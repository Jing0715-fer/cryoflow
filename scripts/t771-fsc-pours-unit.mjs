// t771 — the FSC COMPARE dialog's rows speak the pours words: the kind
// vocabulary's TWENTY-NINTH reader, the family's SIXTEENTH testid address
// (fsc-compare-pours-). The overlay is the receipt's provenance face of
// the commitment-seat taxonomy: a curve is a run's receipt, the overlay
// lines receipts up, and "which reconstruction is actually better?" is a
// question asked per KIND — kinds have different wire contracts (a
// refine3d curve hangs on particles/volume/halfmap; an import's hangs on
// nothing this process owns). The type names the maker, the water names
// the maker's wires — the comparison reads per kind. The ask rides each
// row's OWN type word (the ask lives inside the index map — one source
// word-form, one dose per row); the row is a flex HOST (gap-2.5 is the
// space): the t760 prose law's boundary clause, another staging (flex
// hosts owe nothing; the file's fourteen text-flow payments cohabit).
// The gate closes on pouring; unknown types keep the bare mono word.
//
//   A  one book: the import joins (three names, one home); the gated
//      ask appears exactly once in the FILE (comments stripped — the
//      t760 meta-law); the spec ask + riding ask verbatim; the ask rides
//      the row's map (after the row's own const family); the render gate
//      closes on pouring; the lib home keeps its question; exactly one
//      seat.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      EIGHTEENTH-interlocked, refine3d pours by the lib's own answer,
//      every known type speaks, the unknown silent, every pour's ink is
//      a real PORT_COLORS wire.
//   C  the face: the sixteenth address verbatim, no collision with the
//      family's FIFTEEN other DOM addresses, the container class
//      verbatim (dialect equation SEVENTEENTH staging, cross-file
//      verbatim vs t760 + t766 + t767 + t768 + t769), per-dot anatomy +
//      sr-only ear line, the seat regex (the mono type word -> water ->
//      the source Chip), the boundary clause's two faces in one file
//      (flex host owes nothing / fourteen text-flow payments intact),
//      the type word's mono anatomy untouched.
//   D  purity: hex stock EIGHT = EIGHT (the whole-stock audit ran
//      BEFORE the anchor was written — the palette constants predate
//      the surgery; the seat's ink is the lib's), the t771 judgment
//      notes lead their blocks, the THREE storage mentions are the head
//      note's documentation + one read + one write both inside effects
//      (the honest persistence contract), the old residents keep their
//      seats (the restore latch, the live dot, the cap title, the jump
//      and resolution testids), and the summoner (fsc-chart) still
//      mounts this dialog.
//
// Runs standalone: node scripts/t771-fsc-pours-unit.mjs  (exit 0 =
// all green; every failure prints FAIL + the assert label).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

let pass = 0, fail = 0;
const ok = (label) => { pass++; console.log(`  ok  ${label}`); };
const bad = (label, extra) => { fail++; console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); };
const assert = (cond, label, extra) => (cond ? ok(label) : bad(label, extra));

const src = readFileSync("src/components/workflow/results/fsc-compare-dialog.tsx", "utf8");
const lib = readFileSync("src/lib/workflow.ts", "utf8");

// ask the lib ITSELF (the t761 canonical loader: createJiti + alias
// @->src + await import — regex stays for the surgery file's word-forms,
// functions stay for the lib's semantics)
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf } =
  await __jiti.import("../src/lib/workflow");

// strip line comments (but not strings) for word-form counting — the
// t760 meta-law: comments talk too, the counter must not bite them.
// (Block comments survive — position anchors therefore use the FULL
// testid word-form only the seat holds: the t767 lesson baked in.)
const stripLineComments = (s) =>
  s.split("\n").map((l) => {
    const i = l.indexOf("//");
    return i >= 0 ? l.slice(0, i) : l;
  }).join("\n");
const code = stripLineComments(src);

console.log("A — one book (the import joins, the ask rides the row's map)");
{
  assert(
    /import \{ jobType, pourKindsOf, PORT_COLORS \} from "@\/lib\/workflow";/.test(src),
    "A1 import joins: three names, one home",
  );
  const gated = (code.match(/pourKindsOf\(/g) ?? []).length;
  assert(gated === 1, `A2 gated ask exactly once in file (comments stripped)`, `found ${gated}`);
  assert(code.includes("const spec = jobType(job.type);"), "A3 the spec ask verbatim (each row asks once)");
  assert(
    code.includes("const pouring = spec ? pourKindsOf(job.type) : [];"),
    "A4 riding ask verbatim (spec gates the pours)",
  );
  // the ask rides the ROW's own const family — inside the index map,
  // after isRunning, before the return (the dose follows the row's word)
  const isRunningPos = code.indexOf('const isRunning = job.status === "running";');
  const specPos = code.indexOf("const spec = jobType(job.type);");
  const pouringPos = code.indexOf("const pouring = spec ? pourKindsOf(job.type) : [];");
  const returnPos = code.indexOf("            return (");
  assert(
    isRunningPos >= 0 && specPos > isRunningPos && pouringPos > specPos && returnPos > pouringPos,
    "A5 the ask rides the row's map (isRunning -> spec -> pouring -> return)",
  );
  assert(
    code.includes("{pouring.length > 0 && (") && code.includes("data-testid={`fsc-compare-pours-${job.type}`}"),
    "A6 render gate closes on pouring (the t763/t764/t767 pour-gate form)",
  );
  assert(
    /export function pourKindsOf\(/.test(lib) || /export const pourKindsOf/.test(lib),
    "A7 lib home keeps its question (pourKindsOf exported from lib/workflow)",
  );
  const seats = (code.match(/data-testid=\{`fsc-compare-pours-/g) ?? []).length;
  assert(seats === 1, "A8 exactly one seat (one word-form, one dose per row)", `found ${seats}`);
}

console.log("B — live-fire (40 types, zero ghosts, real ink)");
{
  assert(Array.isArray(JOB_TYPES) && JOB_TYPES.length === 40, `B1 40 types in the lib's job table`, `found ${JOB_TYPES.length}`);
  let ghost = 0;
  const dist = {};
  for (const t of JOB_TYPES) {
    for (const k of pourKindsOf(t.key)) if (!PORT_COLORS[k]) ghost++;
    const n = pourKindsOf(t.key).length;
    dist[n] = (dist[n] ?? 0) + 1;
  }
  assert(ghost === 0, "B2 zero ghost kinds (every pour is a port color)");
  const account = Object.entries(dist).map(([n, c]) => [Number(n), c]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert(
    JSON.stringify(account) === JSON.stringify([[1, 35], [2, 3], [3, 2]]),
    "B3 t747 account EIGHTEENTH-interlocked ([[1,35],[2,3],[3,2]] sorted before compared)",
    JSON.stringify(account),
  );
  assert(
    JSON.stringify(pourKindsOf("refine3d")) === JSON.stringify(["particles", "volume", "halfmap"]),
    "B4 refine3d pours particles, volume, halfmap (the lib's own answer)",
    JSON.stringify(pourKindsOf("refine3d")),
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).length > 0 && jobType(t.key) != null) &&
      pourKindsOf("no-such-type").length === 0,
    "B5 every known type speaks, the unknown silent (the undefined law's face)",
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).every((k) => typeof PORT_COLORS[k]?.wire === "string" && PORT_COLORS[k].wire.startsWith("#"))),
    "B6 every pour's ink is a real PORT_COLORS wire (the dots' hex is the lib's, not guessed)",
  );
}

console.log("C — the face (sixteenth address, flex host, boundary clause)");
{
  assert(
    code.includes("data-testid={`fsc-compare-pours-${job.type}`}"),
    "C1 the sixteenth address verbatim (fsc-compare-pours-{type})",
  );
  const family = [
    "lens-pours-${", "peek-pours-${", "refmap-pours-${", "runtime-pours-${",
    "palette-fav-pours-${", "palette-pours-${", "queue-pours-${",
    "cmd-pours-${", "cmd-preset-pours-${", "cmd-user-pours-${", "shelf-pours-${",
    "storage-pours-${", "params-diff-pours-${", "cleanup-pours-${",
    "remote-pours-${",
  ];
  assert(
    family.every((f) => !src.includes(f)),
    "C2 no collision with the family's FIFTEEN other DOM addresses (none of them lives here)",
  );
  assert(
    code.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C3 container class verbatim (the family's canonical container)",
  );
  // dialect equation, SEVENTEENTH staging: the container class verbatim-
  // equals the t760 prose form AND the t766 + t767 + t768 + t769 seats
  // ACROSS FILES
  const t760 = stripLineComments(readFileSync("src/components/workflow/reference-map-card.tsx", "utf8"));
  const t766 = stripLineComments(readFileSync("src/components/workflow/params-diff-dialog.tsx", "utf8"));
  const t767 = stripLineComments(readFileSync("src/components/workflow/cleanup-dialog.tsx", "utf8"));
  const t768 = stripLineComments(readFileSync("src/components/workflow/remote-run-button.tsx", "utf8"));
  const t769 = stripLineComments(readFileSync("src/components/workflow/storage-dialog.tsx", "utf8"));
  assert(
    t760.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t766.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t767.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t768.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t769.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C4 dialect equation seventeenth staging: container verbatim-equals t760 + t766 + t767 + t768 + t769 across files",
  );
  assert(
    code.includes("aria-hidden=\"true\"") &&
      /title=\{`pours \$\{k\}`\}/.test(code) &&
      code.includes("inline-block size-1.5 rounded-full") &&
      code.includes("style={{ background: PORT_COLORS[k].wire }}") &&
      code.includes('className="sr-only">pours {pouring.join(", ")}'),
    "C5 per-dot anatomy + sr-only ear line verbatim",
  );
  // position anchor on seat-held word-forms: the mono type word's anatomy
  // (unique in file) -> the water's address (unique) -> the source Chip's
  // picked class (unique) — the water glued to the word it names
  const wordPos = code.indexOf("text-muted-foreground/70");
  const waterPos = code.indexOf("fsc-compare-pours-${job.type}");
  const chipPos = code.indexOf("border-amber-600/30");
  assert(
    wordPos >= 0 && waterPos > wordPos && chipPos > waterPos,
    "C6 seat regex: the mono type word -> water -> the source Chip (water glued to the word)",
  );
  // the boundary clause's TWO FACES in one file (t767/t768's shape,
  // replayed): the row is a flex host and the water lands DIRECTLY after
  // the type span's close (the gap speaks — no explicit space), while
  // the file's text-flow hosts keep paying their own debts. The census
  // counts STRIPPED code (ELEVEN = ELEVEN, pre-surgery = post-surgery):
  // the full source's fourteen include three prose mentions ABOUT
  // overflow (the Task 64 legend lesson's own commentary) — the t760
  // meta-law applied to the payment census itself: count the debts,
  // not the prose about the debts (first-run repair: count-basis fix,
  // not a guessed number — both sides of the ledger were counted).
  const payments = (code.match(/truncate|min-w-0|overflow|whitespace-nowrap/g) ?? []).length;
  assert(
    code.includes("flex cursor-pointer items-center gap-2.5") &&
      code.includes("text-muted-foreground/70\">\n                  {job.type}\n                </span>\n                {pouring.length > 0 && (") &&
      payments === 11,
    "C7 boundary clause two faces: flex host owes nothing (gap speaks), ELEVEN code text-flow payments intact (stripped census — the full source's fourteen include three prose mentions ABOUT overflow)",
    `found ${payments}`,
  );
  assert(
    code.includes('className="shrink-0 font-mono text-[10px] text-muted-foreground/70"'),
    "C8 the type word keeps its mono anatomy (the water never mutates the word's room)",
  );
}

console.log("D — purity (hex stock honest, residents seated, summoner wired)");
{
  const hexes = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert(
    hexes === 8,
    `D1 hex stock EIGHT = EIGHT (the whole-stock audit ran BEFORE the anchor was written — the palette constants predate the surgery; the seat's ink is the lib's)`,
    `found ${hexes}`,
  );
  assert(
    src.includes("t771 — the compare rows speak the kind vocabulary") &&
      src.includes("t771 — the pours ask rides each row's OWN type word") &&
      src.includes("t771 — the water rides the type word as a flex sibling"),
    "D2 the t771 judgment notes lead their blocks (head + ask + seat)",
  );
  const storageHits = [...src.matchAll(/localStorage|sessionStorage/g)];
  const firstImport = src.indexOf("import ");
  assert(
    storageHits.length === 3 && (storageHits[0].index ?? Infinity) < firstImport,
    `D3 the THREE storage mentions: head note's documentation + one read + one write (zero NEW writes)`,
    `found ${storageHits.length}`,
  );
  assert(
    src.includes("restoreLatch.current") &&
      src.includes("/* ---------- persist selection ---------- */"),
    "D3b the storage write lives in the persist EFFECT (the honest contract, not a render write)",
  );
  for (const resident of [
    "restoreLatch",
    'data-testid="fsc-compare-live"',
    "curves at most",
    "fsc-compare-jump-",
    "fsc-compare-res-",
    "MAX_CURVES",
    "connectNulls",
  ]) {
    assert(src.includes(resident), `D4 old resident seated: ${resident.slice(0, 44)}`);
  }
  const summoner = readFileSync("src/components/workflow/results/fsc-chart.tsx", "utf8");
  assert(
    summoner.includes("<FscCompareDialog"),
    "D5 summoner wired: fsc-chart still mounts the compare overlay",
  );
}

console.log(`\nt771-fsc-pours-unit: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
