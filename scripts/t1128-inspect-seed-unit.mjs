#!/usr/bin/env node
/**
 * t1128 — the INSPECTOR-SEED unit: the session position's third seat.
 *
 * THE AUTOPSY (this unit's birth — the hollow-shell mystery, open since
 * t1127, solved this window): a Mol* ride died mid-walk — dialogs gone,
 * focus on body, recorder EMPTY, zero console errors, zero recompiles.
 * The v4 heartbeat recorder caught the killer by absence: the interval
 * itself stopped = the JS context died = the PAGE RELOADED
 * (performance.getEntriesByType('navigation') → type "reload"). The
 * reload's parent: the dev lane's watchdog fired the thin-host recycle
 * (rss 2.05GB ≥ soft 1.9GB — which sits BELOW the turbopack lane's born
 * weight ~2.0-2.3GB, so the RSS half of the arm is ALWAYS true at steady
 * state; the only gate left is the host avail dipping past 768MB, which
 * this memory-starved sandbox does routinely under browser+mock+compile
 * load) → pkill next-server → reboot → HMR reconnect → Next dev full-
 * reloads the tab → every dialog evaporates silently. The t1127
 * "[role=dialog] kids=0" hollow shell, the t1117 "~8s self-close", the
 * "radix dismissal" ghosts — one killer, the recycle's reload.
 *
 * THE CURE (what this unit pins):
 *  - the inspector joins the session-position family (t157 selection,
 *    t159 workspace): a localStorage seed (bare string, empty = the
 *    explicit close), echoed by the inspect() action on BOTH branches,
 *    applied ONCE per page load against the SAME filtered-list +
 *    jobInWorkspace trust gate the selection seed rides — so the reload
 *    reopens the inspector the tab closed with instead of orphaning the
 *    reader on the bare canvas;
 *  - the watchdog's kill lines SPEAK their consequence at the scene:
 *    the recycle arm and the zombie arm both confess "this kill
 *    full-reloads every open tab" — the next rider reads the reason in
 *    the log instead of re-deriving the mystery from silence.
 *
 *   node scripts/unit-runner.mjs scripts/t1128-inspect-seed-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log(`ok ${pass} - ${name}`);
  } else {
    fail++;
    console.log(`NOT OK ${fail} - ${name}`);
  }
};
const count = (hay, needle) => hay.split(needle).length - 1;

const store = readFileSync(path.join(ROOT, "src/lib/store.ts"), "utf8");
const watchdog = readFileSync(path.join(ROOT, "scripts/dev-server-watchdog.sh"), "utf8");

/* A band — the seed family's mint (the key, the readers, the echo) */
ok(count(store, 'INSPECT_JOB_KEY = "cryoflow.inspect.v1"') === 1, "A1 the seed's key is minted once, family-named cryoflow.inspect.v1");
ok(count(store, "function hydrateInspectJob(") === 1, "A2 the seed's reader exists (bare-string doctrine)");
ok(count(store, "function persistInspectJob(") === 1, "A3 the seed's echo exists (the two-way door)");
ok(
  store.includes('return trimmed === "" ? null : trimmed;') &&
    store.indexOf('return trimmed === "" ? null : trimmed;') < store.indexOf("const ACTIVE_WS_KEY"),
  "A4 the empty string is the honest closed (shared with the selection's reader)"
);
ok(
  (store.match(/window\.localStorage\.setItem\(INSPECT_JOB_KEY, id \?\? ""\)/g) ?? []).length === 1,
  "A5 the echo writes the honest none as the empty string, not a delete"
);

/* B band — the inspect() action echoes BOTH branches */
const inspectAction = store.slice(store.indexOf("  inspect: (id) => {"), store.indexOf("  // t569 — the return chip's click"));
ok(inspectAction.includes("persistInspectJob(id);"), "B1 the inspect() action echoes its transition to the seed");
ok(inspectAction.includes("set({ inspectId: id, selectedId: null, cameFromJob: null });") && inspectAction.includes("set({ inspectId: null, cameFromJob: null });"), "B2 both branches (open and close) precede the echo — the door speaks both ways");

/* C band — the apply: once per page load, the selection's own trust gate */
ok(count(store, "let inspectSeedApplied = false;") === 1, "C1 the seed applies ONCE per page load (the spent-seed law)");
const applyBlock = store.slice(store.indexOf("if (!inspectSeedApplied) {"), store.indexOf("// RELION status came from the SAVED detection"));
ok(applyBlock.includes("landedJobs.find((x) => x.id === inspectSeed && jobInWorkspace(x, activeWs))"), "C2 the trust gate is the canvas itself (filtered list + jobInWorkspace — the selection seed's own predicate)");
ok(applyBlock.includes("get().inspect(inspectJob.id);"), "C3 the apply rides the user-facing door (inspect()), not a raw set — semantics and echo stay the action's own");
const seedComment = store.includes("t1128 — the inspector seed") || store.includes("t1128 — the INSPECTOR is the session position's third seat");
ok(seedComment, "C4 the mint speaks its autopsy (the hollow-shell cure is written where the cure lives)");

/* D band — the watchdog confesses at the scene */
ok(
  (watchdog.match(/this kill full-reloads every open tab \(HMR reconnect\) — open dialogs evaporate silently \(t1128 hollow-shell autopsy\)/g) ?? []).length === 2,
  "D1 both kill arms (recycle fire + zombie) confess the reload consequence, exactly once each"
);
ok(watchdog.includes("recycle: this kill full-reloads"), "D2 the recycle arm's confession rides its own fire branch");
ok(watchdog.includes("zombie kill: this kill full-reloads"), "D3 the zombie arm's confession rides its own execute branch");
const fireBranch = watchdog.slice(watchdog.indexOf("recycle: ${decision} — thresholds"), watchdog.indexOf("      skip*)"));
ok(
  fireBranch.includes("recycle: this kill full-reloads") &&
    fireBranch.indexOf("recycle: this kill full-reloads") < fireBranch.indexOf("pkill -f \"next dev\""),
  "D4 the recycle confession sits between the verdict line and the kill — read at the scene, not after"
);

/* E band — the family's shape: three seats, one law */
ok(count(store, "Seed applied once per page load") === 0 && count(store, "SeedApplied = false") === 3, "E1 exactly three spent-seed flags — selection, workspace, inspector (the family's full roster)");
ok(
  store.indexOf("function hydrateSelectedJob") < store.indexOf("function hydrateInspectJob") &&
    store.indexOf("function hydrateInspectJob") < store.indexOf("function hydrateActiveWorkspace"),
  "E2 the reader trio sits in family order (selection → inspector → workspace)"
);

console.log(`\n${fail === 0 ? "ALL GREEN" : "RED"} — t1128 inspect-seed unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
