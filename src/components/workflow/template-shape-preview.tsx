"use client";

/**
 * CryoFlow — hover preview of a saved template's SHAPE.
 *
 * The shelf row reads "name · N jobs · M wires · date" — numbers, not
 * geometry. The only way to SEE what a template looks like used to be
 * applying it (an action, with side effects). This hover card closes that
 * gap: it renders the payload as a miniature of the canvas — same card
 * colors (spec.color), same port math (portY), same fine dot grid — so a
 * hover answers "what does this branch look like?" before any commit.
 *
 * The list endpoint is deliberately light (no payload — Task 127), so the
 * preview lazily fetches GET ?id= on first open and caches the payload in
 * a module-level Map: the cache outlives the dialog (unmount-on-close is
 * Radix's default), so the first hover costs one GET and every later
 * hover is instant. Failures are honest (an error row) and NOT cached —
 * a transient 500 retries on the next hover.
 *
 * The diagram is a READING, not a router: edges are plain forward beziers
 * (no obstacle detours, no fan spread) — a saved selection is authored
 * left-to-right, so the shape reads cleanly without the canvas's full
 * edge geometry. Backward wires draw their honest fold-back loop.
 */

import * as React from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import type { CustomTemplatePayload } from "@/lib/types";
import { CARD_H, CARD_W, jobType, portY } from "@/lib/workflow";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

/** Payloads already fetched this session — keyed by template id. */
const payloadCache = new Map<string, CustomTemplatePayload>();

/**
 * PortKind → stroke hex. SVG can't take Tailwind bg classes and dynamic
 * class names don't compile, so the 500-steps behind PORT_COLORS' dot
 * fragments are mirrored here (kept in one table, next to its only use).
 */
const STROKE_HEX: Record<string, string> = {
  movies: "#06b6d4",
  micrographs: "#14b8a6",
  coords: "#f59e0b",
  particles: "#8b5cf6",
  references2d: "#f43f5e",
  volume: "#f97316",
  halfmap: "#ec4899",
  mask: "#10b981",
  model: "#d946ef",
  star: "#64748b",
  tiltseries: "#06b6d4",
  tomograms: "#14b8a6",
};

const FALLBACK_STROKE = "#64748b";

/** Preview area budget (px): w-72 card minus px-3 padding; height cap. */
const AVAIL_W = 264;
const AVAIL_H = 224;
/** Scale floor — chips never shrink past legibility; the card grows. */
const MIN_SCALE = 0.26;

interface Shaped {
  payload: CustomTemplatePayload;
  minX: number;
  minY: number;
  w: number;
  h: number;
  s: number;
}

/** Bounding box → screen scale. A template's dx/dy are bbox-relative
 * already (Task 127), so the shape sits at the origin naturally. */
function shapeOf(payload: CustomTemplatePayload): Shaped | null {
  const jobs = payload.jobs ?? [];
  if (jobs.length === 0) return null;
  const minX = Math.min(...jobs.map((j) => j.dx));
  const minY = Math.min(...jobs.map((j) => j.dy));
  const maxX = Math.max(...jobs.map((j) => j.dx + CARD_W));
  const maxY = Math.max(...jobs.map((j) => j.dy + CARD_H));
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const s = Math.max(MIN_SCALE, Math.min(1, AVAIL_W / bw, AVAIL_H / bh));
  return { payload, minX, minY, w: bw * s, h: bh * s, s };
}

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; shaped: Shaped };

function TemplateShapePreview({ id, name }: { id: string; name: string }) {
  const [status, setStatus] = React.useState<Status>(() => {
    if (!payloadCache.has(id)) return { kind: "loading" };
    const shaped = shapeOf(payloadCache.get(id)!);
    return shaped
      ? { kind: "ready", shaped }
      : { kind: "error", message: "This template has no jobs to preview" };
  });

  React.useEffect(() => {
    const cached = payloadCache.get(id);
    if (cached) {
      const shaped = shapeOf(cached);
      setStatus(
        shaped
          ? { kind: "ready", shaped }
          : { kind: "error", message: "This template has no jobs to preview" }
      );
      return;
    }
    let live = true;
    setStatus({ kind: "loading" });
    fetch(`/api/custom-template?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { template?: { payload?: CustomTemplatePayload } };
      })
      .then((body) => {
        if (!live) return;
        const payload = body?.template?.payload;
        if (!payload || !Array.isArray(payload.jobs) || payload.jobs.length === 0) {
          setStatus({ kind: "error", message: "This template has no jobs to preview" });
          return;
        }
        payloadCache.set(id, payload);
        const shaped = shapeOf(payload);
        setStatus(
          shaped
            ? { kind: "ready", shaped }
            : { kind: "error", message: "This template has no jobs to preview" }
        );
      })
      .catch(() => {
        // NOT cached — the next hover retries (transient failures heal)
        if (live) setStatus({ kind: "error", message: "Preview unavailable" });
      });
    return () => {
      live = false;
    };
  }, [id]);

  return (
    <div data-testid="template-shape-preview" data-template-id={id}>
      <div className="flex items-center gap-1.5 px-3 pb-2 pt-2.5">
        <span className="truncate text-xs font-medium" title={name}>
          {name}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          shape
        </span>
      </div>
      {status.kind === "loading" && (
        <div className="flex h-24 items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Loading shape…
        </div>
      )}
      {status.kind === "error" && (
        <div className="flex h-24 items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <TriangleAlert className="size-3.5" aria-hidden="true" />
          {status.message}
        </div>
      )}
      {status.kind === "ready" && status.shaped && <ShapeDiagram shaped={status.shaped} />}
      {status.kind === "ready" && (
        <p className="px-3 pb-2.5 pt-2 text-[10px] leading-snug text-muted-foreground">
          Apply drops this shape below the workspace content — parameters ride along.
        </p>
      )}
    </div>
  );
}

/** The miniature itself: absolutely-positioned chips + one SVG for wires. */
function ShapeDiagram({ shaped }: { shaped: Shaped }) {
  const { payload, minX, minY, w, h, s } = shaped;

  const edges = (payload.edges ?? [])
    .map((e) => {
      const from = payload.jobs[e.from];
      const to = payload.jobs[e.to];
      if (!from || !to) return null; // corrupt row — skip, don't stall
      const fromSpec = jobType(from.type);
      const toSpec = jobType(to.type);
      const outIdx = Math.max(0, fromSpec?.outputs.findIndex((p) => p.name === e.fromPort) ?? 0);
      const inIdx = Math.max(0, toSpec?.inputs.findIndex((p) => p.name === e.toPort) ?? 0);
      const nOut = Math.max(1, fromSpec?.outputs.length ?? 0);
      const nIn = Math.max(1, toSpec?.inputs.length ?? 0);
      const sx = (from.dx + CARD_W - minX) * s;
      const sy = (from.dy + portY(outIdx, nOut) - minY) * s;
      const ex = (to.dx - minX) * s;
      const ey = (to.dy + portY(inIdx, nIn) - minY) * s;
      const kind = fromSpec?.outputs.find((p) => p.name === e.fromPort)?.kind;
      const stroke = (kind && STROKE_HEX[kind]) || FALLBACK_STROKE;
      // scaled forward bezier (MIN_CTRL shrinks with the scale, floored);
      // backward wires draw their honest fold-back loop
      const reach = Math.max(8, Math.abs(ex - sx) * 0.42);
      const d = `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${(sx + reach).toFixed(1)} ${sy.toFixed(1)}, ${(ex - reach).toFixed(1)} ${ey.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`;
      return { key: `${e.from}-${e.to}-${e.fromPort ?? ""}-${e.toPort ?? ""}`, d, stroke, sx, sy, ex, ey };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="px-3">
      <div
        className="canvas-grid-fine relative mx-auto overflow-hidden rounded-md border bg-background/60"
        style={{ width: `${Math.round(w)}px`, height: `${Math.round(h)}px` }}
        data-testid="template-preview-diagram"
      >
        <svg className="pointer-events-none absolute inset-0" width={w} height={h} aria-hidden="true">
          {edges.map((e) => (
            <path
              key={e.key}
              d={e.d}
              fill="none"
              stroke={e.stroke}
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={0.8}
              data-testid="template-preview-edge"
            />
          ))}
          {edges.map((e) => (
            <g key={`${e.key}-dots`}>
              <circle cx={e.sx} cy={e.sy} r={2} fill={e.stroke} />
              <circle cx={e.ex} cy={e.ey} r={2} fill={e.stroke} />
            </g>
          ))}
        </svg>
        {payload.jobs.map((j, i) => {
          const spec = jobType(j.type);
          const label = spec?.label ?? j.type;
          return (
            <div
              key={`${j.type}-${i}`}
              className={cn(
                "absolute overflow-hidden rounded border bg-card",
                spec ? spec.color.border : "border-slate-400"
              )}
              style={{
                left: `${((j.dx - minX) * s).toFixed(1)}px`,
                top: `${((j.dy - minY) * s).toFixed(1)}px`,
                width: `${(CARD_W * s).toFixed(1)}px`,
                height: `${(CARD_H * s).toFixed(1)}px`,
              }}
              data-testid="template-preview-node"
              data-node-label={label}
              title={`${label}${j.type === label ? "" : ` (${j.type})`}`}
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-1 opacity-80",
                  spec ? spec.color.bg : "bg-slate-400"
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "flex h-full items-center truncate pl-2 pr-1 text-[9px] font-medium leading-tight",
                  spec ? spec.color.text : "text-slate-600 dark:text-slate-300"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * HoverCard wrapper for a shelf row's identity block. The trigger is the
 * name/meta area only — the row's action buttons (Apply/Download/Delete)
 * stay outside it, so hover-to-peek never swallows a click target.
 */
export function TemplateShapeHoverCard({
  id,
  name,
  children,
}: {
  id: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <HoverCard openDelay={350} closeDelay={120}>
      <HoverCardTrigger asChild>
        <div className="min-w-0 flex-1 cursor-default" data-testid="custom-template-hover-zone">
          {children}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-72 p-0">
        <TemplateShapePreview id={id} name={name} />
      </HoverCardContent>
    </HoverCard>
  );
}
