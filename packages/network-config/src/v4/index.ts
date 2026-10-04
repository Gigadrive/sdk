import type {
  ContainerRuntime,
  NeonAWSRegion,
  NormalizedConfigRouteMatchRequirements,
  NormalizedConfigRouteMethod,
  NormalizedImagePolicy,
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

  /** Managed image optimization policy for this deployment. */
  images?: Partial<NormalizedImagePolicy> | null;

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
  env?: Record<string, string>;

  /** Declares managed services to provision for the deployment environment. */
  services?: ConfigV4Services;

  /**
   * Container images to run, keyed by name. A container without `sidecar: true`
   * runs as a function that routes target with `destination: container:<name>`.
   * A sidecar runs next to every function instance and answers at `<name>:<port>`.
   * A name is 1 to 63 lowercase letters, digits, `-` or `_`, starts with a
   * letter (so it never reads as an IP address), and is not `localhost`.
   *
   * @example
   * ```yaml
   * containers:
   *   web:
   *     build: .
   *     port: 3000
   *   redis:
   *     image: redis:7-alpine
   *     sidecar: true
   * ```
   */
  containers?: Record<string, ConfigV4Container> | null;

  /**
   * Project-relative path of a Compose file whose services are imported as
   * `containers`. Entries in `containers` win over imported services of the
   * same name.
   */
  compose?: string | null;
}

/** One entry of the v4 `containers` map. Exactly one of `image` and `build` is required. */
export interface ConfigV4Container {
  /** Registry image reference, e.g. `redis:7-alpine` or `ghcr.io/acme/api:1.4`. */
  image?: string;
  /** Build context directory, or the full build settings, for a Dockerfile in the repository. */
  build?: string | ConfigV4ContainerBuild;
  /** Run next to every function instance instead of serving routes. Defaults to `false`. */
  sidecar?: boolean;
  /** TCP port the container listens on. Defaults to the image's first exposed port, then 8080. */
  port?: number;
  /** Replaces the image `ENTRYPOINT`. A string is split into words the way Compose splits it. */
  entrypoint?: string | string[];
  /** Replaces the image `CMD`. A string is split into words the way Compose splits it. */
  command?: string | string[];
  /** Environment variables baked into the container, merged over the image `ENV`. */
  env?: Record<string, string>;
  /** Replaces the image `WORKDIR`. Must be absolute. */
  working_dir?: string;
  /**
   * Replaces the image `USER`: a name, a uid, `name:group` or `uid:gid`. A bare
   * uid may be written as a number. Root is never used: a root image runs as a
   * dedicated non-root user.
   */
  user?: string | number;
  /** Memory in MB, a whole number from 128 to 3009. Defaults to 512 for a container function and 256 for a sidecar. */
  memory?: number;
  /** Maximum lifetime of one request, in seconds. Container functions only. */
  max_duration?: number;
  /** Stream responses. Defaults to `true`. Container functions only. */
  streaming?: boolean;
  /** Run on a timer, like a function `schedule`. Container functions only. */
  schedule?: string;
}

/** Dockerfile build settings for a container. */
export interface ConfigV4ContainerBuild {
  /** Project-relative build context. Defaults to `.`. */
  context?: string;
  /** Dockerfile path relative to the context. Defaults to `Dockerfile`. */
  dockerfile?: string;
  /** Build stage to stop at. */
  target?: string;
  /** Build arguments. */
  args?: Record<string, string>;
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

/** Managed services accepted under the v4 `services` key. */
export interface ConfigV4Services {
  /** Managed Redis configuration. `null` selects provider defaults. */
  redis?: ConfigV4ServiceRedis | null;
  /** Managed Postgres configuration. `null` selects provider defaults. */
  postgres?: ConfigV4ServicePostgres | null;
  /** Declarative File Storage buckets for the deployment environment. */
  storage?: ConfigV4ServiceStorage;
  /**
   * Queues for the deployment environment, keyed by name. `null` declares a
   * pull queue with default settings.
   *
   * @example
   * ```yaml
   * services:
   *   queues:
   *     emails:
   *       consumer: /api/queues/emails
   *       maxAttempts: 5
   *       schedules:
   *         daily-digest:
   *           cron: '0 8 * * MON-FRI'
   *           timezone: Europe/Berlin
   *           body: { kind: digest }
   *     jobs: null
   * ```
   */
  queues?: Record<string, ConfigV4Queue | null>;
}

/** A duration in seconds, or a string such as `30s`, `10m`, `1.5h` or `4d`. */
export type ConfigV4QueueDuration = number | `${number}${'s' | 'm' | 'h' | 'd'}`;

/** Settings for a declaratively provisioned queue. Omitted settings keep the platform defaults. */
export interface ConfigV4Queue {
  /**
   * Deployment-relative path that receives each message as a signed POST, for
   * example `/api/queues/emails`. Omit it for a pull queue.
   */
  consumer?: string | null;
  /** How long a push delivery may run, or how long a received message stays leased. Defaults to 60 seconds. */
  visibilityTimeout?: ConfigV4QueueDuration;
  /** How long an undelivered message is kept. Defaults to 4 days, at most 14 days. */
  retention?: ConfigV4QueueDuration;
  /** Deliveries per message before it moves to the dead-letter list. Defaults to 10. */
  maxAttempts?: number;
  /** Exponential backoff between failed deliveries. Defaults to 5 seconds up to 15 minutes. */
  retryBackoff?: { min?: ConfigV4QueueDuration; max?: ConfigV4QueueDuration };
  /** How long a deduplication key is remembered. Defaults to 24 hours. */
  deduplicationWindow?: ConfigV4QueueDuration;
  /** Most push deliveries in flight at once. Defaults to 100. */
  concurrency?: number | null;
  /** Most deliveries started per period. The period defaults to one second. */
  rateLimit?: { count: number; period?: ConfigV4QueueDuration } | null;
  /** Keep messages that run out of attempts for inspection and redrive. Defaults to `true`. */
  deadLetter?: boolean;
  /** Cron schedules that send a message into this queue, keyed by schedule name. */
  schedules?: Record<string, ConfigV4QueueSchedule>;
}

/** A recurring send into a queue. */
export interface ConfigV4QueueSchedule {
  /** Five-field cron expression, or a macro such as `@hourly`. */
  cron: string;
  /** IANA time zone the expression is evaluated in. Defaults to `UTC`. */
  timezone?: string;
  /** Message body. Strings are sent as is; any other value is serialized as JSON. */
  body?: unknown;
  /** Content type of the body. Defaults to `text/plain` for a string body and `application/json` otherwise. */
  contentType?: string;
  /** Headers delivered with every message from this schedule. */
  headers?: Record<string, string>;
  /** Set to `false` to keep the schedule without sending. Defaults to `true`. */
  enabled?: boolean;
}

/** Declarative File Storage configuration for one deployment environment. */
export interface ConfigV4ServiceStorage extends ConfigV4Service {
  /**
   * Buckets keyed by their immutable environment-scoped name.
   *
   * Use `null` or an empty object to accept the default private visibility.
   * Names are validated exactly and are never normalized. The environment and
   * global CDN/S3 slug are intentionally not configurable here.
   *
   * @example
   * ```yaml
   * services:
   *   storage:
   *     buckets:
   *       assets:
   *         visibility: public
   *       uploads: null
   * ```
   */
  buckets: Record<string, ConfigV4StorageBucket | null>;
}

/** Optional settings for a declaratively provisioned File Storage bucket. */
export interface ConfigV4StorageBucket {
  /** Access policy applied when the bucket is first provisioned. Defaults to `private`. */
  visibility?: 'public' | 'private';
}

export interface ConfigV4FunctionSettings {
  /**
   * The memory limit for the function in MB.
   */
  memory?: number;
  /**
   * Maximum lifetime of one HTTP request, response stream, or WebSocket connection, in seconds.
   * Defaults to 30 seconds and may not be higher than eight hours (28,800 seconds).
   *
   * This is an invocation limit. It does not control how long the platform retains or reuses the
   * underlying execution environment after the invocation finishes.
   */
  max_duration?: number;
  /**
   * The runtime to use for the function. `docker` builds the matched file as a
   * Dockerfile, with its directory as the build context, and runs the image as
   * the function. Routes target it by the Dockerfile's path, like any other
   * function file.
   */
  runtime?: Runtime | ContainerRuntime;
  /**
   * TCP port the image listens on. Only for `runtime: docker`. Defaults to the
   * image's first exposed port, then 8080.
   */
  port?: number;
  /**
   * Enable function response streaming. When omitted, Node and Bun runtimes stream by default.
   */
  streaming?: boolean;
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
