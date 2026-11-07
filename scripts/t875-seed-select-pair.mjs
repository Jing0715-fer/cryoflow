#!/usr/bin/env node
/**
 * t875 — the compare family's pair fixture (a second `select` run), through
 * the product's own doors only (the t871 law: a fixture the app refuses is
 * not a fixture).
 *
 * WHY: the reborn world is a linear chain — one row per type — and the
 * compare family (t864's report diff, t873/t874's dialogs) needs a
 * same-type SIBLING to open. The healer's re-run door (POST /api/jobs/[id]/run)
 * bumps the SAME row's generation, so the pair must be born through the
 * creation door (POST /api/jobs, the add-a-type flow) + the spine's edge
 * door (POST /api/edges) + the run door, exactly the doors the product
 * speaks.
 *
 * The tenant: `select` — a NATIVE type (no cluster round trip, ~3s), the
 * spine's cheapest completed node. The fixture STAYS (the compare family's
 * standing door, like the iso-view card): the census floors are lower
 * bounds, the world may grow.
 *
 * IDEMPOTENT: the pair is present-and-completed → exit 0, no writes.
 *
 * Usage: node scripts/t875-seed-select-pair.mjs
 */
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";

function curl(method, path, body) {
  const payload = body === undefined ? "" : `-H 'Content-Type: application/json' -d '${JSON.stringify(body).replace(/'/g, `'\\''`)}'`;
  const out = execSync(`curl -s -X ${method} -H 'Origin: ${BASE}' ${payload} '${BASE}${path}'`, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  return out ? JSON.parse(out) : {};
}

let must = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? "ok" : "FAIL"}: ${msg}`); if (!cond) must++; };
const sleep = (ms) => execSync(`sleep ${ms / 1000}`);

/* 1. the roster read */
const jobsBody = curl("GET", "/api/jobs");
const jobs = jobsBody.jobs ?? [];
const selects = jobs.filter((j) => j.type === "select");
ok(jobs.length >= 15, `the roster speaks (${jobs.length} jobs)`);

const doneSelects = selects.filter((j) => j.status === "completed");
if (doneSelects.length >= 2) {
  ok(true, `the pair already stands (${doneSelects.length} completed select rows) — no write`);
  process.exit(must ? 1 : 0);
}

/* 2. the creation door */
const mk = curl("POST", "/api/jobs", { type: "select", name: "Select (compare-pair fixture)" });
const created = mk.job ?? mk;
ok(mk.status === undefined || !!created.id, `the select twin created (${created.id ? created.id.slice(0, 8) : JSON.stringify(mk).slice(0, 80)})`);
if (!created.id) process.exit(1);

/* 3. the edge door — the twin drinks the same upstream (select2d's output) */
const source = jobs.find((j) => j.type === "select2d");
const edgesBody = curl("GET", "/api/edges");
const edgeSet = new Set((edgesBody.edges ?? []).map((e) => `${e.fromJobId}>${e.toJobId}`));
if (source && !edgeSet.has(`${source.id}>${created.id}`)) {
  const e = curl("POST", "/api/edges", { fromJobId: source.id, toJobId: created.id });
  ok(!!e.edge?.id || e.id || e.fromJobId, `the edge wired (select2d → the twin)`);
}

/* 4. the run door + the poll */
const run = curl("POST", `/api/jobs/${created.id}/run`, {});
ok(!run.error, `the run door spoke (${run.error ? run.error : run.waiting ? "waiting" : "started"})`);
let done = null;
for (let i = 0; i < 40; i++) {
  sleep(3000);
  const poll = (curl("GET", "/api/jobs").jobs ?? []).find((j) => j.id === created.id);
  if (poll && (poll.status === "completed" || poll.status === "failed")) { done = poll; break; }
}
ok(!!done, done ? `the twin reached ${done.status} (${done.status === "completed" ? "the pair stands" : "the run failed honestly"})` : "the poll timed out");
if (done && done.status !== "completed") process.exit(1);

console.log(must ? `T875 SELECT PAIR: ${must} FAIL` : "T875 SELECT PAIR: green");
process.exit(must ? 1 : 0);
