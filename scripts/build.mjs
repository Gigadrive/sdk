import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { globSync } from 'glob';
import { minimatch } from 'minimatch';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Read package.json to get target and platform settings
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
const buildScript = packageJson.scripts?.build || '';

// Extract target and platform from the build script if available
const targetMatch = buildScript.match(/--target=(\w+)/);
const platformMatch = buildScript.match(/--platform=(\w+)/);

const target = targetMatch ? targetMatch[1] : 'node18';
const platform = platformMatch ? platformMatch[1] : 'node';

// Find all TypeScript files excluding test files
const entryPoints = globSync('src/**/*.ts', {
  ignore: ['**/*.test.ts', '**/__tests__/**'],
});

// Build with esbuild
try {
  await build({
    entryPoints,
    outdir: 'dist',
    bundle: false,
    sourcemap: true,
    minify: true,
    platform,
    target,
    format: 'esm',
    plugins: [
      {
        name: 'exclude-test-files',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (minimatch(args.path, '**/*.test.ts')) {
              return { external: true };
            }
            return null;
          });
        },
      },
    ],
  });

  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
