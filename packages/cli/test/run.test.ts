import { describe, expect, it } from 'vitest';
import { type CliIO, main } from '../src/run.js';

const SAMPLE_INPUT = JSON.stringify({
  participants: [
    { id: 'p1', name: 'Jenny' },
    { id: 'p2', name: 'Paul' },
  ],
  expenses: [{ id: 'e1', amountCents: 2000, paidBy: [{ participantId: 'p1', amountCents: 2000 }] }],
});

const PARTICIPANTS = JSON.stringify([
  { id: 'p1', name: 'Jenny' },
  { id: 'p2', name: 'Paul' },
]);

/** Collects output and serves canned file contents (key 0 is stdin). */
function fakeIO(files: Record<string | number, string> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const reads: (string | number)[] = [];
  const io: CliIO = {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    readFile: (path) => {
      reads.push(path);
      const contents = files[path];
      if (contents === undefined) throw new Error(`ENOENT: no such file, open '${String(path)}'`);
      return contents;
    },
  };
  return { io, out, err, reads };
}

describe('main', () => {
  it('prints usage and exits 0 for --help', () => {
    const { io, out } = fakeIO();
    expect(main(['--help'], io)).toBe(0);
    expect(out.join('\n')).toContain('Usage:');
  });

  it('prints the version and exits 0 for --version', () => {
    const { io, out } = fakeIO();
    expect(main(['--version'], io)).toBe(0);
    expect(out).toEqual(['0.1.0']);
  });

  it('calculates from stdin by default', () => {
    const { io, out, reads } = fakeIO({ 0: SAMPLE_INPUT });
    expect(main(['calculate'], io)).toBe(0);
    expect(reads).toEqual([0]);
    expect(JSON.parse(out[0] ?? '').totalAmountCents).toBe(2000);
  });

  it('calculates from a file with the requested format and symbol', () => {
    const { io, out } = fakeIO({ 'in.json': SAMPLE_INPUT });
    expect(
      main(['calculate', '-i', 'in.json', '-f', 'whatsapp', '--currency-symbol', 'Rp'], io),
    ).toBe(0);
    expect(out[0]).toContain('Jenny: is owed Rp10.00');
  });

  it('parses inline text without touching the filesystem', () => {
    const { io, out, reads } = fakeIO();
    expect(main(['parse', '-t', 'Jenny: 10.4, Paul: 20'], io)).toBe(0);
    expect(reads).toEqual([]);
    expect(JSON.parse(out[0] ?? '').entries).toHaveLength(2);
  });

  it('matches parsed names against a participants file', () => {
    const { io, out } = fakeIO({ 'p.json': PARTICIPANTS });
    expect(main(['parse', '-t', 'Jenny: 10.4', '-p', 'p.json'], io)).toBe(0);
    expect(JSON.parse(out[0] ?? '').matched).toEqual([{ participantId: 'p1', amountCents: 1040 }]);
  });

  it('exits 1 and points at --help on a usage error', () => {
    const { io, err } = fakeIO();
    expect(main(['frobnicate'], io)).toBe(1);
    expect(err.join('\n')).toContain('Unknown command: frobnicate');
    expect(err.join('\n')).toContain('--help');
  });

  it('exits 1 with the error message on bad input, without the usage hint', () => {
    const { io, err } = fakeIO({ 0: '{not json' });
    expect(main(['calculate'], io)).toBe(1);
    expect(err.join('\n')).toContain('Invalid JSON input');
    expect(err.join('\n')).not.toContain('--help');
  });

  it('exits 1 when the input file is missing', () => {
    const { io, err } = fakeIO();
    expect(main(['calculate', '-i', 'nope.json'], io)).toBe(1);
    expect(err.join('\n')).toContain('nope.json');
  });
});
