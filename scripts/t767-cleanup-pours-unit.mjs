// t767 — the CLEANUP DIALOG's identity row speaks the pours words: the
// kind vocabulary's TWENTY-SEVENTH reader, the family's FOURTEENTH testid
// address (cleanup-pours-). The dialog is the DESTRUCTIVE CONFIRM — the
// confirm seat's destructive face — and its closing sentence already
// promises "chainable outputs ... always stay" in words; the pours ARE
// those chainable outputs, so the dots sit right after the type badge as
// the promise's color-face: know what stays before choosing what goes.
// The description row is a flex-wrap HOST: gap-1.5 is the space, no {" "}
// whitespace discipline — the t760 prose law's BOUNDARY CLAUSE (text-flow
// hosts owe the explicit space, flex hosts let the gap speak), and this
// very file stages both faces: the description row (flex) pays nothing,
// the inner confirm's prose ("On {sides}: {" "}") pays the explicit
// space. The gate closes on pouring (the t763/t764 pour-gate form: the
// water's own emptiness is the gate); unknown types keep the bare badge
// (the undefined law's sixth face). The inner confirm repeats the
// keep-set sentence but names no type — water rides the word, and there
// the word is not named.
//
//   A  one book: the import joins (three names, one home); the gated
//      ask appears exactly once in the FILE (comments stripped — the
//      t760 meta-law); the spec ask + riding ask verbatim; the render
//      gate closes on pouring; the lib home keeps its question; exactly
//      one seat.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      FIFTEENTH-interlocked, refine3d pours by the lib's own answer,
//      every known type speaks, the unknown silent, every pour's ink is
//      a real PORT_COLORS wire.
//   C  the face: the fourteenth address verbatim, no collision with the
//      family's thirteen DOM addresses, the container class verbatim
//      (dialect equation FOURTEENTH staging, cross-file verbatim vs
//      t760/t766), per-dot anatomy + sr-only ear line, the seat regex
//      (badge -> water -> the chainable sentence), the boundary clause's
//      two faces in one file (flex host pays nothing / prose host pays
//      {" "}), the badge's mono anatomy untouched.
//   D  purity: ZERO hex = ZERO (the whole-stock audit ran BEFORE the
//      anchor was written — the t766 lesson applied: count first, anchor
//      second; purity bites additions, not stock), the t767 judgment
//      note leads its block, zero storage writes, the old residents keep
//      their seats (dialog/confirm anchors, the two-step doors, the t522
//      history strip, CLEANUP_TIERS), both keep-set sentences survive,
//      and the two summoners (inspector eraser door + storage t441 door)
//      still import this dialog.
//
// Runs standalone: node scripts/t767-cleanup-pours-unit.mjs  (exit 0 = all
// green; every failure prints FAIL + the assert label).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

let pass = 0, fail = 0;
const ok = (label) => { pass++; console.log(`  ok  ${label}`); };
const bad = (label, extra) => { fail++; console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); };
const assert = (cond, label, extra) => (cond ? ok(label) : bad(label, extra));

const src = readFileSync("src/components/workflow/cleanup-dialog.tsx", "utf8");
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
const stripLineComments = (s) =>
  s.split("\n").map((l) => {
    const i = l.indexOf("//");
    return i >= 0 ? l.slice(0, i) : l;
  }).join("\n");
const code = stripLineComments(src);

console.log("A — one book (the import joins, the gated ask rides)");
{
  assert(
    /import \{ jobType, pourKindsOf, PORT_COLORS \} from "@\/lib\/workflow";/.test(src),
    "A1 import joins: three names, one home",
  );
  const gated = (code.match(/pourKindsOf\(/g) ?? []).length;
  assert(gated === 1, `A2 gated ask exactly once in file (comments stripped)`, `found ${gated}`);
  assert(code.includes("const spec = jobType(job.type);"), "A3 the spec ask verbatim (the dialog asks once)");
  assert(
    code.includes("const pouring = spec ? pourKindsOf(job.type) : [];"),
    "A4 riding ask verbatim (spec gates the pours)",
  );
  assert(
    code.includes("{pouring.length > 0 && (") && code.includes("data-testid={`cleanup-pours-${job.type}`}"),
    "A5 render gate closes on pouring (the t763/t764 pour-gate form)",
  );
  assert(
    /export function pourKindsOf\(/.test(lib) || /export const pourKindsOf/.test(lib),
    "A6 lib home keeps its question (pourKindsOf exported from lib/workflow)",
  );
  const seats = (code.match(/data-testid=\{`cleanup-pours-/g) ?? []).length;
  assert(seats === 1, "A7 exactly one seat (ONE type word speaks for the dialog)", `found ${seats}`);
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
    "B3 t747 account FIFTEENTH-interlocked ([[1,35],[2,3],[3,2]] sorted before compared)",
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
    "B5 every known type speaks, the unknown silent (the undefined law's sixth face)",
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).every((k) => typeof PORT_COLORS[k]?.wire === "string" && PORT_COLORS[k].wire.startsWith("#"))),
    "B6 every pour's ink is a real PORT_COLORS wire (the dots' hex is the lib's, not guessed)",
  );
}

console.log("C — the face (fourteenth address, flex host, boundary clause)");
{
  assert(
    code.includes("data-testid={`cleanup-pours-${job.type}`}"),
    "C1 the fourteenth address verbatim (cleanup-pours-{type})",
  );
  const family = [
    "lens-pours-${", "peek-pours-${", "refmap-pours-${", "runtime-pours-${",
    "palette-fav-pours-${", "palette-pours-${", "queue-pours-${",
    "cmd-pours-${", "cmd-preset-pours-${", "cmd-user-pours-${", "shelf-pours-${",
    "storage-pours-${", "params-diff-pours-${",
  ];
  assert(
    family.every((f) => !src.includes(f)),
    "C2 no collision with the family's thirteen DOM addresses (none of them lives here)",
  );
  assert(
    code.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C3 container class verbatim (the family's canonical container)",
  );
  // dialect equation, FOURTEENTH staging: the container class verbatim-
  // equals the t760 refmap prose word-form AND the t766 diff-dialog seat
  // ACROSS FILES (one container law)
  const t760 = stripLineComments(readFileSync("src/components/workflow/reference-map-card.tsx", "utf8"));
  const t766 = stripLineComments(readFileSync("src/components/workflow/params-diff-dialog.tsx", "utf8"));
  assert(
    t760.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t766.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C4 dialect equation fourteenth staging: container verbatim-equals t760 + t766 across files",
  );
  assert(
    code.includes("aria-hidden=\"true\"") &&
      /title=\{`pours \$\{k\}`\}/.test(code) &&
      code.includes("inline-block size-1.5 rounded-full") &&
      code.includes("style={{ background: PORT_COLORS[k].wire }}") &&
      code.includes('className="sr-only">pours {pouring.join(", ")}'),
    "C5 per-dot anatomy + sr-only ear line verbatim",
  );
  const badgePos = code.indexOf("</Badge>");
  // anchor on the FULL testid word-form: the block comment survives line-
  // comment stripping (the t760 meta-law strips // only) and it names the
  // address in prose — the full `cleanup-pours-${job.type}` form is the
  // seat's alone, so the position anchor cannot be stolen by the file's
  // own head note (the anchor-bytes lesson at position level)
  const waterPos = code.indexOf("cleanup-pours-${job.type}");
  const sentencePos = code.indexOf("chainable outputs, logs, resume checkpoints and cluster twins always stay.");
  assert(
    badgePos >= 0 && waterPos > badgePos && sentencePos > waterPos,
    "C6 seat regex: the type badge -> water -> the chainable sentence (water glued to the word)",
  );
  // the boundary clause's TWO FACES in one file: the description row is a
  // flex-wrap host and the water lands DIRECTLY after </Badge> (the gap
  // speaks — no explicit space), while the inner confirm's prose pays the
  // explicit space (":{\" \"}") because it is a text-flow host
  assert(
    src.includes('className="mt-1 flex flex-wrap items-center gap-1.5 text-xs"') &&
      src.includes("</Badge>\n              {pouring.length > 0 && (") &&
      src.includes(':{" "}'),
    "C7 boundary clause two faces: flex host owes nothing (gap speaks), prose host pays {\" \"}",
  );
  assert(
    code.includes('className="h-4 px-1 font-mono text-[9.5px] font-normal text-foreground/80"'),
    "C8 the badge keeps its mono anatomy (the water never mutates the word's room)",
  );
}

console.log("D — purity (zero hex stock, residents seated, summoners wired)");
{
  const hexes = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert(
    hexes === 0,
    `D1 ZERO hex = ZERO (the whole-stock audit ran BEFORE the anchor was written — the t766 lesson applied: count first, anchor second; purity bites additions, not stock)`,
    `found ${hexes}`,
  );
  assert(
    src.includes("t767 — the pours ask rides the header's type badge"),
    "D2 the t767 judgment note leads its block",
  );
  const storage = (src.match(/localStorage|sessionStorage/g) ?? []).length;
  assert(storage === 0, `D3 zero storage writes`, `found ${storage}`);
  for (const resident of [
    'data-cleanup-dialog=""',
    'data-cleanup-confirm=""',
    "Clean intermediates",
    "aria-label={`Clean ${selection.files} files (about ${fmtBytes(selection.bytes)})`}",
    "Keep them",
    "Delete them",
  ]) {
    assert(src.includes(resident), `D4 old resident seated: ${resident.slice(0, 44)}`);
  }
  assert(
    src.includes("chainable outputs, logs, resume checkpoints and cluster twins always stay.") &&
      src.includes("The keep-set (chainable outputs, logs, resume checkpoints, cluster twins) is not touched."),
    "D5 both keep-set sentences survive (the water's word-face in both steps)",
  );
  assert(
    src.includes('/api/cleanup-history') && src.includes("CLEANUP_TIERS"),
    "D5b the t522 history strip + CLEANUP_TIERS keep their seats",
  );
  const summoner1 = readFileSync("src/components/workflow/job-inspector.tsx", "utf8");
  const summoner2 = readFileSync("src/components/workflow/storage-dialog.tsx", "utf8");
  assert(
    summoner1.includes('import { CleanupDialog } from "./cleanup-dialog";') &&
      summoner1.includes('aria-label="Clean intermediates (local + cluster)"'),
    "D6 summoner one wired: the inspector eraser door still imports and opens this dialog",
  );
  assert(
    summoner2.includes('import { CleanupDialog } from "./cleanup-dialog";'),
    "D6b summoner two wired: the storage run row's t441 visiting shovel still imports this dialog",
  );
}

console.log(`\nt767-cleanup-pours-unit: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
