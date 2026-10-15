#!/usr/bin/env node
/**
 * t1020 stop-walk LAY — the walk leg's seat, laid before the page.
 *
 * The t681 pattern's t1020 edition: the fixture (40k tiny mrcs — the
 * breathing fuel, the t1015 law) + ONE minted twin (idle — the RUN door
 * is part of the walk: the inspector's Run confirm starts it through
 * the REAL dialog, then the Stop door is walked on camera). The twin is
 * minted via the API (the drill's seat-laying face — the WALK is the
 * inspector's doors, not the mint), found BY NAME, and swept by the
 * sibling sweep script after the ride.
 *
 * The world gate FATALs on a non-22/14 world (the t1017 drill law) —
 * the arc's victims are the arc's own twins, nothing else moves.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const FIX = path.join(ROOT, "data/t1020-fixture");
const TWIN_NAME = "Import Stop Walk Leg";
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

async function apiRetry(method, url, body, tries = 4) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await sleep(2500);
    try {
      const r = await api(method, url, body);
      if (r.status > 0) return r;
      last = r;
    } catch (e) { last = { status: 0, json: null, text: String(e) }; }
  }
  return last;
}

/** the storm laws (the t1015 edition): two consecutive healthy frames
 *  after the fixture's 40k writes — the watcher's churn rides out. */
async function settleAfterStorm() {
  let consecutive = 0;
  for (let i = 0; i < 60 && consecutive < 2; i++) {
    try {
      const r = await fetch(BASE + "/api/jobs", { headers: { Origin: BASE } });
      await r.text();
      consecutive = r.status === 200 ? consecutive + 1 : 0;
    } catch { consecutive = 0; }
    await sleep(1500);
  }
  return consecutive >= 2;
}

/* ---------- the world gate (as-found) ---------- */
let world = null;
for (let i = 0; i < 10 && !world; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) world = jobsArr(r.json);
  } catch { /* the warmup */ }
}
if (!world) { console.error("FATAL: the server never answered 200"); process.exit(2); }
const before = { jobs: world.length };
const project = world[0]?.projectId ?? null;
if (!project) { console.error("FATAL: no project id in the world"); process.exit(2); }
if (before.jobs !== 22) {
  console.error(`FATAL: world gate — jobs ${before.jobs} (want 22)`);
  process.exit(1);
}
console.log(`world: ${before.jobs} jobs as-found (project ${project})`);

/* ---------- the fixture (the breathing fuel) ---------- */
console.log("fixture — the breathing fuel:");
rmSync(FIX, { force: true, recursive: true });
mkdirSync(FIX, { recursive: true });
const buf = Buffer.alloc(1024);
for (let i = 0; i < 40000; i++) {
  writeFileSync(path.join(FIX, `fake_movie_${String(i).padStart(6, "0")}.mrc`), buf);
}
if (!existsSync(path.join(FIX, "fake_movie_039999.mrc"))) {
  console.error("FATAL: the fixture did not stand");
  process.exit(1);
}
console.log("  40k tiny mrcs stand at data/t1020-fixture");

/* ---------- the settle (the storm laws) ---------- */
const settled = await settleAfterStorm();
if (!settled) { console.error("FATAL: the watcher storm never settled"); process.exit(1); }
console.log("  the storm settled (two consecutive healthy frames)");

/* ---------- the mint (idle — the RUN door is the walk's first step) ---------- */
const template = world.find((j) => j.name === "Import Movies 1");
if (!template) { console.error("FATAL: the template (Import Movies 1) not found"); process.exit(1); }
const params = { ...(template.params ?? {}), micrographsPath: FIX };
const mint = await apiRetry("POST", "/api/jobs", {
  type: "import", name: TWIN_NAME, workspaceId: template.workspaceId,
  x: 1080, y: 460, params,
});
const twin = mint?.json?.job ?? null;
if (!twin) {
  console.error(`FATAL: the twin mint failed — status=${mint?.status} ${String(mint?.text ?? "").slice(0, 120)}`);
  process.exit(1);
}
console.log(`twin minted idle: ${twin.id} ("${TWIN_NAME}", the run door's victim — the arc's own)`);

/* ---------- the as-left note for the sweep ---------- */
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(path.join(ROOT, "shots-qa/.t1020-walk-seat.json"), JSON.stringify({
  twinId: twin.id, twinName: TWIN_NAME, fixture: "data/t1020-fixture",
  projectId: project, laidAt: new Date().toISOString(),
}, null, 2));
console.log("seat noted to shots-qa/.t1020-walk-seat.json — the walk leg may open the page");
