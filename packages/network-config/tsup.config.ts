import { tsupDefaults } from '@local/tsup';

export default [
  {
    ...tsupDefaults,
    cjsInterop: true,
    format: ['cjs', 'esm'],
    // The published CJS entry must not delegate to the legacy IIFE-shaped CJS
    // artifacts of these workspace dependencies. Bundling the two utilities
    // keeps both real-file `require()` and ESM import consumers functional.
    noExternal: ['@gigadrive/build-utils', '@gigadrive/commons'],
    entry: {
      index: 'src/index.ts',
      'nextjs-adapter': 'src/nextjs-adapter.ts',
      'nextjs-cache-handler': 'src/nextjs-cache-handler.ts',
      'nextjs-cache-components-handler': 'src/nextjs-cache-components-handler.ts',
      'nextjs-image-loader': 'src/nextjs-image-loader.ts',
    },
  },
  // Built as a separate config so its .d.ts stays self-contained: bundling it
  // with the other entries emits a shared dts chunk that imports the effect
  // peer dependencies, breaking `tsc` for consumers that use the
  // dependency-free /define-config subpath without those peers installed.
  {
    ...tsupDefaults,
    clean: false,
    cjsInterop: true,
    format: ['cjs', 'esm'],
    entry: {
      'define-config': 'src/define-config.ts',
    },
  },
];
