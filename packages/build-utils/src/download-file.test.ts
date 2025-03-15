import express from 'express';
import fs from 'fs/promises';
import { Server } from 'http';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { downloadFile } from './download-file';

describe('downloadFile', () => {
  let server: Server;
  let testServer: express.Express;
  let testDir: string;
  const port = 3456;

  // Calculate exact file size for large test
  const lineContent = 'test content\n'; // 12 bytes per line
  const numberOfLines = 100000;
  const expectedLargeFileSize = lineContent.length * numberOfLines;

  // Setup test server and temporary directory
  beforeAll(async () => {
    // Create temporary directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'download-test-'));

    testServer = express();

    // Serve a test file
    testServer.get('/test.txt', (_, res) => {
      res.send('test content');
    });

    // Serve a larger file
    testServer.get('/large.txt', (_, res) => {
      // Create content with known size
      const largeContent = lineContent.repeat(numberOfLines);
      res.send(largeContent);
    });

    // Route that returns a 404
    testServer.get('/not-found', (_, res) => {
      res.status(404).send('Not found');
    });

    // Start the server
    server = testServer.listen(port);
  });

  // Cleanup after all tests
  afterAll(async () => {
    server.close();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up test directory:', error);
    }
  });

  // Clean the test files before each test, but keep the temp directory
  beforeEach(async () => {
    // Read directory contents
    const files = await fs.readdir(testDir);

    // Remove all files/directories inside testDir
    await Promise.all(files.map((file) => fs.rm(path.join(testDir, file), { recursive: true, force: true })));
  });

  it('successfully downloads a small file', async () => {
    const outputPath = path.join(testDir, 'small-test.txt');
    const url = `http://localhost:${port}/test.txt`;

    await downloadFile(url, outputPath);

    const content = await fs.readFile(outputPath, 'utf-8');
    expect(content).toBe('test content');
  });

  it('successfully downloads a large file', async () => {
    const outputPath = path.join(testDir, 'large-test.txt');
    const url = `http://localhost:${port}/large.txt`;

    await downloadFile(url, outputPath);

    const stats = await fs.stat(outputPath);
    // Check against our calculated exact size with small margin for encoding differences
    const marginOfError = 100; // bytes
    expect(stats.size).toBeGreaterThanOrEqual(expectedLargeFileSize - marginOfError);
    expect(stats.size).toBeLessThanOrEqual(expectedLargeFileSize + marginOfError);
  });

  it('creates nested directories as needed', async () => {
    const outputPath = path.join(testDir, 'nested', 'deeply', 'test.txt');
    const url = `http://localhost:${port}/test.txt`;

    await downloadFile(url, outputPath);

    const content = await fs.readFile(outputPath, 'utf-8');
    expect(content).toBe('test content');
  });

  it('throws error on 404 response', async () => {
    const outputPath = path.join(testDir, 'not-found.txt');
    const url = `http://localhost:${port}/not-found`;

    await expect(downloadFile(url, outputPath)).rejects.toThrow('HTTP error! status: 404');
  });

  it('throws error on invalid URL', async () => {
    const outputPath = path.join(testDir, 'error.txt');
    const url = 'http://localhost:invalid-url';

    await expect(downloadFile(url, outputPath)).rejects.toThrow();
  });

  it('throws error when writing to invalid location', async () => {
    const outputPath = '/invalid/location/test.txt';
    const url = `http://localhost:${port}/test.txt`;

    await expect(downloadFile(url, outputPath)).rejects.toThrow();
  });
});
