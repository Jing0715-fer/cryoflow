#!/usr/bin/env node
/**
 * t1164 — THE TAKE-HOME PROOF unit: the no-trace-neighbor law made a
 * pin on the smoke sentinel.
 *
 * t1163's live catch: the world-gate's first real-world refusal was
 * caused by the seat's own draft riding qa63-smoke — and qa63's
 * take-home, though designed to run on every exit path, failed
 * SILENTLY that once (a warned cleanup is a cleanup that did not
 * happen), leaving 5 QA-family jobs standing; the next strict ride
 * refused a DRIFTED world the suite had made. t1164 closes the hole
 * at the source: qa63's take-home now returns its truth, and the
 * normal path ASSERTS zero QA-family jobs in the dev lane before it
 * may say SMOKE GREEN — a green word now carries the no-trace proof.
 *
 * A the live face (the world as the next reader finds it: zero
 * QA-family rows, and the take-home idempotent on an already-clean
 * lane); B the source law (the bool truth, the assertion BEFORE the
 * green word, the argv-direct spawnSync — the shell eats $disconnect
 * through quote-nesting, observed live — the QA * naming contract,
 * the dev-lane URL, the FATAL path's take-home); C the tracked spine's
 * immunity (all 15 tracked jobs are tutorial-named, so the QA-count
 * assertion and the tracked 15-job spine coexist by construction) and
 * the header's contract.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const REPO = "/home/z/my-project";
const QA63 = `${REPO}/scripts/qa63-smoke.mjs`;
const SNAP = `${REPO}/fixtures/world-snapshot.json`;
const SEEDER = `${REPO}/scripts/qa60-seed-fsc.py`;

let pass = 0;
let fail = 0;
const ok = (name, cond, note = "") => {
  if (cond) pass += 1;
  else {
    fail += 1;
    console.error(`  RED ${name} ${note}`);
  }
};
const src = readFileSync(QA63, "utf8");
const snapSrc = readFileSync(`${REPO}/scripts/world-snapshot.mjs`, "utf8");

/** The live QA-family count in the dev lane (one aggregate). */
function qaCount() {
  const r = execFileSync(
    "node",
    [
      "-e",
      "const{PrismaClient}=require('@prisma/client');" +
        "const p=new PrismaClient({datasources:{db:{url:'file:/home/z/my-project/db/cryoflow.db'}}});" +
        "p.job.count({where:{name:{startsWith:'QA '}}}).then(c=>{console.log(c);return p.$disconnect();})",
    ],
    { cwd: REPO, timeout: 60_000, encoding: "utf8" },
  );
  return r.trim().split("\n").filter(Boolean).slice(-1)[0];
}

// ---------- A — the live face ----------
// A1: the world the next reader finds — zero QA-family jobs standing
// (t1163's residue was cured by one restore command; qa63's own rides
// have left nothing since).
ok("A1 the dev lane holds zero QA-family jobs right now", qaCount() === "0",
  `count=${qaCount()}`);

// A2: the take-home is idempotent on an already-clean lane — a REAL
// run of the seeder's cleanup verb, which must exit 0 and delete
// nothing (nothing to delete) and leave the count at zero.
{
  let code = 0;
  let out = "";
  try {
    out = execFileSync("python3", [SEEDER, "--take-home"], {
      cwd: REPO,
      timeout: 120_000,
      encoding: "utf8",
    });
  } catch (e) {
    code = e.status ?? 1;
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  const after = qaCount();
  ok("A2 the take-home is idempotent — a clean lane stays clean, exit 0",
    code === 0 && after === "0",
    `exit=${code} after=${after}`);
}

// ---------- B — the source law ----------
// B1: the take-home returns its truth (a warned cleanup is not a
// cleanup).
ok("B1 the take-home returns a bool — true on success, false on the warn",
  /const takeHomeHome = \(\) => \{\s*\n  try \{ sh\("python3 [^"]+ --take-home"\); return true; \} catch \(e\) \{ console\.log\(`  take-home warn: \$\{String\(e\)\.slice\(0, 120\)\}`\); return false; \}/.test(src));

// B2: the normal path asserts the no-trace proof BEFORE the green
// word — takeHomeHome(); assertNoLeftovers(); console.log("SMOKE GREEN").
{
  const tail = src.slice(src.indexOf("await b.close();"));
  ok("B2 the proof runs before the green word — take-home, assert, then SMOKE GREEN",
    tail.includes("takeHomeHome();") &&
      tail.indexOf("assertNoLeftovers();") > tail.indexOf("takeHomeHome();") &&
      tail.indexOf('console.log("SMOKE GREEN")') > tail.indexOf("assertNoLeftovers();"));
}

// B3: the count is argv-direct (spawnSync) — an inline `node -e` in
// sh() hands the code to a shell and the shell eats `$disconnect`
// (observed live: p.() syntax error).
ok("B3 the count is argv-direct — spawnSync, no shell, no expansion",
  /const assertNoLeftovers[\s\S]*?spawnSync\(\s*\n?\s*"node",/.test(src) &&
    !/sh\(\s*`node -e/.test(src));

// B4: the naming contract — the seeder's family is QA *.
ok("B4 the naming contract — the assertion counts name startsWith 'QA '",
  src.includes("{startsWith:'QA '}"));

// B5: the lane contract — the same dev lane the :3000 server serves.
ok("B5 the lane contract — the count rides file:…/db/cryoflow.db",
  src.includes("url:'file:/home/z/my-project/db/cryoflow.db'"));

// B6: the FATAL path still takes its specimens home (t630 doctrine,
// untouched).
ok("B6 the FATAL path keeps its take-home — the exit(1) road cleans up too",
  /FATAL: \$\{label\}`\);\s*\n    takeHomeHome\(\);/.test(src));

// ---------- C — the spine's immunity and the contract ----------
// C1: every tracked spine job is tutorial-named — the QA-count
// assertion and the tracked 15-job world coexist by construction (the
// assertion can never demand the deletion of a tracked row).
{
  const snap = JSON.parse(readFileSync(SNAP, "utf8"));
  const qaNamed = (snap.data.job || []).filter((j) => /^QA /.test(j.name));
  ok("C1 the tracked spine is immune — zero QA-named jobs among the tracked rows",
    (snap.data.job || []).length > 0 && qaNamed.length === 0,
    `qaNamed=${qaNamed.length}`);
}

// C2: the header speaks the contract (the birthplace law).
ok("C2 the header speaks the no-trace contract — the pin named, t1163's catch cited",
  src.includes("t1164 — the NO-TRACE contract, now a pin") &&
    src.includes("A silent cleanup failure can no"));

// C3: the byte-half — the tail compacts what the ride moved (the
// freelist the product doors' deletes never return; t1021's pinned
// face stays canonical after a smoke ride).
ok("C3 the tail runs the vacuum — no trace in rows OR in bytes",
  src.includes("assertNoLeftovers();") &&
    src.indexOf('"vacuum"') > src.indexOf("assertNoLeftovers();") &&
    src.includes("world-snapshot.mjs"));

// C4: the vacuum is a real command of the instrument (not an inline
// SQL call in the suite) — the byte-half hygiene lives where the
// world's tools live.
ok("C4 the vacuum is the instrument's own verb — world-snapshot.mjs vacuum",
  snapSrc.includes("async function cmdVacuum") &&
    snapSrc.includes('cmd === "vacuum"') &&
    /export\|restore\|selftest\|doctor\|probe\|vacuum/.test(snapSrc));

// A3: the byte face, LIVE — the lane compacts to the canonical
// page-quantized size (the t1021 family's pinned 143360; the t1177
// re-key: the ride-churn page split, 35→36 pages, freelist 0; the
// t1183 re-key: the film's churn bloated the file to 41 pages with 6
// freelist — the VACUUM reclaimed them and the t1177-era 36th page —
// the fingerprint follows the world, 147456→143360; the t897 re-key:
// the demo-chain resurrection's row weight landed (+4 pages × 1024,
// 140→144 — the 16-job completion rewrites, the edge and ledger rows
// the --rerun chain re-wrote), 143360→147456).
{
  // t1184 — the used-pages footprint (the file's byte size rode the boot
  // count; the fingerprint reads the world's data weight now)
  const size = execFileSync("python3", ["-c", "import sqlite3; con = sqlite3.connect('file:/home/z/my-project/db/cryoflow.db?mode=ro', uri=True); pc = con.execute('PRAGMA page_count').fetchone()[0]; fl = con.execute('PRAGMA freelist_count').fetchone()[0]; ps = con.execute('PRAGMA page_size').fetchone()[0]; print((pc - fl) * ps); con.close()"], {
    encoding: "utf8",
  }).trim();
  ok("A3 the byte face — the lane reads its canonical used-pages footprint",
    size === "147456",
    `size=${size}`);
}

console.log(`\nTAKEHOME-PROOF-UNIT t1164: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
