#!/usr/bin/env node
/**
 * t1147 — THE CONTOUR-HISTORY unit: the σ door's memory. The canonical
 * presets (1/2/3/5σ) were already in the viewer; what was genuinely
 * missing was the USER's own levels — the 1.35σ tuned BY EYE for one
 * map is worth more than the canon, and the old viewer forgot it on
 * close. The cure rides the persistence doctrine's own shape (the t1135
 * world-ledger laws, scaled to this memory): a per-job, versioned,
 * capped list of the levels the user SETTLED on — a drag that never
 * committed remembers nothing (the settle is the memory's unit).
 *
 * A — the brain run FOR REAL (src/lib/contour-history.ts, pure, the
 *     storage is a parameter): the recency push (dedup by the epsilon
 *     law, a re-pick MOVES TO THE FRONT, capped, pure, NaN refused) and
 *     the ONE trust decision (the versioned envelope: bad-json /
 *     foreign-version / non-array / ONE off-shape row drop the WHOLE
 *     memory; over-cap truncates to the head — the newest survive).
 * B — the mirror: the per-job key (the house pattern), the byte
 *     round-trip through the ONE envelope father, the quota-refusing
 *     store degrading to FALSE (cosmetic memory, never a throw), the
 *     empty memory removing its key (absence is never written).
 * C — the hands source-pinned: the settle wires (the slider's COMMIT —
 *     never the drag; the [ / ] taps; the preset chips; the histogram
 *     pick), the restore and persist faces through the fathers, the
 *     honest-empty row, the forget door, and the must-not-lie law (NO
 *     new keyboard claim — the digits 1-6 stay the view presets).
 *
 * node scripts/unit-runner.mjs scripts/t1147-contour-history-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTOUR_HISTORY_CAP,
  CONTOUR_HISTORY_EPSILON,
  contourHistoryEnvelope,
  contourHistoryKey,
  parseContourHistory,
  pushContourLevel,
  readContourHistory,
  writeContourHistory,
} from "@/lib/contour-history";

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "  ok" : "  FAIL"}: ${label}${cond ? "" : ` — ${extra}`}`);
  if (cond) pass++;
  else fail++;
};
const nearly = (a, b) => Math.abs(a - b) < 1e-9;

/* ---------- A. the recency push, run FOR REAL ---------- */

ok("A1 an exact re-pick dedups (a level never duplicates — it MOVES)",
  ((r) => r.length === 3 && r[0] === 2 && r[1] === 3 && r[2] === 1)(pushContourLevel([3, 2, 1], 2)) &&
  !JSON.stringify(pushContourLevel([3, 2, 1], 2)).match(/2[\s\S]*2/));

ok("A2 the epsilon law: a level within 1e-6 IS the same level",
  pushContourLevel([1, 0.5], 1 + CONTOUR_HISTORY_EPSILON / 2).length === 2 &&
  nearly(pushContourLevel([1, 0.5], 1 + CONTOUR_HISTORY_EPSILON * 2)[0], 1 + CONTOUR_HISTORY_EPSILON * 2));

ok("A3 newest first — the push lands at the head",
  pushContourLevel([3, 2, 1], 4)[0] === 4 && pushContourLevel([3, 2, 1], 4)[3] === 1);

ok("A4 the cap holds: the tail ages out, the newest survive",
  pushContourLevel([5, 4, 3, 2, 1], 6).length === CONTOUR_HISTORY_CAP &&
  pushContourLevel([5, 4, 3, 2, 1], 6)[0] === 6 &&
  !pushContourLevel([5, 4, 3, 2, 1], 6).includes(1));

ok("A5 a re-pick MOVES TO THE FRONT (recency, not duplication)",
  JSON.stringify(pushContourLevel([3, 9, 1], 9)) === JSON.stringify([9, 3, 1]));

ok("A6 the push is PURE (the input array is never mutated)",
  ((h) => { pushContourLevel(h, 7); return h.length === 2; })([2, 1]));

ok("A7 a non-finite push is refused (the memory never holds a NaN)",
  JSON.stringify(pushContourLevel([2, 1], Number.NaN)) === JSON.stringify([2, 1]) &&
  JSON.stringify(pushContourLevel([2, 1], Infinity)) === JSON.stringify([2, 1]));

/* ---------- A'. the ONE trust decision ---------- */

ok("A8 absent / null / empty raw are the honest absence (never a guess)",
  parseContourHistory(undefined).length === 0 &&
  parseContourHistory(null).length === 0 &&
  parseContourHistory("").length === 0);

ok("A9 bad JSON drops the memory whole",
  parseContourHistory("{not json").length === 0);

ok("A10 a foreign version drops the memory whole (untrusted shapes are never guessed)",
  parseContourHistory(JSON.stringify({ v: 2, levels: [1, 2] })).length === 0 &&
  parseContourHistory(JSON.stringify({ levels: [1, 2] })).length === 0);

ok("A11 non-array levels drop the memory whole",
  parseContourHistory(JSON.stringify({ v: 1, levels: "1,2" })).length === 0);

ok("A12 ONE off-shape row drops the WHOLE memory (a string, a NaN, an Infinity — any untrustworthy row untrusts the list)",
  parseContourHistory(JSON.stringify({ v: 1, levels: [1, "2", 3] })).length === 0 &&
  parseContourHistory(JSON.stringify({ v: 1, levels: [1, Number.NaN, 3] })).length === 0 &&
  parseContourHistory(JSON.stringify({ v: 1, levels: [1, Infinity] })).length === 0);

ok("A13 over-cap is NOT a shape violation — the head survives (the newest are the memory's meaning)",
  JSON.stringify(parseContourHistory(JSON.stringify({ v: 1, levels: [9, 8, 7, 6, 5, 4] }))) ===
    JSON.stringify([9, 8, 7, 6, 5]));

ok("A14 the envelope round-trips through the ONE text father",
  JSON.stringify(parseContourHistory(contourHistoryEnvelope([1.5, 2.25]))) === JSON.stringify([1.5, 2.25]));

/* ---------- B. the mirror ---------- */

const fakeStore = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    _m: m,
  };
};

ok("B1 the per-job key rides the house pattern (the overlays' and the bookmarks' own shape)",
  contourHistoryKey("job-abc") === "cryoflow.contour-history:job-abc");

ok("B2 a null storage reads the honest absence (the SSR face)",
  readContourHistory(null, "job-1").length === 0);

ok("B3 an empty jobId reads the honest absence",
  readContourHistory(fakeStore(), "").length === 0);

ok("B4 the write→read byte round-trip holds (the memory restores EXACTLY)",
  ((s) => {
    writeContourHistory(s, "job-9", [1.35, 2, 3.5]);
    return JSON.stringify(readContourHistory(s, "job-9")) === JSON.stringify([1.35, 2, 3.5]);
  })(fakeStore()));

ok("B5 a quota-refusing store degrades to FALSE — never a throw",
  ((s) => {
    s.setItem = () => { throw new Error("QuotaExceeded"); };
    return writeContourHistory(s, "job-1", [2]) === false;
  })(fakeStore()));

ok("B6 an empty memory REMOVES the key (absence is never written as an empty envelope) and answers true",
  ((s) => {
    writeContourHistory(s, "job-2", [2]);
    const okRemove = writeContourHistory(s, "job-2", []) === true;
    return okRemove && s.getItem(contourHistoryKey("job-2")) === null;
  })(fakeStore()));

ok("B7 a null storage write degrades to false (nothing to write into)",
  writeContourHistory(null, "job-1", [2]) === false);

/* ---------- C. the hands source-pinned ---------- */

const embed = readFileSync(
  join(here, "..", "src", "components", "workflow", "results", "molstar-embed.tsx"),
  "utf8"
);

ok("C1 the embed imports the THREE fathers (the ONE-father law at the door)",
  embed.includes('from "@/lib/contour-history"') &&
    embed.includes("pushContourLevel") &&
    embed.includes("readContourHistory") &&
    embed.includes("writeContourHistory"));

ok("C2 the embed carries NO key string of its own (the key lives in the lib — the instruments cannot drift)",
  !embed.includes("cryoflow.contour-history"));

ok("C3 the restore face reads through the father, per job, on open",
  /useEffect\(\(\) => \{\s*\n\s*\/\/ the restore face[^\}]*setSigmaHistory\(readContourHistory\(window\.localStorage, jobId\)\);\s*\n\s*\}, \[jobId\]\)/.test(embed));

ok("C4 the persist face writes after real changes (the effect rides [sigmaHistory, jobId] — never render, the #13 law)",
  /writeContourHistory\(window\.localStorage, jobId, sigmaHistory\);\s*\n\s*\}, \[sigmaHistory, jobId\]\)/.test(embed));

ok("C5 the settle wire: the slider's COMMIT remembers (the drag's own unit)",
  /onValueCommit=\{\(v\) => \{[\s\S]{0,320}rememberSigma\(s\);/.test(embed));

ok("C6 the drag never remembers (onValueChange carries NO memory — every pixel would flood the cap)",
  embed.includes("onValueChange={(v) => setSigma(v[0] ?? 2)}") &&
    !/onValueChange=\{\(v\) => \{[\s\S]{0,120}rememberSigma/.test(embed));

ok("C7 the [ / ] taps remember the settled level (two decimals, the readout's own truth)",
  embed.includes("rememberSigma(settled);"));

ok("C8 the preset chips remember (the canon is worth remembering too)",
  embed.includes("rememberSigma(p);"));

ok("C9 the histogram pick IS a settle (the SET channel remembers the by-eye choice)",
  /rememberSigma\(s\);\s*\n\s*\};\s*\n\s*window\.addEventListener\(ORTHO_SIGMA_SET_EVENT/.test(embed));

ok("C10 NO new keyboard claim (the digits 1-6 stay the view presets, the slider's teaching line is unchanged — the must-not-lie law)",
  embed.includes('const PRESETS = [1, 2, 3, 5];') &&
    embed.includes('const idx = "123456".indexOf(e.key);') &&
    embed.includes('title="Contour σ — [ / ] step the level from the keyboard, F flips the density side"'));

ok("C11 the honest-empty law: the history row exists only when it has rows",
  embed.includes("{sigmaHistory.length > 0 && ("));

ok("C12 the forget door exists only beside a memory (inside the same conditional row)",
  /sigmaHistory\.length > 0 && \([\s\S]{0,2600}Forget the remembered contour levels/.test(embed));

ok("C13 the group speaks its name and the chips wear honest pressed semantics (the epsilon)",
  embed.includes('"Recent contour levels remembered for this map"') &&
    embed.includes("aria-pressed={Math.abs(sigma - l) < 0.001}"));

ok("C14 the recency cap rides the lib's ONE father (the embed hardcodes no cap of its own)",
  !/setSigmaHistory\([^)]*\)\.slice\(/.test(embed) &&
    embed.includes("pushContourLevel(prev, s)"));

/* ---------- receipt ---------- */
console.log(`\nCONTOUR-HISTORY-UNIT t1147: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
