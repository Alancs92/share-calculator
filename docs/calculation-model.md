# Calculation model

This is the precise spec for the core calculation engine — detailed enough
to implement directly against and to write exhaustive tests from, without
further design decisions needed mid-implementation.

## Money representation

**All amounts are integers in the currency's minor unit (cents), never
floats.** See ADR 0003. Parsing/UI layers convert display strings (`"10.40"`)
to integer cents (`1040`) at the boundary; the engine never sees a float.
This sidesteps binary floating-point rounding errors entirely rather than
working around them later.

## Domain model

```
Participant {
  id: string            // stable identifier, not just display name
  name: string
  weight: number         // default 1. Relative share size, see below.
}

Exception {
  participantId: string
  scope: 'global' | expenseId   // applies to every expense, or just one
  kind: 'excluded' | 'capped' | 'fixed'
  amountCents?: number          // required for 'capped' and 'fixed'
}
// 'excluded'  — participant owes nothing for this scope, and if scope is
//               an expense, they're also not counted in that expense's
//               even split at all (they weren't part of it).
// 'capped'    — participant owes at most amountCents for this scope; if
//               their even share would exceed it, the excess is
//               redistributed to others in the same scope.
// 'fixed'     — participant owes exactly amountCents for this scope,
//               regardless of what an even/weighted split would give them
//               (can be less *or* more than their even share).

Expense {
  id: string
  description?: string
  amountCents: number
  paidBy: Array<{ participantId: string, amountCents: number }>
                                 // sum of these must equal amountCents
  participantIds?: string[]      // who this expense is split among;
                                  // defaults to all non-globally-excluded
                                  // participants
}
```

A calculation is `{ participants, expenses, exceptions }` in, and produces
a per-participant breakdown out.

## Per-expense fair-share algorithm (the "waterfall")

For a single expense, split `amountCents` among its `participantIds`
(after removing anyone excluded for this expense's scope):

1. **Fixed participants** get exactly their fixed amount. Remove them from
   further consideration. Track `remaining = amountCents - sum(fixed)`.
2. **Capped and uncapped participants** split `remaining` by weight:
   `evenShare(p) = remaining * weight(p) / sum(weights of remaining people)`.
3. For anyone whose `evenShare` exceeds their cap: assign them exactly
   their cap, remove them from the pool, and add the excess
   (`evenShare - cap`) back into `remaining` to be redistributed among the
   *still-uncapped* remaining participants.
4. Repeat step 2–3 until no remaining participant's computed share exceeds
   their cap (a participant can only be "resolved down" to their cap once;
   this converges in at most `N` passes for `N` participants since at least
   one participant is finalized per pass).
5. **Infeasibility check:** if at the end every remaining participant is
   capped and their caps still sum to less than what's left to distribute,
   the expense is under-covered — this must surface as an explicit error
   (e.g. `UnderfundedExpenseError` with the shortfall amount), never silent
   truncation or a negative share.
6. **Rounding:** minor-unit division rarely divides evenly. Compute each
   share with integer division (floor), sum the floored shares, and
   distribute the leftover cents (`amountCents - sum(floored shares)`) one
   cent at a time to the participants with the largest fractional
   remainder (the "largest remainder method"), tie-broken by participant
   id for determinism. This guarantees `sum(shares) === amountCents`
   exactly, always — this is an invariant, not a nice-to-have, and should
   be asserted in tests for every generated case, not just examples.

This is a straightforward analogue of progressive-tax / waterfall
allocation — see ADR 0005 for why this approach was chosen over
alternatives (e.g. proportionally scaling everyone down at once, which
does not correctly handle caps in a single pass).

## Aggregating across expenses

Run the above per-expense, then per participant sum:

- `totalShareCents` = sum of their share across all expenses they're part
  of (0 for expenses they're excluded from).
- `totalPaidCents` = sum of `paidBy` amounts across all expenses.
- `netCents = totalPaidCents - totalShareCents`.
  - `net > 0`: this person paid more than their fair share — they're owed
    money.
  - `net < 0`: this person owes `-net`.
  - `net === 0`: settled.

**Global invariant** (must hold for every calculation, and must be a
property-based test, not just example-based): `sum(netCents) === 0` across
all participants — money isn't created or destroyed, every cent paid is
owed to someone.

## Settlement view (optional, lower priority — see product-spec non-goals)

The net table above already answers "who owes / is owed, and how much."
A nice-to-have on top is minimal peer-to-peer transactions (classic debt
simplification): repeatedly match the largest creditor with the largest
debtor, settle the smaller of the two amounts, repeat. This produces at
most `N - 1` transactions for `N` people with nonzero net. Not required
for the first working version; note it here so it isn't reinvented
differently later if/when it's built.

## Worked example (canonical use case)

10 participants, equal weight, no exceptions. One expense: $150.00
(15000 cents), paid by 3 people ($50 each), split among all 10.

- Even share per person: `15000 / 10 = 1500` cents ($15.00) exactly — no
  rounding needed in this example.
- The 3 payers: paid 5000, share 1500 → net `+3500` each (owed $35 back).
- The other 7: paid 0, share 1500 → net `-1500` each (owe $15).
- Check: `3 * 3500 + 7 * (-1500) = 10500 - 10500 = 0`. ✓.

## Worked example (with a cap and an exclusion)

Same 10 people, same $150 expense, but: participant J is capped at $5.00
(500 cents) globally, and participant K is excluded from this expense
entirely (wasn't there).

- Pool for this expense: 9 participants (K excluded), amount still 15000
  (K being excluded doesn't reduce the expense total — someone still
  has to cover it; it just means K isn't one of the people splitting it).
- Even share ignoring the cap: `15000 / 9 = 1666.67` → floor 1666, with
  remainder distributed by largest-remainder method.
- J's even share (1667, say) exceeds their 500 cap → J is fixed at 500,
  remaining `15000 - 500 = 14500` redistributed among the other 8:
  `14500 / 8 = 1812.5` → floor 1812, remainder distributed.
- Re-check none of the remaining 8 are capped below 1812/1813 — if none
  are, done.
- `sum(shares) = 500 + (8 shares summing to 14500) = 15000` ✓.

These two examples (plus the infeasible-cap and all-excluded edge cases)
should become the first fixture-based tests for the engine — see
`development-guide.md`.
