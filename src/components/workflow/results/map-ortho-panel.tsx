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
 *
 * t278 — the three tiles share a tri-planar FOCUS POINT: each tile reports
 * its position up; the panel feeds sibling positions back; every tile
 * draws the other two planes as dashed crosshair lines (in the marked
 * plane's accent — AXIS_COLOR), clicking an image PICKS a focus point
 * (the two sibling planes move to the clicked fractions), the slider
 * steps one VOXEL when the grid is known (stepFrac), and a panel-level
 * toggle switches the crosshair off.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Crosshair, Focus, ScanLine } from "lucide-react";
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
  /** t260 — the anchored box ([lo,hi] fractions per axis) when the clip is
   *  in box mode (the "show in parent" door). When present it OWNS the
   *  geometry: the tiles speak its kept intervals directly, because the
   *  slider language cannot represent a two-sided cut. */
  box?: { lo: [number, number, number]; hi: [number, number, number] } | null;
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

/**
 * t278 — axis-accurate crosshair colours. Each crosshair line takes the
 * accent of the sibling plane it MARKS (the line for axis x on the XY tile
 * is amber — the YZ tile's colour — because it shows where that plane
 * cuts). Same hue family as TILES' accent classes.
 */
const AXIS_COLOR: Record<"x" | "y" | "z", string> = {
  x: "rgba(245,158,11,0.75)",
  y: "rgba(139,92,246,0.75)",
  z: "rgba(20,184,166,0.75)",
};

/** fraction 0..1 → CSS percentage (1 decimal, same math as the clip overlay) */
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function OrthoTile({
  jobId,
  path,
  spec,
  dim,
  follow,
  clip,
  siblings,
  crosshairOn,
  onPositionChange,
  onPick,
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
  /** t278 — every axis' current position (the tri-planar focus point);
   *  this tile draws the crosshair of the OTHER two axes on its image */
  siblings: { x: number; y: number; z: number };
  /** t278 — whether the crosshair lines are shown (panel-level toggle) */
  crosshairOn: boolean;
  /** t278 — report this tile's position upward so siblings can draw it */
  onPositionChange?: (pos: number) => void;
  /** t278 — clicking the image picks a focus point: the panel moves the
   *  TWO sibling planes (hAxis/vAxis) to the clicked fractions */
  onPick?: (hFrac: number, vFrac: number) => void;
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

  // t278 — report the position upward (mount included) so the sibling
  // tiles' crosshair lines always speak the truth. An effect, not the
  // render body: the render-phase adoption above may also change pos,
  // and only ONE upward report should ride each committed value.
  useEffect(() => {
    onPositionChange?.(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  // t278 — voxel-true stepping: when the grid is known, one notch (slider
  // step, arrow key, ‹ › button) is exactly ONE voxel; without dims the
  // 1% fallback keeps the controls usable.
  const stepFrac = dim && dim > 1 ? 1 / (dim - 1) : 0.01;
  const stepVoxel = (d: 1 | -1) =>
    setPos((p) => Math.min(1, Math.max(0, p + d * stepFrac)));

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

  // t278 — the tri-planar crosshair. The tile's own position IS its plane;
  // the OTHER two axes' positions are drawn as dashed lines in the marked
  // plane's accent (see AXIS_COLOR): on the XY tile the vertical amber line
  // shows where the YZ plane cuts, the horizontal violet one where the XZ
  // plane cuts. Same renderer truth as the clip overlay (axis 0 = top row,
  // left column — no flip). Clicking the image PICKS a focus point: the
  // sibling planes move to the clicked fractions (the classic tri-planar
  // navigation — RELION's _display / medical-imaging viewers).
  const crossLines: React.ReactNode[] = [];
  if (crosshairOn) {
    for (const src of [spec.hAxis, spec.vAxis] as const) {
      const vertical = src === spec.hAxis;
      const at = siblings[src];
      crossLines.push(
        <div
          key={src}
          data-ortho-cross={src}
          data-ortho-on={spec.axis}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={
            vertical
              ? { left: pct(at), top: 0, bottom: 0, width: 0, borderLeft: `1px dashed ${AXIS_COLOR[src]}` }
              : { top: pct(at), left: 0, right: 0, height: 0, borderTop: `1px dashed ${AXIS_COLOR[src]}` }
          }
        />
      );
    }
  }

  let clipOverlay: React.ReactNode = null;
  let clippedAway = false;
  if (clip?.on) {
    // an unclipped axis (frac 1) carries NO plane even when inverted —
    // commitClip leaves it out entirely, so the scene keeps the full
    // extent and the tiles must tell the scene's truth (t254: the naive
    // [v, 1] collapse made an unclipped axis look fully cropped).
    // t260 — the anchored box owns the geometry when present: its [lo,hi]
    // per axis IS the kept interval, and a two-sided cut (X 25–75%) is
    // unrepresentable in the slider language the fallback speaks.
    const AX: Record<string, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
    const kept = (ax: "x" | "y" | "z"): [number, number] => {
      if (clip.box) return [clip.box.lo[AX[ax]], clip.box.hi[AX[ax]]];
      const v = clip[ax];
      return v >= 0.999 ? [0, 1] : clip.invert ? [v, 1] : [0, v];
    };
    const [n0, n1] = kept(spec.axis);
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
      const [h0, h1] = kept(spec.hAxis);
      const [v0, v1] = kept(spec.vAxis);
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

  /** t278 — click on the image: pick the focus point (fractional 0..1 in
   *  the image's own frame — hAxis left→right, vAxis top→bottom). The
   *  panel resolves which sibling planes move (hAxis/vAxis of THIS tile). */
  const pickFocus = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onPick?.(fx, fy);
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
        {/* t278 — voxel-true stepping: ‹ › move exactly one notch (one voxel
            when the grid is known); the slider's step and its arrow keys use
            the same stepFrac */}
        <button
          type="button"
          onClick={() => stepVoxel(-1)}
          data-canvas-ui={`ortho-step-${spec.axis}-dec`}
          aria-label={`Step the ${spec.plane} one voxel along ${spec.axisLabel} (toward the start)`}
          title={`Step one voxel along ${spec.axisLabel} (↓${dim ? "1" : "1%"})`}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => stepVoxel(1)}
          data-canvas-ui={`ortho-step-${spec.axis}-inc`}
          aria-label={`Step the ${spec.plane} one voxel along ${spec.axisLabel} (toward the end)`}
          title={`Step one voxel along ${spec.axisLabel} (↑${dim ? "1" : "1%"})`}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronRight className="size-3" aria-hidden="true" />
        </button>
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
      <div
        className="relative aspect-square cursor-crosshair"
        onClick={pickFocus}
        title="Click to move the focus point — the sibling planes follow"
      >
        <MrcImage
          src={src}
          alt={`${spec.plane} at ${readout}`}
          className={cn("h-full w-full transition-opacity duration-300", clippedAway && "opacity-45")}
        />
        {clipOverlay}
        {crossLines}
      </div>
      <Slider
        value={[pos]}
        min={0}
        max={1}
        step={stepFrac}
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
 *
 * t278 — the three tiles now share a tri-planar FOCUS POINT: every tile
 * reports its position up, the panel feeds the sibling positions back
 * down, and each tile draws the other two planes as dashed crosshair
 * lines (in the marked plane's accent). Clicking an image PICKS a focus
 * point — the two sibling planes move to the clicked fractions. The
 * panel header carries a crosshair on/off toggle (the 3D↔2D door and
 * the clip echo are untouched).
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
  /** t278 — the tri-planar focus point: each axis' current plane position */
  const [positions, setPositions] = useState<{ x: number; y: number; z: number }>({
    x: 0.5,
    y: 0.5,
    z: 0.5,
  });
  /** t278 — crosshair lines on/off (panel-level; default ON) */
  const [crosshairOn, setCrosshairOn] = useState(true);

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
  // contour-adjacent controls) moved — the matching tile follows. t278 —
  // the focus point rides along, so the crosshair never disagrees with
  // the plane the 3D scene just drove.
  useEffect(() => {
    const onSliceState = (e: Event) => {
      const d = (e as CustomEvent<{ axis?: string; pos?: number }>).detail;
      const axis = d?.axis?.toLowerCase();
      if (axis !== "x" && axis !== "y" && axis !== "z") return;
      if (typeof d.pos !== "number" || !Number.isFinite(d.pos)) return;
      followNonce.current += 1;
      setFollow((prev) => ({ ...prev, [axis]: { pos: d.pos as number, nonce: followNonce.current } }));
      setPositions((prev) => ({ ...prev, [axis]: d.pos as number }));
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
        box: d.box ?? null,
        nonce: clipNonce.current,
      }));
    };
    window.addEventListener(ORTHO_CLIP_STATE_EVENT, onClipState);
    return () => window.removeEventListener(ORTHO_CLIP_STATE_EVENT, onClipState);
  }, []);

  if (isStack) return null;

  const dimFor = (axis: "x" | "y" | "z") =>
    dims ? (axis === "x" ? dims[0] : axis === "y" ? dims[1] : dims[2]) : undefined;

  /** t278 — a tile clicked its image: move the TWO sibling planes to the
   *  clicked fractions (hAxis/vAxis of THAT tile). The fractions land in
   *  BOTH channels: positions (the crosshair lines) and follow (the
   *  adoption channel the 3D scene already drives — the sibling tiles
   *  glide their own planes to the picked point, so pick = navigation,
   *  not just annotation). */
  const pickFocus = (hAxis: "x" | "y" | "z", vAxis: "x" | "y" | "z", hFrac: number, vFrac: number) => {
    setPositions((prev) => ({ ...prev, [hAxis]: hFrac, [vAxis]: vFrac }));
    followNonce.current += 1;
    setFollow((prev) => ({
      ...prev,
      [hAxis]: { pos: hFrac, nonce: followNonce.current },
      [vAxis]: { pos: vFrac, nonce: followNonce.current },
    }));
  };

  return (
    <section
      aria-label="Orthogonal slice browser"
      data-canvas-ui="ortho-panel"
      className="shrink-0 rounded-lg border border-border/80 bg-card/40"
    >
      <div className="flex w-full items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left"
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
        {/* t278 — the tri-planar crosshair toggle. Sibling of the expand
            button (never nested): the expand behaviour stays the same for
            every existing locator while the crosshair gets its own switch. */}
        <button
          type="button"
          onClick={() => setCrosshairOn((c) => !c)}
          aria-pressed={crosshairOn}
          data-canvas-ui="ortho-crosshair-toggle"
          aria-label="Toggle the tri-planar crosshair"
          title={
            crosshairOn
              ? "The dashed lines mark where the sibling planes cut — click an image to move the focus point"
              : "Crosshair hidden — click to show where the sibling planes cut"
          }
          className={cn(
            "shrink-0 rounded p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            crosshairOn ? "text-cyan-600" : "text-muted-foreground"
          )}
        >
          <Focus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
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
              siblings={positions}
              crosshairOn={crosshairOn}
              onPositionChange={(pos) =>
                setPositions((prev) => (prev[t.axis] === pos ? prev : { ...prev, [t.axis]: pos }))
              }
              onPick={(hFrac, vFrac) => pickFocus(t.hAxis, t.vAxis, hFrac, vFrac)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
