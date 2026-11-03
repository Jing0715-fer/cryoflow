#!/usr/bin/env node
/**
 * t1161 — THE SNAPSHOT DOCTOR unit: the freshness gate, the snapshot's
 * second face (the durability vein's next beat).
 *
 * t1160 taught the world to die as a command (export/restore/selftest);
 * t1161 teaches the snapshot to admit its age. A stale snapshot restored
 * after a recycle would resurrect an OLD world and PRESENT it as the
 * truth — the doctor names the drift before it lies. Four verdicts,
 * loudest first: LIED (meta.counts disagree with the snapshot's own
 * data rows — a snapshot that lies about itself is worse than no
 * snapshot), DRIFTED (the live world moved on: count or job-ID
 * differences, or rows updated after exportedAt — a restore now would
 * resurrect an OLD world), STALE (data faithful, the snapshot rides an
 * older commit — the docs/qa cars' usual footprint), FRESH (counts
 * faithful, job IDs equal, engine-state aligned). READ-ONLY by law:
 * the doctor writes nothing, deletes nothing, decides nothing — it
 * speaks, and the operator (or reboot-recover's step 3.5) decides.
 *
 * A the instrument runs FOR REAL (the four verdicts, each provoked on a
 * doctored temp copy — the tracked snapshot never touched); B the source
 * law (the verdict ladder's order, the read-only body, the exit-code
 * semantics, the both-directions job-ID ledger, the 1s freshness slack,
 * the URL jurisdiction); C the doctrine (the tracked snapshot
 * self-consistent, the verdict ladder in the header, the usage line,
 * the reboot-recover 3.5 integration).
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO = "/home/z/my-project";
const SRC = `${REPO}/scripts/world-snapshot.mjs`;
const SNAP = `${REPO}/fixtures/world-snapshot.json`;
const RECOVER = `${REPO}/scripts/reboot-recover.sh`;

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

/** Run `doctor <path>` in a subprocess; return {code, out}. */
function doctor(p) {
  let code = 0;
  let out = "";
  try {
    out = execFileSync("node", [SRC, "doctor", p], {
      cwd: REPO,
      timeout: 90_000,
      encoding: "utf8",
    });
  } catch (e) {
    code = e.status ?? 1;
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  return { code, out };
}

/** The tracked snapshot onto a temp path, with an optional mutation. */
function snapCopy(mutate) {
  const s = JSON.parse(readFileSync(SNAP, "utf8"));
  if (mutate) mutate(s);
  const dir = mkdtempSync(path.join(tmpdir(), "t1161-"));
  const p = path.join(dir, "snap.json");
  writeFileSync(p, JSON.stringify(s, null, 1) + "\n");
  return { p, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// ---------- A — the instrument runs FOR REAL ----------
// A1: the tracked snapshot itself — the doctor speaks a real verdict.
const a1 = doctor(SNAP);
ok("A1 the tracked snapshot gets a verdict (exit 0, FRESH or STALE)",
  a1.code === 0 && /\b(FRESH|STALE) —/.test(a1.out),
  `exit=${a1.code} out=${a1.out.split("\n")[0] || ""}`);

// A2: LIED — meta.counts.job inflated against its own data rows.
{
  const { p, cleanup } = snapCopy((s) => { s.meta.counts.job = 99; });
  const r = doctor(p);
  cleanup();
  ok("A2 LIED — counts lying about the data is the loudest verdict",
    r.code === 1 && /\bLIED —/.test(r.out) && /meta says job:99/.test(r.out),
    `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
}

// A3: LIED — the engine-state receipt lies too.
{
  const { p, cleanup } = snapCopy((s) => { s.meta.engineStateJobs = 3; });
  const r = doctor(p);
  cleanup();
  ok("A3 LIED — the engine-state count is part of the snapshot's oath",
    r.code === 1 && /meta says engine-state:3/.test(r.out),
    `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
}

// A4: DRIFTED — self-consistent but out of step with the live world,
// BOTH loss directions named: a row deleted from the snapshot is a
// live-only job a restore would NOT bring back; a phantom row added to
// the snapshot is a dead-world job it WOULD resurrect.
{
  const { p, cleanup } = snapCopy((s) => {
    const gone = s.data.job.pop();
    s.meta.counts.job -= 1; // self-consistent: NOT a lie, a drift
    s.meta.removedId = gone.id; // for the assertion below
  });
  const removedId = JSON.parse(readFileSync(p, "utf8")).meta.removedId;
  const r = doctor(p);
  cleanup();
  const liveOnlyOk =
    r.code === 1 && r.out.includes("restore would NOT bring back") &&
    r.out.includes(removedId);
  const { p: p2, cleanup: cleanup2 } = snapCopy((s) => {
    const ghost = { ...s.data.job[0], id: "t1161-ghost-job" };
    s.data.job.push(ghost);
    s.meta.counts.job += 1; // self-consistent: NOT a lie, a drift
  });
  const r2 = doctor(p2);
  cleanup2();
  const snapOnlyOk =
    r2.code === 1 && r2.out.includes("restore would resurrect") &&
    r2.out.includes("t1161-ghost-job");
  ok("A4 DRIFTED — both loss directions named (NOT bring back / resurrect)",
    liveOnlyOk && snapOnlyOk,
    `liveOnly=${liveOnlyOk} snapOnly=${snapOnlyOk} r=${r.out.split("\n")[0] || ""} r2=${r2.out.split("\n")[0] || ""}`);
}

// A5: DRIFTED — the exportedAt pushed into the past makes every live
// row "updated after the snapshot" (the freshness check, provoked).
{
  const { p, cleanup } = snapCopy((s) => {
    s.meta.exportedAt = "2020-01-01T00:00:00.000Z";
  });
  const r = doctor(p);
  cleanup();
  ok("A5 DRIFTED — rows updated after exportedAt name the world's motion",
    r.code === 1 && /updated after the snapshot/.test(r.out),
    `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
}

// A6: FRESH — a live export rides the current HEAD, so the doctor
// certifies it (same instant, same world).
{
  const dir = mkdtempSync(path.join(tmpdir(), "t1161-fresh-"));
  const p = path.join(dir, "fresh.json");
  try {
    execFileSync("node", [SRC, "export", p], { cwd: REPO, timeout: 120_000 });
    const r = doctor(p);
    ok("A6 FRESH — a just-exported snapshot is certified (exit 0)",
      r.code === 0 && /\bFRESH —/.test(r.out) && /job IDs equal/.test(r.out),
      `exit=${r.code} out=${r.out.split("\n")[0] || ""}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- B — the source law ----------
// B1: the verdict ladder, loudest first (LIED before DRIFTED before
// the STALE/FRESH pair) — the order IS the law.
ok("B1 the verdict ladder is ordered — LIED, then DRIFTED, then the pair",
  src.indexOf("world-snapshot doctor: LIED") < src.indexOf("world-snapshot doctor: DRIFTED") &&
  src.indexOf("world-snapshot doctor: DRIFTED") < src.indexOf("world-snapshot doctor: STALE") &&
  src.indexOf("world-snapshot doctor: STALE") < src.indexOf("world-snapshot doctor: FRESH"));

// B2: READ-ONLY — the doctor's body writes nothing, deletes nothing.
{
  const body = src.slice(src.indexOf("async function cmdDoctor"), src.indexOf("const cmd = process.argv"));
  ok("B2 the doctor is READ-ONLY — no writes, no deletes in its body",
    !/writeFileSync|deleteMany|rmSync|createMany/.test(body));
}

// B3: exit codes — LIED/DRIFTED exit 1, STALE/FRESH exit 0.
ok("B3 the exit-code law — LIED/DRIFTED 1, STALE/FRESH 0",
  /doctor: LIED[\s\S]*?process\.exit\(1\)/.test(src) &&
  /doctor: DRIFTED[\s\S]*?process\.exit\(1\)/.test(src) &&
  /doctor: STALE[\s\S]*?process\.exit\(0\)/.test(src) &&
  /doctor: FRESH[\s\S]*?process\.exit\(0\)/.test(src));

// B4: the job-ID ledger names BOTH loss directions.
ok("B4 the ledger is two-sided — live-only AND snapshot-only named",
  src.includes("liveOnly") && src.includes("snapOnly") &&
  src.includes("restore would NOT bring back") &&
  src.includes("restore would resurrect"));

// B5: the freshness slack — 1s between the dump and the timestamp.
ok("B5 the freshness slack — exportedAt + 1000ms, not a hair-trigger",
  /exportedAt \+ 1000/.test(src));

// B6: the URL jurisdiction — the doctor counts in the lane the URL names.
ok("B6 the URL jurisdiction — the doctor's live counts ride DB_URL",
  /async function cmdDoctor[\s\S]*?openClient\(DB_URL\)/.test(src));

// ---------- C — the doctrine ----------
// C1: the tracked snapshot is self-consistent (the t1160 tooth, kept).
ok("C1 the tracked snapshot keeps its oath — counts match the data",
  existsSync(SNAP) && (() => {
    try {
      const s = JSON.parse(readFileSync(SNAP, "utf8"));
      return Object.entries(s.meta.counts).every(
        ([m, n]) => (s.data[m] || []).length === n,
      );
    } catch { return false; }
  })());

// C2: the verdict ladder is spoken in the header (the birthplace law).
ok("C2 the header speaks the ladder — LIED/DRIFTED/STALE/FRESH documented",
  /\*\s+doctor\s+is the tracked snapshot still FRESH/.test(src) &&
  src.includes("LIED     meta.counts disagree") &&
  src.includes("DRIFTED  the live world has moved"));

// C3: the usage line carries the doctor (discoverability).
ok("C3 the usage line carries doctor — export|restore|selftest|doctor",
  /export\|restore\|selftest\|doctor/.test(src));

// C4: the recovery rides the doctor — reboot-recover's step 3.5 exists,
// speaks first, and never auto-restores a living world.
ok("C4 the recovery integration — step 3.5 speaks the doctor, empty-only restore",
  existsSync(RECOVER) && (() => {
    const r = readFileSync(RECOVER, "utf8");
    return /3\.5 snapshot doctor \(t1161\)/.test(r) &&
      /world-snapshot\.mjs doctor/.test(r) &&
      r.indexOf("3.5 snapshot doctor") < r.indexOf("4. build") &&
      /REBOOT_SNAPSHOT_RESTORE/.test(r);
  })());

console.log(`\nSNAPSHOT-DOCTOR-UNIT t1161: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
