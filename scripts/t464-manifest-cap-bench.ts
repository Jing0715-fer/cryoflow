/**
 * t464 — the manifest picks its survivors bench.
 *
 * The sync-back ledger's enumeration stopped being a silent `head -20000`.
 * Every assertion below pins one law of the new grammar:
 *
 *   T1 — script grammar: the root stream (maxdepth 1 — the FINAL star
 *        family, note.txt, run.out/err) leads; the deep stream
 *        (mindepth 2 — rounds, volumes, per-mic graphs) follows; both
 *        exclude the ledger itself (.cf-*); the deep stream excludes the
 *        t385 wipe archive; head takes cap+1 (the canary); the caller's
 *        quoted workdir is what gets cd'd into.
 *   T2 — parser grammar: `rel\tsize\tmtimeSec` (first tab ends the path,
 *        last begins the mtime); a legacy two-field line parses size only;
 *        malformed lines (no tab, non-numeric size) are skipped, never
 *        invented into entries.
 *   T3 — the canary: fewer lines than the cap → complete; exactly the cap
 *        → complete (exactly-full is not cut); cap+1 → truncated, keep
 *        the first cap.
 *   T4 — the note's priority: the local walk's incompleteness outranks
 *        the ledger's, which outranks the display cap; nothing short →
 *        no note (honest silence is not noise).
 *   T5 — the flag travels: writeRemoteManifest persists truncated; a
 *        pre-t464 ledger (no flag) reads as undefined — complete-or-
 *        unknowable, never falsely flagged.
 *   T6 — REAL SHELL, synthetic tree: the actual script runs under bash
 *        against a workdir whose root family would LOSE a readdir-order
 *        cap race — and wins it: root set first, exclusions hold, the
 *        canary fires, round entries are all deep.
 *   T7 — REAL SHELL, the real class2d mirror (the tree t460's bug bit,
 *        11,464 files): at the default cap the enumeration is complete
 *        and root-first; at a small cap it admits the cut AND the final
 *        star family is still inside — the door never dies.
 *
 * World contract: pure functions + one real bash per T6/T7 group (local
 * fs stands in for the cluster shell — the script IS the artifact).
 * Run: bun run scripts/t464-manifest-cap-bench.ts
 */

import {
  manifestFindScript,
  parseManifestListing,
  describeListingNote,
  REMOTE_MANIFEST_MAX,
  writeRemoteManifest,
  readRemoteManifest,
} from "../src/lib/remote/remote-files";
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL — ${label}`);
  }
}

/** quote a path for the shell (the caller owns quoting — same as remote-run) */
function shQuote(p: string): string {
  return `'${p.replace(/'/g, `'\\''`)}'`;
}

/* ------------------------------------------------------------------ */
/* T1 — the script's grammar                                           */
/* ------------------------------------------------------------------ */

{
  console.log("T1 — manifestFindScript grammar");
  const script = manifestFindScript(20_000, shQuote("/cluster/runs/class2d"));
  must(script.startsWith("cd '/cluster/runs/class2d' 2>/dev/null && {"), "T1 cd into the quoted workdir");
  // the four bands, in order: door → root stars → root rest → deep
  const doorAt = script.indexOf("-name 'run_data.star'");
  const starsAt = script.indexOf("-name '*.star'");
  const rootRestAt = script.indexOf("-not -name '*.star'");
  const deepAt = script.indexOf("-mindepth 2");
  must(doorAt >= 0 && doorAt < starsAt && starsAt < rootRestAt && rootRestAt < deepAt, "T1 band order: door, root stars, root rest, deep");
  must(script.includes("\\( -name 'run_data.star' -o -name 'run_model.star' -o -name 'run_optimiser.star' \\)"), "T1 the door is pinned by exact name");
  must(script.split("-not -name '.cf-*'").length - 1 === 3, "T1 stars/rest/deep bands exclude the ledger itself");
  must(script.includes("-not -path './.cryoflow_prev/*'"), "T1 deep band excludes the wipe archive");
  must(script.split("-maxdepth 1").length - 1 === 3, "T1 three depth-1 bands, one deep band");
  must(script.includes("-printf '%P\\t%s\\t%T@\\n'"), "T1 t367 line grammar: rel, size, mtime");
  must(/head -20001$/.test(script), "T1 head takes cap+1 — the canary line");
  must(manifestFindScript(1, "'/x'").endsWith("head -2"), "T1 a cap of 1 still takes its canary");
}

/* ------------------------------------------------------------------ */
/* T2 — the parser's grammar                                           */
/* ------------------------------------------------------------------ */

{
  console.log("T2 — parseManifestListing grammar");
  const lines = [
    "run_data.star\t15234\t1759152000.1234567890",
    "it001/run_it001_data.star\t98812\t1759152001.5",
    "no-tab-line",
    "bad-size.star\tnot-a-number\t1759152002",
    "empty-size.star\t\t1759152003",
  ].join("\n");
  const out = parseManifestListing(lines, 100);
  must(out.entries.length === 2, "T2 malformed lines are skipped, not invented");
  must(out.entries[0].rel === "run_data.star" && out.entries[0].size === 15234, "T2 first tab ends the path, size follows");
  must(out.entries[0].mtimeSec === 1759152000.1234567890, "T2 the last tab begins the mtime");
  must(out.entries[1].mtimeSec === 1759152001.5, "T2 fraction mtime parses");
  must(out.truncated === false, "T2 well-under-cap output is complete");

  const legacy = "note.txt\t220\n"; // two fields only — a pre-t367 shape
  const lg = parseManifestListing(legacy, 10);
  must(lg.entries.length === 1 && lg.entries[0].size === 220, "T2 a legacy two-field line parses size");
  must(lg.entries[0].mtimeSec === undefined, "T2 a legacy line carries no mtime");
}

/* ------------------------------------------------------------------ */
/* T3 — the canary                                                     */
/* ------------------------------------------------------------------ */

{
  console.log("T3 — the cap+1 canary");
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => `f${String(i).padStart(4, "0")}.dat\t10\t1759152000`).join("\n");
  const under = parseManifestListing(mk(9), 10);
  must(under.truncated === false && under.entries.length === 9, "T3 fewer lines than the cap → complete");
  const exact = parseManifestListing(mk(10), 10);
  must(exact.truncated === false && exact.entries.length === 10, "T3 exactly the cap is NOT a cut");
  const over = parseManifestListing(mk(11), 10);
  must(over.truncated === true, "T3 one line past the cap fires the canary");
  must(over.entries.length === 10, "T3 the ledger keeps exactly the cap");
  must(over.entries[9].rel === "f0009.dat", "T3 the kept rows are the enumeration's first");
}

/* ------------------------------------------------------------------ */
/* T4 — the note's priority                                            */
/* ------------------------------------------------------------------ */

{
  console.log("T4 — describeListingNote priority");
  must(describeListingNote({ localTruncated: false, ledgerTruncated: false, displayTruncated: false, count: 42 }) === undefined, "T4 nothing short → no note");
  const local = describeListingNote({ localTruncated: true, ledgerTruncated: true, displayTruncated: true, count: 42 });
  must(local === "Listing truncated at 42 files", "T4 the local walk's cut outranks everything");
  const ledger = describeListingNote({ localTruncated: false, ledgerTruncated: true, displayTruncated: true, count: 42 });
  must(ledger !== undefined && ledger.includes("the cluster holds more than the manifest's cap"), "T4 the ledger's cut speaks the honest sentence");
  must(ledger !== undefined && ledger.includes("the final star family is pinned first"), "T4 the ledger's cut names the cure");
  const display = describeListingNote({ localTruncated: false, ledgerTruncated: false, displayTruncated: true, count: 42 });
  must(display === "Listing truncated at 42 files (remote manifest capped)", "T4 the display cap keeps its t289 dialect");
}

/* ------------------------------------------------------------------ */
/* T5 — the flag travels (real fs round-trip)                          */
/* ------------------------------------------------------------------ */

{
  console.log("T5 — the ledger's truncated flag round-trip");
  const dir = mkdtempSync(path.join(process.cwd(), ".qa-logs", "t464-ledger-"));
  try {
    writeRemoteManifest(dir, {
      connectionId: "conn-1",
      remoteWorkdir: "/cluster/runs/class2d",
      files: [{ path: "run_data.star", size: 15234 }],
      truncated: true,
    });
    const read = readRemoteManifest(dir);
    must(read != null && read.truncated === true, "T5 a capped enumeration writes the flag and reads it back");
    must(read != null && read.files.length === 1 && read.files[0].path === "run_data.star", "T5 the rows ride unchanged");

    writeRemoteManifest(dir, {
      connectionId: "conn-1",
      remoteWorkdir: "/cluster/runs/class2d",
      files: [],
      truncated: false,
    });
    const complete = readRemoteManifest(dir);
    must(complete != null && complete.truncated === false, "T5 an explicit false is written as an explicit false");

    // pre-t464 ledger — no flag key at all
    writeFileSync(path.join(dir, ".cf-remote-manifest.json"), JSON.stringify({ version: 1, writtenAt: "2026-01-01T00:00:00.000Z", connectionId: "c", remoteWorkdir: "/x", files: [] }), "utf8");
    const legacyRead = readRemoteManifest(dir);
    must(legacyRead != null && legacyRead.truncated === undefined, "T5 a pre-t464 ledger reads as unknowable, never falsely flagged");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ */
/* T6 — REAL SHELL, synthetic tree (a readdir race the root now wins)  */
/* ------------------------------------------------------------------ */

{
  console.log("T6 — real bash over a synthetic workdir");
  const dir = mkdtempSync(path.join(process.cwd(), ".qa-logs", "t464-tree-"));
  try {
    // the root family — in readdir order these trail the rounds; the new
    // grammar pins them ahead of everything
    for (const f of ["run_data.star", "run_model.star", "run_optimiser.star", "note.txt", "run.out"]) {
      writeFileSync(path.join(dir, f), "root\n");
    }
    writeFileSync(path.join(dir, ".cf-remote-manifest.json"), "{}\n"); // the ledger itself — excluded
    mkdirSync(path.join(dir, ".cryoflow_prev"));
    writeFileSync(path.join(dir, ".cryoflow_prev", "ghost.txt"), "the wipe's own product\n"); // excluded
    for (let it = 1; it <= 10; it++) {
      const sub = path.join(dir, `it${String(it).padStart(3, "0")}`);
      mkdirSync(sub);
      for (const suffix of ["data.star", "model.star", "optimiser.star"]) {
        writeFileSync(path.join(sub, `run_it${String(it).padStart(3, "0")}_${suffix}`), "round\n");
      }
    }
    const script = manifestFindScript(10, shQuote(dir));
    const run = spawnSync("bash", ["-c", script], { encoding: "utf8" });
    must(run.status === 0, "T6 the script exits 0 under real bash");
    const out = parseManifestListing(run.stdout, 10);
    must(out.truncated === true, "T6 35 files behind a cap of 10 → the canary fires");
    must(out.entries.length === 10, "T6 the ledger keeps the cap");
    const first5 = new Set(out.entries.slice(0, 5).map((e) => e.rel));
    must(
      first5.has("run_data.star") && first5.has("run_model.star") && first5.has("run_optimiser.star"),
      "T6 the FINAL family leads the capped ledger"
    );
    must(first5.has("note.txt") && first5.has("run.out"), "T6 the job's front-door files ride with it");
    must(out.entries.every((e) => !e.rel.startsWith(".cf-") && !e.rel.startsWith(".cryoflow_prev")), "T6 ledger + wipe archive never listed");
    must(out.entries.slice(5).every((e) => e.rel.includes("/")), "T6 what the cap spent itself on is all deep round history");
    must(out.entries.every((e) => typeof e.mtimeSec === "number" && e.mtimeSec! > 0), "T6 every real line carries its mtime");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ */
/* T7 — REAL SHELL, the real class2d mirror (the tree t460 bit)        */
/* ------------------------------------------------------------------ */

{
  console.log("T7 — real bash over the real class2d mirror (11,464 files)");
  const dir = path.join(process.cwd(), "data", "relion", "cmukrk2yy0000rjobryvy0pzu", "class2d_rlhupb8a");
  const DOOR = ["run_data.star", "run_model.star", "run_optimiser.star"];

  // full cap — the default world: complete, and the door leads
  const fullRun = spawnSync("bash", ["-c", manifestFindScript(REMOTE_MANIFEST_MAX, shQuote(dir))], { encoding: "utf8" });
  must(fullRun.status === 0, "T7 the script exits 0 against the real tree");
  const full = parseManifestListing(fullRun.stdout, REMOTE_MANIFEST_MAX);
  must(full.truncated === false, "T7 at the default cap the real world is complete — no false alarm");
  must(full.entries.length === 11464, "T7 every real file is listed (the t460 census)");
  const fullRels = new Set(full.entries.map((e) => e.rel));
  must(DOOR.every((d) => fullRels.has(d)), "T7 the FINAL family is in the ledger");
  const firstDeep = full.entries.findIndex((e) => e.rel.includes("/"));
  const lead = new Set(full.entries.slice(0, firstDeep < 0 ? undefined : firstDeep).map((e) => e.rel));
  must(DOOR.every((d) => lead.has(d)), "T7 the door rides AHEAD of every round file");
  must(full.entries.some((e) => typeof e.mtimeSec === "number" && e.mtimeSec! > 0), "T7 real mtimes parse");

  // the old grammar's count, for the same tree — the censuses must agree
  const wc = spawnSync("bash", ["-c", `cd ${shQuote(dir)} && find . -type f -not -name '.cf-*' -not -path './.cryoflow_prev/*' | wc -l`], { encoding: "utf8" });
  must(Number(wc.stdout.trim()) === full.entries.length, "T7 the new enumeration counts exactly what the old one counted");

  // small cap — the world that used to die silently now confesses, and
  // the door still makes it home
  const small = parseManifestListing(
    spawnSync("bash", ["-c", manifestFindScript(50, shQuote(dir))], { encoding: "utf8" }).stdout,
    50
  );
  must(small.truncated === true, "T7 a cap of 50 against 11,464 files fires the canary");
  must(small.entries.length === 50, "T7 the small ledger keeps its cap");
  const smallRels = new Set(small.entries.map((e) => e.rel));
  must(DOOR.every((d) => smallRels.has(d)), "T7 even at 50, the FINAL family is inside — the door never dies");
}

/* ------------------------------------------------------------------ */

console.log(`\nt464 manifest-cap bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
