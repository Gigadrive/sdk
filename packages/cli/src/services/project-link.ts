import { FileSystem, Path } from '@effect/platform';
import { Effect, Option, Schema } from 'effect';
import type { ProjectLink } from '../domain';
import { ProjectLink as ProjectLinkSchema } from '../domain';
import { ProjectLinkReadError, ProjectLinkWriteError, ProjectNotLinkedError } from '../errors';

// ---------------------------------------------------------------------------
// ProjectLinkService
//
// Links a working directory to a Gigadrive application by persisting the choice
// in `<projectFolder>/.gigadrive/project.json`. Commands read the linked
// application so they don't require an explicit `--app` on every invocation.
// ---------------------------------------------------------------------------

const LINK_DIR = '.gigadrive';
const LINK_FILE = 'project.json';

export class ProjectLinkService extends Effect.Service<ProjectLinkService>()('ProjectLinkService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const linkDir = (projectFolder: string) => pathService.join(projectFolder, LINK_DIR);
    const linkFile = (projectFolder: string) => pathService.join(projectFolder, LINK_DIR, LINK_FILE);

    /** Load the project link, returning `Option.none` when the directory is not linked. */
    const load = Effect.fn('ProjectLinkService.load')(function* (projectFolder: string) {
      const file = linkFile(projectFolder);

      const exists = yield* fs
        .exists(file)
        .pipe(Effect.mapError(() => new ProjectLinkReadError({ message: 'Failed to check project link existence' })));
      if (!exists) return Option.none<ProjectLink>();

      const data = yield* fs
        .readFileString(file, 'utf8')
        .pipe(Effect.mapError(() => new ProjectLinkReadError({ message: 'Failed to read project link file' })));

      const json = yield* Effect.try({
        try: () => JSON.parse(data) as unknown,
        catch: () => new ProjectLinkReadError({ message: `${LINK_DIR}/${LINK_FILE} contains invalid JSON` }),
      });

      const link = yield* Schema.decodeUnknown(ProjectLinkSchema)(json).pipe(
        Effect.mapError(() => new ProjectLinkReadError({ message: `${LINK_DIR}/${LINK_FILE} has an invalid schema` }))
      );

      return Option.some(link);
    });

    /** Load the project link, failing with `ProjectNotLinkedError` when absent. */
    const resolve = Effect.fn('ProjectLinkService.resolve')(function* (projectFolder: string) {
      const link = yield* load(projectFolder);
      return yield* Option.match(link, {
        onNone: () =>
          Effect.fail(
            new ProjectNotLinkedError({
              message: 'This directory is not linked to an application. Run "gigadrive link" first.',
              directory: projectFolder,
            })
          ),
        onSome: (value) => Effect.succeed(value),
      });
    });

    /** Persist the project link, creating `.gigadrive/` if needed. */
    const save = Effect.fn('ProjectLinkService.save')(function* (projectFolder: string, link: ProjectLink) {
      yield* fs
        .makeDirectory(linkDir(projectFolder), { recursive: true })
        .pipe(
          Effect.mapError(
            (error) =>
              new ProjectLinkWriteError({ message: 'Failed to create .gigadrive directory', cause: String(error) })
          )
        );
      yield* fs
        .writeFileString(linkFile(projectFolder), `${JSON.stringify(link, null, 2)}\n`)
        .pipe(
          Effect.mapError(
            (error) => new ProjectLinkWriteError({ message: 'Failed to write project link file', cause: String(error) })
          )
        );
      yield* Effect.log('Project link saved', { applicationId: link.applicationId });
    });

    /** Remove the project link file, treating a missing file as success. */
    const remove = Effect.fn('ProjectLinkService.remove')(function* (projectFolder: string) {
      yield* fs.remove(linkFile(projectFolder)).pipe(
        Effect.mapError((error) => {
          const cause = error instanceof Error ? error : (error as { error?: Error }).error;
          const code = cause && typeof cause === 'object' && 'code' in cause ? (cause as { code: string }).code : '';
          return { isNotFound: code === 'ENOENT' || String(error).includes('ENOENT'), original: error };
        }),
        Effect.catchAll((mapped) =>
          mapped.isNotFound
            ? Effect.void
            : Effect.fail(
                new ProjectLinkWriteError({
                  message: 'Failed to remove project link file',
                  cause: String(mapped.original),
                })
              )
        )
      );
    });

    return { load, resolve, save, remove };
  }),
}) {}
