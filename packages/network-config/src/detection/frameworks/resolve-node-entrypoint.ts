import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import type { FrameworkDefaultConfig } from '../types';

interface PackageJsonManifest {
  main?: unknown;
  scripts?: Record<string, unknown>;
}

/** Script runners whose first file argument is the server entrypoint. */
const SCRIPT_RUNNERS = new Set(['node', 'bun', 'tsx', 'ts-node']);

/** Common entrypoint locations probed on disk, in order of preference. */
const COMMON_ENTRYPOINT_CANDIDATES = [
  'index.js',
  'src/index.js',
  'index.ts',
  'src/index.ts',
  'app.js',
  'src/app.js',
  'server.js',
  'src/server.js',
  'app.ts',
  'src/app.ts',
  'server.ts',
  'src/server.ts',
];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const parsePackageJson = (content: string): PackageJsonManifest | undefined => {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
};

const normalizeEntrypointPath = (entrypoint: string): string | undefined => {
  const normalized = entrypoint.replace(/\\/g, '/').replace(/^\.\//, '');
  if (
    !normalized ||
    normalized === '.' ||
    normalized.startsWith('/') ||
    normalized.includes(':') ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    return undefined;
  }
  return normalized;
};

/**
 * Extracts the entrypoint file from a `start` script such as `node src/index.js`
 * or `bun run src/index.ts`. Flags are skipped; anything more complex than a
 * single runner invocation is ignored.
 */
const parseStartScript = (script: string): string | undefined => {
  const tokens = script.trim().split(/\s+/);
  if (tokens.length < 2 || !SCRIPT_RUNNERS.has(tokens[0])) return undefined;

  let index = 1;
  if (tokens[0] === 'bun' && tokens[index] === 'run') index++;
  while (index < tokens.length && tokens[index].startsWith('-')) index++;

  return tokens[index];
};

const applyEntrypoint = (defaults: FrameworkDefaultConfig, entrypoint: string): FrameworkDefaultConfig => ({
  ...defaults,
  entrypoint,
  routes: defaults.routes.map((route) =>
    route.destination === defaults.entrypoint ? { ...route, destination: entrypoint } : route
  ),
});

/**
 * Resolves the server entrypoint for minimal Node/Bun server frameworks
 * (Express, Fastify, Hono, Elysia) from the project instead of trusting the
 * preset's guessed path.
 *
 * Resolution order:
 * 1. `package.json` `main` field (if it points to an existing file)
 * 2. a `node <file>` / `bun run <file>` pattern in `scripts.start`
 * 3. the preset's default entrypoint, then common candidates that exist on disk
 * 4. the preset's default entrypoint as last resort (unchanged defaults)
 *
 * The `routes` destinations that pointed at the default entrypoint follow the
 * resolved entrypoint.
 */
export const resolveNodeServerEntrypoint = (
  defaults: FrameworkDefaultConfig,
  projectFolder: string
): Effect.Effect<FrameworkDefaultConfig, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const isFile = (relativePath: string) =>
      fs.stat(pathService.join(projectFolder, relativePath)).pipe(
        Effect.map((info) => info.type === 'File'),
        Effect.catchAll(() => Effect.succeed(false))
      );

    const content = yield* fs
      .readFileString(pathService.join(projectFolder, 'package.json'))
      .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
    const manifest = content ? parsePackageJson(content) : undefined;

    const startScript = typeof manifest?.scripts?.start === 'string' ? manifest.scripts.start : undefined;

    const candidates = [
      typeof manifest?.main === 'string' ? manifest.main : undefined,
      startScript ? parseStartScript(startScript) : undefined,
      defaults.entrypoint,
      ...COMMON_ENTRYPOINT_CANDIDATES,
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;

      const normalized = normalizeEntrypointPath(candidate);
      if (!normalized) continue;

      if (yield* isFile(normalized)) {
        return applyEntrypoint(defaults, normalized);
      }
    }

    return defaults;
  });
