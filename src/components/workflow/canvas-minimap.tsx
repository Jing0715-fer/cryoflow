"use client";

/**
 * CryoFlow — canvas minimap (n8n-style navigation overview).
 *
 * A live bird's-eye of the whole workspace: job rectangles colored by
 * status, edge polylines, and the current viewport window. Click or drag
 * anywhere on it to jump the viewport (zoom is preserved). Rendered as a
 * single tiny SVG whose viewBox IS the canvas coordinate system, so every
 * element is drawn in workspace coordinates for free.
 *
 * Pointer handling lives on the container (not the SVG) so the header
 * row is part of the drag surface — finger-sized on touch — and the
 * container swallows contextmenu so a touch long-press mid-drag can't
 * open the canvas-wide Radix menu.
 *
 * Framing modes (segmented control in the header):
 *   fit   — content bbox ∪ viewport window (default; you always see
 *           where you are, even panned far into empty space)
 *   nodes — content bbox only; a far-away viewport is simply clipped
 *           at the map edge (node-only framing: panning into the void
 *           no longer dilutes the map into mostly-empty space)
 *   sel   — selection bbox only; everything unselected dims (chips,
 *           edges). Falls back to fit automatically when the selection
 *           clears. Mode is ephemeral component state — no storage.
 *
 * Task 136 — the find lens reaches the map: with the Ctrl+F bar open,
 * matching chips gain an amber stroke and non-matches dim (the same
 * whisper rung the sel focus uses — see the Task 166 ladder), so
 * scattered matches read at a glance even
 * when they span several viewports. Third consumer of the SAME
 * jobMatchesFind predicate — the count, the card rings, and these dots
 * can never disagree about what a match is.
 *
 * Task 137 — the map leads: an amber match chip is a DOOR. A clean
 * press+release (≤6 px of travel) on one jumps the canvas to that job
 * (focusJob: center + legibility zoom + arrival flash — the same go()
 * semantics the find bar's Enter/count click use); a drag still pans.
 * Without the lens nothing changes — every press pans, as always. The
 * jump is intent-laden: the lens loaded the click with "this is one of
 * the ones you're looking for", so taking over the gesture only under
 * an active lens keeps the plain-pan contract intact.
 *
 * Task 139 — the framed selection is an intent too: in sel mode a
 * SELECTED chip is a door with the exact same gesture contract (clean
 * click → focusJob — which never touches the selection, so a multi-select
 * survives its own door; drag → pan). The mode itself is the intent
 * statement — the user asked the map to frame these jobs, so every chip
 * it frames brightly is "one of the ones you care about". Outside sel
 * mode a selected chip still pans: selection alone doesn't arm doors,
 * the FRAMING does — same discipline that keeps find doors lens-gated.
 */

import * as React from "react";
import { useWorkflowStore, useActiveWorkspaceJobs, useActiveWorkspaceEdges } from "@/lib/store";
import { CARD_W, CARD_H } from "@/lib/workflow";
import { capturePointer } from "@/lib/pointer";
import { cn } from "@/lib/utils";
import { compactStayReceipt } from "@/lib/remote/stay-receipt";
import { jobMatchesFind } from "./canvas-find-bar";
import { useStatusNews } from "@/lib/use-status-news";
import { isSlurmQueued } from "./job-card";
import type { JobDTO } from "@/lib/types";

const MM_W = 192;
const MM_MIN_H = 88;
const MM_MAX_H = 264;

/** padding (world px) around the minimap's world box */
const MM_PAD = 160;

type MmMode = "fit" | "nodes" | "sel";

/** header segmented control — id order is the display order */
const MM_MODES: { id: MmMode; label: string; title: string }[] = [
  { id: "fit", label: "fit", title: "Frame content + viewport (default)" },
  { id: "nodes", label: "nodes", title: "Frame content only — a far viewport clips at the map edge" },
  { id: "sel", label: "sel", title: "Frame the selection only — everything else dims" },
];

/** status → minimap fill (hex: SVG attrs don't take Tailwind classes) */
const STATUS_FILL: Record<string, string> = {
  idle: "#a1a1aa",
  pending: "#f59e0b",
  running: "#14b8a6",
  completed: "#10b981",
  failed: "#f43f5e",
};

/**
 * t606 — one dot, the news face's THIRD distance. The badge speaks at
 * panel distance, the card's floor at canvas distance (t605), and the
 * map's dot at the farthest zoom of all — the bird's-eye where a status
 * change arrives with NO finger anywhere near (the poll merges, the fill
 * swaps) — and until now the swap was silent. The dot is a surface that
 * already shows the state, so it owes the same manners: it blooms ONCE
 * in its own new color and settles.
 *
 * The vocabulary is the FLOOR's (brightness pulse on [data-news-floor]) —
 * the map is canvas distance too, one semantic one value; the hook is
 * the shared lib one (use-status-news), keyed on the DISPLAY word —
 * what the eye sees: a queued remote run paints pending amber here as
 * well (t322's dialect, the same at every distance). key={news} remounts
 * the rect on a real transition — a one-shot bloom — and restarts the
 * running SMIL pulse honestly (the pulse belongs to the new state's
 * life). Quiet re-renders (a progress tick, a position write, a
 * neighbor's poll) keep the key and the DOM node — nothing replays.
 * Mounts carry no bloom (news=0): a born state is not news.
 */
function MinimapDot({
  job, selected, inMulti, dimmed, findHit, findDim, selDoor, s,
}: {
  job: JobDTO;
  selected: boolean;
  inMulti: boolean;
  dimmed: boolean;
  findHit: boolean;
  findDim: boolean;
  selDoor: boolean;
  s: number;
}) {
  const word = isSlurmQueued(job) ? "pending" : job.status || "idle";
  const news = useStatusNews(word);
  return (
    <rect
      key={news}
      data-canvas-ui="minimap-dot"
      data-job-id={job.id}
      data-mm-dim={dimmed || findDim ? "1" : undefined}
      data-mm-find={findHit ? "1" : undefined}
      data-mm-door={findHit || selDoor ? "1" : undefined}
      data-news-floor={news > 0 ? "true" : undefined}
      x={job.x}
      y={job.y}
      width={CARD_W}
      height={CARD_H}
      rx={26}
      fill={STATUS_FILL[word] ?? STATUS_FILL.idle}
      // Task 166 — status ink stays attribute-borne (idle 0.55 /
      // active 0.9); the recession moved to the .mm-chip-dim class
      // consuming the ladder's --dim-whisper rung (the map's old
      // ad-hoc chip depth and the compare curves' whisper differed
      // by a hair — drift, not design; one semantic, one value).
      // Presentation attributes rank below every CSS rule, so the
      // class overrides the attribute without !important, and door
      // chips never co-occur with the dim.
      opacity={job.status === "idle" ? 0.55 : 0.9}
      className={cn(
        "transition-opacity duration-300",
        (dimmed || findDim) && "mm-chip-dim",
        // Task 137/139 — a door chip brightens on hover to say so
        // (stroke stays primary/amber, fill stays the world's —
        // the lens never repaints the world's colors)
        (findHit || selDoor) && "cursor-pointer hover:opacity-100",
      )}
      stroke={
        selected || inMulti
          ? "var(--primary)"
          : findHit
            ? "#f59e0b"
            : "none"
      }
      strokeOpacity={inMulti ? 0.45 : 1}
      strokeWidth={s}
    >
      <title>{`${job.name} — ${job.status}${job.status === "running" ? ` (${Math.round(job.progress)}%)` : job.result ? ` · ${compactStayReceipt(job.result, job.remoteRemaining?.remaining)}` : ""}${findHit || selDoor ? " · click to jump" : ""}`}</title>
      {job.status === "running" && !dimmed && !findDim && (
        <animate
          attributeName="opacity"
          values="0.55;0.95;0.55"
          dur="1.8s"
          repeatCount="indefinite"
        />
      )}
    </rect>
  );
}

interface CanvasMinimapProps {
  /** the canvas viewport element — measured for the viewport window rect */
  rootRef: React.RefObject<HTMLDivElement | null>;
}

/** t595 — the reframe flow's rhythm: 200ms, the thumb settle's own
 *  duration (t591) — one gesture, one rhythm; the map's projection flows
 *  beneath the settling thumb. Ease-out cubic, no overshoot: a back-out
 *  would bounce the whole projection — the box is a frame, not a button.
 *  (The projection has no CSS handle — viewBox is an attribute, not a
 *  property — so this voice lives in JS, unlike its CSS siblings in the
 *  arrival family.) */
const MM_REFLOW_MS = 200;

export function CanvasMinimap({ rootRef }: CanvasMinimapProps) {
  const jobs = useActiveWorkspaceJobs();
  const edges = useActiveWorkspaceEdges();
  const selectedId = useWorkflowStore((s) => s.selectedId);
  const selectedIds = useWorkflowStore((s) => s.selectedIds);
  // t596 — the selection-jump counter: bumps on a real change made by
  // the five selection verbs; the box-record effect compares it with a
  // seen-ref and rides the reframe flow when sel framing is live
  const selReframeSeq = useWorkflowStore((s) => s.selReframeSeq);
  const viewport = useWorkflowStore((s) => s.viewport);
  const setViewport = useWorkflowStore((s) => s.setViewport);
  const focusJob = useWorkflowStore((s) => s.focusJob);

  const svgRef = React.useRef<SVGSVGElement>(null);
  const draggingRef = React.useRef(false);
  /** Task 137 — a press on an amber match chip arms a jump; more than
   *  JUMP_SLOP of travel converts it back into a plain pan (and a clean
   *  release fires the focusJob). Null whenever the press started off a
   *  match or the lens is off. */
  const pendingJumpRef = React.useRef<{ id: string; x: number; y: number } | null>(null);

  // framing mode — ephemeral chrome (no storage, resets on remount)
  const [mode, setMode] = React.useState<MmMode>("fit");

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

  /** Task 137 — travel beyond this many px (client space) between press
   *  and release turns an armed jump back into an ordinary pan */
  const JUMP_SLOP = 6;

  /** client coords → world coords (via the svg bounding box + viewBox).
   *  Task 138 — the svg letterboxes (preserveAspectRatio xMidYMid meet):
   *  whenever the viewBox aspect differs from the element's (fit mode
   *  unions a zoomed-out viewport window into the box; mmH clamps at
   *  88..264), the content renders with centered bands and a naive linear
   *  map lands BESIDE the clicked point — the probe caught pans drifting
   *  235 world px off-target. Map into the content box first, then
   *  through the viewBox. */
  const toWorld = (e: React.PointerEvent): { x: number; y: number } | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    const vb = world;
    if (!rect || !vb) return null;
    const scale = Math.min(rect.width / vb.w, rect.height / vb.h);
    const offX = (rect.width - vb.w * scale) / 2;
    const offY = (rect.height - vb.h * scale) / 2;
    return {
      x: vb.x + (e.clientX - rect.left - offX) / scale,
      y: vb.y + (e.clientY - rect.top - offY) / scale,
    };
  };

  // selection set (primary + multi) — drives the sel framing mode
  const selIds = React.useMemo(() => {
    const s = new Set(selectedIds);
    if (selectedId) s.add(selectedId);
    return s;
  }, [selectedId, selectedIds]);

  // Task 136 — the find lens reaches the map: the SAME exported predicate
  // the bar counts with and the canvas rings with now also marks matches
  // here (third consumer). Matches keep their status fill and gain an
  // amber stroke (the canvas find ring's hue); non-matches dim with the
  // SAME whisper rung the sel focus uses — but only when the lens has ≥1 hit,
  // and never on top of sel focus (selection is the stronger intent,
  // same priority the card rings obey). Hooks live ABOVE the empty-jobs
  // early return — rules-of-hooks has no exceptions for "map not drawn".
  const findOpen = useWorkflowStore((st) => st.findOpen);
  const findQuery = useWorkflowStore((st) => st.findQuery);
  const findStatus = useWorkflowStore((st) => st.findStatus);
  const findCategory = useWorkflowStore((st) => st.findCategory);
  const findMatchIds = React.useMemo(() => {
    const q = findQuery.trim();
    if (!findOpen || (!q && findStatus === "all" && findCategory === "all")) return null;
    const ids = new Set<string>();
    for (const j of jobs) if (jobMatchesFind(j, findQuery, findStatus, findCategory)) ids.add(j.id);
    return ids;
  }, [findOpen, findQuery, findStatus, findCategory, jobs]);
  const findLens = findMatchIds != null && findMatchIds.size > 0;

  // sel with an empty selection is fit (the button disables itself, but
  // an active sel must also survive the selection clearing mid-session)
  // — hoisted above the empty-jobs early return: the t591 honesty effect
  // below needs the live mode, and rules-of-hooks has no exceptions for
  // "map not drawn" (the same discipline the find hooks obey).
  const effMode: MmMode = mode === "sel" && selIds.size === 0 ? "fit" : mode;

  // t591 — the transient click-activation key (t585's data-chip-set
  // idiom, segmented-control dialect): set on an activating click, and a
  // CSS rule keyed on [data-mm-set][aria-pressed="true"] speaks the
  // settle. A bare aria-pressed rule would ghost-pop the fit button the
  // moment sel coerces home (selection emptied → effMode falls back with
  // NO click — the disarm-never-becomes-an-event law in its coercion
  // costume) and would newly-match at remounts too.
  const [mmSet, setMmSet] = React.useState<MmMode | null>(null);

  // the key's honesty edge: when the click-activated mode stops being
  // the live mode, the key names a state the world no longer shows —
  // clear it so a later re-click of that mode can re-arm the animation
  // (React restarts a CSS animation only on a NEW attribute match; an
  // attribute that never leaves never re-fires).
  React.useEffect(() => {
    if (mmSet && mmSet !== effMode) setMmSet(null);
  }, [mmSet, effMode]);

  // t595 — the reframe flows. A mode click changes the world box (fit
  // unions the viewport window in, nodes/sel frame content only) —
  // measured live at Δw=151/Δh=378 world units and a 13% jump in the
  // map's pixel height: a visible event, not furniture. The projection
  // has no CSS handle (viewBox is an attribute, not a property), so the
  // flow is a rAF lerp of the rendered box over MM_REFLOW_MS — the
  // thumb's own settle rhythm (t591): one gesture, two organs. The arm
  // flag lives in the click handler (the finger), NOT in an effMode
  // effect: the coercion edge (selection emptied → sel falls back to fit
  // with no click) never arms — t591's disarm-never-becomes-an-event
  // law. The snapshot is taken in the handler too — by the time the
  // target render's body runs, `world` already IS the target, so the
  // on-screen box must be caught before that render overwrites the ref.
  const reframeFromRef = React.useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const reframeArmRef = React.useRef(false);
  const reframeRafRef = React.useRef<number | null>(null);
  const [animBox, setAnimBox] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // the box on screen as of the last render — the mode-click handler
  // snapshots it (BEFORE the click's own render recomputes it) so the
  // flow rides from what the user actually sees
  const lastRenderedBoxRef = React.useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // t596 — the selection-jump watcher's side of the store contract:
  // `selReframeSeq` bumps ONLY on a real selection change made by the
  // five selection verbs (delete cleanup, workspace switch, load,
  // inspect and the server poll write the fields directly and never
  // bump — those reframes snap). The ref holds the last seq this
  // component has ANSWERED; initializing it from the value at mount
  // keeps the birth quiet (a reload with a live selection must not
  // flow on first paint — t590's systemic silence, F3 face).
  const seenSelSeqRef = React.useRef<number | null>(null);

  // viewport window in WORLD coordinates:
  // screen = vx + wx·zoom  →  wx = (screen − vx) / zoom
  const zoom = viewport.zoom;
  const view = {
    x: -viewport.x / zoom,
    y: -viewport.y / zoom,
    w: size.w / zoom,
    h: size.h / zoom,
  };

  const selFocus = effMode === "sel";
  // find-dim never stacks on sel focus — selection is the stronger intent
  const findDimActive = findLens && !selFocus;

  // the framed content: selection-only in sel mode, everything otherwise
  const frameJobs = selFocus ? jobs.filter((j) => selIds.has(j.id)) : jobs;

  // infinite canvas framing per mode: fit unions the viewport window into
  // the box (you always see where you are); nodes/sel frame their source
  // content only — a far viewport just clips at the map edge instead of
  // diluting the map into mostly-empty space
  const withVp = effMode === "fit";
  const vx0 = Math.min(
    ...frameJobs.map((j) => j.x),
    withVp ? view.x : Infinity
  ) - MM_PAD;
  const vy0 = Math.min(
    ...frameJobs.map((j) => j.y),
    withVp ? view.y : Infinity
  ) - MM_PAD;
  const vx1 = Math.max(
    ...frameJobs.map((j) => j.x + CARD_W),
    withVp ? view.x + view.w : -Infinity
  ) + MM_PAD;
  const vy1 = Math.max(
    ...frameJobs.map((j) => j.y + CARD_H),
    withVp ? view.y + view.h : -Infinity
  ) + MM_PAD;
  const worldBox = { x: vx0, y: vy0, w: vx1 - vx0, h: vy1 - vy0 };
  // during a reframe the rendered box is the lerp's current frame; every
  // derivation (viewBox, mmH, stroke widths, the vp rect's clamps, and
  // toWorld's click mapping) reads this ONE box so the projection flows
  // as a whole
  const world = animBox ?? worldBox;

  // t596 — one reframe voice, two arms. Extracted from the t595 effect
  // body so the selection-jump observer (the box-record effect below)
  // can share the exact same flow: reduced-motion snaps, a same-box
  // "change" answers with silence, the first painted frame is the pin
  // (no snapped frame), the lerp is the thumb settle's rhythm (t591:
  // one gesture, one rhythm), and the transient retires bit-exactly.
  const startReframe = (
    from: { x: number; y: number; w: number; h: number },
    to: { x: number; y: number; w: number; h: number }
  ) => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (
      Math.abs(from.x - to.x) < 0.5 &&
      Math.abs(from.y - to.y) < 0.5 &&
      Math.abs(from.w - to.w) < 0.5 &&
      Math.abs(from.h - to.h) < 0.5
    ) {
      return; // same box — a re-click of the live mode answers with silence
    }
    if (reframeRafRef.current != null) cancelAnimationFrame(reframeRafRef.current);
    const t0 = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    setAnimBox({ ...from }); // pin BEFORE paint — no snapped frame
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / MM_REFLOW_MS);
      const k = easeOut(t);
      setAnimBox({
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
        w: from.w + (to.w - from.w) * k,
        h: from.h + (to.h - from.h) * k,
      });
      if (t < 1) {
        reframeRafRef.current = requestAnimationFrame(step);
      } else {
        reframeRafRef.current = null;
        setAnimBox(null); // retire — the computed box takes over
      }
    };
    reframeRafRef.current = requestAnimationFrame(step);
  };

  // the box on screen, recorded after every commit — a mode click
  // snapshots it (in the handler, BEFORE the click's own render runs)
  // so the flow rides from what the user actually sees. t596 — this
  // effect also OBSERVES selection jumps: it reads the previous box
  // BEFORE overwriting it, which is exactly the snapshot the sel-frame
  // flow needs (arm-in-each-caller would scatter five components for
  // no gain, and only the store's seq knows which changes are the
  // finger's). Runs before the thumb relay below: if both arms ever
  // landed in one commit, this one's honest snapshot wins and the
  // thumb relay's own same-box check silently declines.
  React.useLayoutEffect(() => {
    const prev = lastRenderedBoxRef.current;
    lastRenderedBoxRef.current = world;
    if (seenSelSeqRef.current !== selReframeSeq) {
      seenSelSeqRef.current = selReframeSeq;
      // the coercion edge (selection emptied → effMode falls back to
      // fit) bumps the seq too, but its box change is the SYSTEM's
      // work (t591's disarm-never-becomes-an-event law) — only a jump
      // inside a live sel framing (Escape collapse, Ctrl+A growth, a
      // dot/card re-anchor, the band's commit) rides the flow.
      if (effMode === "sel" && prev) startReframe(prev, worldBox);
    }
  });

  // the arm flag → the flow. Runs after the target render computed the
  // new box, before paint: the first painted frame is still the
  // on-screen box (the pin), and the lerp rides from there. The final
  // frame is the computed box; setAnimBox(null) hands the channels back
  // — a transient that retires (t591's honesty law). t596 — the body
  // moved into startReframe; the thumb channel remains handler-armed
  // (the finger), this effect only relays it.
  React.useLayoutEffect(() => {
    if (!reframeArmRef.current) return;
    reframeArmRef.current = false;
    const from = reframeFromRef.current;
    if (from) startReframe(from, worldBox);
  });

  // unmount: never leave a reframe rAF firing into a dead DOM
  React.useEffect(
    () => () => {
      if (reframeRafRef.current != null) cancelAnimationFrame(reframeRafRef.current);
    },
    [],
  );

  if (jobs.length === 0) return null;

  const mmH = Math.round(
    Math.min(MM_MAX_H, Math.max(MM_MIN_H, (MM_W * world.h) / world.w))
  );

  const jobById = new Map(jobs.map((j) => [j.id, j]));

  return (
    <div
      data-canvas-ui="minimap"
      data-mm-mode={effMode}
      /* Task 176: the map is a DESKTOP instrument. At the fold band its
         192px frame covered 69% of the canvas width and sat under the
         FAB — default-on there was a tap-landmine. Below lg it yields
         (the zoom dock's toggle hides with it); ≥lg everything is as it
         has been since Task 105. */
      className="no-print card-lift absolute bottom-3 right-3 z-30 hidden touch-none select-none rounded-lg border bg-card/95 p-1.5 backdrop-blur [-webkit-touch-callout:none] lg:block"
      aria-label="Canvas minimap"
      onContextMenu={(e) => {
        // the canvas-wide Radix menu would otherwise open mid-drag when the
        // browser fires its touch long-press (~500 ms) — the minimap owns
        // that gesture instead
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        // The canvas-wide Radix ContextMenuTrigger (the root section) starts
        // its OWN 700ms touch long-press timer from any bubbling touch
        // pointerdown — a still finger on the minimap would open the canvas
        // menu mid-navigation. Root's pan/long-press already ignores UI
        // elements, so nothing up-chain misses this event.
        e.stopPropagation();
        draggingRef.current = true;
        try {
          capturePointer(e);
        } catch {
          /* synthesized / lost pointer — navigation still works */
        }
        // Task 137 — a press on an amber match chip arms a jump instead of
        // panning immediately: the release decides (clean click → focusJob,
        // drag → pan from wherever the finger lands next). Task 139 — in
        // sel mode a selected chip arms the same door: the framing is the
        // intent, and focusJob never touches the selection.
        const dotId = (e.target as Element | null)?.getAttribute?.("data-job-id");
        if (dotId) {
          if (findLens && findMatchIds?.has(dotId)) {
            pendingJumpRef.current = { id: dotId, x: e.clientX, y: e.clientY };
            return;
          }
          if (selFocus && selIds.has(dotId)) {
            pendingJumpRef.current = { id: dotId, x: e.clientX, y: e.clientY };
            return;
          }
        }
        pendingJumpRef.current = null;
        const p = toWorld(e);
        if (p) navigate(p.x, p.y);
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return;
        const pj = pendingJumpRef.current;
        if (
          pj &&
          Math.abs(e.clientX - pj.x) + Math.abs(e.clientY - pj.y) > JUMP_SLOP
        ) {
          pendingJumpRef.current = null; // this became a pan
        }
        const p = toWorld(e);
        if (p) navigate(p.x, p.y);
      }}
      onPointerUp={(e) => {
        draggingRef.current = false;
        const pj = pendingJumpRef.current;
        pendingJumpRef.current = null;
        if (pj) focusJob(pj.id); // clean click on a match → jump
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
      {/* header: caption + framing-mode segmented control — buttons stop
          propagation so the container's navigate-on-pointerdown never
          hijacks a mode click */}
      <div className="flex items-center justify-between gap-1 px-0.5 pb-0.5">
        <p className="pointer-events-none text-[9px] font-medium uppercase tracking-widest text-muted-foreground/70">
          map
        </p>
        <div
          role="group"
          aria-label="Minimap framing mode"
          className="flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5"
        >
          {MM_MODES.map((m) => {
            const disabled = m.id === "sel" && selIds.size === 0;
            return (
              <button
                key={m.id}
                type="button"
                data-mm-btn={m.id}
                data-mm-set={mmSet === m.id ? "" : undefined}
                title={m.title}
                aria-pressed={effMode === m.id}
                disabled={disabled}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  // t595 — the finger arms the reframe: snapshot the
                  // on-screen box BEFORE this click's render computes the
                  // target, then flag; the layout effect rides from the
                  // snapshot. The coercion edge never passes here — it
                  // has no click (t591's law).
                  reframeFromRef.current = lastRenderedBoxRef.current;
                  reframeArmRef.current = true;
                  setMode(m.id);
                  setMmSet(m.id); // the click's own voice (t591) — see mmSet
                }}
                className={cn(
                  // t586's press recipe: transition-all + the motion-safe
                  // dip — the segment answers the hand (held = 0.96) and
                  // the mode change (the mm-set settle) on one channel;
                  // the animation owns scale while it runs, the transition
                  // owns it at rest (the CSS cascade is the handoff).
                  "rounded px-1 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide transition-all motion-safe:active:scale-[0.96]",
                  effMode === m.id
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground/60 hover:text-foreground",
                  disabled && "pointer-events-none opacity-40"
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <svg
        ref={svgRef}
        width={MM_W}
        height={mmH}
        viewBox={`${world.x} ${world.y} ${world.w} ${world.h}`}
        data-canvas-ui="minimap-svg"
        className="block cursor-pointer rounded-sm bg-muted/50"
        role="application"
        aria-label={`Workflow overview — ${jobs.length} jobs. ${
          findLens && selFocus
            ? "Click to navigate; click an amber or selected chip to jump to that job."
            : findLens
              ? "Click to navigate; click an amber chip to jump to that match."
              : selFocus
                ? "Click to navigate; click a selected chip to jump to that job."
                : "Click to navigate."
        }`}
      >
        {/* edges (thin, muted) — cheap straight port-to-port lines;
            in sel focus, edges with no selected endpoint dim further */}
        {edges.length <= 160 &&
          edges.map((e) => {
            const a = jobById.get(e.fromJobId);
            const b = jobById.get(e.toJobId);
            if (!a || !b) return null;
            const dim = selFocus && !selIds.has(e.fromJobId) && !selIds.has(e.toJobId);
            return (
              <line
                key={e.id}
                x1={a.x + CARD_W}
                y1={a.y + CARD_H / 2}
                x2={b.x}
                y2={b.y + CARD_H / 2}
                stroke="currentColor"
                strokeWidth={Math.max(6, Math.min(18, world.w / 120))}
                // Task 166 — the dim rides the ladder's --dim-ghost rung via
                // the .mm-edge-dim class (an SVG presentation attribute
                // cannot consume var()); the base ink stays attribute-borne.
                opacity={0.25}
                className={cn("text-muted-foreground", dim && "mm-edge-dim")}
                // Task 139 — the map's wires are pure decoration (the canvas
                // wires carry the click-to-delete affordance, these don't):
                // a wire crossing a chip's projected center must never steal
                // the door/navigate gesture
                pointerEvents="none"
              />
            );
          })}

        {/* job chips colored by status (hover → name tooltip via <title>)
            — stroke widths scale with the world box so chips stay visible
            when the minimap zooms out on the infinite canvas; in sel focus
            unselected chips dim (and their running pulse rests). t606 —
            each dot is a MinimapDot: the news face's third distance, the
            map acknowledges a poll-merged status with one brightness
            bloom in its own new color */}
        {(() => {
          const s = Math.max(4, Math.min(26, world.w / 80));
          return jobs.map((j) => {
            const selected = j.id === selectedId;
            const inMulti = !selected && selectedIds.includes(j.id);
            const dimmed = selFocus && !selIds.has(j.id);
            const findHit = findLens && findMatchIds!.has(j.id);
            const findDim = findDimActive && !findHit;
            // Task 139 — the sel-mode door affordance: framed-bright chips
            // promise the jump the mode armed (cursor + hover brighten +
            // title tail), and never outside sel mode — an affordance that
            // outlives its gesture is a lie
            const selDoor = selFocus && selIds.has(j.id);
            return (
              <MinimapDot
                key={j.id}
                job={j}
                selected={selected}
                inMulti={inMulti}
                dimmed={dimmed}
                findHit={findHit}
                findDim={findDim}
                selDoor={selDoor}
                s={s}
              />
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
            data-canvas-ui="minimap-vp"
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
    </div>
  );
}
