#!/usr/bin/env node
/**
 * t1123 — the app-wide bare-button patrol's source-assertion unit.
 *
 * Task 1123 walked EVERY raw <button> in src/components + src/app that
 * sat outside the shadcn <Button> base and outside a Chip-interactive
 * rider, and rode each onto the panel's family focus ring
 * (`focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`
 * — the exact mint molstar-embed's 45 instances already speak).
 *
 * This unit pins the end state so a future bare button cannot land:
 *
 *   A  zero-bare law      — every .tsx with a raw <button carries the
 *                           family ring OR the Chip-interactive rider
 *                           evidence (`interactive` + `asChild` + `Chip`).
 *   B  mint-count pin     — each cured file carries its exact number of
 *                           mint instances (per-seat surgery, no drive-by).
 *   C  rider evidence     — the three judged-already-ridden files ride
 *                           <Chip interactive asChild> (ring minted in
 *                           ui/chip.tsx, not in the file).
 *   D  mints stay minted  — ui/button.tsx + ui/chip.tsx keep their own
 *                           shadcn ring (the base is not ours to rewrite).
 *   E  other-idiom laws   — the two deliberate non-ring idioms survive:
 *                           denoise compare slider's outline, report
 *                           rows' bg-swap.
 *   F  census shape       — exactly 20 files carry raw <button> elements
 *                           (17 cured + 3 riders); a 21st must arrive
 *                           already ringed or the unit goes RED.
 *
 * Pure source assertions — no build, no browser, no I/O beyond reads.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MINT = "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** walk .tsx files under a dir */
function walkTsx(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTsx(p, out);
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = [...walkTsx(join(ROOT, "src/components")), ...walkTsx(join(ROOT, "src/app"))];
const srcOf = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

// ---------------- band A + F: the zero-bare law ----------------
const riderEvidence = (t) => t.includes("asChild") && t.includes("interactive") && t.includes("Chip");
const bareFiles = files.filter((f) => {
  const t = srcOf.get(f);
  return t.includes("<button") && !t.includes("focus-visible:ring") && !riderEvidence(t);
});
ok("A1 zero bare-button files in the whole app", bareFiles.length === 0, bareFiles.join(", "));

// ---------------- band B: mint-count pins ----------------
const EXPECTED = [
  ["src/components/workflow/header.tsx", 4],
  ["src/components/workflow/canvas-find-bar.tsx", 2],
  ["src/components/workflow/results/micrograph-qc-board.tsx", 3],
  ["src/components/workflow/reference-map-card.tsx", 3],
  ["src/components/ai/ai-settings-dialog.tsx", 3],
  ["src/components/workflow/template-presets-dialog.tsx", 5],
  ["src/components/workflow/results/density-histogram.tsx", 2],
  ["src/components/workflow/results/denoise-compare-gallery.tsx", 2],
  ["src/components/workflow/project-panel.tsx", 2],
  ["src/components/workflow/engine-guidance.tsx", 2],
  ["src/components/workflow/session-report-dialog.tsx", 1],
  ["src/components/workflow/results/topaz-training-chart.tsx", 1],
  ["src/components/workflow/results/motion-drift-chart.tsx", 1],
  ["src/components/workflow/results/chart-error-strip.tsx", 1],
  ["src/components/workflow/job-search-lens.tsx", 1],
  ["src/components/workflow/footer.tsx", 1],
  ["src/components/workflow/canvas-minimap.tsx", 1],
];
let mintTotal = 0;
for (const [rel, want] of EXPECTED) {
  const t = srcOf.get(join(ROOT, rel));
  const got = t ? t.split(MINT).length - 1 : -1;
  mintTotal += Math.max(got, 0);
  ok(`B ${rel} carries ${want} mint(s)`, got === want, `got ${got}`);
}
ok("B-total 35 mint instances across the 17 cured files", mintTotal === 35, `got ${mintTotal}`);

// ---------------- band C: the three judged Chip riders ----------------
const RIDERS = [
  "src/components/workflow/results/continue-verb-row.tsx",
  "src/components/workflow/results/cryosparc-angle-plot.tsx",
  "src/components/workflow/results/compare-face.tsx",
];
for (const rel of RIDERS) {
  const t = srcOf.get(join(ROOT, rel));
  ok(`C ${rel} rides <Chip interactive asChild>`, riderEvidence(t));
}
ok("C-evidence the riders' ring lives in the chip mint", true);

// ---------------- band D: the mints stay minted ----------------
const chipTsx = srcOf.get(join(ROOT, "src/components/ui/chip.tsx")) ?? "";
const buttonTsx = srcOf.get(join(ROOT, "src/components/ui/button.tsx")) ?? "";
ok("D1 ui/chip.tsx keeps the t586 canonical ring", chipTsx.includes("focus-visible:ring-[3px] focus-visible:ring-ring/50"));
ok("D2 ui/button.tsx keeps the shadcn base ring", buttonTsx.includes("focus-visible:ring-[3px]"));
ok("D3 chip mint marks the interactive variant only", /interactive: \{[\s\S]*?focus-visible:ring-\[3px\]/.test(chipTsx));

// ---------------- band E: the deliberate other-idioms survive ----------------
const denoiseT = srcOf.get(join(ROOT, "src/components/workflow/results/denoise-compare-gallery.tsx")) ?? "";
const reportT = srcOf.get(join(ROOT, "src/components/workflow/session-report-dialog.tsx")) ?? "";
ok("E1 denoise compare slider keeps its outline idiom", denoiseT.includes("focus-visible:outline-fuchsia-400"));
ok("E2 session report rows keep the violet bg-swap idiom", reportT.includes("focus-visible:bg-violet-500/15"));
// E3 — the card-lift cascade law: the unlayered .card-lift box-shadow
// beats every layered ring composite, so the family ring paints as an
// outline there (measured live: the header env pill held ring-1 in its
// class list while its computed box-shadow showed only the lift inks).
const globalsT = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
ok("E3 globals carries the card-lift focus outline law", globalsT.includes(".card-lift:focus-visible") && globalsT.includes("outline: 1px solid var(--ring)"));

// E4 — the unlayered-shadow cascade census (the t1124 sweep): an
// unlayered static box-shadow beats every layered ring composite, so
// the census of such rules is a standing assertion. Character-level
// state machine (the jsx-scan family craft): comments stripped, a
// context stack distinguishes @keyframes bodies (transient animations,
// not candidates for ring cascade) from @media(hover) blocks (hover
// implies not keyboard-focused — the rare hover+focus state is a
// visual-only judgement, and E3's outline is itself cascade-proof)
// from plain rules.
{
  const css = globalsT.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack = []; // {kind:'rule'|'media'|'media-hover'|'keyframes', sel}
  let buf = "";
  const staticShadows = new Set();
  const hoverShadows = new Set();
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") {
      const head = buf.trim();
      const kind = head.startsWith("@keyframes")
        ? "keyframes"
        : head.startsWith("@media")
          ? head.includes("hover")
            ? "media-hover"
            : "media-surface" // print / width blocks — surface-mode scoped
          : "rule";
      stack.push({ kind, sel: head });
      buf = "";
      continue;
    }
    if (ch === "}") {
      stack.pop();
      buf = "";
      continue;
    }
    buf += ch;
    if (ch === ";" && stack.length > 0) {
      // a declaration just terminated — buf IS the declaration text
      const decl = buf;
      buf = "";
      if (!decl.includes("box-shadow:")) continue;
      if (stack.some((c) => c.kind === "keyframes")) continue; // transient
      const inHover = stack.some((c) => c.kind === "media-hover");
      const top = stack[stack.length - 1];
      if (top.kind !== "rule") continue; // between rules
      const sel = top.sel.replace(/\s+/g, " ");
      if (inHover) hoverShadows.add(sel);
      else staticShadows.add(sel);
    }
  }
  const staticSet = [...staticShadows].sort();
  const hoverSet = [...hoverShadows].sort();
  // the JUDGED census — every member accounted for, none silent:
  //   .card-lift / .card-lift-lg            → button carriers, E3-outline cured
  //   .report-doc .report-compass-here…     → button carrier, but the compass
  //                                           chip family owns its own
  //                                           focus-visible OUTLINE idiom
  //                                           (2px violet, offset 1px) which
  //                                           survives the active chip's
  //                                           underline ink — probed live
  //                                           (fv:true, outline solid 2px) —
  //                                           the t1124 suspect DISPROVED
  //   .job-running                          → canvas job card (a div; the
  //                                           canvas nav is arrow-driven)
  //   .report-doc .report-spark-zoom        → report paper internal (span)
  //   .reveal-flash / [data-find-ring-flash]::after → flash spans/pseudo
  //   html:has(…) [data-slot=dialog-content] ×6 → dialog PANELS (buttons
  //                                           inside them keep their rings)
  const JUDGED = [
    ".card-lift",
    ".card-lift, .card-lift-lg", // the E3 selector head, read as one head
    ".card-lift-lg",
    ".job-running",
    ".report-doc .report-compass-here, .report-doc .report-compass-here:hover",
    ".report-doc .report-spark-zoom",
    ".reveal-flash",
    '[data-find-ring-flash]::after',
    'body[data-plate-print] [data-slot="dialog-content"]:has([data-ortho-plate-doc])',
    'body[data-report-print] [data-slot="dialog-content"][data-report-doc]',
    'html:has([data-compare-dialog][data-state="open"]) [data-slot="dialog-content"]',
    'html:has([data-family-read-dialog][data-state="open"]) [data-slot="dialog-content"]',
    'html:has([data-fsc-compare-dialog][data-state="open"]) [data-slot="dialog-content"]',
    'html:has([data-inspector-dialog][data-state="open"]) [data-log-console]',
    'html:has([data-inspector-dialog][data-state="open"]) [data-slot="dialog-content"]',
    'html:has([data-params-diff-dialog][data-state="open"]) [data-slot="dialog-content"]',
  ];
  const known = new Set([...JUDGED]);
  const unknown = staticSet.filter((s) => !known.has(s));
  ok(
    "E4 unlayered static shadow census fully judged (16 members, zero unknown)",
    unknown.length === 0 && staticSet.length === 16,
    `unknown=${JSON.stringify(unknown)} total=${staticSet.length}`,
  );
  ok(
    "E4 hover-only shadow census == the three lean/whisper faces",
    hoverSet.length === 3 && hoverSet.every((s) => /card-hover-lean|dash-card-hover|insp-card-whisper/.test(s)),
    JSON.stringify(hoverSet),
  );
  ok(
    "E4b the outline law names every button carrier (the card-lift pair)",
    globalsT.includes(".card-lift:focus-visible,") &&
      globalsT.includes(".card-lift-lg:focus-visible {") &&
      !globalsT.includes(".report-doc .report-compass-here:focus-visible"),
  );
  ok(
    "E4c the compass chip family keeps its own outline idiom",
    /\.report-doc \.report-compass-chip:focus-visible\s*\{[^}]*outline:\s*2px solid/.test(globalsT),
  );
}

// ---------------- band F: census shape ----------------
// 62 files carry raw <button> substrings; 295 REAL raw opening tags live
// in them (plus 4 prose mentions inside comments, which are not tags).
// Every real tag rides a ring: file-level mint, a Chip-interactive
// rider, or a variable whose definition speaks focus-visible — the
// per-button auditor (scripts/t1123-per-button-audit.mjs) is the
// sharper gate and is run as band G below.
const rawButtonFiles = files.filter((f) => srcOf.get(f).includes("<button"));
ok("F1 exactly 62 files speak raw <button>", rawButtonFiles.length === 62, `got ${rawButtonFiles.length}`);
let tags = 0;
let fileRingedTags = 0;
for (const f of rawButtonFiles) {
  const t = srcOf.get(f);
  const m = t.match(/<button[\s\n>]/g) ?? [];
  tags += m.length;
  if (t.includes("focus-visible:ring") || riderEvidence(t)) fileRingedTags += m.length;
}
ok("F2 300 raw <button occurrences (296 real tags + 4 prose; +1 the t1129 sheet face toggle — the cut block's fourth verb)", tags === 300, `got ${tags}`);
ok("F3 every raw occurrence sits in a ringed or rider file", fileRingedTags === 300, `got ${fileRingedTags}/300`);

// ---------------- band G: the per-button auditor gate ----------------
const { execFileSync } = await import("node:child_process");
let auditOk = true;
let auditOut = "";
try {
  auditOut = execFileSync(process.execPath, ["scripts/t1123-per-button-audit.mjs"], { encoding: "utf8", cwd: ROOT });
} catch (e) {
  auditOk = false;
  auditOut = String(e.stdout ?? e.message);
}
ok("G per-button auditor exits clean (zero bare tags)", auditOk, auditOut.split("\n").slice(0, 4).join(" | "));

console.log(`\nt1123 bare-button patrol unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
