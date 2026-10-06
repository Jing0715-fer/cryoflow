"use client";

/**
 * CryoFlow — particle orientation distribution polar heatmap.
 *
 * Classic cryo-EM QC: after 3D classification/refinement every particle has
 * an orientation (rot φ 0–360°, tilt θ 0–180°). This plot bins all particles
 * into a 24×12 polar grid — radius maps tilt (0° centre, 180° edge), the
 * sweep maps rot — and colours each annular sector by occupancy (sqrt
 * scale). Strong single spots ⇒ preferred orientation ⇒ anisotropic FSC.
 *
 * Data: /api/jobs/[id]/angdist (latest run_itXXX_data.star, live while running).
 */

import { useMemo, useState } from "react";
import { CheckCircle2, Compass, Flame, RadioTower, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { useChartResource } from "@/lib/use-chart-resource";
import { angDistRenderable, angDistRows, type AngDistResponse } from "@/lib/chart-rows";
import { ChartExportButtons } from "./chart-export-buttons";
import { ChartErrorStrip } from "./chart-error-strip";
import { ChartInterpretation } from "./interpretation-strip";

const SIZE = 236;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_R = 96;
const TEAL = "#0d9488"; // teal-600 — dense on light and dark cards alike

interface Hovered {
  rotIdx: number;
  tiltIdx: number;
  count: number;
}

/** Annular sector path for one polar cell (small gaps for a crisp grid). */
function sectorPath(rotIdx: number, tiltIdx: number, rotBins: number, tiltBins: number): string {
  const padAngle = (Math.PI * 2) / rotBins * 0.06;
  const padR = 0.6;
  const r0 = (tiltIdx / tiltBins) * MAX_R + (tiltIdx === 0 ? 0 : padR);
  const r1 = ((tiltIdx + 1) / tiltBins) * MAX_R - padR;
  const a0 = (rotIdx / rotBins) * Math.PI * 2 - Math.PI / 2 + padAngle;
  const a1 = ((rotIdx + 1) / rotBins) * Math.PI * 2 - Math.PI / 2 - padAngle;
  const x = (r: number, a: number) => (CX + r * Math.cos(a)).toFixed(2);
  const y = (r: number, a: number) => (CY + r * Math.sin(a)).toFixed(2);
  return [
    `M ${x(r1, a0)} ${y(r1, a0)}`,
    `A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 0 1 ${x(r1, a1)} ${y(r1, a1)}`,
    `L ${x(r0, a1)} ${y(r0, a1)}`,
    `A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 0 0 ${x(r0, a0)} ${y(r0, a0)}`,
    "Z",
  ].join(" ");
}

export function AngularDistributionChart({
  jobId,
  running,
  className,
}: {
  jobId: string;
  /** live jobs poll every 30 s — a new iteration refreshes the assignment. */
  running?: boolean;
  className?: string;
}) {
  // t491 — shared fetch state machine; the error state used to be captured
  // and then thrown away visually ("error && !data → null") — a wound read
  // exactly like honest absence
  const { status, data, error, retry } = useChartResource<AngDistResponse>(
    `/api/jobs/${jobId}/angdist`,
    { pollMs: running ? 30_000 : null }
  );
  const [hovered, setHovered] = useState<Hovered | null>(null);

  const rings = useMemo(() => {
    // dashed rings at tilt 30/60/90/120/150 + labels along the +x axis
    const out: { r: number; deg: number }[] = [];
    for (const deg of [30, 60, 90, 120, 150]) {
      out.push({ r: (deg / 180) * MAX_R, deg });
    }
    return out;
  }, []);

  if (status === "wounded") {
    return (
      <ChartErrorStrip
        label="Angular distribution"
        detail={error ?? undefined}
        onRetry={retry}
        className={className}
      />
    );
  }
  // gate single-sourced in lib/chart-rows (t110: the palette exports the
  // same grid through the same predicate); !data first so TS narrows below
  if (!data || !angDistRenderable(data)) return null;

  const { cells, max, rotBins, tiltBins, total } = data;
  // t489 — the verdict is the WELL's judgment (interpretAngDist): the >6
  // concentration threshold lives there, not re-computed per face
  const interp = data.interpretation ?? null;
  const anisotropic = interp?.verdict === "anisotropic";
  const iterLabel = data.iteration != null ? `it ${data.iteration}` : "final";

  const rotDeg = (hovered?.rotIdx ?? 0) * (360 / rotBins);
  const tiltDeg = (hovered?.tiltIdx ?? 0) * (180 / tiltBins);

  return (
    <section
      aria-label="Orientation distribution"
      data-chart-export-root
      className={cn(
        "animate-rise rounded-lg border border-running/25 bg-gradient-to-b from-running-600/5 to-transparent p-3",
        className
      )}
    >
      {/* header row */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Compass className="h-3.5 w-3.5 text-running-600" aria-hidden="true" />
          Orientation distribution
        </span>
        {running ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-running/30 bg-running/10 px-1.5 py-px text-[10px] font-medium text-running-700 dark:text-running-300">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-running-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-running-500" />
            </span>
            live
          </span>
        ) : null}
        <Chip size="sm" tone="muted">
          <RadioTower aria-hidden="true" />
          {total.toLocaleString()} particles · {iterLabel}
        </Chip>
        <ChartExportButtons
          name="Orientation distribution"
          getRows={() => angDistRows(data)}
          className="ml-auto"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* polar heatmap */}
        <div className="relative mx-auto shrink-0">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width={SIZE}
            height={SIZE}
            role="img"
            aria-label={`Polar heatmap of ${total} particle orientations, ${rotBins}×${tiltBins} bins`}
            className="select-none"
          >
            {/* tilt rings */}
            {rings.map(({ r, deg }) => (
              <g key={deg}>
                <circle
                  cx={CX}
                  cy={CY}
                  r={r}
                  fill="none"
                  stroke="currentColor"
                  className="text-muted-foreground/30"
                  strokeWidth={0.6}
                  strokeDasharray={deg === 90 ? undefined : "2 3"}
                />
                <text
                  x={CX + r + 2}
                  y={CY - 2}
                  className="fill-muted-foreground/70"
                  style={{ fontSize: 6.5, fontVariantNumeric: "tabular-nums" }}
                >
                  {deg}°
                </text>
              </g>
            ))}
            {/* rot spokes */}
            {[0, 90, 180, 270].map((deg) => {
              const a = (deg / 360) * Math.PI * 2 - Math.PI / 2;
              return (
                <line
                  key={deg}
                  x1={CX}
                  y1={CY}
                  x2={CX + MAX_R * Math.cos(a)}
                  y2={CY + MAX_R * Math.sin(a)}
                  stroke="currentColor"
                  className="text-muted-foreground/30"
                  strokeWidth={0.6}
                />
              );
            })}
            {/* heat cells */}
            {cells.map((count, idx) => {
              if (count === 0) return null;
              const rotIdx = Math.floor(idx / tiltBins);
              const tiltIdx = idx % tiltBins;
              const t = max > 0 ? Math.sqrt(count / max) : 0; // sqrt scale: faint cells stay visible
              const opacity = 0.12 + 0.83 * t;
              const isHover = hovered?.rotIdx === rotIdx && hovered?.tiltIdx === tiltIdx;
              return (
                <path
                  key={idx}
                  d={sectorPath(rotIdx, tiltIdx, rotBins, tiltBins)}
                  fill={TEAL}
                  fillOpacity={opacity}
                  stroke={isHover ? "#0f766e" : "transparent"}
                  strokeWidth={isHover ? 1.2 : 0}
                  className="cursor-crosshair transition-[fill-opacity] duration-150"
                  style={{ fillOpacity: isHover ? Math.min(1, opacity + 0.15) : opacity }}
                  onMouseEnter={() => setHovered({ rotIdx, tiltIdx, count })}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
            {/* outer circle + rot labels */}
            <circle cx={CX} cy={CY} r={MAX_R} fill="none" stroke="currentColor" className="text-muted-foreground/50" strokeWidth={0.9} />
            {[0, 90, 180, 270].map((deg) => {
              const a = (deg / 360) * Math.PI * 2 - Math.PI / 2;
              const lx = CX + (MAX_R + 10) * Math.cos(a);
              const ly = CY + (MAX_R + 10) * Math.sin(a);
              return (
                <text
                  key={deg}
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground/80"
                  style={{ fontSize: 7, fontVariantNumeric: "tabular-nums" }}
                >
                  rot {deg}°
                </text>
              );
            })}
            {/* centre marker: tilt 0 (view along z) */}
            <circle cx={CX} cy={CY} r={1.4} className="fill-muted-foreground/60" />
          </svg>

          {/* hover tooltip */}
          {hovered ? (
            <div
              role="status"
              className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-[10px] font-medium tabular-nums text-popover-foreground shadow-md"
            >
              rot {rotDeg}–{rotDeg + 360 / rotBins}° · tilt {tiltDeg}–{tiltDeg + 180 / tiltBins}°
              <span className="ml-1.5 text-running">
                {hovered.count} ({((hovered.count / total) * 100).toFixed(1)}%)
              </span>
            </div>
          ) : null}
        </div>

        {/* legend + quality verdict */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
              <span>particles per bin</span>
              <span className="tabular-nums">
                0 → {max}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full border"
              aria-hidden="true"
              style={{
                background: `linear-gradient(to right, ${TEAL}1f, ${TEAL}66 45%, ${TEAL}f2)`,
              }}
            />
            <p className="mt-1 text-[9.5px] leading-tight text-muted-foreground/80">
              radius = tilt θ (0°–180°) · sweep = rot φ · sqrt colour scale
            </p>
          </div>

          {/* t489 — the coverage strip speaks the tool's exact grammar
              (interpretAngDist): the verdict word, the rounded
              concentration, the bins populated — the same judgment the
              agent quotes when asked whether orientations are even. The
              loader attaches the interpretation whenever the panel
              renders (total > 0), so no fallback re-judges here. */}
          {interp && (
            <ChartInterpretation
              icon={anisotropic ? TriangleAlert : CheckCircle2}
              tone={anisotropic ? "amber" : "emerald"}
              label="Coverage"
            >
              {interp.verdict} — concentration ×{interp.concentration},{" "}
              {data.occupied}/{rotBins * tiltBins} bins populated
            </ChartInterpretation>
          )}

          {/* t489 — the three hottest direction bins: the heatmap shows
              them, the tool names them, and now the strip names them too
              — one grammar, the panel = model can quote. */}
          {interp && interp.hottestBins.length > 0 && (
            <ChartInterpretation icon={Flame} tone="fuchsia" label="Hottest bins">
              {interp.hottestBins.map((b, i) => (
                <span key={`${b.rotBin}-${b.tiltBin}`}>
                  {i > 0 && <span className="opacity-50"> · </span>}
                  rot {b.rotBin} · tilt {b.tiltBin}
                  <span className="opacity-70"> ×{b.count.toLocaleString()}</span>
                </span>
              ))}
            </ChartInterpretation>
          )}

          {interp && anisotropic ? (
            <p className="text-[9.5px] leading-tight text-muted-foreground/80">
              Preferred orientation can bias the map along the missing directions.
            </p>
          ) : null}

          {data.symmetry ? (
            <p className="text-[10px] text-muted-foreground">
              symmetry <span className="font-semibold text-foreground/80">{data.symmetry}</span>{" "}
              · clustered spots mirror the point group
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
