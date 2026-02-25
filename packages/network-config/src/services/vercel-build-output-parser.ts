import { getFilesForPattern } from '@gigadrive/build-utils';
import { deepMerge } from '@gigadrive/commons';
import { Effect } from 'effect';
import path from 'node:path';
import { type Config, type ServerlessFunctionConfig } from '../build-output-v3';
import { determineRepoRoot } from '../build-output-v3/determine-repo-root';
import { getDefaultPathMap } from '../build-output-v3/get-default-path-map';
import { getMonorepoFiles } from '../build-output-v3/get-monorepo-files';
import { translateVercelRegion } from '../build-output-v3/translate-vercel-region';
import { translateVercelRuntime } from '../build-output-v3/translate-vercel-runtime';
import { ConfigFileParseError } from '../errors';
import type {
  NormalizedConfig,
  NormalizedConfigRoute,
  NormalizedConfigRouteHandler,
  NormalizedConfigRouteMethod,
} from '../normalized-config';
import type { Region } from '../regions';
import { RawConfigReader } from './raw-config-reader';

const CONFIG_PATH = '.vercel/output/config.json';
const FUNCTIONS_FOLDER = '.vercel/output/functions';
const FUNCTION_CONFIGS_PATTERN = `${FUNCTIONS_FOLDER}/**/*.func/.vc-config.json`;

export class VercelBuildOutputParser extends Effect.Service<VercelBuildOutputParser>()('VercelBuildOutputParser', {
  effect: Effect.gen(function* () {
    const rawConfigReader = yield* RawConfigReader;

    /**
     * Transforms a parsed config using Vercel's Build Output API v3.
     *
     * @param parseResult - The base NormalizedConfig
     * @param projectFolder - Absolute path to the project root
     */
    const parse = Effect.fn('VercelBuildOutputParser.parse')(function* (
      parseResult: NormalizedConfig,
      projectFolder: string
    ) {
      const config = yield* rawConfigReader.readConfigFile<Config>(path.join(projectFolder, CONFIG_PATH));

      if (!config || config.version < 3) {
        return parseResult;
      }

      const functionData = yield* loadFunctions(config, parseResult, projectFolder);
      const assetOverrides = loadAssetOverrides(config, parseResult);

      return deepMerge(parseResult, functionData, assetOverrides);
    });

    const loadFunctions = Effect.fn('VercelBuildOutputParser.loadFunctions')(function* (
      config: Config,
      parseResult: NormalizedConfig,
      projectFolder: string
    ) {
      const functionConfigs = yield* Effect.tryPromise({
        try: () => getFilesForPattern(FUNCTION_CONFIGS_PATTERN, projectFolder),
        catch: (error) =>
          new ConfigFileParseError({
            message: `Failed to scan for function configs: ${error instanceof Error ? error.message : String(error)}`,
            filePath: projectFolder,
          }),
      });

      const result: Partial<NormalizedConfig> = {
        entrypoints: [],
        routes: [],
        regions: [...parseResult.regions],
      };

      for (const functionConfigPath of functionConfigs) {
        const functionConfig = yield* rawConfigReader.readConfigFile<ServerlessFunctionConfig>(
          path.join(projectFolder, functionConfigPath)
        );

        if (!functionConfig) {
          parseResult.errors.push(`Failed to read function config at ${functionConfigPath}`);
          continue;
        }

        const functionPathRelative = path.dirname(functionConfigPath).replace(FUNCTIONS_FOLDER, '');
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

        const translatedRegions = regions.length > 0 ? regions.map(translateVercelRegion) : ['us-east-1'];
        result.regions = Array.from(new Set([...(result.regions ?? []), ...translatedRegions])) as Region[];

        const environmentVariables: Record<string, string> = {};
        if (environment && typeof environment === 'object') {
          for (const env of Object.values(environment)) {
            Object.assign(environmentVariables, env);
          }
        }

        const streaming = runtime.startsWith('node-') || runtime.startsWith('bun-');

        let filePathMap: Record<string, string> = {};
        for (const [key, value] of Object.entries(configFilePathMap)) {
          filePathMap[path.join(projectFolder, key)] = value;
        }

        if (Object.keys(filePathMap).length === 0) {
          filePathMap = yield* getDefaultPathMap(path.join(projectFolder, functionDirectory));
        }

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
            ?.filter((r) => 'dest' in r && r.dest === `/${functionName}`)
            .map(
              (r) =>
                ({
                  path: ('src' in r ? r.src : undefined) ?? `/${functionName}`,
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
      } as Partial<NormalizedConfig>;
    });

    return { parse };
  }),
}) {}

const loadAssetOverrides = (config: Config, parseResult: NormalizedConfig): Partial<NormalizedConfig> => {
  return {
    assets: {
      overrides: {
        ...(parseResult.assets?.overrides ?? {}),
        ...config.overrides,
      },
    },
  };
};
