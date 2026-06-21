import type { TokenManager } from './auth/token-manager';
import { ApiError, AuthenticationError } from './errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A paginated API response. List endpoints return this shape.
 *
 * @typeParam T - The type of each item in the list.
 */
export interface Paginated<T> {
  /** The items on the current page. */
  items: T[];
  /** The total number of items across all pages. */
  total: number;
  /** An opaque cursor for the next page, present on cursor-paginated endpoints when more items remain. */
  nextCursor?: string;
}

/** A value that can be serialized into a query-string parameter. `undefined` values are omitted. */
export type QueryValue = string | number | boolean | undefined;

/** Common pagination query parameters accepted by list endpoints. */
export interface ListQuery {
  /** 1-indexed page number (for page/`perPage`-style pagination). */
  page?: number;
  /** Maximum number of items per page. */
  perPage?: number;
  /** Opaque cursor for cursor-based pagination (from a previous response's `nextCursor`). */
  cursor?: string;
}

/** @internal */
export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Abort signal to cancel the request (and any 401-refresh retry). */
  signal?: AbortSignal;
}

const isRawBody = (body: unknown): boolean =>
  typeof body === 'string' ||
  body instanceof ArrayBuffer ||
  (typeof Uint8Array !== 'undefined' && body instanceof Uint8Array) ||
  (typeof Blob !== 'undefined' && body instanceof Blob) ||
  (typeof FormData !== 'undefined' && body instanceof FormData) ||
  (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream);

const hasHeader = (headers: Record<string, string>, name: string): boolean =>
  Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());

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
  async get<T>(path: string, options?: Pick<RequestOptions, 'query' | 'signal'>): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  /** @internal */
  async post<T>(
    path: string,
    body?: unknown,
    options?: Pick<RequestOptions, 'headers' | 'query' | 'signal'>
  ): Promise<T> {
    return this.request<T>('POST', path, { body, ...options });
  }

  /** @internal */
  async put<T>(
    path: string,
    body?: unknown,
    options?: Pick<RequestOptions, 'headers' | 'query' | 'signal'>
  ): Promise<T> {
    return this.request<T>('PUT', path, { body, ...options });
  }

  /** @internal */
  async patch<T>(
    path: string,
    body?: unknown,
    options?: Pick<RequestOptions, 'headers' | 'query' | 'signal'>
  ): Promise<T> {
    return this.request<T>('PATCH', path, { body, ...options });
  }

  /** @internal */
  async delete<T>(path: string, options?: Pick<RequestOptions, 'query' | 'signal'>): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  /** @internal */
  async postRaw<T>(
    path: string,
    body: string | ArrayBuffer | Uint8Array | ReadableStream | Blob | FormData,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('POST', path, { body, headers });
  }

  /**
   * Make an authenticated request and return the raw `Response` without parsing
   * the body. Used for streamed (SSE) and binary responses.
   *
   * @throws {@link ApiError} if the response status is not OK.
   * @internal
   */
  async requestStream(method: string, path: string, options?: RequestOptions): Promise<Response> {
    const response = await this.fetchWithAuth(method, path, options);
    if (!response.ok) {
      throw await this.toApiError(response);
    }
    return response;
  }

  /**
   * Make a raw fetch request to an arbitrary URL (e.g. presigned upload URLs
   * or resumable upload endpoints). No auth header is injected and the base URL
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
    const response = await this.fetchWithAuth(method, path, options);
    return this.handleResponse<T>(response);
  }

  /** Perform the request with auth injection and a single 401 refresh-retry. */
  private async fetchWithAuth(method: string, path: string, options?: RequestOptions): Promise<Response> {
    const url = this.buildUrl(path, options?.query);
    const token = await this.tokenManager.getToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    };

    let requestBody: RequestInit['body'] = null;
    if (options?.body !== undefined) {
      if (isRawBody(options.body)) {
        // Raw bodies (FormData/Blob/bytes/streams) set their own Content-Type.
        requestBody = options.body as RequestInit['body'];
      } else {
        requestBody = JSON.stringify(options.body);
        if (!hasHeader(headers, 'Content-Type')) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    const signal = options?.signal;
    const response = await this.fetchFn(url, { method, headers, body: requestBody, signal });

    // A streamed body is consumed by the first fetch and cannot be replayed, so
    // we cannot transparently retry it after a token refresh.
    const bodyIsOneShot = typeof ReadableStream !== 'undefined' && requestBody instanceof ReadableStream;

    // Retry once on 401 after refreshing the token.
    if (response.status === 401 && !bodyIsOneShot) {
      this.tokenManager.invalidate();
      const retryToken = await this.tokenManager.getToken();
      headers.Authorization = `Bearer ${retryToken}`;

      const retryResponse = await this.fetchFn(url, { method, headers, body: requestBody, signal });
      if (retryResponse.status === 401) {
        throw new AuthenticationError('Authentication failed after token refresh');
      }
      return retryResponse;
    }

    return response;
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

    throw await this.toApiError(response);
  }

  private async toApiError(response: Response): Promise<ApiError> {
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

    return new ApiError(message, response.status, code);
  }

  private buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const url = `${this.baseUrl}${path}`;

    if (!query) return url;

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }

    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }
}
