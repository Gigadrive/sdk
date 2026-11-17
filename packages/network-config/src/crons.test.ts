import { describe, expect, it } from 'vitest';
import { cronPathProblem, cronScheduleProblem, normalizeCrons, parseVercelJsonCrons } from './crons';

describe('cronScheduleProblem', () => {
  it.each([
    '0 5 * * *',
    '* * * * *',
    '*/5 * * * *',
    '0 0 1 1 *',
    '30 2 * * 0',
    '0 9 * * 7',
    '0 9-17 * * 1-5',
    '0,30 8,12,18 1,15 */2 *',
    '5-55/10 * * * *',
    '59 23 31 12 6',
  ])('accepts %s', (schedule) => {
    expect(cronScheduleProblem(schedule)).toBeUndefined();
  });

  it.each([
    ['0 5 * *', 'a cron expression has 5 fields (minute hour day-of-month month day-of-week), not 4'],
    ['0 0 5 * * *', 'a cron expression has 5 fields (minute hour day-of-month month day-of-week), not 6'],
    ['', 'a cron expression has 5 fields (minute hour day-of-month month day-of-week), not 1'],
    ['60 * * * *', 'minute "60" is outside 0-59'],
    ['0 24 * * *', 'hour "24" is outside 0-23'],
    ['0 0 0 * *', 'day of month "0" is outside 1-31'],
    ['0 0 32 * *', 'day of month "32" is outside 1-31'],
    ['0 0 * 0 *', 'month "0" is outside 1-12'],
    ['0 0 * * 8', 'day of week "8" is outside 0-7'],
    ['0 0 * * MON', 'day of week "MON" is not a number, a range or *. Names such as MON or JAN are not supported'],
    ['0 0 * JAN *', 'month "JAN" is not a number, a range or *. Names such as MON or JAN are not supported'],
    ['0 0 L * *', 'day of month "L" is not a number, a range or *. Names such as MON or JAN are not supported'],
    ['0 0 ? * 1', 'day of month "?" is not a number, a range or *. Names such as MON or JAN are not supported'],
    ['*/0 * * * *', 'minute "*/0" needs a positive whole step'],
    ['*/x * * * *', 'minute "*/x" needs a positive whole step'],
    ['*/5/2 * * * *', 'minute "*/5/2" has more than one step'],
    ['30-10 * * * *', 'minute "30-10" starts after it ends'],
    ['1-2-3 * * * *', 'minute "1-2-3" is not a number, a range or *. Names such as MON or JAN are not supported'],
    ['0,,5 * * * *', 'minute "" is not a number, a range or *. Names such as MON or JAN are not supported'],
  ])('rejects %s', (schedule, problem) => {
    expect(cronScheduleProblem(schedule)).toBe(problem);
  });

  it('rejects macros, which Vercel does not support either', () => {
    expect(cronScheduleProblem('@daily')).toBe(
      'a cron expression has 5 fields (minute hour day-of-month month day-of-week), not 1'
    );
  });

  it('rejects an expression longer than 256 characters', () => {
    expect(cronScheduleProblem(`${'1,'.repeat(130)}1 * * * *`)).toBe('the expression is longer than 256 characters');
  });
});

describe('cronPathProblem', () => {
  it('accepts a path on the deployment host, with or without a query string', () => {
    expect(cronPathProblem('/api/cron')).toBeUndefined();
    expect(cronPathProblem('/')).toBeUndefined();
    expect(cronPathProblem('/api/cron?task=cleanup&dry=1')).toBeUndefined();
  });

  it('rejects anything that is not a path on the same host', () => {
    expect(cronPathProblem('api/cron')).toBe('the path must start with /');
    expect(cronPathProblem('https://example.com/api/cron')).toBe('the path must start with /');
    expect(cronPathProblem('//example.com/api/cron')).toBe('the path must not start with //');
    expect(cronPathProblem('/api/cron job')).toBe('the path must not contain whitespace or #');
    expect(cronPathProblem('/api/cron#top')).toBe('the path must not contain whitespace or #');
    expect(cronPathProblem(`/${'a'.repeat(512)}`)).toBe('the path is longer than 512 characters');
  });
});

describe('normalizeCrons', () => {
  it('keeps valid entries in order and collapses the whitespace of a schedule', () => {
    expect(
      normalizeCrons(
        [
          { path: '/api/a', schedule: '0 5 * * *' },
          { path: '/api/b', schedule: ' */10   *  * * * ' },
        ],
        'vercel.json'
      )
    ).toEqual({
      crons: [
        { path: '/api/a', schedule: '0 5 * * *' },
        { path: '/api/b', schedule: '*/10 * * * *' },
      ],
      problems: [],
    });
  });

  it('keeps two schedules for the same path, as separate cron jobs', () => {
    expect(
      normalizeCrons(
        [
          { path: '/api/report', schedule: '0 8 * * *' },
          { path: '/api/report', schedule: '0 20 * * *' },
        ],
        'vercel.json'
      ).crons
    ).toHaveLength(2);
  });

  it('describes each invalid entry by its position and source', () => {
    expect(
      normalizeCrons(
        [
          '/api/cron',
          null,
          [],
          { path: '/api/cron' },
          { path: 5, schedule: '0 5 * * *' },
          { path: 'x', schedule: '* * * * *' },
        ],
        'vercel.json'
      )
    ).toEqual({
      crons: [],
      problems: [
        'Cron job 1 in vercel.json must be an object with a path and a schedule.',
        'Cron job 2 in vercel.json must be an object with a path and a schedule.',
        'Cron job 3 in vercel.json must be an object with a path and a schedule.',
        'Cron job 4 in vercel.json must set both path and schedule as strings.',
        'Cron job 5 in vercel.json must set both path and schedule as strings.',
        'Cron job 6 in vercel.json (x at "* * * * *") is invalid: the path must start with /.',
      ],
    });
  });
});

describe('parseVercelJsonCrons', () => {
  it('reads Vercel cron jobs and ignores every other key', () => {
    const content = JSON.stringify({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      regions: ['iad1'],
      crons: [{ path: '/api/cron', schedule: '0 5 * * *' }],
      rewrites: [{ source: '/a', destination: '/b' }],
    });

    expect(parseVercelJsonCrons(content)).toEqual({
      crons: [{ path: '/api/cron', schedule: '0 5 * * *' }],
      warnings: [],
    });
  });

  it('yields nothing for a file without cron jobs', () => {
    expect(parseVercelJsonCrons('{}')).toEqual({ crons: [], warnings: [] });
    expect(parseVercelJsonCrons('{"crons":[]}')).toEqual({ crons: [], warnings: [] });
    expect(parseVercelJsonCrons('[]')).toEqual({ crons: [], warnings: [] });
    expect(parseVercelJsonCrons('null')).toEqual({ crons: [], warnings: [] });
  });

  it('warns instead of failing for a file that is not JSON', () => {
    const result = parseVercelJsonCrons('{ "crons": [ ');

    expect(result.crons).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/^vercel\.json is not valid JSON, so its cron jobs are ignored: /);
  });

  it('warns when crons is not an array', () => {
    expect(parseVercelJsonCrons('{"crons":{"path":"/api/cron"}}')).toEqual({
      crons: [],
      warnings: ['`crons` in vercel.json must be an array, so it is ignored.'],
    });
  });

  it('skips invalid entries with a warning and keeps the valid ones', () => {
    const content = JSON.stringify({
      crons: [
        { path: '/api/ok', schedule: '0 5 * * *' },
        { path: '/api/names', schedule: '0 5 * * MON' },
      ],
    });

    expect(parseVercelJsonCrons(content)).toEqual({
      crons: [{ path: '/api/ok', schedule: '0 5 * * *' }],
      warnings: [
        'Cron job 2 in vercel.json (/api/names at "0 5 * * MON") is invalid: day of week "MON" is not a number, a range or *. Names such as MON or JAN are not supported. It is skipped.',
      ],
    });
  });
});
