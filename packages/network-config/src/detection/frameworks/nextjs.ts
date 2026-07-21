import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import { getDefaultPathMap } from '../../build-output-v3/get-default-path-map';
import {
  parseGigadriveNextBuildManifest,
  type GigadriveNextBuildManifestV1,
  type GigadriveNextBuildManifestV2,
} from '../../nextjs-manifest';
import type { NormalizedConfigEntrypoint, NormalizedSharedArtifact } from '../../normalized-config';
import type { FrameworkDefaultConfig, FrameworkDefinition } from '../types';

const toPortablePath = (value: string): string => value.replaceAll('\\', '/');

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
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const standaloneRoot = pathService.join(projectFolder, manifest.distDir, 'standalone');
  const monorepoServer = pathService.join(standaloneRoot, manifest.repoRootToProject, 'server.js');
  const rootServer = pathService.join(standaloneRoot, 'server.js');
  const monorepoServerExists = yield* fs.exists(monorepoServer).pipe(Effect.catchAll(() => Effect.succeed(false)));
  const serverPath = monorepoServerExists ? monorepoServer : rootServer;
  const serverExists = yield* fs.exists(serverPath).pipe(Effect.catchAll(() => Effect.succeed(false)));
  if (!serverExists) return defaults;

  const serverDirectory = pathService.dirname(serverPath);
  const entrypoint = toPortablePath(pathService.relative(standaloneRoot, serverPath));
  const publicDirectory = pathService.join(projectFolder, 'public');
  const staticDirectory = pathService.join(projectFolder, manifest.distDir, 'static');
  const [publicFiles, staticFiles] = yield* Effect.all([
    getDefaultPathMap(publicDirectory),
    getDefaultPathMap(staticDirectory),
  ]);
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

const createAdapterV2Config = Effect.fn('nextjs.createAdapterV2Config')(function* (
  defaults: FrameworkDefaultConfig,
  projectFolder: string,
  manifest: GigadriveNextBuildManifestV2
) {
  const pathService = yield* Path.Path;
  let repoRoot = projectFolder;
  if (manifest.repoRootToProject !== '.') {
    repoRoot = manifest.repoRootToProject.split('/').reduce((root) => pathService.dirname(root), repoRoot);
  }

  const artifactUseCount = new Map<string, number>();
  for (const entrypoint of manifest.entrypoints) {
    for (const [targetPath, sourcePath] of Object.entries(entrypoint.assets)) {
      const identity = `${targetPath}\0${sourcePath}`;
      artifactUseCount.set(identity, (artifactUseCount.get(identity) ?? 0) + 1);
    }
  }

  const sharedFilePathMap: Record<string, string> = {};
  for (const [identity, useCount] of artifactUseCount) {
    if (useCount < 2) continue;
    const [targetPath, sourcePath] = identity.split('\0');
    sharedFilePathMap[pathService.join(repoRoot, sourcePath)] = targetPath;
  }
  const sharedArtifacts: NormalizedSharedArtifact[] =
    Object.keys(sharedFilePathMap).length > 0 ? [{ id: 'next-shared', filePathMap: sharedFilePathMap }] : [];

  const executablePathByOutputId = new Map(
    [
      ...manifest.outputs.pages,
      ...manifest.outputs.pagesApi,
      ...manifest.outputs.appPages,
      ...manifest.outputs.appRoutes,
      ...(manifest.outputs.middleware ? [manifest.outputs.middleware] : []),
    ].map((output) => [output.id, output.edgeRuntime?.modulePath ?? output.filePath] as const)
  );

  const entrypoints: NormalizedConfigEntrypoint[] = manifest.entrypoints.map((entrypoint) => {
    const filePathMap: Record<string, string> = {};
    for (const [targetPath, sourcePath] of Object.entries({
      ...entrypoint.assets,
      ...entrypoint.wasmAssets,
    })) {
      const identity = `${targetPath}\0${sourcePath}`;
      if ((artifactUseCount.get(identity) ?? 0) >= 2) continue;
      filePathMap[pathService.join(repoRoot, sourcePath)] = targetPath;
    }
    for (const executablePath of new Set(
      entrypoint.outputIds.flatMap((outputId) => {
        const executablePath = executablePathByOutputId.get(outputId);
        return executablePath ? [executablePath] : [];
      })
    )) {
      filePathMap[pathService.join(repoRoot, executablePath)] = executablePath;
    }
    filePathMap[pathService.join(repoRoot, entrypoint.filePath)] = entrypoint.filePath;

    return {
      displayName: entrypoint.id,
      path: entrypoint.filePath,
      runtime: 'node-22',
      memory: defaults.memory,
      maxDuration: entrypoint.config.maxDuration ?? defaults.maxDuration,
      streaming: true,
      environmentVariables: {
        GIGADRIVE_NEXT_ENTRYPOINT_ID: entrypoint.id,
        GIGADRIVE_NEXT_RUNTIME: entrypoint.runtime,
        NEXT_BUILD_ID: manifest.buildId,
        ...entrypoint.config.env,
      },
      package: {
        trace: false,
        includeProjectFiles: false,
        preserveSymlinks: true,
        rootOverwrite: repoRoot,
        filePathMap,
        ...(sharedArtifacts.length > 0 ? { sharedArtifactIds: sharedArtifacts.map((artifact) => artifact.id) } : {}),
      },
    };
  });

  const assetPaths: string[] = [];
  const assetOverrides: Record<string, { path: string }> = {};
  const publicFiles = yield* getDefaultPathMap(pathService.join(projectFolder, 'public'));
  for (const [absolutePath, relativePath] of Object.entries(publicFiles)) {
    const projectRelativePath = toPortablePath(pathService.relative(projectFolder, absolutePath));
    assetPaths.push(projectRelativePath);
    assetOverrides[projectRelativePath] = { path: toPortablePath(relativePath) };
  }
  for (const output of manifest.outputs.staticFiles) {
    const absolutePath = pathService.join(repoRoot, output.filePath);
    const projectRelativePath = toPortablePath(pathService.relative(projectFolder, absolutePath));
    if (projectRelativePath.startsWith('../')) continue;
    assetPaths.push(projectRelativePath);
    assetOverrides[projectRelativePath] = { path: output.pathname.replace(/^\//, '') };
  }

  const prerenders = manifest.outputs.prerenders.map((output) => {
    if (!output.fallback?.filePath) return output;
    const absolutePath = pathService.join(repoRoot, output.fallback.filePath);
    const projectRelativePath = toPortablePath(pathService.relative(projectFolder, absolutePath));
    if (projectRelativePath.startsWith('../')) return output;
    const internalAssetPath = `_gigadrive/prerender/${encodeURIComponent(output.id)}.html`;
    assetPaths.push(projectRelativePath);
    assetOverrides[projectRelativePath] = { path: internalAssetPath };
    return {
      ...output,
      fallback: { ...output.fallback, filePath: `/${internalAssetPath}` },
    };
  });

  const framework = {
    mode: manifest.mode,
    distDir: manifest.distDir,
    repoRootToProject: manifest.repoRootToProject,
    nextVersion: manifest.nextVersion,
    buildId: manifest.buildId,
    config: manifest.config,
    routing: manifest.routing,
    outputs: manifest.outputs,
    entrypoints: manifest.entrypoints,
    outputEntrypoints: manifest.outputEntrypoints,
  };
  return {
    ...defaults,
    entrypoint: undefined,
    routes: [],
    assetPaths,
    assetOverrides,
    assetsDir: manifest.distDir,
    assetsPrefixToStrip: '',
    package: undefined,
    normalizedConfig: {
      entrypoints,
      routes: [],
      framework: {
        ...framework,
        outputs: { ...framework.outputs, prerenders },
        type: 'nextjs' as const,
        schemaVersion: 2 as const,
      },
      images: manifest.config.images,
      sharedArtifacts,
      userArchive: { rootOverwrite: repoRoot },
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
          : yield* createAdapterV2Config(defaults, projectFolder, manifest);
      }
      return manifest.output === 'export'
        ? yield* createStaticExportConfig(defaults, projectFolder)
        : yield* createStandaloneConfig(defaults, projectFolder, manifest);
    }),
};
