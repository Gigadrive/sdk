import { FileSystem, Path } from '@effect/platform';
import { Effect, Layer, Logger, LogLevel, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { ProjectLinkService } from './project-link';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeMockFileSystem = (files: Map<string, string>) =>
  ({
    exists: (path: string) => Effect.succeed(files.has(path)),
    readFileString: (path: string) =>
      files.has(path)
        ? Effect.succeed(files.get(path)!)
        : Effect.fail({ _tag: 'SystemError' as const, message: 'ENOENT' }),
    writeFileString: (path: string, content: string) =>
      Effect.sync(() => {
        files.set(path, content);
      }),
    remove: (path: string) =>
      Effect.sync(() => {
        files.delete(path);
      }),
    makeDirectory: () => Effect.void,
  }) as unknown as FileSystem.FileSystem;

const mockPath: Path.Path = {
  join: (...segments: string[]) => segments.join('/'),
} as unknown as Path.Path;

const makeTestLayer = (initialFiles: Record<string, string> = {}) => {
  const files = new Map(Object.entries(initialFiles));
  const platformLayer = Layer.mergeAll(
    Layer.succeed(FileSystem.FileSystem, makeMockFileSystem(files)),
    Layer.succeed(Path.Path, mockPath)
  );
  const layer = Layer.provide(ProjectLinkService.Default, platformLayer).pipe(
    Layer.provideMerge(Logger.minimumLogLevel(LogLevel.None))
  );
  return { layer, files };
};

const PROJECT = '/project';
const LINK_PATH = `${PROJECT}/.gigadrive/project.json`;

// ---------------------------------------------------------------------------
// load / resolve
// ---------------------------------------------------------------------------

describe('ProjectLinkService.load', () => {
  it('returns None when the directory is not linked', async () => {
    const { layer } = makeTestLayer();
    const result = await Effect.runPromise(Effect.provide(ProjectLinkService.load(PROJECT), layer));
    expect(Option.isNone(result)).toBe(true);
  });

  it('returns the parsed link when project.json exists', async () => {
    const { layer } = makeTestLayer({
      [LINK_PATH]: JSON.stringify({ applicationId: 'app-1', organizationId: 'org-1' }),
    });
    const result = await Effect.runPromise(Effect.provide(ProjectLinkService.load(PROJECT), layer));
    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value.applicationId).toBe('app-1');
      expect(result.value.organizationId).toBe('org-1');
    }
  });

  it('fails with ProjectLinkReadError on invalid JSON', async () => {
    const { layer } = makeTestLayer({ [LINK_PATH]: 'not-json' });
    const result = await Effect.runPromise(
      Effect.provide(ProjectLinkService.load(PROJECT), layer).pipe(
        Effect.catchTag('ProjectLinkReadError', (err) => Effect.succeed({ message: err.message }))
      )
    );
    expect(result).toMatchObject({ message: expect.stringContaining('invalid JSON') });
  });

  it('fails with ProjectLinkReadError on invalid schema', async () => {
    const { layer } = makeTestLayer({ [LINK_PATH]: JSON.stringify({ nope: true }) });
    const result = await Effect.runPromise(
      Effect.provide(ProjectLinkService.load(PROJECT), layer).pipe(
        Effect.catchTag('ProjectLinkReadError', (err) => Effect.succeed({ message: err.message }))
      )
    );
    expect(result).toMatchObject({ message: expect.stringContaining('invalid schema') });
  });
});

describe('ProjectLinkService.resolve', () => {
  it('fails with ProjectNotLinkedError when not linked', async () => {
    const { layer } = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.provide(ProjectLinkService.resolve(PROJECT), layer).pipe(
        Effect.catchTag('ProjectNotLinkedError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, dir: err.directory })
        )
      )
    );
    expect(result).toMatchObject({ _tag: 'caught', dir: PROJECT });
  });

  it('returns the link when linked', async () => {
    const { layer } = makeTestLayer({ [LINK_PATH]: JSON.stringify({ applicationId: 'app-9' }) });
    const result = await Effect.runPromise(Effect.provide(ProjectLinkService.resolve(PROJECT), layer));
    expect(result.applicationId).toBe('app-9');
  });
});

// ---------------------------------------------------------------------------
// save / remove
// ---------------------------------------------------------------------------

describe('ProjectLinkService.save', () => {
  it('writes project.json with the application and organization', async () => {
    const { layer, files } = makeTestLayer();
    await Effect.runPromise(
      Effect.provide(ProjectLinkService.save(PROJECT, { applicationId: 'app-2', organizationId: 'org-2' }), layer)
    );
    expect(files.has(LINK_PATH)).toBe(true);
    expect(JSON.parse(files.get(LINK_PATH)!)).toEqual({ applicationId: 'app-2', organizationId: 'org-2' });
  });
});

describe('ProjectLinkService.remove', () => {
  it('removes an existing link file', async () => {
    const { layer, files } = makeTestLayer({ [LINK_PATH]: JSON.stringify({ applicationId: 'app-3' }) });
    await Effect.runPromise(Effect.provide(ProjectLinkService.remove(PROJECT), layer));
    expect(files.has(LINK_PATH)).toBe(false);
  });
});
