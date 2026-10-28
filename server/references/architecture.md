# Architecture

Read this when you add a route, move code between layers, place a file, or change config.

## Layers

| Layer | Responsibility | May import |
|---|---|---|
| `routes/` | Route table: method, path, auth, body schema, and the handler that calls one service | `services`, `middleware`, `lib` |
| `services/` | Business rules, permission checks, transactions, orchestration | `repositories`, `lib`, `config` |
| `repositories/` | SQL and row mapping. Returns typed rows | `lib` |
| `middleware/` | Cross-cutting: request id, auth, rate limit, CORS, error mapping | `services` (auth only), `lib` |
| `lib/` | Pure helpers: http, logger, errors, validation helpers | nothing from the layers above |
| `config.ts` | Env read and validated with zod | nothing from the layers above |

- Routes never run SQL.
- Services never build HTTP responses.
- Repositories never check permissions.
- `lib/` never imports from a layer above it.

## Route table

Routes are declared as data, not as an `if` chain:

```ts
export const workspaceRoutes: RouteDefinition[] = [
  { method: 'GET', path: '/api/workspaces', auth: 'user', handler: listWorkspaces },
  { method: 'POST', path: '/api/workspaces', auth: 'user', body: createWorkspaceBody, handler: createWorkspace },
]
```

The dispatcher matches the route, runs the middleware, and calls the handler. Adding a route means adding one entry and writing its service and tests.

## Config

- All env is read in `config.ts` and nowhere else.
- `config.ts` validates with zod at startup. A missing or invalid value stops the process with a clear message that names the variable.
- No `process.env` reads inside routes, services, or repositories.
- Required: `DATABASE_URL`, `PUBLIC_WEB_URL`. Optional with defaults: `PORT`, `SMTP_*`, `CORS_ORIGINS`, `DB_POOL_MAX`, `DB_STATEMENT_TIMEOUT_MS`, `APP_VERSION`.
- `.env.example` lists every variable with a placeholder value. Keep it in sync when you add one.

## Imports

- Absolute imports with the `@/` alias, which points to `src/`. Set in `tsconfig.json` (`paths`). Bun resolves it at runtime.
- No `../` or `./` imports.
- Tests import the same way.

## Files

- A file has one concern. Target at most about 300 lines. The current `index.ts` (about 620 lines) is the migration target.
- Name files for what they hold: `workspace.service.ts`, `workspace.repository.ts`, `workspaces.routes.ts`.
- Keep `index.ts` as the bootstrap only.
