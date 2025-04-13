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
export const deepMerge = <T extends object>(target: T, partial: Partial<T>): T => {
  const isObject = (item: any): item is object => item !== null && typeof item === 'object';

  if (!isObject(target) || !isObject(partial)) {
    return target as T;
  }

  Object.keys(partial).forEach((key) => {
    if (key === "__proto__" || key === "constructor") return;
    const targetValue = target[key as keyof T];
    const sourceValue = partial[key as keyof T];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      (targetValue as any[]).push(...(sourceValue as any[])); // Ensure targetValue is treated as any[]
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      deepMerge(targetValue, sourceValue);
    } else {
      (target as any)[key] = sourceValue; // Use type assertion to allow assignment
    }
  });

  return target;
};
