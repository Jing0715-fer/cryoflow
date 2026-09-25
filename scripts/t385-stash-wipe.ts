/**
 * t385 — the rename-aside wipe's bench (bun run scripts/t385-stash-wipe.ts).
 *
 * The field report the mechanism answers: "batch 1: SSH failed (timeout
 * after 180000ms) — after 2 attempt(s), the last on a fresh connection)"
 * — a synchronous unlink storm of the previous run's products on loaded
 * network storage has NO honest per-batch budget. The wipe is now a
 * RENAME-ASIDE: `mv` into <workdir>/.cryoflow_prev/<epoch>/, a
 * shell-builtin survivor loop as the only verdict, and a DETACHED nohup'd
 * reaper for the bytes. The bench plays the login node against real local
 * files, with the EXACT production bytes throughout:
 *
 *   B1  the classifier: the .cryoflow_prev archive NEVER enters the wipe
 *       set (the compounding-death fix — the next re-run must not drag
 *       the archived generation back onto the synchronous path);
 *   B2  the pure planning: class2d's root-level shape (no whole-tree
 *       candidates), extract's extra/ shape (one whole-tree rename when
 *       the cluster's count matches the listing), demotion on mismatch /
 *       a dead count round, and a kept entry under a tree blocking the
 *       whole-tree ride;
 *   B3  the count-round script + the move-batch script against REAL
 *       files — the survivors protocol (CF_STASH_SURVIVOR / CF_STASH_SURV),
 *       idempotent re-runs (a retry after a half-moved batch), the
 *       archive-path-is-a-file refusal shape, and spaces in the workdir;
 *   B4  the detached reaper: five generations → the newest two survive,
 *       the rest die in the background (polled), CF_RECLAIM_BG answered;
 *   B5  parseTreeCounts — the LAST field is the number, MISSING and
 *       garbage lines are skipped;
 *   B6  the source x-ray: remote-run's dispatch wipe rides the stash +
 *       reclaim, deleteRemoteFiles is gone from the dispatch path, and
 *       the refusal speaks the rename-aside doctrine.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  classifyRerunWipe,
  isRunArchivePath,
  RUN_ARCHIVE_DIRNAME as SRC_ARCHIVE,
} from "../src/lib/hpc/cleanup";
import {
  planStashUnits,
  wholeTreeCandidates,
  parseTreeCounts,
  treeCountScript,
  stashBatchScript,
  reclaimScript,
} from "../src/lib/remote/remote-cleanup";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const root = mkdtempSync(path.join(tmpdir(), "cf-t385-"));
const scriptsDir = path.join(root, ".scripts");
mkdirSync(scriptsDir);
let shN = 0;
/** Run a script through a real FILE (the exact bytes, zero quoting
 * layers — what ssh's exec channel delivers verbatim to the login
 * node). A nonzero exit WITH stdout is the script's own world (mv
 * diagnostics) — the output is the answer. */
const sh = (cmd: string, cwd: string): { out: string; code: number } => {
  const f = path.join(scriptsDir, `s${shN++}.sh`);
  writeFileSync(f, cmd);
  try {
    const out = execFileSync("bash", [f], { cwd, encoding: "utf8" });
    return { out, code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; status?: number };
    return { out: err.stdout ?? "", code: err.status ?? 1 };
  }
};
const exists = (p: string) => {
  try {
    return existsSync(p);
  } catch {
    return false;
  }
};
type Entry = { path: string; size: number; link?: boolean };

console.log("B1 — the classifier keeps the archive out of the wipe set");
{
  const listing: Entry[] = [
    { path: "run_it000_classes.mrcs", size: 2_000_000 },
    { path: "run_it050_classes.mrcs", size: 2_000_000 },
    { path: "run_it050_data.star", size: 90_000 },
    { path: "note.txt", size: 20 },
    { path: ".cf-remote-manifest.json", size: 400 },
    // the t370-era archive: a FULL previous generation, sitting inside
    { path: `${SRC_ARCHIVE}/1700000000000/run_it049_classes.mrcs`, size: 2_000_000 },
    { path: `${SRC_ARCHIVE}/1700000000000/extra/mic001.mrcs`, size: 10_000_000 },
    { path: `${SRC_ARCHIVE}/1700000000001/run_it000_classes.mrcs`, size: 2_000_000 },
  ];
  const { wipe, kept } = classifyRerunWipe(listing);
  const archiveInWipe = wipe.filter((p) => isRunArchivePath(p));
  check("no archived file enters the wipe set", archiveInWipe.length === 0, archiveInWipe.join(", "));
  check("the live products still wipe", wipe.length === 3, `wipe=${wipe.length}`);
  check("the archive counts as surviving (it does — detached)", kept.count === 5, `kept=${kept.count}`);
  check("isRunArchivePath grammar", isRunArchivePath(SRC_ARCHIVE) && isRunArchivePath(`${SRC_ARCHIVE}/x/y`) && !isRunArchivePath("cryoflow_prev/x") && !isRunArchivePath("extra/.cryoflow_prevish"));
}

console.log("B2 — the pure planning: collapse, demotion, blocking");
{
  // class2d shape: everything root-level — no whole-tree candidates
  const c2d: Entry[] = [
    { path: "run_it000_classes.mrcs", size: 1 },
    { path: "run_it050_classes.mrcs", size: 1 },
    { path: "run_it050_data.star", size: 1 },
    { path: "note.txt", size: 1 },
  ];
  const c2dWipe = classifyRerunWipe(c2d).wipe;
  check("class2d: no whole-tree candidates", wholeTreeCandidates(c2dWipe, c2d).length === 0);
  const c2dPlan = planStashUnits(c2dWipe, c2d, null);
  check("class2d: all per-file", c2dPlan.files.length === 3 && c2dPlan.wholeTrees.length === 0);

  // extract shape: extra/ holds the stacks, the keeps live at root
  const ex: Entry[] = [
    { path: "extra/mic001.mrcs", size: 10 },
    { path: "extra/mic002.mrcs", size: 10 },
    { path: "extra/mic003.mrcs", size: 10 },
    { path: "particles.star", size: 5 },
    { path: "note.txt", size: 1 },
    { path: ".cf-remote-manifest.json", size: 1 },
    { path: "micrographs", size: 0, link: true },
  ];
  const exWipe = classifyRerunWipe(ex).wipe;
  check("extract: extra/ is the one candidate", JSON.stringify(wholeTreeCandidates(exWipe, ex)) === JSON.stringify(["extra"]));
  const good = planStashUnits(exWipe, ex, new Map([["extra", 3]]));
  check("count match → one whole-tree ride", good.wholeTrees.length === 1 && good.wholeTrees[0] === "extra" && good.files.length === 1 && good.files[0] === "particles.star");
  const mismatch = planStashUnits(exWipe, ex, new Map([["extra", 4]]));
  check("count mismatch → demoted to per-file", mismatch.wholeTrees.length === 0 && mismatch.files.length === 4 && mismatch.demotedTrees.includes("extra"));
  const dead = planStashUnits(exWipe, ex, null);
  check("dead count round → per-file everywhere", dead.wholeTrees.length === 0 && dead.files.length === 4);

  // a kept entry UNDER a tree blocks the whole-tree ride (unknown = keep)
  const blocked: Entry[] = [
    { path: "extra/mic001.mrcs", size: 10 },
    { path: "extra/manual_notes.md", size: 3 }, // unknown, nested — KEEP
  ];
  const blockedWipe = classifyRerunWipe(blocked).wipe;
  check("kept-under-tree blocks the candidate", wholeTreeCandidates(blockedWipe, blocked).length === 0);
  const blockedPlan = planStashUnits(blockedWipe, blocked, new Map([["extra", 2]]));
  check("blocked tree still moves per-file", blockedPlan.wholeTrees.length === 0 && blockedPlan.files.length === 1);
}

console.log("B3 — the exact scripts against real local files");
{
  // ---- the class2d world: root-level products, the keep-set survives
  const W = path.join(root, "class2d_job");
  mkdirSync(W);
  for (const n of ["run_it000_classes.mrcs", "run_it050_classes.mrcs", "run_it050_data.star", "run_it050_model.star"]) {
    writeFileSync(path.join(W, n), "x".repeat(64));
  }
  writeFileSync(path.join(W, "note.txt"), "mine");
  writeFileSync(path.join(W, ".cf-remote-manifest.json"), "{}");
  const listing: Entry[] = [
    ...["run_it000_classes.mrcs", "run_it050_classes.mrcs", "run_it050_data.star", "run_it050_model.star"].map((p) => ({ path: p, size: 64 })),
    { path: "note.txt", size: 4 },
    { path: ".cf-remote-manifest.json", size: 2 },
  ];
  const wipe = classifyRerunWipe(listing).wipe;
  const plan = planStashUnits(wipe, listing, null);
  const epoch = "1700000100000";
  const script = stashBatchScript(W, `${SRC_ARCHIVE}/${epoch}`, plan.files);
  const r1 = sh(script, W);
  check("class2d run: the survivor verdict is 0", /CF_STASH_SURV 0/.test(r1.out), r1.out.trim());
  check("class2d run: the products moved", !exists(path.join(W, "run_it000_classes.mrcs")) && !exists(path.join(W, "run_it050_model.star")));
  check("class2d run: the archive holds them", exists(path.join(W, SRC_ARCHIVE, epoch, "run_it000_classes.mrcs")));
  check("class2d run: note + ledger stay", exists(path.join(W, "note.txt")) && exists(path.join(W, ".cf-remote-manifest.json")));
  check("class2d script: one mv, no per-file fork", (script.match(/^mv -f -- "\$@" "\$A\/"$/m) ?? []).length === 1);

  // idempotent re-run (a retry after a HALF-moved batch — the exact
  // half-death the fresh-wire retry produces): same script, again
  const r2 = sh(script, W);
  check("re-run: still SURV 0 (moved units are absent, not failures)", /CF_STASH_SURV 0/.test(r2.out), r2.out.trim());
  check("re-run: exit 0 despite mv's diagnostics", r2.code === 0, `code=${r2.code}`);

  // ---- the extract world: extra/ rides ONE rename, the count round earns it
  const E = path.join(root, "extract_job");
  mkdirSync(path.join(E, "extra"), { recursive: true });
  for (const n of ["mic001.mrcs", "mic002.mrcs", "mic003.mrcs"]) {
    writeFileSync(path.join(E, "extra", n), "y".repeat(1024));
  }
  writeFileSync(path.join(E, "particles.star"), "p");
  writeFileSync(path.join(E, "note.txt"), "n");
  const eListing: Entry[] = [
    { path: "extra/mic001.mrcs", size: 1024 },
    { path: "extra/mic002.mrcs", size: 1024 },
    { path: "extra/mic003.mrcs", size: 1024 },
    { path: "particles.star", size: 1 },
    { path: "note.txt", size: 1 },
  ];
  const eWipe = classifyRerunWipe(eListing).wipe;
  const cands = wholeTreeCandidates(eWipe, eListing);
  const countOut = sh(treeCountScript(E, cands), E).out;
  const counts = parseTreeCounts(countOut);
  check("count round: the cluster counted 3 under extra/", counts.get("extra") === 3, countOut.trim());
  const ePlan = planStashUnits(eWipe, eListing, counts);
  check("extract plan: one whole-tree + one file", ePlan.wholeTrees.length === 1 && ePlan.files.length === 1);
  const eEpoch = "1700000200000";
  const eScript = stashBatchScript(E, `${SRC_ARCHIVE}/${eEpoch}`, [...ePlan.wholeTrees, ...ePlan.files]);
  const e1 = sh(eScript, E);
  check("extract run: SURV 0", /CF_STASH_SURV 0/.test(e1.out), e1.out.trim());
  check("extract run: the whole tree moved in the one rename", !exists(path.join(E, "extra")) && exists(path.join(E, SRC_ARCHIVE, eEpoch, "extra", "mic002.mrcs")));
  check("extract run: particles.star moved too", !exists(path.join(E, "particles.star")) && exists(path.join(E, SRC_ARCHIVE, eEpoch, "particles.star")));
  check("extract run: note.txt stays", exists(path.join(E, "note.txt")));

  // ---- the count round's SAFETY property: an unlisted entry under the
  // tree (deeper than the listing's depth, past its cap) demotes the
  // whole-tree ride — and that entry SURVIVES the per-file fallback
  const U = path.join(root, "unlisted_job");
  mkdirSync(path.join(U, "extra"), { recursive: true });
  for (const n of ["a.mrcs", "b.mrcs"]) {
    writeFileSync(path.join(U, "extra", n), "z");
  }
  writeFileSync(path.join(U, "extra", "manual_notes.md"), "unknown nested"); // NOT in the listing
  const uListing: Entry[] = [
    { path: "extra/a.mrcs", size: 1 },
    { path: "extra/b.mrcs", size: 1 },
  ];
  const uWipe = classifyRerunWipe(uListing).wipe;
  const uCounts = parseTreeCounts(sh(treeCountScript(U, wholeTreeCandidates(uWipe, uListing)), U).out);
  check("unlisted entry: the cluster counted 3, the listing saw 2", uCounts.get("extra") === 3);
  const uPlan = planStashUnits(uWipe, uListing, uCounts);
  check("unlisted entry: the tree ride is refused", uPlan.wholeTrees.length === 0 && uPlan.files.length === 2);
  const uEpoch = "1700000300000";
  sh(stashBatchScript(U, `${SRC_ARCHIVE}/${uEpoch}`, uPlan.files), U);
  check("unlisted entry: the stacks moved per-file", !exists(path.join(U, "extra", "a.mrcs")) && exists(path.join(U, SRC_ARCHIVE, uEpoch, "a.mrcs")));
  check("unlisted entry: the unknown SURVIVES at its live position (the contract)", exists(path.join(U, "extra", "manual_notes.md")));

  // ---- the refusal shape: the archive path exists as a FILE — mkdir
  // fails, every mv fails, the survivor loop names EVERYTHING
  const F = path.join(root, "refusal_job");
  mkdirSync(F);
  for (const n of ["run_it000_classes.mrcs", "run_it001_classes.mrcs", "particles.star"]) {
    writeFileSync(path.join(F, n), "x");
  }
  const fEpoch = "1700000400000";
  mkdirSync(path.join(F, SRC_ARCHIVE));
  writeFileSync(path.join(F, SRC_ARCHIVE, fEpoch), "a file where the archive dir should be");
  const fScript = stashBatchScript(F, `${SRC_ARCHIVE}/${fEpoch}`, ["run_it000_classes.mrcs", "run_it001_classes.mrcs", "particles.star"]);
  const f1 = sh(fScript, F);
  check("refusal: SURV 3 — nothing provably moved", /CF_STASH_SURV 3/.test(f1.out), f1.out.trim());
  check("refusal: every survivor is named", (f1.out.match(/CF_STASH_SURVIVOR /g) ?? []).length === 3);
  check("refusal: the live files all still sit there", exists(path.join(F, "run_it000_classes.mrcs")) && exists(path.join(F, "particles.star")));

  // ---- spaces in the workdir (the t384 B5 doctrine)
  const S = path.join(root, "my extract job");
  mkdirSync(S, { recursive: true });
  writeFileSync(path.join(S, "particles.star"), "x");
  const sEpoch = "1700000500000";
  const s1 = sh(stashBatchScript(S, `${SRC_ARCHIVE}/${sEpoch}`, ["particles.star"]), S);
  check("spaces: SURV 0 through the single-quote wrappers", /CF_STASH_SURV 0/.test(s1.out), s1.out.trim());
  check("spaces: the file moved", exists(path.join(S, SRC_ARCHIVE, sEpoch, "particles.star")));
}

console.log("B4 — the detached reaper: keep the newest two, eat the rest");
{
  const W = path.join(root, "reaper_job");
  mkdirSync(path.join(W, SRC_ARCHIVE), { recursive: true });
  const gens: string[] = [];
  for (let i = 0; i < 5; i++) {
    const g = String(1700000600000 + i * 1000);
    gens.push(g);
    mkdirSync(path.join(W, SRC_ARCHIVE, g));
    writeFileSync(path.join(W, SRC_ARCHIVE, g, "run_it000_classes.mrcs"), "x".repeat(256));
    // distinct mtimes so the %T@ sort is deterministic
    execFileSync("touch", ["-d", `2024-01-01 00:00:${String(i).padStart(2, "0")}`, path.join(W, SRC_ARCHIVE, g)]);
  }
  const r = sh(reclaimScript(W, 2), W);
  check("reaper: answered CF_RECLAIM_BG", /CF_RECLAIM_BG/.test(r.out), r.out.trim());
  check("reaper: the script itself exited instantly (code 0)", r.code === 0);
  // the background reaper is fire-and-forget — poll for its verdict
  const deadline = Date.now() + 10_000;
  let settled = false;
  while (Date.now() < deadline) {
    const alive = readdirSync(path.join(W, SRC_ARCHIVE)).sort();
    if (alive.length === 2) {
      settled = true;
      check("reaper: exactly the newest two generations survive", JSON.stringify(alive) === JSON.stringify([gens[3], gens[4]]), alive.join(","));
      break;
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  if (!settled) {
    check("reaper: exactly the newest two generations survive", false, readdirSync(path.join(W, SRC_ARCHIVE)).join(","));
  }
  // an empty/no archive world: the script no-ops cleanly
  const E2 = path.join(root, "no_archive_job");
  mkdirSync(E2, { recursive: true });
  const r2 = sh(reclaimScript(E2, 2), E2);
  check("reaper: no archive dir → clean no-op, still answered", r2.code === 0 && !/CF_RECLAIM_BG/.test(r2.out));
}

console.log("B5 — parseTreeCounts dialect");
{
  const m = parseTreeCounts(["extra 3", "my seg 7", "gone MISSING", "", "garbage", "neg -1", "run_it 0"].join("\n"));
  check("plain segment", m.get("extra") === 3);
  check("segment with a space (the LAST field is the number)", m.get("my seg") === 7);
  check("MISSING skipped", !m.has("gone"));
  check("garbage and negatives skipped, zero accepted", !m.has("garbage") && !m.has("neg") && m.get("run_it") === 0);
}

console.log("B6 — the source x-ray: the dispatch rides the stash");
{
  const remoteRun = readFileSync("src/lib/remote/remote-run.ts", "utf8");
  const remoteCleanup = readFileSync("src/lib/remote/remote-cleanup.ts", "utf8");
  const cleanup = readFileSync("src/lib/hpc/cleanup.ts", "utf8");
  check("remote-run wires the stash", remoteRun.includes("stashRemoteRunProducts(") && remoteRun.includes("reclaimRemoteArchiveGens("));
  check("remote-run's dispatch no longer unlinks (deleteRemoteFiles is the cleanup dialog's own)", !remoteRun.includes("deleteRemoteFiles"));
  check("remote-run's refusal speaks the rename-aside", remoteRun.includes("rename-aside") && remoteRun.includes("reclaimed in the background"));
  check("remote-cleanup carries the stash exports", remoteCleanup.includes("export async function stashRemoteRunProducts") && remoteCleanup.includes("export async function reclaimRemoteArchiveGens") && remoteCleanup.includes("const STASH_BATCH = 180"));
  check("the reaper is SIGHUP-proof nohup", /nohup sh -c .*<\/dev\/null &/.test(remoteCleanup.replace(/\n/g, " ").replace(/ {2,}/g, " ")));
  check("the classifier gates the archive out", cleanup.includes("isRunArchivePath(f.path)") && cleanup.includes("RUN_ARCHIVE_DIRNAME"));
}

rmSync(root, { recursive: true, force: true });
console.log(`\nt385 stash-wipe bench: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
