# Repository Guidelines

This folder holds the cloud side of API Documentation. It is split into two independent apps. Read the guide for the app you are changing.

| Folder | What it is | Guide |
|---|---|---|
| `web/` | Browser portal (React, Vite, shadcn/ui, Tailwind) | `web/AGENTS.md` |
| `server/` | API (Bun, PostgreSQL) | `server/AGENTS.md` |

Shared files at this level: `docker-compose.yml` (local stack), `docker-compose.prod.yml` (production stack), `.env.example`, `.github/workflows/cloud.yml` (CI and deploy), and the root `package.json` that runs both apps.

Nothing in `web/` may import from `server/`, and nothing in `server/` may import from `web/`. The two apps talk only over HTTP and the WebSocket.

## Commands

Run these from this folder.

- `bun run cloud:dev`: portal on port 5174.
- `bun run api:dev`: API on port 3001.
- `bun run cloud:typecheck`, `bun run api:typecheck`: type checks.
- `bun run cloud:build`: portal build into `web/dist/`.
- `bun run api:test`: server tests (`bun test server`).
- `bun run cloud:lint`, `bun run cloud:format`: Biome check and write, for the portal. Added during the frontend refactor.

Install dependencies once per app: `bun install --cwd web` and `bun install --cwd server`.

## Versions

The release version lives in the root `package.json`. CI bumps it on every push to `main`. Do not bump it by hand.

## Comments

Comments should read like ordinary code, not generated text. Add a comment only when the reason is not obvious from the code. No section banners, no filler such as "This function handles...", and no slogan phrases such as "floor", "guardrail", or "single source of truth". Keep comments short and in the same language as the nearby code.

## Security

Never commit `.env` files or secrets. Only `.env.example` belongs in git. Store passwords, session tokens, and invite tokens as hashes. Never log them, return them in error messages, or put session tokens in URLs.
