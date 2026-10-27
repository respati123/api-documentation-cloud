# UI, design, and styles

Read this before any UI, design, or styling change in `src/`.

## Required skill

Use the **impeccable** skill for all UI work. It is installed in this folder at `.agents/skills/impeccable/SKILL.md`.

1. Read `.agents/skills/impeccable/SKILL.md`.
2. Run its `scripts/impeccable context` setup step with the cwd set to the `web/` folder.
3. Load the reference for the request, for example `reference/audit.md` for reviews, or `reference/craft-floor.md` before editing.
4. When the change is finished, run the detector on the changed files:
   `./.agents/skills/impeccable/scripts/impeccable detect --json <changed files>`

## Components: shadcn/ui only

- Every UI component comes from shadcn/ui: `Button`, `Input`, `Select`, `Dialog`, `Card`, `Table`, `Skeleton`, `ScrollArea`, `Tabs`, `Sonner` for toasts, and so on.
- Add components with the shadcn CLI. The generated files go in `src/shared/components/ui/`. Do not hand-edit them. If a component needs a different look, wrap it in an atom or molecule.
- Do not build a custom component when shadcn has one. Compose shadcn components instead.
- Do not add a third-party UI library next to shadcn.

## Tailwind CSS

shadcn/ui is built on Tailwind CSS. Tailwind is required, and it is the only styling system.

- Tailwind v4 is set up through the Vite plugin (`@tailwindcss/vite`) and one global entry stylesheet, `src/index.css`.
- `index.css` holds only three things: the `@import "tailwindcss"` line, the shadcn theme tokens (`:root` and `.dark` variables), and the base layer that shadcn generates. Nothing else goes there.
- The entry stylesheet is the only `.css` file in the portal. It is imported once in `app/providers.tsx` or `main.tsx`.
- No `.css`, `.scss`, or `.module.css` files for components. Style with Tailwind utility classes.
- Use the `cn()` helper from `@/shared/utils/cn` to merge class names. It is the shadcn default.

## Styling rules

- Tailwind utilities are the only way to style components.
- No inline `style={{}}` for layout or color. Use utility classes. Inline style is allowed only for values computed at runtime, such as a dynamic width.
- Colors come from the theme tokens (`bg-background`, `text-muted-foreground`, `border-border`, and so on). No hex values in components.
- The current `graphite.css` and `styles.css` are removed during the migration. Each migrated view must not depend on them.

## Theme

- Dark and light themes both come from the same token set. Define the tokens once, in the global entry.
- Keep the look close to the current design when you migrate. Map the current colors to tokens, then check the screenshot.

## Scrolling

- Use shadcn `ScrollArea` for any scrollable region. Set `type="auto"`, so the scrollbar appears only when the content overflows.
- When there is nothing to scroll, the scrollbar stays hidden.
- When the user scrolls, show a thin indicator. Hide it again after the scroll stops.
- Scrolling should feel smooth. Do not set `scroll-behavior` on the whole page to get this.
- Do not show a horizontal scrollbar on the page. A wide table scrolls inside its own `ScrollArea`.

## Loading

Loading must not look broken or jump:

- Show a skeleton with the same shape and size as the final content. Use shadcn `Skeleton`.
- Do not show a spinner that replaces the whole screen. Keep the layout and fill only the content area.
- Avoid flicker. Do not show the skeleton for requests that finish in under about 150ms. Delay it, or let the query serve cached data.
- When a query changes its key, keep the previous data on screen with `keepPreviousData`, and show a small inline pending indicator.
- Animate content in with a short fade, about 150 to 200ms. Respect `prefers-reduced-motion`.
- Put loading state in the ViewModel (`status`) and render the skeleton in the View (see `architecture.md`).

## Error states

Show a view-level error state with a retry button. Route-level crashes go to an error boundary. See `error-handling.md`.

## Accessibility and testing attributes

Every interactive element needs a `data-testid`. See `testing.md`. Do not query tests by class names, since class names come from Tailwind now.

## Reinstall

If the impeccable skill is missing, reinstall it in this folder:

```
bunx impeccable install -y --project --providers=codex --no-hooks
```

Do not copy it from another folder by hand. Do not commit `.agents/skills/impeccable/scripts/bin/`. It is gitignored.
