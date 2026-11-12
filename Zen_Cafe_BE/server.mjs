// Zen Café backend — Node HTTP API server.
//
// Serves only /api/* routes. In development the frontend (Vite, port 3000)
// proxies /api to this server; in production the Cloudflare Worker in
// ./worker serves both the built frontend and the API.

import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const root = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(root, '.env'), quiet: true })

const { handleApiRequest } = await import('./server/api/index.mjs')

const port = Number(process.env.PORT || 5000)

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url || '/', 'http://localhost')

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    try {
      const handled = await handleApiRequest(req, res)
      if (handled || res.headersSent) return
      return sendJson(res, 404, { success: false, error: `No API route for ${req.method} ${pathname}` })
    } catch (err) {
      console.error('Unhandled API error:', err)
      if (!res.headersSent) sendJson(res, 500, { success: false, error: err.message })
      return
    }
  }

  sendJson(res, 404, {
    success: false,
    error: 'This is the Zen Café API server. Open the website on the frontend dev server (http://localhost:3000).',
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log('\n================================')
  console.log('     ZEN CAFÉ BACKEND (API)')
  console.log('================================')
  console.log(`API:           http://localhost:${port}/api`)
  console.log(`Health:        http://localhost:${port}/api/health`)
  console.log(`Products:      http://localhost:${port}/api/products`)
  console.log('================================\n')
})
