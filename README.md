# API Documentation (cloud)

Cloud side of API Documentation: the browser portal (`src/cloud`), the API server (`server/`, Bun + PostgreSQL), and the Docker setup that runs them together.

## Local development

```
npm ci
(cd server && npm ci)
cp .env.example .env
docker compose up -d postgres mailpit
npm run api:dev       # API on http://localhost:3001
npm run cloud:dev     # web portal on http://localhost:5174
```

## Checks

```
npm run cloud:typecheck
npm run api:typecheck
npm run api:test
npm run cloud:build
```

`shared/` holds the sync and merge logic that the server tests run against. It is copied from the desktop app, so keep the two copies in step when that logic changes.

## Docker

`docker compose up -d --build` starts PostgreSQL, Mailpit, the API, and the web portal (nginx on port 3000 by default).
