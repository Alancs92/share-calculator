# 0001 - Single repo, three packages: core / web / cli

Status: Accepted

## Context

We need two deliverables — a static web app and a CLI tool — that must
produce identical calculation results from identical input. Duplicating
the calculation logic in two languages/codebases would let them drift and
double the testing burden.

## Decision

One repository, npm workspaces, three packages: `core` (calculation engine
+ parser, framework/runtime agnostic), `web` (static site consuming
`core`), `cli` (Node CLI consuming `core`). See `docs/architecture.md`.

## Alternatives considered

- **Two separate repos** (web, cli) with the engine duplicated or
  published as an external npm package. Rejected for now — adds
  publishing/versioning overhead disproportionate to the project's size;
  revisit if the core ever needs to be consumed outside this repo.
- **A heavier monorepo tool** (Nx, Turborepo). Rejected for now — three
  small packages with one shared dependency don't need build
  orchestration beyond npm workspaces; revisit only if build times or
  cross-package task-running actually become painful.

## Consequences

Web and CLI are guaranteed to share behavior since they import the same
code. Adds a small amount of workspace/build-config overhead up front
compared to a single package.
