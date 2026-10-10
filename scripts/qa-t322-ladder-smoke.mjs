#!/usr/bin/env node
/**
 * t322 smoke — the decimation ladder's two cluster-side scripts against a
 * REAL MRC on this machine (the mock cluster runs the same bash/python3):
 *   1. build the script via the exported builders (bun imports the TS)
 *   2. run it through bash (the same shell an SSH exec lands in)
 *   3. parse + render via renderDecimatedPng
 *   4. compare BYTE-IDENTICAL against the full-file render (renderMrcSlicePng
 *      for thumb-mid / renderMrcLargePng for large-first) — the tier math
 *      must pick the same pixels downsample() picks.
 * Fixtures: square 1024, non-square 2048×768, a 4-slice stack (mid/first
 * selection), mode 6 (uint16), and the error ladder (garbage file → both
 * tiers refuse honestly).
 */
import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";

/** run a MULTI-LINE script the way the SSH exec channel does: hand the
 * raw bytes to bash as the script itself — no shell quoting layer. */
const bashScript = (cmd) => {
  writeFileSync(`${tmp}/run.sh`, cmd);
  return execSync(`bash ${tmp}/run.sh`, { maxBuffer: 128 * 1024 * 1024 }).toString("utf8");
};

const run = async (code) => {
  const r = await import("data:text/javascript," + encodeURIComponent(code));
  return r;
};

const MOD = await import("../src/lib/remote/preview.ts");
const MRC = await import("../src/lib/mrc.ts");

let fail = 0;
const must = (c, l) => { console.log(c ? `  ok: ${l}` : `  FAIL: ${l}`); if (!c) fail++; };

/** build a real MRC file: header + float/uint16 pixels with a gradient + spikes */
function mkMrc(file, nx, ny, nz, mode) {
  const bpp = mode === 2 ? 4 : mode === 6 || mode === 1 ? 2 : 1;
  const data = Buffer.alloc(nx * ny * nz * bpp);
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const o = (z * ny * nx + y * nx + x) * bpp;
        const v = ((x * 7 + y * 13 + z * 29) % 251) + (x % 17 === 0 ? 900 : 0);
        if (mode === 2) data.writeFloatLE(v * 0.5 - 60, o);
        else if (mode === 6) data.writeUInt16LE(v, o);
        else if (mode === 1) data.writeInt16LE(v - 125, o);
        else data.writeInt8(v % 101 - 50, o);
      }
    }
  }
  const hdr = Buffer.alloc(1024);
  hdr.writeInt32LE(nx, 0);
  hdr.writeInt32LE(ny, 4);
  hdr.writeInt32LE(nz, 8);
  hdr.writeInt32LE(mode, 12);
  hdr.writeInt32LE(nx, 28); // mx
  hdr.writeInt32LE(ny, 32); // my
  hdr.writeInt32LE(nz, 36); // mz
  hdr.writeFloatLE(0, 76);  // dmin
  hdr.writeFloatLE(500, 80); // dmax
  hdr.writeFloatLE(200, 84); // dmean
  hdr.writeInt32LE(0, 92);  // nsymbt
  writeFileSync(file, Buffer.concat([hdr, data]));
  return 1024 + data.length;
}

const tmp = "/tmp/qa-t322";
execSync(`mkdir -p ${tmp}`);

const cases = [
  { name: "square 1024 mode2", file: `${tmp}/sq.mrc`, nx: 1024, ny: 1024, nz: 1, mode: 2 },
  { name: "non-square 2048×768 mode2", file: `${tmp}/rect.mrc`, nx: 2048, ny: 768, nz: 1, mode: 2 },
  { name: "stack nz=4 mode2 (mid thumb / first large)", file: `${tmp}/stack.mrc`, nx: 512, ny: 384, nz: 4, mode: 2 },
  { name: "mode6 uint16 1536²", file: `${tmp}/u16.mrc`, nx: 1536, ny: 1536, nz: 1, mode: 6 },
];

for (const c of cases) {
  const bytes = mkMrc(c.file, c.nx, c.ny, c.nz, c.mode);
  for (const scale of ["thumb", "large"]) {
    const maxW = scale === "large" ? 768 : 384;
    const sliceSel = scale === "large" ? "first" : "mid";
    // the referee: the full-file render (exactly what the old door served)
    const ref = scale === "large"
      ? await MRC.renderMrcLargePng(c.file, 0, undefined)
      : await MRC.renderMrcSlicePng(c.file, undefined, undefined);
    for (const tier of ["python", "dd"]) {
      const cmd = tier === "python"
        ? MOD.buildPythonDecimateCmd(c.file, maxW, sliceSel)
        : MOD.buildDdDecimateCmd(c.file, maxW, sliceSel);
      let out = "";
      try {
        out = bashScript(cmd);
      } catch (e) {
        must(false, `${c.name}/${scale}/${tier}: script ran (${e.message?.slice(0, 80)})`);
        continue;
      }
      const grid = MOD.parseDecimateResponse(out);
      if (!grid) { must(false, `${c.name}/${scale}/${tier}: parsed`); continue; }
      const png = await MRC.renderDecimatedPng(grid.grid.data, grid.grid.width, grid.grid.height, maxW);
      const same = png != null && ref != null && png.equals(ref);
      must(same, `${c.name}/${scale}/${tier}: byte-identical to the full render (tier=${grid.tier}, payload=${(grid.payloadBytes / 1024).toFixed(0)}KB vs file=${(bytes / 1024 / 1024).toFixed(1)}MB)`);
    }
  }
}

// the honest refusal: a garbage file makes BOTH tiers say CFD|ERR → parse null
{
  writeFileSync(`${tmp}/garbage.mrc`, Buffer.from("this is not an mrc at all, just text padding ......" .repeat(20)));
  const pyOut = bashScript(MOD.buildPythonDecimateCmd(`${tmp}/garbage.mrc`, 384, "mid"));
  const ddOut = bashScript(MOD.buildDdDecimateCmd(`${tmp}/garbage.mrc`, 384, "mid"));
  must(MOD.parseDecimateResponse(pyOut) === null, "garbage file: the python tier refuses (parse → null)");
  must(MOD.parseDecimateResponse(ddOut) === null, "garbage file: the dd tier refuses (parse → null)");
}

// the noise-proof payload slice: banner noise before + logout noise after
{
  mkMrc(`${tmp}/noisy.mrc`, 256, 256, 1, 2);
  const clean = bashScript(MOD.buildPythonDecimateCmd(`${tmp}/noisy.mrc`, 384, "mid"));
  const poisoned = `some .bashrc banner with | pipes\n${clean}logout\nbye\n`;
  const a = MOD.parseDecimateResponse(clean);
  const b = MOD.parseDecimateResponse(poisoned);
  must(a != null && b != null && a.grid.data.length === b.grid.data.length, "banner noise before + logout noise after cannot poison the payload");
}

rmSync(tmp, { recursive: true, force: true });
console.log(fail === 0 ? "\nLADDER SMOKE: ALL GREEN" : `\nLADDER SMOKE: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
