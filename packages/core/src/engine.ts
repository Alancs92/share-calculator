import { OverCommittedExpenseError, UnderfundedExpenseError } from './errors.js';
import type {
  CalculationInput,
  CalculationResult,
  Exception,
  Expense,
  Participant,
  ParticipantBreakdown,
  ParticipantId,
} from './types.js';
import { validateInput } from './validate.js';

/** Cross-multiplication tolerance for weight-ratio comparisons against integer caps. */
const EPSILON = 1e-9;

type EffectiveException = Exception | undefined;

function effectiveExceptionFor(
  participantId: ParticipantId,
  expenseId: string,
  exceptions: Exception[],
): EffectiveException {
  const scoped = exceptions.find(
    (e) => e.participantId === participantId && e.scope === expenseId,
  );
  if (scoped) return scoped;
  return exceptions.find((e) => e.participantId === participantId && e.scope === 'global');
}

/** Splits a single expense's amount among its applicable participants. Returns cents per participant id. */
export function splitExpense(
  expense: Expense,
  participants: Participant[],
  exceptions: Exception[],
): Map<ParticipantId, number> {
  const candidateIds = expense.participantIds ?? participants.map((p) => p.id);
  const weightById = new Map(participants.map((p) => [p.id, p.weight ?? 1]));

  const shares = new Map<ParticipantId, number>();
  let remaining = expense.amountCents;

  // Fixed contributions are resolved first and removed from the pool entirely.
  const pool: Array<{ id: ParticipantId; weight: number; capCents: number | undefined }> = [];
  for (const id of candidateIds) {
    const exception = effectiveExceptionFor(id, expense.id, exceptions);
    if (exception?.kind === 'excluded') {
      continue;
    }
    if (exception?.kind === 'fixed') {
      const amount = exception.amountCents ?? 0;
      shares.set(id, amount);
      remaining -= amount;
      continue;
    }
    const capCents = exception?.kind === 'capped' ? exception.amountCents : undefined;
    pool.push({ id, weight: weightById.get(id) ?? 1, capCents });
  }

  if (remaining < 0) {
    throw new OverCommittedExpenseError(expense.id, -remaining);
  }

  // Waterfall: repeatedly peel off anyone whose proportional share would exceed their cap,
  // fixing them at exactly their cap and folding the excess back into what's left to split.
  let changed = true;
  while (changed) {
    changed = false;
    if (pool.length === 0) {
      break;
    }
    const sumWeights = pool.reduce((sum, p) => sum + p.weight, 0);
    for (let i = pool.length - 1; i >= 0; i -= 1) {
      const p = pool[i];
      if (p === undefined || p.capCents === undefined) continue;
      // p.weight/sumWeights * remaining > capCents, compared via cross-multiplication.
      if (p.weight * remaining > p.capCents * sumWeights + EPSILON) {
        shares.set(p.id, p.capCents);
        remaining -= p.capCents;
        pool.splice(i, 1);
        changed = true;
      }
    }
  }

  if (pool.length === 0) {
    if (remaining > 0) {
      throw new UnderfundedExpenseError(expense.id, remaining);
    }
    return shares;
  }

  // Final rounding for the remaining unconstrained pool: floor then distribute the
  // leftover cents one at a time by largest fractional remainder, tie-broken by id.
  const sumWeights = pool.reduce((sum, p) => sum + p.weight, 0);
  const floors = pool.map((p) => {
    const raw = (p.weight * remaining) / sumWeights;
    const floor = Math.floor(raw);
    return { id: p.id, floor, remainder: raw - floor };
  });
  const distributed = floors.reduce((sum, f) => sum + f.floor, 0);
  let leftover = remaining - distributed;

  const byRemainderDesc = [...floors].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const bonus = new Set<ParticipantId>();
  for (const f of byRemainderDesc) {
    if (leftover <= 0) break;
    bonus.add(f.id);
    leftover -= 1;
  }

  for (const f of floors) {
    shares.set(f.id, f.floor + (bonus.has(f.id) ? 1 : 0));
  }

  return shares;
}

export function calculate(input: CalculationInput): CalculationResult {
  validateInput(input);
  const exceptions = input.exceptions ?? [];

  const totalShare = new Map<ParticipantId, number>(input.participants.map((p) => [p.id, 0]));
  const totalPaid = new Map<ParticipantId, number>(input.participants.map((p) => [p.id, 0]));

  for (const expense of input.expenses) {
    const shares = splitExpense(expense, input.participants, exceptions);
    for (const [participantId, cents] of shares) {
      totalShare.set(participantId, (totalShare.get(participantId) ?? 0) + cents);
    }
    for (const payment of expense.paidBy) {
      totalPaid.set(
        payment.participantId,
        (totalPaid.get(payment.participantId) ?? 0) + payment.amountCents,
      );
    }
  }

  const participants: ParticipantBreakdown[] = input.participants.map((p) => {
    const totalPaidCents = totalPaid.get(p.id) ?? 0;
    const totalShareCents = totalShare.get(p.id) ?? 0;
    return {
      participantId: p.id,
      name: p.name,
      totalPaidCents,
      totalShareCents,
      netCents: totalPaidCents - totalShareCents,
    };
  });

  const totalAmountCents = input.expenses.reduce((sum, e) => sum + e.amountCents, 0);

  return { participants, totalAmountCents };
}
