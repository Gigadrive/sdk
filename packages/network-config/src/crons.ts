import type { NormalizedConfigCron } from './normalized-config';

/** Longest cron job path accepted, matching the limit Vercel documents. */
export const MAX_CRON_PATH_LENGTH = 512;

/** Longest cron expression accepted, matching the limit Vercel documents. */
export const MAX_CRON_SCHEDULE_LENGTH = 256;

/** Lower and upper bound of each of the five cron fields, in order. */
const CRON_FIELDS = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  // Both 0 and 7 are Sunday.
  { name: 'day of week', min: 0, max: 7 },
] as const;

const NUMBER = /^\d+$/;

/** Why one comma-separated part of a cron field is invalid, or `undefined` when it is valid. */
const cronPartProblem = (part: string, field: (typeof CRON_FIELDS)[number]): string | undefined => {
  const [range = '', step, ...extra] = part.split('/');
  if (extra.length > 0) return `"${part}" has more than one step`;
  if (step !== undefined && (!NUMBER.test(step) || Number(step) === 0)) {
    return `"${part}" needs a positive whole step`;
  }
  if (range === '*') return undefined;
  const bounds = range.split('-');
  if (bounds.length > 2 || bounds.some((bound) => !NUMBER.test(bound))) {
    return `"${part}" is not a number, a range or *. Names such as MON or JAN are not supported`;
  }
  const [low = 0, high = low] = bounds.map(Number);
  if (low < field.min || high > field.max) {
    return `"${part}" is outside ${String(field.min)}-${String(field.max)}`;
  }
  if (low > high) return `"${part}" starts after it ends`;
  return undefined;
};

/**
 * Explains why a cron expression cannot run, or returns `undefined` when it
 * can. A schedule is five space-separated fields (minute, hour, day of month,
 * month, day of week), evaluated in UTC. Each field is `*`, a number, a range
 * `a-b`, either one followed by a step `/n`, or a comma-separated list of
 * those. Names (`MON`, `JAN`), macros (`@daily`) and the extensions `L`, `W`,
 * `#` and `?` are rejected, as Vercel rejects them.
 *
 * @param schedule - The cron expression to check.
 * @returns A sentence describing the first problem found, or `undefined`.
 * @example
 * cronScheduleProblem('0 5 * * *'); // undefined
 * cronScheduleProblem('0 5 * * MON'); // 'day of week "MON" is not a number, ...'
 */
export const cronScheduleProblem = (schedule: string): string | undefined => {
  if (schedule.length > MAX_CRON_SCHEDULE_LENGTH) {
    return `the expression is longer than ${String(MAX_CRON_SCHEDULE_LENGTH)} characters`;
  }
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== CRON_FIELDS.length) {
    return `a cron expression has 5 fields (minute hour day-of-month month day-of-week), not ${String(fields.length)}`;
  }
  for (const [index, field] of CRON_FIELDS.entries()) {
    for (const part of (fields[index] ?? '').split(',')) {
      const problem = cronPartProblem(part, field);
      if (problem !== undefined) return `${field.name} ${problem}`;
    }
  }
  return undefined;
};

/**
 * Explains why a cron job path cannot be called, or returns `undefined` when
 * it can. The path is requested on the deployment's own host, so it must start
 * with `/`. It may carry a query string.
 */
export const cronPathProblem = (path: string): string | undefined => {
  if (!path.startsWith('/')) return 'the path must start with /';
  if (path.startsWith('//')) return 'the path must not start with //';
  if (path.length > MAX_CRON_PATH_LENGTH) return `the path is longer than ${String(MAX_CRON_PATH_LENGTH)} characters`;
  if (/[\s#]/.test(path)) return 'the path must not contain whitespace or #';
  return undefined;
};

/**
 * Validates cron job entries from a config source and returns the valid ones
 * in their normalized shape, with one message per invalid entry.
 *
 * @param entries - The raw entries, for example the `crons` array of `vercel.json`.
 * @param source - The name of the file the entries came from, used in messages.
 */
export const normalizeCrons = (
  entries: readonly unknown[],
  source: string
): { crons: NormalizedConfigCron[]; problems: string[] } => {
  const crons: NormalizedConfigCron[] = [];
  const problems: string[] = [];
  for (const [index, entry] of entries.entries()) {
    const label = `Cron job ${String(index + 1)} in ${source}`;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      problems.push(`${label} must be an object with a path and a schedule.`);
      continue;
    }
    const { path, schedule } = entry as Record<string, unknown>;
    if (typeof path !== 'string' || typeof schedule !== 'string') {
      problems.push(`${label} must set both path and schedule as strings.`);
      continue;
    }
    const problem = cronPathProblem(path) ?? cronScheduleProblem(schedule);
    if (problem !== undefined) {
      problems.push(`${label} (${path} at "${schedule}") is invalid: ${problem}.`);
      continue;
    }
    crons.push({ path, schedule: schedule.trim().split(/\s+/).join(' ') });
  }
  return { crons, problems };
};

/**
 * Reads the `crons` array out of a `vercel.json` file's contents.
 *
 * A file that is not valid JSON, or that has no `crons` array, yields no cron
 * jobs and at most a warning: before cron jobs were supported, deployments
 * never read this file, so it must not start failing them.
 *
 * @param content - The text of `vercel.json`.
 * @returns The valid cron jobs, and a warning for each problem found.
 */
export const parseVercelJsonCrons = (content: string): { crons: NormalizedConfigCron[]; warnings: string[] } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { crons: [], warnings: [`vercel.json is not valid JSON, so its cron jobs are ignored: ${message}`] };
  }
  if (typeof parsed !== 'object' || parsed === null || !('crons' in parsed) || parsed.crons === undefined) {
    return { crons: [], warnings: [] };
  }
  if (!Array.isArray(parsed.crons)) {
    return { crons: [], warnings: ['`crons` in vercel.json must be an array, so it is ignored.'] };
  }
  const { crons, problems } = normalizeCrons(parsed.crons, 'vercel.json');
  return { crons, warnings: problems.map((problem) => `${problem} It is skipped.`) };
};
