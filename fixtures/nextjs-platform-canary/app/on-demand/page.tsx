import { revalidatePath } from 'next/cache';
import { getOnDemandValue, incrementOnDemandValue } from './state';

async function mutateOnDemandPage() {
  'use server';
  await Promise.resolve(incrementOnDemandValue());
  revalidatePath('/on-demand');
}

/**
 * Renders the mutable static page and its invalidating Server Action.
 *
 * @returns The on-demand revalidation canary UI.
 * @example
 * ```tsx
 * <OnDemandPage />
 * ```
 */
export default function OnDemandPage() {
  return (
    <main>
      <h1>On-demand revalidation</h1>
      <output id="on-demand-value">{getOnDemandValue()}</output>
      <form action={mutateOnDemandPage}>
        <button type="submit">Mutate and revalidate</button>
      </form>
    </main>
  );
}
