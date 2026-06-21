import type { HttpClient } from '../http-client';

/**
 * Base class for all API resource classes. Provides access to the shared
 * HTTP client for making authenticated API requests.
 *
 * @internal
 */
export class BaseResource {
  constructor(protected readonly httpClient: HttpClient) {}
}
