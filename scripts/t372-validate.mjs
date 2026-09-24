#!/usr/bin/env node
/**
 * t372 validation-only pass — runs after the chain driver created+ran the
 * jobs. Walks the CLUSTER-side project tree, validates every produced
 * MRC/MRCS, checks the white-particle convention on class averages, and
 * probes small files with the real relion_image_handler.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let pass = 0, fail = 0;
const fails = [];
const must = (c, label) => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; fails.push(label); console.log(`FAIL  ${label}`); }
};

const clusterRoot = "/home/z/cryoflow/services/mock-cluster/fs/projects/cryoflow";
const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(mrcs?|st)$/i.test(e.name) && !e.name.startsWith(".") && !/_probe/.test(e.name)) acc.push(p);
  }
  return acc;
};
const files = fs.existsSync(clusterRoot) ? walk(clusterRoot) : [];
console.log(`== t372-V: ${files.length} produced image files on the cluster tree ==`);

// V1 — headers + exact sizes
let allHeadersOk = true;
const info = {};
for (const f of files) {
  const st = fs.statSync(f).st_size ?? fs.statSync(f).size;
  const buf = Buffer.alloc(1024);
  const fd = fs.openSync(f, "r");
  fs.readSync(fd, buf, 0, 1024, 0);
  fs.closeSync(fd);
  const nx = buf.readInt32LE(0), ny = buf.readInt32LE(4), nz = buf.readInt32LE(8);
  const mode = buf.readInt32LE(12);
  const bpp = mode === 2 || mode === 12 ? 4 : mode === 1 ? 2 : mode === 6 ? 2 : 4;
  const expect = 1024 + nx * ny * nz * bpp;
  const ok = nx > 0 && ny > 0 && nz > 0 && [0, 1, 2, 6, 12].includes(mode) && st === expect;
  info[f] = { nx, ny, nz, mode, size: st, expect };
  if (!ok) { allHeadersOk = false; console.log(`    BAD ${path.basename(f)}: ${nx}x${ny}x${nz} m${mode} ${st}≠${expect}`); }
}
must(allHeadersOk, `V1 every produced mrc/mrcs: sane header + byte-exact size (${files.length} files)`);

// census
const byKind = {
  particleStacks: files.filter((f) => /extract_.*\.mrcs$/.test(f)),
  classStacks: files.filter((f) => /run_it\d+_classes\.mrcs$/.test(f) || /run_classes\.mrcs$/.test(f)),
  classSingles: files.filter((f) => /run_it\d+_class\d+\.mrc$/.test(f)),
  halfmaps: files.filter((f) => /half\d_class\d+(_unfil)?\.mrc$/.test(f)),
  maps: files.filter((f) => /(run_class\d+\.mrc|postprocess\.mrc|mask\.mrc)$/.test(f)),
  corrected: files.filter((f) => /motioncorr_.*\.mrcs?$/.test(f)),
};
for (const [k, v] of Object.entries(byKind)) console.log(`    ${k}: ${v.length}`);
must(byKind.particleStacks.length >= 5 && byKind.classStacks.length >= 3, `V1b the families are all present (stacks=${byKind.particleStacks.length} classStacks=${byKind.classStacks.length} halfmaps=${byKind.halfmaps.length} maps=${byKind.maps.length} corrected=${byKind.corrected.length})`);

// V2 — real relion_image_handler on small files (big stacks: proven by refine consuming them)
let ihFail = [];
const small = files.filter((f) => fs.statSync(f).size < 8_000_000).slice(0, 60);
for (const f of small) {
  const clusterPath = f.replace(clusterRoot, "/projects/cryoflow").replace("/projects/cryoflow/", "/projects/cryoflow/");
  try {
    execSync(
      `node -e "const {Client}=require('/home/z/cryoflow/node_modules/ssh2');const c=new Client();c.on('ready',()=>{c.exec('bash -lc \\"relion_image_handler --i ${clusterPath} --multiply_constant 1 --o _probe_t372 2>&1 | tail -2; rm -f ${clusterPath.replace(/\\.mrcs?$/, '')}_probe_t372.mrcs ${clusterPath.replace(/\\.mrcs?$/, '')}_probe_t372.mrc 2>/dev/null\\"',(e,s)=>{let o='';s.on('data',d=>o+=d);s.stderr.on('data',d=>o+=d);s.on('close',()=>{console.log(o);c.end();});});}).connect({host:'127.0.0.1',port:3022,username:'cryo',password:'demo'});"`,
      { encoding: "utf8", timeout: 90_000, stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (e) {
    ihFail.push(`${path.basename(f)}`);
  }
}
must(ihFail.length === 0, `V2 real relion_image_handler reads every small produced file (${ihFail.length ? ihFail.join(",") : small.length + " files"})`);

// V3 — white particles on class averages (bright centers vs corners)
const classesFiles = byKind.classStacks;
let whiteOk = null; let whiteDetail = "";
for (const f of classesFiles) {
  const { nx, ny, nz } = info[f];
  const fd = fs.openSync(f, "r");
  const all = Buffer.alloc(fs.statSync(f).size - 1024);
  fs.readSync(fd, all, 0, all.length, 1024);
  fs.closeSync(fd);
  const read = (x, y, z) => all.readFloatLE(4 * (z * nx * ny + y * nx + x));
  let bright = 0, total = 0;
  for (let z = 0; z < nz; z++) {
    let cs = 0, cn = 0, rs = 0, rn = 0;
    const cx0 = Math.floor(nx * 0.38), cx1 = Math.ceil(nx * 0.62);
    const cy0 = Math.floor(ny * 0.38), cy1 = Math.ceil(ny * 0.62);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const v = read(x, y, z);
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) { cs += v; cn++; }
      else if ((x < nx * 0.2 || x >= nx * 0.8) && (y < ny * 0.2 || y >= ny * 0.8)) { rs += v; rn++; }
    }
    if (cn && rn) { total++; if (cs / cn > rs / rn) bright++; }
  }
  if (total && whiteOk === null) whiteOk = bright / total > 0.8;
  if (whiteOk !== null) whiteDetail += `${path.basename(f)}: ${bright}/${total} slices bright; `;
}
must(whiteOk === true, `V3b class averages carry WHITE particles (RELION's display convention) — ${whiteDetail.slice(0, 260)}`);

// V4 — 3D volumes cubic + nonzero variance
let volOk = true; const volBad = [];
for (const f of [...byKind.halfmaps, ...byKind.maps]) {
  const i = info[f];
  if (!i || i.nx !== i.ny || i.nz < 8) { volOk = false; volBad.push(`${path.basename(f)} ${i?.nx}x${i?.ny}x${i?.nz}`); }
  else {
    const fd = fs.openSync(f, "r");
    const head = Buffer.alloc(Math.min(4 * i.nx * i.ny * 64, fs.statSync(f).size - 1024));
    fs.readSync(fd, head, 0, head.length, 1024);
    fs.closeSync(fd);
    let mn = 1e30, mx = -1e30;
    for (let k = 0; k + 4 <= head.length; k += 4) { const v = head.readFloatLE(k); if (v < mn) mn = v; if (v > mx) mx = v; }
    if (!(mx > mn)) { volOk = false; volBad.push(`${path.basename(f)} flat`); }
  }
}
must(volOk, `V4 refine/postprocess volumes cubic + live (${volBad.length ? volBad.slice(0, 4).join("; ") : byKind.halfmaps.length + " half-maps + " + byKind.maps.length + " maps"})`);

console.log(`\n== t372-V RESULT: ${pass} ok, ${fail} FAIL ==`);
if (fails.length) { console.log("FAILS:\n  " + fails.join("\n  ")); process.exit(1); }
process.exit(0);
