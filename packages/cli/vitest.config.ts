import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Tests run against core's TypeScript source directly, not its built dist/,
// so `npm test` works on a fresh checkout without requiring packages/core to
// be built first. Running the built CLI for real still resolves
// @share-calculator/core through node_modules -> packages/core/dist as usual.
export default defineConfig({
  resolve: {
    alias: {
      '@share-calculator/core': path.resolve(dirname, '../core/src/index.ts'),
    },
  },
});
