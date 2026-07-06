export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Raised when caps on the remaining participants can't cover what's left to distribute. */
export class UnderfundedExpenseError extends Error {
  constructor(
    public readonly expenseId: string,
    public readonly shortfallCents: number,
  ) {
    super(
      `Expense "${expenseId}" is underfunded by ${shortfallCents} cents: ` +
        `remaining participants' caps do not cover the full amount.`,
    );
    this.name = 'UnderfundedExpenseError';
  }
}

/** Raised when fixed contributions alone already exceed the expense total. */
export class OverCommittedExpenseError extends Error {
  constructor(
    public readonly expenseId: string,
    public readonly excessCents: number,
  ) {
    super(
      `Expense "${expenseId}" is over-committed by ${excessCents} cents: ` +
        `fixed contributions alone exceed the expense amount.`,
    );
    this.name = 'OverCommittedExpenseError';
  }
}
