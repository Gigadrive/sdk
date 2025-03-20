import { index } from '@local/tsup';

export default {
  ...index,
  format: ['cjs', 'esm'],
  banner: {
    js: '#!/usr/bin/env node',
  },
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    };
  },
};
