# Roadmap

Status reflects what's actually done. Update this in the same change that
completes (or descopes) an item — don't let it drift into aspirational.

## Iteration 0 — docs

**Status: done.**

- Product spec, architecture, calculation model, input parsing spec,
  development guide, ADRs for the decisions baked into the above.

## Iteration 1 — core calculation engine

**Status: done.**

- `packages/core`: domain types, the waterfall algorithm (fixed / capped /
  excluded / weighted, with expense-scoped exceptions overriding global
  ones), largest-remainder rounding, aggregation, both invariants
  (`sum(shares) === amount`, `sum(net) === 0`) enforced and property-tested.
- 49 tests: the documented worked examples, cascading-cap and
  infeasible-cap edge cases, single/zero-participant edge cases, and the
  invariants across a range of participant counts and amounts.

## Iteration 2 — chat-paste parser

**Status: done.**

- `packages/core`: parser per `input-parsing.md` — all four delimiter
  styles, currency symbols/codes, the decimal-vs-thousands-separator
  heuristic, duplicate-name summing, unparsed-line reporting, and
  case-insensitive participant matching (`matchToParticipants`).

## Iteration 3 — CLI tool

**Status: done.**

- `packages/cli` (`share-calc`): `calculate` (JSON in, JSON/table/whatsapp
  out) and `parse` (chat text in, matched/unmatched entries out) commands.
  Command logic is pure/testable (`commands.ts`); `index.ts` is thin
  commander wiring.

## Iteration 4 — web app (MVP)

**Status: done.**

- `packages/web`: vanilla TS + Vite, bundling `packages/core`'s source
  directly (no separate core build step needed for web dev/build).
- Add participants; set a per-participant global exception
  (excluded/capped/fixed); add expenses via a "who paid what" form (the
  total is derived from the payments, not entered separately); paste chat
  text to auto-create an expense (unmatched names become new participants
  automatically — see the parser doc's note on trusting-but-verifying
  parsed input; this MVP skips a manual-resolution step in favor of
  auto-adding, which is a deliberate simplification, not the parser being
  silently wrong about anything since names it can't place become visible
  new participants, not dropped data).
- Results table + WhatsApp-ready copy-to-clipboard text.
- State persists to `localStorage` (last-write-wins across tabs, per the
  concurrency note in `development-guide.md`).
- Verified end-to-end in a real browser (Playwright): the canonical
  10-person/3-payer example, the paste flow, a cap exception cascading
  correctly, and persistence across a reload — zero console errors.
- **Not yet in the UI** (engine supports all of this already): per-expense
  exceptions (only global exceptions are exposed), weighted shares,
  restricting an expense to a subset of participants. These are UI-only
  gaps, not engine gaps — natural next-iteration work.

## Iteration 4.5 — UI/UX polish: theme, redesign, guide, mobile

**Status: done.**

- Full visual redesign: light/dark mode (auto-detect + header toggle,
  pre-paint applied to avoid a flash of the wrong theme), card-based
  layout, inline SVG icon set, status pills.
- Participants and Expenses simplified into compact cards: participants
  are name chips (exception shown as a short note only when set) with
  edit/remove icon buttons; editing opens a modal. Expenses are compact
  cards with edit/remove; add and edit now share one modal form that
  lists every participant next to an amount field — this replaced an
  earlier payer-row-plus-dropdown design that read as a near-duplicate of
  "Add participant" and confused the two.
- "Paste from chat" moved from an always-visible section into a modal,
  opened via a button.
- All modals (paste, edit-participant, add/edit-expense, the guide) share
  one `createModal()` helper: focus trap, Escape/backdrop-click to close,
  focus restored to the trigger on close.
- Adding participants now accepts a comma/semicolon-separated list to add
  several at once, with a visible hint (not just a placeholder).
- **In-app how-to guide**: a "?" button opens a slide-through carousel
  (title, real screenshot, caption, highlighted control), navigable by
  button, keyboard arrows, dot indicators, or touch swipe. See
  `decisions/0006-screenshot-based-guide.md` for the design and its
  maintenance cost (screenshots need regenerating when the UI they show
  changes visibly).
- **Mobile-responsive pass**: verified at phone-width viewports (~375-
  390px) — no page-level horizontal overflow, touch-sized icon buttons,
  modals cap height and scroll internally, header/card actions wrap
  instead of overflowing, and the results table tightens its own padding/
  font-size before falling back to horizontal scroll. See
  `architecture.md`'s "UI implementation (as built)" section.
- Verified via Playwright: theme toggle + persistence, all modal
  interactions (focus trap, Escape, backdrop click, focus restore), the
  guide's every navigation method including wrap-around, and a full
  mobile-viewport pass (390×844) with a real add-participants → add-
  expense → view-results flow — zero console errors throughout.

## CI

**Status: done (basic).**

- `.github/workflows/ci.yml`: lint + typecheck + test + build on every
  push/PR.
- `.github/workflows/security.yml`: `npm audit` (fails on high/critical)
  on every push/PR plus a weekly schedule, so newly-disclosed advisories
  in already-installed dependencies surface without needing a code change.
- `.github/dependabot.yml`: weekly npm + GitHub Actions dependency PRs.
- `.github/workflows/deploy.yml`: builds `packages/web` and publishes to
  GitHub Pages on push to `main` (path-filtered to web/core changes) or
  manual dispatch. Verified end-to-end: needed a one-time manual repo
  setting (Settings → Pages → Build and deployment → Source: GitHub
  Actions) before the workflow's `actions/configure-pages` step could
  create the Pages site — the default `GITHUB_TOKEN` can't create one via
  the API on its own. After that one-time step, the workflow deploys
  cleanly. Live at `https://alancs92.github.io/share-calculator/`.

## Iteration 5 — export & convenience

- Excel/CSV export (client-side).
- Shareable state via URL (as an alternative/complement to localStorage).

## Later / not yet scoped

Needs its own design pass and ADR before starting, not a quick add-on:

- Settlement view (minimal peer-to-peer transactions).
- Per-expense exceptions, weighted shares, and expense-subset participants
  in the UI (engine already supports all three).
- Any persistent backend for cross-device storage, if local/file-based
  storage turns out to be insufficient in practice.
- Dark-mode variants of the in-app guide screenshots, if the light-mode-
  only images read as jarring in practice (see ADR 0006).
