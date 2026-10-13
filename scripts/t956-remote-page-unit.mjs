#!/usr/bin/env node
/**
 * t956 — the REMOTE PAGE unit (node-only): the t944 deep-band law's
 * affordance, pinned at the lib, the route, and the UI.
 *
 * THE LAW: the t289 remote join's 300-card budget spent itself on the
 * ledger's own order (the find's door→spine→front→deep priority) — with
 * a long root history the cards ended INSIDE the front band and the
 * deep band was UNREACHABLE: the note named the truncation and the
 * table never showed the files. The t956 cure makes the join PAGEABLE:
 * `joinRemotePage(files, manifest, offset)` skips deeper into the
 * remote-only sequence, `remoteNextOffset` speaks the next page's door,
 * and the Files tab's "Show 300 more from the cluster ledger" spends
 * the next page on demand.
 *
 * The laws carried intact from the t289 join (each pinned below):
 *  - duplicates never spend budget (skipped BEFORE cap AND offset);
 *  - the cap binds at exactly REMOTE_PAGE additions (the 301st sets
 *    `truncated` instead of landing);
 *  - the exact-remainder page is honest (no phantom next page);
 *  - the join is PURE (the caller owns the push and the re-sort);
 *  - garbage/negative offsets degrade to 0 (the standing face).
 *
 *   node scripts/unit-runner.mjs scripts/t956-remote-page-unit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t956-remote-page-unit.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---- the live import (the lib's own well) ---- */
const { joinRemotePage, REMOTE_PAGE } = await import("@/lib/relion/outputs-list");

/* ---- fixtures ---- */
const local = [
  { path: "run.out", name: "run.out", kind: "text", size: 10 },
  { path: "micrographs/Falcon_1.mrc", name: "Falcon_1.mrc", kind: "mrc", size: 20 },
];
// 320 remote-only entries + 50 duplicates interleaved every 7th slot
const manifestEntries = [];
for (let i = 0; i < 320; i++) {
  manifestEntries.push({ path: `deep/band/f${String(i).padStart(5, "0")}.star`, size: 1000 + i });
  if (i % 7 === 0 && i > 0) {
    manifestEntries.push({ path: i % 2 === 0 ? "run.out" : "micrographs/Falcon_1.mrc", size: 1 });
  }
}
const MANIFEST = { files: manifestEntries, truncated: true };

/* ---- J: the join's own laws ---- */
/* J1 — the standing face: offset 0 caps at 300, speaks the next door */
const p1 = joinRemotePage(local, MANIFEST, 0);
ok("J1 page one adds exactly 300", p1.added.length === 300, String(p1.added.length));
ok("J1 page one is truncated (more remain)", p1.truncated === true);
ok("J1 the next door is 300", p1.nextOffset === 300, String(p1.nextOffset));
ok("J1 added rows carry remote:true + the ledger's size",
  p1.added[0]?.remote === true && p1.added[0]?.size === 1000);
ok("J1 the shape rides classify/friendlyLabel (a star is a star)",
  p1.added[0]?.kind === "star" && typeof p1.added[0]?.label === "string" && p1.added[0].label.length > 0,
  `${p1.added[0]?.kind}: ${p1.added[0]?.label}`);

/* J2 — duplicates never spend budget: 50 dupes inside the first page's
 * span, yet the page still carries exactly 300 REMOTE-ONLY rows */
const remoteOnlyInFirstPage = p1.added.every((f) => f.path !== "run.out" && f.path !== "micrographs/Falcon_1.mrc");
ok("J2 no duplicate path landed in page one", remoteOnlyInFirstPage);

/* J3 — the offset walks DEEPER: page two starts where page one ended */
const p2 = joinRemotePage(local, MANIFEST, 300);
ok("J3 page two adds exactly 20 (the ledger's remainder)", p2.added.length === 20, String(p2.added.length));
ok("J3 page two is the ledger's end — honest, no phantom door",
  p2.truncated === false && p2.nextOffset === null);
ok("J3 page two continues the ledger's own order",
  p2.added[0]?.path === `deep/band/f${String(300).padStart(5, "0")}.star`, p2.added[0]?.path);

/* J4 — the offset is a position in the REMOTE-ONLY sequence: the 50
 * duplicates inside page one's raw span did NOT shift page two's start
 * (it reads f00300, not f00350) — pinned by J3's exact path assert. */
ok("J4 the offset counts remote-only positions (J3's exact path is the proof)",
  p2.added[0]?.path === "deep/band/f00300.star");

/* J5 — a spent ledger: offset past the end answers an empty page */
const p5 = joinRemotePage(local, MANIFEST, 9999);
ok("J5 an offset past the end adds nothing, truncates nothing",
  p5.added.length === 0 && p5.truncated === false && p5.nextOffset === null);

/* J6 — the exact-remainder face: exactly 300 remain → the page fills,
 * truncated stays FALSE (no phantom door), the ledger is spent */
const exact = { files: Array.from({ length: 300 }, (_, i) => ({ path: `x/f${i}.dat`, size: i })) };
const p6 = joinRemotePage([], exact, 0);
ok("J6 exactly 300 remain → the page fills honestly",
  p6.added.length === 300 && p6.truncated === false && p6.nextOffset === null);

/* J7 — the join is PURE: the caller's array is untouched */
const before = JSON.stringify(local);
joinRemotePage(local, MANIFEST, 0);
ok("J7 the join never mutates the caller's files array", JSON.stringify(local) === before);

/* J8 — garbage/negative offsets degrade to the standing face */
const g1 = joinRemotePage(local, MANIFEST, -50);
const g2 = joinRemotePage(local, MANIFEST, Number.NaN);
ok("J8 negative and garbage offsets read as 0",
  g1.added.length === 300 && g2.added.length === 300 && g1.nextOffset === 300);

/* J9 — the cap is ONE named law */
ok("J9 REMOTE_PAGE is 300 (the t289 cap, named)", REMOTE_PAGE === 300);

/* ---- S: the source pins (the assembly, the route, the UI) ---- */
const asmSrc = readFileSync(path.join(ROOT, "src/lib/relion/job-outputs.ts"), "utf8");
ok("S1 the assembly drinks joinRemotePage and passes the offset",
  asmSrc.includes("joinRemotePage(") && asmSrc.includes("opts?.remoteOffset ?? 0"));
ok("S2 the push + re-sort stay at the assembly, gated on added>0",
  asmSrc.includes("if (added.length > 0)") && asmSrc.includes("files.push(...added)"));
ok("S3 the response carries remoteNextOffset (undefined = the key vanishes)",
  asmSrc.includes("remoteNextOffset"));

const routeSrc = readFileSync(path.join(ROOT, "src/app/api/jobs/[id]/outputs/route.ts"), "utf8");
ok("S4 the route reads ?remoteOffset and clamps garbage at the door",
  routeSrc.includes('searchParams.get("remoteOffset")') &&
    routeSrc.includes("Number.parseInt(offsetRaw ?? \"0\", 10) || 0"));

const uiSrc = readFileSync(path.join(ROOT, "src/components/workflow/job-inspector.tsx"), "utf8");
ok("S5 the affordance exists: data-remote-more, no-print, the ledger's words",
  uiSrc.includes('data-remote-more=""') &&
    uiSrc.includes("Show 300 more from the cluster ledger") &&
    uiSrc.includes("no-print flex shrink-0 items-center justify-center"));
ok("S6 the affordance fetches the door's own offset and appends the diff",
  uiSrc.includes("outputs?remoteOffset=${remoteNext}") && uiSrc.includes("setExtraFiles"));
ok("S7 a wholesale reload collapses to the canonical first page",
  uiSrc.includes("setExtraFiles([])") && uiSrc.includes("setRemoteNext(body.remoteNextOffset ?? null)"));
ok("S8 the note rides above the table still (the t944 law untouched)",
  uiSrc.indexOf("data-listing-note") >= 0 &&
    uiSrc.indexOf("data-listing-note") < uiSrc.indexOf("data-remote-more"));

/* ---- the receipt ---- */
try { writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({ instrument: "t956-remote-page-unit", pass, fail, at: new Date().toISOString() }, null, 2)); } catch {}
console.log(`\nREMOTE-PAGE-UNIT t956: ${pass}/${pass + fail} ${fail === 0 ? "green — the deep band is reachable, the laws intact" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
