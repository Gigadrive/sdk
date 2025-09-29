import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as React from 'react';

import { cn, getInitials, wrapTextNodes } from '@/lib/utils';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-xl', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('aspect-square h-full w-full', className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, children, ...props }, ref) => {
  const compute = React.useCallback((value: string) => getInitials(value), []);

  const content = React.useMemo(() => {
    if (typeof children === 'string' || typeof children === 'number') {
      return compute(String(children));
    }
    return children;
  }, [children, compute]);

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn('flex h-full w-full items-center justify-center rounded-xl bg-muted text-xs', className)}
      {...props}
    >
      {wrapTextNodes(content)}
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarFallback, AvatarImage };
