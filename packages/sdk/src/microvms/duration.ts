/**
 * A duration in milliseconds, or a string such as `'500ms'`, `'30s'`, `'10m'`
 * or `'2h'`.
 *
 * Unlike queue durations, a bare number here is **milliseconds**, matching the
 * `timeoutMs` fields of the microVM API.
 */
export type MicroVmDuration = number | `${number}${'ms' | 's' | 'm' | 'h'}`;

const PATTERN = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h)$/;
const UNIT_MS = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 } as const;

/**
 * Converts a {@link MicroVmDuration} to whole milliseconds, rounding up.
 *
 * @throws {RangeError} When the value is negative, not finite, or not a recognised duration string.
 *
 * @example
 * ```ts
 * durationToMs('10m'); // 600000
 * durationToMs(1500); // 1500
 * ```
 */
export const durationToMs = (value: MicroVmDuration): number => {
  let ms: number;
  if (typeof value === 'number') {
    ms = value;
  } else {
    const match = PATTERN.exec(value.trim());
    if (!match)
      throw new RangeError(`Invalid duration "${value}". Use milliseconds or a string such as 30s, 10m or 2h.`);
    ms = Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
  }
  if (!Number.isFinite(ms) || ms < 0) throw new RangeError(`Invalid duration "${String(value)}"`);
  return Math.ceil(ms);
};

/** The longest lifetime a microVM can have: 24 hours (plans may allow less). */
export const MICROVM_MAX_TIMEOUT_MS = 24 * 3_600_000;

/**
 * Converts a microVM lifetime to milliseconds and checks it is between 1 ms
 * and {@link MICROVM_MAX_TIMEOUT_MS}.
 *
 * @throws {RangeError} When the duration is invalid, zero or longer than 24 hours.
 * @internal
 */
export const microvmTimeoutMs = (value: MicroVmDuration): number => {
  const ms = durationToMs(value);
  if (ms < 1 || ms > MICROVM_MAX_TIMEOUT_MS) {
    throw new RangeError(`A microVM timeout must be between 1 ms and 24 hours (got ${String(value)}).`);
  }
  return ms;
};

/** Resolves after `ms`, or rejects with the signal's reason as soon as `signal` aborts. @internal */
export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/** The abort reason as an `Error`, so it can be rethrown. @internal */
export const abortReason = (signal: AbortSignal | undefined): Error => {
  const reason: unknown = signal?.reason;
  if (reason instanceof Error) return reason;
  const error = new Error(typeof reason === 'string' ? reason : 'The operation was aborted');
  error.name = 'AbortError';
  return error;
};
