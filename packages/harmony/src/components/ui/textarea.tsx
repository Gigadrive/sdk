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
    const id = React.useId();

    return (
      <div>
        <div className="relative">
          <textarea
            id={id}
            className={cn(
              'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:focus-visible:ring-offset-background',
              label !== undefined && label !== '' && 'pt-4',
              error !== undefined &&
                'border-destructive focus:border-destructive dark:border-destructive dark:focus:border-destructive',
              className
            )}
            ref={ref}
            placeholder=" "
            {...props}
          />

          {label !== undefined && label !== '' && (
            <label
              htmlFor={id}
              className={cn(
                'pointer-events-none absolute left-1 top-2 z-10 origin-[0] -translate-y-4 scale-75 transform bg-white px-2 text-sm duration-300 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 dark:bg-stone-950',
                error !== undefined
                  ? 'text-destructive peer-focus:text-destructive dark:text-destructive peer-focus:dark:text-destructive'
                  : 'text-gray-500 peer-focus:text-primary-600 dark:text-gray-400 peer-focus:dark:text-primary-500',
                props.disabled && 'cursor-not-allowed opacity-75'
              )}
            >
              {label}
            </label>
          )}
        </div>

        {bottomElement !== undefined && bottomElement}

        {error !== undefined && <div className="mt-2 text-sm text-destructive">{error}</div>}

        {helpText !== undefined && <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{helpText}</div>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
