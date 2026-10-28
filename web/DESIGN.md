# Design system: cloud portal

Written from the built portal (`src/index.css`, `src/features/**`, `src/shared/components/**`). Product truth lives in `PRODUCT.md`. The surface brief and direction contract live in `.impeccable/surfaces/src.md`.

## Direction

Split-flap concourse, Operate mode. A matte near-black ground with ivory type and an amber accent. Layout and navigation are the portal's own. The world supplies type, palette, density, and one signature move.

The signature is the split-flap cell (`src/shared/components/split-flap.tsx`). It runs only on values that change, such as the API status and the latest version. Cells that did not change stay still. Reduced motion turns the flip off.

## Color

All colors are tokens defined once on `:root` in `src/index.css`. Components use the tokens (`bg-background`, `text-muted-foreground`, and so on). There are no hex values in components.

| Token | Value | Use |
|---|---|---|
| background | `#0b0d0f` | page ground |
| foreground | `#f2efe6` | ivory text |
| card | `#13171a` | cards and panels |
| primary | `#f0b429` | primary actions, focus ring, links, amber status |
| primary-foreground | `#15110a` | text on primary |
| secondary | `#1c2226` | flap cells, avatars, badges |
| muted / muted-foreground | `#171c20` / `#9aa3a8` | secondary text |
| border / input | `#2a3035` / `#343c43` | steel frame and field borders |
| destructive | `#c4493f` | removals, failures, deleted items |
| success | `#5fb97a` | connected API status |
| warning | `#f0b429` | pending state, shares the amber |
| sidebar | `#080a0c` | navigation rail |

Amber carries emphasis and pending state. Green marks confirmed sync. Red marks removal and failure.

## Type

- One family: the system sans stack from `--font-sans`.
- Headings: semibold, `tracking-tight` for the page title.
- Body: `text-sm`. Labels and metadata: `text-xs` in `text-muted-foreground`.
- Counts and numbers: `tabular-nums`.
- Sentence case everywhere. No all-caps eyebrows, which the craft floor refuses.

## Shape and spacing

- Radius base `0.5rem`. Cards use the shadcn default (`rounded-xl`). Pills are for badges only.
- Page sections: `gap-6`. Main content padding: `p-4` on small screens, `p-6` from `md`.
- Sidebar: `w-64` from `md`. Below `md`, the same navigation sits in a `Sheet`.
- Tables hide the joined-date column below `md`.

## Components

Every view uses shadcn components. The generated files live in `src/shared/components/ui/`.

Layout and navigation: `Breadcrumb`, `Sheet`, `ScrollArea`, `Separator`, `Tabs`.
Data: `Table`, `Card` (with `CardAction`), `Badge`.
Input: `Input`, `Label`, `Select`, `Button`.
Feedback: `Alert` (notices and errors), `AlertDialog` (confirmations), `Dialog` (invitations), `Empty` (empty states), `Skeleton` (loading).
Shared: `LoadingState`, `ErrorState`, `EmptyState` (`src/shared/components/state-views.tsx`), `CopyButton`, `SplitFlap`.

## States

- Loading: a label plus a `Skeleton` block of the same width as the content. No full-screen spinner.
- Error: `Alert` with the backend message unchanged and a retry button.
- Empty: `Empty` with a title, one sentence of guidance, and the next action when one exists.
- Notice: a top `Alert` from the notice store. It clears itself after 5.5 seconds and can be dismissed.
- Destructive actions (remove, leave, restore, delete) open an `AlertDialog`. Delete also needs the workspace name typed.

## Motion

- The only authored motion is the split-flap cell flip (`animate-flap-drop`, 320ms, ease-out). It runs on changed cells only.
- `motion-reduce:animate-none` turns it off.
- Collapsible folders use the shadcn transition on the chevron.

## Content

- Every visible text comes from a locale key in `id` and `en`, reached through a constant in `features/<name>/constants/`.
- Backend error messages are shown as received.
- Dates and relative times use `Intl`, so they follow the active language.
- Credentials are masked in the browser reference (`redactText`, `isSensitiveName`).

## Responsive

Checked at 1280 and 390 wide. Both fit without horizontal scroll. The topbar keeps one line: the breadcrumb truncates, and the API status shows only its dot on small screens (its text stays available to screen readers).

## Known gaps

- Dark only. There is no light theme yet.
- The main bundle is about 664 kB. The workspace detail feature is not code-split yet.
- The split-flap cell width is a first pass. Single characters read a little wide at `text-sm`.
