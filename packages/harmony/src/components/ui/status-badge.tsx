import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const statusBadgeVariants = cva('inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium', {
  variants: {
    variant: {
      /** Raised chip on a card surface — the default status pill. */
      chip: 'raised rounded-full border border-border bg-card px-2 py-0.5',
      /** Tinted pill for states that should shout (e.g. Failed). */
      soft: 'rounded-full border px-2 py-0.5',
      /** Dot + text only, for dense table cells. */
      plain: '',
    },
    tone: {
      success: '',
      warning: '',
      danger: '',
      info: '',
      neutral: 'text-muted-foreground',
    },
  },
  compoundVariants: [
    { variant: 'soft', tone: 'success', className: 'bg-success-soft text-success border-success/25' },
    { variant: 'soft', tone: 'warning', className: 'bg-warning-soft text-warning border-warning/25' },
    { variant: 'soft', tone: 'danger', className: 'bg-danger-soft text-danger border-danger/25' },
    { variant: 'soft', tone: 'info', className: 'bg-info-soft text-info border-info/25' },
    { variant: 'soft', tone: 'neutral', className: 'bg-muted text-muted-foreground border-border' },
    { variant: 'plain', tone: 'danger', className: 'text-danger' },
  ],
  defaultVariants: {
    variant: 'chip',
    tone: 'neutral',
  },
});

const DOT_TONE_CLASSES: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  success: 'bg-success',
  // warning-fill: vivid amber — the text-contrast --warning reads as ochre as a fill
  warning: 'bg-warning-fill',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-muted-foreground/50',
};

const DOT_GLOW_CLASSES: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  success: 'shadow-[0_0_5px_hsl(var(--success)/0.6)]',
  warning: 'shadow-[0_0_5px_hsl(var(--warning-fill)/0.6)]',
  danger: 'shadow-[0_0_5px_hsl(var(--danger)/0.6)]',
  info: 'shadow-[0_0_5px_hsl(var(--info)/0.6)]',
  neutral: '',
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusBadgeVariants> {
  /** Animate the dot for in-progress states (building, deploying, …). */
  pulse?: boolean;
  /** Soft glow behind the dot — reads well on dark surfaces for healthy/live states. */
  glow?: boolean;
  /** Hide the dot entirely (soft variant often reads better without it). */
  hideDot?: boolean;
}

/**
 * Status indicator with a colored dot — replaces the ad-hoc status pills used
 * across the Gigadrive apps (deployments, requests, connections, plans).
 *
 * - `variant="chip"` (default): raised bordered pill
 * - `variant="soft"`: tinted pill for prominent states such as failures
 * - `variant="plain"`: dot + label only, for dense table cells
 */
const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, variant, tone = 'neutral', pulse = false, glow = false, hideDot = false, children, ...props }, ref) => (
    <span ref={ref} className={cn(statusBadgeVariants({ variant, tone }), className)} {...props}>
      {!hideDot && (
        <span
          aria-hidden
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            DOT_TONE_CLASSES[tone ?? 'neutral'],
            glow && DOT_GLOW_CLASSES[tone ?? 'neutral'],
            pulse && 'animate-pulse'
          )}
        />
      )}
      {children}
    </span>
  )
);
StatusBadge.displayName = 'StatusBadge';

export { StatusBadge, statusBadgeVariants };
