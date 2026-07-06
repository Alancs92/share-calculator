# 0006 - Screenshot-based in-app guide, not a live-DOM product tour

Status: Accepted

## Context

The web app needed a "how to use this" guide, ideally something a
first-time user can slide through: a title, a picture, a short
explanation, and a highlight pointing at the relevant control — rather
than a wall of text.

## Decision

Build the guide as a small carousel modal (`guide.ts` + rendering in
`main.ts`) driven by a static, hand-curated array of slides, each with a
real PNG screenshot of the relevant card/dialog (checked into
`packages/web/public/guide/`), a caption, and a highlight box positioned
with percentage coordinates over the image. Screenshots are generated
with a throwaway Playwright script against the running app (not part of
the build), captured once, and committed as static assets.

## Alternatives considered

- **Live-DOM spotlight tour** (dim everything, cut a hole around the real
  element the user should look at, à la Shepherd.js/Intro.js/driver.js).
  More "alive" (always matches the current theme and real layout,
  including at whatever viewport the user is actually on) but
  meaningfully more code: computing element positions, keeping them
  correct across scroll/resize, and reacting to layout changes. Rejected
  for now given the app's small surface area — five simple steps don't
  justify that machinery. Worth reconsidering if the guide grows to cover
  many more flows, or if screenshot staleness (see Consequences) becomes
  a recurring annoyance.
- **External tour library.** Rejected for the same zero-extra-dependency
  reason `packages/core` stays dependency-free — pulling in a library for
  five static slides is disproportionate, and every dependency is
  something `npm audit`/Dependabot now has to watch (see
  `development-guide.md`).
- **Text-only help / FAQ.** Simpler to maintain (no images to
  regenerate) but exactly what the product-spec discussion was trying to
  avoid — a picture of the actual control being described is
  substantially easier to follow than a text description of where to
  click.

## Consequences

- **Screenshots go stale.** If a card's layout changes meaningfully (not
  just a color tweak), the corresponding guide screenshot and its
  highlight-box coordinates need regenerating, or the guide will point at
  the wrong thing or show an outdated UI. This is a real, ongoing
  maintenance cost — treat "update the guide screenshots" as part of any
  PR that visibly reshapes a card the guide references. There is
  currently no automated check that catches drift; if this becomes a
  recurring problem, generating the screenshots as a build step (rather
  than a manual throwaway script) would close that gap at the cost of
  needing a headless-browser step in the build.
- **Screenshots are captured once in light mode** and shown as-is
  regardless of the app's current theme (the guide's own chrome — modal,
  buttons, caption — still follows the live theme). This was a deliberate
  scope cut to avoid doubling the maintenance cost with dark-mode
  variants; revisit if it reads as jarring in practice.
- **Highlight coordinates are hand-measured percentages**, computed once
  from each screenshot's actual layout (see the generation script's use
  of `boundingBox()` deltas) and hardcoded into `guide.ts`. They will not
  self-correct if a screenshot is regenerated at a different crop/size —
  recompute them at the same time.
