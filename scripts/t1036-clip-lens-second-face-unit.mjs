#!/usr/bin/env node
/**
 * t1036-clip-lens-second-face-unit — the lens's second face + the recall's
 * honest voice.
 *
 * The seat: the t1035 forget door lived ONLY inside the clip panel (the
 * row rides the panel's own `clipOn` gate), so an oblique-only session —
 * clip planes off, the ✂ cut on — had NO forget verb at all: the memory
 * was reachable only through a scene change. And the t1034 recall toast
 * spoke the clip's name ("Clip recalled") even when ONLY the 3D cut came
 * back — the honest-name arc's missed face.
 *
 * Bands:
 *   A — the voice lib's live rides: the four-branch truth table through
 *       real calls (clip+cut / clip only / cut only / the whisper null),
 *       the t1034 words verbatim on the clip-only branch, the purity pin
 *       (the voice never mutates the entry), and the storage round-trip
 *       (an entry written and re-read through the lib speaks correctly).
 *   B — the embed wiring: the import carries the voice, the recall effect
 *       speaks through the lib (one mouth — the hand-rolled words are
 *       GONE from the embed), the voice is called from exactly ONE site,
 *       and the call lives inside the recall effect (the restore's own
 *       body, never a render path).
 *   C — the second face: the oblique chip's lens row and its forget door
 *       (testids, the `lensRemembered && !clipOn` gate — absent exactly
 *       when the clip panel's own row is speaking), the ONE vocabulary at
 *       both doors (the scope words, the aria name, the handler — each
 *       counted verbatim), the row living INSIDE the oblique chip, the
 *       chip's readout row keeping its shape, and the t1035 whisper dot
 *       still standing (the both-off case's face).
 *   D — the lib's own laws: the voice's early-null whisper gate first,
 *       the three titles and their descriptions verbatim, the gate
 *       reading only the two live flags, and no localStorage in the
 *       voice's body (the bookmarks' tier stays untouched).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/* ---- the window shim (Map-backed sessionStorage) — installed BEFORE the
 *      lib import; the lib guards typeof window and hydrates lazily ---- */
const backing = new Map();
const storage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
  clear: () => backing.clear(),
};
globalThis.window = { sessionStorage: storage };

const { CLIP_LENS_KEY, clipLensKeyOf, readClipLens, writeClipLens, clipRecallVoice } = await import(
  "@/lib/clip-lens"
);

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const ENTRY = (over = {}) => ({
  on: true,
  x: 0.25,
  y: 1,
  z: 1,
  invert: false,
  box: { lo: [0.1, 0, 0], hi: [0.9, 1, 1] },
  oblique: { on: false, theta: 45, phi: 30, offset: 0, invert: false },
  ...over,
});

console.log("A — the voice lib's live rides");
{
  // the four-branch truth table
  const both = clipRecallVoice(ENTRY({ oblique: { on: true, theta: 60, phi: 90, offset: 0.1, invert: false } }));
  ok(both !== null && both.title === "Clip recalled", "clip + cut live → the clip's name (the family's elder speaks)");
  ok(both !== null && both.description === "The clip planes and the 3D cut you shaped earlier in this tab are back.", "the both-branch description names BOTH families");

  const clipOnly = clipRecallVoice(ENTRY());
  ok(clipOnly !== null && clipOnly.title === "Clip recalled", "clip only → 'Clip recalled' (the t1034 name stands)");
  ok(clipOnly !== null && clipOnly.description === "The cross-section you shaped earlier in this tab is back.", "the clip-only description is the t1034 words VERBATIM (the one-mouth law at the voice seat)");

  const cutOnly = clipRecallVoice(ENTRY({ on: false, oblique: { on: true, theta: 30, phi: 0, offset: 0, invert: true } }));
  ok(cutOnly !== null && cutOnly.title === "3D cut recalled", "cut only → the cut's OWN name (the honest-name arc's missed face, cured)");
  ok(cutOnly !== null && cutOnly.description === "The 3D cut you left on this map earlier in this tab is back.", "the cut-only description speaks the cut's own words");

  const whisper = clipRecallVoice(ENTRY({ on: false, oblique: { on: false, theta: 45, phi: 30, offset: 0, invert: false } }));
  ok(whisper === null, "nothing live → null (the t1034 whisper law: geometry under an off toggle is not news)");

  // purity: the voice reads, never writes
  const probe = ENTRY({ oblique: { on: true, theta: 60, phi: 90, offset: 0.1, invert: false } });
  const frozen = JSON.parse(JSON.stringify(probe));
  clipRecallVoice(probe);
  clipRecallVoice(probe);
  ok(eq(probe, frozen), "the voice is pure — two calls, the entry byte-identical");

  // the storage round-trip: the lib's own write/read feed the voice
  writeClipLens("job-t1036", "outputs/half.mrc", ENTRY({ on: false, oblique: { on: true, theta: 77, phi: 180, offset: -0.25, invert: false } }));
  const roundTripped = readClipLens("job-t1036", "outputs/half.mrc");
  ok(roundTripped !== null, "the entry survived the shape gate both ways");
  const rtVoice = roundTripped ? clipRecallVoice(roundTripped) : null;
  ok(rtVoice !== null && rtVoice.title === "3D cut recalled", "a round-tripped oblique-only entry speaks the cut's name (the voice rides the lib's own gates)");
}

console.log("B — the embed wiring");
{
  const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
  const code = embed.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  // t1037 re-key: the import grew the cross-map offer + the carry voice —
  // the pin follows the line's new shape (the voice still rides beside the
  // fathers; the offer and the carry are its new siblings on the same line)
  ok(
    code.includes("clipCarryVoice, clipRecallVoice, crossMapLensOffer, forgetClipLens, readClipLens, writeClipLens"),
    "the import carries the voice beside the fathers (the t1037 siblings ride the same line)"
  );

  // one mouth: the hand-rolled words are GONE from the embed — they live in the lib
  ok(!code.includes("The cross-section you shaped earlier in this tab is back."), "the old hand-rolled description is retired from the embed (the words live in the lib alone)");
  ok(!code.includes('"Clip recalled"'), "the old hand-rolled title is retired from the embed");

  // the ONE call site — the recall effect
  const callSites = (code.match(/clipRecallVoice\(/g) || []).length;
  ok(callSites === 1, "the voice is called from exactly ONE site (no new mouths)");

  // the call lives inside the recall effect (the restore's own body)
  const effectBodies = [...code.matchAll(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g)].map((m) => m[0]);
  ok(effectBodies.length > 0, "the effect extraction found the effects (the pin is alive, not vacuous)");
  const recallEffect = effectBodies.find((b) => b.includes("clipRecallVoice(saved)"));
  ok(!!recallEffect, "the recall effect speaks through the lib's voice");
  ok(!!recallEffect && recallEffect.includes("readClipLens(jobId, path)"), "the same effect still reads through the lib's gate (no parallel reads)");
  ok(!!recallEffect && recallEffect.includes("if (recallVoice) {") && recallEffect.includes("toast(recallVoice)"), "the toast rides the voice's answer (the null IS the silence)");
}

console.log("C — the second face");
{
  const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
  const code = embed.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  // the row and its door, named
  ok(code.includes('data-testid="clip-lens-row-oblique"'), "the second face carries its test id");
  ok(code.includes('data-testid="clip-lens-forget-oblique"'), "the second door carries its test id");

  // the gate: present exactly when the clip panel's row is ABSENT
  const rowStart = code.indexOf('data-testid="clip-lens-row-oblique"');
  const rowGate = code.slice(Math.max(0, rowStart - 400), rowStart);
  ok(rowGate.includes("lensRemembered && !clipOn"), "the second face rides the mirror AND the closed-panel gate (never two rows in one open)");

  // one vocabulary — counted across BOTH doors: the words ride the visible
  // span AND the scope title at each seat (2 + 2), never a third mouth
  const scopeWords = (code.match(/remembered for this tab/g) || []).length;
  ok(scopeWords === 4, "the scope words ride exactly the TWO doors' spans + titles (one vocabulary, verbatim)");
  const scopeSpans = (code.match(/>remembered for this tab</g) || []).length;
  ok(scopeSpans === 2, "the visible spans speak the words at exactly the TWO doors");
  const scopeTitles = (code.match(/remembered for this tab — it comes back on the next open/g) || []).length;
  ok(scopeTitles === 2, "the scope titles speak the same truth at exactly the TWO doors");
  const ariaName = (code.match(/aria-label="Forget this map's remembered clip"/g) || []).length;
  ok(ariaName === 2, "the aria name appears at exactly the TWO doors (one verb, one name)");
  const handler = (code.match(/onClick=\{forgetRememberedClip\}/g) || []).length;
  ok(handler === 2, "both doors ride the SAME handler (one verb, two doors)");

  // the row lives INSIDE the oblique chip
  const chipStart = code.indexOf('data-testid="clip-oblique-chip"');
  const chipClose = code.indexOf("</div>\n            )}", chipStart);
  const chip = chipStart >= 0 && chipClose > chipStart ? code.slice(chipStart, chipClose) : "";
  ok(chip.includes('data-testid="clip-lens-row-oblique"'), "the second face lives inside the oblique chip (the ✂'s own panel, not a foreign surface)");
  ok(chip.includes('data-testid="clip-oblique-readout"'), "the readout row keeps its seat inside the chip");

  // the chip is a column now; the readout row keeps its shape (the className
  // sits after the testid in attribute order — the window reaches it)
  const chipTag = code.slice(chipStart, chipStart + 260);
  ok(chipTag.includes("space-y-1.5"), "the chip's container is the column (the face rides beneath, the geometry law's own spacing)");
  const innerRow = chip.slice(chip.indexOf('className="flex items-center gap-1.5"'));
  ok(innerRow.includes("clip-oblique-readout"), "the readout row keeps its flex shape inside the column");

  // the t1035 faces still stand
  ok(code.includes('data-testid="clip-lens-row"'), "the clip panel's row still stands (the first door untouched)");
  ok(code.includes('data-testid="clip-lens-whisper-dot"'), "the whisper dot still stands (the both-off case's face)");
  const dotStart = code.indexOf('data-testid="clip-lens-whisper-dot"');
  const dotGate = code.slice(Math.max(0, dotStart - 300), dotStart);
  ok(dotGate.includes("lensRemembered && !clipOn"), "the dot's gate is unchanged (the closed panel's whisper)");
}

console.log("D — the lib's own laws");
{
  const lib = readFileSync(path.join(ROOT, "src/lib/clip-lens.ts"), "utf8");
  const code = lib.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  const voiceStart = code.indexOf("export function clipRecallVoice");
  const voiceBody = voiceStart >= 0 ? code.slice(voiceStart, code.indexOf("\n}", voiceStart) + 2) : "";
  ok(voiceBody.length > 200, "the voice body extraction is alive (bounded at the top-level close)");

  // the whisper gate comes FIRST
  const nullReturn = voiceBody.indexOf("return null;");
  const firstTitle = voiceBody.indexOf("Clip recalled");
  ok(nullReturn >= 0 && firstTitle > nullReturn, "the whisper null returns before ANY voice is minted (silence is the first branch)");

  // the truth table's names, verbatim
  const clipTitle = (voiceBody.match(/title: "Clip recalled"/g) || []).length;
  ok(clipTitle === 2, "the clip's name minted at exactly the two clip branches (both, clip-only)");
  ok(voiceBody.includes('title: "3D cut recalled"'), "the cut's own name minted once");
  ok(voiceBody.includes("The clip planes and the 3D cut you shaped earlier in this tab are back."), "the both-branch description verbatim");
  ok(voiceBody.includes("The cross-section you shaped earlier in this tab is back."), "the clip-only description verbatim (the t1034 words)");
  ok(voiceBody.includes("The 3D cut you left on this map earlier in this tab is back."), "the cut-only description verbatim");

  // the gate reads only the two live flags
  ok(voiceBody.includes("saved.on === true") && voiceBody.includes("saved.oblique.on === true"), "the gate reads the two live flags (the strict-truth reads, nothing else)");

  // the tier law
  ok(!voiceBody.includes("localStorage"), "the voice never touches localStorage (the bookmarks' tier — the comment-stripped pin)");
}

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
