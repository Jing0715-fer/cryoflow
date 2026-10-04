/**
 * t573 — the 3D judge's discovery + faces sheet, pinned against synthetic
 * volumes.
 *
 * judge_3d_classes' two new pure pieces, tested bare (node 24 runs TS —
 * the t562 pattern):
 *   • discoverClassVolumes — RELION's per-class-per-iteration volume
 *     dialect (run_itNNN_classMMM.mrc): latest iteration wins, classes
 *     sort ascending, older iterations / no-tag finals / stacks / stars
 *     are decoys that must NOT leak in.
 *   • renderClass3dFacesSheet — one row per class, three orthogonal
 *     center faces per row, real PNG out the other end (width/height
 *     asserted via sharp); the 16-class ceiling and the honest nulls.
 *
 * The synthetic volume: a 24³ float32 MRC whose density is a centered
 * sphere (class 1) and uniform noise (class 2) — enough geometry for the
 * renderer to stretch, not enough to care about.
 *
 * Usage: node scripts/t573-judge3d-test.mjs
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { discoverClassVolumes } from "../src/lib/ai/class3d-volumes.ts";
import { renderClass3dFacesSheet } from "../src/lib/mrc.ts";

let pass = 0, fail = 0;
const check = (name, ok, evidence) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${evidence != null ? ` — ${evidence}` : ""}`);
  if (ok) pass++; else fail++;
};

/** a minimal MRC2014 volume: 1024-byte header + nx*ny*nz float32 voxels */
function writeMrcVolume(file, nx, ny, nz, density) {
  const header = Buffer.alloc(1024, 0);
  header.writeInt32LE(nx, 0);
  header.writeInt32LE(ny, 4);
  header.writeInt32LE(nz, 8);
  header.writeInt32LE(2, 12); // mode 2 = float32
  header.writeInt32LE(0, 16); header.writeInt32LE(0, 20); header.writeInt32LE(0, 24); // start
  header.writeFloatLE(nx, 40); header.writeFloatLE(ny, 44); header.writeFloatLE(nz, 48); // cella
  header.writeInt32LE(1, 56); header.writeInt32LE(2, 60); header.writeInt32LE(3, 64); // mapc/mapr/maps
  header.writeFloatLE(0, 76); // dmin
  header.writeFloatLE(1, 80); // dmax
  header.writeFloatLE(0, 84); // dmean
  const data = Buffer.alloc(nx * ny * nz * 4);
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++)
        data.writeFloatLE(density(x, y, z), (z * ny + y) * nx * 4 + x * 4);
  writeFileSync(file, Buffer.concat([header, data]));
}

const N = 24;
const cx = (N - 1) / 2;
// class 1 — a centered sphere r=7 (a coherent "molecule" every face sees)
const sphere = (x, y, z) => (Math.hypot(x - cx, y - cx, z - cx) <= 7 ? 1 : 0.02);
// class 2 — uniform speckle (the noise cube the rubric rejects)
let seed = 42;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 0.9 + 0.05;
};

const tmp = mkdtempSync(join(tmpdir(), "t573-"));
try {
  const workdir = join(tmp, "class3d_xxxx8765");
  mkdirSync(workdir, { recursive: true });
  writeMrcVolume(join(workdir, "run_it007_class001.mrc"), N, N, N, sphere);
  writeMrcVolume(join(workdir, "run_it007_class002.mrc"), N, N, N, noise);
  // decoys that must never leak into the discovery
  writeMrcVolume(join(workdir, "run_it006_class001.mrc"), N, N, N, noise); // older iteration
  writeMrcVolume(join(workdir, "run_it006_class002.mrc"), N, N, N, noise);
  writeMrcVolume(join(workdir, "run_class001.mrc"), N, N, N, noise); // no-tag final
  writeFileSync(join(workdir, "run_it007_classes.mrcs"), "not a real stack"); // stack dialect
  writeFileSync(join(workdir, "run_it007_data.star"), "data_\n\nloop_\n_rlnClassNumber\n1\n"); // data star

  console.log(`\n[discovery] discoverClassVolumes`);
  const found = discoverClassVolumes(workdir);
  check("latest iteration wins", found.iteration === 7, `iteration ${found.iteration}`);
  check("class order ascending, count exact", found.volumes.length === 2 && found.volumes[0].cls === 1 && found.volumes[1].cls === 2, found.volumes.map((v) => v.cls).join(","));
  check("older iteration + no-tag final excluded", found.volumes.every((v) => v.file.includes("it007")), found.volumes.map((v) => v.file.split(/[\\/]/).pop()).join(" "));
  const missing = discoverClassVolumes(join(tmp, "no-such-dir"));
  check("unreadable dir → honest empty", missing.iteration === null && missing.volumes.length === 0, "null/[]");

  console.log(`\n[sheet] renderClass3dFacesSheet`);
  const sheet = await renderClass3dFacesSheet(found.volumes.map((v) => ({ cls: v.cls, file: v.file })));
  check("sheet renders from real volumes", sheet !== null && sheet.rendered === 2 && sheet.total === 2, sheet ? `${sheet.rendered}/${sheet.total}` : "null");
  if (sheet) {
    const meta = await sharp(sheet.png).metadata();
    // cell = min(128, 24) = 24; gw = 3*24 + 4*2 = 80; gh = 2*24 + 3*2 = 54
    check("geometry: 3 face columns × N class rows", meta.width === 80 && meta.height === 54, `${meta.width}×${meta.height}`);
  }
  const capped = await renderClass3dFacesSheet(
    Array.from({ length: 20 }, (_, i) => ({ cls: i + 1, file: join(workdir, "run_it007_class001.mrc") }))
  );
  check("16-class ceiling holds (total stays honest)", capped !== null && capped.rendered === 16 && capped.total === 20, capped ? `${capped.rendered}/${capped.total}` : "null");
  const empty = await renderClass3dFacesSheet([]);
  check("empty entries → null", empty === null, "null");
  const broken = await renderClass3dFacesSheet([{ cls: 1, file: join(tmp, "garbage.mrc") }]);
  check("unreadable header → null", broken === null, "null");

  // the faces must actually differ: the sphere's row carries a bright disc
  // in every column; the noise row's columns are flat speckle. Contrast per
  // cell (stdev of the gray channel) separates them — the sheet's whole point.
  if (sheet) {
    const { data, info } = await sharp(sheet.png).raw().toBuffer({ resolveWithObject: true });
    // sharp may hand the grayscale PNG back as 3-channel sRGB — stride by
    // info.channels so every read lands on the pixel's own first channel
    // (R=G=B for a gray PNG, so channel 0 IS the gray value)
    const cell = 24, gap = 2;
    const cellStd = (row, col) => {
      const vals = [];
      for (let y = 0; y < cell; y++)
        for (let x = 0; x < cell; x++) {
          const px = gap + col * (cell + gap) + x, py = gap + row * (cell + gap) + y;
          vals.push(data[(py * info.width + px) * info.channels]);
        }
      const m = vals.reduce((a, b) => a + b, 0) / vals.length;
      return Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
    };
    const sphereRow = [cellStd(0, 0), cellStd(0, 1), cellStd(0, 2)];
    const noiseRow = [cellStd(1, 0), cellStd(1, 1), cellStd(1, 2)];
    // a disc face is BIMODAL (black solvent + bright disc → std ≈ √(p(1−p))·255
    // with p≈0.26 → ~113); uniform speckle stretched to full range sits lower
    // (~76). "Structured" = every face of the row clears the bimodal bar;
    // the noise row stays under it and under every sphere face.
    check("sphere row: structured (bimodal) in ALL three faces", sphereRow.every((v) => v > 90), sphereRow.map((v) => v.toFixed(0)).join(" "));
    check("noise row: speckle stays under the disc's contrast", noiseRow.every((v) => v < 90) && Math.min(...sphereRow) > Math.max(...noiseRow), `${noiseRow.map((v) => v.toFixed(0)).join(" ")} < ${Math.min(...sphereRow).toFixed(0)}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
