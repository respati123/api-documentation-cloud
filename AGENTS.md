# Repository Guidelines

This folder holds the cloud side of API Documentation. It is split into two independent apps. Read the guide for the app you are changing.

| Folder | What it is | Guide |
|---|---|---|
| `web/` | Browser portal (React, Vite, shadcn/ui, Tailwind) | `web/AGENTS.md` |
| `server/` | API (Bun, PostgreSQL) | `server/AGENTS.md` |

Shared files at this level: `docker-compose.yml` (local stack), `docker-compose.prod.yml` (production stack), `.env.example`, `.github/workflows/cloud.yml` (CI and deploy), and the root `package.json` that runs both apps.

Nothing in `web/` may import from `server/`, and nothing in `server/` may import from `web/`. The two apps talk only over HTTP and the WebSocket.

## Library documentation (mandatory)

- **Always use Context7 for library, framework, and API details.** Before you write or change code that calls a library (React, Vite, Tailwind, shadcn/ui, TanStack Query, zod, i18next, Bun, PostgreSQL drivers, and so on), resolve the library ID with the Context7 MCP tools, then query the docs for the exact API you need.
- Do not write library API calls from memory. If the docs and your memory disagree, the docs win.
- If the Context7 MCP tools are not available in the session, use the official documentation through WebFetch or WebSearch, and say in your reply that Context7 was not available.

## Git

- Start every change from an up-to-date `main`, on a branch: `feat/<scope>-<desc>`, `fix/...`, `test/...`, `refactor/...`, `chore/...`.
- Never commit directly to `main`. Never force-push `main`, and never move or delete a pushed tag.
- Conventional Commits. One logical change per commit, with its tests.
- Stage explicit paths, then read `git diff --cached --name-status` before committing. A file staged earlier goes into the next commit.
- Read `git log` before any `git reset`. Rewrite only your own unpushed commits.
- Never drop a stash you did not create.

## Commits and pull requests

- Do not add a "Generated with Claude Code" footer or any similar tool-generated line to commit messages or pull request descriptions.
- A pull request description explains what changed, how it was checked, and anything the reviewer should know. It ends with the last real section, not with a footer.
- Attribution lines that the user asked for explicitly are the only extra lines allowed in a commit or pull request.
- Base is `main`. One topic per pull request.
- List only checks that actually ran. Merge only when CI is green, using a merge commit (`gh pr merge --merge`).

## Commands

Run these from this folder.

- `bun run cloud:dev`: portal on port 5174.
- `bun run api:dev`: API on port 3001.
- `bun run cloud:typecheck`, `bun run api:typecheck`: type checks.
- `bun run cloud:build`: portal build into `web/dist/`.
- `bun run api:test`: server tests (`bun test server`).
- `bun run cloud:lint`, `bun run cloud:format`: Biome check and write, for the portal. Added during the frontend refactor.

Install dependencies once per app: `bun install --cwd web` and `bun install --cwd server`.

## Checks before push

Run `cloud:typecheck`, `cloud:lint`, `cloud:test`, `cloud:build`, `api:typecheck`, and the server tests. The route tests need a database. Without one they are skipped and the run still passes, so read the `skip` count.

```
PUBLIC_WEB_URL=http://localhost:5174 TEST_DATABASE_URL=postgres://apidocs:<password>@127.0.0.1:<port>/apidocs_test bun run api:test
```

`TEST_DATABASE_URL` must never point at the dev or production database. The CSRF tests send `http://localhost:5174` as their origin, so `PUBLIC_WEB_URL` must be that value. CI runs the same tests against its own Postgres, and fails if `TEST_DATABASE_URL` is missing.

## Changes across repos

A change the desktop app or the MCP package depends on goes in this order:

1. Server first. Keep the old behavior working, so clients already installed do not break.
2. Merge, tag, and deploy the server.
3. Check it in production.
4. Merge the client.

Say this order in both pull request descriptions. A merge to `main` does not reach production, so it is not enough for step 4.

## Release and deploy

Four separate steps, in order:

1. **Push or PR to `main`** runs checks only: typecheck, lint, tests, and the web build. No images are built.
2. **Push a tag `vX.Y.Z`** on the merge commit (`git tag v0.1.5 <sha> && git push origin v0.1.5`) re-runs the checks at that tag, smoke-tests the API container, then builds and pushes the `api` and `web` images to GHCR tagged `vX.Y.Z`. The web app version shown in the UI comes from the tag, not from `package.json`.
3. **Deploy** is manual: Actions → Cloud → Run workflow, enter the version (for example `0.1.5`), and type `deploy`. It refuses a version whose images are not in GHCR. Rollback is the same step with an older version.
4. **Check production:** sign in on the portal, and sign in from the desktop app.

The tag is the release. Nothing deploys on its own.

## Actions that need an explicit request

An agent does these only when asked for that action, in that conversation:

- push, open a pull request, merge
- create or push a tag
- deploy to production
- delete data in a local or production database
- change repo settings, secrets, or variables

A request for one does not cover the next. "Merge" does not mean "deploy". If a permission check refuses an action, stop and report it. Do not reach the same result another way.

## When something fails

- CI red: fix the cause. Do not skip the check.
- GitHub `5xx` during a workflow: read what already happened, then re-run the failed job once. A partly finished run may have already changed something.
- Production problem after a deploy: roll back first, then investigate.

## Comments

Comments should read like ordinary code, not generated text. Add a comment only when the reason is not obvious from the code. No section banners, no filler such as "This function handles...", and no slogan phrases such as "floor", "guardrail", or "single source of truth". Keep comments short and in the same language as the nearby code.

## Security

Never commit `.env` files or secrets. Only `.env.example` belongs in git. Store passwords, session tokens, and invite tokens as hashes. Never log them, return them in error messages, or put session tokens in URLs.
