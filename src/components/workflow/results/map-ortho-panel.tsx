"use client";

/**
 * CryoFlow — orthogonal slice browser under the Mol* 3D map viewer.
 *
 * Three 2D planes through the volume (XY / XZ / YZ), each scrubbable
 * along its normal axis — the way cryo-EM microscopists actually inspect
 * a reconstruction (RELION's `_display` window). Renders come from the
 * job outputs file route (`format=png&axis=…&pos=…`), which reconstructs
 * the X/Y planes server-side from the CCP4 voxel data.
 *
 * The crosshair button on each tile mirrors the plane into the 3D scene:
 * it dispatches `cryoflow:ortho-slice` which molstar-embed listens for
 * and turns into its cross-section intent (plane appears in the 3D view,
 * wireframe + sliders update). A window CustomEvent — not props — keeps
 * the heavy embed untouched by this panel's re-renders.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Crosshair, ScanLine } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { MrcImage } from "./mrc-image";
import { cn } from "@/lib/utils";

/** event name the 3D embed listens to — see molstar-embed.tsx */
export const ORTHO_SLICE_EVENT = "cryoflow:ortho-slice";

interface TileSpec {
  /** plane's normal (movement) axis — also the API's `axis` param */
  axis: "x" | "y" | "z";
  /** human plane name: the two axes the image spans */
  plane: string;
  /** axis-accurate color chip (matches the app's accent roles) */
  accent: string;
  dot: string;
  text: string;
}

const TILES: TileSpec[] = [
  { axis: "z", plane: "XY plane", accent: "hover:border-teal-600/50", dot: "bg-teal-500", text: "text-teal-600" },
  { axis: "y", plane: "XZ plane", accent: "hover:border-violet-600/50", dot: "bg-violet-500", text: "text-violet-600" },
  { axis: "x", plane: "YZ plane", accent: "hover:border-amber-600/50", dot: "bg-amber-500", text: "text-amber-600" },
];

/** debounce window for turning slider drags into render requests (ms) */
const SCRUB_DEBOUNCE = 220;

function OrthoTile({
  jobId,
  path,
  spec,
}: {
  jobId: string;
  path: string;
  spec: TileSpec;
}) {
  // pos follows the slider immediately (readout + sync use the live value);
  // the <img> chases it on a debounce so a drag floods neither the server
  // nor the CCP4 reader
  const [pos, setPos] = useState(0.5);
  const [rendered, setRendered] = useState(0.5);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (rendered === pos) return;
    timer.current = setTimeout(() => setRendered(pos), SCRUB_DEBOUNCE);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pos, rendered]);

  const src = `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=png&axis=${spec.axis}&pos=${rendered.toFixed(3)}`;

  const syncTo3d = () => {
    window.dispatchEvent(
      new CustomEvent(ORTHO_SLICE_EVENT, { detail: { axis: spec.axis, pos } })
    );
  };

  return (
    <div
      className={cn(
        "group/tile rounded-lg border border-border bg-background/60 p-1.5 transition-colors",
        spec.accent
      )}
      data-canvas-ui={`ortho-tile-${spec.axis}`}
    >
      <div className="mb-1 flex items-center gap-1.5 px-0.5">
        <span className={cn("size-1.5 shrink-0 rounded-full", spec.dot)} aria-hidden="true" />
        <span className={cn("truncate text-[10px] font-semibold", spec.text)}>{spec.plane}</span>
        <span className="ml-auto shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
          {spec.axis}={String(Math.round(pos * 100)).padStart(2, "0")}%
        </span>
        <button
          type="button"
          onClick={syncTo3d}
          aria-label={`Show the ${spec.plane} at ${spec.axis} ${Math.round(pos * 100)}% in 3D`}
          title="Move the 3D cross-section to this plane"
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all duration-150 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none group-hover/tile:opacity-100"
        >
          <Crosshair className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <MrcImage
        src={src}
        alt={`${spec.plane} at ${spec.axis} ${Math.round(pos * 100)}%`}
        className="aspect-square"
      />
      <Slider
        value={[pos]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(v) => setPos(v[0] ?? 0.5)}
        aria-label={`${spec.plane} position along ${spec.axis}`}
        className="mt-1.5"
      />
    </div>
  );
}

/**
 * Collapsible orthogonal-slice strip. Hidden entirely for .mrcs stacks —
 * their "ortho" planes are in-image axes, and stack browsing already has
 * the montage/large views.
 */
export function MapOrthoPanel({
  jobId,
  path,
}: {
  jobId: string;
  path: string;
}) {
  const [open, setOpen] = useState(false);
  const isStack = path.toLowerCase().endsWith(".mrcs");

  if (isStack) return null;

  return (
    <section
      aria-label="Orthogonal slice browser"
      data-canvas-ui="ortho-panel"
      className="shrink-0 rounded-lg border border-border/80 bg-card/40"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <ScanLine className="h-3.5 w-3.5 shrink-0 text-cyan-600" aria-hidden="true" />
        <span className="text-xs font-semibold text-foreground/85">Orthogonal slices</span>
        <span className="truncate text-[10px] text-muted-foreground">
          2D sections through the box — scrub a plane, ⌖ to mirror it into the 3D view
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-3">
          {TILES.map((t) => (
            <OrthoTile key={t.axis} jobId={jobId} path={path} spec={t} />
          ))}
        </div>
      )}
    </section>
  );
}
