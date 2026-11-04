"use client";

/**
 * CryoFlow — the text tail preview (Task 779 — extracted from the
 * results view when the inspector's Files tab became the second family;
 * the extraction law: a component moves when a SECOND family needs it).
 *
 * The results view spoke this law first (the Logs & reports door opens
 * this preview on run.out and friends); the job inspector's Files tab is
 * the second family — its textual rows used to offer only the raw
 * download, a pilgrimage to a browser tab for what is a 64 KB tail read.
 * One brain, now three door-sets (results view + inspector Files tab,
 * beside the StarTable brain they already share).
 *
 * The tail contract: the backend answers with the LAST 64 KB of the
 * file (format=text, the same containment chain as every other format —
 * workdir scoping, realpath, pathref resolution). A run.out grows to
 * megabytes; the tail is the part that explains the present.
 *
 * Keyboard face (t774/t777 lineage — focus must have reachability):
 * the content is a focusable scroll region (tabIndex 0) that TAKES the
 * focus when the tail lands, so arrows / PageUp / Home / End scroll it
 * natively and Esc still closes the dialog (the door lineage — arrows
 * move, Esc closes, nothing acts). The copy affordance rides the header
 * row: the same clipboard dialect every consumer speaks (Task 170's
 * one-clipboard law).
 *
 * t869 — the two silent states learned the house dialects. The loading
 * row speaks (role="status" — the same voice the path browser's status
 * lines use), because a dialog that opens silent and swaps to content
 * leaves the screen-reader reader holding nothing. And the wound is no
 * longer a dead end: a failed tail load (a dev-server OOM, a first-hit
 * compile 500) used to render a message with NO door — close and reopen
 * was the only retry. The strip now carries the chart-error-strip's own
 * chip (t491's third state: not the chart, not the empty, "the load
 * failed and you can try again"), re-firing the same fetch.
 *
 * The empty face's honesty (t967 — the bench's run.err was the witness):
 * a 0-byte file used to open as a bare empty box beside a copy button
 * that copies nothing — honest, but bare. The kind note now speaks
 * first: "0 bytes — nothing to read", one sentence of why. The cure
 * travels by ADDITION (the family law): the focusable pre stays — it is
 * still the focus destination and the scroll region — the note only
 * explains what the box's silence means.
 */

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { CopyButton } from "@/components/workflow/copy-button";

export function TextPreview({ jobId, path }: { jobId: string; path: string }) {
  const [text, setText] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // t869 — the retry door: bumping the attempt re-fires the tail fetch
  // (the effect's own dependency — no imperative re-fetch wiring)
  const [attempt, setAttempt] = React.useState(0);
  const preRef = React.useRef<HTMLPreElement | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setText(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=text`
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        if (!cancelled) setText(await res.text());
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load file");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, path, attempt]);

  // the tail landed — hand the dialog's focus to the content itself, so
  // the keyboard user is already inside the scroll region (t774: focus
  // without reachability is a dead gesture; here reachability IS the
  // whole point — the region is the destination)
  React.useEffect(() => {
    if (text !== null) preRef.current?.focus();
  }, [text]);

  if (error) {
    return (
      /* the wound speaks and offers its door (the t491 third state —
         aria-live rides the container, the chip re-fires the fetch) */
      <section
        data-text-error=""
        aria-live="polite"
        aria-label="File preview could not be loaded"
        className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-snug text-destructive"
      >
        <p className="min-w-0 flex-1 pt-0.5">
          <span className="font-semibold">Couldn&apos;t load the file</span>
          <span className="ml-1 font-mono text-[10px] opacity-70">({error})</span>
        </p>
        <button
          type="button"
          data-text-error-retry=""
          onClick={() => setAttempt((a) => a + 1)}
          aria-label="Retry loading the file"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <RefreshCw className="size-3" aria-hidden="true" />
          Retry
        </button>
      </section>
    );
  }
  if (text === null) {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading file…
      </div>
    );
  }
  return (
    <div className="min-w-0">
      {/* the empty face's kind note (t967) — the honest words first, the
          box's silence explained; the pre below stays the focus law's
          destination (the cure is additive, never a replacement) */}
      {text === "" && (
        <p
          data-canvas-ui="text-preview-empty-note"
          className="mb-1.5 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          0 bytes — nothing to read. The file exists but is empty — an honest tail of nothing.
        </p>
      )}
      {/* the copy row — one clipboard dialect (Task 170), no occlusion
          (a floating button would cover the tail's first line) */}
      <div className="mb-1.5 flex items-center justify-end">
        <CopyButton text={text} label="Copy" />
      </div>
      <pre
        ref={preRef}
        tabIndex={0}
        className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/90 outline-none focus-visible:ring-2 focus-visible:ring-running-600/60"
        aria-label="File content preview"
      >
        {text}
      </pre>
    </div>
  );
}
