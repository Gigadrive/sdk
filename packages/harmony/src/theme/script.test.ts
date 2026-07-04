import { describe, expect, it } from 'vitest';
import { getThemeScript, getThemeScriptArgs } from './script';

describe('getThemeScriptArgs', () => {
  it('serializes class-attribute system defaults, mapping undefined → null', () => {
    const args = getThemeScriptArgs({
      attribute: 'class',
      storageKey: 'theme',
      defaultTheme: 'system',
      forcedTheme: undefined,
      themes: ['light', 'dark'],
      value: undefined,
      enableSystem: true,
      enableColorScheme: true,
    });

    expect(args).toBe('"class","theme","system",null,["light","dark"],null,true,true');
  });

  it('serializes an array attribute and enableSystem: false', () => {
    const args = getThemeScriptArgs({
      attribute: ['class', 'data-theme'],
      storageKey: 'theme',
      defaultTheme: 'light',
      themes: ['light', 'dark'],
      enableSystem: false,
      enableColorScheme: true,
    });

    expect(args).toBe('["class","data-theme"],"theme","light",null,["light","dark"],null,false,true');
  });

  it('serializes a value map and a forcedTheme', () => {
    const args = getThemeScriptArgs({
      attribute: 'class',
      storageKey: 'my-theme',
      defaultTheme: 'system',
      forcedTheme: 'dark',
      themes: ['light', 'dark'],
      value: { light: 'light-mode', dark: 'dark-mode' },
      enableSystem: true,
      enableColorScheme: false,
    });

    expect(args).toBe(
      '"class","my-theme","system","dark",["light","dark"],{"light":"light-mode","dark":"dark-mode"},true,false'
    );
  });
});

describe('getThemeScript', () => {
  it('produces a syntactically valid, self-contained IIFE', () => {
    const html = getThemeScript({
      attribute: 'class',
      storageKey: 'theme',
      defaultTheme: 'system',
      forcedTheme: undefined,
      themes: ['light', 'dark'],
      value: undefined,
      enableSystem: true,
      enableColorScheme: true,
    });

    expect(html.startsWith('(')).toBe(true);
    expect(html).toContain('document.documentElement');
    expect(html).toContain('prefers-color-scheme: dark');
    // Compiles (syntax-checks) the IIFE without executing it — no DOM access happens here.
    expect(() => new Function(html)).not.toThrow();
  });
});
