
/**
 * server/api/games.mjs
 *
 * ZEN CAFÉ — GAMES & REWARDS API
 *
 * Features:
 * - PostgreSQL-backed game configuration
 * - Admin-controlled scratch movement count
 * - Five game cards
 * - Exactly two winning cards
 * - Admin-authenticated settings updates
 * - Compatible top-level and nested API responses
 * - Database persistence verification
 * - Backward compatibility with older settings
 *
 * Database:
 * public.game_settings
 *
 * Existing columns:
 * game_key
 * settings
 * is_enabled
 * updated_at
 *
 * The JSONB settings column stores:
 * {
 *   cards: [...],
 *   scratchCount: 25
 * }
 */

import { getDbPool } from '../db.mjs'
import { verifyAdminRequest } from '../auth.mjs'

/* =====================================================
   CONSTANTS
===================================================== */

export const GAME_KEY = 'scratch'

export const TOTAL_GAME_CARDS = 5
export const REQUIRED_WINNING_CARDS = 2

export const DEFAULT_SCRATCH_COUNT = 25
export const MIN_SCRATCH_COUNT = 1
export const MAX_SCRATCH_COUNT = 100

const MAX_BODY_BYTES = 1024 * 1024

/* =====================================================
   DEFAULT GAME CARDS
===================================================== */

export const DEFAULT_CARDS = [
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
]

/* =====================================================
   RESPONSE HELPERS
===================================================== */

function jsonResponse(
  res,
  data,
  status = 200,
) {
  if (res.headersSent || res.writableEnded) {
    return
  }

  res.writeHead(status, {
    'Content-Type':
      'application/json; charset=utf-8',

    'Cache-Control':
      'no-store, no-cache, must-revalidate',

    Pragma: 'no-cache',

    'X-Content-Type-Options': 'nosniff',

    'Access-Control-Allow-Origin': '*',

    'Access-Control-Allow-Methods':
      'GET, POST, PUT, OPTIONS',

    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, x-admin-token',
  })

  res.end(JSON.stringify(data))
}

function jsonError(
  res,
  message,
  status = 400,
) {
  return jsonResponse(
    res,
    {
      success: false,
      error: message,
      message,
    },
    status,
  )
}

/* =====================================================
   GENERAL HELPERS
===================================================== */

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function isValidScratchCount(value) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_SCRATCH_COUNT &&
    value <= MAX_SCRATCH_COUNT
  )
}

function normalizeScratchCount(value) {
  return isValidScratchCount(value)
    ? value
    : DEFAULT_SCRATCH_COUNT
}

function parseStoredSettings(value) {
  if (typeof value === 'string') {
    const parsed = JSON.parse(value)

    if (!isPlainObject(parsed)) {
      throw new Error(
        'Stored game settings must be an object.',
      )
    }

    return parsed
  }

  if (isPlainObject(value)) {
    return value
  }

  return {}
}

function formatUpdatedAt(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString()
}

/* =====================================================
   REQUEST BODY PARSER
===================================================== */

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []

    let totalBytes = 0
    let settled = false

    const fail = error => {
      if (settled) return

      settled = true
      reject(error)
    }

    req.on('data', chunk => {
      if (settled) return

      totalBytes += chunk.length

      if (totalBytes > MAX_BODY_BYTES) {
        fail(
          Object.assign(
            new Error('Payload Too Large'),
            { statusCode: 413 },
          ),
        )

        req.pause()
        return
      }

      chunks.push(chunk)
    })

    req.on('end', () => {
      if (settled) return

      settled = true

      const body = Buffer.concat(chunks)
        .toString('utf8')
        .trim()

      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch {
        reject(
          Object.assign(
            new Error('Invalid JSON payload.'),
            { statusCode: 400 },
          ),
        )
      }
    })

    req.on('error', fail)

    req.on('aborted', () => {
      fail(
        Object.assign(
          new Error('Request aborted.'),
          { statusCode: 400 },
        ),
      )
    })
  })
}

/* =====================================================
   GAME CONFIG VALIDATION
===================================================== */

export function validateGameConfigServer(config) {
  if (!isPlainObject(config)) {
    return {
      valid: false,
      error:
        'Game configuration must be an object.',
    }
  }

  if (typeof config.enabled !== 'boolean') {
    return {
      valid: false,
      error:
        'The "enabled" property must be a boolean.',
    }
  }

  if (!isValidScratchCount(config.scratchCount)) {
    return {
      valid: false,
      error:
        `Scratch count must be a whole number between ${MIN_SCRATCH_COUNT} and ${MAX_SCRATCH_COUNT}.`,
    }
  }

  if (
    !Array.isArray(config.cards) ||
    config.cards.length !== TOTAL_GAME_CARDS
  ) {
    return {
      valid: false,
      error:
        `The game requires exactly ${TOTAL_GAME_CARDS} cards.`,
    }
  }

  const seenIds = new Set()
  let winnerCount = 0

  for (const card of config.cards) {
    if (!isPlainObject(card)) {
      return {
        valid: false,
        error:
          'Each card configuration must be an object.',
      }
    }

    const cardId = card.cardId

    if (
      typeof cardId !== 'number' ||
      !Number.isInteger(cardId) ||
      cardId < 1 ||
      cardId > TOTAL_GAME_CARDS ||
      seenIds.has(cardId)
    ) {
      return {
        valid: false,
        error:
          `Cards must have unique cardId values from 1 to ${TOTAL_GAME_CARDS}.`,
      }
    }

    seenIds.add(cardId)

    if (card.prize === null) {
      continue
    }

    if (!isPlainObject(card.prize)) {
      return {
        valid: false,
        error:
          `Card ${cardId} must have a valid prize or null.`,
      }
    }

    const prize = card.prize

    if (
      typeof prize.productId !== 'string' ||
      !prize.productId.trim() ||
      typeof prize.title !== 'string' ||
      !prize.title.trim() ||
      typeof prize.detail !== 'string' ||
      typeof prize.emoji !== 'string'
    ) {
      return {
        valid: false,
        error:
          `Card ${cardId} prize must contain valid productId, title, detail, and emoji.`,
      }
    }

    winnerCount += 1
  }

  if (winnerCount !== REQUIRED_WINNING_CARDS) {
    return {
      valid: false,
      error:
        `Exactly ${REQUIRED_WINNING_CARDS} of the ${TOTAL_GAME_CARDS} cards must contain winning prizes. Current: ${winnerCount}.`,
    }
  }

  return {
    valid: true,
  }
}

/* =====================================================
   NORMALIZE CARD DATA
===================================================== */

function normalizeCards(cards) {
  return cards
    .map(card => ({
      cardId: card.cardId,

      prize: card.prize
        ? {
            productId:
              card.prize.productId.trim(),

            title:
              card.prize.title.trim(),

            detail:
              card.prize.detail.trim(),

            emoji:
              card.prize.emoji.trim(),
          }
        : null,
    }))
    .sort(
      (a, b) => a.cardId - b.cardId,
    )
}

/* =====================================================
   NORMALIZE REQUEST CONFIGURATION
===================================================== */

function normalizeRequestConfig(body) {
  if (!isPlainObject(body)) {
    return body
  }

  /*
    Support either:

    {
      enabled,
      scratchCount,
      cards
    }

    or:

    {
      config: {
        enabled,
        scratchCount,
        cards
      }
    }
  */

  if (isPlainObject(body.config)) {
    return body.config
  }

  return body
}

/* =====================================================
   FORMAT STORED CONFIGURATION
===================================================== */

function formatGameConfig(row) {
  const settings = parseStoredSettings(
    row.settings,
  )

  /*
    Older database records may contain
    only the cards array.

    Missing scratchCount defaults to 25.

    Existing prize assignments are retained.
  */

  const scratchCount = normalizeScratchCount(
    settings.scratchCount,
  )

  const config = {
    enabled: Boolean(row.is_enabled),
    scratchCount,
    cards: settings.cards,
  }

  const validation =
    validateGameConfigServer(config)

  if (!validation.valid) {
    throw new Error(
      `Invalid stored game configuration: ${validation.error}`,
    )
  }

  return {
    enabled: config.enabled,
    scratchCount: config.scratchCount,
    cards: normalizeCards(config.cards),
  }
}

/* =====================================================
   STANDARD SUCCESS RESPONSE
===================================================== */

function buildGameResponse(
  config,
  {
    gameKey = GAME_KEY,
    updatedAt = null,
    source = 'database',
    message,
  } = {},
) {
  const response = {
    success: true,

    gameKey,

    /*
      Nested configuration.
    */

    config,

    /*
      Backward-compatible top-level fields.
    */

    enabled: config.enabled,

    scratchCount: config.scratchCount,

    cards: config.cards,

    updatedAt,

    source,
  }

  if (message) {
    response.message = message
  }

  return response
}

/* =====================================================
   DATABASE READ
===================================================== */

async function readGameSettings(pool) {
  const result = await pool.query(
    `
      SELECT
        game_key,
        settings,
        is_enabled,
        updated_at
      FROM public.game_settings
      WHERE game_key = $1
      LIMIT 1
    `,
    [GAME_KEY],
  )

  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0]
}

/* =====================================================
   DATABASE SAVE
===================================================== */

async function persistGameSettings(
  pool,
  config,
) {
  const cards = normalizeCards(
    config.cards,
  )

  const scratchCount = config.scratchCount
  const enabled = config.enabled

  /*
    Both cards and scratchCount are stored
    in the existing JSONB settings column.

    No database migration is required.
  */

  const settingsPayload = JSON.stringify({
    cards,
    scratchCount,
  })

  const result = await pool.query(
    `
      INSERT INTO public.game_settings (
        game_key,
        settings,
        is_enabled,
        updated_at
      )
      VALUES (
        $1,
        $2::jsonb,
        $3,
        NOW()
      )
      ON CONFLICT (game_key)
      DO UPDATE SET
        settings = EXCLUDED.settings,
        is_enabled = EXCLUDED.is_enabled,
        updated_at = NOW()
      RETURNING
        game_key,
        settings,
        is_enabled,
        updated_at
    `,
    [
      GAME_KEY,
      settingsPayload,
      enabled,
    ],
  )

  if (!result.rows.length) {
    throw new Error(
      'Database did not return the saved game settings.',
    )
  }

  return result.rows[0]
}

/* =====================================================
   MAIN GAMES ROUTE HANDLER
===================================================== */

export async function handleGamesRoute(
  req,
  res,
  parsedUrl,
) {
  const pathname =
    parsedUrl.pathname.replace(/\/+$/, '') || '/'

  const method = req.method

  if (pathname !== '/api/games/settings') {
    return false
  }

  /* ===================== OPTIONS ===================== */

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Cache-Control': 'no-store',

      'Access-Control-Allow-Origin': '*',

      'Access-Control-Allow-Methods':
        'GET, POST, PUT, OPTIONS',

      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, x-admin-token',
    })

    res.end()

    return true
  }

  /* ===================== GET SETTINGS ===================== */

  if (method === 'GET') {
    try {
      const pool = await getDbPool()

      const row = await readGameSettings(
        pool,
      )

      if (!row) {
        const defaultConfig = {
          enabled: true,

          scratchCount:
            DEFAULT_SCRATCH_COUNT,

          cards: normalizeCards(
            DEFAULT_CARDS,
          ),
        }

        jsonResponse(
          res,
          buildGameResponse(
            defaultConfig,
            {
              updatedAt: null,
              source: 'default',
            },
          ),
        )

        return true
      }

      const config = formatGameConfig(
        row,
      )

      jsonResponse(
        res,
        buildGameResponse(
          config,
          {
            gameKey: row.game_key,

            updatedAt: formatUpdatedAt(
              row.updated_at,
            ),

            source: 'database',
          },
        ),
      )

      return true
    } catch (error) {
      console.error(
        '[Zen Café Games] GET failed:',
        error,
      )

      jsonError(
        res,
        'Failed to fetch game configuration.',
        500,
      )

      return true
    }
  }

  /* ===================== SAVE SETTINGS ===================== */

  if (
    method === 'PUT' ||
    method === 'POST'
  ) {
    /*
      Authenticate before reading or
      processing the request body.
    */

    let authorized = false

    try {
      authorized =
        await verifyAdminRequest(req)
    } catch (error) {
      console.error(
        '[Zen Café Games] Authentication failed:',
        error,
      )

      jsonError(
        res,
        'Unable to verify administrator authentication.',
        500,
      )

      return true
    }

    if (!authorized) {
      jsonError(
        res,
        'Unauthorized: Administrator authentication is required.',
        401,
      )

      return true
    }

    /* ===================== PARSE BODY ===================== */

    let body

    try {
      body = await parseJsonBody(req)
    } catch (error) {
      jsonError(
        res,
        error.message ||
          'Invalid request payload.',

        error.statusCode === 413
          ? 413
          : 400,
      )

      return true
    }

    const config =
      normalizeRequestConfig(body)

    /* ===================== VALIDATION ===================== */

    const validation =
      validateGameConfigServer(config)

    if (!validation.valid) {
      jsonError(
        res,
        validation.error,
        400,
      )

      return true
    }

    /* ===================== DATABASE SAVE ===================== */

    try {
      const pool = await getDbPool()

      const savedRow =
        await persistGameSettings(
          pool,
          config,
        )

      /*
        Format the actual returned
        database values, not merely
        the incoming request.
      */

      const savedConfig =
        formatGameConfig(savedRow)

      /*
        Verify that the database returned
        the expected scratch count.

        This prevents reporting success
        when persistence is inconsistent.
      */

      if (
        savedConfig.scratchCount !==
        config.scratchCount
      ) {
        throw new Error(
          'Scratch count persistence verification failed.',
        )
      }

      if (
        savedConfig.enabled !==
        config.enabled
      ) {
        throw new Error(
          'Game enabled state persistence verification failed.',
        )
      }

      const requestedCards =
        normalizeCards(config.cards)

      if (
        JSON.stringify(savedConfig.cards) !==
        JSON.stringify(requestedCards)
      ) {
        throw new Error(
          'Game card persistence verification failed.',
        )
      }

      /* ===================== SUCCESS ===================== */

      jsonResponse(
        res,
        buildGameResponse(
          savedConfig,
          {
            gameKey:
              savedRow.game_key,

            updatedAt:
              formatUpdatedAt(
                savedRow.updated_at,
              ),

            source: 'database',

            message:
              'Game settings updated successfully.',
          },
        ),
      )

      return true
    } catch (error) {
      console.error(
        '[Zen Café Games] SAVE failed:',
        error,
      )

      jsonError(
        res,
        'Failed to update game settings.',
        500,
      )

      return true
    }
  }

  /* ===================== METHOD NOT ALLOWED ===================== */

  jsonError(
    res,
    'Method not allowed.',
    405,
  )

  return true
}
