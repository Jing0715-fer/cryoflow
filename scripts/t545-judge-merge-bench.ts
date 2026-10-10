/**
 * t545 bench — the two-pass judge merge.
 *
 * t519's field test found the judge's Achilles heel: edge classes flip
 * between keep and maybe across runs (7/11 borderline, while the keep
 * core held 4/5). The fix is structural, not a temperature prayer: the
 * judge reads the same sheet twice under the same rubric and ships only
 * what survives both reads (judge-merge.ts).
 *
 * This bench pins the MERGE LAW table, the honest-degradation edges, and
 * the tools.ts wiring contract (the confirm pass exists, degrades with a
 * spoken note, and never touches the zero-keep doctrine's exact lines —
 * t520's bench owns those strings).
 */
import { readFileSync } from "node:fs";
import { mergeJudgePasses, type JudgeVerdict } from "../src/lib/ai/judge-merge";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, note = "") => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${note ? ` (got: ${note})` : ""}`); }
};

const v = (entries: [number, string, string][], advice = "advice-a"): JudgeVerdict => ({
  classes: entries.map(([cls, verdict, reason]) => ({ cls, verdict, reason })),
  advice,
});

console.log("t545 bench — the two-pass judge merge");

/* T1 — the merge law table (both passes name the class) */
{
  console.log("\nT1 — agreement and disagreement");
  const m = mergeJudgePasses(
    v([[1, "keep", "r1-keep"], [2, "reject", "r1-reject"], [3, "maybe", "r1-maybe"]]),
    v([[1, "keep", "r2-keep"], [2, "reject", "r2-reject"], [3, "maybe", "r2-maybe"]])
  );
  ok("keep ∩ keep = keep", m.verdict.classes[0].verdict === "keep");
  ok("agreement keeps the FIRST read's reason", m.verdict.classes[0].reason === "r1-keep");
  ok("reject ∩ reject = reject", m.verdict.classes[1].verdict === "reject");
  ok("maybe ∩ maybe = maybe (uncertainty is a verdict)", m.verdict.classes[2].verdict === "maybe");

  const m2 = mergeJudgePasses(
    v([[1, "keep", "r1"], [2, "keep", "r1"], [3, "maybe", "r1"], [4, "reject", "r1"], [5, "maybe", "r1"], [6, "reject", "r1"]]),
    v([[1, "maybe", "r2"], [2, "reject", "r2"], [3, "keep", "r2"], [4, "keep", "r2"], [5, "reject", "r2"], [6, "maybe", "r2"]])
  );
  ok("keep+maybe → maybe (demotion, both orders)", m2.verdict.classes[0].verdict === "maybe" && m2.verdict.classes[2].verdict === "maybe");
  ok("keep+reject → maybe (torn, never silently deleted)", m2.verdict.classes[1].verdict === "maybe");
  ok("reject+maybe / reject+keep → maybe", m2.verdict.classes[3].verdict === "maybe" && m2.verdict.classes[5].verdict === "maybe");
  ok("disagreement carries the SECOND read's reason (the dissent)", m2.verdict.classes[1].reason === "r2", m2.verdict.classes[1].reason);
  ok("torn count = 6", m2.torn === 6, String(m2.torn));
  ok("agreed count = 0", m2.agreed === 0, String(m2.agreed));
  ok("moved telemetry: from keep to maybe", m2.moved.some((x) => x.cls === 1 && x.from === "keep" && x.to === "maybe"));
  ok("moved telemetry: from reject to maybe", m2.moved.some((x) => x.cls === 4 && x.from === "reject" && x.to === "maybe"));
  ok("advice stays the first read's", m2.verdict.advice === "advice-a");
}

/* T2 — one-sided classes: an unconfirmed read is a maybe */
{
  console.log("\nT2 — missing sides");
  const m = mergeJudgePasses(
    v([[1, "keep", "r1-only"], [2, "reject", "r1-only"]]),
    v([[3, "keep", "r2-only"]])
  );
  ok("class named only by pass 1 → maybe", m.verdict.classes.find((c) => c.cls === 1)?.verdict === "maybe");
  ok("class named only by pass 2 → maybe", m.verdict.classes.find((c) => c.cls === 3)?.verdict === "maybe");
  ok("missing count = 3", m.missing === 3, String(m.missing));
  ok("pass-1 keep demoted by absence lands in moved", m.moved.some((x) => x.cls === 1 && x.from === "keep" && x.to === "maybe"));
  ok("classes sort by class number", m.verdict.classes.map((c) => c.cls).join(",") === "1,2,3");
}

/* T3 — degenerate confirm: parsed but empty */
{
  console.log("\nT3 — degenerate confirm");
  const a = v([[1, "keep", "r1"], [2, "reject", "r1"]], "only-advice");
  const m = mergeJudgePasses(a, v([]));
  ok("degenerate flag set", m.degenerate === true);
  ok("pass 1 ships untouched", m.verdict === a);
  ok("no moves invented", m.moved.length === 0);
}

/* T4 — the tools.ts wiring contract (source pins) */
{
  console.log("\nT4 — the two-pass wiring (source contract)");
  const toolsSrc = readFileSync(new URL("../src/lib/ai/tools.ts", import.meta.url), "utf8");
  ok("judge-merge imported", /import \{ mergeJudgePasses \} from "\.\/judge-merge"/.test(toolsSrc));
  ok("JudgeVerdict re-exported from the merge module", /export type \{ JudgeVerdict \} from "\.\/judge-merge"/.test(toolsSrc));
  ok("the confirm pass runs the SAME rubric prompt", /const confirmAnalysis = await visionOnce\(\{[\s\S]*?prompt,\s*\n\s*imageBase64/.test(toolsSrc));
  ok("merged verdict replaces the first before the counts", /verdict = merged\.verdict;\s*\n\s*\} else \{/.test(toolsSrc));
  ok("failed confirm speaks (never silence)", /second pass unreadable — first verdict stands/.test(toolsSrc));
  ok("telemetry note names the two-pass", /· two-pass: \$\{confirm\.agreed\} agreed/.test(toolsSrc));
  ok("thrown confirm degrades, not dies", /catch \{\s*\n\s*confirm = \{ failed: true \};/.test(toolsSrc));
  ok("detail carries the confirm block", /judgedClasses: verdict\?\.classes \?\? null,\s*\n\s*confirm,/.test(toolsSrc));
  // t520's zero-keep strings must be untouched by this edit
  ok("t520 zeroKeep line untouched", /const zeroKeep = verdict !== null && keepCls\.length === 0;/.test(toolsSrc));
  ok("t520 refusal doctrine untouched", /select_classes REFUSES an empty list, so do NOT call it/.test(toolsSrc));
}

/* T5 — merge is pure: same inputs, same output (twice) */
{
  console.log("\nT5 — purity");
  const a = v([[1, "keep", "r1"], [2, "maybe", "r1"]]);
  const b = v([[1, "keep", "r2"], [2, "keep", "r2"]]);
  const m1 = mergeJudgePasses(a, b);
  const m2 = mergeJudgePasses(a, b);
  ok("same inputs → same merge", JSON.stringify(m1) === JSON.stringify(m2));
  ok("inputs not mutated", JSON.stringify(a.classes) === JSON.stringify([[1, "keep", "r1"], [2, "maybe", "r1"]].map(([c, vv, r]) => ({ cls: c, verdict: vv, reason: r }))));
}

console.log(`\nt545 bench: ${pass} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
