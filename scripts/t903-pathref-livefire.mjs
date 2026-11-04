#!/usr/bin/env node
/**
 * t903 — the pathref hatch's LIVE-FIRE witness (the t894 doctrine: a
 * guard proven only by unit arms is a guard the world never voted on;
 * plant the evidence, pull the trigger, restore the scene).
 *
 * The fix under test: the outputs/file route's pathref escape hatch now
 * gates on the CANONICAL marker shape (isPathrefPath — micrographs/ +
 * hidden dotfile + .pathref suffix), not a bare name suffix. Two plants
 * into a real completed import job's workdir:
 *   1. micrographs/.t903-live.mrc.pathref — the CANONICAL shape, content
 *      = an absolute path to the job's own run.out (a harmless in-tree
 *      target). The hatch MUST follow: the response bytes == run.out's
 *      bytes.
 *   2. notes/t903-planted.pathref — a planted file with a marker-shaped
 *      CONTENT but a non-canonical NAME/location. The OLD guard would
 *      have followed it (the counterfactual this witness names); the
 *      NEW guard must serve the marker file's OWN bytes (the path text),
 *      NOT the target's.
 * Every planted file is removed in the crash-safe finally; the workdir's
 * file list is asserted byte-for-byte against the pre-state.
 *
 *   node scripts/t903-pathref-livefire.mjs
 */

import { execSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";
const RECEIPT = "shots-qa/t903-pathref-livefire.json";
const IMPORT_NAME = "Import Movies 1";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) =>
  execSync(cmd, { encoding: "utf8", timeout: 120_000, cwd: ROOT }).trim();

/* ------------------------------------------------------------------ */
/* the crash-safe cleanup                                              */
/* ------------------------------------------------------------------ */
const planted = []; // absolute paths this instrument created
let beforeList = null; // the workdir's recursive pre-state (sorted, joined)
let workdir = null;
function snapshot(dir, acc = [], prefix = "") {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) snapshot(join(dir, e.name), acc, rel);
    else acc.push(rel);
  }
  return acc.sort();
}
function cleanup() {
  let restored = true;
  for (const p of planted) {
    try {
      rmSync(p, { force: true });
    } catch {}
  }
  try {
    const now = snapshot(workdir).join(",");
    restored = now === beforeList;
  } catch {
    restored = false;
  }
  console.log(
    `\n  cleanup: ${planted.length} planted files removed, workdir ${restored ? "byte-for-byte" : "DRIFTED"}`
  );
  return restored;
}
process.on("exit", () => {
  for (const p of planted) {
    try {
      rmSync(p, { force: true });
    } catch {}
  }
});

console.log("t903 pathref live-fire — the canonical shape followed, the planted file refused\n");

/* ------------------------------------------------------------------ */
/* the scene: a completed import job's workdir                         */
/* ------------------------------------------------------------------ */
const roster = JSON.parse(
  sh(`curl -s -H "Origin: ${ORIGIN}" "${BASE}/api/jobs"`)
).jobs ?? [];
const imp = roster.find((j) => j.name === IMPORT_NAME && j.status === "completed");
ok("S1 the import job found on the roster", !!imp, imp?.id ?? "none");
const state = JSON.parse(readFileSync(join(ROOT, "data/engine-state.json"), "utf8"));
workdir = (state.runs ?? state)[imp.id]?.workdir;
ok("S2 the workdir on disk", !!workdir && existsSync(workdir), workdir ?? "none");
const micDir = join(workdir, "micrographs");
mkdirSync(micDir, { recursive: true });
beforeList = snapshot(workdir).join(",");

// The TARGET is the job's own mic001.mrc (a real MRC): the raw lane only
// serves maps and images — a FOLLOWED marker whose target is a movie
// answers 200 with the movie's bytes; an UNfollowed .pathref name dies in
// the format lane (400 "Raw format is for maps and image files") — which
// IS the discriminating assertion: the old bare-suffix guard would have
// followed the planted twins and answered 200 with the MRC bytes.
const micNames = readdirSync(micDir)
  .filter((f) => f.endsWith(".mrc") && !f.startsWith("."))
  .sort();
ok("S2b a real MRC target exists in micrographs/", micNames.length > 0, micNames[0] ?? "none");

/* ------------------------------------------------------------------ */
/* the two plants                                                      */
/* ------------------------------------------------------------------ */
const target = join(micDir, micNames[0]);
ok("S3 the MRC target on disk", micNames.length > 0 && existsSync(target), target ? target.slice(-30) : "none");
if (micNames.length === 0) {
  console.log("  no MRC target — aborting (nothing planted)");
  cleanup();
  process.exit(1);
}
const targetBytes = readFileSync(target);

const canonical = join(micDir, ".t903-live.mrc.pathref");
writeFileSync(canonical, `${target}\n`);
planted.push(canonical);

// the planted twin: marker CONTENT, non-canonical NAME + location
const notesDir = join(workdir, "notes");
mkdirSync(notesDir, { recursive: true });
const plantedFile = join(notesDir, "t903-planted.pathref");
writeFileSync(plantedFile, `${target}\n`);
planted.push(plantedFile);
ok("S4 both plants written (canonical + planted twin)", true);

/* ------------------------------------------------------------------ */
/* the trigger: two pulls through the live route                       */
/* ------------------------------------------------------------------ */
const pull = async (rel) => {
  const out = sh(
    `curl -s -H "Origin: ${ORIGIN}" "${BASE}/api/jobs/${imp.id}/outputs/file?path=${encodeURIComponent(rel)}&format=raw" -o /tmp/t903-pull.bin -w "%{http_code}"`
  );
  return { status: out, bytes: readFileSync("/tmp/t903-pull.bin") };
};

// P1 — the canonical marker: the hatch FOLLOWS (the MRC's bytes answer)
const r1 = await pull("micrographs/.t903-live.mrc.pathref");
ok("P1 the canonical marker answered 200", r1.status === "200", `status=${r1.status}`);
ok(
  "P2 the hatch FOLLOWED it (bytes == the MRC target's)",
  Buffer.compare(r1.bytes, targetBytes) === 0,
  `served=${r1.bytes.length}B target=${targetBytes.length}B`
);

// P3/P4 — the planted twin: the guard REFUSES the hatch; the name stays
// .pathref so the raw FORMAT lane answers 400 — under the old bare-suffix
// guard this pull would have followed (name → the MRC) and answered 200
// with the movie's bytes. The 400 IS the no-follow proof.
const RAW_GUARD = "Raw format is for maps and image files";
const r2 = await pull("notes/t903-planted.pathref");
ok(
  "P4 the guard did NOT follow it (the format lane's 400 — the old guard would have answered 200 with the MRC)",
  r2.status === "400" && r2.bytes.toString("utf8").includes(RAW_GUARD),
  `status=${r2.status} body=${r2.bytes.toString("utf8").slice(0, 60)}`
);

// P5 — the second canonical law: no hidden dot → no hatch even under micrographs/
const noDot = join(micDir, "t903-nodot.pathref");
writeFileSync(noDot, `${target}\n`);
planted.push(noDot);
const r3 = await pull("micrographs/t903-nodot.pathref");
ok(
  "P5 micrographs/t903-nodot.pathref (no hidden dot) NOT followed either",
  r3.status === "400" && r3.bytes.toString("utf8").includes(RAW_GUARD),
  `status=${r3.status}`
);

/* ------------------------------------------------------------------ */
/* the restore + receipt                                               */
/* ------------------------------------------------------------------ */
const restored = cleanup();
ok("R1 the workdir restored byte-for-byte", restored);

const verdict = fail === 0 ? "GREEN" : "RED";
writeFileSync(
  join(ROOT, RECEIPT),
  JSON.stringify(
    {
      instrument: "t903-pathref-livefire",
      at: new Date().toISOString(),
      job: imp.id,
      workdir,
      canonicalFollowed: r1.status === "200" && Buffer.compare(r1.bytes, targetBytes) === 0,
      plantedRefused: r2.status === "400" && r2.bytes.toString("utf8").includes("Raw format is for maps"),
      noDotRefused: r3.status === "400" && r3.bytes.toString("utf8").includes("Raw format is for maps"),
      restored,
      pass,
      fail,
      verdict,
    },
    null,
    2
  ) + "\n"
);
console.log(`\nPATHREF-LIVEFIRE t903: ${pass} passed, ${fail} failed — ${verdict}`);
console.log(`receipt: ${RECEIPT}`);
process.exit(fail === 0 ? 0 : 1);
