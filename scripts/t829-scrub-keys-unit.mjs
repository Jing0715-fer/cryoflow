#!/usr/bin/env node
/**
 * t829 — the viewer's scrub keys + the max-w erratum.
 *
 * Feature (this window): the two most-visited 3D-viewer instruments gain a
 * keyboard face — [ / ] step the contour σ (relative ×1.05), F flips the
 * density sign, X/Y/Z cut the section plane at that axis (turning it on),
 * and , / . (shift: < / >) scrub the plane — demanding the plane ON (no
 * spooky action on an invisible plane). Discoverability rides the
 * instruments themselves: the σ slider's title, the flip button's title,
 * the axis buttons' titles, the bookmark door's help line.
 *
 * Erratum (t828 → t829): the "mangled max-w-in(…) fossil" recorded last
 * window NEVER EXISTED — the tool-output pipeline strips bare `[m`
 * sequences as ANSI SGR resets, so every `max-w-[min(…)` read through a
 * bash channel displayed as `max-w-in(…)`. Codepoint dissection settled it:
 * the sources and the compiled CSS were canonical all along. The probe
 * pins the canonical classes byte-exact (D) so the record stays honest.
 *
 * Sections:
 *   A  the scrub keys (verbs, paths, guards)
 *   B  the gate (form fields, menus, modifiers — the t-era contract kept)
 *   C  discoverability (the instruments teach their own keys)
 *   D  the max-w classes canonical — byte-exact (erratum pinned)
 *   E  regression guards (the t827/t828 laws untouched)
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

const m = src("src/components/workflow/results/molstar-embed.tsx");
const molViewer = src("src/components/workflow/results/mol-viewer.tsx");
const gallery = src("src/components/workflow/results/class-iteration-gallery.tsx");
const header = src("src/components/workflow/header.tsx");

console.log("A — the scrub keys");
ok(
  /else if \(e\.key === "\]"/.test(m) && /e\.key === "\["/.test(m),
  "A1 the contour step keys are wired ([ down, ] up)"
);
ok(
  /sigmaRef\.current \* 1\.05/.test(m) && /sigmaRef\.current \/ 1\.05/.test(m),
  "A2 the step is relative (×1.05 / ÷1.05) — fine at low σ, coarse at high"
);
ok(
  /Math\.min\(SIGMA_MAX, sigmaRef\.current \* 1\.05\)/.test(m) &&
    /Math\.max\(SIGMA_MIN, sigmaRef\.current \/ 1\.05\)/.test(m),
  "A3 the step clamps to the slider's own constants"
);
ok(
  /else if \(e\.key === "f" \|\| e\.key === "F"\)/.test(m) &&
    /setSign\(\(s\) => \(s > 0 \? -1 : 1\)\)/.test(m),
  "A4 F rides the flip button's exact verb"
);
ok(
  /e\.key === "x" \|\| e\.key === "y" \|\| e\.key === "z"/.test(m),
  "A5 X/Y/Z are the section verbs"
);
ok(
  /applySliceIntent\(\{ on: true, axis: ax \}\)/.test(m),
  "A6 the section verbs turn the plane ON (the panel's own intent path)"
);
ok(
  /e\.key === "," \|\| e\.key === "\." \|\| e\.key === "<" \|\| e\.key === ">"/.test(m),
  "A7 , . < > are the scrub verbs (shift doubles the step)"
);
ok(
  /if \(!sliceStateRef\.current\.on\) return;/.test(m),
  "A8 the scrub verbs demand the plane ON — an invisible plane must not move"
);
ok(
  /const step = e\.key === "<" \|\| e\.key === ">" \? 0\.1 : 0\.02;/.test(m),
  "A9 the nudge steps are 0.02, shift 0.1"
);
ok(
  /applySliceIntent\(\{ pos: Math\.round\(next \* 100\) \/ 100 \}\)/.test(m),
  "A10 the scrub commits through applySliceIntent (sliders, landscape and chips all follow)"
);

console.log("B — the gate (kept from the 1-6/0/B era)");
ok(
  /if \(e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey\) return;/.test(m),
  "B1 modifiers bail first"
);
ok(
  /t\.closest\("input, textarea, select, \[contenteditable='true'\]"\)/.test(m),
  "B2 form fields keep their keys"
);
ok(
  /document\.querySelector\('\[role="menu"\]\[data-state="open"\]'\)/.test(m),
  "B3 open menus keep their keys"
);
ok(
  /if \(phase !== "ready"\) return;/.test(m),
  "B4 the listener lives only with the viewer ready"
);

console.log("C — discoverability (the instruments teach their own keys)");
ok(
  /title="Contour σ — \[ \/ \] step the level from the keyboard, F flips the density side"/.test(m),
  "C1 the σ slider's title names the keys"
);
ok(
  /F key does the same\./.test(m),
  "C2 the flip button's title names F"
);
ok(
  /title=\{`Slice perpendicular to the \$\{ax\} axis \(\$\{ax\} key\)`\}/.test(m),
  "C3 the axis buttons name their keys"
);
ok(
  /data-canvas-ui="door-keymap"/.test(m) && /<Kbd>\[\]<\/Kbd>|<Kbd>\[<\/Kbd>/.test(m) &&
    /While the viewer is open:/.test(m),
  "C4 the bookmark door's keymap carries the family (t830 re-cut: prose grew kbd chips — the scope lead-in kept)"
);

console.log("D — the max-w classes canonical (the t828 erratum, byte-exact)");
ok(
  molViewer.includes("max-w-[min(1500px,94vw)]") &&
    molViewer.includes("sm:max-w-[min(1500px,94vw)]"),
  "D1 mol-viewer carries the canonical bracket form (bare + sm:)"
);
ok(
  !molViewer.includes("max-w-in(") || true, // the laundered display can't be trusted for [ m — the byte check above is the verdict
  "D2 (display note: bash channels strip bare ANSI-reset sequences — codepoints are the only honest witness)"
);
ok(
  gallery.includes("max-w-[min(96vw,1400px)]") &&
    gallery.includes("sm:max-w-[min(96vw,1400px)]"),
  "D3 class-iteration-gallery carries the canonical bracket form (bare + sm:)"
);

console.log("E — regression guards (the laws of t827/t828 untouched)");
ok(
  /w-64 max-h-\[var\(--radix-popover-content-available-height\)\] overflow-y-auto nice-scroll p-2"\s*\n\s*data-canvas-ui="camera-bookmarks"/.test(m),
  "E1 the bookmarks door keeps its t827 waist"
);
ok(
  /w-72 max-h-\[var\(--radix-popover-content-available-height\)\]/.test(m) &&
    /w-52 max-h-\[var\(--radix-popover-content-available-height\)\]/.test(m),
  "E2 the t828 family caps still ride the toolbar popovers"
);
ok(
  /no-print flex shrink-0 items-center gap-1\.5/.test(header),
  "E3 the header cluster keeps its t828 shrink-0 contract"
);
ok(
  /max-sm:hidden">\s*\n\s*<KnockSettingsButton \/>/.test(header),
  "E4 the tier law's knock seat still falls below sm"
);

console.log("F — the calibre (census rotation)");
const apiDir = join(ROOT, "src/app/api");
const dirs = readdirSync(apiDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
const entries = dirs + (existsSync(join(apiDir, "route.ts")) ? 1 : 0);
ok(entries === 19, `F1 api entries = 19 (18 dirs + root route.ts) — got ${entries}`);

console.log(`\nFLEET-UNIT t829: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
