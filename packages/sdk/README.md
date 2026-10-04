# @gigadrive/sdk

The official TypeScript SDK for the [Gigadrive Network](https://gigadrive.de) cloud
platform — organizations, applications, deployments, storage with resumable file
uploads, and an OpenAI-compatible AI Gateway.

Works in Node.js 18+, browsers, and edge runtimes (anything with `fetch`).

## Installation

```bash
npm install @gigadrive/sdk
# or: pnpm add @gigadrive/sdk
```

## Quick start

```ts
import { GigadriveClient } from '@gigadrive/sdk';

// Credentials are auto-detected from the environment (see below),
// or pass them explicitly.
const client = new GigadriveClient({
  clientId: process.env.GIGADRIVE_CLIENT_ID,
  clientSecret: process.env.GIGADRIVE_CLIENT_SECRET,
});

const { items: organizations } = await client.organizations.list();
const { items: applications } = await client.applications.list();
```

## Organizations and product entitlements

Organizations are the top-level account containers for Gigadrive products.
Beyond listing orgs, the SDK can create organizations, inspect members, and
check product entitlements (read-only; the SDK does not activate or change plans):

```ts
// Create an organization (user-backed token + platform:organizations:write)
const org = await client.organizations.create({ name: 'Acme Corp' });

// Fetch one organization and its members
const details = await client.organizations.get(org.id);
const { items: members } = await client.organizations.members.list(org.id);

// Inspect product access / entitlements (read-only)
const { items: products } = await client.organizations.products.list(org.id);
const office = await client.organizations.products.get(org.id, 'office');
const check = await client.organizations.products.checkEntitlement(org.id, 'office');

console.log(details.name, members.length, office.hasAccess, check.hasAccess, products.length);
```

## Authentication

Authentication is handled for you — tokens are fetched, cached, and refreshed
behind the scenes. Provide credentials via the constructor or environment
variables (constructor values take precedence):

| Method                       | Constructor                       | Environment                                       |
| ---------------------------- | --------------------------------- | ------------------------------------------------- |
| API key (machine-to-machine) | `clientId` + `clientSecret`       | `GIGADRIVE_CLIENT_ID` + `GIGADRIVE_CLIENT_SECRET` |
| Pre-obtained bearer token    | `bearerToken`                     | `GIGADRIVE_BEARER_TOKEN`                          |
| Refresh token                | `clientId` + `refreshToken`       | `GIGADRIVE_CLIENT_ID` + `GIGADRIVE_REFRESH_TOKEN` |
| Authorization code + PKCE    | `clientId` + `onAuthorizationUrl` | —                                                 |

Context-bound storage calls also resolve an application UUID from
`applicationId` in the constructor or `GIGADRIVE_APPLICATION_ID`. Gigadrive
injects the latter with workload credentials, so deployed server code normally
needs no SDK configuration.

```ts
// Custom fetch / base URL (e.g. for tests or non-standard runtimes)
const client = new GigadriveClient({ bearerToken: 'eyJ...', fetch: myFetch });
```

## Sticky sessions

Deployed MicroVM functions can mint a routing URL that keeps the same opaque
application key on one function instance. Workload credentials are injected by
the platform, so no SDK configuration is required inside a deployment:

```ts
import { GigadriveClient } from '@gigadrive/sdk';

const gigadrive = new GigadriveClient();
const { url, expiresAt } = await gigadrive.stickySessions.createUrl({
  key: gameId,
  endpoint: '/socket',
  expiresInSeconds: 14_400,
});

const socket = new WebSocket(url);
```

The URL is routing authority, not user authentication. Applications still own
authorization and room membership. State remains in one MicroVM's memory, URLs
expire, and deploys do not migrate that in-memory state to a new version.

## File storage

Bucket `name` is the canonical REST and IaC identifier. Names are immutable,
lowercase, URL-safe, and unique within an environment. The returned bucket
`slug` remains the global CDN/S3 identifier and should not be passed to these
REST helpers.

Declare buckets for each deployment environment under `services.storage` in
`gigadrive.yaml`. Mapping keys are the canonical bucket names; `null` or an
empty object uses private visibility. The deployment determines the environment
and generates each global CDN/S3 slug.

```yaml
version: 4
services:
  storage:
    buckets:
      assets:
        visibility: public
      uploads: null
```

Inside a deployed workload, application and environment context are inferred:

```ts
import { GigadriveClient } from '@gigadrive/sdk';

const client = new GigadriveClient();
const { items } = await client.storage.objects.list('assets');
```

Management callers can configure the application and select an environment by
slug or UUID:

```ts
const client = new GigadriveClient({ applicationId, clientId, clientSecret });
const bucket = await client.storage.buckets.create({
  name: 'assets',
  environment: 'production',
  visibility: 'public',
});

const { items } = await client.storage.objects.list(bucket.name, {
  environment: 'production',
});
```

Existing `client.applications.storage` calls, explicit `applicationId`
arguments, and bucket UUIDs remain available as deprecated compatibility
paths.

### File uploads

The high-level `upload()` computes the required SHA-256 checksum, infers the
content type from the key, creates the upload session, and uploads the bytes
with resumable transfer — in one call.

```ts
// Node.js — upload straight from a file path (size, checksum, type inferred)
const { url } = await client.storage.upload({
  bucket: 'reports',
  key: 'reports/q1.pdf',
  path: './q1-report.pdf',
});

// Browser — upload a File with progress and cancellation
const controller = new AbortController();
const { url } = await client.storage.upload({
  bucket: 'uploads',
  key: `uploads/${file.name}`,
  data: file,
  onProgress: (sent, total) => console.log(`${Math.round((sent / total) * 100)}%`),
  signal: controller.signal,
});

// Wait until the object is finalized server-side, then read it back
const { object } = await client.storage.upload({
  bucket: 'avatars',
  key: 'avatars/user-1.png',
  data: bytes,
  waitForCompletion: true,
});
console.log(object?.contentLength, 'bytes stored');
```

Accepted inputs: browser `File`/`Blob`, Node `Buffer`/`Uint8Array`/`ArrayBuffer`,
a Node filesystem `path`, or a Node readable `stream` (with `contentLength` and
`checksumSha256`).

Empty files such as `.gitkeep` or `__init__.py` work with every input kind. The
API stores a zero-byte object when the upload session is created, so nothing is
transferred, `waitForCompletion` returns without polling, and the result always
includes `object`. For an empty `stream`, pass `contentLength: 0`; the empty
SHA-256 is filled in for you.

#### Many files at once

```ts
const results = await client.storage.uploadBatch(
  files.map((f) => ({ bucket: 'uploads', key: f.name, data: f })),
  { concurrency: 6, onProgress: (done, total) => console.log(`${done}/${total}`) }
);
const failed = results.filter((r) => r.error);
```

### Working with objects and trash

```ts
// List a "folder" one level deep
const { items, commonPrefixes } = await client.storage.objects.list('assets', {
  prefix: 'images/',
  limit: 100,
});

// Signed download URL for a private object
const { url } = await client.storage.objects.getAccessUrl('assets', objectId, {
  expiresInSeconds: 3600,
});

// Delete moves an object to trash; restore or permanently purge it later
await client.storage.objects.delete('assets', objectId);
await client.storage.trash.restore('assets', objectId);
await client.storage.trash.purge('assets', objectId);

// Permanently purge every trashed object in the bucket
const { purgedCount } = await client.storage.trash.empty('assets');
```

## AI Gateway

OpenAI-compatible chat completions, responses, audio, video, and model discovery.

```ts
// Chat completion
const res = await client.aiGateway.chatCompletions({
  model: 'openai/gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(res.choices[0].message.content);

// Streaming
for await (const chunk of client.aiGateway.chatCompletionsStream({
  model: 'openai/gpt-4o',
  messages: [{ role: 'user', content: 'Write a haiku about the sea.' }],
})) {
  process.stdout.write(chunk.choices[0]?.delta.content ?? '');
}

// Models
const { items: models } = await client.aiGateway.listModels();
```

Organization-scoped governance (usage analytics, budgets, policies) lives under
`client.organizations.aiGateway`.

## Custom domains

Attach a hostname you own to an application. The response lists the DNS records to publish; Gigadrive
Network then verifies ownership, checks DNS and issues the certificate on its own.

```ts
import { DomainNotActiveError } from '@gigadrive/sdk';

const domain = await client.applications.domains.add('app-id', { hostname: 'shop.example.com' });
for (const record of domain.requiredRecords) {
  console.log(record.type, record.host, record.value);
}

try {
  await client.applications.domains.waitUntilActive('app-id', domain.id, {
    timeoutMs: 15 * 60_000,
    onState: (current) => console.log(current.state),
  });
} catch (error) {
  if (!(error instanceof DomainNotActiveError)) throw error;
  // `reason` is `timeout`, `failed`, `suspended` or `removing`; `domain.error` explains what to fix.
  console.error(error.reason, error.domain.error?.message);
}
```

Redirect a domain, or serve a branch instead of production:

```ts
await client.applications.domains.update('app-id', domain.id, {
  target: { type: 'redirect', to: 'www.example.com', statusCode: 308 },
});
```

Verifying the registrable domain once lets every application of the organization attach hostnames
below it without another TXT record:

```ts
const claim = await client.organizations.domains.add('org-id', 'example.com');
console.log(claim.record.host, claim.record.value); // publish this TXT record
await client.organizations.domains.verify('org-id', claim.id);
```

## Queues

Queues deliver work to your app in the background, now or later. A queue with a consumer path is a push queue: Gigadrive Network POSTs each message to that path on your deployment. Without one it is a pull queue that you drain with `receive()`.

```ts
import { NonRetryableError, queue, RetryLaterError } from '@gigadrive/sdk';

export const emails = queue<{ to: string; template: string }>('emails');

// Send now, after a delay, or at a time (up to a year ahead).
await emails.send({ to: 'jane@example.com', template: 'welcome' });
await emails.send({ to: 'jane@example.com', template: 'nudge' }, { delay: '3d', deduplicationKey: 'nudge:jane' });

// app/api/queues/emails/route.ts: the push consumer. Signatures are verified for you.
export const POST = emails.handler(async (email, { attempt }) => {
  if (!templates.has(email.template)) throw new NonRetryableError('Unknown template'); // dead-letter now
  if (await mailer.isThrottled()) throw new RetryLaterError('1m'); // defer without spending an attempt
  await mailer.send(email); // returning acknowledges the message
});
```

Declare the push consumer and any cron schedules in `gigadrive.yaml`, or create them from code with `emails.ensure({ consumerPath: '/api/queues/emails' })` and `emails.schedule(...)`.

Pull consumers lease messages and settle them:

```ts
const jobs = queue<{ id: string }>('jobs');

await jobs.consume(async (job) => processJob(job.id), { maxMessages: 10, stopWhenEmpty: true });
```

`client.queues` exposes the full REST surface (queues, messages, dead letters, schedules), and `createWorkflowQueue()` runs the [Workflow SDK](https://workflow-sdk.dev) on Gigadrive Network queues.

## Pagination

List endpoints accept `page` / `perPage` / `cursor` and return `{ items, total }`
(cursor-paginated endpoints also return `nextCursor`). Iterate everything with
the `paginate` helper:

```ts
import { paginate } from '@gigadrive/sdk';

for await (const object of paginate((cursor) => client.storage.objects.list('assets', { cursor }))) {
  console.log(object.key);
}
```

## Errors

All errors extend `GigadriveError`. Notable subclasses: `ApiError` (with `status`
and optional `code`), `AuthenticationError`, `ConfigurationError`, `UploadError`, and
`UploadSessionExpiredError`.

```ts
import { ApiError } from '@gigadrive/sdk';

try {
  await client.deployments.get('missing');
} catch (err) {
  if (err instanceof ApiError) console.error(err.status, err.message);
}
```

## License

Apache-2.0
