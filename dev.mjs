// Local helper (not part of either repo): starts Zen_Cafe_BE (API, port 5000)
// and Zen_Cafe_FE (site, port 3000) together. Ctrl+C stops both.
//
//   node dev.mjs        (or: npm run dev)
//
// Open http://localhost:3000 — the frontend proxies /api to the backend.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const projects = [
  { name: 'Zen_Cafe_BE', color: '\x1b[36m' },
  { name: 'Zen_Cafe_FE', color: '\x1b[35m' },
]

// Ports are fixed per project; a PORT inherited from the shell must not leak in.
const childEnv = { ...process.env }
delete childEnv.PORT

const children = []
let stopping = false

function shutdown(code) {
  if (stopping) return
  stopping = true
  for (const child of children) if (!child.killed) child.kill()
  setTimeout(() => process.exit(code), 300)
}

for (const { name, color } of projects) {
  const child = spawn(npm, ['run', 'dev'], {
    cwd: path.join(root, name),
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })
  const prefix = `${color}[${name}]\x1b[0m `
  const pipe = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) if (line.trim()) out.write(prefix + line + '\n')
    })
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => {
    console.log(`${prefix}exited with code ${code}`)
    shutdown(code ?? 0)
  })
  children.push(child)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
