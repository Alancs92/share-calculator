import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';

export const VERSION = '0.1.0';

export const USAGE = `share-calc ${VERSION} — split shared expenses

Usage:
  share-calc calculate [options]
  share-calc parse [options]

Commands:
  calculate   Compute the per-person share breakdown from a JSON calculation
              input ({ participants, expenses, exceptions }).
    -i, --input <file>           Path to the JSON input file. Reads stdin if omitted.
    -f, --format <format>        Output format: json | table | whatsapp (default: json)
        --currency-symbol <sym>  Currency symbol for table/whatsapp output (default: $)

  parse       Parse freeform pasted chat text into name/amount entries.
    -t, --text <text>            Raw text to parse. Reads stdin if omitted.
    -p, --participants <file>    JSON file with a participants array to match
                                 parsed names against.

Global options:
  -h, --help      Show this help.
  -V, --version   Show the version.
`;

/** Thrown for anything the user can fix by re-typing the command. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export type ParsedCommand =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'calculate'; input: string | undefined; format: string; currencySymbol: string }
  | { kind: 'parse'; text: string | undefined; participants: string | undefined };

const HELP_OPTION = { type: 'boolean', short: 'h' } as const;

function parseOptions<T extends ParseArgsOptionsConfig>(args: string[], options: T) {
  try {
    return parseArgs({ args, options, strict: true, allowPositionals: false }).values;
  } catch (err) {
    throw new UsageError((err as Error).message);
  }
}

/**
 * Turns raw argv (without the node/script entries) into a command description.
 * Pure — does no I/O — so the whole surface is unit-testable.
 */
export function parseCliArgs(argv: string[]): ParsedCommand {
  const [command, ...rest] = argv;

  switch (command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      return { kind: 'help' };

    case 'version':
    case '--version':
    case '-V':
      return { kind: 'version' };

    case 'calculate': {
      const values = parseOptions(rest, {
        input: { type: 'string', short: 'i' },
        format: { type: 'string', short: 'f' },
        'currency-symbol': { type: 'string' },
        help: HELP_OPTION,
      });
      if (values.help === true) return { kind: 'help' };
      return {
        kind: 'calculate',
        input: values.input,
        format: values.format ?? 'json',
        currencySymbol: values['currency-symbol'] ?? '$',
      };
    }

    case 'parse': {
      const values = parseOptions(rest, {
        text: { type: 'string', short: 't' },
        participants: { type: 'string', short: 'p' },
        help: HELP_OPTION,
      });
      if (values.help === true) return { kind: 'help' };
      return { kind: 'parse', text: values.text, participants: values.participants };
    }

    default:
      throw new UsageError(`Unknown command: ${command}`);
  }
}
