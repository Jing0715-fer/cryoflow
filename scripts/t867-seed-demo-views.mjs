#!/usr/bin/env node
/**
 * t867 — the demo saved-views seeder: the fresh world's lost shelf, restored
 * through the product's OWN door.
 *
 * Why: the sandbox restore wiped the untracked dev DB; the roster was
 * resurrected by demo-chain-resurrect (the 15-node chain), but the
 * BookmarkSession shelf did not survive — the dashboard's Saved-views wall
 * is empty, and two census doors went dark with it:
 *   - t846 M8 ("the saved-view card found and clicked") clicks the wall
 *     card whose text starts with "Centered iso view" — the deliberate
 *     door (t844's) into the 3D Refine inspector;
 *   - t846 M7/M12/M16's floors were pinned in a world whose dashboard
 *     carried the wall's cards.
 * The canonical trio comes verbatim from qa-t531-old-world-seed's
 * buildSeedBookmarks (the proven-against-restore shape, qa48's own save
 * family): one plain iso view, one Z-slice, one front-clip — the chips
 * get something to say. The thumb is honestly absent (the wall card
 * renders its fallback; the door is the TEXT, and a MIP renderer has no
 * business living in a seeder).
 *
 * The write rides the app's own PUT /api/jobs/[id]/camera-bookmarks —
 * the strict whitelist IS the shape test: if the API accepts it, the
 * world can render it. Idempotent: the PUT replaces the row's array.
 *
 *   node scripts/t867-seed-demo-views.mjs
 */

const BASE = "http://localhost:3000";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};

const must = (cond, label, detail = "") =>
  console.log(`${cond ? "  ok" : "  FAIL"}: ${label}${detail ? `  ${detail}` : ""}`) || (!cond && process.exit(1));

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
const BOOKMARKS = [
  {
    id: "seedview1",
    name: "Centered iso view",
    ts: now - 3000,
    snapshot: pose([12.3, -4.5, 30.1], 52.4),
    view: { sigma: 3, sign: 1, slice: { on: false, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
  },
  {
    id: "seedview2",
    name: "Top-down slice",
    ts: now - 2000,
    snapshot: pose([2, 28, 6], 60),
    view: { sigma: 2, sign: 1, slice: { on: true, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
  },
  {
    id: "seedview3",
    name: "Front half clipped",
    ts: now - 1000,
    snapshot: pose([30, 2, 4], 55),
    view: { sigma: 1.8, sign: 1, slice: { on: false, axis: "Z", pos: 0.5 }, clip: { on: true, x: 0.5, y: 1, z: 1, invert: false } },
  },
];

/* the host: the refine3d half-map world, resolved from the roster (measured
 * never pinned — the healer's chain node, "3D Refine (tutorial)") */
const jobs = (await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json()).jobs ?? [];
const refine = jobs.find((j) => j.type === "refine3d" && j.status === "completed");
must(!!refine, `the refine3d host resolved (${refine ? refine.name : "none of " + jobs.length})`);

const put = await fetch(`${BASE}/api/jobs/${refine.id}/camera-bookmarks`, {
  method: "PUT",
  headers: SH,
  body: JSON.stringify({ bookmarks: BOOKMARKS }),
});
must(put.status === 200 || put.status === 201, `the shelf PUT through the product's door (${put.status})`, await put.text().then((t) => t.slice(0, 120)));

/* the read-back: the gallery aggregate must speak the trio */
const gal = await (await fetch(`${BASE}/api/views/gallery`, { headers: SH })).json();
const views = gal.views ?? [];
const names = views.flatMap((v) => (v.bookmarks ?? []).map((b) => b.name));
must(
  ["Centered iso view", "Top-down slice", "Front half clipped"].every((n) => names.includes(n)),
  `the gallery wall speaks the trio (${names.join(" · ") || "none"})`,
  `host job: ${views[0]?.jobName ?? "?"}`
);
console.log("DEMO SAVED VIEWS SEEDED");
