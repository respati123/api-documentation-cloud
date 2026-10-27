# Repository Guidelines (server)

This folder is the API: Bun and PostgreSQL. The entry point is `index.ts`, and `schema.sql` is applied on every start.

## Project

- `index.ts`: all routes, the WebSocket endpoint, and startup. Routes go through the single `handle()` dispatcher.
- `rate-limit.ts`: in-memory rate limiter used by auth and invite routes.
- `schema.sql`: idempotent schema. Each statement uses `IF NOT EXISTS`, so re-running it is safe.
- `shared/`: sync and merge logic. It is copied from the desktop app, so keep the two copies in step when that logic changes.
- `Dockerfile`: builds the API image from this folder as its build context.

## Commands

Run from the repository's `cloud/` folder (root scripts) or from this folder:

- `bun run api:dev`: API on port 3001, with watch mode.
- `bun run api:typecheck`: TypeScript check (`tsc -p tsconfig.json`).
- `bun run api:test`: `bun test server`.

Install dependencies with `bun install` in this folder.

## Rules

- **One dispatcher.** Add new routes inside `handle()` in `index.ts`, following the existing regex pattern for `/api/workspaces/:id/...`.
- **Errors use `HttpError`.** The response is `{ error: string, details? }` with the matching status. The portal shows the `error` text as is, so write messages that are safe and useful to show.
- **Authorize every workspace route** with `requireRole` before reading or writing workspace data.
- **Validate input** at the boundary: lengths, types, and allowed values. Reuse the existing validators (`validateTree`, `validateWorkspaceVariables`) when the input is a workspace snapshot.
- **Tests come with logic changes.** Add or update a `*.test.ts` file when you change sync, merge, rate-limit, or permission logic. Pure logic goes in its own module so it can be tested without starting the server.
- **Test real flows against a database** when you change a route. Start a temporary PostgreSQL container and a Mailpit container, and run the API against them.
- **Do not change API contracts silently.** If the portal or the desktop app depends on a field, update those callers in the same change.
- **Secrets and tokens are hashed.** Passwords use argon2id. Session, invite, and reset tokens are stored as SHA-256 hashes. Never log them.
- **Rate limits are per process.** The limiter is in memory. If the API ever runs more than one instance, move the limiter to a shared store first.
