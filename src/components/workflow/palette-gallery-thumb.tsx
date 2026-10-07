"use client";

/**
 * The palette galleries' inline preview (t663) — the four-window pending
 * item: a gallery row's job is easier to recognize by its first tile than
 * by its name. The thumb mounts INSIDE a cmdk CommandItem and watches the
 * item's own data-selected attribute (cmdk 1.1.1 sets it for pointer hover
 * AND keyboard arrows — one watcher serves both dialects of "active").
 *
 * Honesty ladder:
 *   idle    → nothing rendered (the row stays icon-only; no space is
 *             claimed for a preview nobody asked for)
 *   loading → a pulsing slot (the fetch is bounded; the pulse says so)
 *   ready   → the 40 px tile, WHILE the row is active — the peek is a
 *             gesture, not a permanent fixture; the module cache makes
 *             every re-activation instant
 *   absent  → nothing rendered, cached as absent so a dead job never
 *             refetches on every hover (the honest no-tile beats a
 *             spinner loop)
 *
 * The tile URL is the SAME recipe the surfaces themselves obey:
 *   frames  → /micrographs first entry → outputs/file?format=png
 *   classes → the teaser's own lane rule: volume files win (axis=z&pos=0.5),
 *             the combined stack covers class2d (montage=0&slice=0)
 * so a preview can never disagree with what the jump will show.
 */

import React from "react";

type ThumbState = { url: string } | "loading" | "absent";

/** module-level cache: the URL is the cache (the browser caches the PNG
 *  behind it); "absent" is cached too — a dead wall stays dead for the
 *  session instead of refetching on every scan */
const thumbCache = new Map<string, ThumbState>();

const inFlight = new Map<string, Promise<string | null>>();

/** one fetch chain per kind — resolved through the cache so concurrent
 *  activations of the same row share a single round trip */
export function fetchPaletteThumb(
  kind: "frames" | "classes",
  jobId: string
): Promise<string | null> {
  const key = `${kind}:${jobId}`;
  const hit = thumbCache.get(key);
  if (hit === "absent") return Promise.resolve(null);
  if (hit && hit !== "loading") return Promise.resolve(hit.url);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = (async (): Promise<string | null> => {
    try {
      let url: string | null = null;
      if (kind === "frames") {
        const r = await fetch(`/api/jobs/${jobId}/micrographs`, { cache: "no-store" });
        if (!r.ok) throw new Error("micrographs");
        const d = (await r.json()) as { micrographs?: { path?: string }[] };
        const first = (d.micrographs ?? [])[0];
        if (!first?.path) throw new Error("empty wall");
        url = `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(first.path)}&format=png`;
      } else {
        const r = await fetch(`/api/jobs/${jobId}/classes`, { cache: "no-store" });
        if (!r.ok) throw new Error("classes");
        const d = (await r.json()) as {
          classesFile?: string | null;
          volumeFiles?: string[] | null;
        };
        const volumes = d.volumeFiles ?? [];
        if (volumes.length > 0) {
          url = `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(volumes[0])}&format=png&axis=z&pos=0.5`;
        } else if (d.classesFile) {
          url = `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(d.classesFile)}&format=png&montage=0&slice=0`;
        } else {
          throw new Error("empty classes");
        }
      }
      thumbCache.set(key, { url });
      return url;
    } catch {
      thumbCache.set(key, "absent");
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}

/** test hook — the e2e asserts the cache without dragging fetch through it */
export function peekThumbCache(kind: "frames" | "classes", jobId: string): ThumbState | undefined {
  return thumbCache.get(`${kind}:${jobId}`);
}

export function PaletteGalleryThumb({
  kind,
  jobId,
  label,
}: {
  kind: "frames" | "classes";
  jobId: string;
  /** alt/teaching text for the tile's title */
  label: string;
}) {
  const slotRef = React.useRef<HTMLDivElement | null>(null);
  const [active, setActive] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "loading" | "ready" | "absent">("idle");
  const [url, setUrl] = React.useState<string | null>(null);
  const startedRef = React.useRef(false);

  // cmdk marks the active item on the [cmdk-item] element — pointer hover
  // and arrow keys land on the same attribute, so one observer watches both
  React.useEffect(() => {
    const item = slotRef.current?.closest("[cmdk-item]") as HTMLElement | null;
    if (!item) return;
    const update = () => {
      setActive(
        item.getAttribute("data-selected") === "true" ||
          item.getAttribute("aria-selected") === "true"
      );
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(item, { attributes: true, attributeFilter: ["data-selected", "aria-selected"] });
    return () => mo.disconnect();
  }, []);

  // the fetch starts once per mount's first activation; the module cache
  // makes every later activation instant (no network)
  React.useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;
    setState("loading");
    void fetchPaletteThumb(kind, jobId).then((u) => {
      if (u) {
        setUrl(u);
        setState("ready");
      } else {
        setState("absent");
      }
    });
  }, [active, kind, jobId]);

  const visible = active && (state === "loading" || state === "ready");
  if (!visible) {
    // the wrapper STAYS in the DOM (display-none): the selection observer
    // needs it to find the cmdk item, and a display-none element costs no
    // flex-gap space — the row keeps its compact form; state persists so a
    // re-activation skips the network entirely
    return <div ref={slotRef} data-palette-thumb="" data-palette-thumb-state={state} className="hidden" />;
  }
  return (
    <div
      ref={slotRef}
      data-palette-thumb=""
      data-palette-thumb-state={state}
      title={label}
      className="shrink-0"
    >
      {state === "ready" && url ? (
        // the galleries' own <img> dialect (import-gallery/class teaser speak the same element)
        <img
          src={url}
          alt=""
          aria-hidden="true"
          onError={() => setState("absent")}
          className="size-10 animate-in fade-in rounded-md border border-border/60 object-cover"
        />
      ) : (
        <div className="size-10 animate-pulse rounded-md border border-border/60 bg-muted/60" />
      )}
    </div>
  );
}
