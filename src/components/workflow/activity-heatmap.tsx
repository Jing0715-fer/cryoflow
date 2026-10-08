"use client";

/**
 * CryoFlow — the dashboard's activity calendar (Task 711).
 *
 * A GitHub-contribution-style heatmap of job activity across ALL projects:
 * one column per week (Sunday-aligned by the wire's own contract —
 * GET /api/activity/heatmap pads the first column itself), one row per
 * weekday, one cell per day. The cell answers "how much happened ON that
 * day" with three increments living behind one count:
 *
 *   • the SHADE speaks `touched` — every job whose updatedAt falls on the
 *     day, any status (status flips, param edits, progress sweeps — the
 *     recent-feed's honest touch-time philosophy). A calendar that counted
 *     only creations would stay grey through a week of shepherding runs.
 *   • the TOOLTIP speaks the split — created / completed, so a burst cell
 *     can tell "you seeded a pipeline" apart from "you finished one".
 *
 * The level thresholds are RELATIVE to the observed maximum, not absolute
 * counts: a sparse world (max 2 touches/day) still reads as a gradient
 * instead of collapsing to grey, and a busy world doesn't saturate at L1.
 * L1 is always "at least one touch", L2/L3/L4 divide the observed range —
 * the legend's Less→More is honest about being a scale of THIS world.
 *
 * Faces the family already owns and what this one adds: the KPI sparkline
 * (GET /api/activity) speaks a cumulative TREND line; the recent feed
 * speaks the latest 8 individual jobs; this face speaks the SHAPE OF TIME
 * itself — where the bursts were, how long the quiet stretches ran. The
 * three together are the dashboard's complete activity dialect.
 *
 * Honest states (the feed's empty-state law, calibrated for a calendar):
 *  • a world with zero jobs renders nothing — an all-grey calendar would
 *     be decoration pretending to be data;
 *  • a world whose jobs all predate the window still renders — the grey
 *     grid IS the story ("quiet lately"), with whatever cells exist
 *     colored at the end;
 *  • a fetch failure renders nothing — convenience, not dependency.
 */

import * as React from "react";
import { CalendarDays } from "lucide-react";

interface HeatmapDay {
  date: string;
  created: number;
  completed: number;
  touched: number;
}

interface HeatmapPayload {
  weeks: number;
  today: string;
  totalJobs: number;
  days: HeatmapDay[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Row labels — Sunday-aligned grid (wire contract), GitHub dialect: label
 *  the odd rows only, or the 7-label column tower overpowers the cells. */
const WEEKDAY_ROWS: (string | null)[] = ["Sun", null, "Tue", null, "Thu", null, "Sat"];

/** Relative thresholds: L1 is "touched at all", L2/L3/L4 divide the
 *  observed maximum into thirds with floors so a tiny max still reads as
 *  multiple levels (max=2 → L2 reachable; max=5 → 2/3/4). */
function levelOf(touched: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (touched <= 0 || max <= 0) return 0;
  if (touched >= Math.max(4, Math.ceil((max * 3) / 4))) return 4;
  if (touched >= Math.max(3, Math.ceil(max / 2))) return 3;
  if (touched >= Math.max(2, Math.ceil(max / 4))) return 2;
  return 1;
}

/** The shade scale: opacity steps over one success token so light and dark
 *  themes each get a native gradient (the token itself re-tunes per theme —
 *  emerald-600 in light, emerald-400 in dark) with zero duplicated palettes. */
const LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted",
  1: "bg-success/25",
  2: "bg-success/45",
  3: "bg-success/70",
  4: "bg-success",
};

/** "2026-10-08" → "Oct 8" — a fixed UTC parse, immune to locale drift
 *  between server render and hydration. */
function shortDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
}

export function ActivityHeatmap() {
  const [data, setData] = React.useState<HeatmapPayload | null>(null);
  const [failed, setFailed] = React.useState(false);

  // fetch once on mount — a calendar is a slow face; the feed's 4s live
  // poll exists because running jobs move, but a day-cell never moves
  // under the user's eyes. Refetching on jobCount would redraw mid-glance
  // for zero new information (today's cell updates on the next visit).
  React.useEffect(() => {
    let alive = true;
    fetch("/api/activity/heatmap?weeks=17")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: HeatmapPayload) => {
        if (alive && d && Array.isArray(d.days) && d.days.length > 0) setData(d);
        else if (alive) setFailed(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // the empty-state law: zero jobs = no calendar (decoration pretending to
  // be data); fetch failure = no calendar (convenience, not dependency)
  if (failed || (data !== null && data.totalJobs === 0)) return null;
  if (data === null) {
    // skeleton — 17 ghost columns, the exact shape the real grid will take
    return (
      <section
        aria-label="Activity calendar across all projects"
        className="card-lift rounded-xl border bg-card px-4 py-3.5 sm:px-5"
      >
        <div className="mb-2.5 flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
          <span className="text-[11px] text-muted-foreground">across all projects</span>
        </div>
        <div className="flex gap-[3px] overflow-hidden" aria-hidden="true">
          {Array.from({ length: 17 }, (_, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, d) => (
                <span key={d} className="size-3 animate-pulse rounded-[3px] bg-muted/60" />
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  const { days, today, weeks, totalJobs } = data;
  const maxTouched = Math.max(...days.map((d) => d.touched));
  const totalTouches = days.reduce((acc, d) => acc + d.touched, 0);

  // slice into week columns — the wire guarantees days[0] is a Sunday, so
  // every 7-cell run is a column; the last column is short (ends today)
  const columns: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) columns.push(days.slice(i, i + 7));

  // month labels: a column speaks its first cell's month, and only when it
  // differs from the previous column's (the first column always speaks —
  // the window's opening month anchors the timeline)
  const monthLabels: (string | null)[] = columns.map((col, i) => {
    const m = MONTHS[Number(col[0].date.slice(5, 7)) - 1];
    if (i === 0) return m;
    const prev = MONTHS[Number(columns[i - 1][0].date.slice(5, 7)) - 1];
    return m !== prev ? m : null;
  });

  const busiest = days.reduce((best, d) => (d.touched > best.touched ? d : best), days[0]);

  return (
    <section
      aria-label="Activity calendar across all projects"
      className="card-lift rounded-xl border bg-card px-4 py-3.5 sm:px-5"
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
        <span className="text-[11px] text-muted-foreground">
          {totalJobs === totalTouches
            ? `${totalTouches} job touch${totalTouches === 1 ? "" : "es"} in the last ${weeks} weeks`
            : `${totalTouches} job touch${totalTouches === 1 ? "" : "es"} across ${totalJobs} jobs · last ${weeks} weeks`}
        </span>
        {/* the legend speaks THIS world's relative scale — Less→More is a
            scale of the observed maximum, not an absolute count */}
        <span className="ml-auto hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex" aria-hidden="true">
          Less
          {([0, 1, 2, 3, 4] as const).map((l) => (
            <span key={l} className={`size-2.5 rounded-[2px] ${LEVEL_CLASS[l]}`} />
          ))}
          More
        </span>
      </div>

      {/* screen-reader summary: the cells are a picture; the paragraph is
          the same data in prose (GitHub's own a11y dialect) */}
      <p className="sr-only">
        {`Job activity calendar for the last ${weeks} weeks: ${totalTouches} touches total. Busiest day ${shortDateLabel(
          busiest.date
        )} with ${busiest.touched} touch${busiest.touched === 1 ? "" : "es"}.`}
      </p>

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1.5">
          {/* weekday row labels — pt matches the month-label row height */}
          <div className="flex flex-col gap-[3px] pt-[18px]" aria-hidden="true">
            {WEEKDAY_ROWS.map((label, i) => (
              <span key={i} className="flex h-3 items-center justify-end text-[9px] leading-none text-muted-foreground/70">
                {label ? <span className="w-6 pr-1">{label}</span> : null}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {/* month labels — each spans one week column, overflow visible */}
            <div className="flex gap-[3px]" aria-hidden="true">
              {columns.map((col, i) => (
                <div key={i} className="relative h-[14px] w-3">
                  {monthLabels[i] && (
                    <span className="absolute left-0 top-0 whitespace-nowrap text-[9px] leading-none text-muted-foreground/70">
                      {monthLabels[i]}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* the grid itself — decorative cells + per-cell native tooltip */}
            <div className="flex gap-[3px]" aria-hidden="true">
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {col.map((d) => {
                    const lvl = levelOf(d.touched, maxTouched);
                    const isToday = d.date === today;
                    const split =
                      d.created > 0 || d.completed > 0
                        ? ` · ${d.created} created · ${d.completed} completed`
                        : "";
                    return (
                      <span
                        key={d.date}
                        title={`${shortDateLabel(d.date)}: ${d.touched} touch${d.touched === 1 ? "" : "es"}${split}`}
                        className={[
                          "size-3 rounded-[3px] transition-colors hover:ring-1 hover:ring-foreground/30",
                          LEVEL_CLASS[lvl],
                          isToday ? "ring-1 ring-primary ring-offset-1 ring-offset-card" : "",
                        ].join(" ")}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
