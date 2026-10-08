import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity/heatmap?weeks=17 — the dashboard's activity calendar
 * (Task 711). A new data FACE, not a new fact: the sparkline endpoint
 * (GET /api/activity) already speaks per-day CUMULATIVE series for a
 * ≤30-day window, which is the right shape for a trend line and the wrong
 * shape for a calendar — the heatmap's cell answers "how much happened ON
 * that day" (an increment), and its window is measured in WEEKS so the
 * Sunday-aligned column grid can be built without padding tricks on the
 * client. One well per shape: the sparkline keeps its cumulative series,
 * the calendar gets its own endpoint instead of stretching the sparkline's
 * contract (its `days` array length is load-bearing for its consumers).
 *
 * Three per-day INCREMENTS, aligned with the recent-feed's touch philosophy:
 *  • created   — jobs whose createdAt falls on the day
 *  • completed — jobs whose status is completed AND updatedAt falls on the
 *                day (same honest proxy as /api/activity: a completed job's
 *                last touch IS its completion in practice)
 *  • touched   — jobs whose updatedAt falls on the day, ANY status (status
 *                flips, param edits, progress sweeps all count — the same
 *                "updatedAt is the honest touch-time" contract the
 *                recent-activity feed's header documents; a calendar that
 *                counted only creations would stay grey through a week of
 *                shepherding runs)
 *
 * The grid is Sunday-aligned HERE (the wire's contract, not the client's
 * chore): the first day is the Sunday on-or-before the window start, so
 * every column in the returned array is a full week except the last, which
 * ends at today — a short final column is the calendar's honest "week in
 * progress", not a hole. Day boundaries are UTC (server clock), same as
 * /api/activity — a trend/calendar hint, not a billing report.
 *
 * `totalJobs` rides along so the client can honor the empty-state law: a
 * world with zero jobs renders no calendar at all (the feed's honesty), but
 * a world whose jobs all predate the window still renders an honest grey
 * grid with a few colored cells at the end.
 */

interface HeatmapDay {
  /** ISO day label ("2026-06-08") */
  date: string;
  created: number;
  completed: number;
  touched: number;
}

interface HeatmapPayload {
  /** echoed back so the client's title can speak the same window */
  weeks: number;
  /** ISO label of the last day in the grid (today, server clock) */
  today: string;
  /** total jobs across ALL projects — the empty-state signal */
  totalJobs: number;
  /** Sunday-aligned, oldest → newest, ends at today (short final week) */
  days: HeatmapDay[];
}

export async function GET(request: NextRequest) {
  // Task 711 — the reader door, same as its /api/activity siblings: the
  // aggregate query would still RUN for a drive-by page that can never
  // read the opaque response — a free database-work oracle. Every handler
  // speaks one door (doctrine in http-guard.ts; the t709/t710 censuses
  // sweep new routes automatically).
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site activity reads are not allowed" }, { status: 403 });
  }
  try {
    const url = new URL(request.url);
    const weeks = Math.max(4, Math.min(26, Number.parseInt(url.searchParams.get("weeks") ?? "17", 10) || 17));

    const today = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

    // window = the last `weeks*7` days ending today; the grid's first cell
    // is the Sunday on-or-before that start (getUTCDay(): 0 = Sunday), so
    // every column but the last is a complete week
    const windowStart = todayUtc - (weeks * 7 - 1) * dayMs;
    const startDow = new Date(windowStart).getUTCDay();
    // Sunday start = itself; Mon..Sat start = back up `startDow` days
    const gridStart = startDow === 0 ? windowStart : windowStart - startDow * dayMs;

    const dayCount = Math.round((todayUtc - gridStart) / dayMs) + 1;

    const [rows, totalJobs] = await Promise.all([
      db.job.findMany({
        // slim select — the calendar only needs the two touch times and the
        // completion flag; params/results blobs stay unread (same contract
        // as the sparkline endpoint's findMany)
        select: { createdAt: true, updatedAt: true, status: true },
      }),
      db.job.count(),
    ]);

    const labels: string[] = [];
    const index = new Map<string, number>();
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(gridStart + i * dayMs);
      const label = d.toISOString().slice(0, 10);
      index.set(label, i);
      labels.push(label);
    }

    const createdPerDay = new Array<number>(dayCount).fill(0);
    const completedPerDay = new Array<number>(dayCount).fill(0);
    const touchedPerDay = new Array<number>(dayCount).fill(0);

    for (const r of rows) {
      const ti = index.get(new Date(r.updatedAt).toISOString().slice(0, 10));
      if (ti !== undefined) {
        touchedPerDay[ti] += 1;
        if (r.status === "completed") {
          completedPerDay[ti] += 1;
        }
      }
      const ci = index.get(new Date(r.createdAt).toISOString().slice(0, 10));
      if (ci !== undefined) {
        createdPerDay[ci] += 1;
      }
    }

    const days: HeatmapDay[] = labels.map((date, i) => ({
      date,
      created: createdPerDay[i],
      completed: completedPerDay[i],
      touched: touchedPerDay[i],
    }));

    return NextResponse.json({
      weeks,
      today: new Date(todayUtc).toISOString().slice(0, 10),
      totalJobs,
      days,
    } satisfies HeatmapPayload);
  } catch {
    return NextResponse.json({ error: "heatmap aggregation failed" }, { status: 500 });
  }
}
