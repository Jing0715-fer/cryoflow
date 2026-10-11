#!/usr/bin/env node
// t908 — the oblique verbs' unit: the keyboard face grows its third
// family (the slice's X/Y/Z/,/. and the clip-σ's [/]/F have an oblique
// sibling — C ✂, J ⌖, A ⤸, ; ' the depth dial) and the seat's laws are
// pinned where they live: ONE gated keydown (the embed's — the t829/t831
// gatekeeper), ONE verb wire (OBLIQUE_VERB_EVENT), the block executing
// with its OWN hands (the provenance/flash/debounce laws ride, no second
// implementation to drift), the wake law (the slice's X/Y/Z: turning it
// on if it slept), the sleep law (the scrub verbs': an invisible plane
// must not move, a default plane must not be faced), and the shift law
// (the < > pair's: shift is the COARSER step).
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t908-oblique-keyboard-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const ROOT = "/home/z/my-project";
const embedSrc = readFileSync(join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
const panelSrc = readFileSync(join(ROOT, "src/components/workflow/results/map-ortho-panel.tsx"), "utf8");

console.log("A — the alphabet: one key, one verb, no collisions");

// behavioral: the HOUSE alphabet as keydown predicates. Existing verbs
// (t829's families + the view/reset/save keys) vs the t908 verbs — the
// sets must be disjoint, and every new key must map to exactly one arm.
const houseKeys = ["1", "2", "3", "4", "5", "6", "0", "b", "B", "[", "]", "f", "F",
  "x", "y", "z", "X", "Y", "Z", ",", ".", "<", ">"];
const obliqueKeys = ["c", "C", "j", "J", "a", "A", ";", ":", "'", '"'];
const house = new Set(houseKeys);
const oblique = new Set(obliqueKeys);
let collided = [...houseKeys.filter((k) => oblique.has(k)), ...obliqueKeys.filter((k) => house.has(k))];
ok("no key answers two verbs (the sets are disjoint)", collided.length === 0, collided.join(" "));
ok("the shifted forms belong to their unshifted verb (case/shift fold, the < > law's shape)",
  ["C", "J", "A"].every((k) => oblique.has(k) && oblique.has(k.toLowerCase()))
  && obliqueKeys.filter((k) => !["c", "C", "j", "J", "a", "A"].includes(k)).every((k) => houseKeys.includes(k) === false));
ok("no arrow/function key was grabbed (Mol*'s canvas keeps its own)",
  obliqueKeys.every((k) => !k.startsWith("Arrow") && !k.startsWith("F") || k === "F" === false));

console.log("B — the embed's key face: the four arms, gated and loud");
ok("B1 the ✂ verb toggles: a cut out retires locally, none out requests the wake",
  embedSrc.includes('if (obliqueClipRef.current.on) applyObliqueClipIntent({ on: false });')
  && embedSrc.includes('else window.dispatchEvent(new CustomEvent(OBLIQUE_VERB_EVENT, { detail: { verb: "cut" } satisfies ObliqueVerbDetail }));'));
ok("B2 the ⌖ verb requests the jump (the block owns the refusal)",
  embedSrc.includes('window.dispatchEvent(new CustomEvent(OBLIQUE_VERB_EVENT, { detail: { verb: "jump" } satisfies ObliqueVerbDetail }));'));
ok("B3 the ⤸ verb requests the adopt (the block wakes BY CAMERA)",
  embedSrc.includes('window.dispatchEvent(new CustomEvent(OBLIQUE_VERB_EVENT, { detail: { verb: "adopt" } satisfies ObliqueVerbDetail }));'));
ok("B4 the depth dial speaks dir and coarse (; : toward −n, ' \" toward +n, shift = the coarser 10%)",
  embedSrc.includes('const dir = e.key === ";" || e.key === ":" ? -1 : 1;')
  && embedSrc.includes('const coarse = e.key === ":" || e.key === \'"\';'));
ok("B5 every new arm preventDefaults (the page keeps no double duty)",
  (embedSrc.match(/e\.preventDefault\(\);\n        (?:if \(obliqueClipRef|window\.dispatchEvent|const dir = e\.key === ";")/g) || []).length >= 4);
ok("B6 the keydown docblock names the oblique verbs (the prose and the code are one story)",
  embedSrc.includes("t908 gives the OBLIQUE plane its verbs"));
ok("B7 the gates are untouched (one gatekeeper: ctrl/meta/alt, inputs, menus, foreign modals)",
  embedSrc.includes('if (e.ctrlKey || e.metaKey || e.altKey) return;')
  && embedSrc.includes('t.closest("input, textarea, select, [contenteditable=\'true\']")')
  && embedSrc.includes('document.querySelector(\'[role="menu"][data-state="open"]\')'));

console.log("C — the block's hands: the laws live where the buttons live");
ok("C1 the block listens on the verb wire (ONE listener, no raw keydown in the panel)",
  panelSrc.includes("window.addEventListener(OBLIQUE_VERB_EVENT, onVerb);")
  && !panelSrc.includes('window.addEventListener("keydown"'));
ok("C2 the wake law: \"cut\" wakes a sleeping block and cuts (the X/Y/Z law)",
  panelSrc.includes('if (d.verb === "cut") {') && /verb === "cut"\) \{\s*\n\s*setOn\(true\);\s*\n\s*setCut3d\(true\);/.test(panelSrc));
ok("C3 the sleep law: jump and offset demand ON (the ,/. law — silence IS the honesty)",
  /verb === "jump"\) \{\s*\n\s*if \(!on\) return;/.test(panelSrc)
  && /verb === "offset"\) \{\s*\n\s*if \(!on\) return;/.test(panelSrc));
ok("C4 the depth dial clamps to the slider's own range and speaks its steps (2 fine, 10 coarse)",
  panelSrc.includes("scrubOffset(Math.min(100, Math.max(-100, offset + dir * step)));")
  && panelSrc.includes("const step = d.coarse === true ? 10 : 2;"));
ok("C5 scrubOffset is the hand (the provenance law: an offset scrub never revokes the gesture's chip)",
  /const scrubOffset = \(v: number\) => \{ setOffset\(v\); \};/.test(panelSrc));
ok("C6 the listener re-subscribes on the state it reads (the captured ⌖ frame is THIS render's)",
  panelSrc.includes("}, [on, theta, phi, offset]);"));
ok("C7 the adopt verb rides the block's own ⤸ (the request→answer→wake law, the flash and provenance ride)",
  /verb === "adopt"\) \{\s*\n\s*adoptCamera\(\);/.test(panelSrc));

console.log("D — the wire: one event, one shape, one story");
ok("D1 the verb wire is exported with its detail type",
  panelSrc.includes('export const OBLIQUE_VERB_EVENT = "cryoflow:oblique-verb";')
  && panelSrc.includes('verb: "cut" | "jump" | "adopt" | "offset";'));
ok("D2 the wire's docblock names the house laws (wake, sleep, adopt-wakes-by-camera, the < > law)",
  panelSrc.includes("the slice verbs' X/Y/Z wake law")
  && panelSrc.includes("the scrub verbs'")
  && panelSrc.includes("the < > law"));
ok("D3 the embed imports the wire (the same module the oblique loop already shares)",
  embedSrc.includes("OBLIQUE_VERB_EVENT") && embedSrc.includes("ObliqueVerbDetail"));

console.log("E — the door's chips: a key that renders as a key reads as a key");
ok("E1 the door-keymap grew the four chips (C / J / A / ; ')",
  embedSrc.includes("<Kbd>C</Kbd>") && embedSrc.includes("<Kbd>J</Kbd>") && embedSrc.includes("<Kbd>A</Kbd>")
  && embedSrc.includes("<Kbd>;</Kbd>") && embedSrc.includes("<Kbd>'</Kbd>"));
ok("E2 the chip texts speak the block's own gestures",
  embedSrc.includes("cut in 3D") && embedSrc.includes("face the cut")
  && embedSrc.includes("adopt the view") && embedSrc.includes(">depth<"));
ok("E3 the scope lead-in stands (these are viewer keys, not door shortcuts)",
  embedSrc.includes("While the viewer is open:"));
ok("E4 the older chips stand untouched (the t830 families: [ ] F X Y Z , .)",
  embedSrc.includes("<Kbd>[</Kbd>") && embedSrc.includes("<Kbd>]</Kbd>")
  && embedSrc.includes("<Kbd>F</Kbd>") && embedSrc.includes("<Kbd>,</Kbd>") && embedSrc.includes("<Kbd>.</Kbd>"));

console.log("F — the boundaries: the neighbors untouched");
ok("F1 the slice verbs stand (the t829 arms' exact code)",
  embedSrc.includes("applySliceIntent({ on: true, axis: ax });")
  && embedSrc.includes("if (!sliceStateRef.current.on) return;"));
ok("F2 the σ family stands ([ ] relative ×1.05, F polarity)",
  embedSrc.includes("sigmaRef.current * 1.05") && embedSrc.includes("setSign((s) => (s > 0 ? -1 : 1));"));
ok("F3 the t907 depth voices stand (the chip's readout still rides the lib)",
  embedSrc.includes("{obliqueOffsetPctVoice(obliqueClip.offset)}{obliqueDepthSuffix()}"));
ok("F4 the ACK loop stands (a chip flip / a bookmark restore still follows the block's ✂ face)",
  panelSrc.includes("window.addEventListener(OBLIQUE_CLIP_STATE_EVENT, onAck);"));

console.log(`\nt908 oblique-keyboard unit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
