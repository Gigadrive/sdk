import type { Config } from 'tailwindcss';

import { harmonyPreset } from './src/tailwind/preset';

/**
 * Harmony's own Tailwind config consumes the shared preset so the library and
 * its consumers can never drift apart. Apps should do the same:
 * `presets: [harmonyPreset]` + their own `content` globs.
 */
const config = {
  presets: [harmonyPreset],
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './stories/**/*.{js,jsx,ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
} satisfies Config;

export default config;
