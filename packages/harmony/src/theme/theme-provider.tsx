'use client';

import { useServerInsertedHTML } from 'next/navigation';
import * as React from 'react';
import type { Attribute, ThemeProviderProps } from './context';
import { ThemeContext } from './context';
import type { ThemeScriptProps } from './script';
import { getThemeScript } from './script';

const colorSchemes = ['light', 'dark'];
const MEDIA = '(prefers-color-scheme: dark)';
const isServer = typeof window === 'undefined';
const defaultThemes = ['light', 'dark'];

/**
 * First-party, `next-themes`-compatible theme provider. Toggles the theme class/`data-*`
 * attribute on `<html>`, persists to `localStorage`, resolves `system` via `prefers-color-scheme`,
 * and syncs across tabs.
 *
 * Unlike `next-themes`, the pre-hydration anti-FOUC script is injected via Next's
 * `useServerInsertedHTML` (see {@link ThemeScript}) so it lands in the SSR `<head>` and is never
 * part of the client React tree — avoiding React 19.2's "Encountered a script tag" warning.
 *
 * Mount this in the root layout (and keep `<html suppressHydrationWarning>`) so the script runs
 * before first paint.
 */
export const ThemeProvider = (props: ThemeProviderProps) => {
  const context = React.useContext(ThemeContext);

  // Ignore nested context providers, just passthrough children
  if (context) return <>{props.children}</>;
  return <Theme {...props} />;
};

const Theme = ({
  forcedTheme,
  disableTransitionOnChange = false,
  enableSystem = true,
  enableColorScheme = true,
  storageKey = 'theme',
  themes = defaultThemes,
  defaultTheme = enableSystem ? 'system' : 'light',
  attribute = 'class',
  value,
  children,
  nonce,
  scriptProps,
}: ThemeProviderProps) => {
  const [theme, setThemeState] = React.useState<string | undefined>(() => getTheme(storageKey, defaultTheme));
  const [resolvedTheme, setResolvedTheme] = React.useState<string | undefined>(() =>
    theme === 'system' ? getSystemTheme() : theme
  );
  const attrs = !value ? themes : Object.values(value);

  // The callbacks and effects below intentionally use minimal dependency arrays, ported verbatim
  // from next-themes@0.4.6. The provider's configuration props (attribute, value, enableSystem,
  // storageKey, defaultTheme, …) are static-by-contract — set once at the root layout and never
  // changed — so the omitted deps never go stale in practice. Adding them (as
  // react-hooks/exhaustive-deps suggests) would re-subscribe the media-query listener on every
  // render whenever a consumer passes an inline `themes`/`value` array. Keep them minimal to match
  // upstream behavior.
  /* eslint-disable react-hooks/exhaustive-deps */
  const applyTheme = React.useCallback(
    (theme: string | undefined) => {
      let resolved = theme;
      if (!resolved) return;

      // If theme is system, resolve it before setting theme
      if (theme === 'system' && enableSystem) {
        resolved = getSystemTheme();
      }

      const name = value ? value[resolved] : resolved;
      const enable = disableTransitionOnChange ? disableAnimation(nonce) : null;
      const d = document.documentElement;

      const handleAttribute = (attr: Attribute) => {
        if (attr === 'class') {
          d.classList.remove(...attrs);
          if (name) d.classList.add(name);
        } else if (attr.startsWith('data-')) {
          if (name) {
            d.setAttribute(attr, name);
          } else {
            d.removeAttribute(attr);
          }
        }
      };

      if (Array.isArray(attribute)) attribute.forEach(handleAttribute);
      else handleAttribute(attribute);

      if (enableColorScheme) {
        const fallback = colorSchemes.includes(defaultTheme) ? defaultTheme : null;
        const colorScheme = colorSchemes.includes(resolved) ? resolved : fallback;
        d.style.colorScheme = colorScheme ?? '';
      }

      enable?.();
    },
    [nonce]
  );

  const setTheme = React.useCallback(
    (value: React.SetStateAction<string>) => {
      const newTheme = typeof value === 'function' ? value(theme as string) : value;
      setThemeState(newTheme);

      // Save to storage
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {
        // Unsupported
      }
    },
    [theme]
  );

  const handleMediaQuery = React.useCallback(
    (e: MediaQueryListEvent | MediaQueryList) => {
      const resolved = getSystemTheme(e);
      setResolvedTheme(resolved);

      if (theme === 'system' && enableSystem && !forcedTheme) {
        applyTheme('system');
      }
    },
    [theme, forcedTheme]
  );

  // Always listen to System preference
  React.useEffect(() => {
    const media = window.matchMedia(MEDIA);

    // Intentionally use deprecated listener methods to support iOS & old browsers
    media.addListener(handleMediaQuery);
    handleMediaQuery(media);

    return () => media.removeListener(handleMediaQuery);
  }, [handleMediaQuery]);

  // localStorage event handling
  React.useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) {
        return;
      }

      // If default theme set, use it if localstorage === null (happens on local storage manual deletion)
      if (!e.newValue) {
        setTheme(defaultTheme);
      } else {
        setThemeState(e.newValue); // Direct state update to avoid loops
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [setTheme]);

  // Whenever theme or forcedTheme changes, apply it
  React.useEffect(() => {
    applyTheme(forcedTheme ?? theme);
  }, [forcedTheme, theme]);

  const providerValue = React.useMemo(
    () => ({
      theme,
      setTheme,
      forcedTheme,
      resolvedTheme: theme === 'system' ? resolvedTheme : theme,
      themes: enableSystem ? [...themes, 'system'] : themes,
      systemTheme: (enableSystem ? resolvedTheme : undefined) as 'light' | 'dark' | undefined,
    }),
    [theme, setTheme, forcedTheme, resolvedTheme, enableSystem, themes]
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <ThemeContext.Provider value={providerValue}>
      <ThemeScript
        {...{
          forcedTheme,
          storageKey,
          attribute,
          enableSystem,
          enableColorScheme,
          defaultTheme,
          value,
          themes,
          nonce,
          scriptProps,
        }}
      />

      {children}
    </ThemeContext.Provider>
  );
};

type ThemeScriptComponentProps = ThemeScriptProps & Pick<ThemeProviderProps, 'nonce' | 'scriptProps'>;

/**
 * Renders nothing into the client React tree. Registers the pre-hydration script through
 * `useServerInsertedHTML`, whose callback runs ONLY during the server render pass — so the
 * `<script>` is streamed into the document (head) but never reconciled on the client.
 */
const ThemeScript = React.memo(function ThemeScript({
  forcedTheme,
  storageKey,
  attribute,
  enableSystem,
  enableColorScheme,
  defaultTheme,
  value,
  themes,
  nonce,
  scriptProps,
}: ThemeScriptComponentProps) {
  useServerInsertedHTML(() => {
    const __html = getThemeScript({
      attribute,
      storageKey,
      defaultTheme,
      forcedTheme,
      themes,
      value,
      enableSystem,
      enableColorScheme,
    });

    return (
      <script
        {...scriptProps}
        suppressHydrationWarning
        nonce={typeof window === 'undefined' ? nonce : ''}
        dangerouslySetInnerHTML={{ __html }}
      />
    );
  });

  return null;
});

// Helpers

const getTheme = (key: string, fallback?: string) => {
  if (isServer) return undefined;
  let theme: string | undefined;
  try {
    theme = localStorage.getItem(key) || undefined;
  } catch {
    // Unsupported
  }
  return theme || fallback;
};

const disableAnimation = (nonce?: string) => {
  const css = document.createElement('style');
  if (nonce) css.setAttribute('nonce', nonce);
  css.appendChild(
    document.createTextNode(
      `*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}`
    )
  );
  document.head.appendChild(css);

  return () => {
    // Force restyle
    (() => window.getComputedStyle(document.body))();

    // Wait for next tick before removing
    setTimeout(() => {
      document.head.removeChild(css);
    }, 1);
  };
};

const getSystemTheme = (e?: MediaQueryList | MediaQueryListEvent) => {
  if (!e) e = window.matchMedia(MEDIA);
  const isDark = e.matches;
  const systemTheme = isDark ? 'dark' : 'light';
  return systemTheme;
};
