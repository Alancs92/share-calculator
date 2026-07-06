# 0005 - Waterfall redistribution for caps/fixed amounts, not single-pass scaling

Status: Accepted

## Context

When some participants have a payment cap or fixed contribution below
their even share, the shortfall must be redistributed among the remaining
participants. A naive single-pass approach (compute even shares, then
scale everyone proportionally to hit the cap) can itself push other
participants over *their* caps, requiring further correction — so a
single pass isn't actually sufficient in general.

## Decision

Use an iterative waterfall: resolve fixed amounts first, then repeatedly
compute even (weighted) shares for the remaining pool, peel off anyone who
would exceed their cap by assigning them exactly their cap and folding the
excess back into the remaining pool, and repeat until a pass changes
nothing. Full algorithm in `calculation-model.md`.

## Alternatives considered

- **Single-pass proportional scaling.** Rejected — doesn't correctly
  handle the case where redistributing a shortfall pushes a *different*
  participant over their own cap; would require detecting and correcting
  that anyway, which is just the waterfall by another name, done less
  clearly.
- **Iterative solver / linear programming.** Rejected as overkill — the
  waterfall converges in at most N passes for N participants (at least one
  participant is finalized per pass) and is simple enough to reason about
  and test exhaustively; no need for general-purpose optimization
  machinery for a problem this constrained.

## Consequences

The algorithm requires a loop with a clear termination condition (must be
tested: it terminates, and terminates with the correct result, including
the infeasible-cap case raising an explicit error rather than looping or
producing a wrong number). This is more implementation complexity than a
single division, which is why it's called out as its own ADR rather than
left implicit in the spec.
