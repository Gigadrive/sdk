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

```ts
// Custom fetch / base URL (e.g. for tests or non-standard runtimes)
const client = new GigadriveClient({ bearerToken: 'eyJ...', fetch: myFetch });
```

## File uploads

The high-level `upload()` computes the required SHA-256 checksum, infers the
content type from the key, creates the upload session, and uploads the bytes
resumably — in one call.

```ts
// Node.js — upload straight from a file path (size, checksum, type inferred)
const { url } = await client.applications.storage.upload({
  applicationId,
  bucketId,
  key: 'reports/q1.pdf',
  path: './q1-report.pdf',
});

// Browser — upload a File with progress and cancellation
const controller = new AbortController();
const { url } = await client.applications.storage.upload({
  applicationId,
  bucketId,
  key: `uploads/${file.name}`,
  data: file,
  onProgress: (sent, total) => console.log(`${Math.round((sent / total) * 100)}%`),
  signal: controller.signal,
});

// Wait until the object is finalized server-side, then read it back
const { object } = await client.applications.storage.upload({
  applicationId,
  bucketId,
  key: 'avatars/user-1.png',
  data: bytes,
  waitForCompletion: true,
});
console.log(object?.contentLength, 'bytes stored');
```

Accepted inputs: browser `File`/`Blob`, Node `Buffer`/`Uint8Array`/`ArrayBuffer`,
a Node filesystem `path`, or a Node readable `stream` (with `contentLength` and
`checksumSha256`).

### Many files at once

```ts
const results = await client.applications.storage.uploadBatch(
  files.map((f) => ({ applicationId, bucketId, key: `uploads/${f.name}`, data: f })),
  { concurrency: 6, onProgress: (done, total) => console.log(`${done}/${total}`) }
);
const failed = results.filter((r) => r.error);
```

### Working with objects

```ts
// List a "folder" one level deep
const { items, commonPrefixes } = await client.applications.storage.objects.list(applicationId, bucketId, {
  prefix: 'images/',
  limit: 100,
});

// Signed download URL for a private object
const { url } = await client.applications.storage.objects.getAccessUrl(applicationId, bucketId, objectId, {
  expiresInSeconds: 3600,
});
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

for await (const object of paginate((cursor) =>
  client.applications.storage.objects.list(applicationId, bucketId, { cursor })
)) {
  console.log(object.key);
}
```

## Errors

All errors extend `GigadriveError`. Notable subclasses: `ApiError` (with `status`
and optional `code`), `AuthenticationError`, `UploadError`, and
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
