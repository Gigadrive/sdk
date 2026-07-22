import { tsupDefaults } from '@local/tsup';

export default {
  ...tsupDefaults,
  cjsInterop: true,
  format: ['cjs', 'esm'],
  entry: {
    index: 'src/index.ts',
    'nextjs-adapter': 'src/nextjs-adapter.ts',
    'nextjs-cache-handler': 'src/nextjs-cache-handler.ts',
    'nextjs-cache-components-handler': 'src/nextjs-cache-components-handler.ts',
    'nextjs-image-loader': 'src/nextjs-image-loader.ts',
    'nextjs-ppr-runtime': 'src/nextjs-ppr-runtime.ts',
  },
};
