// t760 — the REFERENCE MAP CARD's provenance sentence borrows the water
// dots: the kind vocabulary's TWENTY-FIRST reader. The provenance line
// ("produced by the {label} job {name}.") names the type in words — the
// sentence's subject IS the provider's type — and now the dots sit right
// after the label, inline in the prose flow. Dialect is the t750 GATED
// form riding the spec the sentence ALREADY holds (the t755 fourth form:
// jobType(provider.type) was the ask the label answer made; pouring only
// re-reads it). ONE deliberate dialect drift: the family container goes
// inline-flex here — the seat is inside a <p> prose paragraph, and
// display:flex would break the sentence into anonymous blocks; the seat
// itself is the drift's witness. testid refmap-pours-{provider.type} —
// the family's tenth address. one-reader discipline: the crop branch
// ("crop of ... sent from the 3D viewer") and the file-browser branch
// ("picked from the file browser.") stay undressed — neither names a
// type, neither gets water.
//
//   A  one book: the import merges; the gated ask appears exactly once
//      in the FILE; the provenance slice holds exactly one jobType call
//      (the riding ask); the render gate closes; dots ride PORT_COLORS;
//      the lib home keeps its question.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      NINTH-interlocked, every known type speaks, the unknown silent,
//      the slice anchored at branch boundaries.
//   C  the face: refmap-pours-{provider.type} (the tenth address),
//      exactly one container, per-dot anatomy verbatim, sr-only ear
//      line, the prose seat label -> water -> job word -> name, the
//      dialect's ONE-LINE inline-flex variant explicitly asserted, the
//      prose <p> host inline.
//   D  purity: zero hex, both t760 judgment notes lead their blocks, no
//      storage writes, the old residents keep their seats (provider
//      chip, View in 3D door, canvas identity, TypeIcon), the chip and
//      mapPath title contracts verbatim, the crop and file-browser
//      branches verified undressed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "..", "src", "components", "workflow", "reference-map-card.tsx"), "utf8");
const pal = readFileSync(path.join(here, "..", "src", "components", "workflow", "palette.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");

// slice discipline: the provenance provider branch runs from its held
// spec to the sentence's closing period; the water block is the render
// gate inside it; the crop and file-browser branches are the one-reader
// undressed witnesses.
const pvStart = src.indexOf("const spec = jobType(provider.type);");
const pvEndAnchor = "{provider.name}</span>.";
const pvEnd = src.indexOf(pvEndAnchor, pvStart) + pvEndAnchor.length;
const prov = pvStart >= 0 && pvEnd > pvStart ? src.slice(pvStart, pvEnd) : "";
// judgment notes are prose ABOUT the code — strip line comments before
// word-form counts (the t758 precedent: comments are legal residents,
// the count bites code lines only).
const provCode = prov.replace(/^\s*\/\/.*$/gm, "");

const wStart = prov.indexOf("{spec ? (");
const wEnd = wStart >= 0 ? prov.indexOf(") : null}", wStart) + ") : null}".length : -1;
const water = wStart >= 0 && wEnd > wStart ? prov.slice(wStart, wEnd) : "";

const cropStart = src.indexOf("crop of <span");
const cropEnd = src.indexOf("sent from the 3D viewer.", cropStart);
const cropBranch = cropStart >= 0 && cropEnd > cropStart ? src.slice(cropStart, cropEnd) : "";

const fbStart = src.indexOf("picked from the file browser.");
const fbBranch = fbStart >= 0 ? src.slice(fbStart, fbStart + 60) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, riding the spec the sentence already holds            */
/* ================================================================== */
console.log("\nA — the provenance sentence asks through its own held spec, gated");

must((src.match(/import \{ jobType, pourKindsOf, PORT_COLORS \} from "@\/lib\/workflow";/g) || []).length === 1,
  "A the workflow import merges into the existing single line (three names, one home)");

must((src.match(/pourKindsOf\(/g) || []).length === 1,
  "A the GATED ask appears exactly once in the file (one-reader: crop and file-browser branches stay undressed, their absence is this count)");

must((provCode.match(/jobType\(/g) || []).length === 1,
  "A the water ask reuses the sentence's held spec — exactly one jobType call in the provenance slice, comments stripped (no re-asking)");

must(prov.includes("const pouring = spec ? pourKindsOf(provider.type) : [];"),
  "A the ask rides the held spec verbatim (the undefined law's fourth form — RECEIVED, not re-asked)");

must(wStart >= 0 && prov.indexOf(") : null}", wStart) > wStart && water.includes("pouring.map"),
  "A the render gate closes (unknown type renders nothing — silence is the posture)");

must(water.includes("PORT_COLORS[k].wire"),
  "A dots ride PORT_COLORS[k].wire (the t735 sample, now in the prose sentence)");

must(libHomeHasPour(), "A pourKindsOf still lives in the lib home (the t746 question, not card logic)");
function libHomeHasPour() {
  const start = wf.indexOf("t746 — the dictionary page's water row");
  const end = wf.indexOf("/** Port shorthands. */", start);
  return start >= 0 && end > start && /export function pourKindsOf\(typeKey: string\): PortKind\[\]/.test(wf.slice(start, end));
}

/* ================================================================== */
/* B — live-fire over the type space                                   */
/* ================================================================== */
console.log("\nB — the pour account, re-counted at the reference map card");

let ghost = 0;
const dist = {};
for (const t of JOB_TYPES) {
  const pk = pourKindsOf(t.key);
  for (const k of pk) if (!PORT_COLORS[k]) ghost++;
  dist[pk.length] = (dist[pk.length] ?? 0) + 1;
}

must(JOB_TYPES.length === 40, "B the type space is 40 strong", `got ${JOB_TYPES.length}`);
must(ghost === 0, "B zero ghost kinds (every dot the sentence can show has a color)");

const account = Object.entries(dist).map(([n, c]) => [Number(n), c]).sort((a, b) => a[0] - b[0]);
const expected = [[1, 35], [2, 3], [3, 2]];
const accountSame = JSON.stringify(account) === JSON.stringify(expected);
must(accountSame,
  "B the t747 account NINTH-interlocked (rows/chips/shelf/cmd catalog/cmd presets/runtime analytics/queue sim/peek/refmap — sorted before compared)",
  JSON.stringify(account));

const allSpeaks = JOB_TYPES.every((t) => pourKindsOf(t.key).length > 0 && jobType(t.key) != null);
must(allSpeaks,
  "B every known type speaks (the gate never silences a resolved type — silence is for the unknown only)");

must(pourKindsOf("no-such-type").length === 0 && jobType("no-such-type") == null,
  "B the unknown type keeps its honest silence (no spec, no water)");

must(prov.includes("produced by the") && prov.endsWith("{provider.name}</span>."),
  "B the provenance slice anchored at branch boundaries (held spec -> sentence period)");

/* ================================================================== */
/* C — the face: testid address, container, dots, ear, prose seat      */
/* ================================================================== */
console.log("\nC — the provenance sentence's water face");

must(water.includes("data-testid={`refmap-pours-${provider.type}`}"),
  "C the testid is refmap-pours-{provider.type} — the family's TENTH address (type-tailed like runtime/queue/peek/shelf)");

must((prov.match(/\{spec \? \(/g) || []).length === 1,
  "C exactly one water container in the provenance branch (one sentence, one seat)");

must(water.includes('aria-hidden="true"') && water.includes("title={`pours ${k}`}") &&
     water.includes("size-1.5 rounded-full"),
  "C per-dot anatomy verbatim (whisper decoration, per-dot word, the family's dot size)");

must(water.includes('<span className="sr-only">pours {pouring.join(", ")}</span>'),
  "C the sr-only ear line verbatim (enters the a11y tree, never the prose words)");

const seatRe = /text-foreground\/80">\{spec\?\.label \?\? provider\.type\}<\/span>\s*\{spec \? \([\s\S]*?refmap-pours-\$\{provider\.type\}[\s\S]*?\) : null\}\{" "\}\s*job\{" "\}/;
must(seatRe.test(prov),
  "C the prose seat is label -> water -> job word -> name (dots inline right after the naming span, never past the sentence)");

const dialectCheck = (() => {
  const grabSpan = (s, anchor) => {
    const a = s.indexOf(anchor);
    if (a < 0) return "";
    const start = s.lastIndexOf("<span", a);
    const end = s.indexOf("</span>", s.indexOf("sr-only\">pours", a)) + "</span>".length;
    return start >= 0 && end > start ? s.slice(start, end) : "";
  };
  const norm = (block) =>
    block.split("\n").map((l) => l.trim()).filter(Boolean)
      .map((l) => l.replace(/data-testid=\{`[a-z-]+pours-\$\{[a-zA-Z.]+\}`\}/, "data-testid={ID}"))
      .join("\n");
  const canon = norm(grabSpan(pal, "palette-fav-pours"));
  const mine = norm(grabSpan(src, "refmap-pours"));
  const canonLines = canon.split("\n");
  const mineLines = mine.split("\n");
  if (canonLines.length !== mineLines.length) return { ok: false, why: "line count differs" };
  const diffs = [];
  for (let i = 0; i < canonLines.length; i++) {
    if (canonLines[i] !== mineLines[i]) diffs.push({ i, canon: canonLines[i], mine: mineLines[i] });
  }
  const oneLine = diffs.length === 1;
  const isFlexDrift = oneLine &&
    diffs[0].canon.includes('"flex shrink-0 items-center gap-1"') &&
    diffs[0].mine.includes('"inline-flex shrink-0 items-center gap-1"');
  return { ok: oneLine && isFlexDrift, why: oneLine ? (isFlexDrift ? "flex->inline-flex" : "not a flex drift") : `${diffs.length} lines` };
})();
must(dialectCheck.ok,
  "C the dialect is the t750 canonical block with EXACTLY ONE line of drift: flex -> inline-flex (the prose seat's own witness — the family's ninth staging)",
  dialectCheck.why);

const pHost = src.indexOf('<p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">');
const pProv = src.indexOf("{provenance}", pHost);
must(pHost >= 0 && pProv > pHost && pProv - pHost < 900,
  "C the water lives inside the prose <p> host (leading-relaxed paragraph — inline-flex is the law of this seat, display:flex would break the sentence)");

/* ================================================================== */
/* D — purity: hex, notes, storage, residents, contracts, one-reader   */
/* ================================================================== */
console.log("\nD — purity checks");

const hexLines = src.split("\n").filter((l) => /#[0-9a-fA-F]{6}\b/.test(l));
must(hexLines.length === 0,
  "D zero hex literals in the file (no legal residents; the dots' ink rides PORT_COLORS)",
  `${hexLines.length} hex line(s)`);

must(src.includes("rides the spec the sentence already holds") &&
     water.includes("names the type in words") &&
     water.includes("the inline-flex variant of") &&
     water.includes("is its witness"),
  "D both t760 judgment notes lead their blocks and name their laws (the riding ask + the prose seat's drift)");

must(!/localStorage|sessionStorage|writeUserParamPresets/.test(water),
  "D no storage writes in the t760 water block");

must(src.includes('data-testid="reference-provider-chip"') && src.includes('data-testid="reference-view-3d"') &&
     src.includes('data-canvas-ui="reference-map"') && src.includes("<TypeIcon"),
  "D the old residents keep their seats (provider chip, View in 3D door, canvas identity, TypeIcon)");

must(src.includes('title={`Open the provider job "${provider.name}"`}') && src.includes("title={mapPath}"),
  "D the chip and mapPath title contracts stay verbatim (the dots never enter the reveal words)");

must(!/pourKindsOf|pours-/.test(cropBranch) && !/pourKindsOf|pours-/.test(fbBranch),
  "D one-reader discipline: the crop and file-browser branches are verified undressed (neither names a type)");

/* ================================================================== */
console.log(`\n==== t760 refmap pours unit: ${PASS} pass / ${FAIL} fail ====`);
process.exit(FAIL === 0 ? 0 : 1);
