# Roadmap

Status reflects what's actually done. Update this in the same change that
completes (or descopes) an item — don't let it drift into aspirational.

## Iteration 0 — docs (this iteration)

**Status: done.**

- Product spec, architecture, calculation model, input parsing spec,
  development guide, ADRs for the decisions baked into the above.
- No application code yet — intentional. Implementation starts next
  iteration, against this spec, on a fresh branch.

## Iteration 1 — core calculation engine

- `packages/core`: domain types, the waterfall algorithm, rounding,
  aggregation, the two documented invariants enforced and tested.
- Property-based + fixture tests per `development-guide.md`.
- No UI, no CLI yet — engine only, driven purely by tests.

## Iteration 2 — chat-paste parser

- `packages/core`: parser per `input-parsing.md`, with the fixture table
  as the primary test suite.
- Still no UI/CLI — parser output feeds the engine in tests directly.

## Iteration 3 — CLI tool

- `packages/cli`: JSON in/out over the core engine + parser, table/
  WhatsApp-text output flag, packaged so an agent can shell out to it.

## Iteration 4 — web app (MVP)

- `packages/web`: form to enter participants/expenses/exceptions, a paste
  box using the parser, on-screen table output, WhatsApp-text copy
  button.
- GitHub Actions deployment to GitHub Pages.

## Iteration 5 — export & convenience

- Excel/CSV export (client-side).
- Shareable state via URL and/or localStorage persistence of the last
  calculation (pick per the concurrency notes in `development-guide.md`).

## Later / not yet scoped

Needs its own design pass and ADR before starting, not a quick add-on:

- Settlement view (minimal peer-to-peer transactions).
- Weighted shares in the UI (engine supports weights from iteration 1;
  exposing it in the UI is separate work).
- Any persistent backend for cross-device storage, if local/file-based
  storage turns out to be insufficient in practice.
