/*
 * Parses the three MC job descriptions in demo-data/osp/*.docx with the production DOCX parser and stores
 * the result in data/demo-osp.json (demo profiles for step 1 of path B — docs/04 § 1).
 * Usage: npm run demo-osp -w packages/domain
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseOspDocx } from '../src/osp';

const dir = resolve(import.meta.dirname, '../../../demo-data/osp');
const out: Record<string, unknown> = {};
for (const file of readdirSync(dir).filter((f) => f.endsWith('.docx')).sort()) {
  const parsed = parseOspDocx(new Uint8Array(readFileSync(join(dir, file))));
  out[file] = parsed;
  console.log(`${file}: ${parsed.symbol} · ${parsed.positionName} · ${parsed.subordinates} · ${parsed.mainTasks.length}+${parsed.otherTasks.length} zadań · ${parsed.softCompetencies.join(', ')}${parsed.warnings.length ? ' · ⚠ ' + parsed.warnings.join(' ') : ''}`);
}
writeFileSync(resolve(import.meta.dirname, '../data/demo-osp.json'), JSON.stringify(out, null, 2) + '\n');
