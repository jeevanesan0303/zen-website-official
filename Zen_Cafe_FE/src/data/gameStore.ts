
import { getAdminAuthHeaders } from '../admin-auth'

/* ==========================================
   ZEN CAFÉ — SCRATCH GAME STORE
========================================== */

/*
  GAME RULE

  scratchCount = required number of
  FULLY COMPLETED scratch-card attempts.

  Example:
  scratchCount = 25

  The customer must complete 25 separate
  scratch cards before the final result
  can be revealed.

  One completed card = one attempt.

  Finger movements, mouse movements,
  and partially scratched cards must
  NOT increase the attempt count.

  IMPORTANT:
  This store manages game configuration.
  Customer progress and reward eligibility
  must be enforced by the game backend.
*/

/* ==========================================
   TYPES
========================================== */

export type GamePrize = {
  productId: string
  title: string
  detail: string
  emoji: string
}

export type GameCardConfig = {
  cardId: number
  prize: GamePrize | null
}

export type GameConfig = {
  enabled: boolean

  /*
    Legacy API field name.

    Meaning:
    Required completed scratch-card attempts.

    Retained for compatibility with the
    existing Games API and admin page.
  */
  scratchCount: number

  cards: GameCardConfig[]
}

/* ==========================================
   CONSTANTS
========================================== */

export const GAME_CONFIG_KEY =
  'zen-cafe-scratch-game-v1'

export const GAME_CONFIG_EVENT =
  'zen-cafe-scratch-game-change'

export const DEFAULT_SCRATCH_COUNT = 25

export const MIN_SCRATCH_COUNT = 1

export const MAX_SCRATCH_COUNT = 100

export const TOTAL_GAME_CARDS = 5

export const REQUIRED_WINNING_CARDS = 2

/*
  Clear aliases for new code.

  Existing code can continue using
  DEFAULT_SCRATCH_COUNT and related names.
*/

export const DEFAULT_REQUIRED_ATTEMPTS =
  DEFAULT_SCRATCH_COUNT

export const MIN_REQUIRED_ATTEMPTS =
  MIN_SCRATCH_COUNT

export const MAX_REQUIRED_ATTEMPTS =
  MAX_SCRATCH_COUNT

const GAME_SETTINGS_ENDPOINT =
  '/api/games/settings'

/* ==========================================
   DEFAULT CONFIGURATION
========================================== */

export const DEFAULT_GAME_CONFIG: GameConfig = {
  enabled: true,

  scratchCount: DEFAULT_REQUIRED_ATTEMPTS,

  cards: [
    {
      cardId: 1,
      prize: {
        productId: 'demo-iced-coffee',
        title: 'Iced Coffee',
        detail: 'A cool Zen Café treat.',
        emoji: '🧋',
      },
    },
    {
      cardId: 2,
      prize: null,
    },
    {
      cardId: 3,
      prize: null,
    },
    {
      cardId: 4,
      prize: {
        productId: 'demo-burger',
        title: 'Zen Burger',
        detail: 'A delicious little surprise.',
        emoji: '🍔',
      },
    },
    {
      cardId: 5,
      prize: null,
    },
  ],
}

/* ==========================================
   INTERNAL TYPES
========================================== */

type UnknownRecord = Record<string, unknown>

type GameSettingsResponse = {
  config?: unknown
  enabled?: unknown
  scratchCount?: unknown
  cards?: unknown
  error?: unknown
  message?: unknown
}

/* ==========================================
   BASIC HELPERS
========================================== */

function isRecord(
  value: unknown
): value is UnknownRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isValidScratchCount(
  value: unknown
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_REQUIRED_ATTEMPTS &&
    value <= MAX_REQUIRED_ATTEMPTS
  )
}

/*
  Compatibility helper.

  Invalid values use the default of 25.
*/

export function normalizeScratchCount(
  value: unknown
): number {
  return isValidScratchCount(value)
    ? value
    : DEFAULT_REQUIRED_ATTEMPTS
}

/*
  New descriptive helper.

  Both functions use the same validation.
*/

export function normalizeRequiredAttempts(
  value: unknown
): number {
  return normalizeScratchCount(value)
}

/*
  Read the configured number of completed
  scratch-card attempts.
*/

export function getRequiredScratchAttempts(
  config: GameConfig
): number {
  return normalizeRequiredAttempts(
    config.scratchCount
  )
}

/* ==========================================
   VALIDATE GAME CONFIGURATION
========================================== */

export function isValidGameConfig(
  value: unknown
): value is GameConfig {
  if (!isRecord(value)) {
    return false
  }

  if (
    typeof value.enabled !== 'boolean' ||
    !isValidScratchCount(value.scratchCount) ||
    !Array.isArray(value.cards) ||
    value.cards.length !== TOTAL_GAME_CARDS
  ) {
    return false
  }

  const cardIds = new Set<number>()

  let winningCards = 0

  for (const item of value.cards) {
    if (!isRecord(item)) {
      return false
    }

    const cardId = item.cardId

    if (
      typeof cardId !== 'number' ||
      !Number.isInteger(cardId) ||
      cardId < 1 ||
      cardId > TOTAL_GAME_CARDS ||
      cardIds.has(cardId)
    ) {
      return false
    }

    cardIds.add(cardId)

    const prize = item.prize

    if (prize === null) {
      continue
    }

    winningCards += 1

    if (!isRecord(prize)) {
      return false
    }

    if (
      typeof prize.productId !== 'string' ||
      !prize.productId.trim() ||
      typeof prize.title !== 'string' ||
      !prize.title.trim() ||
      typeof prize.detail !== 'string' ||
      typeof prize.emoji !== 'string'
    ) {
      return false
    }
  }

  return (
    cardIds.size === TOTAL_GAME_CARDS &&
    winningCards === REQUIRED_WINNING_CARDS
  )
}

/* ==========================================
   NORMALIZE LEGACY CONFIGURATION
========================================== */

/*
  Older configurations may not include
  the scratchCount field.

  In that case, the default value of 25
  is applied.

  Explicit invalid values are rejected.

  We do not rename scratchCount in the
  persisted object because the existing
  API expects this field.
*/

export function normalizeGameConfig(
  value: unknown
): GameConfig | null {
  if (!isRecord(value)) {
    return null
  }

  const scratchCount =
    value.scratchCount === undefined
      ? DEFAULT_REQUIRED_ATTEMPTS
      : value.scratchCount

  const normalized: unknown = {
    ...value,
    scratchCount,
  }

  if (!isValidGameConfig(normalized)) {
    return null
  }

  return normalized
}

/* ==========================================
   CONFIGURATION COMPARISON
========================================== */

/*
  Used to verify that the API persisted
  the requested configuration.

  Card order does not affect comparison.
*/

function sameGameConfig(
  first: GameConfig,
  second: GameConfig
): boolean {
  if (
    first.enabled !== second.enabled ||
    first.scratchCount !== second.scratchCount ||
    first.cards.length !== second.cards.length
  ) {
    return false
  }

  return first.cards.every(card => {
    const other = second.cards.find(
      item => item.cardId === card.cardId
    )

    if (!other) {
      return false
    }

    if (
      card.prize === null ||
      other.prize === null
    ) {
      return (
        card.prize === null &&
        other.prize === null
      )
    }

    return (
      card.prize.productId ===
        other.prize.productId &&
      card.prize.title ===
        other.prize.title &&
      card.prize.detail ===
        other.prize.detail &&
      card.prize.emoji ===
        other.prize.emoji
    )
  })
}

/* ==========================================
   STORAGE HELPERS
========================================== */

function notifyGameConfigChange(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new Event(GAME_CONFIG_EVENT)
  )
}

function persistGameConfig(
  config: GameConfig
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      GAME_CONFIG_KEY,
      JSON.stringify(config)
    )
  } catch (error) {
    console.warn(
      'Unable to cache game configuration:',
      error
    )
  }

  notifyGameConfigChange()
}

/* ==========================================
   READ GAME CONFIGURATION
========================================== */

export function readGameConfig(): GameConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_GAME_CONFIG
  }

  try {
    const stored =
      window.localStorage.getItem(
        GAME_CONFIG_KEY
      )

    if (stored) {
      const parsed: unknown =
        JSON.parse(stored)

      const normalized =
        normalizeGameConfig(parsed)

      if (normalized) {
        return normalized
      }
    }
  } catch (error) {
    console.warn(
      'Unable to read game configuration:',
      error
    )
  }

  return DEFAULT_GAME_CONFIG
}

/* ==========================================
   PARSE API RESPONSE
========================================== */

function extractGameConfig(
  response: unknown
): GameConfig | null {
  if (!isRecord(response)) {
    return null
  }

  const data =
    response as GameSettingsResponse

  /*
    Supported API response formats:

    {
      config: {
        enabled,
        scratchCount,
        cards
      }
    }

    OR:

    {
      enabled,
      scratchCount,
      cards
    }
  */

  const rawConfig =
    data.config !== undefined
      ? data.config
      : {
          enabled: data.enabled,
          scratchCount: data.scratchCount,
          cards: data.cards,
        }

  return normalizeGameConfig(rawConfig)
}

/* ==========================================
   READ API ERROR
========================================== */

async function readApiError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const errorData: unknown =
      await response.json()

    if (isRecord(errorData)) {
      if (
        typeof errorData.error === 'string' &&
        errorData.error.trim()
      ) {
        return errorData.error
      }

      if (
        typeof errorData.message === 'string' &&
        errorData.message.trim()
      ) {
        return errorData.message
      }
    }
  } catch {
    // Keep fallback message.
  }

  return fallback
}

/* ==========================================
   FETCH LIVE GAME CONFIGURATION
========================================== */

/*
  Public settings fetch.

  If the network request fails, return
  the most recent locally cached config.

  This fallback is for display/configuration
  only. It must not authorize reward claims.
*/

export async function fetchGameConfig():
  Promise<GameConfig> {
  try {
    const response = await fetch(
      GAME_SETTINGS_ENDPOINT,
      {
        method: 'GET',

        headers: {
          Accept: 'application/json',
        },

        cache: 'no-store',
      }
    )

    if (!response.ok) {
      throw new Error(
        `Unable to fetch game settings (${response.status}).`
      )
    }

    const data: unknown =
      await response.json()

    const config =
      extractGameConfig(data)

    if (!config) {
      throw new Error(
        'The game API returned an invalid configuration.'
      )
    }

    persistGameConfig(config)

    return config
  } catch (error) {
    console.warn(
      'Failed to fetch live game configuration:',
      error
    )

    return readGameConfig()
  }
}

/* ==========================================
   SAVE GAME CONFIGURATION
========================================== */

/*
  Save workflow:

  1. Validate all game settings.
  2. Send authenticated PUT request.
  3. Validate the API response.
  4. Fetch settings again from the server.
  5. Verify that the requested values
     were actually persisted.
  6. Update local cache only after
     successful verification.

  This verifies the configuration only.

  It does NOT prove that the customer
  scratch game counts completed cards.
*/

export async function saveGameConfig(
  config: GameConfig
): Promise<void> {
  if (!isValidGameConfig(config)) {
    throw new Error(
      `Invalid game settings. Exactly ${REQUIRED_WINNING_CARDS} of the ${TOTAL_GAME_CARDS} cards must have valid prizes, and required completed attempts must be between ${MIN_REQUIRED_ATTEMPTS} and ${MAX_REQUIRED_ATTEMPTS}.`
    )
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...getAdminAuthHeaders(),
  }

  let response: Response

  try {
    response = await fetch(
      GAME_SETTINGS_ENDPOINT,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      }
    )
  } catch {
    throw new Error(
      'Unable to connect to the game settings API. Please check your connection and try again.'
    )
  }

  if (!response.ok) {
    const errorMessage =
      await readApiError(
        response,
        'Failed to save game settings.'
      )

    throw new Error(errorMessage)
  }

  /*
    Validate any configuration returned
    directly by the PUT request.
  */

  const responseText =
    await response.text()

  if (responseText.trim()) {
    let responseData: unknown

    try {
      responseData =
        JSON.parse(responseText)
    } catch {
      throw new Error(
        'The game API returned an invalid JSON response.'
      )
    }

    if (isRecord(responseData)) {
      const hasReturnedConfig =
        responseData.config !== undefined ||
        (
          responseData.enabled !== undefined &&
          responseData.cards !== undefined
        )

      if (hasReturnedConfig) {
        const returnedConfig =
          extractGameConfig(responseData)

        if (!returnedConfig) {
          throw new Error(
            'The game API returned invalid saved settings.'
          )
        }

        if (
          !sameGameConfig(
            returnedConfig,
            config
          )
        ) {
          throw new Error(
            'The game API returned settings that do not match the requested configuration. Check backend persistence.'
          )
        }
      }
    }
  }

  /*
    IMPORTANT:

    Do not trust only the PUT success
    response.

    Read the configuration again from
    the server to verify persistence.
  */

  let verifyResponse: Response

  try {
    verifyResponse = await fetch(
      GAME_SETTINGS_ENDPOINT,
      {
        method: 'GET',

        headers: {
          Accept: 'application/json',
          ...getAdminAuthHeaders(),
        },

        cache: 'no-store',
      }
    )
  } catch {
    throw new Error(
      'The save request was accepted, but the saved settings could not be verified. Please reload the settings before trying again.'
    )
  }

  if (!verifyResponse.ok) {
    throw new Error(
      `The save request was accepted, but verification failed (${verifyResponse.status}).`
    )
  }

  let verifyData: unknown

  try {
    verifyData =
      await verifyResponse.json()
  } catch {
    throw new Error(
      'The verification API returned invalid JSON.'
    )
  }

  const verifiedConfig =
    extractGameConfig(verifyData)

  if (!verifiedConfig) {
    throw new Error(
      'The verification API returned invalid game settings.'
    )
  }

  if (
    !sameGameConfig(
      verifiedConfig,
      config
    )
  ) {
    throw new Error(
      'The Games API did not persist all requested settings. Verify that the backend supports scratchCount as the required completed-attempt count.'
    )
  }

  /*
    Persist only the verified server
    configuration.

    This cache is not an authoritative
    record of customer attempts.
  */

  persistGameConfig(verifiedConfig)
}

/* ==========================================
   SUBSCRIBE TO GAME CONFIGURATION CHANGES
========================================== */

export function subscribeGameConfig(
  callback: () => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const onStorageChange = (
    event: StorageEvent
  ) => {
    if (
      event.key === GAME_CONFIG_KEY ||
      event.key === null
    ) {
      callback()
    }
  }

  window.addEventListener(
    'storage',
    onStorageChange
  )

  window.addEventListener(
    GAME_CONFIG_EVENT,
    callback
  )

  return () => {
    window.removeEventListener(
      'storage',
      onStorageChange
    )

    window.removeEventListener(
      GAME_CONFIG_EVENT,
      callback
    )
  }
}
