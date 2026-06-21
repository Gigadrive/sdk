import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';

/** A nested reference to the application that served a request. */
export interface NetworkRequestApplicationRef {
  id: string;
  name: string;
}

/** A nested reference to the deployment that served a request. */
export interface NetworkRequestDeploymentRef {
  id: string;
  status: string;
}

/** A nested reference to the function route that handled a request. */
export interface NetworkRequestFunctionRef {
  id: string;
  name: string | null;
  path: string;
  region: string | null;
}

/** A nested reference to the static asset that served a request. */
export interface NetworkRequestAssetRef {
  id: string;
  path: string;
  objectKey: string;
}

/** A nested reference to the storage bucket involved in a request. */
export interface NetworkRequestBucketRef {
  id: string;
  name: string;
  slug: string;
}

/** A nested reference to the storage object involved in a request. */
export interface NetworkRequestObjectRef {
  id: string;
  key: string;
  contentType: string | null;
}

/** The HTTP request details captured for a network request. */
export interface NetworkRequestDetails {
  method: string;
  hostname: string;
  path: string;
  query: string | null;
  protocol: string | null;
  country: string | null;
  userAgent: string | null;
  referer: string | null;
}

/** The HTTP response details captured for a network request. */
export interface NetworkResponseDetails {
  status: number | null;
  cacheStatus: 'hit' | 'miss' | 'bypass' | 'revalidated' | 'stale' | 'updating' | null;
  cacheHit: boolean | null;
  region: string | null;
  edgeLocation: string | null;
}

/** Byte and timing metrics for a network request. */
export interface NetworkRequestMetrics {
  requestBodyBytes: number | null;
  responseBodyBytes: number | null;
  bytesSent: number | null;
  durationMs: number | null;
}

/** A single observed request served through the Gigadrive Network edge (summary form). */
export interface NetworkRequestSummary {
  id: string;
  application: NetworkRequestApplicationRef;
  deployment: NetworkRequestDeploymentRef | null;
  deploymentFunction: NetworkRequestFunctionRef | null;
  deploymentAsset: NetworkRequestAssetRef | null;
  storageBucket: NetworkRequestBucketRef | null;
  storageObject: NetworkRequestObjectRef | null;
  request: NetworkRequestDetails;
  response: NetworkResponseDetails;
  metrics: NetworkRequestMetrics;
  startedAt: string;
  completedAt: string | null;
}

/** A full network request record, including sanitized request/response headers. */
export interface NetworkRequest extends NetworkRequestSummary {
  /** Sanitized request headers captured for debugging. */
  requestHeaders: Record<string, string>;
  /** Sanitized response headers captured for debugging. */
  responseHeaders: Record<string, string>;
}

/** Query filters for listing application requests. All fields are optional. */
export interface ListRequestsQuery {
  /** Filter to requests served by one deployment. */
  deploymentId?: string;
  /** Filter to requests served by one function route. */
  deploymentFunctionId?: string;
  /** Filter to requests served by one static asset route. */
  deploymentAssetId?: string;
  /** Filter to storage delivery requests for one bucket. */
  storageBucketId?: string;
  /** Filter to storage delivery requests for one object. */
  storageObjectId?: string;
  /** Only include requests that started at or after this ISO 8601 timestamp. */
  from?: string;
  /** Only include requests that started before or at this ISO 8601 timestamp. */
  to?: string;
  /** Maximum number of records to return. */
  limit?: number;
  /** Opaque cursor from a previous response's `nextCursor`. */
  cursor?: string;
  /** Filter by HTTP method (e.g. `"GET"`). */
  method?: string;
  /** Filter by exact HTTP status code. */
  status?: number;
  /** Filter by status family (`2`, `3`, `4`, or `5`). */
  statusFamily?: number;
  /** Filter by request hostname. */
  hostname?: string;
  /** Filter to requests whose path starts with this prefix. */
  pathPrefix?: string;
  /** Filter by ISO 3166-1 alpha-2 country code. */
  country?: string;
  /** Filter by origin region. */
  region?: string;
  /** Filter by edge location. */
  edgeLocation?: string;
  /** Filter by CDN cache state. */
  cacheStatus?: string;
  /** Filter by whether the response was served from cache. */
  cacheHit?: boolean;
}

/**
 * Read observed traffic (request logs) for an application. Accessed via
 * `client.applications.requests`.
 *
 * @example
 * ```ts
 * // Recent 5xx responses for a deployment
 * const { items } = await client.applications.requests.list('app-id', {
 *   deploymentId: 'dep-id',
 *   statusFamily: 5,
 *   limit: 100,
 * });
 * ```
 */
export class ApplicationRequestsResource extends BaseResource {
  /**
   * List requests for an application, with rich filtering and cursor pagination.
   *
   * @param applicationId - The application ID (UUID).
   * @param query - Optional filters and pagination.
   * @returns A page of request summaries.
   */
  async list(applicationId: string, query?: ListRequestsQuery): Promise<Paginated<NetworkRequestSummary>> {
    return this.httpClient.get(`/applications/${applicationId}/requests`, {
      query: query as Record<string, string | number | boolean | undefined> | undefined,
    });
  }

  /**
   * Get a single request by ID, including sanitized request/response headers.
   *
   * @param applicationId - The application ID (UUID).
   * @param requestId - The request record ID (UUID).
   * @returns The full request record.
   */
  async get(applicationId: string, requestId: string): Promise<NetworkRequest> {
    return this.httpClient.get(`/applications/${applicationId}/requests/${requestId}`);
  }
}
