// t892 — the denoised-count chip's unit receipt (the style deepening's
// verification leg): summarizeOutputs("topazdenoise", ...) rides the same
// shapes the inspector's route feeds — the local index rows (primary), the
// run record's receipt line (fallback), and the honest nulls between.
// t893 grew the coverage legs (the extract doctrine's extension); the
// annihilate killed the original instrument and this re-write carries both
// eras: the original 12 arms + the coverage's 5.
// Usage: node --import ./scripts/ts-alias-register.mjs scripts/t892-denoise-chip-unit.mjs

import { summarizeOutputs } from "@/lib/relion/output-summary";

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

/** a SummaryFile fixture — the kind field is load-bearing: the walk's
 * classify law assigns it in production, so the test wears the same shape */
const f = (path, kind, rows) => ({
  path,
  name: path.split("/").pop(),
  kind,
  size: 1024,
  ...(rows != null ? { rows } : {}),
});

const noDeps = { readStarText: () => null };

console.log("A — the index lane (the primary source)");

const localFull = [
  f("topazdenoise_x/denoised_micrographs.star", "star", 24),
  ...Array.from({ length: 24 }, (_, i) =>
    f(`topazdenoise_x/mic${String(i + 1).padStart(3, "0")}_denoised.mrc`, "mrc")
  ),
];
{
  const s = summarizeOutputs("topazdenoise", localFull, noDeps);
  ok("arm 1: the index's rows are the chip's value (24)", s?.stats[0]?.value === "24", JSON.stringify(s?.stats));
  // t899 — the keys' honest contract, RE-KEYED: the census chip keeps
  // "micrographs"; the local coverage leg speaks "denoised-local". The
  // old arm 2 (every key === "micrographs") pinned the COLLISION as law —
  // the strip's flash diff is key-indexed, two stats sharing a key poison
  // each other's prevVals (the mount flashes, every poll flashes) — live-
  // captured on the ring's browser leg. Distinct keys are the law now.
  ok("arm 2: the census chip keeps the micrographs key", s?.stats[0]?.key === "micrographs");
  ok("arm 2b: the local leg carries its own key (denoised-local)", s?.stats[1]?.key === "denoised-local", JSON.stringify(s?.stats.map((t) => t.key)));
  ok("arm 2c: the two keys are DISTINCT (the diff law)", s?.stats[0]?.key !== s?.stats[1]?.key);
  ok("arm 3: the chip's hint carries the schema-keeping law", /micrograph schema/.test(s?.stats[0]?.hint ?? ""));
  ok("arm 4: complete lane -> coverage covered==total (24/24)", s?.coverage?.covered === 24 && s?.coverage?.total === 24);
  ok("arm 5: complete lane -> NO amber note (the strip stays clean)", s?.coverage?.note === undefined);
  ok("arm 6: the second stat rides when tiles are local (24 / 24)", s?.stats[1]?.value === "24 / 24", JSON.stringify(s?.stats[1]));
}

console.log("B — the coverage leg's honest partial");

const partial = [
  f("topazdenoise_x/denoised_micrographs.star", "star", 4),
  f("topazdenoise_x/mic001_denoised.mrc", "mrc"),
  f("topazdenoise_x/mic002_denoised.mrc", "mrc"),
];
{
  const s = summarizeOutputs("topazdenoise", partial, noDeps);
  ok("arm 7: partial 2-of-4 -> coverage 2/4", s?.coverage?.covered === 2 && s?.coverage?.total === 4, JSON.stringify(s?.coverage));
  ok("arm 8: the amber note names the partial (2 of 4 ... 2 live on the cluster)", /2 of 4 denoised images synced home — 2 live on the cluster only/.test(s?.coverage?.note ?? ""));
  ok("arm 9: the partial's second stat reads 2 / 4", s?.stats[1]?.value === "2 / 4");
  ok("arm 9b: the partial's second stat still speaks denoised-local", s?.stats[1]?.key === "denoised-local", JSON.stringify(s?.stats.map((t) => t.key)));
}

const remoteOnly = [
  f("topazdenoise_x/denoised_micrographs.star", "star", 6),
  Object.assign(f("topazdenoise_x/mic001_denoised.mrc", "mrc"), { remote: true }),
  Object.assign(f("topazdenoise_x/mic002_denoised.mrc", "mrc"), { remote: true }),
];
{
  const s = summarizeOutputs("topazdenoise", remoteOnly, noDeps);
  ok("arm 10: remote tiles are not renderables — covered 0 of 6", s?.coverage?.covered === 0 && s?.coverage?.total === 6);
  ok("arm 11: covered 0 -> NO second stat (nothing renders here)", s?.stats.length === 1, JSON.stringify(s?.stats.map((t) => t.value)));
  ok("arm 12: the note still names the cluster-only world", /0 of 6 denoised images synced home — 6 live on the cluster only/.test(s?.coverage?.note ?? ""));
}

console.log("C — the fallback lane (the sentence doctrine)");

{
  const s = summarizeOutputs("topazdenoise", [], { ...noDeps, result: "24 micrographs denoised · topaz denoise (gpu 0)" });
  ok("arm 13: the receipt sentence feeds the chip (24)", s?.stats[0]?.value === "24", JSON.stringify(s));
  ok("arm 14: the fallback carries NO coverage (a sentence cannot know what renders locally)", s?.coverage === undefined);
  ok("arm 15: the fallback carries no hint (the schema law rides the index lane only)", s?.stats[0]?.hint === undefined);
}

console.log("D — the honest nulls between");

{
  const s1 = summarizeOutputs("topazdenoise", [f("topazdenoise_x/denoised_micrographs.star", "star")], noDeps);
  ok("arm 16: an index the walk could not count -> null (never a guess)", s1 === null);
  const s2 = summarizeOutputs("topazdenoise", [], noDeps);
  ok("arm 17: nothing to speak from -> null", s2 === null);
}

console.log("E — the neighbors' census (the default's own law held)");

{
  const tr = summarizeOutputs("topaztrain", [f("topaztrain_x/model.ts", "star")], noDeps);
  ok("arm 18: topaztrain stays in the default census (the training curve speaks)", tr === null);
  const grouped = summarizeOutputs("topazdenoise", [f("x/denoised_micrographs.star", "star", 12345)], noDeps);
  ok("arm 19: nfmt groups the big count (12,345)", grouped?.stats[0]?.value === "12,345");
}

console.log(`\nt892 chip unit: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
