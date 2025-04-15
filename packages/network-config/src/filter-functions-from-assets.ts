import { NormalizedConfig } from './normalized-config';

/**
 * Ensure a normalized config has no function files that are also defined as assets.
 * For example, a file `public/index.php` should not be defined as an asset, when it is a function and `public` is an asset folder.
 * @param config The normalized config to filter.
 * @returns A promise that resolves to the filtered config.
 */
export const filterFunctionsFromAssets = async (config: NormalizedConfig): Promise<NormalizedConfig> => {
  return {
    ...config,
    assets: {
      ...config.assets,
      paths: config.assets?.paths?.filter((path) => !config.entrypoints.some((entrypoint) => entrypoint.path === path)),
    },
  };
};
