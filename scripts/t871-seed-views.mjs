#!/usr/bin/env node
/**
 * t871 — the recycled-sandbox world's saved-view heal: the demo chain's
 * 15 nodes came back through demo-chain-resurrect.mjs, but the Saved views
 * wall reads the BookmarkSession row (per JOB), and that row died with the
 * old sandbox. The t846 gate's Face I rides the saved-view card ("Centered
 * iso view", the t844 deliberate door) — without the row the inspector
 * never arrives and M8-M12 stay red for a world reason, not an a11y one.
 *
 * The seeder is t531's own law, re-derived against the HEALED world:
 *   - the refine3d job is resolved LIVE (project by name snippet, node by
 *     type — never pinned ids),
 *   - the thumbnail is derived from the WORLD'S OWN volume bytes (the
 *     highest-iteration half1 class001 MRC on the job's disk — the real
 *     data ride law; the t531 MIP builder speaks the actual float32 body
 *     stride the file size proves),
 *   - the three view shapes are t531's canon byte-for-byte (one plain
 *     iso, one Z-slice, one front-clip — the chips have something to say),
 *   - the upsert OVERWRITES the same three views (a bookmark is a named
 *     snapshot; idempotency is the seeder's own law).
 *
 * Verify: /api/views/gallery answers 200 with the three names.
 *
 *   node scripts/t871-seed-views.mjs
 */

import { deflateSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO = process.cwd();
// t11391's tax + the t872 reconciliation — the seeder speaks THE LIVING
// WORLD, wherever .env says it is (the t869 armor, fleet-wide since the
// sibling branch's world-db-law: .env FIRST — the platform owns that file
// and the boot world rides it; Prisma's schema-relative resolution
// mirrored; the frozen pin as fallback; the world NAMED at the gate).
// The t871 form asserted a hard cryoflow.db pin — the law it guarded
// against (seeding a world nobody serves) is now guarded by riding the
// same resolution the armored dev-server.sh itself uses, so the seeder
// and the lane can never again disagree about which file is real.
process.env.DATABASE_URL = (() => {
  try {
    const m = readFileSync(path.join(REPO, ".env"), "utf8").match(/^DATABASE_URL=(.*)$/m);
    if (m) {
      let u = m[1].trim().replace(/^["']|["']$/g, "");
      if (!u.startsWith("file:")) u = "file:" + u;
      if (/^file:[^/]/.test(u)) u = "file:" + REPO + "/prisma/" + u.slice(5);
      return u;
    }
  } catch { /* absent .env — the fallback speaks */ }
  return "file:" + REPO + "/db/cryoflow.db";
})();
console.log(`  db pin: ${process.env.DATABASE_URL} (the t872 armor: .env-first, frozen fallback)`);
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const BASE = "http://localhost:3000";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

/* ---------- the t531 thumbnail family (provenance: scripts/qa-t531-old-world-seed.mjs) ---------- */
let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

/** 8-bit grayscale PNG from a w×h byte matrix (no filters — every
 *  scanline speaks filter 0; deflate does the compression). */
function grayscalePng(pixels, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = pixels[y * w + x];
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

/** Z-axis MIP of the volume body (1024-byte MRC header, float32 stride —
 *  the file size is the stride's witness: 1024 + n³·4), gamma-lifted. */
function buildVolumeMipThumb(volumeBuf, size = 64) {
  const px = Buffer.alloc(size * size);
  const amp = 100;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let m = 0;
      for (let z = 0; z < size; z++) {
        const off = 1024 + 4 * (z * size * size + y * size + x);
        if (off + 4 > volumeBuf.length) continue;
        const v = volumeBuf.readFloatLE(off);
        if (v > m) m = v;
      }
      const t = Math.max(0, Math.min(1, m / amp));
      px[y * size + x] = Math.round(255 * Math.pow(t, 0.6));
    }
  }
  return `data:image/png;base64,${grayscalePng(px, size, size).toString("base64")}`;
}

/* ---------- resolve the healed world's refine3d leg, LIVE ---------- */
const project = await db.project.findFirst({
  where: { name: { contains: "β-Galactosidase" } },
});
if (!project) {
  console.log("  FAIL: the demo project is absent — run demo-chain-resurrect.mjs first");
  process.exit(1);
}
const refine = await db.job.findFirst({
  where: { projectId: project.id, type: "refine3d" },
});
if (!refine) {
  console.log("  FAIL: no refine3d node on the demo project — the chain is incomplete");
  process.exit(1);
}
console.log(`  world: project ${project.name} · refine3d ${refine.id}`);

/* the job's own volume dir (the on-disk convention: data/relion/<project>/<type>_<suffix>/
   — the suffix is the engine's own, discovered by glob, never reconstructed) */
const volRoot = path.join(REPO, "data", "relion", project.id);
let jobDir = null;
try {
  const dirs = readdirSync(volRoot).filter((d) => d.startsWith("refine3d_"));
  if (dirs.length === 1) jobDir = path.join(volRoot, dirs[0]);
} catch {
  /* absent root — the fallback below speaks */
}
let volumePath = null;
if (jobDir) {
  try {
    const its = readdirSync(jobDir)
      .filter((f) => /^run_it\d+_half1_class001\.mrc$/.test(f))
      .sort((a, b) => Number(a.match(/run_it(\d+)/)[1]) - Number(b.match(/run_it(\d+)/)[1]));
    if (its.length > 0) volumePath = path.join(jobDir, its[its.length - 1]);
  } catch {
    /* absent dir — the volume fallback below speaks */
  }
}
must(volumePath != null, `the world's own half-map found on disk (${volumePath ? path.basename(volumePath) : "none"})`);

let thumb;
if (volumePath) {
  const { readFileSync } = await import("node:fs");
  thumb = buildVolumeMipThumb(readFileSync(volumePath));
} else {
  // no volume bytes — the row still heals, the thumb falls back to a flat
  // honest raster (never a broken URL); the gate rides the card's NAME.
  thumb = `data:image/png;base64,${grayscalePng(Buffer.alloc(64 * 64, 30), 64, 64).toString("base64")}`;
}

/* ---------- the t531 canon view shapes ---------- */
const pose = (position, radius) => ({
  mode: "camera",
  fov: 0.876,
  position,
  up: [0, 1, 0],
  target: [0.1, 0.2, 0.3],
  radius,
  radiusMax: 120,
  fog: 0,
  clipFar: 0,
  minNear: 0,
  minFar: 0,
});
const now = Date.now();
const views = [
  {
    id: "seedview1",
    name: "Centered iso view",
    ts: now - 3000,
    thumb,
    snapshot: pose([12.3, -4.5, 30.1], 52.4),
    view: { sigma: 3, sign: 1, slice: { on: false, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
  },
  {
    id: "seedview2",
    name: "Top-down slice",
    ts: now - 2000,
    thumb,
    snapshot: pose([2, 28, 6], 60),
    view: { sigma: 2, sign: 1, slice: { on: true, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
  },
  {
    id: "seedview3",
    name: "Front half clipped",
    ts: now - 1000,
    thumb,
    snapshot: pose([30, 2, 4], 55),
    view: { sigma: 1.8, sign: 1, slice: { on: false, axis: "Z", pos: 0.5 }, clip: { on: true, x: 0.5, y: 1, z: 1, invert: false } },
  },
];

await db.bookmarkSession.upsert({
  where: { jobId: refine.id },
  update: { data: JSON.stringify(views) },
  create: { jobId: refine.id, data: JSON.stringify(views) },
});
console.log("  bookmark session: 3 saved views upserted on the refine3d half-map world");

/* ---------- verify through the product's own door ---------- */
const res = await fetch(`${BASE}/api/views/gallery`, { headers: SH });
must(res.status === 200, `the gallery door speaks (${res.status})`);
if (res.status === 200) {
  const body = await res.json();
  const flat = JSON.stringify(body);
  must(flat.includes("Centered iso view") && flat.includes("Top-down slice") && flat.includes("Front half clipped"),
    "the gallery reads the three healed views");
}

await db.$disconnect();
console.log(fail === 0 ? "T871 VIEWS SEEDED" : `T871 VIEWS: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
