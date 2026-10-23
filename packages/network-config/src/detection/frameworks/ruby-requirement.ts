/** Operators RubyGems accepts in a requirement such as `~> 3.3` or `>= 3.2`. */
export type RubyRequirementOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | '~>';

/** One parsed requirement: an operator and the release segments it applies to. */
export interface RubyRequirementAtom {
  operator: RubyRequirementOperator;
  segments: number[];
}

/**
 * A Ruby version as rbenv, asdf, `ruby -v` and Bundler write it: an optional
 * `ruby-` prefix, numeric segments, an optional patchlevel (`p108`) and an
 * optional pre-release suffix (`-preview1`, `.rc1`).
 */
const RUBY_VERSION = /^(?:ruby-)?(\d+(?:\.\d+)*)(?:p\d+)?(?:[-.]?(?:preview|rc|dev|alpha|beta|pre)\d*)?$/i;

/** One requirement: an optional operator, then a version. */
const REQUIREMENT_ATOM = /^(~>|>=|<=|!=|=|>|<)?\s*(\S+)$/;

/**
 * Parses a concrete Ruby version, such as the contents of `.ruby-version`.
 *
 * Accepts `3.3.6`, `3.3`, `ruby-3.3.6`, `3.3.6p108` and pre-releases such as
 * `3.4.0-preview1`, whose suffix is dropped: only release segments matter for
 * picking a runtime. Other interpreters (`jruby-9.4.5.0`) and anything else
 * that is not a version return `undefined`.
 *
 * @param text - The version, already trimmed of surrounding whitespace.
 * @returns The numeric release segments, e.g. `[3, 3, 6]`.
 *
 * @example
 * ```ts
 * parseRubyVersion('ruby-3.3.6'); // [3, 3, 6]
 * parseRubyVersion('3.3.6p108'); // [3, 3, 6]
 * parseRubyVersion('jruby-9.4.5.0'); // undefined
 * ```
 */
export const parseRubyVersion = (text: string): number[] | undefined => {
  const match = RUBY_VERSION.exec(text);
  return match ? match[1].split('.').map(Number) : undefined;
};

/**
 * Compares two versions the way `Gem::Version` does for releases: segment by
 * segment, with missing trailing segments counting as zero, so `3.3` equals
 * `3.3.0`.
 */
export const compareRubyVersions = (a: readonly number[], b: readonly number[]) => {
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
};

/**
 * The exclusive upper bound of a pessimistic (`~>`) requirement, as
 * `Gem::Version#bump` computes it: drop the last segment (unless it is the
 * only one) and increment the new last one. `~> 3.3` is `< 4`, `~> 3.3.1` is
 * `< 3.4`, `~> 3` is `< 4`.
 */
const pessimisticUpperBound = (segments: readonly number[]) => {
  const kept = segments.length > 1 ? segments.slice(0, -1) : [...segments];
  kept[kept.length - 1] += 1;
  return kept;
};

/**
 * Parses a RubyGems requirement, such as a Gemfile `ruby` directive.
 *
 * Supports the `=`, `!=`, `>`, `<`, `>=`, `<=` and `~>` operators, a bare
 * version (which means `=`), optional whitespace after an operator, and
 * several requirements separated by commas, which must all hold.
 *
 * @param requirement - The requirement, e.g. `~> 3.3` or `>= 3.2, < 4.0`.
 * @returns The parsed requirements, or `undefined` when any part is not a
 *   requirement, so the caller can fall back rather than guess.
 */
export const parseRubyRequirement = (requirement: string): RubyRequirementAtom[] | undefined => {
  const parts = requirement.split(',').map((part) => part.trim());
  const atoms: RubyRequirementAtom[] = [];
  for (const part of parts) {
    const match = REQUIREMENT_ATOM.exec(part);
    const segments = match ? parseRubyVersion(match[2]) : undefined;
    if (!match || !segments) {
      return undefined;
    }
    atoms.push({ operator: (match[1] as RubyRequirementOperator | undefined) ?? '=', segments });
  }
  return atoms;
};

/** Whether one parsed requirement allows a version. */
const atomAllows = ({ operator, segments }: RubyRequirementAtom, version: readonly number[]) => {
  const comparison = compareRubyVersions(version, segments);
  switch (operator) {
    case '=':
      return comparison === 0;
    case '!=':
      return comparison !== 0;
    case '>':
      return comparison > 0;
    case '<':
      return comparison < 0;
    case '>=':
      return comparison >= 0;
    case '<=':
      return comparison <= 0;
    case '~>':
      return comparison >= 0 && compareRubyVersions(version, pessimisticUpperBound(segments)) < 0;
  }
};

/**
 * Whether a RubyGems requirement allows a version, with `Gem::Requirement`
 * semantics: `~> 3.3` is `>= 3.3, < 4.0`, `~> 3.3.1` is `>= 3.3.1, < 3.4`, and
 * comma-separated requirements must all hold. See {@link parseRubyRequirement}
 * for the accepted syntax.
 *
 * @param requirement - The requirement, e.g. `~> 3.3`.
 * @param version - A release version such as `3.4.1`.
 * @returns `true` or `false`, or `undefined` when either argument cannot be
 *   parsed.
 *
 * @example
 * ```ts
 * rubyRequirementAllows('~> 3.3', '3.4.1'); // true
 * rubyRequirementAllows('~> 3.3.1', '3.4.0'); // false
 * rubyRequirementAllows('>= 3.2, < 3.4', '3.3.6'); // true
 * ```
 */
export const rubyRequirementAllows = (requirement: string, version: string): boolean | undefined => {
  const atoms = parseRubyRequirement(requirement);
  const segments = parseRubyVersion(version);
  if (!atoms || !segments) {
    return undefined;
  }
  return atoms.every((atom) => atomAllows(atom, segments));
};
