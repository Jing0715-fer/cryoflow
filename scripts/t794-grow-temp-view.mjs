#!/usr/bin/env node
/**
 * t794 — grow ONE temporary saved view on the canon job (3D auto-refine),
 * so the wall delete-relay can be exercised live WITHOUT touching any of
 * the three canon poses. The DELETE of this temp view (by the patrol
 * finger, through the wall's own mouth) restores net-zero by itself.
 *
 * Read fresh → append → PUT (the same read-modify-write contract the
 * wall's deleteView speaks). Origin header per the t709 door dialect.
 */
const BASE = "http://localhost:3000";
const JOB = "cmuwipe635000refine3d";
const H = { "Content-Type": "application/json", Origin: BASE };

const r = await fetch(`${BASE}/api/jobs/${JOB}/camera-bookmarks`, { headers: { Origin: BASE } });
if (!r.ok) throw new Error(`read ${r.status}`);
const j = await r.json();
const list = j.bookmarks ?? [];
const canonNames = list.map((b) => b.name);
console.log("BEFORE:", JSON.stringify(canonNames));

if (list.some((b) => b.id === "t794-relay-temp")) {
  console.log("temp already aboard — no-op");
  process.exit(0);
}

const temp = {
  id: "t794-relay-temp",
  name: "t794 relay temp",
  ts: Date.now(),
  snapshot: {
    mode: "orientation",
    fov: 0.876,
    position: [12, 8, 10],
    up: [0, 1, 0],
    target: [0, 0, 0],
    radius: 10,
    radiusMax: 100,
    fog: 0,
    clipFar: 0,
    minNear: 0,
    minFar: 0,
  },
};

const w = await fetch(`${BASE}/api/jobs/${JOB}/camera-bookmarks`, {
  method: "PUT",
  headers: H,
  body: JSON.stringify({ bookmarks: [...list, temp] }),
});
if (!w.ok) throw new Error(`write ${w.status}`);
const v = await fetch(`${BASE}/api/jobs/${JOB}/camera-bookmarks`, { headers: { Origin: BASE } });
const after = (await v.json()).bookmarks ?? [];
console.log("AFTER:", JSON.stringify(after.map((b) => b.name)));
if (after.length !== list.length + 1) throw new Error("temp did not land");
console.log("GROWN: 4 aboard, canon verbatim =", JSON.stringify(after.slice(0, 3).map((b) => b.name)));
