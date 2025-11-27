'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '@/lib/utils';

const TooltipProvider: React.FC<React.ComponentProps<typeof TooltipPrimitive.Provider>> = TooltipPrimitive.Provider;

const Tooltip: React.FC<React.ComponentProps<typeof TooltipPrimitive.Root>> = TooltipPrimitive.Root;

const TooltipTrigger: React.FC<React.ComponentProps<typeof TooltipPrimitive.Trigger>> = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_1px_3px_0_rgba(0,0,0,0.1)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.15),transparent)]',
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
