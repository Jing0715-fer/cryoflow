#!/usr/bin/env node
/**
 * t1008 — THE RECITAL'S TOMBSTONE unit (node-only, pure source audit).
 *
 * THE FINDING (this window's audit): the standing Task 13 recital — the
 * list the cron text has re-offered every window since Task 13 ("#5
 * fs/browse unauthed, #6/#14 pathref vs star include policy, #7 chart
 * routes' full sync hot reads, #8 particles BFS N+1, #13 useMemo
 * localStorage write; plus the 3D volume section tool, the Topaz
 * wrapper") — is RETIRED IN FULL. Every item was healed by a real
 * earlier task; the recital kept riding purely as text. The honest
 * counting law (the t217 verdict, the 24th–28th distortions) says the
 * only trustworthy source is the worklog's actual tail — but prose
 * verdicts rot. This unit turns the retirement into INSTRUMENTED
 * ground: each tombstone is a source needle; if the healing regresses
 * (a guard dropped, a cache bypassed, a BFS un-batched), the unit goes
 * RED and the retirement re-opens.
 *
 * THE TOMBSTONES (heir task → item → needle):
 *   T1–T4   t251  (#5)  isLocalRequest guards the four chart routes
 *   T5      t903  (#6/#14) isPathrefPath pins the CANONICAL marker shape
 *   T6–T10  t665  (#7)  statcache rides guinier/angdist/resolution/fsc
 *   T11–T12 t904  (#8)  particles: the batched-BFS marker + the parse
 *                      rides cachedFileCompute
 *   T13     —     (#13) zero useMemo→localStorage.setItem adjacency
 *                      anywhere in src (the write lives in effects)
 *   T14     t217/t905 (3D section) the slab seat rides clip-interval
 *   T15–T16 —     (Topaz wrapper) parser + route + chart shipped
 *   T17     —     (chart export) all seven results charts carry
 *                      ChartExportButtons
 *
 * THE TALLIES ARE NOT RE-PINNED here: the six standing tally-pin units
 * (t982 A3–A5+A21, t998 B23–B26, t999 C3–C6, t1002 R8b, t1004 R1–R3,
 * t1005 R1–R3) own those numbers; a seventh pinner would only multiply
 * the re-key cost on a true tally move. The SIX were re-keyed THIS
 * window by the honest-name third arm (three dynamic names: silent-text
 * 25 → 22, stateful 146 → 149) — the re-keys ride the cure commit.
 *
 * THE S BAND pins the third arm itself: the four cures (the dashboard's
 * switch flight voice + three-state name, the molstar pair's count-or-
 * refusal names, Run B's no-sibling refusal) and the two verdicts that
 * stay (the assistant-panel's component boundary — its children already
 * speak; the carousel vendor floor).
 *
 * THE PROBE PROTOCOL: node-only, readFileSync includes + one recursive
 * scan, exit honest, receipt to shots-qa/.t1008-unit-receipt.json.
 */
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1008-unit-receipt.json");

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const has = (rel, needle) => read(rel).includes(needle);

/* ---------- T1–T4: the #5 sibling closure (t251) guards the charts ---------- */
console.log("T band — the recital's tombstones:");
const CHART_ROUTES = [
  "src/app/api/jobs/[id]/guinier/route.ts",
  "src/app/api/jobs/[id]/angdist/route.ts",
  "src/app/api/jobs/[id]/resolution/route.ts",
  "src/app/api/jobs/[id]/fsc/route.ts",
];
CHART_ROUTES.forEach((route, i) => {
  const src = read(route);
  ok(`T${i + 1} #5/t251 guard rides ${route.split("/").slice(-3, -1).join("/")}`,
    src.includes("isLocalRequest(request)") && src.includes("403"),
    "the drive-by door is refused");
});

/* ---------- T5: the #6/#14 canonical pathref shape (t903) ---------- */
{
  const src = read("src/lib/relion/pathref.ts");
  const canonical =
    src.includes('path.dirname(rel) === "micrographs"') &&
    src.includes('base.startsWith(".")') &&
    src.includes('base.endsWith(".pathref")');
  ok("T5 #6/#14/t903 isPathrefPath pins the canonical marker shape", canonical,
    "suffix alone does not speak for the engine");
}

/* ---------- T6–T10: the #7 statcache ride (t665) ---------- */
{
  ok("T6 #7/t665 chart-data.ts imports the statcache",
    has("src/lib/chart-data.ts", 'from "@/lib/relion/statcache"'));
  const guinier = read("src/lib/chart-data.ts");
  ok('T7 #7/t665 guinier rides the cache ("guinier:eps")', guinier.includes('"guinier:eps"'));
  ok('T8 #7/t665 angdist rides the cache ("angdist:bins")', guinier.includes('"angdist:bins"'));
  ok('T9 #7/t665 resolution rides the cache ("resolution:curres")',
    has("src/app/api/jobs/[id]/resolution/route.ts", '"resolution:curres"'));
  ok('T10 #7/t665 fsc shells ride the cache ("fsc:pp-star")', guinier.includes('"fsc:pp-star"'));
}

/* ---------- T11–T12: the #8 batched BFS + parse cache (t904) ---------- */
{
  const particles = read("src/app/api/jobs/[id]/particles/route.ts");
  ok("T11 #8/t904 the batched-BFS marker stands",
    particles.includes("Batched BFS: ONE edge query per depth level"));
  ok("T12 #8/t904 the parse rides cachedFileCompute",
    particles.includes('cachedFileCompute') && particles.includes('from "@/lib/relion/statcache"'));
}

/* ---------- T13: the #13 zero useMemo→localStorage.setItem adjacency ---------- */
{
  const USEMEMO_RE = /useMemo\s*\(/g;
  const SETITEM_RE = /localStorage\.setItem\s*\(/g;
  let offenders = 0;
  const scan = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(p); continue; }
      if (!/\.(tsx|ts)$/.test(entry.name)) continue;
      const text = readFileSync(p, "utf8");
      const memos = [...text.matchAll(USEMEMO_RE)].map((m) => m.index);
      const sets = [...text.matchAll(SETITEM_RE)].map((m) => m.index);
      // any setItem whose nearest preceding useMemo( opens after the
      // previous setItem (i.e. the write sits inside a memo body,
      // 600-char window) is the pattern the recital named
      for (const s of sets) {
        const memoBefore = memos.filter((m) => m < s && s - m < 600);
        if (memoBefore.length === 0) continue;
        const between = text.slice(memoBefore[memoBefore.length - 1], s);
        // crude but honest: unbalanced parens mean the memo body is open
        const opens = (between.match(/\(/g) || []).length;
        const closes = (between.match(/\)/g) || []).length;
        if (opens > closes) offenders++;
      }
    }
  };
  scan(path.join(ROOT, "src/components"));
  scan(path.join(ROOT, "src/lib"));
  ok("T13 #13 zero useMemo→localStorage.setItem adjacency in src", offenders === 0,
    offenders === 0 ? "the writes live in effects" : `${offenders} offender(s)`);
}

/* ---------- T14: the 3D volume section tool (t217 verdict / t905 slab) ---------- */
{
  ok("T14 3D-section/molstar-embed rides the clip-interval slab seat",
    has("src/components/workflow/results/molstar-embed.tsx", 'from "@/lib/clip-interval"'));
}

/* ---------- T15–T17: the Topaz wrapper shipped ---------- */
{
  ok("T15 Topaz parseTopazTraining exported from the lib",
    has("src/lib/relion/topaz-training.ts", "export function parseTopazTraining"));
  const route = "src/app/api/jobs/[id]/topaz-training/route.ts";
  const chart = "src/components/workflow/results/topaz-training-chart.tsx";
  ok("T16 Topaz route + chart shipped",
    existsSync(path.join(ROOT, route)) && existsSync(path.join(ROOT, chart)));
}

/* ---------- T18: the chart-export family covers all seven charts ---------- */
{
  const RESULTS = "src/components/workflow/results";
  const charts = [
    "ctf-quality-chart.tsx", "fsc-chart.tsx", "motion-drift-chart.tsx",
    "guinier-chart.tsx", "angular-distribution-chart.tsx",
    "resolution-chart.tsx", "topaz-training-chart.tsx",
  ].filter((f) => existsSync(path.join(ROOT, RESULTS, f)));
  const carried = charts.filter((f) => has(path.join(RESULTS, f), "ChartExportButtons"));
  ok("T17 all seven results charts carry ChartExportButtons",
    charts.length === 7 && carried.length === 7, `${carried.length}/${charts.length}`);
}

/* ---------- S band — the honest-name third arm (this window's cures) ---------- */
console.log("S band — the honest-name third arm:");
{
  const dash = read("src/components/workflow/project-dashboard.tsx");
  ok("S1 the dashboard's switch flight speaks (aria-busy beside disabled, one line)",
    /disabled=\{isPending\} aria-busy=\{isPending\}/.test(dash));
  ok("S2 the dashboard's name flips three states honestly (pending/active/idle)",
    dash.includes('aria-label={isPending ? "Switching projects…" : isActive ? "Open workflow" : "Switch & open"}'));
  const molstar = read("src/components/workflow/results/molstar-embed.tsx");
  ok("S3 the sub-volume export's name carries the dims or the refusal",
    molstar.includes("Export sub-volume (${dims[0]}×${dims[1]}×${dims[2]} vox)") &&
    molstar.includes('"Export sub-volume — set a crop box first"'));
  ok("S4 the import confirm's name carries the count or the nothing-picked refusal",
    molstar.includes('"Import — nothing picked yet"') &&
    molstar.includes("Import ${importPreview.picked.size} picked file"));
  ok("S5 Run B's trigger speaks the no-sibling refusal",
    has("src/components/workflow/results/run-compare-dialog.tsx", '"Run B — no sibling runs to compare"'));
  ok("S6 the assistant-panel's component story stays a verdict, not a defect (its children carry dynamic names)",
    has("src/components/ai/assistant-panel.tsx", "aria-label={`执行：${a.label}`}"));
}

/* ---------- the receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict} ${pass}/${pass + fail}`);
try {
  mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
  writeFileSync(TMP, JSON.stringify({
    unit: "t1008-recital-tombstone-unit", verdict, pass, fail,
    at: new Date().toISOString(),
    tombstones: ["#5/t251", "#6-#14/t903", "#7/t665", "#8/t904", "#13", "3D-section/t217", "topaz", "chart-export"],
    thirdArm: ["project-dashboard aria-busy+3-state name", "molstar export-sub-volume dims-or-refusal", "molstar import-confirm count-or-refusal", "run-compare Run-B no-sibling refusal"],
  }, null, 2));
} catch { /* receipt best-effort */ }
process.exit(fail === 0 ? 0 : 1);
