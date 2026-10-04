import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { findEffectiveJob } from "@/lib/link";
import { getLogTail } from "@/lib/relion/engine";
import { parseSelectionReceipt } from "@/lib/selection-receipt";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/selection-receipt — the selection story the engine
 * already wrote (t562).
 *
 * Every native select/select2d run logs a full receipt (per-class
 * occupancy with kept/PRUNED verdicts, input/output counts, the deciding
 * mode, the result line). This route hands that receipt back as
 * structured JSON — the Results tab's receipt card reads THIS, not the
 * raw log tail. The parse is read-only over run.out via the same
 * getLogTail the log route uses (8MB cap, cache, soft-link resolution);
 * the newest block is the newest run's truth.
 *
 * provenance rides alongside (from the job's params, the same law
 * explicitSelectionOf reads):
 *   - classStarSelection (AI select_classes or the gallery birth gesture)
 *     → kind "birth" + the source job's name, so the card can say
 *     "born selection · from Class2D 4"
 *   - selectedClasses string (ticks in this job's own gallery)
 *     → kind "param"
 *   - neither → kind "auto" (the occupancy rule decided)
 *
 * 403 cross-site (the workdir-derived-data hardening pair), 404 when the
 * job does not exist or is not a selection verb, and an honest
 * { available:false, note } when there is no receipt yet (the job has
 * not completed a native run — a pending select2d is not a lie, just
 * not-yet).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  // Hardening (t251 family): the bytes come from the job workdir's run
  // log — the drive-by door + Host pin pair rides along, same as the log
  // and outputs/file routes.
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to job data is not allowed" },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    // soft links: the receipt lives in the original job's run record
    const effective = await findEffectiveJob(id);
    if (!effective) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const type = effective.type;
    if (type !== "select2d" && type !== "select") {
      return NextResponse.json(
        { error: `Not a selection job (type ${type})` },
        { status: 404 }
      );
    }

    // ---- provenance from params (db stores a JSON-encoded string) ------
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(effective.params ?? "{}") as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    let birthClasses: number[] | null = null;
    let sourceJobId: string | null = null;
    const sel = parsed.classStarSelection;
    if (sel && typeof sel === "object" && !Array.isArray(sel)) {
      const s = sel as { jobId?: unknown; classes?: unknown };
      if (typeof s.jobId === "string") sourceJobId = s.jobId;
      if (Array.isArray(s.classes)) {
        const list = s.classes
          .map((c) => Number(c))
          .filter((c) => Number.isInteger(c) && c > 0);
        if (list.length > 0) birthClasses = list;
      }
    }
    const rawParam = String(parsed.selectedClasses ?? "").trim();
    const paramClasses =
      rawParam !== "" && rawParam !== "auto"
        ? [
            ...new Set(
              rawParam
                .split(/[,;\s]+/)
                .map((s) => parseInt(s, 10))
                .filter((n) => Number.isFinite(n) && n > 0)
            ),
          ]
        : null;

    let sourceJobName: string | null = null;
    if (sourceJobId) {
      const src = await db.job.findUnique({
        where: { id: sourceJobId },
        select: { name: true },
      });
      sourceJobName = src?.name ?? null;
    }

    // ---- the receipt itself --------------------------------------------
    const log = getLogTail(effective.id, { full: true });
    const receipt = log?.text ? parseSelectionReceipt(log.text) : null;
    if (!receipt) {
      return NextResponse.json({
        jobId: id,
        type,
        available: false,
        note:
          effective.status === "completed"
            ? "The run log carries no selection receipt (pre-receipt run or a non-native lane)"
            : "No receipt yet — the job has not completed a selection run",
      });
    }

    return NextResponse.json({
      jobId: id,
      type,
      available: true,
      status: effective.status,
      result: effective.result,
      receipt,
      provenance: {
        kind: birthClasses
          ? ("birth" as const)
          : paramClasses
            ? ("param" as const)
            : ("auto" as const),
        birthClasses,
        paramClasses,
        sourceJobId,
        sourceJobName,
      },
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/selection-receipt failed:", error);
    return NextResponse.json(
      { error: "Failed to read the selection receipt" },
      { status: 500 }
    );
  }
}
