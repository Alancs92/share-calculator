export type ParticipantId = string;
export type ExpenseId = string;

export interface Participant {
  id: ParticipantId;
  name: string;
  /** Relative share size. Defaults to 1 (even split) if omitted. */
  weight?: number;
}

/** 'global' applies to every expense; an expense id scopes it to just that expense. */
export type ExceptionScope = 'global' | ExpenseId;
export type ExceptionKind = 'excluded' | 'capped' | 'fixed';

export interface Exception {
  participantId: ParticipantId;
  scope: ExceptionScope;
  kind: ExceptionKind;
  /** Required for 'capped' and 'fixed', ignored for 'excluded'. */
  amountCents?: number;
}

export interface ExpensePayment {
  participantId: ParticipantId;
  amountCents: number;
}

export interface Expense {
  id: ExpenseId;
  description?: string;
  amountCents: number;
  paidBy: ExpensePayment[];
  /** Who this expense is split among. Defaults to all participants. */
  participantIds?: ParticipantId[];
}

export interface CalculationInput {
  participants: Participant[];
  expenses: Expense[];
  exceptions?: Exception[];
}

export interface ParticipantBreakdown {
  participantId: ParticipantId;
  name: string;
  totalPaidCents: number;
  totalShareCents: number;
  /** paid - share. Positive: owed money. Negative: owes money. */
  netCents: number;
}

export interface CalculationResult {
  participants: ParticipantBreakdown[];
  totalAmountCents: number;
}
