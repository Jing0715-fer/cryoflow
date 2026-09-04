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
import { Loader2, Mountain, RotateCw, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MrcImage } from "./mrc-image";
import "molstar/build/viewer/molstar.css";

interface MolStarEmbedProps {
  jobId: string;
  path: string;
  name: string;
}

type Phase = "loading" | "ready" | "error";

/* Mol* typings are awkward to thread through dynamic imports — keep the
 * plugin handle loosely typed and dispose defensively. */
type MolPlugin = any;

const PRESETS = [1, 2, 3, 5];
const SIGMA_MIN = 0.5;
const SIGMA_MAX = 10;

export default function MolStarEmbed({ jobId, path, name }: MolStarEmbedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);

  // contour state (σ units)
  const [sigma, setSigma] = useState(2);
  const [stats, setStats] = useState<{ mean: number; sigma: number } | null>(null);

  // mol* handles — refs so the control bar can act on a live plugin
  const pluginRef = useRef<MolPlugin>(null);
  const reprRef = useRef<any>(null);
  const VolumeReprRef = useRef<any>(null);
  const IsoValueRef = useRef<any>(null);

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
      if (containerRef.current) containerRef.current.innerHTML = "";
    };

    const init = async () => {
      try {
        const [{ createPluginUI }, { renderReact18 }, { DefaultPluginUISpec }] = await Promise.all([
          import("molstar/lib/mol-plugin-ui"),
          import("molstar/lib/mol-plugin-ui/react18"),
          import("molstar/lib/mol-plugin-ui/spec"),
        ]);

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

        // fetch the raw map bytes through the (path-checked) outputs API
        const res = await fetch(
          `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=raw`
        );
        if (!res.ok) {
          throw new Error(`map download failed (HTTP ${res.status})`);
        }
        const buf = await res.arrayBuffer();
        console.debug("[molstar] map fetched", buf.byteLength);

        const [{ RawData, ParseCcp4 }, { VolumeFromCcp4 }, { VolumeRepresentation3D }, { Volume }] =
          await Promise.all([
            import("molstar/lib/mol-plugin-state/transforms/data"),
            import("molstar/lib/mol-plugin-state/transforms/volume"),
            import("molstar/lib/mol-plugin-state/transforms/representation"),
            import("molstar/lib/mol-model/volume"),
          ]);
        VolumeReprRef.current = VolumeRepresentation3D;
        IsoValueRef.current = Volume.IsoValue;

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
        console.debug("[molstar] state committed");

        // surface the grid stats for the absolute-threshold readout
        try {
          for (const cell of plugin.state.data.cells.values()) {
            const obj = (cell as any)?.obj;
            // SO.Volume.Data's type name is "Volume" (capital V)
            const v = obj?.type?.name === "Volume" ? obj.data : null;
            const s = v?.grid?.stats;
            if (s && Number.isFinite(s.sigma) && s.sigma > 0) {
              setStats({ mean: s.mean, sigma: s.sigma });
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
    };
  }, [jobId, path, name]);

  /* ---------------- contour updates (transform-state) --------------- */

  // latest σ requested by the user (the slider can outrun the async commits)
  const sigmaRef = useRef(sigma);
  const updatePending = useRef(false);
  useEffect(() => {
    sigmaRef.current = sigma;
    void pumpContour();
  }, [sigma]);

  const commitContour = async (value: number) => {
    const plugin = pluginRef.current;
    const repr = reprRef.current;
    const VolumeRepresentation3D = VolumeReprRef.current;
    const IsoValue = IsoValueRef.current;
    if (!plugin || !repr || !VolumeRepresentation3D || !IsoValue) throw new Error("not ready");
    await plugin
      .build()
      .to(repr)
      .update(VolumeRepresentation3D, (old: any) => ({
        ...old,
        type: {
          ...old.type,
          params: {
            ...old.type?.params,
            isoValue: IsoValue.relative(value),
          },
        },
      }))
      .commit();
  };

  const pumpContour = async () => {
    if (updatePending.current) return; // the in-flight commit re-checks below
    updatePending.current = true;
    try {
      let s = sigmaRef.current;
      for (;;) {
        await commitContour(s);
        if (s === sigmaRef.current) break; // nothing newer arrived meanwhile
        s = sigmaRef.current; // slider moved while committing — apply the newest
      }
    } catch (err) {
      console.debug("[molstar] contour update skipped", err);
    } finally {
      updatePending.current = false;
    }
  };

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

  const absolute = stats ? stats.mean + stats.sigma * sigma : null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border bg-white dark:bg-zinc-950">
      <div ref={containerRef} className="h-full w-full" data-molstar-container="true" />

      {/* contour control bar */}
      {phase === "ready" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-3">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border bg-card/90 px-4 py-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Mountain className="size-3.5 shrink-0 text-teal-600" aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Contour
              </span>
              <span
                className="rounded-md bg-teal-600/10 px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-teal-700 dark:text-teal-300"
                title={absolute != null ? `threshold = mean + σ·${sigma.toFixed(2)}` : undefined}
              >
                {sigma.toFixed(2)} σ
              </span>
              {absolute != null ? (
                <span className="font-mono text-[10px] text-muted-foreground">
                  ≈ {absolute.toFixed(4)}
                </span>
              ) : null}
              {/* presets */}
              <div className="ml-auto flex items-center gap-1">
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
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="font-mono">{SIGMA_MIN}σ</span>
              <span className="hidden sm:inline">drag rotate · scroll zoom · right-drag pan</span>
              <span className="font-mono">{SIGMA_MAX}σ</span>
            </div>
          </div>
        </div>
      )}

      {/* corner actions */}
      {phase === "ready" ? (
        <div className="absolute right-3 top-3 z-10 flex gap-1.5">
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
        </div>
      ) : null}

      {phase === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-xs text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600" aria-hidden="true" />
            Loading Mol*…
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
