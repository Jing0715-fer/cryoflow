"use client";

/**
 * CryoFlow — filesystem folder picker (client).
 *
 * Backed by GET /api/fs/browse (read-only listing on the app's host — local
 * drives, POSIX mounts, WSL distros via \\wsl.localhost). Mirrors RELION's
 * "Browse…" button: navigate folders, see micrograph counts per folder,
 * paste a path manually, then pick the folder for a path-type job param.
 */

import * as React from "react";
import { ArrowUp, Check, ChevronRight, Folder, FolderOpen, HardDrive, Home, Loader2, RefreshCw, Server, Terminal } from "lucide-react";
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
  title = "Choose a folder",
  description = "Navigate to your micrographs folder — local drives and WSL distros are both browsable.",
  initialPath,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (path: string) => void;
  title?: string;
  description?: string;
  initialPath?: string;
}) {
  const [cwd, setCwd] = React.useState<string | null>(initialPath?.trim() || null);
  const [data, setData] = React.useState<BrowseResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState("");

  // reset when re-opened
  React.useEffect(() => {
    if (open) {
      setCwd(initialPath?.trim() || null);
      setManual("");
      setError(null);
    }
  }, [open, initialPath]);

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

  const currentPath = data?.ok ? data.path : "";
  const inRootsView = !data?.ok || data.path === "";
  const selected = inRootsView ? "" : currentPath;
  const microCount = data?.ok ? (data.micrographs ?? 0) : 0;

  const pick = (path: string) => {
    onPick(path);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FolderOpen className="h-4 w-4 text-primary" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>

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
              title="Up one folder"
              aria-label="Up one folder"
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/80" title={currentPath || "Roots"}>
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
        {data?.quick && data.quick.length > 0 && (
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

        {/* listing */}
        <ScrollArea className="h-72 rounded-lg border">
          <div role="listbox" aria-label="Folders" className="p-1">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Listing…
              </div>
            )}
            {error && !loading && (
              <div className="px-3 py-6 text-center text-xs text-destructive">
                {error}
              </div>
            )}
            {!loading && !error && inRootsView && (
              <div className="grid gap-0.5">
                {(data?.roots ?? []).map((r) => (
                  <button
                    key={r.path}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary/60"
                    onDoubleClick={() => setCwd(r.path)}
                    onClick={() => setCwd(r.path)}
                  >
                    <HardDrive className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />
                    <span className="flex-1 truncate font-mono">{r.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            {!loading && !error && !inRootsView && (
              <div className="grid gap-0.5">
                {(data?.entries ?? []).map((e, i) =>
                  e.dir ? (
                    <button
                      key={`${e.name}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary/60"
                      onDoubleClick={() => setCwd(currentPath ? `${currentPath.replace(/[\\/]$/, "")}/${e.name}` : e.name)}
                      onClick={() => {
                        // single click on a folder = enter it (fast nav)
                        setCwd(currentPath ? `${currentPath.replace(/[\\/]$/, "")}/${e.name}` : e.name);
                      }}
                    >
                      <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500/80" aria-hidden="true" />
                      <span className="flex-1 truncate">{e.name}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                    </button>
                  ) : (
                    <div
                      key={`${e.name}-${i}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground",
                        e.img && "text-foreground/90"
                      )}
                    >
                      {e.img ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500/80" aria-hidden="true" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className="flex-1 truncate">{e.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                        {humanSize(e.size)}
                      </span>
                    </div>
                  )
                )}
                {data?.truncated && (
                  <p className="px-2 py-1.5 text-[10px] text-muted-foreground">
                    Listing truncated at 400 entries — enter a subfolder for more.
                  </p>
                )}
                {(data?.entries ?? []).length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Empty folder
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* micrograph counter */}
        {!inRootsView && (
          <p className="text-[11px] text-muted-foreground" role="status">
            {microCount > 0 ? (
              <>
                <Check className="mr-1 inline h-3 w-3 text-emerald-600" aria-hidden="true" />
                {microCount} micrograph{microCount === 1 ? "" : "s"} (.mrc/.mrcs/.tif) in this folder
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
                if (ev.key === "Enter" && manual.trim()) setCwd(manual.trim());
              }}
              placeholder="Paste a path (C:\… / /home/… / /mnt/c/…)"
              className="h-8 text-xs font-mono"
              aria-label="Manual folder path"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={!manual.trim()}
              onClick={() => setCwd(manual.trim())}
            >
              Go
            </Button>
          </div>
          <Button
            size="sm"
            className="shrink-0"
            disabled={!selected}
            onClick={() => selected && pick(selected)}
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Select this folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
