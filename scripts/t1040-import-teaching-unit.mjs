#!/usr/bin/env node
/**
 * t1040-import-teaching-unit — the pull-list's honest order + the cap's
 * word, and the preselect's own teaching face.
 *
 * The seat: the t1039 live ride witnessed two gaps in the import family's
 * teaching, both on camera — (a) the from-job pull list caps at 8 jobs
 * (the load discipline: 8 tiny GETs, never on hover) and HID a job without
 * a word (the v3 catch: Mask Create sat past the cap while the user looked
 * for it); (b) the import dialog's entries arrive PRE-TICKED (the capacity
 * preselect — appendSource claims the free slots) and the dialog said
 * nothing — the user meets a ticked row they never ticked.
 *
 * Bands:
 *   A — the pull-list's honest order: the band rank (views-first 0, the
 *       unreadable "?" 1 — a ? may hold views, the retry seat — the
 *       known-empty 2), the comparator's chain (band, then count desc,
 *       then name asc — two opens, one order), the sort living in the
 *       fetch's own .then (one mouth, never a render-time computation),
 *       the cap discipline preserved (slice(0, 8) — never more GETs), and
 *       the hidden count's arithmetic (allSiblings − siblings, floor 0).
 *   B — the cap's word: the tail row (testid + data-canvas-ui), the gate
 *       (idle && hidden > 0 — the loading face never speaks a count it
 *       has not counted), the word verbatim, the singular face.
 *   C — the preselect's word: the preTicked field rides appendSource's
 *       claim (accumulating across a multi-file batch — functional
 *       setState), the user's own ticks never grow it (togglePicked is
 *       not a teacher), the description's conditional face (the testid,
 *       the gate, the word verbatim).
 *   D — the neighbors' pins: t827's capped pull-list window intact (the
 *       max-h-40 + nice-scroll strings survive the tail row), the shelf's
 *       own cap untouched, and the mirrored semantics: the comparator as
 *       pinned, run on real band rows — the order it must produce.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

console.log("A — the pull-list's honest order");
{
  // the band rank's shape
  ok(embed.includes("const rank = (c: number) => (c > 0 ? 0 : c < 0 ? 1 : 2);"), "the band rank: views-first 0, the unreadable 1, the known-empty 2");

  // the comparator's chain: band, then count desc, then name asc
  ok(embed.includes("rank(a.count) - rank(b.count) || b.count - a.count || a.name.localeCompare(b.name)"), "the comparator chains band → count desc → name asc (two opens, one order)");

  // the sort lives in the fetch's .then (never a render-time computation)
  const loadBody = embed.slice(embed.indexOf("const loadFromJobCounts ="), embed.indexOf("const loadFromJobCounts =") + 2200);
  ok(loadBody.includes(".then((rows) => {") && loadBody.indexOf(".sort(") > loadBody.indexOf(".then((rows) => {"), "the sort lives in the fetch's own .then (one mouth, never a render)");

  // the cap discipline preserved — the load law (8 tiny GETs, never on hover)
  ok(loadBody.includes("allSiblings.slice(0, 8)"), "the cap stays the load discipline's own (the first 8 by project order — never more GETs)");

  // the hidden count's arithmetic
  ok(loadBody.includes("setFromJobHidden(Math.max(0, allSiblings.length - siblings.length))"), "the hidden count is allSiblings − siblings, floored at 0");

  // the explicit click discipline intact (runs on toggle/open only)
  ok(embed.includes("const toggleFromJob = () => {") && embed.includes("if (!next) return;\n    loadFromJobCounts();"), "the list still loads on explicit click only (never on hover — the standing law)");
}

console.log("B — the cap's word");
{
  // the tail row
  const noteIdx = embed.indexOf('data-testid="from-job-cap-note"');
  ok(noteIdx > 0, "the cap note is born (the testid)");
  ok(embed.slice(noteIdx - 200, noteIdx).includes('data-canvas-ui="from-job-cap-note"'), "the note carries the door's data-canvas-ui face too");

  // the gate: idle && hidden > 0
  const gate = embed.slice(embed.lastIndexOf("{fromJobState === \"idle\" && fromJobHidden > 0", noteIdx), noteIdx);
  ok(gate.length > 0 && gate.includes("fromJobState === \"idle\"") && gate.includes("fromJobHidden > 0"), "the gate: idle && hidden > 0 (the loading face never speaks an uncounted count)");

  // the word verbatim + the singular face
  ok(embed.slice(noteIdx, noteIdx + 300).includes("+{fromJobHidden} more job{fromJobHidden === 1 ? \"\" : \"s\"} not listed — the pull list caps at 8; the shelves with saved views stand first."), "the word verbatim: the cap AND the order, one whisper");
  ok(embed.slice(noteIdx - 400, noteIdx + 400).includes("the loading face"), "the comment names the loading-face law");

  // the note lives INSIDE fromJobRows (both doors — the popover's section
  // and the in-dialog picker share the component)
  const rowsStart = embed.indexOf("const fromJobRows = () => (");
  ok(rowsStart > 0 && noteIdx > rowsStart && noteIdx < embed.indexOf("/* ---------------- view capture (figure export) ---------------------- */"), "the note rides fromJobRows (both doors speak it — the popover's section and the in-dialog picker)");
}

console.log("C — the preselect's word");
{
  // the field rides the state
  ok(embed.includes("preTicked: number;"), "the importPreview state carries preTicked (the preselect's own count)");

  // only appendSource writes it, accumulating across the batch
  const appendBody = embed.slice(embed.indexOf("const appendSource ="), embed.indexOf("const appendSource =") + 1200);
  ok(appendBody.includes("preTicked: (prev?.preTicked ?? 0) + claiming"), "appendSource accumulates the claims (the multi-file batch chains through functional setState)");
  ok(appendBody.includes("const claiming = Math.min(room, src.entries.length);"), "the claim count is what actually fit (room-capped, honest)");

  // the user's ticks never grow it
  const toggleBody = embed.slice(embed.indexOf("const togglePicked ="), embed.indexOf("const togglePicked =") + 700);
  ok(toggleBody.length > 0 && !toggleBody.includes("preTicked"), "togglePicked is not a teacher (the user's ticks never grow the word's count)");

  // the description's conditional face
  const noteIdx = embed.indexOf('data-testid="import-pretick-note"');
  ok(noteIdx > 0, "the pre-tick note is born (the testid)");
  const gateStart = embed.lastIndexOf("importPreview.preTicked > 0", noteIdx);
  ok(gateStart > 0 && gateStart < noteIdx, "the face is gated on the preselect's count (0 hides the word — nothing claimed, nothing said)");
  ok(embed.slice(noteIdx, noteIdx + 320).includes("pre-ticked to fit — untick what you don’t want."), "the word verbatim: what happened + the refusal's invitation");

  // the word rides the DESCRIPTION (the dialog's teaching seat), not a
  // second toast — one face, one home
  const descIdx = embed.lastIndexOf("<DialogDescription>", noteIdx);
  ok(descIdx > 0 && noteIdx - descIdx < 900, "the word rides the description (the dialog's own teaching seat — no second mouth)");
}

console.log("D — the neighbors' pins + the mirrored semantics");
{
  // t827's capped pull-list window intact
  ok(embed.includes("max-h-40 overflow-y-auto"), "t827's B7: the pull-list's cap survives (max-h-40 overflow-y-auto)");
  ok(embed.includes("nice-scroll"), "t827's B8: the house scroll treatment survives");
  ok(embed.includes("max-h-44 space-y-0.5 overflow-y-auto"), "t827's B9: the main shelf's own cap untouched (max-h-44)");

  // the mirrored semantics: the comparator as pinned, run on real rows
  const rank = (c) => (c > 0 ? 0 : c < 0 ? 1 : 2);
  const cmp = (a, b) => rank(a.count) - rank(b.count) || b.count - a.count || a.name.localeCompare(b.name);
  const rows = [
    { name: "Empty (tutorial)", count: 0 },
    { name: "Zeta rich", count: 3 },
    { name: "Unreadable job", count: -1 },
    { name: "Alpha rich", count: 5 },
    { name: "Beta empty", count: 0 },
    { name: "Another ?", count: -1 },
  ];
  const out = [...rows].sort(cmp).map((r) => r.name);
  ok(
    JSON.stringify(out) === JSON.stringify(["Alpha rich", "Zeta rich", "Another ?", "Unreadable job", "Beta empty", "Empty (tutorial)"]),
    "the mirrored order: richest first, the ?'s keep their retry seat, the empty sink — name asc within (the semantics the pins speak)",
  );
}

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
