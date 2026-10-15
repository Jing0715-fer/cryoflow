#!/usr/bin/env node
/**
 * t1020 stop-walk SWEEP — the walk leg's residue, swept after the ride.
 *
 * The t681 pattern's closing face: the twin deleted (the arc's own
 * victim), the fixture removed (the breathing fuel), the workdir
 * removed, the world gate FATALs on leftovers (22 jobs / 14 edges /
 * the DB's standing byte size). The walk's birth and death both on the
 * record — the ride plane left clean.
 */
import { readFileSync, writeFileSync, rmSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", Origin: BASE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* the 404 HTML */ }
  return { status: res.status, json, text };
}
const jobsArr = (b) => (Array.isArray(b) ? b : b?.jobs ?? []);

const seat = JSON.parse(readFileSync(path.join(ROOT, "shots-qa/.t1020-walk-seat.json"), "utf8"));
const twinId = seat.twinId;
console.log(`seat: twin ${twinId} ("${seat.twinName}")`);

/* ---------- the twin's deletion (the API's own delete door) ---------- */
const del = await api("DELETE", `/api/jobs/${twinId}`);
console.log(`delete answered ${del.status}`, del.json?.ok === true ? "(ok)" : del.text.slice(0, 120));
if (del.status !== 200) {
  // a second patience — the delete door retries honestly once
  await sleep(2000);
  const del2 = await api("DELETE", `/api/jobs/${twinId}`);
  console.log(`delete retry answered ${del2.status}`);
  if (del2.status !== 200) { console.error("FATAL: the twin would not leave"); process.exit(1); }
}

/* ---------- the fixture + the workdir ---------- */
const FIX = path.join(ROOT, "data/t1020-fixture");
rmSync(FIX, { force: true, recursive: true });
console.log("fixture swept:", !existsSync(FIX));
const workdir = path.join(ROOT, "data/relion", seat.projectId, `import_${twinId.slice(-8)}`);
rmSync(workdir, { force: true, recursive: true });
console.log("workdir swept:", !existsSync(workdir));
// the seat note leaves WITH the ride (no dangling pointers)
rmSync(path.join(ROOT, "shots-qa/.t1020-walk-seat.json"), { force: true });

/* ---------- the world gate ---------- */
let world = null;
for (let i = 0; i < 10 && !world; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) world = jobsArr(r.json);
  } catch { /* the beat */ }
}
if (!world) { console.error("FATAL: the server never answered"); process.exit(2); }
const jobs = world.length;
let edges = -1;
try {
  // the edge count rides the project's own API face
  const er = await api("GET", `/api/projects/${seat.projectId}/edges`);
  if (er.status === 200) edges = (Array.isArray(er.json) ? er.json : er.json?.edges ?? []).length;
} catch { /* the face may differ; the byte gate below decides */ }
const dbBytes = statSync(path.join(ROOT, "db/cryoflow.db")).size;
console.log(`world: jobs ${jobs} (want 22) · edges ${edges >= 0 ? edges : "n/a"} · db ${dbBytes} bytes (want 155648)`);
if (jobs !== 22 || (edges >= 0 && edges !== 14) || dbBytes !== 155648) {
  console.error("FATAL: the world gate — leftovers detected");
  process.exit(1);
}
console.log("WORLD RESTORED — the walk's plane is clean");
