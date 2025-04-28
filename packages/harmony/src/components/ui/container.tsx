import * as React from 'react';

import { cn } from '@/lib/utils';

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  size?: ContainerSize;
  padded?: boolean;
}

const sizeMap: Record<ContainerSize, string> = {
  sm: 'max-w-screen-sm px-2 sm:px-3 lg:px-4',
  md: 'max-w-screen-md px-3 sm:px-4 lg:px-6',
  lg: 'max-w-screen-lg px-4 sm:px-6 lg:px-8',
  xl: 'max-w-screen-xl px-4 sm:px-8 lg:px-12',
  '2xl': 'max-w-screen-2xl px-6 sm:px-12 lg:px-16',
  full: 'max-w-full px-8 sm:px-16 lg:px-24',
};

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, children, size = 'xl', padded = true, ...props }, ref) => (
    <div ref={ref} className={cn('mx-auto', sizeMap[size], !padded && 'px-0', className)} {...props}>
      {children}
    </div>
  )
);

Container.displayName = 'Container';

export { Container };
