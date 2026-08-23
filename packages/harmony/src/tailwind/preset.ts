import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
// Explicit .js extensions: tailwindcss@3 has no package.json `exports` map, so Node's
// ESM resolver cannot resolve extensionless subpaths from the built ESM artifact.
// defaultTheme is imported as a default (CJS named-export detection fails on it).
import colors from 'tailwindcss/colors.js';
import defaultTheme from 'tailwindcss/defaultTheme.js';

import { scrollFadePlugin } from './scroll-fade-plugin';

const { fontFamily: _fontFamily } = defaultTheme;

/**
 * Shared Tailwind preset for @gigadrive/harmony consumers.
 *
 * Usage in an app's tailwind.config.ts:
 *
 * ```ts
 * import { harmonyPreset } from '@gigadrive/harmony/tailwind-preset';
 *
 * export default {
 *   presets: [harmonyPreset],
 *   content: ['./src/**\/*.{ts,tsx}'],
 * } satisfies Config;
 * ```
 *
 * Contains everything except `content` globs: the token-driven color map
 * (including the semantic status colors backed by theme.css variables),
 * radius scale, fonts, keyframes and the harmony plugins. Apps should not
 * copy this configuration — extend on top of the preset instead.
 */
export const harmonyPreset = {
  // Class strategy with a `.light` escape hatch: `dark:` utilities apply to
  // descendants of `.dark` EXCEPT inside a nested `.light` panel (side-by-side
  // theme comparisons; pairs with the `:root, .light` token block in theme.css).
  // `:is(.dark *)` keeps the exact specificity of the stock class strategy;
  // the `:not(:where(...))` clause adds zero specificity.
  darkMode: ['variant', '&:is(.dark *):not(:where(.light) *)'],
  content: [],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Resist Sans Text', ..._fontFamily.sans],
        display: ['Resist Sans Display', 'Resist Sans Text', ..._fontFamily.sans],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          // Deprecated: prefer `bg-primary` (token) over the raw green scale.
          ...colors.green,
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          // Deprecated: prefer `bg-secondary` (token) over the raw slate scale.
          ...colors.slate,
          foreground: 'hsl(var(--secondary-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          soft: 'hsl(var(--success-soft))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          soft: 'hsl(var(--warning-soft))',
          // Vivid amber for solid fills (dots, meters, bars) — the DEFAULT is darkened
          // for text contrast in light mode and reads as ochre when used as a fill.
          fill: 'hsl(var(--warning-fill))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          soft: 'hsl(var(--danger-soft))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          soft: 'hsl(var(--info-soft))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        shine: {
          '100%': {
            left: '125%',
          },
        },
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        shine: 'shine 2s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      height: {
        font: '1em',
      },
      width: {
        font: '1em',
      },
      backgroundPosition: {
        'pos-0': '0% 0%',
        'pos-100': '100% 100%',
      },
    },
  },
  plugins: [forms, typography, animate, scrollFadePlugin],
  safelist: [
    {
      pattern: /^to-(\w+-600|\w+-700|\w+-100)$/,
    },
    {
      pattern: /^from-(\w+-300|\w+-700)$/,
    },
  ],
} satisfies Config;

export default harmonyPreset;
