
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  ChefHat,
  DoorOpen,
  Gamepad2,
  Gift,
  Home,
  Images,
  MapPin,
  Menu as MenuIcon,
  Sparkles,
  UserPlus,
  UtensilsCrossed,
  X,
} from 'lucide-react'

import ThemeToggle from './components/ThemeToggle'
import { useSiteTheme } from './theme'

import {
  readGameConfig,
  fetchGameConfig,
  subscribeGameConfig,
  DEFAULT_SCRATCH_COUNT,
  MIN_SCRATCH_COUNT,
  MAX_SCRATCH_COUNT,
  type GameConfig,
  type GamePrize,
} from './data/gameStore'

import './games.css'

/* =========================================================
   ZEN CAFÉ — SCRATCH & WIN

   CUSTOMER FLOW

   1. Customer selects one of five cards.
   2. The selected card flips.
   3. Customer scratches one continuous surface.
   4. Scratch movements are counted internally.
   5. No scratch counter is displayed.
   6. The result appears automatically when the
      configured scratch requirement is reached.

   IMPORTANT

   The customer does not need to release their
   finger or mouse after every scratch.

   The coating uses scratch-mark rendering rather
   than fully erasing itself before the result is
   unlocked. This prevents the empty-card problem.
========================================================= */

const SCRATCH_WIDTH = 480
const SCRATCH_HEIGHT = 280

/*
   Each meaningful 65px of scratch movement counts
   as one internal scratch unit.

   With the default requirement of 25:
   25 × 65 = 1625 canvas pixels of movement.

   Movement is measured in canvas coordinates,
   so the interaction behaves consistently on
   desktop and mobile.
*/

const DISTANCE_PER_SCRATCH = 65

/*
   Avoid counting tiny movements and jitter.
*/

const MIN_POINTER_MOVEMENT = 1.5

/*
   Limit large pointer jumps so a single
   browser event cannot generate excessive
   scratch progress.
*/

const MAX_SEGMENT_DISTANCE = 90

/*
   Brush sizes for the scratch effect.
*/

const SCRATCH_BRUSH_SIZE = 24

const cards = [
  {
    image: '/assets/Game/Card/game-1.png.png',
    position: '50% 35%',
    color: '#f45bdd',
    rgb: '244 91 221',
  },
  {
    image: '/assets/Game/Card/game-2.png.png',
    position: '50% 35%',
    color: '#40c9ff',
    rgb: '64 201 255',
  },
  {
    image: '/assets/Game/Card/game-3.png.png',
    position: '72% 42%',
    color: '#f6b64f',
    rgb: '246 182 79',
  },
  {
    image: '/assets/Game/Card/game-4.png.png',
    position: '50% 38%',
    color: '#ff627c',
    rgb: '255 98 124',
  },
  {
    image: '/assets/Game/Card/game-5.png.png',
    position: '50% 38%',
    color: '#80b9ff',
    rgb: '128 185 255',
  },
]

const navLinks = [
  {
    label: 'Home',
    href: '/#home',
    icon: Home,
  },
  {
    label: 'Our Menu',
    href: '/#menu',
    icon: UtensilsCrossed,
  },
  {
    label: 'Party Room',
    href: '/#room-booking',
    icon: DoorOpen,
  },
  {
    label: 'Gallery',
    href: '/gallery.html',
    icon: Images,
  },
  {
    label: 'Contact',
    href: '/#contact',
    icon: MapPin,
  },
] as const

const extraLinks = [
  {
    label: 'Offers',
    href: '/offers.html',
    icon: Gift,
  },
  {
    label: 'Register',
    href: '/register.html',
    icon: UserPlus,
  },
  {
    label: 'Zen Kitchen',
    href: '/zen-kitchen.html',
    icon: ChefHat,
  },
] as const

const floatingItems = [
  {
    emoji: '🎲',
    x: 12,
    y: 17,
    size: 30,
    delay: -2,
  },
  {
    emoji: '🎮',
    x: 91,
    y: 37,
    size: 34,
    delay: -6,
  },
  {
    emoji: '✨',
    x: 6,
    y: 61,
    size: 23,
    delay: -3,
  },
  {
    emoji: '🎲',
    x: 87,
    y: 67,
    size: 32,
    delay: -8,
  },
  {
    emoji: '🕹️',
    x: 8,
    y: 87,
    size: 26,
    delay: -5,
  },
  {
    emoji: '👾',
    x: 92,
    y: 91,
    size: 25,
    delay: -10,
  },
]

const confettiColors = [
  '#d88aff',
  '#6cdbff',
  '#ffd279',
  '#ff79bd',
  '#a794ff',
  '#ffffff',
]

type Point = {
  x: number
  y: number
}

type GameResult =
  | {
      kind: 'win'
      offer: GamePrize
    }
  | {
      kind: 'lose'
    }

type GamePhase =
  | 'intro'
  | 'spread'
  | 'choose'
  | 'centering'
  | 'flipping'
  | 'scratch'
  | 'revealed'

type ScratchCardProps = {
  result: GameResult
  enabled: boolean
  revealed: boolean
  requiredScratches: number
  onReveal: () => void
}

/* =========================================================
   GAME CONFIGURATION
========================================================= */

function getRequiredScratches(
  config: GameConfig
): number {
  const count = config.scratchCount

  if (
    !Number.isInteger(count) ||
    count < MIN_SCRATCH_COUNT ||
    count > MAX_SCRATCH_COUNT
  ) {
    return DEFAULT_SCRATCH_COUNT
  }

  return count
}

/*
   Preserve the admin-defined winning cards.

   A card with a configured prize wins.
   A card without a prize loses.
*/

function createResult(
  cardIndex: number,
  config: GameConfig
): GameResult {
  const cardId = cardIndex + 1

  const selectedCard = config.cards.find(
    card => card.cardId === cardId
  )

  if (
    !config.enabled ||
    !selectedCard?.prize
  ) {
    return {
      kind: 'lose',
    }
  }

  return {
    kind: 'win',
    offer: {
      ...selectedCard.prize,
    },
  }
}

/* =========================================================
   BACKGROUND
========================================================= */

function GamingBackground() {
  return (
    <div
      className="zg-background"
      aria-hidden="true"
    >
      <div className="zg-grid" />

      <div className="zg-orb zg-orb-purple" />
      <div className="zg-orb zg-orb-blue" />
      <div className="zg-orb zg-orb-pink" />

      <div className="zg-scene">
        <div className="zg-scene-wall" />

        <div className="zg-scene-posters">
          {cards
            .slice(0, 3)
            .map((card, index) => (
              <div
                className="zg-scene-poster"
                key={index}
              >
                <img
                  src={card.image}
                  alt=""
                  draggable={false}
                />
              </div>
            ))}
        </div>

        <div className="zg-scene-monitor">
          <div className="zg-monitor-screen">
            <img
              src={cards[4].image}
              alt=""
              draggable={false}
            />
          </div>

          <span className="zg-monitor-neck" />
          <span className="zg-monitor-base" />
        </div>

        <div className="zg-scene-warrior">
          <img
            src={cards[1].image}
            alt=""
            draggable={false}
          />
        </div>

        <div className="zg-scene-sign">
          <strong>ZEN</strong>
          <span>PLAY LOUNGE</span>
          <small>JAFFNA</small>
        </div>

        <div className="zg-scene-floor" />
        <div className="zg-scene-fade" />
      </div>

      <div className="zg-neon-trails">
        {Array.from(
          { length: 6 },
          (_, index) => (
            <span
              key={index}
              className={`zg-neon-trail trail-${index % 3}`}
              style={{
                top: `${17 + index * 15}%`,
                animationDelay:
                  `${-index * 3.1}s`,
                animationDuration:
                  `${15 + index * 1.4}s`,
                animationDirection:
                  index % 2
                    ? 'reverse'
                    : 'normal',
              }}
            />
          )
        )}
      </div>

      <div className="zg-floating-items">
        {floatingItems.map(
          (item, index) => (
            <span
              key={index}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                fontSize:
                  `${item.size}px`,
                animationDelay:
                  `${item.delay}s`,
                animationDuration:
                  `${11 + index}s`,
              }}
            >
              {item.emoji}
            </span>
          )
        )}
      </div>

      <div className="zg-sparks">
        {Array.from(
          { length: 16 },
          (_, index) => (
            <i
              key={index}
              style={{
                left:
                  `${(index * 31 + 7) % 100}%`,
                top:
                  `${(index * 23 + 9) % 100}%`,
                animationDelay:
                  `${-(index % 7)}s`,
                animationDuration:
                  `${4 + (index % 4)}s`,
              }}
            />
          )
        )}
      </div>
    </div>
  )
}

/* =========================================================
   WIN CELEBRATION
========================================================= */

function WinCelebration() {
  return (
    <div
      className="zg-celebration"
      aria-hidden="true"
    >
      <div className="zg-celebration-glow" />

      {Array.from(
        { length: 64 },
        (_, index) => {
          const style = {
            left:
              `${(index * 37 + 11) % 100}%`,
            width:
              `${6 + (index % 5)}px`,
            height:
              `${9 + (index % 7)}px`,
            backgroundColor:
              confettiColors[
                index %
                  confettiColors.length
              ],
            borderRadius:
              index % 3 === 0
                ? '50%'
                : '2px',
            animationDelay:
              `${(index % 12) * 0.055}s`,
            animationDuration:
              `${2.6 + (index % 6) * 0.22}s`,
            '--drift':
              `${((index * 29) % 220) - 110}px`,
            '--spin':
              `${
                index % 2 === 0
                  ? 720
                  : -720
              }deg`,
          } as CSSProperties

          return (
            <span
              key={index}
              className="zg-confetti"
              style={style}
            />
          )
        }
      )}
    </div>
  )
}

/* =========================================================
   SCRATCH CARD

   CORRECTED INTERACTION

   - One card.
   - One continuous scratch surface.
   - Mouse and touch supported.
   - No customer-facing scratch count.
   - No progress bar.
   - No "clear card" button.
   - Continuous movement counts.
   - Automatic result reveal.
========================================================= */

function ScratchCard({
  result,
  enabled,
  revealed,
  requiredScratches,
  onReveal,
}: ScratchCardProps) {
  const canvasRef =
    useRef<HTMLCanvasElement>(null)

  const activePointerRef =
    useRef<number | null>(null)

  const previousPointRef =
    useRef<Point | null>(null)

  const totalDistanceRef =
    useRef(0)

  const completedRef =
    useRef(false)

  const revealTimerRef =
    useRef<number | null>(null)

  const onRevealRef =
    useRef(onReveal)

  const [finishing, setFinishing] =
    useState(false)

  const [
    canvasUnavailable,
    setCanvasUnavailable,
  ] = useState(false)

  /*
     Keep callback current without
     restarting the scratch surface.
  */

  useEffect(() => {
    onRevealRef.current = onReveal
  }, [onReveal])

  const target = Math.max(
    MIN_SCRATCH_COUNT,
    Math.min(
      MAX_SCRATCH_COUNT,
      Number.isFinite(requiredScratches)
        ? Math.round(requiredScratches)
        : DEFAULT_SCRATCH_COUNT
    )
  )

  /*
     This is the total movement needed
     to reveal the result.
  */

  const requiredDistance =
    target * DISTANCE_PER_SCRATCH

  /* -------------------------------------------------------
     DRAW SCRATCH COATING
  ------------------------------------------------------- */

  const drawCoating = useCallback(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    const context =
      canvas.getContext('2d')

    if (!context) {
      setCanvasUnavailable(true)
      return
    }

    setCanvasUnavailable(false)

    context.globalCompositeOperation =
      'source-over'

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    )

    const gradient =
      context.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height
      )

    gradient.addColorStop(
      0,
      '#7745bd'
    )

    gradient.addColorStop(
      0.3,
      '#b985f0'
    )

    gradient.addColorStop(
      0.55,
      '#e2c9ff'
    )

    gradient.addColorStop(
      1,
      '#8b4bc6'
    )

    context.fillStyle = gradient

    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    )

    /*
       Decorative pattern.
    */

    for (
      let y = 12;
      y < canvas.height;
      y += 22
    ) {
      for (
        let x = 12;
        x < canvas.width;
        x += 22
      ) {
        context.beginPath()

        context.arc(
          x,
          y,
          1.2,
          0,
          Math.PI * 2
        )

        context.fillStyle =
          'rgba(50, 20, 90, 0.14)'

        context.fill()
      }
    }

    /*
       Inner border.
    */

    context.strokeStyle =
      'rgba(255,255,255,0.5)'

    context.lineWidth = 1

    context.strokeRect(
      18,
      18,
      canvas.width - 36,
      canvas.height - 36
    )

    context.textAlign = 'center'
    context.fillStyle = '#35204f'

    context.font =
      '600 14px system-ui'

    context.fillText(
      'ZEN LUCKY TABLE',
      canvas.width / 2,
      63
    )

    context.font =
      '34px Georgia'

    context.fillText(
      'Scratch & discover',
      canvas.width / 2,
      124
    )

    context.font =
      '600 17px system-ui'

    context.fillText(
      'SCRATCH HERE',
      canvas.width / 2,
      166
    )

    context.font =
      '14px system-ui'

    context.fillText(
      'Your surprise is waiting',
      canvas.width / 2,
      196
    )

    context.font =
      '22px Georgia'

    context.fillText(
      '✦',
      canvas.width / 2,
      237
    )
  }, [])

  /* -------------------------------------------------------
     INITIALIZE SCRATCH ROUND
  ------------------------------------------------------- */

  useEffect(() => {
    totalDistanceRef.current = 0

    completedRef.current = false

    activePointerRef.current = null

    previousPointRef.current = null

    drawCoating()

    return () => {
      if (
        revealTimerRef.current !== null
      ) {
        window.clearTimeout(
          revealTimerRef.current
        )

        revealTimerRef.current = null
      }
    }
  }, [drawCoating])

  /* -------------------------------------------------------
     POINTER COORDINATES

     Works with:
     - Mouse
     - Touchscreen
     - Apple Pencil / stylus
  ------------------------------------------------------- */

  const getPointerPoint = (
    event:
      ReactPointerEvent<HTMLCanvasElement>
  ): Point | null => {
    const canvas = canvasRef.current

    if (!canvas) return null

    const rect =
      canvas.getBoundingClientRect()

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return null
    }

    const x =
      (
        (event.clientX - rect.left) /
        rect.width
      ) * canvas.width

    const y =
      (
        (event.clientY - rect.top) /
        rect.height
      ) * canvas.height

    return {
      x: Math.max(
        0,
        Math.min(canvas.width, x)
      ),

      y: Math.max(
        0,
        Math.min(canvas.height, y)
      ),
    }
  }

  /* -------------------------------------------------------
     FINISH GAME

     Called only after the configured
     scratch distance is completed.
  ------------------------------------------------------- */

  const finishGame = () => {
    if (completedRef.current) {
      return
    }

    completedRef.current = true

    activePointerRef.current = null

    previousPointRef.current = null

    setFinishing(true)

    const canvas = canvasRef.current

    const context =
      canvas?.getContext('2d')

    if (canvas && context) {
      context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      )
    }

    if (
      revealTimerRef.current !== null
    ) {
      window.clearTimeout(
        revealTimerRef.current
      )
    }

    revealTimerRef.current =
      window.setTimeout(() => {
        revealTimerRef.current = null

        onRevealRef.current()
      }, 350)
  }

  /* -------------------------------------------------------
     DRAW SCRATCH MARKS

     IMPORTANT:

     Instead of erasing the coating
     completely, we draw realistic
     scratch marks over it.

     This ensures the customer never
     sees an empty card while the
     reward is still locked.
  ------------------------------------------------------- */

  const drawScratchStroke = (
    from: Point,
    to: Point
  ) => {
    const canvas = canvasRef.current

    const context =
      canvas?.getContext('2d')

    if (!context) return

    context.save()

    context.globalCompositeOperation =
      'source-over'

    /*
       Main scratch mark.
    */

    context.beginPath()

    context.moveTo(
      from.x,
      from.y
    )

    context.lineTo(
      to.x,
      to.y
    )

    context.lineWidth =
      SCRATCH_BRUSH_SIZE

    context.lineCap = 'round'
    context.lineJoin = 'round'

    context.strokeStyle =
      'rgba(52, 22, 87, 0.52)'

    context.stroke()

    /*
       Metallic highlight.
    */

    context.beginPath()

    context.moveTo(
      from.x,
      from.y
    )

    context.lineTo(
      to.x,
      to.y
    )

    context.lineWidth = 5

    context.strokeStyle =
      'rgba(245, 222, 255, 0.42)'

    context.stroke()

    context.restore()
  }

  /* -------------------------------------------------------
     COUNT SCRATCH MOVEMENT

     This is the main correction.

     Previous code:
       +1 only on pointer release.

     Corrected code:
       Movement accumulates continuously.

     Example:
       65px  = 1 scratch unit
       130px = 2 scratch units
       325px = 5 scratch units

     A continuous drag can complete
     the entire requirement.
  ------------------------------------------------------- */

  const processScratchMovement = (
    event:
      ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      !enabled ||
      revealed ||
      finishing ||
      completedRef.current
    ) {
      return
    }

    const point =
      getPointerPoint(event)

    if (!point) return

    const previous =
      previousPointRef.current

    if (!previous) {
      previousPointRef.current =
        point

      return
    }

    const dx =
      point.x - previous.x

    const dy =
      point.y - previous.y

    const rawDistance =
      Math.hypot(dx, dy)

    if (
      rawDistance <
      MIN_POINTER_MOVEMENT
    ) {
      return
    }

    /*
       Ignore large pointer jumps
       for progress calculation.
    */

    const distance =
      Math.min(
        rawDistance,
        MAX_SEGMENT_DISTANCE
      )

    /*
       Draw the visual scratch effect.
    */

    drawScratchStroke(
      previous,
      point
    )

    previousPointRef.current =
      point

    /*
       Add movement to the hidden
       scratch distance.
    */

    totalDistanceRef.current +=
      distance

    /*
       Reveal immediately when
       the target is reached.
    */

    if (
      totalDistanceRef.current >=
      requiredDistance
    ) {
      finishGame()
    }
  }

  /* -------------------------------------------------------
     START SCRATCHING
  ------------------------------------------------------- */

  const startScratching = (
    event:
      ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      !enabled ||
      revealed ||
      finishing ||
      completedRef.current ||
      canvasUnavailable ||
      !event.isPrimary ||
      activePointerRef.current !== null
    ) {
      return
    }

    /*
       Ignore secondary mouse buttons.
       Touch and pen input remain allowed.
    */

    if (
      event.pointerType === 'mouse' &&
      event.button !== 0
    ) {
      return
    }

    const point =
      getPointerPoint(event)

    if (!point) return

    event.preventDefault()

    activePointerRef.current =
      event.pointerId

    previousPointRef.current =
      point

    try {
      event.currentTarget
        .setPointerCapture(
          event.pointerId
        )
    } catch {
      /*
         Continue without pointer
         capture if unavailable.
      */
    }
  }

  /* -------------------------------------------------------
     MOVE POINTER

     Scratch progress is calculated
     HERE, not on pointer release.
  ------------------------------------------------------- */

  const moveScratching = (
    event:
      ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      activePointerRef.current !==
        event.pointerId ||
      completedRef.current
    ) {
      return
    }

    event.preventDefault()

    processScratchMovement(event)
  }

  /* -------------------------------------------------------
     STOP POINTER

     No additional scratch count
     is required here.
  ------------------------------------------------------- */

  const stopScratching = (
    event:
      ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      activePointerRef.current !==
      event.pointerId
    ) {
      return
    }

    if (
      event.type === 'pointerup' &&
      !completedRef.current
    ) {
      processScratchMovement(event)
    }

    activePointerRef.current = null

    previousPointRef.current = null

    try {
      if (
        event.currentTarget
          .hasPointerCapture(
            event.pointerId
          )
      ) {
        event.currentTarget
          .releasePointerCapture(
            event.pointerId
          )
      }
    } catch {
      /*
         Capture may already
         have been released.
      */
    }
  }

  /* -------------------------------------------------------
     KEYBOARD ACCESSIBILITY

     The keyboard button is visually
     hidden, but remains available
     to keyboard users.
  ------------------------------------------------------- */

  const keyboardScratch = () => {
    if (
      !enabled ||
      revealed ||
      finishing ||
      completedRef.current ||
      canvasUnavailable
    ) {
      return
    }

    const canvas = canvasRef.current

    if (!canvas) return

    const currentUnit =
      Math.floor(
        totalDistanceRef.current /
        DISTANCE_PER_SCRATCH
      )

    const row =
      Math.floor(
        currentUnit / 6
      )

    const column =
      currentUnit % 6

    const from: Point = {
      x: 25 + column * 65,
      y: 35 + (row % 4) * 60,
    }

    const to: Point = {
      x: Math.min(
        SCRATCH_WIDTH - 15,
        from.x + 65
      ),
      y: from.y,
    }

    drawScratchStroke(
      from,
      to
    )

    totalDistanceRef.current +=
      DISTANCE_PER_SCRATCH

    if (
      totalDistanceRef.current >=
      requiredDistance
    ) {
      finishGame()
    }
  }

  const won =
    result.kind === 'win'

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <div className="zg-scratch-area">
      <div
        className={[
          'zg-ticket',
          revealed
            ? 'is-revealed'
            : '',
          revealed
            ? won
              ? 'is-win'
              : 'is-lose'
            : '',
        ].join(' ')}
      >
        {/* RESULT */}

        {revealed ? (
          <div className="zg-prize">
            <span
              className="zg-prize-emoji"
              aria-hidden="true"
            >
              {won
                ? result.offer.emoji
                : '🥺'}
            </span>

            <span className="zg-eyebrow">
              {won
                ? 'YOU WON!'
                : 'NOT THIS TIME'}
            </span>

            <h3>
              {won
                ? result.offer.title
                : 'Good Luck Next Time!'}
            </h3>

            <p>
              {won
                ? result.offer.detail
                : 'Your next little surprise is waiting.'}
            </p>

            <span className="zg-demo-badge">
              {won
                ? 'Demo reward'
                : 'Another chance awaits'}
            </span>
          </div>
        ) : (
          <div
            className="zg-mystery"
            aria-hidden="true"
          >
            <Sparkles size={28} />

            <strong>
              {finishing
                ? 'Your surprise is ready!'
                : 'Keep scratching'}
            </strong>

            <span>
              {finishing
                ? 'Revealing your little surprise…'
                : 'A little surprise is waiting for you'}
            </span>
          </div>
        )}

        {/* SCRATCH SURFACE */}

        {!revealed && (
          <canvas
            ref={canvasRef}
            width={SCRATCH_WIDTH}
            height={SCRATCH_HEIGHT}
            className="zg-scratch-canvas"
            aria-label="Scratch the card to reveal your surprise"
            role="img"
            style={{
              touchAction: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',

              pointerEvents:
                enabled &&
                !finishing &&
                !canvasUnavailable
                  ? 'auto'
                  : 'none',

              opacity:
                finishing ? 0 : 1,

              transition:
                'opacity 0.35s ease',

              cursor:
                enabled
                  ? 'crosshair'
                  : 'default',
            }}
            onPointerDown={
              startScratching
            }
            onPointerMove={
              moveScratching
            }
            onPointerUp={
              stopScratching
            }
            onPointerCancel={
              stopScratching
            }
            onLostPointerCapture={
              stopScratching
            }
            onContextMenu={event =>
              event.preventDefault()
            }
            onDragStart={event =>
              event.preventDefault()
            }
          />
        )}
      </div>

      {/* CUSTOMER INSTRUCTIONS */}

      {!revealed && (
        <div className="zg-scratch-help">
          <p aria-live="polite">
            {canvasUnavailable
              ? 'Scratch surface unavailable. Please reload.'
              : finishing
                ? 'Revealing your surprise…'
                : 'Scratch the card to discover your surprise.'}
          </p>

          {/* KEYBOARD-ONLY CONTROL */}

          <button
            type="button"
            onClick={keyboardScratch}
            disabled={
              !enabled ||
              finishing ||
              canvasUnavailable
            }
            aria-label="Scratch the card using the keyboard"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip:
                'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            Scratch card
          </button>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   MAIN GAME EXPERIENCE
========================================================= */

function GamesExperience() {
  const theme = useSiteTheme()

  const [
    gameConfig,
    setGameConfig,
  ] = useState<GameConfig>(
    () => readGameConfig()
  )

  const [
    roundScratchCount,
    setRoundScratchCount,
  ] = useState<number>(
    () =>
      getRequiredScratches(
        readGameConfig()
      )
  )

  const [
    navOpen,
    setNavOpen,
  ] = useState(false)

  const [
    phase,
    setPhase,
  ] = useState<GamePhase>('intro')

  const [
    selected,
    setSelected,
  ] = useState<number | null>(null)

  const [
    result,
    setResult,
  ] = useState<GameResult | null>(null)

  const [
    round,
    setRound,
  ] = useState(0)

  const selectionLock =
    useRef(false)

  const scratchBackRef =
    useRef<HTMLDivElement>(null)

  const replayRef =
    useRef<HTMLButtonElement>(null)

  const revealed =
    phase === 'revealed'

  const scratchEnabled =
    phase === 'scratch'

  const flipped =
    phase === 'flipping' ||
    phase === 'scratch' ||
    revealed

  const won =
    revealed &&
    result?.kind === 'win'

  const lost =
    revealed &&
    result?.kind === 'lose'

  /* -------------------------------------------------------
     LOAD GAME CONFIGURATION
  ------------------------------------------------------- */

  useEffect(() => {
    let mounted = true

    fetchGameConfig()
      .then(config => {
        if (mounted) {
          setGameConfig(config)
        }
      })
      .catch(error => {
        console.warn(
          'Unable to load game configuration:',
          error
        )
      })

    const unsubscribe =
      subscribeGameConfig(() => {
        if (!mounted) return

        setGameConfig(
          readGameConfig()
        )
      })

    return () => {
      mounted = false

      unsubscribe()
    }
  }, [])

  /* -------------------------------------------------------
     CARD ANIMATION TIMING
  ------------------------------------------------------- */

  useEffect(() => {
    const reducedMotion =
      typeof window.matchMedia ===
        'function' &&
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches

    const transitions: Partial<
      Record<
        GamePhase,
        {
          next: GamePhase
          delay: number
        }
      >
    > = {
      intro: {
        next: 'spread',
        delay: 900,
      },

      spread: {
        next: 'choose',
        delay: 1100,
      },

      centering: {
        next: 'flipping',
        delay: 950,
      },

      flipping: {
        next: 'scratch',
        delay: 1050,
      },
    }

    const transition =
      transitions[phase]

    if (!transition) return

    const timer =
      window.setTimeout(
        () => {
          setPhase(
            transition.next
          )
        },
        reducedMotion
          ? 40
          : transition.delay
      )

    return () => {
      window.clearTimeout(timer)
    }
  }, [phase])

  /* -------------------------------------------------------
     ACCESSIBILITY FOCUS
  ------------------------------------------------------- */

  useEffect(() => {
    if (phase === 'scratch') {
      scratchBackRef.current
        ?.querySelector<HTMLButtonElement>(
          '.zg-scratch-help button'
        )
        ?.focus({
          preventScroll: true,
        })
    }

    if (phase === 'revealed') {
      replayRef.current?.focus({
        preventScroll: true,
      })
    }
  }, [phase])

  /* -------------------------------------------------------
     MOBILE NAVIGATION
  ------------------------------------------------------- */

  useEffect(() => {
    if (!navOpen) return

    const onKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === 'Escape'
      ) {
        setNavOpen(false)
      }
    }

    const onResize = () => {
      if (
        window.innerWidth > 960
      ) {
        setNavOpen(false)
      }
    }

    window.addEventListener(
      'keydown',
      onKeyDown
    )

    window.addEventListener(
      'resize',
      onResize
    )

    return () => {
      window.removeEventListener(
        'keydown',
        onKeyDown
      )

      window.removeEventListener(
        'resize',
        onResize
      )
    }
  }, [navOpen])

  /* -------------------------------------------------------
     SELECT CARD
  ------------------------------------------------------- */

  const chooseCard = (
    index: number
  ) => {
    if (
      phase !== 'choose' ||
      selectionLock.current ||
      !gameConfig.enabled
    ) {
      return
    }

    selectionLock.current =
      true

    const selectedResult =
      createResult(
        index,
        gameConfig
      )

    /*
       Freeze the scratch requirement
       for the current game round.
    */

    setRoundScratchCount(
      getRequiredScratches(
        gameConfig
      )
    )

    setResult(
      selectedResult
    )

    setSelected(index)

    setPhase(
      'centering'
    )
  }

  /* -------------------------------------------------------
     RESET GAME
  ------------------------------------------------------- */

  const resetGame = () => {
    selectionLock.current =
      false

    setSelected(null)

    setResult(null)

    setRound(
      current => current + 1
    )

    setPhase('intro')
  }

  /* -------------------------------------------------------
     REVEAL RESULT
  ------------------------------------------------------- */

  const revealResult = () => {
    setPhase(current =>
      current === 'scratch'
        ? 'revealed'
        : current
    )
  }

  const choosing =
    phase === 'spread' ||
    phase === 'choose'

  const message =
    !gameConfig.enabled &&
    phase === 'choose'
      ? 'The game is temporarily unavailable.'
      : phase === 'intro'
        ? 'Your little adventure begins…'
        : choosing
          ? 'Choose your winning card'
          : phase === 'centering'
            ? 'Your choice. Your moment.'
            : phase === 'flipping'
              ? 'Something is waiting for you.'
              : phase === 'scratch'
                ? 'Scratch & discover your little surprise.'
                : won
                  ? 'A little win. A big celebration.'
                  : 'Your next lucky moment awaits.'

  /* -------------------------------------------------------
     PAGE
  ------------------------------------------------------- */

  return (
    <main
      className="zg-page"
      data-theme={theme}
    >
      <GamingBackground />

      {/* HEADER */}

      <header className="zg-site-header">
        <nav
          className="zg-topbar"
          aria-label="Zen Café navigation"
        >
          <a
            href="/#home"
            className="zg-brand"
          >
            <img
              src="/assets/zen-logo.png"
              alt=""
              className="zg-brand-logo"
            />

            <span>
              <strong>
                ZEN CAFE
              </strong>

              <small>
                JAFFNA
              </small>
            </span>
          </a>

          {/* DESKTOP NAV */}

          <div className="zg-desktop-nav">
            {navLinks.map(
              ({
                label,
                href,
              }) => (
                <a
                  key={label}
                  href={href}
                  className="zg-nav-link"
                >
                  {label}
                </a>
              )
            )}

            <a
              href="#game"
              className="zg-nav-link is-active"
              aria-current="page"
            >
              Games
            </a>
          </div>

          {/* NAV ACTIONS */}

          <div className="zg-nav-actions">
            <ThemeToggle
              className="zg-theme-toggle"
            />

            <a
              href="/offers.html"
              className="zg-offers-button"
            >
              <Gift size={16} />

              <span>
                Offers
              </span>
            </a>

            <button
              type="button"
              className="zg-mobile-toggle"
              onClick={() =>
                setNavOpen(
                  current => !current
                )
              }
              aria-expanded={
                navOpen
              }
              aria-controls="zg-mobile-navigation"
              aria-label={
                navOpen
                  ? 'Close menu'
                  : 'Open menu'
              }
            >
              {navOpen ? (
                <X size={21} />
              ) : (
                <MenuIcon size={21} />
              )}
            </button>
          </div>
        </nav>

        {/* MOBILE NAVIGATION */}

        {navOpen && (
          <>
            <button
              type="button"
              className="zg-nav-backdrop"
              aria-label="Close navigation"
              onClick={() =>
                setNavOpen(false)
              }
            />

            <div
              id="zg-mobile-navigation"
              className="zg-mobile-menu"
            >
              <div className="zg-mobile-menu-head">
                <span>
                  <Gamepad2 size={17} />

                  ZEN PLAY
                </span>

                <Sparkles size={18} />
              </div>

              <div className="zg-mobile-menu-grid">
                {navLinks.map(
                  ({
                    label,
                    href,
                    icon: Icon,
                  }) => (
                    <a
                      key={label}
                      href={href}
                      onClick={() =>
                        setNavOpen(false)
                      }
                    >
                      <Icon size={17} />

                      <span>
                        {label}
                      </span>
                    </a>
                  )
                )}

                <a
                  href="#game"
                  className="is-current"
                  aria-current="page"
                  onClick={() =>
                    setNavOpen(false)
                  }
                >
                  <Gamepad2 size={17} />

                  <span>
                    Games
                  </span>
                </a>
              </div>

              <div className="zg-mobile-extra">
                {extraLinks.map(
                  ({
                    label,
                    href,
                    icon: Icon,
                  }) => (
                    <a
                      key={label}
                      href={href}
                      onClick={() =>
                        setNavOpen(false)
                      }
                    >
                      <Icon size={15} />

                      {label}
                    </a>
                  )
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {/* MAIN CONTENT */}

      <div className="zg-container">
        {/* HERO */}

        <section className="zg-hero">
          <div className="zg-hero-badge">
            <Gamepad2 size={15} />

            <span>
              ZEN LUCKY TABLE
            </span>

            <i aria-hidden="true" />
          </div>

          <h1>
            A little play.

            <br />

            <em>
              A little possibility.
            </em>
          </h1>

          <p>
            Follow your feeling. Pick a card.
            Let your little surprise unfold.
          </p>

          <div className="zg-how-it-works">
            <span>
              Choose a card
            </span>

            <i aria-hidden="true" />

            <span>
              Scratch
            </span>

            <i aria-hidden="true" />

            <span>
              Discover
            </span>
          </div>

          {!gameConfig.enabled && (
            <p
              role="status"
              style={{
                marginTop: 20,
                textAlign: 'center',
                color: '#e2c9ff',
                fontWeight: 600,
              }}
            >
              The scratch card game is
              temporarily unavailable.
              Please check back later.
            </p>
          )}
        </section>

        {/* GAME SHELL */}

        <section
          id="game"
          className={[
            'zg-game-shell',
            `phase-${phase}`,
            won
              ? 'result-win'
              : '',
            lost
              ? 'result-lose'
              : '',
          ].join(' ')}
        >
          <div
            className="zg-table-neon"
            aria-hidden="true"
          >
            <span />
            <span />
          </div>

          {won && (
            <WinCelebration
              key={`celebration-${round}`}
            />
          )}

          {/* GAME HEADING */}

          <div className="zg-game-heading">
            <span className="zg-eyebrow">
              A MOMENT OF LUCK
            </span>

            <h2
              role="status"
              aria-live="polite"
            >
              {choosing &&
              gameConfig.enabled ? (
                <>
                  Choose your{' '}

                  <em>
                    winning card
                  </em>
                </>
              ) : (
                message
              )}
            </h2>

            <div
              className="zg-heading-line"
              aria-hidden="true"
            >
              <span />

              <b>
                ✦
              </b>

              <span />
            </div>
          </div>

          {/* FIVE CARDS */}

          <div className="zg-deal-stage">
            <div
              className="zg-table-glow"
              aria-hidden="true"
            />

            <div
              className="zg-table-floor"
              aria-hidden="true"
            />

            {cards.map(
              (card, index) => {
                const isSelected =
                  selected === index

                if (
                  selected !== null &&
                  !isSelected &&
                  phase !== 'centering'
                ) {
                  return null
                }

                const showBack =
                  isSelected &&
                  flipped

                const canChoose =
                  phase === 'choose' &&
                  gameConfig.enabled

                const cardStyle = {
                  '--card-color':
                    card.color,
                  '--card-rgb':
                    card.rgb,
                } as CSSProperties

                return (
                  <article
                    key={`${round}-${index}`}
                    style={cardStyle}
                    className={[
                      'zg-deal-card',
                      `zg-position-${index}`,
                      index === 2
                        ? 'is-intro-card'
                        : '',
                      isSelected
                        ? 'is-chosen'
                        : '',
                      selected !== null &&
                      !isSelected
                        ? 'is-leaving'
                        : '',
                    ].join(' ')}
                    aria-hidden={
                      phase === 'intro'
                        ? index !== 2
                        : selected !== null &&
                          !isSelected
                    }
                  >
                    <div
                      className="zg-card-ground-glow"
                      aria-hidden="true"
                    />

                    <div
                      className={[
                        'zg-deal-flipper',
                        showBack
                          ? 'is-turned'
                          : '',
                      ].join(' ')}
                    >
                      {/* CARD FRONT */}

                      <button
                        type="button"
                        className="zg-deal-front"
                        disabled={
                          !canChoose
                        }
                        tabIndex={
                          canChoose
                            ? 0
                            : -1
                        }
                        aria-hidden={
                          showBack
                        }
                        aria-label={
                          `Choose mystery card ${index + 1}`
                        }
                        onClick={() =>
                          chooseCard(
                            index
                          )
                        }
                      >
                        <span className="zg-photo">
                          <span
                            className="zg-photo-fallback"
                            aria-hidden="true"
                          >
                            ✦
                          </span>

                          <img
                            src={
                              card.image
                            }
                            alt=""
                            draggable={
                              false
                            }
                            style={{
                              objectPosition:
                                card.position,
                            }}
                            onError={
                              event => {
                                event.currentTarget.style.display =
                                  'none'
                              }
                            }
                          />
                        </span>
                      </button>

                      {/* CARD BACK */}

                      <div
                        ref={
                          isSelected
                            ? scratchBackRef
                            : undefined
                        }
                        className="zg-deal-back"
                        aria-hidden={
                          !scratchEnabled &&
                          !revealed
                        }
                      >
                        {isSelected &&
                          result && (
                            <>
                              <span
                                className="zg-back-emblem"
                                aria-hidden="true"
                              >
                                {revealed &&
                                !won
                                  ? '♡'
                                  : '✦'}
                              </span>

                              <span className="zg-eyebrow">
                                {revealed
                                  ? won
                                    ? 'LUCK LOOKS GOOD ON YOU'
                                    : 'ANOTHER CHANCE AWAITS'
                                  : 'YOUR LITTLE ZEN SURPRISE'}
                              </span>

                              <h3>
                                {revealed
                                  ? won
                                    ? 'Lucky you!'
                                    : 'Good Luck Next Time!'
                                  : 'Scratch & discover.'}
                              </h3>

                              <ScratchCard
                                key={`scratch-${round}`}
                                result={
                                  result
                                }
                                enabled={
                                  scratchEnabled
                                }
                                revealed={
                                  revealed
                                }
                                requiredScratches={
                                  roundScratchCount
                                }
                                onReveal={
                                  revealResult
                                }
                              />

                              <span className="zg-back-signature">
                                with love,
                                Zen Café
                              </span>
                            </>
                          )}
                      </div>
                    </div>
                  </article>
                )
              }
            )}
          </div>

          {/* RESULT CAPTION */}

          <div className="zg-stage-caption">
            {scratchEnabled && (
              <p>
                Scratch the card to
                discover your little
                surprise.
              </p>
            )}

            {revealed &&
              result && (
                <div
                  className={[
                    'zg-result-message',
                    result.kind ===
                    'win'
                      ? 'is-win'
                      : 'is-lose',
                  ].join(' ')}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span
                    className="zg-result-reaction"
                    aria-hidden="true"
                  >
                    {result.kind ===
                    'win'
                      ? '🥳'
                      : '🥺'}
                  </span>

                  <strong>
                    {result.kind ===
                    'win'
                      ? `Hooray! You won ${result.offer.title.toLowerCase()}!`
                      : 'Good Luck Next Time!'}
                  </strong>

                  <p>
                    {result.kind ===
                    'win'
                      ? 'A little luck. A lovely reason to smile.'
                      : 'Your next lucky moment could be one card away.'}
                  </p>

                  <span className="zg-result-note">
                    {result.kind ===
                    'win'
                      ? 'Demo reward — not a redeemable voucher.'
                      : 'Demo game — a fresh chance awaits each round.'}
                  </span>

                  <button
                    ref={replayRef}
                    type="button"
                    className="zg-reset"
                    onClick={
                      resetGame
                    }
                  >
                    {result.kind ===
                    'win'
                      ? 'Play again ↻'
                      : 'Try my luck again ↻'}
                  </button>
                </div>
              )}
          </div>
        </section>

        {/* FOOTER */}

        <footer className="zg-footer">
          <div className="zg-footer-brand">
            <Sparkles size={20} />

            <span>
              <strong>
                ZEN CAFE
              </strong>

              <small>
                JAFFNA
              </small>
            </span>
          </div>

          <p>
            A little play. A little luck.
            A little Zen.
          </p>

          <a href="/#home">
            Back to café →
          </a>
        </footer>
      </div>
    </main>
  )
}

/* =========================================================
   REACT ENTRY
========================================================= */

const rootElement =
  document.getElementById('root')

if (!rootElement) {
  throw new Error(
    'games.html must contain <div id="root"></div>'
  )
}

createRoot(rootElement).render(
  React.createElement(
    GamesExperience
  )
)
