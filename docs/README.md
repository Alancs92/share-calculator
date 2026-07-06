# Docs index

Read these roughly in this order if you're new (human or agent):

1. [`product-spec.md`](product-spec.md) — what we're building and why. Use
   cases, inputs, outputs, exceptions, non-goals.
2. [`architecture.md`](architecture.md) — how it's built. Repo layout, tech
   choices, deployment, how the web app and CLI share the core.
3. [`calculation-model.md`](calculation-model.md) — the actual math. The
   domain model and the algorithm for splitting cost with exceptions, in
   enough detail to implement and test without further design decisions.
4. [`input-parsing.md`](input-parsing.md) — spec for parsing pasted
   chat/WhatsApp-style text into structured expense data.
5. [`development-guide.md`](development-guide.md) — how to work on this repo:
   TDD workflow, test coverage expectations, and a checklist (design,
   concurrency, security) to run through every iteration.
6. [`roadmap.md`](roadmap.md) — iteration plan, current status.
7. [`decisions/`](decisions/) — ADRs (Architecture Decision Records). One
   file per decision, numbered, immutable once merged. If you make a
   decision that isn't already here, add one instead of just writing code.

## Keeping docs current

These docs are meant to be a working reference for agents picking up this
project cold, potentially long after this session. When an implementation
iteration changes the model, the parsing rules, or the architecture:

- Update the relevant doc in the same PR as the code change.
- If it's a *decision* (a choice between real alternatives, not just an
  implementation detail), add a new ADR rather than rewriting an old one —
  ADRs are a log, not a living doc. If a later decision supersedes an
  earlier one, mark the old ADR's status as `Superseded by NNNN` and link it.
- `roadmap.md` should reflect what's actually done, not just what's planned.
