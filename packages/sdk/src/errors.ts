/**
 * Base error class for all Gigadrive SDK errors. Every error thrown by the SDK
 * extends this class, so you can catch all SDK errors with a single check.
 *
 * @example
 * ```ts
 * try {
 *   await client.organizations.list();
 * } catch (err) {
 *   if (err instanceof GigadriveError) {
 *     console.error('SDK error:', err.message);
 *   }
 * }
 * ```
 */
export class GigadriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GigadriveError';
  }
}

/**
 * Thrown when authentication fails. This includes missing or invalid credentials,
 * expired tokens, failed token refresh attempts, and failed token exchanges.
 *
 * Common causes:
 * - No credentials provided and no environment variables set
 * - Invalid `clientId`/`clientSecret` pair
 * - Expired or revoked refresh token
 * - API returned 401 even after an automatic token refresh retry
 *
 * @example
 * ```ts
 * try {
 *   const client = new GigadriveClient(); // no credentials
 * } catch (err) {
 *   if (err instanceof AuthenticationError) {
 *     console.error('Auth failed:', err.message);
 *   }
 * }
 * ```
 */
export class AuthenticationError extends GigadriveError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Thrown when the Gigadrive API returns a non-2xx HTTP response.
 *
 * Contains the HTTP {@link status} code and an optional machine-readable
 * {@link code} parsed from the response body.
 *
 * @example
 * ```ts
 * try {
 *   await client.deployments.get('non-existent-id');
 * } catch (err) {
 *   if (err instanceof ApiError) {
 *     console.error(`API error ${err.status}: ${err.message}`);
 *     // err.code may contain a machine-readable error code
 *   }
 * }
 * ```
 */
export class ApiError extends GigadriveError {
  /** The HTTP status code of the failed response (e.g. 404, 500). */
  readonly status: number;
  /** An optional machine-readable error code from the API response body. */
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
