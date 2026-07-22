import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

// React Server Actions must be declared async even when redirecting synchronously.
// eslint-disable-next-line @typescript-eslint/require-await
async function submitCanary(formData: FormData) {
  'use server';
  const message = formData.get('message');
  redirect(`/actions?result=${encodeURIComponent(typeof message === 'string' ? message : 'invalid')}`);
}

async function ActionResult({ searchParams }: Readonly<{ searchParams: Promise<{ result?: string }> }>) {
  await connection();
  const { result } = await searchParams;
  return result ? <output id="action-result">{result}</output> : null;
}

export default function ActionsPage({ searchParams }: Readonly<{ searchParams: Promise<{ result?: string }> }>) {
  return (
    <main>
      <h1>Server Actions</h1>
      <Suspense fallback={null}>
        <ActionResult searchParams={searchParams} />
      </Suspense>
      <form action={submitCanary}>
        <input name="message" defaultValue="canary-action" />
        <button type="submit">Submit</button>
      </form>
    </main>
  );
}
