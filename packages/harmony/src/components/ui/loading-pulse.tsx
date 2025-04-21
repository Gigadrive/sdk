'use client';

import { cn } from '@/lib/utils';
import * as React from 'react';

import './loading-pulse.scss';

export interface LoadingPulseProps extends React.HTMLAttributes<HTMLDivElement> {
  lineClassName?: string;
}

const Loader = React.forwardRef<HTMLDivElement, LoadingPulseProps>(({ children, className, ...props }, ref) => {
  return (
    <div ref={ref} className={cn('inline-block', className)}>
      <div className="react-loader-wrap w-100 flex flex-col justify-center" {...props}>
        {children}
      </div>
    </div>
  );
});
Loader.displayName = 'Loader';

const LoadingPulse = React.forwardRef<HTMLDivElement, LoadingPulseProps>(
  ({ lineClassName = 'bg-primary', className, ...props }, ref) => {
    return (
      <Loader ref={ref} className={className} {...props}>
        <div className="line-scale-pulse-out">
          <div className={lineClassName}></div>
          <div className={lineClassName}></div>
          <div className={lineClassName}></div>
          <div className={lineClassName}></div>
          <div className={lineClassName}></div>
        </div>
      </Loader>
    );
  }
);
LoadingPulse.displayName = 'LoadingPulse';

export { Loader, LoadingPulse };
