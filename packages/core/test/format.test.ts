import { describe, expect, it } from 'vitest';
import { calculate } from '../src/engine.js';
import { formatTable, formatWhatsApp, toTableRows } from '../src/format.js';
import type { CalculationInput } from '../src/types.js';

function sampleInput(): CalculationInput {
  return {
    participants: [
      { id: 'p1', name: 'Jenny' },
      { id: 'p2', name: 'Paul' },
    ],
    expenses: [
      { id: 'e1', amountCents: 2000, paidBy: [{ participantId: 'p1', amountCents: 2000 }] },
    ],
  };
}

describe('toTableRows', () => {
  it('produces one row per participant with correct status', () => {
    const rows = toTableRows(calculate(sampleInput()));
    expect(rows).toEqual([
      { name: 'Jenny', paid: '$20.00', share: '$10.00', net: '$10.00', status: 'is owed' },
      { name: 'Paul', paid: '$0.00', share: '$10.00', net: '-$10.00', status: 'owes' },
    ]);
  });
});

describe('formatTable', () => {
  it('renders a readable fixed-width table containing every name and status', () => {
    const text = formatTable(calculate(sampleInput()));
    expect(text).toContain('Jenny');
    expect(text).toContain('Paul');
    expect(text).toContain('is owed');
    expect(text).toContain('owes');
  });
});

describe('formatWhatsApp', () => {
  it('renders a plain-text summary with owed/owes wording and a total', () => {
    const text = formatWhatsApp(calculate(sampleInput()));
    expect(text).toContain('Jenny: is owed $10.00');
    expect(text).toContain('Paul: owes $10.00');
    expect(text).toContain('Total: $20.00');
  });
});
