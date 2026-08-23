import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-transform transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_2px_0_rgba(255,255,255,0.2),0_2px_4px_0_rgba(0,0,0,0.1)] hover:bg-primary/90 bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_40%,transparent_60%)] dark:shadow-[inset_0_1px_2px_0_rgba(255,255,255,0.2),0_2px_4px_0_rgba(0,0,0,0.35)]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-[inset_0_1px_2px_0_rgba(255,255,255,0.2),0_2px_4px_0_rgba(0,0,0,0.1)] hover:bg-destructive/90 bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_40%,transparent_60%)] dark:shadow-[inset_0_1px_2px_0_rgba(255,255,255,0.2),0_2px_4px_0_rgba(0,0,0,0.35)]',
        outline:
          'border border-input bg-card shadow-[inset_0_1px_2px_0_rgba(255,255,255,0.2),0_1px_2px_0_rgba(0,0,0,0.05)] hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.09),0_1px_2px_0_rgba(0,0,0,0.4)] dark:bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_60%)]',
        secondary:
          'bg-secondary text-secondary-foreground shadow-[inset_0_1px_2px_0_rgba(255,255,255,0.2),0_1px_2px_0_rgba(0,0,0,0.05)] hover:bg-secondary/80 bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_40%,transparent_60%)] dark:shadow-[inset_0_1px_2px_0_rgba(255,255,255,0.14),0_1px_2px_0_rgba(0,0,0,0.4)]',
        ghost: 'text-foreground hover:bg-muted',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        xs: 'h-8 rounded-md px-3 text-xs',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
      wide: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      wide: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Shows a spinner and disables the button while a pending action runs.
   * With `asChild`, the child may not support `disabled` (e.g. a link), so the
   * button is instead inerted via `aria-disabled` + `pointer-events-none`, and
   * no spinner is injected (Slot requires a single child).
   */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, wide, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, wide, className }), loading && 'pointer-events-none opacity-50')}
        ref={ref}
        disabled={asChild ? disabled : disabled || loading || undefined}
        aria-disabled={loading || undefined}
        {...props}
      >
        {loading && !asChild ? (
          <>
            {/* Animate the wrapper, not the <svg> — see AGENTS.md Rendering Performance. */}
            <div aria-hidden className="animate-spin">
              <Loader2 />
            </div>
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
