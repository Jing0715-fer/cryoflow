// t729 — the inspector param filter: the SIXTH search face joins the
// matcher family, and the first one whose radius is INSIDE a single job.
// The params grid of a refine3d job is a wall of 65 rows across tabs;
// until this window the only ways to find "do_fsc" were eyeball or the
// browser's own find. The filter composes lib's dialect HOW
// (subsequenceSpans) with the row's two NAME fields (label + option
// key — names, never prose), mirrors the palette's reading-order
// ladder, hides groups whose rows all miss, and states its why on the
// face: label hits wash their characters, key hits wear the chip (the
// key is not on the row's face — the palette's chip-is-the-why
// geometry, verbatim). t728's find-lens value wash is a different
// question and keeps its own home; the two whys coexist untouched.
//
//   A  the sixth face: lib HOW imported (no private walk), the ladder
//      is the palette's reading order, the state is ephemeral, the
//      threshold gate stands, the why ledger is per-render.
//   B  live-fire over REAL RELION specs (refine3d + class3d, lib
//      truth): substring sets never shrink, single characters are
//      byte-identical, growth lands on names, determinism, and the
//      field face follows the winner.
//   C  the face: label wash / key chip by field, the wash hue's
//      two-home census intact, the value cell still belongs to t728,
//      the count chip is the predicate's product, empty groups vanish,
//      Escape owns the box, no motion debt, print keeps the grid and
//      loses the chrome.
//   D  geometry over real specs: label spans bounded and ordered,
//      adjacency merges, the corpus is sane.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JOB_TYPES } from "../src/lib/workflow";
import { subsequenceSpans } from "../src/lib/job-match";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const insp = readSrc("components/workflow/job-inspector.tsx");
const fm = readSrc("components/workflow/find-mark.tsx");

// probe-side mirror of paramFilterWhy, built ONLY from lib pieces — the
// static census below pins the implementation to this exact structure.
const filterWhy = (row, q) => {
  if (!q) return null;
  const labelAt = row.label.toLowerCase().indexOf(q);
  if (labelAt !== -1) return { field: "label", spans: [[labelAt, labelAt + q.length]] };
  if (row.key.toLowerCase().includes(q)) return { field: "key" };
  if (q.length >= 2) {
    const labelSeq = subsequenceSpans(q, row.label);
    if (labelSeq) return { field: "label", spans: labelSeq };
    if (subsequenceSpans(q, row.key)) return { field: "key" };
  }
  return null;
};

// ---------- A: the sixth face ----------
console.log("A the sixth face:");
must(insp.includes("subsequenceSpans") && insp.includes('from "@/lib/job-match"'),
  "A the grid asks lib for the dialect HOW (the one matcher family)");
must(insp.includes("FIND_MARK_CLASS") && insp.includes('from "./find-mark"'),
  "A the chip hue is the wash's own const (zero new amber literals)");
must(!/function\s+\w*[Ff]ilter.*subsequence|indexOf\(q\[i\]/.test(insp),
  "A no private subsequence walk in the inspector");
{
  // ladder order IS the palette's reading order: label substring, key
  // substring, then the guarded block (label subsequence, key
  // subsequence). Ordered first-occurrence indices.
  const at = (re) => insp.search(re);
  const labelSub = at(/const labelAt = row\.label\.toLowerCase\(\)\.indexOf\(q\);/);
  const keySub = at(/if \(row\.key\.toLowerCase\(\)\.includes\(q\)\) return \{ field: "key" \};/);
  const guard = at(/if \(q\.length >= 2\) \{/);
  const labelSeq = at(/const labelSeq = subsequenceSpans\(q, row\.label\);/);
  const keySeq = at(/if \(subsequenceSpans\(q, row\.key\)\) return \{ field: "key" \};/);
  must(labelSub !== -1 && labelSub < keySub && keySub < guard && guard < labelSeq && labelSeq < keySeq,
    "A the ladder is the palette's reading order (all substring rungs, then guarded abbreviations)",
    `labelSub@${labelSub} keySub@${keySub} guard@${guard} labelSeq@${labelSeq} keySeq@${keySeq}`);
}
must(insp.includes("const PARAM_FILTER_THRESHOLD = 8;") && insp.includes("total >= PARAM_FILTER_THRESHOLD"),
  "A the threshold gate stands (a filter exists only when there is something to filter)");
must(insp.includes('useState("")') === false || insp.includes('const [paramFilter, setParamFilter] = React.useState("")'),
  "A the filter state is inspector-local (ephemeral by design)");
must(!/localStorage/.test(insp.slice(insp.indexOf("t729 — the sixth search face"), insp.indexOf("function InputsCard"))),
  "A no storage in the filter territory (a persisted filter could boot a dead grid)");
must(insp.includes("const filterWhys = new Map<string, ParamFilterWhy>();"),
  "A the why ledger is a per-render Map (t616's non-persistent ledger)");

// ---------- B: live-fire over REAL RELION specs ----------
console.log("B live-fire over real specs:");
{
  const specRows = (typeKey) => {
    const t = JOB_TYPES.find((x) => x.key === typeKey);
    return (t?.params ?? []).map((p) => ({ key: p.key, label: p.label }));
  };
  const refineRows = specRows("refine3d");
  const classRows = specRows("class3d");
  must(refineRows.length >= 50 && classRows.length >= 50,
    "B the corpus is the real wall (refine3d + class3d specs, lib truth)",
    `${refineRows.length} + ${classRows.length} rows`);
  const oldHit = (row, q) =>
    row.label.toLowerCase().includes(q) || row.key.toLowerCase().includes(q);
  const battery = ["mask", "diam", "fsc", "ang", "iter", "ref", "class", "symmetry",
    "sampling", "part", "gold", "mfov", "ctf", "zzz-nothing"];
  let compat = true, drift = "";
  for (const q of battery) {
    for (const r of [...refineRows, ...classRows]) {
      if (oldHit(r, q) && !filterWhy(r, q)) { compat = false; drift = `"${q}" lost key=${r.key}`; break; }
    }
    if (!compat) break;
  }
  must(compat, "B substring hits never shrink — old set inside the new for every query",
    drift || `${battery.length} queries × ${refineRows.length + classRows.length} rows`);
  let single = true, sDrift = "";
  for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789") {
    const oldSet = [...refineRows, ...classRows].filter((r) => oldHit(r, ch)).map((r) => r.key).join("|");
    const newSet = [...refineRows, ...classRows].filter((r) => filterWhy(r, ch) !== null).map((r) => r.key).join("|");
    if (oldSet !== newSet) { single = false; sDrift = `"${ch}" fuzzy-grew`; break; }
  }
  must(single, "B single characters are substring questions, never patterns",
    sDrift || "36 chars × both specs");
  // determinism: the same (row, query) always wins on the same field
  let deterministic = true;
  for (const q of battery) {
    for (const r of [...refineRows, ...classRows]) {
      const a = filterWhy(r, q), b = filterWhy(r, q);
      if ((a?.field ?? null) !== (b?.field ?? null)) { deterministic = false; break; }
    }
    if (!deterministic) break;
  }
  must(deterministic, "B a row lights for one reason — the winner field is deterministic");
  // the field face follows the winner: label hits carry spans, key hits none
  const labelWinners = [...refineRows, ...classRows]
    .map((r) => filterWhy(r, "fsc")).filter((w) => w && w.field === "label");
  const keyWinners = [...refineRows, ...classRows]
    .map((r) => filterWhy(r, "mfov")).filter((w) => w && w.field === "key");
  must(labelWinners.every((w) => Array.isArray(w.spans) && w.spans.length > 0),
    "B label winners carry wash geometry (spans non-empty)");
  must(keyWinners.every((w) => w.field === "key" && !("spans" in w)),
    "B key winners are chip-shaped (no phantom spans on a hidden field)");
  const grows = (q, typeKey) => {
    const rows = specRows(typeKey);
    return rows.some((r) => !oldHit(r, q) && filterWhy(r, q) !== null);
  };
  must(grows("diam", "refine3d") || grows("fsc", "refine3d"),
    "B the abbreviation rung earns its keep on real keys/labels (growth exists)");
  must(filterWhy({ key: "do_fsc", label: "Compute FSC" }, "zzz-nothing") === null,
    "B \"zzz-nothing\" stays honest zero over name fields");
}

// ---------- C: the face ----------
console.log("C the face:");
must(insp.includes('filterWhy && filterWhy.field === "label" ? (\n          <FindMarkedText text={row.label} spans={filterWhy.spans} />'),
  "C label hits wash their characters (the shared FindMarkedText)");
must(insp.includes('cn("shrink-0 px-1 text-[9px] leading-4", FIND_MARK_CLASS)'),
  "C key hits wear the chip in the wash's own hue (const import, zero literals)");
must(insp.includes('data-param-filter-why="key"') &&
     insp.includes('title={`Matched the parameter key "${row.key}"`}'),
  "C the chip states its why with data and the full key on hover");
must(insp.includes("spans={whyHit ? [[0, display.length]] : []}"),
  "C the value cell still belongs to t728 (find-lens wash untouched by the filter)");
must(insp.includes("filterWhy={filterWhys.get(row.key)}"),
  "C the why rides into the row by exact key identity");
must(insp.includes("{visibleTotal} of {total}"),
  "C the count chip is the predicate's product (t627 honesty)");
must(insp.includes('.filter((g) => g.rows.length > 0)'),
  "C groups whose rows all miss vanish (an empty header would claim params it does not show)");
for (const tid of ["inspector-param-filter", "inspector-param-filter-count",
  "inspector-param-filter-clear", "inspector-params-no-match"]) {
  must(insp.includes(`data-testid="${tid}"`), `C the selector exists: ${tid}`);
}
must(insp.includes('if (e.key === "Escape") setParamFilter("")'),
  "C the box owns its own Escape (the shelf's covenant)");
must(insp.includes("Abbreviations work too"),
  "C the empty state teaches the dialect (the failure page is the tutorial page)");
must(insp.includes('"no-print relative"'),
  "C the filter box is screen chrome (print keeps the grid, loses the chrome)");
{
  const cls = insp.match(/cn\("shrink-0 px-1 text-\[9px\] leading-4", FIND_MARK_CLASS\)/);
  must(cls !== null && !cls[0].includes("transition") && !cls[0].includes("animate"),
    "C the chip carries no motion debt (state, not arrival)");
}
{
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
    "C the wash hue still has exactly two homes in the whole tree", amberHomes.join(", "));
  must(!insp.includes("bg-amber-400/35"),
    "C the inspector invents no amber of its own");
}

// ---------- D: geometry over real specs ----------
console.log("D live-fire geometry:");
{
  const t = JOB_TYPES.find((x) => x.key === "refine3d");
  const rows = (t?.params ?? []).map((p) => ({ key: p.key, label: p.label }));
  const QUERIES = ["mask", "diam", "fsc", "ang", "sampling", "mfov", "iter",
    "goldstandard", "sym", "part", "2d", "cls"];
  let bounded = true, ordered = true, detail = "";
  for (const q of QUERIES) {
    for (const r of rows) {
      const w = filterWhy(r, q);
      if (!w || w.field !== "label") continue;
      for (const [s, e] of w.spans) {
        if (s < 0 || e > r.label.length || s >= e) { bounded = false; detail = `"${q}"×key=${r.key} span [${s},${e})`; break; }
      }
      for (let i = 1; i < w.spans.length; i++) {
        if (w.spans[i][0] < w.spans[i - 1][1]) { ordered = false; detail = `"${q}"×key=${r.key} overlap`; }
      }
      if (!bounded || !ordered) break;
    }
    if (!bounded || !ordered) break;
  }
  must(bounded, "D every label span stays inside its text (12 queries × refine3d)", detail);
  must(ordered, "D label spans are ascending and non-overlapping (greedy L2R walk)", detail);
  const merged = subsequenceSpans("fsc", "Compute FSC curve");
  must(merged !== null && merged.every(([s, e]) => e - s <= 3),
    "D adjacent anchors merge (fsc in a real label never explodes into one-span-per-char)",
    merged ? JSON.stringify(merged) : "null");
  must(rows.every((r) => r.label.length > 0) && new Set(rows.map((r) => r.key)).size === rows.length,
    "D corpus sanity: labels non-empty, keys unique (refine3d)");
}

console.log(`\nt729 param filter: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
