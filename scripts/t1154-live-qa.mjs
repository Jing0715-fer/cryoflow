#!/usr/bin/env node
/**
 * t1154 — the LIVE QA ride for the progress-scale cure: one real
 * select2d re-run lights a RUNNING row in the recent-activity feed,
 * and t181-e2e (the feed's own canary) verifies the painted word
 * against the wire's oracle WHILE the father's faces are live.
 *
 * The t181-e2e canary needs a live running row (`must(!!liveRow)`),
 * and the world is 15/15 completed — so the ride mints the window the
 * honest way: POST the run, wait for the running face, ride the
 * canary inside it, then let the mock settle and verify the world.
 * OOM/dialog law: no dialog is open; the canary opens the dashboard
 * (the feed page), never the inspector; the dev server runs capped.
 *
 * node scripts/t1154-live-qa.mjs
 */
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";
const SELECT2D = "cmvz6i903000gn9swq2qr2pl7"; // "2D Classification (tutorial)" — the world's SLOWEST re-runnable (~4.6 min of mock iterations), a running window wide enough for the paint locator to ride
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass += 1; console.log(`  ok ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`); }
};
const get = async (path) => (await fetch(BASE + path, { headers: { Origin: ORIGIN } })).json();

async function statusOf(id) {
  const d = await get("/api/jobs");
  const js = Array.isArray(d) ? d : d.jobs ?? [];
  return js.find((j) => j.id === id);
}

/* C0 — preflight: the seat job exists and is settled */
console.log("C0 — preflight");
let job = await statusOf(SELECT2D);
ok("the select2d row exists", !!job, JSON.stringify(job ?? {}).slice(0, 120));
ok("the row is settled (completed)", job?.status === "completed", job?.status);

/* C1 — light the running face */
console.log("C1 — POST the run");
const runRes = await fetch(`${BASE}/api/jobs/${SELECT2D}/run`, {
  method: "POST",
  headers: { Origin: ORIGIN, "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
ok("run door answered 2xx", runRes.ok, `status ${runRes.status}`);

let lit = false;
for (let i = 0; i < 40 && !lit; i++) {
  await sleep(500);
  job = await statusOf(SELECT2D);
  lit = job?.status === "running";
  if (job?.status === "completed" && i > 4) break; // sub-200ms law: it may have finished between polls
}
console.log(`  the row's face after the poll: ${job?.status}`);
if (!lit && job?.status === "completed") {
  console.log("  (the mock finished inside the poll gap — the canary still rides the feed's frame checks)");
}

/* C2 — the feed's canary rides the live window */
console.log("C2 — t181-e2e (the feed's own canary)");
let canary = { status: 0, out: "" };
try {
  canary.out = execFileSync("node", ["scripts/t181-e2e.mjs"], {
    cwd: "/home/z/my-project",
    encoding: "utf8",
    timeout: 240_000,
  });
  canary.status = 0;
} catch (e) {
  canary.status = e.status ?? 1;
  canary.out = (e.stdout ?? "") + (e.stderr ?? "");
}
const tail = canary.out.trim().split("\n").slice(-6).join("\n");
console.log(tail.split("\n").map((l) => "    " + l).join("\n"));
ok("the feed canary is green on the live wire", canary.status === 0, `exit ${canary.status}`);

/* C3 — settle: the run completes, the receipt returns */
console.log("C3 — settle + receipt");
let receipt = null;
for (let i = 0; i < 220; i++) {
  await sleep(2000);
  job = await statusOf(SELECT2D);
  if (job?.status === "completed") { receipt = job.result ?? ""; break; }
  if (job?.status === "failed") break;
}
ok("the run settled completed", job?.status === "completed", job?.status);
ok("the receipt text returned", typeof receipt === "string" && receipt.length > 0, String(receipt).slice(0, 80));
console.log(`    receipt: ${String(receipt).slice(0, 140)}`);

/* C4 — the world gate, API level */
console.log("C4 — world gate");
const d = await get("/api/jobs");
const js = Array.isArray(d) ? d : d.jobs ?? [];
const done = js.filter((j) => j.status === "completed").length;
ok("15 jobs · 15 done", js.length === 15 && done === 15, `${js.length} · ${done}`);

console.log(`\nT1154-LIVE-QA: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
