/**
 * Deeply merges a partial object into a target object.
 *
 * This function recursively merges properties from the partial object into the target object.
 * Arrays are concatenated, objects are recursively merged, and primitive values are overwritten.
 *
 * @param target - The target object to merge into
 * @param partial - The partial object containing properties to merge
 * @returns The modified target object with merged properties
 */
export const deepMerge = <T extends object>(target: T, ...partials: Partial<T>[]): T => {
  const isObject = (item: unknown): item is object => item !== null && typeof item === 'object';

  if (!isObject(target)) {
    return target as T;
  }

  for (const partial of partials) {
    if (!isObject(partial)) {
      continue;
    }

    Object.keys(partial).forEach((key) => {
      if (key === '__proto__' || key === 'constructor') return;
      const targetValue = target[key as keyof T];
      const sourceValue = partial[key as keyof T];

      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        (targetValue as unknown[]).push(...(sourceValue as unknown[]));
      } else if (isObject(targetValue) && isObject(sourceValue)) {
        deepMerge(targetValue, sourceValue);
      } else {
        (target as Record<string, unknown>)[key] = sourceValue;
      }
    });
  }

  return target;
};
