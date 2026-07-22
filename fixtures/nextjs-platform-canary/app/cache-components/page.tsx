import { cacheLife, cacheTag } from 'next/cache';

// Cache Components use an async boundary so Next can persist their streamed value.
// eslint-disable-next-line @typescript-eslint/require-await
async function CachedValue() {
  'use cache';
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag('canary-cache-component');
  return <output id="cache-component-token">{`${Date.now()}-${crypto.randomUUID()}`}</output>;
}

export default function CacheComponentsPage() {
  return (
    <main>
      <h1>Cache Components</h1>
      <CachedValue />
    </main>
  );
}
