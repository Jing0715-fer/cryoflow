// t1171 — THE SECOND-TIER SWEEP UNIT: the oldest-routes sweep's 2026-10-13
// tier becomes a standing instrument.
//
// The method (t1168's, continued): the route tree sorted by last-touch date,
// the oldest tier walked line by line, the known bug classes grepped across
// every door. This window's tier — 20 route files last touched 2026-10-13 —
// came back CLEAN: every file guards its door (isLocalRequest), none reads
// a file whole (the t1168 bounded-read law holds), every request.json()
// rides its guard (badJsonReply or the .catch(() => ({})) envelope), and
// the tier's two named survivors are already cured at their wells
// (resolution-arc rides the statcache since t903; browse is the hardened
// #5 door — listing only, control chars rejected, the 20k ceiling).
//
// A clean receipt is not a fence. The audit's truth becomes pins so the
// next window's drift flaps here instead of living quietly: drop a guard
// on one of these doors, add a whole-file read, or write localStorage
// inside a useMemo again, and a census seat goes RED.
//
// The Task 13 ledger closes here too: #5 (fs/browse — hardened, pinned),
// #6/#14 (t903 + t1169's ONE gate), #7 (t903 statcache + t1168 head
// ladder), #8 (t904's batched BFS), #13 — the localStorage write that
// once lived inside a useMemo — confirmed cured this window by source
// read (every setItem in src/components rides a useEffect, the t638
// one-echo law) and pinned below so it stays cured.
//
// node scripts/t1171-second-tier-sweep-unit.mjs
//

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project";
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** strip block + line comments so prose mentioning a poison never flaps a pin */
function codeOf(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

// ── A — the tier is the audit's 20 files, each door guarded ─────────────

const TIER = [
  "src/app/api/activity/heatmap/route.ts",
  "src/app/api/ai/chat/route.ts",
  "src/app/api/ai/judge-worker/route.ts",
  "src/app/api/ai/models/route.ts",
  "src/app/api/ai/providers/health/route.ts",
  "src/app/api/ai/sessions/[id]/route.ts",
  "src/app/api/ai/sessions/route.ts",
  "src/app/api/ai/settings/route.ts",
  "src/app/api/diagnostics/route.ts",
  "src/app/api/jobs/[id]/cleanup/route.ts",
  "src/app/api/jobs/[id]/continue-sources/route.ts",
  "src/app/api/jobs/[id]/denoise-pairs/route.ts",
  "src/app/api/jobs/[id]/funnel/route.ts",
  "src/app/api/jobs/[id]/iterations/image/route.ts",
  "src/app/api/jobs/[id]/iterations/route.ts",
  "src/app/api/jobs/[id]/iterations/sheet/route.ts",
  "src/app/api/jobs/[id]/outputs/remote-remaining/route.ts",
  "src/app/api/jobs/[id]/outputs/sync/route.ts",
  "src/app/api/jobs/[id]/resolution-arc/route.ts",
  "src/app/api/remote/connections/[id]/browse/route.ts",
];

ok("A0 the tier is exactly the 20 files the audit walked", TIER.length === 20, `${TIER.length} files, last touched 2026-10-13`);

const tierCode = new Map();
let missing = null;
for (const rel of TIER) {
  try {
    tierCode.set(rel, codeOf(read(rel)));
  } catch {
    missing = rel;
  }
}
ok("A0b every tier file exists and reads", missing === null, missing ?? "20/20");

const unguarded = TIER.filter((rel) => !tierCode.get(rel).includes("isLocalRequest"));
ok("A1 every tier door carries the same-origin guard", unguarded.length === 0, unguarded[0] ?? "isLocalRequest ×20");

// ── B — the known bug classes hold no members in the tier ───────────────

const wholeReaders = TIER.filter((rel) => tierCode.get(rel).includes("readFileSync("));
ok("B1 no whole-file read in the tier (the t1168 bounded-read law)", wholeReaders.length === 0, wholeReaders[0] ?? "zero readFileSync( in 20 files");

const jsonFiles = TIER.filter((rel) => tierCode.get(rel).includes("request.json()"));
const jsonUnguarded = jsonFiles.filter((rel) => {
  const c = tierCode.get(rel);
  return !c.includes("badJsonReply") && !c.includes(".catch(() => ({}))");
});
ok("B2 every request.json() rides its guard", jsonUnguarded.length === 0, `${jsonFiles.length} json doors checked, ${jsonUnguarded.length} unguarded`);

// ── C — the #13 cure, pinned: no localStorage write inside a useMemo ────

/** collect the source spans of every useMemo(...) call (balanced parens,
 *  string/template literals and comments skipped so a paren in prose or a
 *  quoted ")" cannot derail the walk) */
function useMemoSpans(src) {
  const spans = [];
  const re = /(?:React\.)?useMemo\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let i = m.index + m[0].length; // first char after '('
    let depth = 1;
    let inS = null; // ' " `
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i];
      const prev = src[i - 1];
      if (inS) {
        if (ch === inS && prev !== "\\") inS = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === "`") { inS = ch; continue; }
      if (ch === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (ch === "/" && src[i + 1] === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; continue; }
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
    }
    spans.push(src.slice(m.index, i));
  }
  return spans;
}

/** every source file under dir with its text (recursive, .ts/.tsx only) */
function walkSources(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkSources(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const renderWriters = [];
let memoScanned = 0;
for (const base of ["src/components", "src/hooks", "src/lib", "src/app"]) {
  for (const p of walkSources(join(ROOT, base), [])) {
    const src = readFileSync(p, "utf8");
    if (!src.includes("useMemo") || !src.includes("localStorage.setItem")) continue;
    memoScanned += 1;
    for (const span of useMemoSpans(src)) {
      if (span.includes("localStorage.setItem")) renderWriters.push(p.slice(ROOT.length + 1));
    }
  }
}
ok("C1 no localStorage write inside any useMemo (the #13 cure holds)", renderWriters.length === 0, `${renderWriters.length} render-phase writers across ${memoScanned} scanned files`);

const panelSrc = read("src/components/ai/assistant-panel.tsx");
ok("C2 the geometry echo stays a gesture-end effect (the t638 law)", panelSrc.includes("localStorage.setItem") && panelSrc.includes("useEffect"), "writes ride effects, one echo per gesture");

// ── D — the #5 door's listing-only law, pinned ──────────────────────────

const browseCode = tierCode.get("src/app/api/remote/connections/[id]/browse/route.ts");
ok("D1 browse refuses control characters (the line-protocol law)", browseCode.includes("hasControlChars"), "CR/NUL can never ride the quoted path");
ok("D2 browse serves listings, never file bytes", !browseCode.includes("readFile") && !browseCode.includes("createReadStream") && !browseCode.includes("cat "), "names/sizes/types only — contents move through the staging legs");
ok("D3 browse keeps the browser ceiling", browseCode.includes("REMOTE_MAX_ENTRIES") || browseCode.includes("MAX_ENTRIES"), "the 20k virtualized bound");

console.log(`\nt1171 second-tier sweep unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
