import type { CredentialProvider } from './credential-provider';

/**
 * Manages the access-token lifecycle: caching, automatic expiry detection,
 * proactive refresh, and concurrent-call deduplication.
 *
 * When multiple API requests fire simultaneously with an expired token, only
 * a single refresh call is made — all concurrent callers await the same
 * pending Promise. This prevents a "thundering herd" of token requests.
 *
 * @internal Used internally by {@link HttpClient}. Not part of the public API.
 */
export class TokenManager {
  private cachedToken: string | null = null;
  private expiresAt: number | null = null;
  private pendingRefresh: Promise<string> | null = null;

  constructor(private readonly provider: CredentialProvider) {}

  /**
   * Returns a valid access token. Uses the cached token if still valid,
   * otherwise fetches a new one from the credential provider.
   *
   * Concurrent calls are deduplicated — only one refresh runs at a time.
   */
  async getToken(): Promise<string> {
    if (this.cachedToken && (this.expiresAt === null || Date.now() < this.expiresAt)) {
      return this.cachedToken;
    }

    // Deduplicate concurrent refresh calls
    if (this.pendingRefresh) {
      return this.pendingRefresh;
    }

    this.pendingRefresh = this.refresh();

    try {
      return await this.pendingRefresh;
    } finally {
      this.pendingRefresh = null;
    }
  }

  /**
   * Invalidates the cached token. The next `getToken()` call will trigger a refresh.
   */
  invalidate(): void {
    this.cachedToken = null;
    this.expiresAt = null;
  }

  private async refresh(): Promise<string> {
    const result = await this.provider.getToken();
    this.cachedToken = result.accessToken;
    this.expiresAt = result.expiresAt;
    return result.accessToken;
  }
}
