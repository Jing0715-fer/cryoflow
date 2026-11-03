#!/usr/bin/env node
/**
 * t1034-clip-lens-unit — the session lens's proofs.
 *
 * The seat: the 3D clip's work used to die with the dialog (MolViewer
 * remounts the embed on every open); the lens remembers the clip state
 * the user LEFT the viewer in, per map, for the tab's life — the missing
 * middle tier between the ephemeral state and the explicit bookmarks.
 *
 * Bands:
 *   A — the shape gate (saneClipLens): the entry is clamped where the
 *       clamp is honest (fractions through the t905 law's own mouth, the
 *       oblique dials to their ranges, a crossed box pair sorted) and
 *       refused where it is not (missing fields, wrong types, malformed
 *       box arrays) — the return IS the gate, null drops, never trusts.
 *   B — the storage lifecycle: the corrupt hydrate drops everything
 *       without throwing, the write debounces (the disk sees ONE write
 *       per gesture, never the drag frames), the readback is the write's
 *       own shape, the identity is the MAP (jobId|path — two maps of one
 *       job never dress each other), the overwrite wins, and an unsane
 *       write never enters.
 *   C — the embed wiring pins: the lib import, the ONE write father
 *       called from BOTH intent appliers (event-handler paths — the #13
 *       law), the lens effect's gate/standdown/one-shot, the restore
 *       through the bookmark path's own intents, the honest toast gate.
 *   D — the lib's own laws: sessionStorage ONLY (localStorage is the
 *       bookmarks' tier), the 400 ms trailing figure, rev never travels.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/* ---- the window shim (Map-backed sessionStorage) — installed BEFORE the
 *      lib import; the lib guards typeof window and hydrates lazily, so
 *      the pre-seeded corrupt record is what the FIRST read sees ---- */
const backing = new Map();
const storage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
  clear: () => backing.clear(),
};
globalThis.window = { sessionStorage: storage };

/* pre-seed CORRUPT JSON — the first hydrate must drop it, not throw */
backing.set("cryoflow.clipLens.v1", "{broken json");

const { CLIP_LENS_KEY, CLIP_LENS_PERSIST_MS, clipLensKeyOf, saneClipLens, readClipLens, writeClipLens } = await import(
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

const GOOD = {
  on: true,
  x: 0.25,
  y: 1,
  z: 1,
  invert: false,
  box: { lo: [0.1, 0, 0], hi: [0.9, 1, 1] },
  oblique: { on: false, theta: 45, phi: 30, offset: 0, invert: false },
};

console.log("A — the shape gate");
{
  const s = saneClipLens(GOOD);
  ok(!!s, "a well-formed entry passes");
  ok(s.on === true && s.invert === false, "the booleans travel verbatim");
  ok(eq(s.box.lo, [0.1, 0, 0]) && eq(s.box.hi, [0.9, 1, 1]), "the box arms travel verbatim");
  ok(s.oblique.theta === 45 && s.oblique.phi === 30, "the oblique dials travel verbatim");

  const clamped = saneClipLens({ ...GOOD, x: 1.5, y: -0.2, z: 2 });
  ok(clamped.x === 1 && clamped.y === 0 && clamped.z === 1, "fractions clamp to [0,1]");

  const crossed = saneClipLens({ ...GOOD, box: { lo: [0.8, 0, 0], hi: [0.2, 1, 1] } });
  ok(crossed.box.lo[0] === 0.2 && crossed.box.hi[0] === 0.8, "a crossed box pair sorts (the kept region never lies)");

  const dial = saneClipLens({
    ...GOOD,
    oblique: { on: true, theta: 200, phi: -5, offset: 2, invert: false },
  });
  ok(dial.oblique.theta === 180 && dial.oblique.phi === 0 && dial.oblique.offset === 1, "the oblique dials clamp (theta 0–180, phi 0–360, offset −1…1)");

  const scalar = saneClipLens({ ...GOOD, box: null, x: 0.4, invert: true });
  ok(scalar.box === null && scalar.x === 0.4 && scalar.invert === true, "the scalar language (box null) is a valid shape, remembered as-is");

  ok(saneClipLens(null) === null, "null refuses");
  ok(saneClipLens("clip") === null, "a string refuses");
  ok(saneClipLens({}) === null, "an empty object refuses");
  ok(saneClipLens({ ...GOOD, on: 1 }) === null, "a numeric on refuses");
  ok(saneClipLens({ ...GOOD, x: "0.5" }) === null, "a string fraction refuses");
  ok(saneClipLens({ ...GOOD, x: Number.NaN }) === null, "a non-finite fraction refuses");
  ok(saneClipLens({ ...GOOD, box: {} }) === null, "a box without arms refuses");
  ok(saneClipLens({ ...GOOD, box: { lo: [0.1, 0], hi: [0.9, 1, 1] } }) === null, "a short lo arm refuses");
  ok(saneClipLens({ ...GOOD, box: { lo: [0.1, 0, 0], hi: [0.9, 1, "1"] } }) === null, "a string arm cell refuses");
  ok(saneClipLens({ ...GOOD, oblique: null }) === null, "a null oblique refuses");
  ok(saneClipLens({ ...GOOD, oblique: { on: true, theta: 45 } }) === null, "a partial oblique refuses");
  ok(saneClipLens({ ...GOOD, oblique: { ...GOOD.oblique, invert: 0 } }) === null, "a numeric oblique invert refuses");
}

console.log("B — the storage lifecycle");
{
  ok(readClipLens("job-a", "outputs/map.mrc") === null, "the corrupt hydrate drops everything — no throw, no trust");

  ok(CLIP_LENS_KEY === "cryoflow.clipLens.v1", "the key is the lens's own v1 name");
  ok(CLIP_LENS_PERSIST_MS === 400, "the debounce is the viewport memory's own figure (400 ms)");

  // an unsane write never enters
  writeClipLens("job-a", "outputs/map.mrc", { ...GOOD, on: "yes" });
  ok(backing.get(CLIP_LENS_KEY) === "{broken json", "the unsane write left the disk untouched (the corrupt seed stands — no flush scheduled)");

  // a good write: nothing on the disk YET (the debounce holds it in RAM)
  writeClipLens("job-a", "outputs/map.mrc", GOOD);
  ok(readClipLens("job-a", "outputs/map.mrc")?.on === true, "the readback answers through RAM immediately");
  ok(backing.get(CLIP_LENS_KEY) === "{broken json", "the disk is still the seed inside the debounce window (one write per gesture, never the drag frames)");

  // a second write inside the window re-schedules — still one flush
  writeClipLens("job-a", "outputs/map.mrc", { ...GOOD, x: 0.5 });
  await new Promise((r) => setTimeout(r, 480));
  const raw = backing.get(CLIP_LENS_KEY);
  ok(typeof raw === "string", "the debounce flushed ONE write after the window");
  const stored = JSON.parse(raw);
  ok(stored[clipLensKeyOf("job-a", "outputs/map.mrc")].x === 0.5, "the trailing state won (the last gesture, not the first)");

  // the identity is the MAP: two maps of one job never dress each other
  writeClipLens("job-a", "outputs/halfmap.mrc", { ...GOOD, x: 0.75 });
  ok(readClipLens("job-a", "outputs/map.mrc").x === 0.5, "map A keeps its own fractions");
  ok(readClipLens("job-a", "outputs/halfmap.mrc").x === 0.75, "map B keeps its own fractions");
  ok(readClipLens("job-b", "outputs/map.mrc") === null, "another job's same-named map reads empty");

  // the overwrite wins
  writeClipLens("job-a", "outputs/map.mrc", { ...GOOD, on: false, x: 0.1 });
  ok(readClipLens("job-a", "outputs/map.mrc").on === false, "the overwrite wins — the lens mirrors what the user LAST left on screen");

  // the flushed payload is shape-honest — the disk never holds an unsane entry
  const diskEntry = JSON.parse(backing.get(CLIP_LENS_KEY))[clipLensKeyOf("job-a", "outputs/map.mrc")];
  ok(saneClipLens(diskEntry) !== null, "the flushed payload passes the same gate the read trusts");
}

console.log("C — the embed wiring");
{
  const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");

  ok(embed.includes('from "@/lib/clip-lens"'), "the embed imports the ONE father");

  const defCount = (embed.match(/const noteClipLens = \(\)/g) || []).length;
  const callCount = (embed.match(/noteClipLens\(\);/g) || []).length;
  ok(defCount === 1 && callCount === 2, "ONE write father, called from BOTH intent appliers (the shape never re-typed)");

  ok(
    embed.indexOf("const noteClipLens") > embed.indexOf("const applyClipIntent") &&
      embed.indexOf("const noteClipLens") < embed.indexOf("const applyObliqueClipIntent"),
    "the father sits between the appliers (the clip state and the oblique ref both in scope)",
  );

  // the #13 law: the write rides the appliers, never an effect — extract the
  // lens effect's body and assert it READS but never WRITES. The start is
  // the LAST t1034 marker: the import line's own comment speaks the same
  // words, and the effect lives far below it.
  const effectStart = embed.lastIndexOf("// t1034 — the session lens:");
  const effectEnd = embed.indexOf("}, [phase, jobId, path, initialClipBox]);", effectStart);
  const lensEffect = effectStart >= 0 && effectEnd > effectStart ? embed.slice(effectStart, effectEnd) : "";
  ok(lensEffect.includes("readClipLens(jobId, path)"), "the lens effect reads through the father");
  ok(!lensEffect.includes("writeClipLens"), "the lens effect never writes (the #13 law — storage writes never render)");
  ok(lensEffect.includes('phase !== "ready"'), "the restore gates on the phase being ready (the intents pump a live repr)");
  ok(lensEffect.includes("lensDone.current") && lensEffect.includes("initialClipBox"), "one-shot per mount; the subvolume handoff stands the lens down");

  const applyBody = embed.slice(embed.indexOf("const applyClipIntent"), embed.indexOf("/** t260 — anchor the clip on a GENERAL box"));
  ok(applyBody.includes("noteClipLens();"), "applyClipIntent notes the lens (the slider/toggle/keyboard verbs all ride it)");
  const obliqueBody = embed.slice(embed.indexOf("const applyObliqueClipIntent"), embed.indexOf("/* ---------------- sub-volume export"));
  ok(obliqueBody.includes("noteClipLens();"), "applyObliqueClipIntent notes the lens (the ✂ block's verbs ride it)");

  ok(lensEffect.includes("applyClipIntent({"), "the restore speaks the bookmark path's own clip intent");
  ok(lensEffect.includes("applyObliqueClipIntent({ ...saved.oblique })"), "the restore speaks the bookmark path's own oblique intent");
  ok(lensEffect.includes("lo: [...saved.box.lo]"), "the restore hands the intent its OWN arrays (no shared reference with the lens RAM)");
  // t1036 re-key: the recall's words moved to the lib's honest voice — the
  // pins follow the one mouth (the hand-rolled gate and title are retired
  // from the embed; the null IS the off-memory whisper)
  ok(lensEffect.includes("clipRecallVoice(saved)"), "the recall speaks through the lib's honest voice (t1036 — one mouth for the words)");
  ok(lensEffect.includes("if (recallVoice) {") && lensEffect.includes("toast(recallVoice)"), "the toast rides the voice's answer — a live cut or clip announces, an off memory whispers");
}

console.log("D — the lib's own laws");
{
  const lib = readFileSync(path.join(ROOT, "src/lib/clip-lens.ts"), "utf8");
  // the no-usage pins speak of CODE, not of the docblock that NAMES the law
  // — strip comments first, so a comment that says "never localStorage"
  // never counts as a use
  const code = lib.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  ok(lib.includes('from "@/lib/clip-interval"'), "the [0,1] clamp rides the t905 law's own mouth (normalizeInterval imported)");
  ok(!code.includes("Math.min(1, Math.max(0"), "no hand-copied fraction clamp — one clamp law, one father");
  ok(!code.includes("localStorage"), "sessionStorage ONLY — localStorage is the bookmarks' tier");
  ok(lib.includes("window.sessionStorage"), "the storage is the session's own (the viewport memory doctrine)");
  ok(!/\brev\b/.test(code), "rev never travels (a local change counter, not a memory)");
  ok(lib.includes("saneClipLens(v)"), "the hydrate gate is the same father the read trusts");
}

console.log("E — the quick-look's 3D door (the t289 graduation gap)");
{
  const rv = readFileSync(path.join(ROOT, "src/components/workflow/results/results-view.tsx"), "utf8");

  // the gap: the remote tile speaks the door, the local tile never did
  ok(rv.includes("remote-view-3d") && rv.includes('onClick={() => onView3D(file)}'), "the remote tile keeps its own 3D door (t289's word)");
  ok(rv.includes("quick-look-view-3d"), "the quick-look carries the local map's 3D door");

  // the door rides the quick-look's header row, beside the title
  const doorStart = rv.indexOf("quick-look-view-3d");
  const titleRow = rv.lastIndexOf("<DialogTitle", doorStart);
  const header = rv.slice(titleRow, doorStart + 400);
  ok(header.includes("ml-auto"), "the door takes the header row's right edge (the doors' geometry law)");
  ok(header.includes('setMolTarget({ job, path: imageFile.path, name: imageFile.label ?? imageFile.name })'), "the door speaks the shared MolViewer target — ONE vocabulary with the remote tile");

  // the aria dialect is the remote tile's own words (the t1032 bridge law)
  ok(header.includes("View ${imageFile.label ?? imageFile.name} in 3D (Mol*)"), "the door's aria-label is the remote tile's own dialect");

  // the isStack law: a movie stack is not a map
  const gate = rv.slice(rv.indexOf("!imageFile.name.toLowerCase().endsWith(\".mrcs\") && (", titleRow), doorStart);
  ok(gate.length > 0 && gate.length < 900, "the stack gate stands between the row and the door (.mrcs stays doorless)");

  // the drive-in: the door OPENS the viewer — it never closes the quick-look
  ok(!header.includes("setImageFile(null)"), "the door never closes the quick-look (the viewer stacks over, the t831 drive-in)");
}

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
