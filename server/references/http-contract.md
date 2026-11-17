# HTTP contract

Read this when you add or change a response, an error, input validation, CORS, or a header.

## Response base

Every JSON response has the same base. The base is written by the builders in `src/lib/http.ts` and `src/middleware/error-response.ts`, never by hand in a route.

Success (`200`, `201`):

```json
{
  "code": "OK",
  "requestId": "2c1f0b7e-8a4d-4b1e-9d2f-6a0c3e8b7d10",
  "data": { "workspaces": [ ] },
  "meta": { "nextCursor": null }
}
```

- `code`: `OK` for `200`, `CREATED` for `201`.
- `requestId`: the request id from the `X-Request-Id` header.
- `data`: the payload. Keys inside `data` are camelCase.
- `meta`: optional. Only list endpoints that paginate include it, with `nextCursor`.

Error (any `4xx` or `5xx`):

```json
{
  "code": "WORKSPACE_NOT_FOUND",
  "error": "Workspace tidak ditemukan.",
  "details": null,
  "requestId": "2c1f0b7e-8a4d-4b1e-9d2f-6a0c3e8b7d10"
}
```

- `code`: stable `SCREAMING_SNAKE_CASE`. Clients branch on it.
- `error`: the message in the language from `Accept-Language`. The server owns the text.
- `details`: `null` unless the error carries data, such as validation issues (`[{ path, message }]`) or the remote snapshot of a sync conflict.
- `requestId`: the same id as the response header and the log line.

No content (`204`): no body. The `X-Request-Id` header is still set, so the response can be traced.

Status codes: `200` read or changed resource, `201` created, `204` no body. Mutations that return nothing answer `204`. A mutation that changes a resource returns the changed resource.

## Error mapping

- Routes and services throw `AppError` with a code from `src/lib/errors/codes.ts`. The status comes from the code's definition, so a status is never typed by hand at a throw site.
- The fetch wrapper in `src/index.ts` turns any thrown error into a response through `errorResponse`. A value that is not an `AppError` becomes `INTERNAL_ERROR` with status 500. The real error is logged with its stack, and the client never sees it.
- A route does not translate errors itself.

### Status policy per endpoint kind

| Kind of request | Status | Examples |
|---|---|---|
| Read | `200` with the payload | `GET /api/me`, `GET /api/workspaces/:id/sync/pull` |
| Creates a resource or a record that others can refer to | `201` with the new id or resource | register, create workspace, create invite, accept invite, push commits, restore a version, sync ticket, desktop approve code |
| Issues a session from credentials or a code | `200` with the token and user | login, desktop exchange |
| Changes a resource | `200` with the changed resource | rename workspace, change member role |
| Removes or confirms without a payload | `204`, no body | delete workspace, delete member, delete invite, logout, forgot password, reset password |
| Resource does not exist or is not visible | error `404` with a code | pull of an unknown workspace |

Responses that carry a secret (token, ticket, invite link) also set `Cache-Control: no-store`. The list lives in `src/middleware/response-headers.ts`.

## Project issues, backlog, and sprints

These routes sit under `/api/workspaces/:workspaceId/projects/:projectId`. Every route authorizes in the service, from the member's role in that project. A request body is checked with a zod schema (`src/models/issue-input.ts`) and an unknown field is refused. Lists take `limit` (1 to 100) and an opaque `cursor`, and answer the next cursor in `meta.nextCursor`.

| Method and path | Who | Answer |
|---|---|---|
| `GET /issues?type=&sprint=&epic=` | member (drafts: PM, tech lead, and the author) | `200` `{ issues }`, paged by number. `sprint` is a sprint id or `none` |
| `POST /issues` | by type: PM and tech lead for epic, story, task. Any member for bug. Tech lead or a matching role for sub-task | `201` `{ issue }` |
| `GET /issues/:idOrKey` | member | `200` `{ issue }`. A key such as `PARI-12`, or a key the project had before, also opens it |
| `PATCH /issues/:idOrKey` | by field, see the issue service | `200` `{ issue }` |
| `POST /issues/:idOrKey/rank` | PM, tech lead | `200` `{ issue }`. Body `{ afterId?, beforeId? }` |
| `POST /issues/:idOrKey/publish` | PM, tech lead | `200` `{ issue }` |
| `GET, POST /issues/:idOrKey/checklist` | read: member. Write: who works on the issue | `200` `{ items }`, `201` `{ item }` |
| `PATCH, DELETE /issues/:idOrKey/checklist/:itemId` | who works on the issue | `200` `{ item }`, `204` |
| `GET, POST /issues/:idOrKey/links` | read: member. Write: who works on the issue | `200` `{ links }`, `201` `{ links }` |
| `DELETE /issues/:idOrKey/links/:linkId` | who works on the issue | `204` |
| `GET /backlog` | member | `200` `{ sprints, backlog: { items, nextCursor } }`. The planned and active sprints with their items, then the loose items by rank, paged |
| `GET, POST /sprints` | read: member. Write: PM, tech lead | `200` `{ sprints }`, `201` `{ sprint }` |
| `PATCH /sprints/:sprintId` | PM, tech lead | `200` `{ sprint }` |
| `POST /sprints/:sprintId/items` | PM, tech lead | `201` `{ sprints }`. Body `{ issueId, overrideReason? }` |
| `DELETE /sprints/:sprintId/items/:issueId` | PM, tech lead | `204` |
| `POST /sprints/:sprintId/start`, `/close` | PM, tech lead | `200` `{ sprint }`. Close takes `{ carryTo: sprintId \| 'backlog' }` |
| `PATCH /` (the project) | PM | `200` `{ project }`. Body `{ key?, mode?, productGoal? }` |

An AI agent key never ranks, publishes, links, or changes sprints, and it moves only a sub-task assigned to its owner. Error codes: `ISSUE_*`, `SPRINT_*`, and `PROJECT_KEY_TAKEN` in `src/lib/errors/codes.ts`.

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

## OpenID Connect endpoints (exception)

The endpoints under `/api/oidc/` answer plain JSON, with no `code`, `requestId`, or `data` wrapper. OIDC clients and OAuth tools expect that shape (for example `{ "error": "invalid_grant" }`). Only these routes use the helper in `src/lib/oidc-http.ts`. Authorize and end-session keep the normal response base, because the portal page calls them. The token and user info responses send `Cache-Control: no-store`.
