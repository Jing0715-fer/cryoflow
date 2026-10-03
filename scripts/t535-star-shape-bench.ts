/** t535 — the star shape gate: the real binary's movies contract, spoken locally.
 *
 *  t534's ledger convicted the stub era one more time: t268's motioncorr
 *  fixture fed the REAL relion_run_motioncorr a micrographs star and died
 *  mid-cluster as a cryptic "exit 1 (RELION reported an error)" — the
 *  binary's own diagnosis ("does not contain the rlnMicrographMovieName
 *  column. Are you sure you imported files as movies…",
 *  motioncorr_runner.cpp:257-263) never reached the user. The fix is the
 *  star-shape gate: the motioncorr command builder reads the wired star's
 *  OWN bytes BEFORE dispatch and refuses with the actionable truth. The
 *  laws this bench pins:
 *
 *    LAW 1 — the classifier is pure and byte-honest: label LINES only
 *            (a row value that merely contains the label text is not a
 *            column), the movies dialect wins the moment any table speaks
 *            it, stars that speak neither dialect are honestly null-ish,
 *            and CRLF stars classify the same as LF ones.
 *    LAW 2 — the dialects of the world: the import writer's movies shape
 *            (data_optics + data_movies + _rlnMicrographMovieName) speaks
 *            movies; the corrected star's shape (data_optics +
 *            data_micrographs) speaks micrographs — so chaining MotionCorr
 *            into MotionCorr is refused too; a particles star speaks
 *            neither.
 *    LAW 3 — honest wiring: the engine's motioncorr case reads the gate
 *            BEFORE building argv, the refusal names the cpp contract and
 *            the way out (Node type = Movies), and unreadable stars skip
 *            the gate (honest null — the binary still speaks).
 *    LAW 4 — live smoke, read-only: a real star from the canonical world
 *            classifies from its own bytes (the demo import trees speak
 *            micrographs).
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// the in-process door key (t523 pattern): teach node the product's two import
// dialects (@/ alias + extensionless relatives) before the lib import.
try {
  const { register } = await import("node:module");
  if (typeof register === "function") {
    register(pathToFileURL(new URL("./ts-alias-hook.mjs", import.meta.url).pathname));
  }
} catch {
  // bun (or another runtime with native path-alias eyes) — no key needed
}

const SRC = path.resolve(new URL("..", import.meta.url).pathname, "src");
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const readSrc = (...p: string[]): string => readFileSync(path.join(SRC, ...p), "utf8");

const { starMoviesShapeOf, readStarMoviesShape } = await import("@/lib/relion/star-shape");

let pass = 0;
const fail = (msg: string): never => {
  console.error(`FAIL ${msg}`);
  process.exit(1);
};
const ok = (cond: unknown, msg: string): void => {
  if (!cond) fail(msg);
  pass++;
  console.log(`ok: ${msg}`);
};

/* ---- LAW 1: the classifier is pure and byte-honest ------------------- */

const MOVIES_STAR = [
  "data_optics",
  "",
  "loop_",
  "_rlnOpticsGroup #1",
  "_rlnOpticsGroupName #2",
  "_rlnMicrographPixelSize #3",
  "_rlnVoltage #4",
  "_rlnSphericalAberration #5",
  "_rlnAmplitudeContrast #6",
  "_rlnMicrographOriginalPixelSize #7",
  "1 optGroup1 1.77 300 2.7 0.1 1.77",
  "",
  "data_movies",
  "",
  "loop_",
  "_rlnMicrographMovieName #1",
  "_rlnOpticsGroup #2",
  "movies/mic_001.mrc 1",
].join("\n");

const MICROGRAPHS_STAR = [
  "data_optics",
  "",
  "loop_",
  "_rlnOpticsGroup #1",
  "_rlnOpticsGroupName #2",
  "_rlnMicrographPixelSize #3",
  "_rlnVoltage #4",
  "_rlnSphericalAberration #5",
  "_rlnAmplitudeContrast #6",
  "1 optGroup1 1.77 300 2.7 0.1",
  "",
  "data_micrographs",
  "",
  "loop_",
  "_rlnMicrographName #1",
  "_rlnOpticsGroup #2",
  "micrographs/mic_001.mrc 1",
].join("\n");

{
  const s = starMoviesShapeOf(MOVIES_STAR);
  ok(s.table === "data_movies" && s.dialect === "movies", "L1 the import movies star speaks data_movies/movies");
  const m = starMoviesShapeOf(MICROGRAPHS_STAR);
  ok(m.table === "data_micrographs" && m.dialect === "micrographs", "L1 the micrographs star speaks data_micrographs/micrographs");

  // a row value that merely CONTAINS the label text is not a column
  const sneaky = [
    "data_micrographs",
    "",
    "loop_",
    "_rlnMicrographName #1",
    "mics/_rlnMicrographMovieName_backup.mrc 1",
  ].join("\n");
  ok(starMoviesShapeOf(sneaky).dialect === "micrographs", "L1 a row containing the label text is not a column");

  // label lines match with a #N suffix, a trailing space, or bare
  for (const label of ["_rlnMicrographMovieName #1", "_rlnMicrographMovieName ", "_rlnMicrographMovieName"]) {
    const star = `data_movies\n\nloop_\n${label}\nm.mrc 1`;
    ok(starMoviesShapeOf(star).dialect === "movies", `L1 label dialect "${label.trim()}" matches`);
  }
  // a longer label that merely STARTS with the text is not the column
  ok(
    starMoviesShapeOf("data_movies\n\nloop_\n_rlnMicrographMovieNameExtra #1\nm.mrc 1").dialect === null,
    "L1 a longer label is not the movies column"
  );

  // CRLF stars classify the same
  ok(starMoviesShapeOf(MOVIES_STAR.replace(/\n/g, "\r\n")).dialect === "movies", "L1 CRLF stars classify the same");

  // neither dialect spoken → honest null-ish; garbage too
  ok(starMoviesShapeOf("data_particles\n\nloop_\n_rlnImageName #1\np.mrcs 1").dialect === null, "L1 a particles star speaks neither dialect");
  ok(starMoviesShapeOf("garbage\nno tables").table === null && starMoviesShapeOf("").dialect === null, "L1 garbage is honestly table-less");

  // movies wins the moment ANY table speaks it — even after a micrographs table
  const mixed = ["data_micrographs", "", "loop_", "_rlnMicrographName #1", "a.mrc 1", "", "data_movies", "", "loop_", "_rlnMicrographMovieName #1", "b.mrc 1"].join("\n");
  ok(starMoviesShapeOf(mixed).table === "data_movies" && starMoviesShapeOf(mixed).dialect === "movies", "L1 the movies dialect wins wherever it speaks");
}

/* ---- LAW 2: the dialects of the world -------------------------------- */

{
  // the corrected star (MotionCorr's own output): chaining MotionCorr into
  // MotionCorr must be refused — it speaks micrographs
  const corrected = [
    "data_optics",
    "",
    "loop_",
    "_rlnOpticsGroup #1",
    "_rlnMicrographOriginalPixelSize #2",
    "1 1.77",
    "",
    "data_micrographs",
    "",
    "loop_",
    "_rlnMicrographName #1",
    "_rlnOpticsGroup #2",
    "MotionCorr/job002/corrected_micrographs.star 1",
  ].join("\n");
  ok(starMoviesShapeOf(corrected).dialect === "micrographs", "L2 a corrected star speaks micrographs — motioncorr chains are refused");

  // the t372 optics twist: movies imports carry _rlnMicrographOriginalPixelSize
  // in the OPTICS block — the optics block itself never speaks the mic dialect
  ok(starMoviesShapeOf("data_optics\n\nloop_\n_rlnMicrographOriginalPixelSize #1\n1.77").dialect === null, "L2 the optics block speaks no mic dialect");
}

/* ---- LAW 3: honest wiring (file bytes) -------------------------------- */

{
  const engine = readSrc("lib", "relion", "engine.ts");
  ok(
    /case "motioncorr": \{[\s\S]*?readStarMoviesShape\(inputs\.micrographs_star\)/.test(engine),
    "L3 the motioncorr case reads the gate before anything else"
  );
  ok(/motioncorr_runner\.cpp:261 refuses/.test(engine), "L3 the refusal names the cpp contract");
  ok(/Node type = Movies/.test(engine), "L3 the refusal names the way out");
  ok(/import \{ readStarMoviesShape \} from "\.\/star-shape";/.test(engine), "L3 the engine imports the gate");

  const shape = readSrc("lib", "relion", "star-shape.ts");
  ok(/export function starMoviesShapeOf/.test(shape) && /export function readStarMoviesShape/.test(shape), "L3 the module exports the classifier and the reader");
  ok(/readFileSync\(starPath, "utf8"\)[\s\S]*\}\s*catch \{\s*return null;/.test(shape), "L3 an unreadable star is honest null (the gate skips)");
}

/* ---- LAW 4: live smoke, read-only ------------------------------------- */

{
  // a real star from the canonical world, classified from its own bytes.
  // The demo/tutorial import trees speak micrographs (the t521/t531 seeders
  // and the real imports all write data_micrographs).
  const found = findStar(path.join(ROOT, "data", "relion"), 0);
  if (!found) {
    fail("L4 no micrographs.star found under data/relion — the canonical world is empty?");
  } else {
    const shape = readStarMoviesShape(found);
    ok(
      !!shape && shape.dialect === "micrographs",
      `L4 the world's own star (${path.relative(ROOT, found)}) speaks micrographs (${shape?.table ?? "?"})`
    );
    // honest null: a missing path never becomes a verdict
    ok(readStarMoviesShape(found + ".definitely-missing") === null, "L4 a missing star reads as honest null");
  }
}

/** depth-limited first micrographs.star under dir (read-only walk). */
function findStar(dir: string, depth: number): string | null {
  if (depth > 6 || !existsSync(dir)) return null;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  for (const e of entries) {
    const p = path.join(dir, e);
    try {
      if (statSync(p).isDirectory()) {
        const hit = findStar(p, depth + 1);
        if (hit) return hit;
      } else if (e === "micrographs.star") {
        return p;
      }
    } catch {
      // unreadable entry — keep walking
    }
  }
  return null;
}

console.log(`\n${pass} checks passed — the gate speaks the binary's contract before the binary has to.`);
