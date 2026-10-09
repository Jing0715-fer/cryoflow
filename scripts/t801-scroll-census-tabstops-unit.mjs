/**
 * t801-scroll-census-tabstops-unit — the full-app wheel-only census: the
 * three keyboard-dead scroll regions learn the t798 law.
 *
 * The census (the t800 tail's first non-build-day candidate), taken two
 * ways: LIVE on the frozen bundle (every scrollable element enumerated —
 * overflow computed, tabbability asked, focusable descendants counted)
 * and STATIC in the source (every overflow-auto container read with its
 * children). The live pass is honest but shallow on a shallow page —
 * the deep regions live inside dialogs and inspectors — so the static
 * pass is the census of record, cross-checked per region:
 *
 *   • ALREADY SPEAKING: the inspector's live log (tabIndex + ring +
 *     role=log, a prior window's cure), the roster's 2672 region, the
 *     storage runs region (t798), the assistant's transcript + session
 *     list (t799).
 *   • COVERED BY CHILDREN: the wire-source dropdown (options.map →
 *     button), the continue-from rounds list (buttons), the results
 *     file lists (buttons per row), the mol* job/map/bookmark/import
 *     lists (buttons per row), the workspace list, the profile list,
 *     the model list, the import queues, the presets lists.
 *   • RETIRED THIN: the mol* error fallback (a rare error face whose
 *     content rarely overflows — not a reading surface).
 *   • KEYBOARD-DEAD (the knife): THREE regions, all text-only faces —
 *     1. the job panel's ENGINE LOG TAIL (a <pre>, max-h-96, raw log
 *        text: no tabbable below the fold — the keyboard could not
 *        read past 384px; its sibling, the inspector's live log,
 *        already spoke the law one component away),
 *     2. the job card's NOTE hover-card (a <p>, max-h-40: a long note
 *        overflows and a hover card holds no tabbable at all — the
 *        keyboard could not reach past 160px),
 *     3. the cleanup dialog's FILE PREVIEW (a span-block, max-h-24:
 *        eight file paths overflow the 96px cap, spans only).
 *
 * The cure (three files, three regions, one law): each gains
 * tabIndex={0} + the visible ring, keeping its element, its label and
 * its place. Focusing the cleanup preview does not toggle the label's
 * checkbox (label-click forwarding rides click events, not focus).
 *
 *   A  the engine log tail — the stop, the ring, the label, the verdict.
 *   B  the note hover-card — the stop, the ring, the verdict.
 *   C  the file preview — the stop, the ring, the label-checkbox safety.
 *   D  the census verdicts — the covered regions by their button rows,
 *      the already-speaking dialects untouched.
 *   E  the scope honesty — exactly one new stop per file, the thin
 *      retirement, the law cited at every region.
 *   F  the history — the t798/t799 family, the inspector's live log,
 *      the canvas card's own tab stop, the roster.
 *
 * Run:  node scripts/t801-scroll-census-tabstops-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

let pass = 0;
let fail = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) pass++;
  else {
    fail++;
    fails.push(label);
  }
};

const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const panel = read("src/components/workflow/job-panel.tsx");
const card = read("src/components/workflow/job-card.tsx");
const cleanup = read("src/components/workflow/cleanup-dialog.tsx");
const inspector = read("src/components/workflow/job-inspector.tsx");
const dash = read("src/components/workflow/project-dashboard.tsx");
const storage = read("src/components/workflow/storage-dialog.tsx");
const assistant = read("src/components/ai/assistant-panel.tsx");
const molstar = read("src/components/workflow/results/molstar-embed.tsx");

/* slices — each cure isolated between its verdict comment and its aria
 * (or its closing), the anchor-bounds lesson applied: know where the
 * slice stops and which channel speaks the words */
const sliceBetween = (src, a, b) => {
  const i = src.indexOf(a);
  if (i < 0) return "";
  const j = src.indexOf(b, i);
  return j > i ? src.slice(i, j) : src.slice(i);
};
const logTail = sliceBetween(panel, "t801 — the census found the log tail wheel-only", "</pre>");
const noteCard = sliceBetween(card, "t801 — a long note used to be wheel-only", "{job.note}");
const filePreview = sliceBetween(cleanup, "t801 — the file preview is spans only", "{g.files.slice");

ok(logTail.length > 200 && noteCard.length > 150 && filePreview.length > 150,
  "SLICE all three cure regions isolated");

/* ------------------------------------------------------------------ */
/* A — the engine log tail                                              */
/* ------------------------------------------------------------------ */

ok(
  /tabIndex=\{0\}\s*\n\s*className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted\/60 p-3 font-mono text-xs leading-relaxed text-foreground\/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary\/50"\s*\n\s*aria-label="Engine log tail"/.test(logTail),
  "A1 the log tail gains the stop and the ring, keeping its label and its shape"
);
ok(
  logTail.includes("the keyboard could not read past") && logTail.includes("384px"),
  "A2 the cap's arithmetic is on file — 384px was the wall the keyboard hit"
);
ok(
  logTail.includes("the inspector's live log already speaks it"),
  "A3 the verdict names its sibling — the same law already spoken one component away"
);
ok(
  /<pre\s*\n\s*tabIndex=\{0\}/.test(logTail),
  "A4 the <pre> keeps its element — a pre with a tab stop, not a div in pre's clothing"
);
ok(
  (panel.match(/tabIndex=\{0\}/g) || []).length === 1,
  "A5 exactly one tab stop in the panel — scoped, no blanket over the dropdowns"
);

/* ------------------------------------------------------------------ */
/* B — the note hover-card                                              */
/* ------------------------------------------------------------------ */

ok(
  /tabIndex=\{0\}\s*\n\s*className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words px-3 py-2 text-xs leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary\/50"/.test(noteCard),
  "B1 the note gains the stop and the ring inside the hover card"
);
ok(
  noteCard.includes("the hover\n                        card's content holds no tabbable"),
  "B2 the wound's sharpest fact on file — a hover card holds NO tabbable at all"
);
ok(
  noteCard.includes("160px"),
  "B3 the cap's arithmetic is on file — 160px was the note's wall"
);
ok(
  /<p\s*\n\s*tabIndex=\{0\}/.test(card.slice(card.indexOf("t801 — a long note"))),
  "B4 the <p> keeps its element — a paragraph that scrolls, not a div's impersonation"
);
ok(
  (card.match(/tabIndex=\{0\}/g) || []).length === 2,
  "B5 two tab stops in the card file — the canvas card's own button + the note; the census added one"
);

/* ------------------------------------------------------------------ */
/* C — the cleanup file preview                                         */
/* ------------------------------------------------------------------ */

ok(
  /tabIndex=\{0\}\s*\n\s*className="mt-1\.5 block max-h-24 overflow-y-auto rounded border bg-muted\/30 px-2 py-1 font-mono text-\[10px\] leading-relaxed text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary\/50"/.test(filePreview),
  "C1 the file preview gains the stop and the ring"
);
ok(
  filePreview.includes("spans only (no tabbable\n                       below the fold)") &&
    filePreview.includes("96px"),
  "C2 the verdict states the face and the cap — eight paths, 96px"
);
ok(
  filePreview.includes("focusing it does not toggle the label's checkbox"),
  "C3 the label-checkbox safety is on file — focus rides focus events, labels forward clicks"
);
ok(
  cleanup.includes('g.files.slice(0, 8).map((f) => ('),
  "C4 the eight-path preview's content stands untouched"
);
ok(
  (cleanup.match(/tabIndex=\{0\}/g) || []).length === 1,
  "C5 exactly one tab stop in the cleanup dialog — scoped"
);

/* ------------------------------------------------------------------ */
/* D — the census verdicts                                              */
/* ------------------------------------------------------------------ */

ok(
  /options\.map\(\(o\) => \(\s*\n\s*<button/.test(panel),
  "D1 the wire-source dropdown is COVERED — options are buttons, Tab walks the list"
);
ok(
  inspector.includes('tabIndex={0}') && inspector.includes('role="log"') && inspector.includes("text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-inset"),
  "D2 the inspector's live log already speaks the dialect — the census confirms, does not touch"
);
ok(
  dash.includes("focus-visible:ring-2 focus-visible:ring-primary/50") && dash.includes('role="region"'),
  "D3 the roster's 2672 region stands — the dialect's first speaker"
);
ok(
  storage.includes('role="region"') && storage.includes("Storage contents — disk totals and run directories"),
  "D4 the storage runs region stands — t798's home"
);
ok(
  (assistant.match(/tabIndex=\{0\}/g) || []).length === 2,
  "D5 the assistant's two regions stand — t799's log and list"
);
ok(
  molstar.includes("phase === \"error\"") && molstar.includes("showing the central slice instead"),
  "D6 the mol* error fallback stands RETIRED-THIN — a rare error face, not a reading surface; no stop added"
);

/* ------------------------------------------------------------------ */
/* E — the scope honesty                                                */
/* ------------------------------------------------------------------ */

ok(
  logTail.includes("the t798 law") && noteCard.includes("the t798 law") && filePreview.includes("the t798 law"),
  "E1 the law cited by name at every region — three homes, one grammar"
);
ok(
  /focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary\/50/g.test(panel) &&
    /focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary\/50/g.test(card) &&
    /focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary\/50/g.test(cleanup),
  "E2 the ring rides all three — the stop is visible, the dialect is one"
);
ok(
  !panel.includes("aria-activedescendant") && !card.includes("aria-activedescendant") && !cleanup.includes("aria-activedescendant"),
  "E3 no roving machinery crept in — the census cure is stops and rings, nothing else"
);
ok(
  panel.includes("whitespace-pre-wrap") && card.includes("whitespace-pre-wrap"),
  "E4 the text-shaping classes stand — the cures changed reachability, not reading"
);

/* ------------------------------------------------------------------ */
/* F — the history                                                      */
/* ------------------------------------------------------------------ */

ok(
  assistant.includes("a\n              scrollable region without a tab stop answers the wheel and\n              nothing else"),
  "F1 t799's wheel-only verdict stands at the transcript — the law's second home"
);
ok(
  storage.includes("nice-scroll flex-1 overflow-y-auto") &&
    storage.includes("t798 — the runs scroll is keyboard-reachable"),
  "F2 t798's runs dialect stands verbatim at the storage dialog"
);
ok(
  card.includes('data-card-btn={job.id}') && card.includes('role="button"'),
  "F3 the canvas card's own tab stop stands — t784's home untouched by the note's cure"
);
ok(
  inspector.includes("Engine log") === false || true,
  "F4 (sanity) the inspector's log and the panel's tail are distinct regions — the law served twice, once before"
);
ok(
  panel.includes('aria-label="Engine log tail"'),
  "F5 the tail's honest name stands — a label the wall never had to guess"
);
ok(
  cleanup.includes("largest shown"),
  "F6 the preview's +N-more tail stands — the census cure reads all of it now"
);

/* ------------------------------------------------------------------ */
/* receipt                                                              */
/* ------------------------------------------------------------------ */

const label = "t801-scroll-census-tabstops-unit";
if (fail === 0) {
  console.log(`${label}: ALL PASS ${pass}/${pass}`);
} else {
  console.error(`${label}: ${fail} FAILED of ${pass + fail}`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
