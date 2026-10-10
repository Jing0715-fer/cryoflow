// t577 — the in-place census doubling, reproduced in isolation (t575's
// "diagnostic cosmetics" debt). The specimen (data/deleted-jobs):
//   CRYOFLOW_NOTE: … reads it in place at <FS_ROOT>/projects/cryoflow/<proj>/extract_uxfic7tb/particles.star
//   and that read failed: exit 2: …fs/home/z/my-project/services/mock-cluster/fs/projects/…
// i.e. awk received <FS_ROOT> + <FS_ROOT>/projects/… — the FS_ROOT prefix
// STACKED. This script lifts translateCommand verbatim from server.mjs's
// source text (no import — the server is not a module) and replays the
// exact census awk shape against the exact clusterStar shape.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "services/mock-cluster/server.mjs"), "utf8");

// lift FS_ROOT + the two translation regexes exactly as the server builds them
const FS_ROOT = join(root, "services/mock-cluster/fs");
const shSingleQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// — lifted verbatim from server.mjs (t387 block) —
function escForRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function translateCommand(cmd) {
  let out = String(cmd);
  for (const mount of ["projects", "home/cryo", "data2"]) {
    out = out.replace(
      new RegExp(`(?<!${escForRe(FS_ROOT)})/${mount}/`, "g"),
      `${FS_ROOT}/${mount}/`
    );
  }
  out = out.replace(
    new RegExp(`(?<!${escForRe(FS_ROOT)})/(data2|projects|home/cryo)(?=['"\\s;&|)]|$)`, "g"),
    `${FS_ROOT}/$1`
  );
  return out;
}

// the exact census command shape from remote-run.ts clusterParticleRefCensus
const clusterStar = `${FS_ROOT}/projects/cryoflow/cmuro2ufe000mn5nb3qkwuy49/extract_uxfic7tb/particles.star`;
const awk =
  `awk '` +
  `/^[0-9]+@/ { ` +
  `at = index($0, "@"); ` +
  `img = substr($0, 1, at - 1) + 0; ` +
  `ref = substr($0, at + 1); ` +
  `sub(/[ \\t].*$/, "", ref); ` +
  `if (ref != "") { if (!(ref in mx) || img > mx[ref]) mx[ref] = img; n++ } ` +
  `} ` +
  `END { ` +
  `for (r in mx) printf "CF_REF\\t%s\\t%d\\n", r, mx[r]; ` +
  `printf "CF_TOTAL\\t%d\\n", n ` +
  `}' ${shSingleQuote(clusterStar)}`;

let pass = 0, fail = 0;
const check = (name, ok, evidence) => {
  if (ok) { pass++; console.log(`  ✓ ${name}${evidence ? ` — ${evidence}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${evidence ? ` — ${evidence}` : ""}`); }
};

console.log("t577 census-doubling repro");
console.log(`  FS_ROOT = ${FS_ROOT}`);

// Face 1: the fs-rooted absolute path must pass through UNCHANGED
const t1 = translateCommand(awk);
check(
  "fs-rooted clusterStar survives translation untouched",
  t1.includes(shSingleQuote(clusterStar)),
  t1 === awk ? "byte-identical" : "CHANGED"
);
check(
  "no prefix stacking in translated command",
  !t1.includes(`${FS_ROOT}${FS_ROOT.slice(1)}`) && !t1.includes(`fs/home/z/my-project/services`),
  t1.slice(-160)
);

// Face 2: the honest cluster-absolute path (the twin grammar) still translates
const clusterStar2 = "/projects/cryoflow/cmuro2ufe000mn5nb3qkwuy49/extract_uxfic7tb/particles.star";
const t2 = translateCommand(`awk 'END{print 1}' ${shSingleQuote(clusterStar2)}`);
check(
  "cluster-absolute /projects/ path translates into the fs root",
  t2.includes(shSingleQuote(`${FS_ROOT}/projects/cryoflow/...`.replace("/...", "")) ) === false
    ? t2.includes(`${FS_ROOT}/projects/cryoflow/`)
    : false,
  t2.slice(-140)
);
check("no stacking on the translated twin path either", !t2.includes(`${FS_ROOT}${FS_ROOT}`));

// Face 3: the MIXED command (t387's relink shape) keeps both sides honest
const mixed = `ln -sfn '/data2/t387/particles.mrcs' '${FS_ROOT}/home/cryo/relion/x/micrographs/particles.mrcs'`;
const t3 = translateCommand(mixed);
check(
  "mixed command: /data2 target translates, fs-rooted link path stays",
  t3.includes(`'${FS_ROOT}/data2/t387/particles.mrcs'`) && t3.includes(`'${FS_ROOT}/home/cryo/relion/x/micrographs/particles.mrcs'`),
  ""
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
