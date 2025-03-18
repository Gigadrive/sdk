/**
 * Returns a default value if the input string is null, undefined, empty or only whitespace.
 * Otherwise returns the input value.
 *
 * @param value - The input string value to check
 * @param defaultValue - The default value to return if input is empty/invalid
 * @returns The input value if valid, otherwise the default value
 * @typeParam T - The enum type that extends string
 */
export const enumDefault = <T extends string>(value: string | null | false | undefined, defaultValue: T): T => {
  if (value == null || value === false || value === '' || value.trim() === '') {
    return defaultValue;
  }

  return value as T;
};
