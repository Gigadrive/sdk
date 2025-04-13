import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { exec } from './exec'; // Assuming the exec function is in exec.ts

describe('exec', () => {
  it('should execute a simple command with string input', async () => {
    const outputs: string[] = [];

    await exec({
      command: 'echo "hello world"',
      onOutput: (data) => outputs.push(data),
    });

    expect(outputs).toContain('hello world');
  });

  it('should execute a command with array input', async () => {
    const outputs: string[] = [];

    await exec({
      command: {
        command: 'echo',
        args: ['hello', 'world'],
      },
      onOutput: (data) => outputs.push(data),
    });

    expect(outputs).toContain('hello world');
  });

  it('should handle environment variables', async () => {
    const outputs: string[] = [];

    await exec({
      command: 'echo $TEST_VAR',
      env: { TEST_VAR: 'test value' },
      onOutput: (data) => outputs.push(data),
    });

    expect(outputs).toContain('test value');
  });

  it('should execute in specified working directory', async () => {
    const outputs: string[] = [];
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'exec-test-'));
    const testFile = 'test.txt';

    // Create a test file
    await fs.writeFile(path.join(tempDir, testFile), 'test content');

    // List directory contents
    await exec({
      command: os.platform() === 'win32' ? 'dir' : 'ls',
      cwd: tempDir,
      onOutput: (data) => outputs.push(data),
    });

    // Clean up
    await fs.rm(tempDir, { recursive: true });

    expect(outputs.some((output) => output.includes(testFile))).toBe(true);
  });

  it('should handle command errors', async () => {
    await expect(
      exec({
        command: 'nonexistentcommand',
        onError: () => {}, // Suppress error output
      })
    ).rejects.toThrow();
  });

  it('should capture error output', async () => {
    const errors: string[] = [];

    await expect(
      exec({
        command: 'ls nonexistentfile',
        onError: (data) => errors.push(data),
      })
    ).rejects.toThrow();

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should handle long-running processes', async () => {
    const outputs: string[] = [];
    const startTime = Date.now();

    await exec({
      command: os.platform() === 'win32' ? 'timeout /t 3' : 'sleep 3',
      onOutput: (data) => outputs.push(data),
    });

    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThan(2000); // Should take at least 2 seconds
    expect(outputs.length).toBeGreaterThan(0);
  });

  it('should handle multiple commands in sequence', async () => {
    const allOutput: string[] = [];

    await exec({
      command: os.platform() === 'win32' ? 'cmd /c "echo first && echo second"' : 'echo "first" && echo "second"',
      onOutput: (data) =>
        allOutput.push(
          ...data
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        ),
    });

    expect(allOutput).toContain('first');
    expect(allOutput).toContain('second');
  });

  it('should handle process with large output', async () => {
    const outputs: string[] = [];
    const iterations = 100; // Reduced for stability

    // Create a temporary script file
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'exec-test-'));
    const scriptPath = path.join(tempDir, 'test-script.js');

    const scriptContent = `
      for (let i = 0; i < ${iterations}; i++) {
        console.log('Line ' + i);
      }
    `;

    await fs.writeFile(scriptPath, scriptContent);

    try {
      await exec({
        command: {
          command: 'node',
          args: [scriptPath],
        },
        onOutput: (data) => outputs.push(...data.split('\n').filter(Boolean)),
      });

      expect(outputs.length).toBe(iterations);
      expect(outputs[0]).toBe('Line 0');
      expect(outputs[iterations - 1]).toBe(`Line ${iterations - 1}`);
    } finally {
      // Clean up
      await fs.rm(tempDir, { recursive: true });
    }
  });
});
