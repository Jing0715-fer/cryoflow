"use client";

/**
 * CryoFlow — class snapshots per iteration, live and after (t350 + t354).
 *
 * The user's asks, one component:
 *   「中间过程的结果没有实时展示，希望每一轮的 2D 分类的结果图都要能
 *    及时在本地客户端中显示出来」 (t350) — while a REMOTE classification
 *    runs, poll /api/jobs/<id>/iterations (one SSH round, cluster-side awk
 *    count) and show the newest class averages as they land (each
 *    iteration's stack renders to small PNGs on first sight; the MB-scale
 *    stack itself never stays in the local mirror).
 *   「每一轮的 2D 结果生成一张图片，可以在本地的 UI 中查看」 (t354) —
 *    EVERY round now has its own SHEET: one grid image of that iteration's
 *    whole class-average stack, the way relion_display would show it. A
 *    chips bar picks the round (the newest is followed live while the job
 *    runs), the sheet is pulled lazily on first view, and clicking it opens
 *    the enlarged lightbox with round-to-round keyboard navigation.
 *   「像 cryosparc 一样，每一类的颗粒都有一个单独的 star 文件……直接
 *    选择想要的类进行后续步骤」 — once the job is COMPLETED the class
 *    grid becomes a picker: check classes, choose a downstream type, and
 *    the platform creates the consumer job wired to the source with the
 *    selection in its params (dispatch resolves the per-class stars and
 *    auto-joinstars multiple classes — no manual subset selection).
 */

import React from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Maximize2, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO, EdgeDTO } from "@/lib/types";

const LIVE_TYPES = new Set(["class2d", "class3d", "refine3d", "initialmodel"]);

/** the stack-name dialect the server validates against (STACK_NAME_RE) */
const STACK_NAME_RE = /^(?:run_it|_it)(\d+)_(?:unmasked_)?classes\.mrcs?$/i;

/* t370 — the corruption-evidence tooltips (the honest verdicts the live
 * rounds now carry; attached in the chips bar below). Dense on purpose:
 * the badge is tiny, the explanation must stand alone — and it must
 * never claim more than the evidence says (both verdicts name the two
 * worlds and point at the Log tab's storage diagnostic, which is where
 * the 60-second conviction test lives (t369)). */
const ZERO_DATA_TITLE =
  "this round's pixels are all zero — the class averages were computed from empty/garbage input stacks (a broken extraction upstream) or the run's writes never durably reached the storage. Check the job's Log tab for the storage diagnostic verdict.";
const ZERO_HEADER_TITLE =
  "this round's file was written with a zero MRC header on the cluster (the readMRC 'exceeds stack size 0' shape) — the run's writes are not durably landing; see the storage diagnostic in the Log tab.";

interface ClassEntry {
  cls: number;
  count: number;
  fraction: number;
}

interface StackEntry {
  iter: number;
  file: string;
  /** t370 — the stack's MRC header nz as measured on the cluster (live
   *  rounds may carry it; cached/local rounds and older payloads may
   *  not). 0 = the ZERO-HEADER corruption shape (relion_display's
   *  "exceeds stack size 0", the t369 session's right-sized zero-header
   *  stacks). Absent = unmeasured — renders exactly as before. */
  nz?: number;
  /** t370 — this round's rendered pixels were all identical (the "black
   *  classes" field report: healthy occupancy numbers over an all-zero
   *  image). Absent = unmeasured / healthy. */
  zeroData?: boolean;
}

interface IterationsResponse {
  remote?: boolean;
  iterations: number[];
  latest: number | null;
  classes: ClassEntry[];
  total: number;
  classesFile: string | null;
  classesSlices: number | null;
  /** t354 — every round that has a sheet (or a stack) to view */
  stacks?: StackEntry[];
  /** t358 — the last honest refusal recorded for this payload's classesFile
   * (which link of the cluster pull broke) — shown when cards fail */
  renderError?: string;
  /** t370 — ASSET-level zero-data evidence: the classesFile's rendered
   *  pixels were all identical. The backend may stamp the round entries,
   *  the payload, or both — roundZeroData() unions the two views so the
   *  badge lands on the chip either way. Absent = healthy / unmeasured. */
  zeroData?: boolean;
  error?: string;
  /** t397 — the payload's version token: an unmoved run answers
   * {unchanged:true} and the gallery keeps its rendered state (the log
   * lane's ?since= dialect on the results lane — the 5s live poll is
   * free between rounds). */
  version?: string;
  unchanged?: boolean;
}

/** t370 — does this round carry the zero-data verdict? (entry-level flag,
 *  plus the payload-level asset note mapped onto the classesFile's own
 *  round — whichever layer the backend stamps, the badge lands where the
 *  user looks. Both fields are optional and may be absent.) */
const roundZeroData = (s: StackEntry, data: IterationsResponse | null): boolean =>
  s.zeroData === true || (data?.zeroData === true && s.file === data.classesFile);

/** downstream types offered by source type (the honest set: every pick
 * must be dispatchable with the source's own outputs) */
const DOWNSTREAM: Record<string, Array<{ type: string; label: string }>> = {
  class2d: [
    { type: "initialmodel", label: "Initial Model" },
    { type: "class2d", label: "2D Classification (re-classify)" },
  ],
  class3d: [
    { type: "initialmodel", label: "Initial Model" },
    { type: "refine3d", label: "3D Auto-Refine" },
    { type: "class2d", label: "2D Classification" },
  ],
};

const pad3 = (n: number) => String(n).padStart(3, "0");

export function ClassIterationGallery({ job, refreshKey = 0 }: { job: JobDTO; refreshKey?: number }) {
  const [data, setData] = React.useState<IterationsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [downstream, setDownstream] = React.useState<string>("");
  const [creating, setCreating] = React.useState(false);
  // t354 — the round the sheet shows (null = follow the newest, live)
  const [viewIter, setViewIter] = React.useState<number | null>(null);
  const [sheetLoaded, setSheetLoaded] = React.useState(false);
  const [sheetError, setSheetError] = React.useState<string | null>(null);
  const [sheetRetry, setSheetRetry] = React.useState(0);
  /* t358 — the sheet arrives through fetch(), not <img src>: the img
   * element throws the response body away on failure, and the field
   * reports showed the cost — every refusal collapsed into one vague
   * "the stack may not exist on the cluster" line while the server knew
   * EXACTLY which link broke (missing / truncated mid-wire / over the
   * transfer cap / unreadable bytes). fetch() reads the JSON reason
   * verbatim; the blob becomes an object URL for the img. */
  const [sheetSrc, setSheetSrc] = React.useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = React.useState(false);
  /* t355 — per-class thumbnail failure set: a slice that cannot be
   * fetched/rendered swaps to the honest placeholder instead of the
   * browser's broken-image glyph (the grid stays uniform either way). */
  const [failedSlices, setFailedSlices] = React.useState<Set<number>>(new Set());
  const onSliceError = (cls: number): void =>
    setFailedSlices((prev) => {
      if (prev.has(cls)) return prev;
      const next = new Set(prev);
      next.add(cls);
      return next;
    });
  const running = job.status === "running" || job.status === "pending";

  // t397 — the token belongs to THIS job's canvas: a job switch (or the
  // gallery re-mounting for another job) retires the old token so the
  // first read is always a full payload.
  const versionRef = React.useRef<string>("");
  const load = React.useCallback(async () => {
    try {
      // t397 — carry the last-seen version: an unmoved run answers
      // {unchanged:true} (~40 bytes) and the rendered state stays — the
      // poll below can afford 5s without re-paying the payload's wire,
      // JSON.parse and a full grid re-render every tick.
      const q = versionRef.current ? `?since=${encodeURIComponent(versionRef.current)}` : "";
      const res = await fetch(`/api/jobs/${job.id}/iterations${q}`, { cache: "no-store" });
      if (!res.ok) {
        setData(null);
        return;
      }
      const body = (await res.json()) as IterationsResponse;
      if (body.unchanged) return; // nothing moved since the last payload
      if (typeof body.version === "string" && body.version) versionRef.current = body.version;
      setData(body);
    } catch {
      /* network blip — the next poll retries */
    } finally {
      setLoading(false);
    }
  }, [job.id]);

  React.useEffect(() => {
    // a job switch retires the previous canvas's token — first read is
    // always a full payload
    versionRef.current = "";
    void load();
  }, [load]);

  // running job: poll. t397 — 12s → 5s: the server's prewarm (the sweep
  // carries the live sections on every heartbeat) + the version token
  // (unchanged ≈ 40 bytes, zero re-render) make the faster cadence nearly
  // free, and a fresh round surfaces in ~heartbeat+poll instead of up to
  // 12s+12s of stacked TTLs.
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), 5_000);
    return () => clearInterval(t);
  }, [running, load]);

  // finished job: re-read when the inspector's refresh signal fires
  const firstKey = React.useRef(refreshKey);
  React.useEffect(() => {
    if (refreshKey !== firstKey.current) void load();
  }, [refreshKey, load]);

  // t354 — the rounds with a sheet; tolerate a payload without `stacks`
  // by deriving one entry from the legacy classesFile field
  const stacks: StackEntry[] = React.useMemo(() => {
    if (data?.stacks && data.stacks.length > 0) return data.stacks;
    if (data?.classesFile) {
      const it = Number(STACK_NAME_RE.exec(data.classesFile)?.[1] ?? 0);
      return [{ iter: it, file: data.classesFile }];
    }
    return [];
  }, [data]);
  const newest = stacks.length > 0 ? stacks[stacks.length - 1] : null;
  // pinned rounds fall back to the newest when their chip disappears
  // (a re-dispatch resets the cluster's iteration numbering)
  const current =
    (viewIter != null ? stacks.find((s) => s.iter === viewIter) : undefined) ?? newest;

  // t358 — the sheet's own fetch lifecycle: (re)loaded whenever the round
  // changes or Retry fires. The object URL is revoked on cleanup so
  // round-hopping never leaks blobs.
  React.useEffect(() => {
    if (current == null) {
      setSheetSrc(null);
      setSheetError(null);
      setSheetLoaded(false);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setSheetError(null);
    setSheetLoaded(false);
    setSheetSrc(null); // the previous round's blob is revoked by this run's cleanup
    const it = current.iter;
    const file = current.file;
    (async () => {
      try {
        const url =
          `/api/jobs/${job.id}/iterations/sheet?file=${encodeURIComponent(file)}` +
          (sheetRetry > 0 ? `&_r=${sheetRetry}` : "");
        const res = await fetch(url);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!cancelled) {
            setSheetError(
              body?.error ??
                `could not load the sheet for iteration ${pad3(it)} (HTTP ${res.status})`
            );
          }
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSheetSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setSheetError(
            `could not load the sheet for iteration ${pad3(it)} — the local server did not answer`
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl != null) URL.revokeObjectURL(objectUrl);
    };
  }, [current?.file, current?.iter, sheetRetry, job.id]);

  // keep the selected chip visible as the bar grows / rounds land
  React.useEffect(() => {
    if (current == null) return;
    document
      .querySelector(`[data-iter-chip="${current.iter}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current?.iter]);

  // lightbox round navigation — arrows step through the chips, Esc is the
  // Dialog's own; the handler lives on the content so it only fires open
  const stepRound = React.useCallback(
    (dir: 1 | -1) => {
      if (current == null) return;
      const idx = stacks.findIndex((s) => s.iter === current.iter);
      const next = stacks[idx + dir];
      if (next) setViewIter(next.iter);
    },
    [current, stacks]
  );

  const showPicker =
    (job.type === "class2d" || job.type === "class3d") &&
    job.status === "completed" &&
    (data?.classes?.length ?? 0) > 0;
  const options = showPicker ? DOWNSTREAM[job.type] ?? [] : [];
  React.useEffect(() => {
    if (options.length > 0 && !options.some((o) => o.type === downstream)) {
      setDownstream(options[0].type);
    }
  }, [options, downstream]);

  if (!LIVE_TYPES.has(job.type)) return null;

  const toggle = (cls: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  };

  const createDownstream = async () => {
    if (selected.size === 0 || !downstream) return;
    setCreating(true);
    try {
      // place the consumer under the source on the canvas (the source's own
      // position keeps the lineage readable; the server wires the edge)
      const { jobs } = useWorkflowStore.getState();
      const source = jobs.find((j) => j.id === job.id);
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: downstream,
          x: (source?.x ?? 200) + 60,
          y: (source?.y ?? 320) + 200,
          classStarSelection: { jobId: job.id, classes: [...selected].sort((a, b) => a - b) },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { job: JobDTO; edge?: EdgeDTO };
      const st = useWorkflowStore.getState();
      useWorkflowStore.setState({
        jobs: [...st.jobs, body.job],
        selectedId: body.job.id,
        selectedIds: [body.job.id],
        ...(body.edge && !st.edges.some((e) => e.id === body.edge!.id)
          ? { edges: [...st.edges, body.edge] }
          : {}),
      });
      toast({
        title: "Downstream job created",
        description: `${body.job.name} — consumes class ${[...selected].sort((a, b) => a - b).join(", ")}${
          selected.size > 1 ? ` (auto-joined into one star at dispatch)` : ""
        }. Run it when ready.`,
      });
      setSelected(new Set());
    } catch (err) {
      toast({
        title: "Could not create the downstream job",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Reading iteration snapshots…
      </div>
    );
  }

  if (!data || (data.classes.length === 0 && !data.classesFile && stacks.length === 0)) {
    if (data?.error) {
      return (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-xs text-rose-600 dark:text-rose-400">
          Class snapshots unavailable — {data.error}
        </div>
      );
    }
    return running ? (
      <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        No iteration snapshots on the cluster yet — the seed round (it000) appears within minutes of startup;
        real class-average rounds (it001+) land as each iteration completes.
      </div>
    ) : null;
  }

  const latest = data.latest;
  const sliceTotal = data.classesSlices ?? data.classes.length;
  const sheetUrl =
    current != null
      ? `/api/jobs/${job.id}/iterations/sheet?file=${encodeURIComponent(current.file)}${
          sheetRetry > 0 ? `&_r=${sheetRetry}` : ""
        }`
      : null;
  const pinnedBehind =
    current != null && newest != null && current.iter !== newest.iter;

  return (
    <section
      aria-label="Class snapshots per iteration"
      className="rounded-lg border border-border/60 bg-card"
      data-class-iteration-gallery=""
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">Class snapshots</span>
          {stacks.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {stacks.length} round{stacks.length === 1 ? "" : "s"}
            </span>
          )}
          {data.total > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {data.total.toLocaleString()} particles assigned
            </span>
          )}
          {running && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" aria-hidden="true" />
              live
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          className="h-7 gap-1.5 px-2 text-[11px]"
          aria-label="Refresh class snapshots"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* t354 — one chip per iteration round; the sheet follows the newest
          while running (viewIter=null) and pins when the user picks a round */}
      {stacks.length > 0 && current != null && (
        <div
          className="flex items-center gap-1.5 overflow-x-auto border-b border-border/60 px-4 py-2"
          role="tablist"
          aria-label="Iteration rounds"
        >
          {stacks.map((s) => {
            const isCurrent = s.iter === current.iter;
            const isNewest = newest != null && s.iter === newest.iter;
            // t369 — round 0 is the SEED round RELION writes at startup
            // (initial random class averages — of no scientific value
            // even when healthy; the field report's manual-run control
            // proves a healthy it000 exists too). Its chip says so, so a
            // zero-header it000 verdict never reads as "the whole run is
            // broken" when it001+ are the rounds that matter.
            const isSeed = s.iter === 0;
            const seedTitle =
              "round 0 — the seed round RELION writes at startup (initial random class averages); real class-average rounds start at it001";
            // t370 — the corruption-evidence badges, same shape as the
            // seed badge. Both fields are OPTIONAL (older cached assets,
            // mid-write rounds, a backend that predates t370) — absence
            // renders exactly as today, and no shape assumption is made:
            //   · zeroData — the round's rendered pixels were ALL
            //     identical (the "black classes" report: the numbers say
            //     a healthy run, the image says empty)
            //   · nz === 0 — a right-sized file whose MRC header is all
            //     zeros on the cluster (relion_display's "exceeds stack
            //     size 0"; nz absent or nonzero renders no badge)
            const zeroData = roundZeroData(s, data);
            const zeroHeader = s.nz === 0;
            const verdicts = [
              isSeed ? seedTitle : null,
              zeroData ? ZERO_DATA_TITLE : null,
              zeroHeader ? ZERO_HEADER_TITLE : null,
            ].filter((t): t is string => t != null);
            return (
              <button
                key={s.iter}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                data-iter-chip={s.iter}
                title={verdicts.length > 0 ? verdicts.join("\n\n") : undefined}
                onClick={() => setViewIter(s.iter)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                it {pad3(s.iter)}
                {isSeed && (
                  <span
                    className={cn(
                      "rounded-full px-1 text-[9px] leading-4",
                      isCurrent
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    seed
                  </span>
                )}
                {zeroData && (
                  <span
                    className={cn(
                      "rounded-full px-1 text-[9px] leading-4",
                      isCurrent
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    )}
                  >
                    zero data
                  </span>
                )}
                {zeroHeader && (
                  <span
                    className={cn(
                      "rounded-full px-1 text-[9px] leading-4",
                      isCurrent
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    )}
                  >
                    zero header
                  </span>
                )}
                {running && isNewest && (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 animate-pulse rounded-full motion-reduce:animate-none",
                      isCurrent ? "bg-primary-foreground" : "bg-emerald-500"
                    )}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
          {pinnedBehind && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewIter(null)}
              className="ml-1 h-6 shrink-0 gap-1 rounded-full px-2 text-[10px]"
              aria-label="Jump back to the latest iteration"
            >
              latest
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}

      {/* t354 — the selected round's SHEET: the whole iteration as ONE grid
          image, pulled lazily on first view (running and finished alike).
          t355 — the error card renders OUTSIDE the zoom button: its Retry
          <Button> used to nest inside the wrapper <button> (invalid HTML —
          React flagged the hydration hazard, and the retry click could die
          in the nested-button state the field report actually lived in).
          t358 — the sheet is FETCHED, not <img>-loaded: the refusal's JSON
          reason lands here verbatim (missing / truncated / over-cap /
          unreadable / stat-failed), so the card says which link broke. */}
      {current != null && (
        <div className="p-4" data-sheet-view={current.iter}>
          {sheetError != null ? (
            <div className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-4 py-6 text-center">
              <span className="max-w-xl text-[11px] leading-relaxed text-rose-600 dark:text-rose-400" data-sheet-error="">{sheetError}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-[11px]"
                onClick={() => {
                  setSheetError(null);
                  setSheetLoaded(false);
                  setSheetRetry((n) => n + 1);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              className="group relative block w-full cursor-zoom-in rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-label={`Open iteration ${pad3(current.iter)} class sheet enlarged`}
            >
              {sheetSrc == null && (
                <div className="flex min-h-48 w-full items-center justify-center rounded-md border border-border/60 bg-muted/30">
                  <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Fetching iteration {pad3(current.iter)} from the cluster…
                  </span>
                </div>
              )}
              {sheetSrc != null && (
                <img
                  key={sheetSrc}
                  src={sheetSrc}
                  alt={`All class averages of iteration ${pad3(current.iter)} in one grid`}
                  onLoad={() => setSheetLoaded(true)}
                  onError={() =>
                    setSheetError(
                      `the sheet for iteration ${pad3(current.iter)} arrived but was not a readable image`
                    )
                  }
                  className={cn(
                    "mx-auto max-h-[520px] w-auto max-w-full rounded-md border border-border/60 object-contain transition-opacity duration-300",
                    sheetLoaded ? "opacity-100" : "absolute inset-0 opacity-0"
                  )}
                />
              )}
              {sheetLoaded && (
                <span
                  className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          )}
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            iteration {pad3(current.iter)} · every class average of this round in one sheet
            {running && current.iter === newest?.iter ? " · updates each round" : ""}
          </p>
          {/* t370 — the round the user is LOOKING at carries corruption
              evidence: the sheet is black or refuses to render, and the
              caption must say WHY in one honest line (the chip's badge
              carries the full tooltip; this is the glance layer) */}
          {(roundZeroData(current, data) || current.nz === 0) && (
            <p
              className="mt-1 text-center text-[10px] leading-relaxed text-rose-600 dark:text-rose-400"
              data-round-verdict=""
            >
              {roundZeroData(current, data)
                ? "this round's pixels are all zero — empty/garbage input or writes that never durably landed"
                : "this round's file has a zero MRC header on the cluster — its writes are not durably landing"}
              {" — see the storage diagnostic in the Log tab"}
            </p>
          )}
        </div>
      )}

      {/* class grid — the LATEST round's averages + occupancy (the picker
          once the job completed; numbers come from the newest data star) */}
      {data.classes.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 border-t border-border/60 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {data.classes.map((c) => {
              const sliceIndex = c.cls - 1;
              const hasImage = data.classesFile != null && sliceIndex < sliceTotal;
              const isSelected = selected.has(c.cls);
              const failed = failedSlices.has(c.cls);
              return (
                <button
                  key={c.cls}
                  type="button"
                  onClick={showPicker ? () => toggle(c.cls) : undefined}
                  className={cn(
                    "group relative overflow-hidden rounded-md border bg-background text-left transition-colors",
                    showPicker ? "cursor-pointer hover:border-primary/50" : "cursor-default",
                    showPicker && isSelected && "border-primary ring-2 ring-primary/30"
                  )}
                  aria-pressed={showPicker ? isSelected : undefined}
                  aria-label={`Class ${c.cls}: ${c.count} particles (${(c.fraction * 100).toFixed(1)}%)${
                    showPicker ? " — click to select for the next step" : ""
                  }`}
                >
                  <div className="aspect-square w-full bg-muted/40">
                    {hasImage && !failed ? (
                      <img
                        src={`/api/jobs/${job.id}/iterations/image?file=${encodeURIComponent(data.classesFile!)}&slice=${sliceIndex}`}
                        alt={`Class ${c.cls} average`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        onError={() => onSliceError(c.cls)}
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground"
                        title={data.renderError ?? undefined}
                      >
                        no image
                      </div>
                    )}
                  </div>
                  {/* t355 — one line, always: a wrapped footer makes some
                      cards taller than their neighbours; squeeze truncates. */}
                  <div className="flex min-w-0 items-center justify-between gap-1 overflow-hidden whitespace-nowrap px-2 py-1.5">
                    <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">class {c.cls}</span>
                    <span className="shrink-0 font-mono text-[10px] font-medium">{(c.fraction * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-0.5 w-full bg-muted">
                    <div className="h-full bg-primary/70" style={{ width: `${Math.min(100, c.fraction * 100)}%` }} />
                  </div>
                  {showPicker && (
                    <span
                      className={cn(
                        "absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background/80 text-transparent group-hover:border-primary/50"
                      )}
                      aria-hidden="true"
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {data.classes.length > 0 && latest != null && (
            <p className="px-4 pb-3 text-[10px] text-muted-foreground">
              class grid · latest completed round (it {pad3(latest)}) — occupancy from its data star
            </p>
          )}
          {/* t358 — a grid that could not load its images says WHICH link of
              the cluster pull broke (the payload's honest refusal note) */}
          {failedSlices.size > 0 && data.renderError != null && (
            <p
              className="border-t border-rose-500/20 bg-rose-500/5 px-4 py-2 text-[10px] leading-relaxed text-rose-600 dark:text-rose-400"
              data-render-error=""
            >
              class images unavailable — {data.renderError}
            </p>
          )}
          {/* t370 — a BLACK grid explains itself (asset-level zeroData on
              the payload): the numbers under each card come from the data
              star and can read healthy while every pixel is zero — the
              footnote names the two worlds instead of letting a wall of
              black squares pass as a result */}
          {data.zeroData === true && (
            <p
              className="border-t border-rose-500/20 bg-rose-500/5 px-4 py-2 text-[10px] leading-relaxed text-rose-600 dark:text-rose-400"
              data-zero-data=""
            >
              every class image of this round is all-zero — the averages were computed from
              empty/garbage input stacks (a broken extraction upstream) or the run&apos;s writes
              never durably reached the storage; the Log tab&apos;s storage diagnostic says which world
            </p>
          )}
        </>
      )}

      {showPicker && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} class${selected.size === 1 ? "" : "es"} selected · ${selected
                  .size} per-class star${selected.size === 1 ? "" : "s"} feed the next job${selected.size > 1 ? " (auto-joined)" : ""}`
              : "Pick the classes worth keeping — the next job runs on exactly those particles (no subset-selection step)"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <label className="sr-only" htmlFor="downstream-type">
              Downstream job type
            </label>
            <select
              id="downstream-type"
              value={downstream}
              onChange={(e) => setDownstream(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              {options.map((o) => (
                <option key={o.type} value={o.type}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={() => void createDownstream()}
              disabled={creating || selected.size === 0}
              className="h-8 gap-1.5 px-3 text-xs"
              aria-busy={creating}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              Continue with {selected.size > 0 ? `${selected.size} class${selected.size === 1 ? "" : "es"}` : "selection"}
            </Button>
          </div>
        </div>
      )}

      {/* t354 — the enlarged sheet: round-to-round arrows, keyboard ←/→ */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent
          className="max-h-[94vh] max-w-[min(96vw,1400px)] overflow-hidden sm:max-w-[min(96vw,1400px)]"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") stepRound(-1);
            else if (e.key === "ArrowRight") stepRound(1);
          }}
        >
          <DialogTitle className="flex flex-wrap items-center gap-2 text-sm">
            Class sheet — iteration {current != null ? pad3(current.iter) : "—"}
            <span className="font-mono text-[10px] font-normal text-muted-foreground">
              {stacks.length} round{stacks.length === 1 ? "" : "s"} available
            </span>
            {/* t370 — the enlarged view of a corrupted round says so up
                front (the chip badge is small; here is where the user
                squints at the pixels — the rose chip names the verdict,
                the chip's tooltip on the chips bar carries the full story) */}
            {current != null && roundZeroData(current, data) && (
              <span className="rounded-full bg-rose-500/15 px-1.5 text-[9px] leading-4 text-rose-600 dark:text-rose-400">
                zero data
              </span>
            )}
            {current != null && current.nz === 0 && (
              <span className="rounded-full bg-rose-500/15 px-1.5 text-[9px] leading-4 text-rose-600 dark:text-rose-400">
                zero header
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Every class average of this iteration round in one grid. Use the arrow buttons or the
            left and right arrow keys to step between rounds.
          </DialogDescription>
          <div className="flex items-stretch gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-auto w-8 shrink-0"
              onClick={() => stepRound(-1)}
              disabled={current == null || stacks[0]?.iter === current.iter}
              aria-label="Previous iteration round"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            {sheetUrl != null && (
              <img
                src={sheetUrl}
                alt={`All class averages of iteration ${current != null ? pad3(current.iter) : ""} in one grid`}
                className="max-h-[74vh] w-auto max-w-full flex-1 rounded-md border border-border/60 object-contain"
              />
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-auto w-8 shrink-0"
              onClick={() => stepRound(1)}
              disabled={current == null || stacks[stacks.length - 1]?.iter === current.iter}
              aria-label="Next iteration round"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
