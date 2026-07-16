import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('should render a button element with its text wrapped in a span', () => {
    const html = renderToString(<Button variant="outline">Billing</Button>);
    expect(html).toContain('<button');
    expect(html).toContain('<span class="mt-[var(--text-correction)]">Billing</span>');
  });

  it('should render the child element when asChild is set', () => {
    const html = renderToString(
      <Button variant="outline" size="sm" asChild>
        <a href="/x">Billing</a>
      </Button>
    );
    expect(html).not.toBe('');
    expect(html).toContain('<a');
    expect(html).toContain('href="/x"');
    expect(html).not.toContain('<button');
    expect(html).toContain('<span class="mt-[var(--text-correction)]">Billing</span>');
  });

  it('should merge button classes onto the asChild element', () => {
    const html = renderToString(
      <Button variant="outline" size="sm" asChild>
        <a href="/x">Billing</a>
      </Button>
    );
    expect(html).toContain('border-input');
  });

  it('should render asChild children that mix elements and text', () => {
    const html = renderToString(
      <Button asChild>
        <a href="/x">
          <svg /> Billing
        </a>
      </Button>
    );
    expect(html).toContain('<a');
    expect(html).toContain('Billing');
  });
});
