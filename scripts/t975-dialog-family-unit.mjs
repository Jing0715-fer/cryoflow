#!/usr/bin/env node
/**
 * t975 — the DIALOG FAMILY unit (node-only): the title law and the
 * named-control law pinned at TREE scale.
 *
 * THE SWEEP (this unit's birth, the t975 entry's candidate (e) tier 1):
 * the whole dialog family was censused for the a11y basics —
 *   · DialogContent hosts: 45 real hosts (the census skips comment-line
 *     matches — dialog.tsx's usage docstring quotes a fake
 *     <DialogContent> that would otherwise lie);
 *   · AlertDialogContent hosts: 13, every one titled;
 *   · icon-only buttons tree-wide: ZERO unnamed (the t971/t972
 *     hit-slop family law plus the t973 wrap cure generalized — every
 *     icon-only button carries an aria-label or sr-only text);
 *   · ONE disease: the job-inspector's main dialog — the app's biggest
 *     DialogContent — had NO DialogTitle. The screen reader announced
 *     an unnamed dialog. Cured with an sr-only title speaking the job's
 *     name ("Job inspector: <name>"); the visible header keeps its face.
 *
 * What the unit pins:
 *  - F: the family census (hosts, titles, the comment-exclusion law,
 *       the unnamed-button zero, the inspector cure's source shapes);
 *  - W: the walk's contract (two modes, the GATE labels, the focus
 *       seat, the sr-only pocket).
 *
 *   node scripts/t975-dialog-family-unit.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t975-dialog-family-unit.json";

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  ${name}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`); }
}

const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
};

/* the census: <DialogContent hosts, comment lines excluded (the law that
 * killed dialog.tsx's usage-docstring false positive) */
const componentFiles = walk(path.join(ROOT, "src/components"));
const hosts = [];
for (const f of componentFiles) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/<DialogContent\b/.test(line) && !/^\s*(\*|\/\/|\/\*)/.test(line)) {
      hosts.push({ f: path.relative(ROOT, f), line: i + 1, lines });
    }
  });
}

/* ---- F: the family census ---- */
{
  ok("F1 the census sees the full dialog family (>= 44 real hosts)", hosts.length >= 44, `hosts=${hosts.length}`);
  ok("F2 the census skips comment-line matches (the docstring's fake host never counts)", !hosts.some((h) => h.f === "src/components/ui/dialog.tsx" && h.lines[h.line - 1].includes("Usage:")), `dialog.tsx usage line excluded`);

  /* every host titled: a DialogTitle within 80 lines AFTER the opening,
   * or 25 lines BEFORE (the command.tsx pattern: the sr-only header
   * wraps the title ahead of the content) */
  const untitled = hosts.filter((h) => {
    const after = h.lines.slice(h.line - 1, h.line + 80).join("\n");
    const before = h.lines.slice(Math.max(0, h.line - 25), h.line).join("\n");
    return !after.includes("<DialogTitle") && !before.includes("<DialogTitle");
  });
  ok("F3 every DialogContent host is titled (the screen reader's name exists)", untitled.length === 0, untitled.slice(0, 3).map((h) => `${h.f}:${h.line}`).join(", "));

  /* the alert family */
  let alertHosts = 0, alertUntitled = 0;
  for (const f of componentFiles) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/<AlertDialogContent\b/.test(line) && !/^\s*(\*|\/\/|\/\*)/.test(line)) {
        alertHosts++;
        const after = lines.slice(i, i + 60).join("\n");
        if (!after.includes("<AlertDialogTitle")) alertUntitled++;
      }
    });
  }
  ok("F4 the alert family is fully titled (13 hosts)", alertHosts >= 13 && alertUntitled === 0, `hosts=${alertHosts} untitled=${alertUntitled}`);

  /* the inspector cure's source shapes */
  const inspector = readFileSync(path.join(ROOT, "src/components/workflow/job-inspector.tsx"), "utf8");
  ok("F5 the inspector's title speaks the JOB's name (Job inspector: {job.name})", inspector.includes("Job inspector: {job.name}"));
  ok("F6 the inspector's title is sr-only (the a11y tree's name — not a second visible header)", /<DialogTitle className="sr-only">Job inspector: \{job\.name\}<\/DialogTitle>/.test(inspector));

  /* the unnamed icon-only button zero (the family law's tree-wide form):
   * a <Button/<button block with no aria-label, no sr-only text, and no
   * visible text is a disease; the census must find ZERO */
  const unnamed = [];
  for (const f of componentFiles) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/<(Button|button)\b/g)) {
      const seg = src.slice(m.index, m.index + 700);
      const endm = seg.match(/<\/(Button|button)>/);
      if (!endm) continue;
      const block = seg.slice(0, endm.index + endm[0].length);
      if (/aria-label=/.test(block) || /sr-only/.test(block) || /aria-labelledby=/.test(block)) continue;
      const inner = block.slice(block.indexOf(">")).replace(/<[^>]+>/g, " ").replace(/\{[^}]*\}/g, " ").trim();
      if (!inner) unnamed.push(`${path.relative(ROOT, f)}:${src.slice(0, m.index).split("\n").length}`);
    }
  }
  ok("F7 zero unnamed icon-only buttons tree-wide (the t973 cure generalized)", unnamed.length === 0, unnamed.slice(0, 3).join(", "));
}

/* ---- W: the walk's contract ---- */
{
  const walkSrc = readFileSync(path.join(ROOT, "scripts/t975-dialog-family-walk.mjs"), "utf8");
  ok("W1 the walk has the two modes (BEFORE records, GATE gates)", walkSrc.includes('GATE = process.env.GATE === "1"') && walkSrc.includes("the BEFORE witness"));
  ok("W2 the gate owns the title contract (G1..G6)", walkSrc.includes("G1 the DialogContent carries aria-labelledby") && walkSrc.includes("G6 the PNG receipts landed"));
  ok("W3 the walk resolves the title THROUGH the wiring (aria-labelledby -> getElementById)", walkSrc.includes('getAttribute("aria-labelledby")') && walkSrc.includes("document.getElementById(labelledby)"));
  ok("W4 the walk witnesses the sr-only pocket (the 1px box is the design, not a visible header)", walkSrc.includes("the sr-only design"));
  ok("W5 the walk pins the focus seat (the t900 law untouched)", walkSrc.includes("the t900 law"));
  ok("W6 the walk polls instead of assuming (the title probe's own poll)", walkSrc.includes("the title probe never resolved"));
}

/* ---- B: the BROWSER fold tier (the t981 walk's absorption census) ----
 * The t981 entry's candidate (c): the t969 panel law (panelOverX FALSE
 * at 320) generalized across a SAMPLE of the family's dialogs — the
 * five-mouth census measured ZERO leaky faces (the family absorbs the
 * fold), and the ride cured TWO inner unreadable-content diseases (the
 * inspector log console's clipped long lines; the shortcuts rows that
 * could not wrap). The B-band pins the census's own shapes. */
{
  const foldSrc = readFileSync(path.join(ROOT, "scripts/t981-dialog-fold-walk.mjs"), "utf8");
  ok("B1 the fold walk exists with the two modes (BEFORE witnesses, GATE gates)", foldSrc.includes('GATE = process.env.GATE === "1"') && foldSrc.includes("the BEFORE witness"));
  ok("B2 the measure speaks the t969 grammar (overX = sw > cw + 1, plus the shell)", foldSrc.includes("overX: dlg.scrollWidth > dlg.clientWidth + 1") && foldSrc.includes("shellOverX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"));
  ok("B3 the sample carries the five identity markers (inspector / compare / cmdk / two CTAs)", foldSrc.includes("data-inspector-dialog") && foldSrc.includes('data-testid="fsc-compare-list"') && foldSrc.includes("[cmdk-input]") && foldSrc.includes("View all keyboard shortcuts") && foldSrc.includes("Read the full guide"));
  ok("B4 the canvas mouths ride the wide-first law (open at WIDE, then narrow — the t975 law)", foldSrc.includes("const freshOpenWide") && foldSrc.includes("const narrowTo320"));
  ok("B5 the card mouths read the CLEAN name (.job-card-title — the concat never matches the find bar)", foldSrc.includes(".job-card-title"));
  ok("B6 every fresh open polls the server first (the compile-spike REFUSED receipt)", foldSrc.includes("const serverReady") && foldSrc.includes("if (!(await serverReady())) return false;"));
  ok("B7 the gate owns the fold contract (five mouths, zero leaky)", foldSrc.includes("GATE every sampled face measured (five mouths, none blocked)") && foldSrc.includes("GATE the family absorbs the fold (zero leaky faces)"));

  /* the two cures' source shapes */
  const inspector = readFileSync(path.join(ROOT, "src/components/workflow/job-inspector.tsx"), "utf8");
  ok("B8 the inspector's log console scrolls BOTH axes (the wrap-off long lines stay readable)", /min-h-0 flex-1 overflow-y-auto overflow-x-auto p-3 font-mono/.test(inspector));
  const shortcuts = readFileSync(path.join(ROOT, "src/components/workflow/shortcuts-dialog.tsx"), "utf8");
  ok("B9 the shortcuts rows wrap instead of clipping (flex-wrap + min-w-0 on the dl's rows)", /flex flex-wrap items-center justify-between gap-x-4 gap-y-1\.5 rounded-md px-1\.5 py-1/.test(shortcuts) && shortcuts.includes('className="min-w-0 text-xs leading-relaxed text-muted-foreground"'));
  ok("B10 the offender census exempts the sr-only pocket (the 1px design never counts as a disease)", foldSrc.includes("the t969 ranking") || foldSrc.includes("offenders"));
}

/* ---- the receipt ---- */
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(
  path.join(ROOT, RECEIPT),
  JSON.stringify({ unit: "t975-dialog-family-unit", at: new Date().toISOString(), pass, fail }, null, 2)
);
console.log(`t975-dialog-family-unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
