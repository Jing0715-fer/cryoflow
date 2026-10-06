"use client";

/**
 * CryoFlow — micrograph QC board (the at-a-glance sibling of the CTF
 * scatter and the drift bars).
 *
 * The per-micrograph charts answer "what does the distribution look
 * like"; this board answers "WHICH micrographs should I look at first":
 * one tile per micrograph, colored by how it compares to ITS OWN PACK
 * (p75 watch / p90 offender quantiles from lib/qc-board — no absolute
 * thresholds, the legend bakes the pack's own numbers in), with a metric
 * switch per domain: the CTF's three lenses (worst fit / astigmatism /
 * FOM), motion's accumulated drift, and — t433 — picking's two lenses
 * (pick count / median autopick FOM), where a micrograph with ZERO picks
 * is an absolute offender no matter what the quantiles say (the empty
 * law in lib/qc-board: a real micrograph always has particles to find).
 *
 * Tiles keep the second line ALWAYS visible (accessibility + print):
 * CTF tiles carry the defocus U/V pair, motion tiles the early/late
 * split, picking tiles the count/FOM pair — nothing lives behind a
 * hover. Sort chips: worst-first (the exclusion shortlist) or name (the
 * catalogue walk).
 *
 * Self-hides until the job's catalogue has ≥ 3 micrographs (the same
 * renderable law the sibling charts obey) — an honest gap renders
 * nothing rather than an empty frame.
 */

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, TriangleAlert } from "lucide-react";
import {
  type CtfMetric,
  type MotionMetric,
  type PickMetric,
  type PickQcEntry,
  type QcBucket,
  QC_METRIC_LABEL,
  ctfBoard,
  fmtQcValue,
  medianPickFom,
  motionBoard,
  pickingBoard,
  qcLegendText,
} from "@/lib/qc-board";
import { type CtfResponse, type MotionResponse } from "@/lib/chart-rows";
import { cn } from "@/lib/utils";

const BUCKET_TILE: Record<QcBucket, string> = {
  healthy: "border-l-emerald-500/70",
  watch: "border-l-amber-500/80",
  offender: "border-l-rose-500/90 bg-danger/[0.04]",
};

const BUCKET_VALUE: Record<QcBucket, string> = {
  healthy: "text-emerald-700 dark:text-emerald-300",
  watch: "text-amber-700 dark:text-amber-300",
  offender: "text-danger",
};

const CTF_METRICS: CtfMetric[] = ["resolution", "astigmatism", "fom"];
const PICK_METRICS: PickMetric[] = ["count", "pickFom"];
type AnyMetric = CtfMetric | MotionMetric | PickMetric;

/** the fields this board reads from the picks route (locally declared —
 *  the route's server types must not leak into the client bundle) */
interface PicksBoardResponse {
  micrographs: {
    name: string;
    count: number;
    foms?: (number | null)[];
  }[];
  catalogued?: number;
}

/** short display name: "Micrographs(movie_00003.mrc)" style names get
 *  their extension trimmed and the directory dropped — the tile is 150px
 *  wide, the full name lives in the title attribute. */
function shortName(name: string): string {
  const base = name.split("/").pop() ?? name;
  return base.replace(/\.(mrc|mrcs|tif|tiff|star)$/i, "");
}

export function MicrographQcBoard({
  kind,
  jobId,
  className,
}: {
  kind: "motion" | "ctf" | "picking";
  jobId: string;
  className?: string;
}) {
  const [motion, setMotion] = useState<MotionResponse | null>(null);
  const [ctf, setCtf] = useState<CtfResponse | null>(null);
  const [picks, setPicks] = useState<PicksBoardResponse | null>(null);
  const [metric, setMetric] = useState<AnyMetric>(
    kind === "ctf" ? "resolution" : kind === "picking" ? "count" : "total"
  );
  const [worstFirst, setWorstFirst] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url =
          kind === "picking"
            ? `/api/jobs/${jobId}/picks`
            : `/api/jobs/${jobId}/${kind === "ctf" ? "ctf" : "motion"}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const body = (await res.json()) as
          | (CtfResponse | MotionResponse | PicksBoardResponse)
          | { error?: string };
        if (cancelled || !body || "error" in body) return;
        if (kind === "ctf") setCtf(body as CtfResponse);
        else if (kind === "motion") setMotion(body as MotionResponse);
        else setPicks(body as PicksBoardResponse);
      } catch {
        /* honest gap — the board simply stays hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, kind]);

  const count =
    kind === "ctf"
      ? (ctf?.micrographs.length ?? 0)
      : kind === "motion"
        ? (motion?.micrographs.length ?? 0)
        : (picks?.micrographs.length ?? 0);
  const renderableCount = count >= 3 ? count : 0; // the renderable law: an honest gap hides the board

  // the FOM lens only exists when at least one mic carries FOM evidence —
  // a manualpick world (or a FOM-less coord star set) must not offer a
  // switch that would rank nothing
  const fomAvailable = !!picks?.micrographs.some((m) =>
    (m.foms ?? []).some((f) => f != null)
  );

  const board = useMemo(() => {
    if (renderableCount < 3) return null;
    if (kind === "ctf" && ctf) {
      if (!(CTF_METRICS as string[]).includes(metric)) return null;
      return ctfBoard(ctf.micrographs, metric as CtfMetric);
    }
    if (kind === "motion" && motion) {
      if (metric !== "total") return null;
      return motionBoard(motion.micrographs);
    }
    if (kind === "picking" && picks) {
      if (!(PICK_METRICS as string[]).includes(metric)) return null;
      const entries: PickQcEntry[] = picks.micrographs.map((m) => ({
        name: m.name,
        count: m.count,
        fom: medianPickFom(m.foms ?? []),
      }));
      return pickingBoard(entries, metric as PickMetric);
    }
    return null;
  }, [kind, ctf, motion, picks, metric, renderableCount]);

  if (renderableCount < 3 || !board) return null;

  const rows = worstFirst
    ? board.rows
    : [...board.rows].sort((a, b) =>
        a.micrograph.name.localeCompare(b.micrograph.name)
      );
  const offenders = board.rows.filter((r) => r.bucket === "offender").length;
  const watch = board.rows.filter((r) => r.bucket === "watch").length;
  // the relative bar's scale ignores the empties' +Infinity worse — their
  // tiles paint a full bar (their own absolute law) without flattening
  // everyone else's to zero
  const finiteWorse = board.rows
    .map((r) => r.worse)
    .filter((w) => Number.isFinite(w));
  const maxWorse = Math.max(...(finiteWorse.length > 0 ? finiteWorse : [1]));
  const empties =
    kind === "picking"
      ? board.rows.filter((r) => (r.micrograph as PickQcEntry).count === 0).length
      : 0;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card/50 p-3 print:break-inside-avoid",
        className
      )}
      data-testid="micrograph-qc-board"
      data-qc-kind={kind}
      data-qc-metric={metric}
      data-qc-offenders={offenders}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <LayoutGrid className="size-3 shrink-0 text-teal-600" aria-hidden="true" />
        <span className="text-[11px] font-medium text-foreground/80">
          {kind === "ctf"
            ? "CTF micrograph board"
            : kind === "motion"
              ? "Motion micrograph board"
              : "Picking micrograph board"}
        </span>
        <span className="text-[11px] font-normal text-muted-foreground">
          · {count} micrographs
          {empties > 0 && (
            <>
              {" · "}
              <span className="text-danger">
                {empties} empty
              </span>
            </>
          )}
          {offenders > 0 && (
            <>
              {" · "}
              <span className="text-danger">{offenders} offender{offenders === 1 ? "" : "s"}</span>
              {watch > 0 && <>, <span className="text-amber-700 dark:text-amber-300">{watch} watch</span></>}
            </>
          )}
        </span>
        {offenders === 0 && watch === 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
            <TriangleAlert className="size-2.5" aria-hidden="true" />
            none
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {kind === "ctf" &&
            CTF_METRICS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={metric === m}
                onClick={() => setMetric(m)}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                  metric === m
                    ? "border-running/40 bg-running/10 font-medium text-teal-700 dark:text-teal-300"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {QC_METRIC_LABEL[m]}
              </button>
            ))}
          {kind === "picking" &&
            PICK_METRICS.filter((m) => m === "count" || fomAvailable).map(
              (m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={metric === m}
                  onClick={() => setMetric(m)}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                    metric === m
                      ? "border-running/40 bg-running/10 font-medium text-teal-700 dark:text-teal-300"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  {QC_METRIC_LABEL[m]}
                </button>
              )
            )}
          <button
            type="button"
            aria-pressed={worstFirst}
            onClick={() => setWorstFirst((v) => !v)}
            title={worstFirst ? "Sorted worst-first — click to sort by name" : "Sorted by name — click to sort worst-first"}
            className={cn(
              "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
              worstFirst
                ? "border-running/40 bg-running/10 font-medium text-teal-700 dark:text-teal-300"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {worstFirst ? "Worst first" : "By name"}
          </button>
        </span>
      </div>

      <div
        className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4"
        role="list"
      >
        {rows.map((r) => {
          const m = r.micrograph;
          const isEmpty = kind === "picking" && (m as PickQcEntry).count === 0;
          const barPct = isEmpty
            ? 100
            : maxWorse > 0 && Number.isFinite(r.worse)
              ? Math.min(100, (r.worse / maxWorse) * 100)
              : 0;
          return (
            <div
              key={m.name}
              role="listitem"
              title={
                isEmpty
                  ? `${m.name} — no picks (empty micrograph)`
                  : `${m.name} — ${QC_METRIC_LABEL[metric]} ${fmtQcValue(metric as AnyMetric, r.value)}`
              }
              className={cn(
                "relative overflow-hidden rounded border border-border border-l-2 bg-muted/30 px-2 py-1.5",
                BUCKET_TILE[r.bucket]
              )}
            >
              <p className="truncate text-[10px] font-medium text-foreground/85" aria-hidden="true">
                {shortName(m.name)}
              </p>
              <p className={cn("text-[11px] font-semibold tabular-nums", BUCKET_VALUE[r.bucket])}>
                {fmtQcValue(metric as AnyMetric, r.value)}
              </p>
              {kind === "ctf" ? (
                <p className="truncate text-[9px] tabular-nums text-muted-foreground">
                  def{" "}
                  {(m as { defocusU: number; defocusV: number }).defocusU.toFixed(2)}/
                  {(m as { defocusU: number; defocusV: number }).defocusV.toFixed(2)} µm
                </p>
              ) : kind === "motion" ? (
                <p className="truncate text-[9px] tabular-nums text-muted-foreground">
                  early {(m as { early: number }).early.toFixed(1)} · late{" "}
                  {(m as { late: number }).late.toFixed(1)} Å
                </p>
              ) : isEmpty ? (
                <p className="truncate text-[9px] text-rose-700/80 dark:text-rose-300/80">
                  no picks — empty?
                </p>
              ) : (
                <p className="truncate text-[9px] tabular-nums text-muted-foreground">
                  {metric === "count"
                    ? `FOM ${fmtQcValue("pickFom", (m as PickQcEntry).fom ?? NaN)}`
                    : `${(m as PickQcEntry).count} picks`}
                </p>
              )}
              {/* relative-scale mini bar: the tile's rank in the pack at a
                  squint; emerald baseline keeps healthy tiles calm */}
              <div className="mt-1 h-0.5 w-full rounded-full bg-muted" aria-hidden="true">
                <div
                  className={cn(
                    "h-full rounded-full",
                    r.bucket === "offender"
                      ? "bg-rose-500/80"
                      : r.bucket === "watch"
                        ? "bg-amber-500/80"
                        : "bg-emerald-500/50"
                  )}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/70">
        {qcLegendText(board.thresholds, metric as AnyMetric)}
      </p>
    </div>
  );
}
