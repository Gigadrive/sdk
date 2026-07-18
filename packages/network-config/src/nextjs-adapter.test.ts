import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import gigadriveNextAdapter, { type GigadriveNextBuildManifest } from './nextjs-adapter';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  delete process.env.GIGADRIVE_DEPLOYMENT_ID;
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Gigadrive Next.js adapter', () => {
  it('enables standalone output and version-skew protection for production builds while preserving config', () => {
    const config = { reactStrictMode: true };
    process.env.GIGADRIVE_DEPLOYMENT_ID = 'deployment-id';

    expect(
      gigadriveNextAdapter.modifyConfig(config, {
        phase: 'phase-production-build',
        nextVersion: '16.2.10',
      })
    ).toEqual({ reactStrictMode: true, deploymentId: 'deployment-id', output: 'standalone' });
    expect(config).toEqual({ reactStrictMode: true });
  });

  it('does not alter development or explicit static export config', () => {
    const developmentConfig = { reactStrictMode: true };
    const exportConfig = { output: 'export', trailingSlash: true };

    expect(
      gigadriveNextAdapter.modifyConfig(developmentConfig, {
        phase: 'phase-development-server',
        nextVersion: '16.2.10',
      })
    ).toBe(developmentConfig);
    expect(
      gigadriveNextAdapter.modifyConfig(exportConfig, {
        phase: 'phase-production-build',
        nextVersion: '16.2.10',
      })
    ).toEqual(exportConfig);
  });

  it('writes portable post-build metadata for monorepo applications', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-adapter-'));
    temporaryDirectories.push(repoRoot);
    const projectDir = path.join(repoRoot, 'apps', 'web');
    const distDir = path.join(projectDir, '.next-custom');

    await gigadriveNextAdapter.onBuildComplete({
      projectDir,
      repoRoot,
      distDir,
      config: { output: 'standalone' },
      nextVersion: '16.2.10',
      buildId: 'build-id',
    });

    const manifest = JSON.parse(
      await readFile(path.join(projectDir, '.gigadrive', 'nextjs.json'), 'utf8')
    ) as GigadriveNextBuildManifest;

    expect(manifest).toEqual({
      version: 1,
      output: 'standalone',
      distDir: '.next-custom',
      repoRootToProject: 'apps/web',
      nextVersion: '16.2.10',
      buildId: 'build-id',
    });
  });
});
