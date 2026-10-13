#!/usr/bin/env node
/**
 * t945 — the MINUS CONVENTION unit: one face, one minus sign.
 *
 * The window's finding (the style round's second target): the class
 * convergence dialog spoke TWO minus conventions in one breath — the
 * mover lists and the median chip sign through fmtDelta ("−1.24", the
 * U+2212 minus, "the sign IS the news"), while the census's biggest
 * note handed its negative to toFixed and spoke the ASCII hyphen
 * ("-2.4 pp"). Two glyphs for one truth, one dialog. The cure: the
 * census drinks fmtDelta — the family's own sign — and this unit pins
 * the convention so no future sentence re-opens the wound.
 *
 * ARMS:
 *   M1  fmtDelta's own law holds (the sign IS the news: U+2212 for
 *       negatives, "+" for positives, "" at zero, the em dash for the
 *       non-finite)
 *   M2  the census's biggest note speaks the SAME sign as fmtDelta for
 *       the same delta — negative (U+2212), positive (+), and the
 *       no-mover case (no note at all)
 *   M3  the ASCII hyphen is banished from the biggest note (a "-2.4 pp"
 *       byte in the census is the old leak, caught verbatim)
 *   M4  the family read: for a mixed electorate the census, the mover
 *       lists' formatter and the median chip ALL derive their signs
 *       from the one fmtDelta (the census imports it — no local sign
 *       arithmetic left in the sentence builder)
 *
 * Runs under the alias loader (scripts/unit-runner.mjs) — it imports
 * the app's TypeScript sources. Rides the node-only census fleet
 * (t927-census.sh), the 13th instrument.
 *
 *   node scripts/unit-runner.mjs scripts/t945-convention-unit.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

const { fmtDelta } = await import("@/lib/paired-compare");
const { movingCensus } = await import("@/lib/convergence");

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const MINUS = "\u2212"; // U+2212 — the family's minus
const delta = (name, d) => ({ name, delta: d, kind: d > 0 ? "improved" : d < 0 ? "regressed" : "tied" });

/* ---- M1 — fmtDelta's own law (the precedent, unchanged) ---- */
ok("M1a negative speaks U+2212", fmtDelta(-2.4, 1) === `${MINUS}2.4`, JSON.stringify(fmtDelta(-2.4, 1)));
ok("M1b positive speaks +", fmtDelta(2.4, 1) === "+2.4", JSON.stringify(fmtDelta(2.4, 1)));
ok("M1c zero speaks no sign", fmtDelta(0, 1) === "0.0", JSON.stringify(fmtDelta(0, 1)));
ok("M1d non-finite speaks the em dash", fmtDelta(NaN, 1) === "—", JSON.stringify(fmtDelta(NaN, 1)));

/* ---- M2 — the census drinks fmtDelta (the cure) ---- */
const neg = [delta("Class 001", -2.4), delta("Class 002", 0), delta("Class 003", 0.5)];
const negCensus = movingCensus(neg, { aRound: 0, bRound: 25 }) ?? "";
ok("M2a the census's biggest note speaks the family's U+2212",
  negCensus.includes(`(biggest: Class 001, ${MINUS}2.4 pp)`),
  JSON.stringify(negCensus));
ok("M2b the census's biggest note and fmtDelta agree for the same delta",
  negCensus.includes(`(biggest: Class 001, ${fmtDelta(-2.4, 1)} pp)`),
  "one formatter, one sign");
const pos = [delta("Class 001", 2.4), delta("Class 002", 0), delta("Class 003", -0.5)];
const posCensus = movingCensus(pos, { aRound: 0, bRound: 25 }) ?? "";
ok("M2c a positive biggest keeps its +",
  posCensus.includes("(biggest: Class 001, +2.4 pp)"),
  JSON.stringify(posCensus));
const settled = [delta("Class 001", 0), delta("Class 002", 0.4)];
ok("M2d no movers → no biggest note at all",
  !(movingCensus(settled, { aRound: 0, bRound: 25 }) ?? "").includes("biggest"),
  "the settled ending hides the note (CV3c's own law)");

/* ---- M3 — the ASCII hyphen is banished ---- */
ok("M3a no ASCII '-2.4 pp' byte in the census",
  !negCensus.includes("-2.4 pp"),
  "the old leak, caught verbatim");
ok("M3b the em dashes and the threshold keep their own glyphs (they are not minus signs)",
  negCensus.includes(" — ") && negCensus.includes("1.0 pp"),
  JSON.stringify(negCensus.slice(0, 80)));

/* ---- M4 — the one-formatter read (source-pinned) ---- */
const { readFileSync } = await import("node:fs");
const convSrc = readFileSync(path.join(process.cwd(), "src/lib/convergence.ts"), "utf8");
ok("M4a the census builder imports fmtDelta (no local sign arithmetic)",
  convSrc.includes('import { fmtDelta, type Delta } from "@/lib/paired-compare"') && convSrc.includes("fmtDelta(biggest.delta, 1)") && !convSrc.includes("? \"+\" : \"\"}${"),
  "the sentence builder signs through the family");

const receipt = {
  instrument: "t945-convention-unit",
  pass, fail,
  at: new Date().toISOString(),
};
try { writeFileSync(path.join(process.cwd(), "shots-qa/t945-convention-unit.json"), JSON.stringify(receipt, null, 2)); } catch {}
console.log(`\nCONVENTION-UNIT t945: ${pass}/${pass + fail} ${fail === 0 ? "green — one face, one minus" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
