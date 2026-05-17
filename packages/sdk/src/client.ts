import { resolveCredentialProvider } from './auth/credential-provider';
import { TokenManager } from './auth/token-manager';
import { HttpClient } from './http-client';
import { AiGatewayResource } from './resources/ai-gateway';
import { ApplicationsResource } from './resources/applications';
import { DeploymentsResource } from './resources/deployments';
import { OrganizationsResource } from './resources/organizations';

const DEFAULT_BASE_URL = 'https://api.gigadrive.network';

/**
 * Configuration for the {@link GigadriveClient}.
 *
 * Credentials are resolved in priority order: explicit config fields first,
 * then environment variables. See {@link GigadriveClient} for the full
 * resolution chain.
 */
export interface GigadriveClientConfig {
  /**
   * OAuth2 client ID (the API key ID from the Gigadrive dashboard).
   * Used for both client-credentials and refresh-token flows.
   * Falls back to the `GIGADRIVE_CLIENT_ID` environment variable.
   */
  clientId?: string;

  /**
   * OAuth2 client secret (the API key secret from the Gigadrive dashboard).
   * Used together with {@link clientId} for the client-credentials grant.
   * Falls back to the `GIGADRIVE_CLIENT_SECRET` environment variable.
   */
  clientSecret?: string;

  /**
   * A pre-obtained bearer token (either an IDP or Network token).
   * When set, the SDK sends this token directly without any OAuth exchange.
   * The token is never refreshed — if it expires, requests will fail.
   * Falls back to the `GIGADRIVE_BEARER_TOKEN` environment variable.
   */
  bearerToken?: string;

  /**
   * An IDP refresh token for automatic access-token renewal. Used together
   * with {@link clientId}. The SDK will exchange this for short-lived access
   * tokens and handle refresh-token rotation automatically.
   * Falls back to the `GIGADRIVE_REFRESH_TOKEN` environment variable.
   */
  refreshToken?: string;

  /**
   * The IDP issuer URL used for OIDC discovery (fetching the
   * `.well-known/openid-configuration`). Only needed for refresh-token and
   * authorization-code flows.
   * Falls back to `GIGADRIVE_IDP_ISSUER_URL`, default: `https://idp.gigadrive.de`.
   */
  idpIssuerUrl?: string;

  /**
   * Callback for the OAuth2 authorization code flow with PKCE. The SDK
   * builds the authorization URL and passes it to this callback. Your code
   * must present the URL to the user (e.g. open a browser), then return
   * either the full redirect URL or just the authorization code.
   *
   * Requires {@link clientId} to be set.
   *
   * @param url - The authorization URL the user should visit.
   * @returns The full redirect URL (including `?code=...&state=...`) or the
   *          bare authorization code.
   *
   * @example
   * ```ts
   * const client = new GigadriveClient({
   *   clientId: 'my-app',
   *   onAuthorizationUrl: async (url) => {
   *     console.log('Visit:', url);
   *     return await readline.question('Paste the redirect URL: ');
   *   },
   * });
   * ```
   */
  onAuthorizationUrl?: (url: string) => Promise<string>;

  /**
   * Redirect URI for the authorization code flow.
   * Default: `urn:ietf:wg:oauth:2.0:oob` (out-of-band / manual copy-paste).
   */
  redirectUri?: string;

  /**
   * Base URL of the Gigadrive Network API.
   * Falls back to `GIGADRIVE_API_BASE_URL`, default: `https://api.gigadrive.network`.
   */
  baseUrl?: string;

  /**
   * Custom `fetch` implementation. Useful for testing (injectable mock) or
   * non-standard runtimes like Cloudflare Workers that provide their own
   * `fetch`. Defaults to `globalThis.fetch`.
   */
  fetch?: typeof globalThis.fetch;
}

/**
 * The main entry point for the Gigadrive Network SDK.
 *
 * Create an instance to interact with organizations, applications, deployments,
 * storage, and the AI gateway. Authentication is handled automatically —
 * tokens are obtained, cached, and refreshed behind the scenes.
 *
 * ## Credential resolution order
 *
 * The client resolves credentials in the following order, using the first
 * match it finds:
 *
 * 1. Explicit `bearerToken` in config
 * 2. Explicit `clientId` + `clientSecret` in config
 * 3. Explicit `clientId` + `refreshToken` in config
 * 4. Explicit `clientId` + `onAuthorizationUrl` callback in config
 * 5. `GIGADRIVE_BEARER_TOKEN` environment variable
 * 6. `GIGADRIVE_CLIENT_ID` + `GIGADRIVE_CLIENT_SECRET` environment variables
 * 7. `GIGADRIVE_CLIENT_ID` + `GIGADRIVE_REFRESH_TOKEN` environment variables
 *
 * If no credentials are found, the constructor throws an
 * {@link AuthenticationError}.
 *
 * @example
 * ```ts
 * // Credentials auto-detected from environment variables
 * const client = new GigadriveClient();
 *
 * // Explicit API key (client credentials)
 * const client = new GigadriveClient({
 *   clientId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
 *   clientSecret: 'sk_live_...',
 * });
 *
 * // Pre-obtained bearer token
 * const client = new GigadriveClient({ bearerToken: 'eyJ...' });
 *
 * // IDP refresh token — access tokens are renewed automatically
 * const client = new GigadriveClient({
 *   clientId: 'my-app',
 *   refreshToken: 'rt_...',
 * });
 *
 * // Use the client
 * const orgs = await client.organizations.list();
 * const deployment = await client.deployments.create({ applicationId: 'app-1' });
 * ```
 *
 * @throws {@link AuthenticationError} if no valid credentials are found.
 */
export class GigadriveClient {
  /** Organization management (list, environment variables). */
  readonly organizations: OrganizationsResource;
  /** Application management (list, environment variables, storage). */
  readonly applications: ApplicationsResource;
  /** Deployment lifecycle (create, upload, status, logs). */
  readonly deployments: DeploymentsResource;
  /** AI Gateway — OpenAI-compatible chat completions and model listing. */
  readonly aiGateway: AiGatewayResource;

  constructor(config: GigadriveClientConfig = {}) {
    const baseUrl = config.baseUrl ?? process.env.GIGADRIVE_API_BASE_URL ?? DEFAULT_BASE_URL;
    const fetchFn = config.fetch ?? globalThis.fetch;

    const credentialProvider = resolveCredentialProvider({ ...config, baseUrl, fetch: fetchFn });
    const tokenManager = new TokenManager(credentialProvider);
    const httpClient = new HttpClient(baseUrl, tokenManager, fetchFn);

    this.organizations = new OrganizationsResource(httpClient);
    this.applications = new ApplicationsResource(httpClient);
    this.deployments = new DeploymentsResource(httpClient);
    this.aiGateway = new AiGatewayResource(httpClient);
  }
}
