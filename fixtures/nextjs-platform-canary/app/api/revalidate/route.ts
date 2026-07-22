import { revalidateTag } from 'next/cache';

export function POST() {
  revalidateTag('canary-cache-component', { expire: 0 });
  return Response.json({ cacheComponentRevalidated: true });
}
