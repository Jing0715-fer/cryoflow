#!/usr/bin/env node
/**
 * t1052-kpi-teach-unit — the KPI band's teach-through (the t1050 dialect
 * spreads to the pipeline's own headline).
 *
 * The face: the KPI band's numbers were honest but silent — the
 * completion pair said "click" without saying why the wash is rose, the
 * particle count said "fed" without saying who fed it, and the verdict
 * chip said "above 4.2 Å target" without naming the DISTANCE (the
 * cryo-EM worker's own question — "how far to the paper's mark?").
 * Three needles:
 *
 *   A — completion's fleet voice: when failures exist the title names
 *       them AND names the wash ("N failed (the rose wash)"); the
 *       counts speak in BOTH branches (t1086 — the title IS the
 *       button's accessible name; the healthy one-liner left the
 *       face's 5/15 unheard by AT), and the family's word is
 *       "completed" (the ring's title and the dashboard's line both
 *       say it — "jobs done" was the item mouth's lone fork).
 *   B — particles' provenance voice: the count is the fleet's SUM —
 *       "extracted across the fleet — the summed count every extraction
 *       seat reports" — not an anonymous "fed into".
 *   C — the verdict's distance voice: both sides of the bar speak the
 *       gap — "N.NN Å inside the bar" when met, "N.NN Å above the bar —
 *       push the refinement and the medal turns gold" when not — the
 *       gap computed live from the same resValue the chip prints (one
 *       mouth, no drift).
 *
 * Band law: static source pins (the t1047 discipline) — the words ARE
 * the contract.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const kpi = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");

let pass = 0;
let fail = 0;
const pin = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* ---- A band: completion's fleet voice ---- */
const compWin = kpi.indexOf('key="completion"');
const compSlice = compWin > 0 ? kpi.slice(compWin, compWin + 600) : "";
pin("A0 the completion seat is located", compWin > 0);
pin("A1 the title is conditional on failures",
  /title=\{\s*\n\s*stats\.failed > 0\s*\n\s*\? `Pipeline completion/.test(compSlice));
pin("A2 the failure voice names the count AND the wash",
  compSlice.includes("${stats.failed} failed (the rose wash)"));
pin("A3 the fleet voice names completed-of-total (t1086 re-key — the family's word: the ring's title and the dashboard's line both say 'jobs completed'; 'jobs done' was this mouth's lone fork)",
  compSlice.includes("${stats.completed} of ${stats.total} jobs completed"));
pin("A4 the no-failure voice carries the counts too (t1086 re-key — the title IS the button's accessible name; the face's 5/15 reached the eye but never AT when the alarm was absent — the economy law yields to the aria law)",
  compSlice.includes("of ${stats.total} jobs completed · click to open the dashboard`"));
pin("A5 the click affordance survives in BOTH voices (t1086 re-key — both branches are template literals now, the door named twice in the slice)",
  compSlice.split("· click to open the dashboard").length === 3);

/* ---- B band: particles' provenance voice ---- */
const partWin = kpi.indexOf('key="particles"');
const partSlice = partWin > 0 ? kpi.slice(partWin, partWin + 400) : "";
pin("B0 the particles seat is located", partWin > 0);
pin("B1 the count is named as the fleet's sum",
  partSlice.includes("Particles extracted across the fleet — the summed count every extraction seat reports"));
pin("B2 the anonymous 'fed into' is retired",
  !partSlice.includes("Particles fed into"));

/* ---- C band: the verdict's distance voice ---- */
const verdWin = kpi.indexOf('key="verdict"');
const verdSlice = verdWin > 0 ? kpi.slice(verdWin, verdWin + 900) : "";
// t1087 re-key — the verdict's words moved to the WELL
// (lib/resolution-target): the pill drinks the builders, the unit reads
// both sources (plain text — the band law's static pins hold).
const wellSrc = readFileSync(path.join(ROOT, "src/lib/resolution-target.ts"), "utf8");
pin("C0 the verdict seat is located", verdWin > 0);
pin("C1 the title drinks the WELL's tail builder (t1087 re-key — the glance words' home is lib/resolution-target; one template carries both branches, the old inline ternary retired)",
  verdSlice.includes("${targetTitleTail(verdict)}") &&
    !verdSlice.includes("resValue <= TARGET_ANGSTROM"));
pin("C2 the verdict hoists ONE verdict (t1087 re-key — the distance is computed once per seat, the one-arithmetic law's shape; the old per-tail inline subtractions are retired — checked across the whole source, the hoist sits before the slice window)",
  kpi.includes("const verdict = targetVerdict(resValue);") &&
    !kpi.includes("(TARGET_ANGSTROM - resValue)") &&
    !kpi.includes("(resValue - TARGET_ANGSTROM)"));
pin("C3 the unmet voice teaches the way forward (t1087 re-key — the words now live in the well, byte-exact)",
  wellSrc.includes("push the refinement and the medal turns gold"));
pin("C4 the published provenance is the WELL's passport, quoted verbatim (t1087 re-key — one home for the words, the pill interpolates the const)",
  wellSrc.includes('export const TARGET_PASSPORT = "EMPIAR-10017 published: 4.2 Å (EMD-2824)";') &&
    verdSlice.includes("title={`${TARGET_PASSPORT} — this map:"));
pin("C5 the face branches on verdict.met (t1087 re-key — the comparison drinks the well's one subtraction)",
  verdSlice.includes("{verdict.met ? ("));

/* ---- D band: t1086 — THE KPI BAND'S ONE SHAPE (the hunt's sixth
 * catch, three cells of one family): (1) the fleet item title's
 * space-joins were the t1078 serve's unjudged remainder — the sweep
 * took the card, the dialog and the calendar while this composed
 * title waited behind them; the stories ride the break now (the
 * t1077 notch's title dialect — the silences' own line); (2) the
 * memory chip's seat (t1062) predates the family's shape — a
 * one-liner title and a countless name where the card's and the
 * dialog's chips wear the two-paragraph story and the count-carrying
 * name; (3) the completion counts reached the eye but never AT in the
 * healthy branch. ---- */
const fleetWin = kpi.indexOf('key="fleet"');
const fleetSlice = fleetWin > 0 ? kpi.slice(fleetWin, fleetWin + 2600) : "";
pin("D0 the fleet seat is located", fleetWin > 0);
pin("D1 the bytes' story ends at the card's own gloss scope (voice + reach one paragraph — the card's L570 shape byte-mirrored; no hole joined it by space)",
  fleetSlice.includes('${spec.voice}${reach ? ` ${reach}` : ""}${holes'));
pin("D2 the silences ride the break (the t1077 notch's title dialect — the holes' own line, directly before the ring's memory)",
  fleetSlice.includes('${holes ? `\\n${holes}` : ""}\\nRing'));
pin("D3 the door rides its own break after the memory (the chip family's mechanics-then-affordance shape)",
  fleetSlice.includes('remembered.\\n· click to open the storage overview'));
pin("D4 the chip's countless one-liner title is retired",
  !kpi.includes("The ring's full story — open System diagnostics"));
pin("D5 the chip wears the family's two-paragraph ring story (byte-equal with the card's and the dialog's seats — the cross-file pin lives in t1053's CC band)",
  kpi.includes("The trend ring remembers the last ${FLEET_TREND_RING_CAP} measures") &&
    kpi.includes("arrive.\\nA click opens System diagnostics at the fleet memory section."));
pin("D6 the chip's name carries the ring's count (the family's aria shape)",
  kpi.includes("Ring ${spec.ringCount} of ${FLEET_TREND_RING_CAP} remembered measures — open the fleet memory section in System diagnostics"));
pin("D7 the old countless name is retired",
  !kpi.includes('aria-label="Open the fleet memory section in System diagnostics"'));
pin("D8 the count's SECOND EYE (t1089): the chip's visible face speaks ring n/12 in the family's mono chip dialect — the one seat on the app's MAIN view whose count the ear read and the eye could not",
  kpi.includes("{`ring ${spec.ringCount}/${FLEET_TREND_RING_CAP}`}") &&
    kpi.includes("gap-1 rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[10px] tabular-nums"));
pin("D9 the memory chip's icon-only private face is retired (t1062's size-5 rounded-md glance — the shape survives only on the fold control, the band's own icon-button dialect; the chip's element window wears the family's face instead)",
  (() => {
    const at = kpi.indexOf('data-testid="fleet-kpi-memory"');
    const win = at >= 0 ? kpi.slice(at, at + 700) : "";
    return win.includes("rounded-full bg-muted/60") && !win.includes("size-5");
  })());

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
