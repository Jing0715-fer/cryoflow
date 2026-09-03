"use client";

/**
 * SVG edge layer — renders workflow connections as cubic bezier paths
 * with subtle arrowheads. The SVG itself ignores pointer events except
 * the invisible wide "hit" strokes used for hover styling.
 */

import * as React from "react";
import { CARD_W, CARD_H, CANVAS_W, CANVAS_H } from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import type { EdgeDTO, JobDTO } from "@/lib/types";

const STROKE_BASE = "color-mix(in oklch, var(--foreground) 22%, transparent)";
const STROKE_ACTIVE = "color-mix(in oklch, var(--foreground) 45%, transparent)";

interface EdgeGeometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
}

function geometry(from: JobDTO, to: JobDTO): EdgeGeometry {
  const x1 = from.x + CARD_W;
  const y1 = from.y + CARD_H / 2;
  const x2 = to.x;
  const y2 = to.y + CARD_H / 2;
  const dx = Math.max(48, Math.abs(x2 - x1) * 0.45);
  return { x1, y1, x2, y2, c1x: x1 + dx, c1y: y1, c2x: x2 - dx, c2y: y2 };
}

function pathD(g: EdgeGeometry): string {
  return `M ${g.x1} ${g.y1} C ${g.c1x} ${g.c1y} ${g.c2x} ${g.c2y} ${g.x2} ${g.y2}`;
}

/** Small triangle at the target port, oriented along the end tangent. */
function arrowD(g: EdgeGeometry): string {
  const angle = Math.atan2(g.y2 - g.c2y, g.x2 - g.c2x);
  const s = 7;
  const spread = 0.3;
  const tipX = g.x2 - 1;
  const tipY = g.y2;
  const bx1 = tipX - s * Math.cos(angle + spread);
  const by1 = tipY - s * Math.sin(angle + spread);
  const bx2 = tipX - s * Math.cos(angle - spread);
  const by2 = tipY - s * Math.sin(angle - spread);
  return `M ${tipX} ${tipY} L ${bx1} ${by1} L ${bx2} ${by2} Z`;
}

export function EdgesLayer({
  edges,
  jobs,
}: {
  edges: EdgeDTO[];
  jobs: JobDTO[];
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  // live drag offset — while a card is being dragged its connected edges follow it
  const dragLive = useWorkflowStore((s) => s.dragLive);

  const jobMap = React.useMemo(
    () => new Map(jobs.map((j) => [j.id, j])),
    [jobs]
  );

  const visible = React.useMemo(
    () =>
      edges
        .map((e) => {
          const from = jobMap.get(e.fromJobId);
          const to = jobMap.get(e.toJobId);
          return from && to ? { edge: e, from, to } : null;
        })
        .filter((x): x is { edge: EdgeDTO; from: JobDTO; to: JobDTO } => x !== null),
    [edges, jobMap]
  );

  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      className="pointer-events-none absolute left-0 top-0"
      aria-hidden="true"
    >
      {visible.map(({ edge, from, to }) => {
        // apply live drag offset to whichever endpoint is being dragged
        const fromAdj =
          dragLive && dragLive.id === from.id
            ? { ...from, x: from.x + dragLive.dx, y: from.y + dragLive.dy }
            : from;
        const toAdj =
          dragLive && dragLive.id === to.id
            ? { ...to, x: to.x + dragLive.dx, y: to.y + dragLive.dy }
            : to;
        const g = geometry(fromAdj, toAdj);
        const d = pathD(g);
        const running = from.status === "running";
        const hovered = hoveredId === edge.id;
        const stroke = running
          ? "var(--primary)"
          : hovered
            ? STROKE_ACTIVE
            : STROKE_BASE;
        const width = hovered ? 2.5 : 2;
        const fill = running
          ? "var(--primary)"
          : hovered
            ? STROKE_ACTIVE
            : "color-mix(in oklch, var(--foreground) 30%, transparent)";
        return (
          <g key={edge.id}>
            {/* invisible hit area for hover */}
            <path
              d={d}
              stroke="transparent"
              strokeWidth={14}
              fill="none"
              style={{ pointerEvents: "stroke" }}
              onPointerEnter={() => setHoveredId(edge.id)}
              onPointerLeave={() =>
                setHoveredId((cur) => (cur === edge.id ? null : cur))
              }
            />
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              className={running ? "edge-flow" : undefined}
            />
            <path d={arrowD(g)} fill={fill} />
          </g>
        );
      })}
    </svg>
  );
}
