/** An environment variable attached to an organization, application, or environment. */
export interface EnvVar {
  /** Unique identifier. */
  id: string;
  /** The variable name (e.g. `DATABASE_URL`). */
  key: string;
  /** The variable value. `null` when {@link sensitive} is `true` and the value is hidden from API responses. */
  value: string | null;
  /** When `true`, the value is redacted in API responses to protect secrets. */
  sensitive: boolean;
  /** The scope level at which this variable is defined. */
  scope: 'organization' | 'application' | 'environment';
  /** The environment ID, if this variable is scoped to a specific environment. */
  environmentId: string | null;
  /** The human-readable environment name, if scoped to a specific environment. */
  environmentName: string | null;
  /** ISO 8601 timestamp of when the variable was created. */
  createdAt: string;
  /** ISO 8601 timestamp of when the variable was last updated. */
  updatedAt: string;
}

/** Input for creating a new environment variable. */
export interface CreateEnvVarInput {
  /** The variable name (e.g. `DATABASE_URL`). Must be unique within its scope. */
  key: string;
  /** The variable value. */
  value: string;
  /** Mark the variable as sensitive to hide its value in API responses. */
  sensitive?: boolean;
  /** The scope level. Defaults to the parent resource's scope. */
  scope?: 'organization' | 'application' | 'environment';
  /** The environment ID, when creating an environment-scoped variable. */
  environmentId?: string;
}

/** Input for updating an existing environment variable. All fields are optional — only provided fields are changed. */
export interface UpdateEnvVarInput {
  /** New variable name. */
  key?: string;
  /** New variable value. */
  value?: string;
  /** Change the sensitive flag. */
  sensitive?: boolean;
}

/**
 * A resolved environment variable returned by the pull endpoint. Only
 * non-sensitive variables are returned, so {@link value} is always the real value.
 */
export interface ResolvedEnvVar {
  /** The variable name (e.g. `DATABASE_URL`). */
  key: string;
  /** The resolved variable value. */
  value: string;
  /** Where the resolved value came from after applying org → app → environment inheritance. */
  source: 'organization' | 'application' | 'environment';
}

/** Query options for {@link ApplicationEnvVarsResource.pull}. */
export interface PullEnvVarsQuery {
  /**
   * Resolve environment-specific overrides for this environment slug on top of
   * the organization and application baseline. Omit for the local development
   * baseline (organization + application-wide variables only).
   */
  environment?: string;
}

/** Result of pulling resolved environment variables for local development. */
export interface PullEnvVarsResult {
  /** Resolved, non-sensitive variables, ready to write to a local `.env` file. */
  items: ResolvedEnvVar[];
  /** Number of resolved variables returned. */
  total: number;
  /**
   * Number of sensitive variables that were resolved but intentionally omitted.
   * Secrets are never returned by the pull endpoint.
   */
  omittedSensitive: number;
}
