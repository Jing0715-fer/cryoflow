// lib smoke for readMrcSubvolume BEFORE the OOM build — logic bugs should
// cost a transpile cycle, not a build cycle
const { readMrcSubvolume } = require("/home/z/my-project/scripts/tmp-t254/lib/mrc.js");

let fail = 0;
const must = (c, l) => { console.log(c ? "  ok: " + l : "  FAIL: " + l); if (!c) fail++; };

// crop x [2,6), y [1,4), z [1,3) → 4×3×2 sub-volume, origin (2,1,1)
const r = readMrcSubvolume("/home/z/my-project/scripts/tmp-t254/parent.mrc", {
  ix0: 2, ix1: 6, iy0: 1, iy1: 4, iz0: 1, iz1: 3,
});
must(r.ok, "crop ok");
if (r.ok) {
  must(r.dims.join(",") === "4,3,2", `dims 4,3,2 (got ${r.dims.join(",")})`);
  must(r.origin.join(",") === "2,1,1", `origin 2,1,1 (got ${r.origin.join(",")})`);
  const h = r.bytes;
  must(h.readInt32LE(0) === 4 && h.readInt32LE(4) === 3 && h.readInt32LE(8) === 2, "header dims");
  must(h.readInt32LE(12) === 2, "mode preserved (float32)");
  must(h.readInt32LE(16) === 0 && h.readInt32LE(20) === 4 && h.readInt32LE(24) === 2,
    `start = parent(-2,3,1) + origin(2,1,1) = (0,4,2) (got ${h.readInt32LE(16)},${h.readInt32LE(20)},${h.readInt32LE(24)})`);
  must(h.readInt32LE(28) === 4 && h.readInt32LE(32) === 3 && h.readInt32LE(36) === 2, "mx,my,mz = dims");
  Math.abs(h.readFloatLE(40) - 4.0) < 1e-5 && Math.abs(h.readFloatLE(44) - 3.0) < 1e-5 && Math.abs(h.readFloatLE(48) - 2.0) < 1e-5
    ? must(true, "cella rescaled (8*(4/8), 6*(3/6), 4*(2/4)) = (4,3,2)")
    : must(false, "cella rescaled");
  must(h.readInt32LE(88) === 1, "ispg = 1 (volume)");
  must(h.readInt32LE(92) === 0, "nsymbt = 0");
  must(h.toString("ascii", 208, 212) === "MAP ", "MAP magic");
  // voxel values: sub(i,j,k) = parent(2+i, 1+j, 1+k) = (2+i) + 100*(1+j) + 10000*(1+k)
  let allOk = true;
  for (let k = 0; k < 2; k++)
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 4; i++) {
        const off = 1024 + ((k * 3 + j) * 4 + i) * 4;
        const got = h.readFloatLE(off);
        const want = (2 + i) + 100 * (1 + j) + 10000 * (1 + k);
        if (got !== want) { allOk = false; console.log(`    mismatch (${i},${j},${k}): got ${got} want ${want}`); }
      }
  must(allOk, "all 24 voxels bit-correct (value continuity with parent)");
  must(r.bytes.length === 1024 + 4 * 3 * 2 * 4, "file size = 1024 + voxels*4");
  // dmin/dmax truth over the crop: min at (0,0,0)=10202... wait (2+i)=2, +100*1+10000*1 = 10102; max at (3,2,1)=5+300+20000=20305
  const dmin = h.readFloatLE(76), dmax = h.readFloatLE(80);
  must(dmin === 10102 && dmax === 20305, `dmin/dmax recomputed (got ${dmin}/${dmax})`);
}

// empty box → error
const e1 = readMrcSubvolume("/home/z/my-project/scripts/tmp-t254/parent.mrc", { ix0: 5, ix1: 5, iy0: 0, iy1: 2, iz0: 0, iz1: 2 });
must(!e1.ok && e1.status === 400, `empty box 400 (got ${e1.ok ? "ok" : e1.error})`);
// out-of-range clamps to grid
const e2 = readMrcSubvolume("/home/z/my-project/scripts/tmp-t254/parent.mrc", { ix0: -5, ix1: 100, iy0: 0, iy1: 6, iz0: 0, iz1: 4 });
must(e2.ok && e2.dims.join(",") === "8,6,4", `clamped full-box crop (got ${e2.ok ? e2.dims.join(",") : e2.error})`);
// missing file
const e3 = readMrcSubvolume("/home/z/my-project/scripts/tmp-t254/nope.mrc", { ix0: 0, ix1: 1, iy0: 0, iy1: 1, iz0: 0, iz1: 1 });
must(!e3.ok && e3.status === 404, `missing file 404`);

console.log(fail === 0 ? "LIB SMOKE: ALL PASS" : `LIB SMOKE: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
