/**
 * Converts an object to a URL query string.
 *
 * @param obj - The object to convert to a query string. Can be undefined or a record of key-value pairs.
 * @returns A string starting with '?' followed by the encoded key-value pairs joined with '&'.
 *          Returns an empty string if the input object is undefined or empty.
 *
 * @example
 * // Returns "?name=John&age=30"
 * objectToQueryString({ name: "John", age: 30 });
 *
 * @example
 * // Returns "?name=John" (undefined values are skipped)
 * objectToQueryString({ name: "John", age: undefined });
 *
 * @example
 * // Returns ""
 * objectToQueryString(undefined);
 */
export const objectToQueryString = (obj: undefined | Record<string, string | number | boolean | null | undefined>) => {
  if (!obj) {
    return '';
  }

  const queryParts = Object.keys(obj)
    .map((key) => {
      if (obj[key] === undefined) {
        return '';
      }

      return `${encodeURIComponent(key)}=${encodeURIComponent(String(obj[key]))}`;
    })
    .filter(Boolean);

  return queryParts.length ? '?' + queryParts.join('&') : '?';
};
