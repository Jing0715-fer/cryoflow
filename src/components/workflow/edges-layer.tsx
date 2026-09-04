"use client";

/**
 * SVG edge layer — n8n-style smooth connections that never cross a card.
 *
 * Geometry lives in `@/lib/edge-geom` (shared with the drag loop — see
 * below). Routing: direct bezier unless it would clip a card body, then
 * a rounded detour through the column gaps (see edge-geom.ts).
 *
 * Visual language (n8n): no arrowheads — a solid endpoint dot at the
 * target port plus a smaller dot at the source. Live edges (source job
 * running) use the primary color with marching dashes; primed edges
 * (completed → unfinished) use a soft primary tint; hover thickens and
 * reveals a delete button at the path midpoint.
 *
 * PERFORMANCE — drag with zero React work per frame:
 * while a card is dragged, JobCard's rAF loop recomputes the touching
 * edge geometry with the same shared math and patches the SVG DOM
 * directly through the data attributes on this tree:
 *   <g data-edge-id>     one group per edge
 *   [data-e="d"]         elements whose `d` attribute tracks the path
 *                        (hit area, glow, main stroke)
 *   [data-e="motion"]    <animateMotion> particles (their `path` attr)
 *   [data-e="src"]       source endpoint dot (cx/cy)
 *   [data-e="tgt"]       target endpoint dot + halo ring (cx/cy)
 * No React re-render happens mid-drag: polling is paused (dragActive)
 * and the store's dragLive is never written per frame.
 */

import * as React from "react";
import { CANVAS_H, CANVAS_W } from "@/lib/workflow";
import { computeEdgeGeoms, getLiveDrag, type EdgeGeom } from "@/lib/edge-geom";
import { useWorkflowStore } from "@/lib/store";
import type { EdgeDTO, JobDTO } from "@/lib/types";

const STROKE_BASE = "color-mix(in oklch, var(--foreground) 32%, transparent)";
const STROKE_ACTIVE = "color-mix(in oklch, var(--foreground) 52%, transparent)";
const STROKE_READY = "color-mix(in oklch, var(--primary) 55%, transparent)";
const DOT_BASE = "color-mix(in oklch, var(--foreground) 42%, transparent)";

export const EdgesLayer = React.memo(function EdgesLayer({
  edges,
  jobs,
}: {
  edges: EdgeDTO[];
  jobs: JobDTO[];
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const selectedId = useWorkflowStore((s) => s.selectedId);
  // tooltip + delete chip keep a constant SCREEN size at any zoom
  const zoom = useWorkflowStore((s) => s.viewport.zoom);

  const jobMap = React.useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const geoms = React.useMemo<EdgeGeom[]>(
    // getLiveDrag() is read (not subscribed): if a store update forces a
    // recompute mid-drag (rare — polling is paused), the wires stay glued
    // to the card; with unchanged deps the cached geoms win and the
    // drag loop's direct DOM patches are left untouched.
    () => computeEdgeGeoms(edges, jobs, getLiveDrag()),
    [edges, jobs]
  );

  return (
    <svg
      data-edges-layer
      width={CANVAS_W}
      height={CANVAS_H}
      className="pointer-events-none absolute left-0 top-0"
      aria-hidden="true"
    >
      <defs>
        {/* gradient defs for live / primed wires — created lazily below */}
        {geoms.map((g) => {
          const from = jobMap.get(g.fromId);
          const to = jobMap.get(g.toId);
          const running = from?.status === "running";
          const primed = from?.status === "completed" && to?.status !== "completed";
          if (!running && !primed) return null;
          return (
            <linearGradient
              key={g.edge.id}
              id={`edge-grad-${g.edge.id}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              {running ? (
                <>
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.55" />
                  <stop offset="45%" stopColor="var(--primary)" stopOpacity="1" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.85" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor={STROKE_BASE} />
                  <stop offset="100%" stopColor={STROKE_READY} />
                </>
              )}
            </linearGradient>
          );
        })}
      </defs>
      {geoms.map((g) => {
        const { edge } = g;
        const from = jobMap.get(g.fromId);
        const to = jobMap.get(g.toId);
        if (!from || !to) return null;

        const running = from.status === "running";
        // a completed source feeding an unfinished target — the wire is "primed"
        const primed = from.status === "completed" && to.status !== "completed";
        const touchesSelected =
          selectedId != null && (from.id === selectedId || to.id === selectedId);
        const hovered = hoveredId === edge.id;
        // when a card is selected, unrelated wires recede — the eye follows
        // the selected job's data flow
        const dimmed = selectedId != null && !touchesSelected;

        const gradId = running || primed ? `url(#edge-grad-${edge.id})` : null;
        const stroke = running
          ? gradId ?? "var(--primary)"
          : hovered || touchesSelected
            ? STROKE_ACTIVE
            : primed
              ? gradId ?? STROKE_READY
              : STROKE_BASE;
        const dotFill = running
          ? "var(--primary)"
          : hovered || touchesSelected
            ? STROKE_ACTIVE
            : primed
              ? STROKE_READY
              : DOT_BASE;
        const width = hovered || touchesSelected ? 3.2 : running ? 2.75 : 2.25;

        return (
          <g
            key={edge.id}
            data-edge-id={edge.id}
            style={{
              opacity: dimmed ? 0.32 : 1,
              transition: "opacity 220ms ease",
            }}
          >
            {/* invisible hit area for hover */}
            <path
              d={g.d}
              data-e="d"
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              style={{ pointerEvents: "stroke" }}
              onPointerEnter={() => setHoveredId(edge.id)}
              onPointerLeave={() => setHoveredId((cur) => (cur === edge.id ? null : cur))}
            />
            {/* soft glow under live wires (wide translucent stroke) */}
            {(running || hovered) && (
              <path
                d={g.d}
                data-e="d"
                fill="none"
                stroke={running ? "var(--primary)" : STROKE_ACTIVE}
                strokeWidth={running ? 8 : 9}
                strokeLinecap="round"
                opacity={running ? 0.14 : 0.1}
                style={{ pointerEvents: "none" }}
              />
            )}
            <path
              d={g.d}
              data-e="d"
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={running ? "edge-flow" : undefined}
              style={{
                transition: "stroke 160ms ease, stroke-width 160ms ease",
                pointerEvents: "none",
              }}
            />
            {/* travelling particles on live wires — data flowing downstream */}
            {running && (
              <>
                <circle r={2.6} fill="var(--primary)" opacity={0.95} style={{ pointerEvents: "none" }}>
                  <animateMotion data-e="motion" dur="2.6s" repeatCount="indefinite" path={g.d} />
                </circle>
                <circle r={1.9} fill="var(--primary)" opacity={0.6} style={{ pointerEvents: "none" }}>
                  <animateMotion data-e="motion" dur="2.6s" begin="-1.3s" repeatCount="indefinite" path={g.d} />
                </circle>
              </>
            )}
            {/* source endpoint dot */}
            <circle
              cx={g.srcDot.x}
              cy={g.srcDot.y}
              r={3}
              data-e="src"
              fill={dotFill}
              style={{ transition: "fill 160ms ease", pointerEvents: "none" }}
            />
            {/* target endpoint dot (n8n signature) — punched out of the port,
                halo ring when emphasized */}
            {(hovered || touchesSelected || running) && (
              <circle
                cx={g.tgtDot.x}
                cy={g.tgtDot.y}
                r={7}
                data-e="tgt"
                fill="none"
                stroke={running ? "var(--primary)" : STROKE_ACTIVE}
                strokeWidth={1}
                opacity={0.4}
                style={{ pointerEvents: "none" }}
              />
            )}
            <circle
              cx={g.tgtDot.x}
              cy={g.tgtDot.y}
              r={4.2}
              data-e="tgt"
              fill={dotFill}
              stroke="var(--background)"
              strokeWidth={1.5}
              style={{ transition: "fill 160ms ease", pointerEvents: "none" }}
            />
            {/* hover delete affordance at the path midpoint */}
            {hovered && (
              <g
                data-canvas-ui="edge-delete"
                transform={`translate(${g.mid.x}, ${g.mid.y})`}
                style={{ pointerEvents: "all", cursor: "pointer" }}
                onPointerEnter={() => setHoveredId(edge.id)}
                onPointerLeave={() => setHoveredId((cur) => (cur === edge.id ? null : cur))}
                onClick={(e) => {
                  e.stopPropagation();
                  void removeEdge(edge.id);
                }}
              >
                <title>Remove connection</title>
                <circle r={16} fill="transparent" />
                <circle r={9} className="fill-card stroke-border" strokeWidth={1} />
                <path
                  d="M -3.2 -3.2 L 3.2 3.2 M 3.2 -3.2 L -3.2 3.2"
                  className="stroke-foreground"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            )}
            {/* hover tooltip with caret — patched position lives in data-e
                groups above; tooltip only shows while NOT dragging */}
            {hovered && (
              <g
                data-canvas-ui="edge-label"
                transform={`translate(${g.mid.x}, ${g.mid.y}) scale(${(1 / Math.max(0.05, zoom)).toFixed(3)})`}
                style={{ pointerEvents: "none" }}
              >
                {(() => {
                  const title = `${from.name} → ${to.name}`;
                  const sub = `${g.fromPortLabel} → ${g.toPortLabel}`;
                  const w = Math.max(title.length * 6.6, sub.length * 5.3) + 26;
                  return (
                    <g transform="translate(0, -36)">
                      <rect
                        x={-w / 2}
                        y={-22}
                        width={w}
                        height={34}
                        rx={8}
                        className="fill-popover stroke-border"
                        strokeWidth={1}
                      />
                      {/* caret anchoring the card to the wire */}
                      <path
                        d="M -4.5 12 L 4.5 12 L 0 18.5 Z"
                        className="fill-popover"
                      />
                      <path
                        d="M -4.5 12 L -4.5 12.4 M 4.5 12 L 4.5 12.4"
                        className="stroke-border"
                        strokeWidth={1}
                        fill="none"
                      />
                      <text
                        y={-10.5}
                        textAnchor="middle"
                        className="fill-foreground"
                        style={{ fontSize: 11, fontWeight: 600 }}
                      >
                        {title}
                      </text>
                      <text
                        y={3.5}
                        textAnchor="middle"
                        className="fill-muted-foreground"
                        style={{ fontSize: 9.5 }}
                      >
                        {sub}
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
});
