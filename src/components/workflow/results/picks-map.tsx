"use client";

/**
 * CryoFlow — picked-particle overlay map for ManualPick AND Auto-pick jobs.
 *
 * Renders each picked micrograph with its particle coordinates drawn on
 * top. Two worlds answer:
 *   manualpick — teal crosshair markers (coordinates only), Henderson-style;
 *   autopick (t427) — a QA instrument: marker colour encodes the pick's
 *   figure-of-merit (amber low → teal high) and a threshold slider scrubs
 *   the kept set, so "are the picks where the particles are, and how good
 *   are they?" is one glance. The mic image may live upstream — the route
 *   resolves its owner job and the PNG renders through that job's door.
 * Click through for the full-size overlay.
 *
 * Data: /api/jobs/[id]/picks (manualpick.star, or RELION 5's per-micrograph
 * autopick coordinate stars grouped per micrograph).
 */

import { useMemo, useState } from "react";
import { Crosshair, MousePointerClick, ScanEye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  onEscapeClose,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useChartResource } from "@/lib/use-chart-resource";
import { cn } from "@/lib/utils";
import { ChartErrorStrip } from "./chart-error-strip";
import { MrcImage } from "./mrc-image";

interface PickEntry {
  micPath: string;
  name: string;
  count: number;
  picks: [number, number][];
  /** t427 — per-pick autopick figure-of-merit, aligned with `picks` */
  foms?: (number | null)[];
  /** t427 — the job whose workdir holds the micrograph IMAGE */
  ownerJobId?: string;
}

interface PicksResponse {
  jobId: string;
  source: "manualpick" | "autopick";
  total: number;
  imageWidth: number;
  imageHeight: number;
  micrographs: PickEntry[];
}

/** teal crosshair markers for the lightbox (readable at full size) */
function LargeOverlay({ entry, w, h }: { entry: PickEntry; w: number; h: number }) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {entry.picks.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${h - y})`}>
          <circle r={16} fill="#14b8a6" fillOpacity={0.22} stroke="#ccfbf1" strokeWidth={2.5} />
          <circle r={2.4} fill="#f0fdfa" />
        </g>
      ))}
    </svg>
  );
}

/**
 * t427 — FOM colormap: amber (low) → teal (high), zinc for FOM-less
 * picks. The ramp answers "which picks does the threshold keep" at a
 * glance — scrub the slider and watch the amber junk evaporate.
 */
function fomColor(fom: number | null, lo: number, hi: number): string {
  if (fom == null) return "#a1a1aa";
  if (hi <= lo) return "#14b8a6";
  const t = Math.min(1, Math.max(0, (fom - lo) / (hi - lo)));
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  // #f59e0b (245,158,11) → #14b8a6 (20,184,166)
  return `rgb(${lerp(245, 20)}, ${lerp(158, 184)}, ${lerp(11, 166)})`;
}

/** FOM-filtered colored markers — the QA overlay (thumbnails + lightbox). */
function FomOverlay({
  entry,
  w,
  h,
  lo,
  hi,
  cutoff,
  large,
}: {
  entry: PickEntry;
  w: number;
  h: number;
  lo: number;
  hi: number;
  cutoff: number;
  large?: boolean;
}) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {entry.picks.map(([x, y], i) => {
        const fom = entry.foms?.[i] ?? null;
        if (fom != null && fom < cutoff) return null;
        const color = fomColor(fom, lo, hi);
        return large ? (
          <g key={i} transform={`translate(${x} ${h - y})`}>
            <circle r={16} fill={color} fillOpacity={0.24} stroke={color} strokeOpacity={0.9} strokeWidth={2.5} />
            <circle r={2.4} fill="#f0fdfa" />
          </g>
        ) : (
          <circle key={i} cx={x} cy={h - y} r={13} fill={color} fillOpacity={0.55} />
        );
      })}
    </svg>
  );
}

/** compact dots for the thumbnail grid */
function ThumbOverlay({ entry, w, h }: { entry: PickEntry; w: number; h: number }) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {entry.picks.map(([x, y], i) => (
        <circle key={i} cx={x} cy={h - y} r={13} fill="#14b8a6" fillOpacity={0.55} />
      ))}
    </svg>
  );
}

export function PicksMap({
  jobId,
  className,
}: {
  jobId: string;
  className?: string;
}) {
  const [selected, setSelected] = useState<PickEntry | null>(null);
  /** t427 — the FOM threshold (autopick QA): picks below it hide. Starts
   *  at the dataset minimum (everything shown); the slider scrubs it. */
  const [fomMin, setFomMin] = useState<number>(0);

  // t492 — the fetch belongs to the well: wounded gets the amber strip
  // with a Retry chip (this map is an enhancement, but a wound is not
  // an absence — the old code caught the error into a state it never
  // rendered, so a dev-lane blip read as "this job picked nothing");
  // empty (job gone, 404) stays honestly silent, as before.
  const { status, data, error, retry } = useChartResource<PicksResponse>(
    `/api/jobs/${jobId}/picks`
  );

  // the threshold starts open: the dataset's lowest FOM keeps every
  // pick visible until the user asks the QA question. Re-derived when
  // `data` itself changes, during render (React's "adjusting state
  // when a prop changes" pattern — the effect-body setState the old
  // code needed was a cascading render the lint rightly flagged;
  // t492). The slider's own edits survive because `data` is stable
  // between fetches.
  const [seenData, setSeenData] = useState<PicksResponse | null>(null);
  if (data !== seenData) {
    setSeenData(data);
    if (data) {
      let lo = Infinity;
      for (const m of data.micrographs) {
        for (const f of m.foms ?? []) {
          if (f != null && f < lo) lo = f;
        }
      }
      setFomMin(Number.isFinite(lo) ? lo : 0);
    }
  }

  // t427 — FOM spread for the colormap + slider bounds (nulls excluded)
  const fomRange = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const m of data?.micrographs ?? []) {
      for (const f of m.foms ?? []) {
        if (f == null) continue;
        if (f < lo) lo = f;
        if (f > hi) hi = f;
      }
    }
    return Number.isFinite(lo) && hi > lo ? { lo, hi } : null;
  }, [data]);

  if (status === "wounded") {
    return (
      <ChartErrorStrip
        label="Picked particles map"
        detail={error ?? undefined}
        onRetry={retry}
        className={className}
      />
    );
  }
  if (status === "empty") return null; // job gone — honest absence, as before
  if (!data || data.micrographs.length === 0 || data.imageWidth === 0) return null;

  // t427 — the mic image may live in an upstream job's workdir; the entry
  // names its owner and the PNG renders through THAT job's file route
  const fileUrl = (entry: PickEntry, extra = "") =>
    `/api/jobs/${entry.ownerJobId ?? jobId}/outputs/file?path=${encodeURIComponent(entry.micPath)}&format=png${extra}`;
  const perMic = Math.round(data.total / data.micrographs.length);
  const w = data.imageWidth;
  const h = data.imageHeight;
  const fomMode = data.source === "autopick" && fomRange != null;
  const cutoff = fomMode ? fomMin : Number.NEGATIVE_INFINITY;
  const shownTotal = fomMode
    ? data.micrographs.reduce(
        (n, m) => n + m.picks.filter((_, i) => (m.foms?.[i] ?? null) == null || (m.foms![i] as number) >= cutoff).length,
        0
      )
    : data.total;

  return (
    <section
      aria-label="Picked particles map"
      className={cn(
        "rounded-lg border border-teal-600/25 bg-gradient-to-b from-teal-600/5 to-transparent p-3",
        className
      )}
    >
      {/* header */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Crosshair className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
          {fomMode ? "Pick QA — autopick FOM map" : "Picked particles"}
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
          <MousePointerClick className="h-3 w-3" aria-hidden="true" />
          {fomMode
            ? `${shownTotal.toLocaleString()} / ${data.total.toLocaleString()} picks ≥ threshold`
            : `${data.total.toLocaleString()} picks`}
        </span>
        <span className="rounded bg-muted/60 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
          ~{perMic}/micrograph
        </span>
      </div>

      {/* t427 — the FOM threshold scrubber: the autopick QA instrument */}
      {fomMode && (
        <div className="mb-2 flex items-center gap-3 rounded-md border border-teal-600/20 bg-background/60 px-3 py-2">
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ScanEye className="h-3 w-3 text-teal-600" aria-hidden="true" />
            FOM ≥
          </span>
          <Slider
            value={[fomMin]}
            min={fomRange!.lo}
            max={fomRange!.hi}
            step={(fomRange!.hi - fomRange!.lo) / 200}
            onValueChange={(v: number[]) => setFomMin(v[0] ?? fomMin)}
            aria-label="Picking quality threshold (figure of merit)"
            className="w-40 sm:w-56"
          />
          <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-teal-700 dark:text-teal-300">
            {fomMin.toFixed(3)}
          </span>
          <span
            className="hidden h-2 w-24 rounded-full sm:inline-block"
            style={{ background: "linear-gradient(90deg, rgb(245,158,11), rgb(20,184,166))" }}
            aria-hidden="true"
          />
          <span className="hidden font-mono text-[9px] text-muted-foreground/70 sm:inline">
            {fomRange!.lo.toFixed(3)} … {fomRange!.hi.toFixed(3)}
          </span>
        </div>
      )}

      {/* thumbnail grid with overlays */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
        {data.micrographs.map((m) => (
          <button
            key={`${m.ownerJobId ?? jobId}:${m.micPath}`}
            type="button"
            onClick={() => setSelected(m)}
            className="group relative overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={`${m.name} — ${m.count} picks — click for full-size overlay`}
          >
            <MrcImage src={fileUrl(m)} alt={`Picks overlay on ${m.name}`} className="aspect-square" />
            {fomMode ? (
              <FomOverlay entry={m} w={w} h={h} lo={fomRange!.lo} hi={fomRange!.hi} cutoff={cutoff} />
            ) : (
              <ThumbOverlay entry={m} w={w} h={h} />
            )}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-zinc-950/85 to-transparent px-1 pb-0.5 pt-2 text-[8.5px] font-medium tabular-nums text-zinc-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {fomMode
                ? `${m.picks.filter((_, i) => (m.foms?.[i] ?? null) == null || (m.foms![i] as number) >= cutoff).length}/${m.count} picks`
                : `${m.count} picks`}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-1.5 text-[10px] text-muted-foreground">
        {fomMode
          ? "Autopick QA · marker colour = figure-of-merit (amber low → teal high) · drag the threshold until junk appears, then set the real picking threshold just above it"
          : "Henderson reference picks · teal markers are particle coordinates · click a micrograph for the full-size overlay"}
      </p>

      {/* lightbox */}
      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent
          className="max-w-2xl sm:max-w-2xl"
          onKeyDown={onEscapeClose(() => setSelected(null))}
        >
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate font-mono text-sm">{selected.name}</DialogTitle>
                <DialogDescription className="tabular-nums">
                  {fomMode
                    ? `${selected.picks.filter((_, i) => (selected.foms?.[i] ?? null) == null || (selected.foms![i] as number) >= cutoff).length.toLocaleString()} / ${selected.count.toLocaleString()} picks ≥ ${fomMin.toFixed(3)} · ${w}×${h} px`
                    : `${selected.count.toLocaleString()} picks · ${w}×${h} px`}
                </DialogDescription>
              </DialogHeader>
              <div className="relative max-h-[70vh]">
                <MrcImage
                  src={fileUrl(selected, "&scale=large")}
                  alt={`Full-size picks overlay on ${selected.name}`}
                  className="max-h-[70vh]"
                />
                {fomMode ? (
                  <FomOverlay
                    entry={selected}
                    w={w}
                    h={h}
                    lo={fomRange!.lo}
                    hi={fomRange!.hi}
                    cutoff={cutoff}
                    large
                  />
                ) : (
                  <LargeOverlay entry={selected} w={w} h={h} />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
