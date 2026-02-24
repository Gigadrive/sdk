import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';
import { detectPackageManager } from './detect-package-manager';
import { FRAMEWORK_DEFINITIONS } from './frameworks';
import { generateConfig } from './generate-config';
import { readDependencies } from './read-dependencies';
import type { DetectionResult, FrameworkDefinition, FrameworkDetectionItem } from './types';
import { FrameworkNotDetectedError } from './types';

/**
 * Evaluates whether a single detection item matches the project.
 */
const matchesDetectionItem = Effect.fn('matchesDetectionItem')(function* (
  item: FrameworkDetectionItem,
  projectFolder: string,
  framework: FrameworkDefinition
) {
  const fs = yield* FileSystem.FileSystem;

  // Check matchPackage
  if (item.matchPackage != null) {
    const deps = yield* readDependencies(projectFolder, framework.language);

    if (!deps.has(item.matchPackage)) {
      return false;
    }
  }

  // Check path existence
  if (item.path != null) {
    const filePath = `${projectFolder}/${item.path}`;
    const exists = yield* fs.exists(filePath).pipe(Effect.catchAll(() => Effect.succeed(false)));

    if (!exists) {
      return false;
    }

    // Check matchContent (only when path is set)
    if (item.matchContent != null) {
      const content = yield* fs.readFileString(filePath).pipe(Effect.catchAll(() => Effect.succeed('')));

      if (!new RegExp(item.matchContent).test(content)) {
        return false;
      }
    }
  }

  return true;
});

/**
 * Evaluates whether all detectors for a framework match the project.
 */
const matchesFramework = Effect.fn('matchesFramework')(function* (
  framework: FrameworkDefinition,
  projectFolder: string
) {
  for (const detector of framework.detectors) {
    const matches = yield* matchesDetectionItem(detector, projectFolder, framework);
    if (!matches) {
      return false;
    }
  }

  return true;
});

/**
 * Detects the framework used in a project by checking framework definitions
 * against the project's dependencies and file structure.
 *
 * Framework definitions are checked in priority order (highest first).
 * All detectors for a framework must match for it to be selected.
 *
 * @param projectFolder - Absolute path to the project root
 * @returns DetectionResult with framework, package manager, and generated config
 */
export const detectFramework = Effect.fn('detectFramework')(function* (projectFolder: string) {
  yield* Effect.logDebug(`Detecting framework in ${projectFolder}`);

  for (const framework of FRAMEWORK_DEFINITIONS) {
    const matches = yield* matchesFramework(framework, projectFolder);

    if (matches) {
      yield* Effect.log(`Detected framework: ${framework.name}`, { slug: framework.slug });

      const packageManager = yield* detectPackageManager(projectFolder);
      const config = yield* generateConfig(framework, packageManager);

      return { framework, packageManager, config } as DetectionResult;
    }
  }

  return yield* Effect.fail(
    new FrameworkNotDetectedError({
      message: `No framework detected in project directory`,
      directory: projectFolder,
    })
  );
});
