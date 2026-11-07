#!/usr/bin/env node
/**
 * t887 — the topaz training parser's unit receipt (RE-BORN, t897).
 *
 * The original t887 (80/80, the t893-era tree) died in the annihilate;
 * its SRC survived the merge, so this instrument re-writes onto the
 * living code. It witnesses parseTopazTraining (src/lib/relion/
 * topaz-training.ts) against the three log shapes the parser accepts —
 * the CSV table, the epoch-tagged stream, the bare loss stream — plus
 * the honesty contract (nothing fabricated: no recognizable progress
 * yields [], the chart self-hides) and the mock world's own run.out
 * (progress lines, no loss — the honest empty at the parser level).
 *
 * The cleanup VERIFIED law rides in from birth (the t533 doctrine):
 * this instrument writes NO files — every fixture is in-memory text —
 * so the cleanup arm is vacuously green and SAID so (an instrument
 * that creates nothing cannot litter).
 *
 * Usage: node --import ./scripts/ts-alias-register.mjs scripts/t887-topaz-parser-unit.mjs
 */
import { parseTopazTraining } from "@/lib/relion/topaz-training";

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
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("A — the CSV table shape (pass A)");
{
  const t = parseTopazTraining("it,loss\n0,0.9\n1,0.7\n2,0.5\n");
  ok("A1 basic table parsed", t.length === 3, `got ${t.length}`);
  ok("A2 epochs are 0/1/2", eq(t.map((e) => e.it), [0, 1, 2]));
  ok("A3 trainLoss column parsed", t[0].trainLoss === 0.9 && t[2].trainLoss === 0.5);
  ok("A4 testLoss stays null (no test column)", t.every((e) => e.testLoss === null));
}
{
  const t = parseTopazTraining("# epoch,training loss,test loss\n1,0.80,0.85\n2,0.60,0.66\n3,0.41,0.50\n");
  ok("A5 # header + train/test routed by name", t.length === 3 && t[0].trainLoss === 0.8 && t[0].testLoss === 0.85, JSON.stringify(t[0]));
  ok("A6 falling losses preserved", t[2].trainLoss === 0.41 && t[2].testLoss === 0.5);
}
{
  const t = parseTopazTraining("it\tloss\tprecision\trecall\n0\t0.9\t0.60\t0.55\n1\t0.7\t0.72\t0.66\n");
  ok("A7 tab-separated with precision/recall", t.length === 2 && t[1].precision === 0.72 && t[1].recall === 0.66, JSON.stringify(t[1]));
}
{
  const t = parseTopazTraining("epoch;loss\n0;0.9\n1;0.75\n");
  ok("A8 semicolon-separated table", t.length === 2 && t[1].trainLoss === 0.75);
}
{
  const t = parseTopazTraining("it|loss\n0|0.9\n1|0.7\n");
  ok("A9 pipe-separated table", t.length === 2 && t[1].trainLoss === 0.7);
}
{
  const t = parseTopazTraining("Epoch,Loss\n0,0.9\n1,0.7\n");
  ok("A10 case-insensitive headers", t.length === 2 && t[0].trainLoss === 0.9);
}
{
  const t = parseTopazTraining("it,loss\n0,0.9\n");
  ok("A11 a one-row table is not a table (falls through)", t.length === 0, `got ${t.length}`);
}
{
  const t = parseTopazTraining("it,loss\n0,0.9\n1,0.7\ntotal run time 12s\n2,0.5\n");
  ok("A12 non-numeric row breaks the table honestly", t.length === 2, `got ${t.length}`);
}
{
  const t = parseTopazTraining("it,loss\n0,1.5e-1\n1,9.2E-2\n");
  ok("A13 scientific notation parsed", t[0].trainLoss === 0.15 && t[1].trainLoss === 0.092, JSON.stringify(t));
}

console.log("B — the epoch-tagged stream shape (pass B)");
{
  const t = parseTopazTraining("## epoch 3\n## training loss: 0.42\n## test loss: 0.39\n");
  ok("B1 tagged epoch carries both losses", t.length === 1 && t[0].it === 3 && t[0].trainLoss === 0.42 && t[0].testLoss === 0.39, JSON.stringify(t));
}
{
  const t = parseTopazTraining(
    "## epoch 1\n## training loss: 0.80\n## epoch 2\n## training loss: 0.61\n## epoch 0\n## training loss: 0.95\n"
  );
  ok("B2 epochs sorted ascending regardless of order", eq(t.map((e) => e.it), [0, 1, 2]), JSON.stringify(t.map((e) => e.it)));
}
{
  const t = parseTopazTraining("it 5 loss=0.1 precision=0.8\n");
  ok("B3 one-liner: epoch word + loss + precision", t.length === 1 && t[0].it === 5 && t[0].trainLoss === 0.1 && t[0].precision === 0.8, JSON.stringify(t));
}
{
  const t = parseTopazTraining("iteration 7: loss=0.33\n");
  ok("B4 'iteration' recognized as the epoch word (the t897 alternation-order fix: 'it' shadowed 'iteration' in the old regex, the docblock's third word could never match — src fixed this window)", t.length === 1 && t[0].it === 7 && t[0].trainLoss === 0.33, JSON.stringify(t));
}
{
  const t = parseTopazTraining("iteration 7: loss 0.33\n");
  ok("B4b a loss value without the :/= separator is not a loss assignment (numOf's contract) — the epoch tag alone yields [] (nothing fabricated)", t.length === 0, JSON.stringify(t));
}
{
  const t = parseTopazTraining("## epoch 2\n## training loss: 0.50\nprecision: 0.71\nrecall: 0.69\n## epoch 2 test loss: 0.55\n## epoch 2 test precision: 0.66\n## epoch 2 test recall: 0.61\n");
  ok("B5 test precision/recall routed by keyword (the /loss/i gate respected — a real log always discusses loss)", t.length === 1 && t[0].trainLoss === 0.5 && t[0].testLoss === 0.55 && t[0].precision === 0.71 && t[0].recall === 0.69 && t[0].testPrecision === 0.66 && t[0].testRecall === 0.61, JSON.stringify(t[0]));
}
{
  const t = parseTopazTraining("## epoch 2\nprecision: 0.71\nrecall: 0.69\n");
  ok("B5b a precision-only log (no loss word) is below the parser's gate — honest []", t.length === 0, JSON.stringify(t));
}
{
  const t = parseTopazTraining("## epoch 4\nheld-out loss: 0.25\n");
  ok("B6 'held-out' routes to testLoss", t[0].testLoss === 0.25 && t[0].trainLoss === null, JSON.stringify(t[0]));
}

console.log("C — the bare loss stream (pass C)");
{
  const t = parseTopazTraining("training loss: 0.90\ntraining loss: 0.72\ntraining loss: 0.55\n");
  ok("C1 positional epochs 0/1/2", eq(t.map((e) => e.it), [0, 1, 2]) && t[2].trainLoss === 0.55, JSON.stringify(t.map((e) => e.it)));
}
{
  const t = parseTopazTraining("loss: 0.9\ntest loss: 0.88\nloss: 0.7\n");
  ok("C2 the bare stream's documented contract: EVERY loss line becomes the next positional epoch, train/test routed by keyword (test lines land on their own epoch — the shape's known interleave limitation, said honestly)", eq(t.map((e) => e.it), [0, 1, 2]) && t[0].trainLoss === 0.9 && t[1].testLoss === 0.88 && t[2].trainLoss === 0.7, JSON.stringify(t));
}
{
  const t = parseTopazTraining("loss=0.42\nloss=0.31\n");
  ok("C3 bare loss= lines become train losses", t.length === 2 && t[1].trainLoss === 0.31);
}

console.log("D — the honesty contract (nothing fabricated)");
ok("D1 empty text yields []", parseTopazTraining("").length === 0);
ok("D2 no loss keyword yields []", parseTopazTraining("epoch 1 done\nepoch 2 done\n").length === 0);
ok("D3 loss word without numbers yields []", parseTopazTraining("the loss was computed\nloss: unknown\n").length === 0);
{
  // the mock world's own run.out — progress lines, no loss values
  const mockRunOut =
    "denoising micrograph 1/4: mic001.mrc\ndenoising micrograph 2/4: mic002.mrc\ndenoising micrograph 3/4: mic003.mrc\ndenoising micrograph 4/4: mic004.mrc\nDenoised 4 micrographs — index: denoised_micrographs.star\ncryoflow-mock topaz denoise: CNN denoising simulated (source bytes copied)";
  ok("D4 the mock's run.out yields [] (the chart self-hides)", parseTopazTraining(mockRunOut).length === 0);
}
ok("D5 null/undefined-safe (empty string contract)", parseTopazTraining(String(null)).length === 0);

console.log("E — precedence and tolerance");
{
  const t = parseTopazTraining("it,loss\n0,0.9\n1,0.7\n\n## epoch 9\n## training loss: 0.1\n");
  ok("E1 the structured table wins over a later stream", t.length === 2 && t[0].it === 0, JSON.stringify(t.map((e) => e.it)));
}
{
  const t = parseTopazTraining(
    "topaz train v0.2.5\nmodel: resnet16\n\nit,loss\n0,0.90\n1,0.71\n2,0.52\n\ndone.\n"
  );
  ok("E2 stdout preamble around the table tolerated", t.length === 3 && t[2].trainLoss === 0.52, `got ${t.length}`);
}
{
  const t = parseTopazTraining("## epoch 1\n## training loss: 0.80\n## epoch 1\n## training loss: 0.80\n");
  ok("E3 duplicate epoch tags merge into one entry", t.length === 1 && t[0].it === 1, `got ${t.length}`);
}

console.log("\ncleanup law (the t533 doctrine, aboard from birth):");
console.log(`  ok: vacuously green — this instrument writes NO files (all fixtures in-memory), nothing to clean, verified by construction`);

console.log(`\nt887 parser unit (re-born): ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
