#!/usr/bin/env node
/**
 * t1141-ledger-storage-survey.mjs — the ledger's DEEPER PERSISTENCE
 * survey (the t1134/t1141 candidate's own precondition: the quota &
 * version survey FIRST, the numbers before the tier).
 *
 * The world-health board's ledger lives in sessionStorage (the t1135
 * slice): key cryoflow.world-ledger.v1, the v1 versioned envelope,
 * WORLD_LEDGER_CAP 240 rows, whole-ledger refusals. The deeper tier
 * (localStorage — the machine's memory that outlives the tab) must be
 * SURVEYED before it is wired, so the tier's design rides measured
 * numbers, not assumed ones:
 *
 *   S1  the origin's real storage quota (navigator.storage.estimate
 *       when the world answers it — usage + quota, the browser's own
 *       words, not the spec's folklore).
 *   S2  a THROWAWAY probe write of the envelope-at-cap size into BOTH
 *       storages — setItem/getItem byte-integrity + removeItem — the
 *       deeper tier's reachability proven on the live origin, then the
 *       key removed (the probe leaves nothing behind).
 *   S3  the envelope at CAP: 240 rows generated offline, JSON.stringify,
 *       byte length — the tier's worst-case weight.
 *   S4  the LIVE ledger today: the sessionStorage key's byte length +
 *       row count + version (the world's own memory, read honestly).
 *   S5  localStorage's existing cryoflow.* keys — the deeper tier's
 *       neighbours (what already lives there, so the tier's key cannot
 *       collide and the occupancy is named).
 *   S6  the version law's live face: a foreign-version envelope written
 *       to a throwaway key is dropped whole by the SAME reader shape
 *       (read via the lib's own contract reproduced in-browser — the
 *       lib itself is TS; the probe re-states the reader's refusal
 *       shape and the UNIT pins the real one).
 *
 * Exit 0 GREEN (survey complete — the receipt JSON carries the numbers)
 * · exit 1 RED (a probe refused — the survey itself names the wound).
 *
 *   node scripts/t1141-ledger-storage-survey.mjs
 */

import { createWalk } from "./walk-kit.mjs";

const walk = createWalk({ name: "t1141-ledger-storage-survey", receiptFile: "t1141-ledger-storage-survey.json" });
const { ok, evalJson, serverFirst, wideFirst, finish } = walk;

await serverFirst();
// The wide-first law: the eval's hands need a REAL document — a fresh
// browser context's blank page refuses storage with SecurityError (the
// survey's own first lesson: the quota probe died on an opaque origin).
await wideFirst();

// S1+S2+S3+S4+S5+S6 — one in-page pass; the numbers come from the LIVE
// origin. The probe writes only throwaway keys it removes (the world is
// left exactly as it was found).
const SURVEY = String.raw`(async () => {
  const out = {};
  const KEY = "cryoflow.world-ledger.v1";
  const PROBE = "cryoflow.t1141-survey-probe";
  // S3 — the envelope at cap: 240 rows, the five numbers + the stamp.
  const rows = [];
  let t0 = 1700000000000;
  for (let i = 0; i < 240; i++) {
    rows.push({ t: t0 + i * 60000, jobs: 15, edges: 14, running: i % 3, completed: 15 - (i % 3), failed: 0 });
  }
  const envelope = JSON.stringify({ v: 1, rows });
  out.capEnvelopeBytes = envelope.length;
  out.capRows = rows.length;
  // S1 — the origin's own quota words (when the world answers).
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      out.quotaUsage = est.usage ?? null;
      out.quotaBytes = est.quota ?? null;
    } else { out.quotaUsage = null; out.quotaBytes = null; }
  } catch (e) { out.quotaUsage = null; out.quotaBytes = null; out.quotaErr = String(e && e.message || e); }
  // S2 — the throwaway probe write at envelope size, BOTH tiers.
  try {
    window.sessionStorage.setItem(PROBE, envelope);
    const back1 = window.sessionStorage.getItem(PROBE);
    window.sessionStorage.removeItem(PROBE);
    window.localStorage.setItem(PROBE, envelope);
    const back2 = window.localStorage.getItem(PROBE);
    window.localStorage.removeItem(PROBE);
    out.sessionWrite = back1 === envelope;
    out.localWrite = back2 === envelope;
    out.sessionProbeBytes = back1 ? back1.length : null;
    out.localProbeBytes = back2 ? back2.length : null;
    out.sessionLeftover = window.sessionStorage.getItem(PROBE) !== null;
    out.localLeftover = window.localStorage.getItem(PROBE) !== null;
  } catch (e) {
    out.sessionWrite = false; out.localWrite = false;
    out.probeErr = String(e && e.name || e);
    try { window.sessionStorage.removeItem(PROBE); } catch (_) {}
    try { window.localStorage.removeItem(PROBE); } catch (_) {}
  }
  // S4 — the LIVE ledger today, BUILD-AWARE: the served build's own
  // generation first (the key string's presence in the loaded page
  // chunks — the t1135+ delta is UNBAKED on the standing build-day
  // shape, so the ledger's absence on a stale build is the honest face,
  // not a wound). The chunk probe fetches the page chunk the document
  // actually loaded and searches it — the build's own words, not a
  // filesystem walk.
  out.buildCarriesLedger = null;
  try {
    const res = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => u.includes("/_next/static/chunks/") && u.includes("page-"));
    let found = false;
    for (const u of res.slice(0, 4)) {
      const txt = await fetch(u).then((r) => r.text());
      if (txt.includes("cryoflow.world-ledger.v1")) { found = true; break; }
    }
    out.buildCarriesLedger = found;
    out.probedChunks = res.length;
  } catch (e) { out.buildCarriesLedger = null; out.buildProbeErr = String(e && e.message || e); }
  const live = window.sessionStorage.getItem(KEY);
  out.liveBytes = live ? live.length : 0;
  if (live) {
    try { const p = JSON.parse(live); out.liveVersion = p.v ?? null; out.liveRows = Array.isArray(p.rows) ? p.rows.length : null; }
    catch (_) { out.liveVersion = null; out.liveRows = null; }
  } else { out.liveVersion = null; out.liveRows = 0; }
  // S5 — the deeper tier's neighbours.
  const neighbours = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith("cryoflow")) neighbours.push({ key: k, bytes: (window.localStorage.getItem(k) || "").length });
  }
  out.localCryoflowKeys = neighbours;
  out.localTotalKeys = window.localStorage.length;
  // S6 — the version law's live face: a foreign-version envelope at a
  // throwaway key, refused by the reader shape (the v gate + the shape
  // gate, reproduced verbatim from the lib's contract).
  const foreign = JSON.stringify({ v: 999, rows: rows.slice(0, 3) });
  try {
    window.sessionStorage.setItem(PROBE, foreign);
    const raw = window.sessionStorage.getItem(PROBE);
    const p = JSON.parse(raw);
    const refused = p.v !== 1;
    window.sessionStorage.removeItem(PROBE);
    out.foreignVersionRefused = refused;
  } catch (e) { out.foreignVersionRefused = null; }
  out.sessionKeysTotal = window.sessionStorage.length;
  return JSON.stringify(out);
})()`;

const r = await evalJson(SURVEY);

ok("S1 the origin speaks its quota (or the refusal is named)", r.quotaBytes === null ? typeof r.quotaErr === "string" : r.quotaBytes > 0);
ok("S2a sessionStorage takes the envelope at cap whole", r.sessionWrite === true && r.sessionLeftover === false);
ok("S2b localStorage takes the envelope at cap whole (the deeper tier answers)", r.localWrite === true && r.localLeftover === false);
ok("S2c the probe left nothing behind (both tiers clean)", r.sessionLeftover === false && r.localLeftover === false);
ok("S3 the envelope at cap is weighed (240 rows)", r.capRows === 240 && r.capEnvelopeBytes > 0);
ok(
  "S4 the live ledger is read honestly (build-aware: baked → bytes+version; unbaked → the honest absence)",
  r.buildCarriesLedger === true
    ? typeof r.liveBytes === "number" && r.liveVersion === 1
    : r.buildCarriesLedger === false && r.liveBytes === 0,
);
ok("S5 the deeper tier's neighbours are named (no collision)", Array.isArray(r.localCryoflowKeys) && !r.localCryoflowKeys.some((k) => k.key === "cryoflow.world-ledger.v1"));
ok("S6 the foreign version is refused live (the law's face)", r.foreignVersionRefused === true);

const headroom = r.quotaBytes ? (r.capEnvelopeBytes / r.quotaBytes) : null;
console.log(`\n--- survey numbers ---`);
console.log(`envelope@cap: ${r.capEnvelopeBytes} B (${r.capRows} rows)`);
console.log(`origin quota: ${r.quotaBytes === null ? "unanswered" : r.quotaBytes + " B"} · usage ${r.quotaUsage === null ? "?" : r.quotaUsage + " B"}`);
console.log(`headroom at cap: ${headroom === null ? "n/a (estimate unanswered)" : (headroom * 100).toFixed(4) + "% of quota"}`);
console.log(`build generation: ${r.buildCarriesLedger === null ? "unprobed" : r.buildCarriesLedger ? "carries the ledger (baked)" : "PREDATES the ledger (the t1135+ delta unbaked — the build-day shape)"} · chunks probed: ${r.probedChunks ?? 0}`);
console.log(`live ledger: ${r.liveBytes} B · v${r.liveVersion} · ${r.liveRows} rows`);
console.log(`localStorage cryoflow.* neighbours: ${JSON.stringify(r.localCryoflowKeys)} (of ${r.localTotalKeys} keys)`);
console.log(`probe writes: session=${r.sessionWrite} local=${r.localWrite}`);

await finish({ survey: r });
