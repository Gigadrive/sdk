import { index } from '@local/tsup';

export default {
  ...index,
  format: ['cjs', 'esm'],
  // `src/index.ts` loads the CLI with a dynamic import, so `--version` answers
  // without loading it; splitting keeps that import a separate chunk.
  splitting: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    };
  },
};
