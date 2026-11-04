#!/usr/bin/env node
// t903 — the route-containment unit (the #6/#14 verdict's receipt, the
// t887 pattern: the law lives in lib, the unit pins both the lib's
// arithmetic and the routes' wiring).
//
// The Task 13 recital's oldest open pair, audited against the living
// tree. The verdict: the workdir byte routes speak ONE containment law
// (resolveInsideJobWorkdir — jobfile.ts), and the pathref escape hatch
// — the ONE sanctioned door to files OUTSIDE the workdir — is scoped to
// the CANONICAL marker shape (micrographs/ + hidden dotfile + .pathref
// suffix). The fossil this unit keeps dead: the hatch's old guard was a
// bare basename suffix check (`name.endsWith(".pathref")`), and the
// isPathrefPath helper minted for the job sat UNWIRED (zero users) — a
// planted file whose name ended in .pathref anywhere in the workdir
// would have been followed as a marker, its content treated as a host
// path. The wiring is now the law:
//   A  isPathrefPath's canonical shape (the micrographs/-scoped
//      hidden-dotfile law — outside it, nothing is a marker)
//   B  readPathrefTarget's validation laws (the marker content is a
//      single absolute path to an existing regular file — or nothing)
//   C  the routes' wiring (both hatch sites gate on the canonical
//      shape; the star route pins the no-hatch-by-scoping verdict)
//   D  the writer's scope (the marker writer is the import's tail, and
//      only under micrographs/ — the shape's authority)
//
// Usage: node --import ./scripts/ts-alias-register.mjs scripts/t903-containment-unit.mjs

import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isPathrefPath, readPathrefTarget, pathrefFor } from "@/lib/relion/pathref";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

console.log("A — isPathrefPath's canonical shape (micrographs/-scoped hidden dotfile)");

// A1 — the canonical shape follows
ok("A1 micrographs/.a.mrc.pathref → marker", isPathrefPath("micrographs/.a.mrc.pathref") === true);

// A2 — outside micrographs/: never a marker (the planted-data case)
ok("A2 data/.a.mrc.pathref → NOT a marker", isPathrefPath("data/.a.mrc.pathref") === false);
ok("A3 workdir root .a.mrc.pathref → NOT a marker", isPathrefPath(".a.mrc.pathref") === false);

// A3 — inside micrographs/ but no hidden dot: not the engine's voice
ok("A4 micrographs/planted.pathref (no dot) → NOT a marker", isPathrefPath("micrographs/planted.pathref") === false);

// A4 — nested under micrographs/: the writer never nests
ok("A5 micrographs/sub/.a.pathref → NOT a marker", isPathrefPath("micrographs/sub/.a.pathref") === false);

// A5 — the suffix alone is not the law
ok("A6 micrographs/.a.mrc.pathref.bak → NOT a marker", isPathrefPath("micrographs/.a.mrc.pathref.bak") === false);

// A6 — pathrefFor agrees with the shape (the writer and the guard one voice)
ok("A7 pathrefFor('.a.mrc' base) shape matches the guard", isPathrefPath(`micrographs/${pathrefFor("a.mrc")}`) === true);

// A7 — traversal attempts: the containment resolver's job, but the shape
// guard refuses them for free
ok("A8 ../micrographs/.a.pathref (climb) → NOT a marker by shape", isPathrefPath("../micrographs/.a.pathref") === false);

console.log("B — readPathrefTarget's validation laws");

const tmp = mkdtempSync(join(tmpdir(), "t903-pathref-"));
try {
  // B1 — a valid marker: single absolute path to an existing regular file
  const target = join(tmp, "target.mrc");
  writeFileSync(target, "MRC");
  const marker = join(tmp, ".a.mrc.pathref");
  writeFileSync(marker, `${target}\n`);
  ok("B1 valid marker → the absolute target", readPathrefTarget(marker) === target);

  // B2 — a relative path in the content: refused
  writeFileSync(marker, "relative/path.mrc\n");
  ok("B2 relative target refused", readPathrefTarget(marker) === null);

  // B3 — a missing target: refused
  writeFileSync(marker, `${join(tmp, "gone.mrc")}\n`);
  ok("B3 missing target refused", readPathrefTarget(marker) === null);

  // B4 — a directory as the target: refused (regular files only)
  writeFileSync(marker, `${tmp}\n`);
  ok("B4 directory target refused", readPathrefTarget(marker) === null);

  // B5 — a multi-line content: refused (the single-path law)
  writeFileSync(marker, `${target}\n${target}\n`);
  ok("B5 multi-line content refused", readPathrefTarget(marker) === null);

  // B6 — an oversized content: refused (the 4096 ceiling)
  writeFileSync(marker, `/${"a".repeat(5000)}\n`);
  ok("B6 oversized content refused", readPathrefTarget(marker) === null);

  // B7 — a missing marker file: null (the honest broken-ref answer)
  ok("B7 missing marker → null", readPathrefPath_B7() === null);
  function readPathrefPath_B7() {
    return readPathrefTarget(join(tmp, ".never.pathref"));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log("C — the routes' wiring (the t653 matcher law: guard and meaning one voice)");

const fileSrc = readFileSync(join(process.cwd(), "src/app/api/jobs/[id]/outputs/file/route.ts"), "utf8");
const subvolSrc = readFileSync(join(process.cwd(), "src/app/api/jobs/[id]/outputs/subvolume-job/route.ts"), "utf8");
const starSrc = readFileSync(join(process.cwd(), "src/app/api/jobs/[id]/outputs/star/route.ts"), "utf8");

// C1 — both hatch sites gate on isPathrefPath(rel) — the bare suffix
// check alone is the fossil
const hatchRe = /if\s*\(\s*isPathrefPath\(rel\)\s*&&\s*name\.endsWith\("\.pathref"\)\s*\)/;
ok("C1 outputs/file's hatch gates on isPathrefPath(rel)", hatchRe.test(fileSrc));
ok("C2 subvolume-job's hatch gates on isPathrefPath(rel)", hatchRe.test(subvolSrc));

// C2 — no bare-suffix-only hatch remains anywhere in the routes tree
{
  const bare = /if\s*\(\s*name\.endsWith\("\.pathref"\)\s*\)/;
  ok("C3 no bare-suffix hatch remains in either route", !bare.test(fileSrc) && !bare.test(subvolSrc));
}

// C3 — the star route carries the scoping verdict (the no-hatch law's docblock)
ok(
  "C4 the star route pins the no-hatch-by-scoping verdict",
  starSrc.includes("#6/#14 verdict") && starSrc.includes("isPathrefPath")
);

// C4 — the unified resolver is the only containment voice on the byte routes
ok(
  "C5 file/subvolume/star/map-profile all speak resolveInsideJobWorkdir",
  fileSrc.includes("resolveInsideJobWorkdir") &&
    subvolSrc.includes("resolveInsideJobWorkdir") &&
    starSrc.includes("resolveInsideJobWorkdir") &&
    readFileSync(join(process.cwd(), "src/app/api/jobs/[id]/outputs/subvolume/route.ts"), "utf8").includes("resolveInsideJobWorkdir") &&
    readFileSync(join(process.cwd(), "src/app/api/jobs/[id]/map-profile/route.ts"), "utf8").includes("resolveInsideJobWorkdir")
);

console.log("D — the writer's scope (the shape's authority)");

// D1 — the only writePathrefMarker call sites live in the import tail and
// write into micrographs dirs (the canonical shape's authority)
{
  const engine = readFileSync(join(process.cwd(), "src/lib/relion/engine.ts"), "utf8");
  const sites = [...engine.matchAll(/writePathrefMarker\((\w+),/g)].map((m) => m[1]);
  ok(
    "D1 the engine's marker writes target the micrographs trees only",
    sites.length === 2 && sites.every((v) => v.includes("Mic")),
    `sites=${sites.join(",")}`
  );
}

// D2 — the manifest's own resolution is micrographs-scoped by construction
// (resolveMicrographEntry joins the caller's micDir with a basename only)
{
  const micRoute = readFileSync(join(process.cwd(), "src/app/api/jobs/[id]/micrographs/route.ts"), "utf8");
  ok(
    "D2 the manifest defuses star-row traversal with basename before resolution",
    /const base = path\.basename\(n\);/.test(micRoute)
  );
}

console.log(`\nt903 containment unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
