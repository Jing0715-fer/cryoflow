"use client";

/**
 * CryoFlow — the Overview tab's class-averages teaser (t544).
 *
 * t539 made the receipt say "1 of 4 classes populated" and split the
 * card labels (class averages vs class maps); this face makes both
 * numbers VISIBLE: K tiles in class order, the populated ones bright,
 * the empty ones dimmed to ghosts — the stack RELION wrote side by side
 * with the particles that actually landed in each class.
 *
 * Two lanes (the classes route speaks both):
 *   - class2d: slices of the combined classes .mrcs stack
 *     (outputs/file?path=<classesFile>&format=png&montage=0&slice=N-1)
 *   - class3d / initialmodel: per-class volumes (run_itNNN_class00K.mrc)
 *     through their central z-plane (axis=z&pos=0.5); the combined-stack
 *     dialect (mock class3d) falls back to the slice lane automatically.
 *
 * Self-hide contract (t491 vocabulary): the mount is type-gated, the
 * section never renders when neither lane answers (nothing to show is
 * not a wound), and a fetch failure renders the shared ChartErrorStrip —
 * a wound must never read as absence either.
 */

import { useMemo } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { ChartErrorStrip } from "./chart-error-strip";
import { MrcImage } from "./mrc-image";
import { useChartResource } from "@/lib/use-chart-resource";

/** the /classes response's occupancy row */
interface ClassOcc {
  cls: number;
  count: number;
  fraction: number;
}

/** the /classes response body — only the fields the teaser reads */
interface ClassesPayload {
  classes: ClassOcc[];
  total: number;
  iteration: number | null;
  /** workdir-relative combined class-averages stack (.mrcs), one slice per class */
  classesFile: string | null;
  /** slices in that stack = the K RELION wrote (populated or not) */
  classesSlices: number | null;
  /** per-class volume files (real class3d/initialmodel dialect), class order */
  volumeFiles: string[] | null;
  renderError?: string;
}

/** how many tiles the teaser shows before the honest "+N more" chip */
const TILE_CAP = 12;

const filePng = (jobId: string, rel: string, params: string) =>
  `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(rel)}&format=png&${params}`;

export function ClassAveragesTeaser({
  jobId,
  running,
  className,
}: {
  jobId: string;
  running?: boolean;
  className?: string;
}) {
  const { status, data, error, retry } = useChartResource<ClassesPayload>(
    `/api/jobs/${jobId}/classes`,
    { pollMs: running ? 20_000 : null }
  );

  const occ = useMemo(() => data?.classes ?? [], [data]);
  const occMap = useMemo(() => {
    const m = new Map<number, ClassOcc>();
    for (const c of occ) m.set(c.cls, c);
    return m;
  }, [occ]);
  const populated = useMemo(() => occ.filter((c) => c.count > 0).length, [occ]);
  const topCls = useMemo(
    () => occ.reduce((best, c) => (c.count > 0 && c.fraction > (best?.fraction ?? -1) ? c : best), null as ClassOcc | null),
    [occ]
  );

  // the volume lane wins only when it has files (real class3d/initialmodel);
  // the combined-stack lane covers class2d AND the mock class3d dialect
  const volumes = data?.volumeFiles ?? [];
  const useVolumes = volumes.length > 0;
  const stackK = data?.classesSlices ?? 0;
  const K = useVolumes ? volumes.length : stackK;
  const isMaps = useVolumes;

  if (status === "wounded") {
    return (
      <ChartErrorStrip
        label="Class averages"
        detail={error ?? undefined}
        onRetry={retry}
        className={className}
      />
    );
  }
  if (status !== "ready" || K <= 0 || (!data?.classesFile && !useVolumes)) return null;

  const shown = Math.min(K, TILE_CAP);
  const tileUrl = (i: number) =>
    useVolumes
      ? filePng(jobId, volumes[i], "axis=z&pos=0.5")
      : data?.classesFile
        ? filePng(jobId, data.classesFile, `montage=0&slice=${i}`)
        : "";

  return (
    <section
      aria-label="Class averages"
      data-class-teaser=""
      className={cn(
        "animate-rise rounded-xl border bg-card p-5 pt-4",
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Layers className="size-4 text-teal-600" aria-hidden="true" />
        <h3 className="text-sm font-semibold">
          {isMaps ? "Class maps" : "Class averages"}
        </h3>
        <Chip
          size="md"
          className={
            populated === K
              ? "border-success/30 bg-success/10 text-emerald-700 dark:text-emerald-300"
              : "border-warning/30 bg-warning/10 text-amber-700 dark:text-amber-300"
          }
          title={
            populated === K
              ? "every class the run wrote carries particles"
              : "RELION wrote this many class slots; only the bright ones have particles"
          }
        >
          {populated} of {K} populated
        </Chip>
        {(data?.total ?? 0) > 0 && data ? (
          <span className="text-[11px] text-muted-foreground">
            {data.total.toLocaleString()} particles
          </span>
        ) : null}
      </div>

      {data?.renderError ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{data.renderError}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: shown }, (_, i) => {
              const cls = occMap.get(i + 1);
              const alive = (cls?.count ?? 0) > 0;
              const isTop = topCls?.cls === i + 1;
              return (
                <figure key={i} className="group/cls relative w-20" data-class-tile="">
                  <MrcImage
                    src={tileUrl(i)}
                    alt={`Class ${i + 1}${alive ? "" : " (empty)"}`}
                    className={cn(
                      "aspect-square transition-opacity",
                      !alive && "opacity-25 grayscale",
                      isTop && "ring-2 ring-emerald-500/70 ring-offset-1 ring-offset-card"
                    )}
                  />
                  <figcaption
                    className={cn(
                      "mt-0.5 text-center font-mono text-[9px] tabular-nums",
                      alive ? "text-muted-foreground" : "text-muted-foreground/50"
                    )}
                  >
                    {alive ? `${cls!.count.toLocaleString()}` : "—"}
                  </figcaption>
                </figure>
              );
            })}
            {K > shown ? (
              <div className="flex w-20 items-center justify-center" aria-hidden="true">
                <span className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                  +{K - shown}
                </span>
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            {populated === K
              ? "every class slot the run wrote carries particles — dim tiles would mean empty classes"
              : "dimmed tiles are classes RELION wrote but no particles settled in — the receipt's two numbers, side by side"}
          </p>
        </>
      )}
    </section>
  );
}
