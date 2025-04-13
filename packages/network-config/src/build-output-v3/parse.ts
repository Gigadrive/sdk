import { getFilesForPattern } from '@gigadrive/build-utils';
import { deepMerge } from '@gigadrive/commons';
import path from 'path';
import { type Config, type ServerlessFunctionConfig } from '.';
import type {
  NormalizedConfig,
  NormalizedConfigRoute,
  NormalizedConfigRouteHandler,
  NormalizedConfigRouteMethod,
} from '../normalized-config';
import type { Region } from '../regions';
import { determineRepoRoot } from './determine-repo-root';
import { getDefaultPathMap } from './get-default-path-map';
import { getMonorepoFiles } from './get-monorepo-files';
import { readConfigFile } from './read-config-file';
import { translateVercelRuntime } from './translate-vercel-runtime';

const configPath = '.vercel/output/config.json';
const functionsFolder = '.vercel/output/functions';
const functionConfigsPattern = `${functionsFolder}/**/*.func/.vc-config.json`;

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

  const functionData = await loadFunctions(config, parseResult, projectFolder);
  await loadAssetOverrides(config, parseResult);

  return deepMerge(parseResult, functionData);
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

export const loadFunctions = async (
  config: Config,
  parseResult: NormalizedConfig,
  projectFolder: string
): Promise<Partial<NormalizedConfig>> => {
  const functionConfigs = await getFilesForPattern(functionConfigsPattern, projectFolder);

  const result: Partial<NormalizedConfig> = {
    entrypoints: [],
    routes: [],
    regions: [],
  };

  for (const functionConfigPath of functionConfigs) {
    const functionConfig = await readConfigFile<ServerlessFunctionConfig>(path.join(projectFolder, functionConfigPath));

    if (!functionConfig) {
      parseResult.errors.push(`Failed to read function config at ${functionConfigPath}`);
      continue;
    }

    const functionPathRelative = path.dirname(functionConfigPath).replace(functionsFolder, '');
    const functionName = functionPathRelative.replace(/^\/|\.func$/g, '');
    const runtime = translateVercelRuntime(functionConfig.runtime);

    if (!runtime) {
      parseResult.errors.push(`Unsupported runtime for function ${functionName}: ${functionConfig.runtime}`);
      continue;
    }

    const functionDirectory = `.vercel/output/functions/${functionName}.func`;
    const {
      handler,
      maxDuration,
      memory,
      regions = [],
      environment,
      filePathMap: configFilePathMap = {},
    } = functionConfig;

    // Add regions or use default if empty
    const translatedRegions = regions.length > 0 ? regions.map(translateVercelRegion) : ['us-east-1'];

    // Filter duplicates
    result.regions = Array.from(new Set([...parseResult.regions, ...translatedRegions])) as Region[];

    // Process environment variables
    const environmentVariables: Record<string, string> = {};
    if (environment && typeof environment === 'object') {
      for (const env of Object.values(environment)) {
        Object.assign(environmentVariables, env);
      }
    }

    const streaming = runtime.startsWith('node-') || runtime.startsWith('bun-');

    // Process file path map
    let filePathMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(configFilePathMap)) {
      filePathMap[path.join(projectFolder, key)] = value;
    }

    // Default file path map if none provided
    if (Object.keys(filePathMap).length === 0) {
      filePathMap = getDefaultPathMap(path.join(projectFolder, functionDirectory));
    }

    // Add entrypoint
    if (!result.entrypoints) {
      result.entrypoints = [];
    }

    result.entrypoints.push({
      displayName: functionName,
      runtime,
      path: path.join(functionDirectory, handler),
      memory: memory ?? 1024,
      maxDuration: maxDuration ?? 15,
      environmentVariables,
      streaming,
      package: {
        filePathMap,
      },
    });

    // Create routes
    const handlerType: NormalizedConfigRouteHandler = streaming
      ? 'SERVERLESS_FUNCTION_STREAMING'
      : 'SERVERLESS_FUNCTION';

    const defaultRoute: NormalizedConfigRoute = {
      path: `/${functionName}`,
      methods: ['ANY'],
      headers: {},
      destination: handler,
      handler: handlerType,
    };

    const configRoutes =
      config.routes
        ?.filter((r) => r.dest === `/${functionName}`)
        .map(
          (r) =>
            ({
              path: r.src ?? `/${functionName}`,
              methods: ['ANY'] as NormalizedConfigRouteMethod[],
              headers: {},
              destination: handler,
              handler: handlerType,
            }) as NormalizedConfigRoute
        ) ?? [];

    if (!result.routes) {
      result.routes = [];
    }

    result.routes.push(defaultRoute, ...configRoutes);
  }

  return {
    ...result,
    userArchive: {
      rootOverwrite: determineRepoRoot(projectFolder, result),
      fileWhitelist: [
        `${projectFolder}/*`,
        ...getMonorepoFiles(projectFolder, result.entrypoints?.map((e) => e.package?.filePathMap ?? {}) ?? []),
      ],
    },
  };
};
