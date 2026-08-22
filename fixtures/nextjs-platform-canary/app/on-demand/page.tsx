import { revalidatePath } from 'next/cache';
import { getOnDemandValue, incrementOnDemandValue } from './state';

async function mutateOnDemandPage() {
  'use server';
  await Promise.resolve(incrementOnDemandValue());
  revalidatePath('/on-demand');
}

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
