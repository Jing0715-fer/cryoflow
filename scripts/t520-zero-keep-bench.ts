/**
 * t520 bench — the zero-keep verdict gets an honest branch.
 *
 * The field test's finding (t519): all-junk worlds got text advice with no
 * action block. The deeper wound found while scoping this fix: the old
 * nextStep literally instructed select_classes({classes:[]}) — a call the
 * tool REFUSES ("classes must be a non-empty list of class numbers"), so
 * the instruction pointed at a wall while the user got prose. This bench
 * pins the FOUR-QUADRANT contract the judge's tool result now speaks:
 *
 *   keep>0 maybe>0 → tiers {conservative, inclusive}  (t519's law, unchanged)
 *   keep>0 maybe=0 → tiers {single}                    (t519's law, unchanged)
 *   keep=0 maybe>0 → tiers {borderline} + re-run guidance (the gamble, named)
 *   keep=0 maybe=0 → NO tiers at all + re-run guidance    (absence speaks)
 *
 * and the prompt's law 5 that teaches the model the same doctrine.
 */
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, note = "") => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${note ? ` (got: ${note})` : ""}`); }
};

console.log("t520 bench — the zero-keep branch (verdict → honest guidance)");

const toolsSrc = readFileSync(new URL("../src/lib/ai/tools.ts", import.meta.url), "utf8");
const promptSrc = readFileSync(new URL("../src/lib/ai/prompt.ts", import.meta.url), "utf8");

/* T1 — the branch exists and refuses the wall */
{
  console.log("\nT1 — the zero-keep branch (source contract)");
  ok("zeroKeep predicate defined", /const zeroKeep = verdict !== null && keepCls\.length === 0;/.test(toolsSrc));
  ok("branch precedes the selection branch", /zeroKeep\s*\n\s*\? \{/.test(toolsSrc));
  ok("nextStep names the tool's refusal", /select_classes REFUSES an empty list, so do NOT call it/.test(toolsSrc));
  ok("the refusal quotes the real error", /classes must be a non-empty list of class numbers/.test(toolsSrc));
  ok("verdict is about the RUN", /The verdict is about the RUN, not a selection to force/.test(toolsSrc));
  ok("zero-keep summary is unmissable", /NO class merits a selection \(zero-keep verdict\)/.test(toolsSrc));
}

/* T2 — the re-run trade-offs (law 16's action block, pre-staged) */
{
  console.log("\nT2 — the re-run guidance");
  ok("fewer classes option named", /重跑·减类数.*fewer classes/.test(toolsSrc));
  ok("more iterations option named", /重跑·加迭代.*more iterations/.test(toolsSrc));
  ok("upstream inspection option named", /先查上游.*get_funnel_chain/.test(toolsSrc));
  ok("fewer-classes count is computed, not hard-coded", /const fewerClasses = Math\.max\(2, Math\.floor\(classTotal \/ 2\)\);/.test(toolsSrc));
  ok("says it is a data-or-params problem", /a data-or-params problem, not a patience problem/.test(toolsSrc));
  ok("closes as an action block (law 16)", /close with an action block \(law 16\)/.test(toolsSrc));
}

/* T3 — the borderline tier: the gamble, named */
{
  console.log("\nT3 — the borderline tier");
  ok("0 keep + maybe>0 ships {borderline}", /maybeCls\.length > 0 \? \{ tiers: \{ borderline: maybeCls \} \} : \{\}/.test(toolsSrc));
  ok("borderline is called a gamble, never advice", /offer it only as the explicit gamble, never as advice/.test(toolsSrc));
  ok("0 keep + 0 maybe ships NO tiers", /\.\.\.\(maybeCls\.length > 0 \? \{ tiers: \{ borderline: maybeCls \} \} : \{\}\)/.test(toolsSrc));
}

/* T4 — the four-quadrant arithmetic (behavioral, the tool's exact logic) */
{
  console.log("\nT4 — four-quadrant tier computation");
  const mk = (verdicts: Array<[number, "keep" | "maybe" | "reject"]>) =>
    verdicts.map(([cls, verdict]) => ({ cls, verdict, reason: "r" }));
  const compute = (verdict: { classes: Array<{ cls: number; verdict: string }> } | null) => {
    const keepCls = verdict ? verdict.classes.filter((c) => c.verdict === "keep").map((c) => c.cls).sort((a, b) => a - b) : [];
    const maybeCls = verdict ? verdict.classes.filter((c) => c.verdict === "maybe").map((c) => c.cls).sort((a, b) => a - b) : [];
    const zeroKeep = verdict !== null && keepCls.length === 0;
    // the tool's exact branch structure, replicated verbatim
    const tiers = zeroKeep
      ? (maybeCls.length > 0 ? { borderline: maybeCls } : undefined)
      : maybeCls.length > 0
        ? { conservative: keepCls, inclusive: [...keepCls, ...maybeCls].sort((a, b) => a - b) }
        : { single: keepCls };
    return { tiers, zeroKeep };
  };

  const q1 = compute({ classes: mk([[1, "keep"], [3, "maybe"], [5, "keep"], [7, "maybe"], [9, "reject"]]) });
  ok("Q1 keep>0 maybe>0 → conservative [1,5] / inclusive [1,3,5,7]",
    JSON.stringify(q1.tiers) === JSON.stringify({ conservative: [1, 5], inclusive: [1, 3, 5, 7] }), JSON.stringify(q1.tiers));
  const q2 = compute({ classes: mk([[2, "keep"], [4, "reject"], [6, "keep"]]) });
  ok("Q2 keep>0 maybe=0 → single [2,6]", JSON.stringify(q2.tiers) === JSON.stringify({ single: [2, 6] }), JSON.stringify(q2.tiers));
  const q3 = compute({ classes: mk([[1, "maybe"], [2, "maybe"], [3, "reject"], [4, "reject"]]) });
  ok("Q3 keep=0 maybe>0 → borderline [1,2]", JSON.stringify(q3.tiers) === JSON.stringify({ borderline: [1, 2] }), JSON.stringify(q3.tiers));
  const q4 = compute({ classes: mk([[1, "reject"], [2, "reject"], [3, "reject"]]) });
  ok("Q4 keep=0 maybe=0 → NO tiers (undefined)", q4.tiers === undefined, String(q4.tiers));
  ok("Q3 and Q4 both flag zeroKeep", q3.zeroKeep && q4.zeroKeep && !q1.zeroKeep && !q2.zeroKeep);
}

/* T5 — the zero-keep nextStep content contract (rendered fixture) */
{
  console.log("\nT5 — the zero-keep nextStep speaks all its promises");
  // simulate the exact template with a fixture: 12 classes, all reject
  const classTotal = 12, fewerClasses = Math.max(2, Math.floor(classTotal / 2)), maybeCls: number[] = [];
  const jobName = "2D Classification 1";
  const nextStep = `ZERO keepable classes (0 keep / 0 maybe of ${classTotal}) — select_classes REFUSES an empty list, so do NOT call it. The verdict is about the RUN, not a selection to force: close with an action block (law 16) offering the re-run trade-offs — [重跑·减类数] re-run ${jobName} with fewer classes (${fewerClasses} instead of ${classTotal} — too many classes shred a weak signal into noise), [重跑·加迭代] more iterations (these classes may not have settled), [先查上游] inspect what feeds it (get_funnel_chain on the chain, or judge the picks). Say plainly that a run with zero solid keeps is a data-or-params problem, not a patience problem.`;
  ok("names the run's totals (0/0 of 12)", nextStep.includes("0 keep / 0 maybe of 12"));
  ok("suggests half the classes (6, not a hard-coded number)", nextStep.includes("6 instead of 12"));
  ok("names the job exactly", nextStep.includes("re-run 2D Classification 1 with fewer classes"));
  ok("no empty classes:[] instruction anywhere", !/classes:\s*\[\]/.test(nextStep));
  const borderlineStep = nextStep + ` The borderline set [${[3, 8].join(", ")}] is the only non-empty selection this verdict permits — offer it only as the explicit gamble, never as advice.`;
  ok("borderline variant names the set and the gamble", borderlineStep.includes("The borderline set [3, 8]") && borderlineStep.includes("explicit gamble"));
}

/* T6 — the prompt teaches the same doctrine (law 5) */
{
  console.log("\nT6 — prompt law 5 carries the zero-keep doctrine");
  ok("refuses the empty call", /do NOT call select_classes — it refuses empty class lists/.test(promptSrc));
  ok("verdict about the RUN", /a zero-keep verdict is advice about the RUN, not a selection to force/.test(promptSrc));
  ok("re-run trade-offs in the action block", /present the re-run trade-offs as an action block instead \(fewer classes \/ more iterations \/ inspect the upstream data\)/.test(promptSrc));
  ok("borderline is the gamble, never advice", /only mention the borderline \(maybe\) set as the explicit gamble it is, never as advice/.test(promptSrc));
}

/* T7 — sibling regression: t519's non-zero-keep contract is untouched */
{
  console.log("\nT7 — t519 sibling contract (non-zero-keep paths unchanged)");
  ok("tiers still inline after the zero-keep ternary", /\? zeroKeep\s*\n\s*\? \{[\s\S]{0,3000}?tiers:\s*\n\s*maybeCls\.length > 0/.test(toolsSrc));
  ok("conservative = keep only", /conservative: keepCls/.test(toolsSrc));
  ok("inclusive = keep + maybe", /inclusive: \[\.\.\.keepCls, \.\.\.maybeCls\]/.test(toolsSrc));
  ok("single tier when maybe is empty", /single: keepCls/.test(toolsSrc));
  ok("nextStep keeps the TWO-tier presentation", /offer the TWO tiers as separate actions/.test(toolsSrc));
  ok("nextStep keeps the RAN contract", /executes immediately/.test(toolsSrc));
}

/* T8 — the stackless world's feed: derive the stack name from per-class .mrc */
{
  console.log("\nT8 — stackless judge feed (derive + pull lane)");
  ok("derivation helper exported", /export function deriveClassStackFromPerClass\(/.test(toolsSrc));
  ok("naming law documented (classMMM ⇔ classes.mrcs)", /run_itNNN_classMMM\.mrc ⇔ run_itNNN_classes\.mrcs/.test(toolsSrc));
  ok("judge consults the derivation when the scan found no stack", /if \(!stackFile\) \{\s*\n\s*stackFile = deriveClassStackFromPerClass\(workdir, stats\.iteration\);/.test(toolsSrc));
  ok("the pull lane drinks the derived name (not stats.stackFile)", /fetchRemoteFileIntoWorkdir\(run, stackFile\)/.test(toolsSrc));
  ok("the old lie about finished runs is retired by construction", /stackFile \|\| stats\.classes\.length === 0/.test(toolsSrc));
  // behavioral: the derivation's own arithmetic on fixture dir listings
  const { mkdirSync, rmSync, writeFileSync, readdirSync } = await import("node:fs");
  const tmp = `/tmp/t520-derive-${process.pid}`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  // no per-class files → nothing to derive
  const deriveLocal = (dir: string, iteration: number | null) => {
    if (iteration == null) return null;
    const it = String(iteration).padStart(3, "0");
    const prefix = `run_it${it}_class`;
    let names: string[] = [];
    try { names = readdirSync(dir); } catch { return null; }
    const perClass = names.filter((n) => n.startsWith(prefix) && /\.mrc$/i.test(n));
    if (perClass.length === 0) return null;
    return `run_it${it}_classes.mrcs`;
  };
  ok("empty dir derives nothing", deriveLocal(tmp, 200) === null);
  ok("null iteration derives nothing", deriveLocal(tmp, null) === null);
  for (let c = 1; c <= 12; c++) writeFileSync(`${tmp}/run_it200_class${String(c).padStart(3, "0")}.mrc`, "x");
  ok("12 per-class files at it200 → run_it200_classes.mrcs", deriveLocal(tmp, 200) === "run_it200_classes.mrcs");
  ok("per-class files of ANOTHER iteration do not leak (it199 → null)", deriveLocal(tmp, 199) === null);
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nt520 bench: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
