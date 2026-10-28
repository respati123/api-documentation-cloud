# HTTP contract

Read this when you add or change a response, an error, input validation, CORS, or a header.

## Success responses

- Return the payload as-is: `{ workspaces: [...] }`, `{ workspace: {...} }`, `{ ok: true }`.
- Do not wrap success payloads in `data` or any other envelope.
- Keys are camelCase. Database columns are mapped in the repository, never exposed raw.
- Status codes: `200` read or update, `201` created, `204` no body.
- Build every success response with the helpers in `src/lib/http.ts`: `ok(payload)`, `created(payload)`, `noContent()`. Do not call `Response.json` in a route.
- Mutations that return nothing (delete, logout, password reset, forgot password) answer `204`. A mutation that changes a resource returns the changed resource.

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

## Error codes and messages

- **Codes** are constants in `src/lib/errors/codes.ts`, one object, `as const`. Example: `WORKSPACE_NOT_FOUND`, `ROLE_NOT_ALLOWED`, `RATE_LIMITED`. A shipped code is never renamed or reused.
- **Messages** are in two files: `src/lib/errors/messages/en.ts` and `src/lib/errors/messages/id.ts`. Each file is typed with `satisfies Record<ErrorCode, ErrorMessage>`. A missing code is a typecheck error, so no code can ship without both languages.
- **Parameters** are functions: `(params) => string`. Never build a message by joining strings at the throw site.
- **Throw by code.** Services throw `new AppError(ErrorCode.WORKSPACE_NOT_FOUND)`. The throw site never writes message text.

## Language negotiation

- The language comes from the `Accept-Language` header. `src/lib/locale.ts` parses it with quality values and picks the first supported language: `id` or `en`.
- When the header is missing or no language matches, the default is `en`.
- Every error response sets `Content-Language` to the language it used, and `Vary: Accept-Language` so caches never mix languages.
- The `error` field carries the message in that language. `code` is the same in every language.
- Clients send `Accept-Language` from the language the user picked. The web portal and the desktop app both do this.
- Log lines are always English. The `locale` field records what the client received.

## Adding a code

1. Add the code to `codes.ts`.
2. Add its message to `en.ts` and `id.ts`.
3. Write the test that expects the code, the status, and the message in the requested language first (TDD).
4. Run typecheck. If a language is missing, it fails here.
