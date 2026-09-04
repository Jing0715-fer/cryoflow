"use client";

/**
 * CryoFlow — job results/output viewer.
 *
 * Backend: /api/jobs/[id]/outputs walks the REAL RELION engine workdir
 * (MRC maps/stacks, STAR tables, FSC curves, logs). This component lays
 * them out as: FSC chart (when postprocess data exists) → MRC gallery
 * (thumbnails + 3D Mol* viewer for volumes) → STAR tables → logs &
 * reports → workdir footer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Box,
  Check,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  FolderOpen,
  Layers,
  Loader2,
  RefreshCw,
  ScrollText,
  Table2,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { JobDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FscChart } from "./fsc-chart";
import { MrcImage } from "./mrc-image";
import { MolViewer } from "./mol-viewer";
import { StarTable } from "./star-table";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type OutputKind = "mrc" | "star" | "text" | "image";

interface OutputFile {
  path: string;
  name: string;
  kind: OutputKind;
  size: number;
  slices?: number;
  label?: string;
  rows?: number;
}

interface OutputsResponse {
  workdir: string | null;
  engine: "relion" | "sim";
  files: OutputFile[];
  note?: string;
}

interface FscState {
  fsc: { resolution: number[]; correlation: number[] };
  finalResolution?: number;
  source: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileUrl(jobId: string, file: OutputFile, extra: string): string {
  return `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(file.path)}${extra}`;
}

/** postprocess.star / *_fsc.star carry the resolution curve. */
function isFscStar(file: OutputFile): boolean {
  const lower = file.name.toLowerCase();
  return file.kind === "star" && (lower === "postprocess.star" || lower.endsWith("_fsc.star"));
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function JobResults({ job, refreshKey = 0 }: { job: JobDTO; refreshKey?: number }) {
  const [data, setData] = useState<OutputsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fscState, setFscState] = useState<FscState | null>(null);

  const [imageFile, setImageFile] = useState<OutputFile | null>(null);
  const [starFile, setStarFile] = useState<OutputFile | null>(null);
  const [textFile, setTextFile] = useState<OutputFile | null>(null);
  const [molFile, setMolFile] = useState<OutputFile | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFscState(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/outputs`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as OutputsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load outputs");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [job.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // external refresh signal (inspector's live polling while the job runs)
  const firstKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== firstKey.current) void load();
  }, [refreshKey, load]);

  // Fetch the FSC curve when a postprocess-style STAR file exists.
  const fscCandidate = useMemo(
    () => data?.files.find(isFscStar) ?? null,
    [data]
  );

  useEffect(() => {
    if (!fscCandidate || !data) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/jobs/${job.id}/outputs/star?path=${encodeURIComponent(fscCandidate.path)}&rows=5`
        );
        if (!res.ok) return;
        const body = (await res.json()) as {
          fsc?: { resolution: number[]; correlation: number[]; finalResolution?: number };
        };
        if (!cancelled && body.fsc && body.fsc.resolution.length > 1) {
          setFscState({
            fsc: { resolution: body.fsc.resolution, correlation: body.fsc.correlation },
            finalResolution: body.fsc.finalResolution,
            source: fscCandidate.path,
          });
        }
      } catch {
        /* chart is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fscCandidate, job.id, data]);

  // latest-iteration first: for finished jobs the FINAL classes/maps are what
  // users come to see (run_it025_classes beats run_it000_classes)
  const mrcFiles = useMemo(() => {
    const files = data?.files.filter((f) => f.kind === "mrc") ?? [];
    const iterOf = (name: string): number => {
      const m = name.match(/^run_it(\d+)_/i);
      return m ? Number(m[1]) : -1;
    };
    return [...files].sort((a, b) => {
      const ia = iterOf(a.name);
      const ib = iterOf(b.name);
      if (ia !== ib) return ib - ia; // higher iteration first
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, [data]);
  const starFiles = useMemo(() => data?.files.filter((f) => f.kind === "star") ?? [], [data]);
  const logFiles = useMemo(
    () => data?.files.filter((f) => f.kind === "text" || f.kind === "image") ?? [],
    [data]
  );

  const copyWorkdir = useCallback(async () => {
    if (!data?.workdir) return;
    try {
      await navigator.clipboard.writeText(data.workdir);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, [data?.workdir]);

  /* ---------------- render ---------------- */

  if (loading && !data) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">Could not load outputs</p>
          <p className="text-destructive/80">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.files.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-8 text-center">
        <FolderOpen className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground/80">No on-disk outputs</p>
        <p className="max-w-55 text-xs leading-relaxed text-muted-foreground">
          {data?.note ?? "This job produced no browsable files."}
        </p>
        {job.result && (
          <p className="mt-1 max-w-full truncate rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground" title={job.result}>
            {job.result}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Only RELION-engine jobs write maps, STAR tables and logs to disk.
        </p>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="mt-1 h-7 text-[11px]">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* header row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {data.files.length} output file{data.files.length === 1 ? "" : "s"}
          {data.note ? ` · ${data.note}` : ""}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          className="h-7 gap-1.5 px-2 text-[11px]"
          aria-label="Refresh outputs"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* FSC curve */}
      {fscState && (
        <section aria-label="FSC curve" className="rounded-lg border border-teal-600/25 bg-teal-600/5 p-3">
          <FscChart fsc={fscState.fsc} finalResolution={fscState.finalResolution} />
        </section>
      )}

      {/* Maps & images gallery */}
      {mrcFiles.length > 0 && (
        <section aria-label="Maps and images">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
            <Layers className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
            Maps &amp; images
            <span className="font-normal text-muted-foreground">({mrcFiles.length})</span>
          </h4>
          {mrcFiles.length > 9 ? (
            <div className="max-h-80 overflow-y-auto pr-1">
              <MrcGallery job={job} files={mrcFiles} onOpen={setImageFile} />
            </div>
          ) : (
            <MrcGallery job={job} files={mrcFiles} onOpen={setImageFile} />
          )}
        </section>
      )}

      {/* STAR tables */}
      {starFiles.length > 0 && (
        <section aria-label="STAR tables">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
            <Table2 className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
            STAR tables
            <span className="font-normal text-muted-foreground">({starFiles.length})</span>
          </h4>
          <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {starFiles.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => setStarFile(f)}
                  className="flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors hover:border-violet-600/40 hover:bg-violet-600/5"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden="true" />
                  <span className="truncate font-mono text-[11px]">{f.label ?? f.name}</span>
                  {typeof f.rows === "number" && (
                    <span className="shrink-0 rounded-full border border-violet-600/25 bg-violet-600/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                      {f.rows.toLocaleString()} rows
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {formatBytes(f.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Logs & reports */}
      {logFiles.length > 0 && (
        <section aria-label="Logs and reports">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
            <ScrollText className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            Logs &amp; reports
            <span className="font-normal text-muted-foreground">({logFiles.length})</span>
          </h4>
          <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {logFiles.map((f) =>
              f.kind === "image" ? (
                <li key={f.path}>
                  <a
                    href={fileUrl(job.id, f, "&format=raw")}
                    download={f.name}
                    className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors hover:border-amber-600/40 hover:bg-amber-600/5"
                  >
                    <FileDown className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <span className="truncate">{f.label ?? f.name}</span>
                    <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatBytes(f.size)}
                    </span>
                  </a>
                </li>
              ) : (
                <li key={f.path}>
                  <button
                    type="button"
                    onClick={() => setTextFile(f)}
                    className="flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors hover:border-amber-600/40 hover:bg-amber-600/5"
                  >
                    <ScrollText className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <span className="truncate font-mono text-[11px]">{f.name}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {formatBytes(f.size)}
                    </span>
                  </button>
                </li>
              )
            )}
          </ul>
        </section>
      )}

      {/* workdir footer */}
      {data.workdir && (
        <footer className="flex items-center gap-1.5 border-t pt-3 text-[11px] text-muted-foreground">
          <span className="shrink-0 font-medium">workdir:</span>
          <span className="truncate font-mono" title={data.workdir}>
            {data.workdir}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void copyWorkdir()}
            className="h-6 w-6 shrink-0 p-0"
            aria-label="Copy workdir path"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3 w-3" aria-hidden="true" />
            )}
          </Button>
        </footer>
      )}

      {/* ---------------- dialogs ---------------- */}

      {/* map / stack dialog */}
      <Dialog open={imageFile !== null} onOpenChange={(o) => !o && setImageFile(null)}>
        <DialogContent className="max-w-2xl">
          {imageFile && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <Layers className="h-4 w-4 text-teal-600" aria-hidden="true" />
                  {imageFile.label ?? imageFile.name}
                </DialogTitle>
                <DialogDescription className="font-mono text-[11px]">
                  {imageFile.path} · {formatBytes(imageFile.size)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {imageFile.name.toLowerCase().endsWith(".mrcs") ? (
                  <>
                    <MrcImage
                      src={fileUrl(job.id, imageFile, "&format=png&montage=16")}
                      alt={`${imageFile.name} montage`}
                      className="bg-zinc-950 p-2"
                    />
                    <p className="text-center text-[11px] text-muted-foreground">
                      Stack of {imageFile.slices ?? "?"} particle images — showing the first{" "}
                      {Math.min(16, imageFile.slices ?? 16)}
                    </p>
                  </>
                ) : (
                  <>
                    <MrcImage
                      src={fileUrl(job.id, imageFile, "&format=png&scale=large")}
                      alt={`${imageFile.name} central slice`}
                      className="bg-zinc-950 p-2"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        Central slice (z={Math.floor((imageFile.slices ?? 1) / 2)} of{" "}
                        {imageFile.slices ?? 1}) · {(imageFile.slices ?? 1) > 1
                          ? `${imageFile.slices} sections`
                          : "single section"}
                      </p>
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
                        onClick={() => {
                          setMolFile(imageFile);
                          setImageFile(null);
                        }}
                      >
                        <Box className="h-3.5 w-3.5" aria-hidden="true" />
                        View in 3D (Mol*)
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* STAR table dialog */}
      <Dialog open={starFile !== null} onOpenChange={(o) => !o && setStarFile(null)}>
        <DialogContent className="max-w-4xl">
          {starFile && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <Table2 className="h-4 w-4 text-violet-600" aria-hidden="true" />
                  {starFile.label ?? starFile.name}
                </DialogTitle>
                <DialogDescription className="font-mono text-[11px]">{starFile.path}</DialogDescription>
              </DialogHeader>
              <StarTable job={job} path={starFile.path} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* text preview dialog */}
      <Dialog open={textFile !== null} onOpenChange={(o) => !o && setTextFile(null)}>
        <DialogContent className="max-w-3xl">
          {textFile && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <ScrollText className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  {textFile.name}
                </DialogTitle>
                <DialogDescription className="font-mono text-[11px]">
                  {textFile.path} · last 64 KB
                </DialogDescription>
              </DialogHeader>
              <TextPreview jobId={job.id} path={textFile.path} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Mol* 3D viewer dialog */}
      <MolViewer
        job={job}
        path={molFile?.path ?? ""}
        name={molFile?.label ?? molFile?.name ?? ""}
        open={molFile !== null}
        onOpenChange={(o) => !o && setMolFile(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery                                                             */
/* ------------------------------------------------------------------ */

/** run_it025_… → 25; final artifacts (no it-prefix) → null. */
function iterOfName(name: string): number | null {
  const m = name.match(/^run_it(\d+)_/i);
  return m ? Number(m[1]) : null;
}

type IterFilter = "final" | "all" | number;

function MrcGallery({
  job,
  files,
  onOpen,
}: {
  job: JobDTO;
  files: OutputFile[];
  onOpen: (file: OutputFile) => void;
}) {
  // iterations present on disk, newest first
  const iters = useMemo(() => {
    const set = new Set<number>();
    for (const f of files) {
      const it = iterOfName(f.name);
      if (it != null) set.add(it);
    }
    return [...set].sort((a, b) => b - a);
  }, [files]);
  const maxIter = iters.length > 0 ? iters[0] : -1;

  // default: final round only (+ non-iteration final artifacts)
  const [filter, setFilter] = useState<IterFilter>("final");

  const shown = useMemo(() => {
    if (filter === "all") return files;
    if (filter === "final") {
      // newest iteration + final artifacts without an iteration prefix
      return files.filter((f) => {
        const it = iterOfName(f.name);
        return it == null || it === maxIter;
      });
    }
    return files.filter((f) => iterOfName(f.name) === filter);
  }, [files, filter, maxIter]);

  return (
    <div>
      {/* iteration filter chips */}
      {iters.length > 1 || (iters.length === 1 && files.length > iters.length) ? (
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Round
          </span>
          <button
            type="button"
            aria-pressed={filter === "final"}
            onClick={() => setFilter("final")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors",
              filter === "final"
                ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-teal-600/40 hover:text-foreground"
            )}
          >
            final{maxIter >= 0 ? ` · it${String(maxIter).padStart(3, "0")}` : ""}
          </button>
          {iters.map((it) => (
            <button
              key={it}
              type="button"
              aria-pressed={filter === it}
              onClick={() => setFilter(it)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums transition-colors",
                filter === it
                  ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:border-teal-600/40 hover:text-foreground"
              )}
            >
              it{String(it).padStart(3, "0")}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              filter === "all"
                ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-teal-600/40 hover:text-foreground"
            )}
          >
            all {files.length}
          </button>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {shown.length} of {files.length} shown
          </span>
        </div>
      ) : null}

      {/* compact thumbnail grid — click any tile to enlarge */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((f) => {
          const it = iterOfName(f.name);
          const isFinal = it != null && it === maxIter;
          return (
            <button
              key={f.path}
              type="button"
              onClick={() => onOpen(f)}
              className="group relative rounded-lg border p-1.5 text-left transition-all hover:border-teal-600/50 hover:shadow-sm"
              aria-label={`Enlarge ${f.label ?? f.name}`}
              title={`Click to enlarge — ${f.label ?? f.name}`}
            >
              {isFinal && (
                <span className="absolute right-2 top-2 z-10 rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                  final
                </span>
              )}
              <div className="relative">
                {/* hover zoom affordance over the image itself */}
                <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-zinc-950/80 text-white opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100">
                  <ZoomIn className="size-3.5" aria-hidden="true" />
                </span>
                <MrcImage
                  src={
                    f.name.toLowerCase().endsWith(".mrcs")
                      ? fileUrl(job.id, f, "&format=png&montage=16")
                      : fileUrl(job.id, f, "&format=png")
                  }
                  alt={f.label ?? f.name}
                  className="aspect-square"
                />
              </div>
              <p className="mt-1 truncate text-[10px] font-medium text-foreground/85" title={f.label ?? f.name}>
                {f.label ?? f.name}
              </p>
              <p className="truncate text-[9px] text-muted-foreground">
                {f.name.toLowerCase().endsWith(".mrcs")
                  ? `${f.slices ?? "?"} imgs · ${formatBytes(f.size)}`
                  : `${f.slices ?? 1}³ · ${formatBytes(f.size)}`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Text preview                                                        */
/* ------------------------------------------------------------------ */

function TextPreview({ jobId, path }: { jobId: string; path: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=text`
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        if (!cancelled) setText(await res.text());
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load file");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, path]);

  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error}
      </p>
    );
  }
  if (text === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading file…
      </div>
    );
  }
  return (
    <pre
      className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/90"
      aria-label="File content preview"
    >
      {text}
    </pre>
  );
}
