import { Schema } from 'effect';
import type { NormalizedConfig } from '../normalized-config';
import type { Runtime } from '../runtime';

// ---------------------------------------------------------------------------
// Tagged Errors
// ---------------------------------------------------------------------------

export class ManifestNotFoundError extends Schema.TaggedError<ManifestNotFoundError>()('ManifestNotFoundError', {
  message: Schema.String,
  filePath: Schema.String,
}) {}

export class ManifestReadError extends Schema.TaggedError<ManifestReadError>()('ManifestReadError', {
  message: Schema.String,
  filePath: Schema.String,
}) {}

export class ManifestParseError extends Schema.TaggedError<ManifestParseError>()('ManifestParseError', {
  message: Schema.String,
  filePath: Schema.String,
}) {}

export class FrameworkNotDetectedError extends Schema.TaggedError<FrameworkNotDetectedError>()(
  'FrameworkNotDetectedError',
  {
    message: Schema.String,
    directory: Schema.String,
  }
) {}

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

export interface FrameworkDetectionItem {
  /** Check manifest dependencies for this package (routed by framework language) */
  matchPackage?: string;
  /** Check if this file exists (relative to project root) */
  path?: string;
  /** If path is set, also check file content matches this regex */
  matchContent?: string;
}

export type FrameworkLanguage = 'node' | 'php';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'composer';

export interface FrameworkDefinition {
  slug: string;
  name: string;
  language: FrameworkLanguage;
  /** ALL items must match for the framework to be detected */
  detectors: FrameworkDetectionItem[];
  /** Higher = higher priority (specific frameworks beat generic ones) */
  priority: number;
  /** Generates deployment defaults for this framework */
  getDefaultConfig: (packageManager: PackageManager) => FrameworkDefaultConfig;
}

export interface FrameworkDefaultConfig {
  runtime: Runtime;
  memory: number;
  maxDuration: number;
  streaming: boolean;
  /** Overrides the auto-generated install command (e.g. for custom composer flags) */
  installCommand?: string;
  /** Build commands (install command is auto-prepended by generateConfig) */
  commands: string[];
  entrypoint?: string;
  assetsDir?: string;
  populateAssetCache?: boolean;
  routes: Array<{ source: string; destination: string }>;
  environmentVariables: Record<string, string>;
  symlinks?: Record<string, string>;
  excludeFiles?: string[];
}

export interface DetectionResult {
  framework: FrameworkDefinition;
  packageManager: PackageManager;
  config: NormalizedConfig;
}
