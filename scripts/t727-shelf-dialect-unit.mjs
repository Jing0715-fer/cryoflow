// t727 — the shelf dialect unit probe: the FOURTH search face joins the
// matcher family. The custom-template shelf (Task 132) has filtered its
// rows with a private name-only includes() for forty windows — it never
// heard the t653 abbreviation dialect, so "cls2" could not find a
// template named "2D Classification pass 2" even though the canvas, the
// find bar, the roster and the palette all answer that query the same
// way. This window the shelf composes its predicate from lib's dialect
// pieces (HOW is lib's subsequenceSpans; WHAT is the shelf's only
// operator-given domain — the template NAME), and the row washes the
// characters that won via the shared FindMarkedText (t720's law, fourth
// execution). Census verdicts recorded the same window: the log console
// stays substring-only (log lines are PROSE — t725's exemption law);
// the FilesTab path filter stays substring-only (paths are
// infrastructure words whose enumerable dimension is already a chip —
// t722's chip-is-for-enumerable argument); the projects switcher has no
// haystack at all (new UI, queued separately).
//
//   A  the merge: the shelf imports the lib dialect, the private
//      includes walk is extinct, the rung order mirrors palMatchWhy
//      (whole substring, then guarded in-order abbreviation), the
//      spans ledger is a per-render Map, the meta line stays unread,
//      substring hit sets are byte-compatible and single characters
//      never fuzzy — over a live fixture corpus of operator-given
//      template names.
//   B  the wash: FindMarkedText renders the row name, the amber hue
//      still has exactly two homes in the whole tree (find-mark + the
//      badge), the dialog invents no amber of its own, the trustworthy
//      guard still rides along.
//   C  the contracts: placeholder/aria byte-preserved, every t132-era
//      testid survives, the count chip stays the predicate's product,
//      the empty state teaches the dialect, the threshold gate and the
//      Escape covenant stand, the input's title names the dialect.
//   D  live-fire geometry: spans never escape the text, stay ordered,
//      adjacency merges; the t132 e2e's exact query battery reproduces
//      its expectations on the new predicate.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { subsequenceSpans } from "../src/lib/job-match";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const dlg = readSrc("components/workflow/template-presets-dialog.tsx");
const fm = readSrc("components/workflow/find-mark.tsx");

// ---------- A: the merge ----------
console.log("A the merge:");
must(dlg.includes('from "@/lib/job-match"') && dlg.includes("subsequenceSpans"),
  "A the shelf asks lib for the dialect HOW (one door, no second walk)");
must(!/templates\.filter\(\(t\) => t\.name\.toLowerCase\(\)\.includes\(q\)\)/.test(dlg) &&
     !/indexOf\(q\[i\]/.test(dlg) && !/function\s+\w*[Ss]ubsequence/.test(dlg),
  "A the private includes walk is extinct in the shelf");
{
  // rung order IS palMatchWhy's ladder: whole substring first (carrying
  // its own wash geometry), then the guarded abbreviation rung.
  const subAt = dlg.indexOf("const at = t.name.toLowerCase().indexOf(q);");
  const geomAt = dlg.indexOf("shelfSpans.set(t.id, [[at, at + q.length]]);");
  const guardAt = dlg.indexOf("if (q.length >= 2) {");
  const seqAt = dlg.indexOf("const spans = subsequenceSpans(q, t.name);");
  must(subAt !== -1 && subAt < geomAt && geomAt < guardAt && guardAt < seqAt,
    "A the rung order is substring-first, guarded subsequence second — geometry on rung one",
    `substr@${subAt} geom@${geomAt} guard@${guardAt} seq@${seqAt}`);
}
must(dlg.includes("const shelfSpans = new Map<") && !/useState<Map</.test(dlg),
  "A the spans ledger is a per-render Map (no state, no refs)");
{
  // the filter's callback reads ONLY the name: the meta line (jobs ·
  // wires · date) is infrastructure vocabulary — t724's law says
  // operators never abbreviate infra, and a mis-typed digit lighting
  // the whole shelf would be noise, not search.
  const cbStart = dlg.indexOf("templates.filter((t) => {");
  const cbEnd = dlg.indexOf(": templates;", cbStart);
  const cb = cbStart !== -1 && cbEnd !== -1 ? dlg.slice(cbStart, cbEnd) : "";
  must(cb.includes("t.name") && !/t\.(jobCount|edgeCount|createdAt)/.test(cb),
    "A the predicate reads the name and nothing else (meta line stays infra)",
    `callback ${cb.length} chars`);
}
{
  // live-fire over operator-given template names. Old formula = the
  // t132-era includes. New = the probe-side mirror of the shelf's
  // two-rung ladder, built ONLY from lib pieces.
  const NAMES = [
    "T132 alpha noble", "T132 beta ghost", "T132 gamma noble",
    "T32 alpha renamed", "2D Classification pass 2",
    "3D auto-refine shiny", "CTF refinement batch",
    "Apo-ferritin full pipeline", "Moles cleanup run",
    "Screening deep pass", "tomo tilt series setup",
  ];
  const oldHit = (name, query) => name.toLowerCase().includes(query.trim().toLowerCase());
  const newHit = (name, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    if (name.toLowerCase().includes(q)) return true;
    if (q.length >= 2) return subsequenceSpans(q, name) !== null;
    return false;
  };
  const battery = ["alpha", "ALPHA", "T132", "T32", "cls2", "arf", "ctfr", "ctf",
    "refine", "pass", "tomo", "noble", "cleanup", "pipeline", "zzz-nothing", "shiny"];
  let compat = true, drift = "";
  for (const query of battery) {
    for (const n of NAMES) {
      if (oldHit(n, query) && !newHit(n, query)) { compat = false; drift = `"${query}" lost "${n}"`; break; }
    }
    if (!compat) break;
  }
  must(compat, "A substring hits never shrink — old set inside the new for every query",
    drift || `${battery.length} queries × ${NAMES.length} names`);
  let single = true, sDrift = "";
  for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789") {
    const oldSet = NAMES.filter((n) => oldHit(n, ch)).join("|");
    const newSet = NAMES.filter((n) => newHit(n, ch)).join("|");
    if (oldSet !== newSet) { single = false; sDrift = `"${ch}" fuzzy-grew`; break; }
  }
  must(single, "A single characters are substring questions, never patterns",
    sDrift || "36 chars × full corpus");
  const grew = (query, name) => !oldHit(name, query) && newHit(name, query);
  must(grew("cls2", "2D Classification pass 2"),
    "A \"cls2\" finds \"2D Classification pass 2\" (the empty state's own promise, live)");
  must(grew("arf", "3D auto-refine shiny") && grew("ctfr", "CTF refinement batch"),
    "A abbreviation rung answers across word boundaries (arf → auto-refine, ctfr → CTF refinement)");
  must(!grew("zzz-nothing", "Screening deep pass"),
    "A \"zzz-nothing\" stays honest zero (the no-match covenant's own query)");
}

// ---------- B: the wash ----------
console.log("B the wash:");
must(dlg.includes("FindMarkedText") && dlg.includes('spans={shelfSpans.get(t.id) ?? []}'),
  "B the row name renders through the shared wash (t720's law, fourth execution)");
{
  // full-tree amber census: FIND_MARK_CLASS's hue keeps exactly TWO
  // homes — the wash's own file and the param badge. The shelf imports
  // the const; it must not invent a third literal.
  const srcRoot = path.join(here, "..", "src");
  const amberHomes = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(tsx?|css)$/.test(entry) && readFileSync(p, "utf8").includes("bg-amber-400/35"))
        amberHomes.push(path.relative(path.join(here, ".."), p));
    }
  };
  walk(srcRoot);
  must(amberHomes.length === 2 &&
       amberHomes.some((p) => p.endsWith("find-mark.tsx")) &&
       amberHomes.some((p) => p.endsWith("param-dialect-badge.tsx")),
    "B the amber hue still has exactly two homes in the whole tree", amberHomes.join(", "));
  must(!dlg.includes("bg-amber-400/35"),
    "B the shelf invents no amber of its own (const import, zero literals)");
  must(fm.includes("trustworthy") && fm.includes("spans.every"),
    "B the trustworthy guard rides along (a wrong wash is worse than none)");
}
{
  // the name <p> keeps its title (hover = the full name, wash or not)
  // and the raw text node is extinct inside the row face.
  const pAt = dlg.indexOf('className="truncate text-xs font-medium" title={t.name}');
  must(pAt !== -1 && dlg.indexOf("<FindMarkedText") > pAt,
    "B the row keeps title={t.name} (hover truth survives the wash)");
  must(!/^\s*\{t\.name\}\s*$/m.test(dlg),
    "B the raw name text node is extinct (every render goes through the wash)");
}

// ---------- C: the contracts ----------
console.log("C the contracts:");
must(dlg.includes('placeholder="Filter templates by name…"') &&
     dlg.includes('aria-label="Filter templates by name"'),
  "C placeholder and aria-label byte-preserved (the t132 contract unchanged)");
for (const tid of ["custom-template-search", "custom-template-search-count",
  "custom-template-search-clear", "custom-templates-no-match", "custom-template-row"]) {
  must(dlg.includes(`data-testid="${tid}"`) || dlg.includes(`data-canvas-ui="${tid}"`),
    `C the t132-era selector survives: ${tid}`);
}
must(dlg.includes("{visible.length} of {templates.length}"),
  "C the count chip stays the predicate's product (t627 honesty)");
must(dlg.includes("Abbreviations work too") && dlg.includes("cls2"),
  "C the empty state teaches the dialect (the failure page is the tutorial page)");
must(dlg.includes("templates.length >= SEARCH_THRESHOLD"),
  "C the threshold gate stands (search exists only when there is something to search)");
must(dlg.includes('if (e.key === "Escape") setSearchQ("")'),
  "C the Escape covenant stands (the box owns its own Escape)");
must(dlg.includes('title="Substring first, then in-order abbreviations — matched characters highlight"'),
  "C the input's title names the dialect (no tutorial, one hover)");
{
  // e2e-contract sim: the t132 e2e's exact query battery, replayed on
  // the new predicate over its fixture shape (alpha/beta/gamma/delta +
  // a renamed T32 row). "alpha" filters to substring rows, case
  // carries, "zzz-nothing" is honest zero, "T132" keeps its three.
  const fixtures = ["T132 alpha noble", "T132 beta ghost", "T132 gamma noble",
    "T132 delta noble", "T32 alpha renamed"];
  const hit = (name, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    if (name.toLowerCase().includes(q)) return true;
    if (q.length >= 2) return subsequenceSpans(q, name) !== null;
    return false;
  };
  must(fixtures.filter((n) => hit(n, "alpha")).length === 2 &&
       fixtures.filter((n) => hit(n, "ALPHA")).length === 2,
    "C e2e sim: \"alpha\"/\"ALPHA\" both filter to the two alpha rows (B3+B5)");
  must(fixtures.filter((n) => hit(n, "zzz-nothing")).length === 0,
    "C e2e sim: \"zzz-nothing\" matches nothing (B6)");
  must(fixtures.filter((n) => hit(n, "T132")).length === 4,
    "C e2e sim: \"T132\" keeps exactly its four T132 rows (F1)");
}

// ---------- D: live-fire geometry ----------
console.log("D live-fire geometry:");
{
  const NAMES = ["2D Classification pass 2", "3D auto-refine shiny",
    "CTF refinement batch", "Apo-ferritin full pipeline", "T132 alpha noble"];
  const QUERIES = ["cls2", "arf", "ctfr", "afr", "pipeline", "ALPHA", "t132",
    "shiny", "scrn", "p2", "2d"];
  let bounded = true, ordered = true, detail = "";
  for (const q of QUERIES) {
    for (const n of NAMES) {
      const spans = subsequenceSpans(q, n);
      if (!spans) continue;
      for (const [s, e] of spans) {
        if (s < 0 || e > n.length || s >= e) { bounded = false; detail = `"${q}"×"${n}" span [${s},${e})`; break; }
      }
      for (let i = 1; i < spans.length; i++) {
        if (spans[i][0] < spans[i - 1][1]) { ordered = false; detail = `"${q}"×"${n}" overlap at ${i}`; }
      }
      if (!bounded || !ordered) break;
    }
    if (!bounded || !ordered) break;
  }
  must(bounded, "D every span stays inside its text (11 queries × 5 names)", detail);
  must(ordered, "D spans are ascending and non-overlapping (the walk is greedy L2R)", detail);
  const merged = subsequenceSpans("cla", "Classification");
  must(merged && merged.length === 1 && merged[0][0] === 0 && merged[0][1] === 3,
    "D adjacent anchors merge into one span (cla → [0,3) of \"classification\")",
    merged ? JSON.stringify(merged) : "null");
  must(NAMES.every((n) => n.length > 0) && new Set(NAMES).size === NAMES.length,
    "D corpus sanity: names non-empty and unique");
}

console.log(`\nt727 shelf dialect: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
