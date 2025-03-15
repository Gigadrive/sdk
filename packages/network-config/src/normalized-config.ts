import { type Region } from './regions';
import { type Runtime } from './runtime';

/**
 * The object structure that all config versions will be parsed into.
 * This is done to provide a consistent interface for the rest of the codebase and easily provision the necessary resources, regardless of the config version.
 */
export interface NormalizedConfig {
  /**
   * The regions to deploy the project to.
   */
  regions: Region[];

  assets?: {
    /**
     * The relative file paths of the static assets to be deployed to the edge.
     */
    paths?: string[];

    /**
     * The prefix to strip from the asset path when serving.
     */
    prefixToStrip?: string;

    /**
     * Overrides for specific assets. Can be used to change the path or Content-Type of an asset.
     */
    overrides?: Record<
      string,
      {
        path?: string;
        contentType?: string;
      }
    >;

    /**
     * Whether routes for the assets should be generated during deployment.
     */
    dynamicRoutes?: boolean;

    /**
     * If true, the assets will be cached at the edge during deployment.
     */
    populateCache?: boolean;
  };

  /**
   * Additional environment variables to set during runtime and build.
   */
  environmentVariables: Record<string, string>;

  /**
   * The bash commands that will be run to build the project.
   */
  commands: string[];

  entrypoints: Array<NormalizedConfigEntrypoint>;

  routes: Array<NormalizedConfigRoute>;

  services?: Array<NormalizedConfigService>;

  /**
   * Warning codes to be printed to the output during deployment.
   */
  warnings: string[];

  /**
   * Error codes to be printed to the output during deployment.
   */
  errors: string[];
}

export interface NormalizedConfigService {
  type: NormalizedConfigServiceType;
}

export type NormalizedConfigServiceType = 'redis' | 'postgres';

export type UpstashAWSRegion =
  | 'us-east-1'
  | 'us-east-2'
  | 'us-west-1'
  | 'us-west-2'
  | 'eu-central-1'
  | 'eu-west-1'
  | 'eu-west-2'
  | 'sa-east-1'
  | 'ap-south-1'
  | 'ap-northeast-1'
  | 'ap-southeast-1'
  | 'ap-southeast-2';

export interface NormalizedConfigServiceRedis extends NormalizedConfigService {
  envBindings?: Record<'url' | 'host' | 'port' | 'password' | 'db' | 'ssl', string>;
  primaryRegion?: UpstashAWSRegion | 'us-central1';
  readRegions?: UpstashAWSRegion[];
  eviction?: boolean;
}

export type NeonAWSRegion =
  | 'us-east-1'
  | 'us-east-2'
  | 'us-west-2'
  | 'ap-southeast-1'
  | 'ap-southeast-2'
  | 'eu-central-1'
  | 'eu-west-2'
  | 'sa-east-1';

export interface NormalizedConfigServicePostgres extends NormalizedConfigService {
  envBindings?: Record<'url' | 'host' | 'port' | 'user' | 'password' | 'database', string>;
  postgresVersion?: '17' | '16' | '15' | '14';
  region?: NeonAWSRegion;
}

export interface NormalizedConfigEntrypoint {
  displayName?: string;
  path: string;
  runtime: Runtime;
  memory: number;
  maxDuration: number;
  schedule?: string;
  symlinks?: Record<string, string>;
  environmentVariables?: Record<string, string>;
  streaming?: boolean;
  package?: {
    rootOverwrite?: string;
    filePathMap?: Record<string, string>;
  };
}

export interface NormalizedConfigRoute {
  path: string;
  destination: string;
  handler: NormalizedConfigRouteHandler | undefined;
  methods: NormalizedConfigRouteMethod[];
  headers: Record<string, string>;
  positiveRequirements?: NormalizedConfigRouteMatchRequirements;
  negativeRequirements?: NormalizedConfigRouteMatchRequirements;
  status?: number;
}

export type NormalizedConfigRouteHandler =
  | 'SERVERLESS_FUNCTION'
  | 'SERVERLESS_FUNCTION_STREAMING'
  | 'HTTP_REDIRECT'
  | 'HTTP_PROXY'
  | 'ASSET';

export type NormalizedConfigRouteMethod = 'ANY' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type NormalizedConfigRouteMatchRequirements =
  | []
  | [
      | {
          /**
           * The type of request element to check
           */
          type: 'host';
          /**
           * A regular expression used to match the value. Named groups can be used in the destination
           */
          value: string;
        }
      | {
          /**
           * The type of request element to check
           */
          type: 'header' | 'cookie' | 'query';
          /**
           * The name of the element contained in the particular type
           */
          key: string;
          /**
           * A regular expression used to match the value. Named groups can be used in the destination
           */
          value?: string;
        },
    ];
