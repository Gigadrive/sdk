import { env } from '@/env';

export interface OAuthClientConfig {
  clientId: string;
  issuer: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  userinfoUrl: string;
}

interface OpenIdDiscoveryDocument {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
}

let cachedConfig: OAuthClientConfig | null = null;

export async function getOAuthConfig(): Promise<OAuthClientConfig> {
  if (cachedConfig) return cachedConfig;

  const issuerBase = env.GIGADRIVE_NETWORK_OAUTH_ISSUER_URL.replace(/\/$/, '');

  // Fetch OpenID Provider Configuration
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let discovery: OpenIdDiscoveryDocument | null = null;
  try {
    const discoveryUrl = `${issuerBase}/.well-known/openid-configuration`;
    const res = await fetch(discoveryUrl, { signal: controller.signal });
    if (res.ok) {
      discovery = (await res.json()) as OpenIdDiscoveryDocument;
    } else {
      discovery = null;
    }
  } catch {
    discovery = null;
  } finally {
    clearTimeout(timeout);
  }

  if (!discovery?.authorization_endpoint || !discovery?.token_endpoint || !discovery?.userinfo_endpoint) {
    throw new Error('OIDC discovery failed or returned incomplete endpoints');
  }

  const DEFAULT_SCOPE = 'offline_access openid profile email';

  cachedConfig = {
    clientId: env.GIGADRIVE_NETWORK_OAUTH_CLIENT_ID,
    issuer: discovery.issuer ?? issuerBase,
    authorizeUrl: discovery.authorization_endpoint,
    tokenUrl: discovery.token_endpoint,
    scope: DEFAULT_SCOPE,
    userinfoUrl: discovery.userinfo_endpoint,
  };

  return cachedConfig;
}
