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
resumably — in one call.

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
