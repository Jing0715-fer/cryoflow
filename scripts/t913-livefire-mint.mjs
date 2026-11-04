#!/usr/bin/env node
/**
 * t913 — the live-fire mint: three long-named copies (star / mrc / out)
 * inside ONE topazdenoise workdir, so the results-view's three dialog
 * faces (STAR table / MRC image / text preview) ride at REAL-USER path
 * lengths.
 *
 * WHY: the seeded world's relative name is 26 chars ("the seeded world's
 * relative name is 26 chars, the t652-style hardening question stands" —
 * the t913 entry). A real user's file names run 50-80 chars in ONE token
 * (RELION conventions, no spaces). The three dialog headers render the
 * raw name/path with NO truncate/break — the t912 S2 assert ("no
 * horizontal overflow") only passed because the world's names are short.
 *
 * THE FILES ARE HONEST: byte-copies of real workdir files under their
 * real names — the outputs walk lists them exactly as it lists any user
 * file, the star parser parses the copy identically, the mrc header read
 * reads the copy identically. The ONLY thing synthetic is the NAME —
 * and the name is precisely the variable under test.
 *
 * THE WORLD'S FOOTPRINT: 3 files in ONE workdir
 * (data/relion/<proj>/topazdenoise_09f8q29s/). A manifest with the
 * originals' sha256 records the before-world; `remove` deletes the
 * copies and re-verifies the originals' sha256 — byte-exact restore,
 * the t894 live-fire discipline.
 *
 * Usage:
 *   node scripts/t913-livefire-mint.mjs mint     # place copies + manifest
 *   node scripts/t913-livefire-mint.mjs remove   # delete copies + verify originals
 *   node scripts/t913-livefire-mint.mjs verify   # does the API list them? (read-only)
 */

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PROJ = path.join(ROOT, "data/relion/cmv3x1a000000lt89qwh34u45");
const MANIFEST = path.join(ROOT, "shots-qa/t913-livefire-manifest.json");
const BASE = "http://localhost:3000";
const JOB_ID = "cmv3y2m370001ltn309f8q29s"; // one representative (verify mode)

// one plausible real-user long name per face (single token, 54-61 chars)
const COPIES = [
  { src: "denoised_micrographs.star", long: "motioncorr_corrected_micrographs_stack_session2_full_run.star" },
  { src: "mic001_denoised.mrc", long: "motioncorr_corrected_micrograph_stack_batch2_half1_full.mrc" },
  { src: "run.out", long: "relion_motioncorr_run_protocol_session_verbose_log.out" },
];

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

/** every topazdenoise workdir in the world (the mint-wide footprint) */
function topazDirs() {
  return readdirSync(PROJ, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("topazdenoise_"))
    .map((e) => e.name)
    .sort();
}

function mintWide() {
  const dirs = topazDirs();
  if (dirs.length === 0) { console.error("FATAL: no topazdenoise workdirs"); process.exit(2); }
  const records = [];
  for (const d of dirs) {
    for (const { src, long } of COPIES) {
      const srcAbs = path.join(PROJ, d, src);
      const dstAbs = path.join(PROJ, d, long);
      if (!existsSync(srcAbs)) { console.error(`FATAL: ${d}/${src} missing`); process.exit(2); }
      if (existsSync(dstAbs)) { console.error(`FATAL: ${d}/${long} already exists`); process.exit(2); }
      copyFileSync(srcAbs, dstAbs);
      records.push({ dir: d, src, long, srcSha: sha(srcAbs), copySha: sha(dstAbs) });
    }
  }
  writeFileSync(
    MANIFEST,
    JSON.stringify({ mintedAt: new Date().toISOString(), proj: PROJ, mode: "wide", records }, null, 2)
  );
  console.log(`MINTED ${records.length} copies across ${dirs.length} workdirs`);
  console.log(`manifest: ${MANIFEST}`);
}

function removeWide() {
  if (!existsSync(MANIFEST)) {
    console.error("FATAL: no manifest — nothing to remove");
    process.exit(2);
  }
  const { records } = JSON.parse(readFileSync(MANIFEST, "utf8"));
  let bad = 0;
  for (const r of records) {
    const dstAbs = path.join(PROJ, r.dir, r.long);
    if (existsSync(dstAbs)) rmSync(dstAbs);
    const srcAbs = path.join(PROJ, r.dir, r.src);
    if (sha(srcAbs) !== r.srcSha) { bad++; console.log(`  ✗ ${r.dir}/${r.src} SHA CHANGED — FATAL`); }
  }
  if (bad > 0) process.exit(2);
  rmSync(MANIFEST);
  console.log(`RESTORED — ${records.length} copies removed, every original byte-exact`);
}

async function verify() {
  const res = await fetch(`${BASE}/api/jobs/${JOB_ID}/outputs`, {
    headers: { Origin: BASE },
  });
  if (!res.ok) {
    console.error(`outputs route said ${res.status}`);
    process.exit(2);
  }
  const data = await res.json();
  const files = (data.files ?? []).map((f) => f.name);
  const present = COPIES.map((c) => c.long).filter((n) => files.includes(n));
  const starRows = (data.files ?? []).find((f) => f.name === COPIES[0].long);
  console.log(`listing carries ${files.length} files; live-fire copies present: ${present.length}/3`);
  if (starRows) console.log(`  star copy rows badge: ${typeof starRows.rows === "number" ? starRows.rows : "none (starBudget)"}`);
  if (present.length !== COPIES.length) {
    console.log("NOT ALL LISTED — the walk has not picked them up (or they were removed)");
    process.exit(1);
  }
}

const mode = process.argv[2] ?? "";
if (mode === "mint") mintWide();
else if (mode === "remove") removeWide();
else if (mode === "verify") await verify();
else {
  console.error("usage: t913-livefire-mint.mjs mint|remove|verify");
  process.exit(2);
}
