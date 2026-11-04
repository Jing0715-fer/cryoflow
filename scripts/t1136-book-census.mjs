#!/usr/bin/env node
// t1136 pre/post-weigh: strict walk of every .star book under the mock-cluster
// project dir; counts _rlnAngleTilt cells that fail ^-?\d+(\.\d+)?$ (the
// two-dot corruption shape, t1135). Excludes .cryoflow_prev generations.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] || 'services/mock-cluster/fs/projects/cryoflow/cmvbjl6060000srlis2ai5mb3';
const STRICT = /^-?\d+(\.\d+)?$/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.cryoflow_prev') continue;
      walk(p, out);
    } else if (e.name.endsWith('.star')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
let totalCorrupt = 0, totalCells = 0, badFiles = 0;
const perDir = new Map();
for (const f of files) {
  const txt = readFileSync(f, 'utf8');
  const lines = txt.split('\n');
  let tiltCol = -1, inLoop = false, dataRows = false;
  for (const line of lines) {
    if (line.startsWith('data_')) { dataRows = false; tiltCol = -1; inLoop = false; continue; }
    if (line.startsWith('loop_')) { inLoop = true; continue; }
    if (inLoop && line.startsWith('_rlnAngleTilt')) {
      tiltCol = parseInt(line.split('#')[1]?.trim() || '0', 10) - 1;
      continue;
    }
    if (inLoop && line.startsWith('_rln')) continue;
    if (inLoop && tiltCol >= 0 && line.trim() && !line.startsWith('#')) {
      const cells = line.trim().split(/\s+/);
      if (cells.length <= tiltCol) continue;
      totalCells++;
      const v = cells[tiltCol];
      if (!STRICT.test(v)) {
        totalCorrupt++;
        badFiles++;
        const rel = f.slice(ROOT.length + 1);
        perDir.set(rel, (perDir.get(rel) || 0) + 1);
      }
    }
  }
}
const perWorkdir = new Map();
for (const [f, n] of perDir) {
  const wd = f.split('/')[0];
  perWorkdir.set(wd, (perWorkdir.get(wd) || 0) + n);
}
console.log(`files walked: ${files.length}, tilt cells: ${totalCells}, CORRUPT: ${totalCorrupt}`);
for (const [wd, n] of [...perWorkdir.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}  ${wd}`);
if (totalCorrupt === 0) console.log('BOOKS CLEAN — every _rlnAngleTilt speaks a valid float');
process.exit(totalCorrupt > 0 ? 1 : 0);
