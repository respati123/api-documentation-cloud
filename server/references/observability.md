# Observability

Read this when you add logging, handle an error, or prepare a route for monitoring.

## Goal

Every error must be traceable from the client to the log line without guessing. Any monitoring tool (Loki, Datadog, CloudWatch, Grafana) should be able to read our logs with no custom parser.

## Logger

- One logger in `lib/logger.ts`. Use it everywhere. No `console.log` or `console.error` in application code.
- Output is one JSON object per line on stdout. Errors go to stdout too, with `level: "error"`.
- Levels: `debug`, `info`, `warn`, `error`. Set the minimum with `LOG_LEVEL`, default `info`.
- Every line has these base fields: `time` (ISO 8601), `level`, `msg`, `service: "api"`, `version` (from `APP_VERSION`).

```json
{"time":"2026-10-28T08:01:02.113Z","level":"error","service":"api","version":"0.1.6","msg":"request failed","requestId":"2c1f0b7e-8a4d-4b1e-9d2f-6a0c3e8b7d10","method":"POST","route":"/api/workspaces/:id/sync/push","status":500,"durationMs":41,"userId":"u_9f2a","workspaceId":"w_77c1","error":{"name":"PostgresError","message":"deadlock detected","code":"40P01","stack":"...","cause":{"name":"Error","message":"..."}}}
```

## Request id

- Read `X-Request-Id` from the client if present and it is a safe string up to 64 characters. Otherwise generate a UUID.
- Store it on the request context and return it in the `X-Request-Id` response header.
- Every log line for that request carries the same `requestId`.
- Propagating a W3C `traceparent` header is a later step. Keep `requestId` as the join key until then.

## Request log

One line per request, written when the response is sent:

- `msg: "request"`, `method`, `route` (the route pattern, such as `/api/workspaces/:id`, not the raw path), `status`, `durationMs`.
- `userId` and `workspaceId` when the request has them.
- Level: `info` for 2xx and 3xx, `warn` for 4xx, `error` for 5xx.

## Error log

Every error that reaches the error handler is logged with:

- `msg: "request failed"`, or a more specific message from the code that threw.
- `error`: `name`, `message`, `code` (if any), `stack`, and `cause` as a chain. Limit the chain depth to 5.
- The request context fields above.

Expected errors (validation, not found, forbidden) are logged at `warn` without a stack. Unexpected errors are logged at `error` with the stack.

## Never log

- Passwords, password hashes, session tokens, invite tokens, reset tokens, or any `Authorization` header value.
- Request or response bodies. Log the field names only if a validation error needs them.
- Cookies, SMTP passwords, database URLs with passwords.
- The full workspace snapshot. Log its id and size.

The logger redacts these keys automatically: `password`, `token`, `authorization`, `secret`, `cookie`, `databaseUrl`. Redaction is a safety net, not a reason to log more.

## Startup and background work

- Log the startup config summary (port, log level, CORS origin count, migration count) without secret values.
- Log migrations as they run, with the version and name.
- Log email delivery failures at `error` with the recipient's domain only, not the full address.

## Metrics (later)

Add counters and timings when a monitoring stack is chosen: request count and duration by route and status, database pool wait time, and rate-limit rejections. Route names must match the log `route` field so they can be joined.
