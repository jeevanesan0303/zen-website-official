# Zen_Cafe_FE — Zen Café Website & Admin Panel

React 18 + TypeScript + Tailwind CSS multi-page site (Vite), plus the Cloudflare Worker that serves it in production.

## Pages
| URL | Entry |
|---|---|
| `/` | `index.html` — main website |
| `/zen-kitchen` | `zen-kitchen.html` — restaurant menu |
| `/offers` | `offers.html` |
| `/register` | `register.html` |
| `/games` | `games.html` |
| `/admin/login`, `/admin`, `/admin-bookings` | admin panel (`src/admin`) |

## Structure
```
Zen_Cafe_FE/
├── *.html            # page entries
├── src/              # React pages & components; admin panel in src/admin
├── public/           # images, videos, favicons (served at /)
├── worker/           # Cloudflare Worker (production host: serves dist/, proxies /api)
├── wrangler.jsonc    # Cloudflare config (assets → ./dist)
├── vite.config.ts    # dev server: port 3000, clean URLs, /api proxy
└── .env.example      # optional local settings
```

## Run locally
The API comes from the **Zen_Cafe_BE** repo — start it first (`npm run dev` there, port 5000).

```bash
npm install
npm run dev
```
Open http://localhost:3000. Requests to `/api` are proxied to `BACKEND_URL` (default `http://127.0.0.1:5000`; change it in `.env`).

### Test on a phone
```bash
cloudflared tunnel --url http://localhost:3000
```
`*.trycloudflare.com` hosts are allowed by `vite.config.ts`. Anyone with the link can open the site, so stop the tunnel when you are done.

## Build & deploy (Cloudflare)
```bash
npm run build            # → dist/
npm run deploy:dry-run   # build + wrangler dry run
npm run deploy           # build + deploy (site owner only)
```
In production the Worker proxies `/api/*` to `API_V2_URL` (set in `wrangler.jsonc`). See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).
