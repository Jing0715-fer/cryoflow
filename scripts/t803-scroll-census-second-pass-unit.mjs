/**
 * t803-scroll-census-second-pass-unit — the widened net's receipt: nine
 * keyboard-dead scroll regions learn the law in one batch.
 *
 * The second pass (the t802 tail's first non-build-day candidate) widened
 * the census net to EVERY overflow container class — overflow-y-auto,
 * overflow-x-auto, overflow-scroll, and the content-node faces — because
 * t802 proved the t801 buckets were class-bound (overflow-auto only).
 * The enumeration arm (scripts/t803-scroll-census-second-pass.mjs)
 * counted 101 container hits; the judgment sorted them into:
 *
 *   • SPEAKING (13): every prior cure — t798's runs, t799's log+list,
 *     t801's three, t802's two, the roster's 2672, the inspector's live
 *     log. The family map, confirmed intact.
 *   • RETIRED — RADIX-MANAGED: the ui primitives (command's cmdk list,
 *     select, dropdown, context-menu, alert-dialog) — arrow keys and
 *     typeahead are the widget's own law; the house never stops them.
 *   • RETIRED THIN: the horizontal-only faces (pre-wrap + break-all pres,
 *     chart strips, the tabs bar), the engine popover's badge cloud, and
 *     the mol* error fallback (retired by t801, confirmed by this pass).
 *   • COVERED BY CHILDREN: the tab panels and editor bodies (controls
 *     below the fold), the fsc-compare candidate list (buttons per row).
 *   • KEYBOARD-DEAD (9 — the knife): the assistant's tool-detail pre
 *     (4,000 chars in 192px), the fsc params diff table, the results
 *     warnings list, the inspector's log-findings list, the import
 *     queue's preview grid, the mol* views-found group, the workspace
 *     list's ground, the particle browser's micrograph stack, the queue
 *     sim's Gantt rows.
 *
 * The cure: each container gains tabIndex={0} + the visible ring, keeping
 * its element, its role/label where one existed, gaining an honest name
 * where none did. Three faces pre-existed labels (import queue, views
 * group, Gantt); three are pointer-face lists whose rows are the t784
 * family's debt — the GROUND speaks for the keyboard, the rows stay.
 *
 *   A–I  the nine cures, one section each.
 *   J    the census verdicts (the retirements, the covered, the faces).
 *   K    the elders' regression.
 *   L    the scope honesty.
 *
 * Run:  node scripts/t803-scroll-census-second-pass-unit.mjs
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
const slice = (text, startMarker, endMarker) => {
  const s = text.indexOf(startMarker);
  if (s === -1) return "";
  const e = text.indexOf(endMarker, s + startMarker.length);
  return e === -1 ? text.slice(s) : text.slice(s, e + endMarker.length);
};

const assistant = read("src/components/ai/assistant-panel.tsx");
const diff = read("src/components/workflow/results/fsc-params-diff.tsx");
const resultsView = read("src/components/workflow/results/results-view.tsx");
const inspector = read("src/components/workflow/job-inspector.tsx");
const importDialog = read("src/components/workflow/import-workflow-dialog.tsx");
const molstar = read("src/components/workflow/results/molstar-embed.tsx");
const workspace = read("src/components/workflow/workspace-panel.tsx");
const particle = read("src/components/workflow/results/particle-browser.tsx");
const sim = read("src/components/workflow/hpc-queue-sim.tsx");
const command = read("src/components/ui/command.tsx");
const select = read("src/components/ui/select.tsx");
const fscCompare = read("src/components/workflow/results/fsc-compare-dialog.tsx");
const classConv = read("src/components/workflow/results/class-convergence-dialog.tsx");
const wrapper = read("src/components/ui/dialog.tsx");
const dash = read("src/components/workflow/project-dashboard.tsx");
const storage = read("src/components/workflow/storage-dialog.tsx");
const diag = read("src/components/workflow/system-diagnostics-dialog.tsx");
const shortcuts = read("src/components/workflow/shortcuts-dialog.tsx");

/* A — the assistant's tool-detail pre */
const a = slice(assistant, "t803 — the detail's payload window", "{detail.window}");
ok(a.includes("tabIndex={0}"), "A1 the detail pre's tab stop");
ok(a.includes('aria-label="Tool detail payload window"'), "A2 the detail pre's honest name");
ok(
  a.includes("focus-visible:ring-2") && a.includes("focus-visible:ring-primary/50"),
  "A3 the detail pre's visible ring",
);
ok(a.includes("4,000 characters") && a.includes("192px"), "A4 the wound's numbers on file");
ok(assistant.includes("the window never lies about being a window"), "A5 the t510 window-honesty intact");

/* B — the fsc params diff region (the comment lives INSIDE the div —
 * anchor from the ternary's opening parens so the attrs are in range) */
const b = slice(diff, ") : (", "<table");
ok(b.includes("tabIndex={0}") && b.includes('role="region"'), "B1 the diff region's stop + role");
ok(b.includes('aria-label="Parameter diff table"'), "B2 the diff region's honest name");
ok(b.includes("focus-visible:ring-2"), "B3 the diff region's ring");
ok(b.includes("th/td text only"), "B4 the spans-only verdict on file");

/* C — the results warnings list (anchor from the toggle's conditional) */
const c = slice(resultsView, "{open && (", "{warnings.map");
ok(c.includes("tabIndex={0}") && c.includes('aria-label="Job warnings"'), "C1 the warnings list's stop + name");
ok(c.includes("focus-visible:ring-2"), "C2 the warnings list's ring");
ok(resultsView.includes('className="break-words rounded bg-warning/10'), "C3 the li rows untouched");

/* D — the inspector's findings list (anchor from the pre-existing cap
 * comment, which sits ABOVE the ul and stays in range) */
const d = slice(inspector, "the log is the ground truth and keeps its lane", "FINDING_ICONS");
ok(d.includes("tabIndex={0}") && d.includes('aria-label="Log findings"'), "D1 the findings list's stop + name");
ok(d.includes("focus-visible:ring-2"), "D2 the findings list's ring");
ok(d.includes("the list keeps its ul"), "D3 the ul semantics kept on record");
ok(inspector.includes("the log is the ground truth and keeps its lane"), "D4 the cap comment above intact");

/* E — the import queue */
const e = slice(importDialog, "t803 — the queue's scroll", "{entries.map");
ok(e.includes("tabIndex={0}"), "E1 the queue's stop");
ok(e.includes('data-testid="import-queue"') && e.includes('aria-label="Files staged for import"'), "E2 testid + the honest name kept");
ok(e.includes("focus-visible:ring-2"), "E3 the queue's ring");
ok(e.includes("spans only"), "E4 the spans-only verdict on file");

/* F — the mol* views-found group */
const f = slice(molstar, "t803 — the views-found group", "importGroups.map");
ok(f.includes("tabIndex={0}") && f.includes('role="group"'), "F1 the group's stop, role kept");
ok(f.includes('aria-label="Views found across all sources"'), "F2 the group's name kept");
ok(f.includes("focus-visible:ring-2"), "F3 the group's ring");
ok(f.includes("pointer-faces") && f.includes("t784"), "F4 the row-face debt named, not cured");

/* G — the workspace ground (anchor from the ternary's parens) */
const g = slice(workspace, ") : (", "workspaces.map");
ok(g.includes("tabIndex={0}") && g.includes('aria-label="Workspaces"'), "G1 the ground's stop + name");
ok(g.includes("focus-visible:ring-inset"), "G2 the ground's inset ring (edge-to-edge)");
ok(g.includes("pointer-faces") && g.includes("t784"), "G3 the row-face debt named, not cured");

/* H — the particle stack */
const h = slice(particle, "t803 — the groups' stack", "data.groups.map");
ok(h.includes("tabIndex={0}") && h.includes('aria-label="Micrograph groups"'), "H1 the stack's stop + name");
ok(h.includes("focus-visible:ring-2"), "H2 the stack's ring");
ok(h.includes("pointer-first"), "H3 the pointer-first verdict on file");

/* I — the Gantt schedule (anchor from the conditional; the label sits
 * BEFORE the comment inside the div, so end past it) */
const i = slice(sim, "rows.length ? (", "the honest\n                      name stays");
ok(i.includes("tabIndex={0}"), "I1 the schedule's stop");
ok(i.includes('aria-label="Simulated schedule (Gantt)"'), "I2 the honest name kept");
ok(i.includes("focus-visible:ring-2"), "I3 the schedule's ring");
ok(i.includes("Gantt rows are bars + text"), "I4 the bars+text verdict on file");

/* J — the census verdicts */
ok(!command.includes("tabIndex={0}") && !select.includes("tabIndex={0}"),
  "J1 the Radix-managed primitives stay untouched (the widget's own law)");
const errStart = molstar.indexOf('phase === "error"');
ok(
  errStart > -1 && !molstar.slice(errStart, errStart + 500).includes("tabIndex={0}"),
  "J2 the mol* error fallback stays retired (t801's verdict, confirmed)",
);
ok(
  classConv.includes("flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0") &&
    classConv.includes('role="region"'),
  "J3 the content-node faces stand CURED — t804's house batch (the old gap-4 overflow-y-auto override this assert once watched as 'recorded, untouched' is retired; the gate catches the family growing, the amendment names the cure)",
);
/* J4 — the covered verdict's fact: the candidate list's rows carry
 * buttons AFTER the label (indexOf arithmetic — a slice TO the anchor
 * would exclude it, the seventh verse) */
{
  const labelIdx = fscCompare.indexOf('aria-label="Select jobs to compare"');
  const btnIdx = fscCompare.indexOf("<button", labelIdx);
  ok(labelIdx > -1 && btnIdx > labelIdx,
    "J4 the fsc-compare candidate list is covered by children (buttons after the label) — left alone");
}
ok(
  read("scripts/t803-scroll-census-second-pass.mjs").includes("WIDENED net"),
  "J5 the enumeration arm persisted beside the probe (101 hits, four classes + content faces)",
);

/* K — the elders' regression */
ok(diag.includes('aria-label="System diagnostics readings — memory lanes, engine, disk, world census"'),
  "K1 the t802 readings region verbatim");
ok(shortcuts.includes('aria-label="Keyboard shortcut inventory — grouped by context"'),
  "K2 the t802 shortcuts region verbatim");
ok(dash.includes("max-h-80 overflow-y-auto rounded-lg pr-1 nice-scroll focus-visible"),
  "K3 the roster's 2672 region intact");
ok(storage.includes('aria-label="Storage contents — disk totals and run directories"'),
  "K4 the t798 runs region intact");
ok(assistant.includes('aria-label="AI assistant transcript"') && assistant.includes('aria-label="Session history"'),
  "K5 the t799 log + list intact");

/* L — the scope honesty */
ok(!wrapper.includes("tabIndex={0}"), "L1 the shared wrapper carries no blanket stop");
ok(
  !assistant.includes("aria-activedescendant") &&
    !workspace.includes("RovingFocusGroup") &&
    !particle.includes("RovingFocusGroup"),
  "L2 no roving machinery crept in (the pointer-face rows are the t784 family's, not this law's)");
ok(
  (diff.match(/role="region"/g) || []).length === 1,
  "L3 the region role granted exactly once in the batch (the diff table) — lists and groups keep their own semantics",
);
ok(
  (assistant.match(/tabIndex=\{0\}/g) || []).length === 3,
  "L4 the assistant panel: transcript + session list + detail pre — exactly three stops",
);

console.log(`t803-scroll-census-second-pass-unit: ${pass} pass / ${fail} fail`);
if (fail > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}
