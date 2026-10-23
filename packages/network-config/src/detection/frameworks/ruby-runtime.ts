import { FileSystem, Path } from '@effect/platform';
import { Effect, Option } from 'effect';
import type { Runtime } from '../../runtime';
import type { FrameworkDefaultConfig, FrameworkDefinition } from '../types';
import { compareRubyVersions, parseRubyRequirement, parseRubyVersion, rubyRequirementAllows } from './ruby-requirement';

/**
 * The runtime every Ruby preset declares until the project names a Ruby
 * version: Ruby 3.4, which more gems support today than Ruby 4.0.
 */
export const DEFAULT_RUBY_RUNTIME: Runtime = 'ruby-34';

/**
 * The Ruby runtimes, newest first, each with its minor series and a version
 * standing in for the newest patch release it runs. A requirement is checked
 * against that version, the way Bundler checks the running Ruby, so `<= 3.4`
 * (which RubyGems reads as `<= 3.4.0`) does not pick `ruby-34`.
 */
const RUBY_RUNTIME_CANDIDATES: Array<{ runtime: Runtime; series: readonly [number, number]; newestVersion: string }> = [
  { runtime: 'ruby-40', series: [4, 0], newestVersion: '4.0.9999' },
  { runtime: 'ruby-34', series: [3, 4], newestVersion: '3.4.9999' },
  { runtime: 'ruby-33', series: [3, 3], newestVersion: '3.3.9999' },
];

/**
 * Picks the Ruby runtime for a concrete version, such as the contents of
 * `.ruby-version`: the runtime of the same minor series, otherwise the newest
 * runtime older than the version. A version older than every runtime (`3.2.2`)
 * gets the oldest one, `ruby-33`, and one newer than every runtime gets
 * `ruby-40`.
 *
 * @param version - The version, e.g. `3.3.6`, `ruby-3.4.1` or `3.3.6p108`.
 * @returns The runtime, or `undefined` when the version cannot be parsed.
 *
 * @example
 * ```ts
 * rubyRuntimeForVersion('3.3.6'); // 'ruby-33'
 * rubyRuntimeForVersion('3.2.2'); // 'ruby-33'
 * rubyRuntimeForVersion('4.1.0'); // 'ruby-40'
 * ```
 */
export const rubyRuntimeForVersion = (version: string): Runtime | undefined => {
  const segments = parseRubyVersion(version);
  if (!segments) {
    return undefined;
  }
  const series = [segments[0], segments[1] ?? 0];
  const candidate = RUBY_RUNTIME_CANDIDATES.find((candidate) => compareRubyVersions(candidate.series, series) <= 0);
  return (candidate ?? RUBY_RUNTIME_CANDIDATES[RUBY_RUNTIME_CANDIDATES.length - 1]).runtime;
};

/**
 * Picks the Ruby runtime for a RubyGems requirement, such as a Gemfile `ruby`
 * directive. An exact version (`3.3.6` or `= 3.3.6`) is a concrete version
 * ({@link rubyRuntimeForVersion}); any other requirement picks the newest
 * runtime whose newest patch release it allows, so `~> 3.3` picks `ruby-34`
 * and `>= 3.2` picks `ruby-40`.
 *
 * @param requirement - The requirement, e.g. `~> 3.3` or `>= 3.2, < 3.4`.
 * @returns The runtime, or `undefined` when the requirement cannot be parsed
 *   or allows no runtime.
 */
export const rubyRuntimeForRequirement = (requirement: string): Runtime | undefined => {
  const atoms = parseRubyRequirement(requirement);
  if (!atoms) {
    return undefined;
  }
  if (atoms.length === 1 && atoms[0].operator === '=') {
    return rubyRuntimeForVersion(atoms[0].segments.join('.'));
  }
  return RUBY_RUNTIME_CANDIDATES.find(({ newestVersion }) => rubyRequirementAllows(requirement, newestVersion) === true)
    ?.runtime;
};

/**
 * The version in a `.ruby-version` file: its first line that is neither
 * empty nor a comment, up to the first whitespace, without an rvm `@gemset`.
 */
const versionFromRubyVersionFile = (content: string) =>
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== '' && !line.startsWith('#'))
    ?.split(/\s/)[0]
    ?.split('@')[0];

/** The first Ruby version of the `ruby` line in an asdf/mise `.tool-versions` file. */
const versionFromToolVersionsFile = (content: string) => /^\s*ruby\s+(\S+)/m.exec(content)?.[1];

/** The Ruby version in the `RUBY VERSION` section of a `Gemfile.lock`, e.g. `   ruby 3.3.6p108`. */
const versionFromGemfileLock = (content: string) => /^RUBY VERSION\r?\n\s+ruby\s+(\S+)/m.exec(content)?.[1];

/** A Gemfile `ruby` directive; the capture is its arguments. */
const GEMFILE_RUBY_DIRECTIVE = /^\s*ruby[\s(]+(.+)$/m;

/** A file the `ruby` directive reads its version from: `file: ".ruby-version"` or `File.read(".ruby-version")`. */
const GEMFILE_RUBY_FILE = /^(?:file:|:file\s*=>|File\.read\s*\(?)\s*(['"])([^'"]+)\1/;

/** The quoted strings leading a `ruby` directive, before any keyword argument such as `engine:`. */
const LEADING_STRINGS = /^\s*(['"])([^'"]*)\1\s*(?:,|\)|$)/;

/**
 * Reads a project file.
 *
 * @returns The content, or `None` when the file is missing or unreadable.
 */
const readProjectFile = Effect.fn('readProjectFile')(
  function* (projectFolder: string, file: string) {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    return Option.some(yield* fs.readFileString(pathService.join(projectFolder, file)));
  },
  Effect.catchAll(() => Effect.succeed(Option.none<string>()))
);

/**
 * Picks the runtime for a `.ruby-version` or `.tool-versions` file, by its
 * name.
 */
const runtimeFromVersionFile = Effect.fn('runtimeFromVersionFile')(function* (projectFolder: string, file: string) {
  const content = yield* readProjectFile(projectFolder, file);
  const parse = file.split('/').at(-1) === '.tool-versions' ? versionFromToolVersionsFile : versionFromRubyVersionFile;
  return Option.flatMapNullable(content, (text) => {
    const version = parse(text);
    return version === undefined ? undefined : rubyRuntimeForVersion(version);
  });
});

/**
 * Picks the runtime for the Gemfile `ruby` directive: a requirement such as
 * `ruby "~> 3.3"` (several comma-separated strings are combined), or the file
 * named by `ruby file: ".ruby-version"`.
 */
const runtimeFromGemfile = Effect.fn('runtimeFromGemfile')(function* (projectFolder: string) {
  const gemfile = yield* readProjectFile(projectFolder, 'Gemfile');
  const directive = Option.flatMapNullable(gemfile, (content) => GEMFILE_RUBY_DIRECTIVE.exec(content)?.[1]?.trim());
  if (Option.isNone(directive)) {
    return Option.none<Runtime>();
  }

  const versionFile = GEMFILE_RUBY_FILE.exec(directive.value)?.[2];
  if (versionFile !== undefined) {
    return yield* runtimeFromVersionFile(projectFolder, versionFile);
  }

  const requirements: string[] = [];
  let rest = directive.value;
  for (let match = LEADING_STRINGS.exec(rest); match; match = LEADING_STRINGS.exec(rest)) {
    requirements.push(match[2]);
    rest = rest.slice(match[0].length);
  }
  return requirements.length === 0
    ? Option.none<Runtime>()
    : Option.fromNullable(rubyRuntimeForRequirement(requirements.join(',')));
});

/** Picks the runtime for the `RUBY VERSION` a `Gemfile.lock` records. */
const runtimeFromGemfileLock = Effect.fn('runtimeFromGemfileLock')(function* (projectFolder: string) {
  const lockfile = yield* readProjectFile(projectFolder, 'Gemfile.lock');
  return Option.flatMapNullable(lockfile, (content) => {
    const version = versionFromGemfileLock(content);
    return version === undefined ? undefined : rubyRuntimeForVersion(version);
  });
});

/**
 * Picks the Ruby runtime a project asks for. The first of these that names a
 * usable version wins:
 *
 * 1. `.ruby-version` (`3.3.6`, `ruby-3.3.6`, `3.3`)
 * 2. `.tool-versions` (`ruby 3.3.6`)
 * 3. the Gemfile `ruby` directive (`ruby "3.3.6"`, `ruby "~> 3.3"`,
 *    `ruby file: ".ruby-version"`)
 * 4. the `RUBY VERSION` a `Gemfile.lock` records (`ruby 3.3.6p108`)
 *
 * Concrete versions map with {@link rubyRuntimeForVersion} and requirements
 * with {@link rubyRuntimeForRequirement}. Missing or unreadable files are
 * skipped, never an error.
 *
 * The runtime of a static Ruby preset (Jekyll, Bridgetown) appears nowhere in
 * the generated config, since it has no function, so a build that needs to
 * choose its Ruby calls this directly.
 *
 * @param projectFolder - Absolute path to the project root
 * @returns The runtime, or `undefined` when the project names no usable version.
 */
export const detectRubyRuntime = Effect.fn('detectRubyRuntime')(function* (projectFolder: string) {
  const sources = [
    runtimeFromVersionFile(projectFolder, '.ruby-version'),
    runtimeFromVersionFile(projectFolder, '.tool-versions'),
    runtimeFromGemfile(projectFolder),
    runtimeFromGemfileLock(projectFolder),
  ];
  for (const source of sources) {
    const runtime = yield* source;
    if (Option.isSome(runtime)) {
      return runtime.value;
    }
  }
  return undefined;
});

/**
 * Sets the runtime of Ruby defaults from the version the project asks for
 * (see {@link detectRubyRuntime}). Without one the defaults keep their runtime.
 */
const refineRubyRuntime = Effect.fn('refineRubyRuntime')(function* (
  defaults: FrameworkDefaultConfig,
  projectFolder: string
) {
  const runtime = yield* detectRubyRuntime(projectFolder);
  return runtime ? { ...defaults, runtime } : defaults;
});

/**
 * Makes a Ruby preset pick its runtime from the project's Ruby version, after
 * the preset's own `refineDefaultConfig` (if any) has run. Applied to every
 * Ruby preset in `FRAMEWORK_DEFINITIONS`, so a project pinned to Ruby 3.3 runs
 * on `ruby-33` rather than failing Bundler's Ruby version check on 3.4.
 */
export const withRubyRuntime = (framework: FrameworkDefinition): FrameworkDefinition => ({
  ...framework,
  refineDefaultConfig: (defaults, projectFolder) =>
    Effect.gen(function* () {
      const refined = framework.refineDefaultConfig
        ? yield* framework.refineDefaultConfig(defaults, projectFolder)
        : defaults;
      return yield* refineRubyRuntime(refined, projectFolder);
    }),
});
