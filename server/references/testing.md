# Testing (TDD required)

Read this before you write any server code. TDD is the default for this server.

## The cycle

For every behavior, in this order:

1. **Red.** Write one test that describes one behavior. Run only that test file and confirm it fails with the expected message. A test that passes before the code exists is wrong.
2. **Green.** Write the smallest code that makes the test pass. Hard-coding a value is allowed at this step if it is the next test that forces the real logic.
3. **Refactor.** Clean up with the tests green. Run the full test suite before you hand off.

Write the test first even for a small fix. A bug fix starts with a failing test that reproduces the bug.

## What to test, by layer

| Layer | Kind of test | Database |
|---|---|---|
| `lib/` | Unit | none |
| `services/` | Unit with fake repositories, for rules and permissions | none |
| `repositories/` | Integration against the test database | real PostgreSQL |
| `routes/` | Integration over HTTP | real PostgreSQL |
| `migrations/` | Integration: apply all, then apply again | real PostgreSQL |

Route tests are the main safety net. Each protected route needs at least:

- a success case,
- a `401` without a token,
- a `403` for every role that must be refused,
- a `404` for a resource the caller cannot see,
- a validation `400` with `details`.

## Test database

- Tests read `TEST_DATABASE_URL`. They refuse to run if it is missing or points at the same database as `DATABASE_URL`.
- Each test file creates its own schema or truncates its tables before it runs. Tests do not depend on order or on data left by another test.
- The local stack's Postgres container is used for local runs. CI starts a PostgreSQL service container.

## Conventions

- Test names describe behavior: `returns 403 when an editor tries to delete the workspace`.
- One behavior per `test` block. Keep the arrange, act, assert steps visible.
- Use real HTTP calls in route tests through the app's handler, not mocks of the framework.
- Mock only things outside the process: email, the clock when needed, and external HTTP.
- Do not test private helpers directly if a public function covers them.

## Commands

- `bun run api:test`: all tests.
- Run one file while you work: `bun test server/<name>.test.ts`.
- Typecheck with `bun run api:typecheck` before handoff.

## Definition of done for a server change

1. The new tests were written first and failed for the right reason.
2. All tests pass, including the route tests for the change.
3. Typecheck passes.
4. The migration (if any) applies on a fresh database and on one that already has the previous migrations.
5. The new `.env` variables (if any) are in `.env.example`.
