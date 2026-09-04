"use client";

/**
 * CryoFlow — canvas minimap (n8n-style navigation overview).
 *
 * A live bird's-eye of the whole workspace: job rectangles colored by
 * status, edge polylines, and the current viewport window. Click or drag
 * anywhere on it to jump the viewport (zoom is preserved). Rendered as a
 * single tiny SVG whose viewBox IS the canvas coordinate system, so every
 * element is drawn in workspace coordinates for free.
 */

import * as React from "react";
import { useWorkflowStore, useActiveWorkspaceJobs, useActiveWorkspaceEdges } from "@/lib/store";
import { CARD_W, CARD_H } from "@/lib/workflow";

const MM_W = 192;
const MM_MIN_H = 88;
const MM_MAX_H = 264;

/** padding (world px) around the minimap's world box */
const MM_PAD = 160;

/** status → minimap fill (hex: SVG attrs don't take Tailwind classes) */
const STATUS_FILL: Record<string, string> = {
  idle: "#a1a1aa",
  running: "#14b8a6",
  completed: "#10b981",
  failed: "#f43f5e",
};

interface CanvasMinimapProps {
  /** the canvas viewport element — measured for the viewport window rect */
  rootRef: React.RefObject<HTMLDivElement | null>;
}

export function CanvasMinimap({ rootRef }: CanvasMinimapProps) {
  const jobs = useActiveWorkspaceJobs();
  const edges = useActiveWorkspaceEdges();
  const selectedId = useWorkflowStore((s) => s.selectedId);
  const viewport = useWorkflowStore((s) => s.viewport);
  const setViewport = useWorkflowStore((s) => s.setViewport);

  const svgRef = React.useRef<SVGSVGElement>(null);
  const draggingRef = React.useRef(false);

  // measure the canvas viewport size (ResizeObserver — pan/zoom don't
  // resize it, but the responsive layout does)
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rootRef]);

  /** center the canvas viewport on workspace point (wx, wy) */
  const navigate = (wx: number, wy: number) => {
    if (size.w === 0) return;
    const s = useWorkflowStore.getState();
    setViewport({
      x: size.w / 2 - wx * s.viewport.zoom,
      y: size.h / 2 - wy * s.viewport.zoom,
      zoom: s.viewport.zoom,
    });
  };

  /** client coords → world coords (via the svg bounding box + viewBox) */
  const toWorld = (e: React.PointerEvent): { x: number; y: number } | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    const vb = worldBox;
    if (!rect || !vb) return null;
    return {
      x: vb.x + ((e.clientX - rect.left) / rect.width) * vb.w,
      y: vb.y + ((e.clientY - rect.top) / rect.height) * vb.h,
    };
  };

  if (jobs.length === 0) return null;

  // viewport window in WORLD coordinates:
  // screen = vx + wx·zoom  →  wx = (screen − vx) / zoom
  const zoom = viewport.zoom;
  const view = {
    x: -viewport.x / zoom,
    y: -viewport.y / zoom,
    w: size.w / zoom,
    h: size.h / zoom,
  };

  // infinite canvas: the minimap frames the union of the content bbox
  // and the current viewport window (so you always see where you are,
  // even when panned far into empty space)
  const vx0 = Math.min(view.x, ...jobs.map((j) => j.x)) - MM_PAD;
  const vy0 = Math.min(view.y, ...jobs.map((j) => j.y)) - MM_PAD;
  const vx1 = Math.max(
    view.x + view.w,
    ...jobs.map((j) => j.x + CARD_W)
  ) + MM_PAD;
  const vy1 = Math.max(
    view.y + view.h,
    ...jobs.map((j) => j.y + CARD_H)
  ) + MM_PAD;
  const world = { x: vx0, y: vy0, w: vx1 - vx0, h: vy1 - vy0 };
  const worldBox = world;

  const mmH = Math.round(
    Math.min(MM_MAX_H, Math.max(MM_MIN_H, (MM_W * world.h) / world.w))
  );

  const jobById = new Map(jobs.map((j) => [j.id, j]));

  return (
    <div
      data-canvas-ui="minimap"
      className="card-lift absolute bottom-3 right-3 z-30 rounded-lg border bg-card/95 p-1.5 backdrop-blur"
      aria-label="Canvas minimap"
    >
      <svg
        ref={svgRef}
        width={MM_W}
        height={mmH}
        viewBox={`${world.x} ${world.y} ${world.w} ${world.h}`}
        className="block cursor-pointer touch-none select-none rounded-sm bg-muted/50"
        role="application"
        aria-label={`Workflow overview — ${jobs.length} jobs. Click to navigate.`}
        onPointerDown={(e) => {
          draggingRef.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* synthesized / lost pointer — navigation still works */
          }
          const p = toWorld(e);
          if (p) navigate(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          const p = toWorld(e);
          if (p) navigate(p.x, p.y);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* pointer already gone */
          }
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onPointerLeave={() => {
          // capture was stolen (e.g. by an overlay) → pointerup will never
          // fire here; without this reset a stray `true` would make every
          // later hover drag the viewport around
          draggingRef.current = false;
        }}
        onLostPointerCapture={() => {
          // last-writer-wins: if another element took capture mid-drag,
          // stop tracking so hover moves don't pan the canvas
          draggingRef.current = false;
        }}
      >
        {/* edges (thin, muted) — cheap straight port-to-port lines */}
        {edges.length <= 160 &&
          edges.map((e) => {
            const a = jobById.get(e.fromJobId);
            const b = jobById.get(e.toJobId);
            if (!a || !b) return null;
            return (
              <line
                key={e.id}
                x1={a.x + CARD_W}
                y1={a.y + CARD_H / 2}
                x2={b.x}
                y2={b.y + CARD_H / 2}
                stroke="currentColor"
                strokeWidth={Math.max(6, Math.min(18, world.w / 120))}
                opacity={0.25}
                className="text-muted-foreground"
              />
            );
          })}

        {/* job chips colored by status (hover → name tooltip via <title>)
            — stroke widths scale with the world box so chips stay visible
            when the minimap zooms out on the infinite canvas */}
        {(() => {
          const s = Math.max(4, Math.min(26, world.w / 80));
          return jobs.map((j) => {
            const selected = j.id === selectedId;
            return (
              <rect
                key={j.id}
                x={j.x}
                y={j.y}
                width={CARD_W}
                height={CARD_H}
                rx={26}
                fill={STATUS_FILL[j.status] ?? STATUS_FILL.idle}
                opacity={j.status === "idle" ? 0.55 : 0.9}
                stroke={selected ? "var(--primary)" : "none"}
                strokeWidth={s}
              >
                <title>{`${j.name} — ${j.status}${j.status === "running" ? ` (${Math.round(j.progress)}%)` : j.result ? ` · ${j.result}` : ""}`}</title>
                {j.status === "running" && (
                  <animate
                    attributeName="opacity"
                    values="0.55;0.95;0.55"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                )}
              </rect>
            );
          });
        })()}

        {/* selected job ring */}
        {(() => {
          const j = jobById.get(selectedId ?? "");
          if (!j) return null;
          const s = Math.max(4, Math.min(26, world.w / 80));
          return (
            <rect
              x={j.x - 14}
              y={j.y - 14}
              width={CARD_W + 28}
              height={CARD_H + 28}
              rx={38}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={s * 1.4}
              opacity={0.85}
              pointerEvents="none"
            />
          );
        })()}

        {/* current viewport window */}
        {size.w > 0 && (
          <rect
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.h}
            rx={Math.min(60, world.w / 40)}
            fill="var(--primary)"
            fillOpacity={0.08}
            stroke="var(--primary)"
            strokeWidth={Math.max(4, Math.min(20, world.w / 100))}
            strokeOpacity={0.6}
            pointerEvents="none"
          />
        )}
      </svg>
      <p className="mt-0.5 text-center text-[9px] font-medium uppercase tracking-widest text-muted-foreground/70">
        map
      </p>
    </div>
  );
}
