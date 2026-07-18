import { tsupDefaults } from '@local/tsup';

export default {
  ...tsupDefaults,
  cjsInterop: true,
  format: ['cjs', 'esm'],
  entry: {
    index: 'src/index.ts',
    'nextjs-adapter': 'src/nextjs-adapter.ts',
  },
};
