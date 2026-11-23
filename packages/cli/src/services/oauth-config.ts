import { FileSystem, Path } from '@effect/platform';
import { Config, Effect, Option, Schema } from 'effect';
import * as os from 'node:os';
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
  // Where the OIDC discovery document is cached between runs.
  cacheDir: Config.string('GIGADRIVE_CACHE_DIR').pipe(Config.option),
});

/** How long a discovery document is reused when the IDP sends no cache headers. */
export const DEFAULT_DISCOVERY_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * How long a response may be reused, from its `Cache-Control` (`no-store`,
 * `no-cache`, `max-age`) or `Expires` header, else
 * {@link DEFAULT_DISCOVERY_LIFETIME_MS}.
 */
export const discoveryLifetimeMs = (headers: { get(name: string): string | null } | undefined, now = Date.now()) => {
  const directives = cacheDirectives(headers);
  if (directives.has('no-store') || directives.has('no-cache')) return 0;
  const maxAge = directives.get('max-age');
  if (maxAge !== undefined) return /^\d+$/.test(maxAge) ? Number(maxAge) * 1000 : 0;
  const expires = headers?.get('expires');
  if (expires) {
    const at = Date.parse(expires);
    return Number.isFinite(at) ? Math.max(0, at - now) : 0;
  }
  return DEFAULT_DISCOVERY_LIFETIME_MS;
};

/** `Cache-Control` directives by lowercase name, with their unquoted arguments (`''` when none). */
const cacheDirectives = (headers: { get(name: string): string | null } | undefined) =>
  new Map(
    (headers?.get('cache-control') ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map((part): [string, string] => {
        const [name = '', ...value] = part.split('=');
        return [
          name.trim().toLowerCase(),
          value
            .join('=')
            .trim()
            .replace(/^"(.*)"$/, '$1'),
        ];
      })
  );

/** Whether a response forbids serving it stale, even when the IDP cannot be reached. */
export const mustRevalidate = (headers: { get(name: string): string | null } | undefined) => {
  const directives = cacheDirectives(headers);
  return directives.has('must-revalidate') || directives.has('proxy-revalidate');
};

/** The discovery cache file: the document of one issuer and when it goes stale. */
const DiscoveryCacheFile = Schema.Struct({
  issuer: Schema.String,
  expiresAt: Schema.Number,
  /** The IDP said not to use the document once it is stale. */
  mustRevalidate: Schema.optional(Schema.Boolean),
  document: Schema.Unknown,
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
  'network:microvms:read',
  'network:microvms:write',
  'network:microvms:exec',
  'network:microvms:delete',
  'network:microvm_images:read',
  'network:microvm_images:write',
  'network:microvm_images:delete',
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

    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const cacheDir = Option.getOrElse(envConfig.cacheDir, () => path.join(os.homedir(), '.gigadrive'));
    const cacheFile = path.join(cacheDir, 'oidc-discovery.json');
    const issuerBase = envConfig.issuerUrl.replace(/\/$/, '');
    const discoveryUrl = `${issuerBase}/.well-known/openid-configuration`;

    /** The cached document of this issuer, fresh or stale; none when missing or unreadable. */
    const readCache = fs.readFileString(cacheFile).pipe(
      Effect.flatMap((text) => Effect.try(() => JSON.parse(text) as unknown)),
      Effect.flatMap(Schema.decodeUnknown(DiscoveryCacheFile)),
      Effect.map((entry) => (entry.issuer === issuerBase ? Option.some(entry) : Option.none())),
      Effect.orElseSucceed(() => Option.none<typeof DiscoveryCacheFile.Type>())
    );

    /** Best effort: a CLI that cannot write its cache still works, it just fetches again next time. */
    const writeCache = (document: unknown, lifetimeMs: number, revalidate: boolean) =>
      lifetimeMs > 0
        ? fs.makeDirectory(cacheDir, { recursive: true }).pipe(
            Effect.andThen(
              fs.writeFileString(
                cacheFile,
                JSON.stringify({
                  issuer: issuerBase,
                  expiresAt: Date.now() + lifetimeMs,
                  ...(revalidate ? { mustRevalidate: true } : {}),
                  document,
                })
              )
            ),
            Effect.ignore
          )
        : // A document that must not be stored replaces any older copy: drop it,
          // so a later outage cannot bring back endpoints the IDP changed.
          fs.remove(cacheFile).pipe(Effect.ignore);

    /** Turns a discovery document into the client config, or fails when it lacks an endpoint. */
    const toConfig = (json: unknown) =>
      Effect.gen(function* () {
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
        return config;
      });

    const fetchDocument = Effect.gen(function* () {
      yield* Effect.logDebug('Fetching OIDC discovery document', { discoveryUrl });

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

      const json: unknown = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () =>
          new OAuthDiscoveryError({
            message: 'Failed to parse OIDC discovery JSON',
          }),
      });
      return {
        json,
        lifetimeMs: discoveryLifetimeMs(response.headers),
        revalidate: mustRevalidate(response.headers),
        fetched: true,
      };
    });

    /**
     * The OAuth client config. The discovery document is cached on disk for
     * as long as the IDP's cache headers allow (24 hours without them), so a
     * command does not fetch it on every run. A stale copy is still used when
     * the IDP cannot be reached.
     */
    const getConfig: Effect.Effect<OAuthClientConfig, OAuthDiscoveryError> = Effect.gen(function* () {
      if (cached) return cached;

      const entry = yield* readCache;
      const fresh = Option.filter(entry, (value) => value.expiresAt > Date.now());
      if (Option.isSome(fresh)) {
        const fromCache = yield* toConfig(fresh.value.document).pipe(Effect.option);
        if (Option.isSome(fromCache)) {
          cached = fromCache.value;
          return cached;
        }
      }

      const fetched = yield* fetchDocument.pipe(
        Effect.catchAll((error) =>
          Option.match(
            Option.filter(entry, (stale) => stale.mustRevalidate !== true),
            {
              onNone: () => Effect.fail(error),
              onSome: (stale) =>
                Effect.logDebug('Using a stale OIDC discovery document', { reason: error.message }).pipe(
                  Effect.as({ json: stale.document, lifetimeMs: 0, revalidate: false, fetched: false })
                ),
            }
          )
        )
      );
      const config = yield* toConfig(fetched.json);
      if (fetched.fetched) yield* writeCache(fetched.json, fetched.lifetimeMs, fetched.revalidate);

      cached = config;
      yield* Effect.logDebug('OIDC discovery completed', { issuer: config.issuer });
      return config;
    });

    return { getConfig };
  }),
}) {}
