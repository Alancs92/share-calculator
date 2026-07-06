import { describe, expect, it } from 'vitest';
import { runCalculate, runParse } from '../src/commands.js';

const SAMPLE_INPUT = JSON.stringify({
  participants: [
    { id: 'p1', name: 'Jenny' },
    { id: 'p2', name: 'Paul' },
  ],
  expenses: [
    { id: 'e1', amountCents: 2000, paidBy: [{ participantId: 'p1', amountCents: 2000 }] },
  ],
});

describe('runCalculate', () => {
  it('defaults to JSON output', () => {
    const output = runCalculate(SAMPLE_INPUT);
    const parsed = JSON.parse(output);
    expect(parsed.totalAmountCents).toBe(2000);
    expect(parsed.participants).toHaveLength(2);
  });

  it('renders a table', () => {
    const output = runCalculate(SAMPLE_INPUT, { format: 'table' });
    expect(output).toContain('Jenny');
    expect(output).toContain('is owed');
  });

  it('renders whatsapp text', () => {
    const output = runCalculate(SAMPLE_INPUT, { format: 'whatsapp' });
    expect(output).toContain('Jenny: is owed $10.00');
  });

  it('throws a clear error on invalid JSON', () => {
    expect(() => runCalculate('{not json')).toThrow(/Invalid JSON input/);
  });

  it('propagates domain validation errors', () => {
    const bad = JSON.stringify({
      participants: [{ id: 'p1', name: 'Jenny' }],
      expenses: [{ id: 'e1', amountCents: 1000, paidBy: [{ participantId: 'p1', amountCents: 500 }] }],
    });
    expect(() => runCalculate(bad)).toThrow();
  });
});

describe('runParse', () => {
  it('returns parsed entries as JSON when no participants given', () => {
    const output = runParse('Jenny: 10.4, Paul: 20');
    const parsed = JSON.parse(output);
    expect(parsed.entries).toHaveLength(2);
  });

  it('matches against a participants list when provided', () => {
    const participants = JSON.stringify([
      { id: 'p1', name: 'Jenny' },
      { id: 'p2', name: 'Paul' },
    ]);
    const output = runParse('Jenny: 10.4, Someone Else: 5', participants);
    const parsed = JSON.parse(output);
    expect(parsed.matched).toEqual([{ participantId: 'p1', amountCents: 1040 }]);
    expect(parsed.unmatched).toHaveLength(1);
  });

  it('throws a clear error on invalid participants JSON', () => {
    expect(() => runParse('Jenny: 10', '{not json')).toThrow(/Invalid participants JSON/);
  });
});
