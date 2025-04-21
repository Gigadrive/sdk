import { cn } from '@/lib/utils';
import * as React from 'react';

export interface ActionPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export interface ActionPanelTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode;
}

export interface ActionPanelBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export interface ActionPanelFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const ActionPanel = React.forwardRef<HTMLDivElement, ActionPanelProps>(({ className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn('bg-card border rounded-lg shadow-sm', className)} {...props}>
      <div className="px-4 py-5 sm:p-6">{children}</div>
    </div>
  );
});
ActionPanel.displayName = 'ActionPanel';

const ActionPanelTitle = React.forwardRef<HTMLHeadingElement, ActionPanelTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-base font-medium leading-6 text-gray-900 dark:text-white', className)} {...props}>
      {children}
    </h3>
  )
);
ActionPanelTitle.displayName = 'ActionPanelTitle';

const ActionPanelBody = React.forwardRef<HTMLDivElement, ActionPanelBodyProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-300', className)} {...props}>
      {children}
    </div>
  )
);
ActionPanelBody.displayName = 'ActionPanelBody';

const ActionPanelFooter = React.forwardRef<HTMLDivElement, ActionPanelFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('mt-5', className)} {...props}>
      {children}
    </div>
  )
);
ActionPanelFooter.displayName = 'ActionPanelFooter';

export { ActionPanel, ActionPanelBody, ActionPanelFooter, ActionPanelTitle };
