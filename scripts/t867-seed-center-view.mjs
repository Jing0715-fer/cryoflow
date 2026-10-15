#!/usr/bin/env node
/**
 * t867 seed — the canonical saved view, minted through the app's own door.
 *
 * The healed world (demo-chain-resurrect from the sandbox's fresh seed)
 * carries no camera bookmarks — the saved-view gallery reads empty, and
 * the t846 maintenance sweep's Face-I door (the "Centered iso view" card,
 * the t844 contract) has no target. The instrument owns its measurement
 * conditions (the t866 clean-room law): this seed MINTS the canonical
 * card through the SAME API the viewer's save flow speaks — PUT
 * /api/jobs/[id]/camera-bookmarks, the sanitize's own shape, zero DB
 * guessing. Idempotent: the PUT upserts the row; re-running re-mints the
 * same card.
 *
 *   node scripts/t867-seed-center-view.mjs
 */
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Content-Type": "application/json",
};

const jobs = await (async () => {
  const r = await fetch(`${BASE}/api/jobs`, { headers: { Origin: BASE, Referer: `${BASE}/` } });
  const b = await r.json();
  return b.jobs ?? b;
})();
const host = jobs.find((j) => j.type === "refine3d" && j.status === "completed");
if (!host) {
  console.error("no completed refine3d in the roster — the canonical card has no tenant");
  process.exit(1);
}
console.log(`host: ${host.name} (${host.id})`);

/* the pose: an iso-ish orbit (the "Centered" language), the honest
 * defaults the sanitize would answer anyway — spoken explicitly so the
 * card's restoration is the world's own reading, not the server's */
const bookmark = {
  id: "t867-center-iso-view",
  name: "Centered iso view",
  ts: Date.now(),
  snapshot: {
    mode: "standard",
    fov: 0.876,
    position: [1.0, 0.8, 1.2],
    up: [0, 1, 0],
    target: [0, 0, 0],
  },
  view: {
    sigma: 3,
    sign: 1,
    slice: { on: false, axis: "Z", pos: 0.5 },
    clip: { on: false, x: 1, y: 1, z: 1, invert: false },
    focus: { x: 0.5, y: 0.5, z: 0.5 },
  },
};

const put = await fetch(`${BASE}/api/jobs/${host.id}/camera-bookmarks`, {
  method: "PUT",
  headers: SH,
  body: JSON.stringify({ bookmarks: [bookmark] }),
});
if (put.status !== 200) {
  console.error(`PUT refused (HTTP ${put.status}): ${(await put.text()).slice(0, 140)}`);
  process.exit(1);
}
const check = await fetch(`${BASE}/api/jobs/${host.id}/camera-bookmarks`, {
  headers: { Origin: BASE, Referer: `${BASE}/` },
});
const body = await check.json();
const names = (body.bookmarks ?? body ?? []).map?.((b) => b.name) ?? [];
console.log(`seeded; the job now carries: ${JSON.stringify(names)}`);
console.log("gallery:", JSON.stringify(
  await (async () => {
    const r = await fetch(`${BASE}/api/views/gallery`, { headers: { Origin: BASE, Referer: `${BASE}/` } });
    const b = await r.json();
    return (b.views ?? []).map((v) => v.name ?? v.bookmark?.name ?? "?");
  })()
));
