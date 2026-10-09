// t751 — the shelf card's identity line borrows the water dots: a user
// param preset is saved params FOR a type (Task 716's overview face),
// so before applying it the card says what that type pours. The
// fourteenth reader read the quick-add shelf (t750); this fifteenth
// reader reads the PRESET shelf — the snapshot cards scanned before any
// door is opened. Dialect is t750/t747 verbatim: one dot per unique
// poured kind riding the resting wire hex, small is the whisper
// (size-1.5), the word per dot on its title, an sr-only ear line; one
// family only (pours — the appetite's full sentence stays in the
// dictionary behind the t733 door). The undefined law's component side
// twice: an unknown type doesn't even ASK (the ask gate) and its card
// renders no dots (the render gate) — silence is a posture, nothing
// would be a lie (t748's law, third component staging).
//
//   A  one book: the card asks the lib's own named question
//      (pourKindsOf — the t746 home, asked once per card render, read
//      by dots and ear), dots ride PORT_COLORS[k].wire, both gates in
//      place (ask + render).
//   B  live-fire over the TYPE SPACE (40): the pour distribution holds
//      the t747 account ([[1,35],[2,3],[3,2]]) — now THIRD-interlocked
//      (t747 rows, t750 chips, t751 shelf) — zero ghost kinds, sorted
//      before compared (t748's order lesson).
//   C  the face: the shelf-pours-{type} testid (aligned with the
//      shelf-info-{type} family), dots verbatim the t750 shape (the two
//      blocks structurally equal), the dots' seat between the type
//      label and the t733 dictionary door.
//   D  purity: zero hex literals in the shelf file (it had none before;
//      the dots' ink rides PORT_COLORS), the t733/t717 residents keep
//      their seats, no storage writes in the t751 block.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const shelfSrc = readFileSync(path.join(here, "..", "src", "components", "workflow", "user-preset-shelf.tsx"), "utf8");
const pal = readFileSync(path.join(here, "..", "src", "components", "workflow", "palette.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");

// slice discipline (t748's lesson: an assertion = word form × ground):
// the card slice is the whole shelf.map callback; the ask slice is the
// map head; the water slice is the t751 note through the t733 note.
const cardStart = shelfSrc.indexOf("{shelf.map((p) => {");
const cardEnd = shelfSrc.indexOf("{hidden > 0 ?", cardStart);
const card = cardStart >= 0 && cardEnd > cardStart ? shelfSrc.slice(cardStart, cardEnd) : "";

const askStart = cardStart;
const askEnd = shelfSrc.indexOf("const knobs", cardStart);
const ask = askStart >= 0 && askEnd > askStart ? shelfSrc.slice(askStart, askEnd) : "";

const waterStart = shelfSrc.indexOf("{/* t751 —", cardStart);
const waterEnd = shelfSrc.indexOf("{/* t733 —", cardStart);
const water = waterStart >= 0 && waterEnd > waterStart ? shelfSrc.slice(waterStart, waterEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, on the snapshot card                                  */
/* ================================================================== */
console.log("\nA — the card asks the lib's named question");

must(shelfSrc.includes('import { jobType, pourKindsOf, PORT_COLORS } from "@/lib/workflow";'),
  "A the workflow import stays ONE line (jobType + pourKindsOf + PORT_COLORS merged)");

must(ask.includes("const pouring = t ? pourKindsOf(p.type) : [];"),
  "A the card asks pourKindsOf inside its own map (asked once per card render)");

must((card.match(/const pouring/g) || []).length === 1,
  "A the question is asked exactly ONCE (dots + ear read the answer)");

must((card.match(/\{t \? \(/g) || []).length === 1 && card.includes(") : null}"),
  "A the render gate is in place (unknown type renders nothing — silence is a posture)");

must(card.includes("PORT_COLORS[k].wire"),
  "A dots ride PORT_COLORS[k].wire (the t735 sample, now on the snapshot card)");

must(libHomeHasPour(), "A pourKindsOf still lives in the lib home (the t746 question, not shelf logic)");
function libHomeHasPour() {
  const start = wf.indexOf("t746 — the dictionary page's water row");
  const end = wf.indexOf("/** Port shorthands. */", start);
  return start >= 0 && end > start && /export function pourKindsOf\(typeKey: string\): PortKind\[\]/.test(wf.slice(start, end));
}

/* ================================================================== */
/* B — live-fire over the type space                                   */
/* ================================================================== */
console.log("\nB — the type space's pour account, re-counted at the preset shelf");

let ghost = 0;
const dist = {};
for (const t of JOB_TYPES) {
  const pk = pourKindsOf(t.key);
  for (const k of pk) if (!PORT_COLORS[k]) ghost++;
  dist[pk.length] = (dist[pk.length] ?? 0) + 1;
}

must(JOB_TYPES.length === 40, "B the type space is 40 strong", `got ${JOB_TYPES.length}`);
must(ghost === 0, "B zero ghost kinds (every dot the shelf can show has a color)");

const account = Object.entries(dist).map(([n, c]) => [Number(n), c]).sort((a, b) => a[0] - b[0]);
must(JSON.stringify(account) === JSON.stringify([[1, 35], [2, 3], [3, 2]]),
  "B the SORTED pour account holds the t747 ledger ([[1,35],[2,3],[3,2]], no zero-pour cards) — third interlock (rows/chips/shelf)",
  `got ${JSON.stringify(account)}`);

const allNamed = JOB_TYPES.every((t) => jobType(t.key) !== undefined);
must(allNamed, "B every shelf-able type resolves a spec (the ask gate never silences a known type)");

/* ================================================================== */
/* C — the face                                                        */
/* ================================================================== */
console.log("\nC — the snapshot card's face");

must(card.includes("data-testid={`shelf-pours-${p.type}`}"),
  "C the container testid is shelf-pours-{type} (aligned with the shelf-info-{type} family)");

must(card.includes('data-testid={`shelf-info-${p.type}`}'),
  "C the t733 dictionary door keeps its seat beside the new dots (same family grammar)");

must((card.match(/data-testid=\{`shelf-pours-/g) || []).length === 1,
  "C exactly one pours container per card (the card has one promise)");

must((water.match(/title=\{`pours \$\{k\}`\}/g) || []).length === 1,
  "C the word per dot rides the title (verbatim t750 form: pours ${k})");

must((water.match(/aria-hidden="true"/g) || []).length === 1,
  "C the dots are aria-hidden (decor stays out of the ear)");

must(water.includes('className="inline-block size-1.5 rounded-full"'),
  "C the dots are the scanning whisper (size-1.5, verbatim t750 shape)");

must(water.includes('sr-only">pours {pouring.join(", ")}'),
  "C the sr-only ear line names the kinds (verbatim t750 grammar)");

must(/title=\{p\.type\}>\s*\{t\?\.label \?\? p\.type\}\s*<\/span>[\s\S]*?shelf-pours-[\s\S]*?\) : null\}[\s\S]*?\{\/\* t733 —/.test(card),
  "C the dots' seat is between the type label and the t733 door (label → water → dictionary)");

must(dialectEqualsT750(),
  "C the dot dialect is STRUCTURALLY t750's (same mapped-span syntax, same ear grammar — var and testid names normalized)");

function dialectEqualsT750() {
  const grab = (src, testidMark) => {
    const i = src.indexOf(testidMark);
    if (i < 0) return "";
    const start = src.lastIndexOf("<span", i);
    const endMark = 'sr-only">pours {pouring.join(", ")}</span>';
    const j = src.indexOf(endMark, i);
    if (start < 0 || j < 0) return "";
    return src.slice(start, j + endMark.length).replace(/\s+/g, " ");
  };
  const a = grab(pal, "data-testid={`palette-fav-pours-${t.key}`}")
    .replaceAll("t.key", "P.TYPE").replaceAll("palette-fav-pours", "SHELF-POURS");
  const b = grab(shelfSrc, "data-testid={`shelf-pours-${p.type}`}")
    .replaceAll("p.type", "P.TYPE").replaceAll("shelf-pours", "SHELF-POURS");
  return a.length > 0 && a === b;
}

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — the shelf stays clean");

const hexLines = shelfSrc.split("\n").filter((l) => /#[0-9a-fA-F]{3,8}\b/.test(l));
must(hexLines.length === 0,
  "D zero hex literals in the shelf file (it had none before; the dots' ink rides PORT_COLORS)",
  `${hexLines.length} hex line(s)`);

must(shelfSrc.includes("the empty shelf is a DOOR, not a facade (t717 amended law)") &&
     shelfSrc.includes("{/* t733 — the shelf's dictionary door"),
  "D the t717 empty-door and t733 door notes keep their seats (old residents)");

must(water.startsWith("{/* t751 —") && water.includes("identity line borrows the water") && water.includes("SILENT"),
  "D the t751 judgment note leads the block and names the law (borrowed dots + the silent posture)");

must(!/localStorage|sessionStorage|writeUserParamPresets|deleteUserParamPreset/.test(water),
  "D no storage writes in the t751 water block (the shelf's collector keeps its own home)");

/* ================================================================== */
console.log(`\n${PASS} passed, ${FAIL} failed`);
process.exit(FAIL === 0 ? 0 : 1);
