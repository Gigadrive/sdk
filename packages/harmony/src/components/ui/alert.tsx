import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 shadow-sm overflow-hidden [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
        success:
          'bg-green-50/50 border-green-500/20 text-green-800 dark:text-green-300 dark:bg-green-950/50 dark:border-green-500/20 [&>svg]:text-green-600 dark:[&>svg]:text-green-400',
        warning:
          'bg-yellow-50/50 border-yellow-500/20 text-yellow-800 dark:text-yellow-300 dark:bg-yellow-950/50 dark:border-yellow-500/20 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400',
        error:
          'bg-red-50/50 border-red-500/20 text-red-800 dark:text-red-300 dark:bg-red-950/50 dark:border-red-500/20 [&>svg]:text-red-600 dark:[&>svg]:text-red-400',
        info: 'bg-blue-50/50 border-blue-500/20 text-blue-800 dark:text-blue-300 dark:bg-blue-950/50 dark:border-blue-500/20 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
  )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
  )
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertDescription, AlertTitle };
