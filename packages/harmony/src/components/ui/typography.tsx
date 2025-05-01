import { cn } from '@/lib/utils';
import { forwardRef, type ReactNode } from 'react';

// unfortunately, due to how Tailwind and PostCSS work, we have to manually define styles for all variants
// When updating sizes or anything similar, make sure to update the styles for the standalone components, as well as the Prose component
const TYPOGRAPHY_STYLES = {
  headings: {
    h1: 'text-3xl md:text-4xl lg:text-5xl font-bold',
    h2: 'text-2xl md:text-3xl lg:text-4xl font-semibold',
    h3: 'text-xl md:text-2xl lg:text-3xl font-semibold',
    h4: 'text-lg md:text-xl lg:text-2xl font-medium',
    h5: 'text-base md:text-lg lg:text-xl font-medium',
    h6: 'text-sm md:text-base lg:text-lg font-medium',
    base: 'tracking-tight text-foreground',
  },
  paragraph: {
    base: 'text-base md:text-lg',
    lead: 'text-xl md:text-2xl text-foreground',
  },
  list: {
    base: 'my-6 md:my-8 -ml-3',
    unordered: 'list-disc',
    ordered: 'list-decimal',
  },
  code: {
    block: 'rounded-xl bg-muted p-4 md:p-6 font-mono text-sm md:text-base',
    inline: 'text-foreground',
  },
  prose: {
    base: 'prose prose-slate dark:prose-invert max-w-none',
    headings: {
      h1: 'prose-headings:h1:text-3xl prose-headings:h1:md:text-4xl prose-headings:h1:lg:text-5xl prose-headings:h1:font-bold',
      h2: 'prose-headings:h2:text-2xl prose-headings:h2:md:text-3xl prose-headings:h2:lg:text-4xl prose-headings:h2:font-semibold',
      h3: 'prose-headings:h3:text-xl prose-headings:h3:md:text-2xl prose-headings:h3:lg:text-3xl prose-headings:h3:font-semibold',
      h4: 'prose-headings:h4:text-lg prose-headings:h4:md:text-xl prose-headings:h4:lg:text-2xl prose-headings:h4:font-medium',
      h5: 'prose-headings:h5:text-base prose-headings:h5:md:text-lg prose-headings:h5:lg:text-xl prose-headings:h5:font-medium',
      h6: 'prose-headings:h6:text-sm prose-headings:h6:md:text-base prose-headings:h6:lg:text-lg prose-headings:h6:font-medium',
    },
    paragraph: {
      base: 'prose-p:text-base prose-p:md:text-lg prose-p:leading-relaxed',
      lead: 'prose-p:text-xl prose-p:md:text-2xl prose-p:text-foreground prose-p:leading-relaxed',
    },
    code: {
      block:
        'prose-pre:rounded-xl prose-pre:bg-muted prose-pre:p-4 prose-pre:md:p-6 prose-pre:font-mono prose-pre:text-sm prose-pre:md:text-base',
      inline: 'prose-code:text-foreground',
    },
    list: {
      unordered: 'prose-ul:list-disc prose-ul:text-base prose-ul:md:text-lg prose-ul:leading-relaxed',
      ordered: 'prose-ol:list-decimal prose-ol:text-base prose-ol:md:text-lg prose-ol:leading-relaxed',
      base: 'prose-ul:my-6 prose-ul:md:my-8 prose-ul:-ml-3 prose-ol:my-6 prose-ol:md:my-8 prose-ol:-ml-3',
    },
  },
};

type HeadlineProps = {
  children: ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
} & React.HTMLAttributes<HTMLHeadingElement>;

export const Headline = forwardRef<HTMLHeadingElement, HeadlineProps>(
  ({ children, className, as: Component = 'h1', ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(TYPOGRAPHY_STYLES.headings.base, TYPOGRAPHY_STYLES.headings[Component], className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Headline.displayName = 'Headline';

type ParagraphProps = {
  children: ReactNode;
  className?: string;
  lead?: boolean;
} & React.HTMLAttributes<HTMLParagraphElement>;

export const Paragraph = forwardRef<HTMLParagraphElement, ParagraphProps>(
  ({ children, className, lead, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn(TYPOGRAPHY_STYLES.paragraph.base, lead && TYPOGRAPHY_STYLES.paragraph.lead, className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);
Paragraph.displayName = 'Paragraph';

type ListProps = {
  children: ReactNode;
  className?: string;
  ordered?: boolean;
} & React.HTMLAttributes<HTMLUListElement | HTMLOListElement>;

export const List = forwardRef<HTMLUListElement | HTMLOListElement, ListProps>(
  ({ children, className, ordered, ...props }, ref) => {
    const Component = ordered ? 'ol' : 'ul';
    return (
      <Component
        ref={ref as React.LegacyRef<HTMLUListElement> & React.LegacyRef<HTMLOListElement>}
        className={cn(
          TYPOGRAPHY_STYLES.list.base,
          TYPOGRAPHY_STYLES.paragraph.base,
          ordered ? TYPOGRAPHY_STYLES.list.ordered : TYPOGRAPHY_STYLES.list.unordered,
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
List.displayName = 'List';

type CodeBlockProps = {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLPreElement>;

export const CodeBlock = forwardRef<HTMLPreElement, CodeBlockProps>(({ children, className, ...props }, ref) => {
  return (
    <pre ref={ref} className={cn(TYPOGRAPHY_STYLES.code.block, className)} {...props}>
      <code>{children}</code>
    </pre>
  );
});
CodeBlock.displayName = 'CodeBlock';

type ProseProps = {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
} & React.HTMLAttributes<HTMLDivElement>;

export const Prose = forwardRef<HTMLDivElement, ProseProps>(
  ({ children, className, as: Component = 'div', ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(
          TYPOGRAPHY_STYLES.prose.base,
          TYPOGRAPHY_STYLES.prose.headings.h1,
          TYPOGRAPHY_STYLES.prose.headings.h2,
          TYPOGRAPHY_STYLES.prose.headings.h3,
          TYPOGRAPHY_STYLES.prose.headings.h4,
          TYPOGRAPHY_STYLES.prose.headings.h5,
          TYPOGRAPHY_STYLES.prose.headings.h6,
          TYPOGRAPHY_STYLES.prose.paragraph.base,
          TYPOGRAPHY_STYLES.prose.code.block,
          TYPOGRAPHY_STYLES.prose.code.inline,
          TYPOGRAPHY_STYLES.prose.list.unordered,
          TYPOGRAPHY_STYLES.prose.list.ordered,
          TYPOGRAPHY_STYLES.prose.list.base,
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Prose.displayName = 'Prose';
