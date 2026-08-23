import plugin from 'tailwindcss/plugin';

/**
 * Tailwind v3 port of shadcn's CSS-only `scroll-fade` utilities.
 *
 * Upstream ships these as Tailwind v4 `@utility` rules in `shadcn/tailwind.css`.
 * Harmony is on Tailwind v3, so we re-express the same API as a plugin.
 * `@property` registrations and reveal keyframes live in `src/index.css` /
 * `src/theme.css` (Tailwind v3 cannot emit `@property` reliably via `addBase`).
 *
 * @see https://ui.shadcn.com/docs/utils/scroll-fade
 */
const DEFAULT_SIZE = 'min(12%, 2.5rem)';
const DEFAULT_REVEAL = '6rem';

const sizeVar = (edge?: 't' | 'b' | 's' | 'e') => {
  if (!edge) {
    return `var(--scroll-fade-size, ${DEFAULT_SIZE})`;
  }
  return `var(--scroll-fade-${edge}-size, var(--scroll-fade-size, ${DEFAULT_SIZE}))`;
};

const revealVar = `var(--scroll-fade-reveal, ${DEFAULT_REVEAL})`;

const maskBase = {
  '-webkit-mask-composite': 'source-in',
  'mask-composite': 'intersect',
  '-webkit-mask-repeat': 'no-repeat',
  'mask-repeat': 'no-repeat',
} as const;

export const scrollFadePlugin = plugin((api) => {
  const blockFade = {
    '--_scroll-fade-size-t': sizeVar('t'),
    '--_scroll-fade-size-b': sizeVar('b'),
    '--scroll-fade-block': `linear-gradient(to bottom, transparent 0, #000 var(--scroll-fade-t, 0px), #000 calc(100% - var(--scroll-fade-b, 0px)), transparent 100%)`,
    '-webkit-mask-image': 'var(--scroll-fade-mask, var(--scroll-fade-block))',
    'mask-image': 'var(--scroll-fade-mask, var(--scroll-fade-block))',
    ...maskBase,
    '@supports (animation-timeline: scroll())': {
      animation: 'scroll-fade-reveal-t 1ms ease-in-out, scroll-fade-reveal-b 1ms ease-in-out',
      'animation-timeline': 'scroll(self y), scroll(self y)',
      'animation-range': `0 ${revealVar}, calc(100% - ${revealVar}) 100%`,
      'animation-fill-mode': 'both',
    },
    '@supports not (animation-timeline: scroll())': {
      '--scroll-fade-t': 'var(--_scroll-fade-size-t)',
      '--scroll-fade-b': 'var(--_scroll-fade-size-b)',
    },
  };

  api.addUtilities({
    '.scroll-fade': blockFade,
    '.scroll-fade-y': blockFade,
    '.scroll-fade-x': {
      '--_scroll-fade-size-s': sizeVar('s'),
      '--_scroll-fade-size-e': sizeVar('e'),
      '--scroll-fade-inline': `linear-gradient(to right, transparent 0, #000 var(--scroll-fade-s, 0px), #000 calc(100% - var(--scroll-fade-e, 0px)), transparent 100%)`,
      '-webkit-mask-image': 'var(--scroll-fade-mask, var(--scroll-fade-inline))',
      'mask-image': 'var(--scroll-fade-mask, var(--scroll-fade-inline))',
      ...maskBase,
      '&:where([dir="rtl"], [dir="rtl"] *)': {
        '--scroll-fade-inline': `linear-gradient(to left, transparent 0, #000 var(--scroll-fade-s, 0px), #000 calc(100% - var(--scroll-fade-e, 0px)), transparent 100%)`,
      },
      '@supports (animation-timeline: scroll())': {
        animation: 'scroll-fade-reveal-s 1ms ease-in-out, scroll-fade-reveal-e 1ms ease-in-out',
        'animation-timeline': 'scroll(self inline), scroll(self inline)',
        'animation-range': `0 ${revealVar}, calc(100% - ${revealVar}) 100%`,
        'animation-fill-mode': 'both',
      },
      '@supports not (animation-timeline: scroll())': {
        '--scroll-fade-s': 'var(--_scroll-fade-size-s)',
        '--scroll-fade-e': 'var(--_scroll-fade-size-e)',
      },
    },
    '.scroll-fade-t': {
      '--_scroll-fade-size-t': sizeVar('t'),
      '--scroll-fade-mask': `linear-gradient(to bottom, transparent 0, #000 var(--scroll-fade-t, 0px), #000 100%)`,
      '-webkit-mask-image': 'var(--scroll-fade-mask)',
      'mask-image': 'var(--scroll-fade-mask)',
      ...maskBase,
      '@supports (animation-timeline: scroll())': {
        animation: 'scroll-fade-reveal-t 1ms ease-in-out',
        'animation-timeline': 'scroll(self y)',
        'animation-range': `0 ${revealVar}`,
        'animation-fill-mode': 'both',
      },
      '@supports not (animation-timeline: scroll())': {
        '--scroll-fade-t': 'var(--_scroll-fade-size-t)',
      },
    },
    '.scroll-fade-b': {
      '--_scroll-fade-size-b': sizeVar('b'),
      '--scroll-fade-mask': `linear-gradient(to bottom, #000 0, #000 calc(100% - var(--scroll-fade-b, 0px)), transparent 100%)`,
      '-webkit-mask-image': 'var(--scroll-fade-mask)',
      'mask-image': 'var(--scroll-fade-mask)',
      ...maskBase,
      '@supports (animation-timeline: scroll())': {
        animation: 'scroll-fade-reveal-b 1ms ease-in-out',
        'animation-timeline': 'scroll(self y)',
        'animation-range': `calc(100% - ${revealVar}) 100%`,
        'animation-fill-mode': 'both',
      },
      '@supports not (animation-timeline: scroll())': {
        '--scroll-fade-b': 'var(--_scroll-fade-size-b)',
      },
    },
    '.scroll-fade-l': {
      '--_scroll-fade-size-s': sizeVar('s'),
      '--scroll-fade-mask': `linear-gradient(to right, transparent 0, #000 var(--scroll-fade-s, 0px), #000 100%)`,
      '-webkit-mask-image': 'var(--scroll-fade-mask)',
      'mask-image': 'var(--scroll-fade-mask)',
      ...maskBase,
      '@supports (animation-timeline: scroll())': {
        animation: 'scroll-fade-reveal-s 1ms ease-in-out',
        'animation-timeline': 'scroll(self x)',
        'animation-range': `0 ${revealVar}`,
        'animation-fill-mode': 'both',
      },
      '@supports not (animation-timeline: scroll())': {
        '--scroll-fade-s': 'var(--_scroll-fade-size-s)',
      },
    },
    '.scroll-fade-r': {
      '--_scroll-fade-size-e': sizeVar('e'),
      '--scroll-fade-mask': `linear-gradient(to right, #000 0, #000 calc(100% - var(--scroll-fade-e, 0px)), transparent 100%)`,
      '-webkit-mask-image': 'var(--scroll-fade-mask)',
      'mask-image': 'var(--scroll-fade-mask)',
      ...maskBase,
      '@supports (animation-timeline: scroll())': {
        animation: 'scroll-fade-reveal-e 1ms ease-in-out',
        'animation-timeline': 'scroll(self x)',
        'animation-range': `calc(100% - ${revealVar}) 100%`,
        'animation-fill-mode': 'both',
      },
      '@supports not (animation-timeline: scroll())': {
        '--scroll-fade-e': 'var(--_scroll-fade-size-e)',
      },
    },
    '.scroll-fade-s': {
      '--_scroll-fade-size-s': sizeVar('s'),
      '--scroll-fade-mask': `linear-gradient(to right, transparent 0, #000 var(--scroll-fade-s, 0px), #000 100%)`,
      '-webkit-mask-image': 'var(--scroll-fade-mask)',
      'mask-image': 'var(--scroll-fade-mask)',
      ...maskBase,
      '&:where([dir="rtl"], [dir="rtl"] *)': {
        '--scroll-fade-mask': `linear-gradient(to left, transparent 0, #000 var(--scroll-fade-s, 0px), #000 100%)`,
      },
      '@supports (animation-timeline: scroll())': {
        animation: 'scroll-fade-reveal-s 1ms ease-in-out',
        'animation-timeline': 'scroll(self inline)',
        'animation-range': `0 ${revealVar}`,
        'animation-fill-mode': 'both',
      },
      '@supports not (animation-timeline: scroll())': {
        '--scroll-fade-s': 'var(--_scroll-fade-size-s)',
      },
    },
    '.scroll-fade-e': {
      '--_scroll-fade-size-e': sizeVar('e'),
      '--scroll-fade-mask': `linear-gradient(to right, #000 0, #000 calc(100% - var(--scroll-fade-e, 0px)), transparent 100%)`,
      '-webkit-mask-image': 'var(--scroll-fade-mask)',
      'mask-image': 'var(--scroll-fade-mask)',
      ...maskBase,
      '&:where([dir="rtl"], [dir="rtl"] *)': {
        '--scroll-fade-mask': `linear-gradient(to left, #000 0, #000 calc(100% - var(--scroll-fade-e, 0px)), transparent 100%)`,
      },
      '@supports (animation-timeline: scroll())': {
        animation: 'scroll-fade-reveal-e 1ms ease-in-out',
        'animation-timeline': 'scroll(self inline)',
        'animation-range': `calc(100% - ${revealVar}) 100%`,
        'animation-fill-mode': 'both',
      },
      '@supports not (animation-timeline: scroll())': {
        '--scroll-fade-e': 'var(--_scroll-fade-size-e)',
      },
    },
    '.scroll-fade-none': {
      '--scroll-fade-mask': 'none',
    },
    '.no-scrollbar': {
      '-ms-overflow-style': 'none',
      'scrollbar-width': 'none',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
    },
  });

  const spacing = api.theme('spacing');

  api.matchUtilities(
    {
      'scroll-fade': (value) => ({ '--scroll-fade-size': value }),
      'scroll-fade-t': (value) => ({ '--scroll-fade-t-size': value }),
      'scroll-fade-b': (value) => ({ '--scroll-fade-b-size': value }),
      'scroll-fade-s': (value) => ({ '--scroll-fade-s-size': value }),
      'scroll-fade-e': (value) => ({ '--scroll-fade-e-size': value }),
    },
    {
      values: spacing,
      supportsNegativeValues: false,
      type: ['length', 'percentage'],
    }
  );
});

export default scrollFadePlugin;
