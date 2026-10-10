#!/usr/bin/env node
// t650-assert — static law verification for the solid-domain vocabulary.
// Family A: the 50/950 extension tokens are verbatim palette copies
//           (success/warning/running now span 50–950 FULL, like danger).
// Family B: the field (non-exempt files, class-name domain) carries ZERO
//           teal/amber/emerald hue names — census --assert's own verdict,
//           re-checked here so the probe can call one script.
// Family C: the codex (status-style.ts) wears the rung vocabulary — no
//           hue names, floor/dot/border all ride tokens (t650 recast).
// Family D: SVG-series hex flows from the STATUS_HEX single source —
//           the three verbatim TEAL/AMBER copies retired; the remaining
//           hex sites carry the t650 anchoring comments.
import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
const ok = (label) => { pass++; console.log(`  ok: ${label}`); };
const bad = (label) => { fail++; console.error(`  FAIL: ${label}`); };
const must = (cond, label) => (cond ? ok(label) : bad(label));

// ---------- Family A: 50/950 extension tokens ----------
{
  const css = readFileSync("src/app/globals.css", "utf8");
  const PALETTE = {
    "success-50": "97.9% 0.021 166.113", "success-950": "26.2% 0.051 172.552",
    "warning-50": "98.7% 0.022 95.277", "warning-950": "27.9% 0.077 45.635",
    "running-50": "98.4% 0.014 180.72", "running-950": "27.7% 0.046 192.524",
  };
  for (const [name, val] of Object.entries(PALETTE)) {
    must(css.includes(`--color-${name}: oklch(${val});`),
      `A: --color-${name} verbatim palette copy`);
  }
  must(css.includes("t650 — the 50/950 extension"), "A: legislation comment in place");
  // theme-independent constants: the six new rungs must NOT live inside
  // the :root / .dark flip blocks (pure variable declarations, no nesting,
  // so the first } after each block opener closes it). Anchor on ":root {"
  // WITH the brace — the legislation comments themselves contain the bare
  // words ":root/.dark" (t648/t650 verdicts), which would misplace the
  // block start: the law's own text is a trap for its verifier.
  {
    const rootStart = css.indexOf(":root {");
    const rootEnd = css.indexOf("}", rootStart);
    const darkStart = css.indexOf(".dark {");
    const darkEnd = css.indexOf("}", darkStart);
    for (const name of ["success-50", "success-950", "warning-50", "warning-950", "running-50", "running-950"]) {
      const idx = css.indexOf(`--color-${name}:`);
      const inFlip = (idx > rootStart && idx < rootEnd) || (darkStart >= 0 && idx > darkStart && idx < darkEnd);
      must(!inFlip, `A: --color-${name} is theme-independent (outside :root/.dark)`);
    }
  }
}

// ---------- Family B: field hue-name residue = 0 ----------
{
  const { execFileSync } = await import("node:child_process");
  try {
    const out = execFileSync("node", ["scripts/t650-solid-census.mjs", "--assert"], { encoding: "utf8" });
    must(out.includes("ASSERT OK"), "B: census --assert (field hue-name residue = 0)");
  } catch (e) {
    bad(`B: census --assert failed: ${e.stdout?.slice(-200) ?? e.message}`);
  }
}

// ---------- Family C: the codex wears the vocabulary ----------
{
  const codex = readFileSync("src/lib/status-style.ts", "utf8");
  must(!/\b(?:teal|amber|emerald)-\d/.test(codex), "C: codex has zero hue-name classes");
  for (const cls of [
    "bg-warning-400/80 dark:bg-warning-400/75",
    "bg-running-400/85 dark:bg-running-400/80",
    "bg-success-400/75 dark:bg-success-400/70",
    "border-warning-400/60 dark:border-warning-500/50",
    "bg-warning-500", "bg-running-500", "bg-success-500",
  ]) {
    must(codex.includes(cls), `C: codex rides ${cls}`);
  }
  must(codex.includes("verdict recast once the 50–950 token"),
    "C: recast verdict carved into the floor comment");
}

// ---------- Family D: SVG hex single-source ----------
{
  const charts = [
    "src/components/workflow/results/fsc-chart.tsx",
    "src/components/workflow/results/topaz-training-chart.tsx",
    "src/components/workflow/results/motion-drift-chart.tsx",
  ];
  for (const f of charts) {
    const s = readFileSync(f, "utf8");
    must(!/const (TEAL|AMBER|EMERALD|ROSE) = "#/.test(s),
      `D: ${f.split("/").pop()} constants no longer hardcode palette hex`);
    must(s.includes('STATUS_HEX') && s.includes('from "@/lib/status-style"'),
      `D: ${f.split("/").pop()} derives from STATUS_HEX`);
  }
  const drift = readFileSync("src/components/workflow/results/motion-drift-chart.tsx", "utf8");
  must(!drift.includes('"#f43f5e"'), "D: motion-drift inline offender hex retired");
  const molstar = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
  must(!molstar.includes('fill="#f43f5e"'), "D: molstar negative-station fill retired");
  // anchored residuals: the documented hex sites keep their verdict comments
  const anchors = [
    ["src/lib/report-snapshots.ts", "hex is mandatory here (t650 verdict)"],
    ["src/components/workflow/template-shape-preview.tsx", "SVG hex is the SVG domain's native vocabulary (t650 verdict)"],
    ["src/lib/use-tab-census.ts", "hex\n *  is mandatory (t650 verdict)"],
    ["src/components/workflow/results/compare-face.tsx", "SVG hex is\n                the SVG domain's native vocabulary (t650 verdict)"],
  ];
  for (const [f, marker] of anchors) {
    must(readFileSync(f, "utf8").includes(marker), `D: anchor comment in ${f.split("/").pop()}`);
  }
}

console.log(`\nt650-assert: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
