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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
  /** total files matched before the 400-entry preview cap */
  totalMatched?: number;
  error?: string;
}

export type BrowserMode = "folder" | "files";

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

/** Split a picked value into mode + selection seed + initial cwd. */
function parseInitial(
  value: string
): { mode: BrowserMode; selected: string[]; cwd: string | null } {
  const v = value.trim();
  if (!v) return { mode: "folder", selected: [], cwd: null };
  const lines = v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 1) {
    // previous multi-file selection — restore it, start at the first file's folder
    const first = lines.find((l) => l.includes("/")) ?? lines[0];
    const dir = first.includes("/") ? first.slice(0, first.lastIndexOf("/")) : null;
    return { mode: "files", selected: lines, cwd: dir && dir.trim() ? dir : null };
  }
  const single = lines[0];
  if (/[*?]/.test(single)) return { mode: "files", selected: [], cwd: single };
  const dir = single.includes("/") ? single.slice(0, single.lastIndexOf("/")) : null;
  return { mode: "folder", selected: [], cwd: dir && dir.trim() ? dir : null };
}

export function PathBrowserDialog({
  open,
  onOpenChange,
  onPick,
  title,
  description,
  initialPath,
  initialMode = "folder",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** folder path OR newline-joined file list OR wildcard pattern */
  onPick: (value: string) => void;
  title?: string;
  description?: string;
  initialPath?: string;
  initialMode?: BrowserMode;
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

  // reset when re-opened — restore a previous multi-file selection
  React.useEffect(() => {
    if (open) {
      const seed = parseInitial(initialPath ?? "");
      setMode(seed.mode === "files" ? "files" : initialMode);
      setCwd(seed.cwd);
      setManual("");
      setError(null);
      setFilter("");
      setSelected(new Set(seed.selected));
    }
  }, [open, initialPath, initialMode]);

  // the filter is folder-scoped — navigating anywhere resets it
  React.useEffect(() => {
    setFilter("");
  }, [cwd]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = cwd
      ? `/api/fs/browse?path=${encodeURIComponent(cwd)}`
      : "/api/fs/browse";
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
  }, [open, cwd]);

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
    title ?? (displayedMode === "files" ? "Select micrograph files" : "Choose a folder");
  const resolvedDescription =
    description ??
    (displayedMode === "files"
      ? "Multi-select files across folders (selection accumulates), or paste a wildcard pattern like /data/movies/*.tiff."
      : "Navigate to your micrographs folder — local drives and WSL distros are both browsable.");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            {displayedMode === "files" ? (
              <Images className="h-4 w-4 text-primary" aria-hidden="true" />
            ) : (
              <FolderOpen className="h-4 w-4 text-primary" aria-hidden="true" />
            )}
            {resolvedTitle}
          </DialogTitle>
          <DialogDescription className="text-xs">{resolvedDescription}</DialogDescription>
        </DialogHeader>

        {/* mode switcher — Folders | Files (RELION "Select files by") */}
        {!inRootsView && !patternView && (
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
            title="Back to drives / roots"
            aria-label="Back to roots"
          >
            <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
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
            title={currentPath || "Roots"}
          >
            {inRootsView ? "Drives & locations" : shortenPath(currentPath, 58)}
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

        {/* listing — the [&>…div]:!block override undoes Radix's display:table
            wrapper, which otherwise sizes rows to their max-content (a long
            single-word filename then pushes rows ~180px past the viewport) */}
        <ScrollArea className="h-72 rounded-lg border [&>[data-radix-scroll-area-viewport]>div]:!block">
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
                    <HardDrive className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-mono">{r.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            {!loading && !error && !inRootsView && (
              <div className="grid-cols-[minmax(0,1fr)] grid gap-0.5">
                {visibleEntries.map((e, i) =>
                  e.dir ? (
                    <button
                      key={`${e.name}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={false}
                      title={e.name}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary/60"
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
                      key={`${e.name}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={selected.has(e.abs)}
                      aria-label={`Select file ${e.name}`}
                      title={e.name}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary/60",
                        selected.has(e.abs) && "bg-primary/10 hover:bg-primary/15"
                      )}
                      onClick={() => toggleFile(e.abs!)}
                    >
                      {selected.has(e.abs) ? (
                        <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      ) : (
                        <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                      )}
                      <span className={cn("min-w-0 flex-1 truncate", e.img && "font-medium")}>{e.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                        {humanSize(e.size)}
                      </span>
                    </button>
                  ) : (
                    <div
                      key={`${e.name}-${i}`}
                      title={e.name}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground",
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
                  )
                )}
                {data?.truncated && (
                  <p className="px-2 py-1.5 text-[10px] text-muted-foreground">
                    {patternView
                      ? `Preview capped at 400 matches — ${data.totalMatched ?? "?"} files match in total (import takes them all).`
                      : "Listing truncated at 400 entries — enter a subfolder for more."}
                  </p>
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
              </div>
            )}
          </div>
        </ScrollArea>

        {/* quick filter + one-click pattern chips (files mode, directory listing) */}
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
            {filter.trim() && visibleImages.length > 0 && (
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
          </div>
        )}

        {/* counters / actions row */}
        {activeMode === "files" && !inRootsView && (
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
                {microCount} micrograph{microCount === 1 ? "" : "s"} (.mrc/.mrcs/.tif/.eer) in this folder —
                switch to the Files tab to pick individual files
              </>
            ) : (
              "No micrograph files directly in this folder — they may be in a subfolder"
            )}
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-1.5">
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
              placeholder="Paste a path or pattern (C:\… / /home/… / /data/*.tiff)"
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
          {activeMode === "files" ? (
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
