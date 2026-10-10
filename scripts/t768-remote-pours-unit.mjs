// t768 — the REMOTE RUN dialog's identity row speaks the pours words: the
// kind vocabulary's TWENTY-EIGHTH reader, the family's FIFTEENTH testid
// address (remote-pours-). The dialog is the DISPATCH CONFIRM — the
// commitment seat's dispatch face — and its own copy already promises
// "key files sync back when it lands": the pours ARE what lands, so the
// dots sit right after the type badge as the harvest's color-face — know
// what comes back before the submit writes it. The identity row is a
// flex-wrap HOST (gap-2 is the space, no {" "} whitespace discipline):
// the t760 prose law's BOUNDARY CLAUSE's second staging (t767's cleanup
// dialog staged the first face — flex hosts owe nothing; this file pays
// FIVE text-flow debts elsewhere, the two disciplines cohabiting one
// file again). The gate closes on pouring (the t763/t764/t767 pour-gate
// form); unknown types keep the bare badge (the undefined law's seventh
// face). The continue variant ("Continue on cluster") shares the row —
// ONE seat covers both dispatch faces.
//
//   A  one book: the import joins (three names, one home); the gated
//      ask appears exactly once in the FILE (comments stripped — the
//      t760 meta-law); the spec ask + riding ask verbatim; the render
//      gate closes on pouring; the lib home keeps its question; exactly
//      one seat.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      SIXTEENTH-interlocked, refine3d pours by the lib's own answer,
//      every known type speaks, the unknown silent, every pour's ink is
//      a real PORT_COLORS wire.
//   C  the face: the fifteenth address verbatim, no collision with the
//      family's fourteen DOM addresses, the container class verbatim
//      (dialect equation FIFTEENTH staging, cross-file verbatim vs
//      t760 + t766 + t767), per-dot anatomy + sr-only ear line, the seat
//      regex (badge -> water -> the sync-back promise), the boundary
//      clause's two faces in one file (flex host owes nothing / five
//      text-flow payments intact), the badge's mono anatomy untouched.
//   D  purity: ZERO hex = ZERO (the whole-stock audit ran BEFORE the
//      anchor was written — the t766/t767 lesson applied), the t768
//      judgment note leads its block, the ONE localStorage mention is
//      the head note's documentation of the manager's key (zero code
//      writes), the old residents keep their seats (the door's aria
//      name, the custom-module door, the slurm width truth, the
//      continue variant), and the two summoners (inspector + job panel)
//      still mount this dialog.
//
// Runs standalone: node scripts/t768-remote-pours-unit.mjs  (exit 0 =
// all green; every failure prints FAIL + the assert label).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

let pass = 0, fail = 0;
const ok = (label) => { pass++; console.log(`  ok  ${label}`); };
const bad = (label, extra) => { fail++; console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); };
const assert = (cond, label, extra) => (cond ? ok(label) : bad(label, extra));

const src = readFileSync("src/components/workflow/remote-run-button.tsx", "utf8");
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
    code.includes("{pouring.length > 0 && (") && code.includes("data-testid={`remote-pours-${job.type}`}"),
    "A5 render gate closes on pouring (the t763/t764/t767 pour-gate form)",
  );
  assert(
    /export function pourKindsOf\(/.test(lib) || /export const pourKindsOf/.test(lib),
    "A6 lib home keeps its question (pourKindsOf exported from lib/workflow)",
  );
  const seats = (code.match(/data-testid=\{`remote-pours-/g) ?? []).length;
  assert(seats === 1, "A7 exactly one seat (ONE row covers both dispatch faces)", `found ${seats}`);
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
    "B3 t747 account SIXTEENTH-interlocked ([[1,35],[2,3],[3,2]] sorted before compared)",
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
    "B5 every known type speaks, the unknown silent (the undefined law's seventh face)",
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).every((k) => typeof PORT_COLORS[k]?.wire === "string" && PORT_COLORS[k].wire.startsWith("#"))),
    "B6 every pour's ink is a real PORT_COLORS wire (the dots' hex is the lib's, not guessed)",
  );
}

console.log("C — the face (fifteenth address, flex host, boundary clause)");
{
  assert(
    code.includes("data-testid={`remote-pours-${job.type}`}"),
    "C1 the fifteenth address verbatim (remote-pours-{type})",
  );
  const family = [
    "lens-pours-${", "peek-pours-${", "refmap-pours-${", "runtime-pours-${",
    "palette-fav-pours-${", "palette-pours-${", "queue-pours-${",
    "cmd-pours-${", "cmd-preset-pours-${", "cmd-user-pours-${", "shelf-pours-${",
    "storage-pours-${", "params-diff-pours-${", "cleanup-pours-${",
  ];
  assert(
    family.every((f) => !src.includes(f)),
    "C2 no collision with the family's fourteen DOM addresses (none of them lives here)",
  );
  assert(
    code.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C3 container class verbatim (the family's canonical container)",
  );
  // dialect equation, FIFTEENTH staging: the container class verbatim-
  // equals the t760 prose form AND the t766 + t767 seats ACROSS FILES
  const t760 = stripLineComments(readFileSync("src/components/workflow/reference-map-card.tsx", "utf8"));
  const t766 = stripLineComments(readFileSync("src/components/workflow/params-diff-dialog.tsx", "utf8"));
  const t767 = stripLineComments(readFileSync("src/components/workflow/cleanup-dialog.tsx", "utf8"));
  assert(
    t760.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t766.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t767.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C4 dialect equation fifteenth staging: container verbatim-equals t760 + t766 + t767 across files",
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
  const waterPos = code.indexOf("remote-pours-${job.type}");
  const promisePos = code.indexOf("key files sync back when it lands");
  assert(
    badgePos >= 0 && waterPos > badgePos && promisePos > waterPos,
    "C6 seat regex: the type badge -> water -> the sync-back promise (water glued to the word)",
  );
  // the boundary clause's TWO FACES in one file (t767's shape, replayed):
  // the identity row is a flex-wrap host and the water lands DIRECTLY
  // after </Badge> (the gap speaks — no explicit space), while the
  // file's text-flow hosts keep paying their own explicit-space debts
  assert(
    src.includes('className="flex flex-wrap items-center gap-2"') &&
      src.includes("</Badge>\n              {pouring.length > 0 && (") &&
      code.includes('offers{" "}'),
    "C7 boundary clause two faces: flex host owes nothing (gap speaks), text-flow hosts keep paying {\" \"}",
  );
  assert(
    code.includes('className="h-5 px-1.5 font-mono text-[10px] font-medium text-muted-foreground"'),
    "C8 the badge keeps its mono anatomy (the water never mutates the word's room)",
  );
}

console.log("D — purity (zero hex stock, residents seated, summoners wired)");
{
  const hexes = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert(
    hexes === 0,
    `D1 ZERO hex = ZERO (the whole-stock audit ran BEFORE the anchor was written — the t766/t767 lesson applied: count first, anchor second)`,
    `found ${hexes}`,
  );
  assert(
    src.includes("t768 — the pours ask rides the header's type badge"),
    "D2 the t768 judgment note leads its block",
  );
  const storageHits = [...src.matchAll(/localStorage|sessionStorage/g)];
  const firstImport = src.indexOf("import ");
  assert(
    storageHits.length === 1 && (storageHits[0].index ?? Infinity) < firstImport,
    `D3 the ONE localStorage mention is the head note's documentation (zero code writes)`,
    `found ${storageHits.length}`,
  );
  for (const resident of [
    'aria-label="Run on cluster (SSH)"',
    "CUSTOM_MODULE_VALUE",
    "slurmWidthFor",
    "Continue on cluster",
    "describeSubtreeRun",
  ]) {
    assert(src.includes(resident), `D4 old resident seated: ${resident.slice(0, 44)}`);
  }
  const summoner1 = readFileSync("src/components/workflow/job-inspector.tsx", "utf8");
  const summoner2 = readFileSync("src/components/workflow/job-panel.tsx", "utf8");
  assert(
    summoner1.includes("<RemoteRunButton"),
    "D5 summoner one wired: the inspector still mounts the remote run dialog",
  );
  assert(
    summoner2.includes("<RemoteRunButton"),
    "D5b summoner two wired: the job panel still mounts the remote run dialog",
  );
}

console.log(`\nt768-remote-pours-unit: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
