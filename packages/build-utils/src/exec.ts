import { spawn } from 'child_process';

type CommandInput = string | { command: string; args?: string[] };

interface ExecOptions {
  /**
   * The command to execute.
   */
  command: CommandInput;

  /**
   * The working directory for the command.
   */
  cwd?: string;

  /**
   * Environment variables for the command.
   * Does not include the current process's environment variables by default.
   */
  env?: Record<string, string>;

  /**
   * Callback for handling output from the command (stdout).
   */
  onOutput?: (data: string) => void;

  /**
   * Callback for handling errors from the command (stderr).
   */
  onError?: (data: string) => void;
}

/**
 * Executes a command asynchronously in a child process
 * @param options Configuration options for executing the process
 * @returns Promise that resolves when the process completes
 */
export async function exec({
  command,
  cwd = process.cwd(),
  env,
  onOutput = (data: string) => console.log(data),
  onError = (data: string) => console.error(data),
}: ExecOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    let spawnCommand: string;
    let spawnArgs: string[] = [];

    if (typeof command === 'string') {
      // For string input, first argument is the command, rest are args
      const parts = command.split(' ');
      spawnCommand = parts[0];
      spawnArgs = parts.slice(1);
    } else {
      // For object input, use command and args properties
      spawnCommand = command.command;
      spawnArgs = command.args || [];
    }

    const childProcess = spawn(spawnCommand, spawnArgs, {
      cwd,
      env,
    });

    childProcess.stdout.on('data', (data) => {
      onOutput(data.toString().trim());
    });

    childProcess.stderr.on('data', (data) => {
      onError(data.toString().trim());
    });

    childProcess.on('error', (error) => {
      reject(new Error(`Failed to start process: ${error.message}`));
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}
