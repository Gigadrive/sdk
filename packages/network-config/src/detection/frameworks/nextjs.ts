import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import { getDefaultPathMap } from '../../build-output-v3/get-default-path-map';
import {
  parseGigadriveNextBuildManifest,
  type GigadriveNextBuildManifestV1,
  type GigadriveNextBuildManifestV2Standalone,
} from '../../nextjs-manifest';
import type { NormalizedConfigEntrypoint } from '../../normalized-config';
import { AVAILABLE_REGIONS } from '../../regions';
import type { FrameworkDefaultConfig, FrameworkDefinition } from '../types';

const toPortablePath = (value: string): string => value.replaceAll('\\', '/');

/**
 * Upper bound on the prerendered paths exported for CDN warming. Warming only
 * needs a representative sample; carrying the full table is what produced the
 * multi-megabyte gateway configuration this list replaces.
 */
const MAXIMUM_ENTRY_PAGE_PATHS = 50;

/**
 * Locates the standalone `server.js` produced by `output: 'standalone'`, preferring
 * the monorepo-nested path (`standalone/<repoRootToProject>/server.js`) over the root
 * one. Returns `undefined` when neither exists (e.g. a build that did not run in
 * standalone mode), so callers can fall back to plain framework defaults.
 */
const resolveStandaloneServer = Effect.fn('nextjs.resolveStandaloneServer')(function* (
  projectFolder: string,
  distDir: string,
  repoRootToProject: string
) {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const standaloneRoot = pathService.join(projectFolder, distDir, 'standalone');
  const monorepoServer = pathService.join(standaloneRoot, repoRootToProject, 'server.js');
  const rootServer = pathService.join(standaloneRoot, 'server.js');
  const monorepoServerExists = yield* fs.exists(monorepoServer).pipe(Effect.catchAll(() => Effect.succeed(false)));
  const serverPath = monorepoServerExists ? monorepoServer : rootServer;
  const serverExists = yield* fs.exists(serverPath).pipe(Effect.catchAll(() => Effect.succeed(false)));
  if (!serverExists) return undefined;

  const serverDirectory = pathService.dirname(serverPath);
  const entrypoint = toPortablePath(pathService.relative(standaloneRoot, serverPath));
  return { standaloneRoot, serverDirectory, entrypoint };
});

/**
 * Enumerates the project `public/` tree into per-file static assets plus a package
 * map that copies each file into the standalone server directory. Public files sit
 * at arbitrary root paths and are low-cardinality, so they stay per-file (only the
 * high-cardinality `.next/static` tree is collapsed to a prefix).
 */
const buildStandalonePublicAssets = Effect.fn('nextjs.buildStandalonePublicAssets')(function* (
  projectFolder: string,
  standaloneRoot: string,
  serverDirectory: string
) {
  const pathService = yield* Path.Path;
  const publicFiles = yield* getDefaultPathMap(pathService.join(projectFolder, 'public'));
  const assetPaths: string[] = [];
  const assetOverrides: Record<string, { path: string }> = {};
  const filePathMap: Record<string, string> = {};
  for (const [absolutePath, relativePath] of Object.entries(publicFiles)) {
    const portableRelativePath = toPortablePath(relativePath);
    const projectRelativePath = toPortablePath(pathService.relative(projectFolder, absolutePath));
    assetPaths.push(projectRelativePath);
    assetOverrides[projectRelativePath] = { path: portableRelativePath };
    filePathMap[absolutePath] = toPortablePath(
      pathService.relative(standaloneRoot, pathService.join(serverDirectory, 'public', relativePath))
    );
  }
  return { assetPaths, assetOverrides, filePathMap };
});

const createStaticExportConfig = Effect.fn('nextjs.createStaticExportConfig')(function* (
  defaults: FrameworkDefaultConfig,
  projectFolder: string
) {
  const pathService = yield* Path.Path;
  const outputDirectory = pathService.join(projectFolder, 'out');
  const files = yield* getDefaultPathMap(outputDirectory);
  const assetPaths: string[] = [];
  const assetOverrides: Record<string, { path: string }> = {};

  for (const absolutePath of Object.keys(files)) {
    const projectRelativePath = toPortablePath(pathService.relative(projectFolder, absolutePath));
    const outputRelativePath = toPortablePath(pathService.relative(outputDirectory, absolutePath));
    assetPaths.push(projectRelativePath);

    const routePath =
      outputRelativePath === 'index.html'
        ? ''
        : outputRelativePath.endsWith('/index.html')
          ? outputRelativePath.slice(0, -'/index.html'.length)
          : outputRelativePath;
    assetOverrides[projectRelativePath] = { path: routePath };
  }

  return {
    ...defaults,
    entrypoint: undefined,
    routes: [],
    assetsDir: 'out',
    assetsPrefixToStrip: '',
    assetPaths,
    assetOverrides,
    package: undefined,
  };
});

const createStandaloneConfig = Effect.fn('nextjs.createStandaloneConfig')(function* (
  defaults: FrameworkDefaultConfig,
  projectFolder: string,
  manifest: GigadriveNextBuildManifestV1
) {
  const pathService = yield* Path.Path;
  const resolved = yield* resolveStandaloneServer(projectFolder, manifest.distDir, manifest.repoRootToProject);
  if (!resolved) return defaults;
  const { standaloneRoot, serverDirectory, entrypoint } = resolved;

  const publicAssets = yield* buildStandalonePublicAssets(projectFolder, standaloneRoot, serverDirectory);
  const assetPaths = [...publicAssets.assetPaths];
  const assetOverrides: Record<string, { path: string }> = { ...publicAssets.assetOverrides };
  const filePathMap: Record<string, string> = { ...publicAssets.filePathMap };

  // Legacy path (Next < 16.2): the network prefix matcher may not be available,
  // so `.next/static` stays enumerated per file and copied into the standalone tree.
  const staticFiles = yield* getDefaultPathMap(pathService.join(projectFolder, manifest.distDir, 'static'));
  for (const [absolutePath, relativePath] of Object.entries(staticFiles)) {
    const portableRelativePath = toPortablePath(relativePath);
    const projectRelativePath = toPortablePath(pathService.relative(projectFolder, absolutePath));
    assetPaths.push(projectRelativePath);
    assetOverrides[projectRelativePath] = { path: `_next/static/${portableRelativePath}` };
    filePathMap[absolutePath] = toPortablePath(
      pathService.relative(standaloneRoot, pathService.join(serverDirectory, manifest.distDir, 'static', relativePath))
    );
  }

  return {
    ...defaults,
    entrypoint,
    routes: [{ source: '/*', destination: entrypoint }],
    assetsDir: manifest.distDir,
    assetsPrefixToStrip: '',
    assetPaths,
    assetOverrides,
    package: {
      trace: false,
      rootOverwrite: standaloneRoot,
      filePathMap,
    },
  };
});

const createStandaloneV2Config = Effect.fn('nextjs.createStandaloneV2Config')(function* (
  defaults: FrameworkDefaultConfig,
  projectFolder: string,
  manifest: GigadriveNextBuildManifestV2Standalone
) {
  const resolved = yield* resolveStandaloneServer(projectFolder, manifest.distDir, manifest.repoRootToProject);
  if (!resolved) return defaults;
  const { standaloneRoot, serverDirectory, entrypoint } = resolved;

  const publicAssets = yield* buildStandalonePublicAssets(projectFolder, standaloneRoot, serverDirectory);
  const assetPaths = [...publicAssets.assetPaths];
  const assetOverrides: Record<string, { path: string }> = { ...publicAssets.assetOverrides };
  const filePathMap: Record<string, string> = { ...publicAssets.filePathMap };

  // `.next/static` collapses into edge-served prefixes (one descriptor, not one
  // registration per hashed chunk). The subtree is served by the edge, not copied
  // into the server package, so it is deliberately absent from `filePathMap`.
  const assetPrefixes = manifest.outputs.staticAssets.map((staticAsset) => ({
    source: staticAsset.sourceDir,
    destination: staticAsset.urlPrefix,
    immutable: staticAsset.immutable,
    populateCache: true,
  }));

  // Prerender shells are NOT published as assets here. The single standalone
  // server already ships every build-time prerender inside its own bundle
  // (`writeStandaloneDirectory` recursively copies `.next/server/{app,pages}`)
  // and the cache handler reads them from there, so uploading a second copy
  // produced one object + one asset row per prerendered output — tens of
  // thousands for a large content site — that nothing ever read.
  //
  // A bounded, representative sample of prerendered paths is still exported so
  // the platform can warm the CDN without carrying the full output table.
  const entryPagePaths = [
    ...new Set(
      manifest.outputs.prerenders
        .filter((output) => !output.fallback?.postponedState)
        .map((output) => output.pathname)
        .filter((pathname) => pathname.startsWith('/') && !pathname.includes('['))
    ),
  ]
    .sort((left, right) => left.split('/').length - right.split('/').length || left.localeCompare(right))
    .slice(0, MAXIMUM_ENTRY_PAGE_PATHS);

  const singleEntrypoint: NormalizedConfigEntrypoint = {
    displayName: 'next-server',
    path: entrypoint,
    runtime: defaults.runtime,
    memory: defaults.memory,
    maxDuration: manifest.server.maxDuration ?? defaults.maxDuration,
    streaming: true,
    environmentVariables: {
      NEXT_BUILD_ID: manifest.buildId,
      ...manifest.server.env,
    },
    package: {
      trace: false,
      rootOverwrite: standaloneRoot,
      filePathMap,
    },
  };

  const framework = {
    mode: manifest.mode,
    distDir: manifest.distDir,
    repoRootToProject: manifest.repoRootToProject,
    nextVersion: manifest.nextVersion,
    buildId: manifest.buildId,
    server: manifest.server,
    config: manifest.config,
    routing: manifest.routing,
    // The prerender table is deliberately not forwarded: the standalone server
    // serves build-time prerenders from its own bundle, so the platform only
    // needs the warming sample below.
    outputs: { prerenders: [], staticAssets: manifest.outputs.staticAssets },
    entryPagePaths,
    type: 'nextjs' as const,
    schemaVersion: 2 as const,
  };

  return {
    ...defaults,
    entrypoint: undefined,
    routes: [],
    assetPaths,
    assetOverrides,
    assetPrefixes,
    assetsDir: manifest.distDir,
    assetsPrefixToStrip: '',
    populateAssetCache: true,
    package: undefined,
    normalizedConfig: {
      regions: [...AVAILABLE_REGIONS],
      entrypoints: [singleEntrypoint],
      routes: [
        {
          path: '/*',
          destination: entrypoint,
          handler: 'SERVERLESS_FUNCTION_STREAMING' as const,
          methods: ['ANY' as const],
          headers: {},
        },
      ],
      framework,
      images: manifest.config.images,
      sharedArtifacts: [],
      userArchive: { rootOverwrite: standaloneRoot },
    },
  };
});

export const nextjs: FrameworkDefinition = {
  slug: 'nextjs',
  name: 'Next.js',
  language: 'node',
  detectors: [{ matchPackage: 'next' }],
  priority: 100,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 256,
    maxDuration: 30,
    streaming: true,
    commands: ['next build'],
    entrypoint: '.next/standalone/server.js',
    assetsDir: '.next/static',
    populateAssetCache: true,
    routes: [{ source: '/*', destination: '.next/standalone/server.js' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
  refineDefaultConfig: (defaults, projectFolder) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const manifestContent = yield* fs
        .readFileString(`${projectFolder}/.gigadrive/nextjs.json`)
        .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
      const manifest = manifestContent ? parseGigadriveNextBuildManifest(manifestContent) : undefined;
      if (!manifest) return defaults;

      if (manifest.version === 2) {
        return manifest.mode === 'export'
          ? yield* createStaticExportConfig(defaults, projectFolder)
          : yield* createStandaloneV2Config(defaults, projectFolder, manifest);
      }
      return manifest.output === 'export'
        ? yield* createStaticExportConfig(defaults, projectFolder)
        : yield* createStandaloneConfig(defaults, projectFolder, manifest);
    }),
};
