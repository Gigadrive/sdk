import { describe, expect, it } from 'vitest';
import { isDebugLogLevel, normalizeArgv } from './argv';

const args = (...rest: string[]) => normalizeArgv(['node', 'gigadrive', ...rest]).argv.slice(2);

describe('normalizeArgv', () => {
  it('splits --name=value and -n=value into two arguments', () => {
    expect(args('microvms', 'create', '--port=3000', '-p=8080', '-e=A=1')).toEqual([
      'microvms',
      'create',
      '--port',
      '3000',
      '-p',
      '8080',
      '-e',
      'A=1',
    ]);
  });

  it('keeps an empty inline value as an argument', () => {
    expect(args('env', 'set', '--env=')).toEqual(['env', 'set', '--env', '']);
  });

  it('moves --log-level before the subcommand as one argument, from anywhere', () => {
    expect(args('apps', 'create', '-o', 'x', '--log-level', 'none')).toEqual([
      '--log-level=none',
      'apps',
      'create',
      '-o',
      'x',
    ]);
    expect(args('--log-level', 'debug', 'whoami')).toEqual(['--log-level=debug', 'whoami']);
    expect(args('whoami', '--log-level=warning')).toEqual(['--log-level=warning', 'whoami']);
    expect(normalizeArgv(['node', 'gigadrive', 'whoami', '--log-level', 'debug']).logLevel).toBe('debug');
  });

  it('leaves everything after -- alone', () => {
    expect(args('microvms', 'exec', 'id', '--', 'sh', '-c=x', '--log-level', 'debug')).toEqual([
      'microvms',
      'exec',
      'id',
      '--',
      'sh',
      '-c=x',
      '--log-level',
      'debug',
    ]);
    expect(normalizeArgv(['node', 'gigadrive', 'microvms', 'exec', 'id', '--', '--log-level', 'x']).logLevel).toBe(
      undefined
    );
  });

  it('leaves positional KEY=VALUE arguments and a trailing --log-level alone', () => {
    expect(args('env', 'set', 'KEY=value')).toEqual(['env', 'set', 'KEY=value']);
    expect(args('whoami', '--log-level')).toEqual(['whoami', '--log-level']);
  });

  it('keeps the node and script paths', () => {
    expect(normalizeArgv(['/usr/bin/node', '/bin/gigadrive', 'whoami']).argv).toEqual([
      '/usr/bin/node',
      '/bin/gigadrive',
      'whoami',
    ]);
  });
});

describe('isDebugLogLevel', () => {
  it('is true for debug and more verbose levels only', () => {
    expect(['debug', 'trace', 'all'].map(isDebugLogLevel)).toEqual([true, true, true]);
    expect(['info', 'warning', 'none', undefined].map(isDebugLogLevel)).toEqual([false, false, false, false]);
  });
});
