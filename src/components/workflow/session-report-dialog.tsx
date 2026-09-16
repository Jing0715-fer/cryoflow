"use client";

/**
 * CryoFlow — the session QC report (t197): the page where the report
 * families meet under one cover.
 *
 * Three families speak here, each in its OWN voice and its own provenance:
 *   • the pipeline glance — live from the workflow store (cheap, always
 *     current);
 *   • the map QC section — buildProfileReport's output bound VERBATIM,
 *     measured WITHOUT the viewer: the session's latest succeeded job
 *     with 3D maps is profiled through the same map-profile API the
 *     slice instrument drinks from, so the job-level report answers the
 *     FSC question (do the halves corroborate each other?) even for
 *     people who never opened a single map;
 *   • the scheduling sweep annex — the store's lastSweep bound VERBATIM
 *     through buildSweepReport, exactly the bytes the HPC panel exports.
 *
 * The binding father (buildSessionReport) never parses the families'
 * outputs — the session report does not re-translate the families'
 * translations, it binds them.
 *
 * Contracts carried over from the family's earlier rounds:
 * - ONE md string feeds clipboard + download + the data-md carrier (no
 *   parse-of-parse, t194); the carrier is ALWAYS attached (t191).
 * - Copy falls back to a download when the clipboard is denied, and the
 *   receipt SAYS so — honesty covers both worlds (t188 B3 / t195 D5).
 * - No timestamps in the bytes — the same session state yields the same
 *   document; the filename carries the stamp (t195's doctrine).
 * - Every family with nothing to say gets an honest empty state that
 *   teaches where its numbers come from (t195's empty doctrine).
 * - The report is the ONE dialog that IS a document: while it is open,
 *   body[data-report-print] flips the print contract from "dialogs step
 *   aside" (Task 70) to "only the report prints" — Markdown→PDF is the
 *   whole point of a report page.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Download, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { copyOrFallback, downloadText } from "@/lib/download";
import type { JobDTO } from "@/lib/types";
import {
  buildProfileReport,
  buildSessionReport,
  buildSweepReport,
  deltaVsWinner,
  inventoryCsv,
  inventoryCsvFilename,
  outlierRowIdx,
  QUARTER_LABELS,
  peakPctNumOf,
  peakPctOf,
  localAgreement,
  sessionReportFilename,
  shapeAgreement,
  sparklinePath,
  weakestBand,
  weakestCellOf,
  type LocalBand,
  type ReportOverlay,
} from "@/lib/qc-report";
import { useWorkflowStore } from "@/lib/store";

/** one candidate's 3D-map set (paths relative to the job's workdir) */
interface MapBrief {
  jobId: string;
  main: { path: string; name: string };
  overlays: { path: string; name: string }[];
}

/** t212: one volume owner, as the walk records it. The SAME walk that
 *  picks the deep-report winner now RECORDS every owner it passes —
 *  the inventory costs zero extra outputs probes, and no map hides
 *  below the fold (the t211 lesson, generalized: the old walk stopped
 *  at the first winner and left the rest of the world unseen). */
interface MapOwner extends MapBrief {
  jobName: string;
  volumeCount: number;
}

interface OutputsResponse {
  files?: { path: string; name: string; kind: string; dims?: [number, number, number]; label?: string }[];
}
interface ProfileResponse {
  bins?: number[];
  error?: string;
}

/** Full-map variants lead the report; halves and masked maps compare. */
const MAIN_MAP_RE = /half0|postprocess\.mrc$/i;

/** Types that can ever own a true 3D volume (t211). The walk probes these
 *  FIRST — an import/motioncorr/ctffind/extract candidate has never held a
 *  map, and spending the probe budget on them is how the old walk lied:
 *  its cap of 8 newest completed jobs landed exactly on the demo
 *  pipeline's map-less upper half while a Refine3D four rows down owned
 *  four volumes — and the report declared a world WITH maps to have none.
 *  A lying instrument is the gravest sin; the walk now spends its budget
 *  on plausible owners before it touches the never-volume tail. */
const VOLUME_CAPABLE_RE = /refine3d|class3d|postprocess|multibody/i;

/** The walk's probe budget. Volume-capable candidates ride the front of
 *  the queue (see VOLUME_CAPABLE_RE), so the budget lands on real map
 *  owners; 24 covers the demo world's whole roster well past three
 *  times — the honest failure mode is "scanned them all, none speaks",
 *  never "never asked". */
const MAP_BRIEF_CAP = 24;

/** Newest first — as a real three-way comparator. The old one-liner
 *  `(a.updatedAt < b.updatedAt ? 1 : -1)` answers -1 on EQUAL stamps,
 *  silently reversing same-instant jobs (a gallery restore writes them
 *  all at once); the id tiebreak keeps the order deterministic. */
const byRecency = (a: JobDTO, b: JobDTO) =>
  a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1;

/**
 * t213 — the roster's rows are doors. t210 taught the strip that a name
 * on a bracket should never be a dead end (a covered door is a lying
 * door); t212 put every owner's NAME on the paper — but a name on a
 * roster you cannot press is still a dead end. The inventory's rows now
 * open the owner's results through openJob (the palette's own engine:
 * workspace hops, landing repair, then the inspector for a non-idle
 * job). The doors live ONLY on the screen: the exported bytes stay
 * plain Markdown — a door needs a page to open — so the paper's
 * contracts (t194 one-md, t212's byte pins) are untouched.
 *
 * Mechanics: the rendered document is one ReactMarkdown tree, so the
 * doors ride a component override keyed on the ONE table whose head is
 * exactly [Job, Main map, Volumes] — the Comparison table (Map | Bins |
 * Peak at | Agreement r | Verdict) and any future family keep their
 * plain rows. A context carries "this is the inventory" down from the
 * table element; thead neutralizes it (a head row is a label, not a
 * door); each body row is a door only when its rendered cells match a
 * walk owner (jobName | mainName | volumeCount) — an unmatched row
 * stays plain, because a door must promise what the paper says.
 */
const InventoryTableContext = React.createContext(false);
const ComparisonTableContext = React.createContext(false);
const LocalTableContext = React.createContext(false);

/** The inventory table's exact head sextet — the only door-carrying
 *  table on the paper. Matched against the RENDERED head (hast), so
 *  markdown cosmetics above or below can never turn another table into
 *  doors. t214: the Peak column joins the key — the door key must grow
 *  with the table it guards, or every door goes dark (the first t214
 *  run found ALL doors gone because the key still said "trio" while
 *  the table said "quartet" — a head you don't match is a head you
 *  don't own). t215: the Δ winner column joins too. t221: Agreement r
 *  joins. t222: Weakest joins — the key grows by design again, before
 *  any probe died (the t214 lesson as routine discipline, four times).
 *  t223: the key does NOT grow this time — the Shape column is a
 *  PICTURE, and pictures live on the wire, not in the paper's bytes
 *  (the markdown stays the seven-column facts, the CSV stays
 *  numbers-only); the key matches the PAPER, so the paper's own
 *  head stays the septet. The wire's extra column is rendered,
 *  never written. */
const OWNER_HEAD = ["Job", "Main map", "Volumes", "Peak", "Δ winner", "Agreement r", "Weakest"];

/** t226: the comparisons table's head — the paper speaks five columns
 *  (Map, Bins, Peak at, Agreement r, Verdict); the wire adds the picture
 *  column, the SAME portrait grammar the roster earned. Matched EVERY
 *  cell at once — a partial head cannot mint a Shape th (t223's law). */
const COMPARISON_HEAD = ["Map", "Bins", "Peak at", "Agreement r", "Verdict"];

/** t227: the Local agreement table's head — the paper speaks seven
 *  columns (Map, the four QUARTER_LABELS the logic layer itself names,
 *  Weakest, Depth); the wire adds the band strip, the four quarter bars
 *  the printed r values already describe. The quarter words are IMPORTED,
 *  never retyped — twins fork, imports don't. Matched EVERY cell at
 *  once — a partial head cannot mint a Bands th. */
const LOCAL_HEAD = ["Map", ...QUARTER_LABELS, "Weakest", "Depth (fraction)"];
const BANDS_HEAD = "Bands";

/** t228: the Map QC section's own head word — the hero's admission
 *  signature. EXACT match only: the deep report speaks
 *  "Map QC summary — <map>" and must never mint a second hero (a
 *  partial name cannot mint a figure — the t223 head-matching law at
 *  heading scale). */
const MAP_QC_HEAD = "Map QC";

/** t223: the portrait column's wire grammar — the head word the wire
 *  adds (never the markdown), the box the paths draw in, and the
 *  station count both landscapes are resampled to (the shared fraction
 *  scale, t195's doctrine; 48 stations is well past the eye's
 *  resolution for a 96px line). t224 adds the glass factor: the
 *  magnifier renders the SAME viewBox three times larger — coordinates
 *  never change, only the glass does. */
const SHAPE_HEAD = "Shape";
const SPARK_W = 96;
const SPARK_H = 26;
const SPARK_STATIONS = 48;
const SPARK_ZOOM = 3;

/** t228: the hero's box — the portrait grammar at five times the reach
 *  (480×80): big enough that the quarter grid and the marks can be
 *  READ, not just pointed at. Coordinates keep the same fraction law
 *  (x = pct/100 × HERO_W) — the address scales, the well doesn't. */
const HERO_W = 480;
const HERO_H = 80;
/** t230: the quarter fractions — the address system itself. The grid
 *  lines AND their depth labels drink this one well: two surfaces of
 *  the same numbers, never a retyped pair. */
const HERO_QUARTERS = [0.25, 0.5, 0.75];

/** t223: the shape portrait — an inline SVG that lays the owner's
 *  landscape (solid) over the winner's (dotted) in one box. Both paths
 *  come from sparklinePath (the logic layer's own normalizer — shape,
 *  not magnitude), so the picture and the r column answer the SAME
 *  question: two coinciding lines is what r = 1.00 looks like; a
 *  relocated peak is what a negative r looks like. The winner line is
 *  the reference every row is read against — even the reference row's
 *  own cell draws it (its self-portrait: both lines are the same
 *  landscape, the picture's way of saying 1.00). aria-hidden: the row's
 *  own label already speaks the portrait's verdict in words.
 *
 *  t224: the magnifier — the ONE portrait, mounted twice. The zoom is
 *  the same d bytes, the same ink classes, the same viewBox, three
 *  times the glass: a bigger window onto the SAME picture, never a
 *  re-derivation (a re-derived zoom would be a second father, and the
 *  two pictures could one day disagree). It folds until the eye asks —
 *  hover the cell (the mouse's lens) or keyboard-focus the row (the
 *  keyboard's lens); CSS owns the whole life cycle, no state, no
 *  listener, no render-layer father beyond the second mount.
 *
 *  t225: the address mark — the portrait earns its address. The Peak
 *  column answers WHERE; the mark draws that answer INTO the picture:
 *  one floor-to-ceiling hairline at the SAME pct the paper's word, the
 *  Δ column and the amber lens already drink from (peakPctNumOf's
 *  1-decimal grid, scaled onto the shared fraction axis) — never
 *  re-derived from the drawn path, for a re-derived address would be a
 *  second father and the mark could one day disagree with the word
 *  (t202's lesson, now wearing ink). The winner's mark rides the same
 *  rule and is paired with its drawn line: no reference line, no
 *  reference mark. Coinciding marks are the picture of "peak unmoved"
 *  (the address of 1.00); separated marks are the relocation made
 *  visible at any glass size — the |Δ| as two hairlines. */
function ShapeSparkline({
  bins,
  winnerBins,
  peakPct,
  winnerPct,
}: {
  bins: number[];
  winnerBins: number[] | null;
  peakPct: number | null;
  winnerPct: number | null;
}) {
  const d = sparklinePath(bins, SPARK_W, SPARK_H, SPARK_STATIONS);
  const dw = sparklinePath(winnerBins, SPARK_W, SPARK_H, SPARK_STATIONS);
  if (!d) return <span className="text-muted-foreground">—</span>;
  // the address lives in the numbers: the mark's x is the paper's own
  // Peak pct on the picture's fraction axis (clamped, fail-soft — a
  // pct that never arrived draws no mark)
  const markX = (pct: number | null) =>
    pct == null ? null : Math.min(SPARK_W, Math.max(0, (pct / 100) * SPARK_W));
  const xo = markX(peakPct);
  const xw = dw ? markX(winnerPct) : null;
  // the ONE portrait — one React element, two mounts (element reuse is
  // not a second father: the same d strings AND the same marks reach
  // both glasses)
  const portrait = (
    <>
      {dw ? <path className="report-spark-winner" d={dw} /> : null}
      <path className="report-spark-owner" d={d} />
      {xw != null ? (
        <line className="report-spark-mark-winner" x1={xw} x2={xw} y1={0} y2={SPARK_H} />
      ) : null}
      {xo != null ? (
        <line className="report-spark-mark-owner" x1={xo} x2={xo} y1={0} y2={SPARK_H} />
      ) : null}
    </>
  );
  return (
    <span className="report-spark-wrap">
      <svg
        className="report-spark"
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        width={SPARK_W}
        height={SPARK_H}
        aria-hidden="true"
        focusable="false"
      >
        {portrait}
      </svg>
      <svg
        className="report-spark-zoom"
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        width={SPARK_W * SPARK_ZOOM}
        height={SPARK_H * SPARK_ZOOM}
        aria-hidden="true"
        focusable="false"
      >
        {portrait}
      </svg>
    </span>
  );
}

/** t227: the band strip — the Local agreement table's four quarters as
 *  geometry. The paper's r column already speaks each quarter's number;
 *  the strip DRAWS that number: one bar per quarter, rising above the
 *  midline for agreement, dipping below for a betrayal — length |r| × 11
 *  on the printed 2dp grid (the SAME rounding the paper's cell prints,
 *  never the raw correlation — the bar is the picture of the printed
 *  word, one well). A bar that cannot speak (a flat band, a grid too
 *  short to cut) draws nothing; a strip with nothing to draw keeps the
 *  honest dash. The zero hairline is the reference every bar reads
 *  against. Bars are addresses, not decorations: the k-th bar sits at
 *  the k-th quarter's center (x = k·24 + 12 — the address lives in the
 *  numbers). The ONE strip, mounted twice: the same bars reach both
 *  glasses (element reuse is not a second father).
 *  t226's glass rights carry over untouched: the zoom wears the shared
 *  report-spark-zoom class, so hover/print/one-at-a-time are free. */
function BandStrip({ bands }: { bands: LocalBand[] }) {
  const BAR_H = 11;
  const bars = bands.map((b, k) => {
    if (!b || !Number.isFinite(b.r)) return null;
    const r = Math.min(1, Math.max(-1, Number(b.r.toFixed(2))));
    return {
      x: k * 24 + 12,
      y2: 13 - r * BAR_H,
    };
  });
  if (bars.every((bar) => bar === null)) return <span className="text-muted-foreground">—</span>;
  // the ONE strip — one element tree, two mounts (the same bars reach
  // both glasses)
  const strip = (
    <>
      <line className="report-band-zero" x1={0} x2={SPARK_W} y1={13} y2={13} />
      {bars.map(
        (bar, k) =>
          bar ? (
            <line
              key={k}
              className="report-band"
              x1={bar.x}
              x2={bar.x}
              y1={13}
              y2={bar.y2}
            />
          ) : null,
      )}
    </>
  );
  return (
    <span className="report-spark-wrap">
      <svg
        className="report-band-strip"
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        width={SPARK_W}
        height={SPARK_H}
        aria-hidden="true"
        focusable="false"
      >
        {strip}
      </svg>
      <svg
        className="report-spark-zoom"
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        width={SPARK_W * SPARK_ZOOM}
        height={SPARK_H * SPARK_ZOOM}
        aria-hidden="true"
        focusable="false"
      >
        {strip}
      </svg>
    </span>
  );
}

/** t228: the hero landscape — the Map QC section's one large figure.
 *  Four tables speak portraits and strips at thumbnail scale; the hero
 *  is the report's protagonist terrain made READABLE: the owner's main
 *  landscape (solid) under its overlays (dotted), five times the
 *  portrait box, the quarter grid drawn in (the Local agreement table's
 *  own Q1–Q4 cuts — fixed fractions of depth, addresses with numbers)
 *  and each landscape's paper peak marked. The marks speak the SAME
 *  address law the portraits wear: peakPctNumOf's 1-decimal pct scaled
 *  onto the hero's fraction axis, clamped and fail-soft, never
 *  re-derived from the drawn path (the t225 doctrine at hero scale).
 *  The terrain rides the SAME fetch the deep section was built from
 *  (mapQc) — a re-fetch would be a second well. No glass: the hero IS
 *  the large view the thumbnails' zoom promises. The figure speaks its
 *  own words (a figure has no row to speak for it): names and addresses
 *  from the same wells, nothing guessed. No baseline: the box's bottom
 *  edge is the landscape's own minimum, not a number — only depth
 *  fractions get lines, only depth fractions HAVE addresses. */
function HeroLandscape({
  mainBins,
  overlays,
  mainName,
}: {
  mainBins: number[];
  overlays: { name: string; bins: number[] }[];
  mainName: string | null;
}) {
  const d = sparklinePath(mainBins, HERO_W, HERO_H, SPARK_STATIONS);
  if (!d) return null;
  const markX = (pct: number | null) =>
    pct == null ? null : Math.min(HERO_W, Math.max(0, (pct / 100) * HERO_W));
  const mainPct = peakPctNumOf(mainBins);
  const xMain = markX(mainPct);
  const drawn = overlays
    .map((o) => {
      const dow = sparklinePath(o.bins, HERO_W, HERO_H, SPARK_STATIONS);
      if (!dow) return null;
      const pct = peakPctNumOf(o.bins);
      return { name: o.name, d: dow, x: markX(pct), pct };
    })
    .filter((o): o is { name: string; d: string; x: number | null; pct: number | null } => o !== null);
  // t229: the signatures — the figure's speech made visible. A table row
  // speaks for its portrait; the hero has no row, so each addressed line
  // signs itself at its mark address with the words the aria quotes (name
  // and pct, the same wells, never retyped). No address, no signature —
  // only things with addresses get lines, and only lines with addresses
  // get signatures. Nearby addresses stack deterministically: the address
  // never moves, the signature's row does (an edge address keeps its mark
  // at the exact fraction and its signature just inside the canvas).
  const CHAR_W = 3.7;
  const sigs: { text: string; x: number; row: number }[] = [];
  const sign = (name: string, pct: number | null, x: number | null) => {
    if (x == null || pct == null) return;
    const text = `${name} ${pct}%`;
    const half = (text.length * CHAR_W) / 2;
    const cx = Math.min(HERO_W - half - 1, Math.max(half + 1, x));
    let row = 0;
    while (sigs.some((s) => s.row === row && Math.abs(s.x - cx) < half + (s.text.length * CHAR_W) / 2 + 2)) row++;
    sigs.push({ text, x: cx, row });
  };
  sign(mainName ?? "the main map", mainPct, xMain);
  drawn.forEach((o) => sign(o.name, o.pct, o.x));
  const quote = [
    `${mainName ?? "the main map"} peaks at ${mainPct}% of depth`,
    ...drawn.map((o) => `${o.name} peaks at ${o.pct}% of depth`),
  ].join("; ");
  return (
    <figure className="report-hero" data-hero-landscape="">
      <svg
        className="report-hero-landscape"
        viewBox={`0 0 ${HERO_W} ${HERO_H}`}
        role="img"
        aria-label={`Map QC hero landscape — ${quote}; the quarter grid marks 25, 50 and 75% of depth.`}
        focusable="false"
      >
        {HERO_QUARTERS.map((f) => (
          <line
            key={f}
            className="report-hero-quarter"
            x1={f * HERO_W}
            x2={f * HERO_W}
            y1={0}
            y2={HERO_H}
          />
        ))}
        {drawn.map((o, i) => (
          <g key={`${o.name}·${i}`}>
            <path className="report-hero-overlay" d={o.d} />
            {o.x != null ? (
              <line className="report-hero-mark-overlay" x1={o.x} x2={o.x} y1={0} y2={HERO_H} />
            ) : null}
          </g>
        ))}
        <path className="report-hero-main" d={d} />
        {xMain != null ? (
          <line className="report-hero-mark-main" x1={xMain} x2={xMain} y1={0} y2={HERO_H} />
        ) : null}
        {sigs.map((s, i) => (
          <text key={`sig·${i}`} className="report-hero-label" x={s.x} y={7 + s.row * 9} textAnchor="middle">
            {s.text}
          </text>
        ))}
        {/* t230: the depth labels — the grid signs its own ticks. The
            aria has spoken the quarters since t228 ("the quarter grid
            marks 25, 50 and 75% of depth"); the picture now shows those
            words at the same fixed addresses, drawn from the SAME
            HERO_QUARTERS well as the lines (two surfaces, one father).
            The ruler does not yield: signatures dodge (speech yields to
            legibility), the address system itself never moves — data
            near a tick is the data telling the truth. */}
        {HERO_QUARTERS.map((f) => (
          <text
            key={`depth·${f}`}
            className="report-hero-depth"
            x={f * HERO_W}
            y={HERO_H - 3}
            textAnchor="middle"
          >
            {f * 100}%
          </text>
        ))}
      </svg>
    </figure>
  );
}

/** Collect the rendered words of a hast node (cells carry plain text —
 *  the doors read what the reader reads, not the markdown source). */
function hastText(n: unknown): string {
  if (!n || typeof n !== "object") return "";
  const e = n as { type?: string; value?: string; children?: unknown[] };
  if (e.type === "text") return e.value ?? "";
  return (e.children ?? []).map(hastText).join("");
}

/** hast shape helpers. The markdown pipeline interleaves whitespace TEXT
 *  nodes BETWEEN and INSIDE a table's parts (table → text · thead · text
 *  · tbody · text; thead's tr → text · th · text · th …) — a child must
 *  be FOUND by tagName, never taken by position (t213 RUN=1's lesson:
 *  children[0] of a table is a newline, not the head). */
type HastEl = { tagName?: string; children?: unknown[] };
const asHastEl = (n: unknown): HastEl | undefined => (n && typeof n === "object" ? (n as HastEl) : undefined);
const hastKids = (n: unknown): unknown[] => asHastEl(n)?.children ?? [];
const hastTag = (n: unknown): string | undefined => asHastEl(n)?.tagName;

/** Walk the candidates and return EVERY volume owner, in walk order —
 *  owners[0] is the deep-report winner (the newest capable candidate
 *  that speaks), the rest ride the inventory. Unreadable candidates are
 *  skipped (the next one may speak); the walk returns what it heard. */
async function walkVolumeOwners(jobIds: string[], signal: AbortSignal): Promise<MapOwner[]> {
  const owners: MapOwner[] = [];
  for (const jobId of jobIds.slice(0, MAP_BRIEF_CAP)) {
    if (signal.aborted) return owners;
    try {
      const d = (await fetch(`/api/jobs/${jobId}/outputs`, { signal }).then((r) => r.json())) as OutputsResponse;
      const volumes = (d.files ?? []).filter(
        (f) => f.kind === "mrc" && Array.isArray(f.dims) && f.dims.length === 3,
      );
      if (volumes.length === 0) continue;
      const sorted = [...volumes].sort(
        (a, b) => Number(MAIN_MAP_RE.test(b.name)) - Number(MAIN_MAP_RE.test(a.name)),
      );
      const jobName = useWorkflowStore.getState().jobs.find((j) => j.id === jobId)?.name ?? jobId;
      owners.push({
        jobId,
        jobName,
        main: { path: sorted[0].path, name: sorted[0].label ?? sorted[0].name },
        overlays: sorted.slice(1, 3).map((f) => ({ path: f.path, name: f.label ?? f.name })),
        volumeCount: volumes.length,
      });
    } catch {
      if (signal.aborted) return owners;
      // this candidate's outputs are unreadable — the next one may speak
    }
  }
  return owners;
}

/** Profile the brief's maps on the shared Z axis and hand the family
 *  builder exactly what it would have received from the viewer: the
 *  main landscape plus adopted comparison terrains. */
async function measureMapQc(
  brief: MapBrief,
  signal: AbortSignal,
): Promise<{
  jobId: string;
  report: string;
  mainBins: number[];
  overlays: { name: string; bins: number[] }[];
}> {
  const paths = [brief.main.path, ...brief.overlays.map((o) => o.path)];
  const fetched = await Promise.all(
    paths.map(async (p) => {
      const d = (await fetch(
        `/api/jobs/${brief.jobId}/map-profile?path=${encodeURIComponent(p)}&axis=z`,
        { signal },
      ).then((r) => r.json())) as ProfileResponse;
      if (!Array.isArray(d.bins) || d.bins.length === 0) throw new Error("no landscape");
      return d.bins;
    }),
  );
  const overlays: ReportOverlay[] = brief.overlays.map((o, i) => ({ name: o.name, bins: fetched[i + 1] }));
  const report = buildProfileReport({
    mapName: brief.main.name,
    jobId: brief.jobId,
    axis: "z",
    bins: fetched[0],
    overlays,
    pendingOverlays: 0,
  });
  return { jobId: brief.jobId, report, mainBins: fetched[0], overlays };
}

/** Profile each owner's MAIN map once and return its peak address AND
 *  the landscape itself (t221: the bins ride along — the Agreement r
 *  column correlates them against the winner's, and re-fetching them a
 *  second time would be a second well). The peak formula is the same
 *  API the deep report drinks from, the same formula (peakPctOf:
 *  one truth, two surfaces). An owner whose profile refuses simply keeps
 *  its "—" — the cell says still-measuring/refused, it never guesses
 *  (the pending doctrine, per row). */
async function measureOwnerPeaks(
  owners: MapOwner[],
  signal: AbortSignal,
): Promise<Map<string, { text: string; pct: number; bins: number[] }>> {
  const heard = new Map<string, { text: string; pct: number; bins: number[] }>();
  await Promise.all(
    owners.map(async (o) => {
      try {
        const d = (await fetch(
          `/api/jobs/${o.jobId}/map-profile?path=${encodeURIComponent(o.main.path)}&axis=z`,
          { signal },
        ).then((r) => r.json())) as ProfileResponse;
        if (!Array.isArray(d.bins) || d.bins.length === 0) return;
        // t215: both surfaces of the ONE well — the text is the paper's
        // word, the pct (rounded to the paper's own 1-decimal grid by
        // peakPctNumOf) is what the Δ winner column and the amber lens
        // compute from. A parse-back of the text would fork the well.
        // t221: the bins themselves are the third surface — the Agreement
        // r column reads the SAME fetch, no second well.
        heard.set(o.jobId, { text: peakPctOf(d.bins), pct: peakPctNumOf(d.bins), bins: d.bins });
      } catch {
        // this owner's profile refused (or the dialog closed) — its cell stays honest
      }
    }),
  );
  return heard;
}

export default function SessionReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const project = useWorkflowStore((s) => s.project);
  const jobs = useWorkflowStore((s) => s.jobs);
  const lastSweep = useWorkflowStore((s) => s.lastSweep);

  const [mapQc, setMapQc] = React.useState<{
    jobId: string;
    report: string;
    // t226: the well rides with the paper — the main landscape and the
    // comparison terrains the deep section was built from, so the wire's
    // pictures drink the SAME fetch (a re-fetch would be a second well)
    mainBins: number[];
    overlays: { name: string; bins: number[] }[];
  } | null>(null);
  const [mapPending, setMapPending] = React.useState(false);
  const [mapError, setMapError] = React.useState(false);
  /** t212: every volume owner in walk order, from the SAME walk that
   *  picks the deep-report winner — settled before the measurement,
   *  so the paper still lists the world even if a profile then fails.
   *  t214: each row gains a peak — null until that owner's main map
   *  has been profiled (the cell says — , never a guess).
   *  t215: the row also carries the peak's NUMBER on the paper's own
   *  1-decimal grid (peakPct) — the Δ winner column and the amber
   *  outlier lens compute from it; both import their helpers from
   *  qc-report (twins fork, imports don't). */
  const [mapInventory, setMapInventory] = React.useState<
    { jobId: string; jobName: string; mainName: string; volumeCount: number; peak: string | null; peakPct: number | null; shapeR: number | null; weakest: { label: string; r: number; from: number } | null; bins: number[] | null }[] | null
  >(null);
  const [note, setNote] = React.useState<string | null>(null);
  const noteTimer = React.useRef<number | null>(null);

  const flashNote = (text: string) => {
    setNote(text);
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 4000);
  };

  // The report is the one dialog that IS a document: while open, the body
  // carries the print-exception flag — Task 70's "dialogs step aside on
  // paper" contract is scoped away for exactly this dialog, and cleaned
  // up on close/unmount so no other printout inherits the flag.
  React.useEffect(() => {
    if (open) document.body.setAttribute("data-report-print", "");
    else document.body.removeAttribute("data-report-print");
    return () => document.body.removeAttribute("data-report-print");
  }, [open]);

  // Map QC is measured ONCE per open (a snapshot of the session's maps):
  // the walk + profiles are the expensive part, statcache makes repeats
  // cheap but the assembly is still async — the section says so while it
  // works (the pending doctrine: the summary does not guess).
  React.useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setMapQc(null);
    setMapError(false);
    setMapInventory(null);
    setMapPending(true);
    (async () => {
      // t211 walk: volume-capable types first (each tier newest-first,
      // deterministic under equal stamps), then the never-volume tail —
      // the walk cannot end at a map-less upper half while a Refine3D
      // waits below the fold.
      const done = useWorkflowStore.getState().jobs.filter((j) => j.status === "completed");
      const doneIds = [
        ...done.filter((j) => VOLUME_CAPABLE_RE.test(j.type)).sort(byRecency),
        ...done.filter((j) => !VOLUME_CAPABLE_RE.test(j.type)).sort(byRecency),
      ].map((j) => j.id);
      const owners = await walkVolumeOwners(doneIds, ctrl.signal);
      if (ctrl.signal.aborted) return;
      // the inventory is a fact of the WALK — it settles even when the
      // deep measurement below then refuses (partial truth over silence)
      setMapInventory(
        owners.map((o) => ({ jobId: o.jobId, jobName: o.jobName, mainName: o.main.name, volumeCount: o.volumeCount, peak: null, peakPct: null, shapeR: null, weakest: null, bins: null })),
      );
      if (owners.length === 0) {
        setMapPending(false);
        return; // honest empty state — no job here owns a volume
      }
      // t214: the peaks ride ALONGSIDE the deep measurement — each
      // owner's main map is profiled once and fills its cell when heard;
      // the paper never waits for a number it can already admit it lacks.
      const peaks = measureOwnerPeaks(owners, ctrl.signal);
      try {
        const qc = await measureMapQc(owners[0], ctrl.signal);
        if (ctrl.signal.aborted) return;
        setMapQc(qc);
        setMapPending(false);
      } catch {
        if (ctrl.signal.aborted) return;
        setMapError(true);
        setMapPending(false);
      }
      // the peaks merge after the deep section settles — partial truth
      // first, numbers when they arrive (— is honest, a guess is not)
      // t221: the merge also computes Agreement r — every owner's bins
      // against the winner's (owners[0], the walk's head), through the
      // SAME shapeAgreement the paper's cell prints. The winner's own r
      // lands at 1.00 through the same path (a landscape against itself);
      // an owner whose profile refused keeps r = — (null, never a guess).
      const heard = await peaks;
      if (ctrl.signal.aborted || heard.size === 0) return;
      const winnerBins = owners[0] ? heard.get(owners[0].jobId)?.bins ?? null : null;
      setMapInventory((prev) =>
        prev?.map((row) =>
          heard.has(row.jobId)
            ? {
                ...row,
                peak: heard.get(row.jobId)?.text ?? null,
                peakPct: heard.get(row.jobId)?.pct ?? null,
                shapeR: shapeAgreement(winnerBins, heard.get(row.jobId)?.bins ?? null),
                // t222: WHERE does the shape not follow? The same
                // quarter-band cut the deep report speaks — weakest band
                // of owner-vs-winner, from the SAME bins (the third
                // surface of the one well; a band that is flat or a grid
                // too short to cut earns null and the cell says —).
                weakest: weakestBand(localAgreement(winnerBins ?? [], heard.get(row.jobId)?.bins ?? [])),
                // t223: the bins themselves are the FOURTH surface — the
                // shape portrait draws the landscape the r column
                // compressed. Same fetch, same well, no second father.
                bins: heard.get(row.jobId)?.bins ?? null,
              }
            : row,
        ) ?? prev,
      );
    })();
    return () => ctrl.abort();
  }, [open]);

  const pipeline = React.useMemo(() => {
    const succeeded = jobs.filter((j) => j.status === "completed").length;
    const running = jobs.filter((j) => j.status === "running").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    return { total: jobs.length, succeeded, running, failed, waiting: jobs.length - succeeded - running - failed };
  }, [jobs]);

  const md = React.useMemo(
    () =>
      buildSessionReport({
        projectName: project?.name ?? null,
        pipeline,
        mapQc,
        mapPending,
        mapError,
        mapInventory,
        sweep: lastSweep ? buildSweepReport(lastSweep.rows, lastSweep.bestId) : null,
      }),
    [project?.name, pipeline, mapQc, mapPending, mapError, mapInventory, lastSweep],
  );

  // t213: pressing a door hands the reader to the owner's results. The
  // engine is openJob — the SAME door the command palette uses (landing
  // repair, workspace hops, then the inspector for a completed job) —
  // and the paper closes: the results panel lives on the canvas, not
  // under the dialog. The landing itself is the receipt.
  const pressOwner = React.useCallback(
    (owner: { jobId: string }) => {
      void useWorkflowStore.getState().openJob(owner.jobId);
      onOpenChange(false);
    },
    [onOpenChange],
  );

  // The rendered document's component overrides (t213): the ONE table
  // whose head is exactly OWNER_HEAD carries doors on its body rows; the
  // thead neutralizes the context (a head row is a label, not a door);
  // every other table — the Comparison table, any future family — keeps
  // its plain rows. Row→owner matching is on the RENDERED cells against
  // the settled walk inventory; an unmatched row stays plain (a door
  // must promise what the paper says). Keyboard pressable (Enter/Space)
  // — a door that needs a mouse is half a door.
  const mdComponents = React.useMemo<Components>(() => {
    type TableProps = React.ComponentPropsWithoutRef<"table"> & ExtraProps;
    type TheadProps = React.ComponentPropsWithoutRef<"thead"> & ExtraProps;
    type TrProps = React.ComponentPropsWithoutRef<"tr"> & ExtraProps;
    type H2Props = React.ComponentPropsWithoutRef<"h2"> & ExtraProps;
    return {
      // t228: the section head that admits the hero. The exact-words
      // match is the bouncer — "Map QC" admits the report's one large
      // landscape; the deep report's own "Map QC summary — <map>" head
      // admits nothing (a partial name cannot mint a figure). The hero
      // renders BETWEEN the head and the deep prose: the figure
      // introduces the terrain the tables below detail. It drinks the
      // SAME well measureMapQc delivered — no fetch, no second father —
      // and the heading keeps its exact paper bytes (the figure is
      // rendered around the words, never written into them).
      h2: ({ node, children, ...rest }: H2Props) => {
        const text = hastKids(node).map(hastText).join("");
        if (text !== MAP_QC_HEAD || !mapQc?.mainBins) return <h2 {...rest}>{children}</h2>;
        return (
          <>
            <h2 {...rest}>{children}</h2>
            <HeroLandscape
              mainBins={mapQc.mainBins}
              overlays={mapQc.overlays}
              mainName={mapInventory?.[0]?.mainName ?? null}
            />
          </>
        );
      },
      table: ({ node, children, ...rest }: TableProps) => {
        // find the head row by tagName — position lies (whitespace text
        // nodes interleave every table part; see the hast helpers above)
        const head = hastKids(node).find((c) => hastTag(c) === "thead");
        const headRow = hastKids(head).find((c) => hastTag(c) === "tr");
        const headTexts = hastKids(headRow)
          .filter((c) => hastTag(c) === "th")
          .map(hastText);
        const isInventory =
          headTexts.length === OWNER_HEAD.length && OWNER_HEAD.every((h, i) => headTexts[i] === h);
        // t226: the comparisons table earns the same wire grammar — its
        // head speaks COMPARISON_HEAD exactly, and its body rows carry
        // the winner's own family portraits
        const isComparison =
          headTexts.length === COMPARISON_HEAD.length &&
          COMPARISON_HEAD.every((h, i) => headTexts[i] === h);
        if (isComparison)
          return (
            <ComparisonTableContext.Provider value={true}>
              <table {...rest}>{children}</table>
            </ComparisonTableContext.Provider>
          );
        // t227: the Local agreement table earns the same wire grammar —
        // its head speaks LOCAL_HEAD exactly (the quarter words imported
        // from the logic layer), and its body rows carry the strips
        const isLocal =
          headTexts.length === LOCAL_HEAD.length && LOCAL_HEAD.every((h, i) => headTexts[i] === h);
        if (isLocal)
          return (
            <LocalTableContext.Provider value={true}>
              <table {...rest}>{children}</table>
            </LocalTableContext.Provider>
          );
        if (!isInventory) return <table {...rest}>{children}</table>;
        return (
          <InventoryTableContext.Provider value={true}>
            <table {...rest}>{children}</table>
          </InventoryTableContext.Provider>
        );
      },
      thead: ({ node, children, ...rest }: TheadProps) => (
        <InventoryTableContext.Provider value={false}>
          <ComparisonTableContext.Provider value={false}>
            <LocalTableContext.Provider value={false}>
              <thead {...rest}>{children}</thead>
            </LocalTableContext.Provider>
          </ComparisonTableContext.Provider>
        </InventoryTableContext.Provider>
      ),
      tr: ({ node, children, ...rest }: TrProps) => {
        const inInventory = React.useContext(InventoryTableContext);
        const inComparison = React.useContext(ComparisonTableContext);
        const inLocal = React.useContext(LocalTableContext);
        const cells = hastKids(node)
          .filter((c) => hastTag(c) === "td" || hastTag(c) === "th")
          .map(hastText);
        // t223: the inventory head row — matched EVERY cell at once
        // against OWNER_HEAD (a partial head cannot mint a Shape th) —
        // earns the wire's eighth column HEAD. The th lives in the TR
        // override because a th appended to the thead itself renders
        // OUTSIDE the head row (the browser wraps the stray th in its
        // own line — the first portrait frame caught the column head
        // divorced from its table: the frame is a reviewer too). The
        // picture is RENDERED here, never written into the markdown:
        // the paper's bytes keep their seven-column facts.
        if (
          !inInventory &&
          cells.length === OWNER_HEAD.length &&
          OWNER_HEAD.every((h, i) => cells[i] === h)
        ) {
          return <tr {...rest}>{children}<th className="text-right">{SHAPE_HEAD}</th></tr>;
        }
        // t226: the comparisons head row — matched EVERY cell at once
        // against COMPARISON_HEAD — earns the wire's sixth column HEAD,
        // the same grammar the roster speaks (a picture column rendered,
        // never written into the paper's bytes).
        if (
          !inComparison &&
          cells.length === COMPARISON_HEAD.length &&
          COMPARISON_HEAD.every((h, i) => cells[i] === h)
        ) {
          return <tr {...rest}>{children}<th className="text-right">{SHAPE_HEAD}</th></tr>;
        }
        // t227: the local head row — matched EVERY cell at once against
        // LOCAL_HEAD — earns the wire's eighth column HEAD (the paper's
        // seven + Bands, rendered here, never written into the bytes).
        if (
          !inLocal &&
          cells.length === LOCAL_HEAD.length &&
          LOCAL_HEAD.every((h, i) => cells[i] === h)
        ) {
          return <tr {...rest}>{children}<th className="text-right">{BANDS_HEAD}</th></tr>;
        }
        // t226: the comparison body row — the winner's own family (main
        // vs each sibling volume) draws the same portrait the roster
        // earned: overlay solid over main dotted, marks at each
        // landscape's paper address (the Peak at column's own number,
        // peakPctNumOf — one well, no second father). The pairwise
        // table's rows also start with map names, but they live in a
        // table whose head is NOT COMPARISON_HEAD — the context is the
        // bouncer, the digits-guard is the belt-and-braces.
        if (
          inComparison &&
          cells.length === COMPARISON_HEAD.length &&
          /^\d+$/.test(cells[1] ?? "")
        ) {
          const ov = mapQc?.overlays.find((o) => o.name === cells[0]);
          const cmpMain = mapQc?.mainBins ?? null;
          return (
            <tr {...rest}>
              {children}
              <td
                data-shape-cell={ov?.bins ? "spark" : "empty"}
                className="text-right align-middle"
              >
                {ov?.bins ? (
                  <ShapeSparkline
                    bins={ov.bins}
                    winnerBins={cmpMain}
                    peakPct={peakPctNumOf(ov.bins)}
                    winnerPct={cmpMain ? peakPctNumOf(cmpMain) : null}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          );
        }
        // t227: the local body row — the four quarter bars the paper's
        // r cells already describe. The bands come from the SAME
        // localAgreement the paper's table drank from, on the SAME bins
        // measureMapQc delivered (one well; a re-computation through the
        // same machinery is the same number, not a second father — the
        // inventory's Weakest column has ridden this path since t222).
        if (inLocal && cells.length === LOCAL_HEAD.length) {
          const ov = mapQc?.overlays.find((o) => o.name === cells[0]);
          const cmpMain = mapQc?.mainBins ?? null;
          const bands = ov?.bins && cmpMain ? localAgreement(cmpMain, ov.bins) : null;
          return (
            <tr {...rest}>
              {children}
              <td
                data-shape-cell={bands ? "spark" : "empty"}
                className="text-right align-middle"
              >
                {bands ? (
                  <BandStrip bands={bands} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          );
        }
        const owner = mapInventory?.find(
          (o) => cells[0] === o.jobName && cells[1] === o.mainName && cells[2] === String(o.volumeCount),
        );
        if (!inInventory || !owner) return <tr {...rest}>{children}</tr>;
        // t215: the deviation lens. The Δ aria quote comes from the SAME
        // helper the paper's Δ cell uses (deltaVsWinner, imported — twins
        // fork, imports don't); the amber edge marks the row whose |Δ|
        // is strictly the unique maximum (outlierRowIdx, same import —
        // in a tied world it crowns nobody). A lens, not a verdict: the
        // row stays pressable, the promise stays exactly what it said.
        // t221: the aria also quotes the row's Agreement r (the SAME
        // number the paper's cell prints — no second well).
        // t225: this same winnerPct is the address mark's father too —
        // the pct the mark points at is THE pct the Δ lens drank from,
        // one well, three surfaces (the word, the Δ, the hairline).
        const winnerPct = mapInventory?.[0]?.peakPct ?? null;
        const delta = deltaVsWinner(owner.peakPct, winnerPct);
        const rowIdx = mapInventory?.findIndex((o) => o.jobId === owner.jobId) ?? -1;
        const isOutlier = rowIdx >= 0 && rowIdx === outlierRowIdx(mapInventory ?? []);
        const rQuote = owner.shapeR != null ? `, shape r ${owner.shapeR.toFixed(2)}` : "";
        const wQuote = owner.weakest ? `, thinnest ${weakestCellOf(owner.weakest)}` : "";
        // t223: the aria speaks the picture's verdict in words — the SAME
        // shapeR the r cell prints drives it (no second well): a portrait
        // that follows says so, a divergent one names its own r. An
        // unmeasured row says nothing extra (— is honest in the ear too).
        const pQuote =
          owner.bins && owner.shapeR != null
            ? owner.shapeR >= 0.95
              ? ", shape portrait follows the winner"
              : `, shape portrait diverges (r ${owner.shapeR.toFixed(2)})`
            : "";
        const winnerBins = mapInventory?.[0]?.bins ?? null;
        return (
          <tr
            {...rest}
            data-owner-door={owner.jobId}
            data-outlier={isOutlier ? "1" : undefined}
            tabIndex={0}
            aria-label={`Open ${owner.jobName}'s results — ${owner.mainName}, ${owner.volumeCount} ${owner.volumeCount === 1 ? "volume" : "volumes"}${owner.peak ? `, peak ${owner.peak}` : ""}${delta ? `, Δ ${delta} vs winner` : ""}${rQuote}${wQuote}${pQuote}`}
            className={`cursor-pointer transition-colors hover:bg-violet-500/10 focus-visible:bg-violet-500/15 focus-visible:outline-none${isOutlier ? " bg-amber-500/[0.04]" : ""}`}
            style={isOutlier ? { boxShadow: "inset 3px 0 0 0 rgb(245 158 11)" } : undefined}
            onClick={() => pressOwner(owner)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pressOwner(owner);
              }
            }}
          >
            {children}
            {/* t223: the shape portrait — the wire's eighth cell, RENDERED
                here and never written into the markdown (pictures live on
                the wire; the paper's bytes keep their seven-column facts).
                A row whose landscape never arrived keeps the honest dash. */}
            <td data-shape-cell={owner.bins ? "spark" : "empty"} className="text-right align-middle">
              {owner.bins ? (
                <ShapeSparkline bins={owner.bins} winnerBins={winnerBins} peakPct={owner.peakPct} winnerPct={winnerPct} />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        );
      },
    };
  }, [mapInventory, mapQc, pressOwner]);

  /* t232: the CSV's second mouth. The markdown speaks two doors (copy,
     download) — the machine grid spoke only one. Copy is NOT a second
     CSV builder: the same inventoryCsv bytes leave through the same
     function, the same empty-state refusal ("still measuring" — a
     silent no-op is a lying door), the same receipt grammar. The
     clipboard-denied ladder is copyOrFallback's — t233 single-fathered
     it; the empty-state guard stays HERE (it is the CSV's own truth,
     not the ladder's). */
  const exportCsv = async (mode: "copy" | "download") => {
    const csv = inventoryCsv(mapInventory ?? null);
    if (!csv) {
      // the honest empty: no roster settled yet — the button says so,
      // the note names the wait (a silent no-op is a lying door)
      flashNote("The map inventory is still measuring — no CSV yet");
      return;
    }
    if (mode === "copy") {
      flashNote(
        await copyOrFallback(
          csv,
          inventoryCsvFilename(),
          "text/csv;charset=utf-8",
          "Copied the map inventory grid to the clipboard",
          "Downloaded session-map-inventory-….csv (clipboard unavailable)",
        ),
      );
      return;
    }
    downloadText(inventoryCsvFilename(), csv, "text/csv;charset=utf-8");
    flashNote("Downloaded session-map-inventory-….csv");
  };

  const exportMd = async (mode: "copy" | "download") => {
    if (mode === "copy") {
      // t233: the ladder's first customer — same mechanism as the CSV
      // door now, one father for the whole copy-or-fallback dance
      flashNote(
        await copyOrFallback(
          md,
          sessionReportFilename(),
          "text/markdown;charset=utf-8",
          "Copied the session QC report to the clipboard",
          "Downloaded session-qc-report-….md (clipboard unavailable)",
        ),
      );
      return;
    }
    downloadText(sessionReportFilename(), md, "text/markdown;charset=utf-8");
    flashNote("Downloaded session-qc-report-….md");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-report-doc
        data-md={md}
        className="max-w-4xl sm:max-w-4xl"
        aria-label="Session QC report"
      >
        <DialogHeader className="no-print">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileDown className="h-4 w-4 text-violet-600" aria-hidden="true" />
            Session QC report
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            The report families meet: pipeline glance · map QC (measured, not viewed) · the sweep verdict, bound verbatim.
          </DialogDescription>
        </DialogHeader>

        {/* the doors — copy / download speak Markdown, print speaks paper */}
        <div className="no-print flex flex-wrap items-center justify-end gap-1.5" data-report-doors>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-violet-600 hover:bg-violet-600/15 hover:text-violet-600"
            aria-label="Copy session report"
            onClick={() => exportMd("copy")}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy report
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-violet-600 hover:bg-violet-600/15 hover:text-violet-600"
            aria-label="Download session report"
            onClick={() => exportMd("download")}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download report
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-emerald-600 hover:bg-emerald-600/15 hover:text-emerald-600"
            aria-label="Copy map inventory CSV"
            title="The same machine grid, straight to the clipboard — the download door's twin, one well, two mouths"
            onClick={() => exportCsv("copy")}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-emerald-600 hover:bg-emerald-600/15 hover:text-emerald-600"
            aria-label="Download map inventory CSV"
            title="The map inventory as a machine grid — job, main map, volumes, peak %, Δ winner (one row per owner, pending peaks blank)"
            onClick={() => exportCsv("download")}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            Download CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-violet-600 hover:bg-violet-600/15 hover:text-violet-600"
            aria-label="Print session report"
            title="Print / save as PDF — the paper contract prints exactly this document"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Print
          </Button>
        </div>

        {note && (
          <p
            className="no-print rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300"
            role="status"
          >
            {note}
          </p>
        )}

        {/* the document itself — the families' bytes, rendered */}
        <div className="report-doc max-h-[62vh] overflow-y-auto pr-1" data-report-body>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{md}</ReactMarkdown>
        </div>
      </DialogContent>
    </Dialog>
  );
}
