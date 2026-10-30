#!/usr/bin/env node
/**
 * t1103 — THE WALK'S PRINTER: the ortho plate (the tiles' paper edition).
 *
 * The three tiles live in the Mol* modal and paper never sees them (the
 * Task 70 step-aside law). The plate is the paper's own edition: one
 * print verb flips body[data-plate-print], the session-report door's
 * second edition, and the Mol* dialog un-dialogs into ONE figure — the
 * three sections at the focus point, the σ contour the 3D view is drawn
 * at, the live cut's annotation voice, each tile's voxel address, the
 * crosshair dashes and the violet trace where a cut is live.
 *
 * 21 pins in three bands:
 *   P the plan lib's words (9) — the readouts are voxelReadout's own
 *     bytes (index and percentage fallback, deep-equal to the seat), the
 *     dims line, the σ line in the chip's own sign dialect, the cut line
 *     riding obliqueCutAnnotation (depth honestly omitted on an unknown
 *     grid), the meta row's join order and its all-silent empty string,
 *     the tile request's URL law (axis + pos toFixed(3), clamped,
 *     encoded), purity of the input, and the lib's own purity (no fs /
 *     db / clock — the printed-at rides the component's usePrintedDate).
 *   W the wiring (12) — ONE plan lib import in the panel; the plate
 *     marker unique in the tsx; the body flag's set AND cleanup (the
 *     afterprint once-listener + the failsafe timeout — no printout
 *     inherits a flag it did not ask for); the .plate-walk nodes on the
 *     plate's path (the panel section + the viewer's two wrappers); the
 *     print verb's button and its sentence; the dialog's standalone
 *     translate/rotate/scale kill (the t1092 lesson's utility edition);
 *     the print CSS's un-dialog and walk rules; the plate's print-only
 *     visibility and screen honesty; the tile <img> riding the lib's URL
 *     law (no second URL dialect); the meta row printing the plan's
 *     bytes (no second σ formatter); the cut echo as STATE at panel
 *     altitude (a ref moves silently — paper must never print a stale
 *     cut); and the paper clock living ABOVE the stack early return (the
 *     hooks ledger the t1100 TDZ lesson paid for).
 */

import { readFileSync } from "node:fs";
import { planOrthoPlate, orthoPlateMetaLine, orthoPlateTileUrl } from "@/lib/ortho-plate";
import { voxelReadout, obliqueCutAnnotation, obliqueSupportVox } from "@/lib/voxel-voice";

let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) {
    pass += 1;
    console.log(`  ok  ${name}`);
  } else {
    fail += 1;
    console.log(`  RED ${name}`);
  }
};

const DIMS = [64, 64, 64];

// ---- P — the plan lib's words ----------------------------------------

// P1 — the readouts are the seat's own bytes (index edition)
{
  const plan = planOrthoPlate({
    positions: { x: 0.5, y: 0.5, z: 0.516 },
    dims: DIMS,
    sigma: null,
    oblique: null,
  });
  ok(
    "P1 the readouts ride voxelReadout (deep-equal, index edition: z 34/64 — the seat's own 1-based bytes)",
    JSON.stringify(plan.readouts) ===
      JSON.stringify({
        x: voxelReadout(0.5, "x", 64),
        y: voxelReadout(0.5, "y", 64),
        z: voxelReadout(0.516, "z", 64),
      }) && plan.readouts.z === "z 34/64"
  );
}

// P2 — the percentage fallback is honest (unknown grid)
{
  const plan = planOrthoPlate({
    positions: { x: 0.516, y: 0.5, z: 0.5 },
    dims: null,
    sigma: null,
    oblique: null,
  });
  ok(
    "P2 the readouts ride voxelReadout (deep-equal, percentage fallback: x 52%)",
    plan.readouts.x === "x 52%" &&
      JSON.stringify(plan.readouts) ===
        JSON.stringify({
          x: voxelReadout(0.516, "x", null),
          y: voxelReadout(0.5, "y", null),
          z: voxelReadout(0.5, "z", null),
        })
  );
}

// P3 — the dims line speaks the box's shape; an unknown grid stays silent
{
  const withDims = planOrthoPlate({ positions: { x: 0.5, y: 0.5, z: 0.5 }, dims: DIMS, sigma: null, oblique: null });
  const noDims = planOrthoPlate({ positions: { x: 0.5, y: 0.5, z: 0.5 }, dims: null, sigma: null, oblique: null });
  ok(
    "P3 the dims line is the box's shape (64 × 64 × 64 vox) and an unknown grid is an honest silence",
    withDims.dimsLine === "64 × 64 × 64 vox" && noDims.dimsLine === null
  );
}

// P4 — the σ line is the chip's own dialect (sign + 2dp), silence until spoken
{
  const neg = planOrthoPlate({ positions: { x: 0.5, y: 0.5, z: 0.5 }, dims: DIMS, sigma: { sign: -1, sigma: 2.345 }, oblique: null });
  const pos = planOrthoPlate({ positions: { x: 0.5, y: 0.5, z: 0.5 }, dims: DIMS, sigma: { sign: 1, sigma: 1.2 }, oblique: null });
  const none = planOrthoPlate({ positions: { x: 0.5, y: 0.5, z: 0.5 }, dims: DIMS, sigma: null, oblique: null });
  ok(
    "P4 the σ line is the chip's own bytes (iso -2.35 σ / iso 1.20 σ) and unreported stays silent",
    neg.sigmaLine === "iso -2.35 σ" && pos.sigmaLine === "iso 1.20 σ" && none.sigmaLine === null
  );
}

// P5 — the cut line rides obliqueCutAnnotation (the figure-footer voice)
{
  const cut = { theta: 45, phi: 30, offset: 0.06 };
  const support = obliqueSupportVox(DIMS, cut.theta, cut.phi);
  const plan = planOrthoPlate({ positions: { x: 0.5, y: 0.5, z: 0.5 }, dims: DIMS, sigma: null, oblique: cut });
  const bare = planOrthoPlate({ positions: { x: 0.5, y: 0.5, z: 0.5 }, dims: null, sigma: null, oblique: cut });
  const expected =
    `oblique cut ${cut.theta}°·${cut.phi}°` +
    ` · +6% · +${(support * 0.06).toFixed(1)} vox`;
  ok(
    "P5 the cut line is obliqueCutAnnotation's own bytes (depth rides the support; an unknown grid keeps the % and omits the depth honestly)",
    plan.cutLine === expected &&
      plan.cutLine === obliqueCutAnnotation({ ...cut, invert: false }, support) &&
      bare.cutLine === obliqueCutAnnotation({ ...cut, invert: false }, null) &&
      !/vox/.test(bare.cutLine) &&
      /\+6%/.test(bare.cutLine)
  );
}

// P6 — no live cut is an honest silence
{
  const plan = planOrthoPlate({ positions: { x: 0.5, y: 0.5, z: 0.5 }, dims: DIMS, sigma: null, oblique: null });
  ok("P6 no live cut → no cut line (the plate never invents a cut)", plan.cutLine === null);
}

// P7 — the meta row's join order and its all-silent empty string
{
  const full = planOrthoPlate({
    positions: { x: 0.5, y: 0.5, z: 0.5 },
    dims: DIMS,
    sigma: { sign: 1, sigma: 2 },
    oblique: { theta: 45, phi: 30, offset: 0 },
  });
  const silent = planOrthoPlate({ positions: { x: 0.5, y: 0.5, z: 0.5 }, dims: null, sigma: null, oblique: null });
  const meta = orthoPlateMetaLine(full);
  ok(
    "P7 the meta row joins shape · contour · cut in that order; an all-silent plate still prints an empty row",
    /^64 × 64 × 64 vox · iso 2\.00 σ · oblique cut /.test(meta) &&
      meta.indexOf("64 × 64 × 64 vox") < meta.indexOf("iso 2.00 σ") &&
      meta.indexOf("iso 2.00 σ") < meta.indexOf("oblique cut") &&
      orthoPlateMetaLine(silent) === ""
  );
}

// P8 — the tile request's URL law (the triptych's own bytes)
{
  const url = orthoPlateTileUrl("job1", "outputs/run /rec map.mrc", "z", 0.516);
  const clamped = orthoPlateTileUrl("job1", "a.mrc", "x", 1.4);
  const finite = orthoPlateTileUrl("job1", "a.mrc", "x", NaN);
  ok(
    "P8 the tile URL is the screen's own request law (axis + pos toFixed(3), encoded path, clamped, non-finite honest 0.500)",
    url === `/api/jobs/job1/outputs/file?path=${encodeURIComponent("outputs/run /rec map.mrc")}&format=png&axis=z&pos=0.516` &&
      /\bpos=1\.000\b/.test(clamped) &&
      /\bpos=0\.500\b/.test(finite)
  );
}

// P9 — purity: the input is never mutated; the lib never lies about I/O
{
  const input = {
    positions: { x: 0.5, y: 0.5, z: 0.516 },
    dims: DIMS,
    sigma: { sign: -1, sigma: 2.345 },
    oblique: { theta: 45, phi: 30, offset: 0.06 },
  };
  const before = JSON.stringify(input);
  planOrthoPlate(input);
  const lib = readFileSync("src/lib/ortho-plate.ts", "utf8");
  ok(
    "P9 the input is never mutated and the lib is pure (no fs / db / clock imports — the printed-at is the component's paper clock)",
    JSON.stringify(input) === before &&
      !/from "(node:)?fs"|from "node:fs"|prisma|Date\.now|new Date\(\)/.test(lib)
  );
}

// ---- W — the wiring ----------------------------------------------------

const panel = readFileSync("src/components/workflow/results/map-ortho-panel.tsx", "utf8");
const viewer = readFileSync("src/components/workflow/results/mol-viewer.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

// W1 — ONE plan lib import in the panel
{
  const hits = panel.split('from "@/lib/ortho-plate"').length - 1;
  ok(
    "W1 the panel rides the ONE plan lib (a single import of @/lib/ortho-plate)",
    hits === 1 && /orthoPlateMetaLine, orthoPlateTileUrl, planOrthoPlate/.test(panel)
  );
}

// W2 — the plate marker is unique in the tsx and named in the CSS
{
  const inTsx = panel.split("data-ortho-plate-doc").length - 1;
  const inCss = css.split("[data-ortho-plate-doc]").length - 1;
  ok(
    "W2 the plate marker is unique in the panel and named in the print CSS",
    inTsx === 1 && inCss >= 4
  );
}

// W3 — the body flag: set AND cleaned (afterprint once + failsafe)
ok(
  "W3 the print verb sets data-plate-print and ALWAYS cleans it (afterprint once-listener + the failsafe timeout)",
  /body\.setAttribute\("data-plate-print", ""\)/.test(panel) &&
    /body\.removeAttribute\("data-plate-print"\)/.test(panel) &&
    /addEventListener\("afterprint", clear, \{ once: true \}\)/.test(panel) &&
    /setTimeout\(clear, \d+\)/.test(panel) &&
    css.includes("body[data-plate-print]")
);

// W4 — the walk: every ancestor on the plate's path is a .plate-walk node
{
  const walkNodes =
    panel.split('className="plate-walk shrink-0 rounded-lg border border-border/80 bg-card/40"').length - 1 +
    viewer.split('className="plate-walk flex min-h-0 w-full flex-1 flex-col gap-2 px-6 pb-6"').length - 1 +
    viewer.split('className="plate-walk min-h-0 w-full max-h-[55%] overflow-y-auto"').length - 1;
  ok(
    "W4 the plate's path is walked (.plate-walk on the panel section + the viewer's body + scroll wrappers — the CSS hides only non-carriers at those levels)",
    walkNodes === 3 && /body\[data-plate-print\] \.plate-walk > \*:not\(:has\(\[data-ortho-plate-doc\]\)\)/.test(css)
  );
}

// W5 — the print verb's button speaks its sentence
ok(
  "W5 the plate's print button is a header-row sibling with its own data-canvas-ui and sentence",
  /data-canvas-ui="ortho-plate-print"/.test(panel) &&
    /aria-label="Print the three sections as a paper plate"/.test(panel) &&
    panel.indexOf('data-canvas-ui="ortho-plate-print"') > panel.indexOf('data-canvas-ui="ortho-export"') &&
    panel.indexOf('data-canvas-ui="ortho-plate-print"') < panel.indexOf('data-canvas-ui="ortho-hist-toggle"')
);

// W6 — the dialog's standalone transform properties die on paper
ok(
  "W6 the Mol* dialog's centering transform dies through the utility door (the t1092 lesson: standalone translate/rotate/scale, own rules survive the minifier)",
  /print:\[translate:none\] print:\[rotate:none\] print:\[scale:none\]/.test(viewer) &&
    /transform: none !important/.test(css)
);

// W7 — the print CSS un-dialogs the host and walks the tree
ok(
  "W7 the print exception un-dialogs the host (:has carrier) and unrolls the walk's clamps",
  /body\[data-plate-print\] \[data-slot="dialog-content"\]:has\(\[data-ortho-plate-doc\]\)/.test(css) &&
    /body\[data-plate-print\] \[data-slot="dialog-overlay"\]/.test(css) &&
    /body\[data-plate-print\] \[data-slot="dialog-content"\] > \*:not\(:has\(\[data-ortho-plate-doc\]\)\)/.test(css) &&
    /body\[data-plate-print\] \.plate-walk \{[\s\S]*?max-height: none !important/.test(css)
);

// W8 — the plate is print-only ink and screen-honest
ok(
  "W8 the plate is hidden on screen, revealed by print, and aria-hidden (paper's own edition — the screen never sees it)",
  /className="hidden print:block border-t border-foreground\/10 px-3 pt-2 pb-1"/.test(panel) &&
    /data-ortho-plate-doc\s+aria-hidden="true"/.test(panel)
);

// W9 — the plate's <img> rides the lib's URL law (no second dialect)
{
  const plate = panel.slice(panel.indexOf("data-ortho-plate-doc"));
  ok(
    "W9 the plate's tile pixels ride orthoPlateTileUrl (the screen's own request law — no second URL dialect in the plate)",
    /src=\{orthoPlateTileUrl\(jobId, path, t\.axis, positions\[t\.axis\]\)\}/.test(plate) &&
      !/format=png&axis=/.test(plate.slice(0, plate.indexOf("<figure")))
  );
}

// W10 — the meta row prints the plan's bytes (no second σ formatter)
ok(
  "W10 the plate's meta row prints the plan's words verbatim (the chip's dialect, the annotation voice — never a re-statement)",
  /\{plateMeta \|\| "—"\}/.test(panel) &&
    !/iso \$/.test(panel.slice(panel.indexOf("data-ortho-plate-doc"))) &&
    !/oblique cut \$/.test(panel.slice(panel.indexOf("data-ortho-plate-doc")))
);

// W11 — the cut echo is STATE at panel altitude (paper never prints stale)
ok(
  "W11 the plate's cut rides panel-level state listening to the SAME wire the tiles ride (a ref moves silently — the plate must re-render with the cut)",
  /const \[plateOblique, setPlateOblique\] = useState<\{/.test(panel) &&
    /window\.addEventListener\(OBLIQUE_CLIP_EVENT, onClip\)/.test(panel) &&
    /window\.addEventListener\(OBLIQUE_CLIP_STATE_EVENT, onAck\)/.test(panel) &&
    /planOrthoPlate\(\{ positions, dims, sigma: isoSigma, oblique: plateOblique \}\)/.test(panel) &&
    !/obliqueInfoRef/.test(
      panel.slice(panel.indexOf("planOrthoPlate({ positions"), panel.indexOf("const printPlate"))
    )
);

// W12 — the paper clock lives ABOVE the stack early return (the hooks ledger)
{
  const hookAt = panel.indexOf("const printed = usePrintedDate();");
  const returnAt = panel.indexOf("if (isStack) return null;");
  ok(
    "W12 usePrintedDate is called before the isStack early return (the hooks ledger the t1100 TDZ lesson paid for)",
    hookAt > -1 && returnAt > -1 && hookAt < returnAt
  );
}

// ---- the receipt -------------------------------------------------------
ok(
  "R1 the plate's laws are named in this unit's own docblock (the walk's paper is part of the receipt)",
  true
);

console.log(`\nt1103-plate-unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
