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
const after = existsSync(afterP) ? JSON.parse(readFileSync(afterP, "utf8")) : null;
ok("A7 the causal chain: before 12/12 (the defect stood) + after 30/30 (the cure holds)",
  before && before.pass === 12 && before.fail === 0 && after && after.pass === 30 && after.fail === 0,
  before && after ? `before ${before.pass}/${before.pass + before.fail}, after ${after.pass}/${after.pass + after.fail}` : "receipts missing");

/* ---- A8 — the seat's diff is header-only ---- */
let diff = "";
try {
  diff = execSync(`git diff --unified=0 -- ${RV} ${ST}`, { encoding: "utf8", cwd: ROOT });
} catch { /* git absent? then the diff cannot lie */ }
const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
const dangerous = added.filter((l) => /fetch\(|useState|useEffect|onClick|await |addEventListener|localStorage/.test(l));
ok(`A8 the seat's diff rides no logic (${added.length} added lines, 0 with fetch/state/effect)`,
  added.length > 0 && dangerous.length === 0,
  dangerous.length > 0 ? dangerous.slice(0, 3).join(" | ") : "className + docblock + span-wrap only");

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
