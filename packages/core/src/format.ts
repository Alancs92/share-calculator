import type { CalculationResult, ParticipantBreakdown } from './types.js';

export interface FormatOptions {
  /** Prefix for formatted amounts, e.g. "$". Defaults to "$". */
  currencySymbol?: string;
}

export interface TableRow {
  name: string;
  paid: string;
  share: string;
  net: string;
  status: 'owes' | 'is owed' | 'settled';
}

function centsToDisplay(cents: number, symbol: string): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${symbol}${(abs / 100).toFixed(2)}`;
}

function statusOf(p: ParticipantBreakdown): TableRow['status'] {
  if (p.netCents > 0) return 'is owed';
  if (p.netCents < 0) return 'owes';
  return 'settled';
}

export function toTableRows(result: CalculationResult, options: FormatOptions = {}): TableRow[] {
  const symbol = options.currencySymbol ?? '$';
  return result.participants.map((p) => ({
    name: p.name,
    paid: centsToDisplay(p.totalPaidCents, symbol),
    share: centsToDisplay(p.totalShareCents, symbol),
    net: centsToDisplay(p.netCents, symbol),
    status: statusOf(p),
  }));
}

/** Renders a plain-text, fixed-width table suitable for a terminal. */
export function formatTable(result: CalculationResult, options: FormatOptions = {}): string {
  const rows = toTableRows(result, options);
  const headers = ['Name', 'Paid', 'Share', 'Net', 'Status'];
  const widths = [0, 1, 2, 3, 4].map((col) => {
    const values = [
      headers[col]!,
      ...rows.map((r) => [r.name, r.paid, r.share, r.net, r.status][col]!),
    ];
    return Math.max(...values.map((v) => v.length));
  });

  const pad = (value: string, width: number): string => value.padEnd(width, ' ');
  const line = (cells: string[]): string => cells.map((c, i) => pad(c, widths[i]!)).join('  ');

  const lines = [
    line(headers),
    widths.map((w) => '-'.repeat(w)).join('  '),
    ...rows.map((r) => line([r.name, r.paid, r.share, r.net, r.status])),
  ];
  return lines.join('\n');
}

/** Renders a compact plain-text summary formatted for pasting into a chat. */
export function formatWhatsApp(result: CalculationResult, options: FormatOptions = {}): string {
  const symbol = options.currencySymbol ?? '$';
  const lines = ['*Share calculation*', ''];
  for (const p of result.participants) {
    const net = centsToDisplay(Math.abs(p.netCents), symbol);
    if (p.netCents > 0) {
      lines.push(`${p.name}: is owed ${net}`);
    } else if (p.netCents < 0) {
      lines.push(`${p.name}: owes ${net}`);
    } else {
      lines.push(`${p.name}: settled`);
    }
  }
  lines.push('', `Total: ${centsToDisplay(result.totalAmountCents, symbol)}`);
  return lines.join('\n');
}
