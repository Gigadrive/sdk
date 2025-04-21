import { clsx, type ClassValue } from 'clsx';
import * as React from 'react';
import { twMerge } from 'tailwind-merge';

/**
 * Merge multiple class names
 * @param inputs - The class names to merge
 * @returns The merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Wraps text nodes in a span element while preserving other elements
 * @param children - The children to process
 * @param className - Optional className to apply to the wrapping span
 * @returns The processed children with text nodes wrapped in spans
 */
export function wrapTextNodes(
  children: React.ReactNode | string | number | null | undefined,
  className: string = 'mt-[var(--text-correction)]'
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return React.createElement('span', { className }, child);
    }

    if (React.isValidElement(child)) {
      if (child.type === React.Fragment) {
        return wrapTextNodes(child.props.children, className);
      }

      // If the element has children, recursively process them
      if (child.props.children) {
        return React.cloneElement(child, {
          ...child.props,
          children: wrapTextNodes(child.props.children, className),
        });
      }
    }

    return child;
  });
}
