// Bundles the functions (with @kompas/domain and the RAG index) into dist/ with a minimal package.json,
// so that the deployed source does not depend on the npm workspace.
import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const external = ['firebase-admin', 'firebase-functions'];
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/index.js',
  external: external.map((e) => `${e}*`),
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  logLevel: 'info',
});
mkdirSync('dist', { recursive: true });
writeFileSync(
  'dist/package.json',
  JSON.stringify(
    {
      name: 'kompas-functions',
      private: true,
      type: 'module',
      main: 'index.js',
      engines: pkg.engines,
      dependencies: Object.fromEntries(external.map((e) => [e, pkg.dependencies[e]])),
    },
    null,
    2,
  ) + '\n',
);

// The emulator reads secrets from the functions source dir (dist/), so the local secrets file is copied there.
// Not deployed: firebase deploy ignores *.local by default; dist/ is git-ignored.
if (existsSync('.secret.local')) copyFileSync('.secret.local', 'dist/.secret.local');
