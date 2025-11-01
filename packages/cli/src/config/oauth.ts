import { env } from '@/env';

interface OAuthClientConfig {
  clientId: string;
  authorizeUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope: string;
}

export const OAUTH_CONFIG: OAuthClientConfig = {
  clientId: env.GIGADRIVE_NETWORK_OAUTH_CLIENT_ID,
  authorizeUrl: env.GIGADRIVE_NETWORK_OAUTH_AUTHORIZE_URL,
  tokenUrl: env.GIGADRIVE_NETWORK_OAUTH_TOKEN_URL,
  redirectUri: env.GIGADRIVE_NETWORK_OAUTH_REDIRECT_URI,
  scope: env.GIGADRIVE_NETWORK_OAUTH_SCOPE,
};
