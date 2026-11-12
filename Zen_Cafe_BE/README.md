# Zen_Cafe_BE — Zen Café API (Node.js + PostgreSQL)

Plain Node.js HTTP server for all `/api/*` routes: products, offers, room bookings, customer registration, gallery moderation, games and settings, admin auth with durable sessions, and email/WhatsApp notifications via an outbox.

The website and the production Cloudflare Worker live in the **Zen_Cafe_FE** repo.

## Structure
```
Zen_Cafe_BE/
├── server.mjs        # API server (port 5000, /api/* only)
├── server/           # route controllers (server/api), db, auth, notifications, migrate runner
├── migrations/       # SQL migrations (npm run db:migrate)
├── scripts/          # local schema, seed data, test runner
├── test/             # API & HTTP integration tests (test/legacy is not run)
├── api-v2-package/   # standalone API v2 service (production API_V2_URL)
└── .env.example      # copy to .env
```

## Run locally
```bash
npm install
cp .env.example .env     # then set DATABASE_URL
npm run dev
```
API: http://localhost:5000/api · Health: http://localhost:5000/api/health

### Fresh local PostgreSQL
```bash
npm run db:schema   # create all tables (localhost only)
npm run db:seed     # sample categories, products, offers (localhost only)
```
Both scripts refuse to run against anything other than a local database.

To use the VPS database instead, open an SSH tunnel (`ssh -N -L 55432:127.0.0.1:5432 root@<VPS_IP>`) and point `DATABASE_URL` at port 55432.

### No database at all
Set `ZEN_TEST_MODE=true` (and leave `DATABASE_URL` empty) to run on an in-memory database. Data is lost on restart.

## Tests
```bash
npm test
```
All suites run on the in-memory database and never touch the database in `.env`.

## Admin login
The admin email comes from `ADMIN_EMAIL` in `.env`; the password hash is stored in `public.users`. All admins share one password (changing it signs out every admin session).
