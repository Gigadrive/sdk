import { Command, ValidationError } from '@effect/cli';
// Subpaths, not the package root: the root also loads the HTTP server, sockets
// and workers, about half a second of startup the CLI never uses.
import * as NodeContext from '@effect/platform-node/NodeContext';
import * as NodeRuntime from '@effect/platform-node/NodeRuntime';
import { NetworkConfigLive } from '@gigadrive/network-config';
import { Cause, Console, Effect, Layer, LogLevel, Logger } from 'effect';
import pkg from '../package.json';
import { aiCommand } from './commands/ai';
import { appsCommand } from './commands/apps';
import { buildCommand } from './commands/build';
import { debugCommand } from './commands/debug';
import { deploymentsCommand } from './commands/deployments';
import { domainsCommand } from './commands/domains';
import { envCommand } from './commands/env';
import { linkCommand, unlinkCommand } from './commands/link';
import { loginCommand } from './commands/login';
import { logoutCommand } from './commands/logout';
import { microvmsCommand, vmCommand } from './commands/microvms';
import { platformCommand } from './commands/platform';
import { deployCommand } from './commands/platform/deploy';
import { setupCommand } from './commands/setup';
import { whoamiCommand } from './commands/whoami';
import { isDebugLogLevel, normalizeArgv } from './lib/argv';
import { ApiClientService } from './services/api-client';
import { ArchiveService } from './services/archive';
import { AuthService } from './services/auth';
import { AuthStorageService } from './services/auth-storage';
import { DeploymentApiService } from './services/deployment-api';
import { DevCredentialsStore } from './services/dev-credentials-store';
import { EnvFileService } from './services/env-file';
import { LocalCredentialsService } from './services/local-credentials';
import { OAuthConfigService } from './services/oauth-config';
import { PackageManagerService } from './services/package-manager';
import { ProjectConfigService } from './services/project-config';
import { ProjectLinkService } from './services/project-link';

// ---------------------------------------------------------------------------
// Root command with subcommands
// ---------------------------------------------------------------------------

const gigadrive = Command.make('gigadrive', {}, () => Effect.void).pipe(
  Command.withSubcommands([
    loginCommand,
    logoutCommand,
    whoamiCommand,
    linkCommand,
    unlinkCommand,
    appsCommand,
    envCommand,
    deploymentsCommand,
    domainsCommand,
    aiCommand,
    microvmsCommand,
    vmCommand,
    buildCommand,
    debugCommand,
    deployCommand,
    platformCommand,
    setupCommand,
  ])
);

// ---------------------------------------------------------------------------
// CLI application
// ---------------------------------------------------------------------------

const cli = Command.run(gigadrive, {
  name: 'Gigadrive CLI',
  version: pkg.version,
});

// ---------------------------------------------------------------------------
// Service layers — flat composition via mergeAll + provideMerge
// ---------------------------------------------------------------------------

const BaseServices = Layer.mergeAll(
  OAuthConfigService.Default,
  AuthStorageService.Default,
  PackageManagerService.Default,
  ArchiveService.Default,
  NetworkConfigLive,
  ProjectConfigService.Default,
  ProjectLinkService.Default,
  EnvFileService.Default,
  DevCredentialsStore.Default
).pipe(Layer.provideMerge(AuthService.Default));

const ApiClientLive = Layer.provide(ApiClientService.Default, BaseServices);
const DeploymentApiLive = Layer.provide(DeploymentApiService.Default, BaseServices);
// LocalCredentialsService bakes in ApiClientService + DevCredentialsStore via its
// `dependencies`, so it only needs BaseServices (for the transitive AuthService).
const LocalCredentialsLive = Layer.provide(LocalCredentialsService.Default, BaseServices);

const ServicesLive = Layer.mergeAll(BaseServices, ApiClientLive, DeploymentApiLive, LocalCredentialsLive);

// Warnings and errors only by default; `--log-level info|debug` shows more.
const AppLive = Layer.mergeAll(ServicesLive, Logger.minimumLogLevel(LogLevel.Warning)).pipe(
  Layer.provideMerge(NodeContext.layer)
);

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const { argv, logLevel } = normalizeArgv(process.argv);
const debug = isDebugLogLevel(logLevel);

/**
 * Tracks whether the command printed an error itself. Commands report their
 * own failures with a message and a next step, so the entry point only adds a
 * line for a failure nobody explained.
 */
let printedError = false;
const trackingConsole = Effect.map(Effect.console, (console) => ({
  ...console,
  error: (...args: ReadonlyArray<unknown>) => {
    printedError = true;
    return console.error(...args);
  },
}));

/**
 * Prints a failure in one line, with the full cause (and stack traces) only
 * at `--log-level debug`. The parser has already printed its own validation
 * errors.
 */
const reportFailure = (cause: Cause.Cause<unknown>) =>
  Effect.gen(function* () {
    if (Cause.isInterruptedOnly(cause)) return;
    const failure = Cause.failureOption(cause);
    if (failure._tag === 'Some' && ValidationError.isValidationError(failure.value)) return;
    if (debug) return yield* Console.error(Cause.pretty(cause, { renderErrorCause: true }));
    if (failure._tag === 'Some' && printedError) return;
    const error = failure._tag === 'Some' ? failure.value : Cause.squash(cause);
    const message =
      error !== null && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : String(error);
    yield* Console.error(`Error: ${message}`);
    if (failure._tag === 'None') yield* Console.error('Run again with --log-level debug for details.');
  });

const program = Effect.flatMap(trackingConsole, (console) =>
  cli(argv).pipe(Effect.tapErrorCause(reportFailure), Effect.withConsole(console))
);

NodeRuntime.runMain(Effect.provide(program, AppLive), { disableErrorReporting: true });
