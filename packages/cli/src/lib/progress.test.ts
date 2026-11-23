import { describe, expect, it } from 'vitest';
import { createProgress, formatElapsed } from './progress';

const stream = (isTTY: boolean) => {
  const writes: string[] = [];
  return { writes, isTTY, write: (text: string) => writes.push(text) };
};

describe('formatElapsed', () => {
  it('prints seconds, then minutes and padded seconds', () => {
    expect([0, 999, 42_000, 60_000, 185_000, -5].map(formatElapsed)).toEqual([
      '0s',
      '0s',
      '42s',
      '1m 00s',
      '3m 05s',
      '0s',
    ]);
  });
});

describe('createProgress', () => {
  it('rewrites one line on a terminal and clears it when done', () => {
    const out = stream(true);
    const progress = createProgress(out);

    progress.update('Waiting for capacity...', 0);
    progress.update('Waiting for capacity...', 3_000);
    progress.done();

    expect(out.writes).toEqual([
      '\r\u001b[2KWaiting for capacity... (0s)',
      '\r\u001b[2KWaiting for capacity... (3s)',
      '\r\u001b[2K',
    ]);
  });

  it('cuts a line to the terminal width so it never wraps', () => {
    const out = { ...stream(true), columns: 12 };
    const progress = createProgress(out);

    progress.update('Waiting for capacity...', 0);

    expect(out.writes).toEqual(['\r\u001b[2KWaiting fo…']);
  });

  it('prints a line per change, and every 15 seconds otherwise, elsewhere', () => {
    const out = stream(false);
    const progress = createProgress(out);

    progress.update('Waiting for capacity...', 0);
    progress.update('Waiting for capacity...', 5_000);
    progress.update('Waiting for capacity...', 16_000);
    progress.update('Starting...', 17_000);
    progress.done();

    expect(out.writes).toEqual([
      'Waiting for capacity... (0s)\n',
      'Waiting for capacity... (16s)\n',
      'Starting... (17s)\n',
    ]);
  });
});
