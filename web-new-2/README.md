# web-new-2

Independent React + Vite MVP for the API Documentation cloud server. Components are generated from the official shadcn/ui registry. Feature views compose those components without native HTML tags; native markup lives inside generated UI components and the required Vite HTML entry.

```sh
bun install
bun run dev
```

Open http://127.0.0.1:5176. Start the existing server separately from `cloud` with `bun run api:dev`. Vite proxies `/api` and `/health` to `http://localhost:3001` and preserves Host for cookie/CSRF compatibility. No server changes or database migration are required. For production, serve `dist` with a same-origin `/api` reverse proxy to the existing server and SPA fallback to `index.html`.

## Included

- Cookie session restore, sign-in/out, invite registration at `/join?token=...`, forgot/reset password.
- Paginated workspace list, name filter, workspace creation.
- Collection tree, request search and documentation/body reader, including branch-based workspaces.
- Paginated members, role changes, member removal, invitations and legacy workspace commit history.
- Paginated commit history for each collection branch.
- Personal MCP key creation/revocation and administrator key search/revocation, using the existing cloud API.
- Admin only: user accounts (search, app admin toggle, role changes, invitations by email, cancel invitation), role master (create, delete), and every workspace (search, load more, open read-only unless a member).
- English and Indonesian UI, switchable on the sign-in page and in the account menu, saved in localStorage.
- Browser URLs for each section, request, and history branch, so links can be shared and back/forward work.
- Loading, error, retry and empty states; responsive shadcn sidebar.

## Scope

This is the first reader MVP, not full feature parity with `web`. Project planning and desktop authorization are not implemented here. OIDC (sign-in for other apps) is out of scope: StitchKit and DBDesign are meant to live in this same web app, so the portal does not expose `/oidc/authorize` or `/oidc/logout`. The Project, UI · Stitchkit and Database · DBDesign workspace sections are still placeholders. Collection editing and request execution are outside this read-focused portal; changes are made and committed from the desktop app.

## Structure

`src/app` owns providers, `src/features/portal` separates models, services, viewmodel hooks and presentation, `src/lib` owns the HTTP transport, and `src/components/ui` contains generated shadcn primitives. No imports from the existing web or server applications.

## Checks

```sh
bun run typecheck
bun run test
bun run build
bunx playwright test
```

Browser tests intercept HTTP with explicitly synthetic fixtures and do not change a real workspace. The live backend/database must be running to verify a real account.
