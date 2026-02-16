import { Command } from '@effect/cli';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { Effect, Layer, LogLevel, Logger } from 'effect';
import { buildCommand } from './commands/build';
import { debugCommand } from './commands/debug';
import { loginCommand } from './commands/login';
import { platformCommand } from './commands/platform';
import { whoamiCommand } from './commands/whoami';
import { ArchiveService } from './services/archive';
import { AuthService } from './services/auth';
import { AuthStorageService } from './services/auth-storage';
import { DeploymentApiService } from './services/deployment-api';
import { OAuthConfigService } from './services/oauth-config';
import { PackageManagerService } from './services/package-manager';
import { ProjectConfigService } from './services/project-config';

// ---------------------------------------------------------------------------
// Root command with subcommands
// ---------------------------------------------------------------------------

const gigadrive = Command.make('gigadrive', {}, () => Effect.void).pipe(
  Command.withSubcommands([loginCommand, whoamiCommand, buildCommand, debugCommand, platformCommand])
);

// ---------------------------------------------------------------------------
// CLI application
// ---------------------------------------------------------------------------

const cli = Command.run(gigadrive, {
  name: 'Gigadrive CLI',
  version: '2.0.0',
});

// ---------------------------------------------------------------------------
// Service layers — flat composition via mergeAll + provideMerge
// ---------------------------------------------------------------------------

const BaseServices = Layer.mergeAll(
  OAuthConfigService.Default,
  AuthStorageService.Default,
  ProjectConfigService.Default,
  PackageManagerService.Default,
  ArchiveService.Default
).pipe(Layer.provideMerge(AuthService.Default));

const DeploymentApiLive = Layer.provide(DeploymentApiService.Default, BaseServices);

const ServicesLive = Layer.mergeAll(BaseServices, DeploymentApiLive);

const AppLive = Layer.mergeAll(ServicesLive, Logger.minimumLogLevel(LogLevel.Info)).pipe(
  Layer.provideMerge(NodeContext.layer)
);

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

NodeRuntime.runMain(Effect.provide(cli(process.argv), AppLive));
