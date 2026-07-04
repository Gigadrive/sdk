// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `next/navigation` is an optional peer and isn't installed for tests; mock the one hook we use.
// Its callback only runs during SSR flush, so a no-op faithfully mirrors client behavior.
vi.mock('next/navigation', () => ({
  useServerInsertedHTML: () => {},
}));

import { useTheme } from './context';
import { ThemeProvider } from './theme-provider';

/** Replace jsdom's missing `window.matchMedia` with a stub reporting the given `matches`. */
function mockMatchMedia(matches: boolean): void {
  window.matchMedia = (query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

function ThemeReader() {
  const { theme, resolvedTheme, systemTheme, setTheme } = useTheme();
  return (
    <>
      <span data-testid="theme">{theme ?? 'undefined'}</span>
      <span data-testid="resolved">{resolvedTheme ?? 'undefined'}</span>
      <span data-testid="system">{systemTheme ?? 'undefined'}</span>
      <button onClick={() => setTheme('dark')}>set-dark</button>
      <button onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}>toggle</button>
    </>
  );
}

const root = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root().className = '';
  root().removeAttribute('style');
  root().removeAttribute('data-theme');
  mockMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ThemeProvider', () => {
  it('applies the default theme as a class on <html>', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeReader />
      </ThemeProvider>
    );

    expect(root().classList.contains('light')).toBe(true);
    expect(screen.getByTestId('theme').textContent).toBe('light');
  });

  it('toggles the class and persists to localStorage on setTheme', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeReader />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('set-dark'));

    expect(root().classList.contains('dark')).toBe(true);
    expect(root().classList.contains('light')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('supports a functional updater in setTheme', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeReader />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('toggle'));

    expect(root().classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('sets a data-* attribute when attribute is data-theme', () => {
    render(
      <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
        <ThemeReader />
      </ThemeProvider>
    );

    expect(root().getAttribute('data-theme')).toBe('light');
  });

  it('resolves the system theme from prefers-color-scheme', () => {
    mockMatchMedia(true); // prefers dark

    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeReader />
      </ThemeProvider>
    );

    expect(root().classList.contains('dark')).toBe(true);
    expect(screen.getByTestId('theme').textContent).toBe('system');
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
    expect(screen.getByTestId('system').textContent).toBe('dark');
  });

  it('syncs across tabs via the storage event', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeReader />
      </ThemeProvider>
    );

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'dark' }));
    });

    expect(root().classList.contains('dark')).toBe(true);
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it('disables transitions during a change when disableTransitionOnChange is set', () => {
    vi.useFakeTimers();
    try {
      render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <ThemeReader />
        </ThemeProvider>
      );

      act(() => {
        fireEvent.click(screen.getByText('set-dark'));
      });

      const injected = Array.from(document.head.querySelectorAll('style')).some((style) =>
        style.textContent?.includes('transition:none')
      );
      expect(injected).toBe(true);

      // The forced-reflow cleanup removes the style on a 1ms timeout — flush it without error.
      act(() => {
        vi.runAllTimers();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useTheme without a provider', () => {
  it('returns a default context with an undefined theme', () => {
    render(<ThemeReader />);

    expect(screen.getByTestId('theme').textContent).toBe('undefined');
  });
});
