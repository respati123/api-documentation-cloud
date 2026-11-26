# Unslop UI design report: web-new-2

Scope: every user-facing screen of `web-new-2` (auth, workspace directory, workspace overview, collections, history, team, settings, design placeholders, my MCP keys, admin MCP keys, notifications, sidebar, dialogs). No `DESIGN_REFERENCE` was given, so rebuilt components start from the existing shadcn primitives in `src/components/ui`.

Binding rules: `DESIGN_RULES.md` (updated in place; it already existed).

## How "before" and "after" were captured

- **Before**: the session-start snapshot of `src/`. The working tree was mid-edit by another session when this pass began (see *Concurrent edits* below). The snapshot did not compile because `portal.view.tsx` was missing one closing `</FieldGroup>`. The baseline copy used for screenshots had only that tag added. Nothing in the repository was changed to produce it.
- **After**: the live working tree on the dev server, after the last edit.
- Both sets come from the same harness: 17 screens in three variants (desktop 1440×900 light, desktop with `.dark` applied to `<html>`, and phone 390×844 light), 50 files per set. All API data is synthetic (`fixture@example.test`).

Screenshot folders:

- `unslop-ui-design/before/`: 50 PNG files
- `unslop-ui-design/after/`: 50 PNG files

Pairs share a file name. Examples: `overview-desktop.png`, `collections-selected-request-mobile.png`, `team-mobile.png`, `mcp-keys-desktop.png`, `notifications-menu-desktop.png`, `auth-register-mobile.png`.

## Phase 1: Inventory

| Tell | Where it was | Result |
| --- | --- | --- |
| Accent on non-active elements: primary buttons, links, resting icons, skeletons, hover fills | `--primary` blue across `.workspace-content`; "New workspace", "See all", recent-workspace icons, skeleton `bg-accent` | **Fixed.** Primary is ink. Blue is now only `selected` (selected request row) and `info` (POST label). Skeleton and hover fills are neutral. |
| Icons beside every label | Four summary cards, sidebar account and section popovers, "New workspace", "Create key", "Mark all read", "Revoke key", request rows and folder rows in Collections, member rows, auth inputs | **Fixed** for the listed cases. Kept: sidebar rail icons (the only label when collapsed), copy and password-visibility toggles (functional), and chevrons (navigation). |
| Nested cards | Collections page wrapped `EndpointDocumentView` inside a `Card` | **Fixed.** Outer card removed. History tab card header removed. |
| Empty-state boxes inside cards | `Empty` used a dashed, rounded border | **Fixed.** Border removed. |
| Decorative pills | Request metadata pills (Auth, Path, Query, Headers, Body, Responses) | Already converted to a text line by the concurrent session before my first edit. Left as is. |
| Redundant subtitles | "Workspace history" under "Recent changes" and under "Your workspaces"; "Collections and requests" heading repeating the page title; "UI · Stitchkit" coming-soon card repeating the page header | **Fixed.** |
| Dev name in product UI | Coming-soon text said the section "is being brought into web-new-2" | **Fixed.** Now "Not available in this app yet." |
| Vague or marketing copy | "Keep your collections and their documentation together", "Your first workspace starts here", "A shared home for your team's API collections", "Your collections, documentation and team in one workspace.", "You're all caught up" | **Fixed.** Rewritten short and specific. The auth footer note was removed. |
| Colored or left bars | `border-l-2` on response items | **Fixed.** Removed. |
| Border collisions | Auth footer used a separator plus a tinted footer | **Fixed.** Footer shows only the "Back to sign in" action, when relevant. |
| Type scale off the scale | `text-4xl` (page title), `text-3xl`/`sm:text-4xl` (auth title) | **Fixed.** Page and auth titles are `text-2xl` (24px). Scale is now 12/14/16/18/24. |
| Motion: press feedback as opacity | `button:active { opacity: .85 }` | **Fixed.** `transform: scale(0.97)`. |
| Motion: keyboard highlights | Focus transitions took 150ms | **Fixed.** `:focus-visible { transition-duration: 0ms }`. |
| Motion: exits faster than entries | Dialog and sheet enter/exit classes were identical, and the classes did nothing because `tw-animate-css` was not installed | **Fixed.** `tw-animate-css` installed and imported. Enter 200ms, exit 150ms, tooltip 150/100. |
| Badge overlapping an icon | Notification count sat on top of the bell in the collapsed rail | **Fixed.** Collapsed state shows an 8px dot. |
| Icon in a rounded box / letter logo / check-in-circle / numbered list / avatar stack / emoji / glow / gradient / all caps / eyebrow / Title Case / bold weights / raw hex / shadow on a non-floating element | Searched in `src/` | **Already absent** at session start. No occurrences found. |

## Phase 2: DESIGN_RULES.md

Updated the existing file in place (no second rules file). It now has:

- A **Never** list: 20 lines with reasons where the reason is not obvious.
- An **Always** list: color tokens with their values, the five-step type scale with weights, radii (6, 8, full), spacing, elevation, motion budget in milliseconds (now matching the installed animations), focus treatment, and layout rules at 390px.
- A "Done means" section tied to this report.

`DESIGN.md` already states that `DESIGN_RULES.md` supersedes it, so I left `DESIGN.md` unchanged.

## Phase 3: Fixes applied

Token, CSS, and dependencies (`src/index.css`, `package.json`):

- Primary is ink (`#242B35` light, `#E9EEF5` dark). Blue moved to new tokens `selected`, `selected-foreground`, and `info`.
- Accent is neutral (`#EDF1F6` light).
- Press feedback is scale 0.97.
- Keyboard focus is instant.
- `tw-animate-css` 1.4.0 added as a dev dependency and imported. This makes the shadcn `animate-in`/`animate-out` classes real.

Primitives:

- `skeleton.tsx`: neutral `bg-muted`, no blue.
- `empty.tsx`: no dashed border, no rounded box, padding `p-6 md:p-10`.
- `breadcrumb.tsx`: list no longer wraps.
- `dialog.tsx`, `sheet.tsx`, `popover.tsx`, `select.tsx`, `tooltip.tsx`: explicit enter and exit durations. Popover previously had no animation classes at all.

Views:

- `portal.view.tsx`: title `text-2xl`; copy rewritten; "New workspace" has no icon; breadcrumb hides the product crumb and the section-group crumb below `sm`; dialog copy rewritten.
- `portal-sidebar.view.tsx`: icons removed from the account popover and the compact section popover. Rail icons kept.
- `summary-card.view.tsx`: `icon` prop removed. Callers updated in `workspace.view.tsx` and `workspace-directory.view.tsx`.
- `workspace.view.tsx`: Collections and History wrappers simplified; coming-soon text is one line; "Recent changes" subtitle removed; member row icon removed.
- `workspace-directory.view.tsx`: summary icons and recent-list folder icon removed; duplicate subtitle removed.
- `workspace-team.view.tsx`: heading and invitation blocks use `min-w-0 flex-1` (they were squeezed to about 70px). Members render as a table from `sm` up, and as a stacked card list below `sm` (`workspace-member-card-<id>`). Actions header and role select no longer forced to `w-32`.
- `collections.view.tsx`: request and folder icons removed; selected row uses `bg-selected`; preview banner is neutral.
- `endpoint-document.view.tsx`: response-item left bar removed. Tabs fit on one line at 390px (tight gap), with no scroll and the active underline fully visible. If a narrower screen forces a wrap, the tabs wrap onto a second row; they never scroll or overlap. Trigger `h-auto` and list `group-data-[orientation=horizontal]/tabs:h-auto` override the primitive's fixed heights.
- `auth.view.tsx`: input icons removed; title `text-2xl`; footer note removed; footer shows only "Back to sign in" when relevant.
- `mcp-keys.view.tsx`: header is one row (count left, "Create key" right). It was clipped at the left edge before. Plus and shield icons removed from buttons. My MCP keys and admin MCP keys pages are full width (the `max-w-5xl` and `max-w-6xl` caps were removed).
- `notifications-menu.view.tsx`: row uses a `FieldGroup` so the "New" badge no longer stretches to full width and the message no longer overflows the popover; "Mark all read" has no icon; empty copy changed to "No notifications"; collapsed count is a dot.
- `request-documentation.utils.ts`: POST label uses `text-info`.

Tests (`tests/portal.spec.ts`):

- The spec was stale. It used testids that no longer exist (`workspace-members-tab`, `workspace-history-tab`, `workspace-collections-tab`), did not answer the notifications endpoint, and expected a request to be visible without expanding its folder.
- Rewritten to the current navigation: sidebar sections through `openSection`, folder expanded explicitly, documentation read through its tab, team check per layout, and logout. Same flows, same connection-error and invite tests.

## Phase 4: Screenshot verification

Results from the final harness run on the after build:

- 50 of 50 screenshots captured.
- No horizontal page overflow at 390px on any screen.
- No uncaught page errors on any run.

Defects found and fixed during verification:

- Breadcrumb items overlapped at 390px.
- MCP keys header clipped at the left edge.
- Notification row overflowed the popover.
- Team table columns overlapped at 390px. Now replaced by stacked cards below `sm`.
- Collections tabs wrapped under content.
- Team header text squeezed to a narrow column.

## Phase 5: Cut

Removed: subtitles that repeated headings, icons next to labels in summary cards and menus, the auth footer note, the decorative response-item bar, the Collections and History card wrappers, and the coming-soon card.

## Verification

- `bun run typecheck`: pass.
- `bun run test` (vitest): 5 of 5 pass, including the native-JSX rule test.
- `bun run build`: pass. `dist/` reflects the current source.
- Playwright, `tests/portal.spec.ts` (desktop and mobile projects): **6 of 6 pass**. Before this round it was 3 failed and 3 passed on both before and after builds, for the reasons listed under *Tests* above.
- Screenshot harness on the after build: 50 of 50 captured, no horizontal overflow at 390px, no page errors.

## Still not done

- **Dark mode switch**: the app has no dark-mode toggle and never applies `.dark`. The dark token set is verified only by forcing `.dark` on `<html>` in the harness. Adding a switch is a product decision (toggle placement, default, whether to follow the OS setting), so I did not add one.
- **Admin MCP keys and the design placeholders against live data**: the local API server on port 3001 is running, but these screens sit behind an admin login. I have no test credentials, and I did not create an account or seed the admin user. The screenshots use synthetic data only. To finish this, give me a test account on the local server (or run `bun run api:seed-admin` yourself and share the email), and I will capture the authenticated screens against the real backend.

## Decisions kept on purpose

- **Focus ring**: 3px at 50% opacity stays. It is a keyboard focus indicator for accessibility, not a glow.

## Concurrent edits and other changes you should know about

- Another session edited files in this folder between about 23:10 and 23:16. It left `portal.view.tsx` and `notifications-menu.view.tsx` uncompilable for several minutes. That session also made part of the same design changes (endpoint pills flattened, method colors, notification styling, text scale). I kept its changes and built on the state after its edits stopped at about 23:20.
- Two Vite dev servers from other sessions were already running (ports 4173 and 5176). I used 5176 for after screenshots, since Vite serves the live working tree. I stopped only the servers I started.
- Playwright's runs clear the `test-results/` folder before writing their own output. That removed two untracked screenshots that were there before: `desktop-sidebar-collapsed.png` and `desktop-workspace.png`. They were not in git, and I did not keep a copy. The current spec no longer writes them.
- `dist/` was overwritten at 23:28 by a Vite build, which replaced the 11:45 build. The pre-session `dist/` cannot be restored from here. I rebuilt `dist/` from the current source so it matches the code.
- `web-new-2` is untracked in the `cloud` repository. Nothing is committed, staged, or pushed.
- `package.json` and `bun.lock` now include `tw-animate-css` (dev dependency).
- Context7 was used once to confirm the `tw-animate-css` import and duration utilities.
