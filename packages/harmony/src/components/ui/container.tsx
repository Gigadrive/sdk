import * as React from 'react';

import { cn } from '@/lib/utils';

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  size?: ContainerSize;
  padded?: boolean;
}

const sizeMap: Record<ContainerSize, string> = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
};

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, children, size = 'xl', padded = true, ...props }, ref) => (
    <div ref={ref} className={cn('mx-auto', sizeMap[size], padded && 'px-4 sm:px-6 lg:px-8', className)} {...props}>
      {children}
    </div>
  )
);

Container.displayName = 'Container';

export { Container };
