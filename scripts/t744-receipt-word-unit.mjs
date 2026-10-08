// t744 — the receipt speaks the word (the vocabulary's tenth reader).
// t742 dressed the preview in ink before the wire existed, t734 dressed the
// committed line, t743 dressed the bird's-eye — and the success toast, the
// moment the world ACCEPTS a hand-drawn wire, still only said "A → B".
// This window lets the receipt name the water: "{from} → {to} — ● {kind}
// data", the dot riding the kind's resting wire hex, the word riding the
// t735/t738 dialect. The user just asked for this wire by hand — the
// cleanest teaching slot the vocabulary ever gets.
//
//   A  one book: the receipt derives through outputKindOf + PORT_COLORS
//      (the same well), the quiet gate (t442) still guards it, the bare
//      fallback survives for wordless wires (the undefined law's fifth
//      face).
//   B  live-fire: no ghost kinds in the whole type space or the live
//      world's edges — every receipt the world could speak has a word —
//      and the quiet lane (duplication) still passes quiet: true.
//   C  the face: createElement dialect (a .ts file), the word row wraps
//      gracefully, the dot is aria-hidden decoration, the title stays
//      "Connected".
//   D  purity: no hue-class literals, no storage, census home intact (OR
//      word-shape — the t743 lesson applied before the first run).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { PORT_COLORS, JOB_TYPES, outputKindOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const store = readFileSync(path.join(here, "..", "src", "lib", "store.ts"), "utf8");
const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");

// the receipt block: the quiet gate through the toast's close
const rStart = store.indexOf("if (!opts?.quiet) {");
const rEnd = store.indexOf("    try {", rStart);
const receipt = rStart >= 0 && rEnd > rStart ? store.slice(rStart, rEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, at the moment of acceptance                           */
/* ================================================================== */
console.log("\nA — the receipt drinks the same well");

must(rStart >= 0 && rEnd > rStart,
  "A the receipt block exists inside connect");

must(/import \{ CARD_W, CARD_H, WORLD_MIN, WORLD_MAX, ZOOM_MAX, ZOOM_MIN, jobType, portsCompatible, nextStepsFor, PORT_COLORS, outputKindOf \} from "\.\/workflow"/.test(store),
  "A store imports PORT_COLORS + outputKindOf from the one workflow lib");

must(/const wireKind = fromJob && fromPort \? outputKindOf\(fromJob\.type, fromPort\) : undefined;/.test(receipt),
  "A the word derives through outputKindOf at the from port (the edge layer's own question)");

must(/PORT_COLORS\[wireKind\]\.wire/.test(receipt),
  "A the dot rides the kind's resting WIRE hex (the canvas's own ink)");

must(/`\$\{wireKind\} data`/.test(receipt),
  "A the word rides the t735/t738 dialect ({kind} data)");

must(/: `\$\{fromName\} → \$\{toName\}`/.test(receipt),
  "A a wordless wire keeps the bare receipt (the undefined law's fifth face)");

must(/if \(!opts\?\.quiet\) \{/.test(receipt),
  "A the t442 quiet gate still guards the receipt (duplication's aggregate law survives)");

must(/title: "Connected",/.test(receipt),
  "A the title stays Connected (the word joins the description, not the headline)");

/* ================================================================== */
/* B — live-fire: every receipt the world could speak has a word       */
/* ================================================================== */
console.log("\nB — zero ghost kinds in the type space and the live world");

let pairs = 0, ghost = 0;
for (const t of JOB_TYPES) {
  for (const p of t.outputs ?? []) {
    pairs++;
    if (!outputKindOf(t.key, p.name)) ghost++;
  }
}
must(pairs > 0 && ghost === 0,
  `B every output port of every type resolves (${pairs} ports, zero ghost — a receipt can never meet a nameless wire)`);

let worldOk = false, worldDetail = "api unreachable";
try {
  const edgesRes = await fetch("http://localhost:3000/api/edges", { signal: AbortSignal.timeout(8000) });
  if (edgesRes.ok) {
    const payload = await edgesRes.json();
    // t737 lesson — ask the door's shape before counting the room
    const edges = Array.isArray(payload) ? payload : payload.edges ?? [];
    const jobsRes = await fetch("http://localhost:3000/api/jobs", { signal: AbortSignal.timeout(8000) });
    const jobsPayload = jobsRes.ok ? await jobsRes.json() : {};
    const jobs = Array.isArray(jobsPayload) ? jobsPayload : jobsPayload.jobs ?? [];
    const byId = new Map(jobs.map((j) => [j.id, j]));
    let withPort = 0, worded = 0, ghostWorld = 0;
    for (const e of edges) {
      const from = byId.get(e.fromJobId);
      if (!from || !e.fromPort) continue;
      withPort++;
      const k = outputKindOf(from.type, e.fromPort);
      if (k) worded++;
      else ghostWorld++;
    }
    worldOk = withPort > 0 && ghostWorld === 0;
    worldDetail = `${withPort} ported edges in the live world · ${worded} would speak their word · ${ghostWorld} ghost`;
  }
} catch (e) {
  worldDetail = `live world unreachable (${e.message}) — skipping live assert`;
}
must(worldOk,
  "B the live world: every ported edge has a word for its receipt",
  worldDetail);

must(/quiet: true/.test(store) && /the receipt belongs to the DUPLICATION toast/.test(store),
  "B the quiet lane survives (duplication still batches its receipt)");

/* ================================================================== */
/* C — the face: a .ts file speaks createElement                       */
/* ================================================================== */
console.log("\nC — the word row builds in the file's own dialect");

must(/\.ts file — no JSX/.test(receipt) && /React\.createElement\(\s*"span",\s*\{ className: "flex flex-wrap items-center gap-x-1\.5 gap-y-0\.5" \}/.test(receipt),
  "C the word row is createElement (the announce* dialect), not JSX");

must(/"aria-hidden": true,/.test(receipt) && /inline-block size-2 shrink-0 rounded-full/.test(receipt),
  "C the dot is aria-hidden decoration at the standard receipt size");

must(/key: "names"/.test(receipt) && /key: "dash"/.test(receipt) && /key: "dot"/.test(receipt) && /key: "word"/.test(receipt),
  "C four children, four keys — the row's anatomy is explicit");

must(/the receipt speaks the word \(the vocabulary's tenth reader\)/.test(receipt),
  "C the t744 verdict stands over the derivation");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — purity: no hue classes, no storage, census home intact");

must(receipt !== "" && !/bg-(cyan|teal|amber|violet|rose|orange|pink|emerald|fuchsia|slate)-\d+/.test(receipt),
  "D zero tailwind hue-class literals in the receipt (hex rides PORT_COLORS only)");

must(!/localStorage|sessionStorage/.test(receipt),
  "D zero storage writes (the receipt is spoken, never remembered)");

must(/COLORS palette definition|PORT_COLORS/.test(census),
  "D the census's workflow.ts home still covers the vocabulary the receipt reads (OR word-shape — t743's lesson, applied before the first run)");

/* ================================================================== */
console.log(`\n==== t744 receipt-word unit: ${PASS} pass / ${FAIL} fail ====`);
process.exit(FAIL === 0 ? 0 : 1);
