"use client";

/**
 * SVG edge layer — n8n-style smooth bezier connections.
 *
 * Design (mirrors n8n's canvas feel):
 *   • Cubic bezier leaving the output port horizontally and entering the
 *     input port horizontally — the classic workflow-editor S-curve.
 *   • Control-point offset scales with the horizontal distance (min 56px)
 *     so short hops stay flat and long spans sweep generously.
 *   • Edges sharing a source port (fan-out) or target port (fan-in) get
 *     small opposing offsets on their control points so the wires fan
 *     apart mid-flight instead of overlapping.
 *   • No arrowheads: a solid endpoint dot at the target port (n8n's
 *     signature) plus a smaller dot at the source.
 *   • Live edges (source job running) use the primary color with marching
 *     dashes; completed chains stay quiet gray; hover thickens + brightens
 *     and reveals a delete button at the midpoint.
 *   • While a card is dragged (store.dragLive) endpoints recompute every
 *     render — a bezier path string is O(1) per edge, no caching needed.
 */

import * as React from "react";
import { CANVAS_H, CANVAS_W, CARD_W, jobType, portY } from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import type { EdgeDTO, JobDTO } from "@/lib/types";

const STROKE_BASE = "color-mix(in oklch, var(--foreground) 32%, transparent)";
const STROKE_ACTIVE = "color-mix(in oklch, var(--foreground) 52%, transparent)";
const STROKE_READY = "color-mix(in oklch, var(--primary) 55%, transparent)";
const DOT_BASE = "color-mix(in oklch, var(--foreground) 42%, transparent)";

/** vertical fan separation between wires sharing a port (px) */
const FAN_SPREAD = 26;
/** minimum horizontal reach of the control points (px) */
const MIN_CTRL = 56;

interface Pt {
  x: number;
  y: number;
}

interface EdgeGeom {
  edge: EdgeDTO;
  from: JobDTO;
  to: JobDTO;
  d: string;
  mid: Pt;
  srcDot: Pt;
  tgtDot: Pt;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Cubic-bezier S-curve from an output port to an input port. */
function bezier(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  srcOff: number,
  tgtOff: number
): { d: string; mid: Pt } {
  const reach = Math.max(MIN_CTRL, Math.abs(ex - sx) * 0.42);
  const c1x = sx + reach;
  const c1y = sy + srcOff;
  const c2x = ex - reach;
  const c2y = ey + tgtOff;
  // midpoint of the curve at t = 0.5 (used for the delete affordance)
  const midX = (sx + 3 * c1x + 3 * c2x + ex) / 8;
  const midY = (sy + 3 * c1y + 3 * c2y + ey) / 8;
  return {
    d: `M ${r2(sx)} ${r2(sy)} C ${r2(c1x)} ${r2(c1y)}, ${r2(c2x)} ${r2(c2y)}, ${r2(ex)} ${r2(ey)}`,
    mid: { x: midX, y: midY },
  };
}

export const EdgesLayer = React.memo(function EdgesLayer({
  edges,
  jobs,
}: {
  edges: EdgeDTO[];
  jobs: JobDTO[];
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  // live drag offset — while a card is being dragged its connected edges follow it
  const dragLive = useWorkflowStore((s) => s.dragLive);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const selectedId = useWorkflowStore((s) => s.selectedId);

  const jobMap = React.useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const geoms = React.useMemo<EdgeGeom[]>(() => {
    // group keys to fan apart wires that share an endpoint
    const srcGroups = new Map<string, number>();
    const tgtGroups = new Map<string, number>();

    const raw: {
      edge: EdgeDTO;
      from: JobDTO;
      to: JobDTO;
      sx: number;
      sy: number;
      ex: number;
      ey: number;
      srcKey: string;
      tgtKey: string;
    }[] = [];

    for (const e of edges) {
      const from = jobMap.get(e.fromJobId);
      const to = jobMap.get(e.toJobId);
      if (!from || !to) continue;
      const fdx = dragLive && dragLive.id === from.id ? dragLive.dx : 0;
      const fdy = dragLive && dragLive.id === from.id ? dragLive.dy : 0;
      const tdx = dragLive && dragLive.id === to.id ? dragLive.dx : 0;
      const tdy = dragLive && dragLive.id === to.id ? dragLive.dy : 0;
      const fromSpec = jobType(from.type);
      const toSpec = jobType(to.type);
      const outIdx = Math.max(0, fromSpec?.outputs.findIndex((p) => p.name === e.fromPort) ?? 0);
      const inIdx = Math.max(0, toSpec?.inputs.findIndex((p) => p.name === e.toPort) ?? 0);
      const nOut = Math.max(1, fromSpec?.outputs.length ?? 0);
      const nIn = Math.max(1, toSpec?.inputs.length ?? 0);
      const sx = from.x + CARD_W + fdx;
      const sy = from.y + portY(outIdx, nOut) + fdy;
      const ex = to.x + tdx;
      const ey = to.y + portY(inIdx, nIn) + tdy;
      const srcKey = `${e.fromJobId}|${e.fromPort ?? ""}`;
      const tgtKey = `${e.toJobId}|${e.toPort ?? ""}`;
      srcGroups.set(srcKey, (srcGroups.get(srcKey) ?? 0) + 1);
      tgtGroups.set(tgtKey, (tgtGroups.get(tgtKey) ?? 0) + 1);
      raw.push({ edge: e, from, to, sx, sy, ex, ey, srcKey, tgtKey });
    }

    // deterministic fan-slot assignment (stable across renders)
    const srcSlot = new Map<string, number>();
    const tgtSlot = new Map<string, number>();

    raw.sort((a, b) =>
      a.srcKey < b.srcKey ? -1 : a.srcKey > b.srcKey ? 1 : a.tgtKey < b.tgtKey ? -1 : 1
    );

    return raw.map((r) => {
      const ks = srcSlot.get(r.srcKey) ?? 0;
      srcSlot.set(r.srcKey, ks + 1);
      const kt = tgtSlot.get(r.tgtKey) ?? 0;
      tgtSlot.set(r.tgtKey, kt + 1);
      const ns = srcGroups.get(r.srcKey) ?? 1;
      const nt = tgtGroups.get(r.tgtKey) ?? 1;
      const srcOff = (ks - (ns - 1) / 2) * FAN_SPREAD;
      const tgtOff = (kt - (nt - 1) / 2) * FAN_SPREAD;
      const { d, mid } = bezier(r.sx, r.sy, r.ex, r.ey, srcOff, tgtOff);
      return {
        edge: r.edge,
        from: r.from,
        to: r.to,
        d,
        mid,
        srcDot: { x: r.sx, y: r.sy },
        tgtDot: { x: r.ex, y: r.ey },
      };
    });
  }, [edges, jobMap, dragLive]);

  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      className="pointer-events-none absolute left-0 top-0"
      aria-hidden="true"
    >
      {geoms.map((g) => {
        const { edge, from, to } = g;

        const running = from.status === "running";
        // a completed source feeding an unfinished target — the wire is "primed"
        const primed = from.status === "completed" && to.status !== "completed";
        const touchesSelected =
          selectedId != null && (from.id === selectedId || to.id === selectedId);
        const hovered = hoveredId === edge.id;

        const stroke = running
          ? "var(--primary)"
          : hovered || touchesSelected
            ? STROKE_ACTIVE
            : primed
              ? STROKE_READY
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
          <g key={edge.id}>
            {/* invisible hit area for hover */}
            <path
              d={g.d}
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              style={{ pointerEvents: "stroke" }}
              onPointerEnter={() => setHoveredId(edge.id)}
              onPointerLeave={() => setHoveredId((cur) => (cur === edge.id ? null : cur))}
            />
            <path
              d={g.d}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={running ? "edge-flow" : undefined}
              style={{ transition: "stroke 160ms ease, stroke-width 160ms ease" }}
            />
            {/* source endpoint dot */}
            <circle
              cx={r2(g.srcDot.x)}
              cy={r2(g.srcDot.y)}
              r={3}
              fill={dotFill}
              style={{ transition: "fill 160ms ease" }}
            />
            {/* target endpoint dot (n8n signature) — punched out of the port */}
            <circle
              cx={r2(g.tgtDot.x)}
              cy={r2(g.tgtDot.y)}
              r={4.2}
              fill={dotFill}
              stroke="var(--background)"
              strokeWidth={1.5}
              style={{ transition: "fill 160ms ease" }}
            />
            {/* hover delete affordance at the curve midpoint */}
            {hovered && (
              <g
                data-canvas-ui="edge-delete"
                transform={`translate(${r2(g.mid.x)}, ${r2(g.mid.y)})`}
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
          </g>
        );
      })}
    </svg>
  );
});
