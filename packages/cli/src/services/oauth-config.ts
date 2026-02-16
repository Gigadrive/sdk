import { Config, Effect, Schema } from 'effect';
import type { OAuthClientConfig } from '../domain';
import { OAuthDiscoveryError } from '../errors';

// ---------------------------------------------------------------------------
// Environment config (replaces env.ts + @t3-oss/env-core + zod + dotenv)
// ---------------------------------------------------------------------------

const OAuthEnvConfig = Config.all({
  issuerUrl: Config.string('GIGADRIVE_NETWORK_OAUTH_ISSUER_URL').pipe(Config.withDefault('https://idp.gigadrive.de')),
  clientId: Config.string('GIGADRIVE_NETWORK_OAUTH_CLIENT_ID').pipe(Config.withDefault('todo_add_client_id')),
});

// ---------------------------------------------------------------------------
// OIDC discovery document schema
// ---------------------------------------------------------------------------

const OpenIdDiscoveryDocument = Schema.Struct({
  issuer: Schema.optional(Schema.String),
  authorization_endpoint: Schema.optional(Schema.String),
  token_endpoint: Schema.optional(Schema.String),
  userinfo_endpoint: Schema.optional(Schema.String),
});

const DEFAULT_SCOPE = 'offline_access openid profile email';

// ---------------------------------------------------------------------------
// OAuthConfigService
// ---------------------------------------------------------------------------

export class OAuthConfigService extends Effect.Service<OAuthConfigService>()('OAuthConfigService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const envConfig = yield* OAuthEnvConfig;
    let cached: OAuthClientConfig | null = null;

    const getConfig: Effect.Effect<OAuthClientConfig, OAuthDiscoveryError> = Effect.gen(function* () {
      if (cached) return cached;

      const issuerBase = envConfig.issuerUrl.replace(/\/$/, '');
      const discoveryUrl = `${issuerBase}/.well-known/openid-configuration`;

      yield* Effect.log('Fetching OIDC discovery document', { discoveryUrl });

      const response = yield* Effect.tryPromise({
        try: (signal) => fetch(discoveryUrl, { signal }),
        catch: (error) =>
          new OAuthDiscoveryError({
            message: 'Failed to fetch OIDC discovery document',
            cause: error instanceof Error ? error.message : String(error),
          }),
      });

      if (!response.ok) {
        return yield* Effect.fail(
          new OAuthDiscoveryError({
            message: `OIDC discovery returned ${response.status} ${response.statusText}`,
          })
        );
      }

      const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () =>
          new OAuthDiscoveryError({
            message: 'Failed to parse OIDC discovery JSON',
          }),
      });

      const decoded = yield* Schema.decodeUnknown(OpenIdDiscoveryDocument)(json).pipe(
        Effect.mapError(
          () =>
            new OAuthDiscoveryError({
              message: 'Invalid OIDC discovery document schema',
            })
        )
      );

      if (!decoded.authorization_endpoint || !decoded.token_endpoint || !decoded.userinfo_endpoint) {
        return yield* Effect.fail(
          new OAuthDiscoveryError({
            message: 'OIDC discovery returned incomplete endpoints',
          })
        );
      }

      const config: OAuthClientConfig = {
        clientId: envConfig.clientId,
        issuer: decoded.issuer ?? issuerBase,
        authorizeUrl: decoded.authorization_endpoint,
        tokenUrl: decoded.token_endpoint,
        scope: DEFAULT_SCOPE,
        userinfoUrl: decoded.userinfo_endpoint,
      };

      cached = config;
      yield* Effect.log('OIDC discovery completed', { issuer: config.issuer });
      return config;
    });

    return { getConfig };
  }),
}) {}
