"use client";

/**
 * CryoFlow — Mol* (molstar) 3D volume viewer integration.
 *
 * Loaded lazily (next/dynamic, ssr:false) from mol-viewer.tsx so the
 * ~2 MB molstar bundle never enters the main page chunk. The map is
 * fetched through the job outputs API (format=raw) and loaded via the
 * RawData → ParseCcp4 → VolumeFromCcp4 → VolumeRepresentation3D
 * transform chain.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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

export default function MolStarEmbed({ jobId, path, name }: MolStarEmbedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);

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

        // fetch the raw map bytes through the (path-checked) outputs API
        const res = await fetch(
          `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=raw`
        );
        if (!res.ok) {
          throw new Error(`map download failed (HTTP ${res.status})`);
        }
        const buf = await res.arrayBuffer();
        console.debug("[molstar] map fetched", buf.byteLength);

        const [{ RawData, ParseCcp4 }, { VolumeFromCcp4 }, { VolumeRepresentation3D }] = await Promise.all([
          import("molstar/lib/mol-plugin-state/transforms/data"),
          import("molstar/lib/mol-plugin-state/transforms/volume"),
          import("molstar/lib/mol-plugin-state/transforms/representation"),
        ]);

        const b = plugin.build();
        const data = b.toRoot().apply(RawData, { data: new Uint8Array(buf), label: name });
        const parsed = data.apply(ParseCcp4, {});
        const vol = parsed.apply(VolumeFromCcp4, { entryId: "map" });
        vol.apply(VolumeRepresentation3D, {
          type: { name: "isosurface", params: {} },
          colorTheme: { name: "uniform", params: { value: 0xffae42 } },
          sizeTheme: { name: "uniform", params: {} },
        });
        await b.commit();
        console.debug("[molstar] state committed");

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

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border bg-white dark:bg-zinc-950">
      <div ref={containerRef} className="h-full w-full" data-molstar-container="true" />
      {phase === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-xs text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600" aria-hidden="true" />
            Loading Mol*…
          </div>
        </div>
      )}
      {phase === "error" && (
        <div className="absolute inset-0 overflow-auto bg-background p-4">
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
