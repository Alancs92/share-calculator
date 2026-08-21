import { readFileSync } from 'node:fs';
import { parseCliArgs, USAGE, UsageError, VERSION } from './args.js';
import { runCalculate, runParse, type OutputFormat } from './commands.js';

/** Where the CLI writes to. Injectable so tests don't have to capture the console. */
export interface CliIO {
  out: (line: string) => void;
  err: (line: string) => void;
  readFile: (path: string | 0) => string;
}

export const defaultIO: CliIO = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
  readFile: (path) => readFileSync(path, 'utf-8'),
};

/** Runs the CLI for the given argv (without the node/script entries) and returns the exit code. */
export function main(argv: string[], io: CliIO = defaultIO): number {
  try {
    const command = parseCliArgs(argv);

    switch (command.kind) {
      case 'help':
        io.out(USAGE);
        return 0;

      case 'version':
        io.out(VERSION);
        return 0;

      case 'calculate':
        io.out(
          runCalculate(io.readFile(command.input ?? 0), {
            format: command.format as OutputFormat,
            currencySymbol: command.currencySymbol,
          }),
        );
        return 0;

      case 'parse': {
        const text = command.text ?? io.readFile(0);
        const participants =
          command.participants === undefined ? undefined : io.readFile(command.participants);
        io.out(runParse(text, participants));
        return 0;
      }
    }
  } catch (err) {
    io.err((err as Error).message);
    if (err instanceof UsageError) io.err('\nRun `share-calc --help` for usage.');
    return 1;
  }
}
