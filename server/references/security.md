# Security

Read this when you touch auth, sessions, tokens, passwords, input from a client, rate limits, CORS, or logs.

## Threat model in short

- Anyone on the internet can reach the public API routes. Assume every request is hostile.
- Browsers run the portal. Browsers can be used against the API from another origin, so CORS and token handling matter.
- The database and the SMTP account are the most valuable targets. Keep their credentials in env, never in code.

## Authentication

- Session tokens are random, at least 32 bytes, base64url encoded. Only the SHA-256 hash is stored.
- A session expires after its lifetime (30 days today). Logout deletes the session row.
- Password reset deletes every session for the user.
- Passwords use argon2id through `Bun.password`. Policy: 10 to 256 characters.
- Login errors never say whether the email exists. Use the same message for unknown email and wrong password.
- Session tokens are never accepted in query strings. Only the `Authorization: Bearer` header. The one exception is the WebSocket ticket, which is short-lived (30 seconds), single use, and only usable to open the sync connection.

## Authorization

- Every workspace route checks membership and role in the service layer before any read or write.
- A missing membership returns `404`, not `403`, so the caller cannot discover that a workspace exists.
- A role that is not allowed returns `403`.
- The owner role cannot be changed or removed through the API. Ownership transfer is a separate, explicit feature.
- Test each role against each protected route (see `testing.md`).

## Tokens in other flows

- Invite, reset, and desktop-login codes are random, single-use, and expire. Store their hashes.
- A used or expired token returns the same error as an invalid one.
- Desktop login codes expire in 2 minutes and are removed after one use.

## Input

- Validate every input at the route boundary with zod (see `http-contract.md`).
- Size limits everywhere: strings, arrays, object depth, body bytes.
- Never interpolate input into SQL, file paths, shell commands, or URLs without encoding.
- Email addresses are lowercased and trimmed before lookup or storage.
- Validate file names and paths if files are ever accepted. Reject `..` and absolute paths.

## Rate limits

- Login, register, forgot password, reset password, and invitations are rate limited per IP and per account.
- Limits and windows are constants in one place, not scattered inline.
- A limit hit returns `429` with the standard error shape. It does not reveal which limit was hit.
- Client IP comes from `CF-Connecting-IP` behind Cloudflare. Without that proxy, `X-Forwarded-For` can be spoofed, so set `TRUST_PROXY` explicitly and document it.

## CORS and headers

- CORS origins come only from `CORS_ORIGINS` in `.env`. No wildcard.
- Set the response headers in `http-contract.md` on every response.
- Set `Cache-Control: no-store` on any response that contains a token or a user.

## Secrets and logs

- Secrets live in env. `.env` is never committed. `.env.example` has placeholders only.
- Never log, return, or echo a secret, token, password, hash, or the database URL. See `observability.md`.
- Rotate any secret that was ever committed, even if it was removed later.

## Dependencies

- Keep `bun.lock` committed. Install with `--frozen-lockfile` in CI and in Docker.
- Run a dependency audit in CI before a release. Fix or document each finding.
- Pin the Bun version used in CI and Docker.

## Production hygiene

- Run the API as a non-root user (the Dockerfile already uses `USER bun`).
- The API port is bound to localhost in production. Only the tunnel or proxy reaches it.
- Give the application database user only the privileges it needs. Migrations may need a separate, more privileged user later.
- Any new public route is reviewed for auth, rate limit, input limit, and what it logs.
