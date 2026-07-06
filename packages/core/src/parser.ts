import type { Participant, ParticipantId } from './types.js';

export interface ParsedEntry {
  name: string;
  amountCents: number;
  /** The raw token(s) this entry was extracted from, for a "confirm before trusting" UI. */
  rawLines: string[];
}

export interface ParseResult {
  entries: ParsedEntry[];
  unparsedLines: string[];
}

export interface MatchedPayment {
  participantId: ParticipantId;
  amountCents: number;
}

export interface MatchResult {
  matched: MatchedPayment[];
  unmatched: ParsedEntry[];
}

const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s*/;
const ENTRY_RE =
  /^([A-Za-z][A-Za-z .'-]*?)\s*[:-]?\s*[$€£]?\s*(-?\d[\d.,]*)\s*(?:[A-Za-z]{2,4})?[^A-Za-z0-9]*$/;

/**
 * Splits a line on comma/semicolon into candidate entries, but reattaches any
 * resulting token that contains no letters (e.g. the "400" in "Rp10,400") to the
 * previous token, since that's a thousands-group continuation, not a new entry.
 */
function splitLineIntoTokens(line: string): string[] {
  const rawParts = line
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const tokens: string[] = [];
  for (const part of rawParts) {
    const previous = tokens[tokens.length - 1];
    if (!/[A-Za-z]/.test(part) && previous !== undefined) {
      tokens[tokens.length - 1] = `${previous},${part}`;
    } else {
      tokens.push(part);
    }
  }
  return tokens;
}

/** Converts a raw amount string (currency stripped already by the caller regex) to integer cents. */
export function amountStringToCents(raw: string): number {
  const cleaned = raw.trim();
  const separators = [...cleaned.matchAll(/[.,]/g)];

  if (separators.length === 0) {
    return Math.round(parseFloat(cleaned) * 100);
  }

  if (separators.length === 1) {
    const sep = separators[0]!;
    const sepIndex = sep.index;
    const digitsAfter = cleaned.length - sepIndex - 1;
    if (digitsAfter === 3) {
      // Thousands separator: "1,000" -> 1000.
      const digitsOnly = cleaned.replace(/[.,]/g, '');
      return Math.round(parseFloat(digitsOnly) * 100);
    }
    // Decimal separator: "10.4" / "10,4" -> 10.4.
    const normalized = `${cleaned.slice(0, sepIndex)}.${cleaned.slice(sepIndex + 1)}`;
    return Math.round(parseFloat(normalized) * 100);
  }

  // Multiple separators: the last one is decimal, everything before is thousands grouping.
  const lastSep = separators[separators.length - 1]!;
  const lastIndex = lastSep.index;
  const integerPart = cleaned.slice(0, lastIndex).replace(/[.,]/g, '');
  const decimalPart = cleaned.slice(lastIndex + 1);
  return Math.round(parseFloat(`${integerPart}.${decimalPart}`) * 100);
}

/**
 * Parses freeform pasted chat text (WhatsApp-style) into name/amount entries.
 * See docs/input-parsing.md for the full format spec this implements.
 */
export function parseChatText(rawText: string): ParseResult {
  const unparsedLines: string[] = [];
  const merged = new Map<string, ParsedEntry>();

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    const stripped = line.replace(BULLET_RE, '');
    for (const token of splitLineIntoTokens(stripped)) {
      const match = ENTRY_RE.exec(token);
      const name = match?.[1]?.trim();
      const amountRaw = match?.[2];
      if (!match || !name || amountRaw === undefined) {
        unparsedLines.push(token);
        continue;
      }
      const amountCents = amountStringToCents(amountRaw);
      if (!Number.isFinite(amountCents)) {
        unparsedLines.push(token);
        continue;
      }
      const key = name.toLowerCase();
      const existing = merged.get(key);
      if (existing) {
        existing.amountCents += amountCents;
        existing.rawLines.push(token);
      } else {
        merged.set(key, { name, amountCents, rawLines: [token] });
      }
    }
  }

  return { entries: [...merged.values()], unparsedLines };
}

/** Matches parsed entries to known participants, case-insensitively and trimmed. */
export function matchToParticipants(
  entries: ParsedEntry[],
  participants: Participant[],
): MatchResult {
  const byName = new Map(participants.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const matched: MatchedPayment[] = [];
  const unmatched: ParsedEntry[] = [];
  for (const entry of entries) {
    const participantId = byName.get(entry.name.trim().toLowerCase());
    if (participantId) {
      matched.push({ participantId, amountCents: entry.amountCents });
    } else {
      unmatched.push(entry);
    }
  }
  return { matched, unmatched };
}
