// Vercel Build Output API v3 types

// #region Configuration
// .vercel/output/config.json
// https://vercel.com/docs/build-output-api/v3/configuration

export type Config = {
  version: 3;
  routes?: Route[];
  images?: ImagesConfig;
  wildcard?: WildcardConfig;
  overrides?: OverrideConfig;
  cache?: string[];
  crons?: CronsConfig;
};

export type Route = Source | Handler;

export type Source = {
  src: string;
  dest?: string;
  headers?: Record<string, string>;
  methods?: string[];
  continue?: boolean;
  caseSensitive?: boolean;
  check?: boolean;
  status?: number;
  has?: Array<HostHasField | HeaderHasField | CookieHasField | QueryHasField>;
  missing?: Array<HostHasField | HeaderHasField | CookieHasField | QueryHasField>;
  locale?: Locale;
  middlewareRawSrc?: string[];
  middlewarePath?: string;
};

export type Locale = {
  redirect?: Record<string, string>;
  cookie?: string;
};

export type HostHasField = {
  type: 'host';
  value: string;
};

export type HeaderHasField = {
  type: 'header';
  key: string;
  value?: string;
};

export type CookieHasField = {
  type: 'cookie';
  key: string;
  value?: string;
};

export type QueryHasField = {
  type: 'query';
  key: string;
  value?: string;
};

export type HandleValue =
  | 'rewrite'
  | 'filesystem' // check matches after the filesystem misses
  | 'resource'
  | 'miss' // check matches after every filesystem miss
  | 'hit'
  | 'error'; //  check matches after error (500, 404, etc.)

type Handler = {
  handle: HandleValue;
  src?: string;
  dest?: string;
  status?: number;
};

export type ImageFormat = 'image/avif' | 'image/webp';

export type RemotePattern = {
  protocol?: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname?: string;
};

export type ImagesConfig = {
  sizes: number[];
  domains: string[];
  remotePatterns?: RemotePattern[];
  minimumCacheTTL?: number; // seconds
  formats?: ImageFormat[];
  dangerouslyAllowSVG?: boolean;
  contentSecurityPolicy?: string;
  contentDispositionType?: string;
};

export type WildCard = {
  domain: string;
  value: string;
};

export type WildcardConfig = Array<WildCard>;

export type Override = {
  path?: string;
  contentType?: string;
};

export type OverrideConfig = Record<string, Override>;

export type Cache = string[];

export type Cron = {
  path: string;
  schedule: string;
};

export type CronsConfig = Cron[];

// #region Serverless Functions
// .vercel/output/functions
// https://vercel.com/docs/build-output-api/v3/primitives#serverless-functions

export type ServerlessFunctionConfig = {
  handler: string;
  runtime: string;
  memory?: number;
  maxDuration?: number;
  environment?: Record<string, string>[];
  regions?: string[];
  supportsWrapper?: boolean;
  supportsResponseStreaming?: boolean;
  experimentalResponseStreaming?: boolean; // seems to be deprecated
  filePathMap?: Record<string, string>;
};

export type NodejsServerlessFunctionConfig = ServerlessFunctionConfig & {
  launcherType: 'Nodejs';
  shouldAddHelpers?: boolean; // default: false
  shouldAddSourceMapSupport?: boolean; // default: false
};

// #region Edge Functions
// .vercel/output/functions
// https://vercel.com/docs/build-output-api/v3/primitives#edge-functions

export type EdgeFunctionConfig = {
  runtime: 'edge';
  entrypoint: string;
  envVarsInUse?: string[];
  regions?: 'all' | string | string[];
};

// #region Prerender Functions
// .vercel/output/functions
// https://vercel.com/docs/build-output-api/v3/primitives#prerender-functions

export type PrerenderFunctionConfig = {
  expiration: number | false;
  group?: number;
  bypassToken?: string;
  fallback?: string;
  allowQuery?: string[];
  passQuery?: boolean;
};
