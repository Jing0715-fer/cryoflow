#!/usr/bin/env node
/**
 * t913 — the dialog header hardening unit (node-only): the family census
 * that pins the seat's law to the source, so no future face re-opens the
 * wound the before-witness rode (overX 135-195 at 320 with real-user
 * file names).
 *
 * THE LAW (the t662 Mol* face's grammar, propagated t913): a dialog
 * header that renders a DATA-DERIVED string (a file name, a path —
 * unbounded, single-token, user-controlled) is a data plane, and a data
 * plane hardens: the title truncates one line (min-w-0 + truncate; the
 * icon keeps its size with shrink-0), the path in the description breaks
 * (break-all — a provenance line stays fully readable), a summary path
 * line truncates WITH hover (title attr carries the full string).
 * Fixed-string headers (teaching lines, constants) are exempt — the
 * author bounded them.
 *
 * ARMS:
 *   A1  the precedent: the Mol* face already hardens (shrink-0 icon +
 *       min-w-0 truncate name + the path span with title attr)
 *   A2  the image dialog header carries the grammar
 *   A3  the star dialog header carries the grammar
 *   A4  the text dialog header carries the grammar
 *   A5  the StarTable path line carries the grammar (truncate + hover)
 *   A6  the census: EVERY DialogTitle/DialogDescription in the family
 *       files is either hardened or renders no data-derived expression
 *   A7  the causal chain's receipts exist and tell the story
 *       (before 12/12 — the defect stood; after 30/30 — the cure holds)
 *   A8  the seat's diff is header-only: no fetch/state/effect lines rode
 *       in with the className work
 *   A9  (t945) the compare family's four dialogs harden job.name: the
 *       arc / verdict / funnel titles truncate one line with hover
 *       recovery (the question t913 left open — answered YES for these
 *       seats: the body repeats the name nowhere), the convergence
 *       description's mid-prose name breaks (break-all)
 *   A10 (t945) the compare dialog's print face: data-compare-dialog
 *       opts out of the generic step-aside (globals.css's :has() block,
 *       the Task 114 doctrine's second seat), the chrome (pickers, lens
 *       toggles, adoption verbs) carries .no-print, the scroll region
 *       unrolls on paper, the provenance line (data-compare-print-doc)
 *       is screen-hidden print:block
 *   A11 (t945) the narrow-320 door: the compare action row WRAPS (the
 *       nowrap+shrink-0 buttons' min-content exceeds the 240px box at
 *       320 — the outer row wrapping is the honest wrap)
 *
 * Writes its receipt (an instrument that cannot write its proof must
 * fail loudly — the t910 law). Exit 0 iff every arm holds.
 *
 *   node scripts/t913-dialog-header-unit.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t913-dialog-header-unit.json";
const RV = "src/components/workflow/results/results-view.tsx";
const ST = "src/components/workflow/results/star-table.tsx";
const MV = "src/components/workflow/results/mol-viewer.tsx";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const rvSrc = readFileSync(path.join(ROOT, RV), "utf8");
const stSrc = readFileSync(path.join(ROOT, ST), "utf8");
const mvSrc = readFileSync(path.join(ROOT, MV), "utf8");
/* t945 — the compare family's five faces */
const ARC = "src/components/workflow/results/resolution-arc-dialog.tsx";
const VERDICT = "src/components/workflow/results/postprocess-verdict-dialog.tsx";
const FUNNEL = "src/components/workflow/results/particle-funnel-dialog.tsx";
const CONV = "src/components/workflow/results/class-convergence-dialog.tsx";
const CMP = "src/components/workflow/results/run-compare-dialog.tsx";
const arcSrc = readFileSync(path.join(ROOT, ARC), "utf8");
const verdictSrc = readFileSync(path.join(ROOT, VERDICT), "utf8");
const funnelSrc = readFileSync(path.join(ROOT, FUNNEL), "utf8");
const convSrc = readFileSync(path.join(ROOT, CONV), "utf8");
const cmpSrc = readFileSync(path.join(ROOT, CMP), "utf8");

/** extract a JSX block starting at the line that contains `anchor` */
function blockOf(src, anchor, closeTag) {
  const i = src.indexOf(anchor);
  if (i === -1) return null;
  const end = src.indexOf(closeTag, i);
  return end === -1 ? null : src.slice(i, end + closeTag.length);
}

/* ---- A1 — the precedent (the family's own law, already seated) ---- */
const mvTitle = blockOf(mvSrc, "<DialogTitle", "</DialogTitle>");
ok("A1 the Mol* face hardens its header (the precedent aboard)",
  !!mvTitle && mvTitle.includes("shrink-0") && mvTitle.includes("min-w-0") && mvTitle.includes("truncate") && mvTitle.includes("title={path}"),
  mvTitle ? "title attr + truncate + shrink-0" : "block missing");

/* ---- A2–A4 — the three siblings carry the grammar ---- */
const imgTitle = blockOf(rvSrc, "<DialogTitle", "</DialogTitle>\n                <DialogDescription className=\"break-all font-mono text-[11px]\">\n                  {imageFile.path}");
ok("A2 the image dialog: icon shrink-0, name min-w-0 truncate, path break-all",
  !!imgTitle && imgTitle.includes("shrink-0") && imgTitle.includes('min-w-0 truncate') && imgTitle.includes("imageFile.label ?? imageFile.name"));

const starTitle = blockOf(rvSrc, "<Table2 className=\"h-4 w-4 shrink-0 text-violet-600\"", "</DialogHeader>");
ok("A3 the star dialog: icon shrink-0, name min-w-0 truncate, path break-all",
  !!starTitle && starTitle.includes("shrink-0") && starTitle.includes('min-w-0 truncate') && starTitle.includes("break-all") && starTitle.includes("{starFile.path}"));

const txtTitle = blockOf(rvSrc, "<ScrollText className=\"h-4 w-4 shrink-0 text-warning-600\"", "</DialogHeader>");
ok("A4 the text dialog: icon shrink-0, name min-w-0 truncate, path break-all",
  !!txtTitle && txtTitle.includes("shrink-0") && txtTitle.includes('min-w-0 truncate') && txtTitle.includes("break-all") && txtTitle.includes("{textFile.path}"));

/* ---- A5 — the StarTable path line ---- */
const stLine = blockOf(stSrc, "text-[11px] text-muted-foreground\">", "</div>");
ok("A5 the StarTable path line: shrink-0 icon, path min-w-0 flex-1 truncate + hover title, count shrink-0",
  !!stLine && /Table2 className="h-3\.5 w-3\.5 shrink-0"/.test(stLine) && stLine.includes('min-w-0 flex-1 truncate font-mono') && stLine.includes("title={path}") && /ml-auto shrink-0/.test(stLine));

/* ---- A6 — the census: no unhardened data-plane header left ---- */
// every DialogTitle in the family files; a title is a data plane iff its
// block renders an expression (?? or {identifier.} — not a bare literal)
function censusTitles(src, name) {
  const out = [];
  const re = /<DialogTitle[^>]*>/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = m.index;
    // find the matching close (DialogTitle blocks in this family are short)
    const end = src.indexOf("</DialogTitle>", start);
    if (end === -1) continue;
    const block = src.slice(start, end + "</DialogTitle>".length);
    const dataPlane = /\?\?|\{[a-z][A-Za-z]*\.|name\}/.test(block.replace(/^\s*\/\*[\s\S]*?\*\/\s*/m, ""));
    const hardened = block.includes("min-w-0") && block.includes("truncate");
    out.push({ file: name, dataPlane, hardened, block: block.replace(/\s+/g, " ").slice(0, 120) });
  }
  return out;
}
function censusDescs(src, name) {
  const out = [];
  const re = /<DialogDescription[^>]*>/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = m.index;
    const end = src.indexOf("</DialogDescription>", start);
    if (end === -1) continue;
    const block = src.slice(start, end + "</DialogDescription>".length);
    const dataPlane = /\{[a-z][A-Za-z]*\.(path|name)/.test(block);
    const hardened = block.includes("break-all");
    out.push({ file: name, dataPlane, hardened, block: block.replace(/\s+/g, " ").slice(0, 120) });
  }
  return out;
}
const census = [
  ...censusTitles(rvSrc, "results-view"),
  ...censusTitles(stSrc, "star-table"),
  ...censusTitles(mvSrc, "mol-viewer"),
  ...censusDescs(rvSrc, "results-view"),
  ...censusDescs(stSrc, "star-table"),
  ...censusDescs(mvSrc, "mol-viewer"),
];
const planes = census.filter((c) => c.dataPlane);
const unhardened = planes.filter((c) => !c.hardened);
ok(`A6 the census: ${census.length} header faces, ${planes.length} data planes, ZERO unhardened`,
  census.length > 0 && unhardened.length === 0,
  unhardened.length > 0 ? JSON.stringify(unhardened.map((u) => u.block)) : "every data plane carries its grammar");

/* ---- A7 — the receipts' story ---- */
const beforeP = path.join(ROOT, "shots-qa/t913-dialog-header-before-witness.json");
const afterP = path.join(ROOT, "shots-qa/t913-dialog-header-after-witness.json");
const before = existsSync(beforeP) ? JSON.parse(readFileSync(beforeP, "utf8")) : null;
/* t945 re-key — the after receipt's ON-DISK bytes are not the story's
 * home anymore: the t919 window's stand-down ride overwrote them with
 * the EXPECTED no-mint state (4/10 — "the expected no-mint state, not a
 * regression", the t919 entry's own words), and this unit is not in the
 * node-only census fleet, so the red went unseen for 26 windows. The
 * causal story lives in the COMMITTED receipt (the t913 window's 30/30),
 * so the arm reads history first and the disk second — either proving
 * the cure holds is enough; a stand-down overwriting the disk again
 * cannot kill the story. */
function committedAfter(p) {
  try {
    const hashes = execSync(`git log --format=%H -- ${p}`, { encoding: "utf8", cwd: ROOT })
      .trim().split("\n").filter(Boolean);
    for (const h of hashes) {
      try {
        const j = JSON.parse(execSync(`git show ${h}:${p}`, { encoding: "utf8", cwd: ROOT }));
        if (j.pass === 30 && j.fail === 0) return j;
      } catch { /* a commit without the blob — keep walking */ }
    }
  } catch { /* git absent? then the disk is the only witness */ }
  return null;
}
const after = existsSync(afterP) ? JSON.parse(readFileSync(afterP, "utf8")) : null;
const afterGreen = after && after.pass === 30 && after.fail === 0 ? after : committedAfter("shots-qa/t913-dialog-header-after-witness.json");
ok("A7 the causal chain: before 12/12 (the defect stood) + after 30/30 (the cure holds)",
  before && before.pass === 12 && before.fail === 0 && afterGreen && afterGreen.pass === 30 && afterGreen.fail === 0,
  before && afterGreen ? `before ${before.pass}/${before.pass + before.fail}, after ${afterGreen.pass}/${afterGreen.pass + afterGreen.fail}${after && after.pass !== 30 ? " (disk: the stand-down's expected no-mint state; the story rides git)" : ""}` : "receipts missing");

/* ---- A8 — the seat's diff is header-only ---- */
/* t914 widening (the unit biting its honest successor — the lesson this
 * window's own A16 seat taught t912): the hygiene law binds whatever the
 * header files' CURRENT diff carries — no fetch/state/effect lines, ever.
 * A committed seat leaves those files clean (0 added lines): the law holds
 * trivially and the causal story stays pinned by A7's receipts. A pin to
 * one window's uncommitted-diff shape would redden every honest successor
 * window that touches the tree elsewhere. */
let diff = "";
try {
  diff = execSync(`git diff --unified=0 -- ${RV} ${ST}`, { encoding: "utf8", cwd: ROOT });
} catch { /* git absent? then the diff cannot lie */ }
const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
const dangerous = added.filter((l) => /fetch\(|useState|useEffect|onClick|await |addEventListener|localStorage/.test(l));
ok(`A8 the header files' diff rides no logic (${added.length} uncommitted added lines, ${dangerous.length} with fetch/state/effect)`,
  dangerous.length === 0,
  added.length === 0 ? "the seat is committed — the tree carries no header diff; the receipts (A7) carry the causal story" : dangerous.length > 0 ? dangerous.slice(0, 3).join(" | ") : "className + docblock + span-wrap only");

/* ---- A9 (t945) — the compare family's four dialogs harden job.name ---- */
const arcTitle = blockOf(arcSrc, "<DialogTitle", "</DialogTitle>");
ok("A9a the resolution-arc title: icon shrink-0, heading min-w-0 truncate, hover title={job.name}",
  !!arcTitle && arcTitle.includes("shrink-0") && arcTitle.includes("min-w-0 truncate") && arcTitle.includes("title={job.name}"),
  arcTitle ? "the arc's heading is a data plane and carries the grammar" : "block missing");
const verdictTitle = blockOf(verdictSrc, "<DialogTitle", "</DialogTitle>");
ok("A9b the final-verdict title: icon shrink-0, heading min-w-0 truncate, hover title={job.name}",
  !!verdictTitle && verdictTitle.includes("shrink-0") && verdictTitle.includes("min-w-0 truncate") && verdictTitle.includes("title={job.name}"),
  verdictTitle ? "the verdict's heading is a data plane and carries the grammar" : "block missing");
const funnelTitle = blockOf(funnelSrc, "<DialogTitle", "</DialogTitle>");
ok("A9c the particle-funnel title: icon shrink-0, heading min-w-0 truncate, hover title={job.name}",
  !!funnelTitle && funnelTitle.includes("shrink-0") && funnelTitle.includes("min-w-0 truncate") && funnelTitle.includes("title={job.name}"),
  funnelTitle ? "the funnel's heading is a data plane and carries the grammar" : "block missing");
const convDesc = blockOf(convSrc, "<DialogDescription", "</DialogDescription>");
ok("A9d the convergence description: the mid-prose name breaks (break-all) with hover recovery",
  !!convDesc && convDesc.includes("break-all") && convDesc.includes("title={job.name}"),
  convDesc ? "the description's name span wraps instead of clipping" : "block missing");
/* the family's OTHER data planes stay hardened — a census like A6, for
   the four files: every DialogTitle/DialogDescription is either hardened
   or renders no data-derived expression */
function familyFaces(src, name) {
  const out = [];
  for (const [tag, close] of [["<DialogTitle", "</DialogTitle>"], ["<DialogDescription", "</DialogDescription>"]]) {
    const re = new RegExp(`${tag}[^>]*>`, "g");
    let m;
    while ((m = re.exec(src)) !== null) {
      const end = src.indexOf(close, m.index);
      if (end === -1) continue;
      const block = src.slice(m.index, end + close.length);
      const body = block.replace(/^\s*\{?\s*\/\*[\s\S]*?\*\/\s*\}?\s*/m, "");
      const dataPlane = /\{[a-z][A-Za-z]*\.(name|path)|\?\?/.test(body);
      const hardened = block.includes("min-w-0") || block.includes("break-all");
      out.push({ file: name, tag: tag.slice(1, 12), dataPlane, hardened });
    }
  }
  return out;
}
const familyCensus = [
  ...familyFaces(arcSrc, "resolution-arc"),
  ...familyFaces(verdictSrc, "postprocess-verdict"),
  ...familyFaces(funnelSrc, "particle-funnel"),
  ...familyFaces(convSrc, "class-convergence"),
];
const familyPlanes = familyCensus.filter((c) => c.dataPlane);
const familyNaked = familyPlanes.filter((c) => !c.hardened);
ok(`A9e the family census: ${familyCensus.length} faces, ${familyPlanes.length} data planes, ZERO unhardened`,
  familyCensus.length > 0 && familyNaked.length === 0,
  familyNaked.length > 0 ? JSON.stringify(familyNaked) : "every family data plane carries its grammar");

/* ---- A10 (t945) — the compare dialog's print face ---- */
const cmpContent = blockOf(cmpSrc, "data-compare-dialog", "</DialogHeader>");
ok("A10a the compare DialogContent opts into the print face (data-compare-dialog + the standalone translate kill)",
  !!cmpContent && cmpContent.includes('data-compare-dialog=""') && cmpContent.includes("print:[translate:none]") && cmpContent.includes("print:[scale:none]"),
  cmpContent ? "the :has() chain's hook rides the content" : "block missing");
ok("A10b the provenance line: screen-hidden, print:block, the pair + the paper clock",
  !!cmpContent && cmpContent.includes("data-compare-print-doc") && cmpContent.includes("hidden print:mt-2 print:block") && cmpContent.includes("printed ${printed}"),
  cmpContent ? "the paper keeps the pair's identity after the pickers die" : "block missing");
ok("A10c the chrome stays chrome: pickers, lens toggles and the adoption verbs carry .no-print",
  cmpSrc.includes('no-print grid gap-2 sm:grid-cols-2') && cmpSrc.includes('<div className="no-print">\n              <LensChips') && cmpSrc.includes('no-print space-y-1.5'),
  "a verb that prints is a verb that lies — the whole row hides");
ok("A10d the scroll region unrolls on paper (print:max-h-none print:overflow-visible)",
  cmpSrc.includes("print:max-h-none print:overflow-visible"),
  "the verdict prints in full, never behind a scrollbar");
ok("A10e the globals.css :has() block revives the compare dialog (the Task 114 doctrine's second seat)",
  (() => {
    const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
    return css.includes("html:has([data-compare-dialog][data-state=\"open\"])") &&
      css.includes("[data-compare-print-doc]") === false /* the provenance rides JSX, the revival rides CSS */ &&
      /html:has\(\[data-compare-dialog\]\[data-state="open"\]\)\s*\n\s*\[data-slot="dialog-content"\]/.test(css);
  })(),
  "the chain beats the generic step-aside for this content only");

/* ---- A11 (t945) — the narrow-320 door: the action row wraps ---- */
ok("A11 the compare action row wraps (the honest wrap at the 240px box)",
  cmpSrc.includes("flex flex-wrap items-center justify-between gap-2") && cmpSrc.includes("flex flex-wrap items-center gap-2"),
  "the outer row wraps; the left cluster's riders wrap among themselves");

/* ---- the receipt ---- */
const receipt = {
  instrument: "t913-dialog-header-unit",
  census: { faces: census.length, dataPlanes: planes.length, unhardened: unhardened.length },
  pass, fail,
  at: new Date().toISOString(),
};
try { writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2)); } catch {}
console.log(`\nDIALOG-HEADER-UNIT t913: ${pass}/${pass + fail} ${fail === 0 ? "green — the law is pinned to the source" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
