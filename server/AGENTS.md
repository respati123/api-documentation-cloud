# Repository Guidelines (server)

This folder is the API: Bun, PostgreSQL, and a single HTTP surface used by the web portal and the desktop app. Core rules are below. Detailed guides are in `references/`. Read the guide that matches your task before you start.

## Layout (target)

```
server/
├── src/
│   ├── index.ts              bootstrap only: load config, run migrations, start the server
│   ├── app.ts                builds the Bun handlers and the request log wrapper
│   ├── router.ts             order of the route modules
│   ├── config.ts             env read and validated with zod at startup
│   ├── routes/               route tables, one file per area (workspaces, auth, sync, ...)
│   ├── services/             business rules, permissions, transactions
│   ├── repositories/         SQL only, returns typed rows
│   ├── middleware/           request id, auth, rate limit, CORS, error handling
│   └── lib/                  http helpers, logger, errors, validation helpers
├── migrations/               numbered SQL files, applied once each
├── tests/                    integration tests against a real PostgreSQL
├── shared/                   sync and merge logic copied from the desktop app
└── Dockerfile
```

The split is done for `index.ts`, `app.ts`, `router.ts`, `routes/`, `services/`, `lib/`, and `models/`. Route modules still hold some SQL inline. Move it to `repositories/` when you touch a route. New code follows the target layout.

## Commands

Run from the repository's `cloud/` folder (root scripts) or from this folder:

- `bun run api:dev`: API on port 3001, with watch mode.
- `bun run api:typecheck`: TypeScript check.
- `bun run api:test`: all server tests.

Install dependencies with `bun install` in this folder. The lockfile is `bun.lock`.

## References

| Read this | When |
|---|---|
| `references/architecture.md` | adding a route, moving code between layers, placing a file, imports, config |
| `references/http-contract.md` | response shape, error codes and messages, validation, CORS, headers |
| `references/observability.md` | logging, tracing, request ids, what to log on an error |
| `references/data.md` | SQL, migrations, transactions, performance, pagination, limits |
| `references/testing.md` | TDD workflow (required), integration tests, test database |
| `references/security.md` | auth, secrets, input limits, rate limits, what never to log or return |
| `references/code-quality.md` | naming, file and function size, parameters, comments |

## Core rules

- **MANDATORY: use Context7 for library docs.** Before you write or change code that calls Bun, zod, a PostgreSQL driver, nodemailer, or any other library, resolve the library ID with the Context7 MCP tools and query the docs for the exact API. Do not write library calls from memory. If Context7 is not available, use the official docs and say so in your reply. See `cloud/AGENTS.md`.
- **TDD is required.** Write a failing test first, then the code that makes it pass, then refactor. See `references/testing.md`.
- **Absolute imports only**, with the `@/` alias (`@/` points to `src/`). No `../` or `./` imports.
- **Layers stay separate.** Routes call services. Services call repositories. Repositories run SQL. Nothing skips a layer.
- **One response base.** Every JSON response has `code`, `requestId`, and either `data` (success, `200` or `201`) or `error` and `details` (failure). `204` has no body. Responses are built only by `src/lib/http.ts` and `src/middleware/error-response.ts`. See `references/http-contract.md`.
- **Error codes and messages are constants.** Codes live in one constant object. Each code has an Indonesian and an English message, and TypeScript fails the build if one is missing. The message language follows `Accept-Language`, with English as the default. See `references/http-contract.md`.
- **Every error is traceable.** Each request gets a request id. Every error is logged with its stack and cause chain, the request id, and the route. See `references/observability.md`.
- **Config comes from env and is validated at startup.** CORS origins come from `CORS_ORIGINS` in `.env`. The process refuses to start on a bad config.
- **Schema changes are migrations.** Add a numbered file in `migrations/`. Never edit an applied one. See `references/data.md`.
- **Every workspace route authorizes first** with the role check in the service layer, before reading or writing data.
- **Secrets are hashed or kept out of logs.** Passwords use argon2id. Session, invite, and reset tokens are stored as SHA-256 hashes. See `references/security.md`.
- **Small, readable code.** Functions stay short and take few parameters. See `references/code-quality.md`.

## Security

Never commit `.env` files or secrets. Only `.env.example` belongs in git. Never log a password, token, or secret. Never return a stack trace to a client.
