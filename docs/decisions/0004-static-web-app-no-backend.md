# 0004 - Web app is a static, backend-free GitHub Pages site

Status: Accepted

## Context

One of the two required deliverables is a web app published on GitHub
Pages, which only serves static files. The calculation logic itself has
no inherent need for a server — it's a pure function of its inputs.

## Decision

`packages/web` ships as a static site with all calculation logic running
client-side, reusing `packages/core`. Any persistence needed in the near
term uses browser-local mechanisms (localStorage, URL-encoded state, file
export/import) rather than a hosted backend. See the persistence options
ordering in `architecture.md`.

## Alternatives considered

- **A hosted backend** (for storage, multi-device sync, sharing links
  server-side). Rejected for this phase — not required by the stated use
  cases (product-spec.md explicitly lists this as a non-goal for now), and
  it would mean the "free, static GitHub Pages" deliverable now depends on
  an external service being up and paid for. If a real need emerges
  (e.g. genuine multi-user collaboration), that's a substantial enough
  change to warrant its own ADR and design pass, not a quiet addition.

## Consequences

Zero hosting cost/maintenance for the web app beyond GitHub Pages itself.
Data doesn't persist across devices/browsers without an explicit
export/import step by the user. This is an accepted tradeoff for the
current scope, not a limitation to silently work around.
