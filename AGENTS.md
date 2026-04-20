# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Superconnector (Sayla) is a pnpm monorepo with two packages: `server` (Express.js API + WebSocket on port 8000) and `web` (React/Vite SPA on port 3000). See `package.json` scripts at root and in each package for lint/build/dev commands.

### Prerequisites

- **Node.js 22** (see `.nvmrc` for exact version) and **pnpm 10** (`packageManager` field in root `package.json`).
- **Docker** is required to run PostgreSQL with pgvector via `docker compose up -d` (uses `docker-compose.yml` at repo root).

### Starting services

1. **PostgreSQL**: `sudo dockerd &>/tmp/dockerd.log &` (if Docker daemon isn't running), then `sudo docker compose up -d` from the repo root.
2. **Prisma migrations**: `cd server && npx prisma migrate deploy` (requires `DATABASE_URL` in `server/.env`).
3. **Server**: `cd server && pnpm dev` — runs esbuild watch, tsc watch, and node --watch in parallel via `npm-run-all`.
4. **Web**: `cd web && pnpm dev` — Vite dev server on port 3000.

### Environment variables

- `server/.env` must exist (see `server/.env.example`). The Zod schema in `server/src/utils/env.ts` requires all fields; external API keys (`GEMINI_API_KEY`, `SENDBLUE_*`) can use placeholders for local dev if you don't need those integrations.
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres` matches the default Docker Compose config.
- `JWT_SECRET` must be at least 32 characters.

### Lint / type-check

- Root: `pnpm lint .` (Oxlint config).
- Server type-check: `cd server && pnpm lint` (runs `tsc --noEmit`).
- Web type-check: `cd web && npx tsc -b`.

### Gotchas

- The server `pnpm dev` uses `run-p dev:*` which starts three watchers. When run in a non-interactive shell, esbuild's `--watch` may exit because stdin closes. For background runs, do a one-shot `pnpm build:only` first, then use `node --watch dist/index.js` separately.
- `pnpm install` triggers `postinstall` in the server package which runs `prisma generate`. If Prisma schema changes, re-run `pnpm install` or `cd server && npx prisma generate`.
- Husky pre-commit hook runs `pnpm lint-staged`.
