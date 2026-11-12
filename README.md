# Zen Café — local workspace

This folder is only a local container. It holds two independent projects, each its own git repository:

| Folder | Repo | What |
|---|---|---|
| `Zen_Cafe_FE/` | Zen_Cafe_FE | Website, admin panel, Cloudflare Worker |
| `Zen_Cafe_BE/` | Zen_Cafe_BE | Node.js API + PostgreSQL |

Each has its own `package.json`, `node_modules`, `.gitignore` and README. Push them separately (run `git init` inside each folder, not here).

Run both together (local helper, not part of either repo):
```bash
node dev.mjs
```
→ http://localhost:3000 (site) and http://localhost:5000/api (API).
