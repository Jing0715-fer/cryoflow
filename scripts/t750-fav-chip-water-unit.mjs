// t750 — the favorite chip borrows the same water dots: the quick-add
// bar is the menu AHEAD of the menu (Task 133's one-click shelf — the
// user pinned these types, they'll add them most), so the t747 promise
// rides it too. The thirteenth reader read the seat's placard (t748);
// this fourteenth reader reads the SHELF — the chips sit above the
// catalog rows, before search, before scroll. Dialect is t747 verbatim:
// one dot per unique poured kind riding the resting wire hex, small is
// the whisper (size-1.5), the word per dot on its title, an sr-only ear
// line; one family only (pours — same-shaped dots cannot tell pours from
// drinks, the appetite's sentence stays in the dictionary card). The
// chip's own contracts (Task 133 title, Task 155 caret, Task 163 touch)
// are untouched — the dots ride BETWEEN the name and the star.
//
//   A  one book: the chip asks the lib's own named question
//      (pourKindsOf — the t746 home, asked once per chip render, read by
//      dots and ear), dots ride PORT_COLORS[k].wire.
//   B  live-fire over the TYPE SPACE (40): the pour distribution holds
//      the t747 account ([[1,35],[2,3],[3,2]]), zero ghost kinds, and
//      every chip's dot count is computable (no zero-pour chips).
//   C  the face: the palette-fav-pours-{key} testid (aligned with the
//      palette-fav-chip-{key} family), dots verbatim the t747 shape,
//      the t133 chip title contract intact, the dots' seat between name
//      and star.
//   D  purity: no hex literals in the chip strip, the t747 row dots
//      keep their seat (two readers, one dialect, distinct addresses),
//      no storage writes.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const pal = readFileSync(path.join(here, "..", "src", "components", "workflow", "palette.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");

// the chip strip: the favorites quick-add section only
const stripStart = pal.indexOf("{/* ---- favorites quick-add chips (Task 133) ---- */}");
const stripEnd = pal.indexOf("{/* ---- recently used quick-add chips ---- */}", stripStart);
const strip = stripStart >= 0 && stripEnd > stripStart ? pal.slice(stripStart, stripEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, at the shelf                                          */
/* ================================================================== */
console.log("\nA — the chip asks the lib's named question");

must(strip.includes("const pouring = pourKindsOf(t.key);"),
  "A the chip asks pourKindsOf inside its own map (asked once per chip render)");

must(libHomeHasPour(), "A pourKindsOf still lives in the lib home (the t746 question, not shelf logic)");
function libHomeHasPour() {
  const start = wf.indexOf("t746 — the dictionary page's water row");
  const end = wf.indexOf("/** Port shorthands. */", start);
  return start >= 0 && end > start && /export function pourKindsOf\(typeKey: string\): PortKind\[\]/.test(wf.slice(start, end));
}

must((strip.match(/const pouring/g) || []).length === 1,
  "A the question is asked exactly ONCE in the strip (dots + ear read the answer)");

must(strip.includes("PORT_COLORS[k].wire"),
  "A dots ride PORT_COLORS[k].wire (the t735 sample, now on the shelf)");

/* ================================================================== */
/* B — live-fire over the type space                                   */
/* ================================================================== */
console.log("\nB — the type space's pour account, re-counted at the shelf");

let ghost = 0;
const dist = {};
for (const t of JOB_TYPES) {
  const pk = pourKindsOf(t.key);
  for (const k of pk) if (!PORT_COLORS[k]) ghost++;
  dist[pk.length] = (dist[pk.length] ?? 0) + 1;
}

must(JOB_TYPES.length === 40, "B the type space is 40 strong", `got ${JOB_TYPES.length}`);
must(ghost === 0, "B zero ghost kinds (every dot the shelf can show has a color)");
must(dist[1] === 35 && dist[2] === 3 && dist[3] === 2 && dist[0] === undefined,
  "B the pour distribution holds the t747 account ([[1,35],[2,3],[3,2]], no zero-pour chips)",
  `got ${JSON.stringify(dist)}`);

/* ================================================================== */
/* C — the face                                                        */
/* ================================================================== */
console.log("\nC — the shelf's face");

must(strip.includes("data-testid={`palette-fav-pours-${t.key}`}"),
  "C the container testid is palette-fav-pours-{key} (aligned with the palette-fav-chip-{key} family)");

must((strip.match(/data-testid=\{`palette-fav-pours-/g) || []).length === 1,
  "C exactly one pours container in the chip strip (the chip has one promise)");

must((strip.match(/title=\{`pours \$\{k\}`\}/g) || []).length === 1,
  "C the word per dot rides the title (verbatim t747 form: pours ${k})");

must((strip.match(/aria-hidden="true"/g) || []).length >= 2,
  "C the dots are aria-hidden (decor stays out of the ear)",
  `got ${(strip.match(/aria-hidden="true"/g) || []).length} marks (icon + star + dots)`);

must(strip.includes('className="inline-block size-1.5 rounded-full"'),
  "C the dots are the scanning whisper (size-1.5, verbatim t747 shape)");

must(strip.includes('sr-only">pours {pouring.join(", ")}'),
  "C the sr-only ear line names the kinds (verbatim t747 grammar)");

must(/<span className="max-w-28 truncate">\{t\.label\}<\/span>[\s\S]*palette-fav-pours[\s\S]*<Star className="size-2\.5 shrink-0/.test(strip),
  "C the dots' seat is between the name and the star (name → water → keep-the-type)");

must(strip.includes("title={`Add ${t.label} at the viewport center — drag / touch long-press to reorder (Alt+←/→)`}"),
  "C the t133 chip title contract is verbatim (the dots add no words to it)");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — the shelf stays clean");

const hexLines = strip.split("\n").filter((l) => /#[0-9a-fA-F]{3,8}\b/.test(l));
must(hexLines.every((l) => l.includes("shadow-[inset_")),
  "D hex in the chip strip belongs only to the t155 caret shadow (a known resident — the dots' ink rides PORT_COLORS)",
  `${hexLines.length} hex line(s)${hexLines.length ? ", all caret" : ""}`);

must(pal.includes("data-testid={`palette-pours-${t.key}`}"),
  "D the t747 row dots keep their seat (two readers, one dialect, distinct addresses)");

must(!/localStorage|sessionStorage/.test(strip),
  "D no storage writes in the chip strip (t133's collector keeps its own home)");

must(strip.includes('data-testid="palette-favs-row"') && strip.includes("data-fav-chip"),
  "D the shelf's own contracts keep their seats (favs row + chip markers)");

/* ================================================================== */
console.log(`\n${PASS}/${PASS + FAIL}`);
process.exit(FAIL === 0 ? 0 : 1);
