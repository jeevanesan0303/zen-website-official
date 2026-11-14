
import { getAdminAuthHeaders } from '../admin-auth'

/* =========================================================
   ZEN CAFÉ — SCRATCH GAME STORE

   RULES

   - The customer selects one of five cards.
   - The customer scratches the same card.
   - scratchCount controls the required amount of
     valid scratching activity.
   - The count is never displayed to customers.
   - The reward is revealed after the requirement
     is completed.

   This module manages game configuration.

   IMPORTANT:
   Real prize issuance and redemption must be
   validated by the backend. Local storage is
   only a configuration cache.
========================================================= */

/* ===================== TYPES ===================== */

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
  scratchCount: number
  cards: GameCardConfig[]
}

/* ===================== CONSTANTS ===================== */

export const GAME_CONFIG_KEY =
  'zen-cafe-scratch-game-v1'

export const GAME_CONFIG_EVENT =
  'zen-cafe-scratch-game-change'

export const DEFAULT_SCRATCH_COUNT = 25
export const MIN_SCRATCH_COUNT = 1
export const MAX_SCRATCH_COUNT = 100

export const TOTAL_GAME_CARDS = 5
export const REQUIRED_WINNING_CARDS = 2

// Compatibility exports used by existing admin code.
export const DEFAULT_REQUIRED_ATTEMPTS =
  DEFAULT_SCRATCH_COUNT

export const MIN_REQUIRED_ATTEMPTS =
  MIN_SCRATCH_COUNT

export const MAX_REQUIRED_ATTEMPTS =
  MAX_SCRATCH_COUNT

const GAME_SETTINGS_ENDPOINT =
  '/api/games/settings'

/* ===================== DEFAULT CONFIG ===================== */

export const DEFAULT_GAME_CONFIG: GameConfig = {
  enabled: true,
  scratchCount: DEFAULT_SCRATCH_COUNT,
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

/* ===================== INTERNAL TYPES ===================== */

type UnknownRecord = Record<string, unknown>

type ApiConfigResult = {
  config: GameConfig | null
  scratchCountPresent: boolean
}

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
    value >= MIN_SCRATCH_COUNT &&
    value <= MAX_SCRATCH_COUNT
  )
}

/* ===================== NORMALIZATION ===================== */

export function normalizeScratchCount(
  value: unknown
): number {
  return isValidScratchCount(value)
    ? value
    : DEFAULT_SCRATCH_COUNT
}

export function normalizeRequiredAttempts(
  value: unknown
): number {
  return normalizeScratchCount(value)
}

export function getRequiredScratchAttempts(
  config: GameConfig
): number {
  return normalizeScratchCount(
    config.scratchCount
  )
}

/* ===================== VALIDATION ===================== */

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

    winningCards += 1
  }

  return (
    cardIds.size === TOTAL_GAME_CARDS &&
    winningCards === REQUIRED_WINNING_CARDS
  )
}

/*
   Legacy local configurations can omit
   scratchCount.

   A missing local value defaults to 25.

   The API save verification is stricter:
   it must explicitly return scratchCount.
*/

export function normalizeGameConfig(
  value: unknown
): GameConfig | null {
  if (!isRecord(value)) {
    return null
  }

  const candidate: unknown = {
    ...value,
    scratchCount:
      value.scratchCount === undefined
        ? DEFAULT_SCRATCH_COUNT
        : value.scratchCount,
  }

  if (!isValidGameConfig(candidate)) {
    return null
  }

  // Return only the supported configuration fields.
  return {
    enabled: candidate.enabled,
    scratchCount: candidate.scratchCount,
    cards: candidate.cards
      .map(card => ({
        cardId: card.cardId,
        prize:
          card.prize === null
            ? null
            : {
                productId: card.prize.productId,
                title: card.prize.title,
                detail: card.prize.detail,
                emoji: card.prize.emoji,
              },
      }))
      .sort((a, b) => a.cardId - b.cardId),
  }
}

/* ===================== CONFIG COMPARISON ===================== */

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

/* ===================== STORAGE ===================== */

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

export function readGameConfig(): GameConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_GAME_CONFIG
  }

  try {
    const stored = window.localStorage.getItem(
      GAME_CONFIG_KEY
    )

    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      const config = normalizeGameConfig(parsed)

      if (config) {
        return config
      }
    }
  } catch (error) {
    console.warn(
      'Unable to read cached game settings:',
      error
    )
  }

  return DEFAULT_GAME_CONFIG
}

/* ===================== API RESPONSE ===================== */

/*
   Supported response formats:

   { config: { enabled, scratchCount, cards } }

   or

   { enabled, scratchCount, cards }

   Other response formats must be handled
   explicitly in the backend or added here.
*/

function getRawApiConfig(
  response: unknown
): unknown {
  if (!isRecord(response)) {
    return null
  }

  if (response.config !== undefined) {
    return response.config
  }

  return response
}

function parseApiConfig(
  response: unknown,
  requireScratchCount: boolean
): ApiConfigResult {
  const rawConfig = getRawApiConfig(response)

  if (!isRecord(rawConfig)) {
    return {
      config: null,
      scratchCountPresent: false,
    }
  }

  const scratchCountPresent =
    Object.prototype.hasOwnProperty.call(
      rawConfig,
      'scratchCount'
    )

  /*
     During save verification, a missing
     scratchCount is not accepted.

     Otherwise a backend that drops the field
     could appear to have saved the default 25.
  */

  if (
    requireScratchCount &&
    !scratchCountPresent
  ) {
    return {
      config: null,
      scratchCountPresent: false,
    }
  }

  return {
    config: normalizeGameConfig(rawConfig),
    scratchCountPresent,
  }
}

function extractGameConfig(
  response: unknown
): GameConfig | null {
  return parseApiConfig(
    response,
    false
  ).config
}

/* ===================== API ERRORS ===================== */

async function readApiError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const data: unknown = await response.json()

    if (isRecord(data)) {
      if (
        typeof data.error === 'string' &&
        data.error.trim()
      ) {
        return data.error
      }

      if (
        typeof data.message === 'string' &&
        data.message.trim()
      ) {
        return data.message
      }
    }
  } catch {
    // Preserve fallback.
  }

  return fallback
}

function describeMismatch(
  expected: GameConfig,
  actual: GameConfig
): string {
  if (
    expected.scratchCount !==
    actual.scratchCount
  ) {
    return (
      'The Games API did not preserve scratchCount. ' +
      `Requested: ${expected.scratchCount}. ` +
      `Returned: ${actual.scratchCount}. ` +
      'Update the backend /api/games/settings ' +
      'handler to store and return scratchCount.'
    )
  }

  if (expected.enabled !== actual.enabled) {
    return (
      'The Games API did not preserve ' +
      'the game enabled/disabled setting.'
    )
  }

  return (
    'The Games API did not preserve all ' +
    'winning-card and prize settings.'
  )
}

/* ===================== FETCH CONFIG ===================== */

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

    const data: unknown = await response.json()
    const config = extractGameConfig(data)

    if (!config) {
      throw new Error(
        'The Games API returned invalid settings.'
      )
    }

    persistGameConfig(config)

    return config
  } catch (error) {
    console.warn(
      'Unable to fetch live game settings:',
      error
    )

    return readGameConfig()
  }
}

/* ===================== SAVE CONFIG ===================== */

/*
   Save sequence:

   1. Validate the requested configuration.
   2. Send authenticated PUT.
   3. Validate any configuration returned by PUT.
   4. Perform a fresh authenticated GET.
   5. Compare the server response with the request.
   6. Update local cache only after verification.

   This prevents a false "Saved" message.
*/

export async function saveGameConfig(
  config: GameConfig
): Promise<void> {
  if (!isValidGameConfig(config)) {
    throw new Error(
      'Invalid game settings. Exactly two of ' +
      'the five cards must have valid prizes. ' +
      `The scratch requirement must be between ` +
      `${MIN_SCRATCH_COUNT} and ${MAX_SCRATCH_COUNT}.`
    )
  }

  const requestedConfig =
    normalizeGameConfig(config)

  if (!requestedConfig) {
    throw new Error(
      'Unable to normalize game settings.'
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
        cache: 'no-store',
        body: JSON.stringify(requestedConfig),
      }
    )
  } catch {
    throw new Error(
      'Unable to connect to the Games API. ' +
      'Check your connection and try again.'
    )
  }

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        `Unable to save game settings (${response.status}).`
      )
    )
  }

  /*
     Some APIs return an empty successful
     response. That is allowed.

     If the API returns a configuration,
     however, it must match the request.
  */

  const responseText = await response.text()

  if (responseText.trim()) {
    let responseData: unknown

    try {
      responseData = JSON.parse(responseText)
    } catch {
      throw new Error(
        'The Games API returned invalid JSON ' +
        'after the save request.'
      )
    }

    if (isRecord(responseData)) {
      const hasConfig =
        responseData.config !== undefined ||
        (
          responseData.enabled !== undefined &&
          responseData.cards !== undefined
        )

      if (hasConfig) {
        const parsed = parseApiConfig(
          responseData,
          true
        )

        if (!parsed.scratchCountPresent) {
          throw new Error(
            'The Games API omitted scratchCount ' +
            'from its save response. The backend ' +
            'must return the saved scratchCount.'
          )
        }

        if (!parsed.config) {
          throw new Error(
            'The Games API returned invalid ' +
            'saved game settings.'
          )
        }

        if (
          !sameGameConfig(
            requestedConfig,
            parsed.config
          )
        ) {
          throw new Error(
            describeMismatch(
              requestedConfig,
              parsed.config
            )
          )
        }
      }
    }
  }

  /* ===================== VERIFY SAVE ===================== */

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
      'The save request was accepted, but the ' +
      'saved settings could not be verified. ' +
      'Reload the admin settings before retrying.'
    )
  }

  if (!verifyResponse.ok) {
    throw new Error(
      'The save request was accepted, but ' +
      `verification failed (${verifyResponse.status}).`
    )
  }

  let verifyData: unknown

  try {
    verifyData = await verifyResponse.json()
  } catch {
    throw new Error(
      'The Games API returned invalid JSON ' +
      'during save verification.'
    )
  }

  const verified = parseApiConfig(
    verifyData,
    true
  )

  if (!verified.scratchCountPresent) {
    throw new Error(
      'The Games API is not returning scratchCount. ' +
      'Update /api/games/settings to read, store, ' +
      'and return the saved scratchCount.'
    )
  }

  if (!verified.config) {
    throw new Error(
      'The Games API returned invalid game ' +
      'settings during save verification.'
    )
  }

  if (
    !sameGameConfig(
      requestedConfig,
      verified.config
    )
  ) {
    throw new Error(
      describeMismatch(
        requestedConfig,
        verified.config
      )
    )
  }

  /*
     Only the verified server configuration
     is written to the local cache.
  */

  persistGameConfig(verified.config)
}

/* ===================== SUBSCRIPTIONS ===================== */

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
