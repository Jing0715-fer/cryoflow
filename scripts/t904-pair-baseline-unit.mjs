#!/usr/bin/env node
// t904 — the pair-baseline memory's unit (the t902 geo-restore-unit
// pattern: the lib is importable, the behavior rides REAL calls with a
// localStorage stub, and the component wiring is source-asserted).
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t904-pair-baseline-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readBaselines, baselineFor, rememberBaseline, pairKey } from "@/lib/pair-baseline";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

/** a localStorage stub on a fake window (each test starts empty) */
let bucket = new Map();
const stubWindow = () => {
  bucket = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (bucket.has(k) ? bucket.get(k) : null),
      setItem: (k, v) => bucket.set(k, v),
      removeItem: (k) => bucket.delete(k),
    },
  };
};
const unstub = () => { delete globalThis.window; };

console.log("A — the pair key (order-insensitive storage)");

ok("A1 sorted ids — both arrival orders speak ONE key", pairKey("b", "a") === "a|b" && pairKey("a", "b") === "a|b");
ok("A2 distinct pairs stay distinct", pairKey("a", "b") !== pairKey("a", "c"));

console.log("B — the reads (SSR + corruption guards)");

unstub();
ok("B1 SSR (no window) reads empty", Object.keys(readBaselines()).length === 0);
ok("B2 SSR baselineFor is an honest null", baselineFor("a", "b") === null);

stubWindow();
bucket.set("cryoflow.paramsDiffBaseline.v1", "{not json");
ok("B3 corrupt JSON reads empty (a broken memory never takes the dialog down)", Object.keys(readBaselines()).length === 0);
bucket.set("cryoflow.paramsDiffBaseline.v1", "[1,2]");
ok("B4 an array is not a map — reads empty", Object.keys(readBaselines()).length === 0);
bucket.set("cryoflow.paramsDiffBaseline.v1", '{"a|b":"x","bad":"y","n":3}');
const filtered = readBaselines();
ok("B5 only pair-shaped string entries survive the filter", filtered["a|b"] === "x" && filtered["bad"] === undefined && filtered["n"] === undefined);

console.log("C — the baseline semantics (id, not boolean)");

stubWindow();
rememberBaseline("jobA", "jobB", "jobB");
ok("C1 the remembered baseline reads back", baselineFor("jobA", "jobB") === "jobB");
ok("C2 the arrival order cannot invert it (the sorted pair speaks)", baselineFor("jobB", "jobA") === "jobB");
ok("C3 a stale memory (the job left the pair) is an honest null", baselineFor("jobA", "jobC") === null);
ok("C4 a baseline outside the pair is refused at write time", (() => {
  rememberBaseline("jobA", "jobB", "jobZ");
  return baselineFor("jobA", "jobB") === "jobB";
})());
rememberBaseline("jobA", "jobB", "jobA");
ok("C5 re-choosing the other job overwrites (the user's latest gesture owns)", baselineFor("jobA", "jobB") === "jobA");

console.log("D — the bound (insertion-order eviction, recency refresh)");

stubWindow();
for (let i = 0; i < 24; i++) rememberBaseline(`p${i}`, `q${i}`, `p${i}`);
ok("D1 24 pairs fit", Object.keys(readBaselines()).length === 24);
rememberBaseline("p24", "q24", "p24");
ok("D2 the 25th evicts the OLDEST (p0)", readBaselines()["p0|q0"] === undefined && readBaselines()["p24|q24"] === "p24");
rememberBaseline("p1", "q1", "p1"); // recency refresh
rememberBaseline("p25", "q25", "p25");
ok("D3 the refreshed p1 survives the next eviction (p2 goes instead)", readBaselines()["p1|q1"] === "p1" && readBaselines()["p2|q2"] === undefined);

console.log("E — the wiring (source-level, the #13 law)");

const dlg = readFileSync(join(process.cwd(), "src/components/workflow/params-diff-dialog.tsx"), "utf8");
ok("E1 the dialog imports the lib (the t653 law — no local storage logic)", dlg.includes('from "@/lib/pair-baseline"'));
ok("E2 the restore lives in the render-time adjust (the pair change)", /if \(seenPair !== pairKey\) \{[\s\S]{0,300}?baselineFor\(/.test(dlg));
ok("E3 the write lives in the swap gesture's onClick (no render-path writes)", /onClick=\{\(\) => \{[\s\S]{0,400}?rememberBaseline\(/.test(dlg));
ok("E4 the remembered baseline is the NEW left column (next ? jobs[1] : jobs[0])", dlg.includes("next ? jobs[1].id : jobs[0].id"));
ok("E5 the restore compares against jobs[1] (swap true only when the memory wants the right job left)", dlg.includes("remembered === jobs[1]?.id"));
ok("E6 no useState write of swapped outside the two legal sites", (dlg.match(/setSwapped\(/g) || []).length === 2);
ok("E7 the swap title says the memory (the user can discover the seat)", dlg.includes("your baseline is remembered for this pair"));

console.log("F — the verdict (why no whisper seats here, pinned in lib)");

const lib = readFileSync(join(process.cwd(), "src/lib/pair-baseline.ts"), "utf8");
ok("F1 the self-evidence verdict is pinned", lib.includes("self-evident"));
ok("F2 the boolean-inversion law is pinned (why an id, not a flag)", lib.includes("silently INVERT"));
ok("F3 the quota law is pinned (best-effort memory, honest default)", lib.includes("best-effort by design"));

unstub();
console.log(`\nt904 pair-baseline unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
