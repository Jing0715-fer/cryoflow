#!/usr/bin/env node
/**
 * t914 — the stack mint: the world has no multi-image .mrcs, so the
 * quick-keymap's rich row (the slice-step chips) has never been witnessed
 * live. The t913 law applies: the world lacks the variable — MINT it.
 * Real files, real import machinery, real walk, real parsers; the only
 * synthetic thing is the pixel data's noise pattern (deterministic LCG —
 * byte-exact across mint|verify, the restore's ground truth).
 *
 * Verbs (the t913 mint's contract — the manifest is the restore's law):
 *   mint    write the stack files + manifest.json (sha256 per file)
 *   verify  re-hash every manifest entry, exit 1 on any drift
 *   remove  delete the mint dir, verify the listing afterwards
 *
 * Two files, two faces:
 *   FoilHole_217_35_Data_09449_frames.mrcs   64x64x4  — the rich row LIVES
 *     (nz>1: the ←/→ chips + the slice cursor + ArrowRight stepping)
 *   FoilHole_219_20_Data_09452_frames.mrcs   64x64x1  — the must-not-lie
 *     face (a 1-frame stack is a single image: chips for a dead key would
 *     lie; the keymap must show Esc only)
 *
 * The import POST surface audited this window (engine.ts runImportNative):
 * nodeType "micrographs" + a wildcard micrographsPath takes the pattern
 * lane → importFileSet hardlinks the files into projectDir/micrographs and
 * exposes the set inside the job's workdir → walkWorkdir lists them,
 * readMrcHeader reads nz into the `slices` field. Real path, end to end.
 *
 *   node scripts/t914-stack-mint.mjs mint|verify|remove
 */
import { execSync } from "node:child_process";
import {
  existsSync, mkdirSync, rmSync, readdirSync, writeFileSync, readFileSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const DIR = path.join(process.cwd(), "data", "t914-stack-mint");
const MANIFEST = path.join(DIR, "manifest.json");

const W = 64, H = 64, NSYMBT = 0, HDR = 1024, PX_ANGSTROM = 1.77;
const CELL = W * PX_ANGSTROM; // 113.28 Å

const FILES = [
  { name: "FoilHole_217_35_Data_09449_frames.mrcs", nz: 4 },
  { name: "FoilHole_219_20_Data_09452_frames.mrcs", nz: 1 },
];

/** deterministic frame value — plausible micrograph-ish floats, no Math.random */
function voxel(x, y, frame) {
  const grad = 10 + (x / W) * 4 + (y / H) * 2;
  const wobble = 2.5 * Math.sin((x + frame * 7) / 9) + 1.8 * Math.cos((y - frame * 3) / 11);
  const noise = ((x * 7 + y * 13 + frame * 29) % 23) / 3 - 3.5;
  return grad + wobble + noise + frame * 0.8;
}

function buildStack(nz) {
  const header = Buffer.alloc(HDR, 0);
  header.writeInt32LE(W, 0);
  header.writeInt32LE(H, 4);
  header.writeInt32LE(nz, 8);
  header.writeInt32LE(2, 12); // mode 2 — float32
  header.writeInt32LE(0, 16); header.writeInt32LE(0, 20); header.writeInt32LE(0, 24); // starts
  header.writeInt32LE(W, 28); header.writeInt32LE(H, 32); header.writeInt32LE(nz, 36); // mx my mz
  header.writeFloatLE(CELL, 40); header.writeFloatLE(CELL, 44); header.writeFloatLE(CELL * nz, 48);
  header.writeFloatLE(90, 52); header.writeFloatLE(90, 56); header.writeFloatLE(90, 60);
  header.writeInt32LE(1, 64); header.writeInt32LE(2, 68); header.writeInt32LE(3, 72); // mapc mapr maps
  let dmin = Infinity, dmax = -Infinity, sum = 0, sum2 = 0, n = 0;
  const data = Buffer.alloc(W * H * nz * 4);
  for (let f = 0; f < nz; f++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = voxel(x, y, f);
        if (v < dmin) dmin = v;
        if (v > dmax) dmax = v;
        sum += v; sum2 += v * v; n++;
        data.writeFloatLE(v, (f * H * W + y * W + x) * 4);
      }
    }
  }
  header.writeFloatLE(dmin, 76);
  header.writeFloatLE(dmax, 80);
  header.writeFloatLE(sum / n, 84);
  header.writeInt32LE(0, 88); // ispg = 0 (stack of 2D images)
  header.writeInt32LE(NSYMBT, 92);
  header.writeFloatLE(Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2)), 216); // rms (MRC2014 word 55)
  header.write("MAP ", 208, "ascii");
  header.writeUInt8(0x44, 212); header.writeUInt8(0x44, 213); // machst little-endian
  header.write("t914 stack mint — synthetic multi-image stack, deterministic LCG values", 224, "utf8");
  return Buffer.concat([header, data]);
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function mint() {
  if (existsSync(DIR)) {
    console.error(`mint: ${DIR} already exists — remove or verify first (a double mint would fork the restore law)`);
    process.exit(2);
  }
  mkdirSync(DIR, { recursive: true });
  const manifest = { born: new Date().toISOString(), window: "t914", files: [] };
  for (const spec of FILES) {
    const buf = buildStack(spec.nz);
    const p = path.join(DIR, spec.name);
    writeFileSync(p, buf);
    manifest.files.push({ name: spec.name, nz: spec.nz, bytes: buf.length, sha256: sha256(buf) });
    console.log(`minted ${spec.name}  ${W}x${H}x${spec.nz}  ${buf.length}B  sha256 ${sha256(buf).slice(0, 16)}…`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`manifest: ${MANIFEST} (${manifest.files.length} files)`);
}

function verify() {
  if (!existsSync(MANIFEST)) {
    console.error("verify: no manifest — the restore law has no ground truth");
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  let bad = 0;
  for (const f of manifest.files) {
    const p = path.join(DIR, f.name);
    if (!existsSync(p)) { console.error(`✗ missing: ${f.name}`); bad++; continue; }
    const buf = readFileSync(p);
    const h = sha256(buf);
    const sizeOk = buf.length === f.bytes;
    const hashOk = h === f.sha256;
    if (sizeOk && hashOk) console.log(`ok ${f.name}  ${f.bytes}B  sha256 match`);
    else { console.error(`✗ drift: ${f.name}  sizeOk=${sizeOk} hashOk=${hashOk}`); bad++; }
  }
  process.exit(bad > 0 ? 1 : 0);
}

function remove() {
  if (!existsSync(DIR)) {
    console.log("remove: nothing to remove (already gone)");
    return;
  }
  // verify BEFORE the rm — a drifted mint must fail loudly, not vanish silently
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  let bad = 0;
  for (const f of manifest.files) {
    const p = path.join(DIR, f.name);
    if (!existsSync(p)) { console.error(`✗ missing at remove time: ${f.name}`); bad++; continue; }
    if (sha256(readFileSync(p)) !== f.sha256) { console.error(`✗ drifted at remove time: ${f.name}`); bad++; }
  }
  if (bad > 0) {
    console.error("remove: the mint world drifted — refusing the rm (the witness story would lose its ground truth)");
    process.exit(1);
  }
  rmSync(DIR, { recursive: true, force: true });
  if (existsSync(DIR)) { console.error("remove: rm reported success but the dir persists"); process.exit(1); }
  console.log(`removed ${DIR} — the mint world is gone`);
}

const verb = process.argv[2] ?? "";
if (verb === "mint") mint();
else if (verb === "verify") verify();
else if (verb === "remove") remove();
else {
  console.error("usage: node scripts/t914-stack-mint.mjs mint|verify|remove");
  process.exit(2);
}
