import { FileSystem, Path } from '@effect/platform';
import { Effect, Layer, Logger, LogLevel, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { EnvFileService } from './env-file';

const makeMockFs = (files: Map<string, string>, writeOpts: Map<string, unknown>, chmodModes: Map<string, number>) =>
  ({
    exists: (path: string) => Effect.succeed(files.has(path)),
    readFileString: (path: string) =>
      files.has(path)
        ? Effect.succeed(files.get(path)!)
        : Effect.fail({ _tag: 'SystemError' as const, message: 'ENOENT' }),
    writeFileString: (path: string, content: string, opts?: unknown) =>
      Effect.sync(() => {
        files.set(path, content);
        if (opts !== undefined) writeOpts.set(path, opts);
      }),
    makeDirectory: () => Effect.void,
    chmod: (path: string, mode: number) =>
      Effect.sync(() => {
        chmodModes.set(path, mode);
      }),
  }) as unknown as FileSystem.FileSystem;

const mockPath: Path.Path = {
  join: (...segments: string[]) => segments.join('/'),
  dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '.',
} as unknown as Path.Path;

const makeLayer = (initialFiles: Record<string, string> = {}) => {
  const files = new Map(Object.entries(initialFiles));
  const writeOpts = new Map<string, unknown>();
  const chmodModes = new Map<string, number>();
  const platform = Layer.mergeAll(
    Layer.succeed(FileSystem.FileSystem, makeMockFs(files, writeOpts, chmodModes)),
    Layer.succeed(Path.Path, mockPath)
  );
  const layer = Layer.provide(EnvFileService.Default, platform).pipe(
    Layer.provideMerge(Logger.minimumLogLevel(LogLevel.None))
  );
  return { layer, files, writeOpts, chmodModes };
};

describe('EnvFileService.write', () => {
  it('serializes entries and writes with mode 0o600, tightening perms on overwrite', async () => {
    const { layer, files, writeOpts, chmodModes } = makeLayer();
    await Effect.runPromise(
      Effect.provide(EnvFileService.write('/project/.env.local', [{ key: 'A', value: '1' }]), layer)
    );
    expect(files.get('/project/.env.local')).toContain('A=1');
    expect(writeOpts.get('/project/.env.local')).toEqual({ mode: 0o600 });
    // Explicit chmod guards against writeFileString's mode being a no-op on overwrite.
    expect(chmodModes.get('/project/.env.local')).toBe(0o600);
  });
});

describe('EnvFileService.read', () => {
  it('returns None when the file does not exist', async () => {
    const { layer } = makeLayer();
    const result = await Effect.runPromise(Effect.provide(EnvFileService.read('/project/.env.local'), layer));
    expect(Option.isNone(result)).toBe(true);
  });

  it('returns the contents when the file exists', async () => {
    const { layer } = makeLayer({ '/project/.env.local': 'A=1\n' });
    const result = await Effect.runPromise(Effect.provide(EnvFileService.read('/project/.env.local'), layer));
    expect(Option.getOrNull(result)).toBe('A=1\n');
  });
});

describe('EnvFileService.ensureGitignored', () => {
  it('creates .gitignore with the entry when absent', async () => {
    const { layer, files } = makeLayer();
    const added = await Effect.runPromise(
      Effect.provide(EnvFileService.ensureGitignored('/project', '.env.local'), layer)
    );
    expect(added).toBe(true);
    expect(files.get('/project/.gitignore')).toContain('.env.local');
  });

  it('is idempotent when the entry is already ignored', async () => {
    const { layer } = makeLayer({ '/project/.gitignore': 'node_modules\n.env.local\n' });
    const added = await Effect.runPromise(
      Effect.provide(EnvFileService.ensureGitignored('/project', '.env.local'), layer)
    );
    expect(added).toBe(false);
  });

  it('appends a trailing newline before adding the entry when needed', async () => {
    const { layer, files } = makeLayer({ '/project/.gitignore': 'node_modules' });
    await Effect.runPromise(Effect.provide(EnvFileService.ensureGitignored('/project', '.env.local'), layer));
    expect(files.get('/project/.gitignore')).toBe('node_modules\n.env.local\n');
  });
});
