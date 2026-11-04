#!/usr/bin/env node
/**
 * t1053-fleet-ledger-unit — the fleet ledger (per-connection disk budget,
 * docs/remote-relion.md §7's last standing stretch item, now closed).
 *
 * The feature: a project's remote runs hold bytes on the cluster AND in
 * local mirrors; the storage map told the local story, the cleanup dialog
 * told one job's both-sides story, and NO surface told the fleet story.
 * The fleet ledger answers per connection: "the cluster holds X across N
 * workdirs (stamped, live-probed under a time budget, sidecar-remembered)
 * · mirrors hold Y here (fresh from the walk) · the sync ceiling Z".
 *
 * Three bands:
 *   A — the lib's contract (static pins on fleet-ledger.ts): the probe
 *       budget, the honest hole (null remoteBytes, never a fake zero),
 *       the nulls-last sort, the null-skipping totals, the 0600 sidecar,
 *       the corrupt-sidecar courtesy, the never-measured honesty, the
 *       orphan bucket keying.
 *   B — the route LIVE (HTTP against the running world): the guard's
 *       403, the 404's wording, the demo world's one Mock Cluster band
 *       with its ten workdirs, the totals' internal agreement, the
 *       nulls-last order.
 *   C — the dialog's section (static pins on storage-dialog.tsx): the
 *       gate (connections empty → the section dissolves), the policy
 *       line's two voices, the ceiling bar's accessible name, the
 *       six-a-glance slice with its expand door, the never-measured
 *       voice, the forgotten-on-close.
 *   D — the agent's mouth (t1054): get_fleet_ledger beside
 *       get_storage_report — one well, the second face.
 *   E — the ledger's memory (t1055): the ring's write/read contract and
 *       the voices' home (the spec module since t1056).
 *   F — the ONE VOICE (t1056): the ring's arithmetic lives once in
 *       fleet-trend.ts; the dialog AND the dashboard's fleet card (the
 *       third mouth) drink the same cup; the arithmetic is pinned LIVE
 *       (heights, the 4px floor, the five voices, the hole stub).
 *   G — the FOURTH MOUTH (t1057): the KPI band's fleet sparkline drinks
 *       the same well at its own height dialect (scalePx 12); the ring
 *       cap speaks from the client-safe well; the family bell
 *       (FLEET_MEASURED_EVENT) wires every measure seat to every cached
 *       mouth; the dialog's band header speaks the ring's length; and
 *       the app's first error boundary (error.tsx) catches a falling
 *       chunk with one guarded reload.
 *   H — the ONE ARITHMETIC + the FIFTH MOUTH (t1058): the delta's five
 *       kinds leave every voice's lap and live once in the well
 *       (fleetTrendDelta) — the AI's server breath drinks them (the
 *       t1055 inline twin is dead); the spec carries ringCount so every
 *       mouth speaks the ring's length from ONE home; and the
 *       diagnostics panel grows the fleet memory section (the ring's
 *       existence as facts on disk — the OPS view).
 *   I — the SIXTH MOUTH + the style dialect's second seat (t1059): the
 *       fleet memory's per-project DRILL (get_fleet_memory — every
 *       ring across ALL projects, names resolved from the world, each
 *       ring's delta riding the ONE well off the reader's new
 *       prevAt/prevBytes facts); the storage dialog's strip (the FIRST
 *       mouth) drinks the card's t1058 style dialect (the baseline
 *       hairline, the pointer brighten, the ring chip); the
 *       diagnostics fleet rows grow a fullness meter.
 *   J — the MEMORY'S DEPTH (t1060): the reader carries the ring's FULL
 *       array (newest first, capped at read) and the drill grows the
 *       SPAN clause — the far end speaks ("the ring reaches back 2d —
 *       1.30 GB then, up 30 MB across the ring's reach"), its own delta
 *       riding the ONE well ([oldest] as the history); the locator
 *       breath names the memory's depth; the OPS row's title reaches.
 *   T — THE COUNT'S FAMILY (t1069): the qualifying walk leaves the
 *       summary's lap as fleetTrendHoleCount (ONE arithmetic, now a
 *       NUMBER) — the diagnostics row's stamp grows "· 4 holes" beside
 *       the bytes (off when the newest measure is itself a hole — "a
 *       hole" already speaks a silence and the count beside it would
 *       read as a contradiction at 10px), the drill's per-ring band
 *       names the memory's silences ("4 honest holes in the memory"),
 *       and the summary's plural sentence grows the NEWEST silence's
 *       age ("the newest 2h ago" — the stamps the hover knows, the
 *       paragraph can afford one; the singular keeps its pair — two
 *       readings already fill that cup).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fleetTrendSpec, fleetTrendDelta, fleetTrendRingBars, fleetTrendHolePair, fleetTrendSpanVoice, fleetTrendHoleSummary, fleetTrendHoleCount, fleetTrendGapTitle, fleetTrendHoleDeepest, fleetUnansweredVoice, fleetHistoryOutgoingPoint, mirrorBytesTotalFor, fleetTrendMirrorDelta, fleetTrendMirrorHop, fleetMirrorArc, fleetTrendCeilingFace, fleetUnmirroredRuns, FLEET_TREND_RING_CAP } from "../src/lib/remote/fleet-trend.ts";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const lib = readFileSync(path.join(ROOT, "src/lib/remote/fleet-ledger.ts"), "utf8");
const dialog = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
const trend = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
const card = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
const funnelDoor = readFileSync(path.join(ROOT, "src/components/workflow/canvas-funnel-door.tsx"), "utf8");
// t1124 — the funnel dialog's own source (the scale's reference mark,
// the bar's hover confession, the station numbers, the chips' words)
const funnelDialog = readFileSync(path.join(ROOT, "src/components/workflow/results/particle-funnel-dialog.tsx"), "utf8");
const dashboard = readFileSync(path.join(ROOT, "src/components/workflow/project-dashboard.tsx"), "utf8");
// t1126 — the params-diff room joins the ledger: the shared diff table
// (two houses) + the standalone dialog shell (the description, the
// footnote)
const paramsDiff = readFileSync(path.join(ROOT, "src/components/workflow/results/fsc-params-diff.tsx"), "utf8");
const paramsDialog = readFileSync(path.join(ROOT, "src/components/workflow/params-diff-dialog.tsx"), "utf8");
const fscCompareDialog = readFileSync(path.join(ROOT, "src/components/workflow/results/fsc-compare-dialog.tsx"), "utf8");
const resultsView = readFileSync(path.join(ROOT, "src/components/workflow/results/results-view.tsx"), "utf8");
const sessionReport = readFileSync(path.join(ROOT, "src/components/workflow/session-report-dialog.tsx"), "utf8");
const sessionReportLib = readFileSync(path.join(ROOT, "src/lib/qc-report.ts"), "utf8");
// t1081-R — the ROUTE discovers the demo project LIVE (the reboot recovery:
// the re-seeded world mints a NEW project id — a fossil id pins a corpse;
// the demo project is found by its NAME through the same door the app
// uses, so the pins ride whatever id the living world carries)
const ROUTE = await (async () => {
  try {
    const res = await fetch("http://localhost:3000/api/project", { headers: { Origin: "http://localhost:3000" } });
    const body = await res.json().catch(() => null);
    const p = body?.project ?? body;
    if (p?.id) return `http://localhost:3000/api/projects/${p.id}/fleet-ledger`;
  } catch {}
  return "http://localhost:3000/api/projects/unknown/fleet-ledger";
})();
const SIDECAR = path.join(ROOT, "data/remote-fleet-ledger.json");

let pass = 0;
let fail = 0;
const pin = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* ---- A band: the lib's contract ---- */
pin("A0 the lib is located and names itself", lib.includes("the FLEET LEDGER (t1053)"));
pin("A1 the probes ride a time budget", /PROBE_BUDGET_MS = 12_000/.test(lib));
pin("A2 the hole is honest — null, never a fake zero",
  lib.includes("remoteBytes: number | null") && lib.includes("remoteBytes: bucket.sizes[meta.id] ?? null"));
pin("A3 the rows sort heaviest-first with nulls last",
  /if \(av == null\) return 1;/.test(lib) && /return bv - av \|\| a\.jobName\.localeCompare/.test(lib));
pin("A4 the totals skip the holes",
  /if \(j\.remoteBytes != null\) \{/.test(lib) && lib.includes("unmeasured: b.jobs.length - measured"));
pin("A5 the sidecar writes 0600 (the storage-diag law)", lib.includes("mode: 0o600"));
pin("A6 a corrupt sidecar starts empty (the courtesy law)",
  /catch \(\{\s*\n?\s*return \{\};/.test(lib.replace(/\r/g, "")) || /catch \{\s*\n\s*return \{\};/.test(lib));
pin("A7 a never-measured connection wears a null stamp, not a zero",
  lib.includes("measuredAt: null") && lib.includes('honest "never measured", never a fake zero'));

/* ---- B band: the route LIVE ---- */
async function jsonFetch(url, headers = {}) {
  const res = await fetch(url, { headers });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

let band = null;
try {
  const ok = await jsonFetch(ROUTE, { Origin: "http://localhost:3000" });
  pin("B0 the route answers 200 with the Origin key and its project (the id discovered live — the t1081-R recovery law: the re-seeded world mints a new id, the pin rides the living one)",
    ok.status === 200 && !!ok.body?.projectId);
  const conns = ok.body?.connections ?? [];
  band = conns[0] ?? null;
  pin("B1 the demo world speaks — one Mock Cluster band with ten workdirs",
    conns.length === 1 && band?.connectionName === "Mock Cluster" && band?.jobs.length === 10,
    `got ${conns.length} conn(s), ${band?.jobs.length ?? 0} job(s)`);

  if (band) {
    const nonNull = band.jobs.filter((j) => j.remoteBytes != null);
    const sumRemote = nonNull.reduce((s, j) => s + j.remoteBytes, 0);
    const sumLocal = band.jobs.reduce((s, j) => s + j.localBytes, 0);
    pin("B2 the totals agree with their own rows",
      sumRemote === band.remoteBytesTotal && sumLocal === band.localBytesTotal &&
      band.measured + band.unmeasured === band.jobs.length);
    let sorted = true;
    for (let i = 1; i < band.jobs.length; i++) {
      const a = band.jobs[i - 1].remoteBytes, b = band.jobs[i].remoteBytes;
      if (a == null && b != null) sorted = false;
      else if (a != null && b != null && b > a) sorted = false;
    }
    pin("B3 the rows arrive heaviest-first, holes last", sorted);
    pin("B5 the sync ceiling rides along (2.0 GB from the connection's policy)",
      band.syncCeilingBytes === 2 * 1024 * 1024 * 1024);
  }

  const noOrigin = await fetch(ROUTE);
  pin("B4 the guard speaks — no fetch metadata, no ledger",
    noOrigin.status === 403);
  const missing = await jsonFetch("http://localhost:3000/api/projects/no-such-project/fleet-ledger",
    { Origin: "http://localhost:3000" });
  pin("B6 a vanished project is a 404, not an empty ledger",
    missing.status === 404 && missing.body?.error === "Project not found");
} catch (e) {
  pin("B0 the route answers 200 with the Origin key and its project", false, String(e));
  pin("B1 the demo world speaks — one Mock Cluster band with ten workdirs", false, "skipped");
  pin("B2 the totals agree with their own rows", false, "skipped");
  pin("B3 the rows arrive heaviest-first, holes last", false, "skipped");
  pin("B4 the guard speaks — no fetch metadata, no ledger", false, "skipped");
  pin("B5 the sync ceiling rides along (2.0 GB from the connection's policy)", false, "skipped");
  pin("B6 a vanished project is a 404, not an empty ledger", false, "skipped");
}

/* ---- C band: the dialog's section ---- */
pin("C0 the section dissolves when the fleet is empty (the honest empty)",
  dialog.includes("fleet && fleet.connections.length > 0"));
pin("C1 the policy line speaks both sides of the arithmetic",
  dialog.includes("lives only on the cluster — the") &&
  dialog.includes("The mirrors hold at least as much as the cluster"));
pin("C2 the ceiling bar carries an accessible name (t1084 re-key: the aria's arithmetic drinks the hoisted `ceilingShare`/`ceilingBytes` consts now — the triple inline fork retired, ONE arithmetic per zoom; the name's words unchanged)",
  dialog.includes('role="img"') &&
  dialog.includes("% of the ${fmtBytes(ceilingBytes)} sync ceiling") &&
  card.includes("% of the ${fmtBytes(ceilingBytes)} sync ceiling"));
pin("C3 six rows a glance, the rest behind the door",
  dialog.includes("conn.jobs.slice(0, 6)") &&
  dialog.includes("and ${conn.jobs.length - 6} more workdir"));
pin("C4 the never-measured voice exists (never a blank stamp)",
  dialog.includes('"never measured"') && dialog.includes("never measured"));
pin("C5 the bands die with the dialog (next open re-reads the sidecar)",
  /setFleet\(null\);/.test(dialog) && dialog.includes("the fleet bands die with the dialog too"));
pin("C7 the sidecar exists on disk (the measure path ran)", existsSync(SIDECAR));

/* ---- D band: the agent's mouth (t1054 — the one-well law's second
 * face: the AI drinks the SAME computeFleetLedger cup the dialog
 * drinks; twins fork, imports don't) ---- */
const aiTools = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");
const fleetToolWin = aiTools.indexOf('name: "get_fleet_ledger"');
// t1109 re-key — the window follows the tool: the ear grew the silences
// sentence (~450 chars), the parameters block slid past the old 2400 slice.
const fleetToolSlice = fleetToolWin > 0 ? aiTools.slice(fleetToolWin, fleetToolWin + 3000) : "";
pin("D1 the schema registers get_fleet_ledger beside get_storage_report", fleetToolWin > 0);
pin("D2 the description names both sides of the story",
  fleetToolSlice.includes("what the workdirs hold THERE") && fleetToolSlice.includes("what their local mirrors hold HERE"));
pin("D3 the measure knob is the schema's one parameter",
  fleetToolSlice.includes("measure: {") && fleetToolSlice.includes("Default false."));
pin("D4 the dispatch routes the tool to its executor",
  aiTools.includes('case "get_fleet_ledger":') && aiTools.includes("await getFleetLedger(ctx, args?.measure === true)"));
pin("D5 the executor drinks the one well (the shell, measure flows)",
  aiTools.includes('computeFleetLedger(ctx.projectId, { measure })') &&
  aiTools.includes('from "@/lib/remote/fleet-ledger"'));
pin("D6 the no-remote answer is the honest empty, not a fake zero",
  aiTools.includes("the fleet ledger's honest empty"));
pin("D7 the annex caps its rows and says so (the t510 pane law)",
  aiTools.includes("FLEET_TOOL_JOB_CAP = 20") && aiTools.includes("the annex caps each connection's rows"));
pin("D8 the summary speaks the band in one breath (whale + both bytes + the stamp)",
  aiTools.includes("Heaviest workdir: ") && aiTools.includes("graveAgeLike(c.measuredAt)") &&
  aiTools.includes("the Storage dialog's Cluster ledger drinks the same cup"));

/* ---- E band: the ledger's memory (t1055 — the trend ring: the row's
 * numbers are the PRESENT, the ring is the PAST; the delta finds its
 * voice in the dialog's strip and the AI band's breath) ---- */
pin("E1 the lib names the memory (the ring's cap, the point's shape) — t1057: the cap's ONE home is the client-safe well; the ledger re-exports it",
  /import \{ FLEET_TREND_RING_CAP as FLEET_HISTORY_CAP \} from "\.\/fleet-trend"/.test(lib) &&
    lib.includes("export { FLEET_HISTORY_CAP };") && lib.includes("export interface FleetHistoryPoint"));
pin("E2 the ring remembers the OUTGOING measurement (the row's numbers are the present, never duplicated; t1095 re-key — the shape law's ONE home is the well's fleetHistoryOutgoingPoint now, the loop pours it and the sum stays the ledger's own)",
  lib.includes("The ring remembers the OUTGOING measurement") &&
  lib.includes("fleetHistoryOutgoingPoint({") && lib.includes("totalMeasuredBytes(base.sizes)") &&
  trend.includes("export function fleetHistoryOutgoingPoint(args: {") &&
  trend.includes("if (args.measuredAt == null) return null;"));
pin("E3 the hole arithmetic — no answer at all is spoken null, never a zero wearing a sum",
  lib.includes("return answered > 0 ? sum : null;") && lib.includes("never a zero wearing a sum"));
pin("E4 the cap is enforced at write AND defensively at read",
  (lib.match(/\.slice\(0, FLEET_HISTORY_CAP\)/g) ?? []).length >= 2);
pin("E5 the seed tries both keys — the orphan's ring rides its name",
  lib.includes("historyRec[connId] ?? historyRec[snapRow.connectionName]"));
pin("E6 the ring rides the sidecar's write (the memory persists with the snapshot)",
  lib.includes("history: historyRec"));
pin("E7 the live route carries the memory (the demo band's history is an array)", await (async () => {
  try {
    const res = await fetch(ROUTE, { headers: { Origin: "http://localhost:3000" } });
    const body = await res.json().catch(() => null);
    return res.status === 200 && Array.isArray(body?.connections?.[0]?.history);
  } catch {
    return false;
  }
})());
pin("E8 the ONE VOICE speaks the delta's four voices (begins / hole / up-down / unchanged) — the spec module owns the words since t1056",
  trend.includes("the trend begins here; the next Measure now speaks the delta") &&
  trend.includes("no delta is spoken until it answers") &&
  trend.includes("— the workdirs grew.") && trend.includes("— something was cleaned up there.") &&
  trend.includes("Unchanged since the measure"));
pin("E9 the bars are decoration (aria-hidden) and the paragraph is the voice — the dialog renders the SPEC's bars (t1063: the hairline grew the reach caption between the attribute and the map)",
  /aria-hidden="true"\s*\n\s*title=\{reach \?\? undefined\}\s*>\s*\{spec\.bars\.map/.test(dialog) && dialog.includes('data-testid={`fleet-trend-${conn.connectionId ?? "orphan"}`}'));
pin("E10 the AI band speaks the trend in one breath (direction + age, or the honest hole, or the beginning) — t1058: the words now ride the delta-dialect form (the arithmetic moved into the well)",
  aiTools.includes("the trend begins with this measure") &&
  aiTools.includes("an honest hole in the trend") &&
  aiTools.includes("since the measure ${graveAgeLike(prevPoint!.at)}"));

/* ---- F band: the ONE VOICE (t1056 — the ring's arithmetic lives once:
 * heights, titles, and the delta's voices moved from the dialog's
 * inline IIFE to fleet-trend.ts; the dialog AND the dashboard's fleet
 * card drink the same cup — twins fork, imports don't) ---- */
pin("F1 the spec module exists and names itself (the ONE VOICE)",
  trend.includes("the fleet trend's ONE VOICE (t1056)"));
pin("F2 the spec is self-contained (a client mouth must never drag the server module into the bundle)",
  !/^import /m.test(trend) && trend.includes("Self-contained by design"));
pin("F3 the bar arithmetic carries the dialog's line (24px tall, 4px floor)",
  trend.includes("FLEET_TREND_BAR_PX = 24") && trend.includes("FLEET_TREND_BAR_MIN_PX = 4"));
pin("F4 the dialog drinks the well (no forked arithmetic survives)",
  dialog.includes('from "@/lib/remote/fleet-trend"') &&
  dialog.includes("fleetTrendSpec({") && !dialog.includes("trendMax"));
pin("F5 the current measurement CLOSES the line (past bars then the present, never the past alone; t1067 re-key: the push grew the unanswered-present ternary — the answered branch is still the closing current)",
  trend.includes("kind: \"current\"") && /bars\.push\(\s*\n?\s*currentBytes == null/.test(trend));
pin("F6 the hole speaks as a dashed stub with its own title (never a zero-height bar wearing a number)",
  trend.includes("the cluster never answered (an honest hole)"));
pin("F7 the card exists on the dashboard and drinks the SAME cup",
  card.includes("fleetTrendSpec({") && card.includes('from "@/lib/remote/fleet-trend"'));
pin("F8 the card dissolves on the honest empty (no remote runs → return null, no shell)",
  card.includes("body.connections.length === 0") && card.includes("the card dissolves"));
pin("F9 the card's bars stay decoration and the strip rides the dialog's testid dialect (t1063: the hairline grew the reach caption between the attribute and the map)",
  /aria-hidden="true"\s*\n\s*title=\{reach \?\? undefined\}\s*>\s*\{spec\.bars\.map/.test(card) &&
  card.includes('data-testid={`fleet-card-trend-${props.connectionId}`}'));
pin("F10 the card's Measure now spends the budget honestly (measure=1, aria-busy, the spin)",
  card.includes('?measure=1" : ""') && card.includes("aria-busy={measuring}"));
pin("F11 the card is mounted on the dashboard (the 160ms rung between the strip and the calendar)",
  dashboard.includes("<FleetTrendCard />") && dashboard.includes('"--dash-d": "160ms"'));
pin("F12 the card's caps are named (two bands at a glance, the door opens the rest)",
  card.includes("FLEET_CARD_CONN_CAP = 2") && card.includes("more connection"));
pin("F13 the spec's arithmetic is LIVE — heights, the floor, and the five voices answer", await (async () => {
  try {
    const fmt = (n) => (n >= 1024 * 1024 * 1024 ? `${(n / 1024 ** 3).toFixed(2)}GB` : `${Math.round(n / 1024)}KB`);
    const stamp = (_iso) => "9m ago";
    // a ring with one past point and a bigger present → Up voice, two bars
    const up = fleetTrendSpec({
      history: [{ at: "2026-10-16T10:00:00Z", bytes: 1000 }],
      currentBytes: 3000, currentAt: "2026-10-16T10:09:00Z", fmtBytes: fmt, stampAgo: stamp,
    });
    const okUp = up.bars.length === 2 && up.bars[1].kind === "current" &&
      up.voice === "Up 2KB since the measure 9m ago — the workdirs grew." &&
      up.bars[0].heightPx === "8px" && up.bars[1].heightPx === "24px";
    // the present smaller → Down; equal → Unchanged; empty ring → begins
    const down = fleetTrendSpec({
      history: [{ at: "2026-10-16T10:00:00Z", bytes: 3000 }],
      currentBytes: 1000, currentAt: "2026-10-16T10:09:00Z", fmtBytes: fmt, stampAgo: stamp,
    });
    const same = fleetTrendSpec({
      history: [{ at: "2026-10-16T10:00:00Z", bytes: 3000 }],
      currentBytes: 3000, currentAt: "2026-10-16T10:09:00Z", fmtBytes: fmt, stampAgo: stamp,
    });
    const begins = fleetTrendSpec({
      history: [], currentBytes: 1, currentAt: "2026-10-16T10:09:00Z", fmtBytes: fmt, stampAgo: stamp,
    });
    // a hole in the ring: the stub keeps its 4px floor and its own title
    const holed = fleetTrendSpec({
      history: [{ at: "2026-10-16T10:00:00Z", bytes: null }],
      currentBytes: 2000, currentAt: "2026-10-16T10:09:00Z", fmtBytes: fmt, stampAgo: stamp,
    });
    return okUp &&
      down.voice.startsWith("Down ") && same.voice.startsWith("Unchanged ") &&
      begins.prev === null && begins.bars.length === 1 && begins.bars[0].kind === "current" &&
      holed.bars[0].kind === "hole" && holed.bars[0].heightPx === "4px" &&
      holed.bars[0].title.includes("never answered") &&
      holed.bars[0].bytes === null;
  } catch {
    return false;
  }
})());

/* ---- G band: the FOURTH MOUTH (t1057) ---- */
{
  const kpi = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");
  const errBound = readFileSync(path.join(ROOT, "src/app/error.tsx"), "utf8");
  const fmt = (n) => `${n} B`;
  const stamp = () => "just now";

  pin("G1 the ring cap lives in the client-safe well and the server ledger re-exports it",
    /FLEET_TREND_RING_CAP = 12/.test(trend) &&
    /import \{ FLEET_TREND_RING_CAP as FLEET_HISTORY_CAP \} from "\.\/fleet-trend"/.test(lib) &&
    /export \{ FLEET_HISTORY_CAP \};/.test(lib));
  pin("G2 the family bell has its one name in the well",
    /FLEET_MEASURED_EVENT = "cryoflow:fleet-measured"/.test(trend));
  pin("G3 scalePx is the mouth's height dialect — LIVE: 12px scale halves the bars, default stays 24",
    (() => {
      const s = fleetTrendSpec({
        history: [{ at: "2026-10-16T10:00:00Z", bytes: 3000 }],
        currentBytes: 1500, currentAt: "2026-10-16T10:09:00Z", fmtBytes: fmt, stampAgo: stamp, scalePx: 12,
      });
      const d = fleetTrendSpec({
        history: [{ at: "2026-10-16T10:00:00Z", bytes: 3000 }],
        currentBytes: 1500, currentAt: "2026-10-16T10:09:00Z", fmtBytes: fmt, stampAgo: stamp,
      });
      return s.bars[0].heightPx === "12px" && s.bars[1].heightPx === "6px" &&
        d.bars[0].heightPx === "24px" && d.bars[1].heightPx === "12px";
    })());
  pin("G4 the 4px floor holds at every scale — LIVE",
    (() => {
      const s = fleetTrendSpec({
        history: [{ at: "2026-10-16T10:00:00Z", bytes: 3000 }],
        currentBytes: 1, currentAt: "2026-10-16T10:09:00Z", fmtBytes: fmt, stampAgo: stamp, scalePx: 12,
      });
      return s.bars[1].heightPx === "4px";
    })());
  pin("G5 the KPI spark drinks the WELL (no fork) at its own scale",
    kpi.includes("fleetTrendSpec") && /scalePx: 12,/.test(kpi));
  pin("G6 the KPI spark's bars stay decoration and the item gates on its own project",
    kpi.includes('className="flex items-end gap-[2px]" aria-hidden="true"') &&
      /if \(fleet && fleet\.projectId === projectId\)/.test(kpi));
  pin("G7 the KPI spark hears the family bell and rings the storage door",
    kpi.includes("window.addEventListener(FLEET_MEASURED_EVENT, rePour)") &&
      kpi.includes("window.removeEventListener(FLEET_MEASURED_EVENT, rePour)") &&
      kpi.includes("window.dispatchEvent(new CustomEvent(STORAGE_OPEN_EVENT))"));
  pin("G8 the KPI mouth's stamp ladder matches the card's words",
    (() => {
      const ladder = (src) => ["just now", "`${min}m ago`", "`${hr}h ago`", "`${day}d ago`"]
        .every((w) => src.includes(w));
      return ladder(kpi) && ladder(card);
    })());
  pin("G9 the dialog's band header speaks the ring's length against the cap",
    dialog.includes("` · ring ${conn.history.length}/${FLEET_TREND_RING_CAP}`") &&
      dialog.includes("The ring keeps the last ${FLEET_TREND_RING_CAP} measures"));
  pin("G10 BOTH measure seats ring the bell after a live measure",
    dialog.includes("if (measure) window.dispatchEvent(new CustomEvent(FLEET_MEASURED_EVENT))") &&
      card.includes("if (measure) window.dispatchEvent(new CustomEvent(FLEET_MEASURED_EVENT))"));
  pin("G11 the app's first error boundary: the chunk family named, the reload flagged and guarded",
    /ChunkLoadError\|Loading chunk \\d\+ failed/.test(errBound) &&
      /RELOAD_GUARD_MS = 90_000/.test(errBound) &&
      errBound.includes("sessionStorage.setItem(RELOAD_FLAG"));
  pin("G12 the boundary's no-storage path never reloads (the card carries the cure)",
    /catch \{\s*\n\s*return; \/\/ storage unavailable/.test(errBound.replace(/\r/g, "")) ||
      errBound.includes("the button carries it"));
  pin("G13 the boundary renders role=alert with both doors (reload + reset)",
    errBound.includes('role="alert"') &&
      errBound.includes("window.location.reload()") &&
      errBound.includes("onClick={reset}"));
  pin("G14 the CHIP'S PARITY (t1079): the dialog's honest-holes fact wears the card's amber chip — one voice, two zooms",
    // the same chip face, byte-level, both zooms
    dialog.includes("rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning") &&
      card.includes("rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning") &&
    // the same honest-hole title, byte-level, both zooms
      dialog.includes("${conn.unmeasured} of ${conn.jobs.length} workdirs went unanswered at the last measure (an honest hole, never a zero)") &&
      card.includes("${conn.unmeasured} of ${conn.jobs.length} workdirs went unanswered at the last measure (an honest hole, never a zero)") &&
    // the dotted clause is GONE from the stamp span (the chip replaced it)
      !dialog.includes("` · ${conn.unmeasured} of ${conn.jobs.length} unanswered`") &&
    // the chip is the honest-when-present guard's own (inside the unmeasured ternary)
      /conn\.unmeasured > 0 && \(\s*\n\s*<span\s*\n\s*className="rounded-full bg-warning\/10 px-2 py-0\.5 text-\[10px\] font-semibold text-warning"/.test(dialog));
  pin("G15 the DOT'S PARITY (t1082): the reachable fact wears the dialog's status dot on the card too — one voice, two zooms",
    // the same dot face, byte-level, both zooms
    dialog.includes("inline-block size-2 rounded-full ${conn.reachable ? \"bg-success-500\" : \"bg-warning/60\"}") &&
      card.includes("inline-block size-2 rounded-full ${conn.reachable ? \"bg-success-500\" : \"bg-warning/60\"}") &&
    // the same two titles, byte-level, both zooms
      dialog.includes("The cluster answered at least one workdir probe at the last measurement") &&
      card.includes("The cluster answered at least one workdir probe at the last measurement") &&
      dialog.includes("No workdir answered at the last measurement — the connection may be down, or never measured") &&
      card.includes("No workdir answered at the last measurement — the connection may be down, or never measured") &&
    // the card's mirror type now carries the field the route always served
    // (the lib's own "≥1 probe answered" words ride the comment above it)
      card.includes("≥1 probe answered") && card.includes("reachable: boolean;") &&
    // the dot leads the card's row (before the Server icon — the dialog's
    // own leading slot; the health voice speaks first)
      /<div className="flex flex-wrap items-center gap-2">\s*\n\s*\{\/\* t1082 — THE DOT'S PARITY/.test(card));
  pin("G16 the WHALE'S PARITY (t1083): the cluster ledger names the whale — the card footer's promise and the AI band's words keep theirs on camera",
    // the violet whale face appears TWICE in the dialog: the local side's
    // t458 door-button and the cluster band's t1083 line — one face
    dialog.split("border-violet-500/30 bg-violet-500/[0.06]").length === 3 &&
    // the cluster whale sentence speaks the local whaleLine's grammar
    // (the heaviest X — name — holds bytes, share% of the scope)
      dialog.includes("The heaviest workdir — {whaleJob.jobName} — holds") &&
      dialog.includes("% of the connection&apos;s") &&
      /The heaviest run — \$\{top\.row\.name\} — holds \$\{fmtBytes\(top\.row\.bytes\)\}, \$\{top\.share\.toFixed\(0\)\}% of the project\./.test(
        readFileSync(path.join(ROOT, "src/lib/storage-run-lens.ts"), "utf8")) &&
    // the honest guards: a hole first row, a zero whale, a null or zero
    // total — nobody is named (the whaleLine law verbatim)
      /whaleJob\.remoteBytes == null \|\|\s*\n\s*whaleJob\.remoteBytes <= 0 \|\|/.test(dialog) &&
      /conn\.remoteBytesTotal == null \|\|\s*\n\s*conn\.remoteBytesTotal <= 0/.test(dialog) &&
    // the whale line sits BETWEEN the policy paragraph and the rows
      /<\/p>\s*\n\s*\{\/\* t1083 — THE WHALE'S PARITY/.test(dialog) &&
    // the Server icon rides the line (the cluster mark, the card's own)
      /<Server className="mt-0\.5 size-3\.5 shrink-0" aria-hidden="true" \/>/.test(dialog));
  pin("G17 the CEILING'S SHARE (t1084): the mirror band's share speaks in visible text on both zooms — one arithmetic, one sentence, the zero guard",
    // the consts byte-same, both zooms (the never-divide law: a zero
    // ceiling is an unreadable policy — unknown, the title's note's home)
      card.includes("conn.syncCeilingBytes != null && conn.syncCeilingBytes > 0 ? conn.syncCeilingBytes : null") &&
      dialog.includes("conn.syncCeilingBytes != null && conn.syncCeilingBytes > 0") &&
      card.includes("ceilingBytes != null ? ((conn.localBytesTotal / ceilingBytes) * 100).toFixed(0) : null") &&
      dialog.includes("((conn.localBytesTotal / ceilingBytes) * 100).toFixed(0)") &&
    // the share line's sentence, byte-level, both zooms
      card.includes("at {ceilingShare}% of the {fmtBytes(ceilingBytes)} ceiling") &&
      dialog.includes("at {ceilingShare}% of the {fmtBytes(ceilingBytes)} ceiling") &&
    // the cap clause is ONE voice now (the card adopted the dialog's
    // fuller words; the old tight clause is gone)
      card.includes("is this connection's cap on what one run may bring home — mirrors at ${ceilingShare}% of it.") &&
      dialog.includes("is this connection's cap on what one run may bring home — mirrors at ${ceilingShare}% of it.") &&
      !card.includes("caps what one run may bring home") &&
    // each cell's own size dialect (10px glance, 11px authority)
      card.includes('mt-1 text-[10px] tabular-nums text-muted-foreground">\n                        at {ceilingShare}') &&
      dialog.includes('mt-1 text-[11px] tabular-nums text-muted-foreground">\n                                  at {ceilingShare}'));
}

/* ---- t1085 — the CB band: THE FLEET BAND'S ONE VOICE (the hunt's fifth
   catch, three cells of the same family): (1) the POLICY'S VOICE — the
   delta the key-files policy creates spoke on the dialog's policy line
   and in the AI band's clause, never on the card's glance; the card's
   line drinks the dialog's title byte-equal and the shared case-2
   grammar, each zoom's door tail its own; (2) the QUOTES' PARITY — the
   cluster cell's title wore straight quotes and no heavy-stacks tail on
   the card while the dialog wore curly quotes and the fuller clause;
   (3) the CHIP'S NEWLINE — the dialog's ring chip title joined the two
   stories with a space where the card's wore the paragraph shape (the
   t1078 tree-wide serve's missed hold). ---- */
{
  const cardForC = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForC = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const POLICY_TITLE = 'title="The arithmetic of the sync policy: cluster-side minus mirror-side. Under the key-files policy the heavy stacks stay on the cluster and only text metadata rides home — this gap is those stacks."';
  pin("G18 the POLICY'S VOICE rides the card (the dialog's policy title byte-equal; the shared case-2 grammar `{fmtBytes(deltaOnly)} lives only on the cluster — the` in BOTH files; the card's three cases present — the honest wait, the delta, the pre-policy mirrors; the deltaOnly const shape byte-same — the > 0 guard and the Math.max clamp, one arithmetic per zoom; each zoom's own door tail named)",
    cardForC.includes(POLICY_TITLE) &&
      dialogForC.includes(POLICY_TITLE) &&
      cardForC.includes("{fmtBytes(deltaOnly)} lives only on the cluster — the") &&
      dialogForC.includes("{fmtBytes(deltaOnly)} lives only on the cluster — the") &&
      cardForC.includes("The cluster never answered at the last measure — the policy") &&
      cardForC.includes("The mirrors hold at least as much as the cluster — runs") &&
      cardForC.includes("key-files policy keeps the heavy stacks there; the full") &&
      dialogForC.includes("heavy stacks there; fetch a") &&
      cardForC.includes("conn.remoteBytesTotal != null && conn.remoteBytesTotal > 0") &&
      cardForC.includes("Math.max(conn.remoteBytesTotal - conn.localBytesTotal, 0)") &&
      dialogForC.includes("Math.max(conn.remoteBytesTotal - conn.localBytesTotal, 0)"));
  pin("G19 the QUOTES' PARITY (the cluster cell's title is one voice: curly ‘du’ byte-equal in BOTH files, the heavy-stacks tail byte-equal; the card's old straight-quote form is retired)",
    cardForC.includes("answered \\u2018du\\u2019 over SSH") &&
      dialogForC.includes("answered \\u2018du\\u2019 over SSH") &&
      cardForC.includes("heavy stacks included, whatever the sync policy leaves there.") &&
      dialogForC.includes("heavy stacks included, whatever the sync policy leaves there.") &&
      !cardForC.includes("answered 'du' over SSH"));
  pin("G20 the CHIP'S NEWLINE (the dialog's ring chip takes the t1078 serve the card's AA2 already holds — `arrive.\\nA click opens System diagnostics at the fleet memory section.` byte-level, two stories two paragraphs; the read-only span keeps its one-story title — no door words, and the door sentence lives exactly once in the dialog)",
    dialogForC.includes("arrive.\\nA click opens System diagnostics at the fleet memory section.`") &&
      cardForC.includes("arrive.\\nA click opens System diagnostics at the fleet memory section.`") &&
      dialogForC.includes("as new ones arrive.`}") &&
      dialogForC.split("A click opens System diagnostics").length === 2);
}

/* ---- t1086 — the CC band: THE CHIP'S THIRD SEAT (the family's one
   voice at the glance band): the KPI band's memory chip (t1062's seat)
   wore a one-liner title and a countless name while the card's and the
   dialog's chips wore the two-paragraph ring story and the
   count-carrying name; the seat adopts the family's byte-equal pair —
   the three seats one template, pinned by capture-and-compare (not by
   needle, so a future drift on ANY seat fails the pin). ---- */
{
  const cardForCC = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForCC = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const kpiForCC = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");
  const grab = (src, head) => {
    const i = src.indexOf(head);
    if (i < 0) return null;
    const end = src.indexOf("`}", i);
    return end < 0 ? null : src.slice(i, end + 2);
  };
  const ct = [
    grab(cardForCC, "title={`The trend ring remembers"),
    grab(dialogForCC, "title={`The trend ring remembers"),
    grab(kpiForCC, "title={`The trend ring remembers"),
  ];
  const an = [
    grab(cardForCC, "aria-label={`Ring ${spec.ringCount} of ${FLEET_TREND_RING_CAP} remembered measures"),
    grab(dialogForCC, "aria-label={`Ring ${spec.ringCount} of ${FLEET_TREND_RING_CAP} remembered measures"),
    grab(kpiForCC, "aria-label={`Ring ${spec.ringCount} of ${FLEET_TREND_RING_CAP} remembered measures"),
  ];
  pin("G21a the ring chip's two-paragraph story is ONE template byte-equal across the three seats (card, dialog, the glance band's chip)",
    ct[0] != null && ct[0] === ct[1] && ct[0] === ct[2]);
  pin("G21b the chip's accessible name carries the ring's count — one template byte-equal across the three seats",
    an[0] != null && an[0] === an[1] && an[0] === an[2]);
  pin("G21c the KPI seat's one-liner and countless name are retired (the old words pinned GONE)",
    !kpiForCC.includes("The ring's full story — open System diagnostics") &&
      !kpiForCC.includes('aria-label="Open the fleet memory section in System diagnostics"'));
  // t1089 — the count's SECOND EYE joins the capture: the visible face
  // speaks the same words on every seat (the JSX grammar differs by
  // construction — the card and the dialog render JSX text, the glance
  // band renders a template literal — so the pin is per-seat needles
  // over the same rendered words, plus the family's chip FACE shared).
  pin("G21d the count's visible face rides all three seats (the same rendered words — ring n/cap — each seat's own grammar)",
    cardForCC.includes("ring {spec.ringCount}/{FLEET_TREND_RING_CAP}") &&
      dialogForCC.includes("ring {spec.ringCount}/{FLEET_TREND_RING_CAP}") &&
      kpiForCC.includes("{`ring ${spec.ringCount}/${FLEET_TREND_RING_CAP}`}"));
  pin("G21e the glance band's chip wears the family's mono chip face (the card's own class words — rounded-full bg-muted/60 mono tabular)",
    kpiForCC.includes("gap-1 rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[10px] tabular-nums") &&
      cardForCC.includes("rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[10px] tabular-nums"));
  pin("G21f the glance band's chip no longer wears the icon-only private face (t1062's size-5 rounded-md glance — the shape survives only on the band's fold control; the chip's element window wears the family's face)",
    (() => {
      const at = kpiForCC.indexOf('data-testid="fleet-kpi-memory"');
      const win = at >= 0 ? kpiForCC.slice(at, at + 700) : "";
      return win.includes("rounded-full bg-muted/60") && !win.includes("size-5");
    })());
}

/* ---- H band: the ONE ARITHMETIC + the FIFTH MOUTH (t1058) ---- */
{
  const diagLib = readFileSync(path.join(ROOT, "src/lib/diagnostics.ts"), "utf8");
  const diagDialog = readFileSync(
    path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"),
    "utf8"
  );
  const types = readFileSync(path.join(ROOT, "src/lib/types.ts"), "utf8");
  const kpiSrcForH = readFileSync(
    path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"),
    "utf8"
  );
  const fmt = (n) => `${n} B`;
  const stamp = () => "9m ago";

  pin("H1 the delta's arithmetic is LIVE — the five kinds answer with their magnitudes",
    (() => {
      try {
        const begins = fleetTrendDelta({ history: [], currentBytes: 100 });
        const hole = fleetTrendDelta({
          history: [{ at: "2026-10-16T10:00:00Z", bytes: null }], currentBytes: 100,
        });
        const up = fleetTrendDelta({
          history: [{ at: "2026-10-16T10:00:00Z", bytes: 1000 }], currentBytes: 3500,
        });
        const down = fleetTrendDelta({
          history: [{ at: "2026-10-16T10:00:00Z", bytes: 3500 }], currentBytes: 1000,
        });
        const same = fleetTrendDelta({
          history: [{ at: "2026-10-16T10:00:00Z", bytes: 1000 }], currentBytes: 1000,
        });
        return begins.kind === "begins" && begins.prev === null && begins.deltaBytes === 0 &&
          hole.kind === "hole" && hole.prev !== null && hole.deltaBytes === 0 &&
          up.kind === "up" && up.deltaBytes === 2500 && up.prev?.bytes === 1000 &&
          down.kind === "down" && down.deltaBytes === 2500 &&
          same.kind === "same" && same.deltaBytes === 0;
      } catch {
        return false;
      }
    })());
  pin("H2 the voice rides the delta — the spec's Up words agree with the well's arithmetic, LIVE",
    (() => {
      try {
        const spec = fleetTrendSpec({
          history: [{ at: "2026-10-16T10:00:00Z", bytes: 1000 }],
          currentBytes: 3000, currentAt: "2026-10-16T10:09:00Z", fmtBytes: fmt, stampAgo: stamp,
        });
        const delta = fleetTrendDelta({
          history: [{ at: "2026-10-16T10:00:00Z", bytes: 1000 }], currentBytes: 3000,
        });
        return delta.kind === "up" && delta.deltaBytes === 2000 &&
          spec.voice === "Up 2000 B since the measure 9m ago — the workdirs grew.";
      } catch {
        return false;
      }
    })());
  pin("H3 the spec carries ringCount from its ONE home — LIVE (past only, the current not yet in the ring)",
    (() => {
      try {
        const s = fleetTrendSpec({
          history: [
            { at: "2026-10-16T09:00:00Z", bytes: 1000 },
            { at: "2026-10-16T10:00:00Z", bytes: 2000 },
          ],
          currentBytes: 3000, currentAt: "2026-10-16T10:09:00Z", fmtBytes: fmt, stampAgo: stamp,
        });
        const empty = fleetTrendSpec({
          history: [], currentBytes: 1, currentAt: "2026-10-16T10:09:00Z", fmtBytes: fmt, stampAgo: stamp,
        });
        return s.ringCount === 2 && empty.ringCount === 0 && s.bars.length === 3;
      } catch {
        return false;
      }
    })());
  pin("H4 the AI's server breath drinks the WELL (the t1055 inline twin is dead — twins fork, imports don't; t1063: the span voice joins the drink; t1065: the hole pair too; t1069: the hole count too; t1071: the deepest silence too; t1096 re-key — the mirror delta joins: the SECOND CHANNEL drinks the same well; t1099 re-key — the ceiling face joins: the share's own weather rides the same import; t1100 re-key — the unmirrored count joins: the naming's ONE home rides the same import; t1109 re-key — the hole SUMMARY joins: the silences' sentence rides the same import)",
    /import \{ fleetTrendDelta, fleetTrendMirrorDelta, fleetTrendSpanVoice, fleetTrendHolePair, fleetTrendHoleCount, fleetTrendHoleDeepest, fleetTrendHoleSummary, fleetTrendCeilingFace, fleetUnmirroredRuns, FLEET_TREND_RING_CAP \} from "@\/lib\/remote\/fleet-trend"/.test(aiTools) &&
      aiTools.includes("fleetTrendDelta({ history: c.history, currentBytes: c.remoteBytesTotal })") &&
      !aiTools.includes("c.remoteBytesTotal > prevPoint.bytes"));
  pin("H5 the AI band speaks the ring's length against the cap",
    aiTools.includes("` · ring ${c.history.length}/${FLEET_TREND_RING_CAP}`"));
  pin("H6 the card's strip speaks the ring chip from the spec's ONE home (and the bars grow their floor + hover)",
    card.includes("ring {spec.ringCount}/{FLEET_TREND_RING_CAP}") &&
      card.includes("border-b border-border/50") &&
      card.includes("transition-colors motion-reduce:transition-none hover:bg-primary/60"));
  pin("H7 the KPI spark's title speaks the ring's length",
    kpiSrcForH.includes("Ring ${spec.ringCount}/${FLEET_TREND_RING_CAP} remembered"));
  pin("H8 the diagnostics well grows the fleet memory (the reader rides the payload)",
    /import \{ readFleetSidecarMemory, type FleetSidecarMemory \} from "@\/lib\/remote\/fleet-ledger"/.test(diagLib) &&
      diagLib.includes("fleet: readFleetSidecarMemory()") &&
      lib.includes("export function readFleetSidecarMemory"));
  pin("H9 the AI's box summary speaks the fleet clause (three honest states, one breath)",
    diagLib.includes("fleet memory: ${f.totalPoints} remembered measure") &&
      diagLib.includes("the sidecar exists but no ring remembers a measure yet") &&
      diagLib.includes("no sidecar yet — the first Measure now on a project with remote runs writes it"));
  pin("H10 the diagnostics dialog renders the fleet memory section with its honest empties",
    diagDialog.includes('testid="diag-fleet"') &&
      diagDialog.includes("data-testid=\"diag-fleet-rings\"") &&
      diagDialog.includes("data-testid=\"diag-fleet-nosidecar\"") &&
      diagDialog.includes("data-testid=\"diag-fleet-empty\"") &&
      diagDialog.includes("ring {r.points}/{FLEET_TREND_RING_CAP}"));
  pin("H11 the client mirror carries the fleet memory (the client never imports the server module)",
    types.includes("export interface FleetSidecarMemoryClient") &&
      types.includes("export interface FleetMemoryRingClient") &&
      /fleet: FleetSidecarMemoryClient;/.test(types));
}

/* ---- I band: the SIXTH MOUTH + the style dialect's second seat (t1059) ---- */
{
  const libSrc = readFileSync(path.join(ROOT, "src/lib/remote/fleet-ledger.ts"), "utf8");
  const types = readFileSync(path.join(ROOT, "src/lib/types.ts"), "utf8");
  const aiToolsForI = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");
  const diagDialogForI = readFileSync(
    path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"),
    "utf8"
  );
  const memWin = aiToolsForI.indexOf('name: "get_fleet_memory"');
  const memSlice = memWin > 0 ? aiToolsForI.slice(memWin, memWin + 2000) : "";
  const memImplWin = aiToolsForI.indexOf("/* ---- get_fleet_memory");
  const memImpl = memImplWin > 0 ? aiToolsForI.slice(memImplWin, memImplWin + 8000) : "";

  pin("I1 the reader carries the ring's SECOND point (a fact on disk — history[1] or nothing, never derived)",
    libSrc.includes("prevAt: string | null") && libSrc.includes("prevBytes: number | null") &&
      libSrc.includes("const prev = history[1] ?? null;"));
  pin("I2 the client mirror grows the two ends too (the structural twin never lags)",
    /prevAt: string \| null;\s*\n\s*prevBytes: number \| null;/.test(types));
  pin("I3 the drill registers — schema, dispatch, executor",
    memWin > 0 && aiToolsForI.includes('case "get_fleet_memory":') &&
      aiToolsForI.includes("await getFleetMemory(ctx)"));
  pin("I4 the drill's honest empties (no sidecar / sidecar-but-empty are SAID, never faked)",
    memImpl.includes("has no sidecar yet") && memImpl.includes("every ring is empty"));
  pin("I5 the per-ring delta drinks the ONE well ([prev] is the history, the newest point is the current)",
    memImpl.includes("fleetTrendDelta({") && memImpl.includes("history: r.prevAt != null ? [{ at: r.prevAt, bytes: r.prevBytes }] : []"));
  pin("I6 the names come from the world (the sidecar knows only ids — one indexed db read resolves them)",
    memImpl.includes("db.project.findMany") && memImpl.includes("projectName: nameOf.get(r.projectId)"));
  pin("I7 the FIRST mouth drinks the style dialect (the dialog's strip: the hairline, the brighten, the chip — the card's t1058 words; t1063: the hairline grew the reach caption between the attribute and the map)",
    /aria-hidden="true"\s*\n\s*title=\{reach \?\? undefined\}\s*>\s*\{spec\.bars\.map/.test(dialog) &&
      /border-b border-border\/50 pb-px/.test(dialog) &&
      dialog.includes("transition-colors motion-reduce:transition-none hover:bg-primary/60") &&
      dialog.includes("ring {spec.ringCount}/{FLEET_TREND_RING_CAP}") &&
      dialog.includes('data-testid={`fleet-ring-${conn.connectionId ?? "orphan"}`}'));

  pin("I8 the diagnostics fleet rows grow the fullness meter (the N/12 a bar the eye can weigh; decoration, aria-hidden)",
    diagDialogForI.includes('className="hidden h-1 w-14 shrink-0 overflow-hidden rounded-full bg-muted sm:block"') &&
      diagDialogForI.includes("Math.min((r.points / FLEET_TREND_RING_CAP) * 100, 100)"));

  pin("I9 LIVE the diagnostics route's rings carry the two ends (the reader's facts served hot)",
    await (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const ring = body?.fleet?.rings?.[0];
        return res.status === 200 && body?.fleet?.sidecar === true &&
          ring != null && "prevAt" in ring && "prevBytes" in ring &&
          typeof ring.points === "number" && ring.points >= 2;
      } catch {
        return false;
      }
    })());
}

/* ---- J band: the MEMORY'S DEPTH (t1060) ---- */
{
  const libSrc = readFileSync(path.join(ROOT, "src/lib/remote/fleet-ledger.ts"), "utf8");
  const types = readFileSync(path.join(ROOT, "src/lib/types.ts"), "utf8");
  const aiToolsForJ = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");
  const diagDialogForJ = readFileSync(
    path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"),
    "utf8"
  );
  const jImplWin = aiToolsForJ.indexOf("/* ---- get_fleet_memory");
  const jImpl = jImplWin > 0 ? aiToolsForJ.slice(jImplWin, jImplWin + 11000) : "";

  pin("J1 the reader carries the ring's FULL memory (newest first, defensively capped at read — the E4 law's third face; t1095 re-key — the FULL memory carries the SECOND CHANNEL beside the cluster bytes)",
    libSrc.includes("history: { at: string; bytes: number | null; mirrorBytes?: number | null }[];") &&
      libSrc.includes("history: history.slice(0, FLEET_HISTORY_CAP),"));
  pin("J2 the mirror carries the full ring too (the structural twin never lags; t1095 re-key — the twin wears the optional channel)",
    types.includes("history: { at: string; bytes: number | null; mirrorBytes?: number | null }[];"));
  pin("J3 the drill's SPAN clause drinks the ONE voice (fleetTrendSpanVoice — the span story's one home; the private IIFE and its second delta call are dead — t1063)",
    jImpl.includes("fleetTrendSpanVoice({ history: r.history, fmtBytes, stampAgo: graveAgeLike })") &&
      !jImpl.includes("fleetTrendDelta({ history: [oldest]") &&
      jImpl.includes("r.lastBytes == null"));
  pin("J4 the span's honest voices live in the ONE voice now (the well names the far-end hole; the drill keeps only the newest-end silence, and the summary's join speaks an honest space)",
    !jImpl.includes("the far end is an honest hole.") &&
      jImpl.includes("r.lastBytes == null") &&
      jImpl.includes('r.span ? ` ${r.span}` : ""'));
  pin("J5 the locator breath names the memory's depth (the oldest answered measure anywhere)",
    jImpl.includes("oldestEverywhere") && jImpl.includes("the oldest measure landed "));
  pin("J6 the OPS row's title reaches (t1065: the reach hoisted to the row — ONE span voice drunk by the title and the spark caption alike; the inline reaching fork is dead; the two-case join — the well sentence carries its own stop, the null case lands its own)",
    diagDialogForJ.includes("const reach = fleetTrendSpanVoice({") &&
      diagDialogForJ.includes("${reach ? `. ${reach}` : \".\"} The sidecar") &&
      !diagDialogForJ.includes(", reaching ${diagStampAgo"));
  pin("J7 LIVE the route's rings carry the full array (the depth served hot — real sidecar, newest first)",
    await (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const ring = body?.fleet?.rings?.[0];
        return res.status === 200 &&
          Array.isArray(ring?.history) && ring.history.length >= 2 &&
          ring.history[0].at >= ring.history[ring.history.length - 1].at;
      } catch {
        return false;
      }
    })());
}

/* ---- K band: the SEVENTH MOUTH + the loop closes (t1061) ---- */
{
  const trendWell = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const diagDialogForK = readFileSync(
    path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"),
    "utf8"
  );
  const dialogForK = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const cardForK = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const headerForK = readFileSync(path.join(ROOT, "src/components/workflow/header.tsx"), "utf8");

  pin("K1 the well grows the loop-closer's bell (FLEET_DIAG_FOCUS_EVENT named once, in the client-safe home)",
    trendWell.includes('export const FLEET_DIAG_FOCUS_EVENT = "cryoflow:focus-fleet-diagnostics";'));
  pin("K2 the well grows the ring's OWN shape (fleetTrendRingBars: no current appended, the ring IS the story)",
    trendWell.includes("export function fleetTrendRingBars(args: {") &&
      !/fleetTrendRingBars[\s\S]{0,1400}bars\.push/.test(trendWell) &&
      /const newest = i === past\.length - 1;/.test(trendWell));
  pin("K3 the ring-bars arithmetic is the spec's own law (max over what draws, the 4px floor, the scale injected)",
    /fleetTrendRingBars[\s\S]{0,1600}Math\.max\(\.\.\.past\.map\(\(p\) => p\.bytes \?\? 0\), 1\)/.test(trendWell) &&
      /fleetTrendRingBars[\s\S]{0,1600}FLEET_TREND_BAR_MIN_PX\}px/.test(trendWell) &&
      trendWell.includes("scalePx?: number;\n}): { bars: FleetTrendBar[]; maxBytes: number }"));
  pin("K4 the SEVENTH MOUTH — the OPS row's micro-spark drinks the well (scalePx 12, the hairline, aria-hidden)",
    diagDialogForK.includes("fleetTrendRingBars({") &&
      diagDialogForK.includes("scalePx: 12,") &&
      diagDialogForK.includes('className="flex shrink-0 items-end gap-px border-b border-border/50 pb-px"') &&
      diagDialogForK.includes('aria-hidden="true"'));
  pin("K5 the spark keeps the family dialect (the hole's dashed stub — t1064: the stub class grew the trailing denser-edge ternary, the muted /50 branch stands — the newest's full-primary seat, motion-reduce still)",
    diagDialogForK.includes('bar.trailing') &&
      diagDialogForK.includes('"inline-block w-[3px] rounded-sm border border-dashed border-muted-foreground/50"') &&
      diagDialogForK.includes('"w-[3px] rounded-sm bg-primary/70 ring-1 ring-primary/40 transition-colors motion-reduce:transition-none hover:bg-primary"') &&
      diagDialogForK.includes('"w-[3px] rounded-sm bg-primary/30 transition-colors motion-reduce:transition-none hover:bg-primary/60"'));
  pin("K6 the storage chip grows a handle (the button when the wire rides, the readout stays when it doesn't)",
    dialogForK.includes("onOpenFleetDiagnostics?: () => void;") &&
      /onOpenFleetDiagnostics \? \(/.test(dialogForK) &&
      dialogForK.includes("A click opens System diagnostics at the fleet memory section.") &&
      dialogForK.includes("open the fleet memory section in System diagnostics") &&
      dialogForK.includes('data-testid={`fleet-ring-${conn.connectionId ?? "orphan"}`}'));
  pin("K7 the card's chip rings the bell (dispatch, same words, the seat never mounts a second panel)",
    cardForK.includes("window.dispatchEvent(new CustomEvent(FLEET_DIAG_FOCUS_EVENT))") &&
      cardForK.includes("A click opens System diagnostics at the fleet memory section.") &&
      cardForK.includes('data-testid={`fleet-card-ring-${props.connectionId}`}'));
  pin("K8 the header owns the hop (the bell's ear closes storage, sets the fleet ask, opens the panel; plain opens clear it)",
    headerForK.includes("window.addEventListener(FLEET_DIAG_FOCUS_EVENT, focus)") &&
      headerForK.includes('setDiagFocus("fleet");') &&
      headerForK.includes("if (!v) setDiagFocus(null);") &&
      headerForK.includes("focusSection={diagFocus}") &&
      headerForK.includes("onOpenFleetDiagnostics={() => {"));
  pin("K9 the panel lands (focusSection prop, the region's OWN scrollTop — never a page-dragging scrollIntoView, the pulse, reduced motion)",
    diagDialogForK.includes('focusSection?: "fleet" | null;') &&
      diagDialogForK.includes("region.scrollTo({") &&
      diagDialogForK.includes('behavior: reduced ? "auto" : "smooth",') &&
      diagDialogForK.includes('className={cn(fleetPulse && "ring-2 ring-primary/60")}') &&
      diagDialogForK.includes("sectionRef={fleetSectionRef}"));
  pin("K10 LIVE the route still serves the ring whole (the spark's fuel hot — points ≥ 2 with stamps and bytes)",
    await (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const ring = body?.fleet?.rings?.[0];
        return res.status === 200 &&
          Array.isArray(ring?.history) && ring.history.length >= 2 &&
          ring.history.every((p) => typeof p?.at === "string" && (p?.bytes === null || typeof p?.bytes === "number"));
      } catch {
        return false;
      }
    })());
}

/* ---- L band: the HOP DIALECT + the third seat (t1062) ---- */
{
  const trendWell = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const diagDialogForL = readFileSync(
    path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"),
    "utf8"
  );
  const kpiForL = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");

  pin("L1 the bar grows the HOP (hopKind rides FleetTrendBar, the delta's own vocabulary)",
    trendWell.includes("hopKind?: FleetTrendDeltaKind;"));
  pin("L2 the hop walk is ONE copy — both builders return through it (the spec's and the ring's; t1067 the returns grew the SECOND pass — the entry edge walks after the hop walk; t1070 the THIRD pass — the gap mark walks after the edge, all three walks ride each return)",
    trendWell.includes("function withHopKinds(bars: FleetTrendBar[]): FleetTrendBar[]") &&
      trendWell.includes("return { bars: withRunFirsts(withHopEdges(withHopKinds(bars))), maxBytes };") &&
      /return \{\n    bars: withRunFirsts\(withHopEdges\(withHopKinds\(bars\)\)\),\n    maxBytes,\n    prev,\n    voice,\n    ringCount: history\.length,\n  \};/.test(trendWell));
  pin("L3 the walk's honest vocabulary (first drawn says begins, a hop across a hole says hole, up/down/same by sign)",
    /if \(i === 0\) return \{ \.\.\.bar, hopKind: "begins" as const \};/.test(trendWell) &&
      trendWell.includes('if (prev.bytes == null || bar.bytes == null) {\n      return { ...bar, hopKind: "hole" as const };') &&
      trendWell.includes('d > 0 ? ("up" as const) : d < 0 ? ("down" as const) : ("same" as const)'));
  pin("L4 the well grows the REACH sentence (fleetTrendSpanVoice — the span story's one home; t1063 — the words are the drill's richer dialect: on the cluster then / the ring's reach; t1095 re-key — the far-hole sentence composes with the mirror clause now: `an honest hole.${mirror}`)",
    trendWell.includes("export function fleetTrendSpanVoice(args: {") &&
      trendWell.includes("if (history.length < 2) return null;") &&
      trendWell.includes("if (newest.bytes == null) return null;") &&
      trendWell.includes("— but the far end is an honest hole.${mirror}`") &&
      trendWell.includes("on the cluster then, up ") &&
      trendWell.includes("on the cluster then, down ") &&
      trendWell.includes("flat across the ring's reach ("));
  pin("L5 the OPS spark paints the hops (up = warning amber, down = running teal, flat = primary; the current's seat keeps the identity ring)",
    diagDialogForL.includes('"w-[3px] rounded-sm bg-warning-500/80 ring-1 ring-primary/40 transition-colors motion-reduce:transition-none hover:bg-warning-500"') &&
      diagDialogForL.includes('"w-[3px] rounded-sm bg-running-500/80 ring-1 ring-primary/40 transition-colors motion-reduce:transition-none hover:bg-running-500"') &&
      diagDialogForL.includes('"w-[3px] rounded-sm bg-warning-500/70 transition-colors motion-reduce:transition-none hover:bg-warning-500"') &&
      diagDialogForL.includes('"w-[3px] rounded-sm bg-running-500/70 transition-colors motion-reduce:transition-none hover:bg-running-500"') &&
      diagDialogForL.includes("const hopClass = (bar: (typeof spark.bars)[number])"));
  pin("L6 the spark's caption is the reach (the group's title speaks the span voice; a silent reach omits it)",
    diagDialogForL.includes("const reach = fleetTrendSpanVoice({") &&
      diagDialogForL.includes("title={reach ?? undefined}"));
  pin("L7 the loop's THIRD SEAT (the KPI band's memory chip rings the bell — a sibling button, never button-in-button; t1086 re-key — the name is the family's count-carrying shape now, the countless form retired to the CC band's guard)",
    kpiForL.includes('data-testid="fleet-kpi-memory"') &&
      kpiForL.includes("window.dispatchEvent(new CustomEvent(FLEET_DIAG_FOCUS_EVENT))") &&
      kpiForL.includes("Ring ${spec.ringCount} of ${FLEET_TREND_RING_CAP} remembered measures — open the fleet memory section in System diagnostics") &&
      /<span key="fleet" className="inline-flex items-center gap-0\.5">/.test(kpiForL) &&
      kpiForL.includes("<History className=\"size-3\" aria-hidden=\"true\" />"));
  pin("L8 the economy law holds (the seat lives inside the trend item's own gate — one wrapper, one gate, the band never grows noise)",
    /if \(fleet && fleet\.projectId === projectId\) \{\s*\n\s*const spec = fleetTrendSpec/.test(kpiForL) &&
      kpiForL.includes("the chip beside opens the ring's full story in System diagnostics"));
}

/* ---- M band: the DIALECT REACHES EVERY MOUTH (t1063 — the strips
 * and the KPI sparkline paint the hops; the strips' hairlines carry
 * the reach caption; the drill drinks the ONE voice) ---- */
{
  const trendWellForM = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const cardForM = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForM = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const kpiForM = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");
  const toolsForM = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");

  // the hop color classes, once (the strips' w-3 dialect — the fill
  // speaks the hop, the current keeps its identity ring, hover
  // brightens per color, motion-reduce keeps it all still)
  const hopClasses = [
    '"w-3 rounded-sm bg-warning-500/80 ring-1 ring-primary/40 transition-colors motion-reduce:transition-none hover:bg-warning-500"',
    '"w-3 rounded-sm bg-running-500/80 ring-1 ring-primary/40 transition-colors motion-reduce:transition-none hover:bg-running-500"',
    '"w-3 rounded-sm bg-warning-500/70 transition-colors motion-reduce:transition-none hover:bg-warning-500"',
    '"w-3 rounded-sm bg-running-500/70 transition-colors motion-reduce:transition-none hover:bg-running-500"',
  ];
  const stripPaints = (src) =>
    hopClasses.every((c) => src.includes(c)) &&
    src.includes("const hopClass = (bar: (typeof spec.bars)[number])");

  pin("M1 the card strip paints the hops (the SECOND mouth adopts the well's dialect — the OPS spark led, the card follows)",
    stripPaints(cardForM));
  pin("M2 the dialog strip paints the hops (the FIRST mouth follows — no mouth left in the old all-primary dialect among the strips)",
    stripPaints(dialogForM));
  pin("M3 the KPI sparkline paints the hops (the FOURTH mouth's compact seat: fills speak, no new hover — the glance band keeps its no-hover compactness)",
    kpiForM.includes("bg-warning-500/80") && kpiForM.includes("bg-running-500/80") &&
      kpiForM.includes("bg-warning-500/70") && kpiForM.includes("bg-running-500/70") &&
      kpiForM.includes("the hop dialect's fourth seat"));
  pin("M4 both strips' hairlines carry the reach caption (the span voice's second and third homes — the OPS spark's shape, the well's ONE sentence)",
    cardForM.includes("const reach = fleetTrendSpanVoice({") && cardForM.includes("title={reach ?? undefined}") &&
      dialogForM.includes("const reach = fleetTrendSpanVoice({") && dialogForM.includes("title={reach ?? undefined}"));
  pin("M5 the drill drinks the ONE voice (the span IIFE is dead — tools.ts carries NO span sentence words anymore; the well speaks alone)",
    toolsForM.includes("fleetTrendSpanVoice({ history: r.history, fmtBytes, stampAgo: graveAgeLike })") &&
      !toolsForM.includes("across the ring's reach.") &&
      !toolsForM.includes("the far end is an honest hole."));
  pin("M6 the well's sentence is the enriched dialect (on the cluster then / flat across the ring's reach — the drill's words won, every mouth rides them)",
    trendWellForM.includes("on the cluster then, up ") &&
      trendWellForM.includes("on the cluster then, down ") &&
      trendWellForM.includes("flat across the ring's reach ("));
  pin("M7 the summary's join speaks an honest space (the well's sentence arrives capitalized; the join no longer glues ago.The)",
    toolsForM.includes('r.span ? ` ${r.span}` : ""'));
}

/* ---- N band: the HOLE'S OWN VOICE (t1064 — the stubs speak their
 * situation: the neighbors' readings when both sides answered, the
 * drill's own words when the air is the ring's end; a denser trailing
 * edge, never a hop color on a stub) ---- */
{
  const trendWellForN = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const cardForN = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForN = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const kpiForN = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");
  const diagForN = readFileSync(path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"), "utf8");

  pin("N1 the hole's voice has ONE home (holeTitle; both builders' hole bars return through it)",
    trendWellForN.includes("function holeTitle(args: {") &&
      trendWellForN.includes("title: holeTitle({") &&
      trendWellForN.includes("title: holeTitle({\n            at: p.at,\n            stampAgo,"));
  pin("N2 the mid-ring hole names its neighbors' readings (the pair is a READING, never a verdict — no up/down against air; the spec's hole sees the current on its newer side)",
    trendWellForN.includes("The measures on either side read ") &&
      trendWellForN.includes("nextBytes: i < past.length - 1 ? past[i + 1].bytes : currentBytes"));
  pin("N3 the trailing hole speaks the drill's own words and carries trailing (the ring dialect's end — the air is NOW)",
    trendWellForN.includes("the newest measure heard nothing from the cluster (an honest hole)") &&
      trendWellForN.includes("trailing: newest,") &&
      trendWellForN.includes("...(newest ? { trailing: true as const } : {}),"));
  pin("N4 all four mouths draw the denser trailing edge (no hop color ever lands on a stub)",
    cardForN.includes('bar.trailing') && cardForN.includes('"inline-block size-3 rounded-sm border border-dashed border-muted-foreground/70 bg-muted/40"') &&
      dialogForN.includes('bar.trailing') && dialogForN.includes('"inline-block size-3 rounded-sm border border-dashed border-muted-foreground/70 bg-muted/40"') &&
      kpiForN.includes('bar.trailing') && kpiForN.includes('"inline-block w-[3px] rounded-[1px] border border-dashed border-muted-foreground/70 bg-muted/40"') &&
      diagForN.includes('bar.trailing') && diagForN.includes('"inline-block w-[3px] rounded-sm border border-dashed border-muted-foreground/70 bg-muted/40"'));
  pin("N5 LIVE the hole voices answer (the mid-ring pair reads its neighbors; the trailing stub speaks the drill's words)",
    (() => {
      try {
        const fmt = (n) => `${(n / 1024).toFixed(0)}K`;
        const stamp = () => "5m ago";
        const mid = fleetTrendSpec({
          history: [
            { at: "2026-10-16T10:10:00Z", bytes: 3000 },
            { at: "2026-10-16T10:05:00Z", bytes: null },
            { at: "2026-10-16T10:00:00Z", bytes: 1000 },
          ],
          currentBytes: 4000, currentAt: "2026-10-16T10:15:00Z", fmtBytes: fmt, stampAgo: stamp,
        });
        const hole = mid.bars.find((b) => b.kind === "hole");
        const trailingRing = fleetTrendRingBars({
          history: [
            { at: "2026-10-16T10:05:00Z", bytes: null },
            { at: "2026-10-16T10:00:00Z", bytes: 1000 },
          ],
          fmtBytes: fmt, stampAgo: stamp,
        });
        const trailing = trailingRing.bars[trailingRing.bars.length - 1];
        return hole?.title.includes("The measures on either side read 1K → 3K.") === true &&
          trailing?.trailing === true &&
          trailing?.title.includes("the newest measure heard nothing from the cluster") === true;
      } catch {
        return false;
      }
    })());
}

/* ---- O band: ONE VOICE, TWO MORE CUPS (t1065 — the reach joins the
 * KPI item title and the diagnostics row title; the hole READING PAIR
 * becomes its own export and the drill drinks it — every sentence the
 * ring speaks lives in the well, and every mouth that can carry a
 * sentence drinks it there) ---- */
{
  const trendWellForO = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const kpiForO = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");
  const diagForO = readFileSync(path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"), "utf8");
  const toolsForO = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");

  pin("O1 the READING PAIR is the well's own export (null when either side is air; NO trailing period — each mouth lands its own stop)",
    trendWellForO.includes("export function fleetTrendHolePair(args: {") &&
      trendWellForO.includes("if (args.olderBytes == null || args.newerBytes == null) return null;") &&
      trendWellForO.includes("read ${args.fmtBytes(args.olderBytes)} → ${args.fmtBytes(args.newerBytes)}`") &&
      !trendWellForO.includes("${args.fmtBytes(args.newerBytes)}.`"));
  pin("O2 holeTitle drinks the ONE home (the pair assembled with its stop — the stubs byte-identical, one fewer sentence owned here)",
    (() => {
      const fn = trendWellForO.slice(trendWellForO.indexOf("function holeTitle"));
      return fn.includes("fleetTrendHolePair({") &&
        fn.includes("return pair ? `${base}. ${pair}.` : `${base}.`;");
    })());
  pin("O3 LIVE the pair answers through the well (the mid-ring stub names its neighbors; a one-sided hole stands alone)",
    (() => {
      try {
        const fmt = (n) => `${(n / 1024).toFixed(0)}K`;
        const stamp = () => "5m ago";
        const both = fleetTrendSpec({
          history: [
            { at: "2026-10-16T10:10:00Z", bytes: 3000 },
            { at: "2026-10-16T10:05:00Z", bytes: null },
            { at: "2026-10-16T10:00:00Z", bytes: 1000 },
          ],
          currentBytes: 4000, currentAt: "2026-10-16T10:15:00Z", fmtBytes: fmt, stampAgo: stamp,
        });
        const hole = both.bars.find((b) => b.kind === "hole");
        const oneSide = fleetTrendRingBars({
          history: [
            { at: "2026-10-16T10:10:00Z", bytes: 3000 },
            { at: "2026-10-16T10:05:00Z", bytes: null },
          ],
          fmtBytes: fmt, stampAgo: stamp,
        });
        const midHole = oneSide.bars.find((b) => b.kind === "hole");
        return hole?.title.includes("The measures on either side read 1K → 3K.") === true &&
          midHole?.title.includes("The measures on either side") === false &&
          fleetTrendHolePair({ olderBytes: null, newerBytes: 3, fmtBytes: fmt }) === null;
      } catch {
        return false;
      }
    })());
  pin("O4 the drill hole drinks the pair (the ONE home in tools.ts — the same sentence the stubs speak; the neighbors owned by the caller, the words by the well)",
    toolsForO.includes("fleetTrendHolePair({") &&
      toolsForO.includes("olderBytes: r.history[2]?.bytes ?? null") &&
      toolsForO.includes("newerBytes: r.history[0]?.bytes ?? null") &&
      toolsForO.includes("no delta is spoken${holePair ? `. ${holePair}` : \"\"}`"));
  pin("O5 the KPI item title drinks the REACH (the fourth mouth caption — the span voice joins the voice paragraph from the ONE home; t1068 the title grew the hole summary and the honest COUNT third voice; t1086 re-key — the title SERVES now: the stories ride the break, the voice+reach gloss keeps the card's own scope, the break lands before the silences' line)",
    kpiForO.includes("fleetTrendSpec, fleetTrendSpanVoice, fleetTrendHoleSummary") &&
      kpiForO.includes("const reach = fleetTrendSpanVoice({ history: fleet.history, fmtBytes, stampAgo: kpiStampAgo })") &&
      kpiForO.includes("${spec.voice}${reach ? ` ${reach}` : \"\"}${holes ? `\\n${holes}` : \"\"}\\nRing"));
  pin("O6 the row title drinks the hoisted reach (ONE call per ring — the title and the spark caption ride the same const; the IIFE carries no second call)",
    diagForO.split("const reach = fleetTrendSpanVoice").length === 2 &&
      diagForO.includes("title={reach ?? undefined}") &&
      !/const reach = fleetTrendSpanVoice\(\{[\s\S]*?\}\);[\s\S]*?const reach = fleetTrendSpanVoice/.test(diagForO));
}

/* ---- P band: THE NINTH MOUTH + THE LIVE HOLE (t1066 — both strips
 * paragraphs drink the reach in visible text, and the world carries a
 * REAL mid-ring hole minted by a paused mock cluster: the stubs pair
 * voice photographed on true data) ---- */
{
  const cardForP = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForP = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");

  pin("P1 both strips paragraphs drink the REACH (the ninth and tenth mouths — the strip speaks the delta AND the span in visible text; the two-case join: a bare space, the well sentence lands its own stop)",
    cardForP.includes("{spec.voice}{reach ? ` ${reach}` : \"\"}") &&
      dialogForP.includes("{spec.voice}{reach ? ` ${reach}` : \"\"}"));
  pin("P2 LIVE the memory is FAITHFUL (t1092 re-key: the pause ride filled the ring with the ADJACENT silence pair — two refused probes in a row, honestly remembered — and the t1091 shape law (no two nulls adjacent) retired with it; the ride's verdict: the ring's SHAPE is not law-constrained, the memory's law is FAITHFULNESS — silences remembered exactly as they fell, adjacent or alone. The laws that survive: every point wears a real stamp and a number-or-null (never a zero wearing a hole's clothes, never a hole wearing a number's), the stamps STRICTLY DECREASE (newest first — the memory cannot reorder), the ring never exceeds the cap)",
    await (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const ring = body?.fleet?.rings?.[0]?.history;
        if (!Array.isArray(ring) || ring.length < 3) return false;
        return ring.length <= FLEET_TREND_RING_CAP &&
          ring.every((p, i) =>
            typeof p.at === "string" && p.at.length > 0 &&
            (p.bytes == null || typeof p.bytes === "number") &&
            (i === 0 || Date.parse(ring[i - 1].at) > Date.parse(p.at))
          );
      } catch {
        return false;
      }
    })());
}

/* ---- Q band: THE HONEST UNANSWERED PRESENT (t1067 — the stopped-
 * cluster mint caught the well speaking a FALSE down against an
 * all-null present: 0 - answered read as "Down 1.33 GB — something
 * was cleaned up there" while nothing was cleaned up — the cluster
 * never answered. The cure: the aggregate speaks null at the source,
 * the well learns the trailing present (the stub + the silenced
 * delta), every mouth drinks it) ---- */
{
  const wellForQ = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const ledgerForQ = readFileSync(path.join(ROOT, "src/lib/remote/fleet-ledger.ts"), "utf8");
  const cardForQ = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForQ = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const kpiForQ = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");
  const toolsForQ = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");

  pin("Q1 the well learns the UNANSWERED present (currentBytes: number | null — the null present draws the trailing stub through holeTitle's trailing branch and silences the delta BEFORE the arithmetic; no up/down against air covers the row itself now)",
    wellForQ.includes("currentBytes: number | null;") &&
      wellForQ.includes("currentBytes == null") &&
      /bars\.push\(\s*\n?\s*currentBytes == null/.test(wellForQ) &&
      wellForQ.includes("trailing: true,") &&
      wellForQ.includes("The newest measure heard nothing from the cluster (an honest hole) — no delta is spoken until it answers.") &&
      wellForQ.includes("currentBytes ?? 0, 1"));
  pin("Q2 the spec's null present speaks the honest silence, never a false down (LIVE ARITHMETIC: null current against an answered 1.4G prev — the voice is the newest-silence sentence, the closing bar is the trailing hole with the drill's own words, the max scale ignores the null)",
    (() => {
      const spec = fleetTrendSpec({
        history: [
          { at: "2026-10-16T10:00:00Z", bytes: 1500000000 },
          { at: "2026-10-16T09:00:00Z", bytes: 1500000000 },
        ],
        currentBytes: null,
        currentAt: "2026-10-16T10:30:00Z",
        fmtBytes: (n) => `${n}B`,
        stampAgo: () => "30m ago",
      });
      const closing = spec.bars[spec.bars.length - 1];
      const stubOk = closing.kind === "hole" && closing.trailing === true &&
        closing.title.includes("the newest measure heard nothing from the cluster");
      const voiceOk = spec.voice === "The newest measure heard nothing from the cluster (an honest hole) — no delta is spoken until it answers.";
      const scaleOk = spec.maxBytes === 1500000000;
      return stubOk && voiceOk && scaleOk;
    })());
  pin("Q3 the aggregate speaks NULL at the source (nothing answered is air, never a zero — remoteBytesTotal: number | null; the measured gate; the heaviest-first sort nulls last)",
    ledgerForQ.includes("remoteBytesTotal: number | null;") &&
      ledgerForQ.includes("remoteBytesTotal: measured > 0 ? remoteBytesTotal : null,") &&
      ledgerForQ.includes("(b.remoteBytesTotal ?? 0) - (a.remoteBytesTotal ?? 0)"));
  pin("Q4 the mouths drink the honest null (the card and dialog headlines read the dash, the KPI gate holds on the STAMP alone and the chip joins the two cases, the drill guards the ledger breath before the well's arithmetic)",
    cardForQ.includes('conn.remoteBytesTotal == null ? "—" : fmtBytes(conn.remoteBytesTotal)') &&
      dialogForQ.includes('conn.remoteBytesTotal == null ? "—" : fmtBytes(conn.remoteBytesTotal)') &&
      dialogForQ.includes("conn.remoteBytesTotal != null && conn.remoteBytesTotal > 0") &&
      kpiForQ.includes("typeof c.remoteBytesTotal === \"number\" ? c.remoteBytesTotal : null") &&
      kpiForQ.includes('fleet.currentBytes != null ? `${fmtBytes(fleet.currentBytes)} on the cluster') &&
      toolsForQ.includes("c.remoteBytesTotal == null") &&
      toolsForQ.includes("the newest measure heard nothing from the cluster (an honest hole in the trend)"));
  pin("Q5 LIVE the walk's ends agree on the live ring (t1092 re-key, the faithfulness law's depth-band face: the qualifying walk is the ONE mouth-guard — adjacent silences qualify NOTHING (the live pair proved it: two dashes side by side and the paragraph stayed singular) and the count's ends are the walk's own. The law: the well's ring-only count and depth agree with an independent walk over the same payload — the count counts answered-on-both-sides silences, the deepest is the OLDEST qualifier, no qualifier means no depth)",
    await (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const ring = body?.fleet?.rings?.[0]?.history;
        if (!Array.isArray(ring) || ring.length < 1) return false;
        const seq = [...ring].reverse(); // oldest → newest (draw order)
        let count = 0;
        let oldest = null;
        for (let i = 0; i < seq.length; i++) {
          if (seq[i].bytes != null) continue;
          if (i > 0 && i < seq.length - 1 && seq[i - 1].bytes != null && seq[i + 1].bytes != null) {
            count += 1;
            if (oldest == null) oldest = seq[i].at;
          }
        }
        const wellCount = fleetTrendHoleCount({ history: ring, currentBytes: null });
        const wellDeepest = fleetTrendHoleDeepest({ history: ring, currentBytes: null });
        if (wellCount !== count) return false;
        if (count === 0) return wellDeepest == null;
        return wellDeepest === oldest;
      } catch {
        return false;
      }
    })());
}

/* ---- R band: THE HOLE ENTRY EDGE (t1067 — the edge dialect's second
 * face: a hole whose LEFT neighbor answered with a COLORED hop carries
 * that dialect on the boundary where the answers stopped — the climb
 * or the cleanup ran INTO the silence, and the stub keeps the story
 * visible without hover. The arithmetic lives once in the well
 * (withHopEdges, after the hop walk); the four mouths paint it) ---- */
{
  const wellForR = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const cardForR = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForR = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const kpiForR = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");
  const diagForR = readFileSync(path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"), "utf8");

  pin("R1 the well grows the ENTRY EDGE arithmetic (withHopEdges, ONE copy, both builders pass through it AFTER the hop walk — the edge echoes what the answered neighbor already earned, never the hole's own verdict)",
    wellForR.includes("function withHopEdges(bars: FleetTrendBar[]): FleetTrendBar[]") &&
      wellForR.includes("edgeInto?: \"up\" | \"down\";") &&
      wellForR.split("withHopEdges(withHopKinds(bars))").length === 3);
  pin("R2 LIVE ARITHMETIC the edge follows the neighbor (after a down hop the hole carries edgeInto down; after a flat hop NO edge; after another hole NO chained verdict; the newest hole stays trailing with no edge; the strip builder carries the same edges)",
    (() => {
      const history = [
        { at: "2026-10-16T13:30:00Z", bytes: null },
        { at: "2026-10-16T13:00:00Z", bytes: 1420000000 },
        { at: "2026-10-16T12:30:00Z", bytes: null },
        { at: "2026-10-16T12:00:00Z", bytes: 1420000000 },
        { at: "2026-10-16T11:30:00Z", bytes: 1420000000 },
        { at: "2026-10-16T11:00:00Z", bytes: null },
        { at: "2026-10-16T10:30:00Z", bytes: 1420000000 },
        { at: "2026-10-16T10:00:00Z", bytes: 1500000000 },
      ];
      const fmt = (n) => `${n}B`;
      const stamp = () => "x ago";
      const ring = fleetTrendRingBars({ history, fmtBytes: fmt, stampAgo: stamp });
      const b = ring.bars;
      const strip = fleetTrendSpec({ history, currentBytes: 1420000000, currentAt: "2026-10-16T14:00:00Z", fmtBytes: fmt, stampAgo: stamp });
      const afterDown = b[2];
      const afterFlat = b[5];
      const afterHole = b[7];
      return (
        afterDown.kind === "hole" && afterDown.edgeInto === "down" && !afterDown.trailing &&
        afterFlat.kind === "hole" && afterFlat.edgeInto === undefined &&
        afterHole.kind === "hole" && afterHole.edgeInto === undefined && afterHole.trailing === true &&
        b[0].edgeInto === undefined &&
        strip.bars[2].edgeInto === "down" && strip.bars[5].edgeInto === undefined
      );
    })());
  pin("R3 all four mouths paint the edge (the strips at size-3 grow the wider border-l-2 dialect edge; the two sparks keep the 3px geometry and override the left color only — the stub face stays muted and dashed)",
    cardForR.includes("bar.edgeInto === \"up\"") &&
      cardForR.includes("\" border-l-2 border-l-warning-500/70\"") &&
      cardForR.includes("\" border-l-2 border-l-running-500/70\"") &&
      dialogForR.includes("bar.edgeInto === \"down\"") &&
      dialogForR.includes("\" border-l-2 border-l-warning-500/70\"") &&
      dialogForR.includes("\" border-l-2 border-l-running-500/70\"") &&
      kpiForR.includes("\" border-l-warning-500/80\"") &&
      kpiForR.includes("\" border-l-running-500/80\"") &&
      diagForR.includes("bar.edgeInto === \"up\"") &&
      diagForR.includes("\" border-l-warning-500/80\"") &&
      diagForR.includes("\" border-l-running-500/80\""));
  pin("R4 LIVE the edges follow the memory (t1091 re-key: the ride's live face contradicted the OLD label but not the band — R2's own arithmetic PINS the entry edge ON a hole (the cleanup ran INTO the silence, the stub keeps the story visible without hover); the law that survives: an edge lands only where the previous DRAWN bar is ANSWERED — holes RECEIVE the earned entry echo, never PROPAGATE one (no chain through a silence), and a hole after a flat or after another hole stays bare; R2's fixture holds the arithmetic)",
    await (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const ring = body?.fleet?.rings?.[0]?.history;
        if (!Array.isArray(ring) || ring.length < 1) return false;
        const { bars } = fleetTrendRingBars({
          history: ring,
          fmtBytes: (n) => `${n}`,
          stampAgo: () => "x",
        });
        return bars.every((p, i) => p.edgeInto == null || (i > 0 && bars[i - 1].bytes != null));
      } catch {
        return false;
      }
    })());
}

/* ---- S band: THE HOLE SUMMARY + THE THIRD VOICE (t1068 — the
 * paragraph is the strip semantics carrier and the stubs hover titles
 * never reach a screen reader, so the silences in the ring memory are
 * NAMED in visible text: the count of qualifying holes, the pair when
 * one sits alone; and the honest COUNT grows its third voice — some
 * was never the word for zero answered) ---- */
{
  const wellForS = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const cardForS = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForS = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const kpiForS = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");

  pin("S1 the well grows the HOLE SUMMARY (fleetTrendHoleSummary, ONE home: counts the qualifying holes — answered measures on both sides in the strip draw order with the current closing the line — reuses the pair when one sits alone, null when none qualify; t1069 the plural names the NEWEST silence's age through the caller's own stampAgo)",
    wellForS.includes("export function fleetTrendHoleSummary(args: {") &&
      wellForS.includes("currentBytes: number | null;\n  fmtBytes: (n: number) => string;\n  stampAgo: (iso: string) => string;") &&
      wellForS.includes("fleetTrendHolePair({\n      olderBytes: newest.older,") &&
      wellForS.includes("the newest ${args.stampAgo(newest.at)}${deepestClause}, every one between answered measures."));
  pin("S2 LIVE ARITHMETIC the summary counts and guards (a ring with one mid-ring hole speaks the pair; a hole whose newer side is the unanswered present does not qualify; an all-answered ring says nothing; the two-hole ring speaks the count without byte spam and names the NEWEST silence's age — t1069 the stamps the hover knows, the paragraph can afford one; the singular keeps its pair)",
    (() => {
      const fmt = (n) => `${n}B`;
      const ago = (iso) => ({ "2026-10-16T13:00:00Z": "1h ago", "2026-10-16T12:00:00Z": "2h ago" }[iso] ?? "never");
      const one = fleetTrendHoleSummary({
        history: [
          { at: "2026-10-16T12:00:00Z", bytes: null },
          { at: "2026-10-16T11:00:00Z", bytes: 1400000000 },
          { at: "2026-10-16T10:00:00Z", bytes: 1420000000 },
        ],
        currentBytes: 1410000000,
        fmtBytes: fmt,
        stampAgo: ago,
      });
      const airCurrent = fleetTrendHoleSummary({
        history: [
          { at: "2026-10-16T12:00:00Z", bytes: null },
          { at: "2026-10-16T11:00:00Z", bytes: 1400000000 },
          { at: "2026-10-16T10:00:00Z", bytes: 1420000000 },
        ],
        currentBytes: null,
        fmtBytes: fmt,
        stampAgo: ago,
      });
      const none = fleetTrendHoleSummary({
        history: [
          { at: "2026-10-16T11:00:00Z", bytes: 1400000000 },
          { at: "2026-10-16T10:00:00Z", bytes: 1420000000 },
        ],
        currentBytes: 1410000000,
        fmtBytes: fmt,
        stampAgo: ago,
      });
      const two = fleetTrendHoleSummary({
        history: [
          { at: "2026-10-16T13:00:00Z", bytes: null },
          { at: "2026-10-16T12:30:00Z", bytes: 1400000000 },
          { at: "2026-10-16T12:00:00Z", bytes: null },
          { at: "2026-10-16T11:00:00Z", bytes: 1420000000 },
        ],
        currentBytes: 1410000000,
        fmtBytes: fmt,
        stampAgo: ago,
      });
      const adjacent = fleetTrendHoleSummary({
        history: [
          { at: "2026-10-16T13:00:00Z", bytes: null },
          { at: "2026-10-16T12:00:00Z", bytes: null },
          { at: "2026-10-16T11:00:00Z", bytes: 1400000000 },
          { at: "2026-10-16T10:00:00Z", bytes: 1420000000 },
        ],
        currentBytes: 1410000000,
        fmtBytes: fmt,
        stampAgo: ago,
      });
      return (
        one === "An honest silence sits in the ring's memory — The measures on either side read 1400000000B → 1410000000B." &&
        airCurrent === null &&
        none === null &&
        two === "2 honest silences sit in the ring's memory, the newest 1h ago, the deepest 2h ago, every one between answered measures." &&
        adjacent === null
      );
    })());
  pin("S3 LIVE the world paragraph summary agrees (the fleet-ledger route band through the well: the summary count matches an independent qualifying count from the same payload)",
    await (async () => {
      try {
        const res = await fetch(ROUTE, {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const c = body?.connections?.[0];
        if (!c || !Array.isArray(c.history) || c.history.length === 0) return false;
        const summary = fleetTrendHoleSummary({ history: c.history, currentBytes: c.remoteBytesTotal ?? null, fmtBytes: (n) => `${n}`, stampAgo: (iso) => iso });
        const seq = c.remoteBytesTotal == null ? [...c.history].reverse() : [...[...c.history].reverse(), { bytes: c.remoteBytesTotal }];
        let expect = 0;
        for (let i = 0; i < seq.length; i++) {
          if (seq[i].bytes != null) continue;
          if (i > 0 && i < seq.length - 1 && seq[i - 1].bytes != null && seq[i + 1].bytes != null) expect += 1;
        }
        if (expect === 0) return summary === null;
        // t1091 re-key: the ride's hole made the SINGULAR branch live for
        // the first time — the plural-only expectation bit the singular's
        // own words. The summary's own grammar is the law: the singular
        // speaks "An honest silence" with its pair, the plural speaks the
        // count. The independent walk and the well already agree on HOW
        // MANY; this pin now also agrees on HOW SPOKEN.
        if (expect === 1)
          return summary != null && summary.startsWith("An honest silence sits in the ring's memory");
        return summary != null && summary.startsWith(`${expect} honest silences`);
      } catch {
        return false;
      }
    })());
  pin("S4 the three mouths drink the summary (t1075 re-key, grown again by t1077; t1096 re-key — the card's bytes paragraph grows the mirror hop's join; t1086 re-key — the KPI title's one-cup exception is RETIRED: the accessible description serves like the rendered prose, the strips' second paragraph wears the notch and the KPI title's silences wear the break — the second voice's own line in both dialects)",
    cardForS.includes("{spec.voice}{reach ? ` ${reach}` : \"\"}{mirrorHop ? ` ${mirrorHop}` : \"\"}</p>") &&
      dialogForS.includes("{spec.voice}{reach ? ` ${reach}` : \"\"}") &&
      cardForS.includes("<p className=\"mt-1 border-l-2 border-l-muted-foreground/30 pl-2 text-[11px] text-muted-foreground\">{holes}</p>") &&
      dialogForS.includes("<p className=\"mt-1 border-l-2 border-l-muted-foreground/30 pl-2 text-[11px] text-muted-foreground\">{holes}</p>") &&
      kpiForS.includes("${holes ? `\\n${holes}` : \"\"}\\nRing ${spec.ringCount}"));
  pin("S5 the honest COUNT third voice (the well speaks three steps — every · some · silence; the card header chip and the KPI title drink it, the dialog band keeps its precise N-of-M)",
    wellForS.includes("export function fleetUnansweredVoice(measured: number, total: number): string") &&
      wellForS.includes("? \"every workdir went unanswered\"") &&
      wellForS.includes(": \"some workdirs went unanswered\"") &&
      fleetUnansweredVoice(0, 10) === "every workdir went unanswered" &&
      fleetUnansweredVoice(3, 10) === "some workdirs went unanswered" &&
      fleetUnansweredVoice(10, 10) === "" &&
      fleetUnansweredVoice(5, 0) === "" &&
      cardForS.includes("fleetUnansweredVoice(aggMeasured, aggJobs)") &&
      cardForS.includes("{unansweredHeader}") &&
      kpiForS.includes("fleet.unanswered ? `, ${fleet.unanswered}` : \"\""));
}

/* ---- T band: THE COUNT'S FAMILY (t1069 — the qualifying walk leaves
 * the summary's lap as fleetTrendHoleCount, ONE arithmetic now a NUMBER:
 * the diagnostics row's stamp grows "· 4 holes" beside the bytes, the
 * drill's per-ring band names the memory's silences, and the summary's
 * plural sentence grows the NEWEST silence's age) ---- */
{
  const wellForT = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const diagForT = readFileSync(path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"), "utf8");
  const toolsForT = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");

  pin("T1 the well grows the COUNT (fleetTrendHoleCount, ONE home — the summary's own walk as a number: the qualifying arithmetic, answered measures on both sides; ring-ONLY mouths pass currentBytes: null — a hole at the ring's newest end has no newer reading and does not qualify; an answered current closes the line so the past's newest hole qualifies)",
    wellForT.includes("export function fleetTrendHoleCount(args: {") &&
      wellForT.includes("history: FleetTrendPoint[];\n  currentBytes: number | null;\n}): number") &&
      wellForT.includes("function walkQualifyingHoles(seq: FleetTrendPoint[])") &&
      wellForT.includes("return walkQualifyingHoles(seq).count;") &&
      (() => {
        // the as-left world's shape: 12 points, 4 mid-ring holes
        const A = 1425555057;
        const ring = [A, null, A, A, null, A, A, null, A, A, null, A].map((b, i) => ({
          at: `2026-10-16T${String(14 + i).padStart(2, "0")}:00:00Z`,
          bytes: b,
        }));
        const trailingAir = fleetTrendHoleCount({
          history: [
            { at: "2026-10-16T12:00:00Z", bytes: null },
            { at: "2026-10-16T11:00:00Z", bytes: 1400000000 },
            { at: "2026-10-16T10:00:00Z", bytes: 1420000000 },
          ],
          currentBytes: null,
        });
        const trailingClosed = fleetTrendHoleCount({
          history: [
            { at: "2026-10-16T12:00:00Z", bytes: null },
            { at: "2026-10-16T11:00:00Z", bytes: 1400000000 },
            { at: "2026-10-16T10:00:00Z", bytes: 1420000000 },
          ],
          currentBytes: 1410000000,
        });
        const adjacent = fleetTrendHoleCount({
          history: [
            { at: "2026-10-16T13:00:00Z", bytes: null },
            { at: "2026-10-16T12:00:00Z", bytes: null },
            { at: "2026-10-16T11:00:00Z", bytes: 1400000000 },
            { at: "2026-10-16T10:00:00Z", bytes: 1420000000 },
          ],
          currentBytes: null,
        });
        const none = fleetTrendHoleCount({
          history: [
            { at: "2026-10-16T11:00:00Z", bytes: 1400000000 },
            { at: "2026-10-16T10:00:00Z", bytes: 1420000000 },
          ],
          currentBytes: 1410000000,
        });
        return (
          fleetTrendHoleCount({ history: ring, currentBytes: null }) === 4 &&
          trailingAir === 0 &&
          trailingClosed === 1 &&
          adjacent === 0 &&
          none === 0 &&
          // the count and the sentence are the ONE walk — the number
          // leads the sentence the summary speaks
          (fleetTrendHoleSummary({ history: ring, currentBytes: null, fmtBytes: (n) => `${n}`, stampAgo: (iso) => iso }) ?? "").startsWith("4 honest silences")
        );
      })());
  pin("T2 the row drinks the count (the diagnostics row's stamp names the memory's silences beside the bytes — '· 4 holes' (t1072: grown with the depth clause — '· 4 holes, deepest 3h ago', the count's own guard grew the deepest's null check beside it) — and keeps the count off when the newest measure is itself a hole, where 'a hole' already speaks a silence; ring-ONLY dialect, currentBytes: null)",
    diagForT.includes("fleetTrendHoleCount,") &&
      diagForT.includes("const holeCount = fleetTrendHoleCount({\n                        history: r.history,\n                        currentBytes: null,\n                      });") &&
      diagForT.includes("${diagStampAgo(r.lastAt)} · ${fmtBytes(r.lastBytes)}${holeCount > 0 ? ` · ${holeCount} hole${holeCount === 1 ? \"\" : \"s\"}` : \"\"}") &&
      // the reasoned guard: the count rides ONLY the answered-newest
      // branch — the "a hole" branch stays alone
      diagForT.includes("r.lastBytes != null\n                              ? <>"));
  pin("T3 the drill drinks the count (the per-ring band names the memory's silences between the ring's fullness and the newest measure's stamp — 'ring 12/12, 4 honest holes in the memory, newest measure ...'; the same ONE arithmetic, the stamp the band and the sentence can never disagree)",
    toolsForT.includes("fleetTrendHoleCount") &&
      toolsForT.includes("const holeCount = fleetTrendHoleCount({ history: r.history, currentBytes: null });") &&
      toolsForT.includes("${r.holeCount > 0 ? `, ${r.holeCount} honest hole${r.holeCount === 1 ? \"\" : \"s\"} in the memory` : \"\"}"));
  pin("T4 LIVE the world's row count agrees (t1081-R re-key: the agreement IS the law — the count the helper computes matches an independent qualifying scan of the same payload, at ANY ring age; the as-left `count > 0` richness clause retired with the reboot's reset — the young ring's zero silences are its honest face, and the row's stamp renders exactly the memory's number)",
    await (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const r = body?.fleet?.rings?.[0];
        if (!r || !Array.isArray(r.history) || r.history.length === 0) return false;
        const count = fleetTrendHoleCount({ history: r.history, currentBytes: null });
        const past = [...r.history].reverse();
        let expect = 0;
        for (let i = 0; i < past.length; i++) {
          if (past[i].bytes != null) continue;
          if (i > 0 && i < past.length - 1 && past[i - 1].bytes != null && past[i + 1].bytes != null) expect += 1;
        }
        return count === expect;
      } catch {
        return false;
      }
    })());
}

/* ---- U band: THE GAP'S MOUTH (t1070 — the boundary where the answers
 * stopped speaks the memory's WHOLE silence story: the well MARKS the
 * gap (withRunFirsts — the hole whose LEFT neighbor answered), the
 * helper composes the title (fleetTrendGapTitle — the plural only, the
 * singular's pair already lives in the stub's own title), and the
 * three title-bearing mouths pour their own dialects over ONE law) ---- */
{
  const wellForU = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const cardForU = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForU = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const diagForU = readFileSync(path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"), "utf8");
  const kpiForU = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");
  const fmtU = (n) => `${n} B`;
  const stampU = () => "9m ago";

  // the PLURAL fixture (the strips' dialect — the current closes the
  // line): draw order t0(900) t1(1000) t2(air) t3(2100) t4(air) t5(2000)
  // current(2000) — two runs, each opened by an answered left neighbor,
  // two qualifying silences. The first run rides a COLORED entry (t1's
  // hop is up) so the gap mark and the entry edge are pinned COEXISTING.
  const histU = [
    { at: "2026-10-16T10:05:00Z", bytes: 2000 },
    { at: "2026-10-16T10:04:00Z", bytes: null },
    { at: "2026-10-16T10:03:00Z", bytes: 2100 },
    { at: "2026-10-16T10:02:00Z", bytes: null },
    { at: "2026-10-16T10:01:00Z", bytes: 1000 },
    { at: "2026-10-16T10:00:00Z", bytes: 900 },
  ];
  const specU = fleetTrendSpec({
    history: histU,
    currentBytes: 2000,
    currentAt: "2026-10-16T10:09:00Z",
    fmtBytes: fmtU,
    stampAgo: stampU,
  });
  const holesU = specU.bars.filter((b) => b.kind === "hole");
  const countU = fleetTrendHoleCount({ history: histU, currentBytes: 2000 });
  const sumU = fleetTrendHoleSummary({ history: histU, currentBytes: 2000, fmtBytes: fmtU, stampAgo: stampU });

  pin("U1 the walk marks the BOUNDARY (withRunFirsts — a hole whose LEFT neighbor in draw order answered is the gap between the last answered bar and the first stub; BOTH builders pass through it; the adjacent dash and the leading stub are no boundary, and the mark coexists with the entry edge)",
    wellForU.includes("function withRunFirsts(bars: FleetTrendBar[]): FleetTrendBar[]") &&
      wellForU.includes("return prev && prev.bytes != null ? { ...bar, runFirst: true as const } : bar;") &&
      wellForU.split("withRunFirsts(withHopEdges(withHopKinds(bars)))").length === 3 &&
      holesU.length === 2 &&
      holesU.every((b) => b.runFirst === true) &&
      holesU[0].edgeInto === "up" &&
      holesU[1].edgeInto === undefined);
  pin("U2 the gap title's law (fleetTrendGapTitle ONE home — the boundary only, the PLURAL only: the singular's pair is the SAME pair the stub's own title speaks, composing it would say it twice; a null summary composes nothing; the join is the two-case lesson — t1074 the SERVE grows: a NEWLINE joins the two sentences, the tooltip's own paragraph shape, the accessible description keeps every word)",
    wellForU.includes("export function fleetTrendGapTitle(args: {") &&
      wellForU.includes("if (!args.bar.runFirst || args.holeCount < 2 || args.summary == null) return null;") &&
      wellForU.includes("return `${args.bar.title}\\n${args.summary}`;") &&
      countU === 2 &&
      sumU === "2 honest silences sit in the ring's memory, the newest 9m ago, the deepest 9m ago, every one between answered measures." &&
      fleetTrendGapTitle({ bar: holesU[0], holeCount: countU, summary: sumU }) === `${holesU[0].title}\n${sumU}` &&
      fleetTrendGapTitle({ bar: holesU[1], holeCount: countU, summary: sumU }) === `${holesU[1].title}\n${sumU}` &&
      fleetTrendGapTitle({ bar: { title: "x" }, holeCount: 2, summary: sumU }) === null &&
      fleetTrendGapTitle({ bar: holesU[0], holeCount: 1, summary: sumU }) === null &&
      fleetTrendGapTitle({ bar: holesU[0], holeCount: 2, summary: null }) === null &&
      fleetTrendGapTitle({ bar: { title: "x", runFirst: true }, holeCount: 0, summary: sumU }) === null);
  pin("U3 the ring-only boundary (the spark's dialect: a TRAILING hole after an answered bar is a boundary too — but a ring whose only silence is the trailing one qualifies nothing, so the composition stays bare; a LEADING hole has no answered side to stop from)",
    (() => {
      const ringHist = [
        { at: "2026-10-16T10:05:00Z", bytes: null },
        { at: "2026-10-16T10:04:00Z", bytes: 2100 },
        { at: "2026-10-16T10:00:00Z", bytes: 900 },
      ];
      const ring = fleetTrendRingBars({ history: ringHist, fmtBytes: fmtU, stampAgo: stampU });
      const trailing = ring.bars[ring.bars.length - 1];
      const lead = fleetTrendRingBars({
        history: [
          { at: "2026-10-16T10:05:00Z", bytes: 2100 },
          { at: "2026-10-16T10:00:00Z", bytes: null },
        ],
        fmtBytes: fmtU,
        stampAgo: stampU,
      });
      return (
        trailing.trailing === true &&
        trailing.runFirst === true &&
        fleetTrendHoleCount({ history: ringHist, currentBytes: null }) === 0 &&
        fleetTrendGapTitle({ bar: trailing, holeCount: 0, summary: null }) === null &&
        lead.bars[0].runFirst === undefined
      );
    })());
  pin("U4 LIVE the world's boundary speaks when the memory holds silences (t1081-R re-key: the t1079 honest-when-present law at the boundary zoom — the young ring's zero silences have NO boundaries and NO titles to compose, an honest pass; when the ring carries ≥ 2 silences, every run-first stub's composed title carries the plural summary; the as-left world's four boundaries were the reboot's casualty)",
    await (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const r = body?.fleet?.rings?.[0];
        if (!r || !Array.isArray(r.history) || r.history.length === 0) return false;
        const count = fleetTrendHoleCount({ history: r.history, currentBytes: null });
        if (count < 2) return true; // the young ring's honest face — no boundaries, no titles
        const summary = fleetTrendHoleSummary({ history: r.history, currentBytes: null, fmtBytes: fmtU, stampAgo: stampU });
        if (!summary) return false;
        const spark = fleetTrendRingBars({ history: r.history, fmtBytes: fmtU, stampAgo: stampU });
        const boundaries = spark.bars.filter((b) => b.runFirst === true);
        if (boundaries.length === 0) return false;
        return boundaries.every(
          (b) => fleetTrendGapTitle({ bar: b, holeCount: count, summary }) === `${b.title}\n${summary}`
        );
      } catch {
        return false;
      }
    })());
  pin("U5 the three title-bearing mouths pour their own dialects (the card and the dialog compute their own count beside the summary — the strips' present closes the line; the spark rides the ROW's own count and computes the ring-only summary; each mouth composes EXACTLY once; the KPI band stays titleless — the compactness verdict stands)",
    cardForU.includes("const holeCount = fleetTrendHoleCount({ history: props.history, currentBytes: props.currentBytes });") &&
      cardForU.split("fleetTrendGapTitle({ bar, holeCount, summary: holes }) ?? bar.title").length === 2 &&
      dialogForU.includes("const holeCount = fleetTrendHoleCount({") &&
      dialogForU.includes("history: conn.history,\n                            currentBytes: conn.remoteBytesTotal,\n                          });") &&
      dialogForU.split("fleetTrendGapTitle({ bar, holeCount, summary: holes }) ?? bar.title").length === 2 &&
      diagForU.includes("const sparkHoles = fleetTrendHoleSummary({") &&
      diagForU.includes("currentBytes: null,\n                            fmtBytes,\n                            stampAgo: diagStampAgo,\n                          });") &&
      diagForU.split("fleetTrendGapTitle({ bar, holeCount, summary: sparkHoles }) ?? bar.title").length === 2 &&
      !kpiForU.includes("fleetTrendGapTitle"));
}

/* ---- V band: THE DEEPEST SILENCE (t1071 — the count's eighth mouth:
 * the qualifying walk reads BOTH ENDS now — the OLDEST qualifier rides
 * beside the newest as fleetTrendHoleDeepest's raw fact, and the
 * drill's locator breath names how far back the BURIED silences reach
 * beside the oldest answered measure) ---- */
{
  const wellForV = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const toolsForV = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");
  const fmtV = (n) => `${n} B`;
  const stampV = () => "9m ago";

  // the SAME plural fixture the U band rides: draw order t0(900)
  // t1(1000) t2(air) t3(2100) t4(air) t5(2000) current(2000) — TWO
  // qualifying silences; the DEEPEST is t2 (the FIRST qualifier in
  // draw order), the newest stays t4 (the summary's own end).
  const histV = [
    { at: "2026-10-16T10:05:00Z", bytes: 2000 },
    { at: "2026-10-16T10:04:00Z", bytes: null },
    { at: "2026-10-16T10:03:00Z", bytes: 2100 },
    { at: "2026-10-16T10:02:00Z", bytes: null },
    { at: "2026-10-16T10:01:00Z", bytes: 1000 },
    { at: "2026-10-16T10:00:00Z", bytes: 900 },
  ];
  const deepestStrips = fleetTrendHoleDeepest({ history: histV, currentBytes: 2000 });

  pin("V1 the walk reads BOTH ENDS (oldest ??= the FIRST qualifier in draw order — symmetric to the summary's newest, still ONE walk; the count and the pair are untouched)",
    wellForV.includes("oldest: string | null;") &&
      wellForV.includes("oldest ??= seq[i].at; // draw order — the FIRST qualifier is the deepest") &&
      wellForV.includes("return { count, newest, oldest };") &&
      deepestStrips === "2026-10-16T10:02:00Z" &&
      fleetTrendHoleSummary({ history: histV, currentBytes: 2000, fmtBytes: fmtV, stampAgo: stampV }) ===
        "2 honest silences sit in the ring's memory, the newest 9m ago, the deepest 9m ago, every one between answered measures.");
  pin("V2 the deepest's home (fleetTrendHoleDeepest — the RAW stamp out, the mouths speak their own dialects; the qualifying law holds for depth too: a trailing hole is the newest end and holds no depth, adjacent silences qualify nothing, a ring with no buried silence returns null; the strips' current closes the line)",
    wellForV.includes("export function fleetTrendHoleDeepest(args: {") &&
      wellForV.includes("return walkQualifyingHoles(seq).oldest;") &&
      fleetTrendHoleDeepest({ history: [{ at: "2026-10-16T10:05:00Z", bytes: null }, { at: "2026-10-16T10:04:00Z", bytes: 2100 }], currentBytes: null }) === null &&
      fleetTrendHoleDeepest({ history: [{ at: "2026-10-16T10:05:00Z", bytes: null }, { at: "2026-10-16T10:04:00Z", bytes: null }, { at: "2026-10-16T10:00:00Z", bytes: 900 }], currentBytes: null }) === null &&
      fleetTrendHoleDeepest({ history: [{ at: "2026-10-16T10:05:00Z", bytes: 2000 }], currentBytes: 2000 }) === null &&
      fleetTrendHoleDeepest({ history: [{ at: "2026-10-16T10:05:00Z", bytes: 2000 }, { at: "2026-10-16T10:02:00Z", bytes: null }, { at: "2026-10-16T10:00:00Z", bytes: 2100 }], currentBytes: 2000 }) === "2026-10-16T10:02:00Z");
  pin("V3 the drill drinks the depth (the locator's SECOND breath — the summary's depth clause joins gated after the oldest-measure clause, the drill's own graveAgeLike over the raw stamp; ring-ONLY dialect, currentBytes: null, the same null the count walks)",
    toolsForV.includes("const deepestEverywhere =") &&
      toolsForV.includes("fleetTrendHoleDeepest({ history: r.history, currentBytes: null })") &&
      toolsForV.includes("${oldestEverywhere ? `, the oldest measure landed ${graveAgeLike(oldestEverywhere.at)}` : \"\"}${deepestEverywhere ? `, the deepest silence ${graveAgeLike(deepestEverywhere)}` : \"\"}"));
  pin("V4 LIVE the world's depth agrees when the memory holds silences (t1081-R re-key: the honest-when-present law at the depth zoom — the young ring's zero silences have no deepest to lend; when the ring carries ≥ 2 silences, the deepest matches an independent first-qualifier scan of the same payload; the as-left world's four buried silences were the reboot's casualty)",
    await (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const r = body?.fleet?.rings?.[0];
        if (!r || !Array.isArray(r.history) || r.history.length === 0) return false;
        const count = fleetTrendHoleCount({ history: r.history, currentBytes: null });
        if (count < 2) return true; // the young ring's honest face — no deepest
        const deepest = fleetTrendHoleDeepest({ history: r.history, currentBytes: null });
        const past = [...r.history].reverse();
        let expect = null;
        for (let i = 0; i < past.length; i++) {
          if (past[i].bytes != null) continue;
          if (i > 0 && i < past.length - 1 && past[i - 1].bytes != null && past[i + 1].bytes != null) {
            expect = past[i].at;
            break;
          }
        }
        return deepest != null && deepest === expect;
      } catch {
        return false;
      }
    })());
}

/* ---- W band: THE ROW'S DEPTH BESIDE THE COUNT (t1072 — the count's
 * NINTH mouth: the diagnostics row's 10px stamp names the DEEPEST
 * silence's age beside the count — the drill's t1071 breath arriving
 * at the row. The SAME walk, the SAME guard: the clause rides exactly
 * when the count does, no threshold (a "hole-heavy" constant is one
 * the world never ratified — the t1071 verdict's law), and the "a
 * hole" branch stays bare (the t1069 verdict extends: the depth is
 * the count's companion, where the count is silent the depth is
 * silent too)) ---- */
{
  const rowForW = readFileSync(
    path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"),
    "utf8",
  );

  pin("W1 the row drinks the depth (the count's NINTH mouth — the import grew fleetTrendHoleDeepest, the row's own const beside the count, the SAME ring-only dialect currentBytes: null the count walks — ONE walk, TWO ends, the stamp speaks both)",
    rowForW.includes("fleetTrendHoleDeepest,\n  fleetTrendHoleSummary,") &&
      rowForW.includes("const holeDeepest = fleetTrendHoleDeepest({\n                        history: r.history,\n                        currentBytes: null,\n                      });"));
  pin("W2 the stamp's composition (the clause is its OWN span gated on holeCount > 0 AND holeDeepest != null — the comma joins count and depth into ONE clause at 10px: '· 4 holes, deepest 3h ago'; singular and plural alike — '1 hole, deepest 3h ago' names the one silence's age no other row pixel speaks; the span rides the METER's viewport law hidden sm:inline — the 320px fold cup keeps the row's standing width, a clause clipped mid-word is worse than a clause deferred)",
    rowForW.includes("{holeCount > 0 && holeDeepest != null && (\n                                    <span className=\"hidden sm:inline\">\n                                      {`, deepest ${diagStampAgo(holeDeepest)}`}\n                                    </span>\n                                  )}"));
  pin("W3 the 'a hole' branch stays bare (the t1069 verdict extends verbatim — the trailing air already speaks a silence and the count beside it would read as a contradiction; the depth clause is the count's companion, so the a-hole ternary composes neither — the buried silences stay the strips' dashes and the hover titles' business)",
    rowForW.includes(": `${diagStampAgo(r.lastAt)} · a hole`") &&
      !/a hole`\s*\+/ .test(rowForW) &&
      !rowForW.includes("a hole`}${"));
}

/* ---- X band: THE STRIPS' SECOND AGE (t1073 — the summary's split
 * shape: the plural's reader knows HOW MANY and WHEN THE NEWEST, but
 * not the REACH — when the walk's two ends are DIFFERENT silences the
 * deepest's age joins ("the newest 1h ago, the deepest 2h ago" — the
 * one shape where two ages say more than one; the economy law judged).
 * The guard is the walks' own ends over the RAW stamps — when the ends
 * coincide (the singular's floor) the second age would repeat the
 * first and the economy withholds it. The card's and the dialog's
 * paragraphs and the gap-title hovers drink through the ONE home.) ---- */
{
  const wellForX = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const fmtX = (n) => `${n} B`;
  const agoX = (iso) =>
    ({ "2026-10-16T13:00:00Z": "1h ago", "2026-10-16T12:00:00Z": "2h ago" }[iso] ?? "never");

  pin("X1 the split rides (the well's own guard over the RAW stamps — oldest !== newest.at, no count arithmetic; the two-age sentence through the S-band's own shape: '2 honest silences sit in the ring's memory, the newest 1h ago, the deepest 2h ago, every one between answered measures.')",
    wellForX.includes("const deepestClause =\n      oldest && newest && oldest !== newest.at ? `, the deepest ${args.stampAgo(oldest)}` : \"\";") &&
      fleetTrendHoleSummary({
        history: [
          { at: "2026-10-16T13:00:00Z", bytes: null },
          { at: "2026-10-16T12:30:00Z", bytes: 1400000000 },
          { at: "2026-10-16T12:00:00Z", bytes: null },
          { at: "2026-10-16T11:00:00Z", bytes: 1400000000 },
        ],
        currentBytes: 1410000000,
        fmtBytes: fmtX,
        stampAgo: agoX,
      }) ===
        "2 honest silences sit in the ring's memory, the newest 1h ago, the deepest 2h ago, every one between answered measures.");
  pin("X2 the economy's floor (the singular's pair branch returns BEFORE the tail — 'An honest silence … — The measures on either side read …' carries no deepest clause; the type-safe tail's guard would withhold the second age when the ends coincide — the second age must name a DIFFERENT silence or it says nothing)",
    (() => {
      const one = fleetTrendHoleSummary({
        history: [
          { at: "2026-10-16T12:00:00Z", bytes: null },
          { at: "2026-10-16T11:00:00Z", bytes: 1400000000 },
          { at: "2026-10-16T10:00:00Z", bytes: 1420000000 },
        ],
        currentBytes: 1410000000,
        fmtBytes: fmtX,
        stampAgo: agoX,
      });
      return (
        one === "An honest silence sits in the ring's memory — The measures on either side read 1400000000 B → 1410000000 B." &&
        !one.includes("deepest") &&
        wellForX.includes("if (count === 1 && newest) {")
      );
    })());
  pin("X3 LIVE the world's paragraph speaks the split when the memory holds silences (t1081-R re-key: the honest-when-present law at the paragraph zoom — the young ring's zero silences have no second age to split; when the ring carries ≥ 2 silences, the summary carries the second age and the deepest's stamp — the t1071 walk's sentence, the t1073 clause's growth)",
    await (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const r = body?.fleet?.rings?.[0];
        if (!r || !Array.isArray(r.history) || r.history.length === 0) return false;
        const count = fleetTrendHoleCount({ history: r.history, currentBytes: null });
        if (count < 2) return true; // the young ring's honest face — no split to speak
        const summary = fleetTrendHoleSummary({
          history: r.history,
          currentBytes: null,
          fmtBytes: (n) => `${n}`,
          stampAgo: (iso) => iso,
        });
        const deepest = fleetTrendHoleDeepest({ history: r.history, currentBytes: null });
        return (
          summary != null &&
          summary.includes(", the deepest ") &&
          deepest != null &&
          summary.includes(`the deepest ${deepest}`)
        );
      } catch {
        return false;
      }
    })());
}

/* ---- Y band: THE TOOLTIP'S PARAGRAPH SHAPE (t1074 — the gap title's
 * SERVE: the two sentences stand as two paragraphs — the stub's pair
 * story, then the memory's whole silence story (three facts no single
 * stub knows). The NEWLINE is the break the native tooltip renders;
 * the sentence bounds are the paragraph's bounds; the accessible
 * description keeps every word. The three consumers (the card, the
 * storage dialog, the row's spark) drink through their existing title
 * attributes — no mouth edited, the join grew and every hover
 * paragraphed.) ---- */
{
  const wellForY = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const cardForY = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForY = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const rowForY = readFileSync(path.join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"), "utf8");

  pin("Y1 the join's paragraph shape (the return is the NEWLINE template — bar.title, one \\n, the summary; exactly one break between the pair story and the memory's story, no space rides the break, no trailing whitespace; the guards untouched — the boundary only, the plural only, the null composes nothing)",
    wellForY.includes("return `${args.bar.title}\\n${args.summary}`;") &&
      (() => {
        const composed = fleetTrendGapTitle({
          bar: { runFirst: true, title: "The measures on either side read 1 GB → 2 GB." },
          holeCount: 2,
          summary: "2 honest silences sit in the ring's memory, the newest 1h ago, the deepest 2h ago, every one between answered measures.",
        });
        return (
          composed != null &&
          composed.split("\n").length === 2 &&
          composed.split("\n")[0] === "The measures on either side read 1 GB → 2 GB." &&
          composed.split("\n")[1].startsWith("2 honest silences") &&
          !composed.includes(" \n") &&
          !composed.includes("\n ") &&
          !composed.endsWith("\n")
        );
      })());
  pin("Y2 the three mouths pour the same serve (the card, the storage dialog and the row's spark compose the gap title into their title attributes through the ONE home — each keeps the `?? bar.title` fallback, the singular's own voice; a title attribute takes the break the browser renders, zero layout cost — the fold probe's cup untouched)",
    cardForY.includes("fleetTrendGapTitle({ bar, holeCount, summary: holes }) ?? bar.title") &&
      dialogForY.includes("fleetTrendGapTitle({ bar, holeCount, summary: holes }) ?? bar.title") &&
      rowForY.includes("fleetTrendGapTitle({ bar, holeCount, summary: sparkHoles }) ?? bar.title"));

  // ---- the Z band — t1075, THE PARAGRAPH SHAPE'S SECOND HOME: the
  // t1074 serve taught the TOOLTIP to paragraph; the rendered prose
  // drinks the same shape now — the strips' summaries stand as their
  // own paragraphs (the bytes' story first, the silences' story
  // second; the aria law gains a real paragraph boundary where the
  // tail-join buried the silences). ----
  const cardForZ = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForZ = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const kpiForZ = readFileSync(path.join(ROOT, "src/components/workflow/pipeline-kpi.tsx"), "utf8");
  pin("Z1 the split's guard is the summary's own (both surfaces compose the second paragraph behind the holes ternary — no silences, no second paragraph, the bytes' story stands alone one paragraph as before; the mt-1 join keeps the two paragraphs one block — a tighter gap than the bars' mt-1.5, the prose convention)",
    cardForZ.includes("{holes ? (") &&
      cardForZ.includes(") : null}") &&
      dialogForZ.includes("{holes ? (") &&
      dialogForZ.includes(") : null}"));
  pin("Z2 the tail-join is retired, not forked (t1086 re-key — the old one-cup composition `}{holes ? ` — and its space-join sibling — appear in NEITHER strip surface NOR the KPI title; every home the silences' sentence has serves it: the strips' own paragraph, the KPI title's own line)",
    !cardForZ.includes("}${holes ? ` ${holes}` : \"\"}") &&
      !dialogForZ.includes("}${holes ? ` ${holes}` : \"\"}") &&
      !kpiForZ.includes("}${holes ? ` ${holes}` : \"\"}") &&
      kpiForZ.includes("${holes ? `\\n${holes}` : \"\"}\\nRing"));

  // ---- t1076 — the AA band: THE SERVE'S SWEEP (the t1074 newline serve
  // found by SHAPE across the fleet family's title attributes — the sweep
  // greped every title/prose composition and judged each by the house
  // law: distinct stories ride the break, a same-story gloss holds).
  // Four titles took the serve (six paragraphs gained); the definition
  // tails (the cluster-side's "These are the bytes…" and the KPI's own
  // one-cup joins) held — the second sentence repeats the first's
  // subject, the economy refuses. The caption's split (the sweep's fifth
  // site, the a11y prose outside this family) pins in the t1033
  // instrument where the calendar's laws live. ----
  const cardForA = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForA = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  pin("AA1 the card's header stamp takes the serve (the mechanic's sentence, then the affordance's — `measured ${stamp}.\\nMeasure now refreshes it.` byte-level, one break, no space rides it; the never-probed branch stays one sentence — nothing to break)",
    cardForA.includes("measured ${stamp}.\\nMeasure now refreshes it.`") &&
      cardForA.includes('"The cluster side has never been probed — Measure now speaks the first number."'));
  pin("AA2 the card's ring chip takes the serve (the mechanics, then the affordance — `arrive.\\nA click opens System diagnostics` byte-level; K6/K7's substring pins hold UNRE-KEYED — the serve rides BEFORE their sentence, the affordance's words unchanged)",
    cardForA.includes("arrive.\\nA click opens System diagnostics at the fleet memory section.`"));
  pin("AA3 the dialog's connection stamp takes the DOUBLE serve (provenance, then refresh, then ring memory — three paragraphs, two breaks: `time budget.\\nMeasure now re-asks` and `says so.\\nThe ring keeps`, byte-level; the never-measured branch stays one sentence)",
    dialogForA.includes("under a time budget.\\nMeasure now re-asks; the numbers only move when the cluster says so.\\nThe ring keeps") &&
      dialogForA.includes('"Never measured — Measure now asks every workdir its size over SSH for the first time."'));
  pin("AA4 the dialog's mirror band takes the serve in BOTH branches (the number's definition, then the ceiling's law — `dialog opens.\\nThe sync ceiling` in the measured branch, `dialog opens.\\n(The connection's` in the unknown branch, byte-level both)",
    dialogForA.includes("every time the dialog opens.\\nThe sync ceiling (") &&
      dialogForA.includes("every time the dialog opens.\\n(The connection's sync ceiling is unknown from here"));
  pin("AA5 the CARD's mirror band takes the serve in both branches (the sweep's recovered site — the on-camera probe caught a THIRD mirror title the grep-skip missed; same shape as the dialog's, both branches byte-level: `the walk.\\nThe sync ceiling` / `the walk.\\n(The connection's`)",
    cardForA.includes("read fresh from the walk.\\nThe sync ceiling (") &&
      cardForA.includes("read fresh from the walk.\\n(The connection's sync ceiling is unknown from here.)"));

  // ---- t1077 — the BB band: THE NOTCH (the t1075 candidate ⑤ taken —
  // the second voice's leading edge takes a 2px hairline in muted/30
  // with an 8px inset: a quiet typographic mark where the silences'
  // story begins; the bytes' voice stands unnotched; the fold probe
  // held 7/7 clean 0 overflow — the cup's slack pays the 10px). ----
  const cardForB = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForB = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const NOTCH = "mt-1 border-l-2 border-l-muted-foreground/30 pl-2 text-[11px] text-muted-foreground";
  pin("BB1 the notch rides BOTH strip surfaces byte-level (the card's strip and the dialog's band's second paragraph wear the same `border-l-2 border-l-muted-foreground/30 pl-2` — the two zooms one shape; the FIRST paragraph stands unnotched — the bytes' voice keeps its bare `mt-1.5 text-[11px]` join)",
    cardForB.includes(`<p className="${NOTCH}">{holes}</p>`) &&
      dialogForB.includes(`<p className="${NOTCH}">{holes}</p>`) &&
      cardForB.includes('<p className="mt-1.5 text-[11px] text-muted-foreground">') &&
      dialogForB.includes('<p className="mt-1.5 text-[11px] text-muted-foreground">'));
  pin("BB2 the notch is the guard's own (the class appears exactly ONCE per surface — inside the `{holes ? (` ternary; no silences, no notch, the bytes' story stands alone unmarked as before)",
    cardForB.split(NOTCH).length === 2 &&
      dialogForB.split(NOTCH).length === 2 &&
      /holes \? \(\s*\/\* t1077[^*]*\*\/\s*<p className="/.test(cardForB) &&
      /holes \? \(\s*\/\* t1077[^*]*\*\/\s*<p className="/.test(dialogForB));
}

// ---- t1095 — the AC band: THE SECOND CHANNEL (the ring learns to
// remember the MIRROR side: each point grows mirrorBytes — the local
// mirrors' own total at that measurement — and the span voice grows
// the mirrors' own clause beside the cluster's, one home, four mouths
// drunk at once. The channel's honesty laws: undefined = the point
// predates the channel (the key ABSENT on disk), null = the walk
// didn't speak — BOTH silence the clause; an end without a word never
// speaks, and the channel's youth is paid in measures, not derived.) ----
{
    const wellForAC = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
    const ledgerForAC = readFileSync(path.join(ROOT, "src/lib/remote/fleet-ledger.ts"), "utf8");

    pin("AC1 the well carries the SECOND CHANNEL's shape and voice (FleetTrendPoint.mirrorBytes optional — undefined pre-channel, null walk-silent; the clause appended INSIDE the span voice — it rides, never speaks alone; t1098 re-key: the walk lives in fleetMirrorArc and the span drinks it — `const arc = fleetMirrorArc({ history })` — the three t1095 sentences byte-for-byte through the arc's words)",
      wellForAC.includes("mirrorBytes?: number | null;") &&
        wellForAC.includes("const arc = fleetMirrorArc({ history });") &&
        wellForAC.includes("The mirrors held ${fmtBytes(arc.oldest)} here then, up ${fmtBytes(arc.deltaBytes)} across the reach.") &&
        wellForAC.includes("The mirrors held ${fmtBytes(arc.oldest)} here then, down ${fmtBytes(Math.abs(arc.deltaBytes))} across the reach.") &&
        wellForAC.includes("The mirrors held ${fmtBytes(arc.oldest)} here then, unchanged across the reach."));
    pin("AC2 the ledger carries the channel's on-disk home (SidecarConnection.mirrorBytesTotal optional; the snapshot wears the outgoing word; the fresh entry stamps mirrorBytesTotalFor with the walk's SPOKENNESS — a failed walk is null, never a zero wearing the walk's clothes)",
      ledgerForAC.includes("mirrorBytesTotal?: number | null;") &&
        ledgerForAC.includes("mirrorBytesTotal: prev.mirrorBytesTotal") &&
        ledgerForAC.includes("let mirrorWalkSpoke = false;") &&
        ledgerForAC.includes("mirrorBytesTotal: mirrorBytesTotalFor(") &&
        ledgerForAC.includes("mirrorBytesTotal: entry.mirrorBytesTotal"));
    pin("AC3 the span's mirror clause speaks all three branches INDEPENDENT of the cluster's (LIVE ARITHMETIC, verbatim sentences: the channels are two voices — a cluster-flat reach rides a mirror up AND a mirror down untouched; flat says unchanged, the local domain named `here` beside the cluster's reach clause)",
      (() => {
        const mk = (mOld, mNew) =>
          fleetTrendSpanVoice({
            history: [
              { at: "2026-10-17T10:00:00Z", bytes: 1431834642, mirrorBytes: mNew },
              { at: "2026-10-17T09:00:00Z", bytes: 1431834642, mirrorBytes: mOld },
            ],
            fmtBytes: (n) => `${n}B`,
            stampAgo: () => "1h ago",
          });
        const clusterFlat = "The ring reaches back 1h ago — flat across the ring's reach (1431834642B then and now).";
        return mk(1400000000, 1400000000) === `${clusterFlat} The mirrors held 1400000000B here then, unchanged across the reach.` &&
          mk(1400000000, 1500000000) === `${clusterFlat} The mirrors held 1400000000B here then, up 100000000B across the reach.` &&
          mk(1500000000, 1400000000) === `${clusterFlat} The mirrors held 1500000000B here then, down 100000000B across the reach.`;
      })());
    pin("AC4 an end without a word silences the clause, the newest cluster hole silences the WHOLE span, and the far hole never silences the mirror's word (LIVE ARITHMETIC: undefined AND null ends keep the sentence cluster-only; a newest cluster hole keeps the span null — the clause never resurrects it; a FAR-end cluster hole carries the mirror clause anyway — two channels, two words: the cluster's silence at the far measure says nothing about what the mirrors held, and a channel-young far hole rides bare)",
      (() => {
        const mk = (oldPoint, newPoint) =>
          fleetTrendSpanVoice({
            history: [newPoint, oldPoint],
            fmtBytes: (n) => `${n}B`,
            stampAgo: () => "1h ago",
          });
        const answeredOld = { at: "2026-10-17T09:00:00Z", bytes: 1431834642, mirrorBytes: 1400000000 };
        const answeredNew = { at: "2026-10-17T10:00:00Z", bytes: 1431834642, mirrorBytes: 1400000000 };
        const youngOld = { at: "2026-10-17T09:00:00Z", bytes: 1431834642 }; // channel-young: the key absent
        const silentOld = { at: "2026-10-17T09:00:00Z", bytes: 1431834642, mirrorBytes: null };
        const silentNew = { at: "2026-10-17T10:00:00Z", bytes: 1431834642, mirrorBytes: null };
        const holeFar = { at: "2026-10-17T09:00:00Z", bytes: null, mirrorBytes: 1400000000 };
        const holeFarYoung = { at: "2026-10-17T09:00:00Z", bytes: null };
        const base = "The ring reaches back 1h ago — flat across the ring's reach (1431834642B then and now).";
        return mk(youngOld, answeredNew) === base &&
          mk(silentOld, answeredNew) === base &&
          mk(answeredOld, silentNew) === base &&
          mk(answeredOld, { ...answeredNew, bytes: null }) === null &&
          mk(holeFar, answeredNew) === "The ring reaches back 1h ago — but the far end is an honest hole. The mirrors held 1400000000B here then, unchanged across the reach." &&
          mk(holeFarYoung, answeredNew) === "The ring reaches back 1h ago — but the far end is an honest hole.";
      })());
    pin("AC5 the outgoing point's shape, one home (LIVE ARITHMETIC: never-measured pushes nothing; a measured state pushes {at, bytes}; the channel rides EXACTLY — a number and an explicit null land on disk, undefined leaves the key ABSENT, the channel-young shape byte-for-byte)",
      (() => {
        const p1 = fleetHistoryOutgoingPoint({ measuredAt: null, bytes: 100 });
        const p2 = fleetHistoryOutgoingPoint({ measuredAt: "2026-10-17T03:37:43Z", bytes: 1431834642 });
        const p3 = fleetHistoryOutgoingPoint({ measuredAt: "2026-10-17T03:37:43Z", bytes: 1431834642, mirrorBytesTotal: 1390000000 });
        const p4 = fleetHistoryOutgoingPoint({ measuredAt: "2026-10-17T03:37:43Z", bytes: null, mirrorBytesTotal: null });
        const p5 = fleetHistoryOutgoingPoint({ measuredAt: "2026-10-17T03:37:43Z", bytes: 1431834642, mirrorBytesTotal: undefined });
        return p1 === null &&
          JSON.stringify(p2) === '{"at":"2026-10-17T03:37:43Z","bytes":1431834642}' &&
          JSON.stringify(p3) === '{"at":"2026-10-17T03:37:43Z","bytes":1431834642,"mirrorBytes":1390000000}' &&
          JSON.stringify(p4) === '{"at":"2026-10-17T03:37:43Z","bytes":null,"mirrorBytes":null}' &&
          JSON.stringify(p5) === '{"at":"2026-10-17T03:37:43Z","bytes":1431834642}' &&
          !("mirrorBytes" in p5);
      })());
    pin("AC6 the mirror total's three faces (LIVE ARITHMETIC: the walk didn't speak → null even with rows; the walk spoke → the rows' own sum; a row absent from the map is the walk's own no-mirror zero — never a guess)",
      (() => {
        const rows = new Map([
          ["j1", { bytes: 1000, exists: true }],
          ["j2", { bytes: 250, exists: true }],
        ]);
        return mirrorBytesTotalFor(["j1", "j2"], rows, false) === null &&
          mirrorBytesTotalFor(["j1", "j2"], rows, true) === 1250 &&
          mirrorBytesTotalFor(["j1", "ghost"], rows, true) === 1000 &&
          mirrorBytesTotalFor([], rows, true) === 0;
      })());
    pin("AC7 LIVE the ring's channel is FAITHFUL (every point's mirrorBytes is absent-or-null-or-a-number — never a string, never a guess; when BOTH ends of the live ring speak, the well's span voice over the SAME payload carries the mirrors' clause — the channel's words ride the one arithmetic)",
      await (async () => {
        try {
          const res = await fetch("http://localhost:3000/api/diagnostics", {
            headers: { Origin: "http://localhost:3000" },
          });
          const body = await res.json().catch(() => null);
          const ring = body?.fleet?.rings?.[0]?.history;
          if (!Array.isArray(ring) || ring.length < 2) return false;
          const shapeOk = ring.every((p) =>
            p.mirrorBytes === undefined || p.mirrorBytes === null || typeof p.mirrorBytes === "number"
          );
          const oldest = ring[ring.length - 1];
          const newest = ring[0];
          const bothSpeak = typeof oldest.mirrorBytes === "number" && typeof newest.mirrorBytes === "number";
          const span = fleetTrendSpanVoice({
            history: ring,
            fmtBytes: (n) => `${n}B`,
            stampAgo: () => "1h ago",
          });
          return shapeOk && (!bothSpeak || (span != null && span.includes("The mirrors held ")));
        } catch {
          return false;
        }
      })());
  }

// ---- t1096 — the AD band: THE MIRROR'S HOP (the SECOND CHANNEL's
// per-measure word: the mirrors' own delta beside the cluster's hop —
// the SAME fleetTrendDelta arithmetic via the channel's map (twins
// fork, maps don't); the strips' sentence names its subject ("The
// mirrors are …"), the band speaks its lowercase clause; a missing
// word on either end silences — a hop needs BOTH words) ----
{
  const wellForAD = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const cardForAD = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForAD = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const toolsForAD = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");

  pin("AD1 the well grows the hop's arithmetic AND its strips' sentence (fleetTrendMirrorDelta maps the channel into the ONE fleetTrendDelta — the silence guards speak first: no prev, a channel-young or walk-silent newest point, a silent present each return null; fleetTrendMirrorHop names the subject — 'The mirrors are up/down/unchanged since the measure …')",
    wellForAD.includes("export function fleetTrendMirrorDelta(args: {") &&
      wellForAD.includes("if (!prev || prev.mirrorBytes == null || args.currentMirrorBytes == null) return null;") &&
      wellForAD.includes("return fleetTrendDelta({") &&
      wellForAD.includes("export function fleetTrendMirrorHop(args: {") &&
      wellForAD.includes("The mirrors are up ${args.fmtBytes(delta.deltaBytes)} since the measure ${ago}.") &&
      wellForAD.includes("The mirrors are down ${args.fmtBytes(delta.deltaBytes)} since the measure ${ago}.") &&
      wellForAD.includes("The mirrors are unchanged since the measure ${ago}."));
  pin("AD2 the hop speaks all three branches verbatim (LIVE ARITHMETIC: up and down carry the exact magnitude, unchanged the flat word; the stamp is the ring's newest remembered measure)",
    (() => {
      const ring = [{ at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 }];
      const hop = (cur) => fleetTrendMirrorHop({ history: ring, currentMirrorBytes: cur, fmtBytes: (n) => `${n}B`, stampAgo: () => "5m ago" });
      return hop(1405972601) === "The mirrors are unchanged since the measure 5m ago." &&
        hop(1414361209) === "The mirrors are up 8388608B since the measure 5m ago." &&
        hop(1390000000) === "The mirrors are down 15972601B since the measure 5m ago.";
    })());
  pin("AD3 a hop needs BOTH words — every missing word silences (LIVE ARITHMETIC: an empty ring, a channel-young newest point, a walk-silent newest point, and a silent present each return null — never a fake flat)",
    (() => {
      const answered = { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 };
      const hop = (history, cur) => fleetTrendMirrorHop({ history, currentMirrorBytes: cur, fmtBytes: (n) => `${n}B`, stampAgo: () => "5m ago" });
      return hop([], 1405972601) === null &&
        hop([{ at: answered.at, bytes: answered.bytes }], 1405972601) === null &&
        hop([{ at: answered.at, bytes: answered.bytes, mirrorBytes: null }], 1405972601) === null &&
        hop([answered], null) === null;
    })());
  pin("AD4 the ONE-ARITHMETIC proof (LIVE ARITHMETIC: the mirror channel mapped into a point shape reads the SAME kind and magnitude as the cluster channel over the same numbers — the hop drinks fleetTrendDelta, it never re-implements it)",
    (() => {
      const mirror = fleetTrendMirrorDelta({ history: [{ at: "2026-10-17T05:00:00Z", bytes: 1, mirrorBytes: 1405972601 }], currentMirrorBytes: 1414361209 });
      const cluster = fleetTrendDelta({ history: [{ at: "2026-10-17T05:00:00Z", bytes: 1405972601 }], currentBytes: 1414361209 });
      return mirror != null && cluster != null &&
        mirror.kind === cluster.kind && mirror.deltaBytes === cluster.deltaBytes &&
        mirror.prev != null && cluster.prev != null && mirror.prev.at === cluster.prev.at;
    })());
  pin("AD5 the three mouths pour the hop (the card and the dialog join the sentence after the reach clause with the same two-case join and drink the connection row's localBytesTotal; the band speaks its lowercase clause over the mapped delta — the import grows fleetTrendMirrorDelta; t1100 re-key — the mouths' feed grows the SPOKEN-WALK gate: the present's mirror word rides the row's mirrorWalkSpoke stamp, an unspoken walk feeds null and the well's guards do the silencing)",
    cardForAD.includes("currentMirrorBytes?: number | null;") &&
      cardForAD.includes("currentMirrorBytes={presentMirrorWord}") &&
      cardForAD.includes("const presentMirrorWord = mirrorsSpoke ? conn.localBytesTotal : null;") &&
      cardForAD.includes("{spec.voice}{reach ? ` ${reach}` : \"\"}{mirrorHop ? ` ${mirrorHop}` : \"\"}") &&
      dialogForAD.includes("currentMirrorBytes: presentMirrorWord,") &&
      dialogForAD.includes("{spec.voice}{reach ? ` ${reach}` : \"\"}{mirrorHop ? ` ${mirrorHop}` : \"\"}") &&
      toolsForAD.includes("fleetTrendMirrorDelta({ history: c.history, currentMirrorBytes: c.localBytesTotal })") &&
      toolsForAD.includes("` · the mirrors up ${fmtBytes(mirrorDelta.deltaBytes)} since the measure ${graveAgeLike(mirrorDelta.prev!.at)}`") &&
      toolsForAD.includes("` · the mirrors unchanged since the measure ${graveAgeLike(mirrorDelta.prev!.at)}`"));
}

// ---- t1097 — the AE band: THE DRILL'S MIRROR HOP (the THIRD hop
// seat: the per-ring band's trend clause grows the channel's word —
// ring-internal like its cluster twin, the same fleetTrendMirrorDelta
// doing the arithmetic over the ring's own two ends; a missing word on
// either end silences — the band's other clauses carry the stamps) ----
{
  const toolsForAE = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");

  pin("AE1 the drill's band grows the ring-internal mirror hop (the map computes ringMirrorDelta over the ring's own two ends — history.slice(1) as the history, the newest remembered point's mirrorBytes as the current word; the three lowercase clauses ride after the cluster's trend inside the same sentence: ', ${r.trend}${r.mirrorHop}.'; the tool description's ear names the both-channel words)",
    toolsForAE.includes("fleetTrendMirrorDelta({\n      history: r.history.slice(1),\n      currentMirrorBytes: r.history[0]?.mirrorBytes ?? null,\n    })") &&
      toolsForAE.includes("`, the mirrors up ${fmtBytes(ringMirrorDelta.deltaBytes)} since the measure ${graveAgeLike(ringMirrorDelta.prev!.at)}`") &&
      toolsForAE.includes("`, the mirrors down ${fmtBytes(ringMirrorDelta.deltaBytes)} since the measure ${graveAgeLike(ringMirrorDelta.prev!.at)}`") &&
      toolsForAE.includes("`, the mirrors unchanged since the measure ${graveAgeLike(ringMirrorDelta.prev!.at)}`") &&
      toolsForAE.includes("on the cluster, ${r.trend}${r.mirrorHop}.") &&
      toolsForAE.includes("the mirrors' own per-ring hop beside the cluster's (t1097"));
  pin("AE2 LIVE ARITHMETIC the ring-internal hop speaks all three branches (over a synthetic two-point ring the mapped delta reads up/down/unchanged with the exact magnitude and the OLDER end's stamp — the twin of the drill's cluster trend clause)",
    (() => {
      const ring = [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1414361209 },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 },
      ];
      const d = fleetTrendMirrorDelta({ history: ring.slice(1), currentMirrorBytes: ring[0].mirrorBytes });
      return d != null && d.kind === "up" && d.deltaBytes === 8388608 && d.prev != null && d.prev.at === "2026-10-17T05:00:00Z";
    })() &&
    (() => {
      const ring = [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1414361209 },
      ];
      const d = fleetTrendMirrorDelta({ history: ring.slice(1), currentMirrorBytes: ring[0].mirrorBytes });
      return d != null && d.kind === "down" && d.deltaBytes === 8388608;
    })() &&
    (() => {
      const ring = [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 },
      ];
      const d = fleetTrendMirrorDelta({ history: ring.slice(1), currentMirrorBytes: ring[0].mirrorBytes });
      return d != null && d.kind === "same";
    })());
  pin("AE3 LIVE ARITHMETIC the ring-internal hop's silences (a ring of one, a channel-young point on either end — the key ABSENT, a walk-silent word (null) on either end — each return null: a hop needs BOTH remembered words, the band says nothing)",
    (() => {
      const answered = { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 };
      const older = { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 };
      const d = (history, cur) => fleetTrendMirrorDelta({ history, currentMirrorBytes: cur });
      return d([], answered.mirrorBytes) === null &&
        d([older], null) === null &&
        d([{ at: older.at, bytes: older.bytes }], answered.mirrorBytes) === null &&
        d([{ at: older.at, bytes: older.bytes, mirrorBytes: null }], answered.mirrorBytes) === null &&
        d([{ at: older.at, bytes: older.bytes, mirrorBytes: 1405972601 }, { at: answered.at, bytes: answered.bytes, mirrorBytes: null }], null) === null;
    })());
  pin("AE4 LIVE ARITHMETIC the ONE-ARITHMETIC twin proof, ring-internal (the mirror channel mapped over the ring's own two ends reads the SAME kind and magnitude as the drill's cluster twin — fleetTrendDelta over [history[1]] with the newest bytes — the hop never re-implements the arithmetic)",
    (() => {
      const ring = [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1414361209 },
        { at: "2026-10-17T05:00:00Z", bytes: 1423446034, mirrorBytes: 1405972601 },
      ];
      const mirror = fleetTrendMirrorDelta({ history: ring.slice(1), currentMirrorBytes: ring[0].mirrorBytes });
      const cluster = fleetTrendDelta({ history: [ring[1]], currentBytes: ring[0].bytes });
      return mirror != null && cluster != null &&
        mirror.kind === cluster.kind && mirror.deltaBytes === cluster.deltaBytes &&
        mirror.prev != null && cluster.prev != null && mirror.prev.at === cluster.prev.at;
    })());
  pin("AE5 LIVE the drill's hop is FAITHFUL on the real ring (through the diagnostics API: every point's mirrorBytes absent-or-null-or-number; when the ring's two newest points BOTH speak, the mapped delta's kind matches the raw subtraction and the clause words exist in the drill's source; when either end is silent, the delta is null — never a fake flat)",
    await (async () => {
      try {
        const res = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const body = await res.json().catch(() => null);
        const ring = body?.fleet?.rings?.[0]?.history;
        if (!Array.isArray(ring) || ring.length < 2) return false;
        const shapeOk = ring.every((p) =>
          p.mirrorBytes === undefined || p.mirrorBytes === null || typeof p.mirrorBytes === "number"
        );
        const newest = ring[0];
        const older = ring[1];
        const delta = fleetTrendMirrorDelta({ history: [older], currentMirrorBytes: newest.mirrorBytes ?? null });
        if (delta == null) return shapeOk; // an honest silence — the clause stays absent
        const raw = newest.mirrorBytes - (older.mirrorBytes ?? 0);
        const kindOk =
          (raw > 0 && delta.kind === "up") ||
          (raw < 0 && delta.kind === "down") ||
          (raw === 0 && delta.kind === "same");
        const clauseOk =
          delta.kind === "up"
            ? toolsForAE.includes("`, the mirrors up ${fmtBytes(ringMirrorDelta.deltaBytes)} since the measure ${graveAgeLike(ringMirrorDelta.prev!.at)}`")
            : delta.kind === "down"
              ? toolsForAE.includes("`, the mirrors down ${fmtBytes(ringMirrorDelta.deltaBytes)} since the measure ${graveAgeLike(ringMirrorDelta.prev!.at)}`")
              : toolsForAE.includes("`, the mirrors unchanged since the measure ${graveAgeLike(ringMirrorDelta.prev!.at)}`");
        return shapeOk && kindOk && clauseOk && delta.deltaBytes === Math.abs(raw) && delta.prev != null && delta.prev.at === older.at;
      } catch {
        return false;
      }
    })());
}

// ---- t1098 — the AF band: THE SYNC-CEILING'S TEMPORAL FACE (the
// ceiling bar borrows the mirror channel's arc and speaks it in the
// share's OWN dialect — climbing / easing / holding, the window NAMED;
// fleetMirrorArc is the walk's ONE home, the span voice's mirror
// clause drinks the same arc — twins fork, maps don't) ----
{
  const cardForAF = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForAF = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");

  pin("AF1 the face speaks all three branches in the share's OWN dialect, the window NAMED (an arc up is 'the share climbing across the reach', down is 'the share easing across the reach', unchanged is 'the share holding across the reach' — the ceiling is a policy constant, so the share moves exactly as the mirrors move)",
    (() => {
      const ring = (mNew, mOld) => [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: mNew },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: mOld },
      ];
      return fleetTrendCeilingFace({ history: ring(1414361209, 1405972601) }) === "the share climbing across the reach" &&
        fleetTrendCeilingFace({ history: ring(1405972601, 1414361209) }) === "the share easing across the reach" &&
        fleetTrendCeilingFace({ history: ring(1405972601, 1405972601) }) === "the share holding across the reach";
    })());
  pin("AF2 the face's silences ride the arc's own guards (a ring of one, a channel-young end — the key ABSENT, a walk-silent end (null) — each return null: the bar keeps its t1084 face, never a fake weather report)",
    (() => {
      const answered = { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 };
      const older = { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 };
      return fleetTrendCeilingFace({ history: [answered] }) === null &&
        fleetTrendCeilingFace({ history: [{ at: older.at, bytes: older.bytes }, answered] }) === null &&
        fleetTrendCeilingFace({ history: [{ at: older.at, bytes: older.bytes, mirrorBytes: null }, answered] }) === null &&
        fleetTrendCeilingFace({ history: [older, { at: answered.at, bytes: answered.bytes, mirrorBytes: null }] }) === null;
    })());
  pin("AF3 the ONE-ARITHMETIC proof (the arc helper, the face and the span voice's mirror clause all agree on kind over the same ring — fleetMirrorArc is the walk's ONE home; the face never re-implements the walk)",
    (() => {
      const ring = [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1414361209 },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 },
      ];
      const arc = fleetMirrorArc({ history: ring });
      const face = fleetTrendCeilingFace({ history: ring });
      const span = fleetTrendSpanVoice({ history: ring, fmtBytes: (n) => `${n}B`, stampAgo: () => "1h ago" });
      if (arc == null || face == null || span == null) return false;
      const kindOfFace = face.includes("climbing") ? "up" : face.includes("easing") ? "down" : "same";
      const kindOfSpan = span.includes(", up ") ? "up" : span.includes(", down ") ? "down" : span.includes("unchanged across the reach") ? "same" : "?";
      return arc.kind === "up" && kindOfFace === arc.kind && kindOfSpan === arc.kind &&
        arc.deltaBytes === 8388608 && arc.oldest === 1405972601 && arc.newest === 1414361209 &&
        span.endsWith(" The mirrors held 1405972601B here then, up 8388608B across the reach.");
    })());
  pin("AF4 the refactor is verbatim-safe (the span voice's mirror clause speaks the exact t1095 shapes THROUGH the arc helper — the three branches byte-for-byte, the far-end hole still rides, the channel-young ring still silences the clause while the cluster span speaks)",
    (() => {
      const fmt = (n) => `${n}B`;
      const ago = () => "1h ago";
      const up = fleetTrendSpanVoice({ history: [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1414361209 },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 },
      ], fmtBytes: fmt, stampAgo: ago });
      const down = fleetTrendSpanVoice({ history: [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1414361209 },
      ], fmtBytes: fmt, stampAgo: ago });
      const same = fleetTrendSpanVoice({ history: [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 },
      ], fmtBytes: fmt, stampAgo: ago });
      const holeFar = fleetTrendSpanVoice({ history: [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1414361209 },
        { at: "2026-10-17T05:00:00Z", bytes: null, mirrorBytes: 1405972601 },
      ], fmtBytes: fmt, stampAgo: ago });
      const channelYoung = fleetTrendSpanVoice({ history: [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1414361209 },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642 },
      ], fmtBytes: fmt, stampAgo: ago });
      return up === "The ring reaches back 1h ago — flat across the ring's reach (1431834642B then and now). The mirrors held 1405972601B here then, up 8388608B across the reach." &&
        down === "The ring reaches back 1h ago — flat across the ring's reach (1431834642B then and now). The mirrors held 1414361209B here then, down 8388608B across the reach." &&
        same === "The ring reaches back 1h ago — flat across the ring's reach (1431834642B then and now). The mirrors held 1405972601B here then, unchanged across the reach." &&
        holeFar === "The ring reaches back 1h ago — but the far end is an honest hole. The mirrors held 1405972601B here then, up 8388608B across the reach." &&
        channelYoung != null && !channelYoung.includes("The mirrors held");
    })());
  pin("AF5 the mouths' joins (the card and the dialog grow the same clause join ' · ${ceilingFace}' on their share lines, both import fleetTrendCeilingFace, both row types carry the channel's mirrorBytes, the face only rides an answered ceiling in both files)",
    cardForAF.includes("fleetTrendCeilingFace") &&
      cardForAF.includes("const ceilingFace = ceilingBytes != null ? fleetTrendCeilingFace({ history: conn.history }) : null;") &&
      cardForAF.includes("{ceilingFace ? ` · ${ceilingFace}` : \"\"}") &&
      cardForAF.includes("history: { at: string; bytes: number | null; mirrorBytes?: number | null }[];") &&
      dialogForAF.includes("fleetTrendCeilingFace") &&
      dialogForAF.includes("ceilingBytes != null ? fleetTrendCeilingFace({ history: conn.history }) : null;") &&
      dialogForAF.includes("{ceilingFace ? ` · ${ceilingFace}` : \"\"}") &&
      dialogForAF.includes("mirrorBytes?: number | null;"));
}

// ---- t1099 — the AG band: THE AI BAND'S CEILING WORDS (the ledger
// band's ceiling clause grows the temporal face — the AI-side seat of
// the t1098 face: ONE well, the band's comma dialect inside the
// parentheses, the silence laws riding the arc's own guards) ----
{
  const toolsForAG = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");

  pin("AG1 the ledger band's ceiling clause grows the face (the AI-side seat: fleetTrendCeilingFace over the connection's own ring; the face rides INSIDE the parentheses beside the share — the band's comma dialect '% used${ceilingFace ? `, ${ceilingFace}` : \"\"}'; the face only rides an answered ceiling — the unknown-ceiling case says nothing, the t1084 law; t1102 re-key — the share now rides the WALK-SPOKE gate: the failed walk reads the waits-words, never a fake '0% used')",
    toolsForAG.includes("const ceilingFace = fleetTrendCeilingFace({ history: c.history });") &&
      toolsForAG.includes("!c.mirrorWalkSpoke\n            ? \"the share waits for a spoken mirror walk\"\n            : `${Math.min((c.localBytesTotal / c.syncCeilingBytes) * 100, 999).toFixed(0)}% used${ceilingFace ? `, ${ceilingFace}` : \"\"}`") &&
      toolsForAG.includes("? ` · sync ceiling ${fmtBytes(c.syncCeilingBytes)} (${"));
  pin("AG2 LIVE ARITHMETIC the band's join speaks all three weathers (over synthetic rings the well's face joins into the exact clause words — '66% used, the share climbing across the reach' / easing / holding — the band's template produces them verbatim)",
    (() => {
      const ring = (mNew, mOld) => [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: mNew },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: mOld },
      ];
      const join = (face) => `(${66}% used${face ? `, ${face}` : ""})`;
      return join(fleetTrendCeilingFace({ history: ring(1414361209, 1405972601) })) === "(66% used, the share climbing across the reach)" &&
        join(fleetTrendCeilingFace({ history: ring(1405972601, 1414361209) })) === "(66% used, the share easing across the reach)" &&
        join(fleetTrendCeilingFace({ history: ring(1405972601, 1405972601) })) === "(66% used, the share holding across the reach)";
    })());
  pin("AG3 LIVE ARITHMETIC the band's silences keep the bare t1084 face (a ring of one, a channel-young end — the key ABSENT, a walk-silent end (null) — each face null and the join's else branch empty: the clause reads the share alone, never a fake weather report)",
    (() => {
      const answered = { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 };
      const older = { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 };
      const join = (face) => `(66% used${face ? `, ${face}` : ""})`;
      return join(fleetTrendCeilingFace({ history: [answered] })) === "(66% used)" &&
        join(fleetTrendCeilingFace({ history: [{ at: older.at, bytes: older.bytes }, answered] })) === "(66% used)" &&
        join(fleetTrendCeilingFace({ history: [{ at: older.at, bytes: older.bytes, mirrorBytes: null }, answered] })) === "(66% used)" &&
        join(fleetTrendCeilingFace({ history: [older, { at: answered.at, bytes: answered.bytes, mirrorBytes: null }] })) === "(66% used)";
    })());
  pin("AG4 the ONE-ARITHMETIC proof, the imports (the AI band drinks the SAME fleetTrendCeilingFace the card and the dialog drink — three files, one well function; the band never re-implements the walk; t1100 re-key — the import grows the unmirrored count: the naming's ONE home)",
    toolsForAG.includes("fleetTrendCeilingFace") &&
      toolsForAG.includes("import { fleetTrendDelta, fleetTrendMirrorDelta, fleetTrendSpanVoice, fleetTrendHolePair, fleetTrendHoleCount, fleetTrendHoleDeepest, fleetTrendHoleSummary, fleetTrendCeilingFace, fleetUnmirroredRuns, FLEET_TREND_RING_CAP } from \"@/lib/remote/fleet-trend\";") &&
      readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8").includes("fleetTrendCeilingFace") &&
      readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8").includes("fleetTrendCeilingFace"));
  pin("AG5 LIVE the band's face is FAITHFUL on the real ring (through the shelf's own dispatch: the summary's ceiling clause carries the exact weather the well computes over the live ring — climbing/easing/holding or the bare share when the ends are silent — never a disagreement)",
    await (async () => {
      try {
        // ⚠ PIN the DB explicitly (the t377/t635 poisoning lesson) —
        // the living world is db/cryoflow.db, the .env points elsewhere.
        process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
        const { PrismaClient } = await import("@prisma/client");
        const db = new PrismaClient();
        const project = await db.project.findFirst({ where: { name: "β-Galactosidase Tutorial (demo)" }, select: { id: true } });
        await db.$disconnect();
        if (!project) return false;
        const r = await executeAiTool("get_fleet_ledger", {}, { projectId: project.id });
        const summary = r?.summary ?? "";
        // the same well, the same ring: the sidecar's own history (the
        // diagnostics shape the other LIVE pins drink)
        const diagRes = await fetch("http://localhost:3000/api/diagnostics", {
          headers: { Origin: "http://localhost:3000" },
        });
        const diagBody = await diagRes.json().catch(() => null);
        const ring = diagBody?.fleet?.rings?.[0]?.history;
        const face = Array.isArray(ring) ? fleetTrendCeilingFace({ history: ring }) : null;
        if (!summary.includes("sync ceiling")) return face == null; // no ceiling clause — the face must be silent too
        const clause = summary.match(/sync ceiling [^·]*\(([^)]*)\)/)?.[1] ?? "";
        if (face == null) return !clause.includes("the share");
        return clause.includes(`, ${face}`);
      } catch {
        return false;
      }
    })());
}

// ---- t1100 — the AH band: THE UNMIRRORED NAMING (the count's ONE home
// in the well; the band's three mirror-clause faces — the walk-failed
// unknown, the all-absent "no mirrors yet", the some-absent clause; the
// hop's presence guard — only a real vanishing speaks against an empty
// mirror side; the card's and the dialog's badge + cell faces, the
// twins stay twins) ----
{
  const toolsForAH = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");
  const cardForAH = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const dialogForAH = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");

  pin("AH1 LIVE ARITHMETIC the count's ONE home (fleetUnmirroredRuns over localExists rows: none → 0, some → the count, all → the length, the empty roster → 0 — pure rows in, count out)",
    fleetUnmirroredRuns([]) === 0 &&
      fleetUnmirroredRuns([{ localExists: true }, { localExists: true }]) === 0 &&
      fleetUnmirroredRuns([{ localExists: true }, { localExists: false }, { localExists: false }]) === 2 &&
      fleetUnmirroredRuns([{ localExists: false }, { localExists: false }]) === 2 &&
      fleetUnmirroredRuns([{ localExists: false }]) === 1);
  pin("AH2 the band's mirror clause forks on the WALK'S SPOKENNESS first (the three faces verbatim in the source: the walk-failed unknown — 'the mirror side unreadable — the local walk failed, so the mirror faces are unverified', the all-absent face — 'no mirrors yet — all N runs live on the cluster alone', the some-absent clause — 'K of N runs unmirrored' beside the total; the fork checks c.mirrorWalkSpoke BEFORE the count — an unverified count is never named)",
    toolsForAH.includes("const unmirrored = fleetUnmirroredRuns(c.jobs);") &&
      toolsForAH.includes("const allAbsent = c.mirrorWalkSpoke && c.jobs.length > 0 && unmirrored === c.jobs.length;") &&
      toolsForAH.includes('" · the mirror side unreadable — the local walk failed, so the mirror faces are unverified"') &&
      toolsForAH.includes("` · no mirrors yet — all ${c.jobs.length} run${c.jobs.length === 1 ? \"\" : \"s\"} live on the cluster alone`") &&
      toolsForAH.includes("` · mirrors hold ${fmtBytes(c.localBytesTotal)} here${unmirrored > 0 ? ` · ${unmirrored} of ${c.jobs.length} runs unmirrored` : \"\"}`") &&
      toolsForAH.includes("const mirrorClause = !c.mirrorWalkSpoke"));
  pin("AH3 the band's hop rides a SPOKEN walk and the presence guard keeps the false subject out (the delta gates on c.mirrorWalkSpoke; the all-absent guard lets only a DOWN speak — 'the mirrors unchanged' with no referent stays silent; the policy clause waits for a spoken walk too)",
    toolsForAH.includes("const mirrorDelta = c.mirrorWalkSpoke") &&
      toolsForAH.includes("!c.measuredAt || !mirrorDelta || (allAbsent && mirrorDelta.kind !== \"down\")") &&
      toolsForAH.includes("the policy comparison waits for a spoken mirror walk (the local walk failed, the mirror side is unverified)"));
  pin("AH4 LIVE ARITHMETIC the hop's presence guard (fleetTrendMirrorHop with allMirrorsAbsent: a flat ring between two zeros → null — no subject with no referent; a real vanishing → the DOWN sentence speaks; without the flag the flat ring keeps its unchanged sentence — the guard is the caller's own knowledge, opt-in)",
    (() => {
      const fmt = (n) => (n >= 1024 * 1024 * 1024 ? `${(n / 1024 ** 3).toFixed(2)}GB` : `${Math.round(n / 1024)}KB`);
      const stamp = (_iso) => "1h ago";
      const zeros = [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 0 },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 0 },
      ];
      const vanish = [
        { at: "2026-10-17T06:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 },
        { at: "2026-10-17T05:00:00Z", bytes: 1431834642, mirrorBytes: 1405972601 },
      ];
      const hop = (history, allAbsent) =>
        fleetTrendMirrorHop({ history, currentMirrorBytes: 0, allMirrorsAbsent: allAbsent, fmtBytes: fmt, stampAgo: stamp });
      return hop(zeros, true) === null &&
        hop(zeros, false) === "The mirrors are unchanged since the measure 1h ago." &&
        (hop(vanish, true) ?? "").startsWith("The mirrors are down ") &&
        (hop(vanish, true) ?? "").endsWith(" since the measure 1h ago.");
    })());
  pin("AH5 the card's seat (the badge gated on the spoken walk, the cell's three faces, the strip feeds the presence guard, the policy line waits for a spoken walk, the types catch up — localExists on the job, mirrorWalkSpoke on the row)",
    cardForAH.includes("const unmirrored = fleetUnmirroredRuns(conn.jobs);") &&
      cardForAH.includes("const mirrorsSpoke = conn.mirrorWalkSpoke;") &&
      cardForAH.includes("{!mirrorsSpoke ? \"—\" : allAbsent ? \"no mirrors yet\" : fmtBytes(conn.localBytesTotal)}") &&
      cardForAH.includes("{unmirrored} unmirrored") &&
      cardForAH.includes("allMirrorsAbsent={allAbsent}") &&
      cardForAH.includes("const presentMirrorWord = mirrorsSpoke ? conn.localBytesTotal : null;") &&
      cardForAH.includes("The mirror side is unreadable — the local walk failed, so") &&
      cardForAH.includes("allMirrorsAbsent?: boolean;") &&
      cardForAH.includes("mirrorWalkSpoke: boolean;") &&
      cardForAH.includes("localExists: boolean;"));
  pin("AH6 the dialog's seat (the twin: the same consts, the badge's own count words, the cell's three faces, the strip feeds the guard, the policy line waits, the row's mirror bar names the absent dir, the type catches up)",
    dialogForAH.includes("const unmirrored = fleetUnmirroredRuns(conn.jobs);") &&
      dialogForAH.includes("{unmirrored} of {conn.jobs.length} unmirrored") &&
      dialogForAH.includes("{!mirrorsSpoke ? \"—\" : allAbsent ? \"no mirrors yet\" : fmtBytes(conn.localBytesTotal)}") &&
      dialogForAH.includes("allMirrorsAbsent: allAbsent,") &&
      dialogForAH.includes("title={j.localExists ? `Mirror: ${fmtBytes(j.localBytes)}` : \"No local mirror directory for this run — its bytes live on the cluster alone\"}") &&
      dialogForAH.includes("mirrorWalkSpoke: boolean;"));
  pin("AH7 the ONE-WELL proof, the imports (the card and the dialog drink the SAME fleetUnmirroredRuns the band drinks — three files, one well function; the count is never re-implemented)",
    cardForAH.includes("fleetUnmirroredRuns") &&
      dialogForAH.includes("fleetUnmirroredRuns") &&
      toolsForAH.includes("fleetUnmirroredRuns"));
  pin("AH8 LIVE the band's naming is FAITHFUL on the real world (through the shelf's own dispatch: today's all-mirrored world reads the bare 'mirrors hold X here' with NO unmirrored clause and NO 'no mirrors yet' face — the naming stays home when there is nothing to name; the stamp's presence gates the walk-failed face)",
    await (async () => {
      try {
        process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
        const { PrismaClient } = await import("@prisma/client");
        const db = new PrismaClient();
        const project = await db.project.findFirst({ where: { name: "β-Galactosidase Tutorial (demo)" }, select: { id: true } });
        await db.$disconnect();
        if (!project) return false;
        const r = await executeAiTool("get_fleet_ledger", {}, { projectId: project.id });
        const summary = r?.summary ?? "";
        if (!summary.includes("Mock Cluster")) return false;
        return summary.includes("mirrors hold") &&
          !summary.includes("unmirrored") &&
          !summary.includes("no mirrors yet") &&
          !summary.includes("the mirror side unreadable");
      } catch {
        return false;
      }
    })());
  pin("AH9 LIVE ARITHMETIC the CEILING'S WALK-SPOKE GATE (t1102): the band's share is the MIRRORS' share of the policy — a walk that never spoke reduces the mirror total to a zero, and the ungated clause would read a fake '0% used' (the zero-wearing-unknown's-clothes the family's law forbids — AH2's seat, now at the ceiling clause too; the UI twins gated their share blocks in t1100). The gate forks on !c.mirrorWalkSpoke FIRST: the failed walk reads 'the share waits for a spoken mirror walk' — the ceiling stays named (the policy constant is known from here), the share waits; the spoken case keeps the t1084/t1099 face verbatim",
    await (async () => {
      const tools = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");
      if (!tools.includes("!c.mirrorWalkSpoke\n            ? \"the share waits for a spoken mirror walk\"")) return false;
      if (!tools.includes("the share waits for a spoken mirror walk")) return false;
      if (!tools.includes("Math.min((c.localBytesTotal / c.syncCeilingBytes) * 100, 999).toFixed(0)}% used${ceilingFace ? `, ${ceilingFace}` : \"\"}")) return false;
      // the fork's own proof: the SAME failed-walk row through both
      // shapes — the ungated arithmetic produces the fake zero, the
      // gate refuses it (the waits-words instead)
      const row = { mirrorWalkSpoke: false, localBytesTotal: 0, syncCeilingBytes: 2147483648 };
      const ungated = `${Math.min((row.localBytesTotal / row.syncCeilingBytes) * 100, 999).toFixed(0)}% used`;
      const gated = !row.mirrorWalkSpoke ? "the share waits for a spoken mirror walk" : ungated;
      return ungated === "0% used" && gated === "the share waits for a spoken mirror walk";
    })());
}

// ---- the AI band — THE WALK'S OWN SILENCE, TYPED (t1103): the walk's
// top readdir is the ONE read whose failure silences every face in the
// storage report — the typed StorageWalkError lets the route, the AI
// tool and the dialog NAME the unreadability (the family's honest
// unknown) instead of a generic "failed" or the FALSE absence ("the
// directory is gone" — it is THERE, the walk just can't speak). ----
{
  const report = readFileSync(path.join(ROOT, "src/lib/relion/storage-report.ts"), "utf8");
  const routeForAI = readFileSync(path.join(ROOT, "src/app/api/projects/[id]/storage/route.ts"), "utf8");
  const toolsForAI = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");
  const dialogForAI = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");

  pin("AI1 the walk's silence is TYPED at the source (StorageWalkError: dir + code, thrown ONLY by the top readdir's wrap — the one read whose failure silences every face; the per-dir walks keep their own dialect, a failed sub-walk is that dir's exists=false and the report still speaks)",
    report.includes("export class StorageWalkError extends Error {") &&
      report.includes("throw new StorageWalkError(projectDir, (e as NodeJS.ErrnoException).code ?? \"unknown\");") &&
      report.includes("dirNames = readdirSync(projectDir, { withFileTypes: true })"));
  pin("AI2 the route's two-face wording (the StorageWalkError face is the family's line verbatim — 'The storage walk could not speak — the run directories are unreadable from here (an honest unknown, never a zero). Every face in this dialog waits for a spoken walk.'; every OTHER failure keeps the generic 'Failed to compute storage')",
    routeForAI.includes("if (error instanceof StorageWalkError) {") &&
      routeForAI.includes("The storage walk could not speak — the run directories are unreadable from here (an honest unknown, never a zero). Every face in this dialog waits for a spoken walk.") &&
      routeForAI.includes("Failed to compute storage"));
  pin("AI3 the tool's THREE faces — the false absence is DEAD (the old catch merged every failure into 'the project row or its run directory is gone' — a walk that couldn't speak is NOT a project that is gone: the typed face words the unreadability, an unexpected throw words an unnamed failure, and the null return words the TRUE absence precisely — 'the project row is gone', the directory claim deleted)",
    toolsForAI.includes("if (walkError instanceof StorageWalkError) {") &&
      toolsForAI.includes("The storage walk could not speak — the run directories are unreadable from here (an honest unknown, never a zero). The ledger's faces wait for a spoken walk; ask again once the directories are readable.") &&
      toolsForAI.includes("an unexpected failure stopped it before it spoke") &&
      toolsForAI.includes("the project row is gone") &&
      !toolsForAI.includes("or its run directory is gone"));
  pin("AI3b LIVE the tool's face is FAITHFUL on the real world (through the shelf's own dispatch: today's spoken walk reads ok:true with the project's weight — the walk-failed face stays home when the walk speaks)",
    await (async () => {
      try {
        process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
        const { PrismaClient } = await import("@prisma/client");
        const db = new PrismaClient();
        const project = await db.project.findFirst({ where: { name: "β-Galactosidase Tutorial (demo)" }, select: { id: true, name: true } });
        await db.$disconnect();
        if (!project) return false;
        const r = await executeAiTool("get_storage_report", {}, { projectId: project.id });
        return r?.ok === true && typeof r?.summary === "string" && r.summary.includes(project.name) &&
          !r.summary.includes("could not speak") && !r.summary.includes("is gone");
      } catch {
        return false;
      }
    })());
  pin("AI4 the dialog's danger panel pours the route's words verbatim (the fetch plumbing reads body.error into the error line — the family's line flows through untouched; the Try again door re-walks; the network-level catch keeps its own wording)",
    dialogForAI.includes("(body as { error?: string }).error ?? `HTTP ${res.status}`") &&
      dialogForAI.includes("<p className=\"text-sm text-danger\">{error}</p>") &&
      dialogForAI.includes("Try again"));
}

// ---- the AJ band — THE MEMORY'S EXPORT (t1105): the ring's memory
// leaves as bytes (the storage dialog's CSV door — the t1019 grammar
// chain's AJ seat: the strip's own reading order, the hole's empty
// cell, the spoken zero's digit, the ISO address). The window FIRST
// grew a fourth seat for the ring's fullness (a conn-row chip beside
// the host chip) and the family's own G21a byte-equality pin refused
// it — the band's strip chip already speaks the fullness interactively
// (the FLEET_DIAG_FOCUS_EVENT door), so the redundant glance seat was
// RETRACTED and the export is the window's whole growth. ----
{
  const dialogForAJ = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const builderForAJ = readFileSync(path.join(ROOT, "src/lib/fleet-ring-export.ts"), "utf8");

  pin("AJ1 LIVE the builder's grammar (the t1019 chain's AJ seat: the head words are the band's three faces in the strip's order; the rows speak the strip's draw order — oldest first; the hole exports the NULLISH cell (the house CSV speaks the empty word), the spoken zero exports its own digit, the channel-young end exports the empty word; the name is the connection's own slugged word)",
    await (async () => {
      try {
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { fleetRingCsvRows, fleetRingCsvName, FLEET_RING_CSV_HEAD } = await __jiti.import("../src/lib/fleet-ring-export.ts");
        const { rowsToCsv } = await __jiti.import("../src/lib/chart-export.ts");
        const ring = [
          { at: "2026-10-17T09:03:03.645Z", bytes: 1431834642, mirrorBytes: 0 },
          { at: "2026-10-17T08:59:00.829Z", bytes: 1431834642, mirrorBytes: null },
          { at: "2026-10-17T08:11:57.718Z", bytes: 1431834642, mirrorBytes: 1405972601 },
        ];
        const rows = fleetRingCsvRows(ring);
        const heads = Object.keys(rows[0]);
        const csv = rowsToCsv(rows);
        const lines = csv.replace(/\n$/, "").split("\n");
        return (
          builderForAJ.includes("[...history].reverse()") &&
          builderForAJ.includes("export const FLEET_RING_CSV_HEAD = [\"Measured at\", \"Cluster\", \"Mirrors\"] as const;") &&
          JSON.stringify([...FLEET_RING_CSV_HEAD]) === JSON.stringify(["Measured at", "Cluster", "Mirrors"]) &&
          heads[0] === "Measured at" && heads[1] === "Cluster" && heads[2] === "Mirrors" &&
          rows.length === 3 &&
          rows[0]["Measured at"] === "2026-10-17T08:11:57.718Z" &&
          rows[2]["Measured at"] === "2026-10-17T09:03:03.645Z" &&
          rows[0].Cluster === 1431834642 && rows[0].Mirrors === 1405972601 &&
          rows[1].Mirrors == null && rows[1].Cluster === 1431834642 &&
          rows[2].Mirrors === 0 &&
          lines[0] === "Measured at,Cluster,Mirrors" &&
          lines[1].endsWith(",1405972601") &&
          lines[2].endsWith(",") &&
          lines[3].endsWith(",0") &&
          !csv.includes("null") && !csv.includes("undefined") &&
          fleetRingCsvName("Mock Cluster") === "fleet-ring-mock-cluster" &&
          fleetRingCsvName("") === "fleet-ring-connection"
        );
      } catch {
        return false;
      }
    })());
  pin("AJ2 the dialog's export door (the memory leaves as bytes: the builder is the ONE father — the door never re-derives; the gate is the memory's own — nothing remembered, nothing to export, the honest disable names the first number's door; the aria carries the count and the holes' word)",
    dialogForAJ.includes("data-testid=\"fleet-ring-export\"") &&
      dialogForAJ.includes("disabled={conn.history.length === 0}") &&
      dialogForAJ.includes("downloadCsv(\n                                fleetRingCsvName(conn.connectionName),\n                                fleetRingCsvRows(conn.history)\n                              )") &&
      dialogForAJ.includes("An honest hole exports an empty cell — never a zero; a zero the walk spoke exports as 0.") &&
      dialogForAJ.includes("The ring remembers nothing yet — Measure now speaks the first number.") &&
      dialogForAJ.includes("remembered measures, the honest holes as empty cells"));
  pin("AJ3 LIVE the door speaks the WORLD's own ring (the sidecar's memory through the builder: the header line exact, one row per remembered measure plus the head, the oldest stamp first, the spoken zeros traveling their digit at the row's tail, no null/undefined word anywhere in the file)",
    await (async () => {
      try {
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { fleetRingCsvRows } = await __jiti.import("../src/lib/fleet-ring-export.ts");
        const { rowsToCsv } = await __jiti.import("../src/lib/chart-export.ts");
        const sidecar = JSON.parse(readFileSync(path.join(ROOT, "data/remote-fleet-ledger.json"), "utf8"));
        const proj = Object.values(sidecar.projects)[0];
        const conn = Object.values(proj.history)[0];
        const ring = conn;
        const rows = fleetRingCsvRows(ring);
        const csv = rowsToCsv(rows);
        const lines = csv.replace(/\n$/, "").split("\n");
        const zeroCount = ring.filter((p) => p.mirrorBytes === 0).length;
        const zeroRows = lines.slice(1).filter((l) => l.endsWith(",0")).length;
        return (
          ring.length > 0 &&
          rows.length === ring.length &&
          lines.length === ring.length + 1 &&
          lines[0] === "Measured at,Cluster,Mirrors" &&
          rows[0]["Measured at"] === ring[ring.length - 1].at &&
          rows[rows.length - 1]["Measured at"] === ring[0].at &&
          zeroRows === zeroCount &&
          !csv.includes("null") && !csv.includes("undefined")
        );
      } catch {
        return false;
      }
    })());
  pin("AJ4 LIVE the hole's PAPER FACE (the t1106 ride's film bound as a pin: the file carries the silences the strip draws — the CSV's empty-Cluster rows count EXACTLY the ring's bytes-null points, whatever the world holds today; the HALF-hole's per-cell honesty — a hole's Mirrors cell keeps the local walk's word beside the cluster's silence, one channel's empty cell is ONE channel's word, never the row's death; synthetic: the FULL hole exports BOTH cells empty as the file's last row, the half-hole exports the empty Cluster beside the living Mirrors digit, and the answered rows keep their numbers)",
    await (async () => {
      try {
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { fleetRingCsvRows } = await __jiti.import("../src/lib/fleet-ring-export.ts");
        const { rowsToCsv } = await __jiti.import("../src/lib/chart-export.ts");
        const sidecar = JSON.parse(readFileSync(path.join(ROOT, "data/remote-fleet-ledger.json"), "utf8"));
        const proj = Object.values(sidecar.projects)[0];
        const ring = Object.values(proj.history)[0];
        const rows = fleetRingCsvRows(ring);
        const csv = rowsToCsv(rows);
        const dataLines = csv.replace(/\n$/, "").split("\n").slice(1);
        const emptyClusterRows = dataLines.filter((l) => l.split(",")[1] === "");
        const holesInRing = ring.filter((p) => p.bytes == null);
        const mirrorsAliveOnHoles = rows.every((r) =>
          r["Cluster"] != null ? true : r["Mirrors"] == null || typeof r["Mirrors"] === "number");
        const synthFull = rowsToCsv(fleetRingCsvRows([
          { at: "2026-10-17T12:00:00Z", bytes: null, mirrorBytes: null },
          { at: "2026-10-17T11:00:00Z", bytes: 100, mirrorBytes: 90 },
        ])).replace(/\n$/, "").split("\n");
        const synthHalf = rowsToCsv(fleetRingCsvRows([
          { at: "2026-10-17T12:00:00Z", bytes: 100, mirrorBytes: 90 },
          { at: "2026-10-17T11:00:00Z", bytes: null, mirrorBytes: 90 },
        ])).replace(/\n$/, "").split("\n");
        return (
          ring.length > 0 &&
          dataLines.length === ring.length &&
          emptyClusterRows.length === holesInRing.length &&
          mirrorsAliveOnHoles &&
          synthFull[1] === "2026-10-17T11:00:00Z,100,90" &&
          synthFull[2] === "2026-10-17T12:00:00Z,," &&
          synthHalf[1] === "2026-10-17T11:00:00Z,,90" &&
          synthHalf[2] === "2026-10-17T12:00:00Z,100,90"
        );
      } catch {
        return false;
      }
    })());
}

// ---- the AK band — THE LONE SANDWICH'S HONEST BIRTH (t1107): the
// qualifying walk's own ends refuse the inherited candidate — the
// roll-off path hands the pair's younger half the draw-order's OLDEST
// edge (i=0, no older neighbor — the trailing law's mirror face) and
// then the eviction, never the sandwich; the mint hint died too (the
// walk reads the CLUSTER series only — a mint moves the mirrors' word,
// no qualification rides on it). The lone silence is born only through
// the PUSH LAW: one failed measure's point enters the ring interior
// with the answered present closing the line. The PAIR contributes
// nothing even beside a qualifier — two silences side by side qualify
// NOTHING. The t1107 ride filmed it live: the paragraph's singular
// ("An honest silence sits in the ring's memory — The measures on
// either side read 1.33 GB → 1.33 GB."), the drill's row ("1 hole,
// deepest 2m ago"), and the CSV's single empty Cluster cell between
// two answered rows — the pause pair AND the lone sandwich in ONE
// file. ----
{
  pin("AK1 the EDGE INHERITANCE (the inherited candidate's death certificate as a law: the pair's younger half at the draw-order's oldest edge qualifies NOTHING — both mouths silent whatever the present holds; the walk's own i=0 end refuses it, the trailing law's mirror face)",
    await (async () => {
      try {
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { fleetTrendHoleSummary, fleetTrendHoleCount, fleetTrendHoleDeepest } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
        const edgeRing = [
          { at: "2026-10-17T13:00:00Z", bytes: 100 },
          { at: "2026-10-17T12:00:00Z", bytes: 200 },
          { at: "2026-10-17T11:00:00Z", bytes: null },
        ];
        const f = (n) => `${n} B`;
        const ago = (iso) => `${iso} ago`;
        const withPresent = fleetTrendHoleSummary({ history: edgeRing, currentBytes: 150, fmtBytes: f, stampAgo: ago });
        const ringOnly = fleetTrendHoleSummary({ history: edgeRing, currentBytes: null, fmtBytes: f, stampAgo: ago });
        return (
          fleetTrendHoleCount({ history: edgeRing, currentBytes: 150 }) === 0 &&
          fleetTrendHoleCount({ history: edgeRing, currentBytes: null }) === 0 &&
          withPresent === null && ringOnly === null &&
          fleetTrendHoleDeepest({ history: edgeRing, currentBytes: 150 }) === null
        );
      } catch {
        return false;
      }
    })());
  pin("AK2 the PUSH-LAW BIRTH (the t1107 ride's shape bound: one failed measure's point as the ring's newest with answered on both ring sides and the answered present closing the line — count exactly ONE, the singular head verbatim, the pair readings riding older → newer, the deepest naming the hole's own stamp)",
    await (async () => {
      try {
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { fleetTrendHoleSummary, fleetTrendHoleCount, fleetTrendHoleDeepest } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
        const birthRing = [
          { at: "2026-10-17T13:00:00Z", bytes: null },
          { at: "2026-10-17T12:00:00Z", bytes: 100 },
          { at: "2026-10-17T11:00:00Z", bytes: 200 },
        ];
        const f = (n) => `${n} B`;
        const ago = (iso) => `${iso} ago`;
        const summary = fleetTrendHoleSummary({ history: birthRing, currentBytes: 150, fmtBytes: f, stampAgo: ago });
        return (
          fleetTrendHoleCount({ history: birthRing, currentBytes: 150 }) === 1 &&
          summary === "An honest silence sits in the ring's memory — The measures on either side read 100 B → 150 B." &&
          fleetTrendHoleDeepest({ history: birthRing, currentBytes: 150 }) === "2026-10-17T13:00:00Z"
        );
      } catch {
        return false;
      }
    })());
  pin("AK3 the COEXISTENCE (the world's own film bound as arithmetic: the adjacent PAIR and the lone qualifier in ONE seq — the count stays exactly ONE, the pair contributing nothing even beside a qualifier; the ring-only mouth drinks the same walk and agrees)",
    await (async () => {
      try {
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { fleetTrendHoleSummary, fleetTrendHoleCount, fleetTrendHoleDeepest } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
        const coexistRing = [
          { at: "2026-10-17T15:00:00Z", bytes: 400 },
          { at: "2026-10-17T14:00:00Z", bytes: 300 },
          { at: "2026-10-17T13:00:00Z", bytes: null },
          { at: "2026-10-17T12:00:00Z", bytes: 200 },
          { at: "2026-10-17T11:00:00Z", bytes: null },
          { at: "2026-10-17T10:00:00Z", bytes: null },
        ];
        const f = (n) => `${n} B`;
        const ago = (iso) => `${iso} ago`;
        const summary = fleetTrendHoleSummary({ history: coexistRing, currentBytes: 150, fmtBytes: f, stampAgo: ago });
        const ringOnly = fleetTrendHoleCount({ history: coexistRing, currentBytes: null });
        return (
          fleetTrendHoleCount({ history: coexistRing, currentBytes: 150 }) === 1 &&
          ringOnly === 1 &&
          summary === "An honest silence sits in the ring's memory — The measures on either side read 200 B → 300 B." &&
          fleetTrendHoleDeepest({ history: coexistRing, currentBytes: 150 }) === "2026-10-17T13:00:00Z"
        );
      } catch {
        return false;
      }
    })());
  pin("AK4 LIVE the walk agrees with an independent recount (the faithfulness binding — whatever the world holds: the shared walk's count over the sidecar's own ring, ring-only, equals the pin's own loop over the draw order — null points with answered neighbors on BOTH ring sides; the walk and the recount can never drift apart silently)",
    await (async () => {
      try {
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { fleetTrendHoleCount } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
        const sidecar = JSON.parse(readFileSync(path.join(ROOT, "data/remote-fleet-ledger.json"), "utf8"));
        const proj = Object.values(sidecar.projects)[0];
        const ring = Object.values(proj.history)[0];
        if (!Array.isArray(ring) || ring.length === 0) return false;
        const live = fleetTrendHoleCount({ history: ring, currentBytes: null });
        // the pin's OWN recount over the ledger's dialect (newest first):
        // a point qualifies iff its bytes are null and BOTH ring
        // neighbors answered — the seq's ends never qualify.
        let recount = 0;
        for (let i = 0; i < ring.length; i++) {
          if (ring[i].bytes != null) continue;
          const older = i > 0 ? ring[i - 1].bytes : null;
          const newer = i < ring.length - 1 ? ring[i + 1].bytes : null;
          if (older != null && newer != null) recount += 1;
        }
        return live === recount;
      } catch {
        return false;
      }
    })());
}

// ---- the AL band — THE PLURAL'S FIRST LIVE WORD (t1108): the second
// lone hole rode the push law's same birth (one stop-cluster + one
// relaunch apart) and the plural sang its first live word — the
// t1073 SECOND AGE clause on its first live film ("2 honest silences
// sit in the ring's memory, the newest just now, the deepest 32m ago,
// every one between answered measures."). The ride's own honest turn:
// the plural's QUIET arrived one measure before the paper model — the
// failed measure still pushes its outgoing GOOD, so the ring's growth
// never pauses and the older qualifier reached the draw-order's OLDEST
// edge early (the edge law silences a HOLE; an ANSWERED point at the
// edge is invisible to the walk — the singular persisted one measure
// past the model for exactly that reason). The file's face at the
// peak carried THREE silence shapes in ONE CSV; the flat world's file
// face is the AJ4 faithfulness (0 nulls → 0 empty cells). ----
{
  pin("AL1 the PLURAL'S SPLIT SHAPE (the t1108 birth bound: TWO lone holes, each with answered on both sides, the present closing the line — count exactly TWO, the plural head verbatim, the t1073 second age riding when the walk's ends are DIFFERENT silences, the newest named and the deepest named, the drill's count and the deepest's stamp agreeing)",
    await (async () => {
      try {
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { fleetTrendHoleSummary, fleetTrendHoleCount, fleetTrendHoleDeepest } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
        const pluralRing = [
          { at: "2026-10-17T15:00:00Z", bytes: null },
          { at: "2026-10-17T14:00:00Z", bytes: 400 },
          { at: "2026-10-17T13:00:00Z", bytes: null },
          { at: "2026-10-17T12:00:00Z", bytes: 200 },
          { at: "2026-10-17T11:00:00Z", bytes: 100 },
        ];
        const f = (n) => `${n} B`;
        const ago = (iso) => `${iso} ago`;
        const summary = fleetTrendHoleSummary({ history: pluralRing, currentBytes: 500, fmtBytes: f, stampAgo: ago });
        return (
          fleetTrendHoleCount({ history: pluralRing, currentBytes: 500 }) === 2 &&
          summary === "2 honest silences sit in the ring's memory, the newest 2026-10-17T15:00:00Z ago, the deepest 2026-10-17T13:00:00Z ago, every one between answered measures." &&
          fleetTrendHoleDeepest({ history: pluralRing, currentBytes: 500 }) === "2026-10-17T13:00:00Z"
        );
      } catch {
        return false;
      }
    })());
  pin("AL2 the PLURAL'S QUIET (the t1108 M8 film bound: the OLDER qualifier reaches the draw-order's OLDEST edge — no older neighbor, the AK1 law's i=0 face — and the plural quiets to the SINGULAR about the SURVIVOR: count exactly ONE, the survivor's own pair readings, the deepest's stamp now the survivor's; the quiet is the trailing law, not an eviction)",
    await (async () => {
      try {
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { fleetTrendHoleSummary, fleetTrendHoleCount, fleetTrendHoleDeepest } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
        const quietRing = [
          { at: "2026-10-17T15:00:00Z", bytes: null },
          { at: "2026-10-17T14:00:00Z", bytes: 400 },
          { at: "2026-10-17T13:00:00Z", bytes: null },
        ];
        const f = (n) => `${n} B`;
        const ago = (iso) => `${iso} ago`;
        const summary = fleetTrendHoleSummary({ history: quietRing, currentBytes: 500, fmtBytes: f, stampAgo: ago });
        return (
          fleetTrendHoleCount({ history: quietRing, currentBytes: 500 }) === 1 &&
          summary === "An honest silence sits in the ring's memory — The measures on either side read 400 B → 500 B." &&
          fleetTrendHoleDeepest({ history: quietRing, currentBytes: 500 }) === "2026-10-17T15:00:00Z"
        );
      } catch {
        return false;
      }
    })());
  pin("AL3 the ANSWERED EDGE IS INVISIBLE (the t1108 M10 film bound: the edge law binds HOLES only — while an ANSWERED point sits at the draw-order's i=0 the walk reads nothing there and the survivor keeps its voice; the hole lands the edge only after its answered older neighbor EVICTS, one measure later — the model that forgot this lagged the world by one push)",
    await (async () => {
      try {
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { fleetTrendHoleSummary, fleetTrendHoleCount } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
        const answeredEdgeRing = [
          { at: "2026-10-17T15:00:00Z", bytes: null },
          { at: "2026-10-17T14:00:00Z", bytes: 400 },
          { at: "2026-10-17T13:00:00Z", bytes: 300 },
        ];
        const f = (n) => `${n} B`;
        const ago = (iso) => `${iso} ago`;
        const summary = fleetTrendHoleSummary({ history: answeredEdgeRing, currentBytes: 500, fmtBytes: f, stampAgo: ago });
        return (
          fleetTrendHoleCount({ history: answeredEdgeRing, currentBytes: 500 }) === 1 &&
          summary === "An honest silence sits in the ring's memory — The measures on either side read 400 B → 500 B."
        );
      } catch {
        return false;
      }
    })());
  pin("AL4 LIVE the present-closing faithfulness (the count's other half — AK4's ring-only recount gains the present: the walk's count over the world's own ring WITH the present read from the connection row's sizes sum closing the line equals the pin's own loop over the draw order with the present appended; whatever the world wears — today the purest flat reads ZERO both ways, the plural's peak would have read TWO)",
    await (async () => {
      try {
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { fleetTrendHoleCount } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
        const sidecar = JSON.parse(readFileSync(path.join(ROOT, "data/remote-fleet-ledger.json"), "utf8"));
        const proj = Object.values(sidecar.projects)[0];
        const conn = Object.values(proj.connections)[0];
        const ring = Object.values(proj.history)[0];
        if (!Array.isArray(ring) || ring.length === 0 || !conn || !conn.sizes) return false;
        const present = Object.values(conn.sizes).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
        const live = fleetTrendHoleCount({ history: ring, currentBytes: present });
        // the pin's OWN recount, the walk's own shape: draw order =
        // the ring reversed (oldest first), the present appended; a
        // point qualifies iff its bytes are null and BOTH neighbors
        // answered (the seq's ends never qualify).
        const seq = [...ring].slice().reverse();
        seq.push({ at: "", bytes: present });
        let recount = 0;
        for (let i = 0; i < seq.length; i++) {
          if (seq[i].bytes != null) continue;
          const older = i > 0 ? seq[i - 1].bytes : null;
          const newer = i < seq.length - 1 ? seq[i + 1].bytes : null;
          if (older != null && newer != null) recount += 1;
        }
        return live === recount;
      } catch {
        return false;
      }
    })());
}

// ---- the AM band — THE BAND'S SILENCES SEAT (t1109): get_fleet_ledger,
// the chat's PRIMARY mouth for "what does the cluster hold", never spoke
// the ring's remembered silences — its only hole words were the PRESENT's
// neighborhood faces. The seat: fleetTrendHoleSummary (ONE well — the
// SAME sentence the dashboard's trend card pours: the singular's pair,
// the plural's ages), the present closing the line, the band's own
// graveAgeLike stamp dialect, the sentence riding as the band's closing
// story after the delta. The silence laws ride the well's own guards: a
// flat ring says NOTHING (the clause drops, the t1055 face stands
// verbatim), the present's air → the seq is the ring alone. ----
{
  const toolsForAM = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");
  pin("AM1 the band's SILENCES SEAT (the AI-side seat of the qualifying silences' sentence: the ONE well's fleetTrendHoleSummary over the connection's own ring with the present closing the line; the sentence rides as the band's closing story after the delta — '.${silences} Heaviest' — and DROPS when the well is silent, the flat world keeping the t1055 face verbatim; the stamp dialect is the band's own graveAgeLike)",
    toolsForAM.includes("const holeSummary = fleetTrendHoleSummary({") &&
      toolsForAM.includes("currentBytes: c.remoteBytesTotal,") &&
      toolsForAM.includes("stampAgo: graveAgeLike,") &&
      toolsForAM.includes("const silences = holeSummary ? ` ${holeSummary}` : \"\";") &&
      toolsForAM.includes("· ${delta}.${silences} Heaviest workdir:"));
  pin("AM2 LIVE ARITHMETIC the band's closing story speaks all three faces (over synthetic rings the well's summary joins into the exact band words — the singular's pair sentence after the delta's period, the plural's ages sentence, and the FLAT world's drop: '. Heaviest workdir' with nothing between — never a stub, never a fake silence)",
    (() => {
      const join = (s) => ` · unchanged since the measure 2m ago.${s ? ` ${s}` : ""} Heaviest workdir: none.`;
      const f = (n) => `${n} B`;
      const ago = (iso) => `${iso} ago`;
      const H = (at) => ({ at, bytes: null });
      const G = (at, bytes) => ({ at, bytes });
      const sing = fleetTrendHoleSummary({ history: [H("2026-10-17T15:00:00Z"), G("2026-10-17T14:00:00Z", 400), G("2026-10-17T13:00:00Z", 300)], currentBytes: 500, fmtBytes: f, stampAgo: ago });
      const plur = fleetTrendHoleSummary({ history: [H("2026-10-17T15:00:00Z"), G("2026-10-17T14:00:00Z", 400), H("2026-10-17T13:00:00Z"), G("2026-10-17T12:00:00Z", 200), G("2026-10-17T11:00:00Z", 100)], currentBytes: 500, fmtBytes: f, stampAgo: ago });
      const flat = fleetTrendHoleSummary({ history: [G("2026-10-17T15:00:00Z", 400), G("2026-10-17T14:00:00Z", 400), G("2026-10-17T13:00:00Z", 300)], currentBytes: 500, fmtBytes: f, stampAgo: ago });
      return join(sing) === " · unchanged since the measure 2m ago. An honest silence sits in the ring's memory — The measures on either side read 400 B → 500 B. Heaviest workdir: none." &&
        join(plur) === " · unchanged since the measure 2m ago. 2 honest silences sit in the ring's memory, the newest 2026-10-17T15:00:00Z ago, the deepest 2026-10-17T13:00:00Z ago, every one between answered measures. Heaviest workdir: none." &&
        join(flat) === " · unchanged since the measure 2m ago. Heaviest workdir: none.";
    })());
  pin("AM3 LIVE the band's silences words are FAITHFUL on the real ring (through the shelf's own dispatch: the band carries the qualifying silences' sentence EXACTLY when the well speaks it over the live ring + present — the count word matches the well's count whatever the world wears; today's flat world says nothing, a holed world would wear the sentence verbatim; never a disagreement)",
    await (async () => {
      try {
        // ⚠ PIN the DB explicitly (the t377/t635 poisoning lesson).
        process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
        const { fleetTrendHoleCount } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
        const { PrismaClient } = await import("@prisma/client");
        const db = new PrismaClient();
        const project = await db.project.findFirst({ where: { name: "β-Galactosidase Tutorial (demo)" }, select: { id: true } });
        await db.$disconnect();
        if (!project) return false;
        const r = await executeAiTool("get_fleet_ledger", {}, { projectId: project.id });
        const summary = r?.summary ?? "";
        // the same well, the same ring + present: the sidecar's own
        // history and the connection row's sizes sum (the AL4 pattern).
        const sidecar = JSON.parse(readFileSync(path.join(ROOT, "data/remote-fleet-ledger.json"), "utf8"));
        const proj = Object.values(sidecar.projects)[0];
        const conn = Object.values(proj.connections)[0];
        const ring = Object.values(proj.history)[0];
        if (!Array.isArray(ring) || !conn?.sizes) return false;
        const present = Object.values(conn.sizes).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
        const count = fleetTrendHoleCount({ history: ring, currentBytes: present });
        if (count === 0) return !summary.includes("honest silence") && !summary.includes("honest silences");
        if (count === 1) return summary.includes("An honest silence sits in the ring's memory");
        return summary.includes(`${count} honest silences sit in the ring's memory`);
      } catch {
        return false;
      }
    })());
}

// ---- the AN band — THE WALK-FAILED WORLD'S SILENCES FACE (t1110): the
// t1109 seat's stress world, filmed LIVE (scripts/t1110-walk-silences-ride.mjs).
// THE CLAIM: the silences are CLUSTER-side facts (walkQualifyingHoles
// reads seq[i].bytes — the cluster series only), so the local walk's
// failure must never silence the sentence, and the sentence must never
// FAKE a silence from the walk's own mirror-nulls. The COEXISTENCE: the
// band speaks the delta's waits-words (mirror-side) AND the silences
// sentence (cluster-side) in ONE band; the drill's ring-only compact
// count never sees the present-closed trailing hole (the t1092 law's
// own dialect line). ----
{
  const toolsForAN = readFileSync(path.join(ROOT, "src/lib/ai/tools.ts"), "utf8");
  pin("AN1 the seat's CLUSTER-SIDE placement (the holeSummary block reads ONLY the cluster inputs — c.history + c.remoteBytesTotal — and never forks on the walk's spokenness: the walk's failure is the MIRROR side's weather, the memory's silences are the CLUSTER side's facts; the delta's waits-words fork separately on !mirrorWalkSpoke, and the return joins the sentence unconditionally beside them — the two faces ride one band)",
    (() => {
      const start = toolsForAN.indexOf("const holeSummary = fleetTrendHoleSummary({");
      const end = toolsForAN.indexOf("const silences = holeSummary");
      if (start < 0 || end < 0 || end < start) return false;
      const seat = toolsForAN.slice(start, end);
      const seatUngated = !seat.includes("mirrorWalkSpoke");
      const seatInputs = seat.includes("history: c.history,") && seat.includes("currentBytes: c.remoteBytesTotal,");
      const deltaFork = toolsForAN.includes('!c.mirrorWalkSpoke\n        ? "the policy comparison waits for a spoken mirror walk (the local walk failed, the mirror side is unverified)"');
      const unconditionalJoin = toolsForAN.includes("· ${delta}.${silences} Heaviest workdir:");
      return seatUngated && seatInputs && deltaFork && unconditionalJoin;
    })());
  pin("AN2 LIVE ARITHMETIC the channel-distinct silences (over synthetic rings: (a) a ring carrying the WALK's silence in its memory — mirror-null points, the cluster words answered — speaks NOTHING: the walk's silence is not a silences hole; (b) the same shape with ONE cluster-null interior speaks the SINGULAR — the mirror-null riding the same point never adds a voice; (c) the failed-walk input shape — the holed ring + the ANSWERED present — speaks the sentence: the sentence's inputs never touch the mirror channel)",
    (() => {
      const f = (n) => `${n} B`;
      const ago = (iso) => `${iso} ago`;
      // (a) the walk's silence in the memory: every point's mirrorBytes
      // null on the newest end, the cluster words ALL answered
      const walkSilent = fleetTrendHoleSummary({
        history: [
          { at: "t3", bytes: 500, mirrorBytes: null },
          { at: "t2", bytes: 400, mirrorBytes: 400 },
          { at: "t1", bytes: 300, mirrorBytes: 300 },
        ],
        currentBytes: 500, fmtBytes: f, stampAgo: ago,
      });
      const a = walkSilent === null;
      // (b) one cluster-null interior — the mirror-null rides the SAME
      // point and the count is still exactly the cluster's one
      const holed = fleetTrendHoleSummary({
        history: [
          { at: "t4", bytes: 500, mirrorBytes: 500 },
          { at: "t3", bytes: null, mirrorBytes: null },
          { at: "t2", bytes: 400, mirrorBytes: 400 },
          { at: "t1", bytes: 300, mirrorBytes: 300 },
        ],
        currentBytes: 600, fmtBytes: f, stampAgo: ago,
      });
      const b = holed === "An honest silence sits in the ring's memory — The measures on either side read 400 B → 500 B.";
      // (c) the failed-walk input shape: the holed ring + the ANSWERED
      // present — the sentence speaks (the coexistence's arithmetic)
      const brokenWalk = fleetTrendHoleSummary({
        history: [
          { at: "t3", bytes: null, mirrorBytes: null },
          { at: "t2", bytes: 400, mirrorBytes: 400 },
          { at: "t1", bytes: 300, mirrorBytes: 300 },
        ],
        currentBytes: 500, fmtBytes: f, stampAgo: ago,
      });
      const c = brokenWalk === "An honest silence sits in the ring's memory — The measures on either side read 400 B → 500 B.";
      return a && b && c;
    })());
  pin("AN3 LIVE the two failed-walk faces CO-VARY and the sentence stays independent (through the shelf's own dispatch on the real world: the band carries the delta's waits-words EXACTLY when its own mirror clause reads the unreadable face — never one without the other — and the silences clause still matches the well's count over the live ring + present whatever the walk wears; today's flat world wears neither face and says nothing, a holed-and-broken world would wear all three honestly)",
    await (async () => {
      try {
        // ⚠ PIN the DB explicitly (the t377/t635 poisoning lesson).
        process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";
        const { createJiti } = await import("jiti");
        const __jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") } });
        const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
        const { fleetTrendHoleCount } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
        const { PrismaClient } = await import("@prisma/client");
        const db = new PrismaClient();
        const project = await db.project.findFirst({ where: { name: "β-Galactosidase Tutorial (demo)" }, select: { id: true } });
        await db.$disconnect();
        if (!project) return false;
        const r = await executeAiTool("get_fleet_ledger", {}, { projectId: project.id });
        const summary = r?.summary ?? "";
        const band = summary.split(" | ")[0] ?? "";
        const unreadable = band.includes("the mirror side unreadable");
        const waits = band.includes("the policy comparison waits for a spoken mirror walk");
        if (waits !== unreadable) return false; // the co-variation
        const sidecar = JSON.parse(readFileSync(path.join(ROOT, "data/remote-fleet-ledger.json"), "utf8"));
        const proj = Object.values(sidecar.projects)[0];
        const conn = Object.values(proj.connections)[0];
        const ring = Object.values(proj.history)[0];
        if (!Array.isArray(ring) || !conn?.sizes) return false;
        const present = Object.values(conn.sizes).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
        const count = fleetTrendHoleCount({ history: ring, currentBytes: present });
        // the sentence's independence: whatever the walk wears, the
        // clause matches the well's count — never suppressed by the
        // walk's failure, never faked by it
        if (count === 0) return !band.includes("honest silence") && !band.includes("honest silences");
        if (count === 1) return band.includes("An honest silence sits in the ring's memory");
        return band.includes(`${count} honest silences sit in the ring's memory`);
      } catch {
        return false;
      }
    })());
  pin("AN4 LIVE ARITHMETIC the plural's TRAILING RETURN — the two dialects' honest life (the t1111 film's law, over synthetic rings: (a) the trailing birth's DISAGREEMENT — the ring [null HEAD, g, g, null INTERIOR, g] + the ANSWERED present: the band's count speaks TWO (the trailing hole qualifies through the present), the drill's ring-only count speaks ONE (the head null has no newer reading) — both honest, the trailing seat is the difference; and the band's summary wears the t1073 second age on two trailing-born holes; (b) the lag's CLOSURE — the same holes one push later (the head null interior): the drill's own plural, the dialects re-agree; (c) the plural's EDGE DESCENT — the deepest hole at the draw-order's OLDEST edge qualifies no more: the count hands down to the singular in BOTH dialects)",
    (() => {
      const f = (n) => `${n} B`;
      const ago = (iso) => `${iso} ago`;
      // (a) the trailing birth: H2 at the ring's HEAD (history[0], the
      // newest end), H1 interior — the band closes the line with the
      // present, the drill reads the ring alone
      const bornRing = [
        { at: "t5", bytes: null, mirrorBytes: null },
        { at: "t4", bytes: 500, mirrorBytes: 500 },
        { at: "t3", bytes: 500, mirrorBytes: 500 },
        { at: "t2", bytes: null, mirrorBytes: null },
        { at: "t1", bytes: 500, mirrorBytes: 500 },
      ];
      const bandBorn = fleetTrendHoleCount({ history: bornRing, currentBytes: 600 });
      const drillBorn = fleetTrendHoleCount({ history: bornRing, currentBytes: null });
      const bornSummary = fleetTrendHoleSummary({ history: bornRing, currentBytes: 600, fmtBytes: f, stampAgo: ago });
      const a = bandBorn === 2 && drillBorn === 1 &&
        bornSummary === "2 honest silences sit in the ring's memory, the newest t5 ago, the deepest t2 ago, every one between answered measures.";
      // (b) the lag's closure: one push later — H2 interior at index 1,
      // the head spoken; the drill's own plural
      const closedRing = [
        { at: "t6", bytes: 600, mirrorBytes: 600 },
        { at: "t5", bytes: null, mirrorBytes: null },
        { at: "t4", bytes: 500, mirrorBytes: 500 },
        { at: "t3", bytes: 500, mirrorBytes: 500 },
        { at: "t2", bytes: null, mirrorBytes: null },
        { at: "t1", bytes: 500, mirrorBytes: 500 },
      ];
      const bandClosed = fleetTrendHoleCount({ history: closedRing, currentBytes: 600 });
      const drillClosed = fleetTrendHoleCount({ history: closedRing, currentBytes: null });
      const b = bandClosed === 2 && drillClosed === 2;
      // (c) the edge descent: the deepest hole (H1, t1) reaches the
      // draw-order's OLDEST edge (history's last) — no older neighbor;
      // the count hands down to the singular in both dialects
      const edgeRing = [
        { at: "t6", bytes: 600, mirrorBytes: 600 },
        { at: "t5", bytes: 600, mirrorBytes: 600 },
        { at: "t4", bytes: null, mirrorBytes: null },
        { at: "t3", bytes: 500, mirrorBytes: 500 },
        { at: "t2", bytes: 500, mirrorBytes: 500 },
        { at: "t1", bytes: null, mirrorBytes: null },
      ];
      const bandEdge = fleetTrendHoleCount({ history: edgeRing, currentBytes: 600 });
      const drillEdge = fleetTrendHoleCount({ history: edgeRing, currentBytes: null });
      const c = bandEdge === 1 && drillEdge === 1;
      return a && b && c;
    })());
  pin("AN5 LIVE ARITHMETIC the THIRD BIRTH — the plural's family completed (the t1112 film's law, over synthetic rings: (a) the t1073 sentence is COUNT-AGNOSTIC — three trailing-born holes one relaunch apart (the BIRTH RHYTHM: one birth cycle is two pushes — the failed measure's outgoing-good push, then the trailing birth's push — so the holes sit three pushes apart) + the ANSWERED present: the band's count speaks THREE, the drill's ring-only count speaks TWO (the head null has no newer reading), and the summary wears the ONE shape at three — '3 honest silences sit in the ring's memory, the newest …, the deepest …, every one between answered measures.'; (b) the lag's CLOSURE at three — one push later (the head null carried interior): the drill's own three, the dialects re-agree; (c) the FIRST DESCENT — the deepest hole at the draw-order's OLDEST edge qualifies no more: the three hands down to TWO in BOTH dialects (the band and the drill walk the OLDEST edge together — the lag lived only at the TRAILING end); (d) THE QUIET — the last hole at the OLDEST edge: the clause DROPS (a walk that reads only holes has nothing to say), both dialects silent, both honest)",
    (() => {
      const f = (n) => `${n} B`;
      const ago = (iso) => `${iso} ago`;
      const g = (at) => ({ at, bytes: 500, mirrorBytes: 500 });
      const h = (at) => ({ at, bytes: null, mirrorBytes: null });
      // (a) the third birth: H3 at the HEAD (born trailing), H2 three
      // pushes deeper, H1 six — the birth rhythm's own spacing
      const bornRing = [h("t7"), g("t6"), g("t5"), h("t4"), g("t3"), g("t2"), h("t1"), g("t0")];
      const bandBorn = fleetTrendHoleCount({ history: bornRing, currentBytes: 600 });
      const drillBorn = fleetTrendHoleCount({ history: bornRing, currentBytes: null });
      const bornSummary = fleetTrendHoleSummary({ history: bornRing, currentBytes: 600, fmtBytes: f, stampAgo: ago });
      const a = bandBorn === 3 && drillBorn === 2 &&
        bornSummary === "3 honest silences sit in the ring's memory, the newest t7 ago, the deepest t1 ago, every one between answered measures.";
      // (b) the lag's closure at three: one push later — H3 interior at
      // index 1, the head spoken; the drill's own three
      const closedRing = [g("t8"), h("t7"), g("t6"), g("t5"), h("t4"), g("t3"), g("t2"), h("t1"), g("t0")];
      const bandClosed = fleetTrendHoleCount({ history: closedRing, currentBytes: 600 });
      const drillClosed = fleetTrendHoleCount({ history: closedRing, currentBytes: null });
      const b = bandClosed === 3 && drillClosed === 3;
      // (c) the first descent: H1 (t1) at the draw-order's OLDEST edge
      // (history's last) — the three hands down to two in BOTH dialects
      const edgeRing = [g("t9"), h("t8"), g("t7"), g("t6"), h("t5"), g("t4"), g("t3"), h("t2")];
      const bandEdge = fleetTrendHoleCount({ history: edgeRing, currentBytes: 600 });
      const drillEdge = fleetTrendHoleCount({ history: edgeRing, currentBytes: null });
      const c = bandEdge === 2 && drillEdge === 2;
      // (d) the quiet: the LAST hole at the OLDEST edge — the clause
      // drops (summary null), both counts quiet
      const quietRing = [g("t11"), g("t10"), g("t9"), g("t8"), g("t7"), g("t6"), g("t5"), h("t4")];
      const bandQuiet = fleetTrendHoleCount({ history: quietRing, currentBytes: 600 });
      const drillQuiet = fleetTrendHoleCount({ history: quietRing, currentBytes: null });
      const quietSummary = fleetTrendHoleSummary({ history: quietRing, currentBytes: 600, fmtBytes: f, stampAgo: ago });
      const d = bandQuiet === 0 && drillQuiet === 0 && quietSummary === null;
      return a && b && c && d;
    })());
  pin("AN6 LIVE ARITHMETIC THE ABSENT WORLD'S OWN SILENCES — the two eras' meeting (the t1113 film's law, over synthetic rings: (a) THE ZERO IS AN ANSWER — a hole between two SPOKEN ZERO cells qualifies and the pair reads '0 B → 0 B' (the absent zero never became a silence by itself: a ring of zeros beside the answered present births NO hole, the summary null — the t1104 zero's second face); (b) THE HOLE IS ONE CHANNEL'S SILENCE — the failed record carries bytes: null BESIDE mirrorBytes: 0 (the local walk SPOKE), the silences walk reads the CLUSTER channel only, and the pair stays the cluster's own words while every cell in the ring wears the mirror's spoken zero; (c) THE TWO-CHANNEL VERDICT FORK AT ONE CELL — the cluster's delta at the hole cell waits (kind 'hole', no reading against air) WHILE the mirror's delta at the SAME cell speaks 'up' (its prev is the SPOKEN zero, never air) — one cell, two channels, two honest verdicts; (d) THE UP FACE'S RETURN SEAT — the return's hop speaks 'up' across the absent zero the moment the mirrors come home (the t1104 law re-earned in the silences era), and the all-absent guard keeps its face: the same shape WITH allMirrorsAbsent stays silent ('unchanged'/'up' with no mirrors present is a false subject — the t1100 law holds at the return too)",
    (() => {
      const f = (n) => `${n} B`;
      const ago = (iso) => `${iso} ago`;
      const g = (at) => ({ at, bytes: 500, mirrorBytes: 500 });
      // the ABSENT world's cell: cluster spoken, mirror the spoken zero
      const z = (at) => ({ at, bytes: 500, mirrorBytes: 0 });
      // the FAILED record's shape: the hole carries the mirror's spoken zero
      const hz = (at) => ({ at, bytes: null, mirrorBytes: 0 });
      // (a) the zero is an answer: a hole between two CLUSTER-channel
      //     zero cells qualifies with the "0 B → 0 B" pair (the pair
      //     reads the cluster's bytes — the zero rides the channel's own
      //     word); zeros alone birth nothing
      const cz = (at) => ({ at, bytes: 0, mirrorBytes: 0 });
      const zeroPair = fleetTrendHoleSummary({ history: [cz("t2"), hz("t1"), cz("t0")], currentBytes: 0, fmtBytes: f, stampAgo: ago });
      const pairFace = fleetTrendHolePair({ olderBytes: 0, newerBytes: 0, fmtBytes: f });
      const zeroRing = [cz("t1"), cz("t0")];
      const zeroAlone = fleetTrendHoleSummary({ history: zeroRing, currentBytes: 0, fmtBytes: f, stampAgo: ago });
      const a = zeroPair === "An honest silence sits in the ring's memory — The measures on either side read 0 B → 0 B." && pairFace === "The measures on either side read 0 B → 0 B" && zeroAlone === null;
      // (b) the hole is ONE channel's silence: the ring's every mirror
      //     word is the spoken zero, the pairs stay the cluster's words
      const absentRing = [z("t3"), z("t2"), hz("t1"), z("t0")];
      const absentSummary = fleetTrendHoleSummary({ history: absentRing, currentBytes: 500, fmtBytes: f, stampAgo: ago });
      const b = absentSummary === "An honest silence sits in the ring's memory — The measures on either side read 500 B → 500 B.";
      // (c) the two-channel fork at one cell: the cluster waits, the
      //     mirror speaks — the SAME cell, two honest verdicts
      const clusterVerdict = fleetTrendDelta({ history: [{ at: "t1", bytes: null, mirrorBytes: 0 }], currentBytes: 500 });
      const mirrorVerdict = fleetTrendMirrorDelta({ history: [{ at: "t1", bytes: null, mirrorBytes: 0 }], currentMirrorBytes: 500 });
      const c = clusterVerdict?.kind === "hole" && mirrorVerdict?.kind === "up" && mirrorVerdict.deltaBytes === 500;
      // (d) the return's seat: the UP face speaks across the zero when
      //     the mirrors come home; the guard keeps the false subject out
      const returnHop = fleetTrendMirrorHop({ history: [{ at: "t1", bytes: null, mirrorBytes: 0 }], currentMirrorBytes: 500, fmtBytes: f, stampAgo: ago, allMirrorsAbsent: false });
      const guardedHop = fleetTrendMirrorHop({ history: [{ at: "t1", bytes: null, mirrorBytes: 0 }], currentMirrorBytes: 500, fmtBytes: f, stampAgo: ago, allMirrorsAbsent: true });
      const d = returnHop === "The mirrors are up 500 B since the measure t1 ago." && guardedHop === null;
      return a && b && c && d;
    })());
}

// ---- AN7 — THE TWO-DB TRAP'S OWN WELL (t1115): the t1114 law pinned in
// the verdict's ONE home (src/lib/db-world.ts, the pure zero-prisma well
// the db singleton drinks): the runtime world is db/cryoflow.db
// (dev-server.sh L82's own law), .env's custom.db is the TEMPLATE the seed
// was born from — the warn fires IFF the URL names a world that is not the
// runtime one; HARDENED past the t1114 quick `includes` (the look-alike
// worlds cryoflow.db-wal / cryoflow.db.bak / mycryoflow.db earn the warn
// now), production never sings, the honest absence (an unset URL) says
// nothing, and the warn names BOTH worlds and the law (t1114's misread
// swept 3.1 GB of LIVE workdirs on the strength of the wrong-world read —
// the guard exists so no window repeats it). ----
{
  const worldWell = readFileSync(path.join(ROOT, "src/lib/db-world.ts"), "utf8");
  const { templateWorldWarnOf } = await import("../src/lib/db-world.ts");
  const T = (u, o) => templateWorldWarnOf(u, o);
  pin("AN7 THE TWO-DB TRAP'S ONE HOME — the template-world verdict lives once (src/lib/db-world.ts, the pure well; the t1114 law as arithmetic: (a) THE TEMPLATE WORLD WARNS — .env's custom.db earns the sentence that names BOTH worlds and the law ('TEMPLATE world', 'cryoflow.db', 'dev-server.sh L82') and the honest consequences ('will not see the live project, jobs, edges, or fleet ring'); (b) THE RUNTIME WORLD IS SILENT — file:/…/db/cryoflow.db and its query-param shapes return null (the world is the world); (c) THE HARDENED SUFFIX — cryoflow.db-wal, cryoflow.db.bak, mycryoflow.db are look-alike worlds, not the world: they earn the warn where the t1114 quick `includes` let them pass silently, and query params (?connection_limit=1) strip off before the test so the runtime URL is never false-accused; (d) PRODUCTION NEVER SINGS and the unset URL is the honest absence — both null)",
    (() => {
      // (a) the template world warns and names both worlds + the law
      const warn = T("file:/home/z/my-project/db/custom.db");
      const a =
        warn !== null &&
        warn.includes('file:/home/z/my-project/db/custom.db') &&
        warn.includes("TEMPLATE world") &&
        warn.includes("cryoflow.db") &&
        warn.includes("dev-server.sh L82") &&
        warn.includes("will not see the live project, jobs, edges, or fleet ring");
      // (b) the runtime world stays silent (absolute, relative, and
      //     query-param shapes are all the same world)
      const b =
        T("file:/home/z/my-project/db/cryoflow.db") === null &&
        T("file:./db/cryoflow.db") === null &&
        T("file:/home/z/my-project/db/cryoflow.db?connection_limit=1") === null;
      // (c) the hardened suffix: look-alikes earn the warn, params strip
      const c =
        T("file:/home/z/my-project/db/cryoflow.db-wal") !== null &&
        T("file:/home/z/my-project/db/cryoflow.db.bak") !== null &&
        T("file:/home/z/my-project/db/mycryoflow.db") !== null &&
        T("file:/elsewhere/cryoflow.db") === null;
      // (d) production never sings; the unset URL is the honest absence
      const d =
        T("file:/home/z/my-project/db/custom.db", { production: true }) === null &&
        T(undefined) === null;
      // the well is located and names its law in source (the static face)
      const src =
        worldWell.includes("THE TWO-DB TRAP'S ONE HOME") &&
        worldWell.includes('path.join(process.cwd(), "db", "cryoflow.db")') &&
        /\/\(\^\|\[\/=:\]\)cryoflow\\\.db\$\//.test(worldWell);
      return a && b && c && d && src;
    })());
}

// ---- AN8 — THE FAILURE WORD'S ONE HOME (t1116): the fleet card's two
// filmed scars cured by arithmetic (the wells in src/lib/remote/fleet-trend.ts,
// the family's zero-import ONE home): FACE A — THE DOUBLED WORD (filmed live:
// the catch path set the SENTENCE into the string state the server's raw
// word used, and the courtesy line wrapped the sentence inside its own
// template — "could not be read (The fleet ledger could not be read — …)");
// FACE B — THE SILENT MEASURE FAILURE (filmed live twice: Measure now died,
// the card said nothing, the stamp kept the old word). The cure rides the
// SHAPE: the failure is a typed FleetFailure ({ kind: "unanswered" } |
// { kind: "server", raw }), the attribution clause is ONE home, the read
// line and the measure note are composable only through it, and the card
// carries the amber note seat (the family's warning face, aria-live). ----
{
  const { fleetFailureAttribution, fleetReadFailureLine, fleetMeasureFailureLine } =
    await import("../src/lib/remote/fleet-trend.ts");
  const trendWell = readFileSync(path.join(ROOT, "src/lib/remote/fleet-trend.ts"), "utf8");
  const cardSrc = readFileSync(path.join(ROOT, "src/components/workflow/fleet-trend-card.tsx"), "utf8");
  const once = (hay, needle) => hay.split(needle).length - 1 === 1;
  pin("AN8 THE FAILURE WORD'S ONE HOME — the card's two filmed scars cured by shape (the wells in fleet-trend.ts: (a) THE UNANSWERED FACE SPEAKS ITS OWN WORDS — the attribution is the family's question verbatim, the read line composes it ONCE with the door clause; (b) THE SERVER'S WORD IS ATTRIBUTED VERBATIM — 'the server answered: HTTP 500' and a full server sentence ride raw, never rewrapped; (c) THE DOUBLED WORD IS IMPOSSIBLE BY SHAPE — for both kinds the read line contains the sentence exactly once; (d) THE MEASURE NOTE NAMES THE ATTEMPT — 'Measure now', the attribution, and 'the last honest numbers' for both kinds; (e) THE SRC FACE — the wells live once in fleet-trend.ts (zero imports, the sentence owned once across src) and the card drinks them: no local template, the amber seat (fleet-card-measure-error, aria-live, bg-warning/10) mounted, the catch riding { kind: \"unanswered\" })",
    (() => {
      const UN = { kind: "unanswered" };
      const SV = { kind: "server", raw: "HTTP 500" };
      // (a) the unanswered face: the attribution is the family's question
      const a =
        fleetFailureAttribution(UN) === "the server never answered — is it reachable?" &&
        once(fleetReadFailureLine(UN), "The fleet ledger could not be read") &&
        fleetReadFailureLine(UN).includes("(the server never answered — is it reachable?)") &&
        fleetReadFailureLine(UN).includes("the storage overview's Cluster ledger keeps the full band");
      // (b) the server's word rides verbatim (the status AND a sentence)
      const sentence = "Fleet ledger is not available for this project";
      const b =
        fleetFailureAttribution(SV) === "the server answered: HTTP 500" &&
        fleetFailureAttribution({ kind: "server", raw: sentence }) === `the server answered: ${sentence}` &&
        fleetReadFailureLine(SV).includes("(the server answered: HTTP 500)");
      // (c) THE DOUBLED WORD IS IMPOSSIBLE BY SHAPE — both kinds, one sentence
      const c =
        once(fleetReadFailureLine(UN), "The fleet ledger could not be read") &&
        once(fleetReadFailureLine(SV), "The fleet ledger could not be read") &&
        !fleetReadFailureLine(UN).includes("(The fleet ledger could not be read");
      // (d) the measure note names the attempt, the death, and the kept band
      const d =
        fleetMeasureFailureLine(UN).startsWith("Measure now could not buy a live read") &&
        fleetMeasureFailureLine(SV).includes("the server answered: HTTP 500") &&
        once(fleetMeasureFailureLine(UN), "the last honest numbers") &&
        once(fleetMeasureFailureLine(SV), "the last honest numbers");
      // (e) the src face: the wells live once; the card drinks them
      const e =
        trendWell.includes("export type FleetFailure") &&
        trendWell.includes("export function fleetFailureAttribution") &&
        trendWell.includes("export function fleetReadFailureLine") &&
        trendWell.includes("export function fleetMeasureFailureLine") &&
        // t1117 honest re-key: the well now carries the sentence TWICE — the
        // card's pointer line AND the dialog's self line (the fork BY DESIGN,
        // AN9's (b) face) — the doubling scar was a template wrapping the
        // sentence, never two composers in the ONE well; each composed OUTPUT
        // still owns it exactly once (AN9's once-faces hold the law)
        trendWell.split("The fleet ledger could not be read").length - 1 === 2;
      const e2 =
        cardSrc.includes("fleetReadFailureLine") &&
        cardSrc.includes("fleetMeasureFailureLine") &&
        !cardSrc.includes("The fleet ledger could not be read") &&
        cardSrc.includes('data-testid="fleet-card-measure-error"') &&
        cardSrc.includes('aria-live="polite"') &&
        cardSrc.includes("bg-warning/10") &&
        cardSrc.includes('{ kind: "unanswered" }');
      return a && b && c && d && e && e2;
    })());
}

// ---- AN9 — THE DIALOG DRINKS THE FAMILY (t1117): the storage dialog's
// fleetError was the failure word's LAST FORK — the catch carried its own
// sentence ("The fleet ledger could not be read — is the server reachable?")
// instead of the family's attribution, the state was the same two-faces-in-
// one-string the card's doubled word grew from, and the read seat sat
// INSIDE the fleet guard — a failed FIRST read dissolved the section AND
// the error with it (the word died unseen; the t1116 silent-attempt
// family's dialog face). The cure rides the SHAPE: two FleetFailure states
// (read + measure), the seats composed only through the wells (the dialog's
// read line drops the card's pointer tail — the dialog IS the storage
// overview, a door never points at itself), the read seat living ABOVE the
// fleet guard so the dissolve can never swallow it again. ----
{
  const { fleetDialogReadFailureLine, fleetReadFailureLine, fleetMeasureFailureLine, fleetFailureAttribution } =
    await import("../src/lib/remote/fleet-trend.ts");
  const dialogSrc = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  const once = (hay, needle) => hay.split(needle).length - 1 === 1;
  pin("AN9 THE DIALOG DRINKS THE FAMILY — the dialog's last fork cured by shape (the wells in fleet-trend.ts: (a) THE DIALOG'S READ LINE — the family's opening clause + attribution, NO pointer tail (a door never points at itself), verbatim for both kinds; (b) THE FORK IS BY DESIGN — the card's line keeps the pointer clause, the dialog's drops it, both own the opening clause exactly once; (c) THE MEASURE FACE IS THE FAMILY'S — the same fleetMeasureFailureLine the card speaks, verbatim; (d) THE DISSOLVE CURE — the read seat lives OUTSIDE the fleet guard (fleet-ledger-read-error above the section), the measure seat inside the frame (fleet-ledger-measure-error), both the amber family face (aria-live polite, bg-warning/10); (e) THE SRC FACE — the dialog drinks the wells, the old inline sentence is DEAD (the fork's own words absent from the dialog src), the state rides the shape (two FleetFailure states), the catch riding { kind: \"unanswered\" })",
    (() => {
      const UN = { kind: "unanswered" };
      const SV = { kind: "server", raw: "HTTP 500" };
      const sentence = "Fleet ledger is not available for this project";
      // (a) the dialog's read line: family's clause + attribution, no pointer
      const a =
        fleetDialogReadFailureLine(UN) ===
          "The fleet ledger could not be read (the server never answered — is it reachable?)." &&
        fleetDialogReadFailureLine(SV) === "The fleet ledger could not be read (the server answered: HTTP 500)." &&
        fleetDialogReadFailureLine({ kind: "server", raw: sentence }).includes(`(the server answered: ${sentence})`) &&
        !fleetDialogReadFailureLine(UN).includes("the storage overview's Cluster ledger");
      // (b) the fork is BY DESIGN — pointer vs self, one opening clause each
      const b =
        fleetReadFailureLine(UN).includes("the storage overview's Cluster ledger keeps the full band") &&
        once(fleetDialogReadFailureLine(UN), "The fleet ledger could not be read") &&
        once(fleetReadFailureLine(UN), "The fleet ledger could not be read");
      // (c) the measure face is the family's ONE line (the dialog reuses it)
      const c =
        fleetMeasureFailureLine(UN).startsWith("Measure now could not buy a live read") &&
        fleetMeasureFailureLine(UN).includes(fleetFailureAttribution(UN)) &&
        once(fleetMeasureFailureLine(UN), "the last honest numbers");
      // (d) THE DISSOLVE CURE — the read seat above the guard, both amber
      const d =
        dialogSrc.includes('data-testid="fleet-ledger-read-error"') &&
        dialogSrc.includes('data-testid="fleet-ledger-measure-error"') &&
        dialogSrc.indexOf("fleet-ledger-read-error") < dialogSrc.indexOf("{fleet && fleet.connections.length > 0 && (") &&
        dialogSrc.indexOf("fleet-ledger-measure-error") > dialogSrc.indexOf("data-testid=\"fleet-ledger-section\"") &&
        dialogSrc.split('aria-live="polite"').length - 1 >= 2 &&
        dialogSrc.split("bg-warning/10").length - 1 >= 2;
      // (e) the src face: the wells drunk, the old sentence DEAD, the shape
      const e =
        dialogSrc.includes("fleetDialogReadFailureLine(fleetError)") &&
        dialogSrc.includes("fleetMeasureFailureLine(fleetMeasureError)") &&
        // the FORK's own full sentence is dead (the walk's and the burial's
        // own "— is the server reachable?" tails are THEIR families' words,
        // honest where they live — the needle is the fleet fork's whole line)
        !dialogSrc.includes("The fleet ledger could not be read — is the server reachable?") &&
        dialogSrc.split("FleetFailure | null").length - 1 >= 2 &&
        dialogSrc.includes('{ kind: "unanswered" }') &&
        dialogSrc.includes('kind: "server"');
      return a && b && c && d && e;
    })());
}

// ---- AN10 — THE DIALOG'S EVERY MOUTH SPEAKS POLITELY (t1118): the aria
// census found FIVE silent mouths left in the storage dialog — the walk's
// danger panel (its failed Try-again re-render was announced by NOTHING),
// the walk's loading face, the clean receipt, the graveyard's error and
// receipt. The cure is the family's ONE dialect: every failure/wait/receipt
// seat carries aria-live="polite" (t1116/t1117's politeness, never an
// assertive role="alert" — one voice for the whole dialog), the walk's
// danger panel grows its film name (storage-walk-error). t1120 grows (f):
// THE RETRY KEEPS ITS SEAT — the Try-again's OWN busy face rides INSIDE the
// panel's one polite region (no new mouth — the count stays seven). Healthy
// world: ZERO churn (every live region rides a state that is null when the
// world speaks). ----
{
  const dialogSrc = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  pin("AN10 THE DIALOG'S EVERY MOUTH SPEAKS POLITELY — the aria census's five silent mouths cured in the family's ONE dialect (a) THE WALK'S DANGER PANEL — storage-walk-error named, polite, the failed Try-again announced; (b) THE WAIT SPEAKS — the loading face polite, the walk named while it runs; (c) THE CLEAN RECEIPT polite (its own data-storage-receipt dialect kept); (d) THE GRAVEYARD'S TWO — error + receipt polite; (e) THE UNIFORM VOICE — the dialog's polite count is SEVEN (the fleet's two from t1117 + the five), no role=\"alert\" anywhere (politeness is the family's only volume); (f) THE RETRY KEEPS ITS SEAT (t1120) — the Try-again's OWN busy face: the door disabled while the re-walk runs (the second click refused, not lost), the icon spinning, the word Re-walking… announced by the same polite region (no new mouth — the count stays seven); the failure story is not erased before the next verdict exists",
    (() => {
      // (a) the walk's danger panel: named + polite, INSIDE the error branch
      const a =
        dialogSrc.includes('data-testid="storage-walk-error"') &&
        dialogSrc.indexOf('data-testid="storage-walk-error"') > dialogSrc.indexOf("{error ? (");
      // (b) the wait speaks its existence — the polite attribute rides the
      // loading face (the polite find after the ternary's open lands before
      // the "Walking the run directories" text)
      const b =
        dialogSrc.includes("Walking the run directories") &&
        dialogSrc.indexOf('aria-live="polite"', dialogSrc.indexOf("{error ? (")) <
          dialogSrc.indexOf("Walking the run directories");
      // (c) the clean receipt rides its own dialect + politeness
      const c =
        dialogSrc.includes('data-storage-receipt=""') &&
        dialogSrc.indexOf('data-storage-receipt=""') < dialogSrc.indexOf('aria-live="polite"', dialogSrc.indexOf('data-storage-receipt=""'));
      // (d) the graveyard's two mouths
      const d =
        dialogSrc.indexOf('data-testid="graveyard-error"') < dialogSrc.indexOf('aria-live="polite"', dialogSrc.indexOf('data-testid="graveyard-error"')) &&
        dialogSrc.indexOf('data-testid="graveyard-receipt"') < dialogSrc.indexOf('aria-live="polite"', dialogSrc.indexOf('data-testid="graveyard-receipt"'));
      // (e) THE UNIFORM VOICE — seven polite mouths, zero assertive
      const e =
        dialogSrc.split('aria-live="polite"').length - 1 === 7 &&
        !dialogSrc.includes('role="alert"') &&
        !dialogSrc.includes("aria-live=\"assertive\"");
      // (f) t1120 — the retry keeps its seat: the busy face rides INSIDE the
      // panel's one polite region — the door disabled (the second click
      // refused), the icon spinning, the busy word spoken, the enabled word
      // kept for the verdict's turn (the panel's own element window, the
      // t806 lesson: a class-level needle cannot see WHICH button wears it)
      const panelIdx = dialogSrc.indexOf('data-testid="storage-walk-error"');
      const win = panelIdx >= 0 ? dialogSrc.slice(panelIdx, panelIdx + 900) : "";
      const f =
        panelIdx > dialogSrc.indexOf("{error ? (") &&
        win.includes('data-testid="storage-walk-retry"') &&
        win.includes("disabled={loading}") &&
        win.includes("Re-walking the run directories…") &&
        win.includes("animate-spin") &&
        win.indexOf('"Re-walking…"') >= 0 &&
        win.indexOf('"Re-walking…"') < win.indexOf('"Try again"');
      return a && b && c && d && e && f;
    })());
}

// ---- AN11 — THE NEWEST WALK OWNS THE BOARD (t1120): the walk is the
// physical truth and it is slow, so two walks can be requested in one
// breath (a manual Refresh crossing the post-clean re-walk, a retry
// crossing a burial's finally). Every load() takes a sequence number; only
// the newest requested walk on the LIVING dialog paints (a superseded
// verdict is refused at the door — stale bytes never overwrite a fresh
// receipt's arithmetic, a stale failure never erases fresh contents, a
// closed dialog's ghost walk paints nothing); the loading flag belongs to
// the newest walk; the caller still receives its OWN walk's verdict (the
// clean receipt's arithmetic never drinks another walk's bytes). ----
{
  const dialogSrc = readFileSync(path.join(ROOT, "src/components/workflow/storage-dialog.tsx"), "utf8");
  pin("AN11 THE NEWEST WALK OWNS THE BOARD — the walk's re-entrancy race cured at the root (a) every walk takes a sequence number (the seq ref bumped at request time); (b) THE PAINT GATES — the fail branch and the success branch write through the live gate (seq === walkSeq.current && dialogOpenRef.current) and the catch repeats it: a superseded verdict — stale bytes over a fresh receipt's arithmetic, a stale failure erasing fresh contents, a closed dialog's ghost walk — is refused at the door; (c) THE LOADING FLAG BELONGS TO THE NEWEST WALK — the finally's setLoading(false) is seq-gated, a late straggler cannot lift the busy face mid-walk; (d) THE RETRY KEEPS THE FAILURE STORY — the walk START no longer erases the error (the danger panel wears the busy face while the re-walk runs); (e) THE SUCCESS CLEARS THE ERROR IN ITS TURN — setError(null) rides INSIDE the success gate, after setData(fresh)",
    (() => {
      const loadIdx = dialogSrc.indexOf("const load = React.useCallback");
      const loadEnd = dialogSrc.indexOf("}, [projectId]);", loadIdx);
      const body = loadIdx >= 0 && loadEnd > loadIdx ? dialogSrc.slice(loadIdx, loadEnd) : "";
      // (a) the sequence number — bumped at REQUEST time, not verdict time
      const a = body.includes("const seq = ++walkSeq.current;");
      // (b) the paint gates — fail + success through the live gate, the
      // catch repeating the expression (no body in scope there)
      const b =
        body.split("if (live)").length - 1 === 2 &&
        body.split("seq === walkSeq.current && dialogOpenRef.current").length - 1 >= 2;
      // (c) the loading flag belongs to the newest walk
      const c = body.includes("if (seq === walkSeq.current) setLoading(false);");
      // (d) the retry keeps the failure story — no walk-start erasure
      const d = !/setLoading\(true\);\s*\n\s*setError\(null\)/.test(body);
      // (e) the success clears the error in its turn — inside the gate,
      // after the fresh paint
      const e =
        body.indexOf("setData(fresh);") >= 0 &&
        body.indexOf("setData(fresh);") < body.indexOf("setError(null);");
      return a && b && c && d && e;
    })());
}

// ---- AN12 — THE FLEET READ OWNS ITS BOARD (t1121): the t1120 law
// across the family — the fleet card's load joins the dialog's walk.
// The card's reads are quiet (no reading flag) and its measure door
// admits exactly one measure (disabled mid-flight), but the READ and
// MEASURE pair can cross and two reads can race (a retry crossing a
// retry, the mount read crossing a late straggler): every load takes a
// sequence number at REQUEST time; only the newest requested load
// paints; the bell rides inside the gate with its verdict; the
// measuring flag is the measure flight's OWN (its finally lifts it —
// the door's face is the flight's, not the board's). ----
{
  const loadIdx = card.indexOf("const load = React.useCallback");
  const loadEnd = card.indexOf("[projectId]\n  );", loadIdx);
  const body = loadIdx >= 0 && loadEnd > loadIdx ? card.slice(loadIdx, loadEnd) : "";
  // (a) the sequence number — bumped at REQUEST time, not verdict time
  const a = body.includes("const seq = ++seqRef.current;");
  // (b) the paint gates — the fail branch, the success branch, and the
  // catch each refuse a superseded verdict at the door
  const b = body.split("if (seq !== seqRef.current) return;").length - 1 === 3;
  // (c) the measuring flag is the measure flight's OWN — the finally
  // lifts it unconditionally (the door admits exactly one measure; the
  // flag never drinks the gate: a refused paint must not stick the door)
  const finIdx = body.indexOf("} finally {");
  const fin = finIdx >= 0 ? body.slice(finIdx) : "";
  const c = fin.includes("if (measure) setMeasuring(false);") && !fin.includes("seqRef.current");
  // (d) the bell rides INSIDE the gate — after the success gate, with
  // its verdict (a refused verdict delivers nothing)
  const gateIdx = body.indexOf("if (seq !== seqRef.current) return; // the newest load owns the board");
  const bellIdx = body.indexOf("window.dispatchEvent(new CustomEvent(FLEET_MEASURED_EVENT))");
  const d = gateIdx >= 0 && bellIdx > gateIdx;
  // (e) the success clears the errors in their turn — inside the gate,
  // after the fresh paint
  const paintIdx = body.indexOf("setBody(json as FleetCardBody);");
  const e =
    paintIdx >= 0 &&
    paintIdx < body.indexOf("setError(null);") &&
    body.indexOf("setError(null);") < body.indexOf("setMeasureError(null);") &&
    paintIdx > gateIdx;
  pin("AN12 THE FLEET READ OWNS ITS BOARD — the fleet card's load joins the dialog's walk (the t1120 law across the family): (a) every load takes a sequence number (the seq ref bumped at request time); (b) THE PAINT GATES — the fail branch, the success branch, and the catch each refuse a superseded verdict at the door (stale bytes never overwrite a fresh body, a stale failure never erases fresh contents, a ghost load from a dead question paints nothing); (c) THE MEASURING FLAG IS THE MEASURE FLIGHT'S OWN — the finally lifts it unconditionally, the door admits exactly one measure, the flag never drinks the gate; (d) THE BELL RIDES INSIDE THE GATE — a refused verdict delivers nothing, the family hears no word the seat never spoke; (e) THE SUCCESS CLEARS THE ERRORS IN THEIR TURN — setError(null) and setMeasureError(null) ride INSIDE the success gate, after setBody(fresh)",
    a && b && c && d && e);
}

// ---- AN13 — THE VERDICT ANSWERS THE LIVING QUESTION (t1122): the
// canvas funnel door's fetch is the CLICK'S OWN (one GET per click, the
// t462 law), and the busy flag already refuses re-entry — but the
// canvas's decision is ALIVE while the route flies: a selection that
// moved mid-flight would have the stale chain OPEN behind the user's
// back, the door's own law violated by the race. The settle answers the
// LIVING decision (the mirrored ref), refuses the stale verdict with a
// spoken line (never a silent swallow), and the ghost law gates the
// unmounted door's face. ----
{
  // (a) the living mirror — the decision ref mirrors every render
  const a =
    funnelDoor.includes("const decisionRef = useRef(decision);") &&
    funnelDoor.includes("decisionRef.current = decision;");
  // (b) the living gate BEFORE any paint — the settle re-reads the
  // mirror and compares the chain the click asked for
  const b =
    funnelDoor.includes("if (!mountedRef.current) return; // the ghost law: no door, no face") &&
    funnelDoor.includes("if (now.kind !== \"ready\" || now.job.id !== jobId) {") &&
    funnelDoor.indexOf("now.job.id !== jobId") < funnelDoor.indexOf("setPayload(p);");
  // (c) the refusal SPEAKS — the stale verdict's own line, never a
  // silent swallow
  const c =
    funnelDoor.includes("title: \"The canvas moved on\"") &&
    funnelDoor.includes("the door stayed closed; click the funnel again for the chain in view.");
  // (d) the ghost law — the unmounted door paints nothing (the mounted
  // ref's cleanup flips the gate)
  const d =
    funnelDoor.includes("const mountedRef = useRef(true);") &&
    funnelDoor.includes("mountedRef.current = false;");
  // (e) the family face — the busy flight's own seat (the door disabled
  // mid-flight, aria-busy, the spinner swap) rides unchanged
  const e =
    funnelDoor.includes("disabled={decision.kind === \"blocked\" || busy}") &&
    funnelDoor.includes("aria-busy={busy}") &&
    funnelDoor.includes("Loader2 className=\"size-4 animate-spin\"");
  pin("AN13 THE VERDICT ANSWERS THE LIVING QUESTION — the canvas funnel door's fetch is the click's own, and the canvas's decision is ALIVE while the route flies: (a) the living mirror (the decision ref mirrors every render); (b) the settle re-reads the mirror and refuses the stale chain BEFORE any paint (the door's own t462 law — never another run's funnel behind the user's back — made arithmetic); (c) the refusal SPEAKS its own line (the door stays closed; never a silent swallow); (d) THE GHOST LAW — an unmounted door's mid-flight settle paints nothing, not even a toast; (e) the family face rides (the door disabled mid-flight, aria-busy, the spinner swap — the busy flight's own seat)",
    a && b && c && d && e);
}

// ---- AN14 — THE DOOR'S EVERY FACE SPEAKS (t1123): the funnel door's
// four honest gaps + the fleet Retry door's quiet flight, one family
// law: every face of a door speaks — the wait (the busy WORD replaces
// the icon-only face), the empty (the ledger's own honest face in the
// SUCCESS path, no longer thrown into the catch's generic refusal),
// the reason (the t959 envelope word rides — the argument-less catch
// swallowed it), the ghost (the catch was the ghost law's missing seat
// — an unmounted door toasted its failure), and the read (the fleet
// Retry door gets its own flag and face, the flight's OWN by the
// t1121 law). ----
{
  // (a) THE BUSY WORD — the funnel door's label and title speak during
  // the flight (the busy branch leads the ternary, before ready)
  const catchIdx = funnelDoor.indexOf(".catch((err: unknown) => {");
  const a =
    funnelDoor.includes('busy\n            ? "Particle funnel — reading where the particles went…"') &&
    funnelDoor.includes('"Reading the chain — the funnel ledger is on its way…"') &&
    funnelDoor.indexOf('? "Particle funnel — reading where the particles went…"') <
      funnelDoor.indexOf("Particle funnel — read where the particles went, through");
  // (b) THE EMPTY LEDGER'S OWN FACE — the empty check lives in the
  // success path BEFORE the paint, speaks its own toast, and the throw
  // form is RETIRED (never a failure wearing the empty's clothes)
  const b =
    funnelDoor.includes("if (p.rows.length === 0) {") &&
    funnelDoor.includes('title: "The ledger came back empty"') &&
    funnelDoor.includes("this run has no funnel rows yet, so the door stays closed rather than opening on an empty chain.") &&
    funnelDoor.indexOf("if (p.rows.length === 0) {") < funnelDoor.indexOf("setPayload(p);") &&
    !funnelDoor.includes('throw new Error("the ledger came back empty")');
  // (c) THE CATCH'S OWN WORD + THE GHOST TOAST'S SEAT — the catch reads
  // the thrown error, the t959 word rides verbatim, and the ghost gate
  // rides FIRST in the catch body (before any word leaves)
  const catchBody = catchIdx >= 0 ? funnelDoor.slice(catchIdx) : "";
  const c =
    catchIdx >= 0 &&
    catchBody.includes("if (!mountedRef.current) return;") &&
    catchBody.indexOf("if (!mountedRef.current) return;") < catchBody.indexOf("const word =") &&
    funnelDoor.includes("err instanceof Error && err.message") &&
    funnelDoor.includes("${word} — the door stays closed rather than opening on half a chain. Try again in a moment.");
  // (d) THE READ GETS ITS OWN FLAG — the reading state, raised at
  // request time, lifted by the flight's OWN finally (unconditional —
  // a superseded read's refused paint cannot stick the door disabled)
  const d =
    card.includes("const [reading, setReading] = React.useState(false);") &&
    card.includes("else setReading(true);") &&
    card.includes("else setReading(false);") &&
    card.indexOf("else setReading(true);") < card.indexOf("else setReading(false);");
  // (e) THE RETRY DOOR'S BUSY FACE — disabled mid-flight, aria-busy,
  // the spinning icon, the busy word, the busy aria-label, the film name
  const e =
    card.includes("disabled={reading}") &&
    card.includes("aria-busy={reading}") &&
    card.includes('reading ? "size-3 animate-spin" : "size-3"') &&
    card.includes('"Re-reading…"') &&
    card.includes("Re-reading the fleet ledger — every connection asked again…") &&
    card.includes('data-testid="fleet-card-retry"');
  pin("AN14 THE DOOR'S EVERY FACE SPEAKS — five faces, one family law: (a) the funnel door's busy WORD (the label and the title speak during the flight — the spinner alone was an icon-only face); (b) the empty ledger's OWN face in the success path (the honest no-rows speaks its word before the paint; the throw form retired — never a failure wearing the empty's clothes); (c) the catch's OWN word (the t959 envelope reason rides verbatim; the argument-less swallow is dead) with the ghost gate FIRST in the catch body (the t1122 law's missing seat — an unmounted door's failure paints nothing, not even a toast); (d) the fleet read gets its own flag (raised at request time, lifted by the flight's OWN finally — the t1121 ownership law); (e) the Retry door's busy face (disabled, aria-busy, the spinner, the word Re-reading…, the busy aria-label, the film name)",
    a && b && c && d && e);
}

// ---- AN15 — THE SCALE'S REFERENCE WEARS ITS MARK (t1124): the funnel
// dialog's reading grows its fine print — the footer's square-root
// confession never NAMED its own reference, and the walk's fine data
// rode silent. Three cures, all read-only: (a) the widest stage wears
// the mark (the chip + the bar label's reference suffix — width === 1
// is exact by the ledger's own math, no epsilon owed); (b) every bar
// confesses its own share on hover (the footer's sentence, per row);
// (c) the walk's order becomes readable (the station number rides the
// type line, the amber station numbered too) and the chips say what
// they count (the yield's own word, the class census's own word). ----
{
  // (a) THE MARK — the chip's word, its explaining title, and the bar
  // label's reference suffix, all behind the exact isWidest gate
  const a =
    funnelDialog.includes("const isWidest = row.width === 1;") &&
    funnelDialog.includes('title="this stage holds the most of anything in the walk — every other bar is square-root scaled against it"') &&
    funnelDialog.includes("widest") &&
    funnelDialog.includes("${isWidest ? \" — the widest stage, the scale's reference\" : \"\"}") &&
    funnelDialog.indexOf("const isWidest = row.width === 1;") <
      funnelDialog.indexOf('title="this stage holds the most of anything in the walk');
  // (b) THE BAR'S OWN CONFESSION — the hover title speaks the row's own
  // sqrt share and the ledger's primacy verbatim
  const b =
    funnelDialog.includes("bar at ${Math.round(row.width * 100)}% of the scale (sqrt-scaled; the numbers are the ledger, the bars are only the shape)") &&
    funnelDialog.includes('role="img"') &&
    funnelDialog.indexOf("bar at ${Math.round(row.width * 100)}%") >
      funnelDialog.indexOf("function FunnelRowView");
  // (c) THE WALK'S ORDER + THE CHIPS' WORDS — the station number rides
  // the type line (the ok row AND the amber row — the walk passes
  // through both), the bar's label opens with the stage's position,
  // and each chip says what it counts
  const c =
    funnelDialog.includes('const station = String(index + 1).padStart(2, "0");') &&
    funnelDialog.includes("{station} · {row.type}") &&
    funnelDialog.includes("Stage ${index + 1} of ${total} — ${row.name}:") &&
    funnelDialog.includes("total={payload.rows.length}") &&
    funnelDialog.includes('title="picks per micrograph at this stage — the yield the picker\'s receipt counted against the micrographs it read"') &&
    funnelDialog.includes('title="the class census this classify receipt carried — classes, not particles"') &&
    // the amber station is numbered too — two type-line seats
    (funnelDialog.match(/\{station\} · \{row.type\}/g)?.length ?? 0) === 2;
  pin("AN15 THE SCALE'S REFERENCE WEARS ITS MARK — the funnel dialog's reading grows its fine print, all read-only: (a) the widest stage wears the mark (the mono chip + its explaining title + the bar label's reference suffix — width === 1 exact by the ledger's own math, no epsilon owed; two equal-max stages would both wear it honestly); (b) every bar confesses its own share on hover (bar at N% of the scale, sqrt-scaled — the footer's sentence per row, the numbers' primacy verbatim); (c) the walk's order becomes readable (the station number rides the type line — ok row AND amber row, the walk passes through both — and the bar's label opens with the stage's position) and the chips say what they count (the yield's own word, the class census's own word — classes, not particles)",
    a && b && c);
}

// ---- AN16 — THE FINE PRINT'S LAST TWO SEATS (t1125): the beside line
// and the closing chip speak their status. The numbering weigh is
// answered in the NEGATIVE — the walk's station numbers are the
// mainline's own order; a beside job wearing one would LIE about the
// walk — so the beside entries speak their off-mainline status on
// hover instead of borrowing the numbers, and the closing chip's
// hover names the criterion it prints (FSC(0.143), read verbatim from
// the receipt's verdict line). All read-only. ----
{
  // (a) THE BESIDE STATUS WORD — the hover title verbatim, AND the
  // census body carries NO station numbers (padStart / "of the walk" /
  // "Stage " stay out of the beside map — the numbering's decline is
  // itself pinned, the negative witness)
  const censusStart = funnelDialog.indexOf("payload.offMainline.map");
  const censusBody =
    censusStart >= 0
      ? funnelDialog.slice(censusStart, funnelDialog.indexOf("these ran beside it", censusStart))
      : "";
  const a =
    censusStart >= 0 &&
    censusBody.includes("ran beside the numbered walk, not a station of it") &&
    !censusBody.includes("padStart") &&
    !censusBody.includes("of the walk}") &&
    !censusBody.includes("Stage ");
  // (b) THE CLOSING CHIP'S CRITERION WORD — the hover names FSC(0.143)
  // and confesses the receipt-line provenance verbatim
  const b =
    funnelDialog.includes("FSC(0.143) — the cryo-EM resolution criterion; the number is read verbatim from the postprocess receipt's own verdict line") &&
    funnelDialog.indexOf("the cryo-EM resolution criterion") >
      funnelDialog.indexOf("the closing number — the chain's postprocess receipt");
  pin("AN16 THE FINE PRINT'S LAST TWO SEATS — the beside line and the closing chip speak their status, all read-only: (a) the census's beside entries hover-confess their off-mainline status ('ran beside the numbered walk, not a station of it') and the census body carries NO station numbers (the numbering weigh answered in the negative — a beside job in the walk's numbers would LIE about the walk; the negative witness is pinned: no padStart, no 'of the walk', no 'Stage ' inside the beside map); (b) the closing chip's hover names the criterion it prints (FSC(0.143) — the cryo-EM resolution criterion, the number read verbatim from the postprocess receipt's own verdict line)",
    a && b);
}

// ---- AN17 — THE SHARED PROSE SPEAKS THE ROOM IT STANDS IN (t1126):
// the diff table serves TWO houses (FSC compare: curves on the wall;
// standalone params-diff: none) and its prose used to confess a curve
// story unconditionally and never name "the data"; the zero-params face
// used to borrow a sentence that names a toggle the face never renders.
// Cures, all read-only: (a) hasCurves prop (default true — the FSC
// house keeps its sentence), the referent named in both houses; (b) the
// dead middle branch deleted — the algebra witness: visible empty under
// diffOnly with rows>0 is allSame (taken above), so the only face that
// ever saw "Every shared parameter agrees" was rows.length===0, where
// both halves of the sentence were false; (c) the standalone house
// passes hasCurves={false}; (d) the description's left column names its
// ROLE (the baseline) AFTER the name (the t88/t89 `left column: ${name}`
// readbacks must not break); (e) the footnote's tail follows the ONE
// brain's summary — three faces, verbatim. ----
{
  // (a) the prop + both sentences + the named referent
  const a =
    paramsDiff.includes("hasCurves = true") &&
    paramsDiff.includes("the curve differences come from the") &&
    paramsDiff.includes("any differences in their outputs come from the") &&
    // the referent named in BOTH houses (the span holds it twice)
    (paramsDiff.match(/data each job ran on/g) || []).length >= 2 &&
    paramsDiff.indexOf("hasCurves?: boolean") > paramsDiff.indexOf("export function FscParamsDiff");
  // (b) the dead branch's deletion witness — the lying sentence is GONE
  // and the zero-params face owns its sentence (the branch algebra is on
  // file in the component's own comment)
  const b =
    !paramsDiff.includes("Every shared parameter agrees") &&
    paramsDiff.includes("No launch parameters are recorded for either job") &&
    paramsDiff.includes("rows.length === 0 ?") &&
    paramsDiff.includes("the comparison has nothing to read yet");
  // (c) the standalone house speaks no-curves; the FSC house passes
  // NOTHING (default true — the negative witness: no hasCurves there)
  const c =
    paramsDialog.includes("hasCurves={false}") &&
    !fscCompareDialog.includes("hasCurves");
  // (d) the role word AFTER the name — the readbacks' law: the sentence
  // still carries `left column: ` + the name span, the role word rides
  // after the closing span (the t88/t89 needles and the t904 B3
  // .font-medium readback stay green)
  const descStart = paramsDialog.indexOf("side — left column:");
  const descSlice =
    descStart >= 0
      ? paramsDialog.slice(descStart, paramsDialog.indexOf("</DialogDescription>", descStart))
      : "";
  const d =
    descSlice.includes(", the baseline.") &&
    descSlice.indexOf("font-medium") < descSlice.indexOf(", the baseline.");
  // (e) the footnote's three faces, verbatim, behind the ONE brain's
  // summary (no forked taxonomy — summarizeParamDiff is the reader)
  const e =
    paramsDialog.includes("summarizeParamDiff(diffJobs)") &&
    paramsDialog.includes("nothing differs here: a re-run would follow the same recipe") &&
    paramsDialog.includes("no parameter differs outright — the one-sided rows are the only differences") &&
    paramsDialog.includes("open either job from the canvas to tweak the parameter that differs, then re-run it.") &&
    paramsDialog.indexOf("summary.allSame") < paramsDialog.indexOf("summary.changed === 0");
  pin("AN17 THE SHARED PROSE SPEAKS THE ROOM IT STANDS IN — the diff table's all-identical sentence takes its house's word (hasCurves, default true) and names its referent ('the data each job ran on', both faces); the zero-params face owns its sentence at last ('No launch parameters are recorded for either job — the comparison has nothing to read yet') and the lying sentence it borrowed is DELETED (the branch algebra: visible empty under diffOnly with rows>0 is allSame — taken above — so 'Every shared parameter agrees' named a toggle its only face never rendered); the standalone house passes hasCurves={false} and the FSC house passes nothing; the description's left column names its role (', the baseline.') AFTER the name (the t88/t89 readbacks law); the footnote's tail follows the ONE brain's summary — three faces verbatim (all-identical / one-sided-only / the differing parameter)",
    a && b && c && d && e);
}

// ---- AN18 — THE TOKEN WEARS ITS PROVENANCE (t1127): the session-report
// dialog's description compressed three families into one line, and two
// of the tokens confessed HOW or FROM WHERE without naming the referent
// ("measured, not viewed" — through WHAT instrument? "bound verbatim" —
// from WHICH bytes?). The referents existed only below the fold (the
// paper provenance footer) and in the file header comment — a footnote
// is not the mark (the t1124 law). Cure: title-only hovers on the two
// tokens, verbatim from the binding father's own contracts; the visible
// sentence and the a11y tree keep their bytes. ----
{
  // (a) both provenance hovers, verbatim
  const a =
    sessionReport.includes("the same map-profile API the slice instrument drinks from") &&
    sessionReport.includes("exactly the bytes the HPC queue panel's Compare profiles run exports");
  // (b) the visible sentence keeps its bytes — the three text pieces
  // render the same words they always did
  const b =
    sessionReport.includes("The report families meet: pipeline glance · map QC (") &&
    sessionReport.includes("measured, not viewed") &&
    sessionReport.includes(") · the sweep verdict,") &&
    sessionReport.includes("bound verbatim");
  // (c) the house underline dialect on BOTH token spans (the storage
  // dialog's dotted-underline dialect, two mounts)
  const c = (sessionReport.match(/underline decoration-dotted underline-offset-2/g) || []).length === 2;
  // (d) the negative witness: the old uncompressed one-line form is GONE
  const d = !sessionReport.includes("map QC (measured, not viewed) ·");
  // (e) the comment lead leads (and the tag-body comment carries no
  // apostrophe — the t1126 ranker law, the block self-witnesses)
  const commentStart = sessionReport.indexOf("t1127 — the compressed tokens wear their provenance");
  const commentEnd = sessionReport.indexOf("*/}", commentStart);
  const comment = commentStart >= 0 && commentEnd > commentStart ? sessionReport.slice(commentStart, commentEnd) : "";
  const e = commentStart >= 0 && !comment.includes("'");
  pin("AN18 THE TOKEN WEARS ITS PROVENANCE — the session-report description's two compressed tokens name their referents on the shape: the map QC token hover speaks the map-profile API the slice instrument drinks from (the FSC question answered without opening a single map), the sweep token hover speaks the store last sweep through buildSweepReport — exactly the bytes the HPC panel Compare profiles run exports, never re-translated; the visible sentence and the a11y tree keep their bytes (title-only hovers, the house dotted-underline dialect, two mounts); the old uncompressed one-line form is gone (the negative witness); the referents below the fold were not enough — a footnote is not the mark",
    a && b && c && d && e);
}

// ---- AN19 — THE MEASURED FACE KEEPS A RE-ASK SEAT (t1128): the map and
// curve walks measure ONCE per open (the snapshot law), so a job that
// finished while the reader read kept its section at still-measuring or
// at the refused face forever, and a transient refusal (a lane restart
// mid-walk — the t1127 film's own witness) was only retryable by closing
// and reopening the whole document. The Re-measure door bumps the walk
// epoch: both effects re-run, the walks reset their own state, and the
// pending doctrine speaks while they work. ----
{
  // (a) the door: label + the law in its title + the epoch bump + the note
  const a =
    sessionReport.includes('aria-label="Re-measure the measured sections"') &&
    sessionReport.includes("The map and curve walks measure once per open") &&
    sessionReport.includes("setWalkEpoch((e) => e + 1)") &&
    sessionReport.includes("Re-measuring the map and curve walks");
  // (b) BOTH walks ride the epoch (the two dep arrays)
  const b = (sessionReport.match(/\[open, walkEpoch\]/g) || []).length === 2;
  // (c) the walks reset their own state at effect start (the re-walk cannot
  // inherit the last answer as its pending face)
  const c =
    sessionReport.includes("setMapQc(null)") &&
    sessionReport.includes("setMapError(false)") &&
    sessionReport.includes("setCurves(null)") &&
    sessionReport.includes("setCurvesError(false)");
  // (d) the door rides AFTER the Print door (the append law) and carries
  // the house RefreshCw icon
  const d =
    sessionReport.indexOf('aria-label="Print session report"') <
      sessionReport.indexOf('aria-label="Re-measure the measured sections"') &&
    sessionReport.includes("RefreshCw");
  // (e) the once-per-open law still stands in the walk comments (the door
  // re-asks the snapshot, it does not replace it)
  const e = sessionReport.includes("Map QC is measured ONCE per open") || sessionReport.includes("measured ONCE per open");
  pin("AN19 THE MEASURED FACE KEEPS A RE-ASK SEAT — the Re-measure door rides the doors row after Print: the walk epoch bumps, both families re-walk, the walks reset their own state, and the pending doctrine speaks while they work; a transient refusal (the lane restart mid-walk the t1127 film witnessed) is retryable and a document grown stale mid-read is re-readable — the once-per-open snapshot law stands, the door re-asks it",
    a && b && c && d && e);
}

// ---- AN20 — THE RE-ASK MOUTH WEARS A KEY (t1129): the Re-measure door
// answered to the pointer only, while its row-siblings H and M have
// answered the keyboard since t247. The weigh held the t247 bar: the
// dialog carries exactly ONE re-ask door, so "R re-measures WHICH?" has
// one answer — the key's referent is unambiguous (the bar C failed with
// two copy formats). The button and the key share ONE mouth
// (remeasureWalks) — the door's words live exactly once, a key and a
// click can never drift apart in what they ask or what they say they
// did. The title advertises the key at the point of action, the button
// wears the house Kbd chip, and the t833 keymap row teaches five keys —
// the must-not-lie law: the row gathers the dialog's whole inventory. ----
{
  // (a) the ONE mouth: the named handler holds the bump + the note, and
  // the epoch bump appears EXACTLY once (the button's inline onClick gone
  // — the negative witness)
  const bumpCount = (sessionReport.match(/setWalkEpoch\(\(e\) => e \+ 1\)/g) || []).length;
  const a =
    sessionReport.includes("const remeasureWalks = () =>") &&
    bumpCount === 1 &&
    sessionReport.includes('k === "r"') &&
    sessionReport.includes("remeasureWalks();");
  // (b) the door advertises its key at the point of action (the M/H
  // dialect's tail) and the key branch is guarded by the same single-key
  // no-modifier law
  const b = sessionReport.includes("the world answers fresh · or press R");
  // (c) the button wears the house Kbd chip (aria-hidden, no-print — the
  // third door mount of the dialect)
  const c =
    sessionReport.includes("Re-measure\n            <Kbd") ||
    /Re-measure\s*\n\s*<Kbd[^>]*aria-hidden="true"[^>]*>\s*\n\s*R\s*\n\s*<\/Kbd>/.test(sessionReport);
  // (d) the t247 weigh is on the shape: R named the RE-ASK mouth, the
  // unambiguity bar spoken
  const d =
    sessionReport.includes("R joins as the RE-ASK mouth") &&
    sessionReport.includes('"R re-measures WHICH?"');
  // (e) the t833 row teaches the whole inventory: five keys — the R chip,
  // its words, and the comment's count
  const e =
    sessionReport.includes("<Kbd>R</Kbd>") &&
    sessionReport.includes("re-measure the walks") &&
    sessionReport.includes("answers to five keys");
  pin("AN20 THE RE-ASK MOUTH WEARS A KEY — the Re-measure door answers to R: one re-ask door makes the key's referent unambiguous (the t247 bar held, the C-rejection's contrast), the button and the key share the ONE mouth (remeasureWalks — the bump appears exactly once, the inline onClick is the negative witness), the title advertises '· or press R', the button wears the house Kbd chip, and the t833 row teaches five keys",
    a && b && c && d && e);
}

// ---- AN21 — THE CURSOR'S FACE SPEAKS ITS STEP (t1131): the quick-look's
// stack cursor moved the world through three verbs (the arrows, the slider,
// the buttons — t831/t287) but its readout — the only face that says WHICH
// frame the world landed on — was silent to the ears: a visual number that
// changed without an announcement. The house live dialect (role=status,
// the flashNote's own) carries the step now: the text changes, the polite
// region announces "slice N of M". The step is instant, so the number IS
// the world — the t588 arrival-hold is not needed where nothing glides.
// A one-frame stack never changes the text, so it never speaks (the gate
// law satisfied by the face itself), while the keymap row still gates its
// CHIPS on slices > 1 (the must-not-lie law, unchanged). The image's alt
// grew self-sufficient with the same numbers: "particle image N of M". ----
{
  // (a) the readout's seat wears the live role and keeps its shape
  const a =
    resultsView.includes('data-canvas-ui="stack-slice-readout"') &&
    /data-canvas-ui="stack-slice-readout"[\s\S]{0,120}role="status"/.test(resultsView);
  // (b) the alt is self-sufficient: particle image N of M
  const b =
    resultsView.includes("particle image ${stackSlice + 1} of ${imageFile.slices ?? \"?\"}") &&
    !resultsView.includes("particle image ${stackSlice + 1}`}");
  // (c) the keymap row's gate stands — the chips teach only when stepping exists
  const c = resultsView.includes(
    'imageFile.name.toLowerCase().endsWith(".mrcs") && (imageFile.slices ?? 1) > 1 && ('
  );
  // (d) the t831 anchor still holds: the arrows ride the SAME setter the
  // buttons drive (the handler's comment names the quick-look's own
  // keyboard face), and the cursor's three verbs all speak at the readout
  const d =
    resultsView.includes("the quick-look's own keyboard face") &&
    resultsView.includes("setStackSlice((s) => Math.max(0, s - 1))") &&
    resultsView.includes("setStackSlice((s) => Math.min((imageFile.slices ?? 1) - 1, s + 1))");
  // (e) the caption keeps its own voice (the visual line under the image)
  const e = resultsView.includes("in the stack");
  pin("AN21 THE CURSOR'S FACE SPEAKS ITS STEP — the quick-look's stack readout wears role=status (the house live dialect): stepping by arrow, slider, or button announces 'slice N of M' to the ears, the number IS the world (the step is instant, no t588 hold needed), a one-frame stack never speaks, the keymap row's slices>1 chip gate stands unchanged, and the alt grew self-sufficient ('particle image N of M')",
    a && b && c && d && e);
}

  console.log(`${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
