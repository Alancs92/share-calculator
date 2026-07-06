# Architecture

## Guiding constraint

The web app must run entirely on GitHub Pages: static hosting only, no
server-side process. So the calculation logic must be plain client-side JS
(or TS compiled to JS), and both deliverables (web app + CLI) must share it
rather than reimplementing it twice.

## Repo layout (target — not all present yet, this is a docs-only iteration)

```
/packages
  /core     - calculation engine + input parser. Framework-agnostic,
              zero runtime dependencies. Used by both web and CLI.
              Pure functions, no DOM/Node APIs inside it.
  /web      - static web app, built with the core as a dependency.
              Deployed to GitHub Pages.
  /cli      - Node CLI, built with the core as a dependency.
              JSON-first I/O, designed to be driven by scripts/agents.
/docs       - this directory.
```

A simple npm workspaces monorepo (root `package.json` with `workspaces`)
is enough — no need for Nx/Turborepo/etc. at this scale. Revisit only if
build times or cross-package coordination actually become a problem.

## `packages/core`

- Language: TypeScript (see ADR 0002), compiled to plain JS for
  consumption by both the browser bundle and Node.
- No runtime dependencies. This keeps the web bundle small and keeps the
  core trivially unit-testable without mocking anything.
- Two main modules:
  - **Calculation engine** — takes participants + expenses + exceptions,
    returns a per-person breakdown. See `calculation-model.md`.
  - **Chat parser** — takes freeform pasted text, returns structured
    expense entries. See `input-parsing.md`.
- Output formatting (table renderer, WhatsApp-text renderer) also lives
  here as pure functions, since both web and CLI need the same
  presentation logic, just rendered into different containers (DOM vs
  terminal/stdout).

## `packages/web`

- Static site, plain enough that a lightweight setup (Vite + vanilla TS,
  or a small framework if the UI grows past simple forms/tables) is
  sufficient — avoid pulling in a heavy framework for what is fundamentally
  a form + a table.
- No backend. Persistence options, in increasing order of complexity, to
  reach for only as actually needed:
  1. Nothing — recompute each session from what's pasted in.
  2. `localStorage` — remember the last calculation in the browser.
  3. Shareable state via URL (encode input in a query param) — lets
     someone send a link that reproduces a calculation without any
     storage at all.
  4. File export/import (JSON) — save a calculation, load it back later,
     share the file.
  5. Excel/CSV export — generate client-side (e.g. via a small library
     like SheetJS) and trigger a browser download. No server involved.
  6. (Future, explicitly out of scope for now) A real backend for
     persistent shared storage across devices/users — only worth it if
     local/file-based storage proves insufficient in practice. If this
     happens, it deserves its own ADR and a fresh look at the concurrency
     and auth implications, not a bolt-on.
- Deployment: GitHub Actions workflow builds `packages/web` and publishes
  the output to the `gh-pages` branch (or the `docs/`-as-Pages-source
  pattern, or Actions-based Pages deployment — pick whichever needs the
  least ongoing maintenance when we get there) on push to `main`.

### UI implementation (as built)

- Plain DOM manipulation (no framework), one `render()` that rebuilds the
  whole `#app` subtree from in-memory state on every change. Simple to
  reason about at this scale; revisit only if re-render cost or state
  complexity actually becomes a problem.
- Design system lives entirely in `src/style.css` as CSS custom
  properties (light/dark tokens, spacing/radius/shadow scale). Dark mode
  auto-detects `prefers-color-scheme`, is overridable via a header toggle,
  persisted separately from app state (`theme.ts`), and applied before
  first paint by a small inline script in `index.html` to avoid a flash of
  the wrong theme.
- Icons are static inline SVGs (`icons.ts`) — no icon font or CDN, keeping
  the zero-extra-dependency static-site goal intact.
- All modal dialogs (paste-from-chat, edit participant, add/edit expense,
  the how-to-use guide) share one `createModal()` helper in `main.ts`:
  backdrop, focus trap, Escape-to-close, click-outside-to-close, and
  focus restored to the triggering button on close. Add new modals
  through this helper rather than hand-rolling the same behavior again.
- **Mobile/responsive**: single fluid column (`max-width: 760px`,
  centered), so there's no separate mobile layout to maintain — the same
  markup reflows. Specific things done deliberately for small screens
  (see `style.css`'s `@media (max-width: 480px)` rules and the
  flex-wrap on header/card-header/card-actions/form-actions):
  - Icon-only buttons sized at least 2.1–2.5rem (≈34–40px) for touch;
    prefer slightly larger over exactly meeting the 44px guideline when
    space is tight, but never go below ~32px.
  - Modals cap at `max-height: 100dvh` minus padding and scroll
    internally, since a phone's on-screen keyboard can otherwise push
    modal content off-screen with no way to reach it.
  - The results table is the one place that doesn't reflow to a
    single column — it stays a real table (for correct semantics and
    tabular-number alignment) inside a horizontally-scrollable
    `.table-wrap`, with a narrow-screen media query that tightens
    padding/font-size/status-pill icon before falling back to scroll.
  - Any new UI work should be checked at a phone-width viewport (see
    `development-guide.md`'s checklist) — it's cheap to check and easy to
    silently break with a new fixed-width element or a `flex` row that
    doesn't wrap.

### In-app how-to guide

A "?" button in the header opens a slide-by-slide guide (`guide.ts` +
the guide rendering in `main.ts`): title, a real screenshot of the
relevant part of the UI, a caption, and an amber highlight box drawn over
the screenshot to point at the relevant control. Prev/Next buttons, dot
indicators, keyboard arrow keys, and touch swipe all navigate; it reuses
the same `createModal()` as every other dialog.

This was a deliberate build choice over alternatives — see
[`decisions/0006-screenshot-based-guide.md`](decisions/0006-screenshot-based-guide.md)
for why, and what it costs to maintain (screenshots must be regenerated
when the relevant part of the UI changes visually).

## `packages/cli`

- Node.js, minimal dependencies (an argument parser like `commander` is
  reasonable; avoid anything heavier).
- Default output: JSON — this is the "for agents" requirement. An agent
  should be able to pipe participants/expenses in and get structured data
  back without scraping text.
- A `--format table` / `--format whatsapp` flag (names TBD at
  implementation time) for human-readable output, reusing the same
  renderers as the web app from `packages/core`.
- Input: JSON file/stdin for structured input, plus the ability to pass
  raw pasted chat text through the same parser the web app uses, so the
  CLI is equally useful for "I have a WhatsApp export, just tell me who
  owes what."

## Data flow (either surface)

```
raw input (form fields, or pasted chat text)
        |
        v
  input parser (core)  -->  structured Participants + Expenses + Exceptions
        |
        v
  calculation engine (core)  -->  per-person breakdown (paid / share / net)
        |
        v
  renderer (core)  -->  table view | WhatsApp text | JSON
        |
        v
  surface-specific output (DOM table / stdout / file download)
```

The core never touches the DOM, `fs`, or `process` — that keeps it
identically testable and identically behaved in the browser, in Node, and
under a test runner.
