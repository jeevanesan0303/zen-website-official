
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import {
  Check,
  CircleHelp,
  Gamepad2,
  Gift,
  Hand,
  Minus,
  Plus,
  Power,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trophy,
  UtensilsCrossed,
  LockKeyhole,
  CheckCircle2,
  Info,
} from 'lucide-react'

import {
  getScratchRewardProducts,
  subscribeMenuCatalog,
  type ScratchRewardProduct,
} from '../../data/menuStore'

import {
  readGameConfig,
  fetchGameConfig,
  saveGameConfig,
  subscribeGameConfig,
  type GameConfig,
  type GamePrize,
} from '../../data/gameStore'

import AdminAlert from '../utils/sweetAlert'

/* ==========================================
   ZEN CAFÉ — GAMES & REWARDS

   IMPORTANT GAME RULE

   scratchCount means the number of FULLY
   COMPLETED scratch-card attempts.

   It does NOT mean:
   - Finger movements
   - Mouse movements
   - Scratch gestures
   - Percentage scratched on one card

   Example:
   scratchCount = 25

   Customer completes 25 separate scratch
   cards before the final result is revealed.

   The customer game and backend must enforce
   the same rule.
========================================== */

type Props = {
  query?: string
}

type CardDraft = {
  cardId: number
  winning: boolean
  productId: string
}

type ScratchGameConfig = GameConfig & {
  scratchCount: number
}

const TOTAL_CARDS = 5
const REQUIRED_WINNERS = 2

const DEFAULT_REQUIRED_ATTEMPTS = 25
const MIN_REQUIRED_ATTEMPTS = 1
const MAX_REQUIRED_ATTEMPTS = 100

const CARD_IMAGES = [
  '/assets/Game/Card/game-1.png.png',
  '/assets/Game/Card/game-2.png.png',
  '/assets/Game/Card/game-3.png.png',
  '/assets/Game/Card/game-4.png.png',
  '/assets/Game/Card/game-5.png.png',
]

const COLORS = {
  primary: '#852B3A',
  primaryDark: '#6B2030',
  heading: '#48282E',
  text: '#88777A',
  border: '#EFE5E2',
  green: '#278157',
  background: '#FFFFFF',
}

const sectionStyle: CSSProperties = {
  background: COLORS.background,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 22,
  boxShadow: '0 5px 20px rgba(65,32,35,0.035)',
}

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 19,
  fontWeight: 750,
  color: COLORS.heading,
}

const descriptionStyle: CSSProperties = {
  margin: '7px 0 0',
  fontSize: 13,
  lineHeight: 1.7,
  color: COLORS.text,
}

const primaryButtonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  padding: '13px 20px',
  border: 0,
  borderRadius: 12,
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: 700,
  transition: 'all 0.2s ease',
}

const counterButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: '1px solid #DDC9E3',
  background: '#FFFFFF',
  color: COLORS.heading,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
}

function normalizeAttempts(value: unknown): number {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' &&
          value.trim() !== ''
        ? Number(value)
        : NaN

  if (
    !Number.isInteger(number) ||
    number < MIN_REQUIRED_ATTEMPTS ||
    number > MAX_REQUIRED_ATTEMPTS
  ) {
    return DEFAULT_REQUIRED_ATTEMPTS
  }

  return number
}

function getRequiredAttempts(
  config: GameConfig
): number {
  return normalizeAttempts(
    (
      config as GameConfig & {
        scratchCount?: unknown
      }
    ).scratchCount
  )
}

function configToDraft(
  config: GameConfig,
  products: ScratchRewardProduct[]
): CardDraft[] {
  return Array.from(
    { length: TOTAL_CARDS },
    (_, index) => {
      const cardId = index + 1

      const savedCard = config.cards.find(
        card => card.cardId === cardId
      )

      const winning = savedCard?.prize != null

      const savedProductId =
        savedCard?.prize?.productId || ''

      const validProduct = products.some(
        product => product.id === savedProductId
      )

      return {
        cardId,
        winning,
        productId: validProduct
          ? savedProductId
          : '',
      }
    }
  )
}

function productToPrize(
  product: ScratchRewardProduct
): GamePrize {
  return {
    productId: product.id,
    title: product.name,
    detail:
      product.description ||
      `You've won ${product.name} from Zen Café!`,
    emoji:
      product.kind === 'drink'
        ? '🥤'
        : '🍽️',
  }
}

function formatAttemptLabel(
  count: number
): string {
  return `${count} ${
    count === 1 ? 'attempt' : 'attempts'
  }`
}

export default function Games({
  query: _query = '',
}: Props) {
  const [savedConfig, setSavedConfig] =
    useState<GameConfig>(() => readGameConfig())

  const [products, setProducts] = useState<
    ScratchRewardProduct[]
  >(() => getScratchRewardProducts())

  const [cards, setCards] = useState<CardDraft[]>(
    () =>
      configToDraft(
        readGameConfig(),
        getScratchRewardProducts()
      )
  )

  const [enabled, setEnabled] = useState(
    () => readGameConfig().enabled
  )

  const [
    requiredAttempts,
    setRequiredAttempts,
  ] = useState<number>(
    () => getRequiredAttempts(readGameConfig())
  )

  const [saving, setSaving] = useState(false)

  const savingRef = useRef(false)

  /* ==========================================
     LOAD CONFIGURATION
  ========================================== */

  useEffect(() => {
    let mounted = true

    fetchGameConfig()
      .then(config => {
        if (!mounted) return

        const latestProducts =
          getScratchRewardProducts()

        setProducts(latestProducts)
        setSavedConfig(config)

        setCards(
          configToDraft(
            config,
            latestProducts
          )
        )

        setEnabled(config.enabled)

        setRequiredAttempts(
          getRequiredAttempts(config)
        )
      })
      .catch(error => {
        console.warn(
          'Unable to load game configuration:',
          error
        )
      })

    const unsubscribe = subscribeGameConfig(
      () => {
        if (!mounted || savingRef.current) {
          return
        }

        setSavedConfig(readGameConfig())
      }
    )

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  /* ==========================================
     MENU PRODUCT SUBSCRIPTION
  ========================================== */

  useEffect(() => {
    const refreshProducts = () => {
      setProducts(getScratchRewardProducts())
    }

    return subscribeMenuCatalog(
      refreshProducts
    )
  }, [])

  /* ==========================================
     DERIVED VALUES
  ========================================== */

  const winningCards = useMemo(
    () => cards.filter(card => card.winning),
    [cards]
  )

  const winningCount = winningCards.length

  const losingCount =
    TOTAL_CARDS - winningCount

  const missingPrizeCards = useMemo(
    () =>
      winningCards.filter(
        card =>
          !products.some(
            product =>
              product.id === card.productId
          )
      ),
    [winningCards, products]
  )

  const savedRequiredAttempts =
    getRequiredAttempts(savedConfig)

  const hasChanges = useMemo(() => {
    if (enabled !== savedConfig.enabled) {
      return true
    }

    if (
      requiredAttempts !==
      getRequiredAttempts(savedConfig)
    ) {
      return true
    }

    return cards.some(card => {
      const saved = savedConfig.cards.find(
        item => item.cardId === card.cardId
      )

      const savedWinning =
        saved?.prize != null

      const savedProductId =
        saved?.prize?.productId || ''

      return (
        card.winning !== savedWinning ||
        (card.winning &&
          card.productId !== savedProductId)
      )
    })
  }, [
    cards,
    enabled,
    requiredAttempts,
    savedConfig,
  ])

  /* ==========================================
     REQUIRED COMPLETED ATTEMPTS
  ========================================== */

  function updateRequiredAttempts(
    value: number
  ) {
    if (savingRef.current) return

    if (!Number.isFinite(value)) return

    const next = Math.max(
      MIN_REQUIRED_ATTEMPTS,
      Math.min(
        MAX_REQUIRED_ATTEMPTS,
        Math.round(value)
      )
    )

    setRequiredAttempts(next)
  }

  /* ==========================================
     WINNING CARD SELECTION
  ========================================== */

  function toggleWinner(cardId: number) {
    if (savingRef.current) return

    const selected = cards.find(
      card => card.cardId === cardId
    )

    if (!selected) return

    if (
      !selected.winning &&
      winningCount >= REQUIRED_WINNERS
    ) {
      void AdminAlert.warning(
        'Only Two Winning Cards',
        'You can select only two winning cards. Deselect another winning card first.'
      )
      return
    }

    setCards(previous =>
      previous.map(card =>
        card.cardId === cardId
          ? {
              ...card,
              winning: !card.winning,
              productId: card.winning
                ? ''
                : card.productId,
            }
          : card
      )
    )
  }

  function updatePrize(
    cardId: number,
    productId: string
  ) {
    if (savingRef.current) return

    setCards(previous =>
      previous.map(card =>
        card.cardId === cardId
          ? {
              ...card,
              productId,
            }
          : card
      )
    )
  }

  /* ==========================================
     RESET UNSAVED CHANGES
  ========================================== */

  function resetChanges() {
    if (savingRef.current) return

    const config = savedConfig

    const latestProducts =
      getScratchRewardProducts()

    setProducts(latestProducts)

    setCards(
      configToDraft(
        config,
        latestProducts
      )
    )

    setEnabled(config.enabled)

    setRequiredAttempts(
      getRequiredAttempts(config)
    )
  }

  /* ==========================================
     SAVE GAME SETTINGS
  ========================================== */

  async function handleSave() {
    if (savingRef.current || !hasChanges) {
      return
    }

    if (
      winningCount !== REQUIRED_WINNERS
    ) {
      await AdminAlert.warning(
        'Invalid Winning Cards',
        'Please select exactly two winning cards out of five before saving.'
      )
      return
    }

    if (missingPrizeCards.length > 0) {
      const cardNames = missingPrizeCards
        .map(card => `Card ${card.cardId}`)
        .join(', ')

      await AdminAlert.warning(
        'Reward Selection Required',
        `Please select an available food or drink product for ${cardNames} before saving.`
      )
      return
    }

    if (
      !Number.isInteger(requiredAttempts) ||
      requiredAttempts <
        MIN_REQUIRED_ATTEMPTS ||
      requiredAttempts >
        MAX_REQUIRED_ATTEMPTS
    ) {
      await AdminAlert.warning(
        'Invalid Attempt Count',
        `Enter a number between ${MIN_REQUIRED_ATTEMPTS} and ${MAX_REQUIRED_ATTEMPTS}.`
      )
      return
    }

    savingRef.current = true
    setSaving(true)

    try {
      const confirmed =
        await AdminAlert.confirm(
          'Save Games & Rewards?',
          `Save the five scratch cards, selected rewards, and ${requiredAttempts} required completed scratch-card attempts? The final result must remain locked until the customer finishes all ${requiredAttempts} cards.`,
          'Yes, Save Changes'
        )

      if (!confirmed) return

      const latestProducts =
        getScratchRewardProducts()

      const nextCards = cards.map(card => {
        if (!card.winning) {
          return {
            cardId: card.cardId,
            prize: null,
          }
        }

        const product = latestProducts.find(
          item => item.id === card.productId
        )

        if (!product) {
          throw new Error(
            `Card ${card.cardId} has an unavailable reward. Please select another menu product.`
          )
        }

        return {
          cardId: card.cardId,
          prize: productToPrize(product),
        }
      })

      /*
       * Keep scratchCount for compatibility
       * with the existing gameStore/API.
       *
       * Its intended meaning is now the
       * number of completed scratch cards.
       */

      const nextConfig: ScratchGameConfig = {
        enabled,
        scratchCount: requiredAttempts,
        cards: nextCards,
      }

      await saveGameConfig(nextConfig)

      /*
       * Verify persistence through the API.
       * This does NOT verify that the customer
       * game enforces completed attempts.
       */

      const verifyResponse = await fetch(
        '/api/games/settings',
        {
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      )

      if (!verifyResponse.ok) {
        throw new Error(
          'Unable to verify saved game settings.'
        )
      }

      const verifyData =
        await verifyResponse.json()

      const verifiedConfig =
        verifyData.config ??
        verifyData

      if (
        Number(verifiedConfig.scratchCount) !==
        requiredAttempts
      ) {
        throw new Error(
          'The Games API did not preserve the required attempt count. Update /api/games/settings and gameStore to persist scratchCount correctly.'
        )
      }

      setSavedConfig(nextConfig)
      setProducts(latestProducts)

      await AdminAlert.success(
        'Game Settings Saved',
        `The required completed-attempt setting is saved as ${requiredAttempts}. The customer game and backend must enforce the final reward reveal after ${requiredAttempts} fully completed scratch cards.`
      )
    } catch (error) {
      console.error(
        'Game settings save failed:',
        error
      )

      await AdminAlert.error(
        'Save Failed',
        error instanceof Error
          ? error.message
          : 'Unable to save the game settings.'
      )
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  /* ==========================================
     BUTTON STYLES
  ========================================== */

  const saveButtonStyle: CSSProperties = {
    ...primaryButtonBase,
    background: saving
      ? '#C7B9B9'
      : COLORS.primary,
    cursor:
      saving || !hasChanges
        ? 'not-allowed'
        : 'pointer',
    opacity:
      saving || !hasChanges
        ? 0.55
        : 1,
  }

  const progressPreview = 0

  return (
    <div
      style={{
        display: 'grid',
        gap: 24,
        paddingBottom: 36,
      }}
    >
      {/* =====================================
          PAGE HEADER
      ===================================== */}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <Gamepad2
              size={27}
              color={COLORS.primary}
            />

            <h1
              style={{
                margin: 0,
                fontSize:
                  'clamp(24px, 3vw, 32px)',
                color: COLORS.heading,
              }}
            >
              Games & Rewards
            </h1>
          </div>

          <p style={descriptionStyle}>
            Manage scratch cards, winning
            positions, customer rewards, and
            completed scratch-card requirements.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !hasChanges}
          style={saveButtonStyle}
        >
          <Save size={18} />
          {saving
            ? 'Saving...'
            : 'Save Changes'}
        </button>
      </div>

      {/* =====================================
          SUMMARY CARDS
      ===================================== */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(155px, 1fr))',
          gap: 14,
        }}
      >
        {[
          {
            label: 'Total Cards',
            value: TOTAL_CARDS,
            icon: Gamepad2,
          },
          {
            label: 'Winning Cards',
            value: winningCount,
            icon: Trophy,
          },
          {
            label: 'Losing Cards',
            value: losingCount,
            icon: CircleHelp,
          },
          {
            label: 'Available Rewards',
            value: products.length,
            icon: Gift,
          },
          {
            label: 'Required Attempts',
            value: requiredAttempts,
            icon: Hand,
          },
        ].map(stat => {
          const Icon = stat.icon

          return (
            <div
              key={stat.label}
              style={{
                ...sectionStyle,
                padding: 20,
              }}
            >
              <Icon
                size={22}
                color="#9B4853"
              />

              <div
                style={{
                  fontSize: 29,
                  fontWeight: 800,
                  color: COLORS.heading,
                  marginTop: 10,
                }}
              >
                {stat.value}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: COLORS.text,
                  marginTop: 3,
                }}
              >
                {stat.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* =====================================
          GAME STATUS
      ===================================== */}

      <section style={sectionStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#F9ECEE',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Power
                size={21}
                color={COLORS.primary}
              />
            </div>

            <div>
              <h2 style={headingStyle}>
                Scratch Game Status
              </h2>

              <p style={descriptionStyle}>
                Enable or disable customer
                scratch-card selection.
              </p>
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: saving
                ? 'not-allowed'
                : 'pointer',
              fontWeight: 700,
              color: enabled
                ? '#24734D'
                : '#A15B5B',
            }}
          >
            <input
              type="checkbox"
              checked={enabled}
              disabled={saving}
              onChange={event =>
                setEnabled(
                  event.target.checked
                )
              }
              style={{
                width: 19,
                height: 19,
                accentColor: COLORS.primary,
              }}
            />

            {enabled
              ? 'Game Enabled'
              : 'Game Disabled'}
          </label>
        </div>
      </section>

      {/* =====================================
          COMPLETED ATTEMPT SETTINGS
      ===================================== */}

      <section style={sectionStyle}>
        <div
          style={{
            display: 'flex',
            gap: 13,
            alignItems: 'flex-start',
            marginBottom: 22,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              background: '#F6EAF8',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Hand
              size={23}
              color="#8743A5"
            />
          </div>

          <div>
            <h2 style={headingStyle}>
              Scratch Attempt Settings
            </h2>

            <p style={descriptionStyle}>
              Set how many complete scratch
              cards a customer must finish
              before their final reward is
              revealed.
            </p>
          </div>
        </div>

        <div
          style={{
            background: '#FCF8FD',
            border: '1px solid #EADCEF',
            borderRadius: 16,
            padding: 20,
            display: 'grid',
            gap: 20,
          }}
        >
          {/* COUNT CONTROL */}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.heading,
                }}
              >
                Required Completed Attempts
              </div>

              <p style={descriptionStyle}>
                Default: 25 complete scratch cards
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <button
                type="button"
                disabled={
                  saving ||
                  requiredAttempts <=
                    MIN_REQUIRED_ATTEMPTS
                }
                onClick={() =>
                  updateRequiredAttempts(
                    requiredAttempts - 1
                  )
                }
                aria-label="Decrease required attempts"
                style={counterButtonStyle}
              >
                <Minus size={18} />
              </button>

              <input
                type="number"
                min={MIN_REQUIRED_ATTEMPTS}
                max={MAX_REQUIRED_ATTEMPTS}
                step={1}
                value={requiredAttempts}
                disabled={saving}
                onChange={event => {
                  const value =
                    event.target.valueAsNumber

                  if (
                    Number.isFinite(value)
                  ) {
                    updateRequiredAttempts(value)
                  }
                }}
                aria-label="Required completed scratch-card attempts"
                style={{
                  width: 82,
                  height: 44,
                  textAlign: 'center',
                  borderRadius: 10,
                  border:
                    '1px solid #DDC9E3',
                  background: '#FFFFFF',
                  fontSize: 23,
                  fontWeight: 800,
                  color: COLORS.primary,
                }}
              />

              <button
                type="button"
                disabled={
                  saving ||
                  requiredAttempts >=
                    MAX_REQUIRED_ATTEMPTS
                }
                onClick={() =>
                  updateRequiredAttempts(
                    requiredAttempts + 1
                  )
                }
                aria-label="Increase required attempts"
                style={counterButtonStyle}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* RANGE SLIDER */}

          <input
            type="range"
            min={MIN_REQUIRED_ATTEMPTS}
            max={MAX_REQUIRED_ATTEMPTS}
            step={1}
            value={requiredAttempts}
            disabled={saving}
            onChange={event =>
              updateRequiredAttempts(
                Number(event.target.value)
              )
            }
            aria-label="Adjust required completed attempts"
            style={{
              width: '100%',
              accentColor: COLORS.primary,
              cursor: 'pointer',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: COLORS.text,
            }}
          >
            <span>
              {formatAttemptLabel(
                MIN_REQUIRED_ATTEMPTS
              )}
            </span>

            <span>
              {formatAttemptLabel(
                MAX_REQUIRED_ATTEMPTS
              )}
            </span>
          </div>

          {/* CUSTOMER PROGRESS PREVIEW */}

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #EADCEF',
              borderRadius: 12,
              padding: 16,
              display: 'grid',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <strong
                style={{
                  fontSize: 13,
                  color: COLORS.heading,
                }}
              >
                Customer Attempt Progress Preview
              </strong>

              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: COLORS.primary,
                }}
              >
                {progressPreview} /{' '}
                {requiredAttempts}
              </span>
            </div>

            <div
              style={{
                width: '100%',
                height: 10,
                background: '#EFE4F1',
                borderRadius: 20,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${
                    (progressPreview /
                      requiredAttempts) *
                    100
                  }%`,
                  height: '100%',
                  background: COLORS.primary,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#875A68',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <LockKeyhole size={17} />

              Final reward locked until all{' '}
              {requiredAttempts} attempts
              are completed.
            </div>

            <p
              style={{
                ...descriptionStyle,
                marginTop: 0,
              }}
            >
              Each fully scratched card
              counts as one completed attempt.
              Partial scratching and individual
              finger movements do not increase
              the attempt counter.
            </p>
          </div>

          {/* EXAMPLE FLOW */}

          <div
            style={{
              padding: 16,
              background: '#FFF9F0',
              border: '1px solid #F2E2CD',
              borderRadius: 12,
              display: 'grid',
              gap: 12,
            }}
          >
            <strong
              style={{
                color: COLORS.heading,
                fontSize: 14,
              }}
            >
              How the Customer Game Should Work
            </strong>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 10,
              }}
            >
              {[
                {
                  title: 'Attempt 1',
                  detail:
                    'Fully scratch the first card',
                  icon: Hand,
                },
                {
                  title: `Attempts 2–${Math.max(
                    2,
                    requiredAttempts - 1
                  )}`,
                  detail:
                    'Continue completing cards',
                  icon: RefreshCw,
                },
                {
                  title: `Attempt ${requiredAttempts}`,
                  detail:
                    'Complete the final card',
                  icon: CheckCircle2,
                },
                {
                  title: 'Final Reward',
                  detail:
                    'Reveal the assigned result',
                  icon: Gift,
                },
              ].map((step, index) => {
                const Icon = step.icon

                return (
                  <div
                    key={index}
                    style={{
                      padding: 13,
                      background: '#FFFFFF',
                      border:
                        '1px solid #F0E4D8',
                      borderRadius: 11,
                      display: 'grid',
                      gap: 7,
                    }}
                  >
                    <Icon
                      size={19}
                      color={
                        index === 3
                          ? COLORS.green
                          : COLORS.primary
                      }
                    />

                    <strong
                      style={{
                        fontSize: 13,
                        color: COLORS.heading,
                      }}
                    >
                      {step.title}
                    </strong>

                    <span
                      style={{
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: COLORS.text,
                      }}
                    >
                      {step.detail}
                    </span>
                  </div>
                )
              })}
            </div>

            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: '#936026',
              }}
            >
              This is an admin explanation,
              not a live customer progress
              tracker.
            </p>
          </div>

          {/* UNSAVED COUNT WARNING */}

          {requiredAttempts !==
            savedRequiredAttempts && (
            <div
              style={{
                background: '#FFF3E5',
                color: '#936026',
                borderRadius: 10,
                padding: '11px 13px',
                fontSize: 12,
                fontWeight: 650,
              }}
            >
              Required completed attempts
              changed from{' '}
              {savedRequiredAttempts} to{' '}
              {requiredAttempts}. Save your
              changes to apply this setting.
            </div>
          )}
        </div>
      </section>

      {/* =====================================
          SELECT WINNING CARDS
      ===================================== */}

      <section style={sectionStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={headingStyle}>
              Select Winning Cards
            </h2>

            <p style={descriptionStyle}>
              Choose exactly two winning
              positions from the five cards.
            </p>
          </div>

          <span
            style={{
              background:
                winningCount === REQUIRED_WINNERS
                  ? '#E8F6EE'
                  : '#FFF1E3',
              color:
                winningCount === REQUIRED_WINNERS
                  ? '#24734D'
                  : '#A66B28',
              padding: '9px 13px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {winningCount} /{' '}
            {REQUIRED_WINNERS} Selected
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(145px, 1fr))',
            gap: 14,
          }}
        >
          {cards.map(card => (
            <button
              key={card.cardId}
              type="button"
              disabled={saving}
              onClick={() =>
                toggleWinner(card.cardId)
              }
              aria-pressed={card.winning}
              style={{
                padding: 12,
                borderRadius: 15,
                border: card.winning
                  ? '2px solid #2B9867'
                  : '2px solid #E9E0DD',
                background: card.winning
                  ? '#F0FAF4'
                  : '#FFFCFB',
                cursor: saving
                  ? 'not-allowed'
                  : 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  position: 'relative',
                }}
              >
                <img
                  src={
                    CARD_IMAGES[
                      card.cardId - 1
                    ]
                  }
                  alt={`Scratch card ${card.cardId}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 175,
                    objectFit: 'contain',
                  }}
                />

                {card.winning && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 5,
                      right: 5,
                      width: 27,
                      height: 27,
                      borderRadius: '50%',
                      background: '#2B9867',
                      color: '#FFFFFF',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Check size={17} />
                  </span>
                )}
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontWeight: 800,
                  color: COLORS.heading,
                }}
              >
                Card {card.cardId}
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 12,
                  fontWeight: 700,
                  color: card.winning
                    ? COLORS.green
                    : '#9A888A',
                }}
              >
                {card.winning
                  ? 'Winning Card'
                  : 'Good Luck Next Time!'}
              </div>
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 9,
            marginTop: 18,
            padding: 13,
            background: '#F8F5F4',
            borderRadius: 11,
            color: '#806E70',
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          <Info
            size={17}
            style={{ flexShrink: 0 }}
          />

          These five cards define the
          available winning and losing
          positions. Customers may complete
          multiple scratch attempts, but
          the final result must remain
          hidden until the configured
          attempt requirement is reached.
        </div>
      </section>

      {/* =====================================
          ASSIGN REWARD PRODUCTS
      ===================================== */}

      <section style={sectionStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <Gift
            size={23}
            color={COLORS.primary}
          />

          <h2 style={headingStyle}>
            Assign Reward Products
          </h2>
        </div>

        <p
          style={{
            ...descriptionStyle,
            marginBottom: 20,
          }}
        >
          Select an available menu product
          for each winning card.
        </p>

        {winningCards.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 35,
              borderRadius: 12,
              background: '#FAF6F5',
              color: COLORS.text,
            }}
          >
            <Gift size={30} />

            <p>
              Select your winning cards
              to assign rewards.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 15,
            }}
          >
            {winningCards.map(card => {
              const selectedProduct =
                products.find(
                  product =>
                    product.id ===
                    card.productId
                )

              return (
                <div
                  key={card.cardId}
                  style={{
                    display: 'grid',
                    gap: 13,
                    padding: 18,
                    borderRadius: 13,
                    background: '#FCF8F7',
                    border:
                      '1px solid #F0E4E1',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Trophy
                      size={20}
                      color="#A36B2F"
                    />

                    <strong
                      style={{
                        color: COLORS.heading,
                      }}
                    >
                      Card {card.cardId}
                      {' — '}Winning Reward
                    </strong>
                  </div>

                  <select
                    value={card.productId}
                    disabled={saving}
                    onChange={event =>
                      updatePrize(
                        card.cardId,
                        event.target.value
                      )
                    }
                    style={{
                      width: '100%',
                      padding: '13px 14px',
                      borderRadius: 10,
                      border:
                        '1px solid #DCCBC8',
                      background: '#FFFFFF',
                      color: COLORS.heading,
                      fontSize: 14,
                    }}
                  >
                    <option value="">
                      Select a food or drink
                    </option>

                    {products.map(product => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.name}
                        {' — '}
                        {product.kind === 'food'
                          ? 'Food'
                          : 'Drink'}
                      </option>
                    ))}
                  </select>

                  {selectedProduct ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: 13,
                        color: '#32724D',
                      }}
                    >
                      <ShieldCheck size={18} />

                      Selected:{' '}
                      <strong>
                        {selectedProduct.name}
                      </strong>
                    </div>
                  ) : (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: '#B36B33',
                      }}
                    >
                      Please choose an
                      available menu product
                      for this card.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {products.length === 0 && (
          <p
            style={{
              marginTop: 15,
              padding: 14,
              borderRadius: 10,
              background: '#FFF2E5',
              color: '#9D6030',
              fontSize: 13,
            }}
          >
            No available menu products
            were found. Add or enable
            products in Menu / Products
            first.
          </p>
        )}
      </section>

      {/* =====================================
          GAME RULES
      ===================================== */}

      <section
        style={{
          ...sectionStyle,
          background: '#FFF8ED',
          border: '1px solid #F2E2C7',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Sparkles
            size={21}
            color="#A87530"
          />

          <h2
            style={{
              ...headingStyle,
              fontSize: 17,
              color: '#74502D',
            }}
          >
            Scratch Game Rules
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 15,
            color: '#806D58',
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          <div>
            <UtensilsCrossed
              size={15}
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                marginRight: 7,
              }}
            />
            Only available food and drink
            products can be assigned.
          </div>

          <div>
            <Trophy
              size={15}
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                marginRight: 7,
              }}
            />
            Exactly two of the five card
            positions must contain winning
            rewards.
          </div>

          <div>
            <CircleHelp
              size={15}
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                marginRight: 7,
              }}
            />
            The other three cards display
            "Good Luck Next Time!" when
            the final result is revealed.
          </div>

          <div>
            <Hand
              size={15}
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                marginRight: 7,
              }}
            />
            One completed attempt means
            one fully scratched card,
            regardless of how many finger
            or mouse movements were used.
          </div>

          <div>
            <LockKeyhole
              size={15}
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                marginRight: 7,
              }}
            />
            The final reward must remain
            locked until the customer
            completes all{' '}
            {requiredAttempts} required
            attempts.
          </div>

          <div>
            <CheckCircle2
              size={15}
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                marginRight: 7,
              }}
            />
            A partially scratched card
            must not count as a completed
            attempt.
          </div>

          <div>
            <ShieldCheck
              size={15}
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                marginRight: 7,
              }}
            />
            Customer progress and reward
            eligibility must be verified
            by the backend. Refreshing
            the page must not bypass
            the attempt requirement.
          </div>
        </div>
      </section>

      {/* =====================================
          UNSAVED CHANGES INDICATOR
      ===================================== */}

      {hasChanges && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '13px 16px',
            borderRadius: 12,
            background: '#FFF3E5',
            color: '#936026',
            fontSize: 13,
            fontWeight: 650,
          }}
        >
          <Info size={18} />
          You have unsaved game settings.
          Save your changes before leaving
          this page.
        </div>
      )}

      {/* =====================================
          BOTTOM ACTIONS
      ===================================== */}

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={resetChanges}
          disabled={saving || !hasChanges}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            borderRadius: 11,
            border:
              '1px solid #DAC9C6',
            background: '#FFFFFF',
            color: '#704B50',
            cursor:
              saving || !hasChanges
                ? 'not-allowed'
                : 'pointer',
            opacity:
              saving || !hasChanges
                ? 0.55
                : 1,
          }}
        >
          <RefreshCw size={17} />
          Reset Changes
        </button>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !hasChanges}
          style={saveButtonStyle}
        >
          <Save size={17} />

          {saving
            ? 'Saving...'
            : 'Save Game Settings'}
        </button>
      </div>
    </div>
  )
}
