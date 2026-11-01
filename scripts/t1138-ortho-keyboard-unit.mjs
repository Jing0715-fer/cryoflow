#!/usr/bin/env node
/**
 * t1138 — the ortho strip's KEYBOARD MIRROR unit: the hover's keyboard
 * twin, born this window.
 *
 * The candidate's own words (the t1134 ledger, carried three windows):
 * "ortho 条带 ⌖ mirror 键盘路径（探针家族余韵，hover 的键盘镜像同名在案）".
 * The tile's density canvas answered ONLY the pointer: hover probed the
 * density, click picked the focus point, drag rode the cut — a keyboard
 * user could step the PLANE (the slider and the ‹ › buttons were always
 * real controls) but could never PROBE a point or MOVE the focus.
 * The mirror: the canvas takes focus and answers the same verbs on keys
 * — arrows nudge the probe one voxel in the plane (shift = the coarse
 * ×10, the depth dial's own shape), Enter/Space commit the focus via
 * the SAME onPick door the click uses, Escape clears the probe (the
 * pointer-leave's mirror). ONE wire: probeAt is the factored trailing
 * throttle both hands share; the line is instant, the value chases on
 * the one cadence. The gate is the family's own gatekeeper (no
 * ctrl/meta/alt — t908's B7 law); every handled key preventDefaults
 * (the B5 law); the canvas teaches exactly the keys it answers (the
 * must-not-lie law's fifth application) and the readout speaks
 * politely (aria-live — the value reaches the ear, not only the eye).
 *
 * The unit pins the SOURCE (the verbs are React handlers — the browser
 * ride belongs to the standing census's live lanes when a build day
 * opens). The family's laws are pinned untouched beside it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project";
const src = readFileSync(join(ROOT, "src/components/workflow/results/map-ortho-panel.tsx"), "utf8");

let passed = 0;
let failed = 0;
const ok = (cond, name) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
};

console.log("A — the canvas takes focus and teaches its keys");

// The tile canvas: the div that carries onClick={pickFocus} — the SAME
// div must carry the keyboard contract. Pinned by its own className
// shape (relative aspect-square cursor-crosshair) so a second canvas
// can never satisfy the pin by accident.
const canvasBlock = (() => {
  const m = src.match(/className=\{cn\(\s*\n\s*"relative aspect-square cursor-crosshair[^"]*",[\s\S]{0,900}?onKeyDown=\{onCanvasKeyDown\}/);
  return m ? m[0] : "";
})();
ok(canvasBlock.length > 0, "A0 the tile canvas carries the keyboard handler (onKeyDown={onCanvasKeyDown} on the crosshair canvas)");
ok(/tabIndex=\{0\}/.test(canvasBlock), "A1 the canvas takes focus (tabIndex={0} — the density canvas is a stop, not a ghost)");
ok(/role="group"/.test(canvasBlock), "A2 the canvas is a NAMED group (role=\"group\" — the focusable container announces itself)");
ok(/aria-label=\{`\$\{spec\.plane\} at \$\{readout\} — density canvas: arrow keys move the density probe \(shift for coarse steps\), Enter moves the focus point, Escape dismisses the probe`\}/.test(canvasBlock),
  "A3 the label teaches exactly the answered keys (arrows + shift coarse + Enter + Escape — the must-not-lie law's fifth application)");
ok(/focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/.test(canvasBlock),
  "A4 the focus ring rides the house vocabulary (focus-visible:ring-1 focus-visible:ring-ring — the ⌖ button's own focus dress)");
ok(/keyboard: arrows move the probe, Enter picks the focus, Escape dismisses/.test(src),
  "A5 the title's pointer contract grew the keyboard words (one tooltip, both hands)");

console.log("B — the verbs (source-level)");

// The handler block: from the gatekeeper to the switch's default arm.
const handlerBlock = (() => {
  const m = src.match(/const onCanvasKeyDown = \(e: React\.KeyboardEvent<HTMLDivElement>\) => \{[\s\S]*?\n  \};/);
  return m ? m[0] : "";
})();
ok(handlerBlock.includes("if (e.ctrlKey || e.metaKey || e.altKey) return;"),
  "B1 the gate is the family's one gatekeeper (no ctrl/meta/alt — the t908 B7 law's shape; shift rides as the coarse key)");
ok(handlerBlock.includes("hDim ? -1 / hDim : -0.01") && handlerBlock.includes("vDim ? 1 / vDim : 0.01"),
  "B2 the arrows nudge by ONE VOXEL (1/dims with the honest 1% fallback when the grid is unknown — the stepVoxel tier law's shape)");
ok(handlerBlock.includes("e.shiftKey ? 10 : 1"),
  "B3 shift = the coarse ×10 (the depth dial's own shape — one key, one meaning, family-wide)");
ok((handlerBlock.match(/e\.preventDefault\(\)/g) || []).length >= 6 && handlerBlock.includes("default:\n        return;"),
  "B4 every handled key preventDefaults; the default arm returns bare (the page keeps no double duty AND keeps its own — the B5 law)");
ok(handlerBlock.includes("case \"Enter\":") && handlerBlock.includes("case \" \":") &&
   handlerBlock.includes("if (probe) onPick?.(probe.fx, probe.fy);"),
  "B5 Enter/Space commit the focus via the SAME onPick door (the click's verb — no second door, no second truth)");
ok(handlerBlock.includes("case \"Escape\":") && /case "Escape":\s*\n\s*e\.preventDefault\(\);\s*\n\s*leaveProbe\(\);/.test(handlerBlock),
  "B6 Escape clears the probe (leaveProbe — the pointer-leave's mirror, the SAME hand)");
ok(handlerBlock.includes("probe ?? { fx: 0.5, fy: 0.5 }"),
  "B7 the first nudge without a probe speaks from the canvas's centre (0.5/0.5 — no invented corner, the centre is the honest start)");

console.log("C — one wire, one cadence");

// The factoring pin: the trailing throttle lives EXACTLY once. The
// pre-t1138 file carried it inline inside moveProbe; the mirror must
// never grow a second clock.
const throttleCount = (src.match(/const remaining = PROBE_THROTTLE_MS - \(now - lastProbeAt\.current\);/g) || []).length;
ok(throttleCount === 1, `C1 probeAt is the ONE hand (the trailing throttle appears exactly once — got ${throttleCount}; a second clock would be a drift)`);
ok(/const probeAt = \(fx: number, fy: number\) => \{[\s\S]*?\n  \};/.test(src) && src.includes("fireProbe(fx, fy);"),
  "C2 probeAt exists and carries the fetch (the factored hand — the value chases the line)");
ok(/const moveProbe = \(e: React\.MouseEvent<HTMLDivElement>\) => \{[\s\S]*?probeAt\(fx, fy\);[\s\S]*?\n  \};/.test(src),
  "C3 the cursor's hand rides the shared hand (moveProbe calls probeAt)");
ok((src.match(/probeAt\(cx, cy\);/g) || []).length === 1 && handlerBlock.includes("probeAt(cx, cy);"),
  "C4 the keyboard's hand rides the shared hand (the nudge calls probeAt — ONE cadence, two hands)");
ok(handlerBlock.includes("value: null, voxel: null, patch: undefined") && handlerBlock.includes("p ? { ...p, fx: cx, fy: cy }"),
  "C5 the chip never flashes empty (an existing probe keeps its value until the fetch answers — the birth shape nulls, the move shape preserves)");
ok(/data-canvas-ui="ortho-probe-readout"[\s\S]{0,120}aria-live="polite"/.test(src),
  "C6 the readout speaks politely (aria-live=\"polite\" on the probe chip — the value reaches the ear, not only the eye)");

console.log("D — the family laws untouched");

ok(!src.includes('window.addEventListener("keydown"'),
  "D1 no raw window keydown in the panel (the t908 C1 law — the verb wire stays the ONE window listener; the canvas handler is element-level, focus-gated by nature)");
ok(src.includes('data-canvas-ui={`ortho-step-${spec.axis}-dec`}') && src.includes('data-canvas-ui={`ortho-step-${spec.axis}-inc`}'),
  "D2 the step buttons stand (the ‹ › seats verbatim — the plane's own keyboard path they always were)");
ok(src.includes("Show the ${spec.plane} at ${readout} in 3D"),
  "D3 the ⌖ button stands (the mirror verb — the strip's original keyboard-free verb, untouched)");
ok(/<MrcImage\s*\n\s*src=\{src\}\s*\n\s*alt=\{`\$\{spec\.plane\} at \$\{readout\}`\}/.test(src),
  "D4 the img keeps its alt (the census's alt-less hunt holds — the value voice stays on the image)");

console.log(`\nORTHO-KEYBOARD-UNIT t1138: ${passed}/${passed + failed} green`);
process.exit(failed === 0 ? 0 : 1);
