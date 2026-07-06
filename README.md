# Share Calculator

A calculator for splitting shared costs across a group of people, with support
for exceptions (someone can only pay part of their share, or can't pay at
all), pasted-chat expense input, and table / WhatsApp-ready output.

**Example use case:** 10 people share a house. 3 of them front the cost for
groceries. The calculator works out what each of the 10 owes, accounting for
anyone who has a payment cap or can't contribute this time.

## Status

This repository is currently in the **docs-only** phase — no application code
has been written yet. The goal of this phase is to nail down the product
scope, the calculation model, and the architecture *before* writing code, so
that implementation (by humans or agents) can proceed with a clear, agreed
spec and a TDD-first workflow.

See [`docs/`](docs/) for everything — start with [`docs/README.md`](docs/README.md).

## Planned deliverables

1. **Web app** — a static site published on GitHub Pages. All calculation
   logic runs client-side in JS; no server required for the core feature set.
2. **CLI tool** — a Node-based command line tool built on the same
   calculation core, intended to be scriptable and agent-friendly (JSON in,
   JSON/table out).

Both will share one framework-agnostic calculation core. See
[`docs/architecture.md`](docs/architecture.md) for the intended repo layout.

## For contributors (human or agent)

Before starting an implementation iteration, read
[`docs/development-guide.md`](docs/development-guide.md) — it covers the
TDD workflow, testing expectations, and the design/security/concurrency
checklist every change should be considered against.

Architectural choices are recorded as ADRs in
[`docs/decisions/`](docs/decisions/). Add a new one whenever you make a
decision worth remembering, rather than editing history.
