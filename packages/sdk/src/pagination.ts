import type { Paginated } from './http-client';

/**
 * Lazily iterate every item across all pages of a cursor-paginated endpoint.
 * Pass a function that fetches one page for a given cursor; iteration stops when
 * the API stops returning a `nextCursor`.
 *
 * @typeParam T - The item type.
 * @param fetchPage - Fetches a single page for the given cursor (`undefined` for the first page).
 *
 * @example
 * ```ts
 * for await (const object of paginate((cursor) =>
 *   client.applications.storage.objects.list('app-id', 'bucket-id', { cursor }),
 * )) {
 *   console.log(object.key);
 * }
 * ```
 */
export async function* paginate<T>(
  fetchPage: (cursor: string | undefined) => Promise<Paginated<T>>
): AsyncGenerator<T> {
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    for (const item of page.items) {
      yield item;
    }
    cursor = page.nextCursor;
  } while (cursor);
}
