// t773 — the CLASS GALLERY's source line speaks the pours words: the
// kind vocabulary's THIRTY-FIRST reader, the family's EIGHTEENTH testid
// address (class-gallery-pours-). The gallery is the selection step's
// own face — a run's outputs laid out on a grid so the user can sort
// kept from cut — and the header now names the run it reads: the name
// says WHICH run, the mono type word says WHAT KIND, the water says
// which wires that kind feeds. The TRIAGE face of the commitment-seat
// taxonomy: the thumbnails ON the grid are one of the source's pours
// (a class2d's references2d averages, a class3d's per-class volumes)
// and the particles pour is the food the selection hands on — the dots
// name both ends of that bargain. This is a FLEX-HOST staging (the
// t771 form, not the t772 prose hug): the header row is
// flex-wrap items-center gap-2, the seat rides as a shrink-0 sibling,
// and the family's canonical container is verbatim — the dialect
// equation's NINETEENTH staging, now across EIGHT files.
//
//   A  one book: the import joins (two names, one home); the gated ask
//      appears exactly once in the FILE (comments stripped — the t760
//      meta-law: comments talk too, the counter must not bite them);
//      the riding ask verbatim on upstream.type (the source's own
//      word); the derivation sits beside is3dSource; the gate closes
//      on pouring (no ghost seats); the lib home keeps its question;
//      exactly one seat.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      TWENTIETH-interlocked, the gallery's three possible sources
//      speak by the lib's own answer (class2d -> [particles,
//      references2d], class3d -> [particles, volume], select2d ->
//      [particles] — every source pours the selection's food), every
//      known type speaks, the unknown silent, every pour's ink is a
//      real PORT_COLORS wire, and the thumbnails-are-pours interlock
//      (the class-average output port IS a references2d/volume kind).
//   C  the face: the eighteenth address verbatim, no collision with
//      the family's SEVENTEEN other DOM addresses, the container
//      verbatim (dialect equation NINETEENTH staging, cross-file
//      verbatim vs t760 + t766 + t767 + t768 + t769 + t771 + t772),
//      per-dot anatomy + sr-only ear line, the seat regex (the name
//      span -> the mono kind word -> the water -> the live chip), the
//      boundary clause's two faces in one file (the flex host owes
//      nothing — gap-2 is the space — and the file's TWO {" "} glue
//      payments + TWO truncate payments survive intact), the name
//      span's room untouched.
//   D  purity: ZERO hex = ZERO (the whole-stock audit ran BEFORE the
//      anchor was written), the t773 judgment notes lead their blocks,
//      storage 2 = 2 (the t156 sort-preference read+write pair — zero
//      new writes), the old residents keep their seats (the gallery
//      head, the view bar, the kept/noted doors, the sort key, the
//      filter-combination refusal), and the summoner (the job panel's
//      select2d Classes tab) still mounts this gallery.
//
// Runs standalone: node scripts/t773-class-pours-unit.mjs  (exit 0 =
// all green; every failure prints FAIL + the assert label).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

let pass = 0, fail = 0;
const ok = (label) => { pass++; console.log(`  ok  ${label}`); };
const bad = (label, extra) => { fail++; console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); };
const assert = (cond, label, extra) => (cond ? ok(label) : bad(label, extra));

const src = readFileSync("src/components/workflow/class-gallery.tsx", "utf8");
const lib = readFileSync("src/lib/workflow.ts", "utf8");
const panel = readFileSync("src/components/workflow/job-panel.tsx", "utf8");

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

console.log("A — one book (the import joins, the ask rides the source's own word)");
{
  assert(
    /import \{ pourKindsOf, PORT_COLORS \} from "@\/lib\/workflow";/.test(src),
    "A1 import joins: two names, one home",
  );
  const gated = (code.match(/pourKindsOf\(/g) ?? []).length;
  assert(gated === 1, `A2 gated ask exactly once in file (comments stripped)`, `found ${gated}`);
  assert(
    code.includes("const pouring = upstream ? pourKindsOf(upstream.type) : [];"),
    "A3 riding ask verbatim (the source's own word gates the pours)",
  );
  // the ask sits beside the source-kind derivation — one neighborhood,
  // one source word-form feeding name, seat and address alike
  const is3dPos = code.indexOf('upstream?.type === "class3d"');
  const pouringPos = code.indexOf("const pouring = upstream ? pourKindsOf(upstream.type) : [];");
  assert(
    is3dPos >= 0 && pouringPos > is3dPos,
    "A4 the ask sits beside is3dSource (one kind neighborhood in the component)",
  );
  const wordUses = (code.match(/upstream\.type/g) ?? []).length;
  assert(
    wordUses >= 3,
    "A5 one source word-form, many readers (derivation + mono word + testid address)",
    `found ${wordUses}`,
  );
  assert(
    code.includes("{pouring.length > 0 && ("),
    "A6 render gate closes on pouring (no ghost seats — the t771 flex form)",
  );
  assert(
    /export function pourKindsOf\(/.test(lib) || /export const pourKindsOf/.test(lib),
    "A7 lib home keeps its question (pourKindsOf exported from lib/workflow)",
  );
  const seats = (code.match(/data-testid=\{`class-gallery-pours-/g) ?? []).length;
  assert(seats === 1, "A8 exactly one seat (one word-form, one dose per gallery)", `found ${seats}`);
}

console.log("B — live-fire (40 types, zero ghosts, the gallery's three sources speak)");
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
    "B3 t747 account TWENTIETH-interlocked ([[1,35],[2,3],[3,2]] sorted before compared)",
    JSON.stringify(account),
  );
  // the gallery's upstream filter admits exactly class2d | select2d |
  // class3d (the component's own line) — the lib must answer all three
  assert(
    JSON.stringify(pourKindsOf("class2d")) === JSON.stringify(["particles", "references2d"]),
    "B4 class2d pours particles, references2d (PORT_COLORS order — the lib's own answer)",
    JSON.stringify(pourKindsOf("class2d")),
  );
  assert(
    JSON.stringify(pourKindsOf("class3d")) === JSON.stringify(["particles", "volume"]),
    "B5 class3d pours particles, volume (the z-plane dialect's own water)",
    JSON.stringify(pourKindsOf("class3d")),
  );
  assert(
    JSON.stringify(pourKindsOf("select2d")) === JSON.stringify(["particles"]),
    "B6 select2d pours particles (the selection's food, alone)",
    JSON.stringify(pourKindsOf("select2d")),
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).length > 0 && jobType(t.key) != null) &&
      pourKindsOf("no-such-type").length === 0,
    "B7 every known type speaks, the unknown silent (the undefined law's face)",
  );
  // every pour's ink is a real wire hex from the lib — the dots' colors
  // are the book's, never guessed in the component
  const wires = Object.values(PORT_COLORS).map((p) => p.wire);
  assert(
    wires.every((w) => /^#[0-9a-f]{6}$/i.test(w)),
    "B8 every pour's ink is a real PORT_COLORS wire (the lib's hex, not the component's)",
  );
  // the thumbnails-are-pours interlock: the class-average port the grid
  // renders IS the kind the water names (class2d's classAverages ->
  // references2d; class3d's model -> volume)
  const c2d = jobType("class2d");
  const c3d = jobType("class3d");
  assert(
    c2d?.outputs.some((o) => o.name === "classAverages" && o.kind === "references2d") &&
      c3d?.outputs.some((o) => o.name === "model" && o.kind === "volume"),
    "B9 the thumbnails-are-pours interlock (classAverages IS references2d, model IS volume)",
  );
}

console.log("C — the face (eighteenth address, flex-host staging)");
{
  assert(
    code.includes("data-testid={`class-gallery-pours-${upstream.type}`}"),
    "C1 the eighteenth address verbatim (class-gallery-pours-{type})",
  );
  const family = [
    "cleanup-pours-", "cmd-pours-", "cmd-preset-pours-", "cmd-user-pours-",
    "fsc-compare-pours-", "funnel-pours-", "lens-pours-", "palette-fav-pours-",
    "palette-pours-", "params-diff-pours-", "peek-pours-", "queue-pours-",
    "refmap-pours-", "remote-pours-", "runtime-pours-", "shelf-pours-",
    "storage-pours-",
  ];
  assert(
    family.length === 17 && family.every((a) => !code.includes(`data-testid={\`${a}`)) &&
      !family.some((a) => a === "class-gallery-pours-"),
    "C2 no collision with the family's SEVENTEEN other DOM addresses (none of them lives here)",
  );
  assert(
    code.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C3 container class verbatim (the family's canonical container)",
  );
  // dialect equation, NINETEENTH staging: the container class verbatim-
  // equals the t760 prose form AND the t766 + t767 + t768 + t769 + t771
  // + t772 seats ACROSS FILES
  const t760 = stripLineComments(readFileSync("src/components/workflow/reference-map-card.tsx", "utf8"));
  const t766 = stripLineComments(readFileSync("src/components/workflow/params-diff-dialog.tsx", "utf8"));
  const t767 = stripLineComments(readFileSync("src/components/workflow/cleanup-dialog.tsx", "utf8"));
  const t768 = stripLineComments(readFileSync("src/components/workflow/remote-run-button.tsx", "utf8"));
  const t769 = stripLineComments(readFileSync("src/components/workflow/storage-dialog.tsx", "utf8"));
  const t771 = stripLineComments(readFileSync("src/components/workflow/results/fsc-compare-dialog.tsx", "utf8"));
  const t772 = stripLineComments(readFileSync("src/components/workflow/results/particle-funnel-dialog.tsx", "utf8"));
  assert(
    t760.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t766.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t767.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t768.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t769.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t771.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t772.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C4 dialect equation nineteenth staging: container verbatim-equals t760 + t766 + t767 + t768 + t769 + t771 + t772 across files",
  );
  assert(
    code.includes('aria-hidden="true"') &&
      /title=\{`pours \$\{k\}`\}/.test(code) &&
      code.includes("inline-block size-1.5 rounded-full") &&
      code.includes("style={{ background: PORT_COLORS[k].wire }}") &&
      code.includes('className="sr-only">pours {pouring.join(", ")}'),
    "C5 per-dot anatomy + sr-only ear line verbatim",
  );
  // position anchor on unique word-forms: the name span (whose title is
  // the run's name) -> the mono kind word span -> the water seat -> the
  // live chip (the heartbeat the header already carried)
  const namePos = code.indexOf('title={upstream.name}');
  const kindPos = code.indexOf('text-muted-foreground/70">\n          {upstream.type}');
  const waterPos = code.indexOf("class-gallery-pours-${upstream.type}");
  const chipPos = code.indexOf('data-canvas-ui="class-gallery-live"');
  assert(
    namePos >= 0 && kindPos > namePos && waterPos > kindPos && chipPos > waterPos,
    "C6 seat regex: the name span -> the mono kind word -> the water -> the live chip",
  );
  // the boundary clause's two faces, counted BEFORE the anchor was
  // written: the header is a FLEX HOST (gap-2 is the space — flex hosts
  // owe nothing, the seat adds no glue), and the file's own text-flow
  // payments survive untouched (two {" "} glue + two truncate host
  // classNames — the t771 count-basis lesson: count first, anchor second)
  assert(
    code.includes('"flex flex-wrap items-center gap-2 border-b px-3 py-2"') &&
      (code.match(/\{" "\}/g) ?? []).length === 2,
    "C7a boundary clause face one: the flex host's gap is the space + the file's TWO glue payments intact",
    `glue=${(code.match(/\{" "\}/g) ?? []).length}`,
  );
  assert(
    (code.match(/className="truncate/g) ?? []).length === 2,
    "C7b boundary clause face two: the file's TWO truncate payments intact (the name span + the occupancy footer)",
    `truncate=${(code.match(/className="truncate/g) ?? []).length}`,
  );
  assert(
    code.includes('className="truncate font-mono text-[10px] text-muted-foreground" title={upstream.name}'),
    "C8 the name span's room untouched (truncate + mono + title verbatim)",
  );
}

console.log("D — purity (zero hex, storage 2=2, residents seated, summoner wired)");
{
  assert(
    (src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length === 0,
    "D1 ZERO hex = ZERO (the whole-stock audit ran BEFORE the anchor was written — the t766/t767/t768 lesson applied: count first, anchor second)",
  );
  assert(
    src.includes("t773 — the gallery names its source's kind") &&
      src.includes("t773 — the water rides the kind word as a flex sibling") &&
      src.includes("t773 — the pours ask rides the source's own type word"),
    "D2 the t773 judgment notes lead their blocks (head + seat + ask)",
  );
  const storageHits = [...src.matchAll(/localStorage|sessionStorage/g)];
  assert(
    storageHits.length === 2,
    "D3 storage 2 = 2 (the t156 sort-preference read+write pair intact, zero new writes)",
    `found ${storageHits.length}`,
  );
  for (const resident of [
    "Class gallery",
    'data-canvas-ui="class-viewbar"',
    'data-canvas-ui="kept-only"',
    'data-canvas-ui="noted-only"',
    "cryoflow.classGallerySort.v1",
    "No classes match the current filter combination",
    'aria-label="Class selection gallery"',
  ]) {
    assert(src.includes(resident), `D4 old resident seated: ${resident.slice(0, 44)}`);
  }
  assert(
    panel.includes('spec?.key === "select2d" && t === allTabs[0]') && panel.includes("<ClassGallery"),
    "D5 summoner wired: the job panel still mounts the gallery on the select2d Classes tab",
  );
}

console.log(`\nt773-class-pours-unit: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
