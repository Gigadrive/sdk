import type {
  NeonAWSRegion,
  NormalizedConfigRouteMatchRequirements,
  NormalizedConfigRouteMethod,
  NormalizedConfigServiceType,
  UpstashAWSRegion,
} from '../normalized-config';
import { Config } from '../parse-config';
import type { Runtime } from '../runtime';

export interface ConfigV4 extends Config {
  version: 4;

  /**
   * A list of presets to apply to the project. Each preset will be applied in order.
   */
  presets?: string[] | null;

  /**
   * The folder which holds the assets to be deployed to the edge. Defaults to none.
   */
  assets?: string | null;

  /**
   * If true, the assets will be cached at the edge during deployment. This may increase the deployment time, depending on the size of the assets. Defaults to false.
   */
  populateAssetCache?: boolean | null;

  /**
   * The regions to which the project will be deployed. Use "global" to deploy to all regions. More regions will incur higher costs.
   */
  regions?: string[] | null;

  /**
   * The commands to run to build the project. For example, `bun install` or `npm install`.
   */
  build_commands?: string[] | null;

  /**
   * The serverless functions to deploy.
   */
  functions?: {
    /**
     * The pattern to match the file path of the function. May be a glob pattern or a regular expression.
     */
    [pattern: string]: ConfigV4FunctionSettings;
  } | null;

  /**
   * A list of route definitions.
   *
   * @maxItems 1024
   */
  routes?:
    | {
        /**
         * A pattern that matches each incoming pathname (excluding querystring).
         */
        source: string;
        /**
         * An absolute pathname to an existing resource or an external URL.
         */
        destination: string;
        /**
         * An array of requirements that are needed to match
         *
         * @maxItems 16
         */
        has?: NormalizedConfigRouteMatchRequirements;
        /**
         * An array of requirements that are needed to match
         *
         * @maxItems 16
         */
        missing?: NormalizedConfigRouteMatchRequirements;
        /**
         * An optional integer to override the status code of the response.
         */
        statusCode?: number;
        /**
         * An optional boolean to force a redirect response.
         */
        redirect?: boolean;
        /**
         * The HTTP methods to match for the route. Defaults to all methods.
         */
        methods?: NormalizedConfigRouteMethod[];

        /**
         * Additional headers to add to the response.
         */
        headers?: {
          [k: string]: string;
        };
      }[]
    | null;

  /**
   * Additional environment variables to set during runtime and build.
   */
  env: Record<string, string>;

  /**
   * Optioanlly, specify additional services like databases to deploy.
   */
  services?: {
    /**
     * Left side is the type of service, right side is the service configuration.
     * Allowed types: `redis`, `postgres`.
     */
    [type in NormalizedConfigServiceType]?: ConfigV4Service | null;
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ConfigV4Service {}

export interface ConfigV4ServiceRedis extends ConfigV4Service {
  /**
   * Optionally, specify what environment variables the credentials will be bound to.
   * For example: `{ url: 'REDIS_URL' }` will bind the `url` environment variable to the Redis URL.
   * If you don't specify any bindings, they will be bound to the REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB, and REDIS_SSL environment variables.
   */
  envBindings?: Record<'url' | 'host' | 'port' | 'password' | 'db' | 'ssl', string>;

  /**
   * The primary region to deploy the Redis instance to.
   */
  primaryRegion?: UpstashAWSRegion | 'us-central1';

  /**
   * Optionally, add additional regions to read from. More regions will incur higher costs.
   */
  readRegions?: UpstashAWSRegion[];

  /**
   * Optionally, enable Redis eviction. This will evict the least recently used keys in order to make space for new ones.
   */
  eviction?: boolean;
}

export interface ConfigV4ServicePostgres extends ConfigV4Service {
  /**
   * Optionally, specify what environment variables the credentials will be bound to.
   * For example: `{ url: 'POSTGRES_URL' }` will bind the `url` environment variable to the Postgres URL.
   * If you don't specify any bindings, they will be bound to the POSTGRES_URL, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DATABASE environment variables.
   */
  envBindings?: Record<'url' | 'host' | 'port' | 'user' | 'password' | 'database', string>;
  /**
   * The version of Postgres to deploy.
   */
  postgresVersion?: '17' | '16' | '15' | '14';

  /**
   * The region to deploy the Postgres instance to.
   */
  region?: NeonAWSRegion;
}

export interface ConfigV4FunctionSettings {
  /**
   * The memory limit for the function in MB.
   */
  memory?: number;
  /**
   * The maximum duration of the function in seconds. May not be higher than 15 minutes.
   */
  max_duration?: number;
  /**
   * The runtime to use for the function.
   */
  runtime?: Runtime;
  /**
   * Use to create symlinks on the final function. This is useful for applications that require use of the file system, since serverless functions are ephemeral and have read-only file systems, except for /tmp.
   */
  symlinks?: {
    /**
     * Left side is where the symlink will be created, right side is the target path.
     */
    [path: string]: string;
  };
  /**
   * A glob pattern to match files that should be excluded from your Serverless Function. If you’re using a Community Runtime, the behavior might vary.
   */
  excludeFiles?: string | string[];

  /**
   * A glob pattern to match files that should be included in your Serverless Function. If you’re using a Community Runtime, the behavior might vary.
   */
  includeFiles?: string | string[];
  /**
   * Optionally, provide a schedule to run the function on periodically. Examples: `rate(1 hour)`, `rate(1 day)`, `cron(0 12 * * *)`.
   */
  schedule?: string;
}
