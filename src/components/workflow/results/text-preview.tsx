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
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { CopyButton } from "@/components/workflow/copy-button";

export function TextPreview({ jobId, path }: { jobId: string; path: string }) {
  const [text, setText] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
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
  }, [jobId, path]);

  // the tail landed — hand the dialog's focus to the content itself, so
  // the keyboard user is already inside the scroll region (t774: focus
  // without reachability is a dead gesture; here reachability IS the
  // whole point — the region is the destination)
  React.useEffect(() => {
    if (text !== null) preRef.current?.focus();
  }, [text]);

  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error}
      </p>
    );
  }
  if (text === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading file…
      </div>
    );
  }
  return (
    <div className="min-w-0">
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
