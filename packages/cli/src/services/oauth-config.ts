import { Config, Effect, Schema } from 'effect';
import type { OAuthClientConfig } from '../domain';
import { OAuthDiscoveryError } from '../errors';

// ---------------------------------------------------------------------------
// Environment config (replaces env.ts + @t3-oss/env-core + zod + dotenv)
// ---------------------------------------------------------------------------

const OAuthEnvConfig = Config.all({
  issuerUrl: Config.string('GIGADRIVE_NETWORK_OAUTH_ISSUER_URL').pipe(Config.withDefault('https://idp.gigadrive.de')),
  // Default is the first-party CLI's public OAuth client (seeded in the Network
  // repo). Override with GIGADRIVE_NETWORK_OAUTH_CLIENT_ID per environment.
  clientId: Config.string('GIGADRIVE_NETWORK_OAUTH_CLIENT_ID').pipe(
    Config.withDefault('0195c11c-0000-7000-8000-000000000001')
  ),
});

// ---------------------------------------------------------------------------
// OIDC discovery document schema
// ---------------------------------------------------------------------------

const OpenIdDiscoveryDocument = Schema.Struct({
  issuer: Schema.optional(Schema.String),
  authorization_endpoint: Schema.optional(Schema.String),
  token_endpoint: Schema.optional(Schema.String),
  userinfo_endpoint: Schema.optional(Schema.String),
  device_authorization_endpoint: Schema.optional(Schema.String),
});

/**
 * Scopes requested at login. Identity scopes plus the Network API capability
 * scopes available to the standalone first-party CLI and the platform scopes
 * needed to provision local-dev API credentials. AI Gateway governance scopes
 * are intentionally excluded because the IDP only grants them to OAuth clients
 * bound to a Network application; requesting one would reject the entire login.
 */
const CLI_SCOPES = [
  // Identity / OIDC
  'offline_access',
  'openid',
  'profile',
  'email',
  // Platform discovery used for zero-config application onboarding
  'platform:organizations:read',
  // Network API capabilities
  'network:applications:read',
  'network:applications:write',
  'network:env_vars:read',
  'network:env_vars:write',
  'network:env_vars:delete',
  'network:deployments:read',
  'network:deployments:write',
  'network:deployments:trigger',
  'network:ai_gateway:chat',
  'network:ai_gateway:models',
  // Provisioning local-dev API credentials
  'platform:api_keys:read',
  'platform:api_keys:write',
  'platform:api_keys:delete',
] as const;

const DEFAULT_SCOPE = CLI_SCOPES.join(' ');

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

      if (
        !decoded.authorization_endpoint ||
        !decoded.token_endpoint ||
        !decoded.userinfo_endpoint ||
        !decoded.device_authorization_endpoint
      ) {
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
        deviceAuthorizeUrl: decoded.device_authorization_endpoint,
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
