# MVP verification

2026-11-24. Backend calls in browser tests are synthetic fixtures, not live account verification.

- PASS, native-tag requirement: TypeScript AST test checks all application/feature TSX; native tags exist only in generated shadcn components and the HTML entry.
- PASS, build and contracts: TypeScript and production build succeed. Four transport/service tests verify cookie credentials, errors, pagination, branch reads and workspace creation payload. One AST rule test passes.
- PASS, interaction and responsive checks (R-03, R-26, R-27, R-32, R-35): six Playwright runs cover desktop 1440px and mobile 390px; login/logout, forgot/reset, invite registration, create/cancel, request reading/search, member/history tabs, sidebar and retry. Escape closes the dialog. Browser page-error list is empty. Overflow assertion passes. Desktop/mobile workspace screenshots inspected.
- PASS, content integrity (R-17, R-18, R-23, R-24, R-28, R-36, R-38): no testimonials, marketing statistics, decorative assets or ghost routes. Test-only fixture content stays in tests. Limitations are listed in README.
- PASS, purpose and liveliness: DESIGN.md records paper/ink direction, restrained palette, system type, document-first hierarchy, icons for actual actions, role/method badges and no unnecessary effects. Energy 2 / rhythm 2 / motion 1.
- PASS, consistency: generated shadcn component variants supply spacing, focus, disabled states and controls; shared theme tokens set paper/ink surfaces and corners. Reduced-motion override is present. System fonts and absence of remote media avoid external render dependencies. Performance field metrics were not measured.

Live cookie authentication, production reverse proxy and database integration remain unverified. This reader MVP does not implement every feature of the existing portal; see README scope.

## i18n, admin pages, and routes (2026-11-26)

Backend calls in browser tests are synthetic fixtures. No live server or account was used.

- PASS, typecheck: `bun run typecheck` exits 0.
- PASS, unit tests: `bun run test` runs 6 files, 27 tests. They cover i18n key parity, non-empty values, keys used in code, interpolation placeholders, URL round-trips and legacy links, the native-tag AST rule, and transport/service behavior.
- PASS, build: `bun run build` succeeds. Vite warns that a chunk is over 500 kB; no code splitting was added.
- PASS, Playwright: `bunx playwright test` runs 20 tests on desktop 1440px and mobile 390px, with none skipped. They cover i18n persistence, URL routes with back/forward, scroll areas, admin users (accounts, invitations, roles, app admin toggle), admin workspaces (search, load more, read-only open), non-admin denial, and the portal MVP flows.
- Found and fixed during this run: the notifications menu failed on mobile when its data was incomplete. It now handles a missing list.
- Not verified: unit tests for the admin view models and services were deferred at the owner's request. A live account and the production reverse proxy (SPA fallback for `/w/...` and `/admin/...`) are not verified.

## Collapsed sidebar update

- PASS: official shadcn `collapsible="icon"` leaves a 48px icon rail; all menu items retain accessible names and collapsed tooltips. Header, workspace names and email hide in icon mode. Sidebar footer uses the same menu control as navigation.
- PASS: production build and five unit tests pass; desktop/mobile browser suite passes. The added desktop collapse/expand check passes with width assertion, visible tooltip, request navigation from the rail and expansion.
- PASS: collapsed screenshot inspected; no clipped label text or disappearing workspace controls. Existing paper/ink tokens and reduced-motion behavior remain in use. No new assets or native JSX tags added to feature views.
