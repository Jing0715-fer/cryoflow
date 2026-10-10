// t713 — the user-parameter-presets unit probe: lib/user-param-presets.ts
// is the ONE home of the preset store's semantics, and this probe pins
// those semantics BEFORE the build-day e2e walks the real inspector.
//
// The module speaks to `window.localStorage` (t712's layer law: presets
// are a per-browser asset), so the probe installs a memory-backed window
// BEFORE the import — the same dialect the browser provides, minus the
// persistence.
//
//   A  snapshotSpecParams — the FULL-snapshot law (stored-else-default,
//      scalar gate, spec keys only).
//   B  countEffectiveDiffs — the effective-value law (a stored value equal
//      to the default is NOT a change; missing keys speak the default).
//   C  the store itself — round-trip, type gate, corruption tolerance,
//      delete hygiene, and the changed-event contract.
// t733 jiti codemod — Node ≥24 ESM no longer resolves extensionless
// imports; jiti (in-tree) loads the REAL lib for live-fire, with the
// project's @/ alias wired so lib-internal @/ imports resolve too.
// In-place (not hoisted): the probe's own execution order is law.
import { createJiti } from "jiti";
import * as __path from "node:path";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": __path.resolve(import.meta.dirname, "..", "src") },
});
const { snapshotSpecParams, countEffectiveDiffs, loadUserParamPresets, addUserParamPreset, deleteUserParamPreset, presetsForType, USER_PARAM_PRESETS_EVENT } = await __jiti.import("../src/lib/user-param-presets");

let PASS = 0, FAIL = 0, EVENTS = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

// ---------- the memory window ----------
const backing = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => backing.set(k, String(v)),
    removeItem: (k) => backing.delete(k),
  },
  dispatchEvent: () => { EVENTS += 1; },
};

const SPEC = [
  { key: "box", default: 512 },
  { key: "resMin", default: 30 },
  { key: "resMax", default: 5 },
  { key: "method", default: "CtfFind" },
  { key: "fast", default: false },
];

// ---------- A: the snapshot ----------
console.log("A snapshotSpecParams:");
const empty = snapshotSpecParams(SPEC, {});
must(empty.box === 512 && empty.resMin === 30 && empty.resMax === 5, "A empty stored → all defaults land", JSON.stringify(empty));
must(empty.method === "CtfFind" && empty.fast === false, "A string and boolean defaults land too");
const tuned = snapshotSpecParams(SPEC, { box: 256, resMax: 8, wildKey: "x", nested: { a: 1 } });
must(tuned.box === 256 && tuned.resMax === 8, "A stored scalars override defaults");
must(tuned.wildKey === undefined && tuned.nested === undefined, "A non-spec keys never join the snapshot");
must(tuned.resMin === 30, "A untouched keys fall back to the default");
const weird = snapshotSpecParams(SPEC, { box: null, resMin: [1, 2], method: { deep: true } });
must(weird.box === 512 && weird.resMin === 30 && weird.method === "CtfFind", "A null/array/object stored values degrade to defaults (scalar gate)");
must(Object.keys(empty).length === SPEC.length, "A snapshot is FULL — one key per spec param", `${Object.keys(empty).length}`);

// ---------- B: effective diffs ----------
console.log("B countEffectiveDiffs:");
const preset = { id: "p", type: "ctffind", name: "n", params: { box: 256, resMin: 30, resMax: 8, method: "CtfFind", fast: false }, createdAt: 0 };
must(countEffectiveDiffs(preset, SPEC, { box: 512, resMax: 5 }) === 2, "B stored-equals-default counts as unmoved (effective, not raw)", "box 512==512→same, resMin 30 default→same, only box/resMax move");
must(countEffectiveDiffs(preset, SPEC, {}) === 2, "B empty stored speaks defaults — resMax 8 vs 5 and box 256 vs 512");
must(countEffectiveDiffs(preset, SPEC, { box: 256, resMax: 8, resMin: 42 }) === 1, "B a stray stored resMin=42 still equals the preset's default-value key (30==30 default? no — stored 42 vs preset 30 MOVES)", "resMin 42→30 is the one true move");
must(countEffectiveDiffs({ ...preset, params: {} }, SPEC, {}) === 0, "B an empty preset moves nothing");

// ---------- C: the store ----------
console.log("C the preset store:");
must(loadUserParamPresets().length === 0, "C fresh browser — empty list");
const l1 = addUserParamPreset("ctffind", "My standard pass", preset.params);
must(l1.length === 1 && l1[0].type === "ctffind" && l1[0].name === "My standard pass", "C add returns the list with the preset in it");
must(l1[0].id.startsWith("upp-") && typeof l1[0].createdAt === "number", "C id minted, createdAt stamped");
addUserParamPreset("class2d", "K=8 deep pass", { K: 8, tau2_fudge: 1 });
addUserParamPreset("ctffind", "Fast screen", { box: 256, resMax: 8 });
const all = loadUserParamPresets();
must(all.length === 3, "C three adds, three rows", `${all.length}`);
must(presetsForType(all, "ctffind").length === 2 && presetsForType(all, "class2d").length === 1, "C the type gate filters honestly");
must(presetsForType(all, "refine3d").length === 0, "C a type with no presets answers empty");
must(EVENTS >= 3, "C every mutation fired the changed event", `${EVENTS} events`);
const evNameProbe = (() => { let captured = null; const orig = globalThis.window.dispatchEvent; globalThis.window.dispatchEvent = (e) => { captured = e?.type ?? e; return orig(e); }; addUserParamPreset("ctffind", "event probe", { box: 1 }); globalThis.window.dispatchEvent = orig; return captured; })();
must(evNameProbe === USER_PARAM_PRESETS_EVENT, "C the event carries the module's own event name", evNameProbe);

// delete hygiene
const afterDel = deleteUserParamPreset(all[0].id);
must(afterDel.length === 3, "C delete removes exactly the named row", `${all.length}→${afterDel.length}`);
must(!afterDel.some((p) => p.id === all[0].id), "C the deleted id is gone from the round-trip");
must(loadUserParamPresets().length === 4 - 1, "C localStorage and the returned list agree");
const ghost = deleteUserParamPreset("upp-never-existed");
must(ghost.length === afterDel.length, "C deleting a ghost id is a no-op, not an error");

// corruption tolerance — the convenience-store law
backing.set("cryoflow.user-param-presets:v1", "{not json at all");
must(loadUserParamPresets().length === 0, "C corrupted JSON degrades to empty, never throws");
backing.set("cryoflow.user-param-presets:v1", '{"a":1}');
must(loadUserParamPresets().length === 0, "C a non-array blob degrades to empty");
backing.set("cryoflow.user-param-presets:v1", JSON.stringify([null, 42, { type: "x" }, { id: "ok", type: "ctffind", name: "n", params: {}, createdAt: 1 }]));
const filtered = loadUserParamPresets();
must(filtered.length === 1 && filtered[0].id === "ok", "C foreign-shaped rows are filtered, the one honest row survives");

console.log(`\nt713 param-presets unit: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL === 0 ? 0 : 1);
