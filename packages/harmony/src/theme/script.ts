import type { Attribute } from './context';

/**
 * Props required to build the pre-hydration anti-FOUC script.
 * Mirrors the argument list consumed by {@link script}.
 */
export interface ThemeScriptProps {
  attribute: Attribute | Attribute[];
  storageKey: string;
  defaultTheme: string;
  forcedTheme?: string | undefined;
  themes: string[];
  value?: Record<string, string> | undefined;
  enableSystem?: boolean | undefined;
  enableColorScheme?: boolean | undefined;
}

/**
 * Self-contained function serialized (via {@link Function.prototype.toString}) into the
 * pre-hydration `<script>`. It MUST NOT reference anything from module scope — only its own
 * arguments and browser globals — otherwise the stringified IIFE throws a `ReferenceError`
 * when it runs in the document before React hydrates.
 *
 * Ported from `next-themes@0.4.6` (`src/script.ts`, MIT).
 */
export const script = (
  attribute: Attribute | Attribute[],
  storageKey: string,
  defaultTheme: string,
  forcedTheme: string | undefined,
  themes: string[],
  value: Record<string, string> | undefined,
  enableSystem: boolean | undefined,
  enableColorScheme: boolean | undefined
) => {
  const el = document.documentElement;
  const systemThemes = ['light', 'dark'];

  function updateDOM(theme: string) {
    const attributes = Array.isArray(attribute) ? attribute : [attribute];

    attributes.forEach((attr) => {
      const isClass = attr === 'class';
      const classes = isClass && value ? themes.map((t) => value[t] || t) : themes;
      if (isClass) {
        el.classList.remove(...classes);
        el.classList.add(value && value[theme] ? value[theme] : theme);
      } else {
        el.setAttribute(attr, theme);
      }
    });

    setColorScheme(theme);
  }

  function setColorScheme(theme: string) {
    if (enableColorScheme && systemThemes.includes(theme)) {
      el.style.colorScheme = theme;
    }
  }

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  if (forcedTheme) {
    updateDOM(forcedTheme);
  } else {
    try {
      const themeName = localStorage.getItem(storageKey) || defaultTheme;
      const isSystem = enableSystem && themeName === 'system';
      const theme = isSystem ? getSystemTheme() : themeName;
      updateDOM(theme);
    } catch {
      //
    }
  }
};

/**
 * Serialize the script arguments into the comma-separated list spliced between the IIFE's
 * invocation parentheses. `undefined` entries become `null` (JSON array semantics), matching
 * `next-themes`' `JSON.stringify([...]).slice(1, -1)`.
 *
 * @param props - resolved theme configuration
 * @returns the serialized argument list, e.g. `"class","theme","system",null,["light","dark"],null,true,true`
 */
export const getThemeScriptArgs = (props: ThemeScriptProps): string =>
  JSON.stringify([
    props.attribute,
    props.storageKey,
    props.defaultTheme,
    props.forcedTheme,
    props.themes,
    props.value,
    props.enableSystem,
    props.enableColorScheme,
  ]).slice(1, -1);

/**
 * Build the full pre-hydration IIFE string to inject via `dangerouslySetInnerHTML`.
 *
 * @param props - resolved theme configuration
 * @returns `(<serialized script>)(<serialized args>)`
 */
export const getThemeScript = (props: ThemeScriptProps): string =>
  `(${script.toString()})(${getThemeScriptArgs(props)})`;
