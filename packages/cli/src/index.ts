#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { runCalculate, runParse, type OutputFormat } from './commands.js';

function readInput(filePath: string | undefined): string {
  return readFileSync(filePath ?? 0, 'utf-8');
}

const program = new Command();
program.name('share-calc').description('Share calculator CLI').version('0.1.0');

program
  .command('calculate')
  .description(
    'Compute the per-person share breakdown from a JSON calculation input ' +
      '({ participants, expenses, exceptions })',
  )
  .option('-i, --input <file>', 'Path to the JSON input file. Reads stdin if omitted.')
  .option('-f, --format <format>', 'Output format: json | table | whatsapp', 'json')
  .option('--currency-symbol <symbol>', 'Currency symbol for table/whatsapp output', '$')
  .action((opts: { input?: string; format: string; currencySymbol: string }) => {
    try {
      const output = runCalculate(readInput(opts.input), {
        format: opts.format as OutputFormat,
        currencySymbol: opts.currencySymbol,
      });
      console.log(output);
    } catch (err) {
      console.error((err as Error).message);
      process.exitCode = 1;
    }
  });

program
  .command('parse')
  .description('Parse freeform pasted chat text into name/amount entries')
  .option('-t, --text <text>', 'Raw text to parse. Reads stdin if omitted.')
  .option(
    '-p, --participants <file>',
    'JSON file with a participants array to match parsed names against',
  )
  .action((opts: { text?: string; participants?: string }) => {
    try {
      const text = opts.text ?? readInput(undefined);
      const participantsRaw = opts.participants ? readFileSync(opts.participants, 'utf-8') : undefined;
      console.log(runParse(text, participantsRaw));
    } catch (err) {
      console.error((err as Error).message);
      process.exitCode = 1;
    }
  });

program.parse();
