import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import { COMPOSE_FILE_NAMES, composeDeclaresApp, normalizeContainers, readComposeContainers } from '../containers';
import type { NormalizedConfig } from '../normalized-config';
import { AVAILABLE_REGIONS } from '../regions';
import type { ConfigV4Container } from '../v4';

/** How a container project was recognized. */
export interface ContainerProjectDetection {
  /** `compose` for a Compose file, `dockerfile` for a lone root `Dockerfile`. */
  kind: 'compose' | 'dockerfile';
  /** Project-relative file the configuration came from. */
  file: string;
  /** Deployable configuration: one container function behind a catch-all route, plus any sidecars. */
  config: NormalizedConfig;
}

/**
 * Recognizes a project that ships as container images: a Compose file first,
 * then a `Dockerfile` at the project root.
 *
 * Callers try this only after finding neither a `gigadrive.yaml` nor a
 * framework. A framework project often carries a Compose file for local
 * databases, and deploying that file instead of the framework would change
 * what an existing project deploys. For the same reason a Compose file counts
 * only when it names an application: a service that builds from source or is
 * marked `x-gigadrive: { public: true }`. One that only runs, say, a database
 * for local development is ignored, and the root `Dockerfile` check follows.
 *
 * @param projectFolder - Absolute path to the project root
 * @returns The detection, or `undefined` when the project has neither file
 */
export const detectContainerProject = Effect.fn('detectContainerProject')(function* (projectFolder: string) {
  const fs = yield* FileSystem.FileSystem;
  const pathSvc = yield* Path.Path;
  const exists = (file: string) =>
    fs.exists(pathSvc.join(projectFolder, file)).pipe(Effect.catchAll(() => Effect.succeed(false)));

  let detection: {
    kind: ContainerProjectDetection['kind'];
    file: string;
    containers: Record<string, ConfigV4Container>;
  };
  const warnings: string[] = [];

  const composeFile = yield* Effect.findFirst(COMPOSE_FILE_NAMES, exists);
  if (composeFile._tag === 'Some' && (yield* composeDeclaresApp(composeFile.value, projectFolder))) {
    const imported = yield* readComposeContainers(composeFile.value, projectFolder);
    warnings.push(...imported.warnings);
    detection = { kind: 'compose', file: composeFile.value, containers: imported.containers };
  } else if (yield* exists('Dockerfile')) {
    detection = { kind: 'dockerfile', file: 'Dockerfile', containers: { app: { build: '.' } } };
  } else {
    return undefined;
  }

  const {
    entrypoints,
    sidecars,
    warnings: containerWarnings,
  } = yield* normalizeContainers(detection.containers, projectFolder);
  const [publicContainer] = entrypoints;

  const config: NormalizedConfig = {
    regions: [...AVAILABLE_REGIONS],
    environmentVariables: {},
    commands: [],
    entrypoints,
    ...(sidecars.length > 0 && { sidecars }),
    routes: publicContainer
      ? [
          {
            path: '/*',
            destination: publicContainer.path,
            handler: 'SERVERLESS_FUNCTION_STREAMING',
            methods: ['ANY'],
            headers: {},
          },
        ]
      : [],
    warnings: [
      `Auto-detected ${detection.kind === 'compose' ? 'Docker Compose' : 'Dockerfile'} project (${detection.file}). Create a gigadrive.yaml to customize.`,
      ...warnings,
      ...containerWarnings,
    ],
    errors: [],
  };

  return { kind: detection.kind, file: detection.file, config } satisfies ContainerProjectDetection;
});
