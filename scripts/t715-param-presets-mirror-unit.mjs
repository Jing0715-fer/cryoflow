// t715-param-presets-mirror-unit.mjs — the server mirror's semantics,
// pinned before the bundle wakes (the t653 pattern, fifth reuse).
//
// The t715 lane: lib/user-param-presets.ts grows its second storage
// layer — a PresetShelf row behind /api/param-presets (the camera-
// bookmark dual-mirror pattern). localStorage stays the instant truth;
// persist() dual-writes; reconcileUserParamPresets() adopts the server
// list when one exists. The unit probe pins the laws a build-day e2e
// should never have to re-derive:
//
//   A  sanitizePresetShelf — the door's whitelist (scalar-only params,
//      caps, clamps, skip-not-sink).
//   B  the dual-write law — every local mutation PUTs the whole shelf;
//      a rejected PUT is shrugged off (localStorage stays the truth).
//   C  the reconcile law — synced:true adopts (even empty), synced:false
//      keeps local, failures are silent, a racing local save wins,
//      concurrent reconciles share one GET.
//   D  the route's source census — both handlers doored, shelf row KEPT
//      on empty (the synced flag lives in the row's existence).
//
// Run:  node scripts/unit-runner.mjs scripts/t715-param-presets-mirror-unit.mjs

let PASS = 0, FAIL = 0, EVENTS = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

// ---------- the memory window (+ fetch recorder) ----------
const backing = new Map();
const putCalls = [];   // every PUT the lib fires: { url, method, body }
let getHandler = null; // current GET behavior for reconcile tests
let getCalls = 0;
globalThis.window = {
  localStorage: {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => backing.set(k, String(v)),
    removeItem: (k) => backing.delete(k),
  },
  dispatchEvent: () => { EVENTS += 1; },
  fetch: (url, opts = {}) => {
    if (opts.method === "PUT") {
      putCalls.push({ url, method: opts.method, body: opts.body });
      return Promise.resolve({ ok: true, status: 200 });
    }
    getCalls += 1;
    return getHandler(url, opts);
  },
};

import { loadUserParamPresets, addUserParamPreset, deleteUserParamPreset, reconcileUserParamPresets, USER_PARAM_PRESETS_EVENT } from "../src/lib/user-param-presets";
import { sanitizePresetShelf } from "../src/lib/param-preset-sanitize";
import { readFileSync } from "node:fs";

const goodPreset = { id: "upp-1-abcde", type: "ctffind", name: "My standard pass", params: { box: 256, resMax: 8, fast: false }, createdAt: 1700000000000 };

// ---------- A: the door's whitelist ----------
console.log("A sanitizePresetShelf:");
const clean = sanitizePresetShelf([goodPreset]);
must(clean.length === 1 && clean[0].id === "upp-1-abcde" && clean[0].type === "ctffind" && clean[0].name === "My standard pass", "A a well-shaped entry survives whole");
must(clean[0].params.box === 256 && clean[0].params.fast === false, "A scalar params (number + boolean) ride through");
must(JSON.stringify(sanitizePresetShelf("not an array")) === "[]" && JSON.stringify(sanitizePresetShelf(null)) === "[]", "A non-array input reads as nothing");
const mixed = sanitizePresetShelf([goodPreset, null, "junk", { id: "x" }, 42, { id: "bad", type: "t", name: "n", params: {}, createdAt: "no" }]);
must(mixed.length === 1 && mixed[0].id === "upp-1-abcde", "A bad entries skipped, good neighbour lives (corrupt row never sinks the shelf)", `${mixed.length}`);
const unscalar = sanitizePresetShelf([{ ...goodPreset, params: { box: 256, nested: { a: 1 }, arr: [1], nil: null, inf: NaN, big: "ok" } }]);
must(unscalar.length === 1 && unscalar[0].params.box === 256 && unscalar[0].params.big === "ok", "A non-scalar params are skipped, the entry survives (mirror of the client's snapshot law)");
must(unscalar[0].params.nested === undefined && unscalar[0].params.inf === undefined, "A object/array/null/NaN values never land");
const longVal = sanitizePresetShelf([{ ...goodPreset, params: { long: "x".repeat(300), fine: "y".repeat(256) } }]);
must(longVal[0].params.long === undefined && longVal[0].params.fine === "y".repeat(256), "A string values capped at 256 chars");
must(sanitizePresetShelf([{ id: "i".repeat(65), type: "t", name: "n", params: {}, createdAt: 1 }])[0].id.length === 64, "A id capped at 64 chars");
must(sanitizePresetShelf([{ ...goodPreset, name: "n".repeat(200) }])[0].name.length === 80, "A name capped at 80 chars (wider than the UI's 60 — the door is not the UI)");
const clamped = sanitizePresetShelf([{ ...goodPreset, createdAt: 9e15 }, { ...goodPreset, createdAt: -5 }, { ...goodPreset, createdAt: "1700" }]);
must(clamped[0].createdAt <= Date.now() + 60_000, "A far-future timestamp clamped to now+60s");
must(clamped[1].createdAt === 0, "A negative timestamp clamped to 0");
must(clamped.length === 2, "A non-numeric createdAt rejected");
const fat = sanitizePresetShelf([{ ...goodPreset, params: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, i])) }]);
must(fat.length === 0, "A >64 param keys reject the entry (no JSON-bomb parking)");
const flood = Array.from({ length: 60 }, (_, i) => ({ ...goodPreset, id: `p${i}` }));
must(sanitizePresetShelf(flood).length === 48, "A the shelf caps at 48 presets", `${sanitizePresetShelf(flood).length}`);

// ---------- B: the dual-write law ----------
console.log("B dual-write:");
backing.clear(); putCalls.length = 0;
const l1 = addUserParamPreset("ctffind", "My standard pass", { box: 256, resMax: 8 });
must(l1.length === 1, "B add lands locally first");
must(putCalls.length === 1 && putCalls[0].url === "/api/param-presets" && putCalls[0].method === "PUT", "B the add fired one PUT to the shelf endpoint", `${putCalls.length}`);
const putBody = JSON.parse(putCalls[0].body);
must(Array.isArray(putBody.presets) && putBody.presets.length === 1 && putBody.presets[0].type === "ctffind" && putBody.presets[0].params.box === 256, "B the PUT body is the whole shelf in the lib's own wire shape");
must(putBody.presets[0].id === l1[0].id && putBody.presets[0].createdAt === l1[0].createdAt, "B the mirror carries the same identity the local row carries (one truth, two layers)");
deleteUserParamPreset(l1[0].id);
must(putCalls.length === 2 && JSON.parse(putCalls[1].body).presets.length === 0, "B delete re-PUTs the emptied shelf (deletion propagates)");
backing.clear(); putCalls.length = 0;
const recorderFetch = globalThis.window.fetch; // B ends by restoring THIS (the PUT recorder) — not the stub below
const rejectFetch = () => Promise.reject(new Error("server down"));
globalThis.window.fetch = rejectFetch;
let threw = false;
try { addUserParamPreset("class2d", "Offline save", { K: 8 }); } catch { threw = true; }
must(!threw && loadUserParamPresets().length === 1, "B a rejected PUT is shrugged — the session truth stays local");
globalThis.window.fetch = recorderFetch;

// ---------- C: the reconcile law ----------
console.log("C reconcile:");
const mk = (id, type, name, params) => ({ id, type, name, params, createdAt: 1700000000000 });

// C1: fresh server (synced:false) — local is the truth, nothing moves
backing.clear(); EVENTS = 0;
addUserParamPreset("ctffind", "Local first", { box: 256 });
const before = backing.get("cryoflow.user-param-presets:v1");
EVENTS = 0; getCalls = 0;
getHandler = () => Promise.resolve({ ok: true, status: 200, json: async () => ({ presets: [], synced: false }) });
await reconcileUserParamPresets();
must(backing.get("cryoflow.user-param-presets:v1") === before, "C synced:false (fresh server) keeps the local list byte-identical");
must(EVENTS === 0, "C synced:false fires no event (nothing happened)");

// C2: synced:true with a different list — adopt, re-seed, announce
getHandler = () => Promise.resolve({ ok: true, status: 200, json: async () => ({ presets: [mk("upp-9-zzzzz", "refine3d", "From another browser", { mask_diameter: 200 })], synced: true }) });
await reconcileUserParamPresets();
const adopted = loadUserParamPresets();
must(adopted.length === 1 && adopted[0].name === "From another browser" && adopted[0].type === "refine3d", "C synced:true adopts the server list");
must(backing.get("cryoflow.user-param-presets:v1").includes("From another browser"), "C the local mirror is re-seeded (next save PUTs a list that knows the synced entry)");
must(EVENTS === 1, "C the adoption announces through the changed event", `${EVENTS}`);

// C3: synced:true with an EQUAL list — no event storm
EVENTS = 0;
getHandler = () => Promise.resolve({ ok: true, status: 200, json: async () => ({ presets: adopted, synced: true }) });
await reconcileUserParamPresets();
must(EVENTS === 0 && loadUserParamPresets().length === 1, "C an equal server list is silent (no event storm on every open)");

// C4: synced:true with an EMPTY list — deletion propagates
getHandler = () => Promise.resolve({ ok: true, status: 200, json: async () => ({ presets: [], synced: true }) });
await reconcileUserParamPresets();
must(loadUserParamPresets().length === 0, "C an emptied shelf (deleted elsewhere) wipes local — the deletion is the truth");

// C5: fetch rejects — silent, local stays
backing.set("cryoflow.user-param-presets:v1", JSON.stringify([mk("upp-5-local", "ctffind", "Local truth", { box: 128 })]));
EVENTS = 0;
getHandler = () => Promise.reject(new Error("offline"));
await reconcileUserParamPresets();
must(loadUserParamPresets().length === 1 && loadUserParamPresets()[0].name === "Local truth" && EVENTS === 0, "C a failed fetch is silent — the local list restores everything");

// C6: non-ok status — local stays
getHandler = () => Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
await reconcileUserParamPresets();
must(loadUserParamPresets()[0].name === "Local truth", "C a 500 answers nothing — local stays the truth");

// C7: the dirty-guard — a local save DURING the fetch wins
let releaseGet;
getHandler = () => new Promise((res) => { releaseGet = () => res({ ok: true, status: 200, json: async () => ({ presets: [mk("upp-8-stale", "ctffind", "Stale snapshot", { box: 1 })], synced: true }) }); });
const racing = reconcileUserParamPresets();
addUserParamPreset("class2d", "Saved during the fetch", { K: 16 }); // lands mid-flight
releaseGet();
await racing;
const afterRace = loadUserParamPresets();
must(afterRace.some((p) => p.name === "Saved during the fetch") && !afterRace.some((p) => p.name === "Stale snapshot"), "C a save that lands during the fetch is never regressed (dirty-guard)");

// C8: in-flight dedup — two surfaces opening at once fire ONE GET
let released;
getHandler = () => new Promise((res) => { released = () => res({ ok: true, status: 200, json: async () => ({ presets: [], synced: true }) }); });
getCalls = 0;
const r1 = reconcileUserParamPresets(), r2 = reconcileUserParamPresets();
must(r1 === r2, "C concurrent reconciles share one promise");
released();
await Promise.all([r1, r2]);
must(getCalls === 1, "C two opens, one GET", `${getCalls}`);

// ---------- D: the route's source census ----------
console.log("D route census:");
const route = readFileSync("src/app/api/param-presets/route.ts", "utf8");
must((route.match(/isLocalRequest/g) ?? []).length >= 4, "D both handlers speak the door (t709 law: born doored)", `${(route.match(/isLocalRequest/g) ?? []).length} mentions`);
must(route.includes('sanitizePresetShelf'), "D the door's mouth is the whitelist sanitizer, not ad-hoc checks");
must(route.includes("presetShelf.upsert") && !route.includes("deleteMany"), "D the shelf row is KEPT on empty — its existence is the synced flag (no resurrect-on-empty bug)");
must(route.includes('export const dynamic = "force-dynamic"'), "D the shelf never renders from cache");
const guard = readFileSync("src/lib/http-guard.ts", "utf8");
must(guard.length > 0, "D the guard module exists (door semantics pinned by t709-door-coverage on the live surface)");

console.log(`\n${PASS} pass / ${FAIL} fail`);
process.exit(FAIL > 0 ? 1 : 0);
