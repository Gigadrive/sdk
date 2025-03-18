/**
 * Sleep for a given amount of time
 * @param ms The amount of time to sleep in milliseconds
 * @returns
 */
export const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
