#!/usr/bin/env node
/**
 * t1005 — the REFUSAL-NAME unit (node-only): the message-quality fifth
 * pass's SECOND ARM — the flip-plane census's static bucket turned
 * cure. The t982 first arm cured 13 faces with the refusal-name voice;
 * this arm cures the REMAINING thirty silent-static sites (the entire
 * bucket), each with the honest branch name for its own refusal nature:
 *
 *   the FLIGHT sites (disabled during an in-flight: reprobe,
 *   fetch-models, new-chat, the assistant textarea, duplicate-selection,
 *   re-survey, usage-refresh, fsc-rescan, triptych-export, report-export
 *   ×2, storage-refresh, diagnostics-refresh) speak the flight —
 *   "测活中…", "Refreshing the model list…", "Exporting the run
 *   report…" — the t1002 busy-face vocabulary riding the NAME;
 *   the CLAMP sites (the four GPU/shard steppers, the class-gallery's
 *   round steppers, the particle pager, the stack-slice steppers) speak
 *   the wall — "(already at the minimum)", "(already at the first
 *   round)", "(already at the first page)", "(already at the first
 *   slice)" — the t997 zoom-clamp words, one voice per wall;
 *   the STATE-GATE sites (the critical lens with no finished chain, the
 *   subtree checkbox with blocked nodes, the profile duplicate with no
 *   selection or at the limit, the four molstar export doors with no
 *   landscape profile) speak the gate — "(no finished chain to walk)",
 *   "(pick a provider first)", "(no landscape profile yet)".
 *
 * EVERY cure is an IN-PLACE replacement of a static aria-label with the
 * dynamic branch template — zero line movements anywhere in the tree
 * (the t1004 unit's adjacency needles stand UNMOVED through this
 * commit; only its R-band tallies re-key, in the same commit per the
 * census-signal law).
 *
 * THE TRIPWIRE (R1–R3, FIRST): the thirty cures move the census's
 * naming signal (aria-label={) thirty times — the tallies GENUINELY
 * move for the first time since the t1002 no-re-key ruling:
 *   population 171 (no site added or removed),
 *   stateful 116 → 146 (+30),
 *   silent-static 30 → 0 (THE BUCKET EMPTIED — the fifth pass's
 *     milestone: every state-disabled control in the tree now names
 *     its refusal),
 *   silent-text 25 (the flip bucket stands — its own arm landed in
 *     t1004),
 *   silences 55 → 25.
 *
 * THE PROBE PROTOCOL: node-only, no imports from src — the census
 * child process plus readFileSync includes, exit honest.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CENSUS = path.join(ROOT, "scripts/t982-aria-refusal-census.mjs");
const TMP = path.join(ROOT, "shots-qa/.t1005-unit-receipt.json");
const AI = "src/components/ai";
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
const countOf = (src, needle) => src.split(needle).length - 1;

/* ---------- R band — the census tripwire, FIRST ---------- */
console.log("R band — the tallies GENUINELY move: the static bucket empties");
let receipt = null;
try {
  execFileSync("node", [CENSUS, "--receipt", TMP], { encoding: "utf8", timeout: 60_000 });
  receipt = JSON.parse(readFileSync(TMP, "utf8"));
} catch (e) {
  console.log(`  ✗ the census child process — ${String(e).slice(0, 200)}`);
  fail++;
}
try { unlinkSync(TMP); } catch {}

ok("R1 the population stands at 171 (no site added, none removed)",
  receipt?.population === 171, `got ${receipt?.population}`);
ok("R2 stateful 146 · silent-static 0 · silent-text 25 — thirty name cures moved the whole static bucket into stateful",
  receipt?.tally?.stateful === 146 &&
  receipt?.tally?.["silent-static"] === 0 &&
  receipt?.tally?.["silent-text"] === 25,
  `stateful=${receipt?.tally?.stateful} static=${receipt?.tally?.["silent-static"]} text=${receipt?.tally?.["silent-text"]}`);
ok("R3 silences 25 — only the flip bucket remains silent (its arm landed in t1004)",
  receipt?.silences === 25, `got ${receipt?.silences}`);

/* ---------- N band — the thirty refusal-name cures ---------- */
console.log("N band — every site speaks its own refusal nature: flight, wall, or gate");
const sites = [
  /* the flight sites — the name speaks the in-flight */
  ["N1", `${AI}/ai-settings-dialog.tsx`, "ai-settings-dialog.tsx:467 the reprobe flight (the file's own Chinese voice)",
    'aria-label={probing ? "测活中…" : "重新测活"}'],
  ["N2", `${AI}/ai-settings-dialog.tsx`, "ai-settings-dialog.tsx:554 the fetch-models flight + the no-provider gate (two honest branches)",
    'aria-label={fetching ? "Refreshing the model list…" : !providerId ? "Refresh the model list (pick a provider first)" : "Refresh the model list"}'],
  ["N3", `${AI}/assistant-panel.tsx`, "assistant-panel.tsx:1905 the new-chat flight",
    'aria-label={busy ? "New chat (the assistant is answering)" : "New chat"}'],
  ["N4", `${AI}/assistant-panel.tsx`, "assistant-panel.tsx:2267 the textarea flight",
    'aria-label={busy ? "Message the AI assistant (the answer is still streaming)" : "Message the AI assistant"}'],
  ["N5", `${WF}/canvas.tsx`, "canvas.tsx:815 the duplicate-selection flight",
    'aria-label={busy ? "Duplicating the selection…" : "Duplicate selection"}'],
  ["N6", `${WF}/cleanup-dialog.tsx`, "cleanup-dialog.tsx:463 the re-survey flight + the executing lock (two honest branches)",
    'aria-label={executing ? "Re-survey locked (a cleanup is executing)" : loading ? "Surveying the run directory…" : "Re-survey the run directory (fresh)"}'],
  ["N7", `${WF}/cluster-usage-panel.tsx`, "cluster-usage-panel.tsx:353 the usage-refresh flight + the no-connection gate",
    'aria-label={!connectionId ? "Refresh live node usage (no connection selected)" : refreshing || loading ? "Refreshing live node usage…" : "Refresh live node usage"}'],
  ["N8", `${RES}/fsc-compare-dialog.tsx`, "fsc-compare-dialog.tsx:606 the fsc-rescan flight",
    'aria-label={scanning ? "Scanning the project for FSC curves…" : "Re-scan the project for FSC curves"}'],
  ["N9", `${RES}/map-ortho-panel.tsx`, "map-ortho-panel.tsx:1351 the triptych-export flight",
    'aria-label={exportState === "busy" ? "Exporting the triptych…" : "Export the three orthogonal sections as a PNG triptych"}'],
  ["N10", `${RES}/results-view.tsx`, "results-view.tsx:1024 the report-export flight (aria-busy already rode from an earlier pass)",
    'aria-label={reportBusy ? "Exporting the run report…" : "Export run report"}'],
  ["N11", `${RES}/results-view.tsx`, "results-view.tsx:1037 the html-report-export flight",
    'aria-label={reportBusy ? "Exporting the run report…" : "Export run report as HTML"}'],
  ["N12", `${WF}/storage-dialog.tsx`, "storage-dialog.tsx:768 the storage-refresh flight",
    'aria-label={loading ? "Refreshing storage numbers…" : "Refresh storage numbers"}'],
  ["N13", `${WF}/system-diagnostics-dialog.tsx`, "system-diagnostics-dialog.tsx:416 the diagnostics flight",
    'aria-label={loading ? "Reading the diagnostics…" : "Refresh diagnostics"}'],
  /* the clamp sites — the name speaks the wall (the t997 words) */
  ["N14", `${WF}/remote-run-button.tsx`, "remote-run-button.tsx:554 the GPU minimum wall",
    'aria-label={gpus <= 1 ? "One GPU less (already at the minimum)" : "One GPU less"}'],
  ["N15", `${WF}/remote-run-button.tsx`, "remote-run-button.tsx:572 the GPU maximum wall",
    'aria-label={gpus >= maxGpus ? "One GPU more (already at the maximum)" : "One GPU more"}'],
  ["N16", `${WF}/remote-run-button.tsx`, "remote-run-button.tsx:625 the shard floor (no split to remove)",
    'aria-label={shards <= 1 ? "One shard fewer (no split to remove)" : "One shard fewer"}'],
  ["N17", `${WF}/remote-run-button.tsx`, "remote-run-button.tsx:643 the shard ceiling",
    'aria-label={shards >= ARRAY_MAX_SHARDS ? "One shard more (already at the maximum)" : "One shard more"}'],
  ["N18", `${RES}/class-iteration-gallery.tsx`, "class-iteration-gallery.tsx:842 the first-round wall (+ the no-rounds gate)",
    'aria-label={current == null ? "Previous iteration round (no rounds loaded)" : stacks[0]?.iter === current.iter ? "Previous iteration round (already at the first round)" : "Previous iteration round"}'],
  ["N19", `${RES}/class-iteration-gallery.tsx`, "class-iteration-gallery.tsx:859 the last-round wall (+ the no-rounds gate)",
    'aria-label={current == null ? "Next iteration round (no rounds loaded)" : stacks[stacks.length - 1]?.iter === current.iter ? "Next iteration round (already at the last round)" : "Next iteration round"}'],
  ["N20", `${RES}/particle-browser.tsx`, "particle-browser.tsx:271 the first-page wall (+ the page-flight branch)",
    'aria-label={page.offset === 0 ? "Previous particle page (already at the first page)" : loading ? "Loading the previous page…" : "Previous particle page"}'],
  ["N21", `${RES}/particle-browser.tsx`, "particle-browser.tsx:283 the last-page wall (+ the page-flight branch)",
    'aria-label={page.offset + PAGE_SIZE >= page.total ? "Next particle page (already at the last page)" : loading ? "Loading the next page…" : "Next particle page"}'],
  ["N22", `${RES}/results-view.tsx`, "results-view.tsx:1441 the first-slice wall",
    'aria-label={stackSlice <= 0 ? "Previous particle image (already at the first slice)" : "Previous particle image"}'],
  ["N23", `${RES}/results-view.tsx`, "results-view.tsx:1462 the last-slice wall",
    'aria-label={stackSlice >= (imageFile.slices ?? 1) - 1 ? "Next particle image (already at the last slice)" : "Next particle image"}'],
  /* the state-gate sites — the name speaks the gate */
  ["N24", `${WF}/canvas.tsx`, "canvas.tsx:3118 the lens gate (no finished chain to walk)",
    'aria-label={criticalWalk == null ? "Toggle critical path lens (no finished chain to walk)" : "Toggle critical path lens"}'],
  ["N25", `${WF}/remote-run-button.tsx`, "remote-run-button.tsx:1195 the subtree gate (blocked nodes)",
    'aria-label={subtreePlan.blocked.length > 0 ? "Also re-run the downstream subtree (some downstream nodes are blocked)" : "Also re-run the downstream subtree"}'],
  ["N26", `${WF}/hpc-profiles-editor.tsx`, "hpc-profiles-editor.tsx:402 the duplicate gate (no selection / at the limit) — the Add button's own voice, mirrored",
    'aria-label={!selected ? "Duplicate selected profile (pick a profile first)" : profiles.length >= MAX_PROFILES ? "Duplicate selected profile (the profile limit is reached)" : "Duplicate selected profile"}'],
  ["N27", `${RES}/molstar-embed.tsx`, "molstar-embed.tsx:5723 the CSV-copy gate (no landscape profile)",
    'aria-label={profile ? "Copy profile as CSV" : "Copy profile as CSV (no landscape profile yet)"}'],
  ["N28", `${RES}/molstar-embed.tsx`, "molstar-embed.tsx:5734 the CSV-download gate",
    'aria-label={profile ? "Download profile as CSV" : "Download profile as CSV (no landscape profile yet)"}'],
  ["N29", `${RES}/molstar-embed.tsx`, "molstar-embed.tsx:5749 the report-copy gate",
    'aria-label={profile ? "Copy profile QC report" : "Copy profile QC report (no landscape profile yet)"}'],
  ["N30", `${RES}/molstar-embed.tsx`, "molstar-embed.tsx:5760 the report-download gate",
    'aria-label={profile ? "Download profile QC report" : "Download profile QC report (no landscape profile yet)"}'],
];
const fileCache = new Map();
for (const [id, file, label, nameNeedle] of sites) {
  if (!fileCache.has(file)) fileCache.set(file, read(file));
  const src = fileCache.get(file);
  const c = countOf(src, nameNeedle);
  ok(`${id} ${label}`, c === 1, c === 1 ? "the branch name rides exactly once" : `count=${c}`);
}

/* ---------- S band — the family's older cures stand ---------- */
console.log("S band — the arms before this one stand unmoved");
const t982Send = read(`${AI}/assistant-panel.tsx`);
ok("S1 the t982 first arm's Send refusal stands (the same panel, the older cure)",
  countOf(t982Send, 'aria-label={!input.trim() ? "Send (type a message first)" : "Send"}') === 1,
  "the first arm's voice intact beside the second arm's");
const addBtn = read(`${WF}/hpc-profiles-editor.tsx`);
ok("S2 the Add button's older refusal-name stands (the voice N26 mirrors)",
  countOf(addBtn, 'aria-label={profiles.length >= MAX_PROFILES ? "Add (the profile limit is reached)" : "Add"}') === 1);

console.log(`\nt1005 refusal-name unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
