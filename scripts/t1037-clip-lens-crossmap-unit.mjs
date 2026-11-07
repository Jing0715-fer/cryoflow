#!/usr/bin/env node
/**
 * t1037-clip-lens-crossmap-unit — the lens's second reach: the cross-map
 * carry.
 *
 * The seat: the lens keyed per map, so a slab shaped on the full map was
 * invisible the moment the half-map opened — the QC pair (the same slab
 * on both maps) had to walk the explicit bookmark tier to carry the
 * geometry. The offer scans the SAME job's other keys for live entries
 * and the embed's apply verb adopts the sibling's state through the SAME
 * commit paths as every other intent, after which it is this map's own
 * remembered state.
 *
 * Bands:
 *   A — the offer lib's live rides (real calls, Map-backed sessionStorage,
 *       one accumulating record scoped per fake job): the hydrate-time
 *       drop of a corrupted sibling (pre-seeded, the first read's own
 *       gate), the same-job scoping, the own-path exclusion, the
 *       alphabetical pick, the all-off whisper's exclusion, the count's
 *       travel, the label's basename honesty (and its collision face),
 *       the pure-read pin (the disk byte-identical), the SSR guard, and
 *       the carry voice's four-branch truth table with the sibling's name
 *       riding every description.
 *   B — the embed wiring: the import carries the offer + the voice beside
 *       the fathers, the scan rides the restore effect's own else branch
 *       (the mount's site), the own-entry branch retires the offer
 *       (the explicit-beats-remembered law's own-map face), the apply
 *       handler speaks through the SAME commit paths and retires the
 *       offer, the voice is called from exactly ONE site, and t1038's
 *       honest return: the forget that empties this map's own memory
 *       re-opens the sibling's offer in the same stroke (the scan's
 *       second site, riding the user's own verb — never a render).
 *   C — the offer row: the testids, the gate (`lensOffer && !lensRemembered`
 *       — present exactly while this map holds none of its own), the row
 *       riding OUTSIDE the clip panel's gate (before the sigma slider —
 *       the verb reachable WITHOUT a scene change, the second-face law's
 *       own lesson), the vocabulary (the sibling's label, the +N more
 *       face, the count-aware titles), and the aria naming the sibling.
 *   D — the lib's own laws: the offer body never writes (setItem absent),
 *       the whisper gate before the push, the deterministic sort, the
 *       collision label's parent-segment growth, the carry voice's
 *       whisper-null first + the strict live-flag reads + the three
 *       titles verbatim, and no localStorage anywhere in the new seats.
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

const LENS_KEY = "cryoflow.clipLens.v1";
const keyOf = (job, p) => `${job}|${p}`;
const mk = (over = {}) => ({
  on: true,
  x: 0.25,
  y: 1,
  z: 1,
  invert: false,
  box: { lo: [0.1, 0, 0], hi: [0.9, 1, 1] },
  oblique: { on: false, theta: 45, phi: 30, offset: 0, invert: false },
  ...over,
});

/* pre-seed the record the FIRST hydrate sees: one valid live sibling and
 * one corrupted shape under the same fake job — the corrupt entry must be
 * dropped by the read's own gate, never trusted into an offer */
backing.set(
  LENS_KEY,
  JSON.stringify({
    [keyOf("job-gate", "refine/garbage.mrc")]: { on: "yes" },
    [keyOf("job-gate", "refine/run_class001.mrc")]: mk({ x: 0.3 }),
  })
);

const { CLIP_LENS_KEY, clipLensKeyOf, writeClipLens, crossMapLensOffer, clipCarryVoice } = await import(
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

console.log("A — the offer lib's live rides");
{
  // the hydrate gate + the scan in one ride: the corrupt sibling dropped
  const gated = crossMapLensOffer("job-gate", "outputs/main.mrc");
  ok(gated !== null && gated.path === "refine/run_class001.mrc", "the valid sibling survives the hydrate and offers");
  ok(gated !== null && gated.count === 1, "the corrupted sibling is NOT counted (dropped, not trusted — the shape gate on the way in)");
  ok(gated !== null && gated.label === "run_class001.mrc", "the label is the map's basename (the spoken name)");

  // an empty (job-scoped) record offers nothing
  ok(crossMapLensOffer("job-empty", "outputs/main.mrc") === null, "a job with no entries offers nothing");

  // the same-job scoping: another job's entry is invisible
  writeClipLens("job-other", "outputs/main.mrc", mk());
  ok(crossMapLensOffer("job-scope", "outputs/main.mrc") === null, "another job's live entry never offers (the scoping is the job)");

  // the own-path exclusion: the only entry under this job is the own map's
  writeClipLens("job-scope", "outputs/main.mrc", mk({ x: 0.4 }));
  ok(crossMapLensOffer("job-scope", "outputs/main.mrc") === null, "the ONLY entry being the own map's — no sibling, no offer (the own-path exclusion)");

  // the alphabetical pick: the alphabetically first live sibling leads
  writeClipLens("job-pick", "refine/run_class001.mrc", mk({ x: 0.3 }));
  writeClipLens("job-pick", "refine/run_half1_class001_unfil.mrc", mk({ x: 0.6 }));
  writeClipLens("job-pick", "refine/run_half2_class001_unfil.mrc", mk({ x: 0.8 }));
  const pick = crossMapLensOffer("job-pick", "outputs/main.mrc");
  ok(pick !== null && pick.path === "refine/run_class001.mrc", "the alphabetical pick — run_class001 leads its half-maps (the deterministic order)");
  ok(pick !== null && pick.count === 3, "the count says all three siblings hold memory");
  ok(pick !== null && pick.entry.x === 0.3, "the chosen entry is the pick's OWN state (not the last written)");

  // the all-off whisper never offers
  writeClipLens("job-pick", "refine/run_whisper.mrc", mk({ on: false, oblique: { on: false, theta: 45, phi: 30, offset: 0, invert: false } }));
  const noWhisper = crossMapLensOffer("job-pick", "outputs/main.mrc");
  ok(noWhisper !== null && noWhisper.count === 3, "the all-off whisper is NOT counted (an offer of nothing is a lie the t1034 law forbids)");
  ok(noWhisper !== null && noWhisper.path !== "refine/run_whisper.mrc", "the whisper never leads the pick");

  // purity: the scan writes nothing — the disk is byte-identical
  const before = backing.get(CLIP_LENS_KEY);
  crossMapLensOffer("job-pick", "outputs/main.mrc");
  crossMapLensOffer("job-pick", "outputs/main.mrc");
  ok(backing.get(CLIP_LENS_KEY) === before, "the offer is a pure read — two calls, the disk byte-identical");

  // SSR safety: no window → null (the lib's own guard, ridden live)
  const savedWindow = globalThis.window;
  delete globalThis.window;
  ok(crossMapLensOffer("job-pick", "outputs/main.mrc") === null, "no window — the offer answers null (the SSR guard rides)");
  globalThis.window = savedWindow;

  // the collision face: two basenames equal inside one offer set → the
  // parent segment joins, two maps never share one spoken name
  writeClipLens("job-collide", "importA/map.mrc", mk({ x: 0.2 }));
  writeClipLens("job-collide", "importB/map.mrc", mk({ x: 0.5 }));
  const collide = crossMapLensOffer("job-collide", "outputs/main.mrc");
  ok(collide !== null && collide.path === "importA/map.mrc", "the pick stays alphabetical (importA before importB)");
  ok(collide !== null && collide.label === "importA/map.mrc", "the colliding basenames grow the parent segment (two maps, two names)");
  ok(collide !== null && collide.count === 2, "both colliding siblings count");

  // a lone sibling speaks the bare basename (no parent segment, no noise)
  writeClipLens("job-lone", "refine/run_class001.mrc", mk({ x: 0.3 }));
  const lone = crossMapLensOffer("job-lone", "outputs/main.mrc");
  ok(lone !== null && lone.label === "run_class001.mrc", "a lone sibling speaks the bare basename again");

  // the carry voice — the four-branch truth table, the label riding every branch
  const both = clipCarryVoice("run_class001.mrc", mk({ oblique: { on: true, theta: 60, phi: 90, offset: 0.1, invert: false } }));
  ok(both !== null && both.title === "Clip carried", "clip + cut → 'Clip carried' (the carry's own verb, never the recall's blur)");
  ok(both !== null && both.description.includes("run_class001.mrc"), "the both-branch description names the sibling");
  ok(both !== null && both.description.includes("remembered for this map too"), "the both-branch says the carry becomes this map's own memory");

  const clipOnly = clipCarryVoice("run_class001.mrc", mk());
  ok(clipOnly !== null && clipOnly.title === "Clip carried", "clip only → 'Clip carried'");
  ok(clipOnly !== null && clipOnly.description.includes("The cross-section remembered for run_class001.mrc"), "the clip-only description names the source of the slab");

  const cutOnly = clipCarryVoice("run_half1.mrc", mk({ on: false, oblique: { on: true, theta: 30, phi: 0, offset: 0, invert: true } }));
  ok(cutOnly !== null && cutOnly.title === "3D cut carried", "cut only → the cut's OWN name (the family truth table at the carry's seat)");
  ok(cutOnly !== null && cutOnly.description.includes("The 3D cut remembered for run_half1.mrc"), "the cut-only description names the sibling");

  const whisper = clipCarryVoice("run_class001.mrc", mk({ on: false, oblique: { on: false, theta: 45, phi: 30, offset: 0, invert: false } }));
  ok(whisper === null, "nothing live → null (the carry never speaks a whisper)");

  // purity of the voice
  const probe = mk();
  const frozen = JSON.parse(JSON.stringify(probe));
  clipCarryVoice("x.mrc", probe);
  clipCarryVoice("x.mrc", probe);
  ok(eq(probe, frozen), "the carry voice is pure — two calls, the entry byte-identical");
}

console.log("B — the embed wiring");
{
  const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
  const code = embed.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  ok(
    code.includes("clipCarryVoice, clipRecallVoice, crossMapLensOffer, forgetClipLens, readClipLens, writeClipLens"),
    "the import carries the offer + the voice beside the fathers (one lib, one mouth each)"
  );

  // the scan rides the restore effect's own else branch
  const effectBodies = [...code.matchAll(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g)].map((m) => m[0]);
  ok(effectBodies.length > 0, "the effect extraction found the effects (the pin is alive, not vacuous)");
  const lensEffect = effectBodies.find((b) => b.includes("readClipLens(jobId, path)"));
  ok(!!lensEffect, "the restore effect is found");
  ok(!!lensEffect && lensEffect.includes("crossMapLensOffer(jobId, path)"), "the sibling scan rides the restore effect (the mount's site — t1038 grows the forget's return as the second)");
  ok(!!lensEffect && lensEffect.includes("} else {"), "the scan lives in the effect's OWN else branch (the mount's site — the second site is the forget's honest return)");
  ok(!!lensEffect && !lensEffect.includes("writeClipLens"), "the effect never writes (the #13 law holds through the else branch)");

  // the own-entry branch retires the offer (the own memory outranks)
  ok(!!lensEffect && lensEffect.includes("setLensOffer(null)"), "an own entry retires the offer (the explicit-beats-remembered law's own-map face)");

  // the offer's TWO call sites (t1038): the mount's else + the forget's
  // honest return — the reads ride the mount and the user's own verb
  const offerSites = (code.match(/crossMapLensOffer\(/g) || []).length;
  ok(offerSites === 2, "the offer is called from exactly TWO sites (the mount's else + the forget's honest return)");

  // the apply handler: the SAME commit paths, the voice, the retirement
  const handlerStart = code.indexOf("const applySiblingClip = () =>");
  const handlerEnd = code.indexOf("};", handlerStart);
  const handler = handlerStart >= 0 && handlerEnd > handlerStart ? code.slice(handlerStart, handlerEnd) : "";
  ok(handler.length > 100, "the apply handler extraction is alive");
  ok(handler.includes("applyClipIntent({"), "the carry speaks the bookmark path's own clip intent (the one-grammar law)");
  ok(handler.includes("applyObliqueClipIntent({ ...entry.oblique })"), "the carry speaks the bookmark path's own oblique intent");
  ok(handler.includes("clipCarryVoice(lensOffer.label, entry)"), "the toast speaks through the lib's carry voice (the words live in the lib)");
  ok(handler.includes("if (carryVoice) {") && handler.includes("toast(carryVoice)"), "the toast rides the voice's answer");
  ok(handler.includes("setLensOffer(null)"), "the carry retires the offer (the geometry is this map's own now)");
  ok(!handler.includes("writeClipLens") && !handler.includes("sessionStorage"), "the handler never touches storage directly (the appliers' own re-record is the write)");

  // the voice's ONE call site
  const voiceSites = (code.match(/clipCarryVoice\(/g) || []).length;
  ok(voiceSites === 1, "the carry voice is called from exactly ONE site (the handler)");

  // t1038 — the honest return: the forget that drops the own entry re-opens
  // the sibling's offer in the same stroke (the row's return rides the
  // user's own act, never a render; a forget of nothing changes nothing)
  const forgetStart = code.indexOf("const forgetRememberedClip = () =>");
  const forgetEnd = code.indexOf("};", forgetStart);
  const forgetBody = forgetStart >= 0 && forgetEnd > forgetStart ? code.slice(forgetStart, forgetEnd) : "";
  ok(forgetBody.length > 100, "the forget handler extraction is alive");
  ok(forgetBody.includes("setLensOffer(crossMapLensOffer(jobId, path))"), "the drop that emptied this map's memory re-opens the sibling's offer (the honest return)");
  const hadGate = forgetBody.indexOf("if (had) {");
  const returnScan = forgetBody.indexOf("setLensOffer(crossMapLensOffer");
  ok(hadGate >= 0 && returnScan > hadGate, "the return rides INSIDE the if-had gate (a forget of nothing offers nothing new)");
  ok(!forgetBody.includes("writeClipLens") && !forgetBody.includes("sessionStorage"), "the forget never touches storage directly (the lib drops, the scan only reads)");
}

console.log("C — the offer row");
{
  const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
  const code = embed.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  ok(code.includes('data-testid="clip-lens-offer"'), "the offer row carries its test id");
  ok(code.includes('data-testid="clip-lens-offer-apply"'), "the apply door carries its test id");

  // the gate: present exactly while this map holds none of its own
  const rowStart = code.indexOf('data-testid="clip-lens-offer"');
  const rowGate = code.slice(Math.max(0, rowStart - 400), rowStart);
  ok(rowGate.includes("lensOffer && !lensRemembered"), "the offer rides the no-own-memory gate (an own entry — even a whisper — outranks the sibling)");
  ok(!rowGate.includes("clipOn"), "the gate is NOT the clip panel's gate (the verb reachable WITHOUT a scene change)");

  // the row rides OUTSIDE the clip panel — before the sigma slider, in the
  // always-visible contour card (the second-face law's own lesson)
  const sigmaStart = code.indexOf('aria-label="Isosurface contour level in sigma"');
  ok(rowStart >= 0 && sigmaStart > rowStart, "the offer sits before the sigma slider (outside the clipOn/sliceOn/oblique gates)");
  const clipPanelStart = code.indexOf("{clipOn && (", rowStart);
  ok(clipPanelStart < 0 || clipPanelStart > sigmaStart, "the offer is not swallowed by the clip panel's gate");

  // the vocabulary: the sibling's label, the count's face, the aria's name
  ok(code.includes("{lensOffer.label} remembers a clip"), "the row names the sibling's memory in the lens's own words");
  ok(code.includes("lensOffer.count > 1 ? ` (+${lensOffer.count - 1} more)`"), "the +N more face rides the count (honest about siblings beyond the pick)");
  ok(code.includes("aria-label={`Apply the clip remembered for ${lensOffer.label} to this map`}"), "the apply door's aria names the sibling (the whole name, the template's own honesty)");
  ok(code.includes("onClick={applySiblingClip}"), "the apply door rides the handler");

  // the count-aware titles
  ok(code.includes("maps in this job remember clip state this tab"), "the multi-sibling title speaks the count's truth");
  ok(code.includes("A sibling map in this job remembers its clip for this tab"), "the single-sibling title speaks the tab's scope (the sessionStorage's own truth)");

  // the t1035/t1036 faces still stand
  ok(code.includes('data-testid="clip-lens-row"'), "the clip panel's row still stands (the first door untouched)");
  ok(code.includes('data-testid="clip-lens-row-oblique"'), "the oblique chip's second face still stands");
  ok(code.includes('data-testid="clip-lens-whisper-dot"'), "the whisper dot still stands");
}

console.log("D — the lib's own laws");
{
  const lib = readFileSync(path.join(ROOT, "src/lib/clip-lens.ts"), "utf8");
  const code = lib.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  // the offer body: pure read — no setItem, no writes
  const offerStart = code.indexOf("export function crossMapLensOffer");
  const offerBody = offerStart >= 0 ? code.slice(offerStart, code.indexOf("\n}", offerStart) + 2) : "";
  ok(offerBody.length > 200, "the offer body extraction is alive");
  ok(!offerBody.includes("setItem"), "the offer body never writes (the pure-read pin — the scan is the mouth, not a mutation)");
  ok(!offerBody.includes("localStorage"), "the offer never touches localStorage (the bookmarks' tier)");

  // the whisper gate before the push
  const voiceGate = offerBody.indexOf("clipRecallVoice(entry) === null");
  const push = offerBody.indexOf("live.push(");
  ok(voiceGate >= 0 && push > voiceGate, "the all-off whisper is refused BEFORE the push (the silence is the first branch)");

  // the deterministic sort + the collision label
  ok(offerBody.includes("live.sort("), "the pick is the deterministic sort (the stable order, greppable on every call)");
  ok(offerBody.includes("segs[segs.length - 2]"), "the collision label grows the parent segment (two maps, two names)");

  // the carry voice's laws
  const carryStart = code.indexOf("export function clipCarryVoice");
  const carryBody = carryStart >= 0 ? code.slice(carryStart, code.indexOf("\n}", carryStart) + 2) : "";
  ok(carryBody.length > 200, "the carry body extraction is alive");

  const nullReturn = carryBody.indexOf("return null;");
  const firstTitle = carryBody.indexOf("Clip carried");
  ok(nullReturn >= 0 && firstTitle > nullReturn, "the whisper null returns before ANY carry voice is minted");

  const clipTitle = (carryBody.match(/title: "Clip carried"/g) || []).length;
  ok(clipTitle === 2, "the carry's name minted at exactly the two clip branches (both, clip-only)");
  ok(carryBody.includes('title: "3D cut carried"'), "the cut's own carry name minted once");
  ok(carryBody.includes("entry.on === true") && carryBody.includes("entry.oblique.on === true"), "the gate reads the two live flags (the strict-truth reads, nothing else)");
  ok(!carryBody.includes("localStorage"), "the carry voice never touches localStorage");
}

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
