import { spawn } from 'node:child_process';
import process from 'node:process';

interface ClipboardCommand {
  cmd: string;
  args: string[];
}

/**
 * Ordered list of clipboard commands to try for the current platform. On Linux
 * we try Wayland first, then the common X11 tools; the first one that spawns
 * successfully wins.
 */
const clipboardCandidates = (): ClipboardCommand[] => {
  switch (process.platform) {
    case 'darwin':
      return [{ cmd: 'pbcopy', args: [] }];
    case 'win32':
      return [{ cmd: 'clip', args: [] }];
    default:
      return [
        { cmd: 'wl-copy', args: [] },
        { cmd: 'xclip', args: ['-selection', 'clipboard'] },
        { cmd: 'xsel', args: ['--clipboard', '--input'] },
      ];
  }
};

/**
 * Best-effort copy of `text` to the OS clipboard by spawning the platform's
 * clipboard utility (`pbcopy` / `clip` / `wl-copy` / `xclip` / `xsel`). Never
 * throws: if no utility is available the call is silently a no-op, so callers
 * can offer "press c to copy" without a hard dependency.
 */
export function writeClipboard(text: string): void {
  const candidates = clipboardCandidates();

  const tryNext = (index: number): void => {
    if (index >= candidates.length) return;
    const { cmd, args } = candidates[index];

    let proc;
    try {
      proc = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    } catch {
      tryNext(index + 1);
      return;
    }

    // ENOENT (utility not installed) surfaces as an async 'error' event.
    proc.on('error', () => tryNext(index + 1));
    proc.stdin?.on('error', () => {
      /* ignore broken pipe */
    });
    proc.stdin?.end(text);
  };

  tryNext(0);
}
