// t1169 — THE PATHREF HATCH UNIT: the escape hatch's ONE gate — the
// t903 verdict completed at every carrier.
//
// The #6/#14 legacy's arc: t903 pinned the CANONICAL marker shape
// (isPathrefPath — a marker speaks for the engine ONLY as a
// micrographs/-scoped hidden dotfile) and closed the drift on
// /outputs/file and /outputs/subvolume-job ("gated on the canonical
// marker shape") and on /outputs/star ("no hatch here is the policy").
// But t903's cure left the compound condition INLINE at the two routes
// it fixed — and the two routes it did not visit kept the BARE suffix
// gate: /outputs/subvolume and /map-profile opened the hatch on
// `name.endsWith(".pathref")` alone, so a planted non-hidden
// `anything/evil.pathref` (a file the engine never wrote, outside
// micrographs/, no hidden-dot name) opened the hatch to any absolute
// path its content named — an MRC-named target even passed the header
// check on the map-profile face ("defensive — the header check below
// will refuse", the old comment said; the header check refuses only
// non-MRC targets — a planted marker naming a real map is a door).
//
// THE CURE (one well): pathrefHatchApplies(rel, name) at the
// birthplace — isPathrefPath(rel) && name.endsWith(".pathref") — and
// all FOUR carriers rewired onto it: the drift the inline compound
// condition allowed can never fork again.
//
// A — the helper's functional face: canonical true; the planted twins
//     (outside micrographs/, non-hidden inside it) false; the suffix-
//     lost resolve false; readPathrefTarget's honest nulls.
// B — the source law: all four carriers name the ONE gate; no bare
//     suffix gate survives anywhere; every route reading a pathref
//     target rides the gate (or the canonical-by-construction
//     resolver); the birthplace builds it on isPathrefPath.
// C — the t903 continuity: the containment seat's import unbroken, the
//     livefire seat present, resolveMicrographEntry unchanged.
//
// node scripts/unit-runner.mjs scripts/t1169-pathref-hatch-unit.mjs
//

import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathrefHatchApplies, isPathrefPath, readPathrefTarget, pathrefFor } from "@/lib/relion/pathref";

const ROOT = "/home/z/my-project";
const fileSrc = readFileSync(join(ROOT, "src/app/api/jobs/[id]/outputs/file/route.ts"), "utf8");
const subVolJobSrc = readFileSync(join(ROOT, "src/app/api/jobs/[id]/outputs/subvolume-job/route.ts"), "utf8");
const subVolSrc = readFileSync(join(ROOT, "src/app/api/jobs/[id]/outputs/subvolume/route.ts"), "utf8");
const mapProfileSrc = readFileSync(join(ROOT, "src/app/api/jobs/[id]/map-profile/route.ts"), "utf8");
const pathrefSrc = readFileSync(join(ROOT, "src/lib/relion/pathref.ts"), "utf8");
const containmentSeatSrc = readFileSync(join(ROOT, "scripts/t903-containment-unit.mjs"), "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const dir = mkdtempSync(join(tmpdir(), "t1169-pathref-"));

try {
  console.log("A — the helper's functional face");
  ok("A1 the canonical marker: micrographs/.a.mrc.pathref opens the hatch", pathrefHatchApplies("micrographs/.a.mrc.pathref", ".a.mrc.pathref") === true);
  ok("A2 the planted twin outside micrographs/ stays shut", pathrefHatchApplies("data/evil.pathref", "evil.pathref") === false);
  ok("A3 the planted non-hidden twin inside micrographs/ stays shut", pathrefHatchApplies("micrographs/planted.pathref", "planted.pathref") === false);
  ok("A4 a resolve that lost the suffix stays shut", pathrefHatchApplies("micrographs/.a.mrc.pathref", "a.mrc") === false);
  ok("A5 the rel alone never speaks (bare-suffix name, canonical-looking rel)", isPathrefPath("micrographs/.a.mrc.pathref") === true && pathrefHatchApplies("micrographs/.a.mrc.pathref", "unrelated.mrc") === false);
  {
    const target = join(dir, "real-source.mrc");
    writeFileSync(target, "fake-bytes-for-the-pin", "utf8");
    const marker = join(dir, ".mic_001.mrc.pathref");
    writeFileSync(marker, `${target}\n`, "utf8");
    ok("A6 a real canonical marker resolves to its target", readPathrefTarget(marker) === target);
    const foreign = join(dir, "foreign.pathref");
    writeFileSync(foreign, "relative/not-absolute\n", "utf8");
    ok("A7 a non-absolute target is garbage — honest null", readPathrefTarget(foreign) === null);
    const longTail = join(dir, "longtail.pathref");
    writeFileSync(longTail, `/${"x".repeat(4200)}\n`, "utf8");
    ok("A8 an over-length target is garbage — honest null", readPathrefTarget(longTail) === null);
    ok("A9 a missing marker is honest null", readPathrefTarget(join(dir, "no-such.pathref")) === null);
  }

  console.log("B — the source law (the ONE gate at every carrier)");
  ok("B1 /outputs/file rides the ONE gate", /pathrefHatchApplies\(rel, name\)/.test(fileSrc) && !/isPathrefPath\(/.test(fileSrc));
  ok("B2 /outputs/subvolume-job rides the ONE gate", /pathrefHatchApplies\(rel, name\)/.test(subVolJobSrc) && !/isPathrefPath\(/.test(subVolJobSrc));
  ok("B3 /outputs/subvolume rides the ONE gate (the bare suffix gate is gone)", /pathrefHatchApplies\(rel, name\)/.test(subVolSrc) && !/name\.endsWith\("\.pathref"\)/.test(subVolSrc));
  ok("B4 /map-profile rides the ONE gate (the bare suffix gate is gone)", /pathrefHatchApplies\(rel, resolved\.name\)/.test(mapProfileSrc) && !/resolved\.name\.endsWith\("\.pathref"\)/.test(mapProfileSrc));
  ok("B5 the birthplace builds the gate on the canonical shape", /export function pathrefHatchApplies\(rel: string, name: string\): boolean \{[\s\S]*?isPathrefPath\(rel\) && name\.endsWith\("\.pathref"\)/.test(pathrefSrc));
  {
    // every route file that reads a pathref target rides the gate (or the
    // canonical-by-construction resolver) — the walk catches future drift
    const offenders = [];
    const walk = (base) => {
      for (const ent of readdirSync(base, { withFileTypes: true })) {
        const p = join(base, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.name === "route.ts") {
          const src = readFileSync(p, "utf8");
          if (src.includes("readPathrefTarget(") && !src.includes("pathrefHatchApplies(") && !src.includes("resolveMicrographEntry(")) {
            offenders.push(p.slice(ROOT.length + 1));
          }
        }
      }
    };
    walk(join(ROOT, "src/app/api"));
    ok("B6 every readPathrefTarget carrier rides the gate (api-tree walk)", offenders.length === 0, offenders.join(", ") || "0 offenders");
  }
  {
    const st = statSync(join(ROOT, "src/lib/relion/pathref.ts"));
    ok("B7 the birthplace file's shape unchanged in spirit (the helper joins, nothing moved)", st.isFile() && pathrefSrc.includes("export function resolveMicrographEntry"));
  }

  console.log("C — the t903 continuity");
  ok("C1 the containment seat's import unbroken", containmentSeatSrc.includes('from "@/lib/relion/pathref"') && containmentSeatSrc.includes("isPathrefPath"));
  ok("C2 the livefire seat still present (the planted twins' live witness)", (() => { try { statSync(join(ROOT, "scripts/t903-pathref-livefire.mjs")); return true; } catch { return false; } })());
  ok("C3 the resolver stays canonical-by-construction (pathrefFor-built markers)", pathrefSrc.includes("path.join(micDir, pathrefFor(base))"));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\nt1169 pathref hatch unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
