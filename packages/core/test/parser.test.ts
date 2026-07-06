import { describe, expect, it } from 'vitest';
import { amountStringToCents, matchToParticipants, parseChatText } from '../src/parser.js';

describe('parseChatText - delimiters', () => {
  it('parses comma-separated entries on one line', () => {
    const result = parseChatText("Jenny: 10.4, Paul: 20, Linda: 11.5");
    expect(result.unparsedLines).toEqual([]);
    const byName = new Map(result.entries.map((e) => [e.name, e.amountCents]));
    expect(byName.get('Jenny')).toBe(1040);
    expect(byName.get('Paul')).toBe(2000);
    expect(byName.get('Linda')).toBe(1150);
  });

  it('parses newline-separated entries', () => {
    const result = parseChatText('Jenny: 10.4\nPaul: 20\nLinda: 11.5');
    expect(result.entries).toHaveLength(3);
  });

  it('parses semicolon-separated entries', () => {
    const result = parseChatText('Jenny: 10.4; Paul: 20; Linda: 11.5');
    expect(result.entries).toHaveLength(3);
  });

  it('parses bulleted lines with -, *, and •', () => {
    const result = parseChatText('- Jenny: 10.4\n* Paul: 20\n• Linda: 11.5');
    expect(result.entries).toHaveLength(3);
  });

  it('parses numbered lines', () => {
    const result = parseChatText('1. Jenny: 10.4\n2) Paul: 20');
    expect(result.entries).toHaveLength(2);
  });

  it('parses dash-separated name/amount', () => {
    const result = parseChatText('Jenny - 10.4');
    expect(result.entries[0]).toMatchObject({ name: 'Jenny', amountCents: 1040 });
  });

  it('parses whitespace-only separated name/amount', () => {
    const result = parseChatText('Jenny 10.4');
    expect(result.entries[0]).toMatchObject({ name: 'Jenny', amountCents: 1040 });
  });
});

describe('parseChatText - currency symbols and codes', () => {
  it('handles a leading currency symbol', () => {
    const result = parseChatText('Jenny: $10.40');
    expect(result.entries[0]?.amountCents).toBe(1040);
  });

  it('handles a trailing currency code', () => {
    const result = parseChatText('Jenny: 10.40 SGD');
    expect(result.entries[0]?.amountCents).toBe(1040);
  });

  it('handles no currency marker at all', () => {
    const result = parseChatText('Jenny: 10.40');
    expect(result.entries[0]?.amountCents).toBe(1040);
  });
});

describe('parseChatText - decimal vs thousands ambiguity', () => {
  it('treats a single comma with 1 digit after as decimal', () => {
    expect(amountStringToCents('10,4')).toBe(1040);
  });

  it('treats a single comma with 3 digits after as thousands', () => {
    expect(amountStringToCents('1,000')).toBe(100000);
  });

  it('treats a single dot with 2 digits after as decimal', () => {
    expect(amountStringToCents('10.40')).toBe(1040);
  });

  it('resolves dot-thousand comma-decimal (1.000,50)', () => {
    expect(amountStringToCents('1.000,50')).toBe(100050);
  });

  it('resolves comma-thousand dot-decimal (1,000.50)', () => {
    expect(amountStringToCents('1,000.50')).toBe(100050);
  });

  it('handles a plain integer with no separators', () => {
    expect(amountStringToCents('20')).toBe(2000);
  });
});

describe('parseChatText - names with punctuation/trailing marks', () => {
  it('tolerates trailing punctuation on a line', () => {
    const result = parseChatText('Jenny: 10.4!');
    expect(result.entries[0]).toMatchObject({ name: 'Jenny', amountCents: 1040 });
  });

  it('tolerates a name with an initial', () => {
    const result = parseChatText('Jenny K: 10.4');
    expect(result.entries[0]?.name).toBe('Jenny K');
  });
});

describe('parseChatText - duplicates', () => {
  it('sums amounts for a name that appears twice in one paste', () => {
    const result = parseChatText('Jenny: 10\nJenny: 5');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.amountCents).toBe(1500);
    expect(result.entries[0]?.rawLines).toHaveLength(2);
  });

  it('matches duplicate names case-insensitively', () => {
    const result = parseChatText('jenny: 10\nJENNY: 5');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.amountCents).toBe(1500);
  });
});

describe('parseChatText - unparseable lines', () => {
  it('reports a line with no amount as unparsed rather than dropping or crashing', () => {
    const result = parseChatText('just a note with no amount\nJenny: 10');
    expect(result.unparsedLines).toContain('just a note with no amount');
    expect(result.entries).toHaveLength(1);
  });

  it('does not throw on an empty string', () => {
    expect(() => parseChatText('')).not.toThrow();
    expect(parseChatText('').entries).toEqual([]);
  });
});

describe('matchToParticipants', () => {
  it('matches names case-insensitively and trimmed', () => {
    const participants = [
      { id: 'p1', name: 'Jenny' },
      { id: 'p2', name: 'Paul' },
    ];
    const { matched, unmatched } = matchToParticipants(
      [
        { name: '  jenny ', amountCents: 1000, rawLines: ['jenny: 10'] },
        { name: 'Someone Else', amountCents: 500, rawLines: ['Someone Else: 5'] },
      ],
      participants,
    );
    expect(matched).toEqual([{ participantId: 'p1', amountCents: 1000 }]);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0]?.name).toBe('Someone Else');
  });
});
