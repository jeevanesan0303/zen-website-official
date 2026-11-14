
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

/* ==========================================
   ZEN CAFÉ — SCRATCH & WIN

   ONE FULLY CLEARED COATING = ONE ATTEMPT

   A reward is revealed only after all
   required completed attempts.
========================================== */

const SCRATCH_WIDTH = 480
const SCRATCH_HEIGHT = 280
const BRUSH_SIZE = 48

/*
  Each coating must be at least 75% cleared.

  This measures transparent pixels, not
  pointer movements or swipe count.
*/
const REQUIRED_CLEAR_PERCENT = 75

/*
  Pixel inspection is relatively expensive.
  Limit inspections during pointer movement.
*/
const COVERAGE_CHECK_INTERVAL_MS = 100

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
  { emoji: '🎲', x: 12, y: 17, size: 30, delay: -2 },
  { emoji: '🎮', x: 91, y: 37, size: 34, delay: -6 },
  { emoji: '✨', x: 6, y: 61, size: 23, delay: -3 },
  { emoji: '🎲', x: 87, y: 67, size: 32, delay: -8 },
  { emoji: '🕹️', x: 8, y: 87, size: 26, delay: -5 },
  { emoji: '👾', x: 92, y: 91, size: 25, delay: -10 },
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

/* ==========================================
   CONFIGURATION
========================================== */

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
  Preserve the existing admin-defined
  winning positions.
*/
function createResult(
  cardIndex: number,
  config: GameConfig
): GameResult {
  const cardId = cardIndex + 1

  const selectedCard = config.cards.find(
    card => card.cardId === cardId
  )

  if (!config.enabled || !selectedCard?.prize) {
    return { kind: 'lose' }
  }

  return {
    kind: 'win',
    offer: { ...selectedCard.prize },
  }
}

/* ==========================================
   GAMING BACKGROUND
========================================== */

function GamingBackground() {
  return (
    <div className="zg-background" aria-hidden="true">
      <div className="zg-grid" />
      <div className="zg-orb zg-orb-purple" />
      <div className="zg-orb zg-orb-blue" />
      <div className="zg-orb zg-orb-pink" />

      <div className="zg-scene">
        <div className="zg-scene-wall" />

        <div className="zg-scene-posters">
          {cards.slice(0, 3).map((card, index) => (
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
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={
              `zg-neon-trail trail-${index % 3}`
            }
            style={{
              top: `${17 + index * 15}%`,
              animationDelay: `${-index * 3.1}s`,
              animationDuration:
                `${15 + index * 1.4}s`,
              animationDirection:
                index % 2 ? 'reverse' : 'normal',
            }}
          />
        ))}
      </div>

      <div className="zg-floating-items">
        {floatingItems.map((item, index) => (
          <span
            key={index}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              fontSize: `${item.size}px`,
              animationDelay: `${item.delay}s`,
              animationDuration: `${11 + index}s`,
            }}
          >
            {item.emoji}
          </span>
        ))}
      </div>

      <div className="zg-sparks">
        {Array.from({ length: 16 }, (_, index) => (
          <i
            key={index}
            style={{
              left: `${(index * 31 + 7) % 100}%`,
              top: `${(index * 23 + 9) % 100}%`,
              animationDelay: `${-(index % 7)}s`,
              animationDuration:
                `${4 + (index % 4)}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* ==========================================
   WIN CELEBRATION
========================================== */

function WinCelebration() {
  return (
    <div
      className="zg-celebration"
      aria-hidden="true"
    >
      <div className="zg-celebration-glow" />

      {Array.from({ length: 64 }, (_, index) => {
        const style = {
          left: `${(index * 37 + 11) % 100}%`,
          width: `${6 + (index % 5)}px`,
          height: `${9 + (index % 7)}px`,
          backgroundColor:
            confettiColors[
              index % confettiColors.length
            ],
          borderRadius:
            index % 3 === 0 ? '50%' : '2px',
          animationDelay:
            `${(index % 12) * 0.055}s`,
          animationDuration:
            `${2.6 + (index % 6) * 0.22}s`,
          '--drift':
            `${((index * 29) % 220) - 110}px`,
          '--spin':
            `${index % 2 === 0 ? 720 : -720}deg`,
        } as CSSProperties

        return (
          <span
            key={index}
            className="zg-confetti"
            style={style}
          />
        )
      })}
    </div>
  )
}

/* ==========================================
   SCRATCH CARD

   IMPORTANT:

   1. Each card coating starts fully covered.
   2. User scratches away the coating.
   3. At 75% clearance, ONE attempt completes.
   4. A fresh coating is drawn.
   5. The reward remains hidden until the
      final required attempt.

   The counter never increments simply
   because a pointer gesture ended.
========================================== */

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

  const completedAttemptsRef = useRef(0)
  const coatingCompletedRef = useRef(false)
  const gameCompletedRef = useRef(false)

  const lastCoverageCheckRef = useRef(0)

  const resetTimerRef =
    useRef<number | null>(null)

  const [completedAttempts, setCompletedAttempts] =
    useState(0)

  const [coatingPercent, setCoatingPercent] =
    useState(0)

  const [coatingChanging, setCoatingChanging] =
    useState(false)

  const [canvasUnavailable, setCanvasUnavailable] =
    useState(false)

  const target = Math.max(
    MIN_SCRATCH_COUNT,
    Math.min(
      MAX_SCRATCH_COUNT,
      Math.round(requiredScratches)
    )
  )

  const remaining = Math.max(
    0,
    target - completedAttempts
  )

  const progress =
    Math.min(
      100,
      (completedAttempts / target) * 100
    )

  /*
    Draw a completely new coating.

    Every new coating is a new attempt.
  */
  const drawCoating = useCallback(
    (attemptNumber: number) => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d', {
        willReadFrequently: true,
      })

      if (!canvas || !context) {
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

      gradient.addColorStop(0, '#7745bd')
      gradient.addColorStop(0.3, '#b985f0')
      gradient.addColorStop(0.55, '#e2c9ff')
      gradient.addColorStop(1, '#8b4bc6')

      context.fillStyle = gradient

      context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      )

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

      context.strokeStyle =
        'rgba(255, 255, 255, 0.5)'

      context.lineWidth = 1

      context.strokeRect(
        18,
        18,
        canvas.width - 36,
        canvas.height - 36
      )

      context.textAlign = 'center'
      context.fillStyle = '#35204f'

      context.font = '600 14px system-ui'

      context.fillText(
        'ZEN LUCKY TABLE',
        canvas.width / 2,
        63
      )

      context.font = '34px Georgia'

      context.fillText(
        'Scratch & discover',
        canvas.width / 2,
        124
      )

      context.font = '600 17px system-ui'

      context.fillText(
        `CARD ${attemptNumber} OF ${target}`,
        canvas.width / 2,
        166
      )

      context.font = '14px system-ui'

      context.fillText(
        'Clear 75% of this card',
        canvas.width / 2,
        196
      )

      context.font = '22px Georgia'

      context.fillText(
        '✦',
        canvas.width / 2,
        237
      )

      context.globalCompositeOperation =
        'destination-out'
    },
    [target]
  )

  /*
    Initialize the first coating.

    A new selected game round remounts
    this component using its React key.
  */
  useEffect(() => {
    completedAttemptsRef.current = 0
    coatingCompletedRef.current = false
    gameCompletedRef.current = false
    activePointerRef.current = null
    previousPointRef.current = null
    lastCoverageCheckRef.current = 0

    drawCoating(1)

    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [drawCoating])

  /*
    Calculate actual cleared pixel coverage.

    Transparent pixels indicate that
    the scratch coating was removed.

    A tap or tiny swipe will not complete
    the coating.
  */
  const calculateClearedPercent = () => {
    const canvas = canvasRef.current

    const context = canvas?.getContext('2d', {
      willReadFrequently: true,
    })

    if (!canvas || !context) {
      return 0
    }

    try {
      const { data } = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      )

      let clearedPixels = 0
      const totalPixels =
        canvas.width * canvas.height

      for (
        let index = 3;
        index < data.length;
        index += 4
      ) {
        if (data[index] < 128) {
          clearedPixels += 1
        }
      }

      return (
        clearedPixels / totalPixels
      ) * 100
    } catch (error) {
      console.error(
        'Unable to measure scratch coverage:',
        error
      )

      return 0
    }
  }

  /*
    Complete exactly one card.

    Prevent duplicate completion from
    pointerup, pointercancel, and
    pointercapture events.
  */
  const completeOneCard = () => {
    if (
      coatingCompletedRef.current ||
      gameCompletedRef.current ||
      !enabled ||
      revealed
    ) {
      return
    }

    coatingCompletedRef.current = true

    const next = Math.min(
      target,
      completedAttemptsRef.current + 1
    )

    completedAttemptsRef.current = next
    setCompletedAttempts(next)

    activePointerRef.current = null
    previousPointRef.current = null

    setCoatingPercent(100)

    if (next >= target) {
      gameCompletedRef.current = true

      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')

      if (canvas && context) {
        context.clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        )
      }

      onReveal()
      return
    }

    /*
      Brief pause so customers can see
      that the current card was completed.

      Then start the next fresh card.
    */
    setCoatingChanging(true)

    resetTimerRef.current =
      window.setTimeout(() => {
        if (gameCompletedRef.current) {
          return
        }

        drawCoating(next + 1)

        coatingCompletedRef.current = false
        lastCoverageCheckRef.current = 0

        setCoatingPercent(0)
        setCoatingChanging(false)

        resetTimerRef.current = null
      }, 450)
  }

  /*
    Inspect the coating while scratching.

    Releasing the finger is NOT required
    for completion.

    Completion depends on actual area
    cleared, not the number of gestures.
  */
  const inspectCoverage = (force = false) => {
    if (
      coatingCompletedRef.current ||
      gameCompletedRef.current ||
      !enabled ||
      revealed
    ) {
      return
    }

    const now = performance.now()

    if (
      !force &&
      now - lastCoverageCheckRef.current <
        COVERAGE_CHECK_INTERVAL_MS
    ) {
      return
    }

    lastCoverageCheckRef.current = now

    const percent =
      calculateClearedPercent()

    setCoatingPercent(
      Math.min(100, Math.round(percent))
    )

    if (
      percent >= REQUIRED_CLEAR_PERCENT
    ) {
      completeOneCard()
    }
  }

  const getPointerPoint = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ): Point | null => {
    const canvas = canvasRef.current

    if (!canvas) {
      return null
    }

    const rect =
      canvas.getBoundingClientRect()

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return null
    }

    return {
      x: Math.max(
        0,
        Math.min(
          canvas.width,
          (
            (event.clientX - rect.left) /
            rect.width
          ) * canvas.width
        )
      ),

      y: Math.max(
        0,
        Math.min(
          canvas.height,
          (
            (event.clientY - rect.top) /
            rect.height
          ) * canvas.height
        )
      ),
    }
  }

  /*
    Erase coating using smooth rounded
    strokes.

    This works with touch, mouse,
    and supported pen input.
  */
  const scratch = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      !enabled ||
      revealed ||
      coatingCompletedRef.current ||
      gameCompletedRef.current ||
      coatingChanging
    ) {
      return
    }

    const canvas = canvasRef.current

    const context = canvas?.getContext('2d', {
      willReadFrequently: true,
    })

    const point = getPointerPoint(event)

    if (
      !canvas ||
      !context ||
      !point
    ) {
      return
    }

    const previous =
      previousPointRef.current ?? point

    context.globalCompositeOperation =
      'destination-out'

    context.lineWidth = BRUSH_SIZE
    context.lineCap = 'round'
    context.lineJoin = 'round'

    context.beginPath()
    context.moveTo(previous.x, previous.y)
    context.lineTo(point.x, point.y)
    context.stroke()

    /*
      Also erase a circle so taps and
      initial pointer contact visually
      affect the coating.

      A single circle is nowhere near
      the 75% completion requirement.
    */
    context.beginPath()

    context.arc(
      point.x,
      point.y,
      BRUSH_SIZE / 2,
      0,
      Math.PI * 2
    )

    context.fillStyle =
      'rgba(0, 0, 0, 1)'

    context.fill()

    previousPointRef.current = point

    inspectCoverage()
  }

  const startScratching = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      !enabled ||
      revealed ||
      coatingChanging ||
      coatingCompletedRef.current ||
      gameCompletedRef.current ||
      canvasUnavailable ||
      !event.isPrimary ||
      event.button !== 0 ||
      activePointerRef.current !== null
    ) {
      return
    }

    event.preventDefault()

    const point = getPointerPoint(event)

    if (!point) {
      return
    }

    activePointerRef.current =
      event.pointerId

    previousPointRef.current = point

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      )
    } catch {
      activePointerRef.current = null
      previousPointRef.current = null
      return
    }

    scratch(event)
  }

  const moveScratching = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      activePointerRef.current !==
      event.pointerId
    ) {
      return
    }

    event.preventDefault()

    scratch(event)
  }

  const stopScratching = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (
      activePointerRef.current !==
      event.pointerId
    ) {
      return
    }

    if (event.type === 'pointerup') {
      scratch(event)

      /*
        Force a final coverage check.
        A card is counted only if
        sufficient coating was removed.
      */
      inspectCoverage(true)
    }

    activePointerRef.current = null
    previousPointRef.current = null

    try {
      if (
        event.currentTarget.hasPointerCapture(
          event.pointerId
        )
      ) {
        event.currentTarget.releasePointerCapture(
          event.pointerId
        )
      }
    } catch {
      // Pointer capture may already be lost.
    }
  }

  const won = result.kind === 'win'

  /*
    Accessibility:

    Keyboard users can progressively
    clear the coating using the button.

    Unlike the old "Scratch next strip"
    control, one press does NOT count
    as one completed attempt.

    The same 75% coverage rule applies.
  */
  const scratchAccessibleArea = () => {
    if (
      !enabled ||
      revealed ||
      coatingChanging ||
      coatingCompletedRef.current ||
      gameCompletedRef.current ||
      canvasUnavailable
    ) {
      return
    }

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', {
      willReadFrequently: true,
    })

    if (!canvas || !context) {
      return
    }

    /*
      Erase one horizontal band at a time.

      Button presses progressively remove
      the coating. The completion threshold
      is checked exactly as for pointer input.
    */
    const currentPercent =
      calculateClearedPercent()

    const bandHeight = 35

    const bandIndex = Math.min(
      Math.floor(
        (currentPercent / 100) *
        (canvas.height / bandHeight)
      ),
      Math.ceil(
        canvas.height / bandHeight
      ) - 1
    )

    context.globalCompositeOperation =
      'destination-out'

    context.clearRect(
      0,
      bandIndex * bandHeight,
      canvas.width,
      bandHeight
    )

    inspectCoverage(true)
  }

  return (
    <div className="zg-scratch-area">
      <div
        className={[
          'zg-ticket',
          revealed ? 'is-revealed' : '',
          revealed
            ? won
              ? 'is-win'
              : 'is-lose'
            : '',
        ].join(' ')}
      >
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
              {coatingChanging
                ? 'Card completed!'
                : 'Keep scratching'}
            </strong>

            <span>
              {coatingChanging
                ? 'Preparing your next card…'
                : `Complete ${target} full cards to unlock your result`}
            </span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={SCRATCH_WIDTH}
          height={SCRATCH_HEIGHT}
          className="zg-scratch-canvas"
          aria-hidden="true"
          style={{
            touchAction: 'none',
            pointerEvents:
              enabled &&
              !revealed &&
              !coatingChanging &&
              !coatingCompletedRef.current
                ? 'auto'
                : 'none',
            opacity:
              coatingChanging ? 0.35 : 1,
            transition: 'opacity 0.2s ease',
          }}
          onPointerDown={startScratching}
          onPointerMove={moveScratching}
          onPointerUp={stopScratching}
          onPointerCancel={stopScratching}
          onLostPointerCapture={stopScratching}
          onContextMenu={event =>
            event.preventDefault()
          }
        />
      </div>

      {/* COMPLETED CARD COUNTER */}

      <div className="zg-scratch-progress">
        <div className="zg-progress-label">
          <span>
            {revealed
              ? 'All cards completed'
              : 'Completed scratch cards'}
          </span>

          <strong>
            {completedAttempts} / {target}
          </strong>
        </div>

        <div
          className="zg-progress-track"
          role="progressbar"
          aria-label="Completed scratch cards"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={completedAttempts}
        >
          <span
            style={{
              width: `${progress}%`,
              transition:
                'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {!revealed && (
        <div className="zg-scratch-help">
          <p aria-live="polite">
            {canvasUnavailable
              ? 'Scratch surface unavailable. Please reload.'
              : coatingChanging
                ? `Card ${completedAttempts} completed! Preparing the next card…`
                : remaining === 1
                  ? 'Final card! Scratch it fully to reveal your surprise.'
                  : `Complete ${remaining} more full scratch cards to unlock your result.`}
          </p>

          <p
            style={{
              marginTop: 8,
              fontSize: 12,
              opacity: 0.8,
            }}
          >
            {coatingChanging
              ? 'Well done!'
              : `Current card cleared: ${coatingPercent}% — ${REQUIRED_CLEAR_PERCENT}% required`}
          </p>

          <button
            type="button"
            disabled={
              !enabled ||
              canvasUnavailable ||
              coatingChanging
            }
            onClick={scratchAccessibleArea}
            title="Progressively clear the current card using the keyboard"
            style={{
              marginTop: 10,
            }}
          >
            Clear card area
          </button>
        </div>
      )}
    </div>
  )
}

/* ==========================================
   MAIN GAMES PAGE
========================================== */

function GamesExperience() {
  const theme = useSiteTheme()

  const [gameConfig, setGameConfig] =
    useState<GameConfig>(
      () => readGameConfig()
    )

  const [roundScratchCount, setRoundScratchCount] =
    useState<number>(
      () => getRequiredScratches(
        readGameConfig()
      )
    )

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

        setGameConfig(readGameConfig())
      })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  const [navOpen, setNavOpen] =
    useState(false)

  const [phase, setPhase] =
    useState<GamePhase>('intro')

  const [selected, setSelected] =
    useState<number | null>(null)

  const [result, setResult] =
    useState<GameResult | null>(null)

  const [round, setRound] =
    useState(0)

  const selectionLock = useRef(false)

  const scratchBackRef =
    useRef<HTMLDivElement>(null)

  const replayRef =
    useRef<HTMLButtonElement>(null)

  const revealed = phase === 'revealed'
  const scratchEnabled = phase === 'scratch'

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

  /* ========================================
     ANIMATION TIMING
  ======================================== */

  useEffect(() => {
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
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

    const transition = transitions[phase]

    if (!transition) return

    const timer = window.setTimeout(
      () => setPhase(transition.next),
      reducedMotion
        ? 40
        : transition.delay
    )

    return () => {
      window.clearTimeout(timer)
    }
  }, [phase])

  /* ========================================
     ACCESSIBILITY FOCUS
  ======================================== */

  useEffect(() => {
    if (phase === 'scratch') {
      scratchBackRef.current
        ?.querySelector<HTMLButtonElement>(
          'button'
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

  /* ========================================
     MOBILE NAVIGATION
  ======================================== */

  useEffect(() => {
    if (!navOpen) return

    const onKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setNavOpen(false)
      }
    }

    const onResize = () => {
      if (window.innerWidth > 960) {
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

  /* ========================================
     CHOOSE CARD
  ======================================== */

  const chooseCard = (index: number) => {
    if (
      phase !== 'choose' ||
      selectionLock.current ||
      !gameConfig.enabled
    ) {
      return
    }

    selectionLock.current = true

    const selectedResult = createResult(
      index,
      gameConfig
    )

    setRoundScratchCount(
      getRequiredScratches(gameConfig)
    )

    setResult(selectedResult)
    setSelected(index)
    setPhase('centering')
  }

  /* ========================================
     RESET GAME
  ======================================== */

  const resetGame = () => {
    selectionLock.current = false

    setSelected(null)
    setResult(null)

    setRound(current => current + 1)
    setPhase('intro')
  }

  /* ========================================
     REVEAL RESULT

     Only the ScratchCard completion
     callback triggers this transition.
  ======================================== */

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
                ? `Complete ${roundScratchCount} full cards. Unlock your luck.`
                : won
                  ? 'A little win. A big celebration.'
                  : 'Your next lucky moment awaits.'

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
              <strong>ZEN CAFE</strong>
              <small>JAFFNA</small>
            </span>
          </a>

          <div className="zg-desktop-nav">
            {navLinks.map(
              ({ label, href }) => (
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

          <div className="zg-nav-actions">
            <ThemeToggle
              className="zg-theme-toggle"
            />

            <a
              href="/offers.html"
              className="zg-offers-button"
            >
              <Gift size={16} />
              <span>Offers</span>
            </a>

            <button
              type="button"
              className="zg-mobile-toggle"
              onClick={() =>
                setNavOpen(current => !current)
              }
              aria-expanded={navOpen}
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
                      <span>{label}</span>
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
                  <span>Games</span>
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

      {/* PAGE CONTENT */}

      <div className="zg-container">
        {/* HERO */}

        <section className="zg-hero">
          <div className="zg-hero-badge">
            <Gamepad2 size={15} />
            <span>ZEN LUCKY TABLE</span>
            <i aria-hidden="true" />
          </div>

          <h1>
            A little play.
            <br />
            <em>A little possibility.</em>
          </h1>

          <p>
            Follow your feeling. Pick a card.
            Let your little surprise unfold.
          </p>

          <div className="zg-how-it-works">
            <span>Choose a card</span>
            <i aria-hidden="true" />
            <span>
              Complete{' '}
              {getRequiredScratches(gameConfig)}{' '}
              scratch cards
            </span>
            <i aria-hidden="true" />
            <span>Discover</span>
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
              The scratch card game is temporarily
              unavailable. Please check back later.
            </p>
          )}
        </section>

        {/* GAME SHELL */}

        <section
          id="game"
          className={[
            'zg-game-shell',
            `phase-${phase}`,
            won ? 'result-win' : '',
            lost ? 'result-lose' : '',
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
                  <em>winning card</em>
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
              <b>✦</b>
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

            {cards.map((card, index) => {
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
                isSelected && flipped

              const canChoose =
                phase === 'choose' &&
                gameConfig.enabled

              const cardStyle = {
                '--card-color': card.color,
                '--card-rgb': card.rgb,
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
                      disabled={!canChoose}
                      tabIndex={
                        canChoose ? 0 : -1
                      }
                      onClick={() =>
                        chooseCard(index)
                      }
                      aria-hidden={showBack}
                      aria-label={
                        `Choose mystery card ${index + 1}`
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
                          src={card.image}
                          alt=""
                          draggable={false}
                          style={{
                            objectPosition:
                              card.position,
                          }}
                          onError={event => {
                            event.currentTarget.style.display =
                              'none'
                          }}
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
                              {revealed && !won
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
                              result={result}
                              enabled={scratchEnabled}
                              revealed={revealed}
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
            })}
          </div>

          {/* RESULT CAPTION */}

          <div className="zg-stage-caption">
            {scratchEnabled && (
              <p>
                Fully scratch{' '}
                {roundScratchCount}{' '}
                cards to unlock your result.
                Each completed card counts
                as one attempt.
              </p>
            )}

            {revealed && result && (
              <div
                className={[
                  'zg-result-message',
                  result.kind === 'win'
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
                  {result.kind === 'win'
                    ? '🥳'
                    : '🥺'}
                </span>

                <strong>
                  {result.kind === 'win'
                    ? `Hooray! You won ${result.offer.title.toLowerCase()}!`
                    : 'Good Luck Next Time!'}
                </strong>

                <p>
                  {result.kind === 'win'
                    ? 'A little luck. A lovely reason to smile.'
                    : 'Your next lucky moment could be one card away.'}
                </p>

                <span className="zg-result-note">
                  {result.kind === 'win'
                    ? 'Demo reward — not a redeemable voucher.'
                    : 'Demo game — a fresh chance awaits each round.'}
                </span>

                <button
                  ref={replayRef}
                  type="button"
                  className="zg-reset"
                  onClick={resetGame}
                >
                  {result.kind === 'win'
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
              <strong>ZEN CAFE</strong>
              <small>JAFFNA</small>
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

/* ==========================================
   MOUNT REACT APPLICATION
========================================== */

const rootElement =
  document.getElementById('root')

if (!rootElement) {
  throw new Error(
    'games.html must contain <div id="root"></div>'
  )
}

createRoot(rootElement).render(
  React.createElement(GamesExperience)
)
