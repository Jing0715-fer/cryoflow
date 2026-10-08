// t742 — the live wire wears its ink before it exists.
// t734 gave committed wires a resting ink; t735-t739 taught the word at the
// chips, the cards, the legend and the I/O face; this window teaches the
// word at the wire's BIRTHPLACE: while a connection is pending, the
// preview line already paints the kind's resting wire hex — wiring is the
// moment the user declares what flows, and the color answers immediately,
// not after the commit. A port without a word stays bare primary (the
// wire-ink law's bare face — honest colorlessness, t738's wordless chip
// met again at the wire's birthplace).
//
//   A  one book, one more reader at the birthplace: the live wire derives
//      through outputKindOf(job.type, pendingFrom.port) + PORT_COLORS —
//      zero second directory; the ink variable feeds line AND both anchor
//      dots; the bare fallback is an explicit `?? "var(--primary)"`.
//   B  live-fire over the real world: every next-step port pair of all
//      types resolves (zero ghost kinds — the live wire can never meet a
//      port it cannot name), and the LIVE world's jobs re-derive the same
//      guarantee through the API doors.
//   C  the face: stroke AND fills ride the ink variable, the flow animation
//      survives (a growing wire may flow — it is the legend that must not
//      dance), the svg stays aria-hidden (a preview whispers, the screen
//      reader has the real ports), and the t742 verdict comment stands
//      over the derivation.
//   D  purity: zero hue-class literals in the live-wire block (hex inline
//      styles only), zero storage writes, the census's workflow.ts home
//      still covers the vocabulary.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { PORT_COLORS, JOB_TYPES, outputKindOf } = await __jiti.import("../src/lib/workflow");
const { nextStepsFor } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const canvas = readFileSync(path.join(here, "..", "src", "components", "workflow", "canvas.tsx"), "utf8");
const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");

// the live-wire block, sliced from the LiveWire memo's head to its close
const lwStart = canvas.indexOf("const LiveWire = React.memo");
const lwEnd = canvas.indexOf("/* ------------------------------------------------------------------ */", lwStart);
const liveWire = lwStart >= 0 && lwEnd > lwStart ? canvas.slice(lwStart, lwEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, at the wire's birthplace                              */
/* ================================================================== */
console.log("\nA — the preview drinks the same book the committed wires drink");

must(lwStart >= 0 && lwEnd > lwStart,
  "A the LiveWire block exists in the canvas");

must(/outputKindOf\(job\.type, pendingFrom\.port\)/.test(liveWire),
  "A the ink derives through outputKindOf — the same lookup, zero second directory");

must(/PORT_COLORS\[liveKind\]\.wire/.test(liveWire),
  "A the ink is the kind's resting WIRE hex (the committed line's own ink)");

must(/const ink = liveKind \? PORT_COLORS\[liveKind\]\.wire : undefined;/.test(liveWire),
  "A the ink variable is a single derivation feeding the whole preview");

must((liveWire.match(/\?\? "var\(--primary\)"/g) ?? []).length === 3,
  "A the bare fallback rides all three strokes (line + both anchor dots)");

/* ================================================================== */
/* B — live-fire: every port the drag can start from has a name        */
/* ================================================================== */
console.log("\nB — zero ghost kinds across the whole type space and the live world");

let pairs = 0, ghost = 0;
for (const t of JOB_TYPES) {
  for (const d of nextStepsFor(t.key)) {
    pairs++;
    if (!outputKindOf(t.key, d.fromPort)) ghost++;
  }
}
must(pairs > 0 && ghost === 0,
  `B all next-step port pairs resolve (${pairs} pairs, zero ghost kinds)`);

let worldOk = false, worldDetail = "api unreachable";
try {
  const jobsRes = await fetch("http://localhost:3000/api/jobs", { signal: AbortSignal.timeout(8000) });
  if (jobsRes.ok) {
    const payload = await jobsRes.json();
    const jobs = Array.isArray(payload) ? payload : payload.jobs ?? [];
    // semantic split: outputKindOf names the FROM side ("what flows out of
    // this port"). A drag starting at an OUTPUT port already knows its
    // kind — every output must resolve (zero ghost). A drag starting at an
    // INPUT port is waiting for the other end — the from side is UNKNOWN
    // while dragging, so an unnamed input is not a ghost, it is the bare
    // face doing its honest work (the fallback paints primary).
    const { jobType } = await __jiti.import("../src/lib/workflow");
    let outNamed = 0, outUnnamed = 0, inPorts = 0;
    for (const j of jobs) {
      const spec = jobType(j.type);
      if (!spec) continue;
      for (const p of spec.outputs ?? []) { outNamed++; if (!outputKindOf(j.type, p.name)) outUnnamed++; }
      inPorts += (spec.inputs ?? []).length;
    }
    worldOk = outNamed > 0 && outUnnamed === 0 && inPorts > 0;
    worldDetail = `${outNamed} output ports all named (zero ghost out-starts) · ${inPorts} input ports honestly awaiting their word`;
  }
} catch (e) {
  worldDetail = `live world unreachable (${e.message}) — skipping live assert`;
}
must(worldOk,
  "B the live world: every out-start resolves, in-starts honestly bare",
  worldDetail);

/* ================================================================== */
/* C — the face: the preview speaks, quietly                           */
/* ================================================================== */
console.log("\nC — the ink feeds the line and the dots; the preview stays a whisper");

must(/stroke=\{ink \?\? "var\(--primary\)"\}/.test(liveWire),
  "C the path rides the ink variable");

must(/fill=\{ink \?\? "var\(--primary\)"\} opacity=\{0\.9\}/.test(liveWire)
  && /fill=\{ink \?\? "var\(--primary\)"\} opacity=\{0\.55\}/.test(liveWire),
  "C both anchor dots ride the ink variable (birth dot at 0.9, cursor dot at 0.55)");

must(/className="edge-flow"/.test(liveWire),
  "C the flow animation survives — a growing wire may flow, the legend is the one that must not dance");

must(/aria-hidden="true"/.test(liveWire),
  "C the preview svg stays aria-hidden — a whisper, the screen reader has the real ports");

must(/the live wire wears its ink BEFORE it exists/.test(liveWire),
  "C the t742 verdict stands over the derivation");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — purity: no hue classes, no storage in the live wire");

must(liveWire !== "" && !/bg-(cyan|teal|amber|violet|rose|orange|pink|emerald|fuchsia|slate)-\d+/.test(liveWire),
  "D zero tailwind hue-class literals in the live-wire block (hex inline styles only)");

must(!/localStorage|sessionStorage/.test(liveWire),
  "D zero storage writes (a preview lives for one drag, not for a session)");

must(/COLORS palette definition|PORT_COLORS/.test(census),
  "D the census's workflow.ts home still covers the vocabulary the live wire reads");

/* ================================================================== */
console.log(`\n==== t742 live-wire-ink unit: ${PASS} pass / ${FAIL} fail ====`);
process.exit(FAIL === 0 ? 0 : 1);
