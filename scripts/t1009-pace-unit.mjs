#!/usr/bin/env node
/**
 * t1009 — THE PIPELINE PACE unit (node-only): the t1009 product face's
 * arithmetic pinned at its oracle, the doors pinned at source, the
 * tally law honored by construction.
 *
 * THE FACE: "how fast does this pipeline actually run?" — a project's
 * completed jobs carry the engine's REAL elapsed in `duration` (the
 * completion write `duration: Math.max(1000, elapsed)` overwrites the
 * simulated default — the E-band needle pins that contract at source),
 * so the pace math is honest clock arithmetic:
 *   P1–P6   the lifted oracle (src/lib/pace.ts, the elapsed.ts
 *           doctrine: the product's formatter is the only formatter —
 *           the unit strips `export ` and evals the SOURCE, no
 *           hand-copied twin to drift):
 *           median (odd/even/empty), totals counts + sums, the wall
 *           window (first start → last finish), per-type stages in
 *           FIRST-SEEN chain order (not alphabetical), the rows sorted
 *           by start (a no-clock run sorts LAST, honestly), finishedAt
 *           derived, the failure list carrying names and NO clock.
 *   E       the data contract at source (the engine's overwrite).
 *   D       the doors: the route's guard + FS-FREE shape, the dialog's
 *           aria-busy face / real table semantics / printed-numbers
 *           law / export-family ride / honest empty + failure faces /
 *           mounted gate, the dashboard's dynamic-name gauge button
 *           (no disabled — pace is always viewable), the palette item's
 *           handshake.
 *   T       THE TALLY LAW BY CONSTRUCTION: the three new/edited files
 *           carry ZERO conditional disabled sites — the six tally-pin
 *           units' numbers stand because this face added nothing to
 *           count (the tombstone unit's "no seventh pinner" law, kept
 *           by needle rather than by number).
 *   R       THE RECEIPT + THE DOC ROWS (t1011 — the keyboard arc's
 *           completion): the canvas's live region (role=status,
 *           aria-live=polite, sr-only, ALWAYS mounted — a live region
 *           must precede the change it reports), the mount-skip law
 *           (landing is not an event), the three honest count strings,
 *           the shortcuts dialog's ⇧ Space row (the verb's manual entry,
 *           seated beside its pointer siblings), the help guide's
 *           canvas chapter row naming Shift+Space and the receipt.
 *
 * THE PROBE PROTOCOL: node-only, readFileSync includes + one lifted
 * eval, exit honest, receipt to shots-qa/.t1009-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1009-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
try { unlinkSync(TMP); } catch {}

/* ---------- P band — the lifted oracle ---------- */
console.log("P band — the lifted pace oracle:");
const paceSrc = read("src/lib/pace.ts").replace(/^export /gm, "");
const pace = new Function(`${paceSrc}; return { medianOf, computePace };`)();
const { medianOf, computePace } = pace;

ok("P1 medianOf — odd / even / empty",
  medianOf([5]) === 5 && medianOf([1, 2, 3, 4]) === 2.5 && medianOf([]) === null &&
  medianOf([3, 1]) === 2,
  "no run, no median (null, not 0)");

const t0 = 1728900000000;
const iso = (ms) => new Date(ms).toISOString();
const fixture = [
  { id: "j1", name: "Import", type: "import", status: "completed", duration: 500, startedAt: iso(t0) },
  { id: "j2", name: "MotionCorr A", type: "motioncorr", status: "completed", duration: 33000, startedAt: iso(t0 + 1000) },
  { id: "j3", name: "MotionCorr B", type: "motioncorr", status: "completed", duration: 9000, startedAt: iso(t0 + 2000) },
  { id: "j4", name: "Bad Face", type: "class2d", status: "failed", duration: 14000, startedAt: null },
  { id: "j5", name: "Live 2D", type: "class2d", status: "running", duration: 8000, startedAt: iso(t0 + 3000) },
  { id: "j6", name: "Ready 3D", type: "class3d", status: "idle", duration: 8000, startedAt: null },
];
const face = computePace(fixture);

ok("P2 totals — the four counts and the clock sums",
  face.totals.completed === 3 && face.totals.failed === 1 && face.totals.running === 1 && face.totals.idle === 1 &&
  face.totals.totalMs === 42500,
  "total 42500 = 500+33000+9000 (the failed 14000 never enters)");
ok("P3 wall window — first start → last finish",
  face.totals.wallMs === 34000,
  "max(finish)=t0+34000 − min(start)=t0");
ok("P4 median run — the completed set's own median",
  face.totals.medianMs === 9000,
  "500/9000/33000 → 9000");
ok("P5 stages — first-seen chain order, not alphabetical",
  face.stages.map((s) => s.type).join(",") === "import,motioncorr" &&
  face.stages[1].count === 2 && face.stages[1].medianMs === 21000 &&
  face.stages[1].maxMs === 33000 && face.stages[1].totalMs === 42000,
  "motioncorr: median 21000, max 33000, total 42000");
ok("P6 rows — chain order, finishedAt derived, the failed list carries NO clock",
  face.rows.length === 3 &&
  face.rows[0].id === "j1" && face.rows[0].finishedAt === iso(t0 + 500) &&
  face.rows[1].id === "j2" && face.rows[2].id === "j3" &&
  face.failed.length === 1 && face.failed[0].name === "Bad Face" &&
  !("durationMs" in face.failed[0]),
  "a run that never started owns no minutes");

/* the no-clock sort law: a completed job without a clock sorts LAST */
{
  const face2 = computePace([...fixture, { id: "j7", name: "Ghost Clock", type: "import", status: "completed", duration: 100, startedAt: null }]);
  ok("P7 the no-clock completed run sorts last (honest, not first)",
    face2.rows.length === 4 && face2.rows[3].id === "j7" && face2.totals.wallMs === 34000,
    "wall unchanged by the clockless run");
}

/* ---------- E band — the data contract at source ---------- */
console.log("E band — the engine's overwrite contract:");
ok("E the completion write turns simulated duration into REAL elapsed",
  read("src/lib/relion/engine.ts").includes("duration: Math.max(1000, elapsed)"),
  "engine.ts: the pace face's clock source");

/* ---------- D band — the doors at source ---------- */
console.log("D band — the doors:");
{
  const route = read("src/app/api/projects/[id]/pace/route.ts");
  ok("D1 the pace route rides the same-origin guard (the fsc-index sibling)",
    route.includes("isLocalRequest(request)") && route.includes("403"));
  ok("D2 the pace route is FS-FREE (DB clock facts only — cheap at any size)",
    route.includes("computePace") && !route.includes("readFileSync") && !route.includes("readdirSync"));
}
{
  const dlg = read("src/components/workflow/pace-dialog.tsx");
  ok("D3 the dialog's load flight speaks aria-busy, not disabled",
    dlg.includes("aria-busy={open && !data && !error}"));
  ok("D4 the dialog carries ZERO conditional disabled sites (the tally-pin units' numbers stand by construction)",
    !/disabled=\{/.test(dlg));
  ok("D5 the stage table is a real table (th scope=col, thead/tbody)",
    dlg.includes('scope="col"') && dlg.includes("<thead>") && dlg.includes("<tbody>"));
  ok("D6 the bars are pictures; the numbers are always printed",
    /aria-hidden="true"\s+className="h-2\.5 shrink rounded-full/.test(dlg) &&
    dlg.includes("longest {formatElapsed(s.maxMs)}"));
  ok("D7 the export family rides the same stages the bars render (one source, every sink)",
    dlg.includes("ChartExportButtons") && dlg.includes('name="Pipeline pace"') && dlg.includes("getRows="));
  ok("D8 the empty world gets an honest face",
    dlg.includes("Nothing has run yet"));
  ok("D9 the failure band lists names without claiming time",
    dlg.includes("time is not claimed"));
  ok("D10 the live elapsed is mounted-gated (the hydration law)",
    dlg.includes("setMounted(true)") && dlg.includes("mounted ?"));
}
{
  const dash = read("src/components/workflow/project-dashboard.tsx");
  ok("D11 the dashboard gauge button carries the dynamic name (stateful shape)",
    dash.includes("aria-label={`Pipeline pace — ${project.name}`}") &&
    dash.includes("onClick={onRequestPace}"));
}
{
  const pal = read("src/components/workflow/command-palette.tsx");
  ok("D12 the palette item rides the close-then-open handshake",
    pal.includes('"pipeline pace duration analytics how long stage timings wall time speed"') &&
    /setPaceOpen\(true\)/.test(pal));
}

/* ---------- D13–D15: the t1010 selection arm ---------- */
console.log("D band — the selection arm (t1010):");
{
  const card = read("src/components/workflow/job-card.tsx");
  ok("D13 the card's keyboard toggle speaks (Shift+Space before the act branch)",
    /if \(e\.key === " " && e\.shiftKey\) \{\s*\n\s*e\.preventDefault\(\);\s*\n\s*onToggleSelect\(job\.id\);/.test(card),
    "the keyboard users' multi-select (the shift modifier everywhere else)");
  const canvas = read("src/components/workflow/canvas.tsx");
  ok("D14 the toolbar's pace button carries the dynamic scope name",
    canvas.includes("aria-label={`Pace of ${sel.length} selected jobs`}") &&
    canvas.includes('data-testid="toolbar-pace-selection"'));
  const dlg = read("src/components/workflow/pace-dialog.tsx");
  ok("D15 the dialog's local well rides the SAME lib (no fetch, one truth)",
    dlg.includes('import { computePace } from "@/lib/pace"') &&
    dlg.includes("...computePace(jobs)") &&
    dlg.includes("selection (${jobs.length}"));
}

/* ---------- D16–D19: the t1011 receipt + doc rows ---------- */
console.log("R band — the selection's live receipt + the doc rows (t1011):");
{
  const canvas = read("src/components/workflow/canvas.tsx");
  ok("R1 the canvas hosts a polite status region for the selection",
    canvas.includes('data-testid="selection-live-receipt"') &&
    /role="status"[\s\S]{0,80}aria-live="polite"/.test(canvas) &&
    canvas.includes('className="sr-only"'),
    "role=status + aria-live=polite + sr-only (the t999 wall-echo pattern)");
  ok("R2 the receipt is ALWAYS mounted (a live region must precede its change)",
    /^\s*<SelectionLiveReceipt \/>\s*$/m.test(canvas) &&
    !/\{\s*\w+\s*&&\s*<SelectionLiveReceipt/.test(canvas),
    "rendered unconditionally — gating it would mute the first toggle");
  ok("R3 the receipt skips the landing (mount-skip before any string)",
    /if \(!landedRef\.current\) \{\s*\n\s*landedRef\.current = true;\s*\n\s*return;/.test(canvas),
    "the flip-then-bail shape: landing is not an event worth hearing");
  ok("R4 the three count strings are the receipt's whole vocabulary",
    canvas.includes('"Selection cleared"') &&
    canvas.includes('"1 job selected"') &&
    canvas.includes("`${selectedIds.length} jobs selected`"),
    "every count renders a different string — each step re-announces");
  const sd = read("src/components/workflow/shortcuts-dialog.tsx");
  ok("R5 the shortcuts dialog teaches the keyboard verb beside its siblings",
    sd.includes('{ keys: "⇧ Space", text: "Toggle the focused card in the selection — the keyboard\'s shift+click" }'),
    "the doc row seated between ⇧ Click and ⇧ Drag");
  const hg = read("src/components/workflow/help-guide-dialog.tsx");
  ok("R6 the help guide's canvas chapter names Shift+Space and the receipt",
    hg.includes("press Shift+Space to toggle it in the multi-selection") &&
    hg.includes("hears each count change"),
    "the manual never lags the verb");
}

/* ---------- R band II — the delete arc's mouths (t1012) ---------- */
console.log("R band II — the delete arc's mouths (t1012):");
{
  const store = read("src/lib/store.ts");
  // The two-mouth contract: at the bulk-delete moment the receipt speaks
  // its own true word ("Selection cleared" — the selection's exit, R4's
  // three-string vocabulary is its WHOLE vocabulary) while the deletion's
  // headline lives in the toast (role=status — the vendor announces it).
  // The receipt must never grow a delete-word; the toast's titles are the
  // deletion's mouths and are pinned here.
  ok("R7 the deletion's headline mouth is the toast (two mouths, one story each)",
    store.includes("title: `Deleted ${deleted.length} job${deleted.length === 1 ? \"\" : \"s\"}`") &&
    store.includes("title: `Deleted ${deleted.length} · ${failed} refused`"),
    "the clean split's title + the refused split's title in deleteSelected");
  const shell = read("src/components/workflow/app-shell.tsx");
  const canvas = read("src/components/workflow/canvas.tsx");
  // The prose truce: the keyboard door (app-shell's Del confirm) speaks the
  // same dialect the toolbar's door speaks (canvas.tsx's bulk confirm) —
  // the workdirs sentence verbatim in BOTH, and the counted running clause
  // (the canvas's `${n} running process(es) will be stopped` shape). The
  // sentence needle is whitespace-normalized: JSX re-wraps must not redder
  // the truce (the t1011 R3 lesson — pin the words, not the wrapping).
  const sent = "Files already written to the workdirs stay on disk.";
  ok("R8 the prose truce — both bulk-delete doors speak ONE dialect",
    canvas.replace(/\s+/g, " ").includes(sent) &&
    shell.replace(/\s+/g, " ").includes(sent) &&
    shell.includes('bulkRunningCount === 1 ? " will be stopped" : "es will be stopped"'),
    "the keyboard door gained the toolbar door's words verbatim");
}

/* ---------- R band III — the single pair's truce (t1013) ---------- */
console.log("R band III — the single pair's truce (t1013):");
{
  const shell = read("src/components/workflow/app-shell.tsx");
  const card = read("src/components/workflow/job-card.tsx");
  // The single delete has TWO doors — the keyboard's (app-shell's Del
  // confirm, confirmDeleteId) and the context menu's (job-card's confirm).
  // t1013's survey found them drifted: the keyboard door said "its
  // connections from the workflow" — no workdir sentence, no link-count
  // clause — so it PROMISED a delete the server refuses on linked
  // originals (DELETE /api/jobs/[id] answers 409 when _count.links > 0).
  // The truce: both doors render ONE prose (connections, workdir,
  // running, links, undo). The needles are whitespace-normalized — JSX
  // re-wraps must not redder the truce (the R8 lesson); a WORD change in
  // either door reddens by design.
  const norm = (s) => s.replace(/\s+/g, " ");
  // The R3 lesson (t1011): the needle must survive its own prose — the
  // shell's t1013 comment QUOTES the dead wording as its tombstone, so
  // the absence check reads the code with the JSX comments stripped.
  const code = (s) => norm(s.replace(/\{\/\*[\s\S]*?\*\//g, ""));
  const conn = "This removes the job and every connection attached to it.";
  const wd = "Files already written to the workdir stay on disk.";
  ok("R9 the single pair speaks ONE connections + workdir prose",
    code(shell).includes(conn) && code(card).includes(conn) &&
    code(shell).includes(wd) && code(card).includes(wd) &&
    !code(shell).includes("its connections from the workflow"),
    "the keyboard door adopted the context door's sentences; the old wording is dead");
  ok("R10 both single doors speak the running clause",
    shell.includes('deleteTarget?.status === "running" && " A running process will be stopped."') &&
    card.includes('job.status === "running" && " A running process will be stopped."'),
    "the context door gained the keyboard door's live-process word");
  ok("R11 both single doors speak the link-count refusal clause",
    shell.includes("deleteTarget?.linkCount") &&
    card.includes("job.linkCount") &&
    shell.includes("the server refuses to delete it until they are removed") &&
    card.includes("the server refuses to delete it until they are removed") &&
    shell.includes('linked cop${deleteTarget.linkCount === 1 ? "y" : "ies"}') &&
    card.includes('linked cop${job.linkCount === 1 ? "y" : "ies"}'),
    "the keyboard door pre-states the 409 the linked original will earn");
  ok("R12 both single doors keep the undo sentence",
    norm(shell).includes("You'll get a short window to undo from the toast afterwards.") &&
    norm(card).includes("You'll get a short window to undo from the toast afterwards."),
    "the promise the confirm's Delete actually keeps");
  // The one-prose ORDER: running BEFORE links in both doors (the refusal
  // is the freshest fact before the decision buttons — the bulk family's
  // dialect already runs workdirs → running → undo).
  const shN = norm(shell), cdN = norm(card);
  ok("R13 the clauses hold one order in both doors (running before links)",
    shN.indexOf("A running process will be stopped") < shN.indexOf("linked cop${") &&
    cdN.indexOf("A running process will be stopped") < cdN.indexOf("linked cop${"),
    "the refusal clause is the last conditional before the undo sentence");
  // The honesty chain: the dialog's pre-statement is TRUE because the
  // server's DELETE guard refuses linked originals — the route's guard is
  // the clause's warrant, pinned beside the words it makes true.
  const route = read("src/app/api/jobs/[id]/route.ts");
  ok("R14 the server guard warrants the dialog's refusal clause",
    route.includes("existing._count.links > 0") &&
    route.includes("{ status: 409 }") &&
    route.includes("The engine workdir on disk is intentionally kept"),
    "the dialog pre-states what the server enforces — one story, mouth and guard");
  // R15 — the mint's own dto must speak the COPY's own count (zero). The
  // old line wrote the ROOT's count (+1) onto the copy's dto — the copy's
  // card badge claimed "×N linked copies consume this copy's outputs" and
  // its single-delete confirm spoke the refusal clause for a delete the
  // server accepts (_count.links for a fresh copy is 0). The clause's word
  // is true from birth; the root's badge rides the store's own bump.
  const jobsRoute = read("src/app/api/jobs/route.ts");
  ok("R15 the link mint's dto speaks the copy's OWN count (zero — the clause true from birth)",
    /dto\.linkCount = 0;/.test(jobsRoute) &&
    jobsRoute.includes("the copy's OWN inbound-link count is ZERO"),
    "the optimistic window's badge and door render the honest zero");
}

/* ---------- B band — the breathing law (t1014) ---------- */
console.log("B band — the import loops' breathing law (t1014):");
{
  // A folder/file-set import of a big bundle runs 100k+ SYNC link syscalls
  // inside the server's own event loop. Without a yield the roster GET that
  // would carry status:"running" cannot even be ANSWERED while the run
  // holds the loop (measured live: one fetch queued 4.7s behind a 120k-file
  // import and landed after the completion write) — the running face and
  // the progress face were unrenderable by construction, and the
  // single-delete confirm's "A running process will be stopped." could
  // never speak for exactly the runs big enough to need it. The cure: a
  // macrotask every IMPORT_YIELD_EVERY files — the polls interleave, the
  // faces render, the word can be spoken and made true mid-run (the walk's
  // leg 11 rides it live).
  const eng = read("src/lib/relion/engine.ts");
  ok("B1 the breathing helper stands with its measured law in words",
    eng.includes("const IMPORT_YIELD_EVERY = 256") &&
    eng.includes("const breatheImport = (): Promise<void> => new Promise((r) => setImmediate(r));") &&
    eng.includes("queued 4.7s behind a 120k-file import"),
    "the macrotask cadence + the honest measurement recorded beside the law");
  ok("B2 the folder face's workdir loop yields — and gates (t1015)",
    eng.includes("if (++folderYield % IMPORT_YIELD_EVERY === 0) {") &&
    eng.includes("await breatheImport();\n              nativeAbortGate(job.id); // t1015 — the stop door's flag unwinds the run here"),
    "the demo/EMPIAR shape — the loop every big folder import walks; the yield is now also the stop arm's gate");
  ok("B3 importFileSet is async (the IIFE lift kept the signature's shape)",
    eng.includes("): Promise<{ entries: string[]; unlinked: number }> {") &&
    eng.includes("return (async () => {"),
    "the sync per-file link loops became awaitable without renaming the law");
  ok("B4 both importFileSet loops yield — and gate (t1015)",
    (eng.match(/await breatheImport\(\);\n\s*nativeAbortGate\(jobId\);/g) ?? []).length >= 2,
    "the projectMic links AND the workdir exposure breathe; each breath is an abort gate");
  ok("B5 the single call site awaits the lifted set (and threads the gate's target)",
    eng.includes("const r = await importFileSet(hostFiles, projectDir, workdir, bridge, job.id);"),
    "the folder branch's sibling — the pattern/file-list path");
  ok("B6 the yield cadence is a named constant, not a magic number",
    (eng.match(/IMPORT_YIELD_EVERY/g) ?? []).length >= 4,
    "the law reads by name at every yield site");
}

/* ---------- W band — the twin wells ---------- */
console.log("W band — the twin wells (one window law, two readers):");
{
  // The pace face and the analytics panel (the t504 timeline, the t677
  // stage lens) are renderings of ONE window law: [startedAt, startedAt
  // + duration]. timeline-walk.ts is TS-shaped (interfaces + generics)
  // so it does not lift raw — the band pins the LAW AT BOTH SOURCES
  // instead: either reader changing its window arithmetic reddens here,
  // and the faces can never quietly fork.
  ok("W1 the pace well derives finishedAt from the window law",
    read("src/lib/pace.ts").includes("Date.parse(j.startedAt) + j.duration"),
    "pace.ts: finishedAt = start + duration");
  const tw = read("src/lib/timeline-walk.ts");
  ok("W2 the timeline well closes the window on the same law",
    tw.includes("start + Math.max(TIMELINE_MIN_WINDOW_MS, j.duration)") &&
    tw.includes("j.startedAt &&"),
    "timeline-walk.ts: end = start + max(1000, duration)");
  ok("W3 the failed rows keep their timeline windows but claim NO pace",
    face.failed.length === 1 && !face.rows.some((r) => r.id === "j4"),
    "the pace face never turns the failed window into a stage time");
}

/* ---------- the receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict} ${pass}/${pass + fail}`);
try {
  mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
  writeFileSync(TMP, JSON.stringify({
    unit: "t1009-pace-unit", verdict, pass, fail, at: new Date().toISOString(),
    face: "pipeline pace (t1009 product face): /api/projects/[id]/pace + pace-dialog + dashboard/palette doors + t1011 selection receipt/doc rows",
  }, null, 2));
} catch { /* receipt best-effort */ }
process.exit(fail === 0 ? 0 : 1);
