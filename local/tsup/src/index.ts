/**
 * Original source: https://github.com/FuelLabs/fuels-ts/blob/a071dceabccc867f28c8a6d455749522e83ecbfd/internal/tsup/src/index.ts
 */

/**
 * [NOTE]
 * Due to the limitations of TSUP regarding config inheritance, we
 * exports ready-to-go configurations for most used scenarios in the
 * monorepo. More complex configs can be done in isolation.
 */

import fs from 'fs';
import path from 'path';
import type { Options } from 'tsup';

// Get all dependencies to mark as external
const getExternalDependencies = (): string[] => {
  try {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Collect all dependencies from package.json
    const allDeps = [
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}),
      ...Object.keys(packageJson.peerDependencies || {}),
    ];

    console.log('External dependencies:', allDeps);

    return allDeps;
  } catch (error) {
    console.warn('Could not determine dependencies:', error);
    return [];
  }
};

export const tsupDefaults: Options = {
  clean: true,
  dts: true,
  format: ['cjs', 'esm', 'iife'],
  minify: false,
  sourcemap: true,
  splitting: false,
  external: getExternalDependencies(),
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.js',
    };
  },
};

export const index: Options = {
  ...tsupDefaults,
  entry: {
    index: 'src/index.ts',
  },
};

export const indexAndConfigs: Options = {
  ...tsupDefaults,
  entry: {
    index: 'src/index.ts',
    configs: 'src/configs.ts',
  },
};

export const indexBinAndCliConfig: Options = {
  ...tsupDefaults,
  entry: {
    index: 'src/index.ts',
    bin: 'src/bin.ts',
    cli: 'src/cli.ts',
  },
};

export const binAndCli: Options = {
  ...tsupDefaults,
  entry: {
    bin: 'src/bin.ts',
    cli: 'src/cli.ts',
  },
};
