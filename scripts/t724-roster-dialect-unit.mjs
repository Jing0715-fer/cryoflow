// t724 — the roster dialect unit probe: the dashboard's roster search
// stops being a second matcher. Task 94's haystack used a private
// includes() over a template string — it never heard the t653
// abbreviation dialect ("cls2") or the t722 param dialect ("mask:20").
// One matcher for every search surface is the law; this window the
// roster joins it, and the dialect badge becomes a shared component
// (the vocabulary-lives-in-two-homes law, t720, now for a chip).
//
//   A  the merge: dashboard imports THE matcher, the private template
//      join is extinct, param runs are param-only, ws/status stay raw.
//   B  the badge's single source: one component, both faces import it,
//      the amber hue is defined exactly once in the tree.
//   C  the contracts that must survive: cascade shares the predicate,
//      count chip = rows, placeholder names the dialect, badge sits
//      between input and count.
//   D  purity: one matcher definition in the tree, no private
//      subsequence, the badge is a state (no motion debt).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
// t733 jiti codemod — Node ≥24 ESM no longer resolves extensionless
// imports; jiti (in-tree) loads the REAL lib for live-fire, with the
// project's @/ alias wired so lib-internal @/ imports resolve too.
// In-place (not hoisted): the probe's own execution order is law.
import { createJiti } from "jiti";
import * as __path from "node:path";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": __path.resolve(import.meta.dirname, "..", "src") },
});
const { jobMatchesQuery, jobMatchWhy, parseParamQuery } = await __jiti.import("../src/lib/job-match");

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const dash = readSrc("components/workflow/project-dashboard.tsx");
const bar = readSrc("components/workflow/canvas-find-bar.tsx");
const badge = readSrc("components/workflow/param-dialect-badge.tsx");
const lib = readSrc("lib/job-match.ts");

// ---------- A: the merge ----------
console.log("A the merge:");
must(dash.includes('from "@/lib/job-match"'),
  "A the dashboard imports THE matcher from lib");
must(dash.includes("jobMatchesQuery(j, rosterQuery)"),
  "A inHaystack asks the matcher first (name/type/param through one door)");
must(!/\$\{j\.name\}\s*\$\{j\.type\}/.test(dash),
  "A the private template join is extinct — no second haystack");
must(/rosterParamDialect\)\s*return false/.test(dash),
  "A param runs are param-only: the dialect short-circuits before ws/status");
must(dash.includes("wsNameById.get(j.workspaceId) ?? \"\").toLowerCase().includes(q)"),
  "A workspace words stay raw includes (infrastructure vocabulary)");
must(dash.includes("j.status.includes(q)"),
  "A status words stay raw includes (a subsequence over short words is noise)");
{
  // live evidence through the real lib — the roster's new vocabulary.
  // The "cls2" fixture name honors t653's own example: the abbreviation
  // answers a Class2D-sounding TEXT (card name or type label), not a
  // "2D Classification" label whose letters never spell cls2 in order.
  const cls = { id: "j", name: "Class2D pass 2", type: "class2d", status: "completed", params: {} };
  must(jobMatchesQuery(cls, "cls2"),
    "A abbreviation dialect works through the same predicate: cls2 finds the Class2D-named run");
  const masked = { id: "j", name: "Post-processing", type: "postprocess", status: "running", params: { mask_diameter: 20 } };
  must(jobMatchesQuery(masked, "mask:20"),
    "A param dialect works through the same predicate: mask:20 finds the runner");
  must(jobMatchWhy(masked, "mask:20").source === "param",
    "A the why is the param member (status 'running' never co-answers a param query)");
  must(jobMatchesQuery(masked, "post") && !parseParamQuery("post"),
    "A bare text stays a text question (no dialect hijack)");
}

// ---------- B: the badge's single source ----------
console.log("B badge single source:");
must(badge.includes("export function ParamDialectBadge"),
  "B the badge is a component, exported once");
must(bar.includes('from "./param-dialect-badge"') && dash.includes('from "./param-dialect-badge"'),
  "B both search faces import the same marker");
{
  const amberCount = [bar, dash, badge].filter((s) => s.includes("bg-amber-400/35")).length;
  must(amberCount === 1 && badge.includes("bg-amber-400/35"),
    "B the find amber is defined exactly once in the tree (the badge component)");
}
must(badge.includes("parseParamQuery(query)") || /parseParamQuery\(\s*query\s*\)/.test(badge),
  "B the badge arms from the SAME parser the matcher runs");
must(bar.includes('testid="canvas-find-param-badge"') && dash.includes('testid="roster-param-badge"'),
  "B two faces, two testids, one component");
must(!badge.includes("bg-amber-400/35 dark:bg-amber-400/25 ") ||
      (badge.match(/bg-amber-400/g) || []).length === 2,
  "B the amber pair (light + dark) lives inside the component only");

// ---------- C: the contracts that must survive ----------
console.log("C contracts:");
must(/const visibleJobs = q \? statusSlice\.filter\(inHaystack\) : statusSlice/.test(dash),
  "C the visible slice still = (status filter) ∩ (haystack) — Task 94's composition");
must(dash.includes("{visibleJobs.length} of {sorted.length}"),
  "C the count chip speaks the rows the predicate produced (t627 cascade honesty)");
must(dash.includes('placeholder="Search name, type, workspace, key:value…"'),
  "C the placeholder names the dialect (discovery without a tutorial)");
must(dash.includes('role="search"') && dash.includes('aria-label="Search the job roster"'),
  "C the roster search keeps its role and its name");
{
  const badgeAt = dash.indexOf("<ParamDialectBadge");
  const chipAt = dash.indexOf('data-testid="roster-count-chip"');
  must(badgeAt !== -1 && chipAt !== -1 && badgeAt < chipAt,
    "C the badge sits between input and count chip (same reading order as the find bar)");
}
must(dash.includes("rosterParamDialect = parseParamQuery(rosterQuery)"),
  "C the dashboard's exclusive-gate reads the same parser (no second dialect definition)");

// ---------- D: purity ----------
console.log("D purity:");
{
  const defs = (lib.match(/export function jobMatchesQuery/g) || []).length;
  must(defs === 1,
    "D one matcher definition in the tree (lib/job-match owns the meaning)");
  must(!dash.includes("subsequenceMatch") && !dash.includes("subsequenceSpans"),
    "D no private subsequence in the dashboard — abbreviations come from lib");
  must(!badge.includes("transition") && !badge.includes("animate-"),
    "D the badge is a state, not an arrival — no motion debt");
  must(!badge.includes("fetch") && !badge.includes("localStorage"),
    "D the badge is pure display: no network, no storage");
}

console.log(`\n${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
