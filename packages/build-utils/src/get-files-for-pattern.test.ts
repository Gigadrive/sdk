import { readdir } from 'fs/promises';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { getFilesForPattern } from './get-files-for-pattern'; // Replace with the actual file name

vi.mock('fs/promises');

describe('getFilesForPattern', () => {
  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); // Optional: Suppress console.error messages
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('with glob pattern', async () => {
    vi.mocked(readdir).mockReturnValue(['file1.txt', 'file2.js', 'folder/file3.js'] as any);

    const result = await getFilesForPattern('**/*.js', '/project');
    expect(result).toEqual(['file2.js', 'folder/file3.js']);
  });

  test('with regex pattern', async () => {
    vi.mocked(readdir).mockReturnValue(['file1.txt', 'file2.js', 'folder/file3.js'] as any);

    const result = await getFilesForPattern('.*\\.js$', '/project');
    expect(result).toEqual(['file2.js', 'folder/file3.js']);
  });

  test('does not let regex fallback turn a literal entrypoint into a prefix match', async () => {
    vi.mocked(readdir).mockReturnValue(['dist/src/server.js', 'dist/src/server.js.map', 'dist/src/server-js'] as any);

    const result = await getFilesForPattern('dist/src/server.js', '/project');
    expect(result).toEqual(['dist/src/server.js']);
  });

  test('with exclude files (string)', async () => {
    vi.mocked(readdir).mockReturnValue(['file1.txt', 'file2.js', 'folder/file3.js'] as any);

    const result = await getFilesForPattern('**/*.js', '/project', 'file2.js');
    expect(result).toEqual(['folder/file3.js']);
  });

  test('with exclude files (array)', async () => {
    vi.mocked(readdir).mockReturnValue(['file1.txt', 'file2.js', 'folder/file3.js', 'folder/excluded.js'] as any);

    const result = await getFilesForPattern('**/*.js', '/project', ['file2.js', '**/excluded.js']);
    expect(result).toEqual(['folder/file3.js']);
  });

  test('with exclude files (regex)', async () => {
    vi.mocked(readdir).mockReturnValue(['file1.txt', 'file2.js', 'folder/file3.js', 'folder/excluded.js'] as any);

    const result = await getFilesForPattern('**/*.js', '/project', '.*excluded.*');
    expect(result).toEqual(['file2.js', 'folder/file3.js']);
  });

  test('does not let a literal exclusion hide files that merely share its prefix', async () => {
    vi.mocked(readdir).mockReturnValue(['server.js', 'server.js.map'] as any);

    const result = await getFilesForPattern('server.js*', '/project', 'server.js');
    expect(result).toEqual(['server.js.map']);
  });

  test('with no matches', async () => {
    vi.mocked(readdir).mockReturnValue(['file1.txt', 'file2.txt'] as any);

    const result = await getFilesForPattern('**/*.js', '/project');
    expect(result).toEqual([]);
  });

  test('with invalid regex pattern', async () => {
    vi.mocked(readdir).mockReturnValue(['file1.txt', 'file2.js', 'test(file).js'] as any);

    const result = await getFilesForPattern('test(file).js', '/project');
    expect(result).toEqual(['test(file).js']); // Should match using minimatch
  });
});
