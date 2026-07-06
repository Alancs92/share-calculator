# Product spec

## Problem

A group of people share costs. A subset of the group actually pays each
cost up front; everyone in the group (or a subset of it) owes a fair share
back. People aren't always able to pay their full fair share — the
calculator needs to redistribute the difference fairly among everyone else.

**Canonical example:** 10 people in a group. One grocery run costs $150,
paid for by 3 of the 10. The calculator determines each of the 10 people's
fair share of the $150 and, since 3 already paid, what each of the other 7
owe (and whether the 3 payers are owed money back, if they collectively
overpaid their own share).

## Core use cases

1. **Simple even split.** N people, one or more expenses, no exceptions.
   Each expense is split evenly among the participants it applies to.
2. **Partial payer set.** An expense applies to all N participants but is
   paid by a subset (e.g. 3 of 10). Output shows net owed/owing per person.
3. **Exceptions.** A participant may have a constraint on an expense (or
   globally):
   - **Cannot pay at all** — their share is redistributed among everyone
     else.
   - **Capped contribution** — they can pay at most $X (possibly less than
     their even share); the remainder is redistributed.
   - **Fixed contribution** — they pay exactly $X regardless of the even
     split (e.g. someone who ate less agrees to a flat lower amount).
   - **Excluded from an expense entirely** — e.g. one expense doesn't apply
     to them at all (they weren't present), separate from a payment-ability
     exception.
   - **Weighted share** — optional, lower priority: a participant owes more
     or less than an even share by a ratio (e.g. couples counted as 1.5x).
4. **Multiple expenses, running total.** Several expenses over time, each
   with their own payer(s), participants, and exceptions. Output is the
   *net* position per person across all expenses, not per-expense.
5. **Chat-pasted input.** A user pastes freeform text copied out of a chat
   (WhatsApp, etc.) listing who paid what, in a variety of casual formats.
   See [`input-parsing.md`](input-parsing.md).
6. **Output as a table.** Per person: name, total fair share, total paid,
   net (owes / is owed), ready to read at a glance.
7. **Output as WhatsApp-ready text.** A plain-text rendering of the same
   table, formatted to paste back into a chat.
8. **Export.** Web app can export the result (and ideally the input) as an
   Excel/CSV file. See [`architecture.md`](architecture.md) for how this is
   done without a backend.

## Inputs

- **Participants**: list of names (the people the cost is shared among).
  Not every participant has to be a payer.
- **Expenses**: each has an amount, one or more payers (name + amount paid),
  and (optionally) a subset of participants it applies to (defaults to all
  participants).
- **Exceptions**: per participant, optionally per-expense — cap, fixed
  amount, exclusion, or weight (see use case 3).
- Participants and expenses can be entered manually (form) or in bulk via
  chat-paste (parsed into the same structures — see `input-parsing.md`).

## Outputs

- An on-screen table (web app): name, paid, fair share, net.
- A copy-pasteable plain-text version of the same, formatted for WhatsApp.
- (Web app) Excel/CSV export of the table, and ideally of the raw input so
  a calculation can be re-imported/re-run later.
- (CLI) JSON output by default (agent/script-friendly), with a `--table`
  or similar flag for a human-readable rendering.

## Web app quality bar

Not a "use case" in the sense above, but a standing requirement on the
web app rather than a one-off nice-to-have:

- **Usable comfortably on a phone**, not just desktop — most people will
  hit "split the bill" scenarios on their phone, mid-conversation. See
  `architecture.md`'s mobile/responsive notes and the checklist item in
  `development-guide.md`.
- **Light and dark mode**, following the OS preference by default with a
  manual override.
- **A built-in how-to guide** (a "?" button opening a short slide-through
  walkthrough) — the target user is not expected to read documentation
  first.

## Non-goals (for now)

These are explicitly out of scope until a future iteration decides
otherwise — call them out in the roadmap, don't silently build them:

- User accounts / auth / multi-user real-time collaboration.
- A persistent server-side backend. The web app is static; any "storage"
  in the near term is local (browser localStorage, or file export/import),
  not a hosted database. A backend is a possible *future* iteration, not
  part of this one — see `roadmap.md`.
- Multi-currency / FX conversion. Assume a single currency per calculation.
- Automated bank transfers / payment integration. Output tells people what
  they owe; it doesn't move money.
- Minimal-transaction "who pays whom" optimization (e.g. Splitwise-style
  debt simplification) is a nice-to-have noted in the calculation model,
  not a requirement for the first working version — the net owed/owing
  table is the primary deliverable.
