#!/usr/bin/env node
/**
 * t1133 — the WORLD VITALS unit: the health board's one father.
 *
 * THE FEATURE (the t1133 script's candidate #1, third window on the
 * bench): the world gate's three numbers (jobs · edges · completed)
 * learn a MEMORY — the transition ledger — and the engine's vitals
 * learn a FACE — the health board dialog, opened from the footer.
 *
 *   • the ledger writes TRANSITIONS, not heartbeats: appendWorldSnapshot
 *     dedupes unchanged worlds and returns the SAME reference, so the
 *     store's poll ticks and hover storms cost the board nothing.
 *   • the board counts the SAME numbers the footer counts
 *     (useActiveWorkspaceJobs + s.edges) — a board that disagreed with
 *     the footer beside it would be a lie with a dialog.
 *   • NO listeners: sampling rides the store's own render wave. No
 *     window.addEventListener, no store.subscribe — the stale-listener
 *     law (t1131's cure, t1132's sweep) is held by ABSENCE, and the
 *     F-band pins that absence so it cannot rot back.
 *   • ONE father: every derived word (vitals, bars, rows, ledger text,
 *     age words) comes from lib/world-vitals. The dialog formats nothing.
 *   • honest faces: the flat timeline says "no transitions yet"; a
 *     not-yet-arrived engine status says so; zeros that are GOOD news
 *     still speak (a dashboard is not a filter — presence-derived is
 *     the census's law, not the board's).
 *   • the copy chip law (the ⧉ sibling): three-state flip, the 1600ms
 *     breath, the double guard, the retirement on close/unmount.
 *
 *   node --import ./scripts/ts-alias-register.mjs scripts/t1133-world-vitals-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  WORLD_LEDGER_CAP,
  WORLD_LEDGER_STORAGE_KEY,
  WORLD_LEDGER_STORAGE_VERSION,
  worldVitalsOf,
  snapshotOf,
  sameWorld,
  appendWorldSnapshot,
  worldTimelineBars,
  worldHealthRows,
  worldLedgerText,
  worldAgeWords,
  clockWordsOf,
  isWorldSnapshotShape,
  readWorldLedgerStorage,
  writeWorldLedgerStorage,
} from "@/lib/world-vitals";

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const ROOT = process.cwd();

/* ==================================================================
 * A — the vitals census (the five words + the universe)
 * ================================================================== */
{
  const v = worldVitalsOf(
    [
      { status: "running" },
      { status: "completed" },
      { status: "completed" },
      { status: "failed" },
      { status: "pending" },
      { status: "idle" },
    ],
    [{ id: "e1" }, { id: "e2" }, { id: "e3" }],
  );
  ok("A1 jobs is the universe", v.jobs === 6, String(v.jobs));
  ok("A2 edges counted", v.edges === 3, String(v.edges));
  ok("A3 running", v.running === 1);
  ok("A4 completed", v.completed === 2);
  ok("A5 failed", v.failed === 1);
  ok("A6 pending", v.pending === 1);
  ok("A7 idle", v.idle === 1);

  const empty = worldVitalsOf([], []);
  ok("A8 the empty world zeros honestly", empty.jobs === 0 && empty.edges === 0 && empty.running === 0 && empty.completed === 0 && empty.failed === 0 && empty.pending === 0 && empty.idle === 0, JSON.stringify(empty));

  const alien = worldVitalsOf([{ status: "quantum" }], []);
  ok("A9 a future status still counts toward the universe", alien.jobs === 1 && alien.running + alien.completed + alien.failed + alien.pending + alien.idle === 0, JSON.stringify(alien));
}

/* ==================================================================
 * B — snapshots, sameness, the pure reducer
 * ================================================================== */
{
  const v = worldVitalsOf([{ status: "running" }, { status: "completed" }], [{ id: "e" }]);
  const s1 = snapshotOf(v, 1000);
  ok("B1 the snapshot carries the five health-bearing numbers", s1.t === 1000 && s1.jobs === 2 && s1.edges === 1 && s1.running === 1 && s1.completed === 1 && s1.failed === 0, JSON.stringify(s1));
  const s2 = snapshotOf(v, 2000);
  ok("B2 sameWorld ignores the stamp (the WHAT, not the WHEN)", sameWorld(s1, s2));
  const s3 = { ...s1, completed: 2 };
  ok("B3 a changed number is a changed world", !sameWorld(s1, s3));

  const h0 = [];
  const seeded = appendWorldSnapshot(h0, s1);
  ok("B4 the seed lands in an empty ledger", seeded.length === 1 && seeded[0] === s1);
  const again = appendWorldSnapshot(seeded, s2);
  ok("B5 an unchanged world returns the SAME reference (no re-render, no growth)", again === seeded);
  const moved = appendWorldSnapshot(again, s3);
  ok("B6 a transition appends exactly one sample", moved.length === 2 && moved[1] === s3);
  ok("B7 the input array is never mutated", seeded.length === 1);

  // the cap: 240 standing; the oldest steps off the front
  let h = [];
  for (let i = 0; i < WORLD_LEDGER_CAP + 30; i += 1) {
    h = appendWorldSnapshot(h, { t: i, jobs: i + 1, edges: 0, running: 0, completed: 0, failed: 0 });
  }
  ok(`B8 the ledger caps at ${WORLD_LEDGER_CAP}`, h.length === WORLD_LEDGER_CAP, String(h.length));
  ok("B9 the cap keeps the NEWEST world (the oldest stepped off)", h[h.length - 1].jobs === WORLD_LEDGER_CAP + 30 && h[0].jobs === 31, `${h[0].jobs}..${h[h.length - 1].jobs}`);
  const custom = appendWorldSnapshot([], s1, 1);
  const custom2 = appendWorldSnapshot(custom, s3, 1);
  ok("B10 the cap is a parameter (the law, not a magic number)", custom2.length === 1 && custom2[0] === s3);
}

/* ==================================================================
 * C — the timeline's layout (bars, floor ticks, titles)
 * ================================================================== */
{
  const empty = worldTimelineBars([]);
  ok("C1 the empty ledger is flat with no bars", empty.flat && empty.bars.length === 0);
  const one = worldTimelineBars([{ t: 0, jobs: 5, edges: 2, running: 0, completed: 5, failed: 0 }]);
  ok("C2 ONE world is flat — a single bar would be a movement lie", one.flat && one.bars.length === 1);

  const hist = [
    { t: 0, jobs: 4, edges: 3, running: 1, completed: 2, failed: 0 },
    { t: 1000, jobs: 0, edges: 0, running: 0, completed: 0, failed: 0 },
    { t: 2000, jobs: 8, edges: 7, running: 0, completed: 8, failed: 1 },
  ];
  const lay = worldTimelineBars(hist);
  ok("C3 three distinct worlds are NOT flat", !lay.flat && lay.bars.length === 3);
  ok("C4 max reads the tallest world", lay.max === 8);
  ok("C5 the tallest bar reaches the band", Math.abs(lay.bars[2].h - 28) < 1e-9, String(lay.bars[2].h));
  ok("C6 the zero world still draws its floor tick (3 units)", Math.abs(lay.bars[1].h - 3) < 1e-9, String(lay.bars[1].h));
  ok("C7 the mid world scales linearly (3 + 4/8·25)", Math.abs(lay.bars[0].h - 15.5) < 1e-9, String(lay.bars[0].h));
  ok("C8 x spreads monotonically across the width", lay.bars[0].x < lay.bars[1].x && lay.bars[1].x < lay.bars[2].x);
  ok("C9 every bar keeps its width slot minus the gap", lay.bars.every((b) => b.w === 100 / 3 - 1), String(lay.bars[0].w));
  ok("C10 the title speaks the five-number sentence", lay.bars[2].title.includes("8 jobs") && lay.bars[2].title.includes("7 edges") && lay.bars[2].title.includes("1 running") === false && lay.bars[2].title.includes("0 running") && lay.bars[2].title.includes("1 failed"), lay.bars[2].title);

  const custom = worldTimelineBars(hist, 60, 20);
  ok("C11 width and band are parameters", custom.bars[2].h === 20 && Math.abs(custom.bars[2].x - 2 * (60 / 3)) < 1e-9, JSON.stringify(custom.bars[2]));

  const noon = new Date(2026, 10, 1, 14, 5, 9).getTime();
  ok("C12 clockWordsOf pads the 24h clock", clockWordsOf(noon) === "14:05:09", clockWordsOf(noon));
  ok("C13 a non-finite stamp answers the honest dash face", clockWordsOf(Number.NaN) === "--:--:--", clockWordsOf(Number.NaN));
}

/* ==================================================================
 * D — the verdicts (engine, tools, failures, pipeline)
 * ================================================================== */
{
  const v0 = worldVitalsOf([], []);
  const rowsNull = worldHealthRows(v0, null);
  ok("D1 a not-yet-arrived engine status says so (never a fabricated green)", rowsNull[0].key === "engine" && !rowsNull[0].ok && rowsNull[0].detail.includes("hasn't arrived"), rowsNull[0]?.detail);
  const v1 = worldVitalsOf([{ status: "idle" }, { status: "idle" }], []);
  const rowsLost = worldHealthRows(v1, { found: false });
  ok("D2 a missing install points at Settings", rowsLost[0].key === "engine" && !rowsLost[0].ok && rowsLost[0].detail.includes("Settings"), rowsLost[0].detail);

  const sysBase = {
    found: true,
    execution: "native",
    version: "5.0.0",
    binaries: [
      { name: "relion_refine", present: true },
      { name: "relion_autopick", present: true },
    ],
    externals: [{ name: "topaz", present: true }],
  };
  const rowsOk = worldHealthRows(worldVitalsOf([{ status: "completed" }], [{ id: "e" }]), sysBase);
  const engine = rowsOk.find((r) => r.key === "engine");
  ok("D3 a found engine speaks version + bridge", !!engine && engine.ok && engine.detail.includes("RELION 5.0.0") && engine.detail.includes("native"), engine?.detail);
  ok("D4 all-present binaries are an ok row", rowsOk.some((r) => r.key === "binaries" && r.ok && r.detail === "all 2 present"), JSON.stringify(rowsOk.find((r) => r.key === "binaries")));
  ok("D5 all-present externals are an ok row", rowsOk.some((r) => r.key === "externals" && r.ok));
  ok("D6 zero failures is GOOD news that still speaks", rowsOk.some((r) => r.key === "failures" && r.ok && r.detail.includes("no failed jobs")));
  ok("D7 a wired pipeline is an ok row with the numbers", rowsOk.some((r) => r.key === "pipeline" && r.ok && r.detail.includes("1 edges wire 1 jobs")), JSON.stringify(rowsOk.find((r) => r.key === "pipeline")));

  const wsl = { ...sysBase, execution: "wsl", fromCache: true };
  const rowsWsl = worldHealthRows(v0, wsl);
  ok("D8 the WSL bridge wears its own words + the cached-probe note", rowsWsl[0].detail.includes("WSL bridge") && rowsWsl[0].detail.includes("cached probe"), rowsWsl[0].detail);

  const partial = {
    ...sysBase,
    binaries: [
      { name: "relion_refine", present: true },
      { name: "relion_autopick", present: false },
      { name: "relion_mask_create", present: false },
      { name: "relion_postprocess", present: false },
      { name: "relion_import", present: false },
    ],
  };
  const rowsPartial = worldHealthRows(v0, partial);
  const bin = rowsPartial.find((r) => r.key === "binaries");
  ok("D9 partial binaries warn with the missing names, truncated at three with …", !!bin && !bin.ok && bin.detail.includes("1/5") && bin.detail.includes("relion_autopick, relion_mask_create, relion_postprocess…"), bin?.detail);

  const failV = worldVitalsOf([{ status: "failed" }, { status: "failed" }], []);
  const rowsFail = worldHealthRows(failV, sysBase);
  const fails = rowsFail.find((r) => r.key === "failures");
  ok("D10 failures warn and point at the footer's red chip", !!fails && !fails.ok && fails.detail.includes("2 failed jobs") && fails.detail.includes("footer"), fails?.detail);

  const unwired = worldHealthRows(worldVitalsOf([{ status: "idle" }, { status: "idle" }, { status: "idle" }], []), sysBase);
  ok("D11 many jobs but no wires is the pipeline's warn", unwired.some((r) => r.key === "pipeline" && !r.ok && r.detail.includes("3 jobs but no connections")));
  const single = worldHealthRows(worldVitalsOf([{ status: "idle" }], []), sysBase);
  ok("D12 a single job needs no wires — honestly ok", single.some((r) => r.key === "pipeline" && r.ok && r.detail.includes("single job needs no wires")));
  const blank = worldHealthRows(v0, sysBase);
  ok("D13 an empty canvas is honestly ok, not a warn", blank.some((r) => r.key === "pipeline" && r.ok && r.detail.includes("empty canvas")));

  const absent = { ...sysBase, externals: undefined };
  const rowsAbsent = worldHealthRows(v0, absent);
  ok("D14 an absent tool word keeps its row SILENT (never invented)", !rowsAbsent.some((r) => r.key === "externals"));
}

/* ==================================================================
 * E — the ledger's words (the ⧉ chip's one father)
 * ================================================================== */
{
  ok("E1 the young ledger speaks its honest empty face", worldLedgerText([]).includes("no transitions since this page loaded") && worldLedgerText([]).startsWith("world ledger —"));
  const one = [{ t: 0, jobs: 3, edges: 2, running: 0, completed: 3, failed: 0 }];
  ok("E2 ONE sample is the same lie as zero — the flat face covers it", worldLedgerText(one).includes("no transitions"));
  const hist = [
    { t: new Date(2026, 10, 1, 9, 0, 5).getTime(), jobs: 3, edges: 2, running: 1, completed: 2, failed: 0 },
    { t: new Date(2026, 10, 1, 9, 0, 7).getTime(), jobs: 4, edges: 3, running: 1, completed: 2, failed: 0 },
    { t: new Date(2026, 10, 1, 9, 0, 9).getTime(), jobs: 4, edges: 3, running: 0, completed: 3, failed: 0 },
  ];
  const text = worldLedgerText(hist);
  const lines = text.split("\n");
  ok("E3 the header counts the TRANSITIONS (samples − 1)", lines[0] === "world ledger — 2 transitions (oldest first)", lines[0]);
  ok("E4 each line is the five-number sentence with the 24h clock", lines[1] === "09:00:05  jobs=3 edges=2 completed=2 running=1 failed=0", lines[1]);
  ok("E5 the newest line last (oldest first, stable order)", lines[3] === "09:00:09  jobs=4 edges=3 completed=3 running=0 failed=0", lines[3]);
  ok("E6 age words ride the elapsed father's dialect", worldAgeWords(42_000) === "42s" && worldAgeWords(0) === "0s" && worldAgeWords(Number.NaN) === "0s", worldAgeWords(42_000));
}

/* ==================================================================
 * F — the source pins (the family laws, visible in the files)
 * ================================================================== */
{
  const lib = readFileSync(path.join(ROOT, "src/lib/world-vitals.ts"), "utf8");
  ok("F1 the lib is pure — no React", !lib.includes("react"));
  ok("F2 the lib imports no store (the father carries no state)", !lib.includes("@/lib/store"));
  ok("F3 the cap is 240 and named", lib.includes("export const WORLD_LEDGER_CAP = 240"));
  ok("F4 durations ride the elapsed father (no second formatter)", lib.includes('from "./elapsed"') && !lib.includes("Math.round(ms / 1000)"));

  const dlg = readFileSync(path.join(ROOT, "src/components/workflow/world-health-dialog.tsx"), "utf8");
  ok("F5 the board binds the ONE father", dlg.includes('from "@/lib/world-vitals"'));
  ok("F6 the vocabulary is borrowed, not reinvented", dlg.includes('from "@/lib/status-style"'));
  ok("F7 the stale-listener law held by ABSENCE — no window listeners", !dlg.includes("addEventListener"));
  ok("F8 no store.subscribe either (sampling rides the render wave)", !dlg.includes("subscribe("));
  ok("F9 the stamp lands at commit time, exactly once", (dlg.match(/Date\.now\(\)/g) ?? []).length === 1, String((dlg.match(/Date\.now\(\)/g) ?? []).length));
  ok("F10 the copy chip's breath is the family's 1600", dlg.includes("const COPY_BREATH_MS = 1600"));
  ok("F11 three faces on the copy chip", dlg.includes('"copied"') && dlg.includes('"refused"') && dlg.includes('"idle"'));
  ok("F12 the zero-bare law — the shadcn Button base only", !dlg.includes("<button"));
  ok("F13 the idle-world-pays-zero-timers law rides useNow", dlg.includes('from "@/lib/use-now"') && dlg.includes("useNow(open &&"));
  ok("F14 the trigger's door has its testid + aria name", dlg.includes('data-testid="world-health-trigger"') && dlg.includes('aria-label="Open the world health board'));
  ok("F15 the dialog, vitals, rows, timeline and copy all wear their testids", ["world-health-dialog", "world-health-vitals", "world-health-rows", "world-health-timeline", "world-health-copy"].every((t) => dlg.includes(`data-testid="${t}"`)));
  ok("F16 the strip is a named image (role=img + aria summary)", dlg.includes('role="img"') && dlg.includes("aria-label={ariaSummary}"));
  ok("F17 the flat face exists (the honest no-movement placeholder)", dlg.includes("world-health-timeline-flat") && dlg.includes("no transitions yet"));
  ok("F18 the board renders all five words always (a dashboard is not a filter)", dlg.includes("VITAL_ORDER.map") && !dlg.includes(".filter("));

  const footer = readFileSync(path.join(ROOT, "src/components/workflow/footer.tsx"), "utf8");
  ok("F19 the footer opens the world's own door, exactly once", (footer.match(/<WorldHealthBoard \/>/g) ?? []).length === 1);
  ok("F20 the door sits beside the numbers it remembers", footer.indexOf("jobs.length} {jobs.length === 1 ? \"job\" : \"jobs\"}") < footer.indexOf("<WorldHealthBoard />"));
  ok("F21 the seed waits for the world's first READ (the jobsVersion gate — the t1132 first-screen phantom law)", dlg.includes("jobsVersion === null") && dlg.includes("The seed waits for the read"), "the pre-hydration 0-world must never seed the ledger");
}

/* ----------------------------------------------------------------------
 * G — the ledger's persistence layer (t1135): the world's memory outlives
 * the page. sessionStorage — the tab's own story; versioned, shape-gated,
 * quota-guarded; the lib stays pure (the store is a parameter, the tests
 * construct a fake).
 * ---------------------------------------------------------------------- */

const G_ROWS = () => [
  { t: 1000, jobs: 15, edges: 14, running: 0, completed: 15, failed: 0 },
  { t: 6000, jobs: 16, edges: 14, running: 1, completed: 15, failed: 0 },
  { t: 9000, jobs: 16, edges: 15, running: 0, completed: 16, failed: 0 },
];
function fakeStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      m.set(k, String(v));
    },
  };
}
function throwingStore() {
  return {
    getItem: () => {
      throw new Error("quota");
    },
    setItem: () => {
      throw new Error("quota");
    },
  };
}

ok(
  "G1 the envelope has its own name and version",
  WORLD_LEDGER_STORAGE_KEY === "cryoflow.world-ledger.v1" && WORLD_LEDGER_STORAGE_VERSION === 1,
);
ok("G2 a null store restores absence (the SSR face)", JSON.stringify(readWorldLedgerStorage(null)) === "[]");
ok("G3 no raw restores absence", readWorldLedgerStorage(fakeStore()).length === 0);
(() => {
  const s = fakeStore();
  s.setItem(WORLD_LEDGER_STORAGE_KEY, "{not json");
  ok("G4 bad JSON restores absence (never guessed)", readWorldLedgerStorage(s).length === 0);
})();
(() => {
  const s = fakeStore();
  s.setItem(WORLD_LEDGER_STORAGE_KEY, JSON.stringify({ v: 2, rows: G_ROWS() }));
  ok("G5 a foreign version drops whole", readWorldLedgerStorage(s).length === 0);
})();
(() => {
  const s = fakeStore();
  s.setItem(WORLD_LEDGER_STORAGE_KEY, JSON.stringify({ v: 1, rows: { t: 1 } }));
  ok("G6 rows-not-an-array drops whole", readWorldLedgerStorage(s).length === 0);
})();
(() => {
  const s = fakeStore();
  s.setItem(WORLD_LEDGER_STORAGE_KEY, JSON.stringify({ v: 1, rows: G_ROWS().slice(0, 2).concat([{ t: "late", jobs: 1, edges: 1, running: 0, completed: 0, failed: 0 }]) }));
  ok(
    "G7 one off-shape row drops the WHOLE ledger (a half-trusted memory is a lie with a footnote)",
    readWorldLedgerStorage(s).length === 0,
  );
})();
(() => {
  const s = fakeStore();
  const fat = Array.from(
    { length: WORLD_LEDGER_CAP + 1 },
    (_, i) => ({ t: i, jobs: 15, edges: 14, running: 0, completed: 15, failed: 0 }),
  );
  s.setItem(WORLD_LEDGER_STORAGE_KEY, JSON.stringify({ v: 1, rows: fat }));
  ok("G8 an oversize ledger enters only at its own law (beyond the cap drops)", readWorldLedgerStorage(s).length === 0);
})();
(() => {
  const s = fakeStore();
  const rows = G_ROWS();
  ok("G9 the write returns its receipt (true on a willing store)", writeWorldLedgerStorage(s, rows) === true);
  const back = readWorldLedgerStorage(s);
  ok("G10 the round-trip restores the story row for row", JSON.stringify(back) === JSON.stringify(rows));
})();
(() => {
  const s = fakeStore();
  writeWorldLedgerStorage(s, G_ROWS());
  const env = JSON.parse(s.getItem(WORLD_LEDGER_STORAGE_KEY));
  ok("G11 the envelope carries the version beside the rows", env.v === 1 && Array.isArray(env.rows) && env.rows.length === 3);
})();
ok(
  "G12 a refusing store writes FALSE, never throws (the memory-only degradation)",
  writeWorldLedgerStorage(throwingStore(), G_ROWS()) === false,
);
ok("G13 a null store writes FALSE (the SSR face mirrors the read)", writeWorldLedgerStorage(null, G_ROWS()) === false);
ok(
  "G14 the shape law speaks its refusals (string t, negative, a bare string row; a zero world is a world)",
  isWorldSnapshotShape({ t: "late", jobs: 1, edges: 1, running: 0, completed: 0, failed: 0 }) === false &&
    isWorldSnapshotShape({ t: 1, jobs: -1, edges: 1, running: 0, completed: 0, failed: 0 }) === false &&
    isWorldSnapshotShape("row") === false &&
    isWorldSnapshotShape({ t: 0, jobs: 0, edges: 0, running: 0, completed: 0, failed: 0 }) === true,
);

const dlgLedger = readFileSync(path.join(ROOT, "src/components/workflow/world-health-dialog.tsx"), "utf8");
// t1141 re-key — the restore now reads the TWO tiers through the lib's
// one father (readWorldLedgerTiers): the tab's story wins, the machine's
// story fills an empty tab; the race law's shape held (restore before
// commit), so the pin follows the family's face (the re-key named here).
ok(
  "G15 the restore lands BEFORE the commit effect (declaration order IS the race law; t1141 the tiers' face)",
  dlgLedger.indexOf("readWorldLedgerTiers(session, local)") >= 0 &&
    dlgLedger.indexOf("readWorldLedgerTiers(session, local)") < dlgLedger.indexOf("appendWorldSnapshot(h,"),
);
ok(
  "G16 the write rides an effect, never render (the #13 law; t1141 the write-through's face)",
  !dlgLedger.includes("useMemo(() => writeWorldLedgerStorage") &&
    !dlgLedger.includes("useMemo(() => writeWorldLedgerTiers") &&
    /useEffect\(\(\) => \{\s*\n\s*if \(!restoredRef\.current \|\| history\.length === 0\) return;/.test(dlgLedger),
);
ok(
  "G17 the write door stays shut until the restore pass (the clobber cure)",
  dlgLedger.includes("restoredRef.current = true") &&
    dlgLedger.includes("if (!restoredRef.current || history.length === 0) return;"),
);

console.log(`\n${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
