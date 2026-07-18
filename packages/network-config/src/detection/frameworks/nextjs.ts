import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import { getDefaultPathMap } from '../../build-output-v3/get-default-path-map';
import type { FrameworkDefaultConfig, FrameworkDefinition } from '../types';

interface NextBuildManifest {
  version: 1;
  output: 'standalone' | 'export';
  distDir: string;
  repoRootToProject: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const normalizeRelativePath = (value: string, allowCurrentDirectory = false): string | undefined => {
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (
    (!allowCurrentDirectory && (!normalized || normalized === '.')) ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.includes(':') ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    return undefined;
  }
  return normalized || '.';
};

const parseBuildManifest = (content: string): NextBuildManifest | undefined => {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      (value.output !== 'standalone' && value.output !== 'export') ||
      typeof value.distDir !== 'string' ||
      typeof value.repoRootToProject !== 'string'
    ) {
      return undefined;
    }

    const distDir = normalizeRelativePath(value.distDir);
    const repoRootToProject = normalizeRelativePath(value.repoRootToProject, true);
    return distDir && repoRootToProject ? { version: 1, output: value.output, distDir, repoRootToProject } : undefined;
  } catch {
    return undefined;
  }
};

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
  manifest: NextBuildManifest
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

  const standaloneProjectPath = toPortablePath(pathService.relative(projectFolder, standaloneRoot));

  return {
    ...defaults,
    entrypoint,
    routes: [{ source: '/*', destination: entrypoint }],
    assetsDir: manifest.distDir,
    assetsPrefixToStrip: '',
    assetPaths,
    assetOverrides,
    package: {
      rootOverwrite: standaloneRoot,
      filePathMap,
      includeFiles: [`${standaloneProjectPath}/**`],
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
      const manifest = manifestContent ? parseBuildManifest(manifestContent) : undefined;
      if (!manifest) return defaults;

      return manifest.output === 'export'
        ? yield* createStaticExportConfig(defaults, projectFolder)
        : yield* createStandaloneConfig(defaults, projectFolder, manifest);
    }),
};
