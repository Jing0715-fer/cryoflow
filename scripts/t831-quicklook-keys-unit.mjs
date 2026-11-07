#!/usr/bin/env node
/**
 * t831 — the quick-look learns its keys, the ortho row grows the σ
 * family, and the world behind a modal falls silent.
 *
 * Feature (this window):
 *   1. The map/stack quick-look gains its own keyboard face — ← / →
 *      step the stack's slice cursor through the SAME setter the
 *      prev/next buttons drive (the t287 window-reset follows free),
 *      and a quick-keymap row teaches what works HERE (mode-gated:
 *      the slice family only for a multi-image stack, Esc always).
 *      The keymap family's third seat, after the door and the ortho
 *      panel.
 *   2. The ortho row grows the σ family — [ ] step the cut, F flips
 *      the side. Honest because WIRED: the histogram's cyan cut line
 *      is drawn from the same isoSigma the embed echoes on every σ
 *      change, so "the line follows" is the echo wire's own words.
 *   3. The spooky-action fix: the embed's window key listener bailed
 *      only on open MENUS — a foreign RADIX DIALOG on top left the keys
 *      live, so pressing X behind the quick-look's mask drove an
 *      invisible 3D world. The house's open-surface truth (t813) is
 *      the witness, read at the TOP of the portal stack: keys live when
 *      the topmost modal is the viewer's own dialog (the t829 contract
 *      — the drive-in stacks the viewer over the job report), silent
 *      when a foreign modal tops the stack. FIRST CUT WAS WRONG: a flat
 *      openSurfaceExists() bail ate the viewer's own keyboard face live
 *      (the drive-in IS two stacked modals) — caught on :3000 within
 *      the hour, re-cut to the z-order rule on the record.
 *
 * Re-cut on the record: t809's A9 (the escape-law verbatim) grew the
 * composition form — arrows consumed first, the house escape law
 * still the tail.
 *
 * Sections:
 *   A  the modal guard (one dialect, popovers not modal)
 *   B  the stack slice keys (same clamps, same gate law, same setter)
 *   C  the quick-keymap row (mode-gated families, one vocabulary)
 *   D  the ortho row's σ family (the echo wire's own words)
 *   E  regression guards (the t827-t830 laws untouched)
 *   F  the calibre (19 api entries)
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

const dialog = src("src/components/ui/dialog.tsx");
const m = src("src/components/workflow/results/molstar-embed.tsx");
const rv = src("src/components/workflow/results/results-view.tsx");
const panel = src("src/components/workflow/results/map-ortho-panel.tsx");
const kbd = src("src/components/ui/kbd.tsx");

console.log("A — the modal guard (the world behind a FOREIGN modal falls silent)");
ok(
  /export function openTopSurface\(\): Element \| null \{/.test(dialog),
  "A1 the t813 family grew the topmost-surface truth (one dialect, portal order = stack order)"
);
ok(
  /onEscapeClose, openTopSurface, Dialog,/.test(m),
  "A2 the embed imports the house truth (no second hand-rolled selector)"
);
ok(
  /const topSurface = openTopSurface\(\);/.test(m) &&
    /if \(topSurface && !\(containerRef\.current && topSurface\.contains\(containerRef\.current\)\)\) return;/.test(m),
  "A3 the z-order rule: keys bail when a FOREIGN modal tops the stack — and only then (the viewer's own dialog keeps its t829 keyboard face)"
);
ok(
  dialog.includes(
    '[data-slot="dialog-content"][data-state="open"], [data-slot="alert-dialog-content"][data-state="open"], [data-slot="sheet-content"][data-state="open"]'
  ),
  "A4 the selector's bytes unchanged (dialog + alert-dialog + sheet slots, data-state=open)"
);
ok(
  !/\[data-slot="popover-content"\]\[data-state/.test(dialog),
  "A5 popovers are NOT modal surfaces — the selector never matches the door (the door keeps its keys, current behavior kept)"
);
ok(
  /document\.querySelector\('\[role="menu"\]\[data-state="open"\]'\)/.test(m),
  "A6 the t829 menu guard kept (menus bail, foreign modals bail, everything else lives)"
);

console.log("B — the stack slice keys (the quick-look's own verbs)");
ok(
  /e\.key === "ArrowLeft" && stackSlice > 0/.test(rv) &&
    /e\.key === "ArrowRight" && stackSlice < max/.test(rv),
  "B1 the arrows step the cursor, gated on real movement (at the edges the scroll region keeps its arrows)"
);
ok(
  /setStackSlice\(\(s\) => Math\.max\(0, s - 1\)\)/.test(rv) &&
    /setStackSlice\(\(s\) => Math\.min\(\(imageFile\.slices \?\? 1\) - 1, s \+ 1\)\)/.test(rv),
  "B2 the SAME clamps the prev/next buttons drive (one path, two triggers)"
);
ok(
  /t\.closest\("input, textarea, select, \[contenteditable='true'\]"\) != null ||/.test(rv),
  "B3 the t829 gate law rides along — form fields keep their keys (lo/hi fields, the native range arrows)"
);
ok(
  /!inField && imageFile && imageFile\.name\.toLowerCase\(\)\.endsWith\("\.mrcs"\)/.test(rv),
  "B4 the verbs belong to the stack mode only (a map has no slice cursor — no chips, no keys)"
);
ok(
  /useEffect\(\(\) => \{\s*\n\s*setImgWindow\(null\);\s*\n\s*\}, \[imgPath, stackSlice\]\);/.test(rv),
  "B5 the t287 window-reset still rides [imgPath, stackSlice] — the keyboard path resets the window through the SAME setter"
);
ok(
  /onEscapeClose\(\(\) => setImageFile\(null\)\)\(e\);/.test(rv),
  "B6 the escape law still the composition's tail (t809 A9 re-cut form)"
);

console.log("C — the quick-keymap row (the family's third seat)");
ok(
  rv.includes('data-canvas-ui="quick-keymap"'),
  "C1 the row exists (quick-keymap)"
);
ok(
  /endsWith\("\.mrcs"\) && \(imageFile\.slices \?\? 1\) > 1 && \(/.test(rv),
  "C2 the slice family is mode-gated — a single image has no step, chips for a dead key would lie"
);
ok(
  rv.includes("<Kbd>←</Kbd>") && rv.includes("<Kbd>→</Kbd>"),
  "C3 the slice family renders as keys (← →)"
);
ok(
  rv.includes("<Kbd>Esc</Kbd>") && rv.includes("closes"),
  "C4 Esc is taught — the house dialog close, the one key every mode has"
);
ok(
  rv.includes('import { Kbd } from "@/components/ui/kbd"'),
  "C5 the row speaks the t642 vocabulary (no hand-rolled kbd bones)"
);
ok(
  /gap-x-3 gap-y-1 pt-1 text-\[10px\] leading-tight text-muted-foreground/.test(rv),
  "C6 a quiet footer line (10px muted — the ortho row's signature calibre)"
);

console.log("D — the ortho row's σ family (the echo wire's own words)");
ok(
  panel.includes("<Kbd>[</Kbd>") && panel.includes("<Kbd>]</Kbd>"),
  "D1 the contour step renders as keys ([ ])"
);
ok(
  panel.includes("<Kbd>F</Kbd>"),
  "D2 the flip verb renders as a key (F)"
);
ok(
  panel.includes("step the cut — the line follows"),
  "D3 the wording names the echo wire (the cut line rides the same isoSigma the embed echoes)"
);
ok(
  panel.includes("flips the side"),
  "D4 F's wording matches the door's family (one verb, one name)"
);
ok(
  /\{open && isoSigma && \(/.test(panel),
  "D5 the gate unchanged — no isoSigma, no chips (the σ family borrows the row's honesty signal)"
);

console.log("E — regression guards (the earlier laws untouched)");
ok(
  m.includes('data-canvas-ui="door-keymap"') && m.includes("While the viewer is open:"),
  "E1 the t830 door chips + scope lead-in intact"
);
ok(
  /title="Contour σ — \[ \/ \] step the level from the keyboard, F flips the density side"/.test(m),
  "E2 the t829 σ slider title still names its keys"
);
ok(
  /title=\{`Slice perpendicular to the \$\{ax\} axis \(\$\{ax\} key\)`\}/.test(m),
  "E3 the t829 axis-button titles still name their keys"
);
ok(
  /if \(!sliceStateRef\.current\.on\) return;/.test(m),
  "E4 the t829 ON-guard kept — scrub verbs still demand the plane"
);
ok(
  /w-64 max-h-\[var\(--radix-popover-content-available-height\)\] overflow-y-auto nice-scroll p-2"\s*\n\s*data-canvas-ui="camera-bookmarks"/.test(m),
  "E5 the t827 door waist intact"
);
ok(
  /inline-flex items-center justify-center rounded border bg-muted px-1 font-mono text-\[9px\] font-semibold/.test(kbd),
  "E6 the kbd primitive's bones unchanged (one vocabulary law — t642)"
);
ok(
  panel.includes('data-canvas-ui="ortho-sigma-chip"'),
  "E7 the σ chip still in place (the row's honesty sibling)"
);
ok(
  panel.includes("cut the plane — the tiles follow") &&
    panel.includes("<Kbd>&lt;</Kbd>") &&
    panel.includes("<Kbd>&gt;</Kbd>"),
  "E8 the t830 section + scrub families intact (the row grew, nothing moved)"
);

console.log("F — the calibre (census rotation)");
const apiDir = join(ROOT, "src/app/api");
const dirs = readdirSync(apiDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
const entries = dirs + (existsSync(join(apiDir, "route.ts")) ? 1 : 0);
ok(entries === 19, `F1 api entries = 19 (18 dirs + root route.ts) — got ${entries}`);

console.log(`\nFLEET-UNIT t831: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
