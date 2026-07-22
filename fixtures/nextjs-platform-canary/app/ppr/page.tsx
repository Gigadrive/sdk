import { connection } from 'next/server';
import { Suspense } from 'react';

async function DynamicRegion() {
  await connection();
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  return <output id="ppr-dynamic">dynamic-{crypto.randomUUID()}</output>;
}

export default function PprPage() {
  return (
    <main>
      <h1>PPR</h1>
      <output id="ppr-shell">shell-ready</output>
      <Suspense fallback={<output id="ppr-fallback">dynamic-pending</output>}>
        <DynamicRegion />
      </Suspense>
    </main>
  );
}
