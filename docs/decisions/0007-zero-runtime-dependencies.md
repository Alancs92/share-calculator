# 0007 - Zero runtime dependencies: `node:util.parseArgs` instead of Commander

Status: Accepted

## Context

`packages/core` and `packages/web` have been dependency-free from the
start (see `architecture.md` and ADR 0006). `packages/cli` was the one
exception: it depended on Commander purely for argument parsing — two
subcommands with five string options between them.

That single dependency had costs out of proportion to what it did. Every
Commander release is a Dependabot PR and a CI run; every advisory against
it (or anything it later takes on) is an `npm audit` failure that blocks
the Security audit workflow. Commander is also the kind of dependency that
churns majors: the repo had already taken a 12 → 15 major bump for it.

Node 22 (what CI runs, and what the `bin` targets) ships `parseArgs` in
`node:util`, stable since Node 20. It covers exactly the shape this CLI
needs: subcommand, long and short options, string values, strict rejection
of unknown options.

## Decision

Drop Commander. Parse arguments with `node:util.parseArgs`, split across
three small modules in `packages/cli/src`:

- `args.ts` — pure `parseCliArgs(argv)` returning a discriminated union
  (`help` | `version` | `calculate` | `parse`), plus the usage text and a
  `UsageError` for anything the user can fix by re-typing the command.
- `run.ts` — `main(argv, io)`, which does the I/O through an injectable
  `CliIO` (write a line, read a file) and returns an exit code.
- `index.ts` — a four-line shim that wires `process.argv` to `main` and
  sets `process.exitCode`.

The repo now has **zero runtime dependencies** across all three packages.
Everything left in the tree is dev tooling (ESLint, Prettier, TypeScript,
Vite, Vitest).

## Alternatives considered

- **Keep Commander.** It is a good library and the code it replaced was
  short. But the CLI's surface is small and stable, and "fewer
  dependencies is itself the biggest lever" is already the stated stance
  in `development-guide.md`. Paying a supply-chain and maintenance cost
  for ~40 lines of parsing didn't hold up.
- **A smaller arg parser** (`mri`, `arg`, `minimist`). Smaller, but the
  argument against Commander is not its size — it's that this is a
  dependency at all when the platform already ships the capability.
- **Hand-rolled `for` loop over `argv`.** No dependency either, but
  `parseArgs` already handles `--opt=value`, short flags, `--`, and
  strict unknown-option rejection, and it's maintained by Node. Writing
  that by hand would be strictly worse.

## Consequences

- **Node 20+ is now a hard floor** for running the CLI (it already was in
  practice — CI and the `bin` target Node 22). If the CLI ever needs to
  run on Node 18, `parseArgs` exists there too but was still experimental;
  check before assuming.
- **Help text is hand-maintained.** Commander generated `--help` from the
  command definitions; `USAGE` in `args.ts` is now a string literal that
  can drift from the actual options. When you add or rename an option,
  update `USAGE` in the same edit — `run.test.ts` asserts the help path
  works, not that it's complete.
- **Behaviour changed in two small ways.** `parseArgs` does not accept
  `-f=value` (the `=` form works for long options only: `--format=table`),
  and unknown options/stray positionals now fail with a usage error rather
  than being silently collected. Both are covered by `args.test.ts`.
- **The CLI is more testable than before.** Parsing is pure and the I/O is
  injected, so `main()` can be exercised end-to-end in-process without
  spawning a subprocess or touching the filesystem.
