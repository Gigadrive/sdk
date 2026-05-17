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
