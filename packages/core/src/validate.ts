import { ValidationError } from './errors.js';
import type { CalculationInput } from './types.js';

export function validateInput(input: CalculationInput): void {
  const participantIds = new Set(input.participants.map((p) => p.id));
  if (participantIds.size !== input.participants.length) {
    throw new ValidationError('Duplicate participant id found.');
  }
  for (const p of input.participants) {
    if (p.weight !== undefined && !(p.weight > 0)) {
      throw new ValidationError(`Participant "${p.id}" has a non-positive weight.`);
    }
  }

  const expenseIds = new Set(input.expenses.map((e) => e.id));
  if (expenseIds.size !== input.expenses.length) {
    throw new ValidationError('Duplicate expense id found.');
  }

  for (const expense of input.expenses) {
    if (!Number.isInteger(expense.amountCents) || expense.amountCents < 0) {
      throw new ValidationError(`Expense "${expense.id}" has an invalid amountCents.`);
    }
    if (expense.participantIds) {
      for (const id of expense.participantIds) {
        if (!participantIds.has(id)) {
          throw new ValidationError(
            `Expense "${expense.id}" references unknown participant "${id}".`,
          );
        }
      }
      if (expense.participantIds.length === 0) {
        throw new ValidationError(`Expense "${expense.id}" has an empty participant list.`);
      }
    }
    let paidSum = 0;
    for (const payment of expense.paidBy) {
      if (!participantIds.has(payment.participantId)) {
        throw new ValidationError(
          `Expense "${expense.id}" paidBy references unknown participant "${payment.participantId}".`,
        );
      }
      if (!Number.isInteger(payment.amountCents) || payment.amountCents < 0) {
        throw new ValidationError(
          `Expense "${expense.id}" has an invalid paidBy amount for "${payment.participantId}".`,
        );
      }
      paidSum += payment.amountCents;
    }
    if (paidSum !== expense.amountCents) {
      throw new ValidationError(
        `Expense "${expense.id}": paidBy sums to ${paidSum} cents but amountCents is ${expense.amountCents}.`,
      );
    }
  }

  for (const exception of input.exceptions ?? []) {
    if (!participantIds.has(exception.participantId)) {
      throw new ValidationError(
        `Exception references unknown participant "${exception.participantId}".`,
      );
    }
    if (exception.scope !== 'global' && !expenseIds.has(exception.scope)) {
      throw new ValidationError(
        `Exception for "${exception.participantId}" references unknown expense scope "${exception.scope}".`,
      );
    }
    if (exception.kind === 'capped' || exception.kind === 'fixed') {
      if (
        exception.amountCents === undefined ||
        !Number.isInteger(exception.amountCents) ||
        exception.amountCents < 0
      ) {
        throw new ValidationError(
          `Exception for "${exception.participantId}" (${exception.kind}) requires a valid non-negative amountCents.`,
        );
      }
    }
  }
}
