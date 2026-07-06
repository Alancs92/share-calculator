# 0003 - Represent money as integer minor units (cents), never floats

Status: Accepted

## Context

Binary floating point cannot represent most decimal fractions exactly
(`0.1 + 0.2 !== 0.3`). A cost-splitting calculator that silently
accumulates float error across many participants/expenses would produce
subtly wrong totals — exactly the failure mode this project can't afford,
since correctness is the entire point.

## Decision

The core engine's public API takes and returns integer amounts in the
currency's minor unit (cents) exclusively. Conversion between a display
string (`"10.40"`) and integer cents (`1040`) happens only at the
input-parsing and output-formatting boundaries, never inside the engine.

## Alternatives considered

- **Floats with rounding at the end.** Rejected — error can compound
  across multiple expenses/participants before the final rounding step
  papers over it, and it's hard to guarantee the `sum(shares) == amount`
  invariant exactly rather than "close enough."
- **Arbitrary-precision decimal library** (e.g. decimal.js) throughout.
  Rejected as unnecessary — integer cents cover this project's needs
  (single currency per calculation, no sub-cent amounts) without adding a
  dependency to `core` (see the zero-runtime-dependency goal in
  `architecture.md`). Revisit if multi-currency or sub-cent precision
  becomes an actual requirement.

## Consequences

Every amount crossing into or out of the core must be explicitly
converted; this is a deliberate friction point, not an oversight, and
should not be "simplified away" by letting floats leak in. Enables the
exact-invariant tests described in `development-guide.md`.
