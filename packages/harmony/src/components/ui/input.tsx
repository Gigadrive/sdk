'use client';

import { cn } from '@/lib/utils';
import * as React from 'react';

export interface InputProps extends React.ComponentProps<'input'> {
  label?: string;
  error?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  bottomElement?: React.ReactNode;
  helpText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, leftElement, rightElement, bottomElement, helpText, ...props }, ref) => {
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

        <div className="relative">
          {leftElement !== undefined && (
            <div className="absolute left-2.5 top-0 flex h-full items-center">{leftElement}</div>
          )}

          <input
            type={type}
            id={id}
            className={cn(
              'well flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:focus-visible:ring-offset-background',
              leftElement !== undefined && 'pl-9',
              rightElement !== undefined && 'pr-9',
              error !== undefined && 'border-danger focus-visible:ring-danger/40',
              className
            )}
            ref={ref}
            {...props}
          />

          {rightElement !== undefined && (
            <div className="absolute right-2.5 top-0 flex h-full items-center">{rightElement}</div>
          )}
        </div>

        {bottomElement !== undefined && bottomElement}

        {error !== undefined && <div className="mt-1.5 text-sm text-danger">{error}</div>}

        {helpText !== undefined && <div className="mt-1.5 text-sm text-muted-foreground">{helpText}</div>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
