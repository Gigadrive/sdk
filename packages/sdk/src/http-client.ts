import type { TokenManager } from './auth/token-manager';
import { ApiError, AuthenticationError } from './errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A paginated API response. All list endpoints return this shape.
 *
 * @typeParam T - The type of each item in the list.
 */
export interface Paginated<T> {
  /** The items on the current page. */
  items: T[];
  /** The total number of items across all pages. */
  total: number;
}

/** @internal */
export interface RequestOptions {
  query?: Record<string, string | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// HTTP Client
// ---------------------------------------------------------------------------

/**
 * Low-level HTTP client used internally by all resource classes. Handles
 * authentication header injection, JSON serialization, error mapping, and
 * automatic retry on 401 responses.
 *
 * You do not need to use this class directly — interact with the API through
 * the resource properties on {@link GigadriveClient} instead.
 *
 * @internal
 */
export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly tokenManager: TokenManager,
    private readonly fetchFn: typeof globalThis.fetch
  ) {}

  /** @internal */
  async get<T>(path: string, options?: Pick<RequestOptions, 'query'>): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  /** @internal */
  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, { body });
  }

  /** @internal */
  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, { body });
  }

  /** @internal */
  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  /** @internal */
  async postRaw<T>(
    path: string,
    body: string | ArrayBuffer | Uint8Array | ReadableStream | Blob | FormData,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('POST', path, { body: body as unknown, headers });
  }

  /**
   * Make a raw fetch request to an arbitrary URL (e.g. presigned S3 URLs
   * or TUS upload endpoints). No auth header is injected and the base URL
   * is not prepended.
   *
   * @param url - The full URL to fetch.
   * @param init - Standard `RequestInit` options.
   * @returns The raw `Response` object.
   * @throws {@link ApiError} if the response status is not OK.
   *
   * @internal
   */
  async fetchRaw(url: string, init: RequestInit): Promise<Response> {
    const response = await this.fetchFn(url, init);
    if (!response.ok) {
      throw new ApiError(response.statusText, response.status);
    }
    return response;
  }

  private async request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const token = await this.tokenManager.getToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    };

    // Add Content-Type for JSON bodies (skip for raw bodies which set their own headers)
    if (options?.body !== undefined && !options.headers) {
      headers['Content-Type'] = 'application/json';
    }

    const requestBody =
      options?.body !== undefined && !options.headers
        ? JSON.stringify(options.body)
        : (options?.body as string | ArrayBuffer | Uint8Array | ReadableStream | Blob | FormData | undefined);

    const response = await this.fetchFn(url, {
      method,
      headers,
      body: requestBody ?? null,
    });

    // Retry once on 401
    if (response.status === 401) {
      this.tokenManager.invalidate();
      const retryToken = await this.tokenManager.getToken();
      headers.Authorization = `Bearer ${retryToken}`;

      const retryResponse = await this.fetchFn(url, {
        method,
        headers,
        body: requestBody ?? null,
      });

      if (retryResponse.status === 401) {
        throw new AuthenticationError('Authentication failed after token refresh');
      }

      return this.handleResponse<T>(retryResponse);
    }

    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
      // Handle empty responses (204 No Content, or responses with no body)
      if (response.status === 204) {
        return undefined as T;
      }

      const text = await response.text();
      if (!text) {
        return undefined as T;
      }

      return JSON.parse(text) as T;
    }

    let message: string;
    let code: string | undefined;

    try {
      const body = (await response.json()) as { error?: string | { message?: string; code?: string } };
      if (typeof body.error === 'string') {
        message = body.error;
      } else if (body.error && typeof body.error === 'object') {
        message = body.error.message ?? response.statusText;
        code = body.error.code;
      } else {
        message = response.statusText;
      }
    } catch {
      message = response.statusText;
    }

    throw new ApiError(message, response.status, code);
  }

  private buildUrl(path: string, query?: Record<string, string | undefined>): string {
    const url = `${this.baseUrl}${path}`;

    if (!query) return url;

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params.set(key, value);
      }
    }

    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }
}
