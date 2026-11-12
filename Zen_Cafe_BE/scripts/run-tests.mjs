// Runs the backend test suites in order.
//
// Every suite runs against the in-memory pg-mem database: DATABASE_URL / PGHOST
// are blanked so the tests can never write into the development or production
// database configured in .env.
//
// test/legacy/worker-integration.test.mjs is not run: it targets an older
// Cloudflare Worker that queried PostgreSQL directly. The Worker now lives in
// the Zen_Cafe_FE repo and proxies /api to API_V2_URL.

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const isolatedEnv = {
  ...process.env,
  DATABASE_URL: '',
  POSTGRES_URL: '',
  PGHOST: '',
  ZEN_TEST_MODE: 'true',
}

const suites = [
  'products-api.test.mjs',
  'offers-api.test.mjs',
  'bookings-api.test.mjs',
  'auth-registration.test.mjs',
  'gallery-api.test.mjs',
  'games-settings-api.test.mjs',
  'phase7-safety-auth.test.mjs',
  'http-server.test.mjs',
]

const results = []
let ok = true

for (const file of suites) {
  console.log(`\n▶ ${file}`)
  const res = spawnSync(process.execPath, [path.join('test', file)], {
    cwd: root,
    env: isolatedEnv,
    stdio: 'inherit',
  })
  const passed = res.status === 0
  results.push([file, passed ? 'passed' : 'FAILED'])
  ok = ok && passed
}

console.log('\n================ TEST SUMMARY ================')
for (const [file, status] of results) console.log(`${status.padEnd(8)}  ${file}`)
console.log('==============================================')
process.exit(ok ? 0 : 1)
