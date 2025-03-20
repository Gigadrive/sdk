import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDirname } from './get-dirname';

// Mock modules at the top level
vi.mock('url', () => ({
  fileURLToPath: vi.fn(),
}));

vi.mock('path', () => {
  const dirname = vi.fn();
  return {
    default: {
      dirname,
    },
    dirname,
  };
});

describe('getDirname', () => {
  const mockImportMetaUrl = 'file:///path/to/module.js';
  const expectedDirname = '/path/to';

  beforeEach(() => {
    // Save original globals and reset mocks
    delete (globalThis as any).__dirname;
    vi.mocked(fileURLToPath).mockReset();
    vi.mocked(path.dirname).mockReset();
  });

  afterEach(() => {
    delete (globalThis as any).__dirname;
    vi.resetAllMocks();
  });

  it('should extract dirname from import.meta.url in ESM context', () => {
    // Set up mock implementations for this test
    vi.mocked(fileURLToPath).mockReturnValue('/path/to/module.js');
    vi.mocked(path.dirname).mockReturnValue(expectedDirname);

    const result = getDirname(mockImportMetaUrl);

    expect(fileURLToPath).toHaveBeenCalledWith(mockImportMetaUrl);
    expect(path.dirname).toHaveBeenCalledWith('/path/to/module.js');
    expect(result).toBe(expectedDirname);
  });

  it('should fall back to __dirname in CommonJS context', () => {
    // Set up mock to throw error
    vi.mocked(fileURLToPath).mockImplementation(() => {
      throw new Error('Not a valid URL');
    });

    // Set __dirname global
    (globalThis as any).__dirname = expectedDirname;

    const result = getDirname(mockImportMetaUrl);

    expect(fileURLToPath).toHaveBeenCalledWith(mockImportMetaUrl);
    expect(result).toBe(expectedDirname);
  });

  it('should throw an error if directory path cannot be determined', () => {
    // Set up mock to throw error
    vi.mocked(fileURLToPath).mockImplementation(() => {
      throw new Error('Not a valid URL');
    });

    // Ensure __dirname is undefined
    delete (globalThis as any).__dirname;

    expect(() => getDirname(mockImportMetaUrl)).toThrow('Unable to determine directory path');
  });
});
