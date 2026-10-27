# API Documentation (cloud)

Cloud side of API Documentation. It has two apps that run independently:

- `web/`: the browser portal (React, Vite).
- `server/`: the API (Bun, PostgreSQL), including the sync logic in `server/shared/`.

Each app has its own guide for contributors: `web/AGENTS.md` and `server/AGENTS.md`.

## Local development

```
bun install --cwd web
bun install --cwd server
cp .env.example .env
docker compose up -d postgres mailpit
bun run api:dev       # API on http://localhost:3001
bun run cloud:dev     # web portal on http://localhost:5174
```

## Checks

```
bun run cloud:typecheck
bun run api:typecheck
bun run api:test
bun run cloud:build
```

`server/shared/` holds the sync and merge logic that the server tests run against. It is copied from the desktop app, so keep the two copies in step when that logic changes.

## Docker

`docker compose up -d --build` starts PostgreSQL, Mailpit, the API, and the web portal (nginx on port 3000 by default). The web image is built from `web/` and the API image from `server/`.
