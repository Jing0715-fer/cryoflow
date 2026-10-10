/**
 * t387 — the duplicate-parameter audit probe (DOES NOT MODIFY ANYTHING).
 *
 * Dumps, for every job type, the merged spec's params with three verdicts:
 *   - engine-read?  : the key (quoted or .params.<key>) appears in engine.ts
 *   - flag?         : the RELION option table gives the param a CLI flag
 *                     (the generic layer can ride it when moved off default)
 *   - alias-owned?  : the key is owned by a curated knob via RELION_ALIASES
 *
 * A param that is NOT engine-read AND has NO flag is a dead control; a param
 * that duplicates another visible control's decision (the mode booleans, the
 * rescale pair, ...) is a duplicate. This script names them so the alias/drop
 * lists in the fix can be checked line by line.
 */
import { readFileSync } from "node:fs";
import { JOB_TYPES } from "../src/lib/workflow";
import { RELION_OPTIONS, RELION_ALIASES } from "../src/lib/relion/option-tables";

const engineSrc = readFileSync(new URL("../src/lib/relion/engine.ts", import.meta.url), "utf8");

// other consumers that may legitimately read a key (UI/summary/parsers)
const otherSrcs = [
  "src/lib/relion/cs2star.ts",
  "src/lib/relion/output-summary.ts",
  "src/lib/relion/log-autopick.ts",
  "src/lib/relion/progress-parse.ts",
  "src/lib/relion/dispatch.ts",
  "src/lib/relion/topaz-training.ts",
  "src/lib/relion/pipeline-script.ts",
  "src/lib/relion/extract-gate.ts",
  "src/lib/import-stage.ts",
  "src/lib/job-presets.ts",
  "src/lib/template-suggest.ts",
  "src/lib/workflow.ts",
  "src/lib/remote/remote-run.ts",
]
  .map((p) => {
    try {
      return readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
    } catch {
      return "";
    }
  })
  .join("\n");

function readAnywhere(key: string): boolean {
  const quoted = `"${key}"`;
  const dotted = `.params.${key}`;
  const bracket = `["${key}"]`;
  return (
    engineSrc.includes(quoted) ||
    engineSrc.includes(dotted) ||
    engineSrc.includes(bracket) ||
    otherSrcs.includes(quoted) ||
    otherSrcs.includes(dotted) ||
    otherSrcs.includes(bracket)
  );
}

interface Row {
  type: string;
  key: string;
  label: string;
  tab: string;
  advanced: boolean;
  flag: string;
  engineRead: boolean;
}

const rows: Row[] = [];
for (const spec of JOB_TYPES) {
  const table = RELION_OPTIONS[spec.key];
  const aliasOwned = new Set(
    Object.values(RELION_ALIASES[spec.key] ?? {}).flatMap((v) => (Array.isArray(v) ? v : [v]))
  );
  for (const p of spec.params) {
    const def = table?.options[p.key];
    rows.push({
      type: spec.key,
      key: p.key,
      label: p.label,
      tab: p.tab ?? "",
      advanced: !!p.advanced,
      flag: def?.flag ?? "",
      engineRead: readAnywhere(p.key),
    });
  }
}

// ---- verdicts ------------------------------------------------------------
const DEAD = rows.filter((r) => !r.engineRead && !r.flag);
const MODE_BOOLEANS = rows.filter(
  (r) => /^(do_refs|do_log|do_topaz|do_topaz_pick|do_topaz_train|do_topaz_train_parts|do_ref3d|continue_manual|do_rescale|use_gpu|do_reextract|do_recenter|do_reset_offsets|do_float16)$/.test(r.key)
);

console.log(`merged spec params total: ${rows.length} across ${JOB_TYPES.length} types\n`);

console.log("== DEAD CONTROLS (no engine read, no CLI flag — setting them changes NOTHING) ==");
for (const r of DEAD) {
  console.log(
    `${r.type.padEnd(14)} ${r.key.padEnd(34)} [${r.tab}]${r.advanced ? " (adv)" : ""}  "${r.label}"`
  );
}

console.log("\n== SUSPECT SET (the t387 duplicate family + known-dead candidates) ==");
for (const r of MODE_BOOLEANS) {
  console.log(
    `${r.type.padEnd(14)} ${r.key.padEnd(24)} engineRead=${r.engineRead} flag="${r.flag}" [${r.tab}]`
  );
}

console.log("\n== text/number params with no flag and no engine read, by type ==");
for (const t of [...new Set(DEAD.map((r) => r.type))]) {
  const mine = DEAD.filter((r) => r.type === t);
  console.log(`\n[${t}] ${mine.length} dead:`);
  for (const r of mine) console.log(`   ${r.key.padEnd(32)} "${r.label}"`);
}

// ---- label collisions inside one type (the rawest duplicate shape) --------
function normLabel(s: string): string {
  return s.toLowerCase().replace(/[?:*]/g, "").replace(/\s+/g, " ").trim();
}
console.log("\n== LABEL COLLISIONS (two controls, one label, same type) ==");
for (const spec of JOB_TYPES) {
  const seen = new Map<string, string[]>();
  for (const p of spec.params) {
    const n = normLabel(p.label);
    if (!n) continue;
    seen.set(n, [...(seen.get(n) ?? []), p.key]);
  }
  for (const [label, keys] of seen) {
    if (keys.length > 1) console.log(`${spec.key.padEnd(14)} "${label}"  ←  ${keys.join(" + ")}`);
  }
}
