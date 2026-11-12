import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Clean URL -> HTML entry (same mapping the Cloudflare Worker uses in production).
const CLEAN_ROUTES: Record<string, string> = {
  '/admin': '/admin.html',
  '/admin/login': '/admin-login.html',
  '/admin-bookings': '/admin-bookings.html',
  '/zen-kitchen': '/zen-kitchen.html',
  '/offers': '/offers.html',
  '/register': '/register.html',
  '/games': '/games.html',
}

const HTML_TO_CLEAN = Object.fromEntries(
  Object.entries(CLEAN_ROUTES).map(([clean, html]) => [html, clean])
)

function cleanUrls(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost')
    const pathname = url.pathname

    // /offers.html -> /offers (permanent redirect, keeps query string)
    const clean = HTML_TO_CLEAN[pathname]
    if (clean && req.method === 'GET') {
      res.statusCode = 308
      res.setHeader('Location', clean + url.search)
      res.end()
      return
    }

    // /offers -> serve offers.html
    const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
    const html = CLEAN_ROUTES[trimmed]
    if (html) req.url = html + url.search

    next()
  }

  return {
    name: 'zen-clean-urls',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.BACKEND_URL || 'http://127.0.0.1:5000'

  const shared = {
    // Cloudflare quick tunnels (cloudflared tunnel --url http://localhost:3000)
    // for testing on a phone. Extra hosts: DEV_ALLOWED_HOSTS=a.com,b.com
    allowedHosts: [
      '.trycloudflare.com',
      ...(env.DEV_ALLOWED_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean),
    ],
    proxy: {
      '/api': { target: backendUrl, changeOrigin: true },
    },
  }

  return {
    plugins: [react(), cleanUrls()],
    appType: 'mpa',
    server: { ...shared, port: 3000, strictPort: true },
    preview: shared,
    build: {
      rollupOptions: {
        input: [
          'index.html',
          'admin.html',
          'admin-login.html',
          'admin-bookings.html',
          'zen-kitchen.html',
          'offers.html',
          'register.html',
          'games.html',
        ],
      },
    },
  }
})
