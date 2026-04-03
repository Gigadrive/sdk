import { withThemeByClassName } from '@storybook/addon-themes';
import { spyOn } from 'storybook/test';
import '../src/index.ts';
import '../src/theme.css';

/** @type { import('@storybook/react-vite').Preview } */
const preview = {
  parameters: {
    // actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      expanded: true,
      matchers: {
        date: /Date$/,
      },
    },
  },
  globalTypes: {
    darkMode: {
      defaultValue: false,
    },
    className: {
      defaultValue: 'dark',
    },
  },
};

export const decorators = [
  withThemeByClassName({
    themes: {
      light: 'light',
      dark: 'dark',
    },
    defaultTheme: 'light',
  }),
];

export default preview;

export const beforeEach = function beforeEach() {
  spyOn(console, 'log').mockName('console.log');
  spyOn(console, 'warn').mockName('console.warn');
  spyOn(console, 'error').mockName('console.error');
  spyOn(console, 'info').mockName('console.info');
  spyOn(console, 'debug').mockName('console.debug');
  spyOn(console, 'trace').mockName('console.trace');
  spyOn(console, 'count').mockName('console.count');
  spyOn(console, 'dir').mockName('console.dir');
  spyOn(console, 'assert').mockName('console.assert');
};
