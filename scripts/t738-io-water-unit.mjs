// t738 — the I/O face borrows the water color. The inspector's I/O tab
// has ALWAYS shown kind colors (the port row's dot — the SOCKET's color:
// what the port can accept). But the connection CHIP — the edge itself —
// spoke no color. This window gives the chip the WATER's color: the kind
// the wire actually carries, from the same book (outputKindOf on the
// source job's type + fromPort), same hex the wire rests in.
//
//   A  one book, the sixth reader: the chip's ink derives through
//      outputKindOf + PORT_COLORS (zero second directory); the socket
//      dot (portDotClass) keeps its own semantics — socket color vs
//      water color is a分工, not a merge.
//   B  live-fire over the REAL world: every edge in the live API world
//      resolves its kind (zero ghost words); legacy port-less edges
//      land undefined (colorless is their honest state).
//   C  the face: the chip's title speaks "{label} — {kind} data"; the
//      dot is a size-1.5 aria-hidden sample; conditional rendering —
//      no word, no sample, and the title falls back to the bare label.
//   D  purity: zero tailwind hue-classes in the chip, zero motion, zero
//      storage writes; the census's workflow.ts home still stands.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { PORT_COLORS, outputKindOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

const panel = readSrc("components/workflow/job-panel.tsx");
const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");

// the EdgeChip block, sliced from source (from its declaration to the
// portDotClass section header that follows it)
const chipStart = panel.indexOf("function EdgeChip({");
const chipEnd = panel.indexOf("/* I/O tab", chipStart);
const chipBlock = chipStart >= 0 && chipEnd > chipStart ? panel.slice(chipStart, chipEnd) : "";

/* ================================================================== */
/* A — one book, the sixth reader                                      */
/* ================================================================== */
console.log("\nA — the chip drinks the same book the wires drink");

must(/outputKindOf/.test(panel),
  "A job-panel imports outputKindOf — the book's own lookup");

must(/fromType && e\.fromPort \? outputKindOf\(fromType, e\.fromPort\) : undefined/.test(panel),
  "A the water ledger derives through outputKindOf — zero second directory");

must(/backgroundColor: PORT_COLORS\[kind\]\.wire/.test(chipBlock) ||
     /backgroundColor: ink/.test(chipBlock),
  "A the dot paints PORT_COLORS' wire hex (inline style, the lib dialect)");

must(/port\.kind \?\? \(port\.accepts\?\.find/.test(panel) && /PORT_COLORS\[kind \?\? "star"\]/.test(panel),
  "A the socket dot keeps its accepts-based semantics — socket color is not merged away");

/* ================================================================== */
/* B — live-fire over the REAL world                                   */
/* ================================================================== */
console.log("\nB — every live wire resolves; legacy edges stay wordless");

let liveOk = false, liveDetail = "api unreachable";
try {
  const jobsRes = await fetch("http://localhost:3000/api/jobs", { headers: { Origin: "http://localhost:3000" }, signal: AbortSignal.timeout(8000) });
  const edgesRes = await fetch("http://localhost:3000/api/edges", { headers: { Origin: "http://localhost:3000" }, signal: AbortSignal.timeout(8000) });
  if (jobsRes.ok && edgesRes.ok) {
    const jobsPayload = await jobsRes.json();
    const worldJobs = Array.isArray(jobsPayload) ? jobsPayload : jobsPayload.jobs ?? [];
    const edgesPayload = await edgesRes.json();
    const worldEdges = Array.isArray(edgesPayload) ? edgesPayload : edgesPayload.edges ?? [];
    const byId = new Map(worldJobs.map((j) => [j.id, j]));
    let kinded = 0, wordless = 0, ghost = 0;
    const tableKeys = new Set(Object.keys(PORT_COLORS));
    for (const e of worldEdges) {
      const from = byId.get(e.fromJobId);
      const k = from && e.fromPort ? outputKindOf(from.type, e.fromPort) : undefined;
      if (k == null) wordless++;
      else { kinded++; if (!tableKeys.has(k)) ghost++; }
    }
    liveOk = ghost === 0 && kinded + wordless === worldEdges.length && kinded > 0;
    liveDetail = `${kinded} kinded + ${wordless} wordless = ${worldEdges.length} edges, zero ghost words`;
  }
} catch (e) {
  liveDetail = `live world unreachable (${e.message}) — skipping live assert`;
}
must(liveOk, "B the live world's wires all resolve; legacy edges stay wordless", liveDetail);

/* ================================================================== */
/* C — the face: the chip speaks, the dot paints                       */
/* ================================================================== */
console.log("\nC — title word, sample dot, conditional honesty");

must(/\$\{label\} — \$\{kind\} data/.test(chipBlock),
  "C the chip's title speaks \"{label} — {kind} data\"");

must(/: label\}/.test(chipBlock),
  "C a wordless chip's title falls back to the bare label");

must(/size-1\.5 shrink-0 rounded-full/.test(chipBlock),
  "C the sample is a size-1.5 dot — t735's dialect, smaller than the port's size-2 socket");

must(/aria-hidden="true"/.test(chipBlock),
  "C the dot is aria-hidden decoration (the title speaks, the dot paints)");

must(/ink \? \(/.test(chipBlock) && /: null\}/.test(chipBlock),
  "C conditional rendering: no word → no sample (never an empty dot)");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — purity: no hue classes, no motion, no storage in the chip");

must(chipBlock !== "" && !/bg-(cyan|teal|amber|violet|rose|orange|pink|emerald|fuchsia|slate)-\d+/.test(chipBlock),
  "D zero tailwind hue-class literals in the chip (hex inline styles only)");

must(!/animate/.test(chipBlock),
  "D zero motion in the chip (a sample does not dance)");

must(!/localStorage|sessionStorage/.test(chipBlock),
  "D zero storage writes (a view adornment, not an asset)");

must(/COLORS palette definition|PORT_COLORS/.test(census),
  "D the census's workflow.ts home still covers the vocabulary the chip reads");

/* ================================================================== */
console.log(`\n==== t738 io-water unit: ${PASS} pass / ${FAIL} fail ====`);
process.exit(FAIL === 0 ? 0 : 1);
