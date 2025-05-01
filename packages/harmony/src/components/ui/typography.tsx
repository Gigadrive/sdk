import { cn } from '@/lib/utils';
import { forwardRef, type ReactNode } from 'react';

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
};

const buildProseStyles = (classes: string, prefix: string): string => {
  return classes
    .split(' ')
    .map((className) => `${prefix}${className}`)
    .join(' ');
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
          'prose prose-slate dark:prose-invert max-w-none',
          buildProseStyles(TYPOGRAPHY_STYLES.headings.h1, 'prose-headings:h1:'),
          buildProseStyles(TYPOGRAPHY_STYLES.headings.h2, 'prose-headings:h2:'),
          buildProseStyles(TYPOGRAPHY_STYLES.headings.h3, 'prose-headings:h3:'),
          buildProseStyles(TYPOGRAPHY_STYLES.headings.h4, 'prose-headings:h4:'),
          buildProseStyles(TYPOGRAPHY_STYLES.headings.h5, 'prose-headings:h5:'),
          buildProseStyles(TYPOGRAPHY_STYLES.headings.h6, 'prose-headings:h6:'),
          buildProseStyles(TYPOGRAPHY_STYLES.paragraph.base, 'prose-p:'),
          buildProseStyles(TYPOGRAPHY_STYLES.paragraph.lead, 'prose-p:'),
          buildProseStyles(TYPOGRAPHY_STYLES.code.block, 'prose-pre:'),
          buildProseStyles(TYPOGRAPHY_STYLES.code.inline, 'prose-code:'),
          buildProseStyles(TYPOGRAPHY_STYLES.list.unordered, 'prose-ul:'),
          buildProseStyles(TYPOGRAPHY_STYLES.list.ordered, 'prose-ol:'),

          // add for both list styles
          buildProseStyles(TYPOGRAPHY_STYLES.list.base, 'prose-ul:'),
          buildProseStyles(TYPOGRAPHY_STYLES.list.base, 'prose-ol:'),
          buildProseStyles(TYPOGRAPHY_STYLES.paragraph.base, 'prose-ol:'),
          buildProseStyles(TYPOGRAPHY_STYLES.paragraph.base, 'prose-ol:'),
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
