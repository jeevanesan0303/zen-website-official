
// server/api/games.mjs
// Zen Café — Games & Rewards Database Integration API
// Corrected scratchCount persistence and response handling.

import { getDbPool } from '../db.mjs'
import { verifyAdminRequest } from '../auth.mjs'

export const DEFAULT_SCRATCH_COUNT = 25
export const MIN_SCRATCH_COUNT = 1
export const MAX_SCRATCH_COUNT = 100

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

/* =========================================================
   RESPONSE HELPERS
========================================================= */

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods':
      'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, x-admin-token',
  })

  res.end(JSON.stringify(data))
  return true
}

function jsonError(res, message, status = 400) {
  return jsonResponse(
    res,
    {
      success: false,
      error: message,
      message,
    },
    status
  )
}

/* =========================================================
   JSON BODY PARSER
========================================================= */

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    let settled = false

    req.on('data', chunk => {
      if (settled) return

      body += chunk

      if (
        Buffer.byteLength(body, 'utf8') >
        1024 * 1024
      ) {
        settled = true

        reject(
          new Error('Payload Too Large')
        )
      }
    })

    req.on('end', () => {
      if (settled) return

      settled = true

      if (!body.trim()) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(
          new Error(
            'Invalid JSON payload: ' +
            error.message
          )
        )
      }
    })

    req.on('error', error => {
      if (settled) return

      settled = true
      reject(error)
    })
  })
}

/* =========================================================
   SCRATCH COUNT VALIDATION
========================================================= */

function isValidScratchCount(value) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_SCRATCH_COUNT &&
    value <= MAX_SCRATCH_COUNT
  )
}

function normalizeStoredScratchCount(value) {
  if (isValidScratchCount(value)) {
    return value
  }

  return DEFAULT_SCRATCH_COUNT
}

/* =========================================================
   GAME CONFIG VALIDATION
========================================================= */

export function validateGameConfigServer(config) {
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config)
  ) {
    return {
      valid: false,
      error:
        'Game configuration must be an object.',
    }
  }

  if (
    typeof config.enabled !== 'boolean'
  ) {
    return {
      valid: false,
      error:
        'The "enabled" property must be a boolean.',
    }
  }

  /*
     scratchCount must be explicitly supplied
     by the admin frontend.

     It represents the hidden scratching
     requirement for a single selected card.
  */

  if (
    !isValidScratchCount(
      config.scratchCount
    )
  ) {
    return {
      valid: false,
      error:
        `scratchCount must be an integer ` +
        `between ${MIN_SCRATCH_COUNT} ` +
        `and ${MAX_SCRATCH_COUNT}.`,
    }
  }

  if (
    !Array.isArray(config.cards) ||
    config.cards.length !== 5
  ) {
    return {
      valid: false,
      error:
        'The game requires exactly 5 cards.',
    }
  }

  const seenIds = new Set()
  let winnerCount = 0

  for (const card of config.cards) {
    if (
      !card ||
      typeof card !== 'object' ||
      Array.isArray(card)
    ) {
      return {
        valid: false,
        error:
          'Each card configuration must be an object.',
      }
    }

    const cardId = Number(
      card.cardId
    )

    if (
      !Number.isInteger(cardId) ||
      cardId < 1 ||
      cardId > 5 ||
      seenIds.has(cardId)
    ) {
      return {
        valid: false,
        error:
          'Cards must have unique cardId values from 1 to 5.',
      }
    }

    seenIds.add(cardId)

    if (
      card.prize !== null &&
      card.prize !== undefined
    ) {
      winnerCount++

      const prize = card.prize

      if (
        !prize ||
        typeof prize !== 'object' ||
        Array.isArray(prize) ||
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
            `Card ${cardId} prize must contain ` +
            'valid productId, title, detail, and emoji.',
        }
      }
    }
  }

  if (winnerCount !== 2) {
    return {
      valid: false,
      error:
        'Exactly two of the five cards ' +
        'must have valid winning prizes ' +
        `(current: ${winnerCount}).`,
    }
  }

  return {
    valid: true,
  }
}

/* =========================================================
   NORMALIZE GAME CARDS
========================================================= */

function normalizeCards(cards) {
  return cards
    .map(card => ({
      cardId: Number(
        card.cardId
      ),

      prize: card.prize
        ? {
            productId:
              String(
                card.prize.productId
              ).trim(),

            title:
              String(
                card.prize.title
              ).trim(),

            detail:
              String(
                card.prize.detail || ''
              ).trim(),

            emoji:
              String(
                card.prize.emoji || '🎁'
              ).trim(),
          }
        : null,
    }))
    .sort(
      (a, b) =>
        a.cardId - b.cardId
    )
}

/* =========================================================
   READ DATABASE CONFIG
========================================================= */

function parseStoredSettings(value) {
  if (
    typeof value === 'string'
  ) {
    return JSON.parse(value)
  }

  return value
}

function buildGameConfig(row) {
  if (!row) {
    return {
      enabled: true,
      scratchCount:
        DEFAULT_SCRATCH_COUNT,
      cards: DEFAULT_CARDS,
    }
  }

  const stored =
    parseStoredSettings(
      row.settings
    )

  const settings =
    stored &&
    typeof stored === 'object' &&
    !Array.isArray(stored)
      ? stored
      : {}

  return {
    enabled:
      Boolean(
        row.is_enabled
      ),

    scratchCount:
      normalizeStoredScratchCount(
        settings.scratchCount
      ),

    cards:
      Array.isArray(settings.cards)
        ? settings.cards
        : DEFAULT_CARDS,
  }
}

/* =========================================================
   MAIN ROUTE HANDLER
========================================================= */

export async function handleGamesRoute(
  req,
  res,
  parsedUrl
) {
  const pathname =
    parsedUrl.pathname

  const method =
    req.method

  const isSettingsRoute =
    pathname ===
    '/api/games/settings'

  if (!isSettingsRoute) {
    return false
  }

  /*
     GET and PUT use the same endpoint.

     GET is public so the customer game
     can read the current configuration.

     PUT/POST require administrator
     authentication.
  */

  if (
    method !== 'GET' &&
    method !== 'PUT' &&
    method !== 'POST'
  ) {
    return jsonError(
      res,
      'Method not allowed.',
      405
    )
  }

  /* =======================================================
     GET /api/games/settings
  ======================================================= */

  if (method === 'GET') {
    try {
      const pool =
        await getDbPool()

      const result =
        await pool.query(
          `SELECT
             game_key,
             settings,
             is_enabled,
             updated_at
           FROM public.game_settings
           WHERE game_key = 'scratch'`
        )

      const row =
        result.rows[0] || null

      const config =
        buildGameConfig(row)

      /*
         Return both the top-level fields
         and a config object for compatibility.

         Existing clients using:
           response.enabled
           response.cards

         will continue working.

         New clients using:
           response.config.scratchCount

         will also work.
      */

      return jsonResponse(res, {
        success: true,

        gameKey: 'scratch',

        enabled:
          config.enabled,

        scratchCount:
          config.scratchCount,

        cards:
          config.cards,

        config,

        updatedAt:
          row?.updated_at
            ? new Date(
                row.updated_at
              ).toISOString()
            : null,

        source:
          row
            ? 'database'
            : 'default',
      })
    } catch (error) {
      console.error(
        'Error fetching game settings:',
        error
      )

      return jsonError(
        res,
        'Failed to fetch game configuration.',
        500
      )
    }
  }

  /* =======================================================
     PUT / POST /api/games/settings
  ======================================================= */

  if (
    method === 'PUT' ||
    method === 'POST'
  ) {
    /*
       Verify admin authentication before
       accepting any settings changes.
    */

    if (
      !(await verifyAdminRequest(req))
    ) {
      return jsonError(
        res,
        'Unauthorized: Admin authentication required to update game settings.',
        401
      )
    }

    let body

    try {
      body =
        await parseJsonBody(req)
    } catch (error) {
      return jsonError(
        res,
        error.message ||
          'Invalid request body.',
        error.message ===
          'Payload Too Large'
          ? 413
          : 400
      )
    }

    /*
       Validate the complete payload.
    */

    const validation =
      validateGameConfigServer(
        body
      )

    if (!validation.valid) {
      return jsonError(
        res,
        validation.error,
        400
      )
    }

    try {
      const pool =
        await getDbPool()

      const cards =
        normalizeCards(
          body.cards
        )

      const scratchCount =
        body.scratchCount

      const isEnabled =
        body.enabled

      /*
         CRITICAL FIX:

         Previously this stored:

           { cards }

         That discarded scratchCount.

         Now both cards and scratchCount
         are stored together in the
         existing JSONB settings column.

         No database schema change
         is required.
      */

      const settingsPayload =
        JSON.stringify({
          cards,
          scratchCount,
        })

      const result =
        await pool.query(
          `INSERT INTO public.game_settings
             (
               game_key,
               settings,
               is_enabled,
               updated_at
             )
           VALUES
             (
               'scratch',
               $1::jsonb,
               $2,
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
             updated_at`,
          [
            settingsPayload,
            isEnabled,
          ]
        )

      const row =
        result.rows[0]

      if (!row) {
        throw new Error(
          'Database did not return saved game settings.'
        )
      }

      /*
         Read the actual database values.
      */

      const savedConfig =
        buildGameConfig(row)

      /*
         Verify scratchCount was
         actually persisted.
      */

      if (
        savedConfig.scratchCount !==
        scratchCount
      ) {
        throw new Error(
          'Database scratchCount verification failed.'
        )
      }

      /*
         Return saved configuration
         in the exact structure expected
         by the frontend gameStore.
      */

      return jsonResponse(res, {
        success: true,

        message:
          'Game settings updated successfully.',

        gameKey:
          row.game_key,

        enabled:
          savedConfig.enabled,

        scratchCount:
          savedConfig.scratchCount,

        cards:
          savedConfig.cards,

        config:
          savedConfig,

        updatedAt:
          row.updated_at
            ? new Date(
                row.updated_at
              ).toISOString()
            : null,
      })
    } catch (error) {
      console.error(
        'Error updating game settings:',
        error
      )

      return jsonError(
        res,
        error.message ||
          'Failed to update game settings.',
        500
      )
    }
  }

  return false
}
