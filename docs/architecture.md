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
