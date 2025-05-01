import { cn } from '@/lib/utils';
import { forwardRef, type ReactNode } from 'react';

type HeadlineProps = {
  children: ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
} & React.HTMLAttributes<HTMLHeadingElement>;

export const Headline = forwardRef<HTMLHeadingElement, HeadlineProps>(
  ({ children, className, as: Component = 'h1', ...props }, ref) => {
    const styles = {
      h1: 'text-3xl font-bold',
      h2: 'text-2xl font-semibold',
      h3: 'text-xl font-semibold',
      h4: 'text-lg font-medium',
      h5: 'text-base font-medium',
      h6: 'text-sm font-medium',
    };

    return (
      <Component ref={ref} className={cn(styles[Component], className)} {...props}>
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
      <p ref={ref} className={cn('text-base', lead && 'text-xl text-foreground', className)} {...props}>
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
        className={cn('my-6 ml-6', ordered ? 'list-decimal' : 'list-disc', className)}
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
    <pre ref={ref} className={cn('rounded-lg bg-muted p-4 font-mono text-sm', className)} {...props}>
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
          'prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground',
          'prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg',
          'prose-p:text-base prose-p:text-muted-foreground',
          'prose-pre:rounded-lg prose-pre:bg-muted prose-pre:p-4',
          'prose-code:text-foreground',
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
