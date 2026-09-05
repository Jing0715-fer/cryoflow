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
 */

import { useEffect, useState } from "react";
import { Aperture, Grid3x3, ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MrcImage } from "./mrc-image";

interface MicrographEntry {
  path: string;
  name: string;
  size: number;
  nx: number;
  ny: number;
}

interface MicrographsResponse {
  total: number;
  pixelSize: number | null;
  voltage: number | null;
  sphericalAberration: number | null;
  amplitudeContrast: number | null;
  micrographs: MicrographEntry[];
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

function Chip({ label, value }: { label: string; value: string | null }) {
  if (value == null) return null;
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] tabular-nums">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground/80">{value}</span>
    </span>
  );
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
  const [selected, setSelected] = useState<MicrographEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/micrographs`, { cache: "no-store" });
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
  }, [jobId]);

  if (error && !data) return null; // enhancement — silent when unavailable
  if (!data || data.micrographs.length === 0) return null;

  const fileUrl = (relPath: string, extra = "") =>
    `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(relPath)}&format=png${extra}`;

  const withDims = data.micrographs.filter((m) => m.nx > 0);
  const dims =
    withDims.length > 0
      ? `${withDims[0].nx}×${withDims[0].ny} px`
      : null;

  return (
    <section
      aria-label="Source micrographs"
      className={cn(
        "rounded-lg border border-teal-600/25 bg-gradient-to-b from-teal-600/5 to-transparent p-3",
        className
      )}
    >
      {/* header */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Aperture className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
          Source micrographs
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
          <Grid3x3 className="h-3 w-3" aria-hidden="true" />
          {data.total}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          <Chip label="pixel" value={data.pixelSize != null ? `${data.pixelSize} Å` : null} />
          <Chip label="HT" value={data.voltage != null ? `${data.voltage} kV` : null} />
          <Chip label="Cs" value={data.sphericalAberration != null ? `${data.sphericalAberration} mm` : null} />
          <Chip label="Q0" value={data.amplitudeContrast != null ? `${data.amplitudeContrast}` : null} />
        </div>
      </div>

      {/* thumbnail grid */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
        {data.micrographs.map((m) => (
          <button
            key={m.path}
            type="button"
            onClick={() => setSelected(m)}
            className="group relative overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={`${m.name} — ${m.nx}×${m.ny} px · ${formatBytes(m.size)} — click to enlarge`}
          >
            <MrcImage src={fileUrl(m.path)} alt={`Micrograph ${m.name}`} className="aspect-square" />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-zinc-950/85 to-transparent px-1 pb-0.5 pt-2 text-[8.5px] font-medium text-zinc-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {m.name}
            </span>
            <span className="pointer-events-none absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-sm bg-zinc-950/70 text-zinc-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <ImageIcon className="size-2.5" aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>

      {dims ? (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {dims} detector frames · click a thumbnail for the full contrast-stretched view
        </p>
      ) : null}

      {/* lightbox */}
      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate font-mono text-sm">{selected.name}</DialogTitle>
                <DialogDescription className="tabular-nums">
                  {selected.nx}×{selected.ny} px · {formatBytes(selected.size)}
                  {data.pixelSize != null ? ` · ${data.pixelSize} Å/px` : ""}
                  {data.voltage != null ? ` · ${data.voltage} kV` : ""}
                </DialogDescription>
              </DialogHeader>
              <MrcImage
                src={fileUrl(selected.path, "&scale=large")}
                alt={`Micrograph ${selected.name}, full view`}
                className="max-h-[70vh]"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
