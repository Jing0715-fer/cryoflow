"use client";
// Task 92 — the third import form: drag & drop workflow files onto the canvas.
// Task 93 — the fourth chapter of the same form: FOLDER drops.
//
// The two button-driven forms (canvas file input, palette dynamic input)
// both call stageWorkflowFiles after the pick. The drop form reaches the
// same single-source staging from the other side of the funnel: the OS
// hands us files mid-gesture and the canvas becomes the drop target. What
// the browser would otherwise do with an unguarded drop — navigate the tab
// away and render the raw JSON — is the failure mode the window guard below
// exists to kill.
//
// Task 93 adds folder awareness. A folder dropped from the OS shows up as
// ONE transfer item whose .files list cannot see inside it; the entries API
// (webkitGetAsEntry) is the only way to walk the tree. Walking must be
// GATED, because a Relion job folder is full of multi-GB .mrcs stacks and
// the shared parse funnel would f.text() every collected file into memory.
// The gate mirrors the file-picker forms: those filter via
// accept=".json,application/json" at the OS dialog level, so a .mrcs never
// even reaches parseWorkflowFiles — the drop form now applies the same
// filter itself (extension + size cap). Non-candidates are skipped the same
// way the picker skips them: by not being offered, not by failing loudly.
// A drop that offered files but yielded zero candidates still gets an
// honest toast — silence would read as a swallowed gesture.
//
// Split of duties:
//   collectDroppedFiles    — entries-API walk (depth/scan/count caps) +
//                            .json gate + relative-path renaming; falls
//                            back to .files when no entries exist (synthetic
//                            drops in tests, exotic drag sources).
//   useDropImport          — dragenter/over/leave depth tracking (a child
//                            element fires leave on the parent while staying
//                            inside it; the classic flicker fix is a depth
//                            counter, not a boolean) + folder-gesture
//                            detection + drop → onFiles.
//   DropImportOverlay      — the visual contract while a drag is live:
//                            pointer-events-none (must never swallow the
//                            drop it advertises), aria-hidden (screen-reader
//                            users import via the buttons, not the pointer),
//                            motion-reduce-safe reveal, and a folder chip
//                            that replaces the misleading items.length count
//                            for directory gestures (one item ≠ one file).
//   useDropNavigationGuard — window-level swallow of every drop this app
//                            does not claim. Mounted app-wide (page.tsx),
//                            not canvas-wide: an accidental drop on the
//                            dashboard must not navigate either.
import * as React from "react";
import { FileUp, FolderOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// folder walk (Task 93)
// ---------------------------------------------------------------------------

/** The picker forms' accept gate, restated for the drop path. */
const IMPORTABLE_EXT = ".json";
/**
 * Workflow exports are tiny JSON documents (tens of KB). Anything larger
 * claiming to be .json is data misfiled as metadata — reading it would
 * freeze the tab for nothing.
 */
const MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024;
/** Deepest directory level walked below the dropped item (root = depth 0). */
const MAX_WALK_DEPTH = 8;
/** Collected files handed to staging — keeps the preview queue sane. */
const MAX_COLLECTED = 200;
/** Total entries examined across the whole walk — runaway-tree insurance. */
const MAX_SCAN = 2000;

function isImportCandidate(f: File): boolean {
  return f.name.toLowerCase().endsWith(IMPORTABLE_EXT) && f.size <= MAX_IMPORT_FILE_BYTES;
}

function entryFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file((f) => resolve(f), () => resolve(null));
  });
}

/**
 * readEntries delivers children in batches (often ≤100) and must be called
 * repeatedly until it yields an empty batch — a single call silently drops
 * everything past the first page.
 */
function readAllEntries(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const reader = dir.createReader();
    const all: FileSystemEntry[] = [];
    const step = () =>
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(all);
            return;
          }
          all.push(...batch);
          step();
        },
        () => resolve(all),
      );
    step();
  });
}

interface WalkCtx {
  out: File[];
  scanned: number;
}

async function walkEntry(entry: FileSystemEntry, ctx: WalkCtx, depth: number): Promise<void> {
  if (ctx.scanned >= MAX_SCAN || ctx.out.length >= MAX_COLLECTED) return;
  if (depth > MAX_WALK_DEPTH) return;
  ctx.scanned += 1;
  if (entry.isFile) {
    const file = await entryFile(entry as FileSystemFileEntry);
    if (file && isImportCandidate(file)) {
      // Rename with the path inside the dropped folder — the File
      // constructor keeps "/" verbatim, so "jobs/A/wf.json" both
      // disambiguates same-named files across subfolders and shows
      // provenance in the preview queue. Loose drops keep their identity
      // (fullPath === name → original File object, untouched).
      const rel = entry.fullPath.replace(/^\//, "");
      ctx.out.push(rel && rel !== file.name ? new File([file], rel, { type: file.type }) : file);
    }
    return;
  }
  if (entry.isDirectory) {
    const children = await readAllEntries(entry as FileSystemDirectoryEntry);
    for (const child of children) await walkEntry(child, ctx, depth + 1);
  }
}

export interface CollectedDrop {
  /** Gated, folder-expanded files ready for staging. */
  files: File[];
  /** How many file-kind items the gesture offered (for the empty toast). */
  offered: number;
}

/**
 * Expand a drop's DataTransfer into the files staging should see.
 * Entries must be grabbed synchronously — transfer items go dead once the
 * handler yields; the async walk happens over the entry objects, which stay
 * valid. Never throws: a hostile or half-dead transfer degrades to the
 * .files fallback rather than breaking the gesture.
 */
export async function collectDroppedFiles(dt: DataTransfer | null): Promise<CollectedDrop> {
  const rawCount = Array.from(dt?.items ?? []).filter((i) => i.kind === "file").length;
  if (!dt) return { files: [], offered: 0 };
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind !== "file") continue;
    try {
      const e = item.webkitGetAsEntry();
      if (e) entries.push(e);
    } catch {
      /* dead item — ignore */
    }
  }
  if (entries.length > 0) {
    const ctx: WalkCtx = { out: [], scanned: 0 };
    for (const e of entries) await walkEntry(e, ctx, 0);
    return { files: ctx.out, offered: Math.max(rawCount, 1) };
  }
  // No entries API (synthetic test drops, exotic sources): plain files,
  // same gate.
  const files = Array.from(dt.files ?? []).filter(isImportCandidate);
  return { files, offered: rawCount };
}

// ---------------------------------------------------------------------------
// gesture hooks
// ---------------------------------------------------------------------------

export function useDropImport(onFiles: (files: File[]) => void) {
  // Depth, not boolean: dragenter/dragleave fire for every element the
  // gesture crosses, so "is the pointer still inside the section" is
  // answered by enter-minus-leave balance, not by the last event.
  const depthRef = React.useRef(0);
  const [active, setActive] = React.useState(false);
  const [fileCount, setFileCount] = React.useState<number | null>(null);
  const [folderDrag, setFolderDrag] = React.useState(false);

  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const onDragEnter = React.useCallback((e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depthRef.current += 1;
    if (depthRef.current === 1) {
      const items = Array.from(e.dataTransfer?.items ?? []);
      // A directory gesture reports items.length === 1 no matter how many
      // files it holds — the count chip would lie, so folder gestures get
      // the folder chip instead (checked at the same safe moment).
      const isFolder = items.some((item) => {
        if (item.kind !== "file") return false;
        try {
          return item.webkitGetAsEntry()?.isDirectory === true;
        } catch {
          return false;
        }
      });
      setFolderDrag(isFolder);
      const n = items.filter((it) => it.kind === "file").length;
      setFileCount(!isFolder && n > 0 ? n : null);
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
    if (depthRef.current === 0) {
      setActive(false);
      setFolderDrag(false);
    }
  }, []);

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depthRef.current = 0;
      setActive(false);
      setFileCount(null);
      setFolderDrag(false);
      const dt = e.dataTransfer;
      void collectDroppedFiles(dt).then(({ files, offered }) => {
        if (files.length > 0) {
          onFiles(files);
        } else if (offered > 0) {
          // The gesture offered files but none survived the gate — say so.
          // (The parse funnel's destructive toast only fires for files that
          // WERE collected; gate-skipped ones would otherwise vanish.)
          toast({
            title: "Nothing to import in that drop",
            description:
              "Only CryoFlow workflow exports (*.json) are collected — .mrcs, .star and other data files are ignored.",
            variant: "destructive",
          });
        }
      });
    },
    [onFiles],
  );

  return {
    dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
    active,
    fileCount,
    folderDrag,
  };
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

export function DropImportOverlay({ count, folder }: { count: number | null; folder?: boolean }) {
  const Icon = folder ? FolderOpen : FileUp;
  return (
    <div
      aria-hidden="true"
      data-canvas-ui="drop-import-overlay"
      className="no-print pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-[2px] animate-in fade-in duration-150 motion-reduce:animate-none motion-reduce:transition-none"
    >
      <div className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-primary/70 bg-accent/40 px-10 py-8 shadow-lg">
        <Icon className="size-10 text-primary" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">
          {folder ? "Drop folder to import" : "Drop workflow files to import"}
        </p>
        <p className="text-xs text-muted-foreground">
          {folder
            ? "Workflow exports (*.json) inside are collected — data files are ignored"
            : "Lands in the same preview queue as the file picker"}
        </p>
        {folder ? (
          <span
            data-canvas-ui="drop-folder-chip"
            className="mt-1 flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
          >
            <FolderOpen className="size-3" aria-hidden="true" />
            folder
          </span>
        ) : (
          count != null &&
          count > 0 && (
            <span
              data-canvas-ui="drop-file-count"
              className="mt-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary tabular-nums"
            >
              {count} {count === 1 ? "file" : "files"} ready
            </span>
          )
        )}
      </div>
    </div>
  );
}
