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
