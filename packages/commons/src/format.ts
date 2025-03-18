/**
 * Converts a file size from bytes to a human-readable string.
 *
 * @param {number} bytes - The file size in bytes.
 * @returns {string} A string representing the file size in the most appropriate unit (B, KB, MB, GB, etc.).
 *
 * @example
 *
 * // Returns "117.74 MB"
 * formatFileSize(123456789);
 *
 * @example
 *
 * // Returns "1 GB"
 * formatFileSize(1073741824);
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}
