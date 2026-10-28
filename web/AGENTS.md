# Repository Guidelines (web)

This folder is the browser portal: React, Vite, shadcn/ui, and Tailwind. Core rules are below. Detailed guides are in `references/`. Read the guide that matches your task before you start.

## Project

`src/` holds the portal source. `index.html` is in `src/`. `docker/nginx.conf` serves the built portal in the production image. `Dockerfile` builds that image from this folder as its build context.

## Commands

Run from the repository's `cloud/` folder with the root scripts (`bun run cloud:dev`, `cloud:build`, `cloud:typecheck`), or from this folder with the names below:

- `bun run dev`: portal on port 5174.
- `bun run build`: production build into `dist/`.
- `bun run typecheck`: TypeScript check.

Install dependencies with `bun install` in this folder. The lockfile is `bun.lock`.

Run the typecheck and build before you hand off any change in `src/`.

## References

| Read this | When |
|---|---|
| `references/architecture.md` | creating a feature, moving code between layers, placing a file, imports |
| `references/data-and-state.md` | writing a service, query, mutation, store, or any process logic |
| `references/error-handling.md` | handling a failed request, adding an error state or error boundary |
| `references/i18n.md` | adding or changing any text the user sees |
| `references/ui-design.md` | any UI, design, styling, loading, or scrolling change |
| `references/testing.md` | adding a test, TDD workflow, adding an interactive element, `data-testid` |
| `references/code-quality.md` | naming, file size, props, lint, and other cleanliness rules |
| `references/performance.md` | lists, routes, new dependencies, heavy computation, speed reviews |
| `references/refactor.md` | migrating a feature out of `App.tsx` or `components/` |

## Core rules

- **UI work uses the impeccable skill**, installed at `.agents/skills/impeccable/`. Read `references/ui-design.md` before any UI edit.
- **Components come from shadcn/ui only, and styling is Tailwind only.** No `.css` files except the single global entry `src/index.css`. Use Tailwind utilities and theme tokens.
- **All imports are absolute, with the `@/` alias** (`@/` points to `src/`). No `../` or `./` imports.
- **Pages have no logic. Views only render.** All process logic (fetching, handlers, state, derived values) lives in the ViewModel.
- **No redundant API calls.** Fetch through TanStack Query in a ViewModel. Never fetch in `useEffect`, and never fetch the same data twice.
- **Performance work uses the vercel-react-best-practices skill**, installed at `.agents/skills/vercel-react-best-practices/`, with the project overrides in `references/performance.md`. React Compiler is on: no manual `useMemo`, `useCallback`, or `React.memo` without a Profiler reason.
- **All user-facing text is translated** in `id` and `en`. Keys in both languages.
- **Show the backend's error message.** Do not write your own API error text or invent error codes.
- **Every route has an error boundary.** Async errors are handled in the ViewModel.
- **Loading uses skeletons that match the final layout.** Scroll areas hide their scrollbar when there is nothing to scroll.
- **MVVM with feature folders.** Features import from each other only through `@/features/<name>`.
- **Every interactive element has a `data-testid`**, format `[feature]-[component]-[element]`.
- **Types have one owner.** Feature-only types live in `features/<name>/models`. A type used by two or more features lives in `shared/models`, and features import it from there. See `references/architecture.md`.
- **No `any`.** Validate every API response with a `zod` schema in the service, and infer the type from it.
- **Biome is the only linter and formatter.** Run `bun run cloud:lint` (added during the refactor) before you hand off.
- **File, folder, and identifier names are English**, even when the UI text is Indonesian. See `references/code-quality.md`.
- **Refactors keep behavior, URLs, and visuals.** Migrate one feature per step.
