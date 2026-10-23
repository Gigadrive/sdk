import type { Command, CommandInfo, CommandLogChunk } from '@gigadrive/sdk';
import { describe, expect, it, vi } from 'vitest';
import { attachCommand, type SessionIo } from './microvm-session';

const encoder = new TextEncoder();

const info = (overrides: Partial<CommandInfo> = {}): CommandInfo => ({
  id: 'cmd_1',
  cmd: 'bash',
  args: [],
  cwd: null,
  status: 'running',
  exitCode: null,
  signal: null,
  pid: 1,
  pty: true,
  startedAt: 0,
  finishedAt: null,
  ...overrides,
});

/** A fake remote command whose output is released by the test. */
const fakeCommand = (chunks: CommandLogChunk[], exitCode = 0) => {
  let finish: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => (finish = resolve));
  let current = info();
  const command = {
    get status() {
      return current.status;
    },
    get info() {
      return current;
    },
    async *logs() {
      for (const chunk of chunks) yield chunk;
      await finished;
      current = info({ status: 'exited', exitCode });
    },
    write: vi.fn(async (_data: Uint8Array) => undefined),
    end: vi.fn(async () => undefined),
    resize: vi.fn(async (_cols: number, _rows: number) => undefined),
    wait: vi.fn(async () => current),
  };
  return { command, finish, asCommand: command as unknown as Command };
};

const chunk = (text: string, stream: 'stdout' | 'stderr' = 'stdout'): CommandLogChunk => ({
  stream,
  text,
  data: encoder.encode(text),
  offset: 0,
});

const fakeIo = () => {
  let input: ((chunk: Uint8Array) => void) | undefined;
  let end: (() => void) | undefined;
  let resize: (() => void) | undefined;
  const written: Array<{ text: string; stream: string }> = [];
  let size: { cols: number; rows: number } | undefined = { cols: 80, rows: 24 };
  const io: SessionIo = {
    onInput: (listener, onEnd) => {
      input = listener;
      end = onEnd;
      return () => {
        input = undefined;
      };
    },
    write: (data, stream) => written.push({ text: new TextDecoder().decode(data), stream }),
    size: () => size,
    onResize: (listener) => {
      resize = listener;
      return () => {
        resize = undefined;
      };
    },
  };
  return {
    io,
    written,
    type: (text: string) => input?.(encoder.encode(text)),
    endInput: () => end?.(),
    resizeTo: (next: { cols: number; rows: number } | undefined) => {
      size = next;
      resize?.();
    },
    get subscribed() {
      return input !== undefined || resize !== undefined;
    },
  };
};

describe('attachCommand', () => {
  it('writes output to the matching stream and returns the final state', async () => {
    const { asCommand, finish } = fakeCommand([chunk('out'), chunk('err', 'stderr')], 3);
    const local = fakeIo();

    const result = attachCommand(asCommand, local.io, {
      forwardInput: false,
      endInputOnEof: false,
      forwardResize: false,
    });
    finish();

    await expect(result).resolves.toMatchObject({ status: 'exited', exitCode: 3 });
    expect(local.written).toEqual([
      { text: 'out', stream: 'stdout' },
      { text: 'err', stream: 'stderr' },
    ]);
  });

  it('forwards typed input in batches and resizes, then unsubscribes', async () => {
    const { command, asCommand, finish } = fakeCommand([]);
    const local = fakeIo();

    const result = attachCommand(asCommand, local.io, {
      forwardInput: true,
      endInputOnEof: false,
      forwardResize: true,
    });
    local.type('l');
    local.type('s');
    await vi.waitFor(() => expect(command.write).toHaveBeenCalled());
    local.resizeTo({ cols: 120, rows: 40 });
    local.resizeTo(undefined);
    finish();
    await result;

    expect(command.write).toHaveBeenCalledTimes(1);
    expect(new TextDecoder().decode(command.write.mock.calls[0]![0])).toBe('ls');
    expect(command.resize).toHaveBeenCalledTimes(1);
    expect(command.resize).toHaveBeenCalledWith(120, 40);
    expect(command.end).not.toHaveBeenCalled();
    expect(local.subscribed).toBe(false);
  });

  it('closes remote stdin when local input ends, if asked to', async () => {
    const { command, asCommand, finish } = fakeCommand([]);
    const local = fakeIo();

    const result = attachCommand(asCommand, local.io, {
      forwardInput: true,
      endInputOnEof: true,
      forwardResize: false,
    });
    local.type('data');
    local.endInput();
    await vi.waitFor(() => expect(command.end).toHaveBeenCalled());
    finish();
    await result;

    expect(new TextDecoder().decode(command.write.mock.calls[0]![0])).toBe('data');
  });

  it('ignores input when not forwarding', async () => {
    const { command, asCommand, finish } = fakeCommand([]);
    const local = fakeIo();

    const result = attachCommand(asCommand, local.io, {
      forwardInput: false,
      endInputOnEof: false,
      forwardResize: false,
    });
    local.type('ignored');
    finish();
    await result;

    expect(command.write).not.toHaveBeenCalled();
  });

  it('waits for the final state when the stream ended without an exit', async () => {
    const { command, asCommand } = fakeCommand([]);
    const exited = info({ status: 'exited', exitCode: 0 });
    Object.assign(command, {
      async *logs() {
        yield* [];
      },
    });
    command.wait.mockResolvedValueOnce(exited);
    const local = fakeIo();

    await expect(
      attachCommand(asCommand, local.io, { forwardInput: false, endInputOnEof: false, forwardResize: false })
    ).resolves.toBe(exited);
  });
});
