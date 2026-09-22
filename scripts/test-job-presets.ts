/**
 * CryoFlow — job-preset sanity test.
 *
 * Validates every JOB_PRESETS entry against the LIVE spec in workflow.ts:
 *   1. the type key exists in JOB_TYPES;
 *   2. every param key is a real schema key of that type (server would
 *      silently drop unknown keys — that would make the preset lie);
 *   3. numeric values respect the schema's declared min/max;
 *   4. select values are members of the schema's option list;
 *   5. boolean values are booleans.
 *
 * Run: bun scripts/test-job-presets.ts
 */

import { JOB_TYPES, jobType } from "../src/lib/workflow";
import { JOB_PRESETS } from "../src/lib/job-presets";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};

console.log(`validating ${JOB_PRESETS.length} presets against ${JOB_TYPES.length} types…\n`);

for (const p of JOB_PRESETS) {
  console.log(`▸ ${p.type} · "${p.preset}"`);
  const spec = jobType(p.type);
  if (!spec) {
    fail(`unknown job type "${p.type}"`);
    continue;
  }
  const schema = new Map(spec.params.map((s) => [s.key, s]));
  for (const [key, value] of Object.entries(p.params)) {
    const def = schema.get(key);
    if (!def) {
      fail(`param "${key}" is not in ${p.type}'s schema (server would drop it silently)`);
      continue;
    }
    if (def.type === "number") {
      if (typeof value !== "number") {
        fail(`param "${key}" expects a number, preset has ${JSON.stringify(value)}`);
        continue;
      }
      if (typeof def.min === "number" && value < def.min) {
        fail(`param "${key}" = ${value} < declared min ${def.min}`);
      }
      if (typeof def.max === "number" && value > def.max) {
        fail(`param "${key}" = ${value} > declared max ${def.max}`);
      }
    } else if (def.type === "select") {
      const options = def.options ?? [];
      if (typeof value !== "string" || !options.includes(value)) {
        fail(`param "${key}" = ${JSON.stringify(value)} not in options [${options.join(", ")}]`);
      }
    } else if (def.type === "bool") {
      if (typeof value !== "boolean") {
        fail(`param "${key}" expects a boolean, preset has ${JSON.stringify(value)}`);
      }
    }
  }
  if (Object.keys(p.params).length === 0) {
    fail("preset overrides nothing — remove it (plain add already gives defaults)");
  }
}

console.log("");
if (failures > 0) {
  console.error(`FAIL — ${failures} problem(s)`);
  process.exit(1);
}
console.log(`PASS — ${JOB_PRESETS.length} presets all consistent with the live spec`);
