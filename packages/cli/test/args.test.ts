import { describe, expect, it } from 'vitest';
import { UsageError, parseCliArgs } from '../src/args.js';

describe('parseCliArgs', () => {
  it('shows help when given no arguments', () => {
    expect(parseCliArgs([])).toEqual({ kind: 'help' });
  });

  it.each([['help'], ['--help'], ['-h']])('treats %s as the help command', (arg) => {
    expect(parseCliArgs([arg])).toEqual({ kind: 'help' });
  });

  it.each([['version'], ['--version'], ['-V']])('treats %s as the version command', (arg) => {
    expect(parseCliArgs([arg])).toEqual({ kind: 'version' });
  });

  it('defaults calculate to JSON output from stdin with a $ symbol', () => {
    expect(parseCliArgs(['calculate'])).toEqual({
      kind: 'calculate',
      input: undefined,
      format: 'json',
      currencySymbol: '$',
    });
  });

  it('reads calculate long options', () => {
    expect(
      parseCliArgs([
        'calculate',
        '--input',
        'in.json',
        '--format',
        'table',
        '--currency-symbol',
        'Rp',
      ]),
    ).toEqual({ kind: 'calculate', input: 'in.json', format: 'table', currencySymbol: 'Rp' });
  });

  it('reads calculate short options and =-joined long options', () => {
    expect(parseCliArgs(['calculate', '-i', 'in.json', '--format=whatsapp'])).toEqual({
      kind: 'calculate',
      input: 'in.json',
      format: 'whatsapp',
      currencySymbol: '$',
    });
  });

  it('defaults parse to stdin with no participants file', () => {
    expect(parseCliArgs(['parse'])).toEqual({
      kind: 'parse',
      text: undefined,
      participants: undefined,
    });
  });

  it('reads parse options', () => {
    expect(parseCliArgs(['parse', '-t', 'Jenny: 10', '--participants', 'p.json'])).toEqual({
      kind: 'parse',
      text: 'Jenny: 10',
      participants: 'p.json',
    });
  });

  it('honours --help after a subcommand', () => {
    expect(parseCliArgs(['calculate', '--help'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['parse', '-h'])).toEqual({ kind: 'help' });
  });

  it('rejects an unknown command', () => {
    expect(() => parseCliArgs(['frobnicate'])).toThrow(UsageError);
    expect(() => parseCliArgs(['frobnicate'])).toThrow(/Unknown command: frobnicate/);
  });

  it('rejects an unknown option', () => {
    expect(() => parseCliArgs(['calculate', '--nope'])).toThrow(UsageError);
  });

  it('rejects stray positional arguments', () => {
    expect(() => parseCliArgs(['calculate', 'in.json'])).toThrow(UsageError);
  });

  it('rejects an option used as a flag when it needs a value', () => {
    expect(() => parseCliArgs(['calculate', '--format'])).toThrow(UsageError);
  });
});
