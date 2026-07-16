import { BaseResource } from './base-resource';

/** Input for minting a routing-only sticky session URL. */
export interface CreateStickySessionUrlInput {
  /** Opaque application key shared by callers that must reach the same instance. */
  key: string;
  /** Relative deployment route, including any application query parameters. */
  endpoint: string;
  /** HTTP method used to resolve the target route. Defaults to `GET`. */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH';
  /** URL lifetime in seconds. Defaults to four hours; accepted range is 60–86,400. */
  expiresInSeconds?: number;
}

/** A signed sticky URL and its absolute ISO 8601 expiration time. */
export interface CreateStickySessionUrlResult {
  url: string;
  expiresAt: string;
}

/**
 * Creates protocol-independent sticky routing URLs for MicroVM functions.
 *
 * The URL selects an instance but does not authenticate an application user or
 * store application state. Reusing the same key and unexpired URL keeps HTTP,
 * streaming, and WebSocket traffic on the same function instance.
 */
export class StickySessionsResource extends BaseResource {
  /**
   * Mints a signed URL for an opaque application key.
   *
   * Deployed Gigadrive workloads can call this with a zero-config
   * `GigadriveClient`; the platform injects `GIGADRIVE_CLIENT_ID` and
   * `GIGADRIVE_CLIENT_SECRET` using the SDK's existing credential chain.
   */
  async createUrl(input: CreateStickySessionUrlInput): Promise<CreateStickySessionUrlResult> {
    return this.httpClient.post('/sticky-sessions/urls', {
      body: {
        ...input,
        method: input.method ?? 'GET',
      },
    });
  }
}
