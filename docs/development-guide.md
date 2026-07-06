# Development guide (for every iteration, human or agent)

This is the checklist to run through for every feature/change, not just
once at project start. Keep it short enough to actually use — extend it
only when you learn something worth re-checking every time.

## Workflow: TDD, especially for the core

The calculation engine and the parser are pure, deterministic, and money-
sensitive — exactly the code where TDD pays off most and is cheapest to
do:

1. Write the test first, from the spec in `calculation-model.md` /
   `input-parsing.md` (or from a new example if the spec doesn't cover the
   case yet — and if it doesn't, update the spec doc too, not just the
   test).
2. Watch it fail for the expected reason (not a typo/setup error).
3. Implement the minimum to pass it.
4. Refactor with the test as a safety net.

For the web/CLI surfaces (rendering, argument parsing, wiring), tests
matter but TDD-by-the-book is less critical — reasonable to write code and
tests together there. The core is the part where getting it wrong is a
correctness bug in someone's money, so hold it to a higher bar.

## Testing expectations

- **Core engine**: table/property-based tests, not just the worked
  examples in the spec. At minimum, assert the invariants directly and
  generatively (random participants/expenses/caps within valid ranges):
  - `sum(shares) === expense.amountCents` for every expense, always.
  - `sum(netCents) === 0` across all participants, always.
  - Capping never assigns a participant more than their cap.
  - Infeasible-cap scenarios raise the explicit error, never a silent
    wrong number.
  - Zero participants, one participant, an expense with zero amount, an
    expense where every participant is excluded — these edge cases are
    where bugs hide; don't skip them because they're "not the normal case."
- **Parser**: the fixture table from `input-parsing.md`, run as actual
  test cases, growing over time — treat every real parsing mistake found
  during development as a new permanent fixture, not a one-off fix.
- **Rounding**: explicitly test cases that don't divide evenly (the whole
  point of the largest-remainder method) — an evenly-divisible fixture
  alone won't catch a broken rounding implementation.
- Before considering a core change done: re-run the full core test suite,
  not just the new test. Tightening one rule (e.g. the cap waterfall) can
  silently break another (e.g. the rounding invariant) — the invariant
  tests exist specifically to catch that.

## Design considerations

- Keep `packages/core` free of DOM/Node/browser APIs and free of runtime
  dependencies (see `architecture.md`) — this is what makes it testable
  identically everywhere and keeps the web bundle small.
- Model money as integer minor units end-to-end within the core; convert
  at the boundary only (parsing input, formatting output). Never let a
  float cross into the engine.
- Prefer pure functions and immutable inputs in the core — given the same
  participants/expenses/exceptions, a calculation must be deterministic
  and repeatable. This also makes property-based testing straightforward.
- Don't build the settlement/debt-simplification feature or the
  weighted-share feature ahead of need — they're noted in the spec as
  lower priority; adding them speculatively before the core even/capped
  case is solid just adds surface area to get wrong.

## Concurrency / race conditions

The current design (static web app, no backend, no multi-user
collaboration) has a small surface for this, but don't skip the check:

- **Browser**: if `localStorage` is used for persistence, multiple tabs of
  the same origin can race on read-modify-write. If/when this is
  implemented, either accept "last write wins" explicitly (fine for a
  single-user tool) or use the `storage` event to detect and warn on
  cross-tab changes — pick one deliberately and note it in an ADR, don't
  let it be an accident.
- **CLI**: if export/import writes files, don't assume exclusive access —
  a script driving the CLI could invoke it concurrently against the same
  output path. Fail loudly on an unexpected existing file rather than
  silently overwriting, unless a `--force`-style flag is explicit.
- **Future backend** (if/when built): this is where real concurrency risk
  lives — concurrent edits to the same calculation from multiple people.
  Do not bolt this on casually; it needs its own design pass (optimistic
  locking / last-write-wins / CRDT-ish merge, whichever fits) and its own
  ADR before implementation, not an afterthought bugfix.

## Security

- **XSS**: parsed names and pasted chat text are user-controlled strings
  rendered into the DOM (the table, the WhatsApp-text preview). Never
  insert them via `innerHTML` or unescaped templating — use text-node
  APIs (`textContent`, framework-safe interpolation) so a name like
  `<img src=x onerror=...>` pasted from a chat can't execute.
  A test:the render layer should have a case pasting HTML-ish strings as
  a "name" and asserting it comes out as inert text.
- **No `eval`/`Function`/dynamic code execution** on any user input
  (parser, formulas, etc.) — there's no legitimate reason the calculator
  needs it.
- **Dependencies**: since the web app ships its dependency tree straight
  to users' browsers, keep `packages/core` and `packages/web` dependency
  count minimal (this is also an architecture goal, see above) and run
  `npm audit` (or equivalent) as part of CI once CI exists — fewer
  dependencies is itself the biggest lever here, not just scanning.
- **No secrets in the repo.** There shouldn't be any for this project as
  scoped (no backend, no API keys) — if a future iteration adds one
  (e.g. a backend credential), it goes in environment variables /
  deployment secrets, never committed, and `.env` is already gitignored.
- **CLI file handling**: if export/import takes a file path from the
  user/agent, validate it's within the expected scope rather than passing
  it through unchecked (basic path traversal hygiene), even though this is
  a local tool run by its own user rather than a network-facing service —
  cheap to get right, and CLIs do sometimes get wired into larger
  agent/automation pipelines where the "path" isn't hand-typed by the
  person who'll be affected by it.

## Every-iteration checklist (short version)

Before calling a change done:

- [ ] Tests written first (core), or written alongside (surfaces) —
      not skipped.
- [ ] Invariants (`sum(shares) == amount`, `sum(net) == 0`) still hold —
      re-run full core suite.
- [ ] New parsing rule has fixtures added, not just a single example.
- [ ] Any new user-controlled string reaching the DOM goes through a safe
      text API, not `innerHTML`.
- [ ] Any new persistence/concurrency surface has a deliberate, documented
      answer (even if the answer is "last write wins, acceptable here"),
      not an unconsidered default.
- [ ] Relevant doc(s) updated in the same change — spec, architecture, or
      a new ADR — if the change altered the model rather than just
      implementing what was already specified.
