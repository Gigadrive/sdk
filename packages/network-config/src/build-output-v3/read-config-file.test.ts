import mockFs from 'mock-fs';
import { afterEach, describe, expect, test } from 'vitest';
import { readConfigFile } from './read-config-file';

describe('readConfigFile', () => {
  afterEach(() => {
    mockFs.restore();
  });

  test('should return null if file does not exist', async () => {
    mockFs({});
    const result = await readConfigFile('/path/to/nonexistent.json');
    expect(result).toBeNull();
  });

  test('should parse JSON config file correctly', async () => {
    const mockConfig = { version: 3, name: 'test-config' };
    mockFs({
      '/path/to/config.json': JSON.stringify(mockConfig),
    });

    const result = await readConfigFile<typeof mockConfig>('/path/to/config.json');
    expect(result).toEqual(mockConfig);
  });

  test('should parse YAML config file correctly', async () => {
    mockFs({
      '/path/to/config.yaml': 'version: 3\nname: test-config',
    });

    const result = await readConfigFile('/path/to/config.yaml');
    expect(result).toEqual({ version: 3, name: 'test-config' });
  });

  test('should disable version check when parsing', async () => {
    mockFs({
      '/path/to/config.json': JSON.stringify({ name: 'no-version-config' }),
    });

    const result = await readConfigFile('/path/to/config.json');
    expect(result).toEqual({ name: 'no-version-config' });
  });
});
