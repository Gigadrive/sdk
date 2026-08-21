import type { ConfigV4 } from './v4';

/**
 * Identity helper providing type inference and checking for `gigadrive.ts`
 * config files. Using it is optional — a plain object default export works the
 * same, but `defineConfig` gives editor autocompletion without a type
 * annotation. Requires `@gigadrive/network-config` to be installed in the
 * project (e.g. as a devDependency).
 *
 * Prefer importing from the `@gigadrive/network-config/define-config` subpath:
 * it is dependency-free, whereas the package root eagerly imports peer
 * dependencies (`effect`, `@effect/platform`) that package managers which do
 * not auto-install peers (e.g. Yarn) will not have installed.
 *
 * Note that a `gigadrive.ts` config is executed as code when the config is
 * read — the same trust model as `build_commands`.
 *
 * @param config - The deployment configuration
 * @returns The configuration, unchanged
 * @example
 * ```ts
 * // gigadrive.ts
 * import { defineConfig } from '@gigadrive/network-config/define-config';
 *
 * export default defineConfig({
 *   version: 4,
 *   regions: ['eu-central-1'],
 * });
 * ```
 */
export const defineConfig = (config: ConfigV4): ConfigV4 => config;
