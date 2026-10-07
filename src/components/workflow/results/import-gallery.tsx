"use client";

/**
 * CryoFlow — source micrograph gallery for Import jobs.
 *
 * The import workdir links the raw detector frames; this gallery renders a
 * lazy thumbnail grid through outputs/file (PNG, 2–98% contrast stretch) with
 * a lightbox for the full view — the "look at your data before anything
 * else" step every cryo-EM course teaches.
 *
 * Data: /api/jobs/[id]/micrographs (micrographs.star + optics group).
 *
 * t322 — the cluster sample is DETERMINISTIC per job (the route seeds on
 * job id + a reroll counter) and this component PERSISTS the reroll per
 * job in localStorage: reopening the inspector shows the same five
 * thumbnails, served from the app's PNG cache and the browser's own
 * cache — no re-roll, no re-pull. The re-sample button advances the
 * counter (and remembers it) — a new deterministic five, still stable
 * until the next press.
 *
 * t654 — the gallery learns the two gestures a working scientist asks
 * for next:
 *   1. the lightbox navigates — ←/→ walk the micrographs (wrapping),
 *      the header says "3 of 5", Esc still closes. Browsing five frames
 *      is five clicks no more.
 *   2. compare mode — the header toggle turns clicks into picks (a
 *      ringed, numbered tray, kept in PICK ORDER); with two or more
 *      picks the Compare button opens a side-by-side dialog. Selection
 *      lives in state, not in the network: picks are cleared when the
 *      sample changes (re-sample) or the mode exits — a tray pointing
 *      at thumbnails that are no longer on the wall would be a lie.
 *
 * t657 — the compare dialog learns what it is comparing: each pane
 * carries a measured stats row (dims from the MRC header, bytes per
 * pixel from size ÷ nx·ny) under the identity row. The demo world
 * backs this with real physics — the seeder hard-links the ten real
 * EMPIAR frames into the import workdir — so the numbers are counted,
 * never invented, and honestly absent when a frame's header is unknown.
 */

import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Aperture, Columns3, Grid3x3, ImageIcon, RefreshCw, Server } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  onEscapeClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { MrcImage } from "./mrc-image";

interface MicrographEntry {
  path: string;
  name: string;
  size: number;
  nx: number;
  ny: number;
}

interface ClusterInfo {
  host: string;
  connectionName: string;
  total: number;
  sample: Array<{
    path: string;
    name: string;
    size: number;
    nx: number;
    ny: number;
    kind: string;
  }>;
}

interface MicrographsResponse {
  total: number;
  pixelSize: number | null;
  voltage: number | null;
  sphericalAberration: number | null;
  amplitudeContrast: number | null;
  micrographs: MicrographEntry[];
  /** t315 — the star's rows are cluster-absolute (remote project import):
   *  micrographs[] holds a random sample of five, its thumbnails arrive
   *  through the SSH preview door. */
  cluster?: ClusterInfo;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** t657 — measured bytes per pixel (size ÷ nx·ny): the per-frame storage
 *  density the compare panes can line up side by side. It is a MEASUREMENT,
 *  not a guess about the MRC mode — 4.0 B/px is what float32 looks like,
 *  but the chip reports what it counted, the header knows the mode. */
function formatBytesPerPixel(m: MicrographEntry): string | null {
  const px = m.nx * m.ny;
  if (!(m.nx > 0) || !(m.ny > 0) || !(m.size > 0) || px <= 0) return null;
  return `${(m.size / px).toFixed(1)} B/px`;
}

function StatChip({ label, value }: { label: string; value: string | null }) {
  if (value == null) return null;
  // t645 — renamed from the colliding local "Chip" and rebased on the
  // primitive: stamp skeleton, muted/40 wash kept as a site delta.
  return (
    <Chip size="stamp" className="bg-muted/40">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground/80">{value}</span>
    </Chip>
  );
}

/** localStorage key for this job's sample generation (t322). */
const rerollKey = (jobId: string) => `cryoflow:import-sample:${jobId}`;

/** t654 — the lightbox's combined key handler: ←/→ walk (the wrap is
 * pure arithmetic on the index), everything else falls through to the
 * dialog's own Escape law. The state updater stays PURE (t653's law:
 * computation in the updater, side effects in the event handler — here
 * there is nothing but arithmetic, so the updater IS the handler). */
function lightboxKeydown(
  e: ReactKeyboardEvent,
  count: number,
  step: (dir: 1 | -1) => void,
  close: () => void
) {
  if (count === 0) return;
  if (e.key === "ArrowRight") {
    e.preventDefault();
    step(1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    step(-1);
  } else {
    onEscapeClose(close)(e as React.KeyboardEvent<HTMLDivElement>);
  }
}

export function ImportGallery({
  jobId,
  className,
}: {
  jobId: string;
  className?: string;
}) {
  const [data, setData] = useState<MicrographsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // t654 — the lightbox rides an INDEX (not the entry object): ←/→ are
  // index arithmetic, and the header's "i of n" falls out of it.
  const [selected, setSelected] = useState<number | null>(null);
  // t654 — compare mode: the toggle turns clicks into picks. The tray is
  // an ORDERED array of paths (pick order is compare order), and it is
  // cleared whenever the wall it points at changes (re-sample, mode
  // exit) — honesty about what the tray references.
  const [compareMode, setCompareMode] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  // t322 — the reroll counter survives remounts per job: the initializer
  // reads it client-side (guarded for SSR), the re-sample button advances
  // AND persists it. The sample therefore stays THE SAME FIVE across
  // inspector reopens — which is exactly what makes the preview caches
  // (server PNG + browser) finally engage.
  const [reroll, setReroll] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      const v = Number.parseInt(window.localStorage.getItem(rerollKey(jobId)) ?? "0", 10);
      return Number.isFinite(v) && v > 0 ? Math.min(v, 9_999) : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/jobs/${jobId}/micrographs${reroll > 0 ? `?reroll=${reroll}` : ""}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as MicrographsResponse;
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
  }, [jobId, reroll]);

  /** advance + persist the sample generation (the re-sample button).
   * t654 — the wall changes, so the tray is emptied: picks that point
   * at thumbnails no longer on the wall would be a lie. */
  const resample = () => {
    setSelected(null);
    setPicks([]);
    setCompareMode(false);
    setReroll((n) => {
      const next = Math.min(n + 1, 9_999);
      try {
        window.localStorage.setItem(rerollKey(jobId), String(next));
      } catch {
        /* private mode etc. — the counter still advances for this visit */
      }
      return next;
    });
  };

  if (error && !data) return null; // enhancement — silent when unavailable
  if (!data || data.micrographs.length === 0) return null;

  const isCluster = data.cluster != null;
  const micrographs = data.micrographs;
  /** t654 — wrap-around walk for the lightbox (pure arithmetic). */
  const step = (dir: 1 | -1) =>
    setSelected((s) => (s == null ? s : (s + dir + micrographs.length) % micrographs.length));
  /** t654 — toggle a pick, PRESERVING pick order (the tray is an
   * ordered array, not a Set: compare order = the order you picked). */
  const togglePick = (path: string) =>
    setPicks((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  /** leaving compare mode empties the tray — a stale tray behind a
   * closed mode is invisible debt. */
  const exitCompare = () => {
    setCompareMode(false);
    setPicks([]);
  };
  const pickedEntries = picks
    .map((p) => micrographs.find((m) => m.path === p))
    .filter((m): m is MicrographEntry => m != null);
  // cluster rows (cluster-absolute paths) preview through the SSH door —
  // local rows through the outputs/file door as always
  const fileUrl = (relPath: string, extra = "") =>
    isCluster
      ? `/api/jobs/${jobId}/micrographs?preview=${encodeURIComponent(relPath)}${extra ? "&full=1" : ""}`
      : `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(relPath)}&format=png${extra}`;

  const withDims = data.micrographs.filter((m) => m.nx > 0);
  const dims =
    withDims.length > 0
      ? `${withDims[0].nx}×${withDims[0].ny} px`
      : null;

  return (
    <section
      aria-label="Source micrographs"
      className={cn(
        "rounded-lg border border-running/25 bg-gradient-to-b from-running-600/5 to-transparent p-3",
        className
      )}
    >
      {/* header */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Aperture className="h-3.5 w-3.5 text-running-600" aria-hidden="true" />
          Source micrographs
        </span>
        <Chip size="sm" tone="muted">
          <Grid3x3 aria-hidden="true" />
          {data.total}
        </Chip>
        {isCluster && data.cluster ? (
          <Chip
            size="sm"
            className="rounded border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
            title={`${data.cluster.connectionName} — the files stay there (zero upload); thumbnails travel over SSH`}
          >
            <Server aria-hidden="true" />
            on {data.cluster.host} · sample of {data.micrographs.length}
          </Chip>
        ) : null}
        {isCluster ? (
          <button
            type="button"
            onClick={resample}
            className="inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Sample five different micrographs"
            title="Pick five different micrographs (a new stable selection — it persists until you press again)"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            re-sample
          </button>
        ) : null}
        {/* t654 — the compare toggle: clicks become picks. The mode is
         * visible on the button (aria-pressed + the active face), the
         * picks are visible on the wall (ring + tray number), and the
         * tray itself is visible as an ordered chip row. */}
        <button
          type="button"
          onClick={() => (compareMode ? exitCompare() : setCompareMode(true))}
          aria-pressed={compareMode}
          data-gallery-ui="compare-toggle"
          className={cn(
            "inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-medium transition-colors",
            compareMode
              ? "border-running-600/40 bg-running-600/10 text-running-700 dark:text-running-300"
              : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
          title="Compare mode — click thumbnails to add them to a side-by-side tray"
        >
          <Columns3 className="h-3 w-3" aria-hidden="true" />
          compare
        </button>
        {compareMode ? (
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            disabled={pickedEntries.length < 2}
            data-gallery-ui="compare-open"
            className="inline-flex items-center gap-1 rounded border border-running-600/40 bg-running-600/10 px-1.5 py-px text-[10px] font-semibold text-running-700 transition-colors hover:bg-running-600/20 dark:text-running-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-running-600/10"
            title={
              pickedEntries.length < 2
                ? "Pick at least two thumbnails to compare"
                : "Open the side-by-side comparison"
            }
          >
            Compare {pickedEntries.length}
          </button>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-1">
          <StatChip label="pixel" value={data.pixelSize != null ? `${data.pixelSize} Å` : null} />
          <StatChip label="HT" value={data.voltage != null ? `${data.voltage} kV` : null} />
          <StatChip label="Cs" value={data.sphericalAberration != null ? `${data.sphericalAberration} mm` : null} />
          <StatChip label="Q0" value={data.amplitudeContrast != null ? `${data.amplitudeContrast}` : null} />
        </div>
      </div>

      {/* thumbnail grid */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
        {micrographs.map((m, i) => {
          const pickNo = picks.indexOf(m.path); // -1 unpicked, else 1-based tray order
          const picked = pickNo >= 0;
          return (
            <button
              key={m.path}
              type="button"
              data-gallery-ui="thumb"
              data-picked={picked ? String(pickNo + 1) : undefined}
              aria-pressed={compareMode ? picked : undefined}
              onClick={() => (compareMode ? togglePick(m.path) : setSelected(i))}
              className={cn(
                "group relative overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
                picked && "ring-2 ring-running-600 ring-offset-1 ring-offset-card"
              )}
              title={
                compareMode
                  ? `${picked ? "Remove from" : "Add to"} the comparison tray — ${m.name}`
                  : `${m.name} — ${m.nx}×${m.ny} px · ${formatBytes(m.size)} — click to enlarge`
              }
            >
              <MrcImage src={fileUrl(m.path)} alt={`Micrograph ${m.name}`} className="aspect-square" />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-zinc-950/85 to-transparent px-1 pb-0.5 pt-2 text-[8.5px] font-medium text-zinc-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {m.name}
              </span>
              {picked ? (
                <span className="pointer-events-none absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-sm bg-running-600 font-semibold text-white">
                  {pickNo + 1}
                </span>
              ) : (
                <span className="pointer-events-none absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-sm bg-zinc-950/70 text-zinc-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <ImageIcon className="size-2.5" aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {dims ? (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {dims} detector frames ·{" "}
          {isCluster
            ? `all ${data.total} micrographs live on ${data.cluster?.host} — five sampled (stable per job), thumbnails compressed on the cluster and cached locally`
            : "click a thumbnail for the full contrast-stretched view"}
        </p>
      ) : isCluster ? (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          all {data.total} micrographs live on {data.cluster?.host} — five sampled (stable per job), thumbnails compressed on the cluster and cached locally
        </p>
      ) : null}

      {/* lightbox — t654: rides the index, walks with ←/→ (wrap), says
          "i of n" so the walk has a place in the world */}
      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent
          className="max-w-2xl sm:max-w-2xl"
          data-gallery-ui="lightbox"
          onKeyDown={(e) =>
            lightboxKeydown(e, micrographs.length, step, () => setSelected(null))
          }
        >
          {selected != null && micrographs[selected] ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-mono text-sm">
                  <span className="truncate">{micrographs[selected].name}</span>
                  <Chip size="stamp" className="shrink-0 border-running-600/40 bg-running-600/10 font-sans">
                    <span data-gallery-ui="walk-pos" className="tabular-nums text-running-700 dark:text-running-300">
                      {selected + 1} of {micrographs.length}
                    </span>
                  </Chip>
                </DialogTitle>
                <DialogDescription className="tabular-nums">
                  {micrographs[selected].nx}×{micrographs[selected].ny} px · {formatBytes(micrographs[selected].size)}
                  {data.pixelSize != null ? ` · ${data.pixelSize} Å/px` : ""}
                  {data.voltage != null ? ` · ${data.voltage} kV` : ""}
                  {micrographs.length > 1 ? " · ←/→ to walk" : ""}
                </DialogDescription>
              </DialogHeader>
              <MrcImage
                key={micrographs[selected].path}
                src={fileUrl(micrographs[selected].path, isCluster ? "&full=1" : "&scale=large")}
                alt={`Micrograph ${micrographs[selected].name}, full view`}
                className="max-h-[70vh]"
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* compare dialog — t654: the tray, side by side. Columns follow
          the tray size (capped at 5: the sample itself is five, so a
          wider grid is a grid nobody will ever fill). */}
      <Dialog open={compareOpen} onOpenChange={(open) => !open && setCompareOpen(false)}>
        <DialogContent
          className="max-w-4xl sm:max-w-4xl"
          data-gallery-ui="compare-dialog"
          onKeyDown={onEscapeClose(() => setCompareOpen(false))}
        >
          {pickedEntries.length >= 2 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <Columns3 className="h-4 w-4 text-running-600" aria-hidden="true" />
                  Side-by-side · {pickedEntries.length} micrographs
                </DialogTitle>
                <DialogDescription>
                  in the order you picked them — same contrast stretch, same
                  pixel size, your eyes do the comparing
                </DialogDescription>
              </DialogHeader>
              <div
                className={cn(
                  "grid gap-1.5",
                  pickedEntries.length === 2 ? "grid-cols-2"
                  : pickedEntries.length === 3 ? "grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-4"
                )}
              >
                {pickedEntries.map((m, i) => {
                  const bpp = formatBytesPerPixel(m);
                  return (
                  <figure key={m.path} className="overflow-hidden rounded-md border border-running/25">
                    <MrcImage
                      src={fileUrl(m.path, isCluster ? "&full=1" : "&scale=large")}
                      alt={`Micrograph ${m.name}, comparison pane ${i + 1}`}
                      className="aspect-square"
                    />
                    {/* t657 — the stats the panes can be compared on:
                        row 1 identity (order · name · bytes), row 2 the
                        measured geometry (dims · bytes-per-pixel) — both
                        honest: absent when the header/stat says unknown. */}
                    <figcaption className="border-t border-running/20 bg-muted/30 px-1 py-0.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[9px] font-semibold tabular-nums text-running-700 dark:text-running-300">{i + 1}</span>
                        <span className="truncate text-[9px] font-medium text-foreground/80" title={m.name}>{m.name}</span>
                        <span className="ml-auto shrink-0 text-[8.5px] tabular-nums text-muted-foreground">{formatBytes(m.size)}</span>
                      </div>
                      {m.nx > 0 ? (
                        <div
                          data-gallery-ui="pane-stats"
                          className="mt-px flex items-baseline gap-1.5 text-[8.5px] tabular-nums text-muted-foreground"
                        >
                          <span data-pane-stat="dims" title="detector dimensions from the MRC header">
                            {m.nx}×{m.ny} px
                          </span>
                          {bpp ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span
                                data-pane-stat="bpp"
                                title="measured bytes per pixel — 4.0 is float32, 2.0 int16; counted, not guessed"
                              >
                                {bpp}
                              </span>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </figcaption>
                  </figure>
                  );
                })}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
