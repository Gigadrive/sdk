import { OAUTH_CONFIG } from '@/config/oauth';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { URL, URLSearchParams } from 'node:url';
import open from 'open';

// Type definitions for OAuth responses
interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface OAuthError {
  error?: string;
  errors?: Array<{ code: string; message?: string }>;
}

// Type definition for stored auth data
interface StoredAuthData {
  refreshToken: string;
  accessToken?: string;
  tokenExpirationTime?: number;
}

/**
 * Gets the path to the auth storage directory and file.
 * @returns {Object} Object containing directory and file paths.
 */
function getAuthStoragePaths(): { directory: string; file: string } {
  const homeDir = os.homedir();
  const authDir = path.join(homeDir, '.gigadrive');
  const authFile = path.join(authDir, 'auth.json');
  return { directory: authDir, file: authFile };
}

/**
 * Ensures the auth storage directory exists.
 * @returns {Promise<void>}
 */
async function ensureAuthDirectory(): Promise<void> {
  const { directory } = getAuthStoragePaths();
  try {
    await fs.promises.mkdir(directory, { recursive: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create auth directory: ${errorMessage}`);
  }
}

/**
 * Generates PKCE (Proof Key for Code Exchange) values.
 * @returns {Promise<{ codeVerifier: string; codeChallenge: string }>} The PKCE code verifier and challenge.
 */
function generatePKCE(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const codeChallenge = base64URLEncode(sha256(Buffer.from(codeVerifier)));
  return { codeVerifier, codeChallenge };
}

/**
 * Base64 URL-encodes a string.
 * @param {Buffer} buffer The buffer to encode.
 * @returns {string} The URL-encoded string.
 */
function base64URLEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Calculates the SHA256 hash of a buffer.
 * @param {Buffer} buffer The buffer to hash.
 * @returns {Buffer} The SHA256 hash as a buffer.
 */
function sha256(buffer: Buffer): Buffer {
  return crypto.createHash('sha256').update(buffer).digest();
}

/**
 * Manages the CLI's authentication state, including OAuth flow and secure token storage.
 */
export class AuthManager {
  private accessToken: string | null = null;
  private tokenExpirationTime: number = 0; // Unix timestamp in milliseconds
  private codeVerifier: string | null = null;
  private state: string | null = null;

  constructor() {
    // No explicit initialization needed, tokens are loaded on demand.
  }

  /**
   * Retrieves the stored auth data from the local file.
   * @returns {Promise<StoredAuthData | null>} The stored auth data if found, otherwise null.
   * @private
   */
  private async _loadStoredAuthData(): Promise<StoredAuthData | null> {
    try {
      const { file } = getAuthStoragePaths();
      const data = await fs.promises.readFile(file, 'utf8');
      const authData = JSON.parse(data) as StoredAuthData;

      // Restore in-memory tokens if they exist and are not expired
      if (authData.accessToken && authData.tokenExpirationTime && Date.now() < authData.tokenExpirationTime) {
        this.accessToken = authData.accessToken;
        this.tokenExpirationTime = authData.tokenExpirationTime;
      }

      return authData;
    } catch {
      // File doesn't exist or is invalid, which is fine
      return null;
    }
  }

  /**
   * Stores the auth data in the local file.
   * @param {StoredAuthData} authData The auth data to store.
   * @private
   */
  private async _saveStoredAuthData(authData: StoredAuthData): Promise<void> {
    try {
      await ensureAuthDirectory();
      const { file } = getAuthStoragePaths();
      await fs.promises.writeFile(file, JSON.stringify(authData, null, 2), 'utf8');
      console.log('Auth data saved to local storage.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving auth data to local storage:', errorMessage);
    }
  }

  /**
   * Deletes the stored auth data from the local file.
   */
  public async logout(): Promise<void> {
    this.accessToken = null;
    this.tokenExpirationTime = 0;
    try {
      const { file } = getAuthStoragePaths();
      await fs.promises.unlink(file);
      console.log('Logged out. Auth data removed from local storage.');
    } catch {
      // File doesn't exist, which is fine
      console.log('Logged out.');
    }
  }

  /**
   * Initiates the OAuth login flow with Clerk via a web portal.
   * Opens a browser for user authentication and listens for the redirect.
   * @returns {Promise<boolean>} True if login was successful, false otherwise.
   */
  public async login(): Promise<boolean> {
    // Clear any existing tokens to ensure a fresh login experience
    await this.logout();

    const { codeVerifier, codeChallenge } = generatePKCE();
    this.codeVerifier = codeVerifier;
    this.state = crypto.randomBytes(16).toString('hex');

    // Construct Clerk's authorization URL
    const authUrl = new URL(OAUTH_CONFIG.authorizeUrl);
    authUrl.searchParams.append('client_id', OAUTH_CONFIG.clientId);
    authUrl.searchParams.append('redirect_uri', OAUTH_CONFIG.redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', OAUTH_CONFIG.scope);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('state', this.state);

    // Start a local HTTP server to catch the redirect callback
    const server = http.createServer();
    const serverPromise = new Promise<string>((resolve, reject) => {
      const port = new URL(OAUTH_CONFIG.redirectUri).port;
      if (!port) {
        reject(new Error('Redirect URI must specify a port for the local server.'));
        return;
      }
      server.listen(parseInt(port), () => {
        console.log(`Please open this URL in your browser to log in:\n${authUrl.toString()}\n`);
        console.log('Waiting for login callback...');
        void open(authUrl.toString()); // Automatically open the browser
      });

      server.on('request', (req, res) => {
        const reqUrl = new URL(req.url || '', OAUTH_CONFIG.redirectUri); // Handle req.url possibly being undefined
        if (reqUrl.pathname === new URL(OAUTH_CONFIG.redirectUri).pathname) {
          const authCode = reqUrl.searchParams.get('code');
          const receivedState = reqUrl.searchParams.get('state');
          const error = reqUrl.searchParams.get('error');

          res.writeHead(200, { 'Content-Type': 'text/html' });
          if (error) {
            res.end('<h1>Login Failed!</h1><p>Error: ' + error + '</p><p>You can close this tab.</p>');
            server.close(() => reject(new Error(`OAuth error: ${error}`)));
            return;
          }

          if (receivedState !== this.state) {
            res.end('<h1>Login Failed!</h1><p>State mismatch. Possible CSRF attack.</p><p>You can close this tab.</p>');
            server.close(() => reject(new Error('State mismatch')));
            return;
          }

          if (authCode) {
            res.end('<h1>Login Successful!</h1><p>You can close this tab.</p>');
            server.close(() => resolve(authCode));
          } else {
            res.end('<h1>Login Failed!</h1><p>No authorization code received.</p><p>You can close this tab.</p>');
            server.close(() => reject(new Error('No authorization code received')));
          }
        } else {
          res.writeHead(404).end('Not Found');
        }
      });

      server.on('error', (err: Error) => {
        console.error('Local server error:', err);
        reject(err);
      });
    });

    try {
      const authCode = await serverPromise; // Wait for the auth code from the local server

      // Exchange the authorization code for tokens with Clerk's token endpoint
      const tokenResponse = await fetch(OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: OAUTH_CONFIG.clientId,
          code: authCode,
          redirect_uri: OAUTH_CONFIG.redirectUri,
          code_verifier: this.codeVerifier || '', // Use the stored codeVerifier
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorData = (await tokenResponse.json().catch(() => null)) as OAuthError | null;
        throw new Error(
          `Token exchange failed: ${tokenResponse.status} ${
            tokenResponse.statusText
          } - ${errorData ? JSON.stringify(errorData) : 'Unknown error'}`
        );
      }

      const tokens = (await tokenResponse.json()) as OAuthTokens;
      this.accessToken = tokens.access_token;
      // Calculate expiration time based on 'expires_in' seconds
      this.tokenExpirationTime = Date.now() + (tokens.expires_in || 3600) * 1000;

      if (tokens.refresh_token) {
        // Store both refresh token and current access token
        await this._saveStoredAuthData({
          refreshToken: tokens.refresh_token,
          accessToken: this.accessToken,
          tokenExpirationTime: this.tokenExpirationTime,
        });
        console.log('Login successful! Access token acquired.');
        return true;
      } else {
        console.error('Error: No refresh token received from Clerk.');
        return false;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Login process failed:', errorMessage);
      this.accessToken = null; // Clear any partial tokens on failure
      this.tokenExpirationTime = 0;
      return false;
    } finally {
      this.codeVerifier = null; // Clear PKCE verifier after use
      this.state = null; // Clear state after use
    }
  }

  /**
   * Refreshes the access token using the stored refresh token.
   * This method implicitly loads the refresh token from local storage.
   * @returns {Promise<boolean>} True if refresh was successful, false otherwise.
   */
  private async refreshAccessToken(): Promise<boolean> {
    const storedData = await this._loadStoredAuthData();
    if (!storedData?.refreshToken) {
      console.log('No refresh token available for refresh. Please log in.');
      return false;
    }

    try {
      const tokenResponse = await fetch(OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: OAUTH_CONFIG.clientId,
          refresh_token: storedData.refreshToken,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorData = (await tokenResponse.json().catch(() => null)) as OAuthError | null;
        // Handle common refresh token errors from Clerk
        if (
          tokenResponse.status === 400 &&
          errorData &&
          (errorData.error === 'oauth_token_not_found' ||
            errorData.errors?.[0]?.code === 'token_invalid' ||
            errorData.errors?.[0]?.code === 'token_expired' ||
            errorData.errors?.[0]?.code === 'token_revoked')
        ) {
          console.error('Refresh token is invalid or expired. Please log in again.');
          await this.logout(); // Clear the invalid refresh token from storage
          return false;
        }
        throw new Error(
          `Token refresh failed: ${tokenResponse.status} ${
            tokenResponse.statusText
          } - ${errorData ? JSON.stringify(errorData) : 'Unknown error'}`
        );
      }

      const tokens = (await tokenResponse.json()) as OAuthTokens;
      this.accessToken = tokens.access_token;
      this.tokenExpirationTime = Date.now() + (tokens.expires_in || 3600) * 1000;

      // Check for refresh token rotation (Clerk might issue a new refresh token)
      const newRefreshToken = tokens.refresh_token || storedData.refreshToken;
      if (tokens.refresh_token && tokens.refresh_token !== storedData.refreshToken) {
        console.log('New refresh token received and updated.');
      }

      // Update stored auth data with new tokens
      await this._saveStoredAuthData({
        refreshToken: newRefreshToken,
        accessToken: this.accessToken,
        tokenExpirationTime: this.tokenExpirationTime,
      });

      console.log('Access token refreshed successfully!');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error refreshing access token:', errorMessage);
      this.accessToken = null; // Clear in-memory token on refresh failure
      this.tokenExpirationTime = 0;
      return false;
    }
  }

  /**
   * Provides the current valid access token. If the in-memory token is expired,
   * it attempts to refresh it using the stored refresh token.
   * @returns {Promise<string | null>} The valid access token or null if no session.
   */
  public async getAccessToken(): Promise<string | null> {
    // 1. Check if the in-memory access token is still valid
    if (this.accessToken && Date.now() < this.tokenExpirationTime) {
      return this.accessToken;
    }

    // 2. If no valid in-memory token, attempt to refresh using the stored refresh token
    console.log('Access token expired or not available. Attempting to refresh...');
    if (await this.refreshAccessToken()) {
      return this.accessToken;
    }

    // 3. If refresh failed, the user needs to log in again
    console.log('No valid access token available. Please log in first.');
    return null;
  }
}

// Export a singleton instance of the AuthManager
export const authManager = new AuthManager();
