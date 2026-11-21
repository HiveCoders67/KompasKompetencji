// Bundles the functions (with @kompas/domain and the RAG index) into dist/ with a minimal package.json,
// so that the deployed source does not depend on the npm workspace.
import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

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

// firebase.json points the functions source at dist/, so the emulator reads .env* and .secret.local from there.
// Mirror them from functions/ (the documented location); a stale copy is removed when the original is gone.
// `*.local` files are excluded from deploys via "ignore" in firebase.json.
const LOCAL_FILES = /^\.(env(\..+)?|secret\.local)$/;
const sources = new Set(readdirSync('.').filter((f) => LOCAL_FILES.test(f)));
for (const f of readdirSync('dist').filter((f) => LOCAL_FILES.test(f) && !sources.has(f))) rmSync(`dist/${f}`);
for (const f of sources) copyFileSync(f, `dist/${f}`);
if (!existsSync('.secret.local')) console.warn('⚠ functions/.secret.local not found — AI assistants will not work in the emulator (GEMINI_API_KEY).');
