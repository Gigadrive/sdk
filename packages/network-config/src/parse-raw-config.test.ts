import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { parseRawConfig } from './parse-raw-config';

describe('parseRawConfig', () => {
  const tempDir = path.join(os.tmpdir(), 'parse-raw-config-test-files');
  const jsonFilePath = path.join(tempDir, 'config.json');
  const yamlFilePath = path.join(tempDir, 'config.yaml');
  const ymlFilePath = path.join(tempDir, 'config.yml');
  const unknownFilePath = path.join(tempDir, 'config.txt');
  const invalidJsonFilePath = path.join(tempDir, 'invalid.json');
  const invalidYamlFilePath = path.join(tempDir, 'invalid.yaml');
  const emptyFilePath = path.join(tempDir, 'empty.yaml');
  const noVersionFilePath = path.join(tempDir, 'no-version.yaml');

  beforeEach(() => {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create test files
    fs.writeFileSync(jsonFilePath, JSON.stringify({ version: 4, name: 'test-json' }));
    fs.writeFileSync(yamlFilePath, 'version: 4\nname: test-yaml');
    fs.writeFileSync(ymlFilePath, 'version: 4\nname: test-yml');
    fs.writeFileSync(unknownFilePath, 'version: 4\nname: test-unknown');
    fs.writeFileSync(invalidJsonFilePath, '{ "version": 4, "name": "test-invalid-json"');
    fs.writeFileSync(invalidYamlFilePath, 'version: 4\n  name: - test-invalid-yaml');
    fs.writeFileSync(emptyFilePath, '');
    fs.writeFileSync(noVersionFilePath, 'name: test-no-version');
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should parse JSON config file', async () => {
    const result = await parseRawConfig(jsonFilePath);
    expect(result).toEqual({ version: 4, name: 'test-json' });
  });

  test('should parse YAML config file with .yaml extension', async () => {
    const result = await parseRawConfig(yamlFilePath);
    expect(result).toEqual({ version: 4, name: 'test-yaml' });
  });

  test('should parse YAML config file with .yml extension', async () => {
    const result = await parseRawConfig(ymlFilePath);
    expect(result).toEqual({ version: 4, name: 'test-yml' });
  });

  test('should parse unknown file as YAML by default', async () => {
    const result = await parseRawConfig(unknownFilePath);
    expect(result).toEqual({ version: 4, name: 'test-unknown' });
  });

  test('should throw error for non-existent file', async () => {
    const nonExistentPath = path.join(tempDir, 'non-existent.json');
    await expect(parseRawConfig(nonExistentPath)).rejects.toThrow(`Config file not found at ${nonExistentPath}`);
  });

  test('should throw error for invalid JSON file', async () => {
    await expect(parseRawConfig(invalidJsonFilePath)).rejects.toThrow(
      `Failed to parse config file at ${invalidJsonFilePath}`
    );
  });

  test('should throw error for invalid YAML file', async () => {
    await expect(parseRawConfig(invalidYamlFilePath)).rejects.toThrow(
      `Failed to parse config file at ${invalidYamlFilePath}`
    );
  });

  test('should throw error for empty file', async () => {
    await expect(parseRawConfig(emptyFilePath)).rejects.toThrow(`Config file is empty at ${emptyFilePath}`);
  });

  test('should throw error for file without version', async () => {
    await expect(parseRawConfig(noVersionFilePath)).rejects.toThrow(
      `Config file is missing version at ${noVersionFilePath}`
    );
  });
});
