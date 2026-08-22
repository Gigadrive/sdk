import { revalidatePath, revalidateTag } from 'next/cache';

export function POST() {
  revalidateTag('canary-cache-component', { expire: 0 });
  revalidatePath('/on-demand');
  return Response.json({ cacheComponentRevalidated: true, onDemandPathRevalidated: true });
}
