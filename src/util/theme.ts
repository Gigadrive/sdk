import { defaultTheme, extendTheme } from '@inkjs/ui';
import type { TextProps } from 'ink';

export const theme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: (): TextProps => ({
          color: 'green',
        }),
      },
    },
  },
});
