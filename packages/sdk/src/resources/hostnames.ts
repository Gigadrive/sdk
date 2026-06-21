import type { Paginated } from '../http-client';

/** A `*.gigadrive.app` hostname assigned to an application or deployment. */
export interface Hostname {
  /** Unique identifier (UUID). */
  id: string;
  /** The fully-qualified hostname (e.g. `"my-app.gigadrive.app"`). */
  hostname: string;
  /** The kind of hostname: `"DEPLOYMENT"`, `"BRANCH"`, or `"APP"`. */
  type: 'DEPLOYMENT' | 'BRANCH' | 'APP';
  /** Whether this hostname currently routes traffic. */
  active: boolean;
  /** The deployment this hostname points to, if any. */
  deploymentId: string | null;
  /** The branch this hostname is associated with, if any. */
  branchId: string | null;
  /** Who created the hostname: `"system"` (automatic) or `"user"`. */
  source: 'system' | 'user';
  /** ISO 8601 creation timestamp. */
  createdAt: string;
}

/** A paginated list of application hostnames, plus the production label. */
export interface ApplicationHostnameList extends Paginated<Hostname> {
  /** The application's production hostname label (`{label}.gigadrive.app`), or `null` if none is set. */
  label: string | null;
}
