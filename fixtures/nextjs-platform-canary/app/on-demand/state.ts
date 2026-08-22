const state = globalThis as typeof globalThis & {
  gigadriveOnDemandValue?: number;
};

/**
 * Reads the process-local value rendered by the on-demand page.
 *
 * @returns The current canary value, defaulting to zero.
 * @example
 * ```ts
 * getOnDemandValue(); // 0 in a fresh process
 * ```
 */
export const getOnDemandValue = () => state.gigadriveOnDemandValue ?? 0;

/**
 * Increments the process-local value rendered by the on-demand page.
 *
 * @returns The incremented canary value.
 * @example
 * ```ts
 * incrementOnDemandValue(); // 1 in a fresh process
 * ```
 */
export const incrementOnDemandValue = () => {
  state.gigadriveOnDemandValue = getOnDemandValue() + 1;
  return state.gigadriveOnDemandValue;
};
