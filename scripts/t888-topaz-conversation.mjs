#!/usr/bin/env node
/**
 * t888 — the topaz-training route's live conversation (RE-BORN, t897).
 *
 * The original t888 (81/81) died in the annihilate; the route's SRC
 * survived, so this instrument re-writes onto the living code and rides
 * the REAL door: GET /api/jobs/[id]/topaz-training on the witness job.
 *
 * The t533 doctrine's receipts re-minted — the cleanup VERIFIED law
 * aboard FROM BIRTH, live this time (not vacuous): the instrument
 * writes ONE training-log fixture into the witness job's workdir
 * (matching the loader's *loss*.txt source hunt), witnesses the route
 * discover + parse + interpret it, then deletes the fixture AND
 * VERIFIES the deletion (existsSync false) AND re-fetches to see the
 * route's honest [] again (the world restored, not assumed).
 *
 * Usage: node scripts/t888-topaz-conversation.mjs   (dev server on :3000)
 */
import { execSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const JOB = "cmv3y2m370001ltn309f8q29s"; // the t894 denoise witness (living world)
const WORKDIR = join(ROOT, "data/relion/cmv3x1a000000lt89qwh34u45/topazdenoise_09f8q29s");
const FIXTURE = join(WORKDIR, "t888-training-loss.txt");
const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};
const curl = (path, withOrigin = true) => {
  const cmd = `curl -s -w "\\n%{http_code}" ${withOrigin ? `-H "Origin: ${ORIGIN}"` : ""} "${BASE}${path}"`;
  const out = execSync(cmd, { encoding: "utf8", cwd: ROOT });
  const lines = out.trim().split("\n");
  const code = Number(lines[lines.length - 1]);
  let body = null;
  try { body = JSON.parse(lines.slice(0, -1).join("\n")); } catch {}
  return { code, body };
};

console.log(`t888 topaz conversation — witness job ${JOB}\n`);

console.log("A — the door laws (the same-origin guard, the 404 translation)");
{
  const r = curl(`/api/jobs/${JOB}/topaz-training`, true);
  ok("A1 same-origin GET answers 200", r.code === 200, `got ${r.code}`);
  ok("A2 the response carries the full shape (jobId/epochs/source/interpretation)", r.body && "jobId" in r.body && "epochs" in r.body && "source" in r.body && "interpretation" in r.body, JSON.stringify(r.body).slice(0, 120));
}
{
  const r = curl(`/api/jobs/${JOB}/topaz-training`, false);
  ok("A3 cross-site (no Origin) is refused 403 — the parsed epochs LEAK workdir data", r.code === 403, `got ${r.code}`);
}
{
  const r = curl("/api/jobs/nonexistent-t888/topaz-training", true);
  ok("A4 unknown id translates to 404", r.code === 404, `got ${r.code}`);
}

console.log("\nB — the honest empty (the chart self-hides, nothing fabricated)");
{
  const r = curl(`/api/jobs/${JOB}/topaz-training`, true);
  ok("B1 the witness job's mock run.out carries no loss lines → epochs []", r.body && Array.isArray(r.body.epochs) && r.body.epochs.length === 0, JSON.stringify(r.body).slice(0, 120));
  ok("B2 the source is honestly null", r.body && r.body.source === null);
  ok("B3 the interpretation is honestly null (no epochs, no story invented)", r.body && r.body.interpretation === null);
}

console.log("\nC — the fixture witness (the loader's source hunt, live)");
// The fixture: a falling-loss CSV in the shape the parser's pass A eats.
const FIXTURE_TEXT = [
  "# it,training loss,test loss",
  "0,0.900,0.940",
  "1,0.720,0.780",
  "2,0.550,0.610",
  "3,0.410,0.470",
].join("\n") + "\n";
let fixtureOk = false;
try {
  writeFileSync(FIXTURE, FIXTURE_TEXT, { flag: "wx" });
  fixtureOk = existsSync(FIXTURE);
  ok("C1 the fixture lands in the workdir (flag wx — never overwrite)", fixtureOk);
} catch (e) {
  ok("C1 the fixture lands in the workdir (flag wx — never overwrite)", false, String(e).slice(0, 80));
}
if (fixtureOk) {
  const r = curl(`/api/jobs/${JOB}/topaz-training`, true);
  ok("C2 the route discovers the fixture (epochs 0..3)", r.body && r.body.epochs && r.body.epochs.length === 4, JSON.stringify(r.body?.epochs ?? null).slice(0, 200));
  ok("C3 the source names the fixture", r.body && r.body.source === "t888-training-loss.txt", `got ${r.body?.source}`);
  ok("C4 trainLoss/testLoss routed by column name", r.body?.epochs?.[0]?.trainLoss === 0.9 && r.body?.epochs?.[0]?.testLoss === 0.94, JSON.stringify(r.body?.epochs?.[0]));
  const interp = r.body?.interpretation;
  ok("C5 the interpretation speaks (firstEpoch/lastEpoch + direction)", interp && interp.firstEpoch?.it === 0 && interp.lastEpoch?.it === 3, JSON.stringify(interp).slice(0, 200));
  ok("C6 the falling losses read as 'falling'", interp && interp.lossDirection === "falling", `got ${interp?.lossDirection}`);
  ok("C7 run.out-wins merge respected (the fixture fills where run.out left blanks — all four epochs from the fixture, none fabricated)", r.body?.epochs?.length === 4 && r.body?.epochs?.every((e) => e.trainLoss != null));
}

console.log("\nD — the cleanup, VERIFIED (the t533 doctrine, live this time)");
let cleaned = false;
try {
  rmSync(FIXTURE, { force: false });
  cleaned = !existsSync(FIXTURE);
} catch {
  cleaned = false;
}
ok("D1 the fixture is gone (existsSync false — verified, not assumed)", cleaned);
{
  const r = curl(`/api/jobs/${JOB}/topaz-training`, true);
  ok("D2 the route's answer restored: epochs [] again", r.code === 200 && r.body?.epochs?.length === 0, JSON.stringify(r.body ?? r.code));
  ok("D3 the source back to null, the interpretation retracted", r.body?.source === null && r.body?.interpretation === null);
}
{
  // the run.out must be untouched by the whole conversation
  const runOut = join(WORKDIR, "run.out");
  ok("D4 the witness world's own files untouched (run.out still present, no fixture residue in the workdir)", existsSync(runOut) && !existsSync(FIXTURE) && !readFileSync(runOut, "utf8").includes("0.900"));
}

console.log(`\nt888 route conversation (re-born): ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
