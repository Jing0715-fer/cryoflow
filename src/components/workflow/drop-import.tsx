"use client";
// Task 92 — the third import form: drag & drop workflow files onto the canvas.
//
// The two existing forms are button-driven (canvas file input, palette
// dynamic input); both call stageWorkflowFiles after the pick. The drop
// form reaches the same single-source staging from the other side of the
// funnel: the OS hands us files mid-gesture and the canvas becomes the
// drop target. What the browser would otherwise do with an unguarded drop
// — navigate the tab away and render the raw JSON — is the failure mode
// the window guard below exists to kill.
//
// Split of duties:
//   useDropImport        — dragenter/over/leave depth tracking (a child
//                          element fires leave on the parent while staying
//                          inside it; the classic flicker fix is a depth
//                          counter, not a boolean) + drop → onFiles.
//   DropImportOverlay    — the visual contract while a drag is live:
//                          pointer-events-none (must never swallow the
//                          drop it advertises), aria-hidden (screen-reader
//                          users import via the buttons, not the pointer),
//                          motion-reduce-safe reveal.
//   useDropNavigationGuard — window-level swallow of every drop this app
//                          does not claim. Mounted app-wide (page.tsx),
//                          not canvas-wide: an accidental drop on the
//                          dashboard must not navigate either.
import * as React from "react";
import { FileUp } from "lucide-react";

export function useDropImport(onFiles: (files: File[]) => void) {
  // Depth, not boolean: dragenter/dragleave fire for every element the
  // gesture crosses, so "is the pointer still inside the section" is
  // answered by enter-minus-leave balance, not by the last event.
  const depthRef = React.useRef(0);
  const [active, setActive] = React.useState(false);
  const [fileCount, setFileCount] = React.useState<number | null>(null);

  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const onDragEnter = React.useCallback((e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depthRef.current += 1;
    if (depthRef.current === 1) {
      // items.length is the honest count during the gesture (files is
      // gated on drop by security); some sources report 0 — hide the chip.
      const n = e.dataTransfer?.items?.length ?? 0;
      setFileCount(n > 0 ? n : null);
    }
    setActive(true);
  }, []);

  const onDragOver = React.useCallback((e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    // Over MUST preventDefault — that is what licenses the drop cursor
    // and makes the section a valid drop target at all.
    e.preventDefault();
  }, []);

  const onDragLeave = React.useCallback((e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setActive(false);
  }, []);

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depthRef.current = 0;
      setActive(false);
      setFileCount(null);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  return { dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop }, active, fileCount };
}

// App-wide accident insurance (Task 92): the browser default for a file
// drop nobody handles is NAVIGATION — the app is replaced by the raw JSON
// and in-memory state is gone. Swallow every drop/dragover that bubbles to
// window; surfaces that DO import call preventDefault earlier (deeper in
// the bubble path), so this never competes with a real handler.
export function useDropNavigationGuard() {
  React.useEffect(() => {
    const swallow = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);
}

export function DropImportOverlay({ count }: { count: number | null }) {
  return (
    <div
      aria-hidden="true"
      data-canvas-ui="drop-import-overlay"
      className="no-print pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-[2px] animate-in fade-in duration-150 motion-reduce:animate-none motion-reduce:transition-none"
    >
      <div className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-primary/70 bg-accent/40 px-10 py-8 shadow-lg">
        <FileUp className="size-10 text-primary" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Drop workflow files to import</p>
        <p className="text-xs text-muted-foreground">
          Lands in the same preview queue as the file picker
        </p>
        {count != null && count > 0 && (
          <span
            data-canvas-ui="drop-file-count"
            className="mt-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary tabular-nums"
          >
            {count} {count === 1 ? "file" : "files"} ready
          </span>
        )}
      </div>
    </div>
  );
}
