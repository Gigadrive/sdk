import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
    },
    tsconfigPath: './tsconfig.json',
  },
  lib: [
    {
      bundle: true,
      dts: true,
      format: 'esm',
    },
    {
      bundle: true,
      dts: true,
      format: 'cjs',
    },
  ],
  output: {
    target: 'web',
  },
  plugins: [pluginReact(), pluginSass()],
});
