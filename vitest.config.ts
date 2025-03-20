import { config } from 'dotenv';
import path from 'path';
import { defineConfig } from 'vite';
import type { UserConfig as VitestUserConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';

declare module 'vite' {
  export interface UserConfig {
    test: VitestUserConfig['test'];
  }
}

export default defineConfig({
  test: {
    passWithNoTests: true,
    coverage: {
      enabled: true,
      provider: 'istanbul',
      reporter: ['html', 'json-summary', 'json'],
      reportOnFailure: true,
      exclude: ['examples/**', '**/node_modules/**', '**/*.test.ts'],
      include: ['apps/**/*.ts', 'packages/**/*.ts', 'services/**/*.ts', 'tests/**/*.ts'],
    },
    env: {
      ...config({ path: path.join(__dirname, '.env') }).parsed,
    },
    exclude: [...configDefaults.exclude, 'examples/**', '**/node_modules/**'],
  },
});
