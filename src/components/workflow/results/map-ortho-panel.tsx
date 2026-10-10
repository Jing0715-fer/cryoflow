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
 *
 * t284 — the strip's code moved to density-histogram.tsx (ONE drawing
 * truth, two consumers): this panel passes the live contour (cutSigma)
 * and the click→σ dispatch; the quick-look dialog renders the same
 * instrument read-only.
 *
 * t661 — the OBLIQUE block's ✂ toggle: the settled plane mirrors into the
 * embed's isosurface clip (OBLIQUE_CLIP_EVENT) — the surface opens along
 * the tile's exact geometry, the loop's third half after ⌖ and ⤸.
 *
 * t664 — the cut's 2D shadow: while the clip is live, every tile draws the
 * LINE where that plane crosses its own slice (a dashed violet trace +
 * scissors badge — `obliqueTraceOnTile`). The tiles listen to the same
 * wire the embed speaks (request + applied-state ACK), so a chip clear or
 * a bookmark revival outside the block's sliders still moves the shadow;
 * the line mirrors the SCENE, not the block's UI.
 */

import { useEffect, useRef, useState } from "react";
import { BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, Crosshair, Download, Focus, Loader2, ScanEye, ScanLine, Scissors, Slice, TriangleAlert } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Kbd } from "@/components/ui/kbd"; // t830 — the keymap row speaks the one kbd vocabulary (t642)
import { MrcImage } from "./mrc-image";
import { DensityHistogramStrip } from "./density-histogram";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/lib/download"; // t646 — one blob sink (this dance skipped the attach-before-click law)

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
/** 2D → 3D (t556): the OBLIQUE camera jump — the block's ⌖ swings the 3D
 *  camera to look straight down the cut's normal, face-on at the plane.
 *  dir = +normal (camera rides the −n side: from THERE, screen-right is
 *  the tile's +u and screen-down is the tile's +v — the face-on view and
 *  the tile agree chirality-for-chirality), up = −v. The plane itself
 *  cannot ride Mol*'s axis-aligned slice representation; the camera CAN
 *  agree with it (this event's half), and since t661 the isosurface CAN
 *  be CUT by it too (OBLIQUE_CLIP_EVENT — the loop's third half). */
export const OBLIQUE_VIEW_EVENT = "cryoflow:oblique-view";
/** 2D → 3D (t661): the CUT half of the oblique loop. The block's ✂ toggle
 *  mirrors the settled plane into the embed's isosurface clip: Mol*'s slice
 *  representation is axis-aligned only (the wall t556 rounded with the
 *  camera), but the isosurface's pixel-clip planes take ANY normal — the
 *  surface opens along the 2D tile's exact geometry, and the tile's density
 *  read plus the 3D cut surface describe the same plane from both sides.
 *  detail = { on, theta, phi, offset } (offset in fractions, −1…1);
 *  on:false retires the plane. The kept half is the 3D chip's flip. */
export const OBLIQUE_CLIP_EVENT = "cryoflow:oblique-clip";
/** 3D → 2D (t661): the cut's ACK — the embed echoes EVERY applied oblique
 *  state ({ on, theta, phi, offset, invert }) so the block's ✂ toggle
 *  agrees with the scene: chip flip is 3D-local (no 2D concept), but chip
 *  clear / a bookmark restore retire or revive the plane OUTSIDE the
 *  block's sliders — without the echo, a later scrub would silently
 *  resurrect a cut the viewer already dismissed (the toggle would lie). */
export const OBLIQUE_CLIP_STATE_EVENT = "cryoflow:oblique-clip-state";
export interface ObliqueViewDetail {
  /** unit plane normal in grid coords */
  normal: [number, number, number];
  /** unit screen-north for the face-on view (the tile's −v) */
  up: [number, number, number];
}

/** 3D → 2D (t557): the ⌖'s RETURN ticket. The panel pulls, the embed
 *  answers with the live view direction, and the oblique block takes it
 *  as its plane normal — orbit to an interesting plane in 3D, adopt it,
 *  and the 2D cut renders the geometry you were just looking through.
 *  Only the direction crosses the wire: the camera's roll is deliberately
 *  NOT adopted (u/v stay the block's canonical frame, derived from n, so
 *  readouts and renders stay reproducible — ⌖ remains the way to
 *  canonicalize the roll), and offset stays the user's own dial (the
 *  preset family keeps the target at the box center, where offset 0
 *  already cuts). Synchronous pull like the σ family's REQUEST/STATE. */
export const ORTHO_CAMERA_REQUEST_EVENT = "cryoflow:ortho-camera-request";
/** the answering half: dir = unit view direction (camera→target) in the
 *  map's frame — exactly the law applyViewPreset drives in reverse
 *  (focus(): position = target − dir·d), so adopt → ⌖ lands the camera
 *  back on the same face-on line. Grid axes == cartesian axes holds for
 *  the isotropic-voxel maps cryo-EM produces (the same assumption the ⌖
 *  jump already makes). */
export const ORTHO_CAMERA_STATE_EVENT = "cryoflow:ortho-camera-state";
export interface OrthoCameraStateDetail {
  dir: [number, number, number];
}

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

// t284 — the histogram strip (palette, metrics, σ ticks, draw core,
// fetch, hover, stats row) moved to density-histogram.tsx: ONE drawing
// truth, two consumers — this panel passes the live cutSigma + the
// click→σ dispatch; the quick-look dialog renders it read-only.

/** t279 — canvas colours for the exported triptych: the same axis accents
 *  as AXIS_COLOR (crosshair lines keep their on-screen hue) on a deep
 *  publishing-style backdrop — the export is a document asset, its look
 *  must not swing with the app theme */
const EXPORT_BG = "#0b1220";
const EXPORT_TILE_BORDER = "#334155";
const EXPORT_TEXT = "#94a3b8";
/** t556 — the fourth panel's accent: the oblique block's own violet
 *  (text-violet-600), solid for label text on the dark strip */
const EXPORT_OBLIQUE_ACCENT = "#7c3aed";
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
/** t291 — the footer grew a distribution: 42 held one text line, 64 holds
 *  the 40px histogram thumbnail the text now shares the band with */
const EXPORT_FOOT_H = 64;
const EXPORT_GAP = 14;
/** t291 — the footer thumbnail: the map's density distribution, drawn
 *  small between the map name and the caption stats. Fixed size — the
 *  document grid, not the data, owns the layout; a map whose caption
 *  leaves no room simply keeps the one-line footer (shrink, then skip). */
const EXPORT_THUMB_W = 300;
const EXPORT_THUMB_H = 40;
/** publishing-palette cousins of the live strip's hues (the export is a
 *  document asset — same colour language, fixed values that never swing
 *  with the app theme): bars, the σ ruler's quiet ticks, the strong μ
 *  and the cyan cut line */
const EXPORT_BAR = "#64748b";
const EXPORT_SIGMA_TICK = "#475569";
const EXPORT_MEAN_TICK = "#e2e8f0";
const EXPORT_CUT = "#22d3ee";

function OrthoTile({
  jobId,
  path,
  spec,
  dim,
  dims,
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
  /** t664 — the FULL grid (from the outputs listing): the oblique trace's
   *  plane constant lives in voxel space, so the line needs every axis'
   *  extent, not just the movement axis'. Absent → no line (the honest
   *  fallback the voxel readouts already speak). */
  dims?: [number, number, number] | null;
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

  // t664 — the 2D mirror of the oblique cut: the embed's isosurface clip is
  // the 3D truth; this tile draws the LINE where that plane crosses its own
  // slice. The tile listens to the same wire the embed speaks — the block's
  // request (OBLIQUE_CLIP_EVENT) AND the embed's applied-state ACK
  // (OBLIQUE_CLIP_STATE_EVENT, which a chip clear or a bookmark restore
  // speaks outside the block's sliders) — last writer wins, so the line
  // mirrors the SCENE, not the block's UI. Pure geometry, no I/O: like the
  // crosshairs, it moves at slider rate; like the voxel readouts, it stays
  // honest when the grid is unknown (no dims → no line). The kept side is
  // the 3D guide's tick to tell (t662); the line is the shadow's location.
  const [obliqueCut, setObliqueCut] = useState<{
    theta: number;
    phi: number;
    offset: number;
  } | null>(null);
  useEffect(() => {
    const adopt = (d: unknown) => {
      if (!d || typeof d !== "object") return;
      const det = d as { on?: unknown; theta?: unknown; phi?: unknown; offset?: unknown };
      if (det.on !== true) {
        setObliqueCut(null);
        return;
      }
      const theta = typeof det.theta === "number" && Number.isFinite(det.theta) ? det.theta : null;
      const phi = typeof det.phi === "number" && Number.isFinite(det.phi) ? det.phi : null;
      const offset = typeof det.offset === "number" && Number.isFinite(det.offset) ? det.offset : null;
      if (theta == null || phi == null || offset == null) return;
      setObliqueCut({ theta, phi, offset });
    };
    const onClip = (e: Event) => adopt((e as CustomEvent).detail);
    const onAck = (e: Event) => adopt((e as CustomEvent).detail);
    window.addEventListener(OBLIQUE_CLIP_EVENT, onClip);
    window.addEventListener(OBLIQUE_CLIP_STATE_EVENT, onAck);
    return () => {
      window.removeEventListener(OBLIQUE_CLIP_EVENT, onClip);
      window.removeEventListener(OBLIQUE_CLIP_STATE_EVENT, onAck);
    };
  }, []);
  const obliqueTrace =
    obliqueCut && dims ? obliqueTraceOnTile(spec, dims, pos, obliqueCut) : null;

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

  // t664 — the trace itself: a dashed violet line (the ✂ chip's own hue,
  // violet-600) where the 3D cut crosses this slice, with the scissors
  // badge at its midpoint — the line's sentence is "the cut passes here",
  // and the badge binds it to the toggle that created it (t662's doctrine:
  // a guide says the sentence it serves). Below the crosshair lines (the
  // focus instruments read first), above the image; the density probe
  // (cursor instrument) stays on top of everything.
  let obliqueOverlay: React.ReactNode = null;
  if (obliqueTrace) {
    const midH = (obliqueTrace.x1 + obliqueTrace.x2) / 200;
    const midV = (obliqueTrace.y1 + obliqueTrace.y2) / 200;
    obliqueOverlay = (
      <>
        <svg
          data-canvas-ui={`ortho-oblique-trace-${spec.axis}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1={obliqueTrace.x1}
            y1={obliqueTrace.y1}
            x2={obliqueTrace.x2}
            y2={obliqueTrace.y2}
            stroke="#7c3aed"
            strokeWidth={2}
            strokeDasharray="5 3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div
          data-canvas-ui={`ortho-oblique-badge-${spec.axis}`}
          aria-hidden="true"
          className="pointer-events-none absolute flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-600/90 text-white shadow-sm"
          style={{
            left: pct(Math.min(0.92, Math.max(0.08, midH))),
            top: pct(Math.min(0.92, Math.max(0.08, midV))),
          }}
        >
          <Scissors className="size-2.5" />
        </div>
      </>
    );
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
        {obliqueOverlay}
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
  /** t556 — the oblique block's export-facing state, kept in a ref (the
   *  triptych export reads it at click time; scrubbing never re-renders
   *  the panel). Null until the block mounts; .on gates the 4th panel. */
  const obliqueInfoRef = useRef<ObliqueExportInfo | null>(null);

  const isStack = path.toLowerCase().endsWith(".mrcs");

  // dims arrive from the outputs listing (one cheap JSON fetch per expand).
  // t661 — a transport-level failure (server flap / OOM-kill restart, the
  // box's documented habit) used to swallow silently and darken the oblique
  // world AND the voxel readouts until the dialog reopened. The retry is
  // bounded (~14s — one OOM-restart window) and transport-only: a listing
  // that answers but carries no dims for this file is an honest absence
  // (the percentage fallback), never retried.
  useEffect(() => {
    if (!open || dims || isStack) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const grab = (retries: number) => {
      fetch(`/api/jobs/${jobId}/outputs`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { files?: { path: string; dims?: [number, number, number] }[] } | null) => {
          if (cancelled) return;
          if (!data?.files) {
            if (retries > 0) timer = setTimeout(() => grab(retries - 1), 3500);
            return;
          }
          const f = data.files.find((x) => x.path === path);
          if (f?.dims) setDims(f.dims);
        })
        .catch(() => {
          if (!cancelled && retries > 0) timer = setTimeout(() => grab(retries - 1), 3500);
        });
    };
    grab(4);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
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

  // t279 — the flash-back timer: ok/err states return to idle on their own.
  // (lives ABOVE the isStack early return: hooks must run in the same order
  // every render — an early return that skips a hook crashes React the
  // moment isStack flips on a still-mounted panel; in stack mode this
  // effect is a no-op, exportState never leaves "idle" there)
  useEffect(() => {
    if (exportState !== "ok" && exportState !== "err") return;
    const t = setTimeout(() => setExportState("idle"), 1600);
    return () => clearTimeout(t);
  }, [exportState]);

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

  /** t291 — the footer's distribution: the same `format=histogram` payload
   *  the live strip consumes (server-cached per map, so a panel that had
   *  the strip on pays nothing). Honest absence on ANY failure — a fetch
   *  that errs, times out (8s: the first look walks the volume, the
   *  export must not hang on it) or comes back malformed keeps the
   *  one-line footer instead of drawing a guessed distribution. */
  const fetchHistForExport = async (): Promise<{
    bins: number[];
    mean: number;
    std: number;
    lo: number;
    hi: number;
  } | null> => {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8000);
      const r = await fetch(
        `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=histogram`,
        { signal: ac.signal, cache: "no-store" }
      );
      clearTimeout(t);
      if (!r.ok) return null;
      const d = (await r.json()) as Partial<{
        bins: unknown;
        mean: unknown;
        std: unknown;
        lo: unknown;
        hi: unknown;
      }> | null;
      if (!d || !Array.isArray(d.bins) || d.bins.length === 0) return null;
      if (
        typeof d.mean !== "number" || typeof d.std !== "number" ||
        typeof d.lo !== "number" || typeof d.hi !== "number"
      ) return null;
      if (!(d.std > 0) || !(d.hi > d.lo)) return null;
      return { bins: d.bins as number[], mean: d.mean, std: d.std, lo: d.lo, hi: d.hi };
    } catch {
      return null; // aborted or failed — the footer stays honest by omission
    }
  };

  /** t279 — export the three orthogonal sections as ONE PNG triptych (the
   *  classic multi-panel figure in every cryo-EM paper). The tiles' own
   *  server renderer supplies the planes at the CURRENT focus point; the
   *  crosshair lines (same accents as on screen), per-plane voxel readouts
   *  and a footer naming the map, the focus fractions and the moment are
   *  drawn on a fixed publishing-style grid — a document asset, not a
   *  screenshot: it looks the same at any window size or theme. t291 —
   *  the footer also carries the map's DENSITY DISTRIBUTION as a small
   *  histogram with the contour's cyan cut marked: a figure with its
   *  contour level AND its distribution. */
  const exportTriptych = async () => {
    if (exportState === "busy") return;
    setExportState("busy");
    try {
      // t556 — the oblique block's fourth panel rides along when it is
      // ON: the export becomes a tetraptych, the cut nobody aligned an
      // axis to standing beside the three canonical ones. The PNG comes
      // from the same door, at the SAME live params the block shows.
      const ob = obliqueInfoRef.current;
      const withOblique = !!(ob?.on);
      const [planeBitmaps, hist, obliqueBitmap] = await Promise.all([
        Promise.all(
          TILES.map(async (t) => {
            const url = `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=png&axis=${t.axis}&pos=${positions[t.axis].toFixed(3)}`;
            const r = await fetch(url, { cache: "no-store" });
            if (!r.ok) throw new Error(`render failed (${r.status})`);
            return createImageBitmap(await r.blob());
          })
        ),
        fetchHistForExport(),
        withOblique
          ? fetch(
              `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=png&plane=oblique&theta=${ob.live.theta.toFixed(1)}&phi=${ob.live.phi.toFixed(1)}&offset=${(ob.live.offset / 100).toFixed(3)}`,
              { cache: "no-store" }
            ).then(async (r) => {
              if (!r.ok) throw new Error(`oblique render failed (${r.status})`);
              return createImageBitmap(await r.blob());
            })
          : Promise.resolve(null as ImageBitmap | null),
      ]);
      const planes = planeBitmaps;
      const panelCount = 3 + (obliqueBitmap ? 1 : 0);
      const W = EXPORT_GAP * (panelCount + 1) + EXPORT_TILE * panelCount;
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
      // t556 — the fourth panel: the oblique cut, violet accent (the
      // block's own hue), no crosshair (it has no sibling planes to
      // mark — its geometry IS its readout)
      if (obliqueBitmap) {
        const x0 = EXPORT_GAP + 3 * (EXPORT_TILE + EXPORT_GAP);
        ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
        ctx.fillStyle = EXPORT_OBLIQUE_ACCENT;
        ctx.textBaseline = "middle";
        ctx.fillText("Oblique", x0, EXPORT_GAP + EXPORT_LABEL_H / 2);
        ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = EXPORT_TEXT;
        ctx.textAlign = "right";
        const offPct = ob!.live.offset >= 0 ? `+${ob!.live.offset}` : `${ob!.live.offset}`;
        ctx.fillText(
          `θ ${ob!.live.theta}° · φ ${ob!.live.phi}° · ${offPct}%`,
          x0 + EXPORT_TILE,
          EXPORT_GAP + EXPORT_LABEL_H / 2
        );
        ctx.textAlign = "left";
        ctx.drawImage(obliqueBitmap, x0, EXPORT_GAP + EXPORT_LABEL_H, EXPORT_TILE, EXPORT_TILE);
        ctx.strokeStyle = EXPORT_TILE_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, EXPORT_GAP + EXPORT_LABEL_H + 0.5, EXPORT_TILE - 1, EXPORT_TILE - 1);
      }
      // footer: map name left, the map's density distribution centre
      // (t291), contour + focus fractions + moment right (t280 — the σ
      // segment joins when the embed has reported a contour: a figure
      // without its contour level is half a figure, but a GUESSED one is
      // a lie — absent σ simply keeps the footer honest; the thumbnail
      // plays by the same rule: absent histogram, no thumbnail).
      // Measure first, place second — a document layout never collides:
      // the thumbnail shrinks to the span the caption texts leave, and
      // skips entirely when that span cannot hold a legible chart.
      const footTop = EXPORT_GAP + EXPORT_LABEL_H + EXPORT_TILE + EXPORT_GAP;
      const footY = footTop + EXPORT_FOOT_H / 2;
      const base = path.split("/").pop() || path;
      const sigmaSeg = isoSigma ? `iso ${isoSigma.sign < 0 ? "-" : ""}${isoSigma.sigma.toFixed(2)} σ · ` : "";
      const f = `${sigmaSeg}focus x ${Math.round(positions.x * 100)}% · y ${Math.round(positions.y * 100)}% · z ${Math.round(positions.z * 100)}%   ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
      // t559 — the camera↔plane dialogue: HOW the current cut was last
      // chosen — ⌖ the camera swung face-on to it, ⤸ the cut adopted the
      // camera's view. Only speaks while the reading still holds (a hand
      // on a slider revokes it) — the footer must not lie. Violet: the
      // oblique block's own hue, so the provenance reads as the fourth
      // panel's voice inside the footer.
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      const nameW = ctx.measureText(base).width;
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      const prov = withOblique ? ob?.provenance : undefined;
      const dialogue = prov ? `${prov.kind === "jump" ? "⌖" : "⤸"} ${prov.theta}°·${prov.phi}°` : null;
      const fW = ctx.measureText(f).width;
      const dialogueW = dialogue ? ctx.measureText(dialogue).width + 14 : 0;
      const statsW = fW + dialogueW;
      const spanL = EXPORT_GAP + nameW + 18;
      const spanR = W - EXPORT_GAP - statsW - 18;
      const thumbW = Math.min(EXPORT_THUMB_W, spanR - spanL);
      if (hist && thumbW >= 120) {
        const tx = spanL + (spanR - spanL - thumbW) / 2;
        const ty = footTop + (EXPORT_FOOT_H - EXPORT_THUMB_H) / 2;
        ctx.strokeStyle = EXPORT_TILE_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 0.5, ty + 0.5, thumbW - 1, EXPORT_THUMB_H - 1);
        const px0 = tx + 4;
        const px1 = tx + thumbW - 4;
        const py0 = ty + 4;
        const py1 = ty + EXPORT_THUMB_H - 10; // the caption strip below the bars
        const span = hist.hi - hist.lo;
        const xOf = (v: number) =>
          span > 0 ? px0 + ((v - hist.lo) / span) * (px1 - px0) : (px0 + px1) / 2;
        // the σ ruler — the same one the live strip speaks: μ strongest,
        // ±1σ ±2σ quiet (labels are the caption texts' job at this size)
        ctx.lineWidth = 1;
        for (const s of [-2, -1, 0, 1, 2]) {
          const gx = xOf(hist.mean + s * hist.std);
          if (gx < px0 || gx > px1) continue;
          ctx.strokeStyle = s === 0 ? EXPORT_MEAN_TICK : EXPORT_SIGMA_TICK;
          ctx.beginPath();
          ctx.moveTo(gx, py0);
          ctx.lineTo(gx, py1);
          ctx.stroke();
        }
        // log-scaled bars — the strip's own visual language at postage size
        let maxC = 0;
        for (const c of hist.bins) if (c > maxC) maxC = c;
        if (maxC <= 0) maxC = 1;
        const logMax = Math.log10(1 + maxC);
        const n = hist.bins.length;
        const bw = (px1 - px0) / n;
        ctx.fillStyle = EXPORT_BAR;
        for (let i = 0; i < n; i++) {
          const c = hist.bins[i];
          if (c <= 0) continue;
          const bh = ((py1 - py0) * Math.log10(1 + c)) / logMax;
          ctx.fillRect(px0 + i * bw, py1 - bh, Math.max(0.5, bw - 1), bh);
        }
        // the contour — the cyan cut line, faded when it lives off-scale
        // (the same honesty the live strip draws: clamped, not invented)
        if (isoSigma) {
          const v = hist.mean + isoSigma.sign * isoSigma.sigma * hist.std;
          const cx = Math.min(px1, Math.max(px0, xOf(v)));
          ctx.strokeStyle = EXPORT_CUT;
          ctx.globalAlpha = v >= hist.lo && v <= hist.hi ? 1 : 0.35;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, py0 - 2);
          ctx.lineTo(cx, py1);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        // the caption — WHAT the mini-picture is, centred under the bars
        ctx.font = "7px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = EXPORT_TEXT;
        ctx.textAlign = "center";
        ctx.fillText("density (log)", tx + thumbW / 2, ty + EXPORT_THUMB_H - 2.5);
        ctx.textAlign = "left";
      }
      // the two text runs — same content as ever, the thumb just moved in
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(base, EXPORT_GAP, footY);
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = EXPORT_TEXT;
      ctx.textAlign = "right";
      ctx.fillText(f, W - EXPORT_GAP, footY);
      if (dialogue) {
        ctx.fillStyle = EXPORT_OBLIQUE_ACCENT;
        ctx.fillText(dialogue, W - EXPORT_GAP - fW - 14, footY);
      }
      ctx.textAlign = "left";
      const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png"));
      if (!blob) throw new Error("encode failed");
      const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
      downloadBlob(blob, `ortho-${base.replace(/\.(mrc|mrcs)$/i, "")}-${stamp}.png`);
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
          title="Export the three sections as one PNG — crosshair and density footer included"
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
              dims={dims}
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
          {/* t284 — the shared strip, panel mode: the live contour draws
              the cyan cut line and a click dispatches the SET (density →
              σ, sign follows the clicked side of the mean) */}
          <DensityHistogramStrip
            jobId={jobId}
            path={path}
            cutSigma={isoSigma}
            uiPrefix="ortho-hist"
            ariaLabel="The volume's density histogram with the σ ruler and the current contour"
            interactiveTitle="The volume's density distribution — click anywhere to cut the isosurface at that density"
            onPickSigma={(sigma, sign) =>
              window.dispatchEvent(new CustomEvent(ORTHO_SIGMA_SET_EVENT, { detail: { sigma, sign } }))
            }
          />
        </div>
      )}
      {/* t555 — the OBLIQUE section: the plane family the box axes don't
          cover. Volumes only, its own on/off (a render nobody asked for
          is noise), sliders scrub θ/φ/offset against the SAME file route
          door the tiles use. */}
      {open && !isStack && dims && (
        <ObliqueSectionBlock jobId={jobId} path={path} dims={dims} onChange={(info) => { obliqueInfoRef.current = info; }} />
      )}
      {/* t830 — the SECTION keys' hint row: the keyboard face of the
          bidirectional contract, taught where the 2D instruments live.
          The keys cut the 3D section through the embed's intent path; the
          embed echoes cryoflow:slice-state and THESE tiles follow (the
          same wire a ⌖ click rides the other way). Gated on the σ chip's
          own honesty signal — isoSigma is null until the embed answers
          the pull, so the row never promises keys the embed cannot arm
          (no 3D world yet = no keys = no row, the chip must-not-lie law
          extended to the keymap). */}
      {open && isoSigma && (
        <div
          data-canvas-ui="ortho-keymap"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2.5 text-[10px] leading-tight text-muted-foreground"
        >
          <span className="inline-flex items-center gap-0.5">
            <Kbd>X</Kbd>
            <Kbd>Y</Kbd>
            <Kbd>Z</Kbd>
            <span className="ml-1">cut the plane — the tiles follow</span>
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Kbd>,</Kbd>
            <Kbd>.</Kbd>
            <span className="ml-1">scrub</span>
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Kbd>&lt;</Kbd>
            <Kbd>&gt;</Kbd>
            <span className="ml-1">coarse (shift)</span>
          </span>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* t555 — the OBLIQUE section: the plane nobody aligned an axis to     */
/* ------------------------------------------------------------------ */

const OBLIQUE_DEG = Math.PI / 180;

/** mirror of the server's plane-frame math (mrc.ts readMrcObliqueSlice):
 *  the readouts must speak the numbers the render obeys — computed here
 *  so scrubbing needs no round trip. Keep the two in lockstep. */
function obliqueFrame(
  dims: [number, number, number],
  thetaDeg: number,
  phiDeg: number,
  offsetFrac: number
) {
  const [nx, ny, nz] = dims;
  const t = thetaDeg * OBLIQUE_DEG;
  const p = phiDeg * OBLIQUE_DEG;
  const normal: [number, number, number] = [
    Math.sin(t) * Math.cos(p),
    Math.sin(t) * Math.sin(p),
    Math.cos(t),
  ];
  let u: [number, number, number];
  if (Math.abs(normal[2]) > 0.999) {
    u = [1, 0, 0];
  } else {
    const len = Math.hypot(normal[0], normal[1]);
    u = [normal[1] / len, -normal[0] / len, 0];
  }
  const v: [number, number, number] = [
    normal[1] * u[2] - normal[2] * u[1],
    normal[2] * u[0] - normal[0] * u[2],
    normal[0] * u[1] - normal[1] * u[0],
  ];
  const c: [number, number, number] = [(nx - 1) / 2, (ny - 1) / 2, (nz - 1) / 2];
  let support = 0;
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
    const d: [number, number, number] = [
      (i ? nx - 1 : 0) - c[0],
      (j ? ny - 1 : 0) - c[1],
      (k ? nz - 1 : 0) - c[2],
    ];
    support = Math.max(support, Math.abs(d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2]));
    const pu = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    const pv = d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
    uMin = Math.min(uMin, pu); uMax = Math.max(uMax, pu);
    vMin = Math.min(vMin, pv); vMax = Math.max(vMax, pv);
  }
  return {
    normal,
    u,
    v,
    support,
    offsetVox: offsetFrac * support,
    extent: [Math.round(uMax - uMin) + 1, Math.round(vMax - vMin) + 1] as [number, number],
  };
}

/** t664 — the 2D mirror of the 3D oblique cut: where the clip plane crosses
 *  THIS tile's slice, in the tile's own fraction coordinates (h left→right
 *  along spec.hAxis, v top→bottom along spec.vAxis — the same renderer
 *  truth the clip overlay and the crosshairs speak: axis 0 at the top row
 *  and the left column, NO flip).
 *
 *  Geometry: the plane lives in voxel space (the server's frame — the same
 *  math `obliqueFrame` mirrors for the readouts): n·p = n·c + offsetVox.
 *  The tile's slice pins one coordinate (axisPos along the movement axis);
 *  the other two ride the image fractions. Substituting p = (h·(n_h−1),
 *  v·(n_v−1), axisPos·(n_axis−1)) leaves a LINE A·h + B·v = D, clipped to
 *  the unit square. Returns endpoints in 0..100 viewBox units, or null
 *  when nothing honest can be drawn: unknown grid, a plane parallel to
 *  the slice (θ=0 on the matching axis — no line exists), or a grazing
 *  pass that only touches a corner. Same function the test script mirrors
 *  verbatim — the e2e asserts its numbers against the drawn DOM. */
export function obliqueTraceOnTile(
  spec: { axis: "x" | "y" | "z"; hAxis: "x" | "y" | "z"; vAxis: "x" | "y" | "z" },
  dims: readonly [number, number, number],
  axisPos: number,
  cut: { theta: number; phi: number; offset: number }
): { x1: number; y1: number; x2: number; y2: number } | null {
  if (!dims || dims.length !== 3 || dims.some((d) => !(d > 1))) return null;
  const frame = obliqueFrame([...dims] as [number, number, number], cut.theta, cut.phi, cut.offset);
  const n = frame.normal;
  const c: [number, number, number] = [
    (dims[0] - 1) / 2,
    (dims[1] - 1) / 2,
    (dims[2] - 1) / 2,
  ];
  const AX: Record<"x" | "y" | "z", 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
  const ai = AX[spec.axis];
  const hi = AX[spec.hAxis];
  const vi = AX[spec.vAxis];
  const d0 = n[0] * c[0] + n[1] * c[1] + n[2] * c[2] + frame.offsetVox;
  const A = n[hi] * (dims[hi] - 1);
  const B = n[vi] * (dims[vi] - 1);
  const D = d0 - n[ai] * axisPos * (dims[ai] - 1);
  if (!Number.isFinite(A) || !Number.isFinite(B) || !Number.isFinite(D)) return null;
  if (Math.hypot(A, B) < 1e-9) return null; // plane ∥ slice: no line (or the whole slice)
  const pts: [number, number][] = [];
  const consider = (h: number, v: number) => {
    if (h >= -1e-6 && h <= 1 + 1e-6 && v >= -1e-6 && v <= 1 + 1e-6)
      pts.push([Math.min(1, Math.max(0, h)), Math.min(1, Math.max(0, v))]);
  };
  if (Math.abs(B) > 1e-12) {
    consider(0, D / B);
    consider(1, (D - A) / B);
  }
  if (Math.abs(A) > 1e-12) {
    consider(D / A, 0);
    consider((D - B) / A, 1);
  }
  // dedupe corner touches — a line meets its square in at most two points
  const uniq: [number, number][] = [];
  for (const p of pts) {
    if (!uniq.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6))
      uniq.push(p);
  }
  if (uniq.length !== 2) return null;
  const [[h1, v1], [h2, v2]] = uniq;
  return { x1: h1 * 100, y1: v1 * 100, x2: h2 * 100, y2: v2 * 100 };
}

/** t557 — the inverse of obliqueFrame's normal construction: a unit view
 *  direction (camera→target) becomes the block's (θ, φ). θ = polar =
 *  acos(nz) clamped to [0,180]; φ = azimuth = atan2(ny,nx) normalized to
 *  [0,360). Both rounded to whole degrees — the readouts and the render
 *  URL speak them, and a degree is finer than any orbit a hand settles
 *  on. Returns null for a degenerate direction (zero length or
 *  non-finite): nothing to adopt. At the poles (θ rounds to 0 or 180)
 *  φ collapses to 0 — every azimuth is the same normal there, and 0 is
 *  the honest one instead of atan2's noise-driven arbitrary value. */
export function cameraDirToAngles(
  dir: readonly [number, number, number]
): { theta: number; phi: number } | null {
  if (dir.length !== 3 || dir.some((c) => !Number.isFinite(c))) return null;
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (!(len > 1e-9)) return null;
  const nz = dir[2] / len;
  const theta = Math.round(Math.acos(Math.min(1, Math.max(-1, nz))) / OBLIQUE_DEG);
  let phi = Math.round(Math.atan2(dir[1] / len, dir[0] / len) / OBLIQUE_DEG);
  phi = ((phi % 360) + 360) % 360;
  if (theta === 0 || theta === 180) phi = 0;
  return { theta, phi };
}

/** what the block reports upward — the triptych export's fourth panel
 *  rides on it (a ref on the panel side, never a re-render per scrub) */
interface ObliqueExportInfo {
  on: boolean;
  theta: number;
  phi: number;
  offset: number;
  live: { theta: number; phi: number; offset: number };
  extent: [number, number];
  normal: [number, number, number];
  offsetVox: number;
  /** t559 — how the CURRENT cut was last chosen: ⌖ sent the camera to
   *  face it, ⤸ adopted it from the camera. Cleared the moment a hand
   *  (slider / reset) moves the plane — the export footer only speaks
   *  readings that still hold (the footer must not lie). */
  provenance?: { kind: "jump" | "adopt"; theta: number; phi: number } | null;
}

function ObliqueSectionBlock({
  jobId,
  path,
  dims,
  onChange,
}: {
  jobId: string;
  path: string;
  dims: [number, number, number];
  /** reports the export-facing state on every settle — the panel keeps it
   *  in a ref (export reads it at click time; scrubbing never re-renders
   *  the panel) */
  onChange?: (info: ObliqueExportInfo) => void;
}) {
  const [on, setOn] = useState(false);
  const [theta, setTheta] = useState(45);
  const [phi, setPhi] = useState(30);
  // percent of the box's support along the normal, −100…100
  const [offset, setOffset] = useState(0);
  // the PNG refetch rides one timer behind the slider — a drag emits a
  // storm of values, the render only obeys the one that settles
  const [live, setLive] = useState({ theta: 45, phi: 30, offset: 0 });
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => setLive({ theta, phi, offset }), 140);
    return () => clearTimeout(t);
  }, [on, theta, phi, offset]);

  // t559 — the cut's provenance: which gesture last chose it (⌖ the
  // camera faced this cut, ⤸ the cut adopted the camera). A hand on a
  // slider (or the reset) revokes it — a reading that no longer holds
  // must not ride to the export footer.
  const [provenance, setProvenance] = useState<ObliqueExportInfo["provenance"]>(null);
  const scrubTheta = (v: number) => { setTheta(v); setProvenance(null); };
  const scrubPhi = (v: number) => { setPhi(v); setProvenance(null); };
  const scrubOffset = (v: number) => { setOffset(v); };

  const frame = obliqueFrame(dims, theta, phi, offset / 100);
  const src = on
    ? `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=png&plane=oblique&theta=${live.theta.toFixed(1)}&phi=${live.phi.toFixed(1)}&offset=${(live.offset / 100).toFixed(3)}`
    : null;

  // the export's fourth panel + the ⌖ camera jump both ride this
  useEffect(() => {
    onChange?.({
      on,
      theta,
      phi,
      offset,
      live: { ...live },
      extent: frame.extent,
      normal: [...frame.normal] as [number, number, number],
      offsetVox: frame.offsetVox,
      provenance,
    });
  }, [on, live.theta, live.phi, live.offset, provenance]);

  // t661 — the CUT half: while this toggle is on, every settled reading
  // rides to the embed over OBLIQUE_CLIP_EVENT and the isosurface opens
  // along this exact plane. Toggling off (or collapsing the block) retires
  // the plane — ONE effect owns both voices, so the mirror can never lag
  // a slider: the dispatched state IS the block's state. The off voice
  // only fires after this block actually SENT an on (the sentOnRef guard):
  // a bookmark can revive the cut while the block is collapsed, and the
  // block must not kill it with a mount heartbeat it never earned.
  const [cut3d, setCut3d] = useState(false);
  const sentOnRef = useRef(false);
  useEffect(() => {
    const live3d = on && cut3d;
    if (live3d) {
      sentOnRef.current = true;
      window.dispatchEvent(
        new CustomEvent(OBLIQUE_CLIP_EVENT, {
          detail: { on: true, theta: live.theta, phi: live.phi, offset: live.offset / 100 },
        })
      );
    } else if (sentOnRef.current) {
      sentOnRef.current = false;
      window.dispatchEvent(
        new CustomEvent(OBLIQUE_CLIP_EVENT, {
          detail: { on: false, theta: 0, phi: 0, offset: 0 },
        })
      );
    }
  }, [on, cut3d, live.theta, live.phi, live.offset]);
  // the ACK half: the embed's chip and the bookmarks can retire or revive
  // the cut OUTSIDE this block's sliders — the ✂ follows them (and adopts
  // the revived plane's angles, so the sliders show the truth and the
  // expansion never jumps), and a scrub never resurrects a dismissed cut
  useEffect(() => {
    const onAck = (e: Event) => {
      const d = (e as CustomEvent<{ on?: unknown; theta?: unknown; phi?: unknown; offset?: unknown }>).detail;
      if (!d || typeof d.on !== "boolean") return;
      setCut3d(d.on);
      if (d.on) {
        if (typeof d.theta === "number" && Number.isFinite(d.theta))
          setTheta(Math.min(180, Math.max(0, Math.round(d.theta))));
        if (typeof d.phi === "number" && Number.isFinite(d.phi))
          setPhi(Math.min(360, Math.max(0, Math.round(d.phi))));
        if (typeof d.offset === "number" && Number.isFinite(d.offset))
          setOffset(Math.round(Math.min(1, Math.max(-1, d.offset)) * 100));
      }
    };
    window.addEventListener(OBLIQUE_CLIP_STATE_EVENT, onAck);
    return () => window.removeEventListener(OBLIQUE_CLIP_STATE_EVENT, onAck);
  }, []);

  // t556 — the ⌖: swing the 3D camera to look straight down the cut's
  // normal (face-on at the plane). dir = +n puts the camera on the −n
  // side — from THERE the face-on view agrees with the tile chirality
  // for chirality (screen-right = +u, screen-down = +v), so up = −v.
  const jumpToView = () => {
    setProvenance({ kind: "jump", theta, phi });
    window.dispatchEvent(new CustomEvent(OBLIQUE_VIEW_EVENT, {
      detail: {
        normal: [...frame.normal] as [number, number, number],
        up: [-frame.v[0], -frame.v[1], -frame.v[2]] as [number, number, number],
      } satisfies ObliqueViewDetail,
    }));
  };

  // t557 — the ⌖'s return ticket: pull the live view direction from the
  // embed and take it as this plane's normal. The answer rides back in
  // the same tick (window events are synchronous); adoption auto-enables
  // the block and the 140ms debounce fetches the cut through the standing
  // door. The tile flashes violet — the same "the 3D scene just drove me"
  // language the sibling tiles speak (FOLLOW_FLASH_MS).
  const [adoptFlash, setAdoptFlash] = useState(false);
  useEffect(() => {
    if (!adoptFlash) return;
    const t = setTimeout(() => setAdoptFlash(false), FOLLOW_FLASH_MS);
    return () => clearTimeout(t);
  }, [adoptFlash]);
  useEffect(() => {
    const onCameraState = (e: Event) => {
      const dir = (e as CustomEvent<OrthoCameraStateDetail>).detail?.dir;
      if (!Array.isArray(dir) || dir.length !== 3 || dir.some((c) => !Number.isFinite(c))) return;
      const inv = cameraDirToAngles(dir as [number, number, number]);
      if (!inv) return;
      setOn(true);
      setTheta(inv.theta);
      setPhi(inv.phi);
      setAdoptFlash(true);
      setProvenance({ kind: "adopt", theta: inv.theta, phi: inv.phi });
    };
    window.addEventListener(ORTHO_CAMERA_STATE_EVENT, onCameraState);
    return () => window.removeEventListener(ORTHO_CAMERA_STATE_EVENT, onCameraState);
  }, []);
  const adoptCamera = () => {
    window.dispatchEvent(new CustomEvent(ORTHO_CAMERA_REQUEST_EVENT));
  };

  return (
    <div className="border-t border-border/60 px-3 pb-3 pt-2" data-canvas-ui="ortho-oblique" data-oblique-state={on ? "on" : "off"}>
      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          onClick={() => setOn((o) => !o)}
          aria-expanded={on}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <Slice className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground/85">Oblique section</span>
          <span className="truncate text-[10px] text-muted-foreground">
            θ polar · φ azimuth — the cut the box axes never cover
          </span>
          <ChevronDown
            className={cn(
              "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
              on && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
      </div>
      {on && (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,320px)_1fr]">
          <div
            className={cn(
              "overflow-hidden rounded border bg-black/80 transition-[border-color,box-shadow] duration-300",
              adoptFlash
                ? "border-violet-500/70 shadow-[0_0_0_3px_rgba(139,92,246,0.25)]"
                : "border-border/60"
            )}
          >
            {src ? (
              <MrcImage
                src={src}
                alt={`Oblique section at θ ${theta}°, φ ${phi}°, offset ${offset}%`}
                className="block w-full"
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-2.5">
            {/* t561 — the dialogue's LIVE voice: the same reading the
                export footer draws (⌖/⤸ θ°·φ°, violet) rides here as a
                chip while it holds — and vanishes the moment a hand
                revokes it. The footer must not lie; neither may the
                sliders' own neighborhood. */}
            {provenance && (
              <span
                data-canvas-ui="ortho-oblique-prov"
                title="How this cut was last chosen — ⌖ the camera swung face-on to it, ⤸ the cut adopted the camera's view. A hand on any slider revokes it."
                className="inline-flex items-center gap-1 self-start rounded-full border border-violet-600/30 bg-violet-600/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-violet-700 dark:text-violet-300"
              >
                {provenance.kind === "jump" ? "⌖" : "⤸"} {provenance.theta}°·{provenance.phi}°
              </span>
            )}
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground" htmlFor="oblique-theta">
                  θ polar
                </label>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{theta}°</span>
              </div>
              <Slider
                id="oblique-theta"
                min={0}
                max={180}
                step={5}
                value={[theta]}
                onValueChange={(v) => scrubTheta(v[0] ?? 0)}
                aria-label="Polar angle of the plane normal"
              />
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground" htmlFor="oblique-phi">
                  φ azimuth
                </label>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{phi}°</span>
              </div>
              <Slider
                id="oblique-phi"
                min={0}
                max={360}
                step={5}
                value={[phi]}
                onValueChange={(v) => scrubPhi(v[0] ?? 0)}
                aria-label="Azimuth angle of the plane normal"
              />
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground" htmlFor="oblique-offset">
                  offset
                </label>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {offset >= 0 ? "+" : ""}{offset}% · {frame.offsetVox >= 0 ? "+" : ""}{frame.offsetVox.toFixed(1)} vox
                </span>
              </div>
              <Slider
                id="oblique-offset"
                min={-100}
                max={100}
                step={2}
                value={[offset]}
                onValueChange={(v) => scrubOffset(v[0] ?? 0)}
                aria-label="Signed offset of the plane along its normal"
              />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tabular-nums text-muted-foreground">
              <span title="Unit plane normal in grid coordinates">
                n ({frame.normal.map((c) => c.toFixed(2)).join(", ")})
              </span>
              <span title="In-plane extent in voxels — the true cut size">
                {frame.extent[0]}×{frame.extent[1]} vox
              </span>
              <button
                type="button"
                onClick={() => { setTheta(0); setPhi(0); setOffset(0); setProvenance(null); }}
                className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Back to the axis-aligned center plane (θ 0°, φ 0°, centered)"
              >
                reset
              </button>
              <button
                type="button"
                onClick={jumpToView}
                data-canvas-ui="ortho-oblique-jump"
                className="rounded p-0.5 text-violet-600 transition-colors hover:bg-violet-600/10"
                aria-label="Swing the 3D camera to look straight down this plane's normal"
                title="⌖ the 3D view jumps face-on to this cut (the same ⌖ language the tiles speak)"
              >
                <Focus className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={adoptCamera}
                data-canvas-ui="ortho-oblique-adopt"
                className={cn(
                  "rounded p-0.5 text-violet-600 transition-colors hover:bg-violet-600/10",
                  adoptFlash && "bg-violet-600/15"
                )}
                aria-label="Adopt the current 3D camera direction as this plane's normal"
                title="⤸ adopt — the jump's return ticket: the view you're orbiting becomes this cut (roll and offset stay yours; ⌖ re-snaps the roll)"
              >
                <ScanEye className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setCut3d((c) => !c)}
                aria-pressed={cut3d}
                data-canvas-ui="ortho-oblique-cut3d"
                className={cn(
                  "rounded p-0.5 text-violet-600 transition-colors hover:bg-violet-600/10",
                  cut3d && "bg-violet-600/15"
                )}
                aria-label="Cut the 3D isosurface open at this plane"
                title="✂ cut in 3D — the isosurface opens along this exact oblique plane (which half is kept flips from the viewer's chip)"
              >
                <Scissors className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
