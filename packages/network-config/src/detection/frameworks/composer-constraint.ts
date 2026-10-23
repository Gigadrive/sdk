/**
 * A version normalized to Composer's four numeric segments, so `8.3` is
 * `[8, 3, 0, 0]`.
 */
type Version = readonly [number, number, number, number];

/** A parsed version: its numeric segments, and whether a wildcard followed them. */
interface ParsedVersion {
  segments: number[];
  wildcard: boolean;
}

/** Stability suffixes Composer accepts on a version, e.g. `8.4.0-RC1` or `8.4.x-dev`. */
const STABILITY_SUFFIX = /-(?:dev|alpha|beta|a|b|rc|patch|pl|p|stable)\.?\d*$/i;

/**
 * Parses one version as Composer writes it: up to four dot-separated numeric
 * segments, an optional `v` prefix and stability suffix, and trailing `*` or
 * `x` wildcards. A bare `*` is a wildcard with no segments.
 *
 * @returns The parsed version, or `undefined` when it is not a version.
 */
const parseVersion = (text: string): ParsedVersion | undefined => {
  const parts = text.replace(/^v/i, '').replace(STABILITY_SUFFIX, '').split('.');
  if (parts.length > 4) {
    return undefined;
  }
  const segments: number[] = [];
  let wildcard = false;
  for (const part of parts) {
    if (/^[*x]$/i.test(part)) {
      wildcard = true;
    } else if (/^\d+$/.test(part) && !wildcard) {
      segments.push(Number(part));
    } else {
      // Not a number, or a number after a wildcard (`8.*.1`).
      return undefined;
    }
  }
  return { segments, wildcard };
};

/** Pads segments with zeros to a full {@link Version}. */
const pad = (segments: number[]): Version => [segments[0] ?? 0, segments[1] ?? 0, segments[2] ?? 0, segments[3] ?? 0];

/**
 * The version after the given segments at `position` (1-based), with every
 * later segment reset: Composer's upper bound for `^`, `~`, wildcards and
 * partial hyphen ranges. Bumping `8.3` at position 1 gives `9.0.0.0`.
 */
const bump = (segments: number[], position: number): Version =>
  pad(segments.slice(0, position).map((segment, index) => (index === position - 1 ? segment + 1 : segment)));

const compare = (a: Version, b: Version) => {
  for (let index = 0; index < 4; index++) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return 0;
};

/** Whether `version` lies in `[lower, upper)`. */
const inRange = (version: Version, lower: Version, upper: Version) =>
  compare(version, lower) >= 0 && compare(version, upper) < 0;

/**
 * Evaluates one constraint without `||`, `,` or whitespace: an operator
 * (`^`, `~`, `>=`, `>`, `<=`, `<`, `!=`, `<>`, `=`, `==`, or none for an
 * exact version) followed by a version, or a wildcard version on its own.
 */
const allowsAtom = (atom: string, version: Version): boolean | undefined => {
  const match = /^(\^|~|>=|<=|<>|!=|==|=|>|<)?(.+)$/.exec(atom);
  const parsed = match ? parseVersion(match[2]) : undefined;
  if (!match || !parsed) {
    return undefined;
  }
  const operator = match[1];
  const { segments } = parsed;

  if (parsed.wildcard) {
    // `8.3.*` is `>=8.3 <8.4`; `*` allows everything. Composer does not
    // combine wildcards with operators in a way worth modelling here.
    if (operator !== undefined) {
      return undefined;
    }
    return segments.length === 0 || inRange(version, pad(segments), bump(segments, segments.length));
  }

  const target = pad(segments);
  switch (operator) {
    case '^': {
      // The first non-zero segment may not change: `^8.3` is `>=8.3 <9.0`,
      // `^0.3` is `>=0.3 <0.4`.
      const position = segments[0] !== 0 || segments.length < 2 ? 1 : segments[1] !== 0 || segments.length < 3 ? 2 : 3;
      return inRange(version, target, bump(segments, position));
    }
    case '~':
      // The last given segment may grow: `~8.3` is `>=8.3 <9.0`, `~8.3.0` is
      // `>=8.3.0 <8.4.0`.
      return inRange(version, target, bump(segments, Math.max(1, segments.length - 1)));
    case '>=':
      return compare(version, target) >= 0;
    case '>':
      return compare(version, target) > 0;
    case '<=':
      return compare(version, target) <= 0;
    case '<':
      return compare(version, target) < 0;
    case '!=':
    case '<>':
      return compare(version, target) !== 0;
    default:
      // `8.3`, `=8.3` and `==8.3` all mean exactly `8.3.0.0`.
      return compare(version, target) === 0;
  }
};

/**
 * Evaluates a hyphen range such as `8.1 - 8.3`. A partial upper bound acts as
 * a wildcard (`8.1 - 8.3` is `>=8.1 <8.4`); a complete one is inclusive
 * (`8.1.0 - 8.3.5` is `>=8.1.0 <=8.3.5`).
 */
const allowsHyphenRange = (from: string, to: string, version: Version): boolean | undefined => {
  const lower = parseVersion(from);
  const upper = parseVersion(to);
  if (!lower || !upper || lower.wildcard || upper.wildcard) {
    return undefined;
  }
  const withinUpper =
    upper.segments.length >= 3
      ? compare(version, pad(upper.segments)) <= 0
      : compare(version, bump(upper.segments, upper.segments.length)) < 0;
  return compare(version, pad(lower.segments)) >= 0 && withinUpper;
};

/**
 * Evaluates the constraints of one `||` branch, which must all hold. They are
 * separated by `,` or whitespace; ` - ` joins the two ends of a hyphen range.
 */
const allowsAll = (branch: string, version: Version): boolean | undefined => {
  const tokens = branch
    .trim()
    // `>= 8.1` is one constraint, not `>=` and `8.1`.
    .replace(/([<>=!~^]+)\s+/g, '$1')
    .split(/\s*,\s*|\s+/)
    .filter((token) => token !== '');
  if (tokens.length === 0) {
    return undefined;
  }

  let allowed = true;
  for (let index = 0; index < tokens.length; index++) {
    let result: boolean | undefined;
    if (tokens[index + 1] === '-') {
      const to = tokens[index + 2];
      result = to === undefined ? undefined : allowsHyphenRange(tokens[index], to, version);
      index += 2;
    } else {
      result = allowsAtom(tokens[index], version);
    }
    if (result === undefined) {
      return undefined;
    }
    allowed &&= result;
  }
  return allowed;
};

/**
 * Whether a Composer version constraint, such as a `composer.json`
 * `require.php` entry, allows a version.
 *
 * Supports the syntax Composer documents for version constraints: `||` or `|`
 * between alternatives, `,` or whitespace between constraints that must all
 * hold, the `^`, `~`, `>=`, `>`, `<=`, `<`, `!=`, `<>`, `=` and `==`
 * operators, exact versions, `*` and `x` wildcards (`8.3.*`, `8.*`, `*`),
 * hyphen ranges (`8.1 - 8.3`) and `@dev`-style stability flags, which are
 * ignored. Pre-release suffixes on versions are ignored as well, since only
 * release versions are ever checked against a constraint.
 *
 * @param constraint - The constraint, e.g. `^8.2` or `>=8.1 <8.4`.
 * @param version - A release version such as `8.4.0`.
 * @returns `true` or `false`, or `undefined` when either argument cannot be
 *   parsed, so the caller can fall back rather than guess.
 *
 * @example
 * ```ts
 * composerConstraintAllows('^8.2', '8.4.0'); // true
 * composerConstraintAllows('~8.3.0', '8.4.0'); // false
 * composerConstraintAllows('dev-main', '8.4.0'); // undefined
 * ```
 */
export const composerConstraintAllows = (constraint: string, version: string): boolean | undefined => {
  const parsed = parseVersion(version);
  if (!parsed || parsed.wildcard || parsed.segments.length === 0) {
    return undefined;
  }
  const target = pad(parsed.segments);

  let allowed = false;
  for (const branch of constraint.replace(/@[a-z]+/gi, '').split(/\|\|?/)) {
    const result = allowsAll(branch, target);
    if (result === undefined) {
      return undefined;
    }
    allowed ||= result;
  }
  return allowed;
};
