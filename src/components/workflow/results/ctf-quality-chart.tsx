"use client";

/**
 * CryoFlow — CTF fit quality panel for CtfFind jobs (CryoSPARC-style
 * "experiment summary"): defocus U vs V scatter (distance to the diagonal =
 * astigmatism) + per-micrograph fit table with FOM / fit resolution.
 *
 * Data: /api/jobs/[id]/ctf parses micrographs_ctf.star.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Focus, Grid3x3, Radar } from "lucide-react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MrcImage } from "./mrc-image";

const TEAL = "#14b8a6";
const AMBER = "#d97706";

interface CtfMicrograph {
  name: string;
  relPath: string;
  defocusU: number;
  defocusV: number;
  astigmatism: number;
  defocusAngle: number;
  fom: number;
  maxResolution: number;
}

interface CtfSummary {
  count: number;
  meanDefocus: number;
  minDefocus: number;
  maxDefocus: number;
  maxAstigmatism: number;
  meanFom: number;
  worstResolution: number;
}

interface CtfResponse {
  micrographs: CtfMicrograph[];
  summary: CtfSummary | null;
}

/** FOM health buckets (ctffind figure of merit 0–1). */
function fomTone(fom: number): string {
  if (fom >= 0.1) return "text-emerald-700 dark:text-emerald-300";
  if (fom >= 0.05) return "text-amber-700 dark:text-amber-300";
  return "text-rose-700 dark:text-rose-300";
}

export function CtfQualityChart({ jobId, className }: { jobId: string; className?: string }) {
  const [data, setData] = useState<CtfResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selected, setSelected] = useState<CtfMicrograph | null>(null);

  const fileUrl = (relPath: string, extra = "") =>
    `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(relPath)}&format=png${extra}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/ctf`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as CtfResponse;
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

  const { micrographs, summary, domain } = useMemo(() => {
    const m = data?.micrographs ?? [];
    if (m.length === 0) return { micrographs: [], summary: null, domain: null as [number, number] | null };
    const values = m.flatMap((r) => [r.defocusU, r.defocusV]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.12, 0.1);
    return { micrographs: m, summary: data?.summary ?? null, domain: [min - pad, max + pad] as [number, number] };
  }, [data]);

  if (error && !data) return null; // enhancement, stay silent
  if (micrographs.length === 0) return null;

  return (
    <section
      aria-label="CTF fit quality"
      className={cn(
        "rounded-lg border border-teal-600/25 bg-gradient-to-b from-teal-600/5 to-transparent p-3",
        className
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Radar className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
          CTF fit quality
          <span className="font-normal text-muted-foreground/70">
            ({summary?.count ?? micrographs.length} micrographs)
          </span>
        </span>
        {summary && (
          <>
            <span className="rounded-full border border-teal-600/30 bg-teal-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-teal-700 dark:text-teal-300">
              defocus {summary.meanDefocus.toFixed(2)} µm
            </span>
            <span className="rounded-full border border-amber-600/30 bg-amber-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              astig ≤ {summary.maxAstigmatism.toFixed(2)} µm
            </span>
            {summary.worstResolution > 0 && (
              <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                fit ≤ {summary.worstResolution.toFixed(1)} Å
              </span>
            )}
          </>
        )}
      </div>

      {/* Defocus U vs V scatter — on-diagonal = no astigmatism. */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 6, right: 12, bottom: 2, left: -14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" opacity={0.5} />
            <XAxis
              type="number"
              dataKey="defocusU"
              domain={domain ?? undefined}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickFormatter={(v: number) => v.toFixed(1)}
              height={20}
              label={{ value: "defocus U (µm)", position: "insideBottomRight", offset: -2, fontSize: 10, fill: "currentColor" }}
            />
            <YAxis
              type="number"
              dataKey="defocusV"
              domain={domain ?? undefined}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickFormatter={(v: number) => v.toFixed(1)}
              width={46}
              label={{ value: "defocus V (µm)", angle: -90, position: "insideLeft", offset: 22, fontSize: 10, fill: "currentColor" }}
            />
            <ZAxis type="number" dataKey="astigmatism" range={[24, 140]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(value: number | string, name: string) => {
                const label = name === "astigmatism" ? "astigmatism" : name;
                return [name === "astigmatism" ? `${Number(value).toFixed(3)} µm` : `${Number(value).toFixed(2)} µm`, label];
              }}
              labelFormatter={() => ""}
              contentStyle={{ fontSize: 11, borderRadius: 6, padding: "4px 8px" }}
            />
            <ReferenceLine
              segment={[
                { x: domain?.[0] ?? 0, y: domain?.[0] ?? 0 },
                { x: domain?.[1] ?? 1, y: domain?.[1] ?? 1 },
              ]}
              stroke={AMBER}
              strokeDasharray="5 4"
              opacity={0.7}
            />
            <Scatter
              data={micrographs}
              fill={TEAL}
              fillOpacity={0.75}
              stroke={TEAL}
              strokeWidth={1}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Per-micrograph fit table (compact, scrollable). */}
      <div className="mt-2 overflow-hidden rounded-md border">
        <table className="w-full table-fixed text-[10.5px]">
          <thead>
            <tr className="bg-muted/60 text-left text-[9.5px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-1 font-medium">micrograph</th>
              <th className="w-16 px-1 py-1 text-right font-medium">defocus</th>
              <th className="w-14 px-1 py-1 text-right font-medium">astig</th>
              <th className="w-12 px-1 py-1 text-right font-medium">FOM</th>
              <th className="w-14 px-2 py-1 text-right font-medium">fit Å</th>
            </tr>
          </thead>
        </table>
        <div className="max-h-36 overflow-y-auto nice-scroll">
          <table className="w-full table-fixed text-[10.5px]">
            <tbody>
              {micrographs.map((m) => (
                <tr
                  key={m.name}
                  className="border-t border-border/60 hover:bg-muted/40"
                  title={`${m.name} — defocus ${m.defocusU.toFixed(3)}×${m.defocusV.toFixed(3)} µm @ ${m.defocusAngle.toFixed(0)}°, astig ${m.astigmatism.toFixed(3)} µm, FOM ${m.fom.toFixed(3)}, fit ${m.maxResolution.toFixed(1)} Å`}
                >
                  <td className="truncate px-2 py-1 font-mono text-[10px] text-foreground/80">
                    {m.name.split("/").pop()}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums text-foreground/75">
                    {((m.defocusU + m.defocusV) / 2).toFixed(2)}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums text-foreground/75">
                    {m.astigmatism.toFixed(2)}
                  </td>
                  <td className={cn("px-1 py-1 text-right font-semibold tabular-nums", fomTone(m.fom))}>
                    {m.fom.toFixed(3)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-foreground/75">
                    {m.maxResolution > 0 ? m.maxResolution.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Focus className="size-3 shrink-0" aria-hidden="true" />
        Point size encodes astigmatism; the dashed diagonal marks zero astigmatism.
      </p>

      {/* Micrograph thumbnails (lazy, collapsed by default). */}
      <div className="mt-2.5">
        <button
          type="button"
          onClick={() => setGalleryOpen((v) => !v)}
          aria-expanded={galleryOpen}
          className="flex w-full items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          <Grid3x3 className="size-3.5 shrink-0" aria-hidden="true" />
          Micrographs
          <span className="font-normal text-muted-foreground/70">({micrographs.length})</span>
          <ChevronDown
            className={cn("ml-auto size-3.5 shrink-0 transition-transform duration-200", galleryOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {galleryOpen && (
          <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
            {micrographs.map((m) => (
              <button
                key={m.relPath}
                type="button"
                onClick={() => setSelected(m)}
                className="group relative overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={`${m.name} — defocus ${((m.defocusU + m.defocusV) / 2).toFixed(2)} µm, FOM ${m.fom.toFixed(3)}, fit ${m.maxResolution.toFixed(1)} Å — click to enlarge`}
              >
                <MrcImage
                  src={fileUrl(m.relPath)}
                  alt={`Micrograph ${m.name}`}
                  className="aspect-square"
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-zinc-950/85 to-transparent px-1 pb-0.5 pt-2 text-[8.5px] font-medium text-zinc-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  {m.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox: full-size micrograph + CTF fit numbers. */}
      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate font-mono text-sm">{selected.name}</DialogTitle>
                <DialogDescription className="tabular-nums">
                  defocus {selected.defocusU.toFixed(3)} × {selected.defocusV.toFixed(3)} µm @ {selected.defocusAngle.toFixed(0)}° · astig {selected.astigmatism.toFixed(3)} µm · FOM {selected.fom.toFixed(3)} · fit {selected.maxResolution.toFixed(1)} Å
                </DialogDescription>
              </DialogHeader>
              <MrcImage
                src={fileUrl(selected.relPath, "&scale=large")}
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
