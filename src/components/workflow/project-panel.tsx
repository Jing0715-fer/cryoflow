"use client";

/**
 * CryoFlow — project management panel (sidebar "Projects" tab).
 *
 * Lists every project with mode/engine badges, job stats and quick actions
 * (switch / rename / delete), plus a "New project" dialog. All mutations go
 * through the zustand store (createProject / renameProject / deleteProject /
 * switchProject) which talks to /api/projects*.
 */

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderGit2,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  Snowflake,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import type { ProjectSummaryDTO } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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

/* ------------------------------------------------------------------ */
/* Local types (ProjectSummaryDTO is frozen — the API serves extras)    */
/* ------------------------------------------------------------------ */

interface ProjectStats {
  total: number;
  running: number;
  /** waiting for an upstream job (amber, not failed) */
  pending?: number;
  completed: number;
  failed: number;
}

/** ProjectSummaryDTO + the extra fields GET /api/projects actually returns. */
interface ProjectCard extends ProjectSummaryDTO {
  createdAt?: string;
  stats?: ProjectStats;
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

function ModeBadge({ mode }: { mode: string }) {
  const tomo = mode === "tomo";
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 text-[9px] font-semibold uppercase tracking-wider",
        tomo
          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
          : "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400"
      )}
    >
      {tomo ? "TOMO" : "SPA"}
    </Badge>
  );
}

function EngineBadge() {
  return (
    <Badge
      variant="outline"
      className="h-5 border-emerald-500/40 bg-emerald-500/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
      title="Jobs run on the REAL RELION engine (real binaries, real data)"
    >
      RELION
    </Badge>
  );
}

function StatChip({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone?: string;
}) {
  return (
    <span
      className="inline-flex h-5 items-center gap-1 rounded-md bg-secondary/60 px-1.5 text-[10px] font-medium tabular-nums"
      title={`${value} ${label}`}
    >
      <span className={cn("inline-flex", tone)}>{icon}</span>
      {value}
    </span>
  );
}

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

  const [name, setName] = React.useState("");
  const [mode, setMode] = React.useState("spa");
  const [creating, setCreating] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const trimmed = name.trim();
  const nameError =
    touched && (trimmed.length < 1 || trimmed.length > 80)
      ? "Name must be 1–80 characters"
      : null;
  const relionMissing = system !== null && !system.found;
  const relionWslOnly = system !== null && system.found && system.execution === "wsl";

  React.useEffect(() => {
    if (open) {
      setName("");
      setMode("spa");
      setCreating(false);
      setTouched(false);
    }
  }, [open]);

  const handleCreate = async () => {
    setTouched(true);
    if (trimmed.length < 1 || trimmed.length > 80) return;
    setCreating(true);
    const ok = await createProject({ name: trimmed, mode });
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
            {nameError && (
              <p className="text-[11px] text-destructive">{nameError}</p>
            )}
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
          <div className="flex items-center gap-2 rounded-md border border-teal-500/30 bg-teal-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-teal-700 dark:text-teal-400">
            <Snowflake className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Engine · real RELION{system?.version ? ` ${system.version}` : ""}
              {(system?.installs.length ?? 0) > 1
                ? ` — ${(system?.installs.length ?? 0) - 1} other install(s) detected, switchable from the top-bar chip`
                : ""}
            </span>
          </div>
          {relionMissing && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              RELION not detected — jobs will fail to start honestly.
            </p>
          )}
          {relionWslOnly && (
            <p className="flex items-start gap-2 rounded-md border border-teal-500/30 bg-teal-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-teal-700 dark:text-teal-400">
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
          <Button onClick={() => void handleCreate()} disabled={creating || trimmed.length < 1}>
            {creating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Project card                                                         */
/* ------------------------------------------------------------------ */

function ProjectCardRow({
  project,
  isActive,
  isPending,
  onlyProject,
  editing,
  onStartEdit,
  onCancelEdit,
  onCommitRename,
  onRequestDelete,
  onSelect,
  editName,
  onEditNameChange,
}: {
  project: ProjectCard;
  isActive: boolean;
  isPending: boolean;
  onlyProject: boolean;
  editing: boolean;
  editName: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onCommitRename: () => void;
  onEditNameChange: (v: string) => void;
  onRequestDelete: () => void;
  onSelect: () => void;
}) {
  const stats = project.stats;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !editing && onSelect()}
      onKeyDown={(e) => {
        if (editing) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-current={isActive ? "true" : undefined}
      title={isActive ? `Active project · ${project.name}` : `Switch to ${project.name}`}
      className={cn(
        "group relative w-full cursor-pointer rounded-xl border bg-card p-3 text-left transition-all hover:shadow-sm",
        isActive
          ? "border-primary/60 ring-1 ring-primary/30"
          : "border-border hover:border-foreground/20",
        isPending && "opacity-70"
      )}
    >
      {/* Active mini badge */}
      {isActive && (
        <Badge className="absolute -top-2 left-3 h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wider">
          Active
        </Badge>
      )}

      {/* Name row (or inline rename input) */}
      {editing ? (
        <Input
          value={editName}
          maxLength={80}
          autoFocus
          onChange={(e) => onEditNameChange(e.target.value)}
          onBlur={onCommitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommitRename();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onCancelEdit();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Project name"
          className="h-8 text-sm font-medium"
        />
      ) : (
        <div className="flex items-center gap-2 pr-14">
          {isPending ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <FolderGit2
              className={cn(
                "size-3.5 shrink-0",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-hidden="true"
            />
          )}
          <p className="truncate text-sm font-medium" title={project.name}>
            {project.name}
          </p>
        </div>
      )}

      {/* Badges + stats */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ModeBadge mode={project.mode} />
        <EngineBadge />
        <span className="ml-auto flex items-center gap-1">
          <StatChip
            icon={<Boxes className="size-3" aria-hidden="true" />}
            value={stats?.total ?? 0}
            label="jobs"
            tone="text-muted-foreground"
          />
          {(stats?.running ?? 0) > 0 && (
            <StatChip
              icon={<Loader2 className="size-3 animate-spin" aria-hidden="true" />}
              value={stats?.running ?? 0}
              label="running"
              tone="text-teal-600 dark:text-teal-400"
            />
          )}
          {(stats?.pending ?? 0) > 0 && (
            <StatChip
              icon={<Clock className="size-3" aria-hidden="true" />}
              value={stats?.pending ?? 0}
              label="pending"
              tone="text-amber-600 dark:text-amber-400"
            />
          )}
          {(stats?.completed ?? 0) > 0 && (
            <StatChip
              icon={<CheckCircle2 className="size-3" aria-hidden="true" />}
              value={stats?.completed ?? 0}
              label="completed"
              tone="text-emerald-600 dark:text-emerald-400"
            />
          )}
        </span>
      </div>

      {/* Created */}
      {project.createdAt && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
        </p>
      )}

      {/* Hover actions */}
      {!editing && (
        <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
            aria-label={`Rename ${project.name}`}
            title="Rename project"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRequestDelete();
            }}
            disabled={onlyProject}
            aria-label={`Delete ${project.name}`}
            title={
              onlyProject
                ? "Cannot delete the last project — create another one first"
                : "Delete project"
            }
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel root                                                           */
/* ------------------------------------------------------------------ */

export function ProjectPanel() {
  const projects = useWorkflowStore((s) => s.projects) as ProjectCard[];
  const project = useWorkflowStore((s) => s.project);
  const switchProject = useWorkflowStore((s) => s.switchProject);
  const renameProject = useWorkflowStore((s) => s.renameProject);
  const deleteProject = useWorkflowStore((s) => s.deleteProject);
  const setView = useWorkflowStore((s) => s.setView);

  const [pendingSwitch, setPendingSwitch] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ProjectCard | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Inline rename state
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);

  const activeId = project?.id ?? null;
  const onlyProject = projects.length <= 1;

  const handleSelect = (p: ProjectCard) => {
    if (pendingSwitch || p.id === activeId || editingId) return;
    setPendingSwitch(p.id);
    void switchProject(p.id).finally(() => setPendingSwitch(null));
  };

  const startEdit = (p: ProjectCard) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const commitRename = () => {
    const id = editingId;
    if (!id) return;
    const trimmed = editName.trim();
    const current = projects.find((p) => p.id === id)?.name ?? "";
    if (!trimmed || trimmed === current || renaming) {
      cancelEdit();
      return;
    }
    setRenaming(true);
    void renameProject(id, trimmed.slice(0, 80)).finally(() => {
      setRenaming(false);
      cancelEdit();
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const ok = await deleteProject(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (ok) cancelEdit();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 p-3 pb-2">
        <FolderGit2 className="size-3.5 text-primary" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Projects
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground/70">
          {projects.length}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 gap-1 px-2 text-[11px]"
          onClick={() => setCreateOpen(true)}
          aria-label="Create a new project"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          New
        </Button>
      </div>

      {/* List */}
      {projects.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <FolderGit2 className="size-5" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium">No projects yet</p>
          <p className="max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
            Create your first cryo-EM workspace to start building a pipeline.
          </p>
          <Button size="sm" className="mt-1 gap-1" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            New project
          </Button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 pt-1">
          {projects.map((p) => (
            <ProjectCardRow
              key={p.id}
              project={p}
              isActive={p.id === activeId}
              isPending={pendingSwitch === p.id}
              onlyProject={onlyProject}
              editing={editingId === p.id}
              editName={editName}
              onStartEdit={() => startEdit(p)}
              onCancelEdit={cancelEdit}
              onCommitRename={commitRename}
              onEditNameChange={setEditName}
              onRequestDelete={() => setDeleteTarget(p)}
              onSelect={() => handleSelect(p)}
            />
          ))}
        </div>
      )}

      {/* shortcut to the full dashboard page */}
      <button
        type="button"
        onClick={() => setView("dashboard")}
        title="Open the full project dashboard page (Shift+D)"
        className="group flex shrink-0 items-center gap-2 border-t px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        <LayoutDashboard className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1">Open project dashboard</span>
        <ChevronRight
          className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name ?? ""}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project with all of its jobs, connections and
              saved parameters. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New project */}
      <NewProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
