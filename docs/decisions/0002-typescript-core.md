# 0002 - TypeScript for the core, compiled to plain JS

Status: Accepted

## Context

The core must run unmodified in a browser bundle and in Node for the CLI,
and needs to be reliable since it's money-calculation logic with a fairly
intricate domain model (participants, expenses, exceptions, weights).

## Decision

Write `packages/core` (and, by extension, `cli`/`web`) in TypeScript,
compiled to plain JS for consumption. Types encode the domain model from
`calculation-model.md` directly (e.g. amounts typed distinctly enough that
a float can't be passed where minor-unit integer cents are expected, as
far as the type system reasonably allows).

## Alternatives considered

- **Plain JS.** Simpler toolchain, but this domain model (exceptions with
  three kinds, scopes, the waterfall's intermediate states) is exactly
  where a type checker earns its keep, and the project explicitly cares
  about correctness (TDD, invariants) more than build simplicity.

## Consequences

Requires a build/compile step for both `web` and `cli` (already implied by
bundling for the browser anyway). Gains stronger guarantees at the domain
model boundary and better refactoring safety as the engine's rules get
more detailed (caps, waterfalls, rounding).
