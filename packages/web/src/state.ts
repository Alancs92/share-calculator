import type { CalculationInput, Exception, ParsedEntry, ParticipantId } from '@share-calculator/core';
import { matchToParticipants } from '@share-calculator/core';

export interface StateParticipant {
  id: ParticipantId;
  name: string;
}

export type ExceptionKind = 'none' | 'excluded' | 'capped' | 'fixed';

export interface StateException {
  participantId: ParticipantId;
  kind: ExceptionKind;
  amountCents?: number;
}

export interface StatePayment {
  participantId: ParticipantId;
  amountCents: number;
}

export interface StateExpense {
  id: string;
  description: string;
  paidBy: StatePayment[];
}

export interface AppState {
  participants: StateParticipant[];
  expenses: StateExpense[];
  exceptions: StateException[];
}

export function createEmptyState(): AppState {
  return { participants: [], expenses: [], exceptions: [] };
}

export function expenseTotalCents(expense: StateExpense): number {
  return expense.paidBy.reduce((sum, p) => sum + p.amountCents, 0);
}

/** Maps UI state to the core engine's input shape. Only global exceptions are exposed in this MVP. */
export function toCalculationInput(state: AppState): CalculationInput {
  return {
    participants: state.participants.map((p) => ({ id: p.id, name: p.name })),
    expenses: state.expenses.map((e) => ({
      id: e.id,
      ...(e.description ? { description: e.description } : {}),
      amountCents: expenseTotalCents(e),
      paidBy: e.paidBy,
    })),
    exceptions: state.exceptions
      .filter((e): e is StateException & { kind: Exclude<ExceptionKind, 'none'> } => e.kind !== 'none')
      .map((e) => {
        const exception: Exception = {
          participantId: e.participantId,
          scope: 'global',
          kind: e.kind,
          ...(e.amountCents !== undefined ? { amountCents: e.amountCents } : {}),
        };
        return exception;
      }),
  };
}

export interface ApplyParsedEntriesResult {
  state: AppState;
  expense: StateExpense;
  addedParticipants: StateParticipant[];
}

/**
 * Turns parsed chat entries into a new expense. Any entry whose name doesn't match an
 * existing participant becomes a new participant automatically, so a paste alone is
 * enough to get a usable result without a separate manual-resolution step.
 */
export function applyParsedEntries(
  state: AppState,
  entries: ParsedEntry[],
  generateId: () => string,
  description = 'Pasted expense',
): ApplyParsedEntriesResult {
  const participants = [...state.participants];
  const addedParticipants: StateParticipant[] = [];

  const { matched, unmatched } = matchToParticipants(entries, participants);
  const paidBy: StatePayment[] = [...matched];

  for (const entry of unmatched) {
    const newParticipant: StateParticipant = { id: generateId(), name: entry.name };
    participants.push(newParticipant);
    addedParticipants.push(newParticipant);
    paidBy.push({ participantId: newParticipant.id, amountCents: entry.amountCents });
  }

  const expense: StateExpense = { id: generateId(), description, paidBy };

  return {
    state: { ...state, participants, expenses: [...state.expenses, expense] },
    expense,
    addedParticipants,
  };
}

const STORAGE_KEY = 'share-calculator:state:v1';

export function saveState(state: AppState, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState(storage: Pick<Storage, 'getItem'> = localStorage): AppState | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}
