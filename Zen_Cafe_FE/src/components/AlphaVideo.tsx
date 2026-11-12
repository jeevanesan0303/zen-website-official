import { useCallback, useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react'

/**
 * Transparent video that works on every browser.
 *
 * - Chrome / Edge / Firefox / Android: plays the VP9-alpha WebM directly.
 * - iPhone / iPad / macOS Safari: WebKit cannot render VP9 alpha, so we play a
 *   "stacked alpha" H.264 MP4 (colour on the top half, alpha mask on the bottom
 *   half) in a hidden <video> and composite it onto a WebGL canvas.
 *
 * The real <video> element is always exposed through `videoRef`, so callers can
 * keep controlling playback (play, pause, currentTime, playbackRate, events).
 */

export function needsStackedAlpha(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1)
  const isDesktopSafari =
    /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\/|OPR\/|Android/.test(ua)
  return isIOS || isDesktopSafari
}

type Props = {
  webmSrc: string
  stackedSrc: string
  width: number
  height: number
  className?: string
  poster?: string
  autoPlay?: boolean
  loop?: boolean
  preload?: 'auto' | 'metadata' | 'none'
  videoRef?: MutableRefObject<HTMLVideoElement | null>
}

const HIDDEN_VIDEO_STYLE: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none',
}

const VERTEX_SHADER = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main(){
  v_uv = vec2((a_pos.x + 1.0) * 0.5, (1.0 - a_pos.y) * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_tex;
varying vec2 v_uv;
void main(){
  float y = clamp(v_uv.y, 0.002, 0.998) * 0.5;
  vec3 color = texture2D(u_tex, vec2(v_uv.x, y)).rgb;
  float alpha = texture2D(u_tex, vec2(v_uv.x, y + 0.5)).r;
  gl_FragColor = vec4(color * alpha, alpha);
}`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

export default function AlphaVideo({
  webmSrc,
  stackedSrc,
  width,
  height,
  className,
  poster,
  autoPlay = false,
  loop = false,
  preload = 'auto',
  videoRef,
}: Props) {
  const [stacked] = useState(needsStackedAlpha)
  const [hasFrame, setHasFrame] = useState(false)
  const innerVideoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const setVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      innerVideoRef.current = el
      if (videoRef) videoRef.current = el
    },
    [videoRef]
  )

  // Autoplay can be refused (e.g. iOS Low Power Mode). Retry on the first touch.
  useEffect(() => {
    const video = innerVideoRef.current
    if (!autoPlay || !video) return
    const retry = () => {
      video.muted = true
      video.play().catch(() => {})
    }
    video.muted = true
    video.play().catch(() => {
      window.addEventListener('touchstart', retry, { once: true, passive: true })
      window.addEventListener('pointerdown', retry, { once: true })
    })
    return () => {
      window.removeEventListener('touchstart', retry)
      window.removeEventListener('pointerdown', retry)
    }
  }, [autoPlay])

  // WebGL compositor for the stacked-alpha MP4.
  useEffect(() => {
    if (!stacked) return
    const video = innerVideoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
    if (!gl) return

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    const program = gl.createProgram()
    if (!vs || !fs || !program) return
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.clearColor(0, 0, 0, 0)

    let raf = 0
    let firstFrame = false

    const draw = () => {
      if (video.readyState < 2 || !video.videoWidth) return
      const w = video.videoWidth
      const h = video.videoHeight >> 1
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      } catch {
        return
      }
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (!firstFrame) {
        firstFrame = true
        setHasFrame(true)
      }
    }

    const tick = () => {
      draw()
      raf = requestAnimationFrame(tick)
    }
    const start = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      draw()
    }

    video.addEventListener('playing', start)
    video.addEventListener('play', start)
    video.addEventListener('pause', stop)
    video.addEventListener('ended', stop)
    video.addEventListener('seeked', draw)
    video.addEventListener('loadeddata', draw)
    if (!video.paused) start()
    else draw()

    return () => {
      cancelAnimationFrame(raf)
      video.removeEventListener('playing', start)
      video.removeEventListener('play', start)
      video.removeEventListener('pause', stop)
      video.removeEventListener('ended', stop)
      video.removeEventListener('seeked', draw)
      video.removeEventListener('loadeddata', draw)
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [stacked])

  if (!stacked) {
    return (
      <video
        ref={setVideo}
        className={className}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted
        playsInline
        preload={preload}
        controls={false}
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src={webmSrc} type="video/webm" />
      </video>
    )
  }

  return (
    <>
      <video
        ref={setVideo}
        style={HIDDEN_VIDEO_STYLE}
        src={stackedSrc}
        autoPlay={autoPlay}
        loop={loop}
        muted
        playsInline
        preload={preload}
        controls={false}
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
      />
      {poster && !hasFrame && (
        <img src={poster} alt="" aria-hidden="true" className={className} draggable={false} />
      )}
      <canvas
        ref={canvasRef}
        className={className}
        width={width}
        height={height}
        aria-hidden="true"
        style={poster && !hasFrame ? { position: 'absolute', inset: 0, visibility: 'hidden' } : undefined}
      />
    </>
  )
}
