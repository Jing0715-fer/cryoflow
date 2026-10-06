"use client";

/**
 * CryoFlow — the "New project" dialog.
 *
 * t615 — this file used to hold the whole sidebar "Projects" panel (cards,
 * stats, rename, delete) on top of the dialog; the panel was retired by the
 * Workspaces tab (t613/t614) and had been dead code since, so only the dialog
 * — which the project dashboard still opens — remains. All mutations go
 * through the zustand store (createProject) which talks to /api/projects*.
 */

import * as React from "react";
import {
  CheckCircle2,
  FolderGit2,
  Loader2,
  Plus,
  Server,
  Snowflake,
  TriangleAlert,
} from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  RemoteClusterDialog,
  readActiveRemoteConnectionId,
  useRemoteConnections,
} from "./remote-cluster-dialog";

/* ------------------------------------------------------------------ */
/* New project dialog                                                   */
/* ------------------------------------------------------------------ */

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createProject = useWorkflowStore((s) => s.createProject);
  const system = useWorkflowStore((s) => s.system);
  const projects = useWorkflowStore((s) => s.projects);

  const [name, setName] = React.useState("");
  const [mode, setMode] = React.useState("spa");
  // t300 — the data location: local disk vs a saved SSH cluster (remote
  // project: the import browser browses THAT cluster, jobs submit there)
  const [location, setLocation] = React.useState<"local" | "remote">("local");
  const [connId, setConnId] = React.useState("");
  const [clusterOpen, setClusterOpen] = React.useState(false);
  // reload the connection list whenever the dialog opens (and again after
  // the nested manager closes — a connection may have just been saved)
  const { connections, reload } = useRemoteConnections(open);
  React.useEffect(() => {
    if (clusterOpen) return;
    reload();
  }, [clusterOpen, reload]);

  const [creating, setCreating] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const trimmed = name.trim();
  const nameError =
    touched && (trimmed.length < 1 || trimmed.length > 80)
      ? "Name must be 1–80 characters"
      : null;
  // gentle, non-blocking duplicate hint (Task 27 leftover): same-name
  // projects are LEGAL (the sorter tie-breaks by id), but cards, exports
  // and CSVs become hard to tell apart — so we nudge, never block
  const duplicateName =
    trimmed.length > 0 &&
    projects.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
  const relionMissing = system !== null && !system.found;
  const relionWslOnly = system !== null && system.found && system.execution === "wsl";

  React.useEffect(() => {
    if (open) {
      setName("");
      setMode("spa");
      setLocation("local");
      setConnId("");
      setCreating(false);
      setTouched(false);
    }
  }, [open]);

  // default connection pick: the ACTIVE one (the cluster the user last
  // worked with), else the first saved connection
  React.useEffect(() => {
    if (location !== "remote" || !open) return;
    setConnId((prev) => {
      if (prev && connections.some((c) => c.id === prev)) return prev;
      const active = readActiveRemoteConnectionId();
      if (active && connections.some((c) => c.id === active)) return active;
      return connections[0]?.id ?? "";
    });
  }, [open, location, connections]);

  const selectedConn = connections.find((c) => c.id === connId) ?? null;
  const remoteBlocked = location === "remote" && connections.length === 0;

  const handleCreate = async () => {
    setTouched(true);
    if (trimmed.length < 1 || trimmed.length > 80) return;
    if (location === "remote" && !selectedConn) return;
    setCreating(true);
    const ok = await createProject({
      name: trimmed,
      mode,
      ...(location === "remote" && selectedConn ? { remoteConnectionId: selectedConn.id } : {}),
    });
    setCreating(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A fresh cryo-EM workspace — every project runs the real RELION engine.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-project-name">Name</Label>
            <Input
              id="new-project-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder="e.g. Apoferritin prep 04"
              aria-invalid={nameError ? true : undefined}
            />
            {nameError ? (
              <p className="text-[11px] text-destructive">{nameError}</p>
            ) : duplicateName ? (
              <p className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden="true" />
                <span>
                  A project named “{trimmed}” already exists — you can still
                  create this one, but a distinct name keeps cards and exports
                  easy to tell apart.
                </span>
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="new-project-mode">Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger id="new-project-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spa">SPA · single particle</SelectItem>
                <SelectItem value="tomo">Tomography</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* t300 — the data location: where this project's DATA lives. Local
              keeps the classic contract (browse this machine's drives); remote
              binds the project to a saved SSH cluster — the import browser
              browses THAT cluster's filesystem and jobs are submitted there.
              t301 — radio-card styling: the first cut was a quiet segmented
              pill that users scrolled past without registering (the #1 "where
              is the local/cluster option?" question) — bordered cards, left-
              aligned labels and a real question line make the choice
              unmissable without changing a line of behavior. */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Data location</Label>
              <span className="text-[10px] text-muted-foreground">
                where the data lives
              </span>
            </div>
            <div
              className="grid grid-cols-2 gap-1.5"
              role="tablist"
              aria-label="Data location"
            >
              {(
                [
                  { value: "local", label: "This machine", hint: "local drives · browse & run here" },
                  { value: "remote", label: "Cluster (SSH)", hint: "data stays on the cluster" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={location === opt.value}
                  onClick={() => setLocation(opt.value)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                    location === opt.value
                      ? "border-primary/50 bg-primary/5 shadow-sm"
                      : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    {opt.value === "local" ? (
                      <FolderGit2 className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Server className="size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    {opt.label}
                  </span>
                  <span className="text-[10px] font-normal leading-snug text-muted-foreground">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {location === "remote" ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-project-connection">Cluster connection</Label>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setClusterOpen(true)}
                >
                  Manage clusters…
                </button>
              </div>
              {connections.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-3 py-5 text-center">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Server className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">No cluster connections yet</p>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                      Add an SSH login node (host, user, password or key) — then pick it here.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setClusterOpen(true)}
                  >
                    Add a cluster
                  </Button>
                </div>
              ) : (
                <>
                  <Select value={connId} onValueChange={setConnId}>
                    <SelectTrigger id="new-project-connection" className="text-xs">
                      <SelectValue placeholder="Saved IP / cluster" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                c.lastProbe?.ok
                                  ? "bg-emerald-500"
                                  : c.lastProbe
                                    ? "bg-danger"
                                    : "bg-slate-400 dark:bg-slate-500"
                              )}
                              aria-hidden="true"
                            />
                            <span className="max-w-[220px] truncate">
                              {c.name || `${c.username}@${c.host}`}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{c.host}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedConn ? (
                    <p className="flex items-start gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1.5 text-[10px] leading-snug text-violet-700 dark:text-violet-400">
                      <Server className="mt-px size-3 shrink-0" aria-hidden="true" />
                      <span>
                        Remote project on <span className="font-mono">{selectedConn.username}@{selectedConn.host}</span> — the
                        import browser lists that cluster&apos;s folders (movies stay there, zero upload), and job submission
                        offers its detected nodes + GPU count.
                      </span>
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <p className="flex items-start gap-1.5 rounded-md border bg-secondary/40 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
              <FolderGit2 className="mt-px size-3 shrink-0" aria-hidden="true" />
              <span>
                Local project — browse this machine&apos;s drives (and WSL distros) for micrographs; jobs run on the local
                RELION (or any SSH cluster, per-run).
              </span>
            </p>
          )}
          <div className="flex items-center gap-2 rounded-md border border-running/30 bg-running/10 px-2.5 py-2 text-[11px] leading-relaxed text-teal-700 dark:text-teal-400">
            <Snowflake className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Engine · real RELION{system?.version ? ` ${system.version}` : ""}
              {(system?.installs.length ?? 0) > 1
                ? ` — ${(system?.installs.length ?? 0) - 1} other install(s) detected, switchable from the top-bar chip`
                : ""}
            </span>
          </div>
          {relionMissing && (
            <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              RELION not detected — jobs will fail to start honestly.
            </p>
          )}
          {relionWslOnly && (
            <p className="flex items-start gap-2 rounded-md border border-running/30 bg-running/10 px-2.5 py-2 text-[11px] leading-relaxed text-teal-700 dark:text-teal-400">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              RELION {system?.version ?? "?"} detected in WSL
              {system?.wsl.distro ? ` (${system.wsl.distro})` : ""} — jobs run
              through the built-in WSL bridge (executed inside the distro, paths
              translated automatically).
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={creating || trimmed.length < 1 || remoteBlocked}
          >
            {creating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* the nested cluster manager — a connection saved there becomes
          selectable the moment it closes (reload on close) */}
      <RemoteClusterDialog
        open={clusterOpen}
        onOpenChange={(v) => setClusterOpen(v)}
      />
    </Dialog>
  );
}

