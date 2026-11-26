# Design rules

Read this file before changing any UI in `web-new-2`. Every line is a decision. These rules supersede conflicting styling details in `DESIGN.md` and `DESIGN.reference.md`. Check each change against the **Never** list, and check screenshots at 390px and 1440px in light mode.

## Never

- Gradients, glows, blur, glass, or decorative background patterns.
- Literal hex colors outside the token blocks in `src/index.css`. A raw hex in a component is a tell and breaks the token set.
- All caps, eyebrow labels, or Title Case headings. Use sentence case. Product names and API values keep their spelling (`API Documentation`, `DBDesign`, `GET`, `POST`).
- Font weights other than `font-normal` (400) and `font-medium` (500). No `semibold` or `bold`.
- Font sizes outside the type scale below.
- Icons inside rounded boxes, circles, or pills. An icon sits on the surface or inside a functional control: a button, a password toggle, a copy button.
- An icon next to a text label when the label is enough. Exception: navigation in the sidebar, where the icon is the only label in the collapsed rail.
- Nested cards. A card never contains another card or a bordered box that repeats it.
- Decorative pills. Badges mark only HTTP methods, HTTP status codes, workspace roles, counts, and real states (`New`, `Deprecated`, `Soon`, `You`).
- The accent color on anything that is not active or selected. Primary buttons are ink, not blue. Links are ink. Resting icons are muted. Skeletons and hover fills are neutral.
- Colored or left bars that mark an item (`border-l-2`, pseudo-element bars). Selection is a background tint (`bg-selected`) and nothing else.
- Numbered list styling (01, 02), green check marks in circles as status, avatar stacks, avatars that fan out on hover, letter-in-a-square logos. The brand mark is the three-stroke `ProductMark`.
- Shadows on anything that does not float. Cards use a border.
- Motion over 300ms, bounce or spring easing, staggered entrances, looping animation (skeletons are static), and animation on first paint.
- Marketing or filler copy: "Seamlessly", "Unlock", "Supercharge", "Effortless", "… together", "… starts here", "all caught up". A subtitle that restates its heading is removed.
- Developer or repo names in product UI, such as `web-new-2`.

## Always

Color tokens. Components use these names only.

- `background`: page canvas. `#F4F6F8` light, `#171C24` dark (inside `.workspace-content`).
- `card`, `popover`: white light, `#202833` dark.
- `foreground`: ink, `#242B35` light. `muted-foreground`: secondary text, `#657184` light.
- `border`: `#DFE4EB` light. `input`: `#CFD8E4` light.
- `primary`: ink. Default buttons use it. Ink is not an accent.
- `accent`: neutral hover fill, `#EDF1F6` light.
- `selected` and `selected-foreground`: pale blue tint and blue text, used only on the selected request row or other selected item.
- `ring`: focus ring only, `#3185EE` light.
- `info`: blue text for the `POST` method label only.
- `success`, `warning`, `destructive`: status meaning only.
- Dark mode is a second set of the same names under `.dark .workspace-content`. The app has no dark-mode switch today, so the dark set is verified by applying `.dark` to `<html>`.

Type scale. One family (system sans). Five sizes, two weights.

| Token | Size | Weight | Use |
| --- | --- | --- | --- |
| `text-2xl` | 24px | 500 | Page title, metric values |
| `text-lg` | 18px | 500 | Dialog and empty-state titles |
| `text-base` | 16px | 400 / 500 | Auth copy, card titles, mobile input text |
| `text-sm` | 14px | 400 / 500 | Default UI text, buttons, table cells, labels |
| `text-xs` | 12px | 400 / 500 | Secondary text, dates, method and status labels |

Radius.

- 6px (`rounded-md`): buttons, inputs, selects, toolbar controls.
- 8px (`rounded-lg`): cards, dialogs, popovers, notification and banner panels.
- Full (`rounded-full`): badges and count dots only.
- Shadcn primitives keep 4px on menu rows and 2px on close and tooltip marks. Do not add other radii.

Spacing. Use the 4px scale: `gap-1` to `gap-6`, `p-3`, `p-4`, `p-6`. Side panels and summary cards use 16px padding. Auth cards use 20px on mobile and 24px from `sm`.

Elevation.

- `shadow-lg`: dialogs and sheets.
- `shadow-md`: popovers and selects.
- Cards and rows: `shadow-none` with a 1px border.

Motion, in milliseconds.

- Press (`button:active`): `transform: scale(0.97)`, 150ms.
- Hover, background, and text color: 150ms.
- Chevron rotation: 150ms.
- Sidebar expand and collapse width: 200ms, linear.
- Keyboard focus and keyboard highlight: 0ms. The rule `:focus-visible { transition-duration: 0ms }` applies it. Mouse hover keeps its 150ms glide.
- Dialogs, sheets, popovers, selects, and their overlays: enter 200ms (`duration-200`), exit 150ms (`data-[state=closed]:duration-150`). Opacity, zoom from 95%, or slide from the edge. Provided by `tw-animate-css`, imported in `src/index.css`.
- Tooltips: enter 150ms, exit 100ms.
- No animation runs longer than 300ms. Reduced-motion override stays in `src/index.css`.

Focus. The 3px focus ring at 50% opacity stays. It is a keyboard focus indicator, not a glow.

Layout.

- Verify at 390px and 1440px. No horizontal page scroll at 390px.
- Below `sm`, the breadcrumb hides the product crumb (`API documentation`), the section group crumb (`API`, `Design`, `Account`), and their separators. The workspace crumb and the current section stay.
- Tab lists scroll sideways inside their own box instead of wrapping onto a second row.
- Summary grids: 1 column, then 2 columns from 390px, then 4 columns from `xl`.

Build on the existing primitives in `src/components/ui`. Do not start a component from zero when a primitive covers it.

## Done means

A screen is done when its light and phone-width screenshots pass the **Never** list and the type scale, and its dark screenshot has no broken contrast. The record of each pass is in `unslop-ui-design-report.md`.
