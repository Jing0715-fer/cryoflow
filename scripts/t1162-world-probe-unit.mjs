#!/usr/bin/env node
/**
 * t1162 — THE WORLD PROBE unit: the snapshot doctor's THIRD face (the
 * durability vein's next beat) and the family report's world marker.
 *
 * t1160 taught the world to die as a command; t1161 taught the snapshot
 * to admit its age (the full doctor: nine models, both-directions
 * ledger). t1162 teaches the FAMILY to hear the doorbell: `probe` is
 * the CHEAP reading (count+head only — the self-truth tooth is free
 * once the JSON is in hand; the live truth costs ONE aggregate), and
 * every batch entry in scripts/.family-report.json now carries it —
 * the freshness verdict rides the report the cron family already
 * reads. Verdicts, loudest first: NO-SNAPSHOT (the tracked home is
 * gone or unparseable), LIED (meta.counts.job against the snapshot's
 * own rows), EMPTY-LIVE (the recycle's signature — the snapshot is the
 * CURE here, exit 0), DRIFTED (count or freshness moved off the
 * snapshot), STALE (the docs/qa cars' footprint), FRESH. A RED probe
 * is a DOORBELL, not a diagnosis — the full doctor holds the hearing —
 * and by the t548 doctrine it NEVER moves the runner's exit code.
 *
 * A the instrument runs FOR REAL (every verdict provoked on a doctored
 * temp copy or a temp DB — the tracked snapshot never touched);
 * B the source law (the ladder's order, the ONE-aggregate cheapness,
 * the exit codes, the read-only body, the 1s slack, the URL
 * jurisdiction); C the family integration (the stamp on BOTH report
 * write sites, the non-fatal exit-code law — static AND live, the
 * --summary faces, the preflight, the usage lines).
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const REPO = "/home/z/my-project";
const SRC = `${REPO}/scripts/world-snapshot.mjs`;
const SNAP = `${REPO}/fixtures/world-snapshot.json`;
const FAMILY = `${REPO}/scripts/family-run.mjs`;

let pass = 0;
let fail = 0;
const ok = (name, cond, note = "") => {
  if (cond) pass += 1;
  else {
    fail += 1;
    console.error(`  RED ${name} ${note}`);
  }
};
const src = existsSync(SRC) ? readFileSync(SRC, "utf8") : "";
const fam = existsSync(FAMILY) ? readFileSync(FAMILY, "utf8") : "";

/** Run `probe <path>` in a subprocess; return {code, json?, out}. */
function probe(p, env = {}) {
  let code = 0;
  let out = "";
  try {
    out = execFileSync("node", [SRC, "probe", p], {
      cwd: REPO,
      timeout: 90_000,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
  } catch (e) {
    code = e.status ?? 1;
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  let json = null;
  try {
    json = JSON.parse(out.trim().split("\n").filter(Boolean).slice(-1)[0]);
  } catch {
    /* the caller asserts on json when it expects one */
  }
  return { code, json, out };
}

/** The tracked snapshot onto a temp path, with an optional mutation. */
function snapCopy(mutate) {
  const s = JSON.parse(readFileSync(SNAP, "utf8"));
  if (mutate) mutate(s);
  const dir = mkdtempSync(path.join(tmpdir(), "t1162-"));
  const p = path.join(dir, "snap.json");
  writeFileSync(p, JSON.stringify(s, null, 1) + "\n");
  return { p, dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** An empty temp DB with the project's schema (prisma db push). */
function tempDb() {
  const dir = mkdtempSync(path.join(tmpdir(), "t1162-db-"));
  const url = `file:${dir}/probe.db`;
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
    cwd: REPO,
    timeout: 120_000,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  return { dir, url, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// ---------- A — the instrument runs FOR REAL ----------
// A1: the tracked snapshot gets a real reading (the docs/qa cars'
// footprint: STALE with red=false — or FRESH right after a re-export).
const a1 = probe(SNAP);
ok("A1 the tracked snapshot gets a verdict (exit 0, not red)",
  a1.code === 0 && a1.json && (a1.json.verdict === "STALE" || a1.json.verdict === "FRESH") &&
    a1.json.red === false && a1.json.liveJobs >= 0,
  `exit=${a1.code} out=${a1.out.split("\n")[0] || ""}`);

// A2: NO-SNAPSHOT — the tracked home is GONE (the loudest doorbell).
{
  const r = probe(path.join(tmpdir(), `t1162-absent-${Date.now()}.json`));
  ok("A2 NO-SNAPSHOT — a missing home is doctor-RED",
    r.code === 1 && r.json && r.json.verdict === "NO-SNAPSHOT" && r.json.red === true,
    `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
}

// A3: NO-SNAPSHOT — an unparseable home is no home.
{
  const dir = mkdtempSync(path.join(tmpdir(), "t1162-junk-"));
  const p = path.join(dir, "junk.json");
  writeFileSync(p, "{ this is not json");
  const r = probe(p);
  rmSync(dir, { recursive: true, force: true });
  ok("A3 NO-SNAPSHOT — an unparseable home is named honestly",
    r.code === 1 && r.json && r.json.verdict === "NO-SNAPSHOT",
    `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
}

// A4: LIED — meta.counts.job inflated against its own job rows.
{
  const { p, cleanup } = snapCopy((s) => { s.meta.counts.job = 99; });
  const r = probe(p);
  cleanup();
  ok("A4 LIED — the self-truth tooth is kept, even in the cheap reading",
    r.code === 1 && r.json && r.json.verdict === "LIED" && r.json.red === true,
    `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
}

// A5: EMPTY-LIVE — the recycle's signature: an empty lane under a
// snapshot that carries the 15-job spine. NOT a disease (exit 0):
// the snapshot is the CURE here, recovery's step 3.5 is about to speak.
{
  const db = tempDb();
  try {
    const r = probe(SNAP, { CRYOFLOW_DB_URL: db.url });
    ok("A5 EMPTY-LIVE — an empty lane is the recycle's signature, not a drift",
      r.code === 0 && r.json && r.json.verdict === "EMPTY-LIVE" && r.json.red === false &&
        r.json.liveJobs === 0 && r.json.snapshotJobs > 0,
      `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
  } finally {
    db.cleanup();
  }
}

// A6: DRIFTED (count) — the live lane grew a job the snapshot never saw.
{
  const db = tempDb();
  try {
    execFileSync("node", [SRC, "restore", SNAP], {
      cwd: REPO,
      timeout: 120_000,
      env: { ...process.env, CRYOFLOW_DB_URL: db.url },
      stdio: "ignore",
    });
    const require = createRequire(import.meta.url);
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    try {
      const snap = JSON.parse(readFileSync(SNAP, "utf8"));
      await prisma.job.create({
        data: {
          projectId: snap.data.project[0].id,
          type: "t1162-drift-probe",
          name: "t1162 drift probe",
          x: 0,
          y: 0,
        },
      });
    } finally {
      await prisma.$disconnect();
    }
    const r = probe(SNAP, { CRYOFLOW_DB_URL: db.url });
    ok("A6 DRIFTED — a live-only job moves the count off the snapshot",
      r.code === 1 && r.json && r.json.verdict === "DRIFTED" && r.json.red === true &&
        r.json.liveJobs === r.json.snapshotJobs + 1,
      `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
  } finally {
    db.cleanup();
  }
}

// A7: DRIFTED (freshness) — an exportedAt pushed into the past makes
// the newest live row "updated after the snapshot" (the 1s slack holds).
{
  const { p, cleanup } = snapCopy((s) => {
    s.meta.exportedAt = "2020-01-01T00:00:00.000Z";
  });
  const r = probe(p);
  cleanup();
  ok("A7 DRIFTED — rows updated after exportedAt name the world's motion",
    r.code === 1 && r.json && r.json.verdict === "DRIFTED" && r.json.red === true,
    `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
}

// A8: STALE — a snapshot riding an older commit (doctored head).
{
  const { p, cleanup } = snapCopy((s) => { s.meta.head = "deadbeef"; });
  const r = probe(p);
  cleanup();
  ok("A8 STALE — an old head is the docs/qa footprint, honest and exit 0",
    r.code === 0 && r.json && r.json.verdict === "STALE" && r.json.red === false &&
      r.json.snapshotHead === "deadbeef",
    `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
}

// A9: FRESH — a just-exported snapshot rides the current HEAD.
{
  const dir = mkdtempSync(path.join(tmpdir(), "t1162-fresh-"));
  const p = path.join(dir, "fresh.json");
  try {
    execFileSync("node", [SRC, "export", p], { cwd: REPO, timeout: 120_000, stdio: "ignore" });
    const r = probe(p);
    ok("A9 FRESH — a just-exported snapshot is certified (exit 0, not red)",
      r.code === 0 && r.json && r.json.verdict === "FRESH" && r.json.red === false &&
        r.json.snapshotHead === r.json.treeHead,
      `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- B — the source law ----------
// B1: the verdict ladder, loudest first — NO-SNAPSHOT (three gates:
// missing file, unparseable, shapeless), then LIED, EMPTY-LIVE,
// DRIFTED, STALE, FRESH. The order IS the law.
ok("B1 the verdict ladder is ordered — absent, LIED, EMPTY-LIVE, DRIFTED, STALE, FRESH",
  src.indexOf("async function cmdProbe") > -1 &&
  src.indexOf("async function cmdProbe") < src.indexOf('verdict: "NO-SNAPSHOT"') &&
  src.indexOf('verdict: "NO-SNAPSHOT"') < src.indexOf('verdict: "LIED"') &&
  src.indexOf('verdict: "LIED"') < src.indexOf('verdict: "EMPTY-LIVE"') &&
  src.indexOf('verdict: "EMPTY-LIVE"') < src.indexOf('verdict: "DRIFTED"') &&
  src.indexOf('verdict: "DRIFTED"') < src.indexOf('verdict: "STALE"') &&
  src.indexOf('verdict: "STALE"') < src.indexOf('verdict: "FRESH"'));

// B2: the CHEAPNESS law — the probe's live truth is ONE aggregate, no
// nine-model dump (findMany/dumpModels never appear in cmdProbe's body).
{
  const body = src.slice(src.indexOf("async function cmdProbe"), src.indexOf("const cmd = process.argv"));
  ok("B2 the probe is cheap — ONE aggregate, no findMany, no dumpModels",
    /job\.aggregate\(/.test(body) && !/findMany|dumpModels/.test(body),
    `body=${body.length} chars`);
}

// B3: the exit-code law — LIED/DRIFTED exit 1 (doctor-RED);
// EMPTY-LIVE/STALE/FRESH exit 0.
ok("B3 the exit-code law — LIED/DRIFTED 1, EMPTY-LIVE/STALE/FRESH 0",
  /verdict: "LIED", red: true, \.\.\.base \}, 1\)/.test(src) &&
  /verdict: "DRIFTED", red: true, \.\.\.base \}, 1\)/.test(src) &&
  /verdict: "EMPTY-LIVE", red: false, \.\.\.base \}, 0\)/.test(src) &&
  /verdict: "STALE", red: false, \.\.\.base \}, 0\)/.test(src) &&
  /verdict: "FRESH", red: false, \.\.\.base \}, 0\)/.test(src));

// B4: the machine face — ONE JSON line on stdout (the runner parses it).
ok("B4 the machine face — JSON.stringify is the probe's mouth",
  /console\.log\(JSON\.stringify\(obj\)\)/.test(src));

// B5: the freshness slack — exportedAt + 1000ms, the doctor's own law.
ok("B5 the freshness slack — exportedAt + 1000, not a hair-trigger",
  /exportedAt \+ 1000/.test(src));

// B6: the URL jurisdiction — the probe's live aggregate rides DB_URL.
ok("B6 the URL jurisdiction — the probe counts in the lane the URL names",
  /async function cmdProbe[\s\S]*?openClient\(DB_URL\)/.test(src));

// B7: the read-only law — the probe writes nothing, deletes nothing.
{
  const body = src.slice(src.indexOf("async function cmdProbe"), src.indexOf("const cmd = process.argv"));
  ok("B7 the probe is READ-ONLY — no writes, no deletes in its body",
    !/writeFileSync|deleteMany|rmSync|createMany|\.create\(/.test(body));
}

// B8: discoverability — the usage line carries probe.
ok("B8 the usage line carries probe — export|restore|selftest|doctor|probe",
  /export\|restore\|selftest\|doctor\|probe/.test(src));

// ---------- C — the family integration ----------
// C1: the runner probes by spawning the real instrument (not a re-write).
ok("C1 the runner spawns the real probe — world-snapshot.mjs probe via spawnSync",
  /spawnSync\("node", \[path\.join\(SCRIPTS, "world-snapshot\.mjs"\), "probe"\]/.test(fam));

// C2: BOTH report write sites stamp the world reading (the normal
// close AND the death testimony — a killed batch leaves its world too).
ok("C2 both write sites stamp the world — the close AND the death testimony",
  (fam.match(/world: probeWorld\(\)/g) || []).length === 2 &&
    fam.indexOf("world: probeWorld()") < fam.indexOf("report write failed on the way out") &&
    fam.lastIndexOf("world: probeWorld()") > fam.indexOf("FAMILY VERDICT"));

// C3: the NON-FATAL law, static — the exit codes stay pure suite
// arithmetic (totFail / realFail); the world never moves them.
ok("C3 the non-fatal law — the world never enters an exit-code expression",
  /process\.exit\(totFail > 0 \? 1 : 0\)/.test(fam) &&
    /process\.exit\(realFail\.length > 0 \? 1 : 0\)/.test(fam) &&
    !/process\.exit\([^)]*world/.test(fam));

// C4: the --summary faces — a live reading at the top, the stamped
// batch marker, and the mute-honesty line.
ok("C4 the --summary faces — worldNow at the top, world-RED at the batch, the mute line",
  /const worldNow = probeWorld\(\)/.test(fam) &&
    fam.includes("world-RED(") &&
    fam.includes("world probe: mute"));

// C5: the preflight — a RED world is named BEFORE the ride (the t548
// preflight's sibling), with the hearing named.
ok("C5 the preflight — a RED world is named before the ride proceeds",
  /preflight: WORLD PROBE/.test(fam) && fam.includes("verdicts, not repairs"));

// C6: the non-fatal law, LIVE — a RED-stamped batch still exits 0 when
// no suite failed (the temp report's t30 batch is world-RED on purpose).
{
  const dir = mkdtempSync(path.join(tmpdir(), "t1162-report-"));
  const p = path.join(dir, "report.json");
  const now = new Date().toISOString();
  writeFileSync(p, JSON.stringify({
    batches: {
      t30: {
        lastRun: now,
        suites: [{ name: "t273-family-report.mjs", verdict: "pass", ms: 1000, attempts: 1 }],
        pass: 1, soloRecovery: 0, realFail: 0, skippedServer: 0, wallMs: 1000,
        world: { verdict: "DRIFTED", red: true, snapshotJobs: 15, liveJobs: 16,
          snapshotHead: "6cb3556a", treeHead: "bedc04a4", probedAt: now },
      },
      "adhoc:qa63": {
        lastRun: now,
        suites: [{ name: "qa63-smoke.mjs", verdict: "pass", ms: 500, attempts: 1 }],
        pass: 1, soloRecovery: 0, realFail: 0, skippedServer: 0, wallMs: 500,
        world: null,
      },
    },
  }, null, 2));
  let code = 0;
  let out = "";
  try {
    out = execFileSync("node", [FAMILY, "--summary"], {
      cwd: REPO,
      timeout: 60_000,
      encoding: "utf8",
      env: { ...process.env, FAMILY_REPORT: p },
    });
  } catch (e) {
    code = e.status ?? 1;
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  rmSync(dir, { recursive: true, force: true });
  const redNamed = out.includes("world-RED(DRIFTED") && out.includes("world probe:");
  const muteNamed = out.includes("world ∅ (probe mute)");
  ok("C6 the non-fatal law, LIVE — a world-RED batch exits 0, both markers spoken",
    code === 0 && redNamed && muteNamed,
    `exit=${code} red=${redNamed} mute=${muteNamed}`);
}

// C7: discoverability — the family help line speaks the world probe.
ok("C7 the family help speaks the world probe — doorbell, never an exit code",
  fam.includes("world probe      every batch entry carries a cheap doctor reading") &&
    fam.includes("a RED probe (NO-SNAPSHOT/LIED/DRIFTED) is a doorbell, never an exit code"));

// C8: the header speaks the third face (the birthplace law).
ok("C8 the header speaks the third face — probe documented in world-snapshot.mjs",
  /probe    the doctor's THIRD face/.test(src) &&
    src.includes("A RED probe is a DOORBELL, not"));

console.log(`\nWORLD-PROBE-UNIT t1162: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
