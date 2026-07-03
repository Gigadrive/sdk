import { Config, Effect, Option } from 'effect';
import * as os from 'node:os';
import { parseEnv, type EnvEntry } from '../lib/dotenv';
import { ApiClientService } from './api-client';
import { DevCredentialsStore } from './dev-credentials-store';

// ---------------------------------------------------------------------------
// LocalCredentialsService
//
// Provisions least-privilege, application-scoped API credentials for local
// development and returns them as `.env` entries (GIGADRIVE_CLIENT_ID /
// GIGADRIVE_CLIENT_SECRET / GIGADRIVE_API_BASE_URL). The local app uses these
// with the SDK's client-credentials provider to call the API as the application.
//
// Because a key secret is only returned once at creation, we cannot re-read it.
// To avoid key sprawl we store the provisioned key's ID (in DevCredentialsStore)
// and, on subsequent runs, either reuse the credentials already present in the
// target file or rotate (revoke the old key, mint a new one).
// ---------------------------------------------------------------------------

/** Least-privilege default scopes for a local-dev key. */
const DEV_KEY_SCOPES = ['network:env_vars:read'];

const ApiBaseUrl = Config.string('GIGADRIVE_API_BASE_URL').pipe(Config.withDefault('https://api.gigadrive.network'));

const credentialEntries = (clientId: string, clientSecret: string, baseUrl: string): EnvEntry[] => [
  { key: 'GIGADRIVE_CLIENT_ID', value: clientId },
  { key: 'GIGADRIVE_CLIENT_SECRET', value: clientSecret },
  { key: 'GIGADRIVE_API_BASE_URL', value: baseUrl },
];

export interface ProvisionInput {
  applicationId: string;
  /** Force a fresh key even when reusable credentials already exist. */
  rotate: boolean;
  /** Current contents of the target `.env` file, if any (used to reuse credentials). */
  existingContent?: string;
}

export class LocalCredentialsService extends Effect.Service<LocalCredentialsService>()('LocalCredentialsService', {
  accessors: true,
  dependencies: [ApiClientService.Default, DevCredentialsStore.Default],

  effect: Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const store = yield* DevCredentialsStore;
    const baseUrl = yield* ApiBaseUrl;

    const keyName = (applicationId: string) => `cli-dev:${os.hostname()}:${applicationId}`;

    /**
     * Provision (or reuse) application-scoped credentials and return them as
     * `.env` entries. Reuses the credentials already in `existingContent` when
     * they match the stored key and `rotate` is not set; otherwise revokes any
     * previously provisioned key and mints a fresh one.
     */
    const provision = Effect.fn('LocalCredentialsService.provision')(function* (input: ProvisionInput) {
      const stored = yield* store.get(input.applicationId);
      const existing = input.existingContent ? parseEnv(input.existingContent) : {};
      const existingClientId = existing['GIGADRIVE_CLIENT_ID'];
      const existingClientSecret = existing['GIGADRIVE_CLIENT_SECRET'];

      const canReuse =
        !input.rotate &&
        existingClientId !== undefined &&
        existingClientSecret !== undefined &&
        Option.isSome(stored) &&
        stored.value.apiKeyId === existingClientId;

      if (canReuse) {
        return credentialEntries(existingClientId, existingClientSecret, baseUrl);
      }

      // Revoke the previously provisioned key (if any) to avoid sprawl. Best
      // effort: a key that was already deleted server-side must not block us.
      if (Option.isSome(stored)) {
        yield* apiClient
          .request((client) => client.apiKeys.delete(stored.value.apiKeyId))
          .pipe(Effect.catchTag('ApiRequestError', () => Effect.void));
      }

      const created = yield* apiClient.request((client) =>
        client.apiKeys.create({
          name: keyName(input.applicationId),
          applicationId: input.applicationId,
          scopes: DEV_KEY_SCOPES,
        })
      );

      yield* store.set(input.applicationId, { apiKeyId: created.id });

      return credentialEntries(created.id, created.secret, baseUrl);
    });

    return { provision };
  }),
}) {}
