import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const baseUrl = process.env.CANARY_URL?.replace(/\/$/, '');
assert(baseUrl, 'CANARY_URL is required');
const skipPlatformImage = process.env.CANARY_SKIP_PLATFORM_IMAGE === 'true';

const request = async (pathname, init) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
    ...init,
  });
  const body = await response.text();
  assert.equal(response.ok, true, `${pathname} returned ${response.status}: ${body.slice(0, 500)}`);
  return { response, body };
};

const requestJson = async (pathname, init) => {
  const { response, body } = await request(pathname, init);
  return { response, body, json: JSON.parse(body) };
};

const token = (body, id) => {
  const match = body.match(new RegExp(`<output[^>]+id=["']${id}["'][^>]*>([^<]+)</output>`));
  assert(match, `Missing #${id} in response`);
  return match[1];
};

const eventually = async (label, operation, predicate, maxAttempts = 20) => {
  let latest;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      latest = await operation();
      if (predicate(latest)) return latest;
    } catch (error) {
      latest = error instanceof Error ? error.message : String(error);
    }
    if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  assert.fail(`${label} did not converge; last value: ${String(latest)}`);
};

const measureStream = (pathname) =>
  new Promise((resolve, reject) => {
    const started = performance.now();
    const transportRequest = baseUrl.startsWith('https:') ? httpsRequest : httpRequest;
    const req = transportRequest(`${baseUrl}${pathname}`, { headers: { accept: 'text/html' } }, (response) => {
      let firstByte;
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        firstByte ??= performance.now();
        body += chunk;
      });
      response.on('end', () => {
        resolve({
          status: response.statusCode,
          firstByteMs: (firstByte ?? performance.now()) - started,
          totalMs: performance.now() - started,
          body,
        });
      });
    });
    req.setTimeout(15_000, () => req.destroy(new Error('PPR request timed out')));
    req.on('error', reject);
    req.end();
  });

await eventually(
  'deployment routing',
  async () => {
    try {
      return (await requestJson('/api/node')).json.runtime;
    } catch {
      return null;
    }
  },
  (value) => value === 'nodejs',
  60
);

assert.deepEqual((await requestJson('/api/node')).json, { runtime: 'nodejs', route: 'app' });
assert.deepEqual((await requestJson('/api/edge')).json, { runtime: 'edge', route: 'pages-api' });
assert.deepEqual((await requestJson('/api/after')).json, { after: 'registered' });
assert.deepEqual((await requestJson('/api/legacy')).json, { router: 'pages-api' });
assert.match((await request('/legacy')).body, /id="legacy-page"[^>]*>pages</);

const middleware = await request('/middleware-source');
assert.equal(middleware.response.headers.get('x-canary-middleware'), 'rewritten');
assert.match(middleware.body, /middleware-rewrite-ok/);

const rsc = await request('/?canary-rsc=1', { headers: { RSC: '1' } });
assert.match(rsc.response.headers.get('content-type') ?? '', /text\/x-component/);

const firstIsr = token((await request('/isr')).body, 'isr-token');
const secondIsr = token((await request('/isr')).body, 'isr-token');
assert.equal(secondIsr, firstIsr, 'ISR changed without revalidation');

const firstCacheComponent = token((await request('/cache-components')).body, 'cache-component-token');
const secondCacheComponent = token((await request('/cache-components')).body, 'cache-component-token');
assert.equal(secondCacheComponent, firstCacheComponent, 'Cache Component changed without revalidation');

assert.deepEqual(
  (await requestJson('/api/revalidate', { method: 'POST' })).json,
  { cacheComponentRevalidated: true },
  'Cache Component revalidation failed'
);
assert.deepEqual(
  (await requestJson('/api/revalidate-isr', { method: 'POST' })).json,
  { isrRevalidated: true },
  'Pages ISR revalidation failed'
);

const revalidatedIsr = await eventually(
  'ISR revalidation',
  async () => token((await request('/isr', { headers: { 'cache-control': 'no-cache' } })).body, 'isr-token'),
  (value) => value !== firstIsr
);
assert.equal(
  token((await request('/isr')).body, 'isr-token'),
  revalidatedIsr,
  'The CDN retained an invalidated ISR response'
);
const revalidatedCacheComponent = await eventually(
  'Cache Component revalidation',
  async () =>
    token(
      (await request('/cache-components', { headers: { 'cache-control': 'no-cache' } })).body,
      'cache-component-token'
    ),
  (value) => value !== firstCacheComponent
);
assert.equal(
  token((await request('/cache-components')).body, 'cache-component-token'),
  revalidatedCacheComponent,
  'The CDN retained an invalidated Cache Component response'
);

const actionPage = await request('/actions');
const actionName = actionPage.body.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
assert(actionName, 'Server Action identifier was not rendered');
const actionBody = new FormData();
actionBody.set(actionName, '');
actionBody.set('message', 'canary-action');
const actionResult = await request('/actions', {
  method: 'POST',
  headers: { origin: baseUrl },
  body: actionBody,
});
assert.equal(new URL(actionResult.response.url).searchParams.get('result'), 'canary-action');
assert.match(actionResult.body, /action-result/);
assert.match(actionResult.body, /canary-action/);

if (!skipPlatformImage) {
  const imageAlias = await fetch(`${baseUrl}/_next/image?url=%2Fcanary.png&w=64&q=75`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(imageAlias.status, 308, 'Next image alias did not canonicalize');
  const imageLocation = imageAlias.headers.get('location');
  assert(imageLocation?.includes('/_gigadrive/image/'), 'Next image alias returned a non-canonical location');
  const image = await fetch(imageLocation, {
    headers: { accept: 'image/avif,image/webp,image/*' },
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(image.ok, true, `Canonical image returned ${image.status}`);
  assert.match(image.headers.get('content-type') ?? '', /^image\//);
  assert.equal(image.headers.get('x-gigadrive-image-source'), 'local');
  assert((await image.arrayBuffer()).byteLength > 0, 'Canonical image response was empty');
}

const ppr = await measureStream(`/ppr?probe=${crypto.randomUUID()}`);
assert.equal(ppr.status, 200, `PPR returned ${String(ppr.status)}`);
assert.match(ppr.body, /shell-ready/);
assert.match(ppr.body, /dynamic-/);
assert(ppr.totalMs >= 1_200, `PPR dynamic region was not delayed (${ppr.totalMs.toFixed(0)}ms total)`);
assert(
  ppr.firstByteMs <= ppr.totalMs - 800,
  `PPR shell was buffered (${ppr.firstByteMs.toFixed(0)}ms TTFB, ${ppr.totalMs.toFixed(0)}ms total)`
);

console.log(
  JSON.stringify(
    {
      deployment: baseUrl,
      ppr: { firstByteMs: Math.round(ppr.firstByteMs), totalMs: Math.round(ppr.totalMs) },
      checks: [
        'node-runtime',
        'edge-runtime',
        'after',
        'pages-router',
        'middleware',
        'rsc',
        'isr',
        'cache-components',
        'server-actions',
        ...(skipPlatformImage ? [] : ['image-optimization']),
        'ppr-streaming',
      ],
    },
    null,
    2
  )
);
