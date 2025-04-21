import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { type ComponentPropsWithoutRef } from 'react';

const Collapsible = CollapsiblePrimitive.Root as React.ComponentType<
  ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root>
>;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger as React.ComponentType<
  ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleTrigger>
>;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent as React.ComponentType<
  ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>;

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
