import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';
import type { Hostname } from './hostnames';

/**
 * The lifecycle status of a deployment.
 * - `"PENDING"` — Created, waiting for artifact upload.
 * - `"QUEUED"` — Queued for processing.
 * - `"STARTING"` — Processing is starting.
 * - `"BUILDING"` — Build pipeline is running.
 * - `"PROVISIONING"` — Infrastructure is being provisioned.
 * - `"ACTIVE"` — Successfully deployed and serving traffic.
 * - `"FAILED"` — Build or provisioning failed.
 */
export type DeploymentStatus = 'PENDING' | 'QUEUED' | 'STARTING' | 'BUILDING' | 'PROVISIONING' | 'ACTIVE' | 'FAILED';

/** The severity level of a deployment log entry. */
export type DeploymentLogType = 'INFO' | 'ERROR' | 'WARN';

/** A deployment of an application to the Gigadrive Network. */
export interface Deployment {
  /** Unique identifier (UUID). */
  id: string;
  /** The application this deployment belongs to. */
  applicationId: string;
  /** Current lifecycle status. */
  status: DeploymentStatus;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/** A single log entry from a deployment's build or provisioning pipeline. */
export interface DeploymentLog {
  /** Unique identifier. */
  id: string;
  /** The log message text. */
  message: string;
  /** Severity level: `"INFO"`, `"ERROR"`, or `"WARN"`. */
  type: DeploymentLogType;
  /** ISO 8601 timestamp of when this log entry was created. */
  createdAt: string;
}

/** A paginated page of deployment log entries. */
export interface DeploymentLogPage {
  /** Total number of log entries for this deployment. */
  totalItems: number;
  /** Maximum number of entries per page. */
  limit: number;
  /** Number of entries skipped (for pagination). */
  offset: number;
  /** The log entries on this page. */
  items: DeploymentLog[];
}

/** Input for creating a new deployment. */
export interface CreateDeploymentInput {
  /** The application to deploy. */
  applicationId: string;
  /** Optional git source for the deployment. When omitted, the deployment expects an artifact upload. */
  gitSource?: {
    /** The git ref to deploy (e.g. `"main"`, `"v1.0.0"`). */
    ref: string;
    /** A specific commit SHA to deploy. If omitted, the HEAD of the ref is used. */
    sha?: string;
  };
}

/** Query filters for listing deployments. All fields are optional. */
export interface ListDeploymentsQuery {
  /** Filter by organization ID. */
  organizationId?: string;
  /** Filter by application ID. */
  applicationId?: string;
  /** Filter by deployment status. */
  status?: DeploymentStatus;
}

/** Query parameters for fetching deployment logs. */
export interface ListDeploymentLogsQuery {
  /** Number of log entries to skip (for pagination). */
  offset?: number;
  /** Maximum number of log entries to return per page. */
  limit?: number;
  /** Only return log entries created after this ISO 8601 timestamp. Useful for tailing logs. */
  'createdAt[gt]'?: string;
}

/** Result from starting a multipart deployment upload. */
export interface StartUploadResult {
  /** The multipart upload ID. Pass this to subsequent `getPresignedUrl` and `completeUpload` calls. */
  uploadId: string;
}

/** A presigned URL for uploading a single part of a multipart deployment upload. */
export interface PresignedUrlResult {
  /** The presigned URL to PUT the part data to. */
  url: string;
}

/** A successfully uploaded part, used to complete the multipart upload. */
export interface UploadPart {
  /** The 1-based part number. */
  partNumber: number;
  /** The ETag returned by the storage provider after uploading this part. */
  etag: string;
}

/**
 * Manage deployments — create, monitor, upload artifacts, and read logs.
 * Accessed via {@link GigadriveClient.deployments}.
 *
 * ## Deployment lifecycle
 *
 * 1. **Create** a deployment with {@link create}.
 * 2. **Upload** build artifacts using the multipart upload flow
 *    ({@link startUpload} → {@link getPresignedUrl} → {@link uploadPart} → {@link completeUpload}).
 * 3. **Monitor** the build with {@link get} and {@link getLogs}.
 *
 * @example
 * ```ts
 * // Create a deployment
 * const deployment = await client.deployments.create({ applicationId: 'app-id' });
 *
 * // Check status
 * const updated = await client.deployments.get(deployment.id);
 * console.log(`Status: ${updated.status}`);
 *
 * // Read build logs
 * const logs = await client.deployments.getLogs(deployment.id, { limit: 50 });
 * for (const entry of logs.items) {
 *   console.log(`[${entry.type}] ${entry.message}`);
 * }
 * ```
 */
export class DeploymentsResource extends BaseResource {
  /**
   * List deployments, optionally filtered by organization, application, or status.
   *
   * Requires the `network:deployments:read` scope.
   *
   * @param query - Optional filters.
   * @returns A paginated list of deployments.
   *
   * @example
   * ```ts
   * // All deployments for an application
   * const { items } = await client.deployments.list({ applicationId: 'app-id' });
   *
   * // Only active deployments
   * const { items } = await client.deployments.list({ status: 'ACTIVE' });
   * ```
   */
  async list(query?: ListDeploymentsQuery): Promise<Paginated<Deployment>> {
    return this.httpClient.get('/deployments', {
      query: query as Record<string, string | undefined> | undefined,
    });
  }

  /**
   * Get a deployment by ID, including its current status.
   *
   * @param deploymentId - The deployment ID (UUID).
   * @returns The deployment with its current status.
   *
   * @example
   * ```ts
   * const deployment = await client.deployments.get('deployment-id');
   * if (deployment.status === 'ACTIVE') {
   *   console.log('Deployment is live!');
   * }
   * ```
   */
  async get(deploymentId: string): Promise<Deployment> {
    return this.httpClient.get(`/deployments/${deploymentId}`);
  }

  /**
   * Create a new deployment. The deployment starts in `"PENDING"` status,
   * waiting for artifact upload. Use the multipart upload methods
   * ({@link startUpload}, {@link getPresignedUrl}, {@link uploadPart},
   * {@link completeUpload}) to upload build artifacts.
   *
   * Requires the `network:deployments:trigger` scope.
   *
   * @param data - The application ID and optional git source.
   * @returns The newly created deployment.
   *
   * @example
   * ```ts
   * const deployment = await client.deployments.create({
   *   applicationId: 'app-id',
   * });
   * console.log(`Created deployment ${deployment.id} (${deployment.status})`);
   * ```
   */
  async create(data: CreateDeploymentInput): Promise<Deployment> {
    return this.httpClient.post('/deployments', data);
  }

  /**
   * Start a multipart upload for deployment artifacts. This initiates a new
   * multipart upload and returns an upload ID for subsequent part uploads.
   *
   * The deployment must be in `"PENDING"` status.
   *
   * @param deploymentId - The deployment ID (UUID).
   * @returns An object containing the `uploadId` for subsequent calls.
   *
   * @example
   * ```ts
   * const { uploadId } = await client.deployments.startUpload('deployment-id');
   * ```
   */
  async startUpload(deploymentId: string): Promise<StartUploadResult> {
    return this.httpClient.post(`/deployments/${deploymentId}/upload/start`);
  }

  /**
   * Get a presigned URL for uploading a single part of a multipart upload.
   * The URL is temporary and should be used immediately with {@link uploadPart}.
   *
   * @param deploymentId - The deployment ID (UUID).
   * @param uploadId - The multipart upload ID from {@link startUpload}.
   * @param partNumber - The 1-based part number.
   * @returns An object containing the presigned `url` to PUT the part data to.
   *
   * @example
   * ```ts
   * const { url } = await client.deployments.getPresignedUrl(
   *   'deployment-id', uploadId, 1,
   * );
   * ```
   */
  async getPresignedUrl(deploymentId: string, uploadId: string, partNumber: number): Promise<PresignedUrlResult> {
    return this.httpClient.post(`/deployments/${deploymentId}/upload/part`, { uploadId, partNumber });
  }

  /**
   * Upload a part to a presigned URL obtained from {@link getPresignedUrl}.
   * This sends the chunk data directly to the backend storage service, not
   * to the Gigadrive API. The returned `etag` is needed for
   * {@link completeUpload}.
   *
   * @param presignedUrl - The presigned URL from {@link getPresignedUrl}.
   * @param data - The chunk data to upload.
   * @param partNumber - The 1-based part number (used for error messages).
   * @returns The part number and ETag. Collect these for {@link completeUpload}.
   * @throws {@link ApiError} if the PUT request fails.
   * @throws Error if the storage provider does not return an ETag header.
   *
   * @example
   * ```ts
   * const chunk = fileBuffer.subarray(0, 10 * 1024 * 1024); // 10 MB
   * const part = await client.deployments.uploadPart(presignedUrl, chunk, 1);
   * // part = { partNumber: 1, etag: '"abc123..."' }
   * ```
   */
  async uploadPart(
    presignedUrl: string,
    data: ArrayBuffer | Uint8Array | Blob,
    partNumber: number
  ): Promise<UploadPart> {
    const response = await this.httpClient.fetchRaw(presignedUrl, {
      method: 'PUT',
      headers: {
        // Deployment artifacts are always ZIP archives.
        'Content-Type': 'application/zip',
        'Content-Length': String(data instanceof Blob ? data.size : data.byteLength),
      },
      body: data,
    });

    const etag = response.headers.get('ETag');
    if (!etag) {
      throw new Error(`No ETag received for part ${partNumber}`);
    }

    return { partNumber, etag };
  }

  /**
   * Complete a multipart upload after all parts have been uploaded via
   * {@link uploadPart}. This signals the storage provider to assemble the
   * parts into a single object and triggers the deployment build pipeline.
   *
   * @param deploymentId - The deployment ID (UUID).
   * @param uploadId - The multipart upload ID from {@link startUpload}.
   * @param parts - Array of `{ partNumber, etag }` from each {@link uploadPart} call.
   *
   * @example
   * ```ts
   * await client.deployments.completeUpload(deploymentId, uploadId, [
   *   { partNumber: 1, etag: '"abc..."' },
   *   { partNumber: 2, etag: '"def..."' },
   * ]);
   * ```
   */
  async completeUpload(deploymentId: string, uploadId: string, parts: UploadPart[]): Promise<void> {
    return this.httpClient.post(`/deployments/${deploymentId}/upload/complete`, { uploadId, parts });
  }

  /**
   * Fetch deployment logs. Supports pagination and filtering by timestamp
   * for incremental log tailing.
   *
   * @param deploymentId - The deployment ID (UUID).
   * @param query - Optional pagination and filter parameters.
   * @returns A page of log entries with total count.
   *
   * @example
   * ```ts
   * // Get the first page of logs
   * const page = await client.deployments.getLogs('deployment-id', {
   *   offset: 0,
   *   limit: 100,
   * });
   *
   * for (const entry of page.items) {
   *   const prefix = entry.type === 'ERROR' ? 'ERR' : entry.type === 'WARN' ? 'WRN' : 'INF';
   *   console.log(`[${prefix}] ${entry.message}`);
   * }
   *
   * // Tail new logs since last fetch
   * const newLogs = await client.deployments.getLogs('deployment-id', {
   *   'createdAt[gt]': lastEntry.createdAt,
   * });
   * ```
   */
  async getLogs(deploymentId: string, query?: ListDeploymentLogsQuery): Promise<DeploymentLogPage> {
    return this.httpClient.get(`/deployments/${deploymentId}/logs`, {
      query: query as Record<string, string | number | undefined> | undefined,
    });
  }

  /**
   * List the immutable `*.gigadrive.app` hostnames assigned to a deployment.
   *
   * @param deploymentId - The deployment ID (UUID).
   * @returns A paginated list of hostnames.
   *
   * @example
   * ```ts
   * const { items } = await client.deployments.getHostnames('deployment-id');
   * console.log(items.map((h) => h.hostname));
   * ```
   */
  async getHostnames(deploymentId: string): Promise<Paginated<Hostname>> {
    return this.httpClient.get(`/deployments/${deploymentId}/hostnames`);
  }
}
