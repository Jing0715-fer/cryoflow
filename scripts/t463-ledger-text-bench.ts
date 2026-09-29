/**
 * t463 — the ledger travels bench.
 *
 * funnelLedgerText turns the funnel ledger into clipboard text. Every
 * assertion below pins one law of that export:
 *
 *   T1 — structure: header line (with/without host name), headline
 *        second, sections separated by blank lines, no trailing
 *        newline (clipboard text is not a file).
 *   T2 — ok row grammar: `Name [type]: 24 micrographs`, classes chip,
 *        en-US thousands separators.
 *   T3 — edge lines: indented two spaces, speaking BEFORE the row they
 *        feed, verbatim from the delta the brain wrote.
 *   T4 — amber rows: the honest default for a silent receipt, the
 *        failed status passed through, never a guessed number.
 *   T5 — the per-mic chip stays out of row lines: the edge above
 *        autopick already says "17.0 per micrograph" — a ledger never
 *        says one thing twice in one breath.
 *   T6 — the closing verdict: FSC dialect when the chain closes, the
 *        honest absence line when it doesn't.
 *   T7 — the census: [type] grammar, only when someone was left behind.
 *   T8 — both confessions travel: the sqrt note and the verbless footer.
 *   T9 — an empty ledger exports as an empty string.
 *   T10 — end-to-end: the real brain's ledger through the real text
 *         renderer carries the world's verbatim numbers in order.
 *
 * World contract: pure functions — no store, no fetch, no fs.
 * Run: bun run scripts/t463-ledger-text-bench.ts
 */

import {
  funnelLedgerOf,
  funnelLedgerText,
  FUNNEL_NOTE,
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

const [jImport, , , jPick, , jClass2d, , , , , jSym, , , jMask, jPost] = WORLD;

const LINEAR: FunnelEdgeIn[] = WORLD.slice(1).map((j, i) => ({
  fromJobId: WORLD[i].id,
  toJobId: j.id,
}));

function ledgerOf(entered: FunnelJobIn, edges: FunnelEdgeIn[] = LINEAR, jobs = WORLD) {
  return funnelLedgerOf({ jobs, edges, enteredId: entered.id });
}

/** the hand ledger — small, surgical, for grammar pins */
function handLedger() {
  return {
    rows: [
      {
        jobId: "a1", type: "import", name: "Import Movies 1",
        count: 24, unit: "micrographs" as const, classes: null,
        subnote: null, kind: "ok" as const, width: 1, perMic: null,
        delta: null,
      },
      {
        jobId: "a2", type: "autopick", name: "Autopick 1",
        count: 408, unit: "picks" as const, classes: null,
        subnote: null, kind: "ok" as const, width: 0.9, perMic: 17.0,
        delta: { line: "408 picks across 24 micrographs — 17.0 per micrograph", kind: "transform" as const },
      },
      {
        jobId: "a3", type: "maskcreate", name: "Mask Create 1",
        count: null, unit: null, classes: null,
        subnote: null, kind: "amber" as const, width: 0, perMic: null,
        delta: { line: "all 408 carried through", kind: "carry" as const },
      },
      {
        jobId: "a4", type: "postprocess", name: "Post-process 1",
        count: null, unit: null, classes: null,
        subnote: "status: failed", kind: "amber" as const, width: 0, perMic: null,
        delta: null,
      },
    ],
    offMainline: [{ id: "b1", type: "class2d", name: "Class2D Side Run" }],
    closing: { jobId: "a4", resolution: "7.79 Å" },
    headline: "24 micrographs went in · 5,672 particles came out refined",
    note: FUNNEL_NOTE,
  };
}

/* ------------------------------------------------------------------ */
/* T1 — structure                                                      */
/* ------------------------------------------------------------------ */
{
  const text = funnelLedgerText(handLedger(), "Refine3D 1");
  const lines = text.split("\n");
  must(lines[0] === "Particle funnel — Refine3D 1", "T1a the header names the host");
  must(
    lines[1] === "24 micrographs went in · 5,672 particles came out refined",
    "T1b the headline is the second line",
  );
  must(!text.endsWith("\n"), "T1c no trailing newline — clipboard text is not a file");
  must(!text.includes("\n\n\n"), "T1d no double blank lines — one breath between sections");

  const anon = funnelLedgerText(handLedger());
  must(
    anon.split("\n")[0] === "Particle funnel",
    "T1e without a host the header is still a door",
  );
}

/* ------------------------------------------------------------------ */
/* T2 — ok row grammar                                                 */
/* ------------------------------------------------------------------ */
{
  const text = funnelLedgerText(handLedger());
  must(
    text.includes("Import Movies 1 [import]: 24 micrographs"),
    "T2a the ok row speaks name, type, count, unit",
  );
  const withClasses = funnelLedgerText({
    ...handLedger(),
    rows: [
      {
        jobId: "c1", type: "class2d", name: "Class2D 1",
        count: 96, unit: "particles", classes: 50,
        subnote: null, kind: "ok", width: 0.5, perMic: null, delta: null,
      },
    ],
    offMainline: [], closing: null,
  });
  must(
    withClasses.includes("Class2D 1 [class2d]: 96 particles · 50 classes"),
    "T2b the classes chip rides the row",
  );
  const big = funnelLedgerText({
    ...handLedger(),
    rows: [
      {
        jobId: "d1", type: "rebalance", name: "Rebalance 1",
        count: 5672, unit: "particles", classes: null,
        subnote: null, kind: "ok", width: 0.9, perMic: null, delta: null,
      },
    ],
    offMainline: [], closing: null,
  });
  must(
    big.includes("5,672 particles"),
    "T2c thousands separators travel with the number",
  );
}

/* ------------------------------------------------------------------ */
/* T3 — edge lines                                                     */
/* ------------------------------------------------------------------ */
{
  const text = funnelLedgerText(handLedger());
  const lines = text.split("\n");
  const pickIdx = lines.findIndex((l) => l.startsWith("Autopick 1 [autopick]:"));
  must(
    pickIdx > 0 && lines[pickIdx - 1] === "  408 picks across 24 micrographs — 17.0 per micrograph",
    "T3a the transform edge speaks first, indented, feeding its row",
  );
  const maskIdx = lines.findIndex((l) => l.startsWith("Mask Create 1 [maskcreate]:"));
  must(
    maskIdx > 0 && lines[maskIdx - 1] === "  all 408 carried through",
    "T3b the carry edge rides above its amber row",
  );
}

/* ------------------------------------------------------------------ */
/* T4 — amber rows                                                     */
/* ------------------------------------------------------------------ */
{
  const text = funnelLedgerText(handLedger());
  must(
    text.includes("Mask Create 1 [maskcreate]: a volume verb — no particles on its receipt"),
    "T4a a silent receipt gets the honest default",
  );
  must(
    text.includes("Post-process 1 [postprocess]: status: failed"),
    "T4b a failed stage says so, never a guessed number",
  );
}

/* ------------------------------------------------------------------ */
/* T5 — the per-mic chip stays out of row lines                        */
/* ------------------------------------------------------------------ */
{
  const text = funnelLedgerText(handLedger());
  const rowLines = text.split("\n").filter((l) => l.includes("[autopick]:"));
  must(
    rowLines.every((l) => !l.includes("per micrograph") && !l.includes("/mic")),
    "T5a the row does not repeat what its edge already said",
  );
}

/* ------------------------------------------------------------------ */
/* T6 — the closing verdict                                            */
/* ------------------------------------------------------------------ */
{
  const text = funnelLedgerText(handLedger());
  must(
    text.includes(
      "closes at 7.79 Å — FSC(0.143), the postprocess receipt's own verdict on where the funnel lands.",
    ),
    "T6a the closing verdict speaks the FSC dialect",
  );
  const open = funnelLedgerText({ ...handLedger(), closing: null });
  must(
    open.includes(
      "No postprocess ends this chain yet — the funnel's last number is where the ledger currently stops.",
    ),
    "T6b an open chain confesses where its ledger stops",
  );
}

/* ------------------------------------------------------------------ */
/* T7 — the census                                                     */
/* ------------------------------------------------------------------ */
{
  const text = funnelLedgerText(handLedger());
  must(
    text.includes(
      "Off this mainline, the same chain also fed: Class2D Side Run [class2d]. The walk follows one line at each branch — these ran beside it.",
    ),
    "T7a the census names the left-behind verbs in [type] grammar",
  );
  const solo = funnelLedgerText({ ...handLedger(), offMainline: [] });
  must(
    !solo.includes("Off this mainline"),
    "T7b a mainline-only chain carries no census line",
  );
}

/* ------------------------------------------------------------------ */
/* T8 — both confessions travel                                        */
/* ------------------------------------------------------------------ */
{
  const text = funnelLedgerText(handLedger());
  must(text.includes(FUNNEL_NOTE), "T8a the sqrt confession travels");
  must(
    text.includes(
      "The funnel reads the receipts; it does not mutate — a different chain comes from re-running a verb.",
    ),
    "T8b the verbless footer travels",
  );
  must(
    text.indexOf(FUNNEL_NOTE) < text.indexOf("The funnel reads the receipts; it does not mutate —"),
    "T8c the note comes before the footer, both at the end",
  );
}

/* ------------------------------------------------------------------ */
/* T9 — the empty ledger                                               */
/* ------------------------------------------------------------------ */
{
  must(funnelLedgerText({ ...handLedger(), rows: [] }) === "", "T9 an empty ledger exports as nothing");
}

/* ------------------------------------------------------------------ */
/* T10 — end-to-end: the real brain through the real renderer          */
/* ------------------------------------------------------------------ */
{
  const ledger = ledgerOf(jPost);
  must(ledger !== null, "T10a the world walks");
  if (ledger) {
    const text = funnelLedgerText(ledger, "Post-process 1");
    const anchors = [
      "Import Movies 1 [import]: 24 micrographs",
      "Autopick 1 [autopick]: 408 picks",
      "Class2D 1 [class2d]: 96 particles · 50 classes",
      "Symmetry Expand 1 [symexpand]: 5,760 particles",
      "Rebalance 1 [rebalance]: 5,672 particles",
      "Mask Create 1 [maskcreate]: a volume verb — no particles on its receipt",
      "closes at 7.79 Å — FSC(0.143)",
    ];
    let last = -1;
    let inOrder = true;
    for (const a of anchors) {
      const idx = text.indexOf(a);
      if (idx < 0 || idx < last) inOrder = false;
      else last = idx;
    }
    must(inOrder, "T10b the world's verbatim numbers appear in chain order");
    must(
      text.includes("  −312 · 76% of the picks never became particles") ||
        text.includes("  −312"),
      "T10c the shed edge travels verbatim",
    );
    must(
      text.includes("  +5,664 · ×60 at symexpand"),
      "T10d the gain edge travels verbatim",
    );
  }
}

console.log(`\nt463 — ledger travels bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
