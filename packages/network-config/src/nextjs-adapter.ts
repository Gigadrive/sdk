import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface NextConfig {
  output?: string;
  [key: string]: unknown;
}

interface ModifyConfigContext {
  phase: string;
  nextVersion: string;
}

interface BuildCompleteContext {
  projectDir: string;
  repoRoot: string;
  distDir: string;
  config: NextConfig;
  nextVersion: string;
  buildId: string;
}

export interface GigadriveNextBuildManifest {
  version: 1;
  output: 'standalone' | 'export';
  distDir: string;
  repoRootToProject: string;
  nextVersion: string;
  buildId: string;
}

const PRODUCTION_BUILD_PHASE = 'phase-production-build';

const toPortableRelativePath = (from: string, to: string): string => {
  const relativePath = path.relative(from, to).replaceAll(path.sep, '/');
  return relativePath === '' ? '.' : relativePath;
};

/**
 * Next.js build adapter used automatically by Gigadrive Network build workers.
 *
 * It requests standalone output without changing user-owned Next.js config and
 * records the resolved build paths for post-build Network framework detection.
 */
const gigadriveNextAdapter = {
  name: 'Gigadrive Network',

  modifyConfig(config: NextConfig, { phase }: ModifyConfigContext): NextConfig {
    if (phase !== PRODUCTION_BUILD_PHASE) {
      return config;
    }

    const deploymentId = config.deploymentId ?? process.env.GIGADRIVE_DEPLOYMENT_ID;

    return {
      ...config,
      ...(deploymentId ? { deploymentId } : {}),
      output: config.output === 'export' ? 'export' : 'standalone',
    };
  },

  async onBuildComplete({
    projectDir,
    repoRoot,
    distDir,
    config,
    nextVersion,
    buildId,
  }: BuildCompleteContext): Promise<void> {
    const output = config.output === 'export' ? 'export' : 'standalone';
    const metadataDirectory = path.join(projectDir, '.gigadrive');
    const manifest: GigadriveNextBuildManifest = {
      version: 1,
      output,
      distDir: toPortableRelativePath(projectDir, distDir),
      repoRootToProject: toPortableRelativePath(repoRoot, projectDir),
      nextVersion,
      buildId,
    };

    await mkdir(metadataDirectory, { recursive: true });
    await writeFile(path.join(metadataDirectory, 'nextjs.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  },
};

export default gigadriveNextAdapter;
