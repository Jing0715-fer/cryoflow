#!/usr/bin/env node
/**
 * t830 — the keymap grows kbd chips, and the ortho panel learns its keys.
 *
 * Feature (this window): the ortho panel gains the SECTION keys' hint row —
 * the keyboard face of the bidirectional contract, taught where the 2D
 * instruments live. The keys (X/Y/Z cut, , . scrub, < > coarse) already
 * drive the 3D section through the embed's intent path, and the embed
 * echoes cryoflow:slice-state so THESE tiles follow — the same wire a ⌖
 * click rides the other way. The row is gated on the σ chip's own honesty
 * signal: isoSigma is null until the embed answers the pull, so the row
 * never promises keys the embed cannot arm (the chip must-not-lie law
 * extended to the keymap).
 *
 * Style detail (this window): the bookmark door's keymap line grows kbd
 * chips — a key that renders as a key reads as a key (the t642 law, one
 * vocabulary, no hand-rolled bones). The scope lead-in ("While the viewer
 * is open:") keeps the door honest — these are viewer keys, not door
 * shortcuts.
 *
 * Sections:
 *   A  the ortho panel's hint row (gate, families, contract wording)
 *   B  the door's kbd chips (families, scope lead-in, the t642 vocabulary)
 *   C  regression guards (the t827 waist, the σ chip gate, the t829 titles)
 *   D  the calibre (19 api entries)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
};
const src = (p) => readFileSync(join(ROOT, p), "utf8");

const panel = src("src/components/workflow/results/map-ortho-panel.tsx");
const m = src("src/components/workflow/results/molstar-embed.tsx");
const kbd = src("src/components/ui/kbd.tsx");

console.log("A — the ortho panel's keymap row (the section keys taught at the 2D instruments)");
ok(
  panel.includes('data-canvas-ui="ortho-keymap"'),
  "A1 the hint row exists (ortho-keymap)"
);
ok(
  /\{open && isoSigma && \(/.test(panel),
  "A2 the row gates on the σ chip's own honesty signal (isoSigma — null until the embed answers the pull)"
);
ok(
  panel.includes("<Kbd>X</Kbd>") && panel.includes("<Kbd>Y</Kbd>") && panel.includes("<Kbd>Z</Kbd>"),
  "A3 the section verbs render as keys (X Y Z)"
);
ok(
  panel.includes("<Kbd>,</Kbd>") && panel.includes("<Kbd>.</Kbd>"),
  "A4 the scrub verbs render as keys (, .)"
);
ok(
  panel.includes("<Kbd>&lt;</Kbd>") && panel.includes("<Kbd>&gt;</Kbd>"),
  "A5 the coarse scrub renders as keys (< >, the shift pair)"
);
ok(
  panel.includes("cut the plane — the tiles follow"),
  "A6 the wording names the bidirectional contract (keys cut, the tiles follow)"
);
ok(
  panel.includes('import { Kbd } from "@/components/ui/kbd"'),
  "A7 the row speaks the t642 vocabulary (no hand-rolled kbd bones)"
);
ok(
  /pb-2\.5 text-\[10px\]/.test(panel),
  "A8 the row is a quiet footer (10px, muted — the panel's signature line, not a seat)"
);

console.log("B — the door's keymap grew kbd chips");
ok(
  m.includes('data-canvas-ui="door-keymap"'),
  "B1 the chip row exists (door-keymap)"
);
ok(
  m.includes("<Kbd>[</Kbd>") && m.includes("<Kbd>]</Kbd>"),
  "B2 the contour family renders as keys ([ ])"
);
ok(
  /<Kbd>F<\/Kbd>/.test(m),
  "B3 the flip verb renders as a key (F)"
);
ok(
  m.includes("<Kbd>X</Kbd>") && m.includes("<Kbd>Z</Kbd>") && m.includes("<Kbd>,</Kbd>") && m.includes("<Kbd>.</Kbd>"),
  "B4 the section + scrub families render as keys"
);
ok(
  m.includes("While the viewer is open:"),
  "B5 the scope lead-in kept — viewer keys, not door shortcuts (the door must not imply otherwise)"
);
ok(
  m.includes('import { Kbd } from "@/components/ui/kbd"'),
  "B6 the door speaks the t642 vocabulary too"
);
ok(
  !/Keys while the viewer is open: \[ \] step the contour/.test(m),
  "B7 the old prose line is gone (replaced, not duplicated)"
);

console.log("C — regression guards (the earlier laws untouched)");
ok(
  /w-64 max-h-\[var\(--radix-popover-content-available-height\)\] overflow-y-auto nice-scroll p-2"\s*\n\s*data-canvas-ui="camera-bookmarks"/.test(m),
  "C1 the bookmarks door keeps its t827 waist (the chips ride INSIDE the capped pane)"
);
ok(
  /title="Contour σ — \[ \/ \] step the level from the keyboard, F flips the density side"/.test(m),
  "C2 the t829 σ slider title still names its keys"
);
ok(
  /title=\{`Slice perpendicular to the \$\{ax\} axis \(\$\{ax\} key\)`\}/.test(m),
  "C3 the t829 axis-button titles still name their keys"
);
ok(
  /if \(!sliceStateRef\.current\.on\) return;/.test(m),
  "C4 the t829 ON-guard kept — scrub verbs still demand the plane"
);
ok(
  /const \[isoSigma, setIsoSigma\] = useState<OrthoSigmaState \| null>\(null\);/.test(panel),
  "C5 the σ chip's honesty signal unchanged (null-until-heard)"
);
ok(
  /inline-flex items-center justify-center rounded border bg-muted px-1 font-mono text-\[9px\] font-semibold/.test(kbd),
  "C6 the kbd primitive's bones unchanged (one vocabulary law — t642)"
);
ok(
  panel.includes('data-canvas-ui="ortho-sigma-chip"'),
  "C7 the σ chip still in place (the row's honesty sibling)"
);

console.log("D — the calibre (census rotation)");
const apiDir = join(ROOT, "src/app/api");
const dirs = readdirSync(apiDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
const entries = dirs + (existsSync(join(apiDir, "route.ts")) ? 1 : 0);
ok(entries === 19, `D1 api entries = 19 (18 dirs + root route.ts) — got ${entries}`);

console.log(`\nFLEET-UNIT t830: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
