# HTTP contract

Read this when you add or change a response, an error, input validation, CORS, or a header.

## Success responses

- Return the payload as-is: `{ workspaces: [...] }`, `{ workspace: {...} }`, `{ ok: true }`.
- Do not wrap success payloads in `data` or any other envelope.
- Keys are camelCase. Database columns are mapped in the repository, never exposed raw.
- Status codes: `200` read or update, `201` created, `204` no body.

## Error responses

Every error has this shape:

```json
{
  "error": "Workspace not found.",
  "code": "WORKSPACE_NOT_FOUND",
  "requestId": "2c1f0b7e-8a4d-4b1e-9d2f-6a0c3e8b7d10"
}
```

- `error`: the message the client shows. The server owns the text. Write it so a user can act on it. Do not include internal details.
- `code`: stable `SCREAMING_SNAKE_CASE`. Clients may branch on it. Never rename a code once shipped.
- `requestId`: the id from the `X-Request-Id` response header. Include it in every error so support can find the log line.
- `details`: only for validation errors. A list of `{ path, message }`. Omit it everywhere else.

Map errors in one place: `middleware/error-handler.ts`. Routes and services throw typed errors from `lib/errors.ts`:

- `ValidationError` → 400
- `UnauthorizedError` → 401
- `ForbiddenError` → 403
- `NotFoundError` → 404
- `ConflictError` → 409
- `RateLimitError` → 429
- Anything else → 500 with `code: "INTERNAL_ERROR"` and the generic message `Something went wrong. Try again.`. The real error is logged, never sent.

A service throws the error that matches the situation. The handler does not translate errors itself.

## Validation

- Validate every request body, query, and path parameter at the route boundary with a zod schema.
- Reject unknown fields where the contract is strict.
- Limit sizes in the schema: string lengths, array lengths, object depth. The snapshot validators in `shared/` already do this for workspace trees.
- Parse, do not trust. Use the parsed value after validation, never the raw body.
- Set a body size limit per route. The default is small. Sync push gets a larger limit, and only that route.

## CORS

- Allowed browser origins come from `CORS_ORIGINS` in `.env`, a comma-separated list such as `https://docs.example.com,http://localhost:5174`.
- Only listed origins get `Access-Control-Allow-Origin`. Any other origin gets no CORS header, so the browser blocks it.
- Requests without an `Origin` header (the desktop app, curl, server-to-server) are not CORS requests and are allowed by the normal auth check.
- `Access-Control-Allow-Credentials` is not set. Clients send the bearer token in the `Authorization` header.
- The preflight `OPTIONS` response uses the same allowlist. Do not use `*` anywhere.
- `Vary: Origin` is always set, so caches do not mix origins.

## Headers

Every response sets:

- `X-Content-Type-Options: nosniff`
- `X-Request-Id: <id>`
- `Referrer-Policy: no-referrer`

Responses that contain a session or a token also set `Cache-Control: no-store`. This covers login, register, `/api/me`, and desktop login exchange.

## Message language

Messages are English, because the portal shows them unchanged today. Keep them stable. If the portal is later localized, map `code` to a translation and keep the server text as the fallback.
