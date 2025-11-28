import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn, wrapTextNodes } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_1px_2px_0_rgba(0,0,0,0.1)] hover:bg-primary/80 bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.25),transparent)]',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_1px_2px_0_rgba(0,0,0,0.1)] hover:bg-secondary/80 bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.25),transparent)]',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_1px_2px_0_rgba(0,0,0,0.1)] hover:bg-destructive/80 bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.25),transparent)]',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, children, ...props }, ref) => {
  return (
    <div className={cn(badgeVariants({ variant }), className)} ref={ref} {...props}>
      {wrapTextNodes(children)}
    </div>
  );
});
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
