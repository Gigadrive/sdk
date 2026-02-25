import { Command } from '@effect/cli';
import { FileSystem, Path } from '@effect/platform';
import { exec } from '@gigadrive/build-utils';
import { Console, Effect } from 'effect';
import { BuildScriptNotFoundError, ExecError, PackageJsonNotFoundError, PackageJsonParseError } from '../../errors';
import { PackageManagerService } from '../../services/package-manager';

export const buildCommand = Command.make('build', {}, () =>
  Effect.gen(function* () {
    const pmService = yield* PackageManagerService;
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const cwd = process.cwd();

    yield* Effect.log('Starting build', { cwd });

    // Validate package.json exists
    const packageJsonPath = pathService.join(cwd, 'package.json');
    const packageJsonExists = yield* fs
      .exists(packageJsonPath)
      .pipe(
        Effect.mapError(
          () => new PackageJsonNotFoundError({ message: 'Failed to check for package.json', directory: cwd })
        )
      );
    if (!packageJsonExists) {
      return yield* Effect.fail(new PackageJsonNotFoundError({ message: 'No package.json found', directory: cwd }));
    }

    // Read and validate build script
    const packageJsonContent = yield* fs
      .readFileString(packageJsonPath, 'utf-8')
      .pipe(
        Effect.mapError(() => new PackageJsonNotFoundError({ message: 'Failed to read package.json', directory: cwd }))
      );

    const packageJson = yield* Effect.try({
      try: () => JSON.parse(packageJsonContent) as { scripts?: { build?: string } },
      catch: (error) =>
        new PackageJsonParseError({
          message: 'Failed to parse package.json',
          directory: cwd,
          cause: error instanceof Error ? error.message : String(error),
        }),
    });

    if (!packageJson.scripts?.build) {
      return yield* Effect.fail(new BuildScriptNotFoundError({ message: 'No build script found in package.json' }));
    }

    // Detect package manager
    const pm = yield* pmService.detect(cwd);

    const buildEnv = {
      ...process.env,
      NODE_ENV: 'production',
      NEBULA: '1',
      VERCEL: '1',
      NOW_BUILDER: '1',
    };

    // Install dependencies
    const installCmd = pmService.installCommand(pm);
    yield* Console.log(`Running: ${installCmd}`);
    yield* Effect.tryPromise({
      try: () =>
        exec({
          command: installCmd,
          cwd,
          env: buildEnv,
          onOutput: (chunk) => {
            Console.log(chunk).pipe(Effect.runSync);
          },
        }),
      catch: (error) =>
        new ExecError({
          message: 'Install failed',
          command: installCmd,
          cause: error instanceof Error ? error.message : String(error),
        }),
    });

    // Run build
    const buildCmd = pmService.buildCommand(pm);
    yield* Console.log(`Running: ${buildCmd}`);
    yield* Effect.tryPromise({
      try: () =>
        exec({
          command: buildCmd,
          cwd,
          env: buildEnv,
          onOutput: (chunk) => {
            Console.log(chunk).pipe(Effect.runSync);
          },
        }),
      catch: (error) =>
        new ExecError({
          message: 'Build failed',
          command: buildCmd,
          cause: error instanceof Error ? error.message : String(error),
        }),
    });

    yield* Console.log('Build completed successfully.');
  }).pipe(
    Effect.catchTags({
      PackageJsonNotFoundError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
      PackageJsonParseError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
      BuildScriptNotFoundError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
      PackageManagerNotFoundError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
      ExecError: (err) =>
        Console.error(`${err.message}: ${err.cause ?? err.command}`).pipe(Effect.andThen(Effect.fail(err))),
    })
  )
);
