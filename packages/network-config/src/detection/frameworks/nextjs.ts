import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import { getDefaultPathMap } from '../../build-output-v3/get-default-path-map';
import { parseVercelJsonCrons } from '../../crons';
import { MAXIMUM_ENTRY_PAGE_PATHS } from '../../nextjs-constants';
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
 * Memory for the single standalone server, in MB.
 *
 * The per-route default (256 MB) sized a function that served one route with a
 * small module graph. One standalone server instead holds the whole
 * application's graph and renders its heaviest pages, so the same floor leaves
 * it thrashing the garbage collector on large documents. Node itself sizes its
 * old-space heap from the container limit, which makes 256 MB actively harmful
 * for server rendering rather than merely tight.
 */
const STANDALONE_SERVER_MEMORY_MB = 1024;

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
  projectFolder: string,
  // A custom `distDir` holds the export instead of `out`; the build manifest
  // records which one Next wrote.
  outDir = 'out'
) {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const outputDirectory = pathService.join(projectFolder, outDir);
  const files = yield* getDefaultPathMap(outputDirectory);
  const assetPaths: string[] = [];
  const assetOverrides: Record<string, { path: string }> = {};

  for (const absolutePath of Object.keys(files)) {
    const projectRelativePath = toPortablePath(pathService.relative(projectFolder, absolutePath));
    const outputRelativePath = toPortablePath(pathService.relative(outputDirectory, absolutePath));
    assetPaths.push(projectRelativePath);

    // Pages answer the URL Next links to. Next writes `out/about/index.html`
    // with `trailingSlash: true` and `out/about.html` without it, its default,
    // and links to `/about` either way. The content type still comes from the
    // file name, so a page served at `/about` stays HTML. A file copied from
    // `public/` keeps the name it is requested by.
    const fromPublic =
      outputRelativePath.endsWith('.html') &&
      (yield* fs
        .exists(pathService.join(projectFolder, 'public', outputRelativePath))
        .pipe(Effect.catchAll(() => Effect.succeed(false))));
    const routePath =
      outputRelativePath === 'index.html'
        ? ''
        : outputRelativePath.endsWith('/index.html')
          ? outputRelativePath.slice(0, -'/index.html'.length)
          : outputRelativePath.endsWith('.html') && !fromPublic
            ? outputRelativePath.slice(0, -'.html'.length)
            : outputRelativePath;
    assetOverrides[projectRelativePath] = { path: routePath };
  }

  return {
    ...defaults,
    entrypoint: undefined,
    routes: [],
    assetsDir: outDir,
    assetsPrefixToStrip: '',
    assetPaths,
    assetOverrides,
    package: undefined,
  };
});

/**
 * Finds the application inside a standalone build that no adapter described.
 *
 * Next 15.3 and older cannot load the build adapter, so no manifest says where
 * the application sits relative to the repository root. The standalone tree
 * mirrors the repository: the application is the directory holding `server.js`
 * next to its traced `.next`, at the root for a single project and nested for a
 * monorepo. Returns its path relative to the standalone root, `.` at the root.
 */
const findUnmanagedStandaloneProject = Effect.fn('nextjs.findUnmanagedStandaloneProject')(function* (
  projectFolder: string
) {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const standaloneRoot = pathService.join(projectFolder, '.next', 'standalone');
  const isDirectory = (candidate: string) =>
    fs.stat(candidate).pipe(
      Effect.map((info) => info.type === 'Directory'),
      Effect.catchAll(() => Effect.succeed(false))
    );
  // Breadth first, so the shallowest application wins; a monorepo nests it a
  // few levels deep (`apps/web`), never inside `node_modules`.
  let level = [standaloneRoot];
  for (let depth = 0; depth <= 8 && level.length > 0; depth += 1) {
    const next: string[] = [];
    for (const directory of level) {
      const hasServer = yield* fs
        .exists(pathService.join(directory, 'server.js'))
        .pipe(Effect.catchAll(() => Effect.succeed(false)));
      if (hasServer && (yield* isDirectory(pathService.join(directory, '.next')))) {
        return toPortablePath(pathService.relative(standaloneRoot, directory)) || '.';
      }
      const entries = yield* fs.readDirectory(directory).pipe(Effect.catchAll(() => Effect.succeed([] as string[])));
      for (const entry of [...entries].sort()) {
        if (entry === 'node_modules' || entry === '.next') continue;
        const child = pathService.join(directory, entry);
        if (yield* isDirectory(child)) next.push(child);
      }
    }
    level = next;
  }
  return undefined;
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

  const assetManifests = manifest.outputs.assetManifest ? [{ source: manifest.outputs.assetManifest }] : undefined;
  const { entryPagePaths: manifestEntryPagePaths, ...manifestOutputs } = manifest.outputs;

  // The complete prerender table is referenced through a sidecar. Keep only a
  // bounded path sample inline so normalized configuration remains compact.
  const entryPagePaths =
    manifestEntryPagePaths?.slice(0, MAXIMUM_ENTRY_PAGE_PATHS) ??
    [
      ...new Set(
        manifest.outputs.prerenders
          .filter((output) => output.fallback?.postponedState === undefined)
          .map((output) => output.pathname)
          .filter((pathname) => pathname.startsWith('/') && !pathname.includes('['))
      ),
    ]
      .sort((left, right) => left.split('/').length - right.split('/').length || left.localeCompare(right))
      .slice(0, MAXIMUM_ENTRY_PAGE_PATHS);

  // A route without its own `maxDuration` runs for the platform default, as a
  // function without one does, so the one server must outlast that default
  // too, not only the longest route that sets a limit.
  const routeWithoutLimit = Object.values(manifest.server.routes ?? {}).some(
    (route) => route.maxDuration === undefined
  );
  const singleEntrypoint: NormalizedConfigEntrypoint = {
    displayName: 'next-server',
    path: entrypoint,
    runtime: defaults.runtime,
    memory: Math.max(defaults.memory, STANDALONE_SERVER_MEMORY_MB),
    maxDuration:
      manifest.server.maxDuration === undefined
        ? defaults.maxDuration
        : routeWithoutLimit
          ? Math.max(manifest.server.maxDuration, defaults.maxDuration)
          : manifest.server.maxDuration,
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
    // Keep high-cardinality output metadata in portable sidecars rather than
    // expanding it into normalized deployment configuration.
    outputs: { ...manifestOutputs, prerenders: [] },
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
    assetManifests,
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

/**
 * Adds the cron jobs a project declares in `vercel.json`, so a Next.js app
 * moved from Vercel keeps its schedules without a config file. Only the
 * `crons` key is read. A static export has no server to call, so its cron jobs
 * are skipped with a warning; invalid entries are skipped with a warning too,
 * since deployments never read this file before.
 */
const withVercelCrons = Effect.fn('nextjs.withVercelCrons')(function* (
  config: FrameworkDefaultConfig,
  projectFolder: string
) {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const content = yield* fs
    .readFileString(pathService.join(projectFolder, 'vercel.json'))
    .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
  if (content === undefined) return config;

  const { crons, warnings } = parseVercelJsonCrons(content);
  if (crons.length === 0 && warnings.length === 0) return config;

  const servesRequests = config.entrypoint !== undefined || (config.normalizedConfig?.entrypoints?.length ?? 0) > 0;
  if (!servesRequests) {
    return crons.length === 0
      ? config
      : {
          ...config,
          normalizedConfig: {
            ...config.normalizedConfig,
            warnings: [
              ...(config.normalizedConfig?.warnings ?? []),
              'vercel.json declares cron jobs, but a static export has no server for them to call, so they are skipped.',
            ],
          },
        };
  }

  return {
    ...config,
    normalizedConfig: {
      ...config.normalizedConfig,
      ...(crons.length > 0 && { crons }),
      ...(warnings.length > 0 && { warnings: [...(config.normalizedConfig?.warnings ?? []), ...warnings] }),
    },
  };
});

/** Resolves the Next.js build output the adapter (or, for Next 15.3 and older, the standalone tree) describes. */
const refineNextjsBuild = Effect.fn('nextjs.refineBuild')(function* (
  defaults: FrameworkDefaultConfig,
  projectFolder: string
) {
  const fs = yield* FileSystem.FileSystem;
  const manifestContent = yield* fs
    .readFileString(`${projectFolder}/.gigadrive/nextjs.json`)
    .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
  const manifest = manifestContent ? parseGigadriveNextBuildManifest(manifestContent) : undefined;
  if (!manifest) {
    // Next 15.3 and older never run the adapter. The build forces a
    // standalone server for them (`NEXT_PRIVATE_STANDALONE`), which is
    // served like a Next 15 build: one server, with `.next/static` and
    // `public` published as files.
    const repoRootToProject = yield* findUnmanagedStandaloneProject(projectFolder);
    if (repoRootToProject === undefined) return defaults;
    return yield* createStandaloneConfig(defaults, projectFolder, {
      version: 1,
      output: 'standalone',
      distDir: '.next',
      repoRootToProject,
      nextVersion: 'unknown',
      buildId: '',
    });
  }

  if (manifest.version === 2) {
    return manifest.mode === 'export'
      ? yield* createStaticExportConfig(defaults, projectFolder, manifest.outDir)
      : yield* createStandaloneV2Config(defaults, projectFolder, manifest);
  }
  return manifest.output === 'export'
    ? yield* createStaticExportConfig(defaults, projectFolder, manifest.outDir)
    : yield* createStandaloneConfig(defaults, projectFolder, manifest);
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
    // No `assetsDir`: this is only the fallback for a standalone build whose
    // Gigadrive manifest is missing, and `.next/static` answers
    // `/_next/static/...` rather than its own stripped prefix. Every path that
    // resolves a real Next.js build (`refineDefaultConfig`) maps those chunks
    // itself, so declaring the directory here would publish them at the wrong
    // URLs.
    populateAssetCache: true,
    routes: [{ source: '/*', destination: '.next/standalone/server.js' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
  refineDefaultConfig: (defaults, projectFolder) =>
    Effect.gen(function* () {
      const refined = yield* refineNextjsBuild(defaults, projectFolder);
      return yield* withVercelCrons(refined, projectFolder);
    }),
};
