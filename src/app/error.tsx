"use client";

import { useEffect, useRef } from "react";

/**
 * t1057 — the app's error boundary: the net under a falling chunk.
 *
 * The QA pass caught the missing seat live: after a keeper recycle the
 * FIRST visit to a lazily-compiled view can race the chunk's on-demand
 * compile and die with a ChunkLoadError — and the app carried no
 * boundary at all, so the death bubbled to the bare overlay and the
 * USER had to know to reload by hand. The boundary cures it in two
 * moves:
 *
 *  · the CHUNK case (a stale page riding a fresh build — dev recycles,
 *    deploys): ONE honest auto-reload, flagged in sessionStorage with
 *    a timestamp; a second chunk death inside the guard window renders
 *    the fallback instead of looping (a reload that cannot stop is not
 *    a cure, it is the bug wearing a cure's clothes). No storage
 *    (private mode, storage denied) → no auto-reload at all: the card
 *    and its button carry the cure, visibly.
 *  · every other case: the fallback card directly — the error's own
 *    words (truncated), the server's digest when one was sent, and a
 *    Retry that calls reset() so the segment re-renders in place.
 *
 * The card speaks the house dialect: the failure named, the cure
 * described as what already happened or what the button will do —
 * never a fake promise ("this will heal" is not claimed; the buttons
 * say what they do).
 */

/** the chunk-error family: dev's ChunkLoadError, webpack's classic
 *  "Loading chunk N failed", and the native dynamic-import rejections
 *  (Chrome/Firefox/Safari each word it differently — the family shares
 *  "dynamically imported module"). */
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i;

/** one auto-reload per incident: a second chunk death inside this
 *  window means the build itself is broken — reloading again would
 *  only reset the same fall. */
const RELOAD_GUARD_MS = 90_000;

const RELOAD_FLAG = "cryoflow:chunk-auto-reload";

function isChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return CHUNK_ERROR_RE.test(error.name) || CHUNK_ERROR_RE.test(error.message);
}

export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunk = isChunkError(error);
  const armed = useRef(false);

  useEffect(() => {
    if (!chunk || armed.current) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
      const now = Date.now();
      if (now - last < RELOAD_GUARD_MS) return; // the guard holds — the card speaks
      sessionStorage.setItem(RELOAD_FLAG, String(now));
    } catch {
      return; // storage unavailable → no auto-reload; the button carries it
    }
    armed.current = true;
    // the honest reload: flagged, guarded, once — the next page load
    // asks the server for the fresh build this stale page never saw
    window.setTimeout(() => window.location.reload(), 0);
  }, [chunk]);

  const words = (error.message || "The view fell mid-render.").slice(0, 240);

  return (
    <div
      role="alert"
      className="flex h-dvh items-center justify-center bg-background p-6 text-foreground"
    >
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-base font-semibold leading-tight">
              {chunk ? "The view's code didn't arrive" : "The view fell mid-render"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {chunk
                ? "A code chunk failed to load — usually a stale page riding a fresh build. The page reloads itself once automatically; if you're reading this, the one-reload guard held."
                : "Something failed while drawing this view. Nothing was lost — the workflow lives on the server; this page just stopped reading it."}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
          <p className="break-words font-mono text-xs text-muted-foreground">{words}</p>
          {error.digest ? (
            <p className="font-mono text-[11px] text-muted-foreground/70">
              digest {error.digest}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Reload the page
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
