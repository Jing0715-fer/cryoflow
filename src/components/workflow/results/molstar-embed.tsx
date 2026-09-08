"use client";

/**
 * CryoFlow — Mol* (molstar) 3D volume viewer integration with contour controls.
 *
 * Loaded lazily (next/dynamic, ssr:false) from mol-viewer.tsx so the
 * ~2 MB molstar bundle never enters the main page chunk. The map is
 * fetched through the job outputs API (format=raw) and loaded via the
 * RawData → ParseCcp4 → VolumeFromCcp4 → VolumeRepresentation3D
 * transform chain.
 *
 * Contour (iso) level: the isosurface's isoValue is a Volume.IsoValue —
 * this UI exposes it in σ units (relative), i.e. threshold =
 * mean + relativeValue·sigma. Updates go through a transform-state
 * update on the VolumeRepresentation3D node so undo/history stays intact.
 */

import { useEffect, useRef, useState } from "react";
import { Axis3d, BoxSelect, Camera, Check, ClipboardCopy, Layers, Loader2, Mountain, Orbit, Plus, RotateCw, ScanLine, Video, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { fmtBytes } from "@/lib/canvas-export";
import { canCopyImageToClipboard, copyViewerPng, downloadViewerBlob, drawFigureFooter, exportViewerPng, figureFooterHeightPx, figureTitleMeta, viewerFileSlug, viewerFileTimestamp } from "@/lib/viewer-export";
import { MrcImage } from "./mrc-image";
import "molstar/build/viewer/molstar.css";

interface MolStarEmbedProps {
  jobId: string;
  path: string;
  name: string;
}

interface GridStats {
  min: number;
  max: number;
  mean: number;
  sigma: number;
}

/** Mirrors mrc.ts stretchToGray's inversion heuristic: the negative side
 * carries >2× the positive swing → the signal lives below the mean. */
function isInvertedStats(s: GridStats): boolean {
  return (
    Number.isFinite(s.min) &&
    s.min < 0 &&
    -s.min > 2 * Math.max(s.max, Number.EPSILON)
  );
}

type Phase = "loading" | "ready" | "error";

/** free-text hex color entry for the Layers color swatches — accepts with
 *  or without the leading "#" and applies LIVE once six hex digits are
 *  typed (no apply button to hunt for); invalid drafts revert on blur */
function HexSwatchInput({ color, onCommit }: { color: string; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = useState(color);
  const [focused, setFocused] = useState(false);
  // while unfocused the input simply SHOWS the prop — no prop→state sync
  // effect needed (and drafts can never go stale behind the user's back);
  // focusing seeds the draft from the current color, blur drops it
  const shown = focused ? draft : color;
  const m = shown.trim().match(/^#?([0-9a-fA-F]{6})$/);
  const valid = !!m;
  const normalized = m ? `#${m[1].toLowerCase()}` : "";
  // live-apply: the moment the draft parses as a full hex color it IS the
  // surface color — Enter just confirms, blur reverts an invalid draft
  const onChange = (v: string) => {
    setDraft(v);
    const mm = v.trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (mm) onCommit(`#${mm[1].toLowerCase()}`);
  };
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full ring-1 ring-black/15"
        style={{ backgroundColor: valid ? normalized : color }}
      />
      <input
        value={shown}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          setDraft(color);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (valid) onCommit(normalized);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") (e.target as HTMLInputElement).blur();
        }}
        spellCheck={false}
        maxLength={7}
        placeholder="RRGGBB"
        aria-label={`Custom hex color for this map (currently ${color})`}
        data-testid="hex-color-input"
        className={cn(
          "h-4 w-16 rounded border bg-background px-1 font-mono text-[9px] leading-none outline-none transition-colors placeholder:text-muted-foreground/50",
          valid ? "border-input focus-visible:border-ring" : draft.trim() ? "border-destructive/60" : "",
        )}
      />
      <span className="truncate text-[8px] leading-tight text-muted-foreground">
        {valid ? "live" : draft.trim() ? "invalid hex" : "type a hex color"}
      </span>
    </span>
  );
}

/** Fine-grained progress for the loading veil — distinguishes "compiling
 * the ~2 MB viewer" (slow on first open, expected) from "downloading the
 * map" so users never stare at an unexplained spinner. */
type LoadStage = "viewer" | "plugin" | "download" | "scene";
const STAGE_LABEL: Record<LoadStage, string> = {
  viewer: "Compiling Mol* viewer modules…",
  plugin: "Starting Mol* viewer…",
  download: "Downloading map…",
  scene: "Building isosurface…",
};
/** after this many ms of loading, show the first-open explanation */
const SLOW_HINT_MS = 8_000;

const STAGE_ORDER: LoadStage[] = ["viewer", "plugin", "download", "scene"];
/** true when stage `a` completed before the current stage `b` */
function sorder(a: LoadStage, b: LoadStage): boolean {
  return STAGE_ORDER.indexOf(a) < STAGE_ORDER.indexOf(b);
}

/* Mol* typings are awkward to thread through dynamic imports — keep the
 * plugin handle loosely typed and dispose defensively. */
type MolPlugin = any;

const PRESETS = [1, 2, 3, 5];
const SIGMA_MIN = 0.5;
const SIGMA_MAX = 10;

/** overlay surface colors, in assignment order (distinct from the main
 *  map's orange and from each other; readable on both themes). The
 *  SWATCH palette adds three more for manual overrides in the Layers
 *  panel — auto-assignment still cycles the first five. */
const OVERLAY_COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#f472b6", "#facc15"];
const SWATCH_COLORS = [...OVERLAY_COLORS, "#60a5fa", "#e879f9", "#a3e635"];
/** default surface opacity for overlays — the main map stays in front */
const OVERLAY_ALPHA = 0.55;

/** one comparison volume layered over the main map */
interface OverlayEntry {
  path: string;
  name: string;
  color: string;
  /** current surface opacity (0.15–1) */
  alpha: number;
  /** σ offset from the shared contour slider — nudges THIS map only
   *  (class maps have different stats; the shared slider alone is tight) */
  sigmaOffset: number;
}
/** an .mrc candidate from the job's outputs, offered in the Layers panel */
interface MapChoice {
  path: string;
  name: string;
  label?: string;
  size: number;
}

/** which 4 wireframe edges lie on each axis' movable clip face. pt indices
 *  follow the corner ordering in drawClipGuide (0-3 = −Z ring, 4-7 = +Z
 *  ring); the face sits at hi[i] when keeping [0,fd], at lo[i] when
 *  inverted. Indexed [axis][invert] → edge list. */
const FACE_EDGES: [number, number][][][] = [
  // X: hi face 1-2-6-5 · lo face 0-3-7-4
  [[[1, 2], [2, 6], [6, 5], [5, 1]], [[0, 3], [3, 7], [7, 4], [4, 0]]],
  // Y: hi face 2-3-7-6 · lo face 0-1-5-4
  [[[2, 3], [3, 7], [7, 6], [6, 2]], [[0, 1], [1, 5], [5, 4], [4, 0]]],
  // Z: hi face 4-5-6-7 · lo face 0-1-2-3
  [[[4, 5], [5, 6], [6, 7], [7, 4]], [[0, 1], [1, 2], [2, 3], [3, 0]]],
];

export default function MolStarEmbed({ jobId, path, name }: MolStarEmbedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<LoadStage>("viewer");
  const [slow, setSlow] = useState(false);

  // escalate the loading veil with an explanation when the first open
  // drags on (molstar compile can legitimately take ~a minute on slow disks)
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setTimeout(() => setSlow(true), SLOW_HINT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // contour state (σ units, always ≥ 0; `sign` picks the density side —
  // inverted maps like RELION class-average-style volumes store the signal
  // as NEGATIVE density, so the isosurface needs mean − σ·level)
  const [sigma, setSigma] = useState(2);
  const [sign, setSign] = useState<1 | -1>(1);
  const [stats, setStats] = useState<GridStats | null>(null);
  const [invertedNote, setInvertedNote] = useState(false);

  // ---- overlay maps (compare) -----------------------------------------
  // Extra volumes from the SAME job layered over the main map — half-maps
  // against the full map, sharpened vs masked, class 1 vs class 2. Each
  // overlay is its own RawData→ParseCcp4→VolumeFromCcp4→repr subtree that
  // FOLLOWS the main contour σ slider (relative σ per map: identical stats
  // for half-maps means identical absolute thresholds; class maps scale
  // sensibly per map). Handles live in a ref, UI state in `overlays`.
  const [overlays, setOverlays] = useState<OverlayEntry[]>([]);
  const [mapChoices, setMapChoices] = useState<MapChoice[] | null>(null);
  const [choicesLoading, setChoicesLoading] = useState(false);
  const [overlayBusy, setOverlayBusy] = useState<string | null>(null);
  /** overlay row whose color swatches are expanded (path, or null) */
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const overlayReprsRef = useRef<Map<string, { data: any; vol: any; repr: any }>>(new Map());
  const overlaySeqRef = useRef(0);
  /** per-overlay σ offset (sync source for commitContour — UI state lags) */
  const overlayOffsetsRef = useRef<Map<string, number>>(new Map());

  // mol* handles — refs so the control bar can act on a live plugin
  const pluginRef = useRef<MolPlugin>(null);
  const reprRef = useRef<any>(null);
  const volRef = useRef<any>(null);
  const sliceRef = useRef<any>(null);
  const VolumeReprRef = useRef<any>(null);
  const IsoValueRef = useRef<any>(null);
  const GridRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;
    let plugin: MolPlugin = null;

    const disposePlugin = () => {
      try {
        plugin?.dispose?.();
      } catch {
        /* best-effort cleanup */
      }
      plugin = null;
      pluginRef.current = null;
      reprRef.current = null;
      volRef.current = null;
      sliceRef.current = null;
      overlayReprsRef.current.clear();
      if (containerRef.current) containerRef.current.innerHTML = "";
    };

    const init = async () => {
      try {
        const [{ createPluginUI }, { renderReact18 }, { DefaultPluginUISpec }] = await Promise.all([
          import("molstar/lib/mol-plugin-ui"),
          import("molstar/lib/mol-plugin-ui/react18"),
          import("molstar/lib/mol-plugin-ui/spec"),
        ]);
        setStage("plugin");

        const target = containerRef.current;
        if (!target || disposed) return;

        plugin = await createPluginUI({
          target,
          render: renderReact18,
          spec: {
            ...DefaultPluginUISpec(),
            layout: { initial: { isExpanded: false, showControls: false } },
          },
        });
        console.debug("[molstar] plugin created");
        if (disposed) {
          disposePlugin();
          return;
        }
        pluginRef.current = plugin;
        // QA affordance: let browser tooling poke the live plugin (read the
        // volume grid transform when verifying clip/slice plane math).
        (window as unknown as { __molstar?: unknown }).__molstar = plugin;

        // fetch the raw map bytes through the (path-checked) outputs API.
        // Retry with backoff: in dev, Turbopack compiles the route on first
        // hit and a request can transiently fail mid-compile — an instant
        // error here would kick users to the slice fallback even though the
        // viewer itself is fine.
        setStage("download");
        let res: Response | null = null;
        let lastErr: unknown = null;
        for (let attempt = 0; attempt < 4 && !res; attempt++) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 1500 * attempt));
          }
          try {
            const r = await fetch(
              `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=raw`
            );
            if (r.ok) res = r;
            else if (r.status >= 500 || r.status === 429) lastErr = new Error(`HTTP ${r.status}`);
            else {
              // 4xx is definitive (bad path / not a map) — no retry
              throw new Error(`map download failed (HTTP ${r.status})`);
            }
          } catch (err) {
            // network-level failure (server compiling) — retry unless it was
            // our own 4xx Error
            if (err instanceof Error && err.message.startsWith("map download failed")) throw err;
            lastErr = err;
          }
        }
        if (!res) {
          throw new Error(
            `map download failed (${lastErr instanceof Error ? lastErr.message : "network"})`
          );
        }
        const buf = await res.arrayBuffer();
        console.debug("[molstar] map fetched", buf.byteLength);

        const [{ RawData, ParseCcp4 }, { VolumeFromCcp4 }, { VolumeRepresentation3D }, { Volume }, { Grid }] =
          await Promise.all([
            import("molstar/lib/mol-plugin-state/transforms/data"),
            import("molstar/lib/mol-plugin-state/transforms/volume"),
            import("molstar/lib/mol-plugin-state/transforms/representation"),
            import("molstar/lib/mol-model/volume"),
            import("molstar/lib/mol-model/volume/grid"),
          ]);
        VolumeReprRef.current = VolumeRepresentation3D;
        IsoValueRef.current = Volume.IsoValue;
        GridRef.current = Grid;

        setStage("scene");
        const b = plugin.build();
        const data = b.toRoot().apply(RawData, { data: new Uint8Array(buf), label: name });
        const parsed = data.apply(ParseCcp4, {});
        const vol = parsed.apply(VolumeFromCcp4, { entryId: "map" });
        const repr = vol.apply(VolumeRepresentation3D, {
          type: { name: "isosurface", params: {} },
          colorTheme: { name: "uniform", params: { value: 0xffae42 } },
          sizeTheme: { name: "uniform", params: {} },
        });
        await b.commit();
        reprRef.current = repr;
        volRef.current = vol;
        console.debug("[molstar] state committed");

        // surface the grid stats for the absolute-threshold readout
        try {
          for (const cell of plugin.state.data.cells.values()) {
            const obj = (cell as any)?.obj;
            // SO.Volume.Data's type name is "Volume" (capital V)
            const v = obj?.type?.name === "Volume" ? obj.data : null;
            const s = v?.grid?.stats;
            if (s && Number.isFinite(s.sigma) && s.sigma > 0) {
              const full: GridStats = {
                min: Number(s.min),
                max: Number(s.max),
                mean: Number(s.mean),
                sigma: Number(s.sigma),
              };
              setStats(full);
              // inverted map: flip the contour to the negative side once,
              // automatically — otherwise a positive σ surface shows only
              // solvent noise and the map looks "empty"
              if (isInvertedStats(full)) {
                setSign(-1);
                setInvertedNote(true);
              }
              break;
            }
          }
        } catch {
          /* readout-only */
        }

        // frame the map: focus on the visible scene's bounding sphere
        // (non-blocking — camera framing is cosmetic)
        void (async () => {
          try {
            await new Promise((r) => setTimeout(r, 300));
            const c3d = plugin?.canvas3d;
            if (!c3d || disposed) return;
            const { PluginCommands } = await import("molstar/lib/mol-plugin/commands");
            const sphere = c3d.scene?.boundingSphereVisible ?? c3d.scene?.boundingSphere;
            if (
              sphere &&
              sphere.radius > 0 &&
              Array.isArray(sphere.center) &&
              Number.isFinite(sphere.center[0])
            ) {
              // frame slightly tighter than the full bounding box so the
              // density fills more of the viewport
              const snapshot = c3d.camera.getFocus(sphere.center, Math.max(sphere.radius * 0.7, 1));
              await PluginCommands.Camera.SetSnapshot(plugin, { snapshot });
            } else {
              await PluginCommands.Camera.Reset(plugin, {});
            }
          } catch {
            /* camera framing is cosmetic */
          }
        })();

        if (!disposed) {
          setPhase("ready");
          console.debug("[molstar] ready");
        }
      } catch (err) {
        console.error("[molstar] init failed", err);
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Mol* failed to initialize");
          setPhase("error");
        }
      }
    };

    void init();
    return () => {
      disposed = true;
      disposePlugin();
      pluginRef.current = null;
      reprRef.current = null;
      volRef.current = null;
      sliceRef.current = null;
    };
  }, [jobId, path, name]);

  /* ---------------- contour updates (transform-state) --------------- */

  // latest σ requested by the user (the slider can outrun the async commits)
  const sigmaRef = useRef(sigma);
  const signRef = useRef(sign);
  const updatePending = useRef(false);
  useEffect(() => {
    sigmaRef.current = sigma;
    signRef.current = sign;
    void pumpContour();
  }, [sigma, sign]);

  const commitContour = async (value: number, dir: 1 | -1) => {
    const plugin = pluginRef.current;
    const repr = reprRef.current;
    const VolumeRepresentation3D = VolumeReprRef.current;
    const IsoValue = IsoValueRef.current;
    if (!plugin || !repr || !VolumeRepresentation3D || !IsoValue) throw new Error("not ready");
    // one build for the main map AND every overlay — overlays track the σ
    // slider in RELATIVE units, so each volume resolves the threshold
    // against its own stats (identical for half-maps, sensible for classes)
    const b = plugin.build();
    b.to(repr).update(VolumeRepresentation3D, (old: any) => ({
      ...old,
      type: {
        ...old.type,
        params: {
          ...old.type?.params,
          isoValue: IsoValue.relative(dir * value),
        },
      },
    }));
    for (const [oPath, { repr: oRepr }] of overlayReprsRef.current) {
      const offset = overlayOffsetsRef.current.get(oPath) ?? 0;
      b.to(oRepr).update(VolumeRepresentation3D, (old: any) => ({
        ...old,
        type: {
          ...old.type,
          params: {
            ...old.type?.params,
            isoValue: IsoValue.relative(dir * Math.max(0.05, value + offset)),
          },
        },
      }));
    }
    await b.commit();
  };

  const pumpContour = async () => {
    if (phase !== "ready") return; // nothing to update until the repr exists
    if (updatePending.current) return; // the in-flight commit re-checks below
    updatePending.current = true;
    try {
      let s = sigmaRef.current;
      let d = signRef.current;
      for (;;) {
        await commitContour(s, d);
        if (s === sigmaRef.current && d === signRef.current) break; // nothing newer arrived
        s = sigmaRef.current; // slider moved while committing — apply the newest
        d = signRef.current;
      }
    } catch (err) {
      console.debug("[molstar] contour update skipped", err);
    } finally {
      updatePending.current = false;
    }
  };

  /** next unused overlay color (cycles once the palette is exhausted) */
  const pickOverlayColor = (): string => {
    const used = new Set(overlays.map((o) => o.color));
    return OVERLAY_COLORS.find((c) => !used.has(c)) ?? OVERLAY_COLORS[overlays.length % OVERLAY_COLORS.length];
  };

  /** list other .mrc outputs of this job (lazy — first Layers panel open).
   *  The outputs route walks the workdir, so ANY map file the engine (or a
   *  user) dropped into the job folder is offered here. */
  const loadMapChoices = async () => {
    if (choicesLoading) return;
    setChoicesLoading(true);
    try {
      const r = await fetch(`/api/jobs/${jobId}/outputs`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const files: MapChoice[] = (json?.files ?? [])
        .filter((f: { kind: string; path: string }) => f.kind === "mrc" && f.path !== path)
        .map((f: { path: string; name: string; label?: string; size: number }) => ({
          path: f.path,
          name: f.name,
          label: f.label,
          size: f.size,
        }));
      setMapChoices(files);
    } catch {
      setMapChoices([]); // honest empty state; the panel offers a retry via reopen
    } finally {
      setChoicesLoading(false);
    }
  };

  /** fetch raw map bytes with one retry (dev route-compile blips) */
  const fetchMapBytes = async (filePath: string): Promise<Uint8Array> => {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1200));
      try {
        const r = await fetch(
          `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(filePath)}&format=raw`
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return new Uint8Array(await r.arrayBuffer());
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("map download failed");
  };

  /** add a comparison volume: own state subtree, distinct color, translucent
   *  surface, contoured at the CURRENT σ (and following it from then on).
   *  `preset` re-applies a saved session's look (see overlay persistence);
   *  `silent` suppresses the error toast for auto-restores. */
  const addOverlay = async (
    choice: MapChoice,
    preset?: { color?: string; alpha?: number; sigmaOffset?: number; silent?: boolean },
  ) => {
    if (overlayReprsRef.current.has(choice.path)) return;
    const plugin = pluginRef.current;
    const VolumeRepresentation3D = VolumeReprRef.current;
    const IsoValue = IsoValueRef.current;
    if (!plugin || !VolumeRepresentation3D || !IsoValue) return;
    setOverlayBusy(choice.path);
    try {
      const bytes = await fetchMapBytes(choice.path);
      // the plugin may have been torn down while the bytes were downloading
      if (pluginRef.current !== plugin || disposedOverlayGuard.current) return;
      const [{ RawData, ParseCcp4 }, { VolumeFromCcp4 }] = await Promise.all([
        import("molstar/lib/mol-plugin-state/transforms/data"),
        import("molstar/lib/mol-plugin-state/transforms/volume"),
      ]);
      const color = preset?.color ?? pickOverlayColor();
      const label = choice.label ?? choice.name.replace(/\.[^.]+$/, "");
      const alpha = preset?.alpha ?? OVERLAY_ALPHA;
      const offset = preset?.sigmaOffset ?? 0;
      const b = plugin.build();
      const data = b.toRoot().apply(RawData, { data: bytes, label });
      const parsed = data.apply(ParseCcp4, {});
      const vol = parsed.apply(VolumeFromCcp4, { entryId: `overlay-${overlaySeqRef.current++}` });
      const repr = vol.apply(VolumeRepresentation3D, {
        type: {
          name: "isosurface",
          params: {
            isoValue: IsoValue.relative(
              signRef.current * Math.max(0.05, sigmaRef.current + offset)
            ),
            alpha,
          },
        },
        colorTheme: { name: "uniform", params: { value: Number.parseInt(color.slice(1), 16) } },
        sizeTheme: { name: "uniform", params: {} },
      });
      await b.commit();
      overlayReprsRef.current.set(choice.path, { data, vol, repr });
      overlayOffsetsRef.current.set(choice.path, offset);
      setOverlays((o) => [...o, { path: choice.path, name: label, color, alpha, sigmaOffset: offset }]);
    } catch (err) {
      if (preset?.silent) {
        console.debug("[molstar] overlay restore skipped", choice.path, err);
      } else {
        toast({
          title: "Could not overlay map",
          description: err instanceof Error ? err.message : "Failed to load the comparison map.",
          variant: "destructive",
        });
      }
    } finally {
      setOverlayBusy(null);
    }
  };

  /** remove an overlay: delete its whole subtree (RawData→…→repr). The
   *  builder's delete() needs the raw node REF (the To selector itself does
   *  not resolve — mol* silently no-ops) and the RawData node is the root
   *  of the chain, so one delete takes the entire subtree with it. */
  const removeOverlay = async (filePath: string) => {
    const plugin = pluginRef.current;
    const entry = overlayReprsRef.current.get(filePath);
    if (!plugin || !entry) return;
    try {
      const b = plugin.build();
      b.delete(entry.data.ref);
      await b.commit();
    } catch {
      /* the subtree may already be gone (plugin teardown race) — still drop
         the UI row so the panel never shows a ghost entry */
    }
    overlayReprsRef.current.delete(filePath);
    overlayOffsetsRef.current.delete(filePath);
    setOverlays((o) => o.filter((x) => x.path !== filePath));
  };

  /** per-overlay surface opacity (debounced commit — slider fires fast) */
  const overlayAlphaTimer = useRef<Map<string, number>>(new Map());
  const setOverlayAlpha = (filePath: string, alpha: number) => {
    setOverlays((o) => o.map((x) => (x.path === filePath ? { ...x, alpha } : x)));
    const prev = overlayAlphaTimer.current.get(filePath);
    if (prev) window.clearTimeout(prev);
    overlayAlphaTimer.current.set(
      filePath,
      window.setTimeout(async () => {
        overlayAlphaTimer.current.delete(filePath);
        const plugin = pluginRef.current;
        const entry = overlayReprsRef.current.get(filePath);
        const VolumeRepresentation3D = VolumeReprRef.current;
        if (!plugin || !entry || !VolumeRepresentation3D) return;
        try {
          await plugin
            .build()
            .to(entry.repr)
            .update(VolumeRepresentation3D, (old: any) => ({
              ...old,
              type: { ...old.type, params: { ...old.type?.params, alpha } },
            }))
            .commit();
        } catch {
          /* cosmetic — next slider tick retries */
        }
      }, 140),
    );
  };

  /** per-overlay σ offset (debounced commit — recontours just this map;
   *  the shared slider keeps working since commitContour reads the ref) */
  const overlaySigmaTimer = useRef<Map<string, number>>(new Map());
  const setOverlaySigma = (filePath: string, offset: number) => {
    overlayOffsetsRef.current.set(filePath, offset);
    setOverlays((o) => o.map((x) => (x.path === filePath ? { ...x, sigmaOffset: offset } : x)));
    const prev = overlaySigmaTimer.current.get(filePath);
    if (prev) window.clearTimeout(prev);
    overlaySigmaTimer.current.set(
      filePath,
      window.setTimeout(async () => {
        overlaySigmaTimer.current.delete(filePath);
        const plugin = pluginRef.current;
        const entry = overlayReprsRef.current.get(filePath);
        const VolumeRepresentation3D = VolumeReprRef.current;
        const IsoValue = IsoValueRef.current;
        if (!plugin || !entry || !VolumeRepresentation3D || !IsoValue) return;
        try {
          await plugin
            .build()
            .to(entry.repr)
            .update(VolumeRepresentation3D, (old: any) => ({
              ...old,
              type: {
                ...old.type,
                params: {
                  ...old.type?.params,
                  isoValue: IsoValue.relative(
                    signRef.current * Math.max(0.05, sigmaRef.current + offset)
                  ),
                },
              },
            }))
            .commit();
        } catch {
          /* cosmetic — the next slider tick or σ change retries */
        }
      }, 140),
    );
  };

  /** per-overlay color — one immediate commit (a click, not a drag); the
   *  legend chips in the Layers panel AND the exported figure footer both
   *  read from the same overlays state, so they follow for free */
  const setOverlayColor = async (filePath: string, color: string) => {
    setOverlays((o) => o.map((x) => (x.path === filePath ? { ...x, color } : x)));
    const plugin = pluginRef.current;
    const entry = overlayReprsRef.current.get(filePath);
    const VolumeRepresentation3D = VolumeReprRef.current;
    if (!plugin || !entry || !VolumeRepresentation3D) return;
    try {
      await plugin
        .build()
        .to(entry.repr)
        .update(VolumeRepresentation3D, (old: any) => ({
          ...old,
          colorTheme: {
            ...old.colorTheme,
            params: { ...old.colorTheme?.params, value: Number.parseInt(color.slice(1), 16) },
          },
        }))
        .commit();
    } catch {
      /* cosmetic — picking the swatch again retries */
    }
  };

  /** teardown raced against a pending overlay download — checked after await */
  const disposedOverlayGuard = useRef(false);
  useEffect(() => {
    disposedOverlayGuard.current = false;
    return () => {
      disposedOverlayGuard.current = true;
      for (const t of overlayAlphaTimer.current.values()) window.clearTimeout(t);
      overlayAlphaTimer.current.clear();
      for (const t of overlaySigmaTimer.current.values()) window.clearTimeout(t);
      overlaySigmaTimer.current.clear();
    };
  }, []);

  /* ---------------- overlay session persistence ------------------------ */
  // The Layers setup (which maps, colors, opacities, σ nudges) is a WORKING
  // session — coming back to the job should restore it, not rebuild it from
  // scratch. Two mirrors: localStorage (instant, per browser) and a server
  // row /api/jobs/:id/overlay-session (debounced) so the session follows
  // the JOB across browsers and devices. Entries whose map left the
  // outputs are dropped on restore and both mirrors are rewritten honestly.
  const OVERLAY_KEY = `cryoflow.mol-overlays:${jobId}`;
  // the save effect must not run until the restore attempt has finished —
  // otherwise the initial empty `overlays` render would wipe the saved
  // session BEFORE it was ever read
  const overlayRestoreDoneRef = useRef(false);
  const overlayRestoreKeyRef = useRef("");
  // server mirror state: debounce timer + latest payload for flush-on-unmount
  const overlaySyncTimerRef = useRef<number | null>(null);
  const overlayLastPayloadRef = useRef<Array<{ path: string; name: string; color: string; alpha: number; sigmaOffset: number }>>([]);
  /** push a session snapshot to the job's server row — best-effort by
   *  design: localStorage stays the instant, offline-capable mirror */
  const putOverlaySession = (entries: Array<{ path: string; name: string; color: string; alpha: number; sigmaOffset: number }>) =>
    fetch(`/api/jobs/${jobId}/overlay-session`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
      keepalive: true,
    }).catch(() => {
      /* offline / dev server restarting — the local copy still holds it */
    });

  useEffect(() => {
    if (!overlayRestoreDoneRef.current) return; // restore owns storage first
    const payload = overlays.map(({ path, name, color, alpha, sigmaOffset }) => ({
      path,
      name,
      color,
      alpha,
      sigmaOffset,
    }));
    try {
      if (payload.length === 0) localStorage.removeItem(OVERLAY_KEY);
      else localStorage.setItem(OVERLAY_KEY, JSON.stringify(payload));
    } catch {
      /* private mode — session lives for this visit only */
    }
    // debounced server mirror so the session follows the JOB across
    // browsers and devices (typing in the hex field or dragging opacity
    // must not fire a request per keystroke / frame)
    overlayLastPayloadRef.current = payload;
    if (overlaySyncTimerRef.current) window.clearTimeout(overlaySyncTimerRef.current);
    overlaySyncTimerRef.current = window.setTimeout(() => {
      overlaySyncTimerRef.current = null;
      void putOverlaySession(payload);
    }, 900);
  }, [overlays, OVERLAY_KEY]);

  useEffect(() => {
    if (phase !== "ready") return;
    const restoreKey = `${jobId}|${path}`;
    if (overlayRestoreKeyRef.current === restoreKey) return;
    overlayRestoreKeyRef.current = restoreKey;
    void (async () => {
      let saved: Array<{ path: string; name: string; color: string; alpha: number; sigmaOffset: number }> = [];
      try {
        saved = JSON.parse(localStorage.getItem(OVERLAY_KEY) ?? "[]");
      } catch {
        saved = [];
      }
      // the SERVER session wins when it has entries — it follows the job
      // across browsers and devices; localStorage is the same-browser /
      // offline fallback. 2.5 s cap: a stalled request must never delay
      // the viewer coming up.
      try {
        const ctl = new AbortController();
        const timer = window.setTimeout(() => ctl.abort(), 2500);
        const r = await fetch(`/api/jobs/${jobId}/overlay-session`, { signal: ctl.signal });
        window.clearTimeout(timer);
        if (r.ok) {
          const j = await r.json();
          if (Array.isArray(j?.entries) && j.entries.length > 0) saved = j.entries;
        }
      } catch {
        /* offline / timeout — the local copy restores the session */
      }
      if (!Array.isArray(saved) || saved.length === 0) {
        overlayRestoreDoneRef.current = true;
        return;
      }
      try {
        const r = await fetch(`/api/jobs/${jobId}/outputs`);
        if (!r.ok) return; // transient — storage kept, retry on next mount
        const json = await r.json();
        const files: MapChoice[] = (json?.files ?? [])
          .filter((f: { kind: string; path: string }) => f.kind === "mrc" && f.path !== path)
          .map((f: { path: string; name: string; label?: string; size: number }) => ({
            path: f.path,
            name: f.name,
            label: f.label,
            size: f.size,
          }));
        const matches = saved.filter(
          (s) =>
            files.some((f) => f.path === s.path) &&
            typeof s.color === "string" &&
            /^#[0-9a-f]{6}$/.test(s.color) &&
            !overlayReprsRef.current.has(s.path),
        );
        // storage rewritten WITHOUT the stale entries (and only once the
        // live listing — the source of truth for what still exists — read).
        // The server mirror is rewritten too: a restore that dropped stale
        // entries must heal BOTH copies, not leave a phantom row behind
        // waiting for an unrelated edit.
        try {
          if (matches.length === 0) localStorage.removeItem(OVERLAY_KEY);
          else if (matches.length !== saved.length) localStorage.setItem(OVERLAY_KEY, JSON.stringify(matches));
        } catch {
          /* private mode */
        }
        if (matches.length !== saved.length) void putOverlaySession(matches);
        let restored = 0;
        for (const m of matches) {
          const choice = files.find((f) => f.path === m.path);
          if (!choice) continue;
          const before = overlayReprsRef.current.size;
          await addOverlay(choice, {
            color: m.color,
            alpha: typeof m.alpha === "number" ? Math.min(1, Math.max(0.15, m.alpha)) : undefined,
            sigmaOffset: typeof m.sigmaOffset === "number" ? m.sigmaOffset : undefined,
            silent: true,
          });
          if (overlayReprsRef.current.size > before) restored++;
        }
        if (restored > 0 && !disposedOverlayGuard.current) {
          toast({
            title: `Restored ${restored} overlay map${restored > 1 ? "s" : ""}`,
            description: "Your Layers setup from the last visit to this job.",
          });
        }
      } catch (err) {
        console.debug("[molstar] overlay restore skipped", err);
      } finally {
        overlayRestoreDoneRef.current = true;
      }
    })();
  }, [phase, OVERLAY_KEY]);

  const resetCamera = () => {
    const plugin = pluginRef.current;
    if (!plugin) return;
    void (async () => {
      try {
        const { PluginCommands } = await import("molstar/lib/mol-plugin/commands");
        await PluginCommands.Camera.Reset(plugin, {});
      } catch {
        /* cosmetic */
      }
    })();
  };

  /* ---------------- standard view orientations ------------------------- */
  // Axis-aligned presets are the daily bread of cryo-EM inspection — look
  // straight down X/Y/Z to judge anisotropy, check the top/bottom of the
  // box, or return to the default ¾ view. Camera.focus(target, radius,
  // durationMs, up, dir) keeps the current target + zoom radius and only
  // swings the view direction (dir = camera→target, up = screen north),
  // eased over 320 ms — verified against molstar/lib/mol-canvas3d/camera.js
  // (getFocus matches deltaDirection to `dir`, position = target − dir·d).
  const VIEW_PRESETS: Array<{ key: string; label: string; dir: [number, number, number]; up: [number, number, number] }> = [
    { key: "front", label: "Front", dir: [0, 0, -1], up: [0, 1, 0] },
    { key: "back", label: "Back", dir: [0, 0, 1], up: [0, 1, 0] },
    { key: "left", label: "Left", dir: [1, 0, 0], up: [0, 1, 0] },
    { key: "right", label: "Right", dir: [-1, 0, 0], up: [0, 1, 0] },
    { key: "top", label: "Top", dir: [0, -1, 0], up: [0, 0, -1] },
    { key: "bottom", label: "Bottom", dir: [0, 1, 0], up: [0, 0, 1] },
  ];
  const applyViewPreset = (dir: [number, number, number], up: [number, number, number]) => {
    const cam = pluginRef.current?.canvas3d?.camera;
    if (!cam) return;
    const st = cam.state;
    const target = Array.from(st.target ?? [0, 0, 0]) as [number, number, number];
    const radius = Number(st.radius) || 0;
    if (!(radius > 0)) return; // focus() ignores radius ≤ 0 — nothing framed yet
    cam.focus(target, radius, 320, up as unknown as Parameters<typeof cam.focus>[3], dir as unknown as Parameters<typeof cam.focus>[4]);
  };
  // keyboard: 1-6 swing to the matching axis view, 0 returns to the default
  // ¾ view — same muscle memory as the canvas (0 = reset). Scoped to the
  // viewer being ready; form fields and open menus keep their keys.
  useEffect(() => {
    if (phase !== "ready") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.closest("input, textarea, select, [contenteditable='true']") != null || t.isContentEditable)
      )
        return;
      if (document.querySelector('[role="menu"][data-state="open"]')) return;
      const cam = pluginRef.current?.canvas3d?.camera;
      if (!cam) return;
      const idx = "123456".indexOf(e.key);
      if (idx >= 0) {
        const p = VIEW_PRESETS[idx];
        e.preventDefault();
        applyViewPreset(p.dir, p.up);
      } else if (e.key === "0") {
        e.preventDefault();
        resetCamera();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase]);

  /* ---------------- view capture (figure export) ---------------------- */

  // busy → spinner; done → emerald check for 1.8s so the click lands visibly
  // even when the download itself is instant
  const [shot, setShot] = useState<"idle" | "busy" | "done">("idle");

  // ---- export resolution (1× native / 2× supersampled / 3× print) -------
  // persisted per browser — a figure workflow is a habit, not a per-open
  // decision. The rate multiplies the backing-store pixelScale (capped so
  // dpr-2 + 3× can never demand an absurd framebuffer).
  const EXPORT_SCALES = [1, 2, 3] as const;
  const EXPORT_SCALE_KEY = "cryoflow.mol-export-scale";
  const EXPORT_SCALE_CAP = 6; // max total pixelScale (× dpr) we ever request
  const [exportScale, setExportScale] = useState<number>(2);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(EXPORT_SCALE_KEY));
      if ((EXPORT_SCALES as readonly number[]).includes(v)) setExportScale(v);
    } catch {
      /* private mode — default 2× stands */
    }
  }, []);
  const pickExportScale = (v: number) => {
    setExportScale(v);
    try {
      localStorage.setItem(EXPORT_SCALE_KEY, String(v));
    } catch {
      /* non-fatal */
    }
  };

  // ---- custom figure caption ------------------------------------------
  // Non-empty → the footer title becomes this text instead of the default
  // "CryoFlow — <map>". Publication captions are a per-figure habit, so it
  // persists per browser and follows every sink (download / clipboard).
  const CAPTION_KEY = "cryoflow.mol-figure-caption";
  const CAPTION_MAX = 120;
  const [caption, setCaption] = useState("");
  useEffect(() => {
    try {
      setCaption(localStorage.getItem(CAPTION_KEY) ?? "");
    } catch {
      /* private mode — default caption stands */
    }
  }, []);
  const editCaption = (v: string) => {
    setCaption(v);
    try {
      if (v.trim()) localStorage.setItem(CAPTION_KEY, v);
      else localStorage.removeItem(CAPTION_KEY);
    } catch {
      /* non-fatal */
    }
  };

  /** shared capture pipeline: supersample boost → compose → sink. The
   *  figure (plate + themed footer with annotations) is identical for both
   *  sinks — only where the PNG lands differs. */
  const runCapture = (mode: "download" | "copy") => {
    const plugin = pluginRef.current;
    // The onscreen canvas: Canvas3D does NOT expose `.canvas` directly —
    // the authoritative path is webgl.gl.canvas (GLRenderingContext.canvas
    // is the standard DOM backreference to the canvas molstar created the
    // context on). DOM query is the fallback for API drift.
    const c3d = plugin?.canvas3d;
    const glCanvas = c3d?.webgl?.gl?.canvas as HTMLCanvasElement | undefined;
    const canvas: HTMLCanvasElement | null =
      glCanvas ?? containerRef.current?.querySelector("canvas") ?? null;
    if (!canvas) {
      toast({
        title: "Nothing to capture yet",
        description: "The 3D view is still starting — try again in a moment.",
        variant: "destructive",
      });
      return;
    }
    setShot("busy");
    void (async () => {
      // ---- hi-res: briefly double the backing-store pixel scale so the
      // exported figure is supersampled even on dpr-1 displays (Task 30
      // leftover). canvas3dContext.setProps re-syncs the GL scale and
      // resizes the canvas synchronously; the redraw lands on the plugin's
      // rAF loop, so we await one real `didDraw` (the BehaviorSubject's seed
      // value is skipped) with a 400 ms fallback — a throttled background
      // tab can never hang the export. Restored in `finally`.
      const ctx = plugin?.canvas3dContext;
      const prevScale = ctx?.props?.pixelScale ?? 0;
      // chosen export rate: 1× captures as-is; 2×/3× raise the backing-store
      // pixelScale for the capture frame only (capped against absurd framebuffers)
      const mult = exportScale;
      const wantBoost = mult > 1 && !!ctx && prevScale > 0 && prevScale * mult <= EXPORT_SCALE_CAP;
      const prevW = canvas.width;
      let supersampled = false;
      // one real frame at the new size: didDraw fires after the plugin's
      // render pass (its BehaviorSubject replays the seed on subscribe —
      // skipped); 400 ms fallback so a throttled tab can't hang the export
      const awaitRedraw = () =>
        new Promise<void>((res) => {
          const subject = plugin?.canvas3d?.didDraw;
          if (!subject?.subscribe) return res();
          let seeded = false;
          const sub = subject.subscribe(() => {
            if (!seeded) return;
            sub.unsubscribe();
            res();
          });
          seeded = true;
          setTimeout(res, 400);
        });
      if (wantBoost && ctx) {
        ctx.setProps({ pixelScale: prevScale * mult });
        await awaitRedraw();
        supersampled = canvas.width > prevW * 1.2; // resize actually landed?
        if (!supersampled) ctx.setProps({ pixelScale: prevScale });
      }
      const sizeNote = `${mult > 1 ? ` · ${mult}× supersampled` : ""}`;
      // color legend for the Layers overlays — chip + label per map in the
      // figure footer, so multi-map figures are self-describing
      const figureLegend = overlays.map((o) => ({ color: o.color, label: o.name }));
      try {
        // composite plate background, theme-aware: the mol* canvas renders
        // opaque (renderer clear color) in practice, but if a future render
        // pipeline leaves alpha, the plate should match the viewer surface.
        // containerRef is the inner transparent host — its PARENT carries
        // bg-white dark:bg-zinc-950. Resolve through it; a transparent
        // computed value falls back to the theme's --background.
        const host = containerRef.current?.parentElement ?? containerRef.current;
        const bg = host ? getComputedStyle(host).backgroundColor : "";
        const plate = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent" ? bg : "";
        // figure annotations: document HOW the map was cut — the same
        // slice/clip state the on-screen wireframe + sliders represent.
        // Clip axes still at 1 are uncropped and silently omitted.
        const st = sliceStateRef.current;
        const cp = clipStateRef.current;
        const annotations: string[] = [];
        if (supersampled) annotations.push(`${mult}× supersampled`);
        if (st.on) annotations.push(`slice ${st.axis} ${Math.round(st.pos * 100)}%`);
        if (cp.on) {
          const axes = (["x", "y", "z"] as const)
            .filter((ax) => cp[ax] < 0.999)
            .map((ax) => `${ax.toUpperCase()} ${Math.round(cp[ax] * 100)}%`);
          if (axes.length) annotations.push(`clip ${axes.join(" ")}${cp.invert ? " · flip" : ""}`);
        }
        if (overlays.length) {
          annotations.push(`${overlays.length} overlay map${overlays.length > 1 ? "s" : ""}`);
        }
        const opts = {
          canvas,
          background: plate,
          mapName: name,
          caption,
          sigma,
          annotations,
          legend: figureLegend,
        };
        if (mode === "copy") {
          const res = await copyViewerPng(opts);
          toast({
            title: "Figure copied to clipboard",
            description: `${res.width}×${res.height} px${sizeNote} · ${fmtBytes(res.bytes)} — paste into slides, docs or chats`,
          });
        } else {
          const res = await exportViewerPng(opts);
          toast({
            title: "3D view exported",
            description: `${res.fileName} · ${res.width}×${res.height} px${sizeNote} · ${fmtBytes(res.bytes)}`,
          });
        }
        setShot("done");
        setTimeout(() => setShot("idle"), 1800);
      } catch (err) {
        // clipboard refusals (permission / unfocused window) degrade to a
        // download so the capture work is never wasted
        if (mode === "copy" && canCopyImageToClipboard()) {
          try {
            const res = await exportViewerPng({
              canvas,
              background: getComputedStyle(containerRef.current?.parentElement ?? containerRef.current ?? document.body).backgroundColor,
              mapName: name,
              caption,
              sigma,
              annotations: [],
              legend: figureLegend,
            });
            toast({
              title: "Clipboard refused — downloaded instead",
              description: `${res.fileName} · ${fmtBytes(res.bytes)}`,
            });
            setShot("done");
            setTimeout(() => setShot("idle"), 1800);
            return;
          } catch {
            /* fall through to the honest error */
          }
        }
        toast({
          title: mode === "copy" ? "Copy failed" : "Export failed",
          description: err instanceof Error ? err.message : "Unknown error while capturing the view.",
          variant: "destructive",
        });
        setShot("idle");
      } finally {
        if (supersampled && ctx) {
          ctx.setProps({ pixelScale: prevScale }); // on-screen scale back
          await awaitRedraw();
        }
      }
    })();
  };

  const captureView = () => runCapture("download");

  /* ---------------- turntable video export ---------------------------- */

  // Records one full 360° camera rotation around the current view as a
  // WebM clip — the mol* built-in AnimateCameraSpin drives the camera (one
  // turn per duration, camera restored to the pre-spin view on finish) and
  // MediaRecorder captures a COMPOSITE canvas: every rAF the live WebGL
  // frame is drawn onto an offscreen canvas together with the same figure
  // footer the PNG export uses (title/caption + contour meta + overlay
  // legend), so videos are self-describing exactly like stills. The
  // footer content is snapshotted at record start — what you see when you
  // press record is what the clip is labeled with.
  const [spin, setSpin] = useState<"idle" | "recording">("idle");
  const [spinElapsed, setSpinElapsed] = useState(0);
  /** re-render tick for the speed highlight (the speed itself lives in a
   *  ref so `recordTurntable` always reads the latest choice) */
  const [, setSpinSpeedTick] = useState(0);
  const spinSpeedRef = useRef(8000);
  // the turn length is a habit, not a per-recording decision — remembered
  // across visits like the export scale and figure caption
  const SPIN_SPEED_KEY = "cryoflow.mol-turntable-speed";
  useEffect(() => {
    const v = Number(localStorage.getItem(SPIN_SPEED_KEY));
    if (v === 12000 || v === 8000 || v === 5000) {
      spinSpeedRef.current = v;
      setSpinSpeedTick((t) => t + 1);
    }
  }, []);

  const spinCancelRef = useRef(false);
  const spinRecRef = useRef<MediaRecorder | null>(null);
  const spinStreamRef = useRef<MediaStream | null>(null);
  /** component alive? (unmount during a recording discards silently) */
  const viewerAliveRef = useRef(true);
  useEffect(() => {
    viewerAliveRef.current = true;
    return () => {
      viewerAliveRef.current = false;
      // stop animation + recorder without saving — unmount mid-record
      spinCancelRef.current = true;
      try {
        if (spinRecRef.current && spinRecRef.current.state !== "inactive") spinRecRef.current.stop();
      } catch {
        /* best-effort */
      }
      spinStreamRef.current?.getTracks().forEach((t) => t.stop());
      const plugin = pluginRef.current;
      if (plugin?.managers?.animation?.isAnimating) void plugin.managers.animation.stop();
      // flush a pending overlay-session mirror immediately — closing the
      // viewer right after a tweak must not lose the last 900 ms of edits
      if (overlaySyncTimerRef.current) {
        window.clearTimeout(overlaySyncTimerRef.current);
        overlaySyncTimerRef.current = null;
        if (overlayLastPayloadRef.current.length) void putOverlaySession(overlayLastPayloadRef.current);
      }
    };
  }, []);

  const recordTurntable = (perTurnMs: number) => {
    const plugin = pluginRef.current;
    if (!plugin || spin === "recording") return;
    const c3d = plugin.canvas3d;
    const glCanvas = c3d?.webgl?.gl?.canvas as HTMLCanvasElement | undefined;
    const canvas: HTMLCanvasElement | null =
      glCanvas ?? containerRef.current?.querySelector("canvas") ?? null;
    if (
      !canvas ||
      typeof canvas.captureStream !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      toast({
        title: "Turntable recording unavailable",
        description: "This browser cannot record canvas video (MediaRecorder / captureStream missing).",
        variant: "destructive",
      });
      return;
    }
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
      MediaRecorder.isTypeSupported(m),
    );
    if (!mime) {
      toast({
        title: "Turntable recording unavailable",
        description: "No supported WebM encoder found in this browser.",
        variant: "destructive",
      });
      return;
    }
    setSpin("recording");
    setSpinElapsed(0);
    spinCancelRef.current = false;
    void (async () => {
      // ---- composite canvas: live frame + figure footer (snapshot) -------
      // The footer is built once, from the state visible when Record was
      // pressed — same title/caption, contour σ, slice/clip annotations and
      // overlay legend the PNG figure pipeline would burn in.
      const st = sliceStateRef.current;
      const cp = clipStateRef.current;
      const annotations: string[] = [];
      if (st.on) annotations.push(`slice ${st.axis} ${Math.round(st.pos * 100)}%`);
      if (cp.on) {
        const axes = (["x", "y", "z"] as const)
          .filter((ax) => cp[ax] < 0.999)
          .map((ax) => `${ax.toUpperCase()} ${Math.round(cp[ax] * 100)}%`);
        if (axes.length) annotations.push(`clip ${axes.join(" ")}${cp.invert ? " · flip" : ""}`);
      }
      if (overlays.length) {
        annotations.push(`${overlays.length} overlay map${overlays.length > 1 ? "s" : ""}`);
      }
      const figureLegend = overlays.map((o) => ({ color: o.color, label: o.name }));
      const { title, meta } = figureTitleMeta({ mapName: name, caption, sigma, annotations });
      const host = containerRef.current?.parentElement ?? containerRef.current;
      const bgRaw = host ? getComputedStyle(host).backgroundColor : "";
      const bgColor =
        bgRaw && bgRaw !== "rgba(0, 0, 0, 0)" && bgRaw !== "transparent"
          ? bgRaw
          : getComputedStyle(document.body).getPropertyValue("--background").trim() || "#ffffff";
      const scale = canvas.width / Math.max(1, canvas.clientWidth || canvas.width);
      const footerH = figureFooterHeightPx(scale, figureLegend.length);
      const composite = document.createElement("canvas");
      composite.width = canvas.width;
      composite.height = canvas.height + footerH;
      const cctx = composite.getContext("2d");
      if (!cctx) throw new Error("Canvas 2D context unavailable for the video footer.");

      // paint loop: one composite frame per rAF for as long as the recorder
      // is alive — captureStream(30) samples this canvas at a fixed 30 fps
      let painting = true;
      let paintRaf = 0;
      const paint = () => {
        if (!painting || !viewerAliveRef.current) return;
        cctx.fillStyle = bgColor;
        cctx.fillRect(0, 0, composite.width, canvas.height);
        cctx.drawImage(canvas, 0, 0);
        drawFigureFooter(cctx, {
          width: composite.width,
          plateHeight: canvas.height,
          footerH,
          scale,
          title,
          meta,
          legend: figureLegend,
        });
        paintRaf = requestAnimationFrame(paint);
      };
      paint();

      const stream = composite.captureStream(30);
      spinStreamRef.current = stream;
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
      spinRecRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((res) => {
        rec.onstop = () => res();
      });
      rec.start();
      const t0 = Date.now();
      const elapsedTimer = window.setInterval(
        () => setSpinElapsed(Math.round((Date.now() - t0) / 1000)),
        500,
      );
      try {
        const { AnimateCameraSpin } = await import(
          "molstar/lib/mol-plugin-state/animation/built-in/camera-spin"
        );
        if (pluginRef.current !== plugin) return; // torn down mid-import
        await plugin.managers.animation.play(AnimateCameraSpin, {
          durationInMs: perTurnMs,
          speed: 1,
          axis: [0, -1, 0], // around the current view's up axis — a turntable
        });
        // one full turn: the animation auto-stops (and restores the camera
        // to the pre-spin view); hard deadline guards a stalled tick loop
        const deadline = perTurnMs + 5000;
        while (
          pluginRef.current === plugin &&
          !spinCancelRef.current &&
          plugin.managers.animation.isAnimating &&
          Date.now() - t0 < deadline
        ) {
          await new Promise((r) => setTimeout(r, 80));
        }
        // let the final frame land before the stream closes
        await new Promise((r) => setTimeout(r, 300));
      } finally {
        window.clearInterval(elapsedTimer);
        // stop the footer paint loop before tearing the stream down
        painting = false;
        if (paintRaf) cancelAnimationFrame(paintRaf);
        try {
          if (pluginRef.current === plugin && plugin.managers.animation.isAnimating) {
            await plugin.managers.animation.stop();
          }
        } catch {
          /* cosmetic */
        }
        try {
          if (rec.state !== "inactive") rec.stop();
        } catch {
          /* best-effort */
        }
        await stopped;
        stream.getTracks().forEach((t) => t.stop());
        spinRecRef.current = null;
        spinStreamRef.current = null;
      }
      if (spinCancelRef.current) {
        if (viewerAliveRef.current) {
          toast({
            title: "Turntable recording discarded",
            description: "The partial clip was not saved — record again any time.",
          });
        }
      } else {
        const blob = new Blob(chunks, { type: mime });
        if (blob.size === 0) throw new Error("The recorder produced an empty clip.");
        const secs = Math.round(perTurnMs / 1000);
        const fileName = `cryoflow-turntable-${viewerFileSlug(name)}-${viewerFileTimestamp()}.webm`;
        downloadViewerBlob(blob, fileName);
        const footerNote = figureLegend.length
          ? `figure footer + ${figureLegend.length}-map legend burned in · `
          : caption?.trim()
            ? "figure footer (custom caption) burned in · "
            : "figure footer burned in · ";
        toast({
          title: "Turntable video exported",
          description: `${fileName} · one 360° loop (${secs}s @ 30 fps) · ${footerNote}${fmtBytes(blob.size)}`,
        });
      }
      if (viewerAliveRef.current) {
        setSpin("idle");
        setSpinElapsed(0);
      }
    })().catch((err) => {
      if (viewerAliveRef.current) {
        setSpin("idle");
        setSpinElapsed(0);
        toast({
          title: "Turntable recording failed",
          description: err instanceof Error ? err.message : "Unknown recording error.",
          variant: "destructive",
        });
      }
    });
  };

  /* ---------------- cross-section (volume slice) --------------------- */

  // Cross-section: a second VolumeRepresentation3D node on the SAME volume
  // data with the 'slice' type — a density-image plane through the box.
  // The slice shares the contour σ (it tracks the main slider) so the image
  // and the isosurface always agree on where "signal" starts.
  type SliceAxis = "X" | "Y" | "Z";
  const [sliceOn, setSliceOn] = useState(false);
  const [sliceAxis, setSliceAxis] = useState<SliceAxis>("Z");
  const [slicePos, setSlicePos] = useState(0.5);
  const sliceStateRef = useRef({ on: false, axis: "Z" as SliceAxis, pos: 0.5, sigma: 2, sign: 1 as 1 | -1 });
  const slicePending = useRef(false);

  /** build/update the slice node from the latest intent snapshot.
   *
   * Two mol* 5.11 quirks verified live against this exact map (EMPIAR-10017
   * postprocess_masked.mrc):
   *  1. the `relativeX/Y/Z` dimension options are REJECTED by the state's
   *     param normalization — the value silently reverts to the x/0 default
   *     (the plane then sits at the box edge, looking like "nothing
   *     happened"). Absolute grid indices (`{ name: 'z', params: 32 }`)
   *     survive creation AND same-name numeric updates, so we convert the
   *     fraction slider to a grid index ourselves.
   *  2. a PD.Mapped NAME switch (axis change) needs a node RECREATE —
   *     updates only flow within the same option name.
   * Deletes target every cell labelled "Slice" (not a remembered builder
   * ref) so a dev hot-refresh can never strand an orphan plane in the
   * scene. */
  const sliceAxisRef = useRef<SliceAxis | null>(null);
  const commitSlice = async () => {
    const plugin = pluginRef.current;
    const VolumeRepresentation3D = VolumeReprRef.current;
    const IsoValue = IsoValueRef.current;
    if (!plugin || !VolumeRepresentation3D || !IsoValue) throw new Error("not ready");
    const st = sliceStateRef.current;

    // every live slice cell — "Slice" is the provider label mol* assigns
    const sliceCells = (): any[] => {
      const out: any[] = [];
      for (const cell of plugin.state.data.cells.values()) {
        if (cell?.obj?.label === "Slice") out.push(cell);
      }
      return out;
    };

    // grid dimensions come from the volume cell (needed for index math)
    const gridDims = (): number[] | null => {
      for (const cell of plugin.state.data.cells.values()) {
        const dims = (cell?.obj?.data as any)?.grid?.cells?.space?.dimensions;
        if (Array.isArray(dims) && dims.length === 3 && dims.every((d: number) => Number.isFinite(d) && d > 1)) {
          return dims as number[];
        }
      }
      return null;
    };

    const setMainAlpha = async (alpha: number) => {
      if (!reprRef.current) return;
      await plugin
        .build()
        .to(reprRef.current)
        .update(VolumeRepresentation3D, (old: any) => ({
          ...old,
          type: {
            ...old.type,
            params: { ...old.type?.params, alpha },
          },
        }))
        .commit();
    };

    const deleteAllSlices = async () => {
      const cells = sliceCells();
      if (cells.length === 0) return;
      const b = plugin.build();
      for (const c of cells) b.delete(c.transform.ref);
      await b.commit();
      sliceRef.current = null;
      sliceAxisRef.current = null;
    };

    if (!st.on) {
      await deleteAllSlices();
      await setMainAlpha(1); // restore the opaque isosurface
      return;
    }

    const dims = gridDims();
    if (!dims) throw new Error("volume dims unavailable");
    const axisIdx = st.axis === "X" ? 0 : st.axis === "Y" ? 1 : 2;
    const dimName = ["x", "y", "z"][axisIdx];
    const gridIndex = Math.min(dims[axisIdx] - 1, Math.max(0, Math.round(st.pos * (dims[axisIdx] - 1))));

    if (sliceAxisRef.current !== st.axis) {
      await deleteAllSlices(); // name switch ⇒ recreate
    }

    const typeParams = (old: any) => ({
      ...old?.type?.params,
      dimension: { name: dimName, params: gridIndex },
      isoValue: IsoValue.relative(st.sign * st.sigma),
      alpha: 1,
    });

    if (!sliceRef.current) {
      // create WITH the requested axis + position in the initial params
      const b = plugin.build();
      const slice = b
        .to(volRef.current)
        .apply(VolumeRepresentation3D, {
          type: { name: "slice", params: typeParams(undefined) },
          colorTheme: { name: "uniform", params: {} },
          sizeTheme: { name: "uniform", params: {} },
        });
      await b.commit();
      sliceRef.current = slice;
      sliceAxisRef.current = st.axis;
    } else {
      // same-axis update — numeric position/threshold only (supported)
      await plugin
        .build()
        .to(sliceRef.current)
        .update(VolumeRepresentation3D, (old: any) => ({
          ...old,
          type: { ...old.type, params: typeParams(old) },
        }))
        .commit();
    }
    // let the isosurface recede behind the slice plane so both read at once
    await setMainAlpha(0.4);
  };

  const pumpSlice = async () => {
    if (phase !== "ready") return;
    if (slicePending.current) return; // in-flight commit re-checks the snapshot
    slicePending.current = true;
    try {
      for (;;) {
        const seen = { ...sliceStateRef.current };
        await commitSlice();
        const now = sliceStateRef.current;
        if (
          now.on === seen.on && now.axis === seen.axis &&
          now.pos === seen.pos && now.sigma === seen.sigma && now.sign === seen.sign
        ) break; // nothing newer arrived while committing
      }
    } catch (err) {
      console.debug("[molstar] slice update skipped", err);
    } finally {
      slicePending.current = false;
    }
  };

  const applySliceIntent = (patch: Partial<{ on: boolean; axis: SliceAxis; pos: number }>) => {
    sliceStateRef.current = {
      ...sliceStateRef.current,
      ...patch,
      sigma: sigmaRef.current,
      sign: signRef.current,
    };
    if (patch.on !== undefined) setSliceOn(patch.on);
    if (patch.axis !== undefined) setSliceAxis(patch.axis);
    if (patch.pos !== undefined) setSlicePos(patch.pos);
    void pumpSlice();
  };

  // σ / sign changes flow into the live slice too (it shares the threshold)
  useEffect(() => {
    if (!sliceStateRef.current.on) return;
    sliceStateRef.current.sigma = sigma;
    sliceStateRef.current.sign = sign;
    void pumpSlice();
  }, [sigma, sign]);

  /* ---------------- box clipping (crop the isosurface) ---------------- */

  // ChimeraX-style per-axis clip planes applied to the MAIN isosurface
  // node (not a separate scene node): mol* isosurface visuals carry a
  // `clip` prop ({variant, objects: Plane[]}) evaluated per-pixel in the
  // shader, so updating it is a cheap transform-state update — no rebuild.
  // Each axis has a fraction 0…1; 1 keeps the whole box (plane parked just
  // past the far edge), dragging down crops away the +side. `invert` flips
  // all planes to crop from the −side instead.
  const [clipOn, setClipOn] = useState(false);
  const [clipX, setClipX] = useState(1);
  const [clipY, setClipY] = useState(1);
  const [clipZ, setClipZ] = useState(1);
  const [clipInvert, setClipInvert] = useState(false);
  const clipStateRef = useRef({ on: false, x: 1, y: 1, z: 1, invert: false });
  const clipPending = useRef(false);

  /** cartesian box origin + extents (+ basis columns & grid dims) of the
   *  loaded volume, derived from the authoritative
   *  Grid.getGridToCartesianTransform (handles both the 'spacegroup'
   *  transform CCP4 maps carry and plain matrices). Mesh positions are that
   *  matrix applied to voxel indices, so the box runs origin →
   *  origin + extents with extents = basis-column length × dims; the raw
   *  columns let callers walk corners in voxel units (the clip wireframe). */
  const clipBox = (): {
    origin: [number, number, number];
    extents: [number, number, number];
    cols: [[number, number, number], [number, number, number], [number, number, number]];
    dims: number[];
  } | null => {
    const plugin = pluginRef.current;
    const Grid = GridRef.current;
    if (!plugin || !Grid) return null;
    for (const cell of plugin.state.data.cells.values()) {
      const obj = cell?.obj;
      if (obj?.type?.name !== "Volume") continue;
      const grid = obj.data?.grid;
      const dims: number[] | undefined = grid?.cells?.space?.dimensions;
      if (!Array.isArray(dims) || dims.length !== 3) continue;
      try {
        // Mat4 IS a column-major number[16] in mol* — the matrix is the array
        const m = Grid.getGridToCartesianTransform(grid) as number[];
        if (!Array.isArray(m) || m.length < 16) continue;
        const col = (i: number) => [m[i * 4], m[i * 4 + 1], m[i * 4 + 2]] as [number, number, number];
        const cols = [col(0), col(1), col(2)] as [[number, number, number], [number, number, number], [number, number, number]];
        const origin: [number, number, number] = [m[12], m[13], m[14]];
        const extents: [number, number, number] = [
          Math.hypot(...cols[0]) * dims[0],
          Math.hypot(...cols[1]) * dims[1],
          Math.hypot(...cols[2]) * dims[2],
        ];
        if (extents.every((e) => Number.isFinite(e) && e > 0)) return { origin, extents, cols, dims };
      } catch {
        /* fall through */
      }
      return null;
    }
    return null;
  };

  const commitClip = async () => {
    const plugin = pluginRef.current;
    const VolumeRepresentation3D = VolumeReprRef.current;
    if (!plugin || !VolumeRepresentation3D || !reprRef.current) throw new Error("not ready");
    const st = clipStateRef.current;

    const box = st.on ? clipBox() : null;
    // identity 4×4 rotation container (mol* wants rotation as axis+angle)
    const plane = (axisIdx: 0 | 1 | 2, frac: number) => {
      const axisVec: [number, number, number] =
        axisIdx === 0 ? [1, 0, 0] : axisIdx === 1 ? [0, 1, 0] : [0, 0, 1];
      const pos: [number, number, number] = [0, 0, 0];
      if (box) {
        const along = frac * box.extents[axisIdx];
        pos[0] = box.origin[0] + axisVec[0] * along;
        pos[1] = box.origin[1] + axisVec[1] * along;
        pos[2] = box.origin[2] + axisVec[2] * along;
      }
      return {
        type: "plane",
        invert: st.invert,
        position: pos,
        rotation: { axis: axisVec, angle: 0 },
        scale: [1, 1, 1] as [number, number, number],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as number[],
      };
    };

    const objects = !st.on || !box
      ? []
      : ([
          [0, st.x],
          [1, st.y],
          [2, st.z],
        ] as const)
          // frac 1 ≡ no clip on this axis — leave the plane out entirely
          .filter(([, f]) => f < 0.999)
          .map(([axisIdx, f]) => plane(axisIdx as 0 | 1 | 2, f));

    await plugin
      .build()
      .to(reprRef.current)
      .update(VolumeRepresentation3D, (old: any) => ({
        ...old,
        type: {
          ...old.type,
          params: {
            ...old.type?.params,
            clip: { variant: "pixel", objects },
          },
        },
      }))
      .commit();
  };

  const pumpClip = async () => {
    if (phase !== "ready") return;
    if (clipPending.current) return;
    clipPending.current = true;
    try {
      for (;;) {
        const seen = { ...clipStateRef.current };
        await commitClip();
        const now = clipStateRef.current;
        if (
          now.on === seen.on && now.invert === seen.invert &&
          now.x === seen.x && now.y === seen.y && now.z === seen.z
        ) break;
      }
    } catch (err) {
      console.debug("[molstar] clip update skipped", err);
    } finally {
      clipPending.current = false;
    }
  };

  const applyClipIntent = (patch: Partial<{ on: boolean; x: number; y: number; z: number; invert: boolean }>) => {
    clipStateRef.current = { ...clipStateRef.current, ...patch };
    if (patch.on !== undefined) setClipOn(patch.on);
    if (patch.invert !== undefined) setClipInvert(patch.invert);
    if (patch.x !== undefined) setClipX(patch.x);
    if (patch.y !== undefined) setClipY(patch.y);
    if (patch.z !== undefined) setClipZ(patch.z);
    void pumpClip();
  };

  /* ---------------- clip region wireframe (SVG overlay) --------------- */

  // The clip planes live in the isosurface's shader props — invisible them-
  // selves, so the cropped region's boundary is drawn as a camera-projected
  // 12-edge box outline in an SVG overlay above the canvas. Zero mol* state-
  // tree involvement: each redraw projects the kept-region corners through
  // the LIVE camera (projectionView, column-major) into container pixel
  // space — orbiting/zooming re-fires via camera.changed.
  const guidePathRef = useRef<SVGPathElement | null>(null);
  // per-axis movable-face outlines (the 4 edges of the kept box that lie ON
  // the clip plane) + invisible fat hit paths on top of them — dragging a
  // face directly manipulates the corresponding X/Y/Z clip slider
  const facePathRefs = useRef<(SVGPathElement | null)[]>([null, null, null]);
  const hitPathRefs = useRef<(SVGPathElement | null)[]>([null, null, null]);
  // face-center affordance dots — a small grabbable-looking marker at each
  // movable face's centroid (visual only, like the face outlines)
  const dotRefs = useRef<(SVGCircleElement | null)[]>([null, null, null]);
  // screen-space drag geometry per axis: full-span direction vector (px) and
  // |dir|², captured from the LIVE projection each redraw so a drag mid-orbit
  // still maps correctly. null = axis not currently draggable (degenerate
  // projection, e.g. box edge-on or a corner behind the camera)
  const dragGeomRef = useRef<({ dx: number; dy: number; len2: number } | null)[] | null>(null);
  const dragRef = useRef<{ axis: 0 | 1 | 2; startX: number; startY: number; startFrac: number } | null>(null);
  const [grabAxis, setGrabAxis] = useState<0 | 1 | 2 | null>(null);
  const [hoverAxis, setHoverAxis] = useState<0 | 1 | 2 | null>(null);

  const drawClipGuide = () => {
    const path = guidePathRef.current;
    const camera = pluginRef.current?.canvas3d?.camera;
    if (!path || !camera) return;
    if (!clipStateRef.current.on) {
      path.setAttribute("d", "");
      return;
    }
    const box = clipBox();
    const pv = camera.projectionView as number[] | undefined;
    const w = containerRef.current?.clientWidth ?? 0;
    const h = containerRef.current?.clientHeight ?? 0;
    if (!box || !Array.isArray(pv) || pv.length < 16 || w < 2 || h < 2) {
      path.setAttribute("d", "");
      return;
    }
    const st = clipStateRef.current;
    const fracs = [st.x, st.y, st.z];
    const lo: number[] = [];
    const hi: number[] = [];
    for (let i = 0; i < 3; i++) {
      const fd = fracs[i] * box.dims[i];
      lo.push(st.invert ? fd : 0);
      hi.push(st.invert ? box.dims[i] : fd);
    }
    // 8 corners of the KEPT region in world space (voxel units × basis cols)
    const corner = (a: number, b: number, c: number): [number, number, number] => [
      box.origin[0] + a * box.cols[0][0] + b * box.cols[1][0] + c * box.cols[2][0],
      box.origin[1] + a * box.cols[0][1] + b * box.cols[1][1] + c * box.cols[2][1],
      box.origin[2] + a * box.cols[0][2] + b * box.cols[1][2] + c * box.cols[2][2],
    ];
    const pts = [
      corner(lo[0], lo[1], lo[2]), corner(hi[0], lo[1], lo[2]),
      corner(hi[0], hi[1], lo[2]), corner(lo[0], hi[1], lo[2]),
      corner(lo[0], lo[1], hi[2]), corner(hi[0], lo[1], hi[2]),
      corner(hi[0], hi[1], hi[2]), corner(lo[0], hi[1], hi[2]),
    ];
    const edges: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 0], // −Z face
      [4, 5], [5, 6], [6, 7], [7, 4], // +Z face
      [0, 4], [1, 5], [2, 6], [3, 7], // pillars
    ];
    // project through the combined view-projection; edges with an endpoint
    // behind the camera (w ≤ 0) would mirror across the screen — drop them
    const sx: number[] = [];
    const sy: number[] = [];
    const ok: boolean[] = [];
    for (const p of pts) {
      const cx = pv[0] * p[0] + pv[4] * p[1] + pv[8] * p[2] + pv[12];
      const cy = pv[1] * p[0] + pv[5] * p[1] + pv[9] * p[2] + pv[13];
      const cw = pv[3] * p[0] + pv[7] * p[1] + pv[11] * p[2] + pv[15];
      const good = Number.isFinite(cw) && cw > 0.001;
      ok.push(good);
      sx.push(good ? ((cx / cw) + 1) / 2 * w : 0);
      sy.push(good ? (1 - (cy / cw)) / 2 * h : 0);
    }
    let d = "";
    for (const [a, b] of edges) {
      if (!ok[a] || !ok[b]) continue;
      d += `M${sx[a].toFixed(1)} ${sy[a].toFixed(1)}L${sx[b].toFixed(1)} ${sy[b].toFixed(1)}`;
    }
    path.setAttribute("d", d);

    // movable faces + drag geometry — the kept box's face lying ON each clip
    // plane is the grab target; dragging it in screen space maps onto the
    // axis direction through the same projection (direct manipulation)
    for (let i = 0; i < 3; i++) {
      let fd = "";
      let cxSum = 0;
      let cySum = 0;
      let n = 0;
      for (const [a, b] of FACE_EDGES[i][st.invert ? 1 : 0]) {
        if (!ok[a] || !ok[b]) continue;
        fd += `M${sx[a].toFixed(1)} ${sy[a].toFixed(1)}L${sx[b].toFixed(1)} ${sy[b].toFixed(1)}`;
        cxSum += sx[a] + sx[b];
        cySum += sy[a] + sy[b];
        n += 2;
      }
      const face = facePathRefs.current[i];
      if (face) face.setAttribute("d", fd);
      const hit = hitPathRefs.current[i];
      if (hit) hit.setAttribute("d", fd);
      const dot = dotRefs.current[i];
      if (dot) {
        // centroid of the projected face corners; hidden while the face is
        // degenerate (edges dropped behind the camera)
        const show = n === 8 && fd !== ""; // 4 edges × 2 endpoints
        dot.setAttribute("cx", show ? (cxSum / n).toFixed(1) : "0");
        dot.setAttribute("cy", show ? (cySum / n).toFixed(1) : "0");
        dot.setAttribute("r", show ? "3.5" : "0");
      }
    }
    // per-axis full-span screen vector: voxel mid-plane endpoints along the
    // axis, projected — the drag delta projects onto this vector to yield a
    // fraction of the full box extent (same units as the sliders)
    const mid = (j: number) => box.dims[j] / 2;
    const axisDir = (i: 0 | 1 | 2): { dx: number; dy: number; len2: number } | null => {
      const aV = [mid(0), mid(1), mid(2)];
      const bV = [...aV];
      bV[i] = box.dims[i];
      const proj = (v: number[]) => {
        const cx = pv[0] * v[0] + pv[4] * v[1] + pv[8] * v[2] + pv[12];
        const cy = pv[1] * v[0] + pv[5] * v[1] + pv[9] * v[2] + pv[13];
        const cw = pv[3] * v[0] + pv[7] * v[1] + pv[11] * v[2] + pv[15];
        if (!Number.isFinite(cw) || cw <= 0.001) return null;
        return [((cx / cw) + 1) / 2 * w, (1 - (cy / cw)) / 2 * h] as [number, number];
      };
      const a = proj(aV);
      const b = proj(bV);
      if (!a || !b) return null;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      return len2 > 25 ? { dx, dy, len2 } : null; // <5 px span → not draggable
    };
    dragGeomRef.current = clipStateRef.current.on
      ? [axisDir(0), axisDir(1), axisDir(2)]
      : null;
  };

  /* -------- direct manipulation: drag a wireframe face = drag slider ----- */

  const onFacePointerDown = (axis: 0 | 1 | 2, e: React.PointerEvent<SVGPathElement>) => {
    if (e.button !== 0) return;
    const geom = dragGeomRef.current?.[axis];
    if (!geom) return; // degenerate projection — sliders still work
    e.preventDefault();
    e.stopPropagation();
    // capture routes real-pointer move/up to this element even outside its
    // bounds; a synthetic event's pointerId has no active pointer, so the
    // DOM call throws — the drag itself still works (move/up land here
    // anyway when dispatched on the element)
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer — ignore */
    }
    dragRef.current = {
      axis,
      startX: e.clientX,
      startY: e.clientY,
      startFrac: axis === 0 ? clipStateRef.current.x : axis === 1 ? clipStateRef.current.y : clipStateRef.current.z,
    };
    setGrabAxis(axis);
  };

  const onFacePointerMove = (e: React.PointerEvent<SVGPathElement>) => {
    const drag = dragRef.current;
    const geom = dragGeomRef.current?.[drag?.axis ?? 0];
    if (!drag || !geom) return;
    const dot = (e.clientX - drag.startX) * geom.dx + (e.clientY - drag.startY) * geom.dy;
    const frac = Math.min(1, Math.max(0.02, drag.startFrac + dot / geom.len2));
    applyClipIntent(
      drag.axis === 0 ? { x: frac } : drag.axis === 1 ? { y: frac } : { z: frac },
    );
  };

  const endFaceDrag = (e: React.PointerEvent<SVGPathElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setGrabAxis(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  // orbit/zoom/pan → reproject (camera.changed covers every mutation,
  // including drags from mol*'s own controls)
  useEffect(() => {
    if (phase !== "ready") return;
    const camera = pluginRef.current?.canvas3d?.camera;
    if (!camera?.changed) return;
    const sub = camera.changed.subscribe(() => drawClipGuide());
    return () => {
      try {
        sub.unsubscribe();
      } catch {
        /* cosmetic */
      }
    };
  }, [phase]);

  // slider/toggle intent → immediate guide update (the shader clip itself
  // lands asynchronously through pumpClip; the frame previews the intent)
  useEffect(() => {
    if (phase !== "ready" || !clipOn) return;
    drawClipGuide();
  }, [phase, clipOn, clipX, clipY, clipZ, clipInvert]);

  const absolute = stats ? stats.mean + sign * stats.sigma * sigma : null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border bg-white dark:bg-zinc-950">
      <div ref={containerRef} className="h-full w-full" data-molstar-container="true" />

      {/* clip region wireframe — projected live from the mol* camera into
          this overlay. The three movable faces are individually grabbable:
          dragging one maps the pointer delta onto the axis' screen-space
          span (same 0–1 units as the panel sliders). Root SVG is
          pointer-events-none so orbit/zoom passes through everywhere
          except the fat hit strokes. */}
      {clipOn && phase === "ready" && (
        <svg
          className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
          aria-hidden="true"
          data-clip-guide="true"
        >
          <path
            ref={guidePathRef}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            strokeDasharray="7 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
            vectorEffect="non-scaling-stroke"
          />
          {/* movable faces — solid violet, emphasized on hover/grab.
              Visual only: pointer-events none so they never steal events
              from the fat hit strokes (or the canvas) beneath/around them */}
          {([0, 1, 2] as const).map((ax) => (
            <path
              key={ax}
              ref={(el) => {
                facePathRefs.current[ax] = el;
              }}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth={hoverAxis === ax || grabAxis === ax ? 3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={hoverAxis === ax || grabAxis === ax ? 1 : 0.75}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: "none" }}
            />
          ))}
          {/* face-center affordance dots — visual only */}
          {([0, 1, 2] as const).map((ax) => (
            <circle
              key={ax}
              ref={(el) => {
                dotRefs.current[ax] = el;
              }}
              fill="#8b5cf6"
              opacity={0.9}
              stroke="white"
              strokeWidth={1}
              style={{ pointerEvents: "none" }}
            />
          ))}
          {/* invisible fat hit strokes — the actual drag targets */}
          {([0, 1, 2] as const).map((ax) => (
            <path
              key={ax}
              ref={(el) => {
                hitPathRefs.current[ax] = el;
              }}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-stroke cursor-grab touch-none"
              style={{ pointerEvents: "stroke", cursor: grabAxis === ax ? "grabbing" : "grab", touchAction: "none" }}
              onPointerDown={(e) => onFacePointerDown(ax, e)}
              onPointerMove={onFacePointerMove}
              onPointerUp={endFaceDrag}
              onPointerCancel={endFaceDrag}
              onPointerEnter={() => !dragRef.current && setHoverAxis(ax)}
              onPointerLeave={() => setHoverAxis((h) => (h === ax ? null : h))}
            >
              <title>{["X", "Y", "Z"][ax]} clip face — drag to move the plane (sliders in the panel do the same)</title>
            </path>
          ))}
        </svg>
      )}

      {/* contour control bar */}
      {phase === "ready" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-3">
          <div className="pointer-events-auto w-full max-w-lg rounded-2xl border bg-card/90 px-4 py-3 shadow-lg backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-2">
              <Mountain className="size-3.5 shrink-0 text-teal-600" aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Contour
              </span>
              <span
                className={cn(
                  "whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums",
                  sign > 0
                    ? "bg-teal-600/10 text-teal-700 dark:text-teal-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                )}
                title={
                  absolute != null
                    ? `threshold = mean ${sign > 0 ? "+" : "−"} σ·${sigma.toFixed(2)}`
                    : undefined
                }
              >
                {sign > 0 ? "" : "−"}
                {sigma.toFixed(2)} σ
              </span>
              {absolute != null ? (
                <span className="font-mono text-[10px] text-muted-foreground">
                  ≈ {absolute.toFixed(4)}
                </span>
              ) : null}
              {/* presets — wrap allowed: slice/clip toggles joined the row and
                  a no-wrap row overflowed the pill on narrow viewers */}
              <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSigma(p)}
                    aria-label={`Set contour to ${p} sigma`}
                    className={
                      "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums transition-colors " +
                      (Math.abs(sigma - p) < 0.001
                        ? "bg-teal-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-teal-600/15 hover:text-teal-700 dark:hover:text-teal-300")
                    }
                  >
                    {p}σ
                  </button>
                ))}
                {/* density sign flip — inverted maps need the negative side */}
                <button
                  type="button"
                  onClick={() => setSign((s) => (s > 0 ? -1 : 1))}
                  aria-pressed={sign < 0}
                  aria-label="Flip contour to the negative density side"
                  title={
                    sign > 0
                      ? "Contour on positive density — flip if the map is inverted (signal below the mean)"
                      : "Contour on NEGATIVE density — flip back to positive"
                  }
                  className={
                    "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors " +
                    (sign < 0
                      ? "bg-amber-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-amber-500/20 hover:text-amber-700 dark:hover:text-amber-300")
                  }
                >
                  −ρ / +ρ
                </button>
                {/* cross-section toggle — density-image plane through the box */}
                <button
                  type="button"
                  onClick={() => applySliceIntent({ on: !sliceStateRef.current.on })}
                  aria-pressed={sliceOn}
                  aria-label="Toggle cross-section plane"
                  title={
                    sliceOn
                      ? "Hide the cross-section plane"
                      : "Show a cross-section — a density slice through the box (shares the contour level)"
                  }
                  className={
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors " +
                    (sliceOn
                      ? "bg-cyan-600 text-white"
                      : "bg-muted text-muted-foreground hover:bg-cyan-600/15 hover:text-cyan-700 dark:hover:text-cyan-300")
                  }
                >
                  <ScanLine className="h-3 w-3" aria-hidden="true" />
                  Slice
                </button>
                {/* box-clip toggle — crop the isosurface per axis */}
                <button
                  type="button"
                  onClick={() => applyClipIntent({ on: !clipStateRef.current.on })}
                  aria-pressed={clipOn}
                  aria-label="Toggle box clipping"
                  title={
                    clipOn
                      ? "Disable box clipping — show the full isosurface again"
                      : "Clip the isosurface — drag the X/Y/Z sliders to crop into the box (ChimeraX-style clip planes)"
                  }
                  className={
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors " +
                    (clipOn
                      ? "bg-violet-600 text-white"
                      : "bg-muted text-muted-foreground hover:bg-violet-600/15 hover:text-violet-700 dark:hover:text-violet-300")
                  }
                >
                  <BoxSelect className="h-3 w-3" aria-hidden="true" />
                  Clip
                </button>
              </div>
            </div>
            <Slider
              value={[sigma]}
              min={SIGMA_MIN}
              max={SIGMA_MAX}
              step={0.05}
              onValueChange={(v) => setSigma(v[0] ?? 2)}
              aria-label="Isosurface contour level in sigma"
              className="mt-2.5"
            />
            {/* cross-section row — axis pick + plane position (only when on) */}
            {sliceOn && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-cyan-600/25 bg-cyan-600/5 px-2.5 py-2">
                <ScanLine className="size-3.5 shrink-0 text-cyan-600" aria-hidden="true" />
                <div className="flex items-center gap-0.5" role="group" aria-label="Cross-section axis">
                  {(["X", "Y", "Z"] as SliceAxis[]).map((ax) => (
                    <button
                      key={ax}
                      type="button"
                      onClick={() => applySliceIntent({ axis: ax })}
                      aria-pressed={sliceAxis === ax}
                      title={`Slice perpendicular to the ${ax} axis`}
                      className={
                        "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors " +
                        (sliceAxis === ax
                          ? "bg-cyan-600 text-white"
                          : "bg-muted text-muted-foreground hover:bg-cyan-600/15 hover:text-cyan-700 dark:hover:text-cyan-300")
                      }
                    >
                      {ax}
                    </button>
                  ))}
                </div>
                <Slider
                  value={[slicePos]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(v) => applySliceIntent({ pos: v[0] ?? 0.5 })}
                  aria-label="Cross-section plane position (fraction of the box)"
                  className="flex-1"
                />
                <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {Math.round(slicePos * 100)}%
                </span>
              </div>
            )}
            {/* clip rows — one slider per axis + side flip (only when on) */}
            {clipOn && (
              <div className="mt-2.5 space-y-1.5 rounded-lg border border-violet-600/25 bg-violet-600/5 px-2.5 py-2">
                {(
                  [
                    ["X", clipX, (v: number) => applyClipIntent({ x: v })] as const,
                    ["Y", clipY, (v: number) => applyClipIntent({ y: v })] as const,
                    ["Z", clipZ, (v: number) => applyClipIntent({ z: v })] as const,
                  ] as const
                ).map(([ax, val, set]) => (
                  <div key={ax} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyClipIntent({ [ax.toLowerCase()]: 1 } as Partial<{ x: number; y: number; z: number }> )}
                      title={`Reset the ${ax} clip plane (1 = unclipped)`}
                      aria-label={`Reset ${ax} clip`}
                      className="w-4 shrink-0 rounded bg-violet-600/90 px-1 py-0.5 font-mono text-[10px] font-bold text-white transition-opacity hover:opacity-80"
                    >
                      {ax}
                    </button>
                    <Slider
                      value={[val]}
                      min={0.02}
                      max={1}
                      step={0.01}
                      onValueChange={(v) => set(v[0] ?? 1)}
                      aria-label={`Clip position along the ${ax} axis`}
                      className="flex-1"
                    />
                    <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {val >= 0.999 ? "—" : `${Math.round(val * 100)}%`}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => applyClipIntent({ invert: !clipStateRef.current.invert })}
                    aria-pressed={clipInvert}
                    title={
                      clipInvert
                        ? "Planes crop from the − side — flip back to crop the + side"
                        : "Flip every plane to crop from the − side instead of the + side"
                    }
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors " +
                      (clipInvert
                        ? "bg-violet-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-violet-600/15 hover:text-violet-700 dark:hover:text-violet-300")
                    }
                  >
                    flip side
                  </button>
                  <button
                    type="button"
                    onClick={() => applyClipIntent({ x: 1, y: 1, z: 1 })}
                    className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-violet-600/15 hover:text-violet-700 dark:hover:text-violet-300"
                  >
                    reset all
                  </button>
                </div>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="font-mono">{SIGMA_MIN}σ</span>
              <span className="hidden truncate sm:inline">
                {invertedNote
                  ? "inverted map detected — contouring the negative side"
                  : sliceOn
                    ? "cross-section shares the contour level — drag the slider to sweep the box"
                    : clipOn
                      ? "clip crops into the box — drag the highlighted faces or the X/Y/Z sliders; flip side crops the other half"
                      : "drag rotate · scroll zoom · right-drag pan"}
              </span>
              <span className="font-mono">{SIGMA_MAX}σ</span>
            </div>
          </div>
        </div>
      )}

      {/* turntable recording badge — DOM overlay only, never enters the
          captured video; cancel discards the partial clip */}
      {spin === "recording" && (
        <div
          className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md bg-red-600/90 px-2 py-1 text-[10px] font-semibold text-white shadow-sm"
          data-testid="turntable-rec-badge"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-2 animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-white" />
          </span>
          <span className="font-mono tabular-nums">
            REC {Math.floor(spinElapsed / 60)}:{String(spinElapsed % 60).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => {
              spinCancelRef.current = true;
            }}
            className="ml-0.5 rounded px-1 text-[9px] font-medium transition-colors hover:bg-white/20"
            aria-label="Cancel the turntable recording (partial clip is discarded)"
          >
            cancel
          </button>
        </div>
      )}

      {/* corner actions */}
      {phase === "ready" ? (
        <div className="absolute right-3 top-3 z-10 flex gap-1.5">
          {/* overlay maps (compare) — layered volumes from the same job */}
          <Popover onOpenChange={(open) => open && loadMapChoices()}>
            <PopoverTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="relative size-8 rounded-lg shadow-sm transition-colors"
                aria-label={`Overlay maps — ${overlays.length} active`}
                title="Overlay maps — compare other volumes from this job (half-maps, masked, classes)"
              >
                <Layers className="size-4" />
                {overlays.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold leading-none text-primary-foreground shadow-sm">
                    {overlays.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2" data-canvas-ui="layers-popover">
              <p className="px-1 pb-1 text-[11px] font-semibold">Overlay maps</p>
              <p className="px-1 pb-1.5 text-[10px] leading-tight text-muted-foreground">
                Layer other volumes from this job over the main map — half-maps, masked maps, classes.
              </p>

              {/* active overlays */}
              {overlays.length > 0 && (
                <div className="mb-1 space-y-1">
                  {overlays.map((o) => (
                    <div
                      key={o.path}
                      className="rounded-md border bg-muted/40 px-2 py-1.5"
                      data-testid={`overlay-row-${o.path}`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={cn(
                            "size-2.5 shrink-0 rounded-full ring-1 ring-black/10 transition-transform",
                            colorPickerFor === o.path && "scale-125 ring-2 ring-ring ring-offset-1 ring-offset-card"
                          )}
                          style={{ backgroundColor: o.color }}
                          onClick={() =>
                            setColorPickerFor((p) => (p === o.path ? null : o.path))
                          }
                          aria-label={`Color for ${o.name} — open swatches`}
                          aria-expanded={colorPickerFor === o.path}
                          title="Change this map's color"
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium" title={o.path}>
                          {o.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => void removeOverlay(o.path)}
                          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remove overlay ${o.name}`}
                          title="Remove overlay"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      {colorPickerFor === o.path && (
                        <div className="mt-1.5 space-y-1.5 pl-4.5">
                          <div
                            className="flex items-center gap-1.5"
                            data-testid={`swatches-${o.path}`}
                            role="radiogroup"
                            aria-label={`Surface color for ${o.name}`}
                          >
                            {SWATCH_COLORS.map((c) => {
                              const active = c.toLowerCase() === o.color.toLowerCase();
                              return (
                                <button
                                  key={c}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  aria-label={`Set color ${c}`}
                                  onClick={() => {
                                    void setOverlayColor(o.path, c);
                                    setColorPickerFor(null);
                                  }}
                                  className={cn(
                                    "size-4 rounded-full ring-1 ring-black/15 transition-transform hover:scale-110",
                                    active && "ring-2 ring-ring ring-offset-1 ring-offset-card"
                                  )}
                                  style={{ backgroundColor: c }}
                                />
                              );
                            })}
                          </div>
                          {/* free hex entry — live-applies once a full
                              #rrggbb is typed; Enter confirms, blur reverts
                              an invalid draft (styled destructive) */}
                          <div
                            className="flex items-center gap-2"
                            data-testid={`hex-row-${o.path}`}
                          >
                            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                              custom
                            </span>
                            <HexSwatchInput
                              color={o.color}
                              onCommit={(hex) => void setOverlayColor(o.path, hex)}
                            />
                          </div>
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-2 pl-4.5">
                        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                          opacity
                        </span>
                        <Slider
                          value={[o.alpha]}
                          min={0.15}
                          max={1}
                          step={0.05}
                          onValueChange={([v]) => setOverlayAlpha(o.path, v)}
                          className="h-3 flex-1"
                          aria-label={`Opacity for ${o.name}`}
                        />
                        <span className="w-7 text-right font-mono text-[9px] text-muted-foreground">
                          {Math.round(o.alpha * 100)}%
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 pl-4.5">
                        <span
                          className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
                          title="Nudge this map's contour away from the shared σ slider — class maps have different statistics"
                        >
                          σ nudge
                        </span>
                        <Slider
                          value={[o.sigmaOffset]}
                          min={-1.5}
                          max={1.5}
                          step={0.05}
                          onValueChange={([v]) => setOverlaySigma(o.path, v)}
                          className="h-3 flex-1"
                          aria-label={`Sigma offset for ${o.name}`}
                        />
                        <span
                          className={cn(
                            "w-9 text-right font-mono text-[9px]",
                            o.sigmaOffset === 0 ? "text-muted-foreground" : "font-bold text-primary"
                          )}
                        >
                          {o.sigmaOffset >= 0 ? "+" : "−"}
                          {Math.abs(o.sigmaOffset).toFixed(2)}σ
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* available candidates */}
              <div className="border-t pt-1.5">
                <p className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {overlays.length > 0 ? "More maps in this job" : "Maps in this job"}
                </p>
                {choicesLoading || mapChoices === null ? (
                  <div className="flex items-center gap-2 px-1.5 py-2 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Scanning job outputs…
                  </div>
                ) : mapChoices.length === 0 ? (
                  <p className="px-1.5 py-2 text-[11px] leading-tight text-muted-foreground">
                    No other maps in this job's outputs yet — half-maps, masked maps or class maps
                    appear here once the job (or a follow-up) produces them.
                  </p>
                ) : (
                  <div className="max-h-44 space-y-0.5 overflow-y-auto">
                    {mapChoices.map((c) => {
                      const active = overlays.some((o) => o.path === c.path);
                      const busy = overlayBusy === c.path;
                      return (
                        <button
                          key={c.path}
                          type="button"
                          disabled={active || busy || overlayBusy !== null}
                          onClick={() => void addOverlay(c)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors",
                            active ? "opacity-50" : "hover:bg-muted",
                            "disabled:cursor-default"
                          )}
                          data-testid={`map-choice-${c.path}`}
                          title={active ? "Already overlaid" : c.path}
                        >
                          {busy ? (
                            <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                          ) : (
                            <Plus
                              className={cn(
                                "size-3.5 shrink-0",
                                active ? "text-emerald-500" : "text-muted-foreground"
                              )}
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium leading-tight">
                              {c.label ?? c.name.replace(/\.[^.]+$/, "")}
                            </span>
                            <span className="block truncate font-mono text-[9px] leading-tight text-muted-foreground">
                              {c.name} · {fmtBytes(c.size)}
                            </span>
                          </span>
                          {active && <Check className="size-3.5 shrink-0 text-emerald-500" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="border-t px-1 pb-0.5 pt-1.5 text-[10px] leading-tight text-muted-foreground">
                Overlays follow the contour σ slider — half-maps track the main map exactly;
                nudge σ per map when statistics differ. Exports list active overlays as a
                color legend in the figure footer.
              </p>
            </PopoverContent>
          </Popover>
          {/* figure export chip — resolution + caption, both persist per
              browser; the Camera capture and the figure footer follow them
              instantly */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  "size-8 rounded-lg font-mono text-[10px] font-bold shadow-sm transition-colors",
                  caption.trim() && "border-primary/40 text-primary"
                )}
                aria-label={`Figure export: ${exportScale}×${caption.trim() ? ", custom caption set" : ""} — open to change`}
                title="Figure export — resolution (1×/2×/3×) and custom caption"
              >
                {exportScale}×
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2" data-canvas-ui="export-scale-popover">
              <p className="px-1 pb-1 text-[11px] font-semibold">Export resolution</p>
              <div role="radiogroup" aria-label="Export resolution">
                {(
                  [
                    [1, "Native", "What you see is what you get — fastest"],
                    [2, "Supersampled", "2× the pixels — sharper figures on any display"],
                    [3, "Print", "3× — publications and deep zoom-ins, larger file"],
                  ] as const
                ).map(([v, label, desc]) => {
                  const active = exportScale === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`export-scale-${v}`}
                      onClick={() => pickExportScale(v)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                        active ? "bg-primary/10" : "hover:bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                          active ? "border-primary" : "border-muted-foreground/40"
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full transition-transform",
                            active ? "scale-100 bg-primary" : "scale-0 bg-transparent"
                          )}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-xs font-medium">
                          {label}
                          <span className="font-mono text-[10px] text-muted-foreground">{v}×</span>
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                          {desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* custom figure caption — replaces the default "CryoFlow —
                  <map>" footer title; persists per browser */}
              <div className="border-t px-1 pb-1 pt-1.5">
                <label
                  htmlFor="figure-caption"
                  className="flex items-center justify-between text-[11px] font-semibold"
                >
                  Figure caption
                  {caption.trim() && (
                    <button
                      type="button"
                      onClick={() => editCaption("")}
                      className="flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Reset caption to the default"
                      data-testid="caption-reset"
                    >
                      <X className="size-3" />
                      reset
                    </button>
                  )}
                </label>
                <input
                  id="figure-caption"
                  data-testid="figure-caption-input"
                  value={caption}
                  maxLength={CAPTION_MAX}
                  onChange={(e) => editCaption(e.target.value)}
                  placeholder={`Default: CryoFlow — ${name}`}
                  className="mt-1 h-7 w-full rounded-md border bg-background px-2 text-xs outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
                <p className="mt-0.5 text-[9px] leading-tight text-muted-foreground">
                  {caption.trim()
                    ? "Footer title uses your caption."
                    : "Optional — names the figure in the exported footer."}
                </p>
              </div>
              <p className="border-t px-1 pb-0.5 pt-1.5 text-[10px] leading-tight text-muted-foreground">
                Both apply to the next capture; the figure footer annotates them.
              </p>
            </PopoverContent>
          </Popover>
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "size-8 rounded-lg shadow-sm transition-colors",
              shot === "done" &&
                "border-emerald-500/40 text-emerald-600 hover:text-emerald-600 dark:text-emerald-400"
            )}
            onClick={() => runCapture("copy")}
            disabled={shot === "busy"}
            aria-label="Copy the current 3D figure to the clipboard"
            title={canCopyImageToClipboard() ? "Copy figure to clipboard — same composed PNG with footer, paste into slides/docs/chats" : "Copy figure to clipboard (falls back to download in this browser)"}
          >
            {shot === "busy" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : shot === "done" ? (
              <Check className="size-4" />
            ) : (
              <ClipboardCopy className="size-4" />
            )}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "size-8 rounded-lg shadow-sm transition-colors",
              shot === "done" &&
                "border-emerald-500/40 text-emerald-600 hover:text-emerald-600 dark:text-emerald-400"
            )}
            onClick={captureView}
            disabled={shot === "busy"}
            aria-label="Export the current 3D view as PNG"
            title={`Export view as PNG — ${exportScale}× ${exportScale > 1 ? "supersampled" : "native"}; contour / slice / clip state is annotated in the figure footer`}
          >
            {shot === "busy" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : shot === "done" ? (
              <Check className="size-4" />
            ) : (
              <Camera className="size-4" />
            )}
          </Button>
          {/* turntable video — one full 360° camera loop recorded off the
              live canvas as WebM (MediaRecorder + mol* camera-spin anim) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  "size-8 rounded-lg shadow-sm transition-colors",
                  spin === "recording" &&
                    "border-red-500/40 text-red-600 hover:text-red-600 dark:text-red-400"
                )}
                disabled={spin === "recording"}
                aria-label="Record a turntable video of the current view"
                title="Turntable video — record one full 360° rotation of the current view as a WebM clip"
              >
                {spin === "recording" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Orbit className="size-4" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2" data-canvas-ui="turntable-popover">
              <p className="px-1 pb-1 text-[11px] font-semibold">Turntable video</p>
              <p className="px-1 pb-1.5 text-[10px] leading-tight text-muted-foreground">
                Records one full 360° rotation around the current view as a .webm clip —
                the camera returns to where it started.
              </p>
              <div className="space-y-1">
                {[
                  { ms: 12000, label: "Slow", desc: "12 s / turn — smoothest" },
                  { ms: 8000, label: "Normal", desc: "8 s / turn — balanced" },
                  { ms: 5000, label: "Quick", desc: "5 s / turn — preview" },
                ].map((s) => {
                  const active = spinSpeedRef.current === s.ms;
                  return (
                    <button
                      key={s.ms}
                      type="button"
                      data-testid={`turntable-speed-${s.ms}`}
                      onClick={() => {
                        spinSpeedRef.current = s.ms;
                        try {
                          localStorage.setItem(SPIN_SPEED_KEY, String(s.ms));
                        } catch {
                          /* private mode — choice lives for this visit */
                        }
                        setSpinSpeedTick((t) => t + 1);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-[11px] transition-colors",
                        active
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "bg-card text-foreground/90 hover:bg-muted"
                      )}
                    >
                      <span className="font-medium">{s.label}</span>
                      <span className="text-[9px] text-muted-foreground">{s.desc}</span>
                    </button>
                  );
                })}
              </div>
              <Button
                size="sm"
                className="mt-1.5 w-full gap-1.5"
                onClick={() => recordTurntable(spinSpeedRef.current)}
              >
                <Video className="size-3.5" />
                Record 360° loop
              </Button>
              <p className="border-t px-1 pb-0.5 pt-1.5 text-[10px] leading-tight text-muted-foreground">
                30 fps · WebM (VP9/VP8) · figure footer with caption + overlay legend burned
                in · your speed choice is remembered.
              </p>
            </PopoverContent>
          </Popover>
          <Button
            variant="secondary"
            size="icon"
            className="size-8 rounded-lg shadow-sm"
            onClick={resetCamera}
            aria-label="Reset camera"
            title="Reset camera"
          >
            <RotateCw className="size-4" />
          </Button>
          {/* standard view orientations — swing to an axis without losing
              the current zoom; the grid doubles as a crash course in the
              box's shape (anisotropy reads instantly along each axis) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="size-8 rounded-lg shadow-sm"
                aria-label="Standard view orientations — front, back, left, right, top, bottom"
                title="Standard views — axis-aligned orientations, zoom preserved"
              >
                <Axis3d className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-2" data-canvas-ui="view-presets">
              <p className="px-1 pb-1 text-[11px] font-semibold">Standard views</p>
              <div className="grid grid-cols-3 gap-1">
                {VIEW_PRESETS.map((p, i) => (
                  <button
                    key={p.key}
                    type="button"
                    data-testid={`view-preset-${p.key}`}
                    onClick={() => applyViewPreset(p.dir, p.up)}
                    title={`${p.label} view (key ${i + 1})`}
                    className="relative rounded-md border bg-card px-1 py-1.5 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    {p.label}
                    <span
                      aria-hidden="true"
                      className="absolute right-1 top-0.5 font-mono text-[8px] leading-none text-muted-foreground/60"
                    >
                      {i + 1}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={resetCamera}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-1 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RotateCw className="size-3" />
                Default ¾ view
                <span aria-hidden="true" className="font-mono text-[8px] text-muted-foreground/60">
                  0
                </span>
              </button>
              <p className="border-t px-1 pb-0.5 pt-1.5 text-[10px] leading-tight text-muted-foreground">
                Keys 1–6 / 0 work too. Swing the camera to an axis — zoom stays put.
              </p>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      {phase === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2.5 rounded-2xl border bg-background px-5 py-4 text-xs text-muted-foreground shadow-sm">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-teal-600" aria-hidden="true" />
              <span aria-live="polite">{STAGE_LABEL[stage]}</span>
            </div>
            {/* thin stage progress: 4 dots, filled as stages complete */}
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {(["viewer", "plugin", "download", "scene"] as LoadStage[]).map((s) => (
                <span
                  key={s}
                  className={
                    "h-1 w-6 rounded-full transition-colors duration-300 " +
                    (s === stage ? "bg-teal-600 animate-pulse" : sorder(s, stage) ? "bg-teal-600/60" : "bg-border")
                  }
                />
              ))}
            </div>
            {slow && (
              <p className="max-w-xs text-center text-[10px] leading-relaxed">
                First open compiles the ~2 MB Mol* viewer bundle — this can take
                up to a minute on slower disks. It only happens once per page
                load; later opens are instant.
              </p>
            )}
          </div>
        </div>
      )}
      {phase === "error" && (
        <div className="absolute inset-0 z-20 overflow-auto bg-background p-4">
          <p className="mb-2 text-xs text-destructive">
            3D viewer unavailable ({error ?? "unknown error"}) — showing the central slice instead:
          </p>
          <MrcImage
            src={`/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=png&scale=large`}
            alt={`${name} central slice`}
            className="mx-auto max-w-md"
          />
        </div>
      )}
    </div>
  );
}
