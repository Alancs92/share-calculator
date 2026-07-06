import {
  calculate,
  formatTable,
  formatWhatsApp,
  matchToParticipants,
  parseChatText,
  type CalculationInput,
  type Participant,
} from '@share-calculator/core';

export type OutputFormat = 'json' | 'table' | 'whatsapp';

export interface CalculateOptions {
  format?: OutputFormat;
  currencySymbol?: string;
}

/** Parses a JSON CalculationInput and returns rendered output as a string. Throws on invalid input. */
export function runCalculate(rawInput: string, options: CalculateOptions = {}): string {
  let input: CalculationInput;
  try {
    input = JSON.parse(rawInput) as CalculationInput;
  } catch (err) {
    throw new Error(`Invalid JSON input: ${(err as Error).message}`);
  }

  const result = calculate(input);
  const currencySymbol = options.currencySymbol ?? '$';

  switch (options.format ?? 'json') {
    case 'table':
      return formatTable(result, { currencySymbol });
    case 'whatsapp':
      return formatWhatsApp(result, { currencySymbol });
    case 'json':
      return JSON.stringify(result, null, 2);
    default:
      throw new Error(`Unknown format: ${String(options.format)}`);
  }
}

/** Parses freeform chat text, optionally matching against a participants JSON array, returns JSON. */
export function runParse(rawText: string, participantsRaw?: string): string {
  const result = parseChatText(rawText);

  if (participantsRaw === undefined) {
    return JSON.stringify(result, null, 2);
  }

  let participants: Participant[];
  try {
    participants = JSON.parse(participantsRaw) as Participant[];
  } catch (err) {
    throw new Error(`Invalid participants JSON: ${(err as Error).message}`);
  }

  const { matched, unmatched } = matchToParticipants(result.entries, participants);
  return JSON.stringify({ matched, unmatched, unparsedLines: result.unparsedLines }, null, 2);
}
