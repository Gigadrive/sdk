/** Differences below this are ordinary timer noise, not a clock that fell behind. */
const NEGLIGIBLE_LAG_MS = 1_000;

/**
 * How far Next's clock trails the wall clock.
 *
 * Next measures cache age with `performance.timeOrigin + performance.now()`,
 * which is built on the monotonic clock. A process resumed from a snapshot keeps
 * its monotonic clock from before the pause, while the wall clock is corrected,
 * so Next's clock falls behind by every moment spent paused. An entry stamped
 * with the wall clock then looks newer than it is and never goes stale.
 *
 * Stored timestamps use the wall clock, because other processes read them.
 * Anything handed to Next is shifted onto its clock by this amount.
 */
export const nextClockLagMs = (): number => {
  const lag = Date.now() - (performance.timeOrigin + performance.now());
  return Math.abs(lag) < NEGLIGIBLE_LAG_MS ? 0 : lag;
};
