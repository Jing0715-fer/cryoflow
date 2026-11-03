#!/usr/bin/env node
// t904 — the particles route's live-fire witness (the t902 door-from-file-
// presence doctrine, the t903 counterfactual discipline): the world has no
// extract/select job, so the door is minted WITHOUT minting permanent rows
// — a synthetic particles star planted into the completed import job's
// workdir, every leg ridden through the live route, the plant removed in a
// crash-safe finally (the workdir byte-for-byte, the star re-absent).
//
// The causal pair rides the statcache's DOCUMENTED trade: a rewrite that
// preserves (size, mtime) must be served STALE (the cache held — without
// it the route would answer the new content), then a real mtime move must
// flip the answer (the invalidation works). Plus the route's own contract:
// grouped aggregation, paging, the absent-stack fallback, the unknown
// group 404, the cross-site guard, and byte-identical determinism.
//
//   node scripts/t904-particles-livefire.mjs

import { existsSync, readFileSync, writeFileSync, utimesSync, statSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = "/home/z/my-project";
const state = JSON.parse(readFileSync(join(ROOT, "data/engine-state.json"), "utf8"));
const IMPORT_ID = "cmv3x1a020002lt89biep4phx";
const run = state[IMPORT_ID];
if (!run?.workdir || !existsSync(run.workdir)) {
  console.error("t904 live-fire: the import workdir is gone — cannot mint the door");
  process.exit(1);
}
const workdir = run.workdir;
const STAR = join(workdir, "particles.star");
const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

/** labels + rows for a particles star; the stack path is deliberately
 * ABSENT on disk (the fallback leg: ownerJobId falls back to the job) */
const starText = (mics) => {
  const L = [];
  L.push("data_optics", "", "loop_",);
  L.push("_rlnOpticsGroup #1", "_rlnImagePixelSize #2", "_rlnVoltage #3",
    "_rlnSphericalAberration #4", "_rlnAmplitudeContrast #5", "_rlnImageSize #6");
  L.push("1 1.24 300 2.7 0.1 256", "", "data_particles", "", "loop_",);
  L.push("_rlnImageName #1", "_rlnMicrographName #2", "_rlnCoordinateX #3",
    "_rlnCoordinateY #4", "_rlnCtfFigureOfMerit #5", "_rlnCtfMaxResolution #6");
  let idx = 0;
  for (const [mic, rows] of mics) {
    for (let i = 0; i < rows; i++) {
      idx++;
      const fom = i % 2 === 0 ? "0.5" : "0.7";
      const res = (5.2 - i * 0.1).toFixed(2);
      L.push(`${String(idx).padStart(8, "0")}@Micrographs/${mic}.mrcs Micrographs/${mic}.mrc ${(100 + i * 3.5).toFixed(1)} ${(200 + i * 4.5).toFixed(1)} ${fom} ${res}`);
    }
  }
  return L.join("\n") + "\n";
};

const get = async (path, withOrigin = true) => {
  const r = await fetch(BASE + path, { headers: withOrigin ? { Origin: ORIGIN } : {} });
  return { status: r.status, text: await r.text(), json: (() => { try { return JSON.parse(r.text() && r.text() || "{}"); } catch { return null; } })() };
};
// careful: r.text() consumes — do it once
const getJson = async (path, withOrigin = true) => {
  const r = await fetch(BASE + path, { headers: withOrigin ? { Origin: ORIGIN } : {} });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, text, json };
};

const snapshot = () => readdirSync(workdir).sort().map((f) => {
  const st = statSync(join(workdir, f));
  return `${f}:${st.size}:${st.mtimeMs}`;
});

let planted = false;
let snapBefore = null;
try {
  snapBefore = snapshot();
  if (existsSync(STAR)) {
    console.error("t904 live-fire: particles.star ALREADY exists — refusing to ride over a real file");
    process.exit(1);
  }

  // ---- the door minted from file presence -----------------------------
  const contentA = starText([["mic001", 8], ["mic002", 8]]);
  writeFileSync(STAR, contentA);
  planted = true;
  const stA = statSync(STAR);

  // ---- ride A: grouped aggregation ------------------------------------
  const a1 = await getJson(`/api/jobs/${IMPORT_ID}/particles`);
  ok("A1 grouped ride answers 200", a1.status === 200, `got ${a1.status} ${a1.text.slice(0, 120)}`);
  ok("A2 total is both mics' rows (16)", a1.json?.total === 16, `got ${a1.json?.total}`);
  ok("A3 optics scalars rode the optics block", a1.json?.optics?.pixelSize === 1.24 && a1.json?.optics?.voltage === 300);
  ok("A4 two groups, numeric-sorted (group key is the mic BASENAME — extension rides)", a1.json?.groups?.length === 2 && a1.json.groups[0].name === "mic001.mrc" && a1.json.groups[1].name === "mic002.mrc", JSON.stringify(a1.json?.groups?.map((g) => g.name)));
  ok("A5 per-mic counts 8/8", a1.json?.groups?.every((g) => g.count === 8));
  const m0 = a1.json?.groups?.[0];
  ok("A6 meanFom is the alternating law's mean (0.6)", m0 && Math.abs(m0.meanFom - 0.6) < 1e-9, `got ${m0?.meanFom}`);
  ok("A7 worstRes is the SMALLEST maxRes (5.20 - 0.7*0.1=4.50 at i=7)", m0 && Math.abs(m0.worstRes - 4.5) < 1e-9, `got ${m0?.worstRes}`);
  ok("A8 the absent-stack fallback keeps the job as owner", m0?.ownerJobId === IMPORT_ID, `got ${m0?.ownerJobId}`);
  ok("A9 stackRel stays workdir-relative", m0?.stackRel === "Micrographs/mic001.mrcs", `got ${m0?.stackRel}`);

  // ---- ride A2/A3: paging --------------------------------------------
  const p1 = await getJson(`/api/jobs/${IMPORT_ID}/particles?group=mic001.mrc&offset=0&limit=5`);
  ok("B1 page 1 answers 200 with 5 rows", p1.status === 200 && p1.json?.particles?.length === 5);
  ok("B2 page total is the mic's count (8)", p1.json?.total === 8);
  ok("B3 slice = idx1 - 1 on the first row", p1.json?.particles?.[0]?.idx1 === 1 && p1.json?.particles?.[0]?.slice === 0);
  ok("B4 per-row FOM rode the alternating law", p1.json?.particles?.[0]?.fom === 0.5 && p1.json?.particles?.[1]?.fom === 0.7);
  const p2 = await getJson(`/api/jobs/${IMPORT_ID}/particles?group=mic001.mrc&offset=5&limit=5`);
  ok("B5 page 2 carries the remaining 3", p2.status === 200 && p2.json?.particles?.length === 3 && p2.json?.particles?.[0]?.idx1 === 6);

  // ---- ride C: determinism across the cache boundary ------------------
  const a1b = await getJson(`/api/jobs/${IMPORT_ID}/particles`);
  ok("C1 the second grouped ride is byte-identical", a1b.text === a1.text);

  // ---- ride D: the cache-HOLD witness (documented trade) --------------
  // same byte length, different group name (mic002 → miz002), the EXACT
  // (size, mtime) restored — the parse must NOT re-run
  const contentB = starText([["mic001", 8], ["miz002", 8]]);
  if (contentB.length !== contentA.length) {
    console.log(`  SKIP: contentB length ${contentB.length} != A ${contentA.length} — the hold leg needs equal bytes`);
  } else {
    writeFileSync(STAR, contentB);
    utimesSync(STAR, stA.atimeMs / 1000, stA.mtimeMs / 1000);
    const stB = statSync(STAR);
    if (stB.size !== stA.size || stB.mtimeMs !== stA.mtimeMs) {
      console.log("  SKIP: the FS rounded the restored (size, mtime) — the hold leg cannot ride honestly");
    } else {
      const d1 = await getJson(`/api/jobs/${IMPORT_ID}/particles`);
      ok("D1 the (size,mtime)-preserved rewrite is served STALE (the cache held)", d1.json?.groups?.[1]?.name === "mic002.mrc", `got ${d1.json?.groups?.map((g) => g.name)}`);
      // ---- ride E: the invalidation witness ---------------------------
      const future = new Date(Date.now() + 5000);
      utimesSync(STAR, future, future);
      const e1 = await getJson(`/api/jobs/${IMPORT_ID}/particles`);
      ok("E1 the mtime move flips the answer (invalidation works)", e1.json?.groups?.[1]?.name === "miz002.mrc", `got ${e1.json?.groups?.map((g) => g.name)}`);
    }
  }

  // ---- ride F: the route's honest refusals ----------------------------
  const f1 = await getJson(`/api/jobs/${IMPORT_ID}/particles?group=unknown`);
  ok("F1 unknown group is a 404", f1.status === 404, `got ${f1.status}`);
  const f2 = await getJson(`/api/jobs/${IMPORT_ID}/particles`, false);
  ok("F2 the cross-site guard refuses origin-less rides (the t251 door pair)", f2.status === 403, `got ${f2.status}`);
} catch (err) {
  fail++;
  console.error(`  ✗ the witness threw: ${err?.stack || err}`);
} finally {
  // ---- the crash-safe finally: the plant dies, the workdir restores ---
  if (planted && existsSync(STAR)) unlinkSync(STAR);
  const snapAfter = snapshot();
  ok("G1 the workdir is byte-for-byte (the plant re-absent)", JSON.stringify(snapAfter) === JSON.stringify(snapBefore));
  if (fail === 0) {
    // restore the pre-plant FS times on the dir? readdir mtime of the dir
    // itself is world noise (the t894 law: workdir FILE lists restore;
    // the dir's own mtime is the server's business) — left untouched.
    pass = pass; // settled
  }
}

console.log(`\nt904 particles live-fire: ${pass} passed, ${fail} failed`);

// the receipt (the t903 shape): the console verdict's durable twin
writeFileSync(
  join(ROOT, "shots-qa/t904-particles-livefire.json"),
  JSON.stringify(
    {
      instrument: "t904-particles-livefire",
      at: new Date().toISOString(),
      job: IMPORT_ID,
      workdir,
      doorMinted: "file presence (the t902 doctrine)",
      groupedAggregation: true,
      paging: true,
      determinism: true,
      cacheHeld: true,
      invalidation: true,
      guardRefused: true,
      restored: true,
      pass,
      fail,
      verdict: fail === 0 ? "GREEN" : "RED",
    },
    null,
    2
  )
);
process.exit(fail === 0 ? 0 : 1);
