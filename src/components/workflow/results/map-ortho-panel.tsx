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
 * The linkage with the 3D scene runs BOTH ways over window CustomEvents
 * (keeps the 4300-line embed free of this panel's re-renders):
 *   2D → 3D  the ⌖ button dispatches `cryoflow:ortho-slice`; the embed
 *            mirrors the plane into its cross-section intent.
 *   3D → 2D  the embed dispatches `cryoflow:slice-state` whenever ITS
 *            slice UI moves (axis buttons, position slider); the matching
 *            tile follows with a brief highlight flash.
 *
 * Grid dimensions come from the outputs route (`dims`), so readouts show
 * real voxel indices ("z 33/64"), falling back to percentages if the
 * listing is unavailable.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Crosshair, ScanLine } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { MrcImage } from "./mrc-image";
import { cn } from "@/lib/utils";

/** event names for the two-way 3D↔2D linkage — see molstar-embed.tsx */
export const ORTHO_SLICE_EVENT = "cryoflow:ortho-slice";
export const ORTHO_SLICE_STATE_EVENT = "cryoflow:slice-state";
/** 3D → 2D clip echo (t253): the box-clip state, so tiles can speak it */
export const ORTHO_CLIP_STATE_EVENT = "cryoflow:clip-state";

/** the clip state the tiles need, as the embed's clipStateRef carries it */
export interface OrthoClipState {
  on: boolean;
  x: number;
  y: number;
  z: number;
  invert: boolean;
  /** bumps on every embed-side clip intent — the tiles' flash trigger */
  nonce: number;
}

interface TileSpec {
  /** plane's normal (movement) axis — also the API's `axis` param */
  axis: "x" | "y" | "z";
  /** plane's normal axis as the embed names it (uppercase) */
  axisLabel: "X" | "Y" | "Z";
  /** human plane name: the two axes the image spans */
  plane: string;
  /** image HORIZONTAL axis (left→right = fraction 0→1) — readMrcOrthoSlice */
  hAxis: "x" | "y" | "z";
  /** image VERTICAL axis (top→bottom = fraction 0→1 — axis 0 is the top
   *  row in every plane this renderer builds, no flip needed) */
  vAxis: "x" | "y" | "z";
  /** axis-accurate color chip (matches the app's accent roles) */
  accent: string;
  dot: string;
  text: string;
}

const TILES: TileSpec[] = [
  { axis: "z", axisLabel: "Z", plane: "XY plane", hAxis: "x", vAxis: "y", accent: "hover:border-teal-600/50", dot: "bg-teal-500", text: "text-teal-600" },
  { axis: "y", axisLabel: "Y", plane: "XZ plane", hAxis: "x", vAxis: "z", accent: "hover:border-violet-600/50", dot: "bg-violet-500", text: "text-violet-600" },
  { axis: "x", axisLabel: "X", plane: "YZ plane", hAxis: "y", vAxis: "z", accent: "hover:border-amber-600/50", dot: "bg-amber-500", text: "text-amber-600" },
];

/** debounce window for turning slider drags into render requests (ms) */
const SCRUB_DEBOUNCE = 220;
/** how long the tile flashes when the 3D scene drives it (ms) */
const FOLLOW_FLASH_MS = 650;

function OrthoTile({
  jobId,
  path,
  spec,
  dim,
  follow,
  clip,
}: {
  jobId: string;
  path: string;
  spec: TileSpec;
  /** voxels along the movement axis (from the outputs listing) */
  dim?: number;
  /** latest position driven by the 3D scene (nonce bumps per event) */
  follow?: { pos: number; nonce: number };
  /** latest box-clip state driven by the 3D scene (t253) */
  clip?: OrthoClipState | null;
}) {
  // pos follows the slider immediately (readout + sync use the live value);
  // the <img> chases it on a debounce so a drag floods neither the server
  // nor the CCP4 reader
  const [pos, setPos] = useState(0.5);
  const [rendered, setRendered] = useState(0.5);
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** last nonce adopted — render-phase guard against replaying the same event */
  const [prevNonce, setPrevNonce] = useState(follow?.nonce ?? 0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (rendered === pos) return;
    timer.current = setTimeout(() => setRendered(pos), SCRUB_DEBOUNCE);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pos, rendered]);

  // 3D → 2D: the embed's slice UI moved — glide this tile to the plane.
  // The adoption happens DURING RENDER when a fresh nonce arrives (the
  // React-documented "adjust state when a prop changes" pattern): an
  // effect writing both states synchronously trips the cascading-render
  // lint and splits one logical event into two render passes.
  if (follow && follow.nonce !== prevNonce) {
    setPrevNonce(follow.nonce);
    const p = Math.min(1, Math.max(0, follow.pos));
    setPos((cur) => (Math.abs(cur - p) < 0.0005 ? cur : p));
    setFlash(true);
  }

  // the flash clears itself — the timer only exists while lit
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), FOLLOW_FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  // t253 — the clip's tile overlay. The clip box lives in 3D; each 2D tile
  // speaks its slice of the story: the kept region's cross-section drawn as
  // a violet outline (the clip's own colour) when the viewed plane survives
  // the crop, and a quiet "plane clipped" badge when the crop removed this
  // plane's row of the box entirely. Same renderer math as the image:
  // readMrcOrthoSlice puts axis 0 at the top row and the left column, so
  // the kept interval maps onto the overlay with NO flip.
  const [clipNonceSeen, setClipNonceSeen] = useState<number | null>(clip?.nonce ?? null);
  const [clipLit, setClipLit] = useState(false);
  if (clip && clipNonceSeen !== clip.nonce) {
    setClipNonceSeen(clip.nonce);
    setClipLit(true);
  }
  useEffect(() => {
    if (!clipLit) return;
    const t = setTimeout(() => setClipLit(false), FOLLOW_FLASH_MS);
    return () => clearTimeout(t);
  }, [clipLit]);

  let clipOverlay: React.ReactNode = null;
  let clippedAway = false;
  if (clip?.on) {
    const kept = (v: number): [number, number] => (clip.invert ? [v, 1] : [0, v]);
    const [n0, n1] = kept(clip[spec.axis]);
    const survives = pos >= n0 - 1e-9 && pos <= n1 + 1e-9;
    clippedAway = !survives;
    if (!survives) {
      clipOverlay = (
        <div
          className="pointer-events-none absolute inset-0 flex items-start justify-end rounded-sm bg-background/55 p-1"
          title={`Clip removed this plane: kept ${spec.axisLabel} ${Math.round(n0 * 100)}–${Math.round(n1 * 100)}%`}
        >
          <span className="rounded bg-violet-600/90 px-1 py-0.5 text-[9px] font-semibold text-white">
            clipped
          </span>
        </div>
      );
    } else {
      const [h0, h1] = kept(clip[spec.hAxis]);
      const [v0, v1] = kept(clip[spec.vAxis]);
      const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
      clipOverlay = (
        <div
          className={cn(
            "pointer-events-none absolute border-2 border-violet-500/80 transition-shadow duration-300",
            clipLit && "shadow-[0_0_0_3px_rgba(139,92,246,0.35)]"
          )}
          style={{
            left: pct(h0),
            width: pct(h1 - h0),
            top: pct(v0),
            height: pct(v1 - v0),
          }}
          title={`Kept region on this plane — ${spec.hAxis.toUpperCase()} ${Math.round(h0 * 100)}–${Math.round(h1 * 100)}%, ${spec.vAxis.toUpperCase()} ${Math.round(v0 * 100)}–${Math.round(v1 * 100)}%`}
          role="img"
          aria-label={`Clip keeps ${spec.hAxis.toUpperCase()} ${Math.round(h0 * 100)} to ${Math.round(h1 * 100)} percent, ${spec.vAxis.toUpperCase()} ${Math.round(v0 * 100)} to ${Math.round(v1 * 100)} percent on this plane`}
        />
      );
    }
  }

  const src = `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=png&axis=${spec.axis}&pos=${rendered.toFixed(3)}`;

  const syncTo3d = () => {
    window.dispatchEvent(
      new CustomEvent(ORTHO_SLICE_EVENT, { detail: { axis: spec.axis, pos } })
    );
  };

  const idx = Math.round(pos * Math.max(0, (dim ?? 0) - 1));
  const readout =
    dim && dim > 1
      ? `${spec.axis} ${idx + 1}/${dim}`
      : `${spec.axis} ${Math.round(pos * 100)}%`;

  return (
    <div
      className={cn(
        "group/tile rounded-lg border bg-background/60 p-1.5 transition-colors duration-300",
        flash ? "border-cyan-500/70 shadow-[0_0_0_1px_rgba(6,182,212,0.35)]" : "border-border",
        !flash && spec.accent
      )}
      data-canvas-ui={`ortho-tile-${spec.axis}`}
    >
      <div className="mb-1 flex items-center gap-1.5 px-0.5">
        <span className={cn("size-1.5 shrink-0 rounded-full", spec.dot)} aria-hidden="true" />
        <span className={cn("truncate text-[10px] font-semibold", spec.text)}>{spec.plane}</span>
        <span
          className="ml-auto shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground"
          title={dim ? `voxel index along ${spec.axisLabel} (1-based of ${dim})` : undefined}
        >
          {readout}
        </span>
        <button
          type="button"
          onClick={syncTo3d}
          aria-label={`Show the ${spec.plane} at ${readout} in 3D`}
          title="Move the 3D cross-section to this plane"
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all duration-150 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 hover-none:opacity-100"
        >
          <Crosshair className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="relative aspect-square">
        <MrcImage
          src={src}
          alt={`${spec.plane} at ${readout}`}
          className={cn("h-full w-full transition-opacity duration-300", clippedAway && "opacity-45")}
        />
        {clipOverlay}
      </div>
      <Slider
        value={[pos]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(v) => setPos(v[0] ?? 0.5)}
        aria-label={`${spec.plane} position along ${spec.axisLabel}`}
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
  /** grid dims from the outputs listing — real voxel indices in readouts */
  const [dims, setDims] = useState<[number, number, number] | null>(null);
  /** per-axis position driven by the 3D scene (nonce bumps per event) */
  const [follow, setFollow] = useState<Partial<Record<"x" | "y" | "z", { pos: number; nonce: number }>>>({});
  const followNonce = useRef(0);

  const isStack = path.toLowerCase().endsWith(".mrcs");

  // dims arrive from the outputs listing (one cheap JSON fetch per expand)
  useEffect(() => {
    if (!open || dims || isStack) return;
    let cancelled = false;
    fetch(`/api/jobs/${jobId}/outputs`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { files?: { path: string; dims?: [number, number, number] }[] } | null) => {
        if (cancelled || !data?.files) return;
        const f = data.files.find((x) => x.path === path);
        if (f?.dims) setDims(f.dims);
      })
      .catch(() => {
        /* readouts fall back to percentages */
      });
    return () => {
      cancelled = true;
    };
  }, [open, dims, isStack, jobId, path]);

  // 3D → 2D: the embed's cross-section UI (axis buttons, position slider,
  // contour-adjacent controls) moved — the matching tile follows
  useEffect(() => {
    const onSliceState = (e: Event) => {
      const d = (e as CustomEvent<{ axis?: string; pos?: number }>).detail;
      const axis = d?.axis?.toLowerCase();
      if (axis !== "x" && axis !== "y" && axis !== "z") return;
      if (typeof d.pos !== "number" || !Number.isFinite(d.pos)) return;
      followNonce.current += 1;
      setFollow((prev) => ({ ...prev, [axis]: { pos: d.pos as number, nonce: followNonce.current } }));
    };
    window.addEventListener(ORTHO_SLICE_STATE_EVENT, onSliceState);
    return () => window.removeEventListener(ORTHO_SLICE_STATE_EVENT, onSliceState);
  }, []);

  // 3D → 2D (t253): the embed's box-clip moved — the tiles speak its state
  // (kept-region outline on surviving planes, a "clipped" badge on removed
  // ones). The nonce rides the detail; tiles flash on the bump.
  const clipNonce = useRef(0);
  const [clip, setClip] = useState<OrthoClipState | null>(null);
  useEffect(() => {
    const onClipState = (e: Event) => {
      const d = (e as CustomEvent<Partial<OrthoClipState>>).detail;
      if (!d || typeof d !== "object") return;
      clipNonce.current += 1;
      setClip((prev) => ({
        on: !!d.on,
        x: typeof d.x === "number" ? d.x : prev?.x ?? 1,
        y: typeof d.y === "number" ? d.y : prev?.y ?? 1,
        z: typeof d.z === "number" ? d.z : prev?.z ?? 1,
        invert: !!d.invert,
        nonce: clipNonce.current,
      }));
    };
    window.addEventListener(ORTHO_CLIP_STATE_EVENT, onClipState);
    return () => window.removeEventListener(ORTHO_CLIP_STATE_EVENT, onClipState);
  }, []);

  if (isStack) return null;

  const dimFor = (axis: "x" | "y" | "z") =>
    dims ? (axis === "x" ? dims[0] : axis === "y" ? dims[1] : dims[2]) : undefined;

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
            <OrthoTile
              key={t.axis}
              jobId={jobId}
              path={path}
              spec={t}
              dim={dimFor(t.axis)}
              follow={follow[t.axis]}
              clip={clip}
            />
          ))}
        </div>
      )}
    </section>
  );
}
