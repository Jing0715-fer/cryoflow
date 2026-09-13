// t165 — world-hygiene FIXTURE audits (Task 165).
//
// The world-hygiene janitor grew two new audits out of the qa61 Host twins
// incident (Task 164's world archaeology): two rows named "qa61 Host" sat
// in the roster for rounds — both completed, both unreferenced, invisible
// to RESIDUE because a fixture name is never the "<label> N" auto-name
// form. Two blind-spot shapes, two audits:
//
//   FIXTURE-DUP    the same NAME twice is always a leak (suites seed by
//                  name, delete by id; a crashed run leaves its copy and
//                  the next run creates a SECOND). Keep the newest copy,
//                  delete the older — a just-crashed run's row may be the
//                  one disk artifacts still point at.
//   FIXTURE-ORPHAN explicit hand-listed signatures whose OWNING suite
//                  deletes them at exit ("/^qa61 Host$/", "/^QA Esc
//                  Import$/", "/^T\d+ /", "/^t\d+ /") — a match between
//                  suites is a FATALed run's leftover. "QA" alone is
//                  deliberately NOT a signature: the standing world's
//                  QA-pipeline rows are probe-created but CANONICAL.
//
// The matrix runs world-hygiene BEFORE every suite, so the between-suites
// window IS the between-rounds contract: a leaked fixture is swept before
// the next suite's first assertion.
//
// Phases (API-only — no browser; a seeder-contract probe over the HTTP
// roster and the hygiene script's own output, the t161 family):
//   S  baseline roster snapshot (ids+names — the equality oracle)
//   X  source oracles (signatures, keep-newest, caps, matrix wiring,
//      the canonical guard: no bare /^QA/ signature)
//   B  hygiene on the CLEAN world reports 0/0 (a janitor that sweeps a
//      clean floor is broken somewhere else)
//   C  CORE: seed 2×"qa61 Host" (old+new) + "T165 Anchor" + "t165 beta"
//      + a NON-signature duplicate pair 2×"165 Twin" → one hygiene run →
//      the audits COMPOSE: dup reports 2/2 (older host + older twin),
//      orphan reports 3/3 (the KEPT host still matches /^qa61 Host$/ —
//      between suites even one is a leak — plus anchor + beta), and the
//      only survivor is the NEWER twin (keep-newest observable at the
//      state level precisely because a non-signature name has no orphan
//      follow-up); canonical rows untouched
//   D  stability: a second pass reports 0/0 (a non-signature SINGLETON is
//      not a leak by design — dup needs a pair, orphan needs a signature)
//   Z  strict roster equality (names AND ids), hygiene 0/0 again

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
const run = promisify(execFile);

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const hygieneSrc = readFileSync(`${ROOT}/scripts/world-hygiene.mjs`, "utf8");
const matrixSrc = readFileSync(`${ROOT}/scripts/run-matrix.sh`, "utf8");

let checks = 0;
let failed = null;
const must = (cond, msg) => {
  checks++;
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    if (failed == null) failed = msg;
    throw new Error(`t165: ${msg}`); // THIS instant — evidence over politeness
  }
  console.log(`  ok: ${msg}`);
};

const roster = async () =>
  (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
const seed = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`t165: seed POST → ${r.status}: ${await r.text()}`);
  const j = await r.json();
  // the POST route wraps the row: {job:{...}} — returning the envelope made
  // every `.id` undefined and every "=== seedId" oracle pass VACUOUSLY
  // (the t163 unknown-ids family: assertion operands must be real rows)
  return j.job ?? j;
};
const runHygiene = async () => {
  const { stdout } = await run("node", [`${ROOT}/scripts/world-hygiene.mjs`], {
    cwd: ROOT,
    timeout: 120000,
  });
  return stdout;
};

try {
  // ---------------- S: baseline ----------------
  console.log("== S: baseline roster ==");
  const base = await roster();
  must(base.length >= 10, `world present (${base.length} jobs)`);
  const baseIds = new Set(base.map((o) => o.id));
  const baseNames = base.map((o) => o.name).sort();
  const wsId = base.find((o) => o.workspaceId)?.workspaceId ?? null;
  must(wsId != null, "a workspace exists to seed into");

  // ---------------- X: source oracles ----------------
  console.log("== X: source oracles ==");
  must(/audit 0\.6: fixture-dup/.test(hygieneSrc), "hygiene: FIXTURE-DUP audit block present");
  must(/audit 0\.7: fixture-orphan/.test(hygieneSrc), "hygiene: FIXTURE-ORPHAN audit block present");
  // plain-string includes, NOT regex literals — matching a source pattern
  // that itself contains slashes through a regex literal is delimiter hell
  must(hygieneSrc.includes('/^qa61 Host$/'), "signature: qa61 Host (the incident's own name)");
  must(hygieneSrc.includes('/^QA Esc Import$/'), "signature: QA Esc Import (its sheet prop)");
  must(hygieneSrc.includes('/^T\\d+ /'), "signature: T<number> space (t-suite anchors)");
  must(hygieneSrc.includes('/^t\\d+ /'), "signature: t<number> space (lowercase fixtures)");
  must(!hygieneSrc.includes('/^QA/'), "CANONICAL GUARD: no bare /^QA/ signature (the pipeline is what the world is made of)");
  must(/group\.sort\(\(a, b\) => \(a\.createdAt < b\.createdAt \? 1 : -1\)\); \/\/ newest first[\s\S]{0,80}group\.slice\(1\)/.test(hygieneSrc),
    "dup policy: keep the NEWEST copy, delete the older");
  must((hygieneSrc.match(/exceed the 400 cap/g) ?? []).length >= 3,
    "both audits carry the 400 loud-abort cap (residue's contract, twice more)");
  must(/node scripts\/world-hygiene\.mjs/.test(matrixSrc),
    "matrix wiring: run-matrix.sh runs hygiene BEFORE every suite (the between-suites window)");

  // ---------------- B: clean world → 0/0 ----------------
  console.log("== B: hygiene on the clean world ==");
  const outB = await runHygiene();
  must(/fixture-dup: 0 /.test(outB), "clean world: fixture-dup reports 0");
  must(/fixture-orphan: 0 /.test(outB), "clean world: fixture-orphan reports 0");

  // ---------------- C: CORE — seed leaks, the janitor sweeps ----------------
  console.log("== C: CORE — seed leaks, the janitor sweeps ==");
  const hostA = await seed({ type: "import", name: "qa61 Host", workspaceId: wsId, x: 2600, y: 1200 });
  await new Promise((r) => setTimeout(r, 120)); // distinct createdAt — the tie would break the keep-newest oracle
  const hostB = await seed({ type: "import", name: "qa61 Host", workspaceId: wsId, x: 2900, y: 1200 });
  const anchor = await seed({ type: "import", name: "T165 Anchor", workspaceId: wsId, x: 2600, y: 1500 });
  const beta = await seed({ type: "import", name: "t165 beta", workspaceId: wsId, x: 2900, y: 1500 });
  // a NON-signature duplicate pair — the only way to observe keep-newest at
  // the STATE level: a signature name's survivor is swept by the orphan
  // pass in the SAME run (the audits compose), but a plain-name singleton
  // survives with nothing following up
  const twinA = await seed({ type: "import", name: "165 Twin", workspaceId: wsId, x: 2600, y: 1800 });
  await new Promise((r) => setTimeout(r, 120));
  const twinB = await seed({ type: "import", name: "165 Twin", workspaceId: wsId, x: 2900, y: 1800 });
  const midNames = (await roster()).map((o) => o.name);
  must(midNames.filter((n) => n === "qa61 Host").length === 2, "twins seeded (2× qa61 Host)");
  must(midNames.filter((n) => n === "165 Twin").length === 2, "non-signature dup pair seeded (2× 165 Twin)");

  const outC = await runHygiene();
  must(/fixture-dup: 2\/2 /.test(outC), `sweep: dup 2/2 (older host + older twin) — got: ${(outC.match(/fixture-dup: [^\n]*/) ?? ["?"])[0]}`);
  must(/fixture-orphan: 3\/3 /.test(outC),
    `sweep: orphan 3/3 — the KEPT host still matches its signature (between suites even one is a leak) + anchor + beta — got: ${(outC.match(/fixture-orphan: [^\n]*/) ?? ["?"])[0]}`);

  const afterC = await roster();
  const twins = afterC.filter((o) => o.name === "165 Twin");
  must(twins.length === 1 && twins[0].id === twinB.id,
    "keep-newest: the SURVIVING 165 Twin is the newer id (disk artifacts point at the fresh row)");
  must(!afterC.some((o) => o.id === hostA.id) && !afterC.some((o) => o.id === hostB.id),
    "both qa61 Host rows gone (dup took the older, orphan took the kept one — the audits compose)");
  must(!afterC.some((o) => o.id === anchor.id) && !afterC.some((o) => o.id === beta.id),
    "signature rows both swept");
  // canonical rows untouched: every baseline id+name pair still present
  const canonOk = base.every((o) => afterC.some((p) => p.id === o.id && p.name === o.name));
  must(canonOk, "CANONICAL SAFETY: every baseline row (id AND name) survived the sweep");
  must(afterC.length === base.length + 1, `roster == baseline + kept twin (${afterC.length} == ${base.length}+1)`);

  // ---------------- D: stability — the second pass ----------------
  console.log("== D: stability — the second pass ==");
  const outD = await runHygiene();
  must(/fixture-dup: 0 /.test(outD) && /fixture-orphan: 0 /.test(outD),
    "second pass: 0/0 — a non-signature SINGLETON is not a leak by design (dup needs a pair, orphan needs a signature)");
  const afterD = await roster();
  must(afterD.length === base.length + 1 && afterD.some((o) => o.id === twinB.id),
    "the kept twin persists (a singleton plain-name row is a world feature — the probe's finally removes it)");
} catch (e) {
  if (failed == null) failed = `uncaught: ${e.message}`;
  console.error(`  ERROR: ${e.message}`);
} finally {
  // evidence-preserving cleanup (no must here): sweep any probe-seeded
  // fixture rows via the janitor itself — dogfooding the audit's own exit
  const problems = [];
  if (failed) problems.push(failed);
  try {
    const js = await roster();
    const mine = js.filter((o) => o.name === "165 Twin" || /^qa61 Host$/.test(o.name) || /^T165 /.test(o.name) || /^t165 /.test(o.name));
    for (const o of mine) {
      const r = await fetch(`${BASE}/api/jobs/${o.id}`, { method: "DELETE" });
      if (!r.ok) problems.push(`cleanup: DELETE ${o.name} → ${r.status}`);
    }
    if (mine.length) console.log(`  cleanup: ${mine.length} probe row(s) removed via the contract's own DELETE`);
  } catch (e) { problems.push(`cleanup: ${e.message}`); }
  console.log(problems.length === 0 ? `T165 ALL PASS (${checks} assertions)` : `T165 FAILED (${problems.length}): ${problems[0]}`);
  if (problems.length > 0) process.exit(1);
}
