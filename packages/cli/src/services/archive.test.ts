import { NodeContext } from '@effect/platform-node';
import { Effect, Layer, Logger, LogLevel } from 'effect';
import * as nodeFs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ArchiveService } from './archive';

const TestLayer = Layer.mergeAll(ArchiveService.Default, Logger.minimumLogLevel(LogLevel.None)).pipe(
  Layer.provideMerge(NodeContext.layer)
);

const temporaryDirectories: string[] = [];

const makeProject = async () => {
  const directory = await nodeFs.mkdtemp(path.join(os.tmpdir(), 'gigadrive-archive-'));
  temporaryDirectories.push(directory);

  await Promise.all([
    nodeFs.mkdir(path.join(directory, '.git'), { recursive: true }),
    nodeFs.mkdir(path.join(directory, '.next'), { recursive: true }),
    nodeFs.mkdir(path.join(directory, 'node_modules', 'package'), { recursive: true }),
    nodeFs.mkdir(path.join(directory, 'packages', 'app', 'node_modules', 'package'), { recursive: true }),
    nodeFs.mkdir(path.join(directory, 'src'), { recursive: true }),
  ]);

  await Promise.all([
    nodeFs.writeFile(path.join(directory, '.git', 'config'), 'secret repository metadata'),
    nodeFs.writeFile(path.join(directory, '.next', 'cache'), 'build cache'),
    nodeFs.writeFile(path.join(directory, 'node_modules', 'package', 'index.js'), 'dependency'),
    nodeFs.writeFile(path.join(directory, 'packages', 'app', 'node_modules', 'package', 'index.js'), 'dependency'),
    nodeFs.writeFile(path.join(directory, 'src', 'index.ts'), 'export const value = true;'),
    nodeFs.writeFile(path.join(directory, 'package.json'), '{}'),
    nodeFs.writeFile(path.join(directory, '.env.local'), 'SECRET=value'),
    nodeFs.writeFile(path.join(directory, 'ignored.log'), 'ignored'),
    nodeFs.writeFile(path.join(directory, '.gitignore'), '.next/\n.env.local\n'),
    nodeFs.writeFile(path.join(directory, '.gigadriveignore'), 'ignored.log\n'),
  ]);

  return directory;
};

const readZipEntries = async (archivePath: string) => {
  const archive = await nodeFs.readFile(archivePath);
  const endOfCentralDirectory = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endOfCentralDirectory < 0) throw new Error('ZIP end-of-central-directory record not found');

  const entryCount = archive.readUInt16LE(endOfCentralDirectory + 10);
  let offset = archive.readUInt32LE(endOfCentralDirectory + 16);
  const entries: string[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP central-directory entry');
    const fileNameLength = archive.readUInt16LE(offset + 28);
    const extraFieldLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    entries.push(archive.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8'));
    offset += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  return entries;
};

const createArchive = async (directory: string, options?: { useIgnoreFiles?: boolean; useManagedIgnore?: boolean }) => {
  const archivePath = path.join(directory, 'project.zip');
  await Effect.runPromise(Effect.provide(ArchiveService.createZipArchive(directory, archivePath, options), TestLayer));
  return readZipEntries(archivePath);
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => nodeFs.rm(directory, { recursive: true })));
});

describe('ArchiveService.createZipArchive', () => {
  it('excludes dependencies, repository metadata, and files ignored by the project', async () => {
    const directory = await makeProject();
    const entries = await createArchive(directory);

    expect(entries).toContain('package.json');
    expect(entries).toContain('src/index.ts');
    expect(entries).not.toContain('.git/config');
    expect(entries).not.toContain('node_modules/package/index.js');
    expect(entries).not.toContain('packages/app/node_modules/package/index.js');
    expect(entries).not.toContain('.next/cache');
    expect(entries).not.toContain('.env.local');
    expect(entries).not.toContain('ignored.log');
  });

  it('applies managed dependency and repository ignores without project ignore files', async () => {
    const directory = await makeProject();
    const entries = await createArchive(directory, { useIgnoreFiles: false });

    expect(entries).not.toContain('.git/config');
    expect(entries).not.toContain('node_modules/package/index.js');
    expect(entries).not.toContain('packages/app/node_modules/package/index.js');
    expect(entries).toContain('.next/cache');
    expect(entries).toContain('.env.local');
    expect(entries).toContain('ignored.log');
  });

  it('can disable both managed and project ignore processing explicitly', async () => {
    const directory = await makeProject();
    const entries = await createArchive(directory, { useIgnoreFiles: false, useManagedIgnore: false });

    expect(entries).toContain('.git/config');
    expect(entries).toContain('node_modules/package/index.js');
    expect(entries).toContain('.next/cache');
    expect(entries).toContain('.env.local');
  });
});
