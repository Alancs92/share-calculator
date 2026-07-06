import { describe, expect, it } from 'vitest';
import { calculate } from '@share-calculator/core';
import {
  applyParsedEntries,
  createEmptyState,
  expenseTotalCents,
  loadState,
  saveState,
  toCalculationInput,
  type AppState,
} from '../src/state.js';

describe('toCalculationInput', () => {
  it('derives an expense amount from the sum of its payments', () => {
    const state: AppState = {
      participants: [
        { id: 'p1', name: 'Jenny' },
        { id: 'p2', name: 'Paul' },
      ],
      expenses: [
        {
          id: 'e1',
          description: 'Groceries',
          paidBy: [
            { participantId: 'p1', amountCents: 500 },
            { participantId: 'p2', amountCents: 300 },
          ],
        },
      ],
      exceptions: [],
    };
    const input = toCalculationInput(state);
    expect(input.expenses[0]?.amountCents).toBe(800);
    expect(expenseTotalCents(state.expenses[0]!)).toBe(800);
  });

  it('drops exceptions with kind "none" and maps the rest to global scope', () => {
    const state: AppState = {
      participants: [{ id: 'p1', name: 'Jenny' }],
      expenses: [],
      exceptions: [
        { participantId: 'p1', kind: 'none' },
        { participantId: 'p1', kind: 'capped', amountCents: 500 },
      ],
    };
    const input = toCalculationInput(state);
    expect(input.exceptions).toHaveLength(1);
    expect(input.exceptions?.[0]).toEqual({
      participantId: 'p1',
      scope: 'global',
      kind: 'capped',
      amountCents: 500,
    });
  });

  it('produces an input the engine actually accepts and computes correctly', () => {
    const state: AppState = {
      participants: [
        { id: 'p1', name: 'Jenny' },
        { id: 'p2', name: 'Paul' },
      ],
      expenses: [
        { id: 'e1', description: '', paidBy: [{ participantId: 'p1', amountCents: 2000 }] },
      ],
      exceptions: [],
    };
    const result = calculate(toCalculationInput(state));
    expect(result.totalAmountCents).toBe(2000);
  });
});

describe('applyParsedEntries', () => {
  it('matches existing participants and auto-adds unmatched ones', () => {
    let counter = 0;
    const generateId = () => `gen-${counter++}`;
    const state: AppState = {
      participants: [{ id: 'p1', name: 'Jenny' }],
      expenses: [],
      exceptions: [],
    };
    const { state: nextState, expense, addedParticipants } = applyParsedEntries(
      state,
      [
        { name: 'Jenny', amountCents: 1000, rawLines: ['Jenny: 10'] },
        { name: 'Paul', amountCents: 500, rawLines: ['Paul: 5'] },
      ],
      generateId,
    );

    expect(addedParticipants).toEqual([{ id: 'gen-0', name: 'Paul' }]);
    expect(nextState.participants).toHaveLength(2);
    expect(expense.paidBy).toEqual([
      { participantId: 'p1', amountCents: 1000 },
      { participantId: 'gen-0', amountCents: 500 },
    ]);
    expect(nextState.expenses).toHaveLength(1);
  });

  it('does not mutate the original state object', () => {
    const state: AppState = createEmptyState();
    const result = applyParsedEntries(state, [], () => 'x');
    expect(state.participants).toHaveLength(0);
    expect(result.state).not.toBe(state);
  });
});

describe('save/load state', () => {
  it('round-trips through a storage-like object', () => {
    const store = new Map<string, string>();
    const storage = {
      setItem: (k: string, v: string) => store.set(k, v),
      getItem: (k: string) => store.get(k) ?? null,
    };
    const state: AppState = {
      participants: [{ id: 'p1', name: 'Jenny' }],
      expenses: [],
      exceptions: [],
    };
    saveState(state, storage);
    expect(loadState(storage)).toEqual(state);
  });

  it('returns null when nothing is stored', () => {
    const storage = { getItem: () => null };
    expect(loadState(storage)).toBeNull();
  });

  it('returns null instead of throwing on corrupt stored data', () => {
    const storage = { getItem: () => 'not json' };
    expect(loadState(storage)).toBeNull();
  });
});
