---
version: 1
slug: "src"
primary_target: "src"
related_targets: []
---

# Portal surface brief

Scope: the browser portal in `cloud/web/src`. Mode: operate, with the reading flow of the documentation view treated as part of operate.

## Direction contract

THESIS: The portal reads like a departures board for shared API contracts. Ranked rows, fixed columns, and changes that are visible and held until seen. It refuses the generic SaaS dashboard of identical cards.

OWN-WORLD: Matte near-black ground with a brushed steel frame, white condensed sans on every flap, amber for pending or syncing state, dim red for removed or cancelled items, and green only for confirmed sync. Tokens replace the current graphite palette.

STORY: A member sees at once which contract is current and finds an endpoint fast. A manager sees member changes, pending invites, and sync state at the same glance, and understands when the team's committed version changed.

FIRST VIEWPORT: The workspace list is a board: one row per workspace with name, role, last commit, and sync state in fixed columns. The primary action (open workspace, create workspace) sits top-right. A pending commit shows an amber row that stays lit until opened.

FORM: Split-flap cascade is the one signature move. It runs only on values that change (last commit, sync state, role changes), never as page decoration. Layout and navigation stay the portal's own. Seed: seed:033b328b70079fe9.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
