import { cn } from '@/lib/utils';
import * as React from 'react';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current value, clamped to [0, max]. */
  value?: number;
  /** Maximum value. @default 100 */
  max?: number;
  /** Tone of the fill. @default 'primary' */
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  /** Height of the bar. @default 'default' */
  size?: 'sm' | 'default' | 'lg';
  /** Optional accessible label announced by screen readers. */
  label?: string;
}

const SIZE_CLASSES = {
  sm: 'h-1',
  default: 'h-2',
  lg: 'h-3',
} as const;

const TONE_CLASSES = {
  // fill-gloss carries the glossy brand-green recipe; other tones re-tint it.
  primary: 'fill-gloss',
  success: 'fill-gloss !bg-success',
  warning: 'fill-gloss !bg-warning-fill',
  danger: 'fill-gloss !bg-danger',
} as const;

/**
 * Tactile progress bar: recessed `.well` track with a glossy `.fill-gloss` fill.
 */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, tone = 'primary', size = 'default', label, ...props }, ref) => {
    const clamped = Math.min(Math.max(value, 0), max);
    const percentage = max > 0 ? (clamped / max) * 100 : 0;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-label={label}
        className={cn('well w-full overflow-hidden rounded-full bg-muted', SIZE_CLASSES[size], className)}
        {...props}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300 ease-out', TONE_CLASSES[tone])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
