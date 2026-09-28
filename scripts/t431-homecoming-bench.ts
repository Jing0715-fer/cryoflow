/**
 * t431 bench — the homecoming truth on every surface.
 *
 * The stay receipt ("24 image file(s) stayed on the cluster — …") is
 * history written at sync-back time; t429 taught the inspector and the
 * panel an epilogue. t431 lifts the truth number into the jobs LIST as a
 * per-DTO annotation (remainingForRun) and gives the compact surfaces
 * (canvas card, minimap, dashboard) a dialect-aware renderer
 * (compactStayReceipt / stayReceiptHead + the card's HomecomingChip).
 *
 * Sections:
 *   H1 (lib, pure):  stayReceiptHead / compactStayReceipt — the
 *                    sync-policy wordings × states × envelope matrix
 *   R1 (lib, tmp):   remainingFromWorkdir / remainingForRun — manifest ×
 *                    existsSync arithmetic against a temp workdir
 *   W1 (real world): the demo extract job's workdir counts 0/27 (the
 *                    t425 bring-home); skipped honestly when no demo
 *                    world is on disk
 *
 * World contract: H1/R1 are world-free (tmp dirs only). W1 self-pins the
 * repo data tree (t428 lesson — a bench declares which world it reads)
 * and only ever READS.
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                    */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t431-home-"));
const DATA_DIR = path.join(TMP, "data");
const DB_PATH = path.join(TMP, "test.db");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;
process.env.DATABASE_URL = `file:${DB_PATH}`;
execSync("bunx prisma db push --skip-generate", {
  cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  stdio: "pipe",
});

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

/* ------------------------------------------------------------------ */
/* Imports (after env)                                                 */
/* ------------------------------------------------------------------ */

const { isStayReceipt, stayReceiptHead, compactStayReceipt } = await import(
  "../src/lib/remote/stay-receipt"
);
const { remainingFromWorkdir, remainingForRun } = await import(
  "../src/lib/remote/remote-remaining"
);
const { writeRemoteManifest, REMOTE_MANIFEST_NAME } = await import(
  "../src/lib/remote/remote-files"
);

/* ------------------------------------------------------------------ */
/* H1 — the dialect matrix (pure string work)                          */
/* ------------------------------------------------------------------ */

console.log("H1. stayReceiptHead / compactStayReceipt — wordings × states");

// the exact dialect the engine writes (sync-policy.ts:158-198 + the
// remote-run.ts t367 composition: envelope + payload + " — " + receipt)
const metaReceipt =
  "24 image file(s) stayed on the cluster — extract jobs sync metadata only under the key-files policy (STAR, logs and plots come home; image stacks never do, whatever their size). They are listed in this job's Results — open or download one to fetch it on demand — or switch the connection's sync policy to \"everything\" to bring them home";
const remoteResult = `REMOTE[cryo@127.0.0.1:3022 · relion/5.0.1]: 96 particles extracted — ${metaReceipt}`;
const bulkyReceipt =
  "3 bulky file(s) stayed on the cluster (key-files policy): run_it025_classes.mrcs, run_it025_data.star, run.err — they are listed in this job's Results; preview or download them there on demand";
const capsReceipt =
  "2 file(s) stayed on the cluster (caps): big1.mrc, big2.mrc — raise the sync caps in the connection settings or fetch them manually from /projects/x";
const earlierMixed = `${metaReceipt} — 3 file(s) in the workdir were left behind by an EARLIER run of this job (run_it024_classes.mrcs) — they predate this dispatch`;

const expectedHead = "REMOTE[cryo@127.0.0.1:3022 · relion/5.0.1]: 96 particles extracted";

must(isStayReceipt(remoteResult), "H1.1 the composed result IS a stay receipt");
must(
  stayReceiptHead(remoteResult) === expectedHead,
  "H1.2 head cuts the meta receipt to envelope + payload"
);
must(
  compactStayReceipt(remoteResult, 0) === `${expectedHead} · all brought home`,
  "H1.3 resolved → '<head> · all brought home'"
);
must(
  compactStayReceipt(remoteResult, 3) === `${expectedHead} · 3 still on cluster`,
  "H1.4 pending → '<head> · 3 still on cluster'"
);
must(
  compactStayReceipt(remoteResult, undefined) === remoteResult &&
    compactStayReceipt(remoteResult, null) === remoteResult,
  "H1.5 truth not loaded (undefined|null) → byte-identical pass-through"
);
must(
  compactStayReceipt("96 particles extracted — REAL run", 0) ===
    "96 particles extracted — REAL run",
  "H1.6 non-receipt result → untouched even when truth is loaded"
);
must(stayReceiptHead("96 particles extracted") === null, "H1.7 head of a non-receipt → null");

must(
  isStayReceipt(bulkyReceipt) && stayReceiptHead(bulkyReceipt) === null,
  "H1.8 bulky wording — a standalone note has no ' — ' lead boundary → head null"
);
must(
  isStayReceipt(capsReceipt) && stayReceiptHead(capsReceipt) === null,
  "H1.9 caps wording standalone → head null (boundary ' — ' absent)"
);
must(
  !isStayReceipt(earlierMixed) && compactStayReceipt(earlierMixed, 0) === earlierMixed,
  "H1.10 EARLIER-run mix → never declared resolved, byte-identical"
);
must(
  stayReceiptHead(`REAL: 33 particles extracted — ${metaReceipt}`) ===
    "REAL: 33 particles extracted",
  "H1.11 REAL-lane result cuts to the same payload law"
);

/* ------------------------------------------------------------------ */
/* R1 — the manifest × existsSync arithmetic (temp workdir)            */
/* ------------------------------------------------------------------ */

console.log("R1. remainingFromWorkdir / remainingForRun — the truth arithmetic");

const work = path.join(TMP, "extract_tmp");
mkdirSync(path.join(work, "extra"), { recursive: true });
writeFileSync(path.join(work, "extra", "mic_001.mrcs"), "a");
writeFileSync(path.join(work, "extra", "mic_002.mrcs"), "bb");
// mic_003 deliberately absent
writeRemoteManifest(work, {
  connectionId: "conn-bench",
  remoteWorkdir: "/projects/x/extract_tmp",
  files: [
    { path: "extra/mic_001.mrcs", size: 1 },
    { path: "extra/mic_002.mrcs", size: 2 },
    { path: "extra/mic_003.mrcs", size: 3 },
  ],
});

must(remainingFromWorkdir(work).remaining === 1, "R1.1 one of three entries still out");
must(remainingFromWorkdir(work).total === 3, "R1.2 total counts the manifest, not the disk");

writeFileSync(path.join(work, "extra", "mic_003.mrcs"), "ccc");
must(
  remainingFromWorkdir(work).remaining === 0 && remainingFromWorkdir(work).total === 3,
  "R1.3 the file lands → 0/3 (bring-home flips the judgment)"
);

const emptyWork = path.join(TMP, "no_manifest");
mkdirSync(emptyWork, { recursive: true });
must(
  remainingFromWorkdir(emptyWork).remaining === 0 && remainingFromWorkdir(emptyWork).total === 0,
  "R1.4 no manifest → vacuously all-home 0/0"
);

const { upsertRun, getRun } = await import("../src/lib/relion/engine");
import type { RunRecord } from "../src/lib/relion/engine";

const runBase = {
  projectId: "p",
  type: "extract",
  pid: null,
  cmd: "",
  workdir: work,
  logFile: path.join(work, "run.out"),
  errFile: path.join(work, "run.err"),
  startedAt: new Date().toISOString(),
  outputs: {},
  done: true,
  exitCode: 0,
};
upsertRun("bench-job-home", {
  ...runBase,
  jobId: "bench-job-home",
  remote: { mode: "ssh" } as unknown as RunRecord["remote"],
} as RunRecord);
upsertRun("bench-job-local", {
  ...runBase,
  jobId: "bench-job-local",
} as RunRecord);
must(
  JSON.stringify(remainingForRun(getRun("bench-job-home"))) ===
    JSON.stringify({ remaining: 0, total: 3 }),
  "R1.5 remote run → the annotation rides"
);
must(
  remainingForRun(getRun("bench-job-local")) === null,
  "R1.6 local-only run → no annotation (nothing to re-judge)"
);
must(remainingForRun(null) === null && remainingForRun(undefined) === null, "R1.7 no run → null");

/* ------------------------------------------------------------------ */
/* W1 — the real demo world (read-only; skipped when absent)           */
/* ------------------------------------------------------------------ */

console.log("W1. the demo extract workdir — the t425 bring-home, re-counted");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relionDir = path.join(ROOT, "data", "relion");
let counted = false;
try {
  const projects = readdirSync(relionDir) as string[];
  outer: for (const proj of projects) {
    const projDir = path.join(relionDir, proj);
    for (const jd of readdirSync(projDir) as string[]) {
      if (!jd.startsWith("extract_")) continue;
      const workdir = path.join(projDir, jd);
      const stat = remainingFromWorkdir(workdir);
      counted = true;
      console.log(`      (${jd}: ${stat.remaining}/${stat.total})`);
      must(stat.remaining === 0, `W1.1 ${jd} — every manifested file is home`);
      must(stat.total > 0, `W1.2 ${jd} — the manifest is non-empty (a real receipt world)`);
      break outer;
    }
  }
} catch {
  console.log("  skip  no demo world on disk (data/relion absent)");
}
if (!counted) console.log("  skip  no extract workdir found in data/relion");

/* ------------------------------------------------------------------ */

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(TMP, { recursive: true, force: true });
process.exit(fail === 0 ? 0 : 1);
