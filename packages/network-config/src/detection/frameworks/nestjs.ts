import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';
import type { FrameworkDefaultConfig, FrameworkDefinition } from '../types';

interface NestCliJson {
  compilerOptions?: {
    outputPath?: unknown;
  };
  defaultProject?: unknown;
  projects?: Record<
    string,
    {
      compilerOptions?: {
        outputPath?: unknown;
      };
    }
  >;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const parseNestCliJson = (content: string): NestCliJson | undefined => {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed)) return undefined;
    return parsed as NestCliJson;
  } catch {
    return undefined;
  }
};

const getProjectOutputPath = (config: NestCliJson): string | undefined => {
  if (typeof config.compilerOptions?.outputPath === 'string') {
    return config.compilerOptions.outputPath;
  }

  if (typeof config.defaultProject === 'string') {
    const outputPath = config.projects?.[config.defaultProject]?.compilerOptions?.outputPath;
    if (typeof outputPath === 'string') return outputPath;
  }

  const firstProject = Object.values(config.projects ?? {})[0];
  const outputPath = firstProject?.compilerOptions?.outputPath;
  return typeof outputPath === 'string' ? outputPath : undefined;
};

const normalizeOutputPath = (outputPath: string): string | undefined => {
  const normalized = outputPath.replace(/^\.\//, '').replace(/\/$/, '');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').some((segment) => segment === '..')) {
    return undefined;
  }
  return normalized;
};

const createNestConfig = (outputPath: string): FrameworkDefaultConfig => {
  const outputDirectory = normalizeOutputPath(outputPath) ?? 'dist';
  const entrypoint = `${outputDirectory}/main.js`;

  return {
    runtime: 'node-22',
    memory: 256,
    maxDuration: 30,
    streaming: true,
    commands: ['nest build'],
    entrypoint,
    routes: [{ source: '/*', destination: entrypoint }],
    environmentVariables: { NODE_ENV: 'production' },
  };
};

export const nestjs: FrameworkDefinition = {
  slug: 'nestjs',
  name: 'NestJS',
  language: 'node',
  detectors: [{ matchPackage: '@nestjs/core' }],
  priority: 90,
  getDefaultConfig: () => createNestConfig('dist'),
  refineDefaultConfig: (defaults, projectFolder) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const content = yield* fs
        .readFileString(`${projectFolder}/nest-cli.json`)
        .pipe(Effect.catchAll(() => Effect.succeed(undefined)));

      if (!content) return defaults;

      const nestConfig = parseNestCliJson(content);
      const outputPath = nestConfig ? getProjectOutputPath(nestConfig) : undefined;

      return outputPath ? createNestConfig(outputPath) : defaults;
    }),
};
