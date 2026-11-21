// Runs a Python script with the first working interpreter (python3 on Linux/macOS,
// python or the py launcher on Windows, where `python3` is often a Store stub).
import { spawnSync } from 'node:child_process';

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error('Usage: node knowledge/scripts/run-python.mjs <script.py> [args...]');
  process.exit(2);
}

const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
for (const cmd of candidates) {
  const probe = spawnSync(cmd, ['-c', 'import sys; assert sys.version_info >= (3, 9)'], { stdio: 'ignore' });
  if (probe.status !== 0) continue;
  const run = spawnSync(cmd, [script, ...args], { stdio: 'inherit' });
  process.exit(run.status ?? 1);
}
console.error('Python >= 3.9 not found (tried: ' + candidates.join(', ') + ').');
process.exit(1);
