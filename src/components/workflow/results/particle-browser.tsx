"use client";

/**
 * CryoFlow — particle stack browser for Extract / Select jobs.
 *
 * Every picked particle lives in a per-micrograph .mrcs stack on disk.
 * This panel inventories those stacks (per-micrograph counts, CTF-fit
 * stats, optics table) and lets you page through the individual
 * particles — click any box for the full-size image with its picking
 * coordinates and CTF quality.
 *
 * Data: /api/jobs/[id]/particles (grouped inventory + ?group= pages).
 * Images: /api/jobs/{ownerJobId}/outputs/file (PNG slice rendering —
 * Select jobs reference the upstream Extract's stacks, the API resolves
 * ownership through the workflow edges).
 */

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Layers,
  MousePointerClick,
  ChevronsUpDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MrcImage } from "./mrc-image";

interface ParticleGroup {
  name: string;
  mic: string;
  stackRel: string;
  ownerJobId: string;
  count: number;
  meanFom: number | null;
  worstRes: number | null;
}

interface ParticlesResponse {
  jobId: string;
  total: number;
  optics: {
    pixelSize: number | null;
    voltage: number | null;
    cs: number | null;
    q0: number | null;
    boxSize: number | null;
  };
  groups: ParticleGroup[];
}

interface ParticleRow {
  slice: number;
  idx1: number;
  x: number;
  y: number;
  fom: number | null;
  maxRes: number | null;
  stackRel: string;
  ownerJobId: string;
}

interface ParticlePageResponse {
  jobId: string;
  group: string;
  offset: number;
  limit: number;
  total: number;
  particles: ParticleRow[];
}

const PAGE_SIZE = 24;

const fmt = (v: number | null | undefined, digits = 2, suffix = "") =>
  v == null ? "—" : `${v.toFixed(digits)}${suffix}`;

/** CTF-fit FOM health colour (matches the CTF quality panel grading) */
const fomTone = (fom: number) =>
  fom >= 0.08 ? "text-emerald-600 dark:text-emerald-400" : fom >= 0.05 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";

function chip(children: React.ReactNode, title?: string) {
  return (
    <span
      title={title}
      className="rounded bg-muted/60 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground"
    >
      {children}
    </span>
  );
}

/** one micrograph's stack: montage preview + stats + expandable particle grid */
function GroupSection({
  jobId,
  group,
}: {
  jobId: string;
  group: ParticleGroup;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<ParticlePageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoomed, setZoomed] = useState<ParticleRow | null>(null);

  const fileUrl = (p: { stackRel: string; ownerJobId: string; slice: number }, large = false) =>
    `/api/jobs/${p.ownerJobId}/outputs/file?path=${encodeURIComponent(p.stackRel)}&montage=0&format=png` +
    `&slice=${p.slice}${large ? "&scale=large" : ""}`;

  const loadPage = useCallback(
    async (off: number) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/jobs/${jobId}/particles?group=${encodeURIComponent(group.name)}&offset=${off}&limit=${PAGE_SIZE}`,
          { cache: "no-store" }
        );
        if (res.ok) setPage((await res.json()) as ParticlePageResponse);
      } finally {
        setLoading(false);
      }
    },
    [jobId, group.name]
  );

  useEffect(() => {
    if (open && !page) void loadPage(0);
  }, [open, page, loadPage]);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* row header: montage preview + stats + toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-2.5 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
        title={`${group.count} particles in this micrograph's stack — ${open ? "collapse" : "expand to browse"}`}
      >
        {/* montage of the first 12 particles */}
        <div className="w-28 shrink-0">
          <MrcImage
            src={`/api/jobs/${group.ownerJobId}/outputs/file?path=${encodeURIComponent(group.stackRel)}&montage=12&format=png`}
            alt={`First particles of ${group.name}`}
            className="aspect-[4/3]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs font-medium" title={group.name}>
            {group.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {chip(<>{group.count.toLocaleString()} particles</>)}
            {group.meanFom != null ? (
              <span className={cn("rounded bg-muted/60 px-1.5 py-px text-[10px] font-medium tabular-nums", fomTone(group.meanFom))} title="Mean CTF figure of merit">
                FOM {group.meanFom.toFixed(3)}
              </span>
            ) : null}
            {group.worstRes != null
              ? chip(<>fits to {group.worstRes.toFixed(1)} Å</>, "Best resolution the CTF model still fits on this micrograph")
              : null}
            {group.ownerJobId !== jobId ? chip(<>stack via upstream job</>, "Stack lives in the upstream Extract job — images render through its file API") : null}
          </div>
        </div>
        <ChevronsUpDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {/* expanded: paginated single-particle grid */}
      {open ? (
        <div className="border-t bg-muted/20 p-2.5">
          {loading && !page ? (
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8" aria-busy="true" aria-label="Loading particles">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
              ))}
            </div>
          ) : page ? (
            <>
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                {page.particles.map((p) => (
                  <button
                    key={p.idx1}
                    type="button"
                    onClick={() => setZoomed(p)}
                    className="group relative overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={`Particle #${p.idx1} — (${Math.round(p.x)}, ${Math.round(p.y)}) — click to enlarge`}
                  >
                    <MrcImage src={fileUrl(p)} alt={`Particle ${p.idx1} of ${group.name}`} className="aspect-square" />
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/85 to-transparent px-0.5 pb-px pt-2 text-[8px] font-semibold tabular-nums text-zinc-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      #{p.idx1}
                    </span>
                  </button>
                ))}
              </div>
              {/* pagination */}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {page.offset + 1}–{Math.min(page.offset + page.particles.length, page.total)} of{" "}
                  {page.total.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page.offset === 0 || loading}
                    onClick={() => {
                      const off = Math.max(0, page.offset - PAGE_SIZE);
                      void loadPage(off);
                    }}
                    aria-label="Previous particle page"
                    className="rounded border bg-card p-1 text-muted-foreground outline-none transition-colors hover:bg-muted disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={page.offset + PAGE_SIZE >= page.total || loading}
                    onClick={() => {
                      const off = page.offset + PAGE_SIZE;
                      void loadPage(off);
                    }}
                    aria-label="Next particle page"
                    className="rounded border bg-card p-1 text-muted-foreground outline-none transition-colors hover:bg-muted disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="px-1 py-3 text-center text-[11px] text-muted-foreground">
              No particles returned for this micrograph
            </p>
          )}
        </div>
      ) : null}

      {/* single-particle lightbox */}
      <Dialog open={zoomed != null} onOpenChange={(o) => !o && setZoomed(null)}>
        <DialogContent className="max-w-md">
          {zoomed ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-sm">
                  Particle #{zoomed.idx1} · {group.name}
                </DialogTitle>
                <DialogDescription className="tabular-nums">
                  picked at ({Math.round(zoomed.x)}, {Math.round(zoomed.y)}) px ·{" "}
                  {zoomed.fom != null ? `CTF FOM ${zoomed.fom.toFixed(3)}` : "no CTF stats"}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center rounded-xl bg-zinc-950 p-4">
                <MrcImage
                  src={fileUrl(zoomed, true)}
                  alt={`Enlarged particle ${zoomed.idx1}`}
                  className="w-64"
                />
              </div>
              <p className="text-center text-[10px] text-muted-foreground">
                {zoomed.maxRes != null ? `CTF fits to ${zoomed.maxRes.toFixed(1)} Å` : "—"} · box{" "}
                128 px · slice {zoomed.slice} of the micrograph stack
              </p>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ParticleBrowser({
  jobId,
  className,
}: {
  jobId: string;
  className?: string;
}) {
  const [data, setData] = useState<ParticlesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/particles`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as ParticlesResponse;
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
  if (!data || data.groups.length === 0) return null;

  const o = data.optics;

  return (
    <section
      aria-label="Particle stack browser"
      className={cn(
        "rounded-lg border border-violet-500/25 bg-gradient-to-b from-violet-500/5 to-transparent p-3",
        className
      )}
    >
      {/* header */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Grid3x3 className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
          Particle stacks
        </span>
        {chip(
          <>
            <Layers className="mr-0.5 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
            {data.total.toLocaleString()} particles
          </>,
          "Total extracted particles across all micrograph stacks"
        )}
        {o.boxSize ? chip(<>{o.boxSize} px box</>) : null}
        {o.pixelSize ? chip(<>@ {o.pixelSize} Å/px</>) : null}
        {o.voltage ? chip(<>{Math.round(o.voltage)} kV</>) : null}
        {chip(<>{data.groups.length} micrographs</>)}
      </div>

      {/* per-micrograph stack sections */}
      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {data.groups.map((g) => (
          <GroupSection key={g.name} jobId={jobId} group={g} />
        ))}
      </div>

      <p className="mt-1.5 text-[10px] text-muted-foreground">
        <MousePointerClick className="mr-0.5 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
        expand a micrograph to page through its particles · click a box for coordinates + CTF
        quality · FOM colours follow the CTF panel grading
      </p>
    </section>
  );
}
