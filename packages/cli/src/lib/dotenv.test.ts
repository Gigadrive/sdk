import { describe, expect, it } from 'vitest';
import { DEFAULT_ENV_HEADER, formatEnvValue, parseEnv, serializeEnv } from './dotenv';

describe('formatEnvValue', () => {
  it('emits identifier-like values unquoted', () => {
    expect(formatEnvValue('postgres://user:pass@host:5432/db')).toBe('postgres://user:pass@host:5432/db');
    expect(formatEnvValue('simple_value-123')).toBe('simple_value-123');
    expect(formatEnvValue('gdnet_secret_abcABC-_09')).toBe('gdnet_secret_abcABC-_09');
  });

  it('emits the empty string as an empty (unquoted) value', () => {
    expect(formatEnvValue('')).toBe('');
  });

  it('quotes values with spaces, #, =, or quotes', () => {
    expect(formatEnvValue('hello world')).toBe('"hello world"');
    expect(formatEnvValue('a=b')).toBe('"a=b"');
    expect(formatEnvValue('has # hash')).toBe('"has # hash"');
    expect(formatEnvValue('say "hi"')).toBe('"say \\"hi\\""');
  });

  it('escapes newlines, tabs, and backslashes', () => {
    expect(formatEnvValue('line1\nline2')).toBe('"line1\\nline2"');
    expect(formatEnvValue('a\tb')).toBe('"a\\tb"');
    expect(formatEnvValue('back\\slash')).toBe('"back\\\\slash"');
  });
});

describe('serializeEnv', () => {
  it('writes a header and KEY=value lines, preserving order', () => {
    const out = serializeEnv([
      { key: 'B', value: '2' },
      { key: 'A', value: '1' },
    ]);
    expect(out).toBe(`${DEFAULT_ENV_HEADER}\nB=2\nA=1\n`);
  });

  it('supports a custom header and empty entries', () => {
    expect(serializeEnv([], { header: '# custom' })).toBe('# custom\n');
  });
});

describe('parseEnv', () => {
  it('round-trips values through serializeEnv', () => {
    const entries = [
      { key: 'DATABASE_URL', value: 'postgres://user:pass@host/db' },
      { key: 'MULTILINE', value: 'line1\nline2' },
      { key: 'SPACED', value: 'hello world' },
      { key: 'EMPTY', value: '' },
      { key: 'QUOTED', value: 'say "hi"' },
    ];
    const parsed = parseEnv(serializeEnv(entries));
    for (const { key, value } of entries) {
      expect(parsed[key]).toBe(value);
    }
  });

  it('ignores comments and blank lines', () => {
    const parsed = parseEnv('# comment\n\nKEY=value\n');
    expect(parsed).toEqual({ KEY: 'value' });
  });

  it('recovers unquoted credential values', () => {
    const parsed = parseEnv('GIGADRIVE_CLIENT_ID=abc-123\nGIGADRIVE_CLIENT_SECRET=gdnet_secret_xyz\n');
    expect(parsed['GIGADRIVE_CLIENT_ID']).toBe('abc-123');
    expect(parsed['GIGADRIVE_CLIENT_SECRET']).toBe('gdnet_secret_xyz');
  });
});
