import { describe, expect, it } from 'vitest';
import { calculate, splitExpense } from '../src/engine.js';
import { OverCommittedExpenseError, UnderfundedExpenseError, ValidationError } from '../src/errors.js';
import type { CalculationInput, Exception, Expense, Participant } from '../src/types.js';

function participants(n: number): Participant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Person ${i}` }));
}

function sumShares(shares: Map<string, number>): number {
  return [...shares.values()].reduce((a, b) => a + b, 0);
}

describe('splitExpense - even split (canonical example)', () => {
  it('splits $150 evenly among 10 people with 3 payers', () => {
    const ps = participants(10);
    const expense: Expense = {
      id: 'e1',
      amountCents: 15000,
      paidBy: [
        { participantId: 'p0', amountCents: 5000 },
        { participantId: 'p1', amountCents: 5000 },
        { participantId: 'p2', amountCents: 5000 },
      ],
    };
    const shares = splitExpense(expense, ps, []);
    expect(sumShares(shares)).toBe(15000);
    for (const p of ps) {
      expect(shares.get(p.id)).toBe(1500);
    }
  });

  it('produces the documented net table for the canonical example', () => {
    const ps = participants(10);
    const input: CalculationInput = {
      participants: ps,
      expenses: [
        {
          id: 'e1',
          amountCents: 15000,
          paidBy: [
            { participantId: 'p0', amountCents: 5000 },
            { participantId: 'p1', amountCents: 5000 },
            { participantId: 'p2', amountCents: 5000 },
          ],
        },
      ],
    };
    const result = calculate(input);
    const byId = new Map(result.participants.map((p) => [p.participantId, p]));
    expect(byId.get('p0')?.netCents).toBe(3500);
    expect(byId.get('p1')?.netCents).toBe(3500);
    expect(byId.get('p2')?.netCents).toBe(3500);
    expect(byId.get('p3')?.netCents).toBe(-1500);
    expect(byId.get('p9')?.netCents).toBe(-1500);
    const netSum = result.participants.reduce((s, p) => s + p.netCents, 0);
    expect(netSum).toBe(0);
  });
});

describe('splitExpense - rounding', () => {
  it('distributes an unevenly-divisible amount with sum exactly equal to the total', () => {
    const ps = participants(3);
    const expense: Expense = {
      id: 'e1',
      amountCents: 1000,
      paidBy: [{ participantId: 'p0', amountCents: 1000 }],
    };
    const shares = splitExpense(expense, ps, []);
    expect(sumShares(shares)).toBe(1000);
    // 1000 / 3 = 333.33 -> two people get 333, one gets 334
    const values = [...shares.values()].sort((a, b) => a - b);
    expect(values).toEqual([333, 333, 334]);
  });

  it('is deterministic: ties broken by participant id', () => {
    const ps = participants(3);
    const expense: Expense = {
      id: 'e1',
      amountCents: 1000,
      paidBy: [{ participantId: 'p0', amountCents: 1000 }],
    };
    const a = splitExpense(expense, ps, []);
    const b = splitExpense(expense, ps, []);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});

describe('splitExpense - exclusion', () => {
  it('excludes a participant from an expense entirely, redistributing among the rest', () => {
    const ps = participants(3);
    const exceptions: Exception[] = [{ participantId: 'p2', scope: 'e1', kind: 'excluded' }];
    const expense: Expense = {
      id: 'e1',
      amountCents: 1000,
      paidBy: [{ participantId: 'p0', amountCents: 1000 }],
    };
    const shares = splitExpense(expense, ps, exceptions);
    expect(shares.has('p2')).toBe(false);
    expect(sumShares(shares)).toBe(1000);
    expect(shares.get('p0')).toBe(500);
    expect(shares.get('p1')).toBe(500);
  });

  it('applies a global exclusion across every expense', () => {
    const ps = participants(3);
    const exceptions: Exception[] = [{ participantId: 'p2', scope: 'global', kind: 'excluded' }];
    const input: CalculationInput = {
      participants: ps,
      expenses: [
        { id: 'e1', amountCents: 1000, paidBy: [{ participantId: 'p0', amountCents: 1000 }] },
        { id: 'e2', amountCents: 2000, paidBy: [{ participantId: 'p1', amountCents: 2000 }] },
      ],
      exceptions,
    };
    const result = calculate(input);
    const p2 = result.participants.find((p) => p.participantId === 'p2');
    expect(p2?.totalShareCents).toBe(0);
  });
});

describe('splitExpense - caps (worked example from calculation-model.md)', () => {
  it('caps one participant and redistributes the excess, excluding another entirely', () => {
    const ps = participants(10);
    const exceptions: Exception[] = [
      { participantId: 'p0', scope: 'global', kind: 'capped', amountCents: 500 },
      { participantId: 'p1', scope: 'e1', kind: 'excluded' },
    ];
    const expense: Expense = { id: 'e1', amountCents: 15000, paidBy: [] };
    // paidBy sum must equal amount for validation; use calculate() bypassing that check here
    // by calling splitExpense directly (validation happens in calculate(), not splitExpense).
    const shares = splitExpense(expense, ps, exceptions);
    expect(shares.has('p1')).toBe(false);
    expect(shares.get('p0')).toBe(500);
    expect(sumShares(shares)).toBe(15000);
    // remaining 14500 split among 8 people (not p0, not p1)
    const others = [...shares.entries()].filter(([id]) => id !== 'p0');
    expect(others).toHaveLength(8);
    const otherSum = others.reduce((s, [, v]) => s + v, 0);
    expect(otherSum).toBe(14500);
  });

  it('cascades: capping one participant can push another over their own cap', () => {
    const ps = participants(4);
    // Total 1000 among 4. p0 capped at 100. Remaining 900 among 3 -> 300 each.
    // p1 capped at 250 -> exceeds by being under 300, so p1 gets capped too, cascading.
    const exceptions: Exception[] = [
      { participantId: 'p0', scope: 'global', kind: 'capped', amountCents: 100 },
      { participantId: 'p1', scope: 'global', kind: 'capped', amountCents: 250 },
    ];
    const expense: Expense = { id: 'e1', amountCents: 1000, paidBy: [] };
    const shares = splitExpense(expense, ps, exceptions);
    expect(shares.get('p0')).toBe(100);
    expect(shares.get('p1')).toBe(250);
    // remaining 650 split between p2 and p3 -> 325 each
    expect(shares.get('p2')).toBe(325);
    expect(shares.get('p3')).toBe(325);
    expect(sumShares(shares)).toBe(1000);
  });

  it('throws UnderfundedExpenseError when caps cannot cover the total', () => {
    const ps = participants(2);
    const exceptions: Exception[] = [
      { participantId: 'p0', scope: 'global', kind: 'capped', amountCents: 100 },
      { participantId: 'p1', scope: 'global', kind: 'capped', amountCents: 100 },
    ];
    const expense: Expense = { id: 'e1', amountCents: 1000, paidBy: [] };
    expect(() => splitExpense(expense, ps, exceptions)).toThrow(UnderfundedExpenseError);
  });
});

describe('splitExpense - fixed amounts', () => {
  it('gives a fixed participant exactly their amount regardless of even split', () => {
    const ps = participants(3);
    const exceptions: Exception[] = [
      { participantId: 'p0', scope: 'global', kind: 'fixed', amountCents: 100 },
    ];
    const expense: Expense = { id: 'e1', amountCents: 1000, paidBy: [] };
    const shares = splitExpense(expense, ps, exceptions);
    expect(shares.get('p0')).toBe(100);
    expect(shares.get('p1')).toBe(450);
    expect(shares.get('p2')).toBe(450);
    expect(sumShares(shares)).toBe(1000);
  });

  it('throws OverCommittedExpenseError when fixed amounts exceed the total', () => {
    const ps = participants(2);
    const exceptions: Exception[] = [
      { participantId: 'p0', scope: 'global', kind: 'fixed', amountCents: 2000 },
    ];
    const expense: Expense = { id: 'e1', amountCents: 1000, paidBy: [] };
    expect(() => splitExpense(expense, ps, exceptions)).toThrow(OverCommittedExpenseError);
  });
});

describe('splitExpense - weights', () => {
  it('splits proportionally to weight', () => {
    const ps: Participant[] = [
      { id: 'p0', name: 'A', weight: 2 },
      { id: 'p1', name: 'B', weight: 1 },
    ];
    const expense: Expense = { id: 'e1', amountCents: 900, paidBy: [] };
    const shares = splitExpense(expense, ps, []);
    expect(shares.get('p0')).toBe(600);
    expect(shares.get('p1')).toBe(300);
  });
});

describe('splitExpense - expense-scoped exception overrides global', () => {
  it('prefers an expense-scoped exception over a global one for the same participant', () => {
    const ps = participants(2);
    const exceptions: Exception[] = [
      { participantId: 'p0', scope: 'global', kind: 'capped', amountCents: 100 },
      { participantId: 'p0', scope: 'e1', kind: 'fixed', amountCents: 700 },
    ];
    const expense: Expense = { id: 'e1', amountCents: 1000, paidBy: [] };
    const shares = splitExpense(expense, ps, exceptions);
    expect(shares.get('p0')).toBe(700);
    expect(shares.get('p1')).toBe(300);
  });
});

describe('edge cases', () => {
  it('handles a single participant', () => {
    const ps = participants(1);
    const expense: Expense = {
      id: 'e1',
      amountCents: 1000,
      paidBy: [{ participantId: 'p0', amountCents: 1000 }],
    };
    const shares = splitExpense(expense, ps, []);
    expect(shares.get('p0')).toBe(1000);
  });

  it('handles a zero-amount expense', () => {
    const ps = participants(3);
    const expense: Expense = { id: 'e1', amountCents: 0, paidBy: [] };
    const shares = splitExpense(expense, ps, []);
    expect(sumShares(shares)).toBe(0);
  });

  it('handles an expense excluding all-but-one participant', () => {
    const ps = participants(3);
    const exceptions: Exception[] = [
      { participantId: 'p0', scope: 'e1', kind: 'excluded' },
      { participantId: 'p1', scope: 'e1', kind: 'excluded' },
    ];
    const expense: Expense = { id: 'e1', amountCents: 1000, paidBy: [] };
    const shares = splitExpense(expense, ps, exceptions);
    expect(shares.get('p2')).toBe(1000);
    expect(shares.has('p0')).toBe(false);
    expect(shares.has('p1')).toBe(false);
  });

  it('handles an expense scoped to a subset of participants', () => {
    const ps = participants(5);
    const expense: Expense = {
      id: 'e1',
      amountCents: 300,
      paidBy: [],
      participantIds: ['p0', 'p1', 'p2'],
    };
    const shares = splitExpense(expense, ps, []);
    expect(shares.size).toBe(3);
    expect(sumShares(shares)).toBe(300);
  });
});

describe('multiple expenses aggregation', () => {
  it('aggregates net across several expenses', () => {
    const ps = participants(3);
    const input: CalculationInput = {
      participants: ps,
      expenses: [
        { id: 'e1', amountCents: 300, paidBy: [{ participantId: 'p0', amountCents: 300 }] },
        { id: 'e2', amountCents: 600, paidBy: [{ participantId: 'p1', amountCents: 600 }] },
      ],
    };
    const result = calculate(input);
    const byId = new Map(result.participants.map((p) => [p.participantId, p]));
    // each expense splits 100/200 evenly among 3 -> share totals 100+200=300 each
    expect(byId.get('p0')?.totalShareCents).toBe(300);
    expect(byId.get('p0')?.totalPaidCents).toBe(300);
    expect(byId.get('p0')?.netCents).toBe(0);
    expect(byId.get('p1')?.netCents).toBe(600 - 300);
    expect(byId.get('p2')?.netCents).toBe(0 - 300);
    expect(result.totalAmountCents).toBe(900);
  });
});

describe('validation', () => {
  it('rejects paidBy that does not sum to amountCents', () => {
    const ps = participants(2);
    const input: CalculationInput = {
      participants: ps,
      expenses: [
        { id: 'e1', amountCents: 1000, paidBy: [{ participantId: 'p0', amountCents: 500 }] },
      ],
    };
    expect(() => calculate(input)).toThrow(ValidationError);
  });

  it('rejects unknown participant references', () => {
    const ps = participants(1);
    const input: CalculationInput = {
      participants: ps,
      expenses: [
        { id: 'e1', amountCents: 100, paidBy: [{ participantId: 'ghost', amountCents: 100 }] },
      ],
    };
    expect(() => calculate(input)).toThrow(ValidationError);
  });

  it('rejects an exception scoped to an unknown expense', () => {
    const ps = participants(2);
    const input: CalculationInput = {
      participants: ps,
      expenses: [],
      exceptions: [{ participantId: 'p0', scope: 'no-such-expense', kind: 'excluded' }],
    };
    expect(() => calculate(input)).toThrow(ValidationError);
  });
});

describe('property: invariants hold across random-ish scenarios', () => {
  it('sum(shares) === amountCents for a range of participant counts and amounts', () => {
    for (const n of [1, 2, 3, 4, 7, 10, 13]) {
      for (const amount of [0, 1, 7, 99, 1000, 15000, 999999]) {
        const ps = participants(n);
        const expense: Expense = { id: 'e1', amountCents: amount, paidBy: [] };
        const shares = splitExpense(expense, ps, []);
        expect(sumShares(shares)).toBe(amount);
      }
    }
  });

  it('sum(netCents) === 0 for a range of payer configurations', () => {
    for (const n of [1, 2, 5, 10]) {
      const ps = participants(n);
      const paidBy = ps.slice(0, Math.max(1, Math.floor(n / 3))).map((p, i, arr) => ({
        participantId: p.id,
        amountCents: i === arr.length - 1 ? 10000 - 100 * (arr.length - 1) : 100,
      }));
      const paidSum = paidBy.reduce((s, p) => s + p.amountCents, 0);
      const input: CalculationInput = {
        participants: ps,
        expenses: [{ id: 'e1', amountCents: paidSum, paidBy }],
      };
      const result = calculate(input);
      const netSum = result.participants.reduce((s, p) => s + p.netCents, 0);
      expect(netSum).toBe(0);
    }
  });
});
