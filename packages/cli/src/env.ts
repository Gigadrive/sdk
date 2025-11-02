import { createEnv } from '@t3-oss/env-core';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Load env files from current working directory with correct precedence
// Precedence (highest to lowest):
// .env.<NODE_ENV>.local -> .env.local -> .env.<NODE_ENV> -> .env
// OS environment variables always take precedence (we never use override=true)
(() => {
  const cwd = process.cwd();
  const nodeEnv = process.env.NODE_ENV;

  const candidates = [
    nodeEnv ? `.env.${nodeEnv}.local` : null,
    `.env.local`,
    nodeEnv ? `.env.${nodeEnv}` : null,
    `.env`,
  ].filter(Boolean) as string[];

  for (const filename of candidates) {
    const fullPath = path.join(cwd, filename);
    if (fs.existsSync(fullPath)) {
      console.debug(`Loading environment variables from ${fullPath}`);
      loadEnv({ path: fullPath, override: false });
    }
  }
})();

export const env = createEnv({
  server: {
    GIGADRIVE_NETWORK_OAUTH_ISSUER_URL: z.url().min(1).default('https://idp.gigadrive.de'),
    GIGADRIVE_NETWORK_OAUTH_CLIENT_ID: z.string().min(1).default('todo_add_client_id'),
  },

  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
