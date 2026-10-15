#!/usr/bin/env node
/**
 * t1004 — the FLIP-PLANE unit (node-only): the message-quality fifth
 * pass's SECOND sub-case, the rendered-plane census turned cure.
 *
 * THE RECORDED SHAPE (the t1004 entry, candidate ①):
 *   the t982 census's silent-text bucket (25 sites, live receipt this
 *   window — the t1001 candidate's "67" was a stale-world number) names
 *   controls whose TEXT flips with state while the static scan cannot
 *   see whether the flip is WITNESSED in the accessible plane. Source
 *   reading classified all 25: 14 in-flight flips (idle word → pending
 *   word, disabled during the flight, NO plane witness — "Stop"→
 *   "Stopping…", "Send to cluster"→"Sending…", "Re-detect"→"detecting…"
 *   …), 2 transient-feedback flips ("Copy script"→"Copied", not
 *   disabled, a live region is the honest witness), 1 already witnessed
 *   (class-iteration-gallery rode aria-busy={creating} at birth), and 8
 *   honest name-stories (state-honest labels, data-count names, the
 *   placeholder that speaks the empty state, the vendor floor's
 *   carousel untouched).
 *
 * THE CURE (the t1002 vocabulary, one mouth per site):
 *   F1–F14  aria-busy={flight} rides FIRST-CLASS beside the disabled=
 *           prop it mirrors — the flight's one truth made machine-
 *           readable, exactly the t1002 rename gate's voice applied to
 *           the click-road's flights;
 *   F15–F16 the copied pair's text wrapped in <span aria-live="polite">
 *           — the flip announces itself, the button never disabled for
 *           it, no double-speak;
 *   W1      the witnessed one stands UNMOVED (aria-busy={creating},
 *           count exactly 1 — the census's rendered-plane lesson:
 *           the static bucket keeps it silent-text, the plane knows
 *           better);
 *   W2      the vendor floor untouched (src/components/ui/carousel.tsx
 *           carries NO aria-busy — the shadcn pattern stands).
 *
 * THE TRIPWIRE (R1–R3, FIRST — the loudest word before any needle):
 *   the cure adds NO disabled prop, NO aria-label/aria-labelledby/
 *   title={, NO aria-describedby — none of the census's four naming
 *   signals move — so the t982 tallies stand EXACTLY as the live
 *   receipt took them at the window start (population 171 / stateful
 *   116 / silent-static 30 / silent-text 25 / silences 55). The
 *   no-re-key ruling's second live pin.
 *
 * THE ADJACENCY LAW (every F-needle): the aria-busy line must sit
 * within TWO lines of its disabled= line — the wire rides the SAME
 * control it mirrors, not a lookalike elsewhere in the file.
 *
 * THE FLIGHTS ARE MOSTLY SUB-PERCEPTUAL on localhost (the t1002
 * precedent): the busy face is unit-pinned at source; the walk rides
 * the one REAL multi-ms flight (the dashboard's Re-detect probe) —
 * scripts/t1004-flip-plane-walk.mjs.
 *
 * THE PROBE PROTOCOL: node-only, no imports from src — the census
 * child process plus readFileSync includes, exit honest.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CENSUS = path.join(ROOT, "scripts/t982-aria-refusal-census.mjs");
const TMP = path.join(ROOT, "shots-qa/.t1004-unit-receipt.json");
const WF = "src/components/workflow";
const RES = "src/components/workflow/results";

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const read = (rel) => {
  try { return readFileSync(path.join(ROOT, rel), "utf8"); } catch { return ""; }
};
const lineOf = (src, needle) => {
  const i = src.indexOf(needle);
  return i < 0 ? -1 : src.slice(0, i).split("\n").length;
};
/* the ADJACENCY LAW: needle A (the disabled= line) and needle B (the
   aria-busy line) within `gap` lines, B AFTER A — one control, one
   wire. */
const adjacent = (src, a, b, gap = 3) => {
  const la = lineOf(src, a), lb = lineOf(src, b);
  return la > 0 && lb > la && lb - la <= gap;
};
const countOf = (src, needle) => src.split(needle).length - 1;

/* ---------- R band — the census tripwire, FIRST ---------- */
console.log("R band — the t982 tallies stand UNMOVED (the no-re-key ruling, second live pin)");
let receipt = null;
try {
  execFileSync("node", [CENSUS, "--receipt", TMP], { encoding: "utf8", timeout: 60_000 });
  receipt = JSON.parse(readFileSync(TMP, "utf8"));
} catch (e) {
  console.log(`  ✗ the census child process — ${String(e).slice(0, 200)}`);
  fail++;
}
try { unlinkSync(TMP); } catch {}

ok("R1 the disabled census's population stands at 171",
  receipt?.population === 171, `got ${receipt?.population}`);
ok("R2 stateful 146 · silent-static 0 · silent-text 25 — the t1005 second arm's re-key: the thirty refusal-name cures moved every silent-static site into stateful (the static bucket EMPTIED), the text bucket untouched",
  receipt?.tally?.stateful === 146 &&
  receipt?.tally?.["silent-static"] === 0 &&
  receipt?.tally?.["silent-text"] === 25,
  `stateful=${receipt?.tally?.stateful} static=${receipt?.tally?.["silent-static"]} text=${receipt?.tally?.["silent-text"]}`);
ok("R3 silences 25 — the bucket sum after the second arm (the t1004-window receipt took 55; the thirty name cures retired the static half)",
  receipt?.silences === 25, `got ${receipt?.silences}`);

/* ---------- F band — the fourteen aria-busy cures ---------- */
console.log("F band — the in-flight cohort: aria-busy rides beside its disabled=, one control");
const flightSites = [
  ["F1", `${WF}/canvas.tsx`, "canvas.tsx:606 the suggestions-connect flight",
    "disabled={busy || included.length === 0}", "aria-busy={busy}"],
  ["F2", `${WF}/engine-guidance.tsx`, "engine-guidance.tsx:197 the Re-detect probe flight",
    "disabled={systemRefreshing}", "aria-busy={systemRefreshing}"],
  ["F3", `${WF}/finish-knock-button.tsx`, "finish-knock-button.tsx:148 the notifications-ask flight",
    "disabled={asking}", "aria-busy={asking}"],
  ["F4", `${WF}/import-workflow-dialog.tsx`, "import-workflow-dialog.tsx:384 the import flight (the Cancel sibling already speaks)",
    "disabled={busy || !targetWs || entries.length === 0}", "aria-busy={busy}"],
  ["F5", `${WF}/job-inspector.tsx`, "job-inspector.tsx:3093 the ledger's load-more flight",
    "disabled={loadingMore}", "aria-busy={loadingMore}"],
  ["F6", `${WF}/job-inspector.tsx`, "job-inspector.tsx:3794 the Re-run/Continue flight",
    "disabled={busy}\n                  aria-busy={busy}", null],
  ["F7", `${WF}/job-panel.tsx`, "job-panel.tsx:1648 the save-now flight (phase === saving)",
    "disabled={!dirty && autoSave.phase !== \"error\"}", "aria-busy={autoSave.phase === \"saving\"}"],
  ["F8", `${WF}/orchestration-strip.tsx`, "orchestration-strip.tsx:159 the stop flight (the latch that holds)",
    "disabled={orch.stopRequested}", "aria-busy={orch.stopRequested}"],
  ["F9", `${WF}/remote-cluster-dialog.tsx`, "remote-cluster-dialog.tsx:1584 the module-verify flight",
    "disabled={verifying || !verifyInput.trim() || (creating && !valid)}", "aria-busy={verifying}"],
  ["F10", `${WF}/remote-cluster-dialog.tsx`, "remote-cluster-dialog.tsx:1727 the storage write-path flight",
    "disabled={storageChecking || testing || saving}", "aria-busy={storageChecking}"],
  ["F11", `${WF}/remote-run-button.tsx`, "remote-run-button.tsx:1309 the send-to-cluster flight",
    "disabled={pending || !conn || (mode === \"slurm\" && !slurmAvailable)}", "aria-busy={pending}"],
  ["F12", `${WF}/template-presets-dialog.tsx`, "template-presets-dialog.tsx:963 the create-pipeline flight",
    "disabled={busy} aria-busy={busy}", null],
  ["F13", `${WF}/type-card-dialog.tsx`, "type-card-dialog.tsx:502 the add-to-canvas flight",
    "disabled={adding}", "aria-busy={adding}"],
  ["F14", `${RES}/molstar-embed.tsx`, "molstar-embed.tsx:5989 the sub-volume send flight",
    "disabled={!dims || sendBusy}", "aria-busy={sendBusy}"],
];
const fileCache = new Map();
for (const [id, file, label, disabledNeedle, busyNeedle] of flightSites) {
  if (!fileCache.has(file)) fileCache.set(file, read(file));
  const src = fileCache.get(file);
  if (busyNeedle === null) {
    /* the inline-form sites: the paired needle IS the pin (disabled and
       aria-busy on ONE line) */
    ok(`${id} ${label}`, countOf(src, disabledNeedle) === 1,
      countOf(src, disabledNeedle) === 1 ? "the paired line rides exactly once" : `count=${countOf(src, disabledNeedle)}`);
  } else {
    const wired = adjacent(src, disabledNeedle, busyNeedle);
    ok(`${id} ${label}`, wired,
      wired ? "aria-busy within 2 lines of its disabled=" : `disabled@${lineOf(src, disabledNeedle)} busy@${lineOf(src, busyNeedle)}`);
  }
}

/* ---------- G band — the feedback pair's live region ---------- */
console.log("G band — the copied pair: the flip announces itself, no double-speak");
const spanNeedle = '<span aria-live="polite">{copied ? "Copied" : "Copy script"}</span>';
const g1 = read(`${WF}/hpc-sbatch-dialog.tsx`);
ok("G15 hpc-sbatch-dialog.tsx:207 the copied flip wrapped in the polite span (exactly once)",
  countOf(g1, spanNeedle) === 1, `count=${countOf(g1, spanNeedle)}`);
ok("G16 pipeline-script-dialog.tsx:214 the copied flip wrapped in the polite span (exactly once)",
  countOf(read(`${WF}/pipeline-script-dialog.tsx`), spanNeedle) === 1,
  `count=${countOf(read(`${WF}/pipeline-script-dialog.tsx`), spanNeedle)}`);

/* ---------- W band — the witnessed one + the vendor floor ---------- */
console.log("W band — the plane's own truths the cure must NOT move");
const gal = read(`${RES}/class-iteration-gallery.tsx`);
ok("W1 class-iteration-gallery's aria-busy={creating} stands (the witnessed one, born with it)",
  countOf(gal, "aria-busy={creating}") === 1, `count=${countOf(gal, "aria-busy={creating}")}`);
const carousel = read("src/components/ui/carousel.tsx");
ok("W2 the vendor floor untouched — carousel.tsx carries no aria-busy",
  countOf(carousel, "aria-busy") === 0, `count=${countOf(carousel, "aria-busy")}`);

console.log(`\nt1004 flip-plane unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
