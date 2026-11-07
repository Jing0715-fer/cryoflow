#!/usr/bin/env node
/**
 * t1025 — the movies-dialect unit: the mock rig's micrograph-name readers
 * speak BOTH star dialects, at the deepest layer they actually touch.
 *
 * THE LAW (t703, applied to every consumer): the import's RELION 5 optics
 * star writes data_movies with _rlnMicrographMovieName for a movies-typed
 * import and data_micrographs with _rlnMicrographName for a micrographs-
 * typed one. "MicrographName" is NOT a substring of
 * "_rlnMicrographMovieName" — a reader that greps only the micrograph
 * spelling parses a movies star as EMPTY (the t1025 find: the t916 mint's
 * import→autopick wire picked 0 micrographs from the standing
 * movies-typed import, and the chain died at extract with "no micrographs
 * in input" — hidden since the t1014 EMPIAR re-run flipped the standing
 * import to movies; the t933-era world's micrographs-typed import never
 * exercised the wire).
 *
 * THE CONSUMERS (every stub that reads a micrograph-name column from an
 * arbitrary star): relion_autopick, relion_preprocess (extract),
 * relion_run_ctffind, relion_python_topaz (denoise) — relion_run_motioncorr
 * already spoke both dialects (the t703 cure) and is pinned as the twin.
 *
 * F band — the source pins: the dialect word present at every consumer,
 * the preference order (MovieName preferred, Name the fallback), the
 * column-INDEX law (the reader never hard-codes column 0), the t703
 * citation in the comment prose.
 * L band — the live rides through the stubs' REAL doors (execFileSync,
 * temp stars): the movies shape, the micrographs shape (the fallback
 * unharmed), the SHIFTED shape (MovieName at index 1 — the optics-group
 * leading column can never shift the name out from under the reader), and
 * the STANDING import's own star (the world's real 24-row data_movies
 * shape) through the autopick door.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BIN = path.join(ROOT, "services", "mock-cluster", "fs", "opt", "bin");
const RECEIPT = "shots-qa/.t1025-movies-dialect-unit.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const TMP = path.join(ROOT, "data", "t1025-movies-dialect-tmp");
mkdirSync(TMP, { recursive: true });

/* ------------------------- the star shapes ------------------------------ */
const MOVIES_STAR = [
  "data_optics", "",
  "loop_",
  "_rlnOpticsGroup #1",
  "_rlnOpticsGroupName #2",
  "_rlnMicrographPixelSize #3",
  "1 optGroup1 1.77",
  "",
  "data_movies", "",
  "loop_",
  "_rlnMicrographMovieName #1",
  "_rlnOpticsGroup #2",
  "micrographs/mic_001.mrc 1",
  "micrographs/mic_002.mrc 1",
  "micrographs/mic_003.mrc 1",
  "",
].join("\n");
const MICRO_STAR = [
  "data_optics", "",
  "loop_",
  "_rlnOpticsGroup #1",
  "1 optGroup1 1.77",
  "",
  "data_micrographs", "",
  "loop_",
  "_rlnMicrographName #1",
  "_rlnOpticsGroup #2",
  "micrographs/mic_001.mrc 1",
  "micrographs/mic_002.mrc 1",
  "",
].join("\n");
const SHIFTED_STAR = [
  "data_movies", "",
  "loop_",
  "_rlnOpticsGroup #1",
  "_rlnMicrographMovieName #2",
  "2 micrographs/mic_001.mrc",
  "2 micrographs/mic_002.mrc",
  "",
].join("\n");
const writeStar = (name, body) => {
  const p = path.join(TMP, name);
  writeFileSync(p, body);
  return p;
};

/* --------------------------- F band ------------------------------------- */
console.log("== F band: the source pins ==");
const read = (f) => readFileSync(path.join(BIN, f), "utf8");
const consumers = ["relion_autopick", "relion_preprocess", "relion_run_ctffind", "relion_python_topaz"];
for (const c of consumers) {
  ok(`F ${c} carries the movies-dialect word (_rlnMicrographMovieName)`, read(c).includes("_rlnMicrographMovieName"));
}
const mc = read("relion_run_motioncorr");
ok("F the t703 twin (relion_run_motioncorr) prefers MovieName FIRST in its want-tuple", mc.indexOf("_rlnMicrographMovieName") < mc.indexOf("_rlnMicrographName") && mc.includes('for want in ("_rlnMicrographMovieName", "_rlnMicrographName")'));
ok("F the autopick reader is index-aware (the idx < len(cols) shape, never a bare cols[0])", /idx is not None and idx < len\(cols\)/.test(read("relion_autopick")));
ok("F the ctffind reader is index-aware", /idx is not None and idx < len\(cols\)/.test(read("relion_run_ctffind")));
ok("F the topaz reader is index-aware (labels_seen positions the column)", /name_idx = labels_seen/.test(read("relion_python_topaz")));
ok("F the preprocess reader prefers the movie column with the per-loop fallback guard", /"MicrographMovieName" in name:[\s\S]*?movie_seen = True[\s\S]*?elif "MicrographName" in name and not movie_seen/.test(read("relion_preprocess")));
ok("F the autopick comment cites the t703 law", read("relion_autopick").includes("t703"));

/* --------------------------- L band ------------------------------------- */
console.log("== L band: the live rides through the stubs' real doors ==");
const runStub = (stub, args) => {
  try {
    const out = execFileSync("python3", [path.join(BIN, stub), ...args], { encoding: "utf8", timeout: 120_000, cwd: TMP });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout ?? "") + String(e.stderr ?? "") };
  }
};
const cleanOds = () => { try { rmSync(TMP, { recursive: true, force: true }); } catch {} mkdirSync(TMP, { recursive: true }); };

{
  cleanOds();
  const star = writeStar("movies.star", MOVIES_STAR);
  const od = path.join(TMP, "odA");
  const r = runStub("relion_autopick", ["--i", star, "--odir", od]);
  ok("L1 autopick × MOVIES star: exit 0", r.code === 0, String(r.code));
  ok("L1 the count speaks THREE micrographs (the dialect read)", /3 micrograph\(s\)/.test(r.out), (r.out.match(/cryoflow-mock autopick[^\n]*/) ?? ["?"])[0]);
  let picks = 0;
  try { picks = readdirSync(path.join(od, "micrographs")).filter((f) => f.endsWith("_autopick.star")).length; } catch {}
  ok("L1 THREE picks stars written (one per movie)", picks === 3, String(picks));
}
{
  cleanOds();
  const star = writeStar("micro.star", MICRO_STAR);
  const od = path.join(TMP, "odB");
  const r = runStub("relion_autopick", ["--i", star, "--odir", od]);
  ok("L2 autopick × MICROGRAPHS star: the fallback unharmed (2 micrographs)", r.code === 0 && /2 micrograph\(s\)/.test(r.out), (r.out.match(/cryoflow-mock autopick[^\n]*/) ?? ["?"])[0]);
}
{
  cleanOds();
  const star = writeStar("shifted.star", SHIFTED_STAR);
  const od = path.join(TMP, "odC");
  const r = runStub("relion_autopick", ["--i", star, "--odir", od]);
  ok("L3 autopick × SHIFTED star (MovieName at index 1): the column-index law holds (2 micrographs, never the optics number)", r.code === 0 && /2 micrograph\(s\)/.test(r.out), (r.out.match(/cryoflow-mock autopick[^\n]*/) ?? ["?"])[0]);
  const bad = r.out.includes("1 micrograph") || r.out.includes("0 micrograph");
  ok("L3 the optics-group leading column did NOT shift the name out", !bad);
}
{
  cleanOds();
  const star = writeStar("movies.star", MOVIES_STAR);
  const od = path.join(TMP, "odD");
  const r = runStub("relion_run_ctffind", ["--i", star, "--o", od]);
  ok("L4 ctffind × MOVIES star: the count speaks THREE (no empty-parse refusal)", /3 micrograph\(s\) from/.test(r.out), (r.out.match(/cryoflow-mock ctffind[^\n]*/) ?? ["?"])[0]);
}
{
  cleanOds();
  const star = writeStar("movies.star", MOVIES_STAR);
  const od = path.join(TMP, "odE");
  const r = runStub("relion_preprocess", ["--i", star, "--o", od]);
  const refused = /no micrographs in input/.test(r.out);
  ok("L5 extract (relion_preprocess) × MOVIES star: NO empty-parse refusal", !refused, refused ? "the movies dialect still unread" : "the three movies parsed");
}
{
  cleanOds();
  const star = writeStar("movies.star", MOVIES_STAR);
  const od = path.join(TMP, "odF");
  const r = runStub("relion_python_topaz", ["--i", star, "-o", od]);
  const refused = /no _rlnMicrographName rows|input star not found/.test(r.out);
  ok("L6 topaz denoise × MOVIES star: NO empty-parse refusal", !refused && r.code === 0, (r.out.split("\n").find(Boolean) ?? "?").slice(0, 80));
}
{
  cleanOds();
  /* the STANDING import's own star — the world's real data_movies shape
   * (24 rows, EMPIAR-10017), the exact input the t916 mint's wire hands
   * the picker. The autopick door reads it; the count speaks 24. */
  const standing = path.join(ROOT, "services", "mock-cluster", "fs", "projects", "cryoflow", "cmv8nhqxo0000sy8934xli45t", "import_j4c0llxu", "micrographs.star");
  const have = (() => { try { return readFileSync(standing, "utf8").includes("_rlnMicrographMovieName"); } catch { return false; } })();
  if (have) {
    const od = path.join(TMP, "odG");
    const r = runStub("relion_autopick", ["--i", standing, "--odir", od]);
    ok("L7 the STANDING import's own movies star reads 24 through the autopick door (the mint's wire, live)", /24 micrograph\(s\)/.test(r.out), (r.out.match(/cryoflow-mock autopick[^\n]*/) ?? ["?"])[0]);
  } else {
    ok("L7 the standing import's star absent — the world-shape ride skipped honestly", true, "star not on disk");
  }
}

/* --------------------------- cleanup ------------------------------------ */
try { rmSync(TMP, { recursive: true, force: true }); } catch {}

writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({
  at: new Date().toISOString(), pass, fail,
  law: "t703 movies dialect — every micrograph-name reader speaks both star shapes by declared column index",
  consumers, receipt: RECEIPT,
}, null, 2));
console.log(`== t1025-movies-dialect-unit ${fail === 0 ? "GREEN" : "RED"} (${pass} ok, ${fail} fail) ==`);
process.exit(fail === 0 ? 0 : 1);
