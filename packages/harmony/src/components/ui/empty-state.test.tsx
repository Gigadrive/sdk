import { Search } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

const rootClasses = (html: string): string[] => {
  const match = /^<div class="([^"]*)"/.exec(html);
  return match ? match[1].split(' ') : [];
};

describe('EmptyState', () => {
  it('should render the title and description', () => {
    const html = renderToString(<EmptyState title="No results found" description="Try adjusting your filters." />);

    expect(html).toContain('No results found');
    expect(html).toContain('Try adjusting your filters.');
  });

  it('should fill its container instead of capping its own width', () => {
    const classes = rootClasses(renderToString(<EmptyState title="Nothing here" description="Nothing here yet." />));

    expect(classes).toContain('w-full');
    expect(classes.some((className) => className.startsWith('max-w-'))).toBe(false);
  });

  it('should constrain the title and description to a readable measure', () => {
    const html = renderToString(<EmptyState title="Nothing here" description="Nothing here yet." />);

    expect(html).toContain('<div class="mx-auto max-w-lg">');
  });

  it('should keep a caller-supplied max-w-none as a harmless no-op', () => {
    const classes = rootClasses(
      renderToString(<EmptyState title="Nothing here" description="Nothing here yet." className="max-w-none" />)
    );

    expect(classes).toContain('w-full');
    expect(classes.filter((className) => className.startsWith('max-w-'))).toEqual(['max-w-none']);
  });

  it('should let a caller cap the width deliberately', () => {
    const classes = rootClasses(
      renderToString(<EmptyState title="Nothing here" description="Nothing here yet." className="max-w-[620px]" />)
    );

    expect(classes).toContain('max-w-[620px]');
  });

  it('should scale its padding with the viewport', () => {
    const classes = rootClasses(renderToString(<EmptyState title="Nothing here" description="Nothing here yet." />));

    expect(classes).toEqual(expect.arrayContaining(['p-8', 'sm:p-12', 'lg:p-16']));
    expect(classes).not.toContain('p-20');
  });

  it('should render the provided icon', () => {
    const html = renderToString(<EmptyState title="No results" description="Nothing matched." icons={[Search]} />);

    expect(html).toContain('lucide-search');
  });
});
