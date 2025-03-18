/**
 * Get a random integer between two numbers.
 *
 * @param min - The minimum number
 * @param max - The maximum number
 * @returns A random integer between the two numbers
 */
export const randomIntInRange = (min: number, max: number): number => {
  if (min > max) {
    throw new Error('Minimum number is greater than maximum number');
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
};
