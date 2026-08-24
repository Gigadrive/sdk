'use client';

import { cn } from '@/lib/utils';
import * as React from 'react';

export interface TextareaProps extends React.ComponentProps<'textarea'> {
  label?: string;
  error?: string;
  helpText?: string;
  bottomElement?: React.ReactNode;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helpText, bottomElement, ...props }, ref) => {
    const generatedId = React.useId();
    // A caller-supplied id must win so the label's htmlFor stays associated.
    const id = props.id ?? generatedId;

    return (
      <div>
        {label !== undefined && label !== '' && (
          <label
            htmlFor={id}
            className={cn(
              'mb-1.5 block text-sm font-medium',
              error !== undefined ? 'text-danger' : 'text-foreground',
              props.disabled && 'cursor-not-allowed opacity-75'
            )}
          >
            {label}
          </label>
        )}

        <textarea
          id={id}
          className={cn(
            'well flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:focus-visible:ring-offset-background',
            error !== undefined && 'border-danger focus-visible:ring-danger/40',
            className
          )}
          ref={ref}
          {...props}
        />

        {bottomElement !== undefined && bottomElement}

        {error !== undefined && <div className="mt-1.5 text-sm text-danger">{error}</div>}

        {helpText !== undefined && <div className="mt-1.5 text-sm text-muted-foreground">{helpText}</div>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
