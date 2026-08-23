import * as React from 'react';

import { cn } from '@/lib/utils';

export interface SettingsCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Footer content (save actions). Rendered in a muted bar under a top border. */
  footer?: React.ReactNode;
  /** Danger-zone styling: red-tinted border and title. */
  danger?: boolean;
}

/**
 * Settings section card — the console settings idiom as a shared component.
 * Compose field rows with {@link SettingsCardRow}; put save actions in `footer`
 * with a {@link SettingsCardStatus} on the left for dirty/saved state.
 *
 * @param title - Section heading rendered in the card header.
 * @param description - Optional helper text under the heading.
 * @param footer - Optional save-bar content, rendered in a muted bottom bar.
 * @param danger - Danger-zone styling (red-tinted border and title).
 * @returns The settings section card element.
 * @example
 * ```tsx
 * <SettingsCard
 *   title="Application details"
 *   footer={<><SettingsCardStatus state="unsaved" /><Button size="xs">Save</Button></>}
 * >
 *   <SettingsCardRow label="Name" htmlFor="name" description="Shown in the console.">
 *     <Input id="name" />
 *   </SettingsCardRow>
 * </SettingsCard>
 * ```
 */
const SettingsCard = React.forwardRef<HTMLDivElement, SettingsCardProps>(
  ({ className, title, description, footer, danger = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'card-tactile overflow-hidden rounded-xl border bg-card text-card-foreground',
        danger && 'border-danger/35',
        className
      )}
      {...props}
    >
      <div className={cn('p-5', children != null ? 'pb-1' : 'pb-4')}>
        <h3 className={cn('text-sm font-medium leading-none tracking-tight', danger && 'text-danger')}>{title}</h3>
        {description != null && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
      </div>
      {children != null && <div className="divide-y divide-border/70 px-5 pb-1">{children}</div>}
      {footer != null && (
        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-5 py-2.5">{footer}</div>
      )}
    </div>
  )
);
SettingsCard.displayName = 'SettingsCard';

export interface SettingsCardRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  description?: React.ReactNode;
  /** `id` of the control rendered in the row, for label association. */
  htmlFor?: string;
}

/**
 * Horizontal field row: label + description on the left, control on the right.
 *
 * @param label - Field label. Pass `htmlFor` matching the control's `id` so the
 *   label is associated for accessibility.
 * @param description - Optional helper text under the label.
 * @param htmlFor - `id` of the control rendered in the row.
 * @returns The field row element.
 */
const SettingsCardRow = React.forwardRef<HTMLDivElement, SettingsCardRowProps>(
  ({ className, label, description, htmlFor, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('grid grid-cols-1 items-center gap-2 py-4 sm:grid-cols-[1fr_240px] sm:gap-6', className)}
      {...props}
    >
      <div>
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {description != null && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
      </div>
      <div className="flex min-w-0 items-center sm:justify-end">{children}</div>
    </div>
  )
);
SettingsCardRow.displayName = 'SettingsCardRow';

export interface SettingsCardStatusProps extends React.HTMLAttributes<HTMLSpanElement> {
  state?: 'idle' | 'unsaved' | 'saving' | 'saved';
}

const STATUS_CONTENT: Record<NonNullable<SettingsCardStatusProps['state']>, { dot: string | null; text: string }> = {
  idle: { dot: null, text: '' },
  unsaved: { dot: 'bg-warning-fill', text: 'Unsaved changes' },
  saving: { dot: 'bg-info animate-pulse', text: 'Saving…' },
  saved: { dot: 'bg-success', text: 'Saved' },
};

/**
 * Dirty/saving/saved indicator for the footer of a {@link SettingsCard}.
 *
 * @param state - `idle` (renders nothing), `unsaved`, `saving` or `saved`.
 * @param children - Optional text override (e.g. "Saved 2 minutes ago").
 * @returns The status indicator element.
 * @example
 * ```tsx
 * <SettingsCardStatus state="saved">Saved 2 minutes ago</SettingsCardStatus>
 * ```
 */
const SettingsCardStatus = React.forwardRef<HTMLSpanElement, SettingsCardStatusProps>(
  ({ className, state = 'idle', children, ...props }, ref) => {
    const { dot, text } = STATUS_CONTENT[state];
    return (
      <span ref={ref} className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)} {...props}>
        {dot != null && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dot)} />}
        {children ?? text}
      </span>
    );
  }
);
SettingsCardStatus.displayName = 'SettingsCardStatus';

export { SettingsCard, SettingsCardRow, SettingsCardStatus };
