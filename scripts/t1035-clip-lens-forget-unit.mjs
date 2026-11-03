#!/usr/bin/env node
/**
 * t1035-clip-lens-forget-unit — the lens's explicit door.
 *
 * The seat: t1034's lens remembers automatically (that is its whole
 * point), so it owed the user an equally explicit way OUT — one verb
 * that drops the map's remembered clip. The forget speaks to the
 * MEMORY, never the scene: the clip on screen stays as it is, the next
 * intent re-records (the memory restarts), and the panel's lens chip is
 * the face that makes the silent tier visible (and forgettable) while
 * it holds.
 *
 * Bands:
 *   A — the lib's forget mechanics: the drop lands (the read answers
 *       null), the flush is IMMEDIATE (an explicit user act never waits
 *       on the 400 ms debounce — a forget that rode behind a reload
 *       would never land), the pending trailing flush is RETIRED (the
 *       debounce never re-writes what the forget just dropped), the `had`
 *       answer is honest (true only when an entry existed — the caller's
 *       toast gate), other maps' entries survive untouched, and a fresh
 *       write after the forget restarts the memory.
 *   B — the embed wiring: the lib import grows the forget, the ONE write
 *       father (noteClipLens) raises the chip's mirror from every intent
 *       path (the restore rides the same appliers), the forget handler
 *       drops through the lib + lowers the mirror + gates its toast on
 *       the lib's `had` answer, and the #13 law holds — the forget is an
 *       event-handler verb, never an effect body.
 *   C — the honest faces: the chip row (the silent tier's name —
 *       "remembered for this tab" — and its Forget door), the whisper
 *       dot on the Clip toggle (the memory under a closed panel is a
 *       face, never a speech), and the forget's title that says the
 *       scene-stays truth.
 *   D — the lib's own laws: the forget flushes through sessionStorage
 *       ONLY (localStorage is the bookmarks' tier — the comment-stripped
 *       no-usage pin), and the `had` return exists as the honest-silence
 *       gate.
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

const { CLIP_LENS_KEY, clipLensKeyOf, saneClipLens, readClipLens, writeClipLens, forgetClipLens } = await import(
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
const MAP_A = ["job-a", "outputs/map.mrc"];
const MAP_B = ["job-a", "outputs/halfmap.mrc"];

console.log("A — the forget's mechanics");
{
  // the empty lens forgets nothing — and says so
  const hadEmpty = forgetClipLens(...MAP_A);
  ok(hadEmpty === false, "a forget of nothing answers false (the honest-silence gate)");
  ok(!backing.has(CLIP_LENS_KEY), "the empty lens never minted a record to say so");

  // a real entry drops — and the disk hears it NOW
  writeClipLens(...MAP_A, GOOD);
  ok(readClipLens(...MAP_A)?.on === true, "the entry is remembered before the forget");
  ok(!backing.has(CLIP_LENS_KEY), "the debounce holds the write in RAM (the disk waits)");

  const had = forgetClipLens(...MAP_A);
  ok(had === true, "the forget of a real entry answers true");
  ok(readClipLens(...MAP_A) === null, "the read answers null after the drop");
  const flushed = backing.has(CLIP_LENS_KEY) ? JSON.parse(backing.get(CLIP_LENS_KEY)) : {};
  ok(!(clipLensKeyOf(...MAP_A) in flushed), "the post-drop record flushed IMMEDIATELY (no debounce wait — a forget never rides behind a reload)");

  // the retired flush: a write inside the debounce window scheduled a
  // flush of the PRE-drop state; the forget retires that timer — after
  // the window passes, the disk must STILL hold the post-drop record
  writeClipLens(...MAP_A, GOOD);
  const hadAgain = forgetClipLens(...MAP_A);
  ok(hadAgain === true, "the re-recorded entry forgets again (the memory restarts honestly)");
  await new Promise((r) => setTimeout(r, 480));
  const afterWindow = JSON.parse(backing.get(CLIP_LENS_KEY));
  ok(!(clipLensKeyOf(...MAP_A) in afterWindow), "the retired trailing flush never fired — the drop stands after the debounce window");

  // the neighbours survive
  writeClipLens(...MAP_A, { ...GOOD, x: 0.5 });
  writeClipLens(...MAP_B, { ...GOOD, x: 0.75 });
  forgetClipLens(...MAP_A);
  ok(readClipLens(...MAP_A) === null, "map A's entry is gone");
  ok(readClipLens(...MAP_B)?.x === 0.75, "map B keeps its own memory (the identity is the map — one forget drops ONE entry)");

  // the disk record after a neighbourly forget carries exactly the survivor
  const diskNow = JSON.parse(backing.get(CLIP_LENS_KEY));
  ok(eq(Object.keys(diskNow), [clipLensKeyOf(...MAP_B)]), "the flushed record carries exactly the survivor (no tombstones, no ghosts)");

  // an unknown map forgets nothing and leaves the disk byte-stable
  const before = backing.get(CLIP_LENS_KEY);
  const hadGhost = forgetClipLens("job-z", "outputs/never-seen.mrc");
  ok(hadGhost === false, "an unknown map answers false");
  ok(backing.get(CLIP_LENS_KEY) === before, "the disk is byte-identical after a forget of nothing");

  // the dropped payload was shape-honest before it left — the flush path
  // is the same gate the read trusts (the survivor re-passes it)
  ok(saneClipLens(diskNow[clipLensKeyOf(...MAP_B)]) !== null, "the survivor re-passes the shape gate (the flush path never writes what the read would drop)");
}

console.log("B — the embed wiring");
{
  const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");

  ok(embed.includes("forgetClipLens, readClipLens, writeClipLens"), "the import carries the forget beside the fathers");

  // the mirror state — one React face for the lens's presence
  ok(embed.includes("const [lensRemembered, setLensRemembered] = useState(false)"), "the chip's mirror is declared state (never a render-time storage read)");

  // the ONE father raises the mirror — every intent path teaches the chip
  const fatherStart = embed.indexOf("const noteClipLens = () =>");
  const fatherEnd = embed.indexOf("};", fatherStart);
  const father = fatherStart >= 0 && fatherEnd > fatherStart ? embed.slice(fatherStart, fatherEnd) : "";
  ok(father.includes("writeClipLens(jobId, path, {") && father.includes("setLensRemembered(true)"), "the write father raises the mirror in the same stroke (every intent path teaches the chip)");
  const fatherCalls = (embed.match(/noteClipLens\(\);/g) || []).length;
  ok(fatherCalls === 2, "the father stays called from exactly the TWO appliers (the chip rides the existing paths, no new teachers)");

  // the forget handler — the explicit door, wired through the lib
  const forgetStart = embed.indexOf("const forgetRememberedClip = () =>");
  const forgetEnd = embed.indexOf("};", forgetStart);
  const forgetBody = forgetStart >= 0 && forgetEnd > forgetStart ? embed.slice(forgetStart, forgetEnd) : "";
  ok(forgetBody.includes("forgetClipLens(jobId, path)"), "the handler drops through the lib (no hand-rolled storage surgery in the component)");
  ok(forgetBody.includes("setLensRemembered(false)"), "the handler lowers the mirror");
  ok(forgetBody.includes("if (had) {"), "the toast gate reads the lib's `had` answer (a forget of nothing is a whisper, not news)");
  ok(forgetBody.includes('"Clip forgotten"'), "the forget speaks its name (the recall's twin)");

  // the #13 law: the forget is an event-handler verb, never an effect body.
  // Extract every effect body from the comment-stripped source and assert
  // none of them holds the verb.
  const code = embed.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const effectBodies = [...code.matchAll(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g)].map((m) => m[0]);
  ok(effectBodies.length > 0, "the effect extraction found the effects (the pin is alive, not vacuous)");
  ok(effectBodies.every((b) => !b.includes("forgetClipLens(")), "no effect body holds the forget (the #13 law — the explicit door is a click, never a render)");
}

console.log("C — the honest faces");
{
  const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");

  // the chip row lives in the clip panel, named and gated
  ok(embed.includes('data-testid="clip-lens-row"'), "the chip row carries its test id");
  ok(embed.includes('data-testid="clip-lens-forget"'), "the forget door carries its test id");
  const chipStart = embed.indexOf('data-testid="clip-lens-row"');
  const chipEnd = embed.indexOf("clipStateRef.current.box ?", chipStart);
  const chip = chipStart >= 0 && chipEnd > chipStart ? embed.slice(chipStart, chipEnd) : "";
  ok(chip.includes("lensRemembered &&") || embed.slice(Math.max(0, chipStart - 600), chipStart).includes("lensRemembered &&"), "the chip renders under the mirror (present only while the memory holds)");
  ok(chip.includes("remembered for this tab"), "the chip names the memory's scope — the TAB, not forever (sessionStorage's own truth)");
  ok(chip.includes("History"), "the chip speaks the memory icon");
  ok(chip.includes("onClick={forgetRememberedClip}"), "the forget door rides the handler");
  ok(chip.includes('aria-label="Forget this map\'s remembered clip"'), "the door's aria speaks its whole name");

  // the forget's title says the scene-stays truth
  ok(chip.includes("the clip on screen stays as it is"), "the forget's title says the scene-stays truth (memory, never scene)");

  // the whisper dot — the closed panel's face
  const dotStart = embed.indexOf('data-testid="clip-lens-whisper-dot"');
  ok(dotStart > 0, "the whisper dot carries its test id");
  const dotGate = embed.slice(Math.max(0, dotStart - 300), dotStart);
  ok(dotGate.includes("lensRemembered && !clipOn"), "the dot shows only while the panel is closed (the chip is the open panel's face, the dot the closed one's)");
  const dotSpan = embed.slice(embed.lastIndexOf("<span", dotStart), embed.indexOf("/>", dotStart));
  ok(dotSpan.includes('aria-hidden="true"'), "the dot is decorative (aria-hidden — the chip is the speaking door)");
}

console.log("D — the lib's own laws");
{
  const lib = readFileSync(path.join(ROOT, "src/lib/clip-lens.ts"), "utf8");
  // the no-usage pins speak of CODE, not of the docblock that NAMES the
  // law — strip comments first (the t1034 unit's own dialect)
  const code = lib.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  const forgetStart = code.indexOf("export function forgetClipLens");
  const forgetBody = forgetStart >= 0 ? code.slice(forgetStart, code.indexOf("\n}", forgetStart) + 2) : "";
  ok(forgetBody.length > 200 && forgetBody.includes("return true"), "the forget body extraction is alive (bounded at the top-level close)");
  ok(forgetBody.includes('if (!(key in rec)) return false'), "the forget of nothing returns before ANY write (no drop, no write — the whisper)");
  ok(forgetBody.includes("window.sessionStorage.setItem"), "the forget flushes through sessionStorage (the lens's own tier)");
  ok(!forgetBody.includes("localStorage"), "the forget never touches localStorage (the bookmarks' tier — the comment-stripped pin)");
  ok(forgetBody.includes("return true"), "the drop answers true — the caller's honest-silence gate is the lib's own answer");
  ok(forgetBody.includes("clearTimeout(flushTimer)"), "the forget retires the pending trailing flush (the debounce never re-writes the drop)");
}

console.log("E — the residue law at the fuel gate (the window's own QA-infrastructure catch)");
{
  // The live ride this window caught a REAL stall: a t1021 twin whose
  // cleanup died stands in the world forever — the as-found gate refuses
  // a non-22 world and nobody else deletes the mint name. The cure: the
  // gate recognizes its OWN residue (the mint name is the fingerprint),
  // sweeps it with patience, and only then judges.
  const fuel = readFileSync(path.join(ROOT, "scripts/t1021-import-fuel-unit.mjs"), "utf8");

  // the as-found gate's residue sweep
  const gateStart = fuel.indexOf("the world gate (as-found)");
  const gateSlice = fuel.slice(gateStart, fuel.indexOf("world: 22 jobs as-found", gateStart));
  ok(gateSlice.includes('j.name === "Import Fuel Gate Ride"'), "the as-found gate recognizes the unit's OWN residue by mint name");
  ok(gateSlice.includes("continue; // the world re-read after the sweep"), "the gate re-reads after the sweep (one silent round is never the final word — the t1025 patience law)");
  ok(gateSlice.includes("the world never settled at 22"), "the exhausted gate's FATAL is honest (last seen + sweeps attempted, never a fake 200 story)");
  ok(gateSlice.includes("A foreign extra never passes"), "the sweep's scope is named — the unit's own name and nothing else");

  // the sweep's name fallback (the twin-null path: the mint's response
  // was lost before `twin` was read — no id to delete, the name is the broom)
  const sweepStart = fuel.indexOf("sweep — the ride's own residue");
  const sweepSlice = fuel.slice(sweepStart, fuel.indexOf("the world gate (as-left)", sweepStart));
  ok(sweepSlice.includes("the name fallback"), "the sweep carries the name fallback (the twin-null path sweeps by mint name)");
  ok(sweepSlice.includes('j.name === "Import Fuel Gate Ride"'), "the sweep's broom speaks the mint name");

  // the as-left gate's name sweep
  const leftStart = fuel.indexOf("the world gate (as-left)");
  const leftSlice = fuel.slice(leftStart, fuel.indexOf("the DB byte size held", leftStart));
  ok(leftSlice.includes("the name sweep"), "the as-left gate sweeps the residue before it accepts the world");
}

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
