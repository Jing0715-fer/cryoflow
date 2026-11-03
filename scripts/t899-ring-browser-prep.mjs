#!/usr/bin/env node
/**
 * t899 — THE RING'S BROWSER LEG (prep leg, no browser).
 *
 * The t898 slow-sync witness proved the staged climb AT THE DATA SOURCE
 * (0/4 → 4/4 across ~6.3s at 1500ms/file). The browser leg's remaining
 * piece: the inspector OPEN on the running job while the climb happens —
 * the strip's 6s poll diff catches a mid-climb state and the fuchsia
 * ring (data-flash) fires in the live DOM.
 *
 * This prep leg does the API-only work BEFORE the browser becomes the
 * last resident (the discipline): arm the cat-slow-ms lever (3500ms — a
 * ~14s climb gives the 6s poll TWO mid-run landings), mint the witness
 * job type-direct (the t898 law: a linkedJobId MIRRORS the linked job's
 * type), draw the micrographs edge, and print the choreography card.
 * The run itself is fired LATER — after the browser sits on the
 * inspector's Results tab — by t899-ring-browser-fire.mjs.
 *
 * The t533 cleanup law: the lever is the only write outside the app's
 * own lanes; the fire leg disarms it and VERIFIES the disarm.
 *
 * Usage: node scripts/t899-ring-browser-prep.mjs
 */
import { writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";
const LEVER = join(ROOT, "services/mock-cluster/fs/home/cryo/.slurm/cat-slow-ms");
const SLOW_MS = 3500;
// the t898 witness's micrographs parent (the same provider leg)
const PROVIDER = "cmv3x1a040004lt89yb3fmxq7";
const STATE = join(ROOT, "shots-qa/t899-ring-browser-state.json");

const api = (method, path, body) => {
  const dataArg = body ? ` -d '${JSON.stringify(body).replace(/'/g, `'\\''`)}'` : "";
  const out = execSync(
    `curl -s -X ${method} -H "Origin: ${ORIGIN}" -H "Content-Type: application/json"${dataArg} "${BASE}${path}"`,
    { encoding: "utf8", cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }
  );
  try { return JSON.parse(out); } catch { return { raw: out.slice(0, 200) }; }
};

console.log("t899 ring browser leg — prep (API only, browser stays cold)\n");

/* 0 — the provider must still exist (the world was re-seeded before; the
 * t898 receipt's provider is this window's provider leg too) */
const roster = api("GET", "/api/jobs");
const jobs = roster?.jobs ?? roster ?? [];
const provider = Array.isArray(jobs) ? jobs.find((j) => j.id === PROVIDER) : null;
console.log(`  roster: ${Array.isArray(jobs) ? jobs.length : "?"} jobs; provider ${PROVIDER} -> ${provider ? provider.type : "MISSING"}`);
if (!provider) {
  console.log("  provider missing — aborting (no lever armed, no job minted)");
  process.exit(1);
}

/* 1 — arm the lever (wx: fail if one is already armed — a stale lever
 * would lie about this window's throttle) */
if (existsSync(LEVER)) {
  console.log("  ✗ a cat-slow-ms lever ALREADY exists — refusing to double-arm; aborting");
  process.exit(1);
}
writeFileSync(LEVER, `${SLOW_MS} topazdenoise\n`, { flag: "wx" });
console.log(`  1 the lever armed: ${SLOW_MS}ms on any topazdenoise cat (a ~14s climb)`);

/* 2 — mint the job type-direct, no linkedJobId (the t898 law) */
let job = null;
try {
  job = api("POST", "/api/jobs", {
    type: "topazdenoise",
    name: "t899 ring browser witness",
    params: { topazDownscale: -1, topazWorkers: 1, topazArgs: "" },
  });
} catch (e) {
  console.log(`  ✗ mint failed: ${String(e).slice(0, 160)}`);
}
const jobId = job?.id ?? job?.job?.id ?? null;
if (!jobId) {
  // the lever does not outlive a failed prep
  execSync(`rm -f '${LEVER}'`);
  console.log("  ✗ mint failed — lever disarmed, aborting");
  process.exit(1);
}
console.log(`  2 the job minted: ${jobId}`);

/* 3 — the pipeline edge (micrographs → the new denoise) */
let edge = null;
try {
  edge = api("POST", "/api/edges", {
    fromJobId: PROVIDER,
    toJobId: jobId,
    fromPort: "micrographs",
    toPort: "micrographs",
  });
} catch { edge = null; }
console.log(`  3 the edge drawn: ${edge && !edge.error ? "yes" : `NO — ${JSON.stringify(edge).slice(0, 120)}`}`);
if (!edge || edge.error) {
  execSync(`rm -f '${LEVER}'`);
  console.log("  edge failed — lever disarmed, aborting");
  process.exit(1);
}

writeFileSync(
  STATE,
  JSON.stringify({ jobId, PROVIDER, SLOW_MS, armed: true, at: new Date().toISOString() }, null, 2) + "\n"
);
console.log(`\n  state -> ${STATE}`);
console.log(`
  CHOREOGRAPHY (the browser is the LAST resident):
    1. agent-browser open http://localhost:3000/
    2. click the card:  [data-card-btn="${jobId}"]
    3. click the Results tab  (role=tab "Results")
    4. node scripts/t899-ring-browser-fire.mjs
       (fires the run, samples the DOM at 1.2s, disarms the lever, VERIFIES)
`);
