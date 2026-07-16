import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getInitials, wrapTextNodes } from './utils';

describe('wrapTextNodes', () => {
  it('should wrap a text child in a span', () => {
    const result = wrapTextNodes('Billing');
    expect(renderToString(<>{result}</>)).toBe('<span class="mt-[var(--text-correction)]">Billing</span>');
  });

  it('should return a single valid element for a lone child so Radix Slot can clone it', () => {
    const result = wrapTextNodes(<a href="/x">Billing</a>);
    expect(React.isValidElement(result)).toBe(true);
  });

  it('should return a single valid element for a lone text child', () => {
    expect(React.isValidElement(wrapTextNodes('Billing'))).toBe(true);
  });

  it('should keep multiple children as an array', () => {
    const result = wrapTextNodes([<b key="a">a</b>, 'b']);
    expect(Array.isArray(result)).toBe(true);
    expect(React.Children.count(result)).toBe(2);
  });

  it('should recursively wrap text nodes inside elements', () => {
    const html = renderToString(<>{wrapTextNodes(<a href="/x">Billing</a>)}</>);
    expect(html).toContain('<a href="/x"');
    expect(html).toContain('<span class="mt-[var(--text-correction)]">Billing</span>');
  });

  it('should apply a custom className', () => {
    const html = renderToString(<>{wrapTextNodes('hi', 'custom')}</>);
    expect(html).toBe('<span class="custom">hi</span>');
  });

  it('should pass through null and undefined', () => {
    expect(wrapTextNodes(null)).toBeNull();
    expect(wrapTextNodes(undefined)).toBeUndefined();
  });

  it('should flatten fragments and wrap their text children', () => {
    const html = renderToString(<>{wrapTextNodes(<>Billing</>)}</>);
    expect(html).toBe('<span class="mt-[var(--text-correction)]">Billing</span>');
  });
});

describe('getInitials', () => {
  it('should compute initials for multi-word names', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('should use the first two characters for single tokens', () => {
    expect(getInitials('gigadrive')).toBe('GI');
  });

  it('should handle hyphenated single tokens', () => {
    expect(getInitials('mary-jane')).toBe('MJ');
  });

  it('should return an empty string for empty input', () => {
    expect(getInitials('   ')).toBe('');
  });
});
