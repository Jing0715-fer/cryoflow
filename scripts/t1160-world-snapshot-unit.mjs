#!/usr/bin/env node
/**
 * t1160 — THE WORLD-SNAPSHOT unit: the world's death is a command, not
 * an afternoon (the NEW map's eighth vein — the durability vein).
 *
 * The world died twice in one week (the t418 disaster's echo, then
 * t1159's recycle that zeroed db/cryoflow.db and emptied the mock fs);
 * each rebirth cost three chain rounds, two watchdog rides and an
 * afternoon. The t1160 cure: scripts/world-snapshot.mjs — the 9-model
 * DB truth (FK-safe order, IDs preserved) + the engine-state file,
 * frozen into ONE tracked JSON (fixtures/world-snapshot.json), restorable
 * in one command. The FILE half of the world (workdirs under data/relion/)
 * is honestly OUT of the snapshot — a restored job is DB-complete but
 * file-hollow, and the chain (demo-chain-resurrect.mjs) re-runs what
 * needs files; the boundary is written at the birthplace.
 *
 * A the instrument runs FOR REAL (the selftest subprocess: 7 pins green,
 * export determinism byte-equal); B the source law (the FK-safe roster,
 * the two-pass self-FK, the URL jurisdiction — CRYOFLOW_DB_URL overrides,
 * the dev lane default, never the template leak; restore never touches a
 * lane its URL didn't name); C the doctrine (the file-half boundary, the
 * snapshot's self-consistency, the tracked home the recycle cannot eat).
 */
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO = "/home/z/my-project";
const SRC = `${REPO}/scripts/world-snapshot.mjs`;
const SNAP = `${REPO}/fixtures/world-snapshot.json`;

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

// ---------- A — the instrument runs FOR REAL ----------
let selftestOut = "";
let selftestCode = 0;
try {
  selftestOut = execFileSync("node", [SRC, "selftest"], {
    cwd: REPO,
    timeout: 150_000,
    encoding: "utf8",
  });
} catch (e) {
  selftestCode = e.status ?? 1;
  selftestOut = String(e.stdout || e);
}
ok("A1 the selftest subprocess exits 0",
  selftestCode === 0, `exit=${selftestCode}`);
ok("A2 the selftest speaks its seven pins",
  /PASS 7\b/.test(selftestOut) && /7\/7 pins/.test(selftestOut),
  selftestOut.split("\n")[0] || "");
ok("A3 the export is deterministic — two runs, byte-equal data payload", (() => {
  if (!existsSync(SNAP)) return false;
  const dir = mkdtempSync(path.join(tmpdir(), "t1160-"));
  try {
    const a = path.join(dir, "a.json");
    const b = path.join(dir, "b.json");
    execFileSync("node", [SRC, "export", a], { cwd: REPO, timeout: 120_000 });
    execFileSync("node", [SRC, "export", b], { cwd: REPO, timeout: 120_000 });
    const da = JSON.parse(readFileSync(a, "utf8"));
    const db_ = JSON.parse(readFileSync(b, "utf8"));
    return JSON.stringify(da.data) === JSON.stringify(db_.data);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})());

// ---------- B — the source law ----------
ok("B1 the roster is FK-safe — parents precede children, wipe walks it backwards",
  src.indexOf('"project"') < src.indexOf('"workspace"') &&
  src.indexOf('"workspace"') < src.indexOf('"job"') &&
  src.indexOf('"job"') < src.indexOf('"edge"') &&
  /\[\.\.\.MODELS\]\.reverse\(\)/.test(src));
ok("B2 the self-FK rides two passes — detached createMany, then the link update",
  /m === "job"/.test(src) &&
  /linkedJobId, \.\.\.rest \}/.test(src) &&
  /prisma\.job\.update\(\{/.test(src));
ok("B3 the URL jurisdiction — CRYOFLOW_DB_URL overrides, the dev lane default",
  src.includes("process.env.CRYOFLOW_DB_URL") &&
  src.includes("db/cryoflow.db"));
ok("B4 the restore's honesty — it wipes by design and names the file half",
  /deleteMany/.test(src) &&
  src.includes("demo-chain-resurrect.mjs"));
ok("B5 the engine-state rides the snapshot — read at export, written at restore",
  src.includes("data/engine-state.json"));

// ---------- C — the doctrine ----------
ok("C1 the snapshot exists at its tracked home with meta",
  existsSync(SNAP) && (() => {
    try {
      const s = JSON.parse(readFileSync(SNAP, "utf8"));
      return s.meta && s.meta.head && s.meta.counts;
    } catch { return false; }
  })());
ok("C2 the snapshot is self-consistent — the counts match the data", (() => {
  try {
    const s = JSON.parse(readFileSync(SNAP, "utf8"));
    return Object.entries(s.meta.counts).every(
      ([m, n]) => (s.data[m] || []).length === n,
    );
  } catch { return false; }
})());
ok("C3 the file-half boundary is spoken at the birthplace",
  src.includes("file-hollow") && src.includes("NOT in the snapshot"));
ok("C4 the world's job spine rides the snapshot — a completed world, not a stub",
  (() => {
    try {
      const s = JSON.parse(readFileSync(SNAP, "utf8"));
      const jobs = s.data.job || [];
      return jobs.length >= 10 &&
        jobs.every((j) => j.type && j.name && j.status);
    } catch { return false; }
  })());

console.log(`\nWORLD-SNAPSHOT-UNIT t1160: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
