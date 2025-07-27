import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    GIGADRIVE_NETWORK_OAUTH_CLIENT_ID: z.string().min(1).default('todo_add_client_id'),
    GIGADRIVE_NETWORK_OAUTH_AUTHORIZE_URL: z.url().min(1).default('https://oauth.example.com/oauth/authorize'),
    GIGADRIVE_NETWORK_OAUTH_TOKEN_URL: z.url().min(1).default('https://oauth.example.com/oauth/token'),
    GIGADRIVE_NETWORK_OAUTH_REDIRECT_URI: z.url().min(1).default('http://localhost:56615/callback'),
    GIGADRIVE_NETWORK_OAUTH_SCOPE: z.string().min(1).default('openid profile email'),
  },

  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
