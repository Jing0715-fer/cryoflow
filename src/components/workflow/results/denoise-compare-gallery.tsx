"use client";

/**
 * CryoFlow — Topaz Denoise before/after compare gallery (t542).
 *
 * Data: /api/jobs/[id]/denoise-pairs pairs every denoised micrograph in the
 * run's denoised_micrographs.star index with its ORIGINAL under the provider
 * job's workdir (the same primary leg the engine's resolveInputs rides —
 * the gallery pairs against exactly the star the run consumed).
 *
 * Two views:
 *   - wipe (default): one square per micrograph; the denoised render sits
 *     underneath, the original is clipped to the left of a draggable
 *     divider — drag right to reveal more original, left to reveal more
 *     denoised. The range input is the real control (keyboard works,
 *     arrow keys scrub), the visible line + grip are its face.
 *   - side-by-side: the honest two-up, labels pinned.
 *
 * Self-hide contract (t491 vocabulary): a non-denoise job or a run without
 * an index answers the route's empty body → the section never renders. A
 * transient fetch failure renders the shared ChartErrorStrip — an absence
 * must never masquerade as a wound, and a wound must never read as absence.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Columns2, Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GALLERY_FOCUS_TTL_MS, useWorkflowStore } from "@/lib/store";
import { ChartErrorStrip } from "./chart-error-strip";
import { MrcImage } from "./mrc-image";
import { useChartResource } from "@/lib/use-chart-resource";

/** the denoise-pairs route's body — declared here (the house rule: the
 *  component owns its fetch shape; the route owns the parsing) */
interface DenoisePair {
  name: string;
  denoised: string | null;
  original: string | null;
  originalJobId: string | null;
}

interface DenoisePairsResponse {
  jobId: string;
  jobType: string;
  total: number;
  paired: number;
  provider: { id: string; name: string } | null;
  pairs: DenoisePair[];
}

const PAGE = 9;

const pngUrl = (jobId: string, rel: string) =>
  `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(rel)}&format=png`;

/** one micrograph's wipe card — the denoised render with the original
 *  clipped over it, one divider, two fading labels */
function WipeCard({
  denoisedSrc,
  originalSrc,
  alt,
}: {
  denoisedSrc: string;
  originalSrc: string;
  alt: string;
}) {
  // 0..100 — the percentage of WIDTH that shows the ORIGINAL (left side)
  const [pos, setPos] = useState(50);
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-border bg-zinc-950">
      {/* base: the denoised render fills the square */}
      <MrcImage src={denoisedSrc} alt={`${alt} (denoised)`} className="absolute inset-0 h-full rounded-none border-0" />
      {/* clipped overlay: the original, left of the divider */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <MrcImage src={originalSrc} alt={`${alt} (original)`} className="absolute inset-0 h-full rounded-none border-0" />
      </div>
      {/* divider line + grip — the range input's face. The grip carries a
          fuchsia halo while the card's invisible range control owns focus:
          the keyboard user must see WHICH divider the arrows are scrubbing. */}
      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.45)]"
        style={{ left: `${pos}%` }}
        aria-hidden="true"
      >
        <span className="absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-zinc-950/70 backdrop-blur-sm transition-shadow group-focus-within:shadow-[0_0_0_3px_rgba(232,121,249,0.4)]">
          <Wand2 className="h-2.5 w-2.5 text-white" aria-hidden="true" />
        </span>
      </div>
      {/* labels fade toward the side they name */}
      <span
        className="pointer-events-none absolute left-1.5 top-1.5 rounded-sm bg-zinc-950/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-200 backdrop-blur-sm transition-opacity"
        style={{ opacity: pos <= 8 ? 0.25 : 1 }}
      >
        original
      </span>
      <span
        className="pointer-events-none absolute right-1.5 top-1.5 rounded-sm bg-fuchsia-950/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-fuchsia-200 backdrop-blur-sm transition-opacity"
        style={{ opacity: pos >= 92 ? 0.25 : 1 }}
      >
        denoised
      </span>
      {/* the real control: a transparent range input riding the whole card.
          The drag handle is the div above — this input is what keeps the
          wipe keyboard-accessible (focus ring + arrows scrub). */}
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pos}
        aria-label={`Wipe original / denoised for ${alt}`}
        aria-valuetext={`${pos}% original · ${100 - pos}% denoised`}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent opacity-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-fuchsia-400"
      />
    </div>
  );
}

export function DenoiseCompareGallery({
  jobId,
  running,
  className,
}: {
  jobId: string;
  running?: boolean;
  className?: string;
}) {
  const { status, data, error, retry } = useChartResource<DenoisePairsResponse>(
    `/api/jobs/${jobId}/denoise-pairs`,
    { pollMs: running ? 20_000 : null }
  );
  const [mode, setMode] = useState<"wipe" | "side">("wipe");
  const [shown, setShown] = useState(PAGE);

  const pairs = useMemo(() => data?.pairs ?? [], [data]);
  const paired = data?.paired ?? 0;

  // t665 — the deep link's CONSUMER gate (the inspector only cleared the
  // way to the results tab): fresh request + wall on screen → the section
  // scrolls into view and flashes its own fuchsia ring — the link promised
  // the before/after wall, so the wall itself answers, not just the tab
  // that contains it below the fold. The waiting law (t659 verbatim):
  // while the fetch is still loading the request WAITS; a stale request is
  // cleared on sight (the self-hide contract means this component may
  // never render — the flash would have nothing to land on); an empty or
  // wounded wall is cleared honestly. One-shot either way.
  const rootRef = useRef<HTMLElement | null>(null);
  const [flash, setFlash] = useState(false);
  const pendingDenoiseFocus = useWorkflowStore((s) => s.pendingDenoiseFocus);
  const consumeDenoiseFocus = useWorkflowStore((s) => s.consumeDenoiseFocus);
  useEffect(() => {
    if (!pendingDenoiseFocus || pendingDenoiseFocus.jobId !== jobId) return;
    if (Date.now() - pendingDenoiseFocus.at >= GALLERY_FOCUS_TTL_MS) {
      consumeDenoiseFocus();
      return;
    }
    // still loading — the effect re-runs when data or error arrives
    if (data == null && !error) return;
    if (data && data.pairs.length > 0) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      rootRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      // the flash rides a paint-aligned callback, not the effect body (the
      // set-state-in-effect law): the ring is a transient cue acknowledging
      // the link's arrival, and its teardown must not live in THIS effect's
      // cleanup — the consume() above flips the pending to null, the effect
      // re-runs, and React runs the previous cleanup — a cleanup-cleared
      // timer would kill its own flash-off and the ring would never fade
      // (the t665 first-flight lesson).
      requestAnimationFrame(() => {
        setFlash(true);
        setTimeout(() => setFlash(false), 1800);
      });
      consumeDenoiseFocus();
      return;
    }
    consumeDenoiseFocus();
  }, [pendingDenoiseFocus, jobId, data, error, consumeDenoiseFocus]);

  if (status === "wounded") {
    return (
      <ChartErrorStrip
        label="Denoise compare"
        detail={error ?? undefined}
        onRetry={retry}
        className={className}
      />
    );
  }
  if (status !== "ready" || pairs.length === 0) return null;

  const allPaired = paired === pairs.length && data?.provider != null;

  return (
    <section
      ref={rootRef}
      aria-label="Denoise compare"
      data-denoise-gallery=""
      data-denoise-flash={flash ? "on" : undefined}
      className={cn(
        "animate-rise rounded-lg border border-fuchsia-600/25 bg-gradient-to-b from-fuchsia-600/5 to-transparent p-3 transition-shadow duration-500",
        flash && "ring-2 ring-fuchsia-500/70",
        className
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-600" aria-hidden="true" />
          Denoise compare
          <span className="font-normal text-muted-foreground/70">({data?.total} micrographs)</span>
        </span>
        {data?.provider && (
          <span
            className="inline-flex max-w-48 items-center gap-1 truncate rounded-full border border-teal-600/30 bg-teal-600/10 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300"
            title={`originals served by ${data.provider.name}`}
          >
            originals: {data.provider.name}
          </span>
        )}
        {allPaired ? (
          <span className="rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            {paired}/{pairs.length} paired
          </span>
        ) : (
          <span
            className="rounded-full border border-amber-600/30 bg-amber-600/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
            title="no readable input star — the run consumed it before this view existed, or the provider's outputs left this machine"
          >
            denoised only
          </span>
        )}
        <div className="ml-auto inline-flex overflow-hidden rounded-full border border-fuchsia-600/30">
          {([
            ["wipe", "wipe"],
            ["side", "side-by-side"],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={
                "inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold transition-colors " +
                (mode === m
                  ? "bg-fuchsia-600 text-white"
                  : "bg-transparent text-muted-foreground hover:bg-fuchsia-600/10 hover:text-fuchsia-700 dark:hover:text-fuchsia-300")
              }
            >
              {m === "wipe" ? (
                <Wand2 className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Columns2 className="h-3 w-3" aria-hidden="true" />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pairs.slice(0, shown).map((p) => (
          <figure key={p.name} data-denoise-card="" className="space-y-1">
            {p.denoised && p.original ? (
              mode === "wipe" ? (
                <WipeCard
                  denoisedSrc={pngUrl(jobId, p.denoised)}
                  originalSrc={pngUrl(p.originalJobId ?? jobId, p.original)}
                  alt={p.name}
                />
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="space-y-0.5">
                    <MrcImage
                      src={pngUrl(p.originalJobId ?? jobId, p.original)}
                      alt={`${p.name} (original)`}
                      className="aspect-square"
                    />
                    <figcaption className="text-center font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                      original
                    </figcaption>
                  </div>
                  <div className="space-y-0.5">
                    <MrcImage
                      src={pngUrl(jobId, p.denoised)}
                      alt={`${p.name} (denoised)`}
                      className="aspect-square"
                    />
                    <figcaption className="text-center font-mono text-[9px] uppercase tracking-wider text-fuchsia-600/80">
                      denoised
                    </figcaption>
                  </div>
                </div>
              )
            ) : (
              /* unpaired — an absence must never masquerade as a presence:
                 no original means NO original-labeled half and NO divider
                 (a wipe over one image is a lie); the tile speaks alone
                 under the amber badge the header chip already taught. */
              <div className="relative">
                <MrcImage
                  src={pngUrl(jobId, p.denoised ?? p.original ?? "")}
                  alt={`${p.name} (denoised, unpaired)`}
                  className="aspect-square"
                />
                <span
                  className="pointer-events-none absolute left-1.5 top-1.5 rounded-sm bg-amber-950/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-200 backdrop-blur-sm"
                  title="no readable input star — the run consumed it before this view existed, or the provider's outputs left this machine"
                >
                  no original
                </span>
              </div>
            )}
            <figcaption
              className="truncate text-center font-mono text-[10px] text-muted-foreground"
              title={p.name}
            >
              {p.name}
            </figcaption>
          </figure>
        ))}
      </div>

      {pairs.length > shown && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setShown((s) => s + PAGE * 2)}
            className="rounded-full border border-fuchsia-600/30 bg-fuchsia-600/5 px-3 py-1 text-[11px] font-semibold text-fuchsia-700 transition-colors hover:bg-fuchsia-600/15 dark:text-fuchsia-300"
          >
            show more ({pairs.length - shown} remaining)
          </button>
          <span className="text-[10px] text-muted-foreground/60">
            remote runs pull each tile over SSH on first view
          </span>
        </div>
      )}
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
        drag the divider (or focus a card and use the arrow keys) to wipe between the raw
        micrograph and its denoised render — real Topaz denoising removes detector noise the
        picker trains better without.
      </p>
    </section>
  );
}
