# Input parsing (chat-paste)

Goal: let a user copy a chunk of chat (WhatsApp or similar) that lists who
paid what, paste it into one text box, and get back structured
`{ name, amountCents }` entries to feed the calculation engine — without
needing to reformat it first.

## Supported input shapes

The parser should treat the pasted blob as a set of "lines", where a line
can be separated from the next by any of:

- Newline (most common — copying multiple WhatsApp messages)
- Comma (`Jenny: 10.4, Paul: 20, Linda: 11.5`)
- Semicolon
- Bullet markers at the start of a line: `-`, `*`, `•`, or a leading
  number like `1.` / `1)` (WhatsApp doesn't bullet natively, but users
  paste from notes apps that do)

Within a line, the expected shape is `<name><separator><amount>`, where:

- `<separator>` is a colon, a dash, or just whitespace before a number
  (`Jenny: 10.4`, `Jenny - 10.4`, `Jenny 10.4`).
- `<amount>` may have a currency symbol/code before or after it (`$10.40`,
  `10.40 SGD`, `Rp10.400`), thousands separators, and either `.` or `,` as
  the decimal separator. Locale is ambiguous in isolation (`10,4` could be
  10.4 or 10400) — see "Ambiguity" below.
- Trailing punctuation/emoji on a line (`Jenny: 10.4 ✅`, `Jenny: 10.4!`)
  should not break parsing of the name/amount.

## Parsing strategy

1. **Split into lines** on newline first, then split each resulting line
   further on comma/semicolon *only if* it contains multiple
   `name:amount`-shaped chunks (a raw split on comma alone would wrongly
   break `Rp10,400` — split on a delimiter only between recognized
   entries, e.g. by finding all `name`-then-`amount` matches within the
   line rather than blindly tokenizing on the delimiter character).
2. **Strip leading bullets/numbering** (`^[-*•]\s*` or `^\d+[.)]\s*`) from
   each line before extracting name/amount.
3. **Extract name + amount** per entry via a pattern along the lines of:
   `^\s*([^\d:$]+?)\s*[:\-]?\s*[$]?\s*([\d.,]+)\s*[A-Za-z]{0,3}\s*$`
   — i.e. "a run of non-numeric characters (the name), then an optional
   separator, then a number, then an optional trailing currency code."
   Treat this as a starting point to refine against real fixtures, not as
   gospel — see "Test fixtures" below.
4. **Normalize the amount** to integer cents: strip currency
   symbols/codes and thousands separators, resolve the decimal-separator
   ambiguity (see below), then round to the nearest cent and convert.
5. **Match the name** against the known participant list case-insensitively
   and trimmed. If a pasted name doesn't match any participant:
   - Do **not** silently drop it.
   - Surface it as an unmatched entry for the user to resolve (map to an
     existing participant, or add as a new one) — never guess a fuzzy
     match silently for money.
6. **Duplicate names within one paste** (e.g. someone paid in two
   installments listed separately): sum their amounts by default, don't
   overwrite. This should be an explicit, tested behavior, not incidental.

## Ambiguity: decimal vs. thousands separator

`10,4` and `1,000` can't both be resolved by a single global rule reliably.
Heuristic, in order:

1. If the number has exactly one separator and exactly 1–2 digits after
   it, treat it as a decimal separator (`10,4` → 10.4, `10.4` → 10.4).
2. If it has exactly one separator and exactly 3 digits after it, it's
   ambiguous between "1000" and "1.000 of a unit" — default to treating it
   as a thousands separator (`1,000` → 1000), since sharing-a-cost amounts
   in the hundreds/thousands are far more common than sub-dollar/cent
   amounts pasted with 3 decimal digits. Document this default prominently
   in the UI (e.g. show the parsed amount next to the raw text for
   confirmation) so a wrong guess is easy to catch and correct, rather than
   silently wrong.
3. Multiple separators (`1,000.50` or `1.000,50`): the last separator is
   decimal, everything before it is thousands grouping.

This is exactly the kind of rule that benefits from a large, real-world
test fixture set (see below) rather than being "solved" theoretically.

## Confirmation step (not silent trust)

Because this is money, the UI should always show the parsed result
(name, amount, and which raw line it came from) for the user to confirm or
correct before it feeds the calculation — the parser should be treated as
a fast first draft, not an oracle. This also naturally handles parser
mistakes gracefully instead of requiring the parser to be perfect.

## Test fixtures

Build the parser test suite as a table of `(raw input, expected parsed
entries)` pairs, covering at minimum:
- Each delimiter style (newline/comma/semicolon/bullets/numbered) alone
  and mixed in one paste.
- Currency symbol before and after, and no currency symbol.
- Decimal-comma and decimal-dot amounts, and the thousands-separator case.
- Names with initials, emoji, or trailing punctuation.
- An unmatched name (not in the participant list).
- A duplicate name appearing twice in the same paste.
- A line that isn't a name/amount pair at all (should be reported as
  unparsed, not silently ignored and not crash the parser).

Keep this fixture file growing — every real-world paste that the parser
gets wrong during development or dogfooding should become a new fixture,
so regressions are caught permanently.
