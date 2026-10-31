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
import { BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, Crosshair, Download, Film, Focus, Loader2, Printer, ScanEye, ScanLine, Scissors, Slice, TriangleAlert } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Kbd } from "@/components/ui/kbd"; // t830 — the keymap row speaks the one kbd vocabulary (t642)
import { MrcImage } from "./mrc-image";
import { DensityHistogramStrip } from "./density-histogram";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/lib/download"; // t646 — one blob sink (this dance skipped the attach-before-click law)
import { obliqueDepthVox, obliqueDepthVoice, obliqueNormal, obliqueOffsetPctVoice, obliqueSupportVox, patchBoxRect, voxelReadout } from "@/lib/voxel-voice"; // t906/t907 — the tile's and the oblique block's voices ride the ONE lib (the embed's commit site reads the same seats); t1099 — the cut's direction rides the ONE father too; t1122 — the patch's footprint rides the same lib (the box and the crosshair can never disagree about where a voxel lives)
import { DIRECTION_STATIONS, FILMSTRIP_FRAMES, obliqueDirectionWalkCurrentIndex, obliqueDirectionWalkFilename, obliqueDirectionWalkUrls, obliqueFilmstripFilename, obliqueFilmstripUrls, obliqueWalkCurrentIndex, planObliqueDirectionWalk, planObliqueFilmstrip } from "@/lib/oblique-filmstrip"; // t1096 — the walk's geometry rides the ONE lib: the plan, the URLs and the name are decided before a fetch flies; t1108 — the cut's "you are here" rides the same lib's frac seat; t1109 — the walk dial rides the same two seats on the live screen; t1111 — the direction dial rides the lib's azimuth ladder (the stations carry the voice's own label) and its angular mark; t1112 — the direction page's pixels ride the lib's azimuth URL edition; t1115 — the direction export's name rides the lib's filename edition
import { ORTHO_FILMSTRIP_FRAMES, orthoFilmstripFilename, orthoFilmstripUrls, orthoWalkCurrentIndex, planOrthoFilmstrip } from "@/lib/ortho-filmstrip"; // t1098 — the axis walks ride the ONE lib: the plan, the URLs and the name are decided before a fetch flies; t1107 — the walk's "you are here" rides the same seat
import { orthoAxisWalkHeading, orthoPlateDirectionCurrentLegend, orthoPlateDirectionWalkExtentWord, orthoPlateDirectionWalkMetaLine, orthoPlateMetaLine, orthoPlateObliqueCurrentLegend, orthoPlateTileUrl, orthoPlateWalkCurrentLegend, orthoPlateWalkMetaLine, orthoWalkFrameCaption, planOrthoPlate, planPlateHistogram, PLATE_HIST_INKS, type PlateHistPayload } from "@/lib/ortho-plate"; // t1103/t1104/t1105/t1106 — the plate's words and its distribution band ride the ONE plan lib (the voices' own bytes, decided before any print; the walk page's words and the σ leg's geometry ride the same family); t1112 — the direction page's extent and legend ride the same words lib; t1115 — the export button's aria and header ride the extent word seat and the legend's own sentence
import { usePrintedDate } from "@/lib/use-now"; // t1103 — the plate's paper clock (the t232 law: paper clocks do not hydrate)
import {
  obliqueTraceDragOffset,
  obliqueTraceEndpointHit, // t1100 — the rim's own word: the endpoints answer first, the body keeps the slide
  obliqueTraceHit,
  obliqueTraceTurn,
} from "@/lib/oblique-trace-drag"; // t1099 — the trace's HAND rides the ONE lib: the hit-test and the offset solve are decided before an event flies

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
/** 3D → 2D (t908): the KEYBOARD's verb half. The viewer's one key face
 *  (the embed's gated keydown — the t829/t831 gates) requests the block's
 *  OWN gestures over ONE wire, and the block executes with its own hands:
 *  provenance, the adopt flash, the settle debounce and the ✂ mirror all
 *  ride the same paths the buttons use (no second implementation to
 *  drift). The verb alphabet speaks the house laws:
 *    - "cut"   — the ✂ verb; wakes a sleeping block and cuts at its
 *                plane (the slice verbs' X/Y/Z wake law: turning it on
 *                if it slept);
 *    - "jump"  — the ⌖ verb; demands the block ON (the scrub verbs'
 *                sleep law — no spooky default-plane jumps);
 *    - "adopt" — the ⤸ verb; the request→answer→wake law (the block
 *                wakes BY CAMERA, its own provenance rides);
 *    - "offset"— the depth dial; demands ON too; dir ±1 along n, the
 *                shift step is the coarser one (the < > law).
 *  When the block sleeps, jump/offset do nothing — the key's silence IS
 *  the honesty (",/.” deliberately do nothing then” — the same sentence). */
export const OBLIQUE_VERB_EVENT = "cryoflow:oblique-verb";
export interface ObliqueVerbDetail {
  verb: "cut" | "jump" | "adopt" | "offset";
  /** offset direction: −1 toward −n, +1 toward +n */
  dir?: -1 | 1;
  /** shift = the coarser step (the < > law) */
  coarse?: boolean;
}
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
  probeRadius,
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
  /** t1122 — the probe's patch radius in voxels (panel-level slider):
   *  the AREA both the chip's statistics and the box outline speak */
  probeRadius: number;
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
  // t1100 — declared EARLY: the oblique overlay's endpoint handles read
  // these below, and a hooks-order TDZ here would unmount the whole tree
  // the moment the cut turns on (the live walk's own catch)
  const [traceHover, setTraceHover] = useState(false);
  const [traceRiding, setTraceRiding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // t1099 — the trace's HAND: grab the cut's line on this tile and slide
  // it along its own normal. The grab gates on the pixel hit-test (the
  // lib's own); the drag solves the offset through the ONE lib and speaks
  // the sliders' own door (OBLIQUE_CLIP_EVENT), throttled with a trailing
  // word on release; the pick yields once (the grab owns that click). The
  // sliders and the 3D cut follow through the loop's ACK half (t661) —
  // one writer, one truth, no desync.
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
    /** t1121 — the patch's second voice (only when the request names r);
     *  t1122 — carries its clamped box so the tile can DRAW the area */
    patch?: {
      median: number;
      sigma: number;
      z: number | null;
      n: number;
      lo: { x: number; y: number; z: number };
      hi: { x: number; y: number; z: number };
    };
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
    // t1121 — r: the answer grows the in-plane (2r+1)² local statistics
    // (median / robust z) around the SAME voxel — still row-wise preads,
    // still free of any plane buffer, still safe at hover frequency;
    // t1122 — the radius rides the panel's own slider (the chip's numbers
    // and the tile's box outline follow the same hand)
    const qs = `path=${encodeURIComponent(path)}&format=value&axis=${spec.axis}&pos=${rendered.toFixed(3)}&fx=${fx.toFixed(4)}&fy=${fy.toFixed(4)}&r=${probeRadius}`;
    fetch(`/api/jobs/${jobId}/outputs/file?${qs}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: {
        value?: unknown;
        voxel?: { x: number; y: number; z: number };
        patch?: {
          median?: unknown;
          sigma?: unknown;
          z?: unknown;
          n?: unknown;
          box?: {
            lo?: { x?: unknown; y?: unknown; z?: unknown };
            hi?: { x?: unknown; y?: unknown; z?: unknown };
          };
        };
      } | null) => {
        if (!d || typeof d.value !== "number" || !Number.isFinite(d.value)) return;
        // the patch speaks only when its numbers are finite — a partial
        // payload degrades to the first voice (honest, never invented).
        // Each field is extracted through one finite-guard (the `num`
        // seat): a box corner that is not a finite number nulls the whole
        // box — a half-honest rectangle would be a wrong rectangle.
        const num = (v: unknown): number | null =>
          typeof v === "number" && Number.isFinite(v) ? v : null;
        const p = d.patch;
        const mx = p ? num(p.median) : null;
        const nx = p ? num(p.n) : null;
        // the box rides the route's own shape (t1121's `box: {lo, hi}`) —
        // the footprint and the numbers are ONE payload's two halves
        const lo = p?.box?.lo;
        const hi = p?.box?.hi;
        const lx = lo ? num(lo.x) : null;
        const ly = lo ? num(lo.y) : null;
        const lz = lo ? num(lo.z) : null;
        const hx = hi ? num(hi.x) : null;
        const hy = hi ? num(hi.y) : null;
        const hz = hi ? num(hi.z) : null;
        const patch =
          mx !== null && nx !== null && lx !== null && ly !== null && lz !== null &&
          hx !== null && hy !== null && hz !== null
            ? {
                median: mx,
                sigma: p ? num(p.sigma) ?? 0 : 0,
                z: p ? num(p.z) : null,
                n: nx,
                lo: { x: lx, y: ly, z: lz },
                hi: { x: hx, y: hy, z: hz },
              }
            : undefined;
        setProbe((pv) =>
          pv ? { ...pv, value: d.value as number, voxel: d.voxel ?? null, patch } : pv
        );
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
    setProbe((p) =>
      p ? { ...p, fx, fy } : { fx, fy, value: null, voxel: null, patch: undefined }
    );
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
        {/* t1100 — the endpoints' own handles: the rim is grabbable, and
            the handles SAY so (the badge names the slide, the handles
            name the turn — each affordance speaks its sentence). Small
            violet rings at the drawn endpoints; they wake when the line
            is under the hand (hover) or riding (drag). */}
        {[
          { x: obliqueTrace.x1, y: obliqueTrace.y1 },
          { x: obliqueTrace.x2, y: obliqueTrace.y2 },
        ].map((pt, i) => (
          <div
            key={i}
            data-canvas-ui={`ortho-oblique-end-${spec.axis}-${i + 1}`}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-violet-600 shadow-sm transition-transform duration-150",
              (traceHover || traceRiding) && "scale-150 ring-1 ring-violet-400"
            )}
            style={{ left: pct(pt.x / 100), top: pct(pt.y / 100) }}
          />
        ))}
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

  // t1121 — the patch's second line (the AREA voice): median first (the
  // robust centre of the neighbourhood), then the robust z with an
  // explicit sign (σ = 1.4826·MAD — a positive z on an apex says the
  // blob rises above its own background; a z near zero says it sits
  // inside the crowd), then the ACTUAL point count — a clamped edge
  // patch speaks its true n, never a round (2r+1)² lie. When the patch
  // is too flat or too small to speak (z null) the line simply omits
  // the z — silence about it, never a lie about it.
  const patchText =
    probe?.patch == null
      ? null
      : `med ${probe.patch.median.toFixed(3)} · ${
          probe.patch.z === null
            ? ""
            : `z ${probe.patch.z >= 0 ? "+" : "−"}${Math.abs(probe.patch.z).toFixed(1)}σ · `
        }${probe.patch.n} pts`;

  const syncTo3d = () => {
    window.dispatchEvent(
      new CustomEvent(ORTHO_SLICE_EVENT, { detail: { axis: spec.axis, pos } })
    );
  };

  /** t278 — click on the image: pick the focus point (fractional 0..1 in
   *  the image's own frame — hAxis left→right, vAxis top→bottom). The
   *  panel resolves which sibling planes move (hAxis/vAxis of THIS tile). */
  const pickFocus = (e: React.MouseEvent<HTMLDivElement>) => {
    // t1099 — the grab owns the click that ends its own drag: the pick
    // yields once, then the flag clears (a plain click never sees it)
    if (traceDrag.current?.moved) {
      traceDrag.current = null;
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onPick?.(fx, fy);
  };

  // t1099 — the trace's HAND, the handlers: the grab (pointerdown within
  // the lib's pixel radius of the line), the slide (the lib's offset
  // solve at the pointer, throttled to ~120ms with a trailing word on
  // release — the embed's plane rebuild deserves a breath), the release
  // (the final word rides NOW; the pick's suppression flag stays for the
  // click that follows), and the cursor's vocabulary (grab when the line
  // is under the hand, grabbing while it rides). t1100 — the SECOND DOF:
  // a grab near an endpoint TURNs the cut (θ, φ) instead of sliding its
  // depth — the mode rides the drag ref, the solve branches, the door
  // (OBLIQUE_CLIP_EVENT) and the throttle stay the loop's own.
  const traceDrag = useRef<{ active: boolean; moved: boolean; mode: "slide" | "turn" } | null>(null);
  const traceDragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const traceLastSent = useRef(0);

  const traceSlideTo = (e: React.PointerEvent<HTMLDivElement>, force = false) => {
    const cut = obliqueCut;
    if (!cut || !dims) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const fracs = { h: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height };
    // t1100 — the mode branches the solve, never the door: the slide
    // solves the offset, the turn solves the angles — both speak the
    // sliders' own OBLIQUE_CLIP_EVENT with the loop's own detail shape
    const detail =
      traceDrag.current?.mode === "turn"
        ? (() => {
            const turned = obliqueTraceTurn(spec, dims, pos, cut, fracs);
            return turned
              ? { on: true, theta: turned.theta, phi: turned.phi, offset: turned.offset }
              : null;
          })()
        : (() => {
            const offset = obliqueTraceDragOffset(spec, dims, pos, cut, fracs);
            return offset === null
              ? null
              : { on: true, theta: cut.theta, phi: cut.phi, offset };
          })();
    if (detail === null) return;
    if (traceDrag.current) traceDrag.current.moved = true;
    const speak = () => {
      traceLastSent.current = Date.now();
      window.dispatchEvent(new CustomEvent(OBLIQUE_CLIP_EVENT, { detail }));
    };
    if (force || Date.now() - traceLastSent.current >= 120) {
      if (traceDragTimer.current) {
        clearTimeout(traceDragTimer.current);
        traceDragTimer.current = null;
      }
      speak();
    } else if (!traceDragTimer.current) {
      traceDragTimer.current = setTimeout(speak, 120);
    }
  };

  const tracePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!obliqueCut || !obliqueTrace || e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ppx = { x: e.clientX - r.left, y: e.clientY - r.top };
    // t1100 — the rim answers first: an endpoint grab TURNs the cut,
    // the body keeps the slide (the more specific word wins)
    const onEndpoint =
      r.width > 0 && r.height > 0
        ? obliqueTraceEndpointHit(obliqueTrace, { w: r.width, h: r.height }, ppx)
        : false;
    const onBody = obliqueTraceHit(obliqueTrace, { w: r.width, h: r.height }, ppx);
    if (!onEndpoint && !onBody) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a lost capture never kills the gesture — the move handlers re-arm */
    }
    traceDrag.current = { active: true, moved: false, mode: onEndpoint ? "turn" : "slide" };
    setTraceRiding(true);
    traceSlideTo(e, true);
  };

  const tracePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (traceDrag.current?.active) {
      traceSlideTo(e);
      return;
    }
    if (!obliqueTrace) {
      if (traceHover) setTraceHover(false);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const hit = obliqueTraceHit(
      obliqueTrace,
      { w: r.width, h: r.height },
      { x: e.clientX - r.left, y: e.clientY - r.top }
    );
    if (hit !== traceHover) setTraceHover(hit);
  };

  const tracePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!traceDrag.current?.active) return;
    if (traceDragTimer.current) {
      clearTimeout(traceDragTimer.current);
      traceDragTimer.current = null;
    }
    traceSlideTo(e, true); // the trailing word: the final offset rides NOW
    traceDrag.current = { active: false, moved: traceDrag.current.moved, mode: traceDrag.current.mode };
    setTraceRiding(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* the capture may already be gone — the release is the point */
    }
  };

  const tracePointerLeave = () => {
    if (traceHover) setTraceHover(false);
  };

  // t906 — the readout rides the lib's ONE formula (the embed's commit
  // site and this tile can never drift); the byte-format is unchanged
  const readout = voxelReadout(pos, spec.axis, dim);

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
        {/* t1098 — the axis's own walk: the whole box swept face to face
            along this axis, one document; revealed with the sync button's
            own hover vocabulary (the tile's feature tier). t1107 — the
            tile's own position rides along: the export marks the frame
            nearest the plane the reader was just looking at. */}
        <OrthoFilmstripButton jobId={jobId} path={path} spec={spec} dim={dim} current={pos} />
        <button
          type="button"
          onClick={syncTo3d}
          aria-label={`Show the ${spec.plane} at ${readout} in 3D`}
          title="Move the 3D cross-section to this plane"
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all duration-150 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 hover-none:opacity-100"
        >
          <Crosshair className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <div
        className={cn(
          "relative aspect-square cursor-crosshair",
          traceRiding ? "cursor-grabbing" : traceHover && "cursor-grab"
        )}
        onClick={pickFocus}
        onMouseMove={moveProbe}
        onMouseLeave={() => {
          tracePointerLeave();
          leaveProbe();
        }}
        onPointerDown={tracePointerDown}
        onPointerMove={tracePointerMove}
        onPointerUp={tracePointerUp}
        title="Hover reads the density at the cursor · click to move the focus point — the sibling planes follow · drag the violet cut line to slide the cut · drag an endpoint to turn the cut"
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
            {(() => {
              // t1122 — the patch's own footprint: the (2r+1)² AREA whose
              // statistics the chip speaks, drawn as a dashed outline —
              // the numbers and the rectangle are the same object (one
              // fetch, one box, one lib seat: patchBoxRect). No dims, no
              // patch, no drawable truth → no box (silence, not a guess).
              const rect = patchBoxRect(probe?.patch, dims ?? null, spec.hAxis, spec.vAxis);
              if (!rect) return null;
              return (
                <div
                  data-ortho-probe-box
                  aria-hidden="true"
                  className="pointer-events-none absolute border border-dashed border-sky-400/70 bg-sky-400/5"
                  style={{
                    left: `${rect.left * 100}%`,
                    top: `${rect.top * 100}%`,
                    width: `${(rect.right - rect.left) * 100}%`,
                    height: `${(rect.bottom - rect.top) * 100}%`,
                  }}
                />
              );
            })()}
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
                {patchText && (
                  <span
                    data-ortho-probe-patch
                    className="block text-sky-400/70"
                    title="local (2r+1)² patch around the probed voxel — median & robust z (σ = 1.4826·MAD): a high z says the blob rises above its own background, a z near zero says noise"
                  >
                    {patchText}
                  </span>
                )}
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
  // t1103 — the plate's paper clock (the t232 law: paper clocks do not
  // hydrate). A TOP-LEVEL hook: the plate renders below the stack early
  // return, but the clock belongs to the component's hook ledger —
  // calling it past `if (isStack) return null` would be the hooks-order
  // sin the t1100 TDZ lesson already paid for.
  const printed = usePrintedDate();
  /** t278 — crosshair lines on/off (panel-level; default ON) */
  const [crosshairOn, setCrosshairOn] = useState(true);
  // t1122 — the probe's patch radius (voxels): the slider is panel-level
  // (one hand, all three tiles), the chip's statistics and the tile's
  // dashed footprint follow it on the next hover — and the request speaks
  // it verbatim, the server's own 0..16 law stays the last word
  const [probeRadius, setProbeRadius] = useState(5);
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
  /** t1103 — the panel's own echo of the live oblique cut: the plate's
   *  words (the cut line, the violet trace) need the cut as STATE, not
   *  the block's onChange ref — a ref moves without a render, and paper
   *  must never print a stale cut. Rides the SAME wire the tiles ride
   *  (OBLIQUE_CLIP_EVENT + the applied-state ACK), the tile's own adopt
   *  law at panel altitude; the effect lives right below with the
   *  panel's other window listeners. */
  const [plateOblique, setPlateOblique] = useState<{
    theta: number;
    phi: number;
    offset: number;
  } | null>(null);
  /** t1105 — the plate's distribution: fetched at PRINT time by the t291
   *  law (the paper asks, the server's per-map cache answers), held as
   *  state so the band is IN the DOM before the flag arms. Null = the
   *  honest absence (fetch failed / degenerate payload): the plate
   *  prints without the band, never with a guessed distribution. */
  const [plateHist, setPlateHist] = useState<PlateHistPayload | null>(null);
  /** t1105 — the print verb's busy door: the fetch (≤8s honest) now
   *  precedes the dialog, so the button speaks the export button's own
   *  spinner language while the paper prepares (the walk family's
   *  idle/busy law, one state smaller — no ok/err window: the print
   *  dialog itself is the answer). */
  const [platePrintBusy, setPlatePrintBusy] = useState(false);
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

  // t1103 — the plate's cut echo: the SAME wire the tiles' shadows ride
  // (the embed's clip intent + the applied-state ACK), adopted at panel
  // altitude so the plate's cut line and violet trace re-render with the
  // cut (a ref moves silently — paper must never print a stale cut). The
  // tile's own adopt law, verbatim shape.
  useEffect(() => {
    const adopt = (d: unknown) => {
      if (!d || typeof d !== "object") return;
      const det = d as { on?: unknown; theta?: unknown; phi?: unknown; offset?: unknown };
      if (det.on !== true) {
        setPlateOblique(null);
        return;
      }
      const theta = typeof det.theta === "number" && Number.isFinite(det.theta) ? det.theta : null;
      const phi = typeof det.phi === "number" && Number.isFinite(det.phi) ? det.phi : null;
      const offset = typeof det.offset === "number" && Number.isFinite(det.offset) ? det.offset : null;
      if (theta == null || phi == null || offset == null) return;
      setPlateOblique({ theta, phi, offset });
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

  // t1103 — the plate's words, decided before any print: the plan rides
  // the ONE voices lib, so the paper can never drift from the screen's
  // own readouts (the captions, the σ chip, the cut's annotation).
  const platePlan = planOrthoPlate({ positions, dims, sigma: isoSigma, oblique: plateOblique });
  const plateMeta = orthoPlateMetaLine(platePlan);
  const plateBase = path.split("/").pop() || path;

  // t1104 — the walk page's geometry, decided before any print: the SAME
  // walk lib the screen's strip button rides (plan + URLs — no second
  // request dialect), planned from the plate's own cut echo so the paper
  // never prints a stale cut (the t1103 echo law, second page). No live
  // cut → no walk page: the screen's own law (the strip button is
  // disabled while the clip is off), stated on paper too.
  const walkPlan = plateOblique
    ? planObliqueFilmstrip(plateOblique.theta, plateOblique.phi, dims)
    : null;
  const walkUrls = walkPlan ? obliqueFilmstripUrls(jobId, path, walkPlan) : null;

  // t1108 — the cut walk's "you are here": the frame whose plane stands
  // nearest the cut's own offset (the ONE frac seat — the export's
  // canvas rides the same answer via live.offset). A null walkPlan (no
  // live cut) has no page and no mark: the honest absence, stated on
  // both faces at once.
  const walkCurrent =
    walkPlan && plateOblique
      ? obliqueWalkCurrentIndex(walkPlan.frames, plateOblique.offset)
      : null;

  // t1112 — the direction walk's paper geometry, decided before any
  // print: the SAME seats the screen's direction dial rides (the ONE
  // lib's azimuth ladder + angular mark) joined with the azimuth URL
  // edition (the block's own src law — no second request dialect).
  // The θ and offset are the cut's own (the plate's echo state — the
  // paper never prints a stale cut, the t1103 echo law, fourth page);
  // φ walks the stations. No live cut → no page: page 2's own law,
  // stated on paper again.
  const directionPrintStops = planObliqueDirectionWalk();
  const directionPrintUrls = plateOblique
    ? obliqueDirectionWalkUrls(jobId, path, plateOblique.theta, plateOblique.offset, directionPrintStops)
    : null;
  const directionPrintCurrent = plateOblique
    ? obliqueDirectionWalkCurrentIndex(directionPrintStops, plateOblique.phi)
    : null;

  // t1106 — the axis walks' paper geometry, decided before any print: the
  // SAME lib the screen's strip buttons ride (plan + URLs — no second
  // request dialect), one strip per axis in the tile row's own order (the
  // page's map below iterates TILE_SPECS — the ONE order father). A grid
  // the listing cannot claim still walks: the plane voice's own % fallback
  // carries the position (the t1098 law, stated on paper too).
  const axisWalkPlans = {
    z: planOrthoFilmstrip("z", dimFor("z")),
    y: planOrthoFilmstrip("y", dimFor("y")),
    x: planOrthoFilmstrip("x", dimFor("x")),
  };
  const axisWalkUrls = {
    z: orthoFilmstripUrls(jobId, path, axisWalkPlans.z),
    y: orthoFilmstripUrls(jobId, path, axisWalkPlans.y),
    x: orthoFilmstripUrls(jobId, path, axisWalkPlans.x),
  };

  // t1107 — the walk's "you are here": each strip marks the frame whose
  // plane stands nearest the tile's own current position (the ONE seat —
  // the export's canvas rides the same answer, so the paper and the
  // downloaded document can never disagree about where the reader was).
  // positions are the state the tiles themselves speak (t278's focus
  // point), so the mark follows every scrub without a second channel.
  const axisWalkCurrent = {
    z: orthoWalkCurrentIndex(axisWalkPlans.z.frames, positions.z),
    y: orthoWalkCurrentIndex(axisWalkPlans.y.frames, positions.y),
    x: orthoWalkCurrentIndex(axisWalkPlans.x.frames, positions.x),
  };

  // t1105 — the distribution band's geometry, decided before any print:
  // the ONE plan seat (the t291 drawing law in pure, node-pinnable form).
  // A null payload plans null → the leg honestly stays home.
  const plateHistPlan = planPlateHistogram(plateHist, isoSigma);

  // t1103 — the plate's print verb: set the body flag (the print CSS's
  // only key), print, and ALWAYS clean the flag up — afterprint owns the
  // happy path, the timeout is the headless failsafe. No printout inherits
  // a flag it did not ask for (the session report's cleanup law,
  // verb-scoped edition: the flag lives for THIS print, not the mount).
  const printPlate = async () => {
    if (platePrintBusy) return;
    setPlatePrintBusy(true);
    try {
      // t1105 — the paper asks for the distribution BEFORE the verb (the
      // t291 fetch law: 8s honest timeout, server-cached per map); the
      // band must be committed before the flag arms, so a rAF pair lets
      // the state paint, then the flag law below runs UNCHANGED (set →
      // print → afterprint once + the 8s failsafe — the t1103 bytes).
      const hist = await fetchHistForPaper();
      setPlateHist(hist);
      await new Promise<void>((res) =>
        requestAnimationFrame(() => requestAnimationFrame(() => res()))
      );
      const body = document.body;
      body.setAttribute("data-plate-print", "");
      const clear = () => body.removeAttribute("data-plate-print");
      window.addEventListener("afterprint", clear, { once: true });
      try {
        window.print(); // headless probes: no dialog — the flag rides for the pdf instrument
      } catch {
        /* the flag stays for the instrument; the failsafe clears it below */
      }
      window.setTimeout(clear, 8000);
    } finally {
      setPlatePrintBusy(false);
    }
  };

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

  /** t291/t1105 — the PAPER editions' distribution: the same
   *  `format=histogram` payload the live strip consumes (server-cached
   *  per map, so a panel that had the strip on pays nothing). ONE fetch
   *  form serving both paper faces — the export triptych's footer (t291)
   *  and the plate's σ leg (t1105) — honest absence on ANY failure: a
   *  fetch that errs, times out (8s: the first look walks the volume,
   *  the paper must not hang on it) or comes back malformed keeps the
   *  paper honest (the footer stays one line, the leg stays home)
   *  instead of drawing a guessed distribution. */
  const fetchHistForPaper = async (): Promise<{
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
        // t1105 — the export's hist leg rides the SAME fetch fn (renamed
        // fetchHistForPaper: it now serves both paper editions)
        Promise.all(
          TILES.map(async (t) => {
            const url = `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=png&axis=${t.axis}&pos=${positions[t.axis].toFixed(3)}`;
            const r = await fetch(url, { cache: "no-store" });
            if (!r.ok) throw new Error(`render failed (${r.status})`);
            return createImageBitmap(await r.blob());
          })
        ),
        fetchHistForPaper(),
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
      // t559/t907 — the footer's oblique voice: the cut DESCRIBED, not
      // just gestured at. The render obeys ob.live (the fetch's own
      // params), so the live readings always hold and always speak:
      // the angles, the offset %, the depth in voxels. The provenance
      // glyph prefixes while its reading holds (⌖ the camera swung
      // face-on to it, ⤸ the cut adopted the camera's view) — a hand on
      // a slider revokes the GLYPH, never the cut's own truth. Violet:
      // the oblique block's own hue, so the voice reads as the fourth
      // panel's inside the footer.
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      const nameW = ctx.measureText(base).width;
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      const prov = withOblique ? ob?.provenance : undefined;
      const dialogue =
        withOblique && ob
          ? `${prov ? `${prov.kind === "jump" ? "⌖" : "⤸"} ` : ""}${ob.live.theta}°·${ob.live.phi}° · ${obliqueOffsetPctVoice(ob.live.offset / 100)} · ${obliqueDepthVoice(ob.offsetVox)}`
          : null;
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
      className="plate-walk shrink-0 rounded-lg border border-border/80 bg-card/40"
    >
      <div className="flex w-full items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
        {/* t1122 — the probe's patch radius: the AREA the second voice
            summarises, adjustable 1..12. The readout speaks the FULL patch
            size (2r+1)² — what the chip's `n` counts at the volume edge is
            its own honest clamped truth, never this number. */}
        <div
          className="flex shrink-0 items-center gap-1.5"
          data-canvas-ui="ortho-probe-radius"
          title="the density probe reads a (2r+1)² patch around the cursor — its median and robust z fill the chip's second line; drag to widen or narrow the neighbourhood"
        >
          <Slider
            value={[probeRadius]}
            min={1}
            max={12}
            step={1}
            onValueChange={(v) => setProbeRadius(v[0] ?? 5)}
            aria-label="Probe patch radius in voxels"
            className="w-16"
          />
          <span className="w-12 font-mono text-[10px] tabular-nums text-muted-foreground">
            {2 * probeRadius + 1}×{2 * probeRadius + 1}
          </span>
        </div>
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
          aria-label={exportState === "busy" ? "Exporting the triptych…" : "Export the three orthogonal sections as a PNG triptych"}
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
        {/* t1103 — the walk's paper verb. Sibling of the export button
            (never nested): the plate is the screen's paper edition — the
            body-flag door the session report opened, verb-scoped. */}
        <button
          type="button"
          onClick={printPlate}
          disabled={platePrintBusy}
          data-canvas-ui="ortho-plate-print"
          data-ortho-print-state={platePrintBusy ? "busy" : "idle"}
          aria-label={
            platePrintBusy
              ? "Preparing the paper plate — fetching the density distribution"
              : "Print the three sections as a paper plate"
          }
          title="Print the tri-panar plate — the three sections at the focus point, their voxel readouts, the σ contour and the density distribution, as one paper figure"
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        >
          {platePrintBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
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
              probeRadius={probeRadius}
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
          {/* t831 — the σ family completes the row: the contour keys
              belong here too, because the histogram's cyan cut line is
              drawn from the SAME isoSigma the embed echoes — [ ] moves
              the cut and the line follows the echo wire (the same
              3D→2D direction the tiles ride), F flips the side. Gated
              by the row's own signal: no isoSigma, no chips. */}
          <span className="inline-flex items-center gap-0.5">
            <Kbd>[</Kbd>
            <Kbd>]</Kbd>
            <span className="ml-1">step the cut — the line follows</span>
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Kbd>F</Kbd>
            <span className="ml-1">flips the side</span>
          </span>
        </div>
      )}
      {/* t1103 — the walk's PRINTER: the plate. The tiles live in the Mol*
          modal and paper never sees them (the Task 70 law); the plate is
          the paper's own edition — one print verb flips
          body[data-plate-print], the dialog un-dialogs, and this figure
          prints: the three sections at the focus point, the σ contour
          the 3D view is drawn at, the live cut's annotation voice, each
          tile's voxel address. The screen never sees it (hidden
          print:block); the words ride the ONE plan lib, the pixels ride
          the SAME request law as the screen tiles. */}
      {open && (
        <section
          data-ortho-plate-doc
          aria-hidden="true"
          className="hidden print:block border-t border-foreground/10 px-3 pt-2 pb-1"
        >
          <header className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold">Ortho plate</span>
            <span className="truncate font-mono text-[9px] text-muted-foreground">
              {plateBase}
              {plateBase && printed ? " · " : ""}
              {printed}
            </span>
          </header>
          <p className="font-mono text-[9px] leading-4 text-muted-foreground">
            {plateMeta || "—"}
          </p>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {TILES.map((t) => {
              const trace =
                plateOblique && dims
                  ? obliqueTraceOnTile(t, dims, positions[t.axis], plateOblique)
                  : null;
              return (
                <figure key={t.axis} className="min-w-0">
                  <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-foreground/15 bg-white">
                    <img
                      src={orthoPlateTileUrl(jobId, path, t.axis, positions[t.axis])}
                      alt=""
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    {crosshairOn &&
                      ([t.hAxis, t.vAxis] as const).map((src) => {
                        const vertical = src === t.hAxis;
                        const at = positions[src];
                        return (
                          <div
                            key={src}
                            className="pointer-events-none absolute"
                            style={{
                              left: vertical ? pct(at) : 0,
                              top: vertical ? 0 : pct(at),
                              width: vertical ? 0 : "100%",
                              height: vertical ? "100%" : 0,
                              borderLeft: vertical
                                ? `1px dashed ${AXIS_COLOR[src]}`
                                : undefined,
                              borderTop: vertical
                                ? undefined
                                : `1px dashed ${AXIS_COLOR[src]}`,
                            }}
                          />
                        );
                      })}
                    {trace && (
                      <>
                        <svg
                          className="pointer-events-none absolute inset-0 h-full w-full"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <line
                            x1={trace.x1}
                            y1={trace.y1}
                            x2={trace.x2}
                            y2={trace.y2}
                            stroke="#7c3aed"
                            strokeWidth={2}
                            strokeDasharray="5 3"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                        {[
                          { x: trace.x1, y: trace.y1 },
                          { x: trace.x2, y: trace.y2 },
                        ].map((pt, i) => (
                          <span
                            key={i}
                            className="pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-violet-600"
                            style={{ left: pct(pt.x / 100), top: pct(pt.y / 100) }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                  <figcaption className="pt-0.5 font-mono text-[8px] leading-3 text-muted-foreground">
                    {t.plane} · {platePlan.readouts[t.axis]}
                  </figcaption>
                </figure>
              );
            })}
          </div>
          {/* t1105 — the σ LEG: the map's density distribution joins page 1
              (the t291 export's own figure, its second paper edition). The
              data rides the t291 fetch law (asked at print time, the per-map
              server cache answering); the geometry is the ONE plan seat's
              (the t291 bytes, lib-pinned, zero inline math here); the inks
              are the strip's own light edition (paper is always light).
              No payload → the leg honestly stays home (the export's own
              absence law), the plate prints without the band. */}
          {plateHistPlan && (
            <div data-ortho-plate-hist className="pt-1.5">
              <svg
                viewBox={`0 0 ${plateHistPlan.w} ${plateHistPlan.h}`}
                className="h-auto w-full"
                aria-hidden="true"
              >
                {plateHistPlan.bars.map((b, i) => (
                  <rect
                    key={`b${i}`}
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    fill={PLATE_HIST_INKS.bar}
                  />
                ))}
                {plateHistPlan.ticks.map((t, i) => (
                  <line
                    key={`t${i}`}
                    x1={t.x}
                    y1={6}
                    x2={t.x}
                    y2={plateHistPlan.h - 6}
                    stroke={t.strong ? PLATE_HIST_INKS.mean : PLATE_HIST_INKS.tick}
                    strokeWidth={1}
                  />
                ))}
                {plateHistPlan.cut && (
                  <line
                    x1={plateHistPlan.cut.x}
                    y1={4}
                    x2={plateHistPlan.cut.x}
                    y2={plateHistPlan.h - 6}
                    stroke={PLATE_HIST_INKS.cut}
                    strokeWidth={1.5}
                    opacity={plateHistPlan.cut.onScale ? 1 : 0.35}
                  />
                )}
              </svg>
              <p className="font-mono text-[8px] leading-3 text-muted-foreground">
                density (log) · ticks: μ ±1σ ±2σ · cyan line: the current contour
              </p>
            </div>
          )}
          <footer className="pt-1 font-mono text-[8px] leading-3 text-muted-foreground">
            {path}
            {printed ? ` · printed ${printed}` : ""}
          </footer>
          {/* t1104 — the walk's SECOND PAGE: the oblique walk's paper
              edition. Six frames face to face along the cut's own normal,
              planned by the SAME walk lib the screen's strip button rides
              (planObliqueFilmstrip + obliqueFilmstripUrls — no second
              request dialect), introduced by page 1's own cut line (the
              annotation voice's bytes, passed through — never restated),
              each frame signed with its pct and depth voices (the t907
              seats — the honest silence included). No live cut → the page
              honestly stays home (the screen's own disabled-button law).
              break-before-page starts it on a fresh sheet: page 1 is the
              three sections at the focus point, page 2 is the cut's walk
              through the box. */}
          {walkPlan && walkUrls && (
            <div data-ortho-plate-walk className="break-before-page pt-2">
              <header className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold">Oblique walk</span>
                <span className="truncate font-mono text-[9px] text-muted-foreground">
                  {plateBase}
                  {plateBase && printed ? " · " : ""}
                  {printed}
                </span>
              </header>
              <p className="font-mono text-[9px] leading-4 text-muted-foreground">
                {orthoPlateWalkMetaLine(
                  platePlan.cutLine,
                  walkPlan.frames.length
                ) || "—"}
              </p>
              <p className="font-mono text-[9px] leading-4 text-muted-foreground">
                {orthoPlateObliqueCurrentLegend()}
              </p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {walkPlan.frames.map((f, i) => (
                  <figure key={f.frac} className="min-w-0">
                    <div
                      className={cn(
                        "relative aspect-square w-full overflow-hidden rounded-sm bg-white",
                        i === walkCurrent
                          ? "border-2"
                          : "border border-foreground/15"
                      )}
                      style={
                        i === walkCurrent
                          ? { borderColor: EXPORT_OBLIQUE_ACCENT }
                          : undefined
                      }
                    >
                      <img
                        src={walkUrls[i]}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    </div>
                    <figcaption className="pt-0.5 font-mono text-[8px] leading-3 text-muted-foreground">
                      {orthoWalkFrameCaption(f)}
                    </figcaption>
                  </figure>
                ))}
              </div>
              <footer className="pt-1 font-mono text-[8px] leading-3 text-muted-foreground">
                {path}
                {printed ? ` · printed ${printed}` : ""}
              </footer>
            </div>
          )}
          {/* t1106 — the walk's THIRD PAGE: the axis walks' paper edition.
              The screen's strip buttons answer one axis at a time (one
              export each); the paper answers all three — z, y, x in the
              tile row's own order (TILES is the ONE order father), each
              strip six frames face to face along its axis, every frame
              signed with the strip lib's own plane voice (the t1098
              seats — the % fallback rides along when the grid is
              unknown). The strips ride no cut: the axis walk is the
              box's own document, so this page prints whenever the plate
              prints. The accent border rides the AXIS_LABEL father
              (decorative — the voice text stays monochrome: paper
              contrast is not the dark strip's contrast). */}
          <div data-ortho-plate-axis-walks className="break-before-page pt-2">
            <header className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold">Axis walks</span>
              <span className="truncate font-mono text-[9px] text-muted-foreground">
                {plateBase}
                {plateBase && printed ? " · " : ""}
                {printed}
              </span>
            </header>
            <p className="font-mono text-[9px] leading-4 text-muted-foreground">
              {orthoPlateWalkCurrentLegend()}
            </p>
            {TILES.map((spec) => (
              <div
                key={spec.axis}
                data-ortho-plate-axis-walk={spec.axis}
                className="mt-2 border-l-2 pl-2"
                style={{ borderColor: AXIS_LABEL[spec.axis] }}
              >
                <p className="font-mono text-[9px] leading-4 text-muted-foreground">
                  {orthoAxisWalkHeading(
                    spec.axis,
                    axisWalkPlans[spec.axis].frames.length
                  )}
                </p>
                <div className="mt-1 grid grid-cols-6 gap-1.5">
                  {axisWalkPlans[spec.axis].frames.map((f, i) => (
                    <figure key={f.pos} className="min-w-0">
                      <div
                        className={cn(
                          "relative aspect-square w-full overflow-hidden rounded-sm bg-white",
                          i === axisWalkCurrent[spec.axis]
                            ? "border-2"
                            : "border border-foreground/15"
                        )}
                        style={
                          i === axisWalkCurrent[spec.axis]
                            ? { borderColor: AXIS_LABEL[spec.axis] }
                            : undefined
                        }
                      >
                        <img
                          src={axisWalkUrls[spec.axis][i]}
                          alt=""
                          className="absolute inset-0 h-full w-full object-contain"
                        />
                      </div>
                      <figcaption className="pt-0.5 font-mono text-[8px] leading-3 text-muted-foreground">
                        {f.planeLabel}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ))}
            <footer className="pt-1 font-mono text-[8px] leading-3 text-muted-foreground">
              {path}
              {printed ? ` · printed ${printed}` : ""}
            </footer>
          </div>
          {/* t1112 — the walk's FOURTH PAGE: the direction walk's paper
              edition. The screen's direction dial (t1111) walks the cut
              around the box — six azimuth stations at the cut's own θ
              and depth; the paper answers: six frames around the box,
              planned by the SAME seats the dial rides (the ONE lib's
              azimuth ladder + angular mark) joined with the azimuth URL
              edition (the block's own src law — no second request
              dialect), introduced by page 1's own cut line (the
              annotation voice's bytes, passed through — never restated)
              and the direction extent (the walk's own word — "around
              the box"; face to face is the offset walk's phrase, the
              direction walk does not pass through faces, it circles
              them), each frame signed with the station's own voice
              (the ladder's label bytes, passed through). The current
              direction wears the mark family's ring (page 2's own ring
              bytes — the cut's violet, 2px against 1px), the ANGULAR
              seat's answer: the wrap law holds on paper too (350°
              rings φ 0°). No live cut → the page honestly stays home
              (page 2's own law). break-before-page starts it on a
              fresh sheet: page 1 is the three sections, page 2 is the
              cut's walk through the box, page 3 is the axis walks,
              page 4 is the cut's walk around it. */}
          {plateOblique && directionPrintUrls && (
            <div data-ortho-plate-direction-walk className="break-before-page pt-2">
              <header className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold">Direction walk</span>
                <span className="truncate font-mono text-[9px] text-muted-foreground">
                  {plateBase}
                  {plateBase && printed ? " · " : ""}
                  {printed}
                </span>
              </header>
              <p className="font-mono text-[9px] leading-4 text-muted-foreground">
                {orthoPlateDirectionWalkMetaLine(platePlan.cutLine, directionPrintStops.length) || "—"}
              </p>
              <p className="font-mono text-[9px] leading-4 text-muted-foreground">
                {orthoPlateDirectionCurrentLegend()}
              </p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {directionPrintStops.map((s, i) => (
                  <figure key={s.phi} className="min-w-0">
                    <div
                      className={cn(
                        "relative aspect-square w-full overflow-hidden rounded-sm bg-white",
                        i === directionPrintCurrent
                          ? "border-2"
                          : "border border-foreground/15"
                      )}
                      style={
                        i === directionPrintCurrent
                          ? { borderColor: EXPORT_OBLIQUE_ACCENT }
                          : undefined
                      }
                    >
                      <img
                        src={directionPrintUrls[i]}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    </div>
                    <figcaption className="pt-0.5 font-mono text-[8px] leading-3 text-muted-foreground">
                      {s.label}
                    </figcaption>
                  </figure>
                ))}
              </div>
              <footer className="pt-1 font-mono text-[8px] leading-3 text-muted-foreground">
                {path}
                {printed ? ` · printed ${printed}` : ""}
              </footer>
            </div>
          )}
        </section>
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
 *  so scrubbing needs no round trip. Keep the two in lockstep.
 *
 *  t907 — the support walk rides the shared lib (obliqueSupportVox, the
 *  ONE father; bit-identical to the server's historic inline for every
 *  in-range angle — and the block's state law keeps the angles in-range:
 *  sliders step 0..180/0..360, the ACK clamps, the adopt clamps). The
 *  depth arithmetic rides obliqueDepthVox (the builder's own clamp law —
 *  invisible for the slider's in-range fractions, byte-identical). */
function obliqueFrame(
  dims: [number, number, number],
  thetaDeg: number,
  phiDeg: number,
  offsetFrac: number
) {
  const [nx, ny, nz] = dims;
  // t1099 — the direction rides the ONE father (voxel-voice's
  // obliqueNormal): the builder, the support and the trace drag share the
  // seat, so a cut and its shadow can never disagree about the way out.
  const normal = obliqueNormal(thetaDeg, phiDeg);
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
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
    const d: [number, number, number] = [
      (i ? nx - 1 : 0) - c[0],
      (j ? ny - 1 : 0) - c[1],
      (k ? nz - 1 : 0) - c[2],
    ];
    const pu = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    const pv = d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
    uMin = Math.min(uMin, pu); uMax = Math.max(uMax, pu);
    vMin = Math.min(vMin, pv); vMax = Math.max(vMax, pv);
  }
  const support = obliqueSupportVox(dims, thetaDeg, phiDeg) ?? 0;
  return {
    normal,
    u,
    v,
    support,
    offsetVox: obliqueDepthVox(offsetFrac, support),
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

/**
 * t1096 — the cut's WALK, exported: the current oblique cut swept face
 * to face through the box along its own normal, composed into ONE PNG
 * document. The strip rides the same publishing-grid language as the
 * triptych (fixed tiles, measure-first labels, the block's violet
 * accent) and the SAME server truth the live view rides — the frames
 * are the block's own src shape at the plan's offsets, so a frame and
 * the screen can never disagree. The voices ride along: each frame is
 * signed with its pct (violet) and, when the grid is usable, its depth
 * in voxels (muted) — a strip that can be cited frame by frame.
 *
 * The provenance glyph rides the header while its reading holds (the
 * t559 law — a hand on a slider revokes it; the live values it names
 * are the fetch's own params, so the header never lies).
 */
function ObliqueFilmstripButton({
  jobId,
  path,
  dims,
  on,
  live,
  provenance,
}: {
  jobId: string;
  path: string;
  dims: [number, number, number];
  on: boolean;
  live: { theta: number; phi: number; offset: number };
  provenance: ObliqueExportInfo["provenance"];
}) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  useEffect(() => {
    if (state !== "ok" && state !== "err") return;
    const t = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(t);
  }, [state]);

  const walk = async () => {
    if (state === "busy" || !on) return;
    setState("busy");
    try {
      const plan = planObliqueFilmstrip(live.theta, live.phi, dims);
      const urls = obliqueFilmstripUrls(jobId, path, plan);
      // t1108 — the mark's frame, decided by the ONE frac seat before
      // any pixel: the paper's page 2 and this export share the answer
      // (the block's own live offset — the same number the slider
      // speaks). t1109 — the two-scales translation lands HERE: the
      // seat speaks the scene's fraction dialect (−1…+1), the slider
      // speaks the block's percent dialect (−100…+100); the /100 is
      // the boundary's own conversion (the raw percent read the seat
      // past the tie band — a cut at +12% wore the +100% frame's ring).
      const currentIdx = obliqueWalkCurrentIndex(plan.frames, live.offset / 100);
      const bitmaps = await Promise.all(
        urls.map(async (u) => {
          const r = await fetch(u, { cache: "no-store" });
          if (!r.ok) throw new Error(`frame render failed (${r.status})`);
          return createImageBitmap(await r.blob());
        })
      );
      // the publishing grid: fixed tiles, label strip per frame, a
      // header naming the cut and a footer naming the map + the moment.
      const TILE = 220;
      const LABEL_H = 26;
      const HEAD_H = 30;
      const FOOT_H = 46;
      const GAP = 12;
      const n = bitmaps.length;
      const W = GAP * (n + 1) + TILE * n;
      const H = GAP + HEAD_H + GAP + LABEL_H + TILE + GAP + FOOT_H;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.fillStyle = EXPORT_BG;
      ctx.fillRect(0, 0, W, H);
      // header: the walk's name in the block's violet, the cut's angles
      // (+ the provenance glyph while it holds) and the walk's span right
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = EXPORT_OBLIQUE_ACCENT;
      ctx.fillText("Oblique walk", GAP, GAP + HEAD_H / 2);
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = EXPORT_TEXT;
      ctx.textAlign = "right";
      const prov = provenance ? `${provenance.kind === "jump" ? "\u2302" : "\u2938"} ` : "";
      const span =
        plan.supportVox != null ? `${(plan.supportVox * 2).toFixed(1)} vox face to face · ` : "";
      ctx.fillText(
        `${prov}\u03b8 ${live.theta}\u00b0 \u00b7 \u03c6 ${live.phi}\u00b0 \u00b7 ${span}${n} frames${currentIdx != null ? " \u00b7 ring marks the cut's plane" : ""}`,
        W - GAP,
        GAP + HEAD_H / 2
      );
      ctx.textAlign = "left";
      // the frames: pct voice left (violet), depth voice right (muted),
      // the plane beneath — a strip that can be cited frame by frame
      const rowTop = GAP + HEAD_H + GAP;
      plan.frames.forEach((f, i) => {
        const x0 = GAP + i * (TILE + GAP);
        ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = EXPORT_OBLIQUE_ACCENT;
        ctx.textBaseline = "middle";
        ctx.fillText(f.pctLabel, x0, rowTop + LABEL_H / 2);
        if (f.depthLabel) {
          ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
          ctx.fillStyle = EXPORT_TEXT;
          ctx.textAlign = "right";
          ctx.fillText(f.depthLabel, x0 + TILE, rowTop + LABEL_H / 2);
          ctx.textAlign = "left";
        }
        ctx.drawImage(bitmaps[i], x0, rowTop + LABEL_H, TILE, TILE);
        ctx.strokeStyle = EXPORT_TILE_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, rowTop + LABEL_H + 0.5, TILE - 1, TILE - 1);
        // t1108 — the "you are here" ring: the cut's own plane wears the
        // block's violet (the header's voice color — no new ink), a 2px
        // ring inside the tile's own border. The header legend names it;
        // the plate's page 2 speaks the same mark with the same father.
        if (i === currentIdx) {
          ctx.strokeStyle = EXPORT_OBLIQUE_ACCENT;
          ctx.lineWidth = 2;
          ctx.strokeRect(x0 + 1.5, rowTop + LABEL_H + 1.5, TILE - 3, TILE - 3);
          ctx.lineWidth = 1;
        }
      });
      // footer: the map's name left, the moment right — the document
      // provenance the triptych already speaks
      const footTop = H - GAP - FOOT_H;
      const footY = footTop + FOOT_H / 2;
      const base = path.split("/").pop() || path;
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(base, GAP, footY);
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = EXPORT_TEXT;
      ctx.textAlign = "right";
      ctx.fillText(
        `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
        W - GAP,
        footY
      );
      ctx.textAlign = "left";
      const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png"));
      if (!blob) throw new Error("encode failed");
      const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
      downloadBlob(blob, obliqueFilmstripFilename(path, stamp));
      setState("ok");
    } catch {
      setState("err");
    }
  };

  return (
    <button
      type="button"
      onClick={walk}
      disabled={!on || state === "busy"}
      data-canvas-ui="ortho-oblique-filmstrip"
      aria-label={
        state === "busy"
          ? "Exporting the walk\u2026"
          : `Export the cut's walk \u2014 ${FILMSTRIP_FRAMES} frames from face to face along the normal`
      }
      title="\u2317 the walk: the current cut swept face to face through the box along its own normal, one document \u2014 each frame signed with its offset and depth"
      className={cn(
        "rounded p-0.5 text-violet-600 transition-colors hover:bg-violet-600/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        (!on || state === "busy") && "cursor-not-allowed opacity-50"
      )}
    >
      {state === "busy" ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : state === "ok" ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : state === "err" ? (
        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Film className="h-3 w-3" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * t1115 — the direction walk's EXPORT: the walk-page family's last
 * honest gap, closed. Both siblings export — the offset walk as ONE PNG
 * (t1096), the axis walks as their own (t1098); the direction walk had
 * its live dial (t1111) and its paper page (t1112) but no document. The
 * strip rides the SAME publishing-grid language and the SAME lib seats
 * the paper's fourth page rides (the ONE plan, the azimuth URL edition,
 * the angular mark) — the sibling walks mirror their laws, never share
 * code (the t1098 precedent): this export is the offset walk's azimuth
 * edition, not a parameterized merge. The frames speak the stations'
 * own voice (the lib's label — "φ 0°"…, the ONE father); the held cut's
 * θ and offset speak the header (the walk varies φ only); the ring is
 * the mark family's father (EXPORT_OBLIQUE_ACCENT, 2px against the
 * tiles' 1px — zero new ink). The URL's offset rides the /100
 * translation BORN IN (the t1109 lesson — the seat speaks the scene's
 * fraction dialect; the slider's percent never crosses raw).
 */
function ObliqueDirectionStripButton({
  jobId,
  path,
  on,
  live,
}: {
  jobId: string;
  path: string;
  on: boolean;
  live: { theta: number; phi: number; offset: number };
}) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  useEffect(() => {
    if (state !== "ok" && state !== "err") return;
    const t = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(t);
  }, [state]);

  const walk = async () => {
    if (state === "busy" || !on) return;
    setState("busy");
    try {
      const plan = planObliqueDirectionWalk();
      const urls = obliqueDirectionWalkUrls(jobId, path, live.theta, live.offset / 100, plan);
      // the mark's frame, decided by the ONE angular seat before any
      // pixel: the paper's page 4 and this export share the answer
      // (the cut's own φ, measured around the circle — the wrap law).
      const currentIdx = obliqueDirectionWalkCurrentIndex(plan, live.phi);
      const bitmaps = await Promise.all(
        urls.map(async (u) => {
          const r = await fetch(u, { cache: "no-store" });
          if (!r.ok) throw new Error(`frame render failed (${r.status})`);
          return createImageBitmap(await r.blob());
        })
      );
      // the publishing grid: the walk family's own measures — fixed
      // tiles, a label strip per frame, a header naming the held cut
      // and a footer naming the map + the moment
      const TILE = 220;
      const LABEL_H = 26;
      const HEAD_H = 30;
      const FOOT_H = 46;
      const GAP = 12;
      const n = bitmaps.length;
      const W = GAP * (n + 1) + TILE * n;
      const H = GAP + HEAD_H + GAP + LABEL_H + TILE + GAP + FOOT_H;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.fillStyle = EXPORT_BG;
      ctx.fillRect(0, 0, W, H);
      // header: the walk's name in the block's violet; the held cut's
      // θ and offset left-adjacent in the mono voice, the walk's span
      // word right — "N frames, around the box", the meta line's own
      // extent word (the paper's fourth page speaks the same bytes),
      // plus the ring's legend while the mark holds
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = EXPORT_OBLIQUE_ACCENT;
      ctx.fillText("Direction walk", GAP, GAP + HEAD_H / 2);
      const nameW = ctx.measureText("Direction walk").width;
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = EXPORT_TEXT;
      const offPct = `${live.offset > 0 ? "+" : ""}${Math.round(live.offset)}%`;
      ctx.fillText(
        `\u03b8 ${live.theta}\u00b0 \u00b7 offset ${offPct}`,
        GAP + nameW + 14,
        GAP + HEAD_H / 2
      );
      ctx.textAlign = "right";
      ctx.fillText(
        `${orthoPlateDirectionWalkExtentWord(n)}${currentIdx != null ? ` \u00b7 ${orthoPlateDirectionCurrentLegend()}` : ""}`,
        W - GAP,
        GAP + HEAD_H / 2
      );
      ctx.textAlign = "left";
      // the frames: each station's own voice (the lib's label — the ONE
      // father), violet, above its tile
      const rowTop = GAP + HEAD_H + GAP;
      plan.forEach((s, i) => {
        const x0 = GAP + i * (TILE + GAP);
        ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = EXPORT_OBLIQUE_ACCENT;
        ctx.textBaseline = "middle";
        ctx.fillText(s.label, x0, rowTop + LABEL_H / 2);
        ctx.drawImage(bitmaps[i], x0, rowTop + LABEL_H, TILE, TILE);
        ctx.strokeStyle = EXPORT_TILE_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, rowTop + LABEL_H + 0.5, TILE - 1, TILE - 1);
        // the "you are here" ring: the cut's own direction wears the
        // block's violet (the mark family's father — no new ink), a 2px
        // ring inside the tile's own border. The header legend names it;
        // the paper's page 4 speaks the same mark with the same father.
        if (i === currentIdx) {
          ctx.strokeStyle = EXPORT_OBLIQUE_ACCENT;
          ctx.lineWidth = 2;
          ctx.strokeRect(x0 + 1.5, rowTop + LABEL_H + 1.5, TILE - 3, TILE - 3);
          ctx.lineWidth = 1;
        }
      });
      // footer: the map's name left, the moment right — the document
      // provenance the walk family already speaks
      const footTop = H - GAP - FOOT_H;
      const footY = footTop + FOOT_H / 2;
      const base = path.split("/").pop() || path;
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(base, GAP, footY);
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = EXPORT_TEXT;
      ctx.textAlign = "right";
      ctx.fillText(
        `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
        W - GAP,
        footY
      );
      ctx.textAlign = "left";
      const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png"));
      if (!blob) throw new Error("encode failed");
      const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
      downloadBlob(blob, obliqueDirectionWalkFilename(path, stamp));
      setState("ok");
    } catch {
      setState("err");
    }
  };

  return (
    <button
      type="button"
      onClick={walk}
      disabled={!on || state === "busy"}
      data-canvas-ui="ortho-oblique-direction-export"
      aria-label={
        state === "busy"
          ? "Exporting the direction walk\u2026"
          : `Export the cut's direction walk \u2014 ${orthoPlateDirectionWalkExtentWord(DIRECTION_STATIONS)}`
      }
      title="\u2317 the direction walk: the current cut swept around the box at its own depth \u2014 six azimuths, one document \u2014 each frame signed with its station"
      className={cn(
        "rounded p-0.5 text-violet-600 transition-colors hover:bg-violet-600/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        (!on || state === "busy") && "cursor-not-allowed opacity-50"
      )}
    >
      {state === "busy" ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : state === "ok" ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : state === "err" ? (
        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Film className="h-3 w-3" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * t1098 — the walk's SIBLINGS: one ortho axis swept face to face through
 * the box, composed into ONE PNG document. The strip rides the same
 * publishing-grid language as the oblique walk (t1096), but speaks the
 * TILE's own accent (the axis's color everywhere the oblique speaks
 * violet) and the TILE's own voice (the t906 plane voice — "z 33/64" /
 * "z 50%", the readout the tile already wears) — one father per family,
 * no face drifts. The frames are the tile's own src shape at the plan's
 * positions (axis + pos toFixed(3)), so a frame and the screen can never
 * disagree. The walk is the axis's own tour: it owns the whole support
 * face to face, independent of where the tile's slider currently sits.
 */
function OrthoFilmstripButton({
  jobId,
  path,
  spec,
  dim,
  current,
}: {
  jobId: string;
  path: string;
  spec: TileSpec;
  /** voxels along the walked axis (from the outputs listing) — the
   * span's voice and the frames' addresses; absent → the honest % */
  dim?: number;
  /** t1107 — the tile's own current position (the live slider's
   * fraction): the walk's "you are here" anchor. The ONE seat decides
   * the frame; the export and the plate's page 3 speak the same mark. */
  current: number;
}) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  useEffect(() => {
    if (state !== "ok" && state !== "err") return;
    const t = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(t);
  }, [state]);

  const walk = async () => {
    if (state === "busy") return;
    setState("busy");
    try {
      const plan = planOrthoFilmstrip(spec.axis, dim ?? null);
      const urls = orthoFilmstripUrls(jobId, path, plan);
      // t1107 — the mark's frame, decided by the ONE seat before any
      // pixel: the paper (page 3) and this export share the answer.
      const currentIdx = orthoWalkCurrentIndex(plan.frames, current);
      const bitmaps = await Promise.all(
        urls.map(async (u) => {
          const r = await fetch(u, { cache: "no-store" });
          if (!r.ok) throw new Error(`frame render failed (${r.status})`);
          return createImageBitmap(await r.blob());
        })
      );
      // the publishing grid: the oblique walk's own measures — fixed
      // tiles, a label strip per frame, a header naming the axis and a
      // footer naming the map + the moment
      const TILE = 220;
      const LABEL_H = 26;
      const HEAD_H = 30;
      const FOOT_H = 46;
      const GAP = 12;
      const n = bitmaps.length;
      const W = GAP * (n + 1) + TILE * n;
      const H = GAP + HEAD_H + GAP + LABEL_H + TILE + GAP + FOOT_H;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.fillStyle = EXPORT_BG;
      ctx.fillRect(0, 0, W, H);
      // header: the axis walk's name in the tile's own accent, the axis's
      // span face to face (honest silence when the grid is unknown) and
      // the frame count right
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = AXIS_LABEL[spec.axis];
      ctx.fillText(`${spec.axisLabel} walk`, GAP, GAP + HEAD_H / 2);
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = EXPORT_TEXT;
      ctx.textAlign = "right";
      const span = plan.dim != null ? `${plan.dim} vox face to face \u00b7 ` : "";
      ctx.fillText(
        `${span}${n} frames${currentIdx != null ? " \u00b7 ring marks the current plane" : ""}`,
        W - GAP,
        GAP + HEAD_H / 2
      );
      ctx.textAlign = "left";
      // the frames: the tile's own plane voice in the tile's own accent —
      // the one honest label a cite needs; the plane beneath
      const rowTop = GAP + HEAD_H + GAP;
      plan.frames.forEach((f, i) => {
        const x0 = GAP + i * (TILE + GAP);
        ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = AXIS_LABEL[spec.axis];
        ctx.textBaseline = "middle";
        ctx.fillText(f.planeLabel, x0, rowTop + LABEL_H / 2);
        ctx.drawImage(bitmaps[i], x0, rowTop + LABEL_H, TILE, TILE);
        ctx.strokeStyle = EXPORT_TILE_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, rowTop + LABEL_H + 0.5, TILE - 1, TILE - 1);
        // t1107 — the "you are here" ring: the current plane's frame
        // wears the axis's own accent (the header's voice color — no
        // new ink), a 2px ring inside the tile's own border. The header
        // legend names it; the plate's page 3 speaks the same mark
        // with the same father.
        if (i === currentIdx) {
          ctx.strokeStyle = AXIS_LABEL[spec.axis];
          ctx.lineWidth = 2;
          ctx.strokeRect(x0 + 1.5, rowTop + LABEL_H + 1.5, TILE - 3, TILE - 3);
          ctx.lineWidth = 1;
        }
      });
      // footer: the map's name left, the moment right — the document
      // provenance the oblique walk already speaks
      const footTop = H - GAP - FOOT_H;
      const footY = footTop + FOOT_H / 2;
      const base = path.split("/").pop() || path;
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(base, GAP, footY);
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = EXPORT_TEXT;
      ctx.textAlign = "right";
      ctx.fillText(
        `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
        W - GAP,
        footY
      );
      ctx.textAlign = "left";
      const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png"));
      if (!blob) throw new Error("encode failed");
      const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
      downloadBlob(blob, orthoFilmstripFilename(path, spec.axis, stamp));
      setState("ok");
    } catch {
      setState("err");
    }
  };

  return (
    <button
      type="button"
      onClick={walk}
      disabled={state === "busy"}
      data-canvas-ui={`ortho-filmstrip-${spec.axis}`}
      aria-label={
        state === "busy"
          ? "Exporting the walk\u2026"
          : `Export the ${spec.plane}'s walk \u2014 ${ORTHO_FILMSTRIP_FRAMES} frames from face to face along ${spec.axisLabel}`
      }
      title={`The walk: the whole ${spec.plane} swept face to face along ${spec.axisLabel}, one document \u2014 each frame signed with its plane address`}
      className={cn(
        "shrink-0 rounded p-0.5 opacity-0 transition-all duration-150 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 hover-none:opacity-100",
        spec.text,
        state === "busy" && "cursor-not-allowed opacity-50"
      )}
    >
      {state === "busy" ? (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      ) : state === "ok" ? (
        <Check className="size-3" aria-hidden="true" />
      ) : state === "err" ? (
        <TriangleAlert className="size-3" aria-hidden="true" />
      ) : (
        <Film className="size-3" aria-hidden="true" />
      )}
    </button>
  );
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

  // t1109 — the walk DIAL's seats: the stops ride the settled walk
  // (live θ/φ — the span doesn't jitter under the hand; the same plan
  // the strip export prints and the paper's page 2 wears), and the
  // mark rides the HAND's own offset — the same number the % voice
  // above speaks — through the ONE frac seat's fraction dialect. The
  // /100 is the two-scales precedent's own translation (t1108's
  // export rode the raw percent and the seat misread the hand past
  // the tie band; the dial is born speaking the boundary's law).
  const dialPlan = planObliqueFilmstrip(live.theta, live.phi, dims);
  const dialCurrent = obliqueWalkCurrentIndex(dialPlan.frames, offset / 100);

  // t1111 — the direction DIAL's seats: the azimuth ladder rides the ONE
  // direction plan (six stations around the box, φ=360 honestly absent —
  // it is φ=0), and the mark rides the HAND's phi through the ONE
  // angular seat — the circle's own law (350° stands nearer 0° than
  // 300°; the straight difference would lie). No unit translation: the
  // slider and the stations speak the same degrees.
  const directionStops = planObliqueDirectionWalk();
  const directionCurrent = obliqueDirectionWalkCurrentIndex(directionStops, phi);
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

  // t908 — the keyboard's verb half: the viewer's key face (the embed's
  // ONE gated keydown) requests this block's OWN gestures over the verb
  // wire, and every law these buttons already obey rides along — the
  // provenance chip, the adopt flash, the 140ms settle debounce, the ✂
  // mirror. The wake/sleep laws live HERE (the block knows on/off; the
  // embed's mirror only knows the cut): "cut" wakes a sleeping block
  // (the slice's X/Y/Z law), "jump" and "offset" demand ON (the ,/. law —
  // an invisible plane must not move, a default plane must not be faced),
  // "adopt" wakes BY CAMERA (the answer handler sets on itself). The
  // listener re-subscribes on the state it reads — the captured gestures
  // are never stale (the frame ⌖ faces is THIS render's frame).
  useEffect(() => {
    const onVerb = (e: Event) => {
      const d = (e as CustomEvent<ObliqueVerbDetail>).detail;
      if (!d || typeof d.verb !== "string") return;
      if (d.verb === "cut") {
        setOn(true);
        setCut3d(true);
      } else if (d.verb === "jump") {
        if (!on) return;
        jumpToView();
      } else if (d.verb === "adopt") {
        adoptCamera();
      } else if (d.verb === "offset") {
        if (!on) return;
        const dir = d.dir === -1 ? -1 : 1;
        const step = d.coarse === true ? 10 : 2;
        scrubOffset(Math.min(100, Math.max(-100, offset + dir * step)));
      }
    };
    window.addEventListener(OBLIQUE_VERB_EVENT, onVerb);
    return () => window.removeEventListener(OBLIQUE_VERB_EVENT, onVerb);
  }, [on, theta, phi, offset]);

  return (
    <div className="border-t border-border/60 px-3 pb-3 pt-2" data-canvas-ui="ortho-oblique" data-oblique-state={on ? "on" : "off"}>
      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          onClick={() => setOn((o) => !o)}
          aria-expanded={on}
          className="flex flex-1 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                alt={`Oblique section at θ ${theta}°, φ ${phi}°, offset ${obliqueOffsetPctVoice(offset / 100)} (${obliqueDepthVoice(frame.offsetVox)})`}
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
              {/* t1111 — the direction DIAL: the offset dial's azimuth
                  sibling — six stations around the box join the φ
                  slider's own neighborhood. A click walks the cut to
                  that direction through scrubPhi (the slider's own
                  door — no second channel, no new request dialect; the
                  dial IS a hand, so the t559 law reads it the slider's
                  way: the provenance revokes). The current stop wears
                  the block's violet (the mark family's father — zero
                  new ink), 2px ring against the stops' 1px; the mark
                  is ANGULAR (the wrap seat's own law — 350° rings φ
                  0°). The stops speak: each names its azimuth; the
                  current one says so (aria-pressed). */}
              <div
                role="group"
                data-canvas-ui="ortho-oblique-direction-dial"
                aria-label="The cut's direction stops — six azimuths around the box; the ringed stop is the cut's own direction"
                title="The direction stops — six azimuths around the box at the cut's own depth. Click a stop to walk the cut there."
                className="mt-1.5 flex flex-wrap items-center gap-1"
              >
                {directionStops.map((s, i) => {
                  const current = i === directionCurrent;
                  return (
                    <button
                      key={s.phi}
                      type="button"
                      onClick={() => scrubPhi(s.phi)}
                      aria-pressed={current}
                      aria-label={
                        (current ? "The cut's own direction — " : "") +
                        `Walk the cut to ${s.label} of the azimuth circle`
                      }
                      title={`Walk the cut to ${s.label}`}
                      data-direction-stop={s.label}
                      className={cn(
                        "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        current
                          ? "border-2 border-violet-600 bg-violet-600/10 font-semibold text-violet-700 dark:text-violet-300"
                          : "border-border/70 text-muted-foreground hover:border-violet-600/40 hover:bg-violet-600/5 hover:text-foreground"
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground" htmlFor="oblique-offset">
                  offset
                </label>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {obliqueOffsetPctVoice(offset / 100)} · {obliqueDepthVoice(frame.offsetVox)}
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
              {/* t1109 — the walk DIAL: the strip's six stops join the
                  slider's own neighborhood — the cut's walk gains its
                  LIVE screen face (the ring's third face: the export
                  canvas and the paper's page 2 wear it; the live block
                  never did). A click walks the cut to that stop through
                  scrubOffset (the slider's own door — no second
                  channel, no new request dialect; the walk keeps the
                  direction's provenance — an offset scrub never revokes
                  it, the t559 law's own reading). The current stop
                  wears the block's violet (the t1108 mark's father —
                  zero new ink), 2px ring against the stops' 1px — the
                  plate's own marked/unmarked language, mirrored onto
                  the screen. The stops speak: each names its frame and
                  its depth; the current one says so (aria-pressed). */}
              <div
                role="group"
                data-canvas-ui="ortho-oblique-walk-dial"
                aria-label="The cut's walk stops — six frames face to face along the normal; the ringed stop is the cut's own plane"
                title="The walk's stops — the frames the strip export prints and the paper's second page wear. Click a stop to walk the cut there."
                className="mt-1.5 flex flex-wrap items-center gap-1"
              >
                {dialPlan.frames.map((f, i) => {
                  const current = i === dialCurrent;
                  return (
                    <button
                      key={f.frac}
                      type="button"
                      onClick={() => scrubOffset(f.offsetPct)}
                      aria-pressed={current}
                      aria-label={
                        (current ? "The cut's own plane — " : "") +
                        `Walk the cut to ${f.pctLabel} of the face-to-face span` +
                        (f.depthLabel ? ` (${f.depthLabel})` : "")
                      }
                      title={`Walk the cut to ${f.pctLabel}${f.depthLabel ? ` · ${f.depthLabel}` : ""}`}
                      data-walk-stop={f.pctLabel}
                      className={cn(
                        "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        current
                          ? "border-2 border-violet-600 bg-violet-600/10 font-semibold text-violet-700 dark:text-violet-300"
                          : "border-border/70 text-muted-foreground hover:border-violet-600/40 hover:bg-violet-600/5 hover:text-foreground"
                      )}
                    >
                      {f.pctLabel}
                    </button>
                  );
                })}
              </div>
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
                className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                title="Back to the axis-aligned center plane (θ 0°, φ 0°, centered)"
              >
                reset
              </button>
              <button
                type="button"
                onClick={jumpToView}
                data-canvas-ui="ortho-oblique-jump"
                className="rounded p-0.5 text-violet-600 transition-colors hover:bg-violet-600/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                  "rounded p-0.5 text-violet-600 transition-colors hover:bg-violet-600/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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
                  "rounded p-0.5 text-violet-600 transition-colors hover:bg-violet-600/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  cut3d && "bg-violet-600/15"
                )}
                aria-label="Cut the 3D isosurface open at this plane"
                title="✂ cut in 3D — the isosurface opens along this exact oblique plane (which half is kept flips from the viewer's chip)"
              >
                <Scissors className="h-3 w-3" aria-hidden="true" />
              </button>
              <ObliqueFilmstripButton
                jobId={jobId}
                path={path}
                dims={dims}
                on={on}
                live={live}
                provenance={provenance}
              />
              <ObliqueDirectionStripButton
                jobId={jobId}
                path={path}
                on={on}
                live={live}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
