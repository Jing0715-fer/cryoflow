import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity?days=14 — per-day job activity across ALL projects,
 * feeding the Dashboard KPI sparklines.
 *
 * Two cumulative series aligned to the returned `days` array:
 *  • total     — jobs CREATED up to and including that day
 *  • completed — jobs whose status is completed with updatedAt ≤ end of that
 *                day. A completed job's last update IS its completion in
 *                practice (nothing rewrites it afterwards), which makes
 *                updatedAt an honest completion-time proxy; workdir moves
 *                (PATCH x/y) after completion can shift a job's dot by a
 *                day, which is noise we accept rather than adding a
 *                completedAt column for a sparkline.
 *
 * Day boundaries are UTC (server clock) — the sparkline is a trend hint,
 * not a billing report, so a +8h skew is immaterial. Cheap aggregate over
 * two slim columns; no statcache involvement (no file reads).
 */

interface ActivityPayload {
  /** ISO day labels ("2026-09-01"), oldest → newest, length = requested days */
  days: string[];
  /** cumulative job count at end of each day */
  total: number[];
  /** cumulative completed-job count at end of each day */
  completed: number[];
  /** absolute count of jobs created inside the window (for the "+N" chip) */
  createdInWindow: number;
  /** absolute count of jobs completed inside the window */
  completedInWindow: number;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const days = Math.max(7, Math.min(30, Number.parseInt(url.searchParams.get("days") ?? "14", 10) || 14));

    // window start = (today − days + 1) at 00:00 UTC
    const today = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const startDay = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - (days - 1) * dayMs
    );

    const rows = await db.job.findMany({
      // only what the two series need — keeps the payload scan slim even
      // for large projects
      select: { createdAt: true, updatedAt: true, status: true },
    });

    const labels: string[] = [];
    const index = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDay.getTime() + i * dayMs);
      const label = d.toISOString().slice(0, 10);
      index.set(label, i);
      labels.push(label);
    }

    const createdPerDay = new Array<number>(days).fill(0);
    const completedPerDay = new Array<number>(days).fill(0);
    let createdInWindow = 0;
    let completedInWindow = 0;

    for (const r of rows) {
      const created = new Date(r.createdAt);
      const createdLabel = created.toISOString().slice(0, 10);
      const ci = index.get(createdLabel);
      if (ci !== undefined) {
        createdPerDay[ci] += 1;
        createdInWindow += 1;
      }
      if (r.status === "completed") {
        const completedLabel = new Date(r.updatedAt).toISOString().slice(0, 10);
        const bi = index.get(completedLabel);
        if (bi !== undefined) {
          completedPerDay[bi] += 1;
          completedInWindow += 1;
        }
      }
    }

    // cumulative at end of each day — jobs created BEFORE the window are
    // included via the prefix, so the first point is already > 0 for an
    // established project (a from-zero line would lie about the trend)
    let prefix = rows.length - createdInWindow;
    const total = createdPerDay.map((n) => (prefix += n));
    prefix = rows.filter((r) => r.status === "completed").length - completedInWindow;
    const completed = completedPerDay.map((n) => (prefix += n));

    const payload: ActivityPayload = {
      days: labels,
      total,
      completed,
      createdInWindow,
      completedInWindow,
    };
    return NextResponse.json(payload);
  } catch (error) {
    console.error("GET /api/activity failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
