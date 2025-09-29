import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import * as React from 'react';

export interface EmptyStateProps extends React.ComponentProps<'div'> {
  title: string;
  description: string;
  icons?: LucideIcon[];
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ title, description, icons = [], action, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-background border-border hover:border-border/80 text-center',
          'border-2 border-dashed rounded-xl p-20 w-full max-w-[620px] space-y-6',
          'group hover:bg-muted/50 transition duration-500 hover:duration-200',
          className
        )}
        {...props}
      >
        {icons && icons.length > 0 && (
          <div className="flex justify-center isolate">
            {icons.length === 3 ? (
              <>
                <div className="bg-background size-12 grid place-items-center rounded-xl relative left-2.5 top-1.5 -rotate-6 shadow-lg ring-1 ring-border group-hover:-translate-x-5 group-hover:-rotate-12 group-hover:-translate-y-0.5 transition duration-500 group-hover:duration-200">
                  {React.createElement(icons[0], {
                    className: 'w-6 h-6 text-muted-foreground',
                  })}
                </div>
                <div className="bg-background size-12 grid place-items-center rounded-xl relative z-10 shadow-lg ring-1 ring-border group-hover:-translate-y-0.5 transition duration-500 group-hover:duration-200">
                  {React.createElement(icons[1], {
                    className: 'w-6 h-6 text-muted-foreground',
                  })}
                </div>
                <div className="bg-background size-12 grid place-items-center rounded-xl relative right-2.5 top-1.5 rotate-6 shadow-lg ring-1 ring-border group-hover:translate-x-5 group-hover:rotate-12 group-hover:-translate-y-0.5 transition duration-500 group-hover:duration-200">
                  {React.createElement(icons[2], {
                    className: 'w-6 h-6 text-muted-foreground',
                  })}
                </div>
              </>
            ) : (
              <div className="bg-background size-12 grid place-items-center rounded-xl shadow-lg ring-1 ring-border group-hover:-translate-y-0.5 transition duration-500 group-hover:duration-200">
                {icons[0] &&
                  React.createElement(icons[0], {
                    className: 'w-6 h-6 text-muted-foreground',
                  })}
              </div>
            )}
          </div>
        )}

        <div>
          <h2 className="text-foreground font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{description}</p>
        </div>

        {action && (
          <Button onClick={action.onClick} variant="outline" className={cn('mt-4', 'shadow-sm active:shadow-none')}>
            {action.label}
          </Button>
        )}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';

export { EmptyState };
