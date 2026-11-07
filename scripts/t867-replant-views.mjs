#!/usr/bin/env node
/**
 * t867 — the saved-view seeds' RE-PLANTER (the t671 setup, extracted and
 * made world-agnostic). The sandbox restore wiped the camera-bookmark
 * rows; the dashboard's saved-views wall went dark, the t844 deliberate
 * door ("Centered iso view") lost its card, and t846's Face I could not
 * open the inspector. The cure rides the product's OWN door: PUT the
 * three seed views to the REFINE3D job's camera-bookmarks endpoint —
 * the job RESOLVED FROM THE ROSTER BY TYPE (measured never pinned; the
 * t671 original hard-pinned a pre-restore id).
 *
 *   node scripts/t867-replant-views.mjs
 */
import { deflateSync } from "node:zlib";

const BASE = "http://localhost:3000";

/* ---------- resolve the refine3d host from the roster (never pinned) ---------- */
const jobs = await fetch(`${BASE}/api/jobs`, { headers: { Origin: BASE } })
  .then((r) => r.json())
  .then((b) => b.jobs ?? b);
const host = jobs.find((j) => j.type === "refine3d" && j.status === "completed");
if (!host) {
  console.error("no completed refine3d in the roster — the wall cannot be planted; stop honestly");
  process.exit(1);
}
console.log(`host (measured, not pinned): ${host.name} (${host.id})`);

/* ---------- the seed shape (the t671 law verbatim: seats AND thumbs) ---------- */
const pngChunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(t671crc(body) >>> 0);
  return Buffer.concat([len, body, crc]);
};
function t671crc(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return crc ^ 0xffffffff;
}
const grayscalePng = (pixels, w, h) => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    for (let x = 0; x < w; x++) raw[y * w + x + 1] = pixels[y * w + x];
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
};
const seedThumb = (base) =>
  `data:image/png;base64,${grayscalePng(
    Buffer.from(Array.from({ length: 64 }, (_, i) => Math.min(255, base + i * 3))),
    8,
    8
  ).toString("base64")}`;
const mkSeed = (id, name, i) => ({
  id,
  name,
  ts: Date.now() - (3 - i) * 1000,
  thumb: seedThumb(40 + i * 60),
  snapshot: { mode: "iso", fov: 0.876, position: [42.7, 38.1, 95.3], up: [0, 1, 0], target: [0, 0, 0], radius: 63.2, radiusMax: 110.4, fog: 0, clipFar: 0, minNear: 0, minFar: 0 },
  view: { sigma: 2.5, sign: 1, slice: { on: true, axis: "Z", pos: 0.35 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
});
const seeds = ["seedview1", "seedview2", "seedview3"].map((id, i) =>
  mkSeed(id, ["Centered iso view", "Top-down slice", "Front half clipped"][i], i)
);

/* ---------- the PUT through the product's own door ---------- */
const cur = await fetch(`${BASE}/api/jobs/${host.id}/camera-bookmarks`, { headers: { Origin: BASE } })
  .then((r) => r.json())
  .then((j) => j.bookmarks ?? []);
const w = await fetch(`${BASE}/api/jobs/${host.id}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: seeds }),
});
if (!w.ok) {
  console.error(`setup PUT failed: ${w.status} — stop honestly`);
  process.exit(1);
}
const after = await fetch(`${BASE}/api/jobs/${host.id}/camera-bookmarks`, { headers: { Origin: BASE } })
  .then((r) => r.json())
  .then((j) => j.bookmarks ?? []);
const clean = after.length === 3 &&
  ["seedview1", "seedview2", "seedview3"].every((id) => after.some((x) => x.id === id && (x.thumb ?? "").startsWith("data:image")));
console.log(`planted: ${after.length} seats (was ${cur.length}) — ${clean ? "CLEAN (three seeds, thumbs aboard)" : "NOT CLEAN — stop honestly"}`);
process.exit(clean ? 0 : 2);
