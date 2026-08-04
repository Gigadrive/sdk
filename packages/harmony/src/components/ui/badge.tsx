import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'border-foreground/[0.08] bg-secondary text-secondary-foreground hover:bg-secondary/70',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border-border bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        soft: 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary/15 dark:text-[color:color-mix(in_srgb,hsl(var(--primary)),white_45%)]',
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
      {children}
    </div>
  );
});
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
