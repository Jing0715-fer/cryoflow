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
 *
 * t281 — the DENSITY PROBE: hovering a tile reads the density value under
 * the cursor (`format=value` — a single-voxel server pread) with a solid
 * sky cursor-crosshair distinct from the dashed focus lines; the value +
 * 1-based voxel address sit in a corner chip. "Is this blob particle or
 * noise" wants a number, not a squint.
 *
 * t283 — the HISTOGRAM: the volume's whole density distribution as a
 * strip under the tiles (`format=histogram` — a chunked two-pass server
 * read, cached per map). The σ ruler marks ±1/2/3σ, the current contour
 * is drawn as a cyan cut line, and CLICKING the strip picks a new contour:
 * the density under the cursor becomes σ through ORTHO_SIGMA_SET, the
 * embed's existing pump commits it, and the STATE echo moves the chip and
 * the cut line — the loop closes. "Where should the contour cut" is now
 * answered by seeing the distribution, not by slider trial-and-error.
 */

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, Crosshair, Download, Focus, Loader2, ScanLine, TriangleAlert } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { MrcImage } from "./mrc-image";
import { cn } from "@/lib/utils";

/** event names for the two-way 3D↔2D linkage — see molstar-embed.tsx */
export const ORTHO_SLICE_EVENT = "cryoflow:ortho-slice";
export const ORTHO_SLICE_STATE_EVENT = "cryoflow:slice-state";
/** 3D → 2D clip echo (t253): the box-clip state, so tiles can speak it */
export const ORTHO_CLIP_STATE_EVENT = "cryoflow:clip-state";
/** 2D → 3D (t279): the tri-planar focus point moved — the embed stores it
 *  in a ref so the bookmark capture freezes the whole picture (the focus
 *  point is part of a saved view, not just the camera and the σ) */
export const ORTHO_FOCUS_EVENT = "cryoflow:ortho-focus";
/** 3D → 2D (t279): a restored bookmark carries a focus point — the three
 *  tiles adopt it through the same channels a pick uses, so "fly back"
 *  means the whole picture here too (restore = navigation, not a note) */
export const ORTHO_FOCUS_RESTORE_EVENT = "cryoflow:ortho-focus-restore";
/** 3D → 2D (t280): the isosurface contour the 3D view is drawn at — the
 *  ortho panel shows it as a header chip and records it in the triptych
 *  export footer (a figure without its contour level is half a figure:
 *  RELION's _display always prints σ alongside the map) */
export const ORTHO_SIGMA_STATE_EVENT = "cryoflow:ortho-sigma-state";
/** 2D → 3D (t280): the panel's pull channel — the embed answers with one
 *  ORTHO_SIGMA_STATE carrying the current σ, so a panel that mounts after
 *  the last σ change (or the dialog's first paint) still learns the value
 *  without the embed having to re-broadcast on a timer */
export const ORTHO_SIGMA_REQUEST_EVENT = "cryoflow:ortho-sigma-request";
/** 2D → 3D (t283): the SET channel — the histogram strip is a contour
 *  PICKER: clicking a density sends it as a σ (sign follows the clicked
 *  side of the mean) and the embed commits it through the same pump the
 *  slider drives. Completes the σ family: STATE echoes (3D→2D), REQUEST
 *  pulls (2D→3D), SET commands (2D→3D). */
export const ORTHO_SIGMA_SET_EVENT = "cryoflow:ortho-sigma-set";

/** the σ payload both directions speak: the contour level in σ units and
 *  the density sign it is measured on (negative = the inverted surface) */
export interface OrthoSigmaState {
  sigma: number;
  sign: 1 | -1;
}

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

/** t281 — minimum gap between probe fetches (ms): mousemove fires at
 *  pointer-event rate, the single-voxel pread is cheap but a flood of
 *  them is still a flood; the crosshair line follows the cursor at full
 *  rate and only the VALUE chases on this cadence */
const PROBE_THROTTLE_MS = 140;
/** t281 — the probe's hue (sky, the σ chip's cyan family): distinct from
 *  the three focus accents so "where I am looking" (dashed, accent) and
 *  "where my cursor is" (solid, sky) never share a colour language */
const PROBE_COLOR = "rgba(56,189,248,0.8)";

/** t283 — the histogram strip's palette, per theme (canvas paints raw
 *  colours — the strip is an instrument, and an instrument must stay
 *  readable in both themes). Bars live in the cyan family: the strip's
 *  whole business is the contour, and the contour's hue is the σ chip's. */
const HIST_BAR = { light: "rgba(8,145,178,0.62)", dark: "rgba(103,232,249,0.55)" };
const HIST_BAR_HOVER = { light: "rgba(8,145,178,0.9)", dark: "rgba(103,232,249,0.9)" };
const HIST_GRID = { light: "rgba(0,0,0,0.10)", dark: "rgba(255,255,255,0.10)" };
const HIST_TEXT = { light: "rgba(0,0,0,0.45)", dark: "rgba(255,255,255,0.45)" };
const HIST_CUT = { light: "#0891b2", dark: "#22d3ee" };
const HIST_MEAN = { light: "rgba(0,0,0,0.55)", dark: "rgba(255,255,255,0.55)" };
/** strip metrics (CSS px) */
const HIST_PAD_L = 6;
const HIST_PAD_R = 6;
const HIST_PAD_T = 9;
const HIST_PAD_B = 15;
/** σ values marked by the ruler — every one the stats actually span */
const HIST_SIGMA_TICKS = [-3, -2, -1, 0, 1, 2, 3];

/** t279 — canvas colours for the exported triptych: the same axis accents
 *  as AXIS_COLOR (crosshair lines keep their on-screen hue) on a deep
 *  publishing-style backdrop — the export is a document asset, its look
 *  must not swing with the app theme */
const EXPORT_BG = "#0b1220";
const EXPORT_TILE_BORDER = "#334155";
const EXPORT_TEXT = "#94a3b8";
/** solid (non-alpha) versions of the accents for label text on the dark strip */
const AXIS_LABEL: Record<"x" | "y" | "z", string> = {
  x: "#f59e0b",
  y: "#8b5cf6",
  z: "#14b8a6",
};
/** raster metrics of the exported triptych (fixed grid — a document, not
 *  a screenshot: it looks identical at any window size) */
const EXPORT_TILE = 512;
const EXPORT_LABEL_H = 34;
const EXPORT_FOOT_H = 42;
const EXPORT_GAP = 14;

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

  // t281 — the DENSITY PROBE: hovering the image reads the density value
  // under the cursor (the classic instrument every medical-imaging viewer
  // and RELION's _display carry — "is this blob particle or noise" wants
  // a NUMBER, not a squint). The crosshair line tracks the cursor at full
  // pointer rate (it is pure geometry, no I/O); the VALUE chases on a
  // throttle against `format=value` — a single-voxel server pread, so
  // even hover-frequency polling never touches a plane buffer. The fetch
  // speaks the RENDERED position (the image on screen), not the slider's
  // live one — the number must belong to the pixels it hovers over.
  const [probe, setProbe] = useState<{
    fx: number;
    fy: number;
    value: number | null;
    voxel: { x: number; y: number; z: number } | null;
  } | null>(null);
  const probeAbort = useRef<AbortController | null>(null);
  const lastProbeAt = useRef(0);
  const probeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      // unmount — never let a dying tile's fetch land anywhere
      probeAbort.current?.abort();
      if (probeTimer.current) clearTimeout(probeTimer.current);
    },
    []
  );
  const fireProbe = (fx: number, fy: number) => {
    probeAbort.current?.abort();
    const ac = new AbortController();
    probeAbort.current = ac;
    const qs = `path=${encodeURIComponent(path)}&format=value&axis=${spec.axis}&pos=${rendered.toFixed(3)}&fx=${fx.toFixed(4)}&fy=${fy.toFixed(4)}`;
    fetch(`/api/jobs/${jobId}/outputs/file?${qs}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { value?: unknown; voxel?: { x: number; y: number; z: number } } | null) => {
        if (!d || typeof d.value !== "number" || !Number.isFinite(d.value)) return;
        setProbe((p) => (p ? { ...p, value: d.value as number, voxel: d.voxel ?? null } : p));
      })
      .catch(() => {}); // aborted on leave/unmount — silence is correct
  };
  // TRAILING throttle: a move inside the window schedules the fetch for
  // when it closes (instead of dropping it) — a cursor that STOPS always
  // gets its final position probed, never the one 200 ms behind it
  const moveProbe = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    // the line is instant (local geometry); the value keeps whatever it
    // had until the next fetch answers — the chip never flashes empty
    setProbe((p) => (p ? { ...p, fx, fy } : { fx, fy, value: null, voxel: null }));
    const now = Date.now();
    const remaining = PROBE_THROTTLE_MS - (now - lastProbeAt.current);
    if (probeTimer.current) clearTimeout(probeTimer.current);
    if (remaining <= 0) {
      lastProbeAt.current = now;
      fireProbe(fx, fy);
    } else {
      probeTimer.current = setTimeout(() => {
        lastProbeAt.current = Date.now();
        fireProbe(fx, fy);
      }, remaining);
    }
  };
  const leaveProbe = () => {
    if (probeTimer.current) clearTimeout(probeTimer.current);
    probeAbort.current?.abort();
    setProbe(null);
  };

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

  // t281 — the probe's readout text: value first (the NUMBER the tool
  // exists for), then the 1-based voxel address (same convention as the
  // tile readout "z 33/64"). While the first fetch is in flight the
  // address shows alone — "no value yet" must not read as "value 0".
  const probeText =
    probe === null
      ? null
      : probe.value === null
        ? probe.voxel
          ? `… @ ${probe.voxel.x + 1},${probe.voxel.y + 1},${probe.voxel.z + 1}`
          : null
        : `${probe.value.toFixed(3)}${probe.voxel ? ` @ ${probe.voxel.x + 1},${probe.voxel.y + 1},${probe.voxel.z + 1}` : ""}`;

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
        onMouseMove={moveProbe}
        onMouseLeave={leaveProbe}
        title="Hover reads the density at the cursor · click to move the focus point — the sibling planes follow"
      >
        <MrcImage
          src={src}
          alt={`${spec.plane} at ${readout}`}
          className={cn("h-full w-full transition-opacity duration-300", clippedAway && "opacity-45")}
        />
        {clipOverlay}
        {crossLines}
        {probe && (
          <>
            {/* t281 — the cursor's own crosshair: SOLID sky lines (the focus
                lines above are DASHED accent-coloured — the two instruments
                never blur together) */}
            <div
              data-ortho-probe="h"
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{ left: pct(probe.fx), top: 0, bottom: 0, width: 0, borderLeft: `1px solid ${PROBE_COLOR}` }}
            />
            <div
              data-ortho-probe="v"
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{ top: pct(probe.fy), left: 0, right: 0, height: 0, borderTop: `1px solid ${PROBE_COLOR}` }}
            />
            {probeText && (
              <div
                data-canvas-ui="ortho-probe-readout"
                className="pointer-events-none absolute bottom-1 left-1 rounded border border-sky-500/30 bg-background/85 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-sky-300"
              >
                {probeText}
              </div>
            )}
          </>
        )}
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
/* ------------------------------------------------------------------ */
/* t283 — the density histogram strip                                  */
/* ------------------------------------------------------------------ */

interface HistPayload {
  nTotal: number;
  nFinite: number;
  min: number;
  max: number;
  mean: number;
  std: number;
  lo: number;
  hi: number;
  bins: number[];
}

const fmtHist = (v: number) =>
  Math.abs(v) >= 1000 ? v.toLocaleString("en-US") : v.toFixed(4).replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m));
const fmtN = (v: number) => v.toLocaleString("en-US");

/**
 * t283 — the volume's density histogram as an interactive strip. The
 * server counts EVERY voxel (chunked two-pass, cached); the strip draws
 * log-scaled bars (cryo-EM histograms are a noise spike with particle
 * tails — linear y would flatten everything else into invisibility), a
 * σ ruler at ±1/2/3σ, the mean marker, and the CURRENT contour as a cyan
 * cut line. Clicking anywhere turns that density into the contour
 * (ORTHO_SIGMA_SET → the embed's pump commits → the STATE echo moves the
 * chip and the cut line). Hovering reads the bin: value, σ offset, count
 * — the probe's "numbers, not squints" doctrine, one level up.
 */
function OrthoHistogram({
  jobId,
  path,
  isoSigma,
}: {
  jobId: string;
  path: string;
  isoSigma: OrthoSigmaState | null;
}) {
  const [data, setData] = useState<HistPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "err">("loading");
  const [hover, setHover] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();

  // one fetch per strip mount — the server caches the histogram per
  // (path, mtime, size), so re-opening the strip is free
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setData(null);
    fetch(
      `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=histogram`,
      { cache: "no-store" }
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (
          !d ||
          !Array.isArray(d.bins) ||
          d.bins.length === 0 ||
          typeof d.mean !== "number" || !Number.isFinite(d.mean) ||
          typeof d.std !== "number" || !Number.isFinite(d.std) ||
          typeof d.lo !== "number" || typeof d.hi !== "number"
        ) {
          throw new Error("bad payload");
        }
        if (cancelled) return;
        setData(d as HistPayload);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("err");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, path]);

  // the draw — data, contour, hover and theme all repaint the strip
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || state !== "ready" || !data) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dark = resolvedTheme === "dark";
    const bar = dark ? HIST_BAR.dark : HIST_BAR.light;
    const barHover = dark ? HIST_BAR_HOVER.dark : HIST_BAR_HOVER.light;
    const grid = dark ? HIST_GRID.dark : HIST_GRID.light;
    const text = dark ? HIST_TEXT.dark : HIST_TEXT.light;
    const cut = dark ? HIST_CUT.dark : HIST_CUT.light;
    const meanCol = dark ? HIST_MEAN.dark : HIST_MEAN.light;

    const w = cv.clientWidth || 1;
    const h = cv.clientHeight || 1;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const x0 = HIST_PAD_L;
    const x1 = w - HIST_PAD_R;
    const y0 = HIST_PAD_T;
    const y1 = h - HIST_PAD_B;
    const span = data.hi - data.lo;
    const xOf = (v: number) =>
      span > 0 ? x0 + ((v - data.lo) / span) * (x1 - x0) : (x0 + x1) / 2;

    // σ ruler — the ticks the stats actually span, μ strongest
    ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineWidth = 1;
    for (const s of HIST_SIGMA_TICKS) {
      const v = data.mean + s * data.std;
      if (v < data.lo || v > data.hi) continue;
      const gx = xOf(v);
      ctx.strokeStyle = s === 0 ? meanCol : grid;
      ctx.beginPath();
      ctx.moveTo(gx, y0 - 2);
      ctx.lineTo(gx, y1);
      ctx.stroke();
      ctx.fillStyle = text;
      ctx.fillText(s === 0 ? "μ" : `${s > 0 ? "+" : ""}${s}σ`, gx, y1 + 3);
    }

    // bars — log-scaled: log10(1 + c) against the max, so the noise peak
    // and the particle tails share one readable picture
    const bins = data.bins;
    const n = bins.length;
    let maxC = 0;
    for (const c of bins) if (c > maxC) maxC = c;
    if (maxC <= 0) maxC = 1;
    const logMax = Math.log10(1 + maxC);
    const bw = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const c = bins[i];
      if (c <= 0) continue;
      const bh = ((y1 - y0) * Math.log10(1 + c)) / logMax;
      ctx.fillStyle = hover === i ? barHover : bar;
      // 1px gap between bars keeps 256 bins legible at strip width
      ctx.fillRect(x0 + i * bw, y1 - bh, Math.max(0.5, bw - 1), bh);
    }

    // the current contour — a cyan cut line; an off-scale threshold is
    // drawn as a faded arrowhead AT the edge (honest: the value lives
    // beyond the visible range, the σ chip says how far)
    if (isoSigma) {
      const v = data.mean + isoSigma.sign * isoSigma.sigma * data.std;
      const cx = Math.min(x1, Math.max(x0, xOf(v)));
      const inside = v >= data.lo && v <= data.hi;
      ctx.strokeStyle = cut;
      ctx.globalAlpha = inside ? 1 : 0.35;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, y0 - 3);
      ctx.lineTo(cx, y1);
      ctx.stroke();
      if (!inside) {
        // arrowhead at the edge, pointing off-scale
        ctx.beginPath();
        const dir = v > data.hi ? 1 : -1;
        ctx.moveTo(cx + 3 * dir, y0 - 1);
        ctx.lineTo(cx - 2 * dir, y0 - 5);
        ctx.lineTo(cx - 2 * dir, y0 + 3);
        ctx.closePath();
        ctx.fillStyle = cut;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // hover readout — value, σ offset and count of the bin under the
    // cursor (top-left, mono, on a translucent backing)
    if (hover !== null && hover >= 0 && hover < n) {
      const binW = span > 0 ? span / n : 0;
      const mid = data.lo + (hover + 0.5) * binW;
      const sOff = data.std > 0 ? (mid - data.mean) / data.std : 0;
      const line = `${mid.toFixed(4)} (${sOff >= 0 ? "+" : ""}${sOff.toFixed(2)}σ) · ${fmtN(data.bins[hover])} vx`;
      ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const tw = ctx.measureText(line).width;
      ctx.fillStyle = dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
      ctx.fillRect(x0, y0, tw + 8, 13);
      ctx.fillStyle = dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)";
      ctx.fillText(line, x0 + 4, y0 + 2);
    }
  }, [data, state, isoSigma, hover, resolvedTheme]);

  const binAt = (clientX: number) => {
    const cv = canvasRef.current;
    if (!cv || !data) return null;
    const rect = cv.getBoundingClientRect();
    const x0 = HIST_PAD_L;
    const x1 = rect.width - HIST_PAD_R;
    const frac = (clientX - rect.left - x0) / (x1 - x0);
    const n = data.bins.length;
    const idx = Math.trunc(frac * n);
    if (!Number.isFinite(idx) || idx < 0 || idx >= n) return null;
    return idx;
  };

  return (
    <div
      data-canvas-ui="ortho-hist"
      data-hist-state={state}
      className="rounded-md border border-border/60 bg-background/40 px-2 pb-1.5 pt-1.5"
    >
      {state === "ready" && data ? (
        <>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="The volume's density histogram with the σ ruler and the current contour"
            title="The volume's density distribution — click anywhere to cut the isosurface at that density"
            className="h-24 w-full cursor-crosshair select-none"
            onPointerMove={(e) => setHover(binAt(e.clientX))}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              // the pick: clicked density → σ (sign follows the clicked
              // side of the mean) → the embed commits through its pump
              const cv = canvasRef.current;
              if (!cv || !data || data.std <= 0) return;
              const rect = cv.getBoundingClientRect();
              const x0 = HIST_PAD_L;
              const x1 = rect.width - HIST_PAD_R;
              const frac = (e.clientX - rect.left - x0) / (x1 - x0);
              if (!Number.isFinite(frac)) return;
              const v = data.lo + Math.min(1, Math.max(0, frac)) * (data.hi - data.lo);
              const raw = (v - data.mean) / data.std;
              const sign: 1 | -1 = raw < 0 ? -1 : 1;
              const sigma = Math.min(10, Math.max(0.05, Math.abs(raw)));
              window.dispatchEvent(new CustomEvent(ORTHO_SIGMA_SET_EVENT, { detail: { sigma, sign } }));
            }}
          />
          <div
            data-canvas-ui="ortho-hist-stats"
            data-hist-mean={data.mean.toFixed(6)}
            data-hist-std={data.std.toFixed(6)}
            data-hist-n={String(data.nFinite)}
            data-hist-lo={data.lo.toFixed(6)}
            data-hist-hi={data.hi.toFixed(6)}
            className="flex items-baseline justify-between gap-2 font-mono text-[9px] tabular-nums text-muted-foreground"
          >
            <span className="truncate">
              n {fmtN(data.nFinite)} · μ {fmtHist(data.mean)} · σ {fmtHist(data.std)}
            </span>
            <span className="truncate text-right">
              min {fmtHist(data.min)} · max {fmtHist(data.max)} · log count
            </span>
          </div>
        </>
      ) : state === "err" ? (
        <div className="flex h-24 items-center justify-center text-[10px] text-muted-foreground">
          The density histogram is unavailable for this map.
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          counting voxels…
        </div>
      )}
    </div>
  );
}

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
  /** t283 — the density histogram strip on/off (default OFF: the first
   *  look costs one volume walk — the toggle makes that an explicit ask,
   *  and the server cache makes every later look free) */
  const [histOn, setHistOn] = useState(false);
  /** t279 — export button's machine state: idle / rasterizing / flash */
  const [exportState, setExportState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  /** t280 — the 3D view's isosurface contour, as last reported by the
   *  embed (push on change + pull on mount). Null = nothing heard yet —
   *  the chip stays absent and the export footer skips the σ segment
   *  rather than guessing a default (the footer must not lie). */
  const [isoSigma, setIsoSigma] = useState<OrthoSigmaState | null>(null);

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

  // 3D → 2D (t280): the embed's isosurface contour moved (slider, preset
  // button, restored bookmark) — the header chip follows. The listener is
  // also the answer side of the pull channel: mounting dispatches one
  // ORTHO_SIGMA_REQUEST and the embed replays its CURRENT value, so the
  // chip is live from the dialog's first paint instead of waiting for the
  // user's first σ interaction.
  useEffect(() => {
    const onSigmaState = (e: Event) => {
      const d = (e as CustomEvent<Partial<OrthoSigmaState>>).detail;
      if (!d || typeof d.sigma !== "number" || !Number.isFinite(d.sigma) || (d.sign !== 1 && d.sign !== -1)) return;
      setIsoSigma({ sigma: d.sigma, sign: d.sign });
    };
    window.addEventListener(ORTHO_SIGMA_STATE_EVENT, onSigmaState);
    window.dispatchEvent(new CustomEvent(ORTHO_SIGMA_REQUEST_EVENT));
    return () => window.removeEventListener(ORTHO_SIGMA_STATE_EVENT, onSigmaState);
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

  // 2D → 3D (t279): the focus point is part of a saved view — every
  // committed positions change is reported once to the embed, whose
  // bookmark capture reads it from a ref (fire-and-forget; the embed
  // never re-renders for this).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(ORTHO_FOCUS_EVENT, { detail: { ...positions } }));
  }, [positions]);

  // 3D → 2D (t279): a restored bookmark carries a focus point — the three
  // tiles adopt it through the SAME two channels a pick uses (positions
  // for the crosshair lines, follow for the plane glide), so "fly back"
  // is navigation here too, not just a note on a map.
  useEffect(() => {
    const onFocusRestore = (e: Event) => {
      const d = (e as CustomEvent<Partial<{ x: number; y: number; z: number }>>).detail;
      if (!d || typeof d !== "object") return;
      const ax = (v: unknown, fb: number) =>
        typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fb;
      followNonce.current += 1;
      const nonce = followNonce.current;
      setPositions((prev) => ({ x: ax(d.x, prev.x), y: ax(d.y, prev.y), z: ax(d.z, prev.z) }));
      setFollow((prev) => ({
        x: { pos: ax(d.x, prev.x?.pos ?? 0.5), nonce },
        y: { pos: ax(d.y, prev.y?.pos ?? 0.5), nonce },
        z: { pos: ax(d.z, prev.z?.pos ?? 0.5), nonce },
      }));
    };
    window.addEventListener(ORTHO_FOCUS_RESTORE_EVENT, onFocusRestore);
    return () => window.removeEventListener(ORTHO_FOCUS_RESTORE_EVENT, onFocusRestore);
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

  // t279 — the flash-back timer: ok/err states return to idle on their own
  useEffect(() => {
    if (exportState !== "ok" && exportState !== "err") return;
    const t = setTimeout(() => setExportState("idle"), 1600);
    return () => clearTimeout(t);
  }, [exportState]);

  /** t279 — export the three orthogonal sections as ONE PNG triptych (the
   *  classic multi-panel figure in every cryo-EM paper). The tiles' own
   *  server renderer supplies the planes at the CURRENT focus point; the
   *  crosshair lines (same accents as on screen), per-plane voxel readouts
   *  and a footer naming the map, the focus fractions and the moment are
   *  drawn on a fixed publishing-style grid — a document asset, not a
   *  screenshot: it looks the same at any window size or theme. */
  const exportTriptych = async () => {
    if (exportState === "busy") return;
    setExportState("busy");
    try {
      const planes = await Promise.all(
        TILES.map(async (t) => {
          const url = `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=png&axis=${t.axis}&pos=${positions[t.axis].toFixed(3)}`;
          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) throw new Error(`render failed (${r.status})`);
          return createImageBitmap(await r.blob());
        })
      );
      const W = EXPORT_GAP * 4 + EXPORT_TILE * 3;
      const H = EXPORT_GAP + EXPORT_LABEL_H + EXPORT_TILE + EXPORT_GAP + EXPORT_FOOT_H;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.fillStyle = EXPORT_BG;
      ctx.fillRect(0, 0, W, H);
      const readoutFor = (axis: "x" | "y" | "z", v: number) => {
        const d = dimFor(axis);
        if (d && d > 1) return `${axis} ${Math.round(v * (d - 1)) + 1}/${d}`;
        return `${axis} ${Math.round(v * 100)}%`;
      };
      TILES.forEach((t, i) => {
        const x0 = EXPORT_GAP + i * (EXPORT_TILE + EXPORT_GAP);
        // label strip: plane name in the tile's accent, voxel readout right
        ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
        ctx.fillStyle = AXIS_LABEL[t.axis];
        ctx.textBaseline = "middle";
        ctx.fillText(t.plane, x0, EXPORT_GAP + EXPORT_LABEL_H / 2);
        ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = EXPORT_TEXT;
        ctx.textAlign = "right";
        ctx.fillText(readoutFor(t.axis, positions[t.axis]), x0 + EXPORT_TILE, EXPORT_GAP + EXPORT_LABEL_H / 2);
        ctx.textAlign = "left";
        // the plane itself
        ctx.drawImage(planes[i], x0, EXPORT_GAP + EXPORT_LABEL_H, EXPORT_TILE, EXPORT_TILE);
        ctx.strokeStyle = EXPORT_TILE_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, EXPORT_GAP + EXPORT_LABEL_H + 0.5, EXPORT_TILE - 1, EXPORT_TILE - 1);
        // the crosshair — same hue and dashed language as the live tiles
        if (crosshairOn) {
          ctx.save();
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1.5;
          for (const src of [t.hAxis, t.vAxis] as const) {
            const at = positions[src] * EXPORT_TILE;
            ctx.strokeStyle = AXIS_COLOR[src];
            ctx.beginPath();
            if (src === t.hAxis) {
              ctx.moveTo(x0 + at, EXPORT_GAP + EXPORT_LABEL_H);
              ctx.lineTo(x0 + at, EXPORT_GAP + EXPORT_LABEL_H + EXPORT_TILE);
            } else {
              ctx.moveTo(x0, EXPORT_GAP + EXPORT_LABEL_H + at);
              ctx.lineTo(x0 + EXPORT_TILE, EXPORT_GAP + EXPORT_LABEL_H + at);
            }
            ctx.stroke();
          }
          ctx.restore();
        }
      });
      // footer: map name left, contour + focus fractions + moment right
      // (t280 — the σ segment joins when the embed has reported a contour:
      // a figure without its contour level is half a figure, but a GUESSED
      // one is a lie — absent σ simply keeps the footer honest)
      const footY = EXPORT_GAP + EXPORT_LABEL_H + EXPORT_TILE + EXPORT_GAP + EXPORT_FOOT_H / 2;
      const base = path.split("/").pop() || path;
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(base, EXPORT_GAP, footY);
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = EXPORT_TEXT;
      ctx.textAlign = "right";
      const sigmaSeg = isoSigma ? `iso ${isoSigma.sign < 0 ? "-" : ""}${isoSigma.sigma.toFixed(2)} σ · ` : "";
      const f = `${sigmaSeg}focus x ${Math.round(positions.x * 100)}% · y ${Math.round(positions.y * 100)}% · z ${Math.round(positions.z * 100)}%   ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
      ctx.fillText(f, W - EXPORT_GAP, footY);
      ctx.textAlign = "left";
      const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png"));
      if (!blob) throw new Error("encode failed");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
      a.download = `ortho-${base.replace(/\.(mrc|mrcs)$/i, "")}-${stamp}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setExportState("ok");
    } catch {
      setExportState("err");
    }
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
        {/* t280 — the isosurface contour the 3D view is drawn at, as a
            quiet mono chip. Sibling of the crosshair/export buttons (never
            nested); absent until the embed reports a σ — the panel never
            guesses a default (the chip must not lie). */}
        {isoSigma && (
          <span
            data-canvas-ui="ortho-sigma-chip"
            title="The isosurface contour the 3D view is drawn at — recorded in the triptych export footer"
            className="shrink-0 rounded bg-cyan-600/10 px-1.5 py-0.5 font-mono text-[9px] font-medium tabular-nums text-cyan-700 dark:text-cyan-400"
          >
            iso {isoSigma.sign < 0 ? "-" : ""}{isoSigma.sigma.toFixed(2)} σ
          </span>
        )}
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
        {/* t279 — export the triptych: one PNG with the three sections at
            the current focus point, crosshair included. Sibling of the
            crosshair toggle, never nested inside the expand button. */}
        <button
          type="button"
          onClick={exportTriptych}
          disabled={exportState === "busy"}
          data-canvas-ui="ortho-export"
          data-ortho-export-state={exportState}
          aria-label="Export the three orthogonal sections as a PNG triptych"
          title="Export the three sections (crosshair included) as one PNG"
          className={cn(
            "shrink-0 rounded p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            exportState === "ok"
              ? "text-teal-600"
              : exportState === "err"
                ? "text-amber-600"
                : "text-muted-foreground"
          )}
        >
          {exportState === "busy" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : exportState === "ok" ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : exportState === "err" ? (
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
        {/* t283 — the density histogram toggle. Sibling of the export
            button (never nested); the strip is the σ PICKER — click a
            density, the contour moves there. */}
        <button
          type="button"
          onClick={() => setHistOn((v) => !v)}
          aria-pressed={histOn}
          data-canvas-ui="ortho-hist-toggle"
          aria-label="Toggle the density histogram"
          title={
            histOn
              ? "Hide the density histogram (the σ picker)"
              : "Show the density histogram — click it to move the contour"
          }
          className={cn(
            "shrink-0 rounded p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            histOn ? "text-cyan-600" : "text-muted-foreground"
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
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
      {open && histOn && !isStack && (
        <div className="px-3 pb-3">
          <OrthoHistogram jobId={jobId} path={path} isoSigma={isoSigma} />
        </div>
      )}
    </section>
  );
}
