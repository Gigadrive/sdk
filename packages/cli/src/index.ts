import { Command } from '@effect/cli';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { NetworkConfigLive } from '@gigadrive/network-config';
import { Effect, Layer, LogLevel, Logger } from 'effect';
import pkg from '../package.json';
import { aiCommand } from './commands/ai';
import { appsCommand } from './commands/apps';
import { buildCommand } from './commands/build';
import { debugCommand } from './commands/debug';
import { deploymentsCommand } from './commands/deployments';
import { envCommand } from './commands/env';
import { linkCommand, unlinkCommand } from './commands/link';
import { loginCommand } from './commands/login';
import { logoutCommand } from './commands/logout';
import { platformCommand } from './commands/platform';
import { setupCommand } from './commands/setup';
import { whoamiCommand } from './commands/whoami';
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
    aiCommand,
    buildCommand,
    debugCommand,
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

const AppLive = Layer.mergeAll(ServicesLive, Logger.minimumLogLevel(LogLevel.Info)).pipe(
  Layer.provideMerge(NodeContext.layer)
);

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

NodeRuntime.runMain(Effect.provide(cli(process.argv), AppLive));
