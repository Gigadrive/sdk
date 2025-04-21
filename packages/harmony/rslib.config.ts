import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.scss'],
    tsconfigPath: './tsconfig.build.json',
  },
  lib: [
    {
      bundle: false,
      dts: true,
      format: 'esm',
    },
    {
      bundle: false,
      dts: true,
      format: 'cjs',
    },
  ],
  output: {
    target: 'web',
  },
  plugins: [pluginReact(), pluginSass()],
});
