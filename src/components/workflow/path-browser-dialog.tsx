"use client";

/**
 * CryoFlow — filesystem picker (client).
 *
 * Backed by GET /api/fs/browse (read-only listing on the app's host — local
 * drives, POSIX mounts, WSL distros via \\wsl.localhost, wildcard patterns).
 *
 * Two modes, mirroring RELION's Import job ("Select files by"):
 *  - Folders: navigate folders, see micrograph counts, pick the folder
 *    (classic behaviour — every image in it gets imported).
 *  - Files: multi-select individual image files with checkboxes (the
 *    selection accumulates across folders — like RELION's file browser and
 *    cryoSPARC's import multi-select), or paste/preview a wildcard pattern
 *    (e.g. /data/movies/*.tiff) — the listing shows every matched file.
 *
 * The picked value flows back as one string: a folder path (folder mode) or
 * newline-separated absolute file paths / a wildcard pattern (files mode).
 */

import * as React from "react";
import {
  ArrowUp,
  Check,
  CheckSquare,
  ChevronRight,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  HardDrive,
  Home,
  Images,
  ListFilter,
  Loader2,
  RefreshCw,
  Server,
  Square,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import {
  onEscapeClose,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BROWSER_LIST_MAX } from "@/lib/browse-caps";
import { parseBrowserSeed, type BrowserMode } from "@/lib/browser-seed";

interface BrowseEntry {
  name: string;
  dir: boolean;
  size?: number;
  img?: boolean;
  /** absolute host path (files) — the multi-select key */
  abs?: string;
}

interface BrowseResponse {
  ok: boolean;
  path: string;
  parent: string | null;
  entries?: BrowseEntry[];
  roots?: { label: string; path: string }[];
  quick?: { label: string; path: string }[];
  truncated?: boolean;
  micrographs?: number;
  /** true when this listing is a wildcard-pattern expansion */
  pattern?: boolean;
  baseDir?: string;
  /** total files matched before the preview cap (t312: the cap is the
   * shared browser ceiling — 20,000 by default — so this now fires only
   * for genuinely enormous folders) */
  totalMatched?: number;
  /** t311/t312 — the REAL entry count of the listed directory (both local
   * and remote routes compute it before the cap): for a normal session
   * folder the listing arrives WHOLE (every image visible, every image
   * selectable); beyond the browser ceiling the truncated notice still
   * names the real total and steers the user to import the folder itself
   * (whose import enumerates EVERY image). */
  totalEntries?: number;
  error?: string;
}

function humanSize(n?: number): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

function shortenPath(p: string, max = 46): string {
  if (p.length <= max) return p;
  return p.slice(0, Math.ceil(max / 2) - 6) + "…" + p.slice(-Math.floor(max / 2));
}

export function PathBrowserDialog({
  open,
  onOpenChange,
  onPick,
  title,
  description,
  initialPath,
  initialMode = "folder",
  remote = null,
  singleFile = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** folder path OR newline-joined file list OR wildcard pattern */
  onPick: (value: string) => void;
  title?: string;
  description?: string;
  initialPath?: string;
  initialMode?: BrowserMode;
  /**
   * t300 — browse a CLUSTER's filesystem instead of this machine's: the
   * saved SSH connection whose `/api/remote/connections/[id]/browse` route
   * answers the listing. Remote projects pass their bound connection; the
   * picked paths are CLUSTER-absolute and ride the import's zero-upload
   * staging contract. Absent = the classic local browser, unchanged.
   */
  remote?: { connectionId: string; label?: string } | null;
  /**
   * t396 — ONE file, picked by ONE click (the "Continue from here:"
   * optimiser.star door). The multi-select micrograph world stays the
   * default: file rows gain checkboxes, the selection accumulates, the
   * footer imports N files. singleFile instead renders every file row as
   * click-to-pick (no checkboxes, no accumulation), hides the import
   * affordances, and adds a "Use this path" footer button that picks the
   * TYPED path verbatim — the value's mode can never flip to folders
   * behind a caller's back (the t395 field report: a single-path value
   * forced folder mode and files became unpickable).
   */
  singleFile?: boolean;
}) {
  const [mode, setMode] = React.useState<BrowserMode>(initialMode);
  const [cwd, setCwd] = React.useState<string | null>(null);
  const [data, setData] = React.useState<BrowseResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  /** name substring filter (files mode) — narrows the visible listing so
   * "Select all images" becomes "select everything that matched" */
  const [filter, setFilter] = React.useState("");

  // ---- t312: windowed rendering ------------------------------------------
  // The listing may now hold EVERY entry in a session folder (the 400-row
  // preview cap is retired — BROWSER_LIST_MAX, 20,000 by default), so the
  // DOM only ever materializes the visible window: a fixed 30px row pitch
  // (28px h-7 row + 2px breathing gap) with ±8 rows of overscan. Scrolling
  // just moves the translateY window — 2,054 or 20,000 entries cost the
  // same dozen row nodes.
  const LIST_ROW_PX = 30; // h-7 row + mb-0.5 gap
  const LIST_VIEW_PX = 288; // h-72 viewport
  const LIST_OVERSCAN = 8;
  const listScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [listScrollTop, setListScrollTop] = React.useState(0);

  // navigating / filtering / reloading swaps the list under the scrollbar —
  // snap both the window math and the element itself back to the top
  React.useEffect(() => {
    setListScrollTop(0);
    if (listScrollRef.current) listScrollRef.current.scrollTop = 0;
  }, [data, filter]);

  // reset when re-opened — restore a previous multi-file selection
  React.useEffect(() => {
    if (open) {
      const seed = parseBrowserSeed(initialPath ?? "", singleFile);
      setMode(seed.mode === "files" ? "files" : initialMode);
      setCwd(seed.cwd);
      setManual("");
      setError(null);
      setFilter("");
      setSelected(new Set(seed.selected));
    }
  }, [open, initialPath, initialMode, singleFile]);

  // the filter is folder-scoped — navigating anywhere resets it
  React.useEffect(() => {
    setFilter("");
  }, [cwd]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // t300 — one dialog, two worlds: the remote variant speaks the SAME
    // response dialect over the connection's SSH browse route.
    const base = remote
      ? `/api/remote/connections/${encodeURIComponent(remote.connectionId)}/browse`
      : "/api/fs/browse";
    const url = cwd
      ? `${base}?path=${encodeURIComponent(cwd)}`
      : base;
    fetch(url)
      .then((r) => r.json() as Promise<BrowseResponse>)
      .then((d) => {
        if (cancelled) return;
        if (d.ok) {
          setData(d);
        } else {
          setData(null);
          setError(d.error ?? "Could not list this folder");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("Browse request failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, cwd, remote]);

  // a wildcard pattern listing is always a file listing — force files mode
  const patternView = data?.ok && data.pattern === true;
  const activeMode: BrowserMode = patternView ? "files" : mode;

  const currentPath = data?.ok ? data.path : "";
  const inRootsView = !data?.ok || data.path === "";
  const microCount = data?.ok ? (data.micrographs ?? 0) : 0;

  // ---- filter (files mode, directory listing) -------------------------
  const needle = filter.trim().toLowerCase();
  const visibleEntries = React.useMemo(
    () =>
      needle
        ? (data?.entries ?? []).filter((e) => e.name.toLowerCase().includes(needle))
        : (data?.entries ?? []),
    [data, needle]
  );
  const visibleImages = React.useMemo(
    () => visibleEntries.filter((e) => !e.dir && e.img && e.abs).map((e) => e.abs!),
    [visibleEntries]
  );
  /** count of files in the UNFILTERED listing containing a needle — used
   * by the one-click quick chips so they stay honest when a filter is set */
  const countByNeedle = (sub: string): number =>
    (data?.entries ?? []).filter(
      (e) => !e.dir && e.abs && e.name.toLowerCase().includes(sub.toLowerCase())
    ).length;

  const toggleFile = (abs: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(abs)) next.delete(abs);
      else next.add(abs);
      return next;
    });
  };

  const addMany = (paths: string[]) => {
    if (paths.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of paths) next.add(p);
      return next;
    });
  };

  const selectAllImages = () => addMany(visibleImages);

  /** ONE-CLICK quick select: set the filter AND select every file in the
   * current listing whose name contains `sub` (e.g. "DW.mrc" —
   * motioncor2 dose-weighted outputs) in a single click. */
  const quickSelect = (sub: string) => {
    setFilter(sub);
    const hits = (data?.entries ?? [])
      .filter(
        (e) => !e.dir && e.abs && e.name.toLowerCase().includes(sub.toLowerCase())
      )
      .map((e) => e.abs!);
    addMany(hits);
  };

  const pick = (value: string) => {
    onPick(value);
    onOpenChange(false);
  };

  const pickFiles = () => {
    const list = Array.from(selected).sort();
    if (list.length > 0) pick(list.join("\n"));
  };

  const displayedMode = activeMode;
  const resolvedTitle =
    title ??
    (remote
      ? `Select files on ${remote.label ?? "the cluster"}`
      : displayedMode === "files"
        ? singleFile
          ? "Select a file"
          : "Select micrograph files"
        : "Choose a folder");
  const resolvedDescription =
    description ??
    (remote
      ? `Browse ${remote.label ?? "the cluster"}'s filesystem over SSH — every path you pick stays on the cluster (zero upload); downstream jobs run there.`
      : displayedMode === "files"
        ? singleFile
          ? "Navigate to the folder and click the file to pick it — or type the path below."
          : "Multi-select files across folders (selection accumulates), or paste a wildcard pattern like /data/movies/*.tiff."
        : "Navigate to your micrographs folder — local drives and WSL distros are both browsable.");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* narrow viewports host the job panel in a Radix Sheet — without the
          React-level Escape consume, Esc here would close the Sheet too */}
      {/* t396 — flex-col (not the default grid): it lets the footer ride
          `sticky bottom-0`, so the pick/Use-this-path button is ONSCREEN at
          every viewport height. The t383 scroll cap already kept the dialog
          inside a short window, but its action row sat BELOW THE FOLD —
          "the button for selecting the file path is off the screen" (the
          field report, verbatim). A pinned bar is the honest shape: the
          files scroll, the action never leaves. */}
      <DialogContent
        className="flex flex-col gap-3.5 sm:max-w-2xl"
        onKeyDown={onEscapeClose(() => onOpenChange(false))}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            {remote ? (
              <Server className="h-4 w-4 text-violet-500" aria-hidden="true" />
            ) : displayedMode === "files" ? (
              <Images className="h-4 w-4 text-primary" aria-hidden="true" />
            ) : (
              <FolderOpen className="h-4 w-4 text-primary" aria-hidden="true" />
            )}
            {resolvedTitle}
          </DialogTitle>
          <DialogDescription className="text-xs">{resolvedDescription}</DialogDescription>
        </DialogHeader>

        {/* mode switcher — Folders | Files (RELION "Select files by"). Hidden
            in singleFile mode: there is exactly ONE thing to pick. */}
        {!inRootsView && !patternView && !singleFile && (
          <div className="flex items-center gap-1 rounded-lg border bg-secondary/40 p-0.5" role="tablist" aria-label="Selection mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "folder"}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                mode === "folder"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode("folder")}
            >
              <Folder className="h-3.5 w-3.5" aria-hidden="true" />
              Folders
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "files"}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                mode === "files"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode("files")}
            >
              <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Files & pattern
            </button>
          </div>
        )}

        {/* breadcrumb / current location */}
        <div className="flex items-center gap-1.5 rounded-lg border bg-secondary/40 px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={() => setCwd(null)}
            title={remote ? "Back to the cluster's roots (/, home, cryoflow root)" : "Back to drives / roots"}
            aria-label="Back to roots"
          >
            {remote ? (
              <Server className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </Button>
          {data?.ok && data.parent != null && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs"
              onClick={() => setCwd(data.parent || null)}
              title={patternView ? "Back to the pattern's base folder" : "Up one folder"}
              aria-label="Up one folder"
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/80",
              patternView && "text-primary"
            )}
            title={currentPath || (remote ? "Cluster roots" : "Roots")}
          >
            {inRootsView ? (remote ? "Cluster locations" : "Drives & locations") : shortenPath(currentPath, 58)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={() => setCwd(currentPath || null)}
            title="Refresh"
            aria-label="Refresh listing"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" />
          </Button>
        </div>

        {/* quick jumps */}
        {data?.quick && data.quick.length > 0 && !patternView && (
          <div className="flex flex-wrap gap-1">
            {data.quick.map((q) => (
              <button
                key={q.path}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                onClick={() => setCwd(q.path)}
                title={q.path}
              >
                {q.label === "Home" ? (
                  <Home className="h-3 w-3" aria-hidden="true" />
                ) : q.label === "Project" ? (
                  <Server className="h-3 w-3" aria-hidden="true" />
                ) : null}
                {q.label}
              </button>
            ))}
          </div>
        )}

        {/* t312 — plain overflow container + WINDOWED rows: the Radix
            ScrollArea's display:table wrapper sized rows to max-content; a
            virtualized 20,000-row listing needs direct scrollTop access
            anyway, and globals.css already themes every scrollbar thin.
            Rows are pinned h-7 (30px pitch incl. the 2px gap) so the
            translateY window math is exact at any scroll offset. */}
        <div
          ref={listScrollRef}
          onScroll={(ev) => setListScrollTop(ev.currentTarget.scrollTop)}
          className="h-72 overflow-y-auto rounded-lg border"
        >
          <div role="listbox" aria-label="Folders" className="p-1">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {patternView ? "Matching pattern…" : "Listing…"}
              </div>
            )}
            {error && !loading && (
              <div className="px-3 py-6 text-center text-xs text-destructive">{error}</div>
            )}
            {!loading && !error && inRootsView && (
              <div className="grid-cols-[minmax(0,1fr)] grid gap-0.5">
                {(data?.roots ?? []).map((r) => (
                  <button
                    key={r.path}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary/60"
                    onDoubleClick={() => setCwd(r.path)}
                    onClick={() => setCwd(r.path)}
                  >
                    {remote ? (
                      <Server className="h-3.5 w-3.5 shrink-0 text-violet-500/80" aria-hidden="true" />
                    ) : (
                      <HardDrive className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-mono">{r.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            {!loading && !error && !inRootsView && (
              <>
                {/* the virtualized window: a spacer of the FULL list height
                    (n × 30px) keeps the scrollbar honest; the materialized
                    slice rides translateY — a 2,054-image folder scrolls
                    exactly like a 40-row one, at the same DOM cost */}
                {visibleEntries.length > 0 && (
                  <div
                    role="presentation"
                    style={{ height: visibleEntries.length * LIST_ROW_PX }}
                    className="relative"
                  >
                    <div
                      role="presentation"
                      className="absolute inset-x-0 top-0"
                      style={{
                        transform: `translateY(${Math.max(
                          0,
                          Math.floor(listScrollTop / LIST_ROW_PX) - LIST_OVERSCAN
                        ) * LIST_ROW_PX}px)`,
                      }}
                    >
                      {visibleEntries
                        .slice(
                          Math.max(0, Math.floor(listScrollTop / LIST_ROW_PX) - LIST_OVERSCAN),
                          Math.min(
                            visibleEntries.length,
                            Math.ceil((listScrollTop + LIST_VIEW_PX) / LIST_ROW_PX) + LIST_OVERSCAN
                          )
                        )
                        .map((e, i) => {
                          const rowIdx =
                            Math.max(0, Math.floor(listScrollTop / LIST_ROW_PX) - LIST_OVERSCAN) + i;
                          return e.dir ? (
                    <button
                      key={`${e.name}-${rowIdx}`}
                      type="button"
                      role="option"
                      aria-selected={false}
                      aria-posinset={rowIdx + 1}
                      aria-setsize={visibleEntries.length}
                      title={e.name}
                      className="mb-0.5 flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-secondary/60"
                      onDoubleClick={() =>
                        setCwd(currentPath ? `${currentPath.replace(/[\\/]$/, "")}/${e.name}` : e.name)
                      }
                      onClick={() => {
                        // single click on a folder = enter it (fast nav)
                        setCwd(currentPath ? `${currentPath.replace(/[\\/]$/, "")}/${e.name}` : e.name);
                      }}
                    >
                      <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500/80" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{e.name}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                    </button>
                  ) : activeMode === "files" && e.abs ? (
                    <button
                      key={`${e.name}-${rowIdx}`}
                      type="button"
                      role="option"
                      aria-selected={singleFile ? false : selected.has(e.abs)}
                      aria-posinset={rowIdx + 1}
                      aria-setsize={visibleEntries.length}
                      aria-label={singleFile ? `Pick file ${e.name}` : `Select file ${e.name}`}
                      title={singleFile ? e.abs : e.name}
                      className={cn(
                        "mb-0.5 flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-secondary/60",
                        singleFile
                          ? "hover:bg-primary/10"
                          : selected.has(e.abs) && "bg-primary/10 hover:bg-primary/15"
                      )}
                      onClick={() =>
                        singleFile
                          ? pick(e.abs!)
                          : toggleFile(e.abs!)
                      }
                    >
                      {singleFile ? (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />
                      ) : selected.has(e.abs) ? (
                        <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      ) : (
                        <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                      )}
                      <span className={cn("min-w-0 flex-1 truncate", e.img && "font-medium")}>{e.name}</span>
                      {singleFile && (
                        <span className="shrink-0 rounded-sm bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary/90">
                          pick
                        </span>
                      )}
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                        {humanSize(e.size)}
                      </span>
                    </button>
                  ) : (
                    <div
                      key={`${e.name}-${rowIdx}`}
                      role="option"
                      aria-selected={false}
                      aria-posinset={rowIdx + 1}
                      aria-setsize={visibleEntries.length}
                      title={e.name}
                      className={cn(
                        "mb-0.5 flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground",
                        e.img && "text-foreground/90"
                      )}
                    >
                      {e.img ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500/80" aria-hidden="true" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{e.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                        {humanSize(e.size)}
                      </span>
                    </div>
                  );
                        })}
                    </div>
                  </div>
                )}
                {data?.truncated && (
                  <div className="px-2 pb-1 pt-2">
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      {patternView
                        ? `Preview capped at ${(data.entries?.length ?? BROWSER_LIST_MAX).toLocaleString()} matches — ${data.totalMatched?.toLocaleString() ?? "?"} files match in total (import takes them all).`
                        : `Listing shows the first ${(data.entries?.length ?? BROWSER_LIST_MAX).toLocaleString()} of ${data.totalEntries?.toLocaleString() ?? "many"} entries.`}
                    </p>
                    {!patternView && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1 h-6 gap-1 px-2 text-[11px]"
                        onClick={() => currentPath && pick(currentPath)}
                        title="Import the folder itself — the engine enumerates every image in it (any count)"
                      >
                        <FolderOpen className="h-3 w-3" aria-hidden="true" />
                        Import this whole folder — every image
                      </Button>
                    )}
                  </div>
                )}
                {visibleEntries.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {patternView
                      ? "No files match this pattern — try a broader wildcard (e.g. *)"
                      : needle
                        ? `No files match "${filter.trim()}" in this folder`
                        : "Empty folder"}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* quick filter (files mode, directory listing) — narrows the
            listing so "optimiser" finds run_it025_optimiser.star in a
            2,000-round workdir. The multi-select affordances (select-N,
            the DW.mrc chip) are the micrograph import's world. */}
        {activeMode === "files" && !inRootsView && !patternView && (
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative min-w-[150px] flex-1">
              <Filter
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
                aria-hidden="true"
              />
              <Input
                value={filter}
                onChange={(ev) => setFilter(ev.target.value)}
                placeholder="Filter file names — e.g. DW.mrc"
                className="h-7 pl-7 pr-7 text-xs"
                aria-label="Filter the listing by file name substring"
              />
              {filter && (
                <button
                  type="button"
                  onClick={() => setFilter("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground"
                  aria-label="Clear filter"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            {!singleFile && filter.trim() && visibleImages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-[11px]"
                onClick={selectAllImages}
                title="Add every file matching the filter to the selection"
              >
                <CheckSquare className="h-3 w-3" aria-hidden="true" />
                Select {visibleImages.length} match{visibleImages.length === 1 ? "" : "es"}
              </Button>
            )}
            {/* one-click quick select: dose-weighted motioncor2 outputs */}
            {!singleFile && (
              <button
                type="button"
                onClick={() => quickSelect("DW.mrc")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  needle && needle === "dw.mrc"
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-primary/30 bg-primary/5 text-primary/90 hover:border-primary/50 hover:bg-primary/10"
                )}
                title="Select every file containing DW.mrc (dose-weighted) in this listing"
              >
                <Zap className="h-3 w-3" aria-hidden="true" />
                DW.mrc
                <span className="font-mono text-[10px] opacity-70">({countByNeedle("DW.mrc")})</span>
              </button>
            )}
          </div>
        )}

        {/* counters / actions row — the multi-select world's tally; the
            single-file world gets its one-line instruction instead */}
        {activeMode === "files" && !inRootsView && singleFile && (
          <p className="text-[11px] text-muted-foreground" role="status">
            <FileText className="mr-1 inline h-3 w-3 text-primary/70" aria-hidden="true" />
            Click a file to pick it — folders only navigate.
          </p>
        )}
        {activeMode === "files" && !inRootsView && !singleFile && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] text-muted-foreground" role="status">
              {selected.size > 0 ? (
                <>
                  <CheckSquare className="mr-1 inline h-3 w-3 text-primary" aria-hidden="true" />
                  {selected.size} file{selected.size === 1 ? "" : "s"} selected
                </>
              ) : patternView ? (
                <>
                  <ListFilter className="mr-1 inline h-3 w-3 text-primary" aria-hidden="true" />
                  {microCount} image{microCount === 1 ? "" : "s"} match
                  {microCount === 1 ? "es" : ""} the pattern
                </>
              ) : (
                "Click files to select them — selection accumulates across folders"
              )}
            </p>
            {selected.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                onClick={() => setSelected(new Set())}
              >
                <X className="h-3 w-3" aria-hidden="true" />
                Clear
              </Button>
            )}
            {microCount > 0 && !patternView && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-6 gap-1 px-2 text-[11px]"
                onClick={selectAllImages}
                title={
                  needle
                    ? `Add the ${visibleImages.length} visible image(s) matching "${filter.trim()}" to the selection`
                    : "Add every micrograph file in the current listing to the selection"
                }
              >
                <Images className="h-3 w-3" aria-hidden="true" />
                Select all images ({needle ? visibleImages.length : microCount})
              </Button>
            )}
            {patternView && microCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-6 gap-1 px-2 text-[11px]"
                onClick={() => {
                  // import the PATTERN itself (RELION-style: * expanded by the engine)
                  pick(currentPath);
                }}
                title="Import the wildcard pattern as-is — the engine expands it at run time"
              >
                <ListFilter className="h-3 w-3" aria-hidden="true" />
                Use this pattern
              </Button>
            )}
          </div>
        )}
        {!inRootsView && activeMode === "folder" && (
          <p className="text-[11px] text-muted-foreground" role="status">
            {microCount > 0 ? (
              <>
                <Check className="mr-1 inline h-3 w-3 text-emerald-600" aria-hidden="true" />
                {microCount} micrograph{microCount === 1 ? "" : "s"} (.mrc/.mrcs/.tif/.eer)
                {data?.truncated && data.totalEntries != null
                  ? ` shown of ~${data.totalEntries} entries — `
                  : " in this folder — "}
                {data?.truncated
                  ? "Select this folder imports EVERY image in it (the import enumerates the whole folder)"
                  : "switch to the Files tab to pick individual files"}
              </>
            ) : (
              "No micrograph files directly in this folder — they may be in a subfolder"
            )}
          </p>
        )}

        {/* t396 — the pinned action bar: sticky inside the (flex-col,
            scrollable) dialog content, full-bleed through the content
            padding (-mx-6/-mb-6/-mt-3.5) so it reads as the dialog's own
            bottom bar. On tall viewports nothing changes visually. */}
        <DialogFooter className="sticky bottom-0 z-10 -mx-6 -mb-6 -mt-3.5 flex-col gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Input
              value={manual}
              onChange={(ev) => setManual(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && manual.trim()) {
                  // a wildcard jumps straight into the pattern preview
                  if (/[*?]/.test(manual.trim())) setMode("files");
                  setCwd(manual.trim());
                }
              }}
              placeholder={
                remote
                  ? "Cluster path or pattern (/data2/home/… / /projects/movies/*.mrc)"
                  : "Paste a path or pattern (C:\… / /home/… / /data/*.tiff)"
              }
              className="h-8 text-xs font-mono"
              aria-label="Manual path or wildcard pattern"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={!manual.trim()}
              onClick={() => {
                if (/[*?]/.test(manual.trim())) setMode("files");
                setCwd(manual.trim());
              }}
            >
              Go
            </Button>
          </div>
          {singleFile ? (
            /* t396 — the typed path IS the pick: one text box, one button,
               no detour through a listing that may not even resolve (a
               file path does not list) */
            <Button
              size="sm"
              className="shrink-0"
              disabled={!manual.trim()}
              onClick={() => manual.trim() && pick(manual.trim())}
              title="Pick the typed path exactly as written"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Use this path
            </Button>
          ) : activeMode === "files" ? (
            <Button
              size="sm"
              className="shrink-0"
              disabled={selected.size === 0}
              onClick={pickFiles}
            >
              <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Import {selected.size} file{selected.size === 1 ? "" : "s"}
            </Button>
          ) : (
            <Button
              size="sm"
              className="shrink-0"
              disabled={inRootsView || !currentPath}
              onClick={() => !inRootsView && currentPath && pick(currentPath)}
            >
              <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Select this folder
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
