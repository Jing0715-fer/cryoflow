#!/usr/bin/env node
/**
 * t1081 — THE STAMP'S SECOND EYE (the build fact's parity across its
 * zooms, the t1079 chip's-parity law at the provenance zoom).
 *
 * THE FINDING (this window's asymmetry hunt): the build fact wore two
 * DIALECTS that contradicted each other on camera. The footer's stamp
 * answered "build 44521ef" (the config's git read, inlined at boot);
 * the diagnostics' World & build section answered "No provenance stamp
 * on this lane" (the disk stamp .next/.built-at-commit only exists on
 * a built lane). The authoritative zoom was BLIND to the dev lane —
 * the same app, the same fact, two answers.
 *
 * THE CURE:
 *   1. the SECOND EYE — readBuildProvenance falls back to the config's
 *      boot stamp (bootStampFromEnv guards the shape: seven hex chars;
 *      the "?" honest-no does not pass), and the payload names WHERE the
 *      commit came from: source "disk" (the recipe's authoritative
 *      stamp) | "boot" (the config's git read at server start) | null
 *      (both eyes closed — an exported archive);
 *   2. THE STALE-PROBE LAW — the boot branch forces standalone:false at
 *      the shape level: a dev tree can carry .next/standalone/server.js
 *      outlived by its own build, and the boot eye never saw a build —
 *      the badge only ever wears the disk stamp's case;
 *   3. THE PARITY — the diagnostics row wears the footer's served
 *      tooltip BYTE-LEVEL (one voice, two zooms), the standalone badge
 *      gains its story (t525 stamps at bake time), the new dev boot
 *      badge gains its own (a build day bakes the disk stamp), and the
 *      both-eyes-closed fallback line narrows its words honestly.
 *
 * PROTOCOL: lib-import unit via unit-runner (jiti) for the pure helpers,
 * readFileSync pins on the two components + the lib, one LIVE probe of
 * /api/diagnostics with the same-origin shim (the guard's documented
 * curl law), exit honest.
 *
 * RECOVERY NOTE (t1081-R): this unit was first written and greened in
 * the pre-reboot window; the sandbox's reboot restored the tree to an
 * earlier snapshot and the file was lost with it — recreated byte-
 * faithful from the window's own record, re-ran green against the
 * restored tree.
 */
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { bootStampFromEnv, readBuildProvenance } from "@/lib/diagnostics";

const ROOT = process.cwd();
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const lib = read("src/lib/diagnostics.ts");
const dialog = read("src/components/workflow/system-diagnostics-dialog.tsx");
const footer = read("src/components/workflow/footer.tsx");
const types = read("src/lib/types.ts");

let pass = 0, fail = 0;
const pin = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* ---------- W band — the anatomy ---------- */
console.log("W band — the second eye's anatomy");

pin("W1 the guard's shapes: a real sha passes, the ? honest-no does not",
  bootStampFromEnv("44521ef") === "44521ef" &&
  bootStampFromEnv("93BD005") === "93bd005" &&
  bootStampFromEnv(" 93bd005 ") === "93bd005" &&
  bootStampFromEnv("?") === null &&
  bootStampFromEnv("") === null &&
  bootStampFromEnv(undefined) === null &&
  bootStampFromEnv(null) === null,
  `got ${JSON.stringify([
    bootStampFromEnv("44521ef"),
    bootStampFromEnv("?"),
    bootStampFromEnv(undefined),
  ])}`);

pin("W2 the guard's wall: wrong shapes do not pass (8/6 chars, non-hex, words)",
  bootStampFromEnv("44521efd") === null &&
  bootStampFromEnv("93bd00") === null &&
  bootStampFromEnv("93bd00g") === null &&
  bootStampFromEnv("build?") === null &&
  bootStampFromEnv("44521e\nf") === null,
  "seven hex chars is the whole contract");

{
  const fx = mkdtempSync(path.join(tmpdir(), "t1081-disk-"));
  try {
    mkdirSync(path.join(fx, ".next"), { recursive: true });
    writeFileSync(path.join(fx, ".next", ".built-at-commit"), "93bd005\n");
    const disk = readBuildProvenance(fx, "44521ef");
    pin("W3 the disk stamp wins and names its eye (authoritative over boot)",
      disk.commit === "93bd005" && disk.source === "disk" && disk.standalone === false,
      JSON.stringify(disk));
  } finally {
    rmSync(fx, { recursive: true, force: true });
  }
}

{
  const fx = mkdtempSync(path.join(tmpdir(), "t1081-boot-"));
  try {
    const boot = readBuildProvenance(fx, "44521ef");
    pin("W4 the boot eye answers a bare tree with the boot source, no standalone",
      boot.commit === "44521ef" && boot.source === "boot" && boot.standalone === false,
      JSON.stringify(boot));
    const closed = readBuildProvenance(fx, null);
    pin("W5 both eyes closed is said, not guessed",
      closed.commit === null && closed.source === null && closed.standalone === false,
      JSON.stringify(closed));
  } finally {
    rmSync(fx, { recursive: true, force: true });
  }
}

{
  // THE STALE-PROBE LAW — a dev tree can carry .next/standalone/server.js
  // outlived by its own build; the boot eye never saw a build, so the
  // boot branch forces the honest false AT THE SHAPE LEVEL.
  const fx = mkdtempSync(path.join(tmpdir(), "t1081-stale-"));
  try {
    mkdirSync(path.join(fx, ".next", "standalone"), { recursive: true });
    writeFileSync(path.join(fx, ".next", "standalone", "server.js"), "main();");
    const stale = readBuildProvenance(fx, "44521ef");
    pin("W6 the stale-probe law: the boot lane is never the standalone lane",
      stale.source === "boot" && stale.standalone === false,
      JSON.stringify(stale));
    // the disk eye at the same tree STILL earns the badge (the probe
    // belongs to the disk stamp's case)
    writeFileSync(path.join(fx, ".next", ".built-at-commit"), "93bd005\n");
    const diskStale = readBuildProvenance(fx, "44521ef");
    pin("W7 the disk stamp at the same tree earns the standalone badge",
      diskStale.commit === "93bd005" && diskStale.source === "disk" && diskStale.standalone === true,
      JSON.stringify(diskStale));
  } finally {
    rmSync(fx, { recursive: true, force: true });
  }
}

/* ---------- G band — the parity guards ---------- */
console.log("G band — one voice, two zooms");

const SERVED = "Served build — the git commit this app is actually running.\\nAfter git pull: restart the dev server, or rebuild (npm run build) for production, or the old code keeps serving.";
pin("G1 THE PARITY: the row's tooltip IS the footer's served tooltip, byte-level",
  footer.includes(`title={"${SERVED}"}`) && dialog.includes(`title={"${SERVED}"}`),
  "the same 173-char serve rides both zooms");

pin("G2 the braces law holds in both files (the \\n only serves inside an expression)",
  /title=\{"Served build[^\n]*\\nAfter git pull/.test(footer) &&
  /title=\{"Served build[^\n]*\\nAfter git pull/.test(dialog) &&
  !footer.includes('title="Served build') &&
  !dialog.includes('title="Served build'),
  "a quoted attribute would print a literal backslash-n (t1078 SW5)");

pin("G3 the standalone badge wears its story (t525's bake-time stamp)",
  dialog.includes('title={"The standalone lane — this process serves the recipe\'s production build; t525 stamps the commit at bake time."}'),
  "the badge is no longer a bare word");

pin("G4 the dev boot badge wears its own story (a build day bakes the disk stamp)",
  /source === "boot"/.test(dialog) &&
  dialog.includes('title={"The dev boot eye — the config read this commit when the server started; the disk stamp only exists on a built lane (a build day bakes it)."}') &&
  />\s*dev boot\s*</.test(dialog),
  "the dev lane's honest face has a name");

pin("G5 the fallback line narrowed honestly (both eyes closed, not 'dev or legacy')",
  dialog.includes("the boot eye saw no git checkout and no recipe") &&
  !dialog.includes("dev or legacy build (the recipe marks standalone"),
  "the dev lane no longer lands here — the words say what remains");

pin("G6 the report's lane tag names the eye (boot → dev boot lane, standalone survives)",
  lib.includes('" (dev boot lane)"') &&
  lib.includes('" (standalone lane)"') &&
  /const laneTag = payload\.provenance\.standalone/.test(lib),
  "the third zoom (the report's prose) speaks the same dialect");

pin("G7 the client mirror type carries source (the dialog's type door)",
  types.includes('source: "disk" | "boot" | null;') &&
  /interface BuildProvenanceClient \{[\s\S]*?source: "disk" \| "boot" \| null/.test(types),
  "BuildProvenanceClient grows with the lib's own interface");

pin("G8 the source-shape contract sits in the lib too (one union, two doors)",
  /source: "disk" \| "boot" \| null;/.test(lib),
  "the payload and its mirror share the union");

/* ---------- L band — the live receipt ---------- */
console.log("L band — the lane's LIVE face");

try {
  const shaFull = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  // the config's own law: the stamp is SEVEN chars (resolveBuildStamp's
  // slice) — git's --short can auto-abbrev wider on a big repo, so the
  // live comparison cuts at the same seven
  const sha = shaFull.slice(0, 7);
  const res = await fetch("http://localhost:3000/api/diagnostics", {
    headers: { Origin: "http://localhost:3000" },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await res.json();
  const prov = payload?.provenance;
  if (res.status === 200 && prov) {
    const devLane = prov.source === "boot";
    pin("L1 the LIVE lane's provenance: the commit matches HEAD and the eye is named",
      prov.commit === sha &&
      (devLane ? prov.standalone === false : true) &&
      (devLane || prov.source === "disk"),
      `commit=${prov.commit} head=${sha} source=${prov.source} standalone=${prov.standalone} — ` +
      (devLane
        ? "the dev lane answers through the boot eye, the same commit the footer's stamp carries"
        : "a built lane answers through the disk stamp (the recipe's own face)"));
  } else {
    pin("L1 the LIVE lane's provenance", false, `status=${res.status} provenance=${JSON.stringify(prov ?? null)}`);
  }
} catch (e) {
  pin("L1 the LIVE lane's provenance", false, String(e).slice(0, 160));
}

/* the receipt */
console.log(`t1081-provenance-second-eye-unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
