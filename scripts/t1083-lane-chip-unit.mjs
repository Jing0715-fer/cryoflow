#!/usr/bin/env node
/**
 * t1083 — THE LANE CHIP unit (node-only, source-wiring): the product face
 * of the standalone lane exam.
 *
 * THE STORY: the exam measured the two lanes honestly (dev ~1.85GB
 * resident vs prod ~190MB; the build greens in 56s on the stripped box;
 * chrome + prod + ambient = 1088MB used with 2952MB still free). A lane
 * an operator cannot SEE is a lane they cannot trust — so the footer's
 * served-build stamp (t401) grew a sibling: the served-lane chip.
 *
 * THE HONESTY CORE: the chip reads process.env.NODE_ENV === "production",
 * which webpack's DefinePlugin INLINES at bundle time. The comparison is
 * compiled into the very bundle the browser loaded — the dev server's
 * bundle says "development" forever, the built standalone's says
 * "production" forever. The chip cannot drift from the process that
 * served the page; it cannot be fooled by a runtime env var, a config
 * file, or a stale API answer. The dot speaks the workshop (amber, dev)
 * or the serving hall (teal, prod); the words name it for the colorblind
 * reader; the tooltip carries each lane's refresh law (restart vs
 * rebuild) — the same laws the build stamp's tooltip carries, now one
 * lane apart.
 *
 * PROTOCOL: node-only, read-only toward the tree (no server, no db, no
 * spawn) — pure source assertions, exit honest.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

const footer = read("src/components/workflow/footer.tsx");

/* ---------- L — the lane chip ---------- */

// L1: the chip's data seat exists (the QA contract's hook).
ok("L1: the chip carries data-testid=footer-lane", footer.includes('data-testid="footer-lane"'));

// L2: the honesty core — the grammar is the bundle-inlined NODE_ENV
// comparison, not a runtime fetch, a store read, or an API answer.
ok(
  "L2: the lane reads the bundle-inlined NODE_ENV (=== \"production\")",
  footer.includes('process.env.NODE_ENV === "production"'),
  "any other source (store, API, runtime env) could drift from the serving process"
);

// L3: the two labels — the words name the lane for the colorblind reader.
ok(
  "L3: the labels are 'prod lane' / 'dev lane'",
  footer.includes('"prod lane"') && footer.includes('"dev lane"')
);

// L4: the dot tokens are the app's own vocabulary (warning = the workshop,
// success = the serving hall) — no ad-hoc color literal.
ok(
  "L4: the dot speaks the app's own tokens (bg-warning-500 / bg-success-500)",
  footer.includes('"bg-success-500"') && footer.includes('"bg-warning-500"')
);

// L5: the tooltip carries EACH lane's refresh law (restart vs rebuild) —
// a lane chip whose tooltip cannot say how to leave the lane is decoration.
ok(
  "L5: the prod tooltip names the rebuild law",
  /isProdLane\s*\n?\s*\?\s*["'`][^"'`]*rebuild/.test(footer)
);
ok(
  "L6: the dev tooltip names the restart law (and the exam's measured appetite)",
  /:\s*["'`][^"'`]*restart[^"'`]*["'`]/.test(footer) && /1\.85GB/.test(footer)
);

// L7: the chip lives beside the served-build stamp (after it, inside the
// same hidden-sm:flex rail) — the two stamps are one fact, two halves:
// WHICH commit and WHICH lane served it.
const buildStampIdx = footer.indexOf("Served build — the git commit");
const laneIdx = footer.indexOf('data-testid="footer-lane"');
ok(
  "L7: the chip sits beside the t401 build stamp (same rail, after it)",
  buildStampIdx > 0 && laneIdx > buildStampIdx,
  `stamp@${buildStampIdx} lane@${laneIdx}`
);

console.log(`\n===== t1083 lane-chip unit: ${pass}/${pass + fail} green =====`);
process.exit(fail === 0 ? 0 : 1);
