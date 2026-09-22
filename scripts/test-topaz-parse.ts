/**
 * Test: parseTopazTraining — the topaz training-log parser.
 *
 * topaz's console output shape varies across versions (RELION pipes it
 * into the job's run.out). Three shapes are covered: CSV table,
 * epoch-tagged blocks, bare loss stream — plus noise tolerance.
 *
 * Run: bun scripts/test-topaz-parse.ts
 */

import { parseTopazTraining } from "../src/lib/relion/topaz-training";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.error(
      `  FAIL  ${name}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`
    );
  }
}

console.log("parseTopazTraining — three log shapes + noise");

// 1. CSV table (header + numeric rows)
{
  const log = `some preamble
+ Running topaz train...
#epoch,train_loss,test_loss,precision,recall
0,0.6850,0.6845,0.000001,1.000000
1,0.4359,0.4412,0.010200,0.982000
2,0.2211,0.2408,0.140800,0.913400
+ Finished`;
  const e = parseTopazTraining(log);
  check("csv: epoch count", e.length, 3);
  check("csv: it0", [e[0].it, e[0].trainLoss, e[0].testLoss], [0, 0.685, 0.6845]);
  check("csv: it2 precision/recall", [e[2].precision, e[2].recall], [0.1408, 0.9134]);
}

// 2. Epoch-tagged blocks (topaz verbose style)
{
  const log = `## training topaz classifier
## epoch 0
## training loss: 0.684962 precision: 0.000001 recall: 1.000000
## test loss: 0.684593 precision: 0.000001 recall: 1.000000
## epoch 1
## training loss: 0.431902 precision: 0.009877 recall: 0.993004
## test loss: 0.440101 precision: 0.010402 recall: 0.988111
## done`;
  const e = parseTopazTraining(log);
  check("tagged: epochs", e.length, 2);
  check("tagged: e0", [e[0].it, e[0].trainLoss, e[0].testLoss], [0, 0.684962, 0.684593]);
  check("tagged: e1 test precision", e[1].testPrecision, 0.010402);
}

// 3. Bare loss stream (no epoch markers, test routed by keyword)
{
  const log = `## test set: loss=0.4143, precision=0.0296, recall=0.4819
## test set: loss=0.3312, precision=0.0511, recall=0.5023
## test set: loss=0.2901, precision=0.0677, recall=0.5201`;
  const e = parseTopazTraining(log);
  check("bare: epochs", e.length, 3);
  check("bare: positional it", e.map((x) => x.it), [0, 1, 2]);
  check("bare: loss descent", e.map((x) => x.testLoss), [0.4143, 0.3312, 0.2901]);
}

// 4. Mixed RELION run.out noise around real progress
{
  const log = `+ Training with 862 picks in test set; and 2576 picks in work set
some bash echo noise without numbers
## epoch 3
## training loss: 0.198 precision: 0.310 recall: 0.770
Traceback-ish line mentioning epoch and loss but no digits after loss:
ModuleNotFoundError: No module named 'topaz'
## epoch 4
## training loss: 0.171 precision: 0.402 recall: 0.755
## test loss: 0.208 precision: 0.298 recall: 0.690`;
  const e = parseTopazTraining(log);
  check("noise: explicit epochs kept", e.map((x) => x.it), [3, 4]);
  check("noise: e3 train loss", e[0].trainLoss, 0.198);
  check("noise: e4 test loss", e[1].testLoss, 0.208);
}

// 5. No progress at all → [] (chart self-hides)
{
  check("no loss → []", parseTopazTraining("started\nfinished\nnothing numeric"), []);
  check("empty → []", parseTopazTraining(""), []);
}

// 6. Scientific notation losses
{
  const log = "## epoch 0\n## training loss: 6.85e-1 precision: 1e-6 recall: 1.0";
  const e = parseTopazTraining(log);
  check("sci-notation", [e[0].trainLoss, e[0].precision], [0.685, 0.000001]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
