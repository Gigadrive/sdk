import { getFilesForPattern } from '@gigadrive/build-utils';
import fs from 'fs';
import path from 'path';
import { type Config, type Route, type ServerlessFunctionConfig } from '.';
import type {
  NormalizedConfig,
  NormalizedConfigRoute,
  NormalizedConfigRouteHandler,
  NormalizedConfigRouteMethod,
} from '../normalized-config';
import { parseRawConfig } from '../parse-raw-config';
import type { Region } from '../regions';
import type { Runtime } from '../runtime';

const configPath = '.vercel/output/config.json';
const functionConfigsPattern = '.vercel/output/functions/*.func/.vc-config.json';

/**
 * Transforms a parsed config file using Vercel's Build Output API v3
 * @param parseResult The result of parsing the existing config file
 * @param projectFolder The path to the project folder
 * @returns
 */
export const parseVercelBuildOutputV3 = async (
  parseResult: NormalizedConfig,
  projectFolder: string
): Promise<NormalizedConfig> => {
  // read config file
  const config = await readConfigFile<Config>(path.join(projectFolder, configPath));

  if (!config || config.version < 3) {
    // TODO: Log error
    return parseResult;
  }

  // TODO: Routes
  // TODO: Images
  // TODO: Wildcards
  // TODO: Cache
  // TODO: Cron
  // TODO: Edge Functions
  // TODO: Prerender Functions

  await loadFunctions(config, parseResult, projectFolder);
  await loadAssetOverrides(config, parseResult);

  return parseResult;
};

const loadAssetOverrides = async (config: Config, parseResult: NormalizedConfig) => {
  if (!parseResult.assets) {
    parseResult.assets = {
      paths: [],
      prefixToStrip: '',
    };
  }

  parseResult.assets.overrides = {
    ...(parseResult.assets.overrides ?? {}),
    ...config.overrides,
  };
};

export const loadFunctions = async (config: Config, parseResult: NormalizedConfig, projectFolder: string) => {
  const functionConfigs = await getFilesForPattern(functionConfigsPattern, projectFolder);

  // console.debug('functionConfigs', functionConfigs);

  for (const functionConfigPath of functionConfigs) {
    const functionConfig = await readConfigFile<ServerlessFunctionConfig>(path.join(projectFolder, functionConfigPath));

    if (!functionConfig) {
      parseResult.errors.push(`Failed to read function config at ${functionConfigPath}`);
      continue;
    }

    const functionName: string = path.basename(path.dirname(functionConfigPath)).replace(/\.func$/, '');
    const runtime = translateVercelRuntime(functionConfig.runtime);

    if (!runtime) {
      parseResult.errors.push(`Unsupported runtime for function ${functionName}: ${functionConfig.runtime}`);
      continue;
    }

    const functionDirectory = `.vercel/output/functions/${functionName}.func`;
    const handler = functionConfig.handler;
    const maxDuration = functionConfig.maxDuration;
    const memory = functionConfig.memory;

    // add regions and filter duplicates
    parseResult.regions = Array.from(
      new Set([
        ...(parseResult.regions ?? []),
        ...(functionConfig.regions ?? ['us-east-1']).map((r) => translateVercelRegion(r)),
      ])
    ) as Region[];

    const environmentVariables: Record<string, string> = {};

    const functionEnv = functionConfig.environment;

    if (functionEnv != null && typeof functionEnv === 'object') {
      for (const env of Object.values(functionEnv)) {
        for (const [key, value] of Object.entries(env)) {
          environmentVariables[key] = value;
        }
      }
    }

    const streaming: boolean = runtime == null || runtime.startsWith('node-') || runtime.startsWith('bun-');

    // translate filePathMap relative paths to absolute paths
    const filePathMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(functionConfig.filePathMap ?? {})) {
      filePathMap[path.join(projectFolder, key)] = value;
    }

    parseResult.entrypoints.push({
      displayName: functionName,
      runtime,
      path: handler,
      memory: memory ?? 1024,
      maxDuration: maxDuration ?? 15,
      environmentVariables,
      streaming,
      package: {
        // rootOverwrite: path.join(projectFolder, functionDirectory),
        filePathMap: filePathMap,
      },
    });

    const handlerType: NormalizedConfigRouteHandler = streaming
      ? 'SERVERLESS_FUNCTION_STREAMING'
      : 'SERVERLESS_FUNCTION';

    (
      [
        {
          path: `/${functionName}`,
          methods: ['ANY'],
          headers: {},
          destination: handler,
          handler: handlerType,
        },
        ...(config.routes
          ?.filter((r) => r.dest === `/${functionName}`)
          .map((r: Route) => ({
            path: r.src ?? `/${functionName}`,
            methods: ['ANY'] as NormalizedConfigRouteMethod[],
            headers: {},
            destination: handler,
            handler: handlerType,
          })) ?? []),
      ] as NormalizedConfigRoute[]
    ).forEach((route) => {
      parseResult.routes.push(route);
    });
  }
};

export const readConfigFile = async <T>(configFilePath: string): Promise<T | null> => {
  if (!fs.existsSync(configFilePath)) {
    // skip vercel transformation if no vercel output exists
    return null;
  }

  const parsed = await parseRawConfig(configFilePath, { disableVersionCheck: true });

  return parsed as T;
};

export const translateVercelRuntime = (runtime: string): Runtime | null => {
  switch (runtime) {
    case 'nodejs12.x':
    case 'nodejs14.x':
    case 'nodejs16.x':
    case 'nodejs18.x':
      return 'node-18';
    case 'nodejs20.x':
    case 'nodejs22.x': // TODO: Update when Lambda supports Node.js 22
      return 'node-20';
    default:
      return null;
  }
};

/**
 * @link https://vercel.com/docs/edge-network/regions#region-list
 */
export const translateVercelRegion = (region: string): string => {
  const regionMap: Record<string, string> = {
    arn1: 'eu-north-1',
    bom1: 'ap-south-1',
    cdg1: 'eu-west-3',
    cle1: 'us-east-2',
    cpt1: 'af-south-1',
    dub1: 'eu-west-1',
    fra1: 'eu-central-1',
    gru1: 'sa-east-1',
    hkg1: 'ap-east-1',
    hnd1: 'ap-northeast-1',
    iad1: 'us-east-1',
    icn1: 'ap-northeast-2',
    kix1: 'ap-northeast-3',
    lhr1: 'eu-west-2',
    pdx1: 'us-west-2',
    sfo1: 'us-west-1',
    sin1: 'ap-southeast-1',
    syd1: 'ap-southeast-2',
  };

  return regionMap[region.toLowerCase()] ?? 'us-east-1';
};
