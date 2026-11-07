#!/usr/bin/env node
/**
 * t1050-slab-teach-unit — the slab face's teach-through.
 *
 * The face: the clip block's rows carry real numbers (the t1049 render
 * clock made the readouts follow the drag), but three seats stayed
 * SILENT on hover — the readout (— / 12–88%) said nothing about what it
 * means or what to do next, the fold label named no arithmetic, and the
 * axis reset told a full-extent axis "Reset" when there was nothing to
 * reset. The cure is three teaching titles in the block's own dialect:
 *
 *   A — the readout's two voices (per axis): the FULL extent names the
 *       whole depth and the way in ("Drag a face inward to keep a
 *       slab, or fold through the whole depth"); the KEPT slab names
 *       its THICKNESS — the cryo-EM worker's own unit ("NN% of the
 *       axis' depth stands") — and the fold's reach ("rays fold only
 *       through this band"). The title is computed from the same lo/hi
 *       the readout prints — one mouth, no drift.
 *   B — the fold label's arithmetic: max pops the brightest, mean
 *       keeps the landscape, min keeps the floor — the same family the
 *       op chips teach (t1048), now on the row's own name tag.
 *   C — the reset's conditional honesty: at the full extent the button
 *       confesses "nothing to reset" instead of promising a reset it
 *       cannot perform; off the full extent it keeps the t905 voice
 *       ("both faces come off (full extent kept)").
 *
 * Band law: every pin reads the SOURCE (the static face) — the same
 * discipline as t1047: the words ARE the contract, and a silent seat
 * is a regression the census catches at re-key time.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");

let pass = 0;
let fail = 0;
const pin = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* ---- the readout seat's window (the per-axis row, from the full test
 * through the readout's closing </span>) — keeps each pin inside the
 * row's own source, immune to siblings elsewhere in the file. ---- */
const rowStart = embed.indexOf("const full = lo <= 0.001 && hi >= 0.999;");
const rowEnd = embed.indexOf("</span>", embed.indexOf("clip-interval-${ax.toLowerCase()}"));
const row = rowStart >= 0 && rowEnd > rowStart ? embed.slice(rowStart, rowEnd) : "";
pin("A0 the per-axis row window is located in the source", row.length > 400, `len=${row.length}`);

/* ---- A band: the readout's two voices ---- */
pin("A1 the readout span carries a title (the silent seat speaks)",
  /data-testid=\{`clip-interval-\$\{ax\.toLowerCase\(\)\}`\}\s*\n\s*title=\{/.test(row));
pin("A2 the FULL voice names the whole depth",
  row.includes("The full extent along ${ax} — every ray of the axis' depth stands"));
pin("A3 the FULL voice teaches the way in (drag a face / fold through)",
  row.includes("Drag a face inward to keep a slab, or fold through the whole depth"));
pin("A4 the SLAB voice names the kept slab",
  row.includes("The kept slab along ${ax}"));
pin("A5 the SLAB voice speaks the THICKNESS from the live bounds",
  /\$\{Math\.round\(\(hi - lo\) \* 100\)\}% of the axis' depth stands/.test(row));
pin("A6 the SLAB voice names the fold's reach",
  row.includes("rays fold only through this band"));
pin("A7 one conditional mouth — title is a full ? A : B ternary (no drift)",
  /title=\{full\s*\n\s*\? `The full extent along/.test(row));

/* ---- B band: the fold label's arithmetic ---- */
const foldTag = embed.indexOf('title="The fold\'s arithmetic');
pin("B1 the fold label carries a teaching title", foldTag > 0);
pin("B2 the arithmetic names all three ops",
  foldTag > 0 && /max pops the brightest, mean keeps the landscape, min keeps the floor/.test(embed.slice(foldTag, foldTag + 200)));
pin("B3 the title rides the fold row's own label span",
  /uppercase tracking-wider text-muted-foreground"\s*\n\s*title="The fold's arithmetic/.test(embed));

/* ---- C band: the reset's conditional honesty ---- */
const resetWin = embed.indexOf('onClick={() => applyClipAxisInterval(axisIdx, 0, 1)}');
const resetSlice = resetWin > 0 ? embed.slice(resetWin, resetWin + 400) : "";
pin("C0 the axis reset seat is located", resetWin > 0);
pin("C1 the reset title is conditional (full ? honest : t905 voice)",
  /title=\{full\s*\n\s*\? `\$\{ax\} is already at the full extent/.test(resetSlice));
pin("C2 the FULL-state reset confesses nothing to reset",
  resetSlice.includes("is already at the full extent — both faces are off; nothing to reset"));
pin("C3 the SLAB-state reset keeps the t905 voice verbatim",
  resetSlice.includes("Reset the ${ax} clip — both faces come off (full extent kept)"));
pin("C4 the reset click is unchanged (still the both-faces-off door)",
  resetSlice.includes("onClick={() => applyClipAxisInterval(axisIdx, 0, 1)}"));

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
