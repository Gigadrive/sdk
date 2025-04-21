/**
 * Executes promises with a concurrency limit, similar to Promise.all but with controlled parallelism.
 *
 * @param promises - An iterable of promises to execute
 * @param concurrencyLimit - Maximum number of promises to execute simultaneously (default: Infinity)
 * @returns A promise that resolves to an array of all the results
 *
 * @example
 * // Execute 3 promises at a time
 * const results = await all([promise1, promise2, promise3, promise4, promise5], 3);
 *
 * @example
 * // Execute all promises simultaneously (same as Promise.all)
 * const results = await all([promise1, promise2, promise3]);
 */
export async function all<T>(promises: Iterable<Promise<T> | T>, concurrencyLimit: number = Infinity): Promise<T[]> {
  // Handle invalid concurrency limit
  if (concurrencyLimit <= 0) {
    throw new Error('Concurrency limit must be greater than 0');
  }

  // Convert iterable to array for easier handling
  const items = [...promises];

  // If no items or concurrency is Infinity, use native Promise.all for performance
  if (items.length === 0 || concurrencyLimit === Infinity) {
    return Promise.all(items);
  }

  const results: T[] = new Array(items.length);
  let currentIndex = 0;
  let completedCount = 0;

  // Create a promise that will resolve when all items are processed
  return new Promise((resolve, reject) => {
    // Start initial batch of promises (up to concurrency limit)
    const initialBatch = Math.min(concurrencyLimit, items.length);
    for (let i = 0; i < initialBatch; i++) {
      processNext();
    }

    function processNext() {
      const index = currentIndex++;

      // If we've started processing all items, we're done launching new ones
      if (index >= items.length) return;

      // Process the promise at the current index
      Promise.resolve(items[index])
        .then((result) => {
          results[index] = result;
          completedCount++;

          // If all promises are done, resolve the main promise
          if (completedCount === items.length) {
            resolve(results);
          } else {
            // Otherwise process the next item
            processNext();
          }
        })
        .catch((error) => {
          // If any promise rejects, reject the main promise
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    }
  });
}
