"use client";

/**
 * CryoFlow — picked-particle overlay map for ManualPick jobs.
 *
 * Renders each picked micrograph with its particle coordinates drawn on
 * top (teal markers, Y-flipped — RELION .coord files are origin
 * bottom-left, MRC rendering is top-down). The grid answers the first
 * question of every picking session: "are the picks where the particles
 * are?" Click through for the full-size overlay.
 *
 * Data: /api/jobs/[id]/picks (manualpick.star grouped per micrograph).
 */

import { useEffect, useState } from "react";
import { Crosshair, MousePointerClick } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MrcImage } from "./mrc-image";

interface PickEntry {
  micPath: string;
  name: string;
  count: number;
  picks: [number, number][];
}

interface PicksResponse {
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
  const [data, setData] = useState<PicksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PickEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/picks`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as PicksResponse;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (error && !data) return null; // enhancement — silent when unavailable
  if (!data || data.micrographs.length === 0 || data.imageWidth === 0) return null;

  const fileUrl = (relPath: string, extra = "") =>
    `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(relPath)}&format=png${extra}`;
  const perMic = Math.round(data.total / data.micrographs.length);
  const w = data.imageWidth;
  const h = data.imageHeight;

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
          Picked particles
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
          <MousePointerClick className="h-3 w-3" aria-hidden="true" />
          {data.total.toLocaleString()} picks
        </span>
        <span className="rounded bg-muted/60 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
          ~{perMic}/micrograph
        </span>
      </div>

      {/* thumbnail grid with overlays */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
        {data.micrographs.map((m) => (
          <button
            key={m.micPath}
            type="button"
            onClick={() => setSelected(m)}
            className="group relative overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={`${m.name} — ${m.count} picks — click for full-size overlay`}
          >
            <MrcImage src={fileUrl(m.micPath)} alt={`Picks overlay on ${m.name}`} className="aspect-square" />
            <ThumbOverlay entry={m} w={w} h={h} />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-zinc-950/85 to-transparent px-1 pb-0.5 pt-2 text-[8.5px] font-medium tabular-nums text-zinc-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {m.count} picks
            </span>
          </button>
        ))}
      </div>

      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Henderson reference picks · teal markers are particle coordinates · click a
        micrograph for the full-size overlay
      </p>

      {/* lightbox */}
      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate font-mono text-sm">{selected.name}</DialogTitle>
                <DialogDescription className="tabular-nums">
                  {selected.count.toLocaleString()} picks · {w}×{h} px
                </DialogDescription>
              </DialogHeader>
              <div className="relative max-h-[70vh]">
                <MrcImage
                  src={fileUrl(selected.micPath, "&scale=large")}
                  alt={`Full-size picks overlay on ${selected.name}`}
                  className="max-h-[70vh]"
                />
                <LargeOverlay entry={selected} w={w} h={h} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
