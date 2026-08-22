import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Invalidates the canary's tag-backed and path-backed cache entries.
 *
 * @param request - Request carrying the canary bearer credential.
 * @returns An unauthorized response or the invalidation result.
 * @example
 * ```ts
 * await fetch('/api/revalidate', {
 *   method: 'POST',
 *   headers: { authorization: `Bearer ${process.env.CANARY_REVALIDATE_SECRET}` },
 * });
 * ```
 */
export function POST(request: Request) {
  const secret = process.env.CANARY_REVALIDATE_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidateTag('canary-cache-component', { expire: 0 });
  revalidatePath('/on-demand');
  return Response.json({ cacheComponentRevalidated: true, onDemandPathRevalidated: true });
}
