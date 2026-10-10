/**
 * t451 bench — the walk's inheritance: the claim law.
 *
 *   G1 (the claim law — one walk, one heir): no record → none; own
 *       record → own instantly (a reload reclaims itself, no wait);
 *       a stranger's FRESH heartbeat → elsewhere (a live owner is
 *       untouchable); a stranger's STALE heartbeat → adopted (owner
 *       rewritten, epoch bumped, heartbeat refreshed — adoption is
 *       just resurrection by another hand).
 *   G2 (owner-conditional writes): the zombie's clear, heartbeat and
 *       mirror save must all be REFUSED — a dispossessed walker never
 *       fights the heir's record back, and its exit never erases the
 *       claim.
 *   G3 (the legacy upgrade): a v1 session record imports as this tab's
 *       own v2 walk (owner = self, epoch 1) and the v1 key is gone;
 *       garbage v1 is cleared, not read.
 *   G4 (the shape guard): hand-edited or half-written v2 records read
 *       as no record — nothing invalid resurrects a walk.
 *   G5 (the sentences): the three tab laws each stay true in their own
 *       world (fresh promises reload AND closed-tab survival; resumed
 *       names the reload; inherited names the hand-off), the three are
 *       pairwise distinct, and the hand-off receipt speaks the neutral
 *       dialect (continues there — never the destructive tone).
 *   G6 (the tab identity): stable within a tab, unique across tabs —
 *       the claim law's "own vs stranger" depends on it.
 *   G7 (the constants): a stale threshold comfortably above the
 *       heartbeat — one throttled beat never hands a live walk over;
 *       the boundary lands on stale (>= STALE adopts).
 *   G8 (the claim's cargo): an adoption hands the resume the FULL plan
 *       — order, target, progress — the world-truth scan does the rest.
 *
 * World contract: the session module is client-gated, so the bench
 * installs a window shim with real-map localStorage + sessionStorage
 * BEFORE importing it — the claim law is exercised for real, minus the
 * browser. All time is injected (claimSubtreeOrch(now)) — no sleeps.
 */

import type { RemoteRunTarget } from "../src/lib/remote/types";
import type { StoredSubtreeOrch } from "../src/lib/subtree-orch-session";

/* ------------------------------------------------------------------ */
/* the window shim — installed before the session module is imported   */
/* ------------------------------------------------------------------ */

function mkStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => {
      map.clear();
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

let ls = mkStorage();
let ss = mkStorage();

(globalThis as Record<string, unknown>).window = {
  localStorage: ls,
  sessionStorage: ss,
} as unknown as Window & typeof globalThis;

const { ORCH_HB_MS, ORCH_STALE_MS, ORCH_RECORD_KEY, claimSubtreeOrch, clearSubtreeOrch, heartbeatSubtreeOrch, importLegacySubtreeOrch, readSubtreeOrch, saveSubtreeOrch, saveSubtreeOrchIfOwner } = await import(
  "../src/lib/subtree-orch-session"
);
const { getTabId } = await import("../src/lib/tab-identity");
const {
  ORCH_TAB_LAW,
  ORCH_TAB_LAW_INHERITED,
  ORCH_TAB_LAW_RESUMED,
  handoffReceiptSentence,
  resumeScan,
} = await import("../src/lib/subtree-run");

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL ${label}`);
  }
}
function freshWorld(): void {
  ls = mkStorage();
  ss = mkStorage();
  (globalThis as Record<string, unknown>).window = {
    localStorage: ls,
    sessionStorage: ss,
  } as unknown as Window & typeof globalThis;
}

const ORDER = [
  { id: "job-a", name: "Motion Correction 1" },
  { id: "job-b", name: "CTF Estimation 1" },
];
const TARGET = {
  connectionId: "conn-1",
  mode: "slurm",
  module: "relion",
  gpus: 0,
} as unknown as RemoteRunTarget;

const ORCH = {
  rootId: "job-a",
  rootName: "Motion Correction 1",
  order: ORDER,
  index: 1,
  stopRequested: false,
};

function seedRecord(owner: string, hb: number, epoch = 1): void {
  const rec: StoredSubtreeOrch = { orch: ORCH, target: TARGET, owner, hb, epoch };
  ls.setItem(ORCH_RECORD_KEY, JSON.stringify(rec));
}
function storedRaw(): StoredSubtreeOrch | null {
  const raw = ls.getItem(ORCH_RECORD_KEY);
  return raw ? (JSON.parse(raw) as StoredSubtreeOrch) : null;
}

/* ------------------------------------------------------------------ */
/* G1 — the claim law                                                  */
/* ------------------------------------------------------------------ */

console.log("G1 — the claim law (one walk, one heir)");
{
  freshWorld();
  getTabId();
  const r = claimSubtreeOrch(1000);
  must(r.mode === "none" && r.saved === null, "G1.1 no record → none");
}
{
  freshWorld();
  const self = getTabId();
  seedRecord(self, 1000, 3);
  const r = claimSubtreeOrch(1000 + 99_999);
  must(r.mode === "own", "G1.2 own record → own even when the heartbeat is ancient");
  must(r.saved?.owner === self && r.saved?.epoch === 3, "G1.2b own keeps owner and epoch");
  must(storedRaw()?.hb === 1000, "G1.2c own claim writes nothing (heartbeat untouched)");
}
{
  freshWorld();
  getTabId();
  seedRecord("tab-owner", 1000, 1);
  const r = claimSubtreeOrch(1000 + ORCH_STALE_MS - 1);
  must(r.mode === "elsewhere", "G1.3 a stranger's fresh heartbeat → elsewhere");
  must(storedRaw()?.owner === "tab-owner", "G1.3b elsewhere leaves the record alone");
}
{
  freshWorld();
  getTabId();
  seedRecord("tab-owner", 1000, 1);
  const now = 1000 + ORCH_STALE_MS;
  const r = claimSubtreeOrch(now);
  must(r.mode === "adopted", "G1.4 a stranger's stale heartbeat → adopted (at the boundary)");
  must(r.saved?.owner === getTabId(), "G1.4b adoption rewrites the owner to self");
  must(storedRaw()?.owner === getTabId(), "G1.4c the claim lands in storage");
}
{
  freshWorld();
  getTabId();
  seedRecord("tab-owner", 1000, 5);
  const now = 1000 + ORCH_STALE_MS + 500;
  const r = claimSubtreeOrch(now);
  must(r.saved?.epoch === 6, "G1.5 adoption bumps the epoch");
  must(r.saved?.hb === now, "G1.6 adoption refreshes the heartbeat to the claim instant");
}

/* ------------------------------------------------------------------ */
/* G2 — owner-conditional writes                                       */
/* ------------------------------------------------------------------ */

console.log("G2 — owner-conditional writes (the zombie never fights back)");
{
  freshWorld();
  getTabId();
  seedRecord("tab-owner", 1000, 2);
  const ok = clearSubtreeOrch();
  must(ok === false && storedRaw()?.owner === "tab-owner", "G2.1 a stranger's clear is refused — the heir's claim survives");
}
{
  freshWorld();
  const self = getTabId();
  seedRecord(self, 1000, 2);
  const ok = clearSubtreeOrch();
  must(ok === true && storedRaw() === null, "G2.2 the owner's clear retires the record");
}
{
  freshWorld();
  getTabId();
  seedRecord("tab-owner", 1000, 2);
  const ok = heartbeatSubtreeOrch();
  must(ok === false && storedRaw()?.hb === 1000, "G2.3 a stranger's heartbeat is refused (no freshening a stranger's claim)");
}
{
  freshWorld();
  const self = getTabId();
  seedRecord(self, 1000, 2);
  const ok = heartbeatSubtreeOrch();
  const rec = storedRaw();
  must(ok === true && typeof rec?.hb === "number" && rec.hb > 1000, "G2.4 the owner's heartbeat lands");
  must(rec?.epoch === 2 && rec?.owner === self, "G2.4b the heartbeat moves nothing but the beat");
}
{
  freshWorld();
  getTabId();
  seedRecord("tab-owner", 1000, 2);
  const ok = saveSubtreeOrchIfOwner({ ...ORCH, index: 2 }, TARGET);
  must(ok === false && storedRaw()?.orch.index === 1, "G2.5 a dispossessed walker's mirror save is refused");
}
{
  freshWorld();
  const self = getTabId();
  seedRecord(self, 1000, 2);
  const ok = saveSubtreeOrchIfOwner({ ...ORCH, index: 2 }, TARGET);
  const rec = storedRaw();
  must(ok === true && rec?.orch.index === 2, "G2.6 the owner's mirror save lands");
  must(rec?.owner === self && rec?.target !== null && (rec.target as { connectionId?: string }).connectionId === "conn-1", "G2.6b the mirror save preserves owner and target");
}
{
  freshWorld();
  getTabId();
  saveSubtreeOrch(ORCH, TARGET);
  const rec = storedRaw();
  must(rec?.owner === getTabId() && rec?.epoch === 1, "G2.7 a fresh save claims with epoch 1");
  seedRecord(getTabId(), Date.now(), 7);
  saveSubtreeOrch({ ...ORCH, index: 2 }, TARGET);
  must(storedRaw()?.epoch === 7, "G2.7b the owner's re-save preserves the epoch");
}

/* ------------------------------------------------------------------ */
/* G3 — the legacy upgrade                                             */
/* ------------------------------------------------------------------ */

console.log("G3 — the legacy upgrade (v1 session → v2 workspace record)");
{
  freshWorld();
  const self = getTabId();
  const v1 = { orch: ORCH, target: TARGET, savedAt: 1234 };
  ss.setItem("cryoflow.subtreeOrch.v1", JSON.stringify(v1));
  importLegacySubtreeOrch();
  const rec = storedRaw();
  must(rec !== null && rec?.owner === self, "G3.1 the v1 record imports as this tab's own walk");
  must(rec?.epoch === 1 && rec?.orch.rootId === "job-a", "G3.1b the import carries the plan with a fresh epoch");
  must(ss.getItem("cryoflow.subtreeOrch.v1") === null, "G3.2 the v1 key is gone after the upgrade");
}
{
  freshWorld();
  getTabId();
  ss.setItem("cryoflow.subtreeOrch.v1", "{not json");
  importLegacySubtreeOrch();
  must(storedRaw() === null && ss.getItem("cryoflow.subtreeOrch.v1") === null, "G3.3 garbage v1 is cleared, never read into a walk");
}

/* ------------------------------------------------------------------ */
/* G4 — the shape guard                                                */
/* ------------------------------------------------------------------ */

console.log("G4 — the shape guard (invalid records are no records)");
{
  freshWorld();
  getTabId();
  ls.setItem(ORCH_RECORD_KEY, "{broken");
  must(readSubtreeOrch() === null, "G4.1 unparseable JSON → null");
}
{
  freshWorld();
  getTabId();
  seedRecord("tab-owner", 1000);
  const rec = storedRaw() as StoredSubtreeOrch;
  delete (rec as unknown as Record<string, unknown>).owner;
  ls.setItem(ORCH_RECORD_KEY, JSON.stringify(rec));
  must(readSubtreeOrch() === null, "G4.2 a record without an owner is not a record");
}
{
  freshWorld();
  getTabId();
  seedRecord("tab-owner", 1000);
  const rec = storedRaw() as StoredSubtreeOrch;
  rec.epoch = 0;
  ls.setItem(ORCH_RECORD_KEY, JSON.stringify(rec));
  must(readSubtreeOrch() === null, "G4.3 an epoch below 1 is not a record");
}
{
  freshWorld();
  getTabId();
  seedRecord("tab-owner", 1000, 4);
  const read = readSubtreeOrch();
  must(
    read !== null && read?.orch.index === 1 && read?.epoch === 4 && read?.target !== null,
    "G4.4 a valid record round-trips (plan, epoch, target)"
  );
}

/* ------------------------------------------------------------------ */
/* G5 — the sentences                                                  */
/* ------------------------------------------------------------------ */

console.log("G5 — the sentences (three laws, three worlds, all true)");
{
  must(
    ORCH_TAB_LAW.includes("reload") &&
      ORCH_TAB_LAW.includes("closed tab") &&
      ORCH_TAB_LAW.includes("another tab"),
    "G5.1 the fresh law promises reload AND closed-tab survival via another tab"
  );
  must(
    ORCH_TAB_LAW_RESUMED.includes("Resumed after a reload") &&
      ORCH_TAB_LAW_RESUMED.includes("across tabs"),
    "G5.2 the resumed law names the reload and the new reach"
  );
  must(
    ORCH_TAB_LAW_INHERITED.includes("another tab") &&
      ORCH_TAB_LAW_INHERITED.includes("continues here"),
    "G5.3 the inherited law names the hand-off and the continuation"
  );
  const laws = [ORCH_TAB_LAW, ORCH_TAB_LAW_RESUMED, ORCH_TAB_LAW_INHERITED];
  must(
    new Set(laws).size === 3,
    "G5.4 the three laws are pairwise distinct (a face cannot wear two truths)"
  );
  const h = handoffReceiptSentence();
  must(
    h.includes("Another tab") && h.includes("continues there") && h.includes("stands down"),
    "G5.5 the hand-off receipt speaks the neutral dialect (the walk continues — nothing failed)"
  );
}

/* ------------------------------------------------------------------ */
/* G6 — the tab identity                                               */
/* ------------------------------------------------------------------ */

console.log("G6 — the tab identity (own vs stranger depends on it)");
{
  freshWorld();
  const a1 = getTabId();
  const a2 = getTabId();
  must(a1 === a2 && a1.length > 0, "G6.1 stable within a tab (and non-empty)");
  must(ss.getItem("cryoflow.tabId.v1") === a1, "G6.2 the id persists in sessionStorage (a reload reclaims)");
}
{
  freshWorld();
  const tabA = getTabId();
  // a second tab: its own sessionStorage, shared localStorage — swap the shim
  const lsB = ls; // same workspace memory
  ss = mkStorage();
  (globalThis as Record<string, unknown>).window = {
    localStorage: lsB,
    sessionStorage: ss,
  } as unknown as Window & typeof globalThis;
  const tabB = getTabId();
  must(tabA !== tabB, "G6.3 a sibling tab is a stranger (unique ids)");
}

/* ------------------------------------------------------------------ */
/* G7 — the constants                                                  */
/* ------------------------------------------------------------------ */

console.log("G7 — the constants (one missed beat never hands a walk over)");
{
  must(ORCH_STALE_MS > ORCH_HB_MS * 2, "G7.1 stale > two beats (throttle-safe)");
  must(ORCH_HB_MS >= 1000 && ORCH_STALE_MS <= 60_000, "G7.2 the pulse is human-scale (seconds, not minutes)");
}

/* ------------------------------------------------------------------ */
/* G8 — the claim's cargo                                              */
/* ------------------------------------------------------------------ */

console.log("G8 — the claim's cargo (adoption hands over the FULL plan)");
{
  freshWorld();
  getTabId();
  seedRecord("tab-owner", 1000, 3);
  const now = 1000 + ORCH_STALE_MS + 5;
  const r = claimSubtreeOrch(now);
  must(
    r.mode === "adopted" &&
      r.saved?.orch.order.length === 2 &&
      r.saved?.orch.order[1]?.id === "job-b" &&
      r.saved?.orch.index === 1 &&
      r.saved?.target !== null,
    "G8.1 the adopter receives order, progress and the cluster target intact"
  );
}

/* ------------------------------------------------------------------ */
/* G9 — the walkStart law (a pre-walk result is not a landing)         */
/* ------------------------------------------------------------------ */

console.log("G9 — the walkStart law (caught live: the allLanded short-circuit)");
{
  // the live-fire scenario: M re-ran and landed INSIDE the walk; C's
  // completion predates the walk (a previous run's output)
  const WALK_START = 1_000_000;
  const jobs = [
    { id: "job-a", name: "M", status: "completed", startedAt: new Date(WALK_START + 2_000).toISOString() },
    { id: "job-b", name: "C", status: "completed", startedAt: new Date(WALK_START - 90_000).toISOString() },
  ];
  const scan = resumeScan(ORDER, jobs, { walkStart: WALK_START });
  must(scan.done === 1, "G9.1 the walk's own landing counts (M, started after the first breath)");
  must(
    scan.resumeNode?.id === "job-b" && !scan.allLanded,
    "G9.2 a pre-walk completion is NOT a landing — the walk must re-run it (C)"
  );
  must(scan.resumeInflight === false, "G9.3 a pre-walk-completed resume node is dispatched, not awaited");
}
{
  const WALK_START = 1_000_000;
  const jobs = [
    { id: "job-a", name: "M", status: "completed", startedAt: new Date(WALK_START - 90_000).toISOString() },
    { id: "job-b", name: "C", status: "completed", startedAt: new Date(WALK_START - 80_000).toISOString() },
  ];
  const scan = resumeScan(ORDER, jobs, { walkStart: WALK_START });
  must(scan.done === 0 && scan.resumeNode?.id === "job-a" && !scan.allLanded, "G9.4 an all-pre-walk world dispatches from the head (never allLanded)");
}
{
  const WALK_START = 1_000_000;
  const jobs = [
    { id: "job-a", name: "M", status: "completed", startedAt: new Date(WALK_START - 4_000).toISOString() },
    { id: "job-b", name: "C", status: "completed", startedAt: new Date(WALK_START + 50_000).toISOString() },
  ];
  const scan = resumeScan(ORDER, jobs, { walkStart: WALK_START });
  must(scan.done === 2 && scan.allLanded, "G9.5 the 5s grace keeps the walk's own first landing counted (dispatch-gap safe)");
}
{
  const WALK_START = 1_000_000;
  const jobs = [
    { id: "job-a", name: "M", status: "completed", startedAt: null },
    { id: "job-b", name: "C", status: "completed", startedAt: new Date(WALK_START + 1_000).toISOString() },
  ];
  const scan = resumeScan(ORDER, jobs, { walkStart: WALK_START });
  must(scan.done === 0 && scan.resumeNode?.id === "job-a", "G9.6 no startedAt witness → not this walk's landing (honest unknown)");
}
{
  const jobs = [
    { id: "job-a", name: "M", status: "completed", startedAt: new Date(1_000).toISOString() },
    { id: "job-b", name: "C", status: "completed", startedAt: new Date(2_000).toISOString() },
  ];
  const scan = resumeScan(ORDER, jobs);
  must(scan.done === 2 && scan.allLanded, "G9.7 legacy records (no walkStart) keep the t450 semantics");
}

/* ------------------------------------------------------------------ */

console.log(`\nt451 orch-inheritance bench: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
