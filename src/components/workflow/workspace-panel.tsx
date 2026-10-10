"use client";

/**
 * CryoFlow — workspace management panel (sidebar "Workspaces" tab).
 *
 * One project holds several workspaces (sub-canvases). Each row shows live
 * job stats (derived client-side so poll ticks keep them fresh) and quick
 * actions: switch / rename / delete (jobs fall back to the default space).
 * Cross-workspace moves and copy-as-link live on the job card's context
 * menu — this panel is the navigator.
 *
 * t614 — the panel's faces join the arrival grammar their dashboard
 * siblings started (t611/t612/t613): header → hint → cards → stats
 * itemize, riding the family's receipt word (zero new keyframes). The
 * full timing law lives in the WS_BASE_MS docblock below; the short
 * version: the base is a USER-GESTURE beat (the panel mounts on the
 * user's own tab click), and the cards' delays come from a MOUNT LEDGER
 * (a ticket belongs to a face, not a seat — deletion shifts indices,
 * and a shifted delay on a finished animation replays it).
 */

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  Layers,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import type { WorkspaceDTO } from "@/lib/types";
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
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Arrival timing (t614)                                                */
/* ------------------------------------------------------------------ */

/* t614 — the wave's timing words, the single source of truth. The base
 * is a USER-GESTURE beat: the panel mounts on the user's own tab click
 * (Radix TabsContent unmounts on leave — every entry is a fresh
 * surfacing), so 90ms sits between the find bar's gesture echoes (status
 * row 60ms, type row 120ms); the dashboard's 350ms card-arrival beat
 * would read as lag on a click the user just made.
 *
 * The wave: header (BASE) → hint (BASE+STEP) → card i (BASE +
 * (HEAD_FACES + i)×STEP via the MOUNT LEDGER below) → its stats row
 * itemizes one step after its card (+STEP). Card i and card i-1's stats
 * share a beat — the wave interleaves; every 24ms something starts.
 * Canonical single-workspace world: 90 / 114 / 138 / 162 — settled at
 * 162 + 240 = 402ms; each extra card adds 24ms to the tail.
 *
 * THE MOUNT LEDGER (t613's law, second consumer): a ticket belongs to a
 * FACE, not a seat. Workspace creation APPENDS to the store list
 * (append-safe), but a DELETION shifts every later row's index — and a
 * shifted delay on a finished animation replays it (re-render becoming
 * re-arrival). So cards keep a tail ledger keyed by workspace id:
 * filled on miss at render time (the Task 88 pattern — no extra frame,
 * no effect), never rewritten. The ledger ref dies with the Radix
 * unmount on tab leave, so every fresh entry re-issues it — the t613
 * "project switch resets the ledger" semantics, for free. */
const WS_BASE_MS = 90;
const WS_STEP_MS = 24;
/** the fixed head of the wave (faces before the cards): header, hint */
const WS_HEAD_FACES = 2;

interface LiveStats {
  total: number;
  running: number;
  pending: number;
  completed: number;
  links: number;
}

function WorkspaceRow({
  workspace,
  isActive,
  isDefault,
  stats,
  editing,
  editName,
  arrivalDelay,
  onStartEdit,
  onCancelEdit,
  onCommitRename,
  onEditNameChange,
  onRequestDelete,
  onSelect,
}: {
  workspace: WorkspaceDTO;
  isActive: boolean;
  isDefault: boolean;
  stats: LiveStats;
  editing: boolean;
  editName: string;
  /** t614 — the card's wave ticket in ms (the mount ledger's word for
   * this face). Absent = mount without a ticket (rides no wave). The
   * stats row derives its own +STEP beat from this — one number in, the
   * itemize rhythm computed next to the row that owns it. */
  arrivalDelay?: number;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onCommitRename: () => void;
  onEditNameChange: (v: string) => void;
  onRequestDelete: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-ws-card={arrivalDelay !== undefined ? "" : undefined}
      style={
        arrivalDelay !== undefined
          ? ({ "--wd": `${arrivalDelay}ms` } as React.CSSProperties)
          : undefined
      }
      aria-current={isActive ? "true" : undefined}
      title={
        isActive
          ? `Active workspace · ${workspace.name}`
          : `Switch the canvas to ${workspace.name}`
      }
      onClick={() => !editing && onSelect()}
      onKeyDown={(e) => {
        if (editing) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative w-full cursor-pointer rounded-xl border bg-card p-3 text-left outline-none transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "border-primary/60 ring-1 ring-primary/30"
          : "border-border hover:border-foreground/20"
      )}
    >
      {/* name row / inline rename */}
      {editing ? (
        <Input
          value={editName}
          maxLength={60}
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
          aria-label="Workspace name"
          className="h-8 text-sm font-medium"
        />
      ) : (
        <div className="flex items-center gap-2 pr-14">
          <Layers
            className={cn(
              "size-3.5 shrink-0",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            aria-hidden="true"
          />
          <p className="truncate text-sm font-medium" title={workspace.name}>
            {workspace.name}
          </p>
          {isDefault && (
            <Badge
              variant="outline"
              className="h-4 shrink-0 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
              title="The project's default workspace — new jobs land here and deleted workspaces fall back to it"
            >
              default
            </Badge>
          )}
          {/* Active badge lives INSIDE the card — the old floating -top-2
              badge was clipped by the scroll container's top edge on the
              first row (overflow-y-auto crops overflowing children) */}
          {isActive && (
            <Badge className="ml-auto h-4 shrink-0 gap-1 px-1.5 text-[9px] font-semibold uppercase tracking-wider">
              <span
                className="inline-block size-1.5 rounded-full bg-primary-foreground"
                aria-hidden="true"
              />
              Active
            </Badge>
          )}
        </div>
      )}

      {/* live stats — the row is ONE face of the wave (t614): the
          entrance names the row, never the chips inside it — the running
          chip's animate-spin is a living word an entrance shorthand
          would kill. The row itemizes one step after its card. */}
      <div
        data-ws-stats={arrivalDelay !== undefined ? "" : undefined}
        style={
          arrivalDelay !== undefined
            ? ({ "--wd": `${arrivalDelay + WS_STEP_MS}ms` } as React.CSSProperties)
            : undefined
        }
        className="mt-2 flex flex-wrap items-center gap-1.5"
      >
        <span
          className="inline-flex h-5 items-center gap-1 rounded-md bg-secondary/60 px-1.5 text-[10px] font-medium tabular-nums"
          title={`${stats.total} job${stats.total === 1 ? "" : "s"} in this workspace`}
        >
          {stats.total} job{stats.total === 1 ? "" : "s"}
        </span>
        {stats.links > 0 && (
          <span
            className="inline-flex h-5 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 text-[10px] font-medium tabular-nums text-primary"
            title={`${stats.links} linked cop${stats.links === 1 ? "y" : "ies"} — they mirror originals from other workspaces`}
          >
            <Link2 className="size-3" aria-hidden="true" />
            {stats.links}
          </span>
        )}
        {stats.running > 0 && (
          <span
            className="ws-running inline-flex h-5 items-center gap-1 rounded-md bg-running/10 px-1.5 text-[10px] font-medium tabular-nums text-running"
            title={`${stats.running} running`}
          >
            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {stats.running}
          </span>
        )}
        {stats.pending > 0 && (
          <span
            className="inline-flex h-5 items-center gap-1 rounded-md bg-warning/10 px-1.5 text-[10px] font-medium tabular-nums text-warning"
            title={`${stats.pending} pending — waiting for an upstream job`}
          >
            <Clock className="size-3" aria-hidden="true" />
            {stats.pending}
          </span>
        )}
        {stats.completed > 0 && (
          <span
            className="inline-flex h-5 items-center gap-1 rounded-md bg-success/10 px-1.5 text-[10px] font-medium tabular-nums text-success"
            title={`${stats.completed} completed`}
          >
            <CheckCircle2 className="size-3" aria-hidden="true" />
            {stats.completed}
          </span>
        )}
      </div>

      {/* hover actions */}
      {!editing && (
        <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 hover-none:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
            aria-label={`Rename ${workspace.name}`}
            title="Rename workspace"
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
            disabled={isDefault}
            aria-label={`Delete ${workspace.name}`}
            title={
              isDefault
                ? "The default workspace cannot be deleted — create another workspace first"
                : "Delete workspace (its jobs move to the default one)"
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

export function WorkspacePanel() {
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  const jobs = useWorkflowStore((s) => s.jobs);
  const switchWorkspace = useWorkflowStore((s) => s.switchWorkspace);
  const createWorkspace = useWorkflowStore((s) => s.createWorkspace);
  const renameWorkspace = useWorkflowStore((s) => s.renameWorkspace);
  const deleteWorkspace = useWorkflowStore((s) => s.deleteWorkspace);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<WorkspaceDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");

  // live stats derived from the store's job list — poll ticks keep these
  // fresh without extra requests (server stats only seed the first paint)
  const liveStats = React.useMemo(() => {
    const map = new Map<string, LiveStats>();
    for (const w of workspaces) {
      map.set(w.id, { total: 0, running: 0, pending: 0, completed: 0, links: 0 });
    }
    for (const j of jobs) {
      const key = j.workspaceId ?? "";
      const s = map.get(key) ?? { total: 0, running: 0, pending: 0, completed: 0, links: 0 };
      s.total++;
      if (j.linkedJobId) s.links++;
      if (j.status === "running") s.running++;
      else if (j.status === "pending") s.pending++;
      else if (j.status === "completed") s.completed++;
      map.set(key, s);
    }
    return map;
  }, [jobs, workspaces]);

  const defaultId = workspaces[0]?.id ?? null;

  const startEdit = (w: WorkspaceDTO) => {
    setEditingId(w.id);
    setEditName(w.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const commitRename = () => {
    const id = editingId;
    if (!id) return;
    const trimmed = editName.trim();
    const current = workspaces.find((w) => w.id === id)?.name ?? "";
    if (!trimmed || trimmed === current) {
      cancelEdit();
      return;
    }
    void renameWorkspace(id, trimmed.slice(0, 60)).finally(cancelEdit);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const ok = await deleteWorkspace(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (ok) cancelEdit();
  };

  // t614 — the wave's mount ledger: one ticket per card, keyed by
  // workspace id, filled on miss at render time (the Task 88 pattern —
  // no extra frame, no effect), never rewritten. A lazy useState holds
  // the Map (the react-compiler lint forbids render-phase ref reads —
  // and the lifecycle is identical anyway): it dies with the Radix
  // unmount on tab leave, so every fresh entry re-issues the ledger (a
  // new surfacing) — no explicit reset exists or is needed.
  const [wsWave] = React.useState<Map<string, number>>(() => new Map());

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (trimmed.length < 1 || trimmed.length > 60 || creating) return;
    setCreating(true);
    const ok = await createWorkspace(trimmed.slice(0, 60));
    setCreating(false);
    if (ok) {
      setNewName("");
      setCreateOpen(false);
    }
  };

  // t614 — the ledger's fill-on-miss pass, BEFORE the JSX so the tickets
  // read the SAME order the cards render in (top of the list = the wave's
  // first card slot). Existing tickets are never rewritten — that is the
  // whole law: a rewritten delay on a finished animation replays it.
  const wave = wsWave;
  const waveTicketOf = (id: string): number => {
    let t = wave.get(id);
    if (t === undefined) {
      t = WS_BASE_MS + (WS_HEAD_FACES + wave.size) * WS_STEP_MS;
      wave.set(id, t);
    }
    return t;
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-ws-arrival="">
      {/* header */}
      <div
        data-ws-header=""
        style={{ "--wd": `${WS_BASE_MS}ms` } as React.CSSProperties}
        className="flex shrink-0 items-center gap-2 p-3 pb-2"
      >
        <Layers className="size-3.5 text-primary" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workspaces
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground/70">
          {workspaces.length}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 gap-1 px-2 text-[11px]"
          onClick={() => setCreateOpen(true)}
          aria-label="Create a new workspace"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          New
        </Button>
      </div>

      {/* hint */}
      <p
        data-ws-hint=""
        style={{ "--wd": `${WS_BASE_MS + WS_STEP_MS}ms` } as React.CSSProperties}
        className="px-3 pb-2 text-[10px] leading-relaxed text-muted-foreground/80"
      >
        Each workspace is a separate canvas inside the project. Right-click a
        job card → <span className="font-medium text-foreground/80">Copy as link to…</span> to
        continue its pipeline in another workspace.
      </p>

      {/* list */}
      {workspaces.length === 0 ? (
        <div
          data-ws-empty=""
          style={{
            "--wd": `${WS_BASE_MS + WS_HEAD_FACES * WS_STEP_MS}ms`,
          } as React.CSSProperties}
          className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Layers className="size-5" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium">No workspaces yet</p>
          <Button size="sm" className="mt-1 gap-1" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            New workspace
          </Button>
        </div>
      ) : (
        <div
          tabIndex={0}
          aria-label="Workspaces"
          className="nice-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
        >
          {/* t803 — the workspace list's ground gains the stop (the
              second-pass census); ring-inset — the list runs edge-to-edge.
              The t806 audit re-walked the row debt this comment once
              named: the rows carried their keyboard face all along
              (role=button + Enter/Space, on the row since the workspace
              architecture landed), so the real residue was the INVISIBLE
              focus — tabbing to a row showed no ring anywhere. t806
              teaches the row the card family's focus ring. */}
          {workspaces.map((w) => (
            <WorkspaceRow
              key={w.id}
              workspace={w}
              isActive={w.id === activeWorkspaceId}
              isDefault={w.id === defaultId}
              stats={liveStats.get(w.id) ?? { total: 0, running: 0, pending: 0, completed: 0, links: 0 }}
              editing={editingId === w.id}
              editName={editName}
              arrivalDelay={waveTicketOf(w.id)}
              onStartEdit={() => startEdit(w)}
              onCancelEdit={cancelEdit}
              onCommitRename={commitRename}
              onEditNameChange={setEditName}
              onRequestDelete={() => setDeleteTarget(w)}
              onSelect={() => switchWorkspace(w.id)}
            />
          ))}
        </div>
      )}

      {/* delete confirmation */}
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
              The workspace is removed, but its jobs (including linked copies)
              are moved to the project&apos;s default workspace — nothing is
              deleted. This action cannot be undone.
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
              {deleting ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              Delete workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* new workspace dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              A fresh canvas inside the current project — e.g. for a
              classification round, a refinement branch, or post-processing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-workspace-name">Name</Label>
            <Input
              id="new-workspace-name"
              value={newName}
              maxLength={60}
              autoFocus
              placeholder="e.g. Classification round 2"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={creating || newName.trim().length < 1}
            >
              {creating ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              Create workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
