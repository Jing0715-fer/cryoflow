#!/usr/bin/env node
/**
 * t875 — the census fixture's reborn-world re-seed (the t871 recipe, third verse).
 *
 * The recycle took the healed world AND its standing fixture: the
 * "Centered iso view" saved-view card (the inspector's deliberate door,
 * t844's) died with the bookmarks. This seed restores it THROUGH THE
 * APP'S OWN DOOR (the camera-bookmarks route's whitelist — the t871
 * lesson: a fixture the app refuses to render is not a fixture), on the
 * census's canonical tenant (the refine3d job — M9's heading names it).
 *
 * The wrapper shape is `{bookmarks:[…]]}` — the t871 first try taught
 * it (`count:0`, the strict whitelist at work; a bare array is not the
 * door's tongue). The payload: a whitelisted iso snapshot (position
 * [0.577,0.577,0.577], up [0,1,0], target [0,0,0] — the three vec3s ARE
 * the pose, the route's own law) with the half view at σ 2.
 *
 * IDEMPOTENT: reads the tenant's bookmarks first; the fixture is
 * present-and-named → exit 0 with no write. Absent → merged in (any
 * other user bookmarks ride along untouched).
 *
 * Usage: node scripts/t875-seed-iso-fixture.mjs
 */
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const FIXTURE_NAME = "Centered iso view";

/* execSync with args array is not a thing — build the command shell-safe. */
function curl(method, path, body) {
  const payload = body === undefined ? "" : `-H 'Content-Type: application/json' -d '${JSON.stringify(body).replace(/'/g, `'\\''`)}'`;
  const out = execSync(`curl -s -X ${method} -H 'Origin: ${BASE}' ${payload} '${BASE}${path}'`, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(out || "{}");
}

let must = 0;
function ok(cond, msg) {
  console.log(`  ${cond ? "ok" : "FAIL"}: ${msg}`);
  if (!cond) must++;
}

/* 1. the tenant: the refine3d job, by heading-name through the jobs door */
const jobsBody = curl("GET", "/api/jobs");
const jobs = jobsBody.jobs ?? jobsBody ?? [];
const tenant = jobs.find((j) => /3D Refine \(tutorial\)/.test(j.name ?? ""));
ok(!!tenant, `the census tenant found ("${tenant?.name ?? "none"}")`);
if (!tenant) process.exit(1);
const jobId = tenant.id;

/* 2. the fixture's current absence (idempotency read) */
const cur = curl("GET", `/api/jobs/${jobId}/camera-bookmarks`);
const existing = cur.bookmarks ?? [];
const already = existing.find((b) => b.name === FIXTURE_NAME);
if (already) {
  ok(true, `fixture already standing ("${already.name}", id ${String(already.id).slice(0, 8)}) — no write`);
  process.exit(must ? 1 : 0);
}

/* 3. the seed — the t871 payload, through the wrapper */
const fixture = {
  id: "census-iso-view-t875",
  name: FIXTURE_NAME,
  ts: Date.now(),
  snapshot: {
    mode: "iso",
    fov: 0.876,
    position: [0.577, 0.577, 0.577],
    up: [0, 1, 0],
    target: [0, 0, 0],
    radius: 10,
    radiusMax: 1e4,
    fog: 0,
    clipFar: 0,
    minNear: 0,
    minFar: 0,
  },
  view: {
    sigma: 2,
    sign: -1,
    slice: { on: false, axis: "x", pos: 0.5 },
    clip: { on: false, x: 1, y: 1, z: 1, invert: false },
  },
};
const merged = [...existing, fixture];
const put = curl("PUT", `/api/jobs/${jobId}/camera-bookmarks`, { bookmarks: merged });
/* the PUT's tongue is {ok, count} — not the row echo (the door's own
   honest count is the receipt; the row itself is witnessed by the
   read-back below) */
ok(put.ok === true && (put.count ?? 0) >= 1,
  `the door spoke the write ({ok:${put.ok}, count:${put.count}})`);

/* 4. the read-back witness */
const verify = curl("GET", `/api/jobs/${jobId}/camera-bookmarks`);
ok((verify.bookmarks ?? []).some((b) => b.name === FIXTURE_NAME), "read-back witness: the door holds the fixture");

console.log(must ? `T875 ISO FIXTURE: ${must} FAIL` : "T875 ISO FIXTURE: green");
process.exit(must ? 1 : 0);
