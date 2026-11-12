// Creates all tables in the LOCAL development database from scripts/local-db-schema.sql.
// Safe to re-run (CREATE TABLE IF NOT EXISTS). No psql needed.
//
// Usage: npm run db:schema
//
// Refuses to run unless DATABASE_URL / PGHOST points at localhost (and not the
// 55432 SSH-tunnel port used for the production VPS).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import dotenv from 'dotenv'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env'), quiet: true })

const connectionString = process.env.DATABASE_URL
const host = connectionString ? new URL(connectionString).hostname : process.env.PGHOST
const port = connectionString ? new URL(connectionString).port : process.env.PGPORT

if (!['127.0.0.1', 'localhost', '::1'].includes(host) || String(port) === '55432') {
  console.error(`Refusing to apply schema: database ${host}:${port} is not the local development database.`)
  process.exit(1)
}

const sql = fs.readFileSync(path.join(root, 'scripts', 'local-db-schema.sql'), 'utf8')
const pool = new pg.Pool(connectionString ? { connectionString } : undefined)

try {
  await pool.query(sql)
  const res = await pool.query(
    "SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'"
  )
  console.log(`Schema applied. Tables in public schema: ${res.rows[0].n}`)
} catch (err) {
  console.error('Schema failed:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
