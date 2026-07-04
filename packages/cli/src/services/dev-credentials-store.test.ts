import { FileSystem, Path } from '@effect/platform';
import { Effect, Layer, Logger, LogLevel, Option } from 'effect';
import * as os from 'node:os';
import { describe, expect, it } from 'vitest';
import { DevCredentialsStore } from './dev-credentials-store';

const STORE_FILE = `${os.homedir()}/.gigadrive/dev-keys.json`;

const makeMockFs = (files: Map<string, string>, writeOpts: Map<string, unknown>) =>
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
    chmod: () => Effect.void,
  }) as unknown as FileSystem.FileSystem;

const mockPath: Path.Path = {
  join: (...segments: string[]) => segments.join('/'),
} as unknown as Path.Path;

const makeLayer = (initialFiles: Record<string, string> = {}) => {
  const files = new Map(Object.entries(initialFiles));
  const writeOpts = new Map<string, unknown>();
  const platform = Layer.mergeAll(
    Layer.succeed(FileSystem.FileSystem, makeMockFs(files, writeOpts)),
    Layer.succeed(Path.Path, mockPath)
  );
  const layer = Layer.provide(DevCredentialsStore.Default, platform).pipe(
    Layer.provideMerge(Logger.minimumLogLevel(LogLevel.None))
  );
  return { layer, files, writeOpts };
};

describe('DevCredentialsStore', () => {
  it('returns None for an unknown application', async () => {
    const { layer } = makeLayer();
    const result = await Effect.runPromise(Effect.provide(DevCredentialsStore.get('app-1'), layer));
    expect(Option.isNone(result)).toBe(true);
  });

  it('persists a key ID with mode 0o600 and reads it back', async () => {
    const { layer, writeOpts } = makeLayer();
    await Effect.runPromise(Effect.provide(DevCredentialsStore.set('app-1', { apiKeyId: 'key-1' }), layer));
    expect(writeOpts.get(STORE_FILE)).toEqual({ mode: 0o600 });

    const result = await Effect.runPromise(Effect.provide(DevCredentialsStore.get('app-1'), layer));
    expect(Option.getOrNull(result)).toEqual({ apiKeyId: 'key-1' });
  });

  it('keeps other applications when setting a new one', async () => {
    const { layer } = makeLayer({ [STORE_FILE]: JSON.stringify({ 'app-1': { apiKeyId: 'key-1' } }) });
    await Effect.runPromise(Effect.provide(DevCredentialsStore.set('app-2', { apiKeyId: 'key-2' }), layer));
    const first = await Effect.runPromise(Effect.provide(DevCredentialsStore.get('app-1'), layer));
    const second = await Effect.runPromise(Effect.provide(DevCredentialsStore.get('app-2'), layer));
    expect(Option.getOrNull(first)).toEqual({ apiKeyId: 'key-1' });
    expect(Option.getOrNull(second)).toEqual({ apiKeyId: 'key-2' });
  });

  it('fails with a read error on invalid JSON', async () => {
    const { layer } = makeLayer({ [STORE_FILE]: 'not json' });
    const result = await Effect.runPromise(Effect.either(Effect.provide(DevCredentialsStore.get('app-1'), layer)));
    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('DevCredentialsStoreReadError');
    }
  });
});
