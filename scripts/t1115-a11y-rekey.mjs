/**
 * t1115 — the a11y roster re-key (the text-surgery law: a formal
 * script, never an inline regex injection; grep the silent compliers
 * first). The direction walk's EXPORT added ONE named interactive
 * control to the panel: its idle aria-label joins the population
 * (174 → 175) and its busy aria-label joins the stateful roster
 * (152 → 153). Three units carry the same world-shape tallies, each
 * re-keyed at t1096/t1098/t1105 with named reasons — the t1115 reason
 * joins the same lists:
 *   t982-aria-refusal-unit.mjs  A2 (population) + A3 (stateful)
 *   t998-workspace-rename-unit.mjs  B22 + B23
 *   t999-pointer-wall-echo-unit.mjs  C2 + C3
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "/home/z/my-project/scripts/t982-aria-refusal-unit.mjs",
  "/home/z/my-project/scripts/t998-workspace-rename-unit.mjs",
  "/home/z/my-project/scripts/t999-pointer-wall-echo-unit.mjs",
  "/home/z/my-project/scripts/t1002-rename-busy-unit.mjs",
];

const REASON = "+1 the t1115 direction walk export name";
const REASON_STATE = "+1 from the t1115 direction walk export's busy name";

const swaps = [
  // population: the literal, the name's reason list tail, both sides
  [
    "population = 174 (the world's shape; +1 the t1096 filmstrip walk name, +1 the t1098 ortho walk name, +1 the t1105 print-plate busy door)",
    "population = 175 (the world's shape; +1 the t1096 filmstrip walk name, +1 the t1098 ortho walk name, +1 the t1105 print-plate busy door, " + REASON + ")",
  ],
  [
    "population = 174 (the cured faces were never in it — the no-re-key ruling, live; +1 the t1096 filmstrip walk name, +1 the t1098 ortho walk name, +1 the t1105 print-plate busy door)",
    "population = 175 (the cured faces were never in it — the no-re-key ruling, live; +1 the t1096 filmstrip walk name, +1 the t1098 ortho walk name, +1 the t1105 print-plate busy door, " + REASON + ")",
  ],
  [
    "population = 174 (the grips carry no disabled prop — the no-shift ruling, live; +1 the t1096 filmstrip walk name, +1 the t1098 ortho walk name, +1 the t1105 print-plate busy door)",
    "population = 175 (the grips carry no disabled prop — the no-shift ruling, live; +1 the t1096 filmstrip walk name, +1 the t1098 ortho walk name, +1 the t1105 print-plate busy door, " + REASON + ")",
  ],
  [
    "receipt?.population === 174",
    "receipt?.population === 175",
  ],
  // stateful: the literal, the name's reason list tail, both sides
  [
    "the 1 t1105 print-plate busy name)\"",
    "the 1 t1105 print-plate busy name, " + REASON_STATE + ")\"",
  ],
  [
    "+1 from the t1096 filmstrip walk name, +1 from the t1098 ortho walk name, +1 from the t1105 print-plate busy name)\"",
    "+1 from the t1096 filmstrip walk name, +1 from the t1098 ortho walk name, +1 from the t1105 print-plate busy name, " + REASON_STATE + ")\"",
  ],
  [
    "receipt?.tally?.stateful === 152",
    "receipt?.tally?.stateful === 153",
  ],
  // the stateful headline numbers in the names (152 → 153)
  [
    "A3 stateful = 152 (61 standing",
    "A3 stateful = 153 (61 standing",
  ],
  [
    "B23 stateful = 152 (the delete door",
    "B23 stateful = 153 (the delete door",
  ],
  [
    "C3 stateful = 152 (the panel's population tags unmoved",
    "C3 stateful = 153 (the panel's population tags unmoved",
  ],
  // t1002-rename-busy-unit — R8a/R8b (the disabled census's own tallies)
  [
    "R8a the disabled census's population stands at 174 (the busy gate added no disabled row; +1 the t1096 filmstrip walk name, +1 the t1098 ortho walk name, +1 the t1105 print-plate busy door)",
    "R8a the disabled census's population stands at 175 (the busy gate added no disabled row; +1 the t1096 filmstrip walk name, +1 the t1098 ortho walk name, +1 the t1105 print-plate busy door, " + REASON + ")",
  ],
  [
    "R8b stateful 152 · silent-static 0 · silences 22",
    "R8b stateful 153 · silent-static 0 · silences 22",
  ],
  [
    "(+1 the busy door's flip voice), this unit's own no-disabled-prop law stands untouched",
    "(+1 the busy door's flip voice) + the t1115 direction walk arm (+1 the export button's busy voice), this unit's own no-disabled-prop law stands untouched",
  ],
];

let totalSwaps = 0;
for (const f of FILES) {
  let src = readFileSync(f, "utf8");
  // idempotency by MARKER — read from the DISK bytes BEFORE any swap:
  // the swaps mutate src in memory (the reason strings and the 153
  // literal enter it), so a post-swap check would always misfire
  if (src.includes(REASON) && src.includes("=== 153")) {
    console.log(`${f.split("/").pop()}: already re-keyed`);
    continue;
  }
  let n = 0;
  for (const [oldS, newS] of swaps) {
    const c = src.split(oldS).length - 1;
    if (c > 0) {
      src = src.split(oldS).join(newS);
      n += c;
    }
  }
  // the post-swap fallback (a file re-keyed by other means — the
  // literals present, the reason absent) reads the MUTATED src, which
  // is fine: it fired only when nothing matched
  if (n === 0 && src.includes("175") && src.includes("153")) {
    console.log(`${f.split("/").pop()}: already re-keyed`);
    continue;
  }
  if (n < 5) {
    console.error(`FATAL ${f}: only ${n} swaps landed (want ≥5) — the anchors moved`);
    process.exit(1);
  }
  writeFileSync(f, src);
  totalSwaps += n;
  console.log(`${f.split("/").pop()}: ${n} swaps landed`);
}
console.log(`a11y roster re-keyed: ${totalSwaps} swaps, reasons named`);
