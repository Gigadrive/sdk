import * as React from 'react';

import { cn } from '@/lib/utils';

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Field label rendered above the control. */
  label?: React.ReactNode;
  /** `id` of the control this field labels. */
  htmlFor?: string;
  /** Validation error — replaces the hint and tints the label. */
  error?: React.ReactNode;
  /** Helper text below the control. */
  hint?: React.ReactNode;
  /** Marks the label with a required asterisk. */
  required?: boolean;
}

/**
 * Label + control + hint/error composite for the top-label form pattern.
 * Pairs with the plain (unlabeled) usage of Input/Textarea/Select:
 *
 * ```tsx
 * <Field label="Project name" htmlFor="name" hint="Used in your deployment URLs.">
 *   <Input id="name" />
 * </Field>
 * ```
 */
const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, label, htmlFor, error, hint, required = false, children, ...props }, ref) => (
    <div ref={ref} className={cn('w-full', className)} {...props}>
      {label !== undefined && label !== '' && (
        <label
          htmlFor={htmlFor}
          className={cn('mb-1.5 block text-sm font-medium', error != null ? 'text-danger' : 'text-foreground')}
        >
          {label}
          {required && (
            <span aria-hidden className="ms-0.5 text-danger">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error != null && <div className="mt-1.5 text-sm text-danger">{error}</div>}
      {error == null && hint != null && <div className="mt-1.5 text-sm text-muted-foreground">{hint}</div>}
    </div>
  )
);
Field.displayName = 'Field';

export { Field };
