/**
 * t461 — the particle funnel bench.
 *
 * The pure brain (src/lib/particle-funnel.ts) is client-safe and does
 * no I/O: jobs + edges in, ledger out. Every assertion below pins one
 * law of the face:
 *
 *   F1 — the chain walk: linear order, both-ends symmetry, the branch
 *        tiebreak (canonical rank), the off-mainline census, the cycle
 *        guard, and the unknown-id null.
 *   F2 — every edge speaks: carry / shed (with the pct) / gain (with
 *        the factor) / transform (picks-per-micrograph, never a fake
 *        percentage across a unit change).
 *   F3 — amber honesty: a silent receipt is a row, not a gap —
 *        mask-create's volume verb, a failed stage, an unknown verb.
 *   F4 — the closing number + the headline: the postprocess receipt's
 *        FSC verdict closes the funnel; the headline is the arc.
 *   F5 — the shape confesses its scale: sqrt widths, the widest row at
 *        1, the floor at 0.02, amber at 0.
 *   F6 — the quiet subnotes: symexpand's deck, rebalance's anisotropy,
 *        class2d's top class — parsed, never guessed, silent when absent.
 *   F7 — the guards: a solitary verb is a one-row ledger; closure never
 *        invents edges.
 *
 * World contract: pure functions — no store, no fetch, no fs.
 * Run: bun run scripts/t461-particle-funnel-bench.ts
 */

import {
  funnelLedgerOf,
  type FunnelJobIn,
  type FunnelEdgeIn,
} from "../src/lib/particle-funnel";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL — ${label}`);
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures — the mock world's receipt dialect, verbatim numbers       */
/* ------------------------------------------------------------------ */

let seq = 0;
function job(
  type: string,
  name: string,
  result: string | null,
  status = "completed"
): FunnelJobIn {
  seq += 1;
  return { id: `j${seq}`, type, name, status, result };
}

const WORLD: FunnelJobIn[] = [
  job("import", "Import Movies 1", "24 micrographs imported · EMPIAR-10017 (pixel 1.77 Å)"),
  job("motioncorr", "MotionCorr 1", "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: motion corrected, 24 micrographs"),
  job("ctffind", "CTFFIND 1", "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: CTF estimated for 24 micrographs"),
  job("autopick", "Autopick 1", "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: 408 particles picked across 24 micrographs"),
  job("extract", "Extract 1", "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: 96 particles extracted — 24 image file(s) stayed on the cluster"),
  job("class2d", "Class2D 1", "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: 2D classification finished — 50 classes · 96 particles · top: class 1 22.9%"),
  job("select2d", "Select 2D 1", "96 of 96 particles kept · 50/50 classes (auto — occupancy ≥ 0.5× best)"),
  job("select", "Select Classes 1", "96 of 96 particles selected · kept 50/50 classes (occupancy ≥ 0.5× best)"),
  job("initialmodel", "Initial Model 1", "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: de-novo 3D initial model generated · 96 particles"),
  job("class3d", "Class3D 1", "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: class3d exited 0 · 96 particles · 4 per-class star(s)"),
  job("symexpand", "Symmetry Expand 1", "96 × 60 = 5,760 particles (I/full)"),
  job("rebalance", "Rebalance 1", "5,672 of 5,760 particles kept · anisotropy 1.09→1.07 · uniformity 0.77→0.80"),
  job("refine3d", "Refine3D 1", "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: refine3d exited 0 · 5,672 particles"),
  job("maskcreate", "Mask Create 1", "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: soft-edged mask created"),
  job("postprocess", "Post-process 1", "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: sharpened map · FSC(0.143) = 7.79 Å"),
];

const [jImport, jMotion, jCtf, jPick, jExtract, jClass2d, jSelect2d, jSelect, jInit, jClass3d, jSym, jRebal, jRefine, jMask, jPost] = WORLD;

/** the mock world's edges — one straight line, 14 hops */
const LINEAR: FunnelEdgeIn[] = [
  { fromJobId: jImport.id, toJobId: jMotion.id },
  { fromJobId: jMotion.id, toJobId: jCtf.id },
  { fromJobId: jCtf.id, toJobId: jPick.id },
  { fromJobId: jPick.id, toJobId: jExtract.id },
  { fromJobId: jExtract.id, toJobId: jClass2d.id },
  { fromJobId: jClass2d.id, toJobId: jSelect2d.id },
  { fromJobId: jSelect2d.id, toJobId: jSelect.id },
  { fromJobId: jSelect.id, toJobId: jInit.id },
  { fromJobId: jInit.id, toJobId: jClass3d.id },
  { fromJobId: jClass3d.id, toJobId: jSym.id },
  { fromJobId: jSym.id, toJobId: jRebal.id },
  { fromJobId: jRebal.id, toJobId: jRefine.id },
  { fromJobId: jRefine.id, toJobId: jMask.id },
  { fromJobId: jMask.id, toJobId: jPost.id },
];

function ledgerOf(entered: FunnelJobIn, edges: FunnelEdgeIn[] = LINEAR, jobs = WORLD) {
  return funnelLedgerOf({ jobs, edges, enteredId: entered.id });
}

const approx = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;

/* ------------------------------------------------------------------ */
/* F1 — the chain walk                                                 */
/* ------------------------------------------------------------------ */

console.log("F1 — the chain walk: order, symmetry, branch, census, guard");
{
  const led = ledgerOf(jRefine);
  must(led !== null, "F1a the entered job resolves");
  if (led) {
    must(led.rows.length === 14, `F1b the mainline holds 14 rows (postprocess is the closing, not a row) — got ${led.rows.length}`);
    must(led.rows[0].type === "import" && led.rows[0].count === 24, "F1c the walk reaches the root: import first, 24 micrographs");
    must(led.rows[1].type === "motioncorr", "F1d the canonical order holds: import then motioncorr");
    must(led.rows[led.rows.length - 1].type === "maskcreate", "F1e the mainline ends at mask-create (postprocess speaks as the closing)");
  }
  const ledFromRoot = ledgerOf(jImport);
  must(ledFromRoot !== null && ledFromRoot.rows.length === 14, "F1f both ends agree: the funnel from the root is the same chain");
  // the branch: the mock line is straight, so the branch is grown here —
  // a direct class2d→select edge makes class2d fork, and the canonical
  // rank (select 70 > select2d 65) sends the mainline through select;
  // select-2d speaks in the census instead of vanishing
  const branchEdges: FunnelEdgeIn[] = [...LINEAR, { fromJobId: jClass2d.id, toJobId: jSelect.id }];
  const branchLed = ledgerOf(jExtract, branchEdges);
  must(branchLed !== null && branchLed.offMainline.length === 1 && branchLed.offMainline[0].name === "Select 2D 1", "F1g the branch's left-out verb speaks in the census");
  must(branchLed !== null && branchLed.rows.some((r) => r.type === "select") && !branchLed.rows.some((r) => r.type === "select2d"), "F1h the mainline went through select, not select-2d");
}

console.log("F1+ — the guards: cycles, unknown ids, forced unknown verbs");
{
  // a degenerate cycle must terminate, not hang
  const cycEdges: FunnelEdgeIn[] = [
    { fromJobId: jImport.id, toJobId: jMotion.id },
    { fromJobId: jMotion.id, toJobId: jCtf.id },
    { fromJobId: jCtf.id, toJobId: jImport.id },
  ];
  const led = ledgerOf(jMotion, cycEdges);
  must(led !== null && led.rows.length === 3, `F1i the cycle guard terminates with the whole loop read — got ${led?.rows.length}`);
  must(funnelLedgerOf({ jobs: WORLD, edges: LINEAR, enteredId: "nope" }) === null, "F1j an unknown entered id is a null ledger, not a guess");
  // an unknown verb mid-chain is a forced path — the walk passes through it
  const stranger = job("myverb", "Strange Verb 1", null);
  const strangeEdges: FunnelEdgeIn[] = [
    { fromJobId: jExtract.id, toJobId: stranger.id },
    { fromJobId: stranger.id, toJobId: jRefine.id },
  ];
  const strangeJobs = [jExtract, stranger, jRefine];
  const sled = funnelLedgerOf({ jobs: strangeJobs, edges: strangeEdges, enteredId: jRefine.id });
  must(sled !== null && sled.rows.length === 3 && sled.rows[1].type === "myverb", "F1k an unknown verb mid-chain is walked through, not skipped");
}

/* ------------------------------------------------------------------ */
/* F2 — every edge speaks                                              */
/* ------------------------------------------------------------------ */

console.log("F2 — the deltas: carry, shed, gain, transform");
{
  const led = ledgerOf(jRefine);
  must(led !== null, "F2a the ledger resolves");
  if (led) {
    const byType = new Map(led.rows.map((r) => [r.type, r]));
    must(byType.get("motioncorr")?.delta?.line === "all 24 carried through", `F2b carry — got "${byType.get("motioncorr")?.delta?.line}"`);
    must(byType.get("ctffind")?.delta?.kind === "carry", "F2c the CTF stage carried too");
    must(byType.get("autopick")?.delta?.line === "408 picks across 24 micrographs — 17.0 per micrograph", `F2d the transform speaks picks-per-micrograph — got "${byType.get("autopick")?.delta?.line}"`);
    must(byType.get("autopick")?.perMic === 17, "F2e the per-mic chip carries the rate");
    must(byType.get("extract")?.delta?.line === "−312 · 76% of the picks never became particles", `F2f the pick→particle shed — got "${byType.get("extract")?.delta?.line}"`);
    must(byType.get("extract")?.delta?.kind === "shed", "F2g the shed wears its kind");
    must(byType.get("symexpand")?.delta?.line === "+5,664 · ×60 at symexpand", `F2h the gain speaks the receipt's own factor — got "${byType.get("symexpand")?.delta?.line}"`);
    must(byType.get("rebalance")?.delta?.line === "−88 · 1.5% lost at rebalance", `F2i the small shed keeps its decimal — got "${byType.get("rebalance")?.delta?.line}"`);
    must(byType.get("refine3d")?.delta?.line === "all 5,672 carried through", "F2j the last verb carried the whole stack");
    must(byType.get("class2d")?.classes === 50, "F2k class2d's receipt census rides its row");
    must(byType.get("maskcreate")?.delta === null, "F2l an amber row owns no delta — the edge into silence has no numbers to speak");
  }
}

/* ------------------------------------------------------------------ */
/* F3 — amber honesty                                                  */
/* ------------------------------------------------------------------ */

console.log("F3 — the amber rows: a silent receipt is a row, not a gap");
{
  const led = ledgerOf(jRefine);
  must(led !== null, "F3a the ledger resolves");
  if (led) {
    const mask = led.rows.find((r) => r.type === "maskcreate");
    must(mask !== undefined && mask.kind === "amber" && mask.count === null, "F3b mask-create speaks amber — present, uncounted");
    must(mask !== undefined && mask.width === 0, "F3c the amber row claims no width");
    const failed = job("extract", "Extract 2 (failed)", null, "failed");
    const fled = funnelLedgerOf({
      jobs: [jImport, jMotion, failed],
      edges: [
        { fromJobId: jImport.id, toJobId: jMotion.id },
        { fromJobId: jMotion.id, toJobId: failed.id },
      ],
      enteredId: failed.id,
    });
    const frow = fled?.rows.find((r) => r.type === "extract");
    must(frow !== undefined && frow.kind === "amber" && frow.subnote === "status: failed", "F3d a failed stage confesses its status");
    const silent = job("select", "Select 1", "exited 0");
    const sled = funnelLedgerOf({
      jobs: [jExtract, silent],
      edges: [{ fromJobId: jExtract.id, toJobId: silent.id }],
      enteredId: silent.id,
    });
    const srow = sled?.rows.find((r) => r.type === "select");
    must(srow !== undefined && srow.kind === "amber" && srow.subnote === null, "F3e a completed-but-countless receipt is amber with no invented note");
  }
}

/* ------------------------------------------------------------------ */
/* F4 — the closing number + the headline                              */
/* ------------------------------------------------------------------ */

console.log("F4 — the closing Å and the headline arc");
{
  const led = ledgerOf(jRefine);
  must(led !== null, "F4a the ledger resolves");
  if (led) {
    must(led.closing?.resolution === "7.79 Å", `F4b the closing reads the postprocess receipt — got ${led.closing?.resolution}`);
    must(led.closing?.jobId === jPost.id, "F4c the closing points at its own postprocess");
    must(
      led.headline === "24 micrographs went in · 5,672 particles came out refined · the map closes at 7.79 Å",
      `F4d the headline is the arc — got "${led.headline}"`
    );
  }
  // a chain that stops before postprocess has no closing number
  const shortLed = funnelLedgerOf({
    jobs: [jExtract, jRefine],
    edges: [{ fromJobId: jExtract.id, toJobId: jRefine.id }],
    enteredId: jRefine.id,
  });
  must(shortLed !== null && shortLed.closing === null, "F4e no postprocess, no closing — the absence is honest");
  must(shortLed !== null && !shortLed.headline.includes("closes at"), "F4f the headline does not pretend to close");
  // the exit verb follows the last particle stage
  const selLed = funnelLedgerOf({
    jobs: [jExtract, jSelect],
    edges: [{ fromJobId: jExtract.id, toJobId: jSelect.id }],
    enteredId: jSelect.id,
  });
  must(selLed !== null && selLed.headline === "96 particles went in · 96 particles came out selected", `F4g the exit verb follows the stage — got "${selLed?.headline}"`);
  // a variant resolution format still parses
  const altPost = job("postprocess", "Post-process 2", "sharpened map · FSC(0.143) = 7.8 Å");
  const altLed = funnelLedgerOf({
    jobs: [jRefine, altPost],
    edges: [{ fromJobId: jRefine.id, toJobId: altPost.id }],
    enteredId: altPost.id,
  });
  must(altLed !== null && altLed.closing?.resolution === "7.8 Å", "F4h the closing parses one decimal as happily as two");
}

/* ------------------------------------------------------------------ */
/* F5 — the shape confesses its scale                                  */
/* ------------------------------------------------------------------ */

console.log("F5 — the sqrt widths: widest at 1, floor at 0.02, amber at 0");
{
  const led = ledgerOf(jRefine);
  must(led !== null, "F5a the ledger resolves");
  if (led) {
    const byType = new Map(led.rows.map((r) => [r.type, r]));
    must(byType.get("symexpand")?.width === 1, "F5b the widest stage owns the full bar");
    must(approx(byType.get("import")?.width ?? -9, Math.sqrt(24 / 5760)), "F5c the widths are square-root scaled, not linear");
    must(byType.get("maskcreate")?.width === 0, "F5d amber claims no width");
  }
  // a brutal ratio hits the floor instead of vanishing
  const big = job("import", "Big Import", "40,000 micrographs imported");
  const tiny = job("extract", "Tiny Extract", "4 particles extracted");
  const tled = funnelLedgerOf({
    jobs: [big, tiny],
    edges: [{ fromJobId: big.id, toJobId: tiny.id }],
    enteredId: tiny.id,
  });
  must(tled !== null && tled.rows.find((r) => r.type === "extract")?.width === 0.02, "F5e the floor keeps a tiny stage visible without lying about its count");
}

/* ------------------------------------------------------------------ */
/* F6 — the quiet subnotes                                             */
/* ------------------------------------------------------------------ */

console.log("F6 — the subnotes: parsed, never guessed");
{
  const led = ledgerOf(jRefine);
  must(led !== null, "F6a the ledger resolves");
  if (led) {
    const byType = new Map(led.rows.map((r) => [r.type, r]));
    must(byType.get("symexpand")?.subnote === "the symmetry deck ×60", `F6b symexpand's deck — got "${byType.get("symexpand")?.subnote}"`);
    must(byType.get("rebalance")?.subnote === "anisotropy 1.09→1.07", `F6c rebalance's anisotropy — got "${byType.get("rebalance")?.subnote}"`);
    must(byType.get("class2d")?.subnote === "top: class 1 at 22.9%", `F6d class2d's top class — got "${byType.get("class2d")?.subnote}"`);
    must(byType.get("import")?.subnote === null, "F6e a stage with no note stays silent");
    must(byType.get("extract")?.subnote === null, "F6f extract's file footnote is not a particle note");
  }
}

/* ------------------------------------------------------------------ */
/* F7 — the guards                                                     */
/* ------------------------------------------------------------------ */

console.log("F7 — the solitary verb and the unwired world");
{
  const solo = ledgerOf(jImport, [], [jImport]);
  must(solo !== null && solo.rows.length === 1 && solo.headline === "24 micrographs went in", `F7a a one-verb chain is a one-row ledger — got "${solo?.headline}"`);
  must(solo !== null && solo.closing === null && solo.offMainline.length === 0, "F7b the solitary ledger closes nothing and leaves nobody behind");
  // two jobs, no edge between them: closure never invents edges
  const unwired = ledgerOf(jImport, [], [jImport, jRefine]);
  must(unwired !== null && unwired.rows.length === 1 && unwired.offMainline.length === 0, "F7c without an edge the neighbor is not family — closure invents nothing");
}

/* ------------------------------------------------------------------ */

console.log(`t461 particle-funnel bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
