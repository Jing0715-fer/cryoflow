#!/usr/bin/env node
/**
 * t1141 — THE LEDGER'S DEEPER TIER unit: the machine's memory beside
 * the tab's.
 *
 * THE SLICE (the t1134 pool's persistence candidate — the survey FIRST):
 * the t1135 slice made the ledger sessionStorage (the TAB's own memory).
 * The survey (scripts/t1141-ledger-storage-survey.mjs, 10/10) measured
 * the deeper tier BEFORE it was wired — the envelope at cap weighs
 * 18,976 B against a 10 GiB origin quota (0.0002%: the tier's space
 * cost is nil), BOTH storages take the envelope whole on the live
 * origin, and localStorage holds zero cryoflow keys today (no
 * collision). It also caught the build's own generation: the served
 * build PREDATES the ledger (the t1135+ delta unbaked — the build-day
 * shape), so the live face's empty ledger is the honest absence, and
 * this unit rides the SOURCE (the jiti lane), where the tier lives.
 *
 * THE LAWS PINNED:
 *   A  the tier reader — the TAB's story wins; the machine's story
 *      fills an empty tab; a REFUSED TIER IS THAT TIER'S ABSENCE (a
 *      foreign version drops that tier whole and never blinds the
 *      other's restore); the SSR face (nulls) restores nothing.
 *   B  the tier writer — write-through BOTH through the ONE writer
 *      (one envelope: both tiers hold byte-equal memories); each tier
 *      keeps its OWN receipt; a refusal degrades that tier alone. The
 *      byte-bound tooth: the envelope at cap stays under 64 KiB — a
 *      fatter row shape REDs this seat and the survey re-runs.
 *   C  the dialog wiring — the restore reads the TIERS father with
 *      both storages; the persist writes THROUGH the tiers father; the
 *      bare single-tier fathers are GONE from the call site (the
 *      one-father law at the door); the survey's numbers travel with
 *      the lib's own words (the birth certificate).
 *   D  the survey's standing facts — the measured numbers (quota,
 *      envelope, both tiers' live reachability) are pinned from the
 *      receipt, so the tier's design never drifts from its evidence.
 *
 * node scripts/unit-runner.mjs scripts/t1141-world-ledger-tiers-unit.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import {
  readWorldLedgerTiers,
  writeWorldLedgerTiers,
  readWorldLedgerStorage,
  WORLD_LEDGER_CAP,
} from "../src/lib/world-vitals.ts";

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const lib = readFileSync("src/lib/world-vitals.ts", "utf8");
const dlg = readFileSync("src/components/workflow/world-health-dialog.tsx", "utf8");

/* ---------- fixtures (the tests construct fakes — the lib stays pure) ---------- */
const snap = (t, jobs = 15, edges = 14, running = 0, completed = 15, failed = 0) =>
  ({ t, jobs, edges, running, completed, failed });
const R1 = [snap(1000), snap(2000, 15, 14, 1, 14), snap(3000, 16, 14, 0, 16)];
const R2 = [snap(5000, 15, 14, 0, 15, 1), snap(6000, 15, 15, 0, 15)];

const fakeStore = (map) => ({
  getItem: (k) => (k in map ? map[k] : null),
  setItem: (k, v) => { map[k] = String(v); },
});
const throwingStore = () => ({
  getItem: () => { throw new Error("the tier refuses"); },
  setItem: () => { throw new Error("the tier refuses"); },
});
const envelope = (rows, v = 1) => JSON.stringify({ v, rows });

/* ---------- A — the tier reader: the precedence law ---------- */
{
  const s = fakeStore({ "cryoflow.world-ledger.v1": envelope(R1) });
  const l = fakeStore({ "cryoflow.world-ledger.v1": envelope(R2) });
  const r = readWorldLedgerTiers(s, l);
  ok("A1 the TAB's story wins (both tiers fed → session rows, tier session)",
    r.tier === "session" && r.rows.length === 3 && r.rows[0].t === 1000);
}
{
  const s = fakeStore({});
  const l = fakeStore({ "cryoflow.world-ledger.v1": envelope(R2) });
  const r = readWorldLedgerTiers(s, l);
  ok("A2 the machine fills an EMPTY tab (tier local)", r.tier === "local" && r.rows.length === 2 && r.rows[0].t === 5000);
}
{
  const r = readWorldLedgerTiers(fakeStore({}), fakeStore({}));
  ok("A3 both empty → the honest none (rows [], tier none)", r.tier === "none" && Array.isArray(r.rows) && r.rows.length === 0);
}
{
  const r = readWorldLedgerTiers(null, null);
  ok("A4 the SSR face (nulls) restores nothing", r.tier === "none" && r.rows.length === 0);
}
{
  const l = fakeStore({ "cryoflow.world-ledger.v1": envelope(R2) });
  const r = readWorldLedgerTiers(null, l);
  ok("A5 a null session tier does not blind the machine's restore", r.tier === "local" && r.rows.length === 2);
}
{
  const s = fakeStore({ "cryoflow.world-ledger.v1": envelope(R1, 999) }); // a foreign version
  const l = fakeStore({ "cryoflow.world-ledger.v1": envelope(R2) });
  const r = readWorldLedgerTiers(s, l);
  ok("A6 a REFUSED tier is that tier's absence — the machine's story fills (never the restore's death)",
    r.tier === "local" && r.rows.length === 2);
}
{
  const s = fakeStore({ "cryoflow.world-ledger.v1": envelope(R1) });
  const l = fakeStore({ "cryoflow.world-ledger.v1": envelope(R2, 999) }); // the machine's story untrusted
  const r = readWorldLedgerTiers(s, l);
  ok("A7 the mirror: an untrusted LOCAL never dethrones the tab's story", r.tier === "session" && r.rows.length === 3);
}
ok("A8 the tier vocabulary is the lib's own type (session | local | none)",
  lib.includes('export type WorldLedgerTier = "session" | "local" | "none";') &&
    lib.includes("export interface WorldLedgerRestore") &&
    lib.includes("export interface WorldLedgerWriteReceipt"));

/* ---------- B — the tier writer: the write-through law ---------- */
{
  const sm = {};
  const lm = {};
  const r = writeWorldLedgerTiers(fakeStore(sm), fakeStore(lm), R1);
  ok("B1 both willing → both receipts true", r.session === true && r.local === true);
}
{
  const sm = {};
  const r = writeWorldLedgerTiers(fakeStore(sm), throwingStore(), R1);
  ok("B2 a refusing tier degrades ALONE (its own false, the other true)",
    r.session === true && r.local === false && sm["cryoflow.world-ledger.v1"] !== undefined);
}
{
  const sm = {};
  const r = writeWorldLedgerTiers(fakeStore(sm), null, R1);
  ok("B3 the SSR face of one tier (null local) → {session: true, local: false}", r.session === true && r.local === false);
}
{
  const r = writeWorldLedgerTiers(null, null, R1);
  ok("B4 the SSR face of both (nulls) → both false, never a throw", r.session === false && r.local === false);
}
{
  const sm = {};
  const lm = {};
  writeWorldLedgerTiers(fakeStore(sm), fakeStore(lm), R1);
  const backS = readWorldLedgerStorage(fakeStore(sm));
  const backL = readWorldLedgerStorage(fakeStore(lm));
  ok("B5 the ONE envelope: both tiers hold byte-equal memories the SAME reader restores",
    JSON.stringify(backS) === JSON.stringify(R1) && JSON.stringify(backL) === JSON.stringify(R1) &&
      sm["cryoflow.world-ledger.v1"] === lm["cryoflow.world-ledger.v1"]);
}
{
  const rows = [];
  let t0 = 1700000000000;
  for (let i = 0; i < WORLD_LEDGER_CAP; i++) rows.push(snap(t0 + i * 60000));
  const bytes = JSON.stringify({ v: 1, rows }).length;
  ok("B6 the byte-bound tooth: the envelope at cap stays under 64 KiB (the survey's number made standing)",
    bytes < 64 * 1024, `${bytes} B at ${WORLD_LEDGER_CAP} rows`);
}

/* ---------- C — the dialog wiring: the one-father law at the door ---------- */
ok("C1 the restore reads the TIERS father with BOTH storages",
  dlg.includes("readWorldLedgerTiers(session, local)") &&
    /const session = typeof window !== "undefined" \? window\.sessionStorage : null;/.test(dlg) &&
    /const local = typeof window !== "undefined" \? window\.localStorage : null;/.test(dlg));
ok("C2 the restore's clobber cure rides the tier shape (setHistory only on a non-empty restore)",
  dlg.includes("restoredRef.current = true;") && dlg.includes("if (restored.rows.length > 0) setHistory(restored.rows);"));
ok("C3 the persist writes THROUGH the tiers father",
  dlg.includes("writeWorldLedgerTiers(session, local, history)"));
ok("C4 the bare single-tier fathers are GONE from the call site (the one-father law at the door)",
  !dlg.includes("readWorldLedgerStorage(") && !dlg.includes("writeWorldLedgerStorage("));
ok("C5 the survey's numbers travel with the lib's own words (the birth certificate)",
  lib.includes("18,976 B") && lib.includes("0.0002%"));

/* ---------- D — the survey's standing facts (the receipt's own numbers) ---------- */
const SURVEY = "shots-qa/t1141-ledger-storage-survey.json";
ok("D1 the survey receipt EXISTS (the tier's birth certificate is in the repo)", existsSync(SURVEY));
if (existsSync(SURVEY)) {
  const sv = JSON.parse(readFileSync(SURVEY, "utf8"));
  const s = sv.survey ?? {};
  ok("D2 the survey measured the origin's quota (a number, not folklore)",
    typeof s.quotaBytes === "number" && s.quotaBytes > 0, `${s.quotaBytes} B`);
  ok("D3 the survey weighed the envelope at cap (240 rows, byte-counted)",
    s.capRows === WORLD_LEDGER_CAP && s.capEnvelopeBytes > 0, `${s.capEnvelopeBytes} B`);
  ok("D4 BOTH tiers took the envelope whole on the live origin (the reachability receipt)",
    s.sessionWrite === true && s.localWrite === true);
  ok("D5 the build's generation is NAMED in the receipt (the build-day shape's own witness)",
    typeof s.buildCarriesLedger === "boolean", `buildCarriesLedger=${s.buildCarriesLedger}`);
  ok("D6 the deeper tier's key had no collision on the live origin",
    Array.isArray(s.localCryoflowKeys) && !s.localCryoflowKeys.some((k) => k.key === "cryoflow.world-ledger.v1"));
} else {
  ok("D2 the survey measured the origin's quota", false, "receipt missing");
  ok("D3 the survey weighed the envelope at cap", false, "receipt missing");
  ok("D4 BOTH tiers took the envelope whole", false, "receipt missing");
  ok("D5 the build's generation is named", false, "receipt missing");
  ok("D6 the deeper tier's key had no collision", false, "receipt missing");
}

/* ---------- receipt ---------- */
console.log(`\nWORLD-LEDGER-TIERS-UNIT t1141: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
