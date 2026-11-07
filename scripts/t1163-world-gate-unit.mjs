#!/usr/bin/env node
/**
 * t1163 — THE WORLD GATE unit: the durability vein's fourth face —
 * the operator's lever on the family runner.
 *
 * t1162 made the family HEAR the doorbell (every batch entry carries
 * the cheap probe's verdict; --summary speaks it). t1163 lets the
 * operator DECIDE: FAMILY_WORLD_GATE=strict refuses to ride a
 * doctor-RED world — the batch writes HONEST TESTIMONY (a worldGated
 * entry, every suite "world-gated", attempts 0) and exits 0. The
 * doorbell law's three jurisdictions are now all executable: the
 * probe names the drift (the doorbell), the doctor holds the hearing
 * (nine models, both-directions ledger), and the GATE decides — but
 * only the operator's own way: the default keeps the t1162 behavior
 * (report and ride), strict never repairs, never retries, never
 * fakes a verdict, and a mute probe is never red (the gate stays
 * silent when the instrument went silent). EMPTY-LIVE (red=false)
 * rides: the recycle's signature is the recovery's business, not the
 * family's refusal.
 *
 * A the instrument runs FOR REAL (strict × RED world = the refusal,
 * on a DRIFTED temp DB so the tracked snapshot is never touched;
 * default × RED world = the ride proceeds; strict × honest world =
 * the ride proceeds; --summary speaks the ⊘ testimony); B the source
 * law (strict-only, exit 0, no manufactured failure, the testimony
 * shape, the mute safety, the EMPTY-LIVE whitelist, the default's
 * t1162 shape); C the doctrine (the help line, the non-fatal exit
 * codes, the summary faces).
 */
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
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
const fam = readFileSync(FAMILY, "utf8");
const snapSrc = readFileSync(SRC, "utf8");

/** An empty temp DB with the project's schema, restored to the tracked
 * snapshot, then grown one live-only job — the DRIFTED world (red). */
function driftedDb() {
  const dir = mkdtempSync(path.join(tmpdir(), "t1163-db-"));
  const url = `file:${dir}/gate.db`;
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
    cwd: REPO,
    timeout: 120_000,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  execFileSync("node", [SRC, "restore", SNAP], {
    cwd: REPO,
    timeout: 120_000,
    env: { ...process.env, CRYOFLOW_DB_URL: url },
    stdio: "ignore",
  });
  const require = createRequire(import.meta.url);
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  return {
    dir,
    url,
    grow: async () => {
      const snap = JSON.parse(readFileSync(SNAP, "utf8"));
      await prisma.job.create({
        data: {
          projectId: snap.data.project[0].id,
          type: "t1163-gate-drift",
          name: "t1163 gate drift",
          x: 0,
          y: 0,
        },
      });
    },
    close: () => prisma.$disconnect(),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Run family-run with an env; return {code, out}. */
function ride(env) {
  let code = 0;
  let out = "";
  try {
    out = execFileSync("node", [FAMILY, "--filter", "qa00-data-view"], {
      cwd: REPO,
      timeout: 200_000,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
  } catch (e) {
    code = e.status ?? 1;
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  return { code, out };
}

const readEntry = (reportPath, key) =>
  JSON.parse(readFileSync(reportPath, "utf8")).batches[key];

// ---------- A — the instrument runs FOR REAL ----------
// A1: strict × RED world — the REFUSAL: nothing rides, testimony is
// written, exit 0. The DRIFTED world is a temp DB; the tracked
// snapshot and the live dev lane are never touched.
{
  const db = driftedDb();
  const reportPath = path.join(mkdtempSync(path.join(tmpdir(), "t1163-r1-")), "report.json");
  try {
    await db.grow();
    await db.close();
    const r = ride({
      FAMILY_REPORT: reportPath,
      FAMILY_WORLD_GATE: "strict",
      CRYOFLOW_DB_URL: db.url,
    });
    const entry = readEntry(reportPath, "adhoc:qa00-data-view");
    const gatedOk =
      r.code === 0 &&
      r.out.includes("⊘ WORLD-GATE(strict)") &&
      r.out.includes("DRIFTED") &&
      entry?.worldGated === true &&
      entry.world?.verdict === "DRIFTED" &&
      entry.suites.every((s) => s.verdict === "world-gated" && s.attempts === 0) &&
      entry.realFail === 0;
    ok("A1 strict × RED — the refusal: nothing rode, testimony written, exit 0",
      gatedOk,
      `exit=${r.code} out=${r.out.split("\n").filter(Boolean).slice(0, 3).join(" | ")}`);
    rmSync(path.dirname(reportPath), { recursive: true, force: true });

    // A4 (rides on A1's face): --summary speaks the ⊘ testimony.
    // Re-create the entry shape from the gate run for a quiet summary.
    const rp2 = path.join(mkdtempSync(path.join(tmpdir(), "t1163-r4-")), "report.json");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(rp2, JSON.stringify({ batches: { "adhoc:qa00-data-view": entry } }, null, 2));
    let code4 = 0;
    let out4 = "";
    try {
      out4 = execFileSync("node", [FAMILY, "--summary"], {
        cwd: REPO,
        timeout: 60_000,
        encoding: "utf8",
        env: { ...process.env, FAMILY_REPORT: rp2 },
      });
    } catch (e) {
      code4 = e.status ?? 1;
      out4 = String(e.stdout || "") + String(e.stderr || "");
    }
    rmSync(path.dirname(rp2), { recursive: true, force: true });
    ok("A4 --summary speaks the ⊘ — the gated flag, the verdict, nothing rode",
      code4 === 0 && out4.includes("⊘ world-gated(DRIFTED") &&
        out4.includes("nothing rode") && /⊘ adhoc:qa00-data-view/.test(out4),
      `exit=${code4}`);
  } finally {
    db.cleanup();
  }
}

// A2: default × RED world — the t1162 behavior stands: the ride
// proceeds (the ⚠ preflight names the world; the suite runs its real
// course). Same DRIFTED temp DB.
{
  const db = driftedDb();
  const reportPath = path.join(mkdtempSync(path.join(tmpdir(), "t1163-r2-")), "report.json");
  try {
    await db.grow();
    await db.close();
    const r = ride({ FAMILY_REPORT: reportPath, CRYOFLOW_DB_URL: db.url });
    const entry = readEntry(reportPath, "adhoc:qa00-data-view");
    const rodeOk =
      r.out.includes("⚠ preflight: WORLD PROBE DRIFTED") &&
      entry && entry.worldGated === undefined &&
      ["pass", "solo-recovery", "real-fail", "skipped-server"].includes(entry.suites?.[0]?.verdict);
    ok("A2 default × RED — the ride proceeds, the warning speaks, no gate",
      rodeOk,
      `exit=${r.code} out=${r.out.split("\n").filter(Boolean).slice(0, 3).join(" | ")}`);
  } finally {
    db.cleanup();
    rmSync(path.dirname(reportPath), { recursive: true, force: true });
  }
}

// A3: strict × honest world — the gate stays open: the tracked
// snapshot.s STALE is red=false, so strict rides (the READ-ONLY
// sentinel against the real server — it never moves the world).
{
  const reportPath = path.join(mkdtempSync(path.join(tmpdir(), "t1163-r3-")), "report.json");
  try {
    const r = ride({ FAMILY_REPORT: reportPath, FAMILY_WORLD_GATE: "strict" });
    const entry = readEntry(reportPath, "adhoc:qa00-data-view");
    const rodeOk =
      !r.out.includes("WORLD-GATE(strict)") &&
      entry && entry.worldGated === undefined &&
      ["pass", "solo-recovery", "real-fail", "skipped-server"].includes(entry.suites?.[0]?.verdict);
    ok("A3 strict × honest (STALE, red=false) — the gate stays open, the ride proceeds",
      rodeOk,
      `exit=${r.code}`);
  } finally {
    rmSync(path.dirname(reportPath), { recursive: true, force: true });
  }
}

// ---------- B — the source law ----------
// B1: the gate is strict-only — any other value keeps the t1162 ride.
ok("B1 the gate is strict-only — the default rides and reports",
  /WORLD_GATE === "strict"/.test(fam) &&
    /\(process\.env\.FAMILY_WORLD_GATE \|\| ""\)/.test(fam));

// B2: the refusal exits 0 — an operator choice, not a failure.
ok("B2 the refusal exits 0 — the exit code stays pure suite arithmetic",
  /process\.exit\(0\); \/\/ refusal, not failure/.test(fam));

// B3: the gate never manufactures a failure.
ok("B3 the gate never manufactures a failure — realFail 0 in the testimony",
  /realFail: 0, \/\/ the gate never manufactures a failure/.test(fam));

// B4: the testimony shape — worldGated, the world reading preserved,
// every suite world-gated with attempts 0.
ok("B4 the testimony shape — worldGated + world + suites world-gated × attempts 0",
  /worldGated: true/.test(fam) &&
    /world: preWorld, \/\/ the reading that rang the doorbell/.test(fam) &&
    /verdict: "world-gated", ms: 0, attempts: 0/.test(fam));

// B5: the mute safety — a null probe never opens the gate branch.
ok("B5 the mute safety — preWorld?.red keeps the silent instrument silent",
  /if \(preWorld\?\.red\)/.test(fam));

// B6: the EMPTY-LIVE whitelist — red=false rides, by the probe's own law.
ok("B6 the EMPTY-LIVE whitelist — the probe stamps red:false on the recycle's signature",
  /verdict: "EMPTY-LIVE", red: false/.test(snapSrc));

// B7: the default's t1162 shape — the ⚠ preflight line stands.
ok("B7 the default keeps the t1162 face — the ⚠ preflight line stands",
  fam.includes("⚠ preflight: WORLD PROBE"));

// ---------- C — the doctrine ----------
// C1: discoverability — the help line speaks the lever.
ok("C1 the help line speaks the lever — FAMILY_WORLD_GATE=strict, the operator owns it",
  fam.includes("FAMILY_WORLD_GATE=strict  refuse to ride a doctor-RED world") &&
    fam.includes("the operator owns the lever"));

// C2: the non-fatal law, static — no exit expression contains the
// world or the gate.
ok("C2 the non-fatal law — no exit expression contains world or gate",
  !/process\.exit\([^)]*(world|WORLD_GATE|GATE)/.test(fam));

// C3: the summary's flag precedence — ⊘ outranks ✗/⚡/✓ for a gated batch.
ok("C3 the flag precedence — worldGated paints ⊘ before any other flag",
  fam.indexOf('b.worldGated ? paint.bold("⊘")') <
    fam.indexOf('b.interrupted ? paint.bold("⚡")'));

console.log(`\nWORLD-GATE-UNIT t1163: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
