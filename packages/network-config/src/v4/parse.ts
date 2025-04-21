import { getFilesForPattern } from '@gigadrive/build-utils';
import fs from 'fs';
import { minimatch } from 'minimatch';
import type { ConfigV4, ConfigV4FunctionSettings } from '.';
import type {
  NormalizedConfig,
  NormalizedConfigEntrypoint,
  NormalizedConfigRoute,
  NormalizedConfigRouteHandler,
} from '../normalized-config';
import { AVAILABLE_REGIONS, type Region } from '../regions';

export const parseConfigV4 = async (config: ConfigV4, projectFolder: string): Promise<NormalizedConfig> => {
  const regions =
    config.regions?.includes('global') === true
      ? AVAILABLE_REGIONS
      : (config.regions?.filter((region) => region !== 'global') ?? ['global']);

  const populateAssetCache = config.populateAssetCache ?? false;
  const environmentVariables = config.env ?? {};
  const commands = config.build_commands ?? [];
  const entrypoints: NormalizedConfigEntrypoint[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.functions != null) {
    for (const [path, func] of Object.entries(config.functions)) {
      const settings = getFunctionSettings(path, config);

      if (settings == null) {
        throw new Error(`Settings invalid for function at path '${path}'`);
      }

      (await getFilesForPattern(path, projectFolder, func.excludeFiles)).forEach((file) => {
        // check if file is already in entrypoints, or if the path has a definition other than this one that matches it exactly
        if (entrypoints.find((entrypoint) => entrypoint.path === file)) {
          return;
        }

        if (config.functions != null && Object.keys(config.functions).find((func) => func === file && func !== path)) {
          return;
        }

        entrypoints.push({
          path: file,
          runtime: settings.runtime ?? 'node-20',
          memory: settings.memory ?? 128,
          maxDuration: settings.max_duration ?? 30,
          schedule: func.schedule,
          symlinks: func.symlinks,
          streaming:
            settings.runtime == null || settings.runtime.startsWith('node-') || settings.runtime.startsWith('bun-'),
        });
      });
    }
  }

  const assets: string[] = [];

  if (config.assets != null) {
    // list all files in assets folder recursively

    const assetsPath = `${projectFolder}/${config.assets}`;

    if (fs.existsSync(assetsPath) && fs.statSync(assetsPath).isDirectory()) {
      // console.debug('---- ASSET DEBUG ----');
      // console.debug('projectFolder', fs.readdirSync(assetsPath, { recursive: true }));

      // find all files in assets folder using fs
      for (const asset of fs.readdirSync(`${projectFolder}/${config.assets}`, {
        recursive: true,
      })) {
        // if file is a directory, skip it
        if (fs.statSync(`${projectFolder}/${config.assets}/${asset.toString()}`).isDirectory()) {
          continue;
        }

        const disallowedExtensions = ['.htaccess', '.htpasswd'];

        const assetName = asset.toString();

        if (disallowedExtensions.some((ext) => assetName.toLowerCase().endsWith(ext.toLowerCase()))) {
          continue;
        }

        // if it is a function, skip it
        if (getFunctionSettings(`${config.assets}/${assetName}`, config) != null) {
          continue;
        }

        assets.push(`${config.assets}/${assetName}`);
      }
    }
  }

  const routes = config.routes ?? [];

  return {
    regions: regions as Region[],
    assets: {
      paths: assets.sort(),
      prefixToStrip: (config.assets ?? '') + '/',
      dynamicRoutes: true,
      populateCache: populateAssetCache,
    },
    environmentVariables,
    commands,
    entrypoints,
    errors,
    warnings,
    routes: routes.map((route) => {
      // check if the destination has a protocol, if so use REDIRECT handler
      const handler: NormalizedConfigRouteHandler =
        route.destination.toLowerCase().startsWith('http://') || route.destination.toLowerCase().startsWith('https://')
          ? route.redirect === true
            ? 'HTTP_REDIRECT'
            : 'HTTP_PROXY'
          : route.redirect === true
            ? 'HTTP_REDIRECT'
            : 'SERVERLESS_FUNCTION';

      return {
        path: route.source,
        destination: route.destination,
        handler,
        headers: route.headers ?? {},
        methods: route.methods ?? ['ANY'],
        positiveRequirements: route.has,
        negativeRequirements: route.missing,
        status: route.statusCode,
      } as NormalizedConfigRoute;
    }),
  };
};

/**
 * Gets the runtime, memory and max duration for a given path.
 * @param path
 * @param config
 * @returns The runtime, memory and max duration for the given path. Should return undefined when a path should not be deployed as a function.
 */
export const getFunctionSettings = (path: string, config: ConfigV4): ConfigV4FunctionSettings | undefined => {
  // functions don't have to state all their options.
  // some function definitions might be glob or regex patterns.
  // go through all function definitions, find those that match the path and merge them.

  let functionSettings: ConfigV4FunctionSettings | undefined;

  for (const [key, value] of Object.entries(config.functions ?? {})) {
    // make sure to check for both glob and regex patterns
    if (minimatch(path, key) || new RegExp(key).test(path)) {
      if (functionSettings == null) {
        functionSettings = {
          memory: 128,
          max_duration: 30,
          schedule: undefined,
          symlinks: undefined,
          excludeFiles: undefined,
          includeFiles: undefined,
        };
      }

      if (value.runtime != null) {
        functionSettings.runtime = value.runtime;
      }

      if (value.memory != null) {
        functionSettings.memory = value.memory;
      }

      if (value.max_duration != null) {
        functionSettings.max_duration = value.max_duration;
      }

      if (value.schedule != null) {
        functionSettings.schedule = value.schedule;
      }

      if (value.symlinks != null) {
        functionSettings.symlinks = value.symlinks;
      }

      if (value.excludeFiles != null) {
        functionSettings.excludeFiles = value.excludeFiles;
      }

      if (value.includeFiles != null) {
        functionSettings.includeFiles = value.includeFiles;
      }
    }
  }

  return functionSettings;
};
