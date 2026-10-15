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
 * t998 — the rename arc learned to speak: the inline rename input's
 * four-branch name (empty / unchanged / at-cap / rest — the commit's
 * two silent refusals get their voice BEFORE Enter lands), the delete
 * door's refusal riding its NAME (the title's hover-only whisper
 * promoted to the accessible name, the t982 zoom-clamp dialect), and
 * the create input's cap face — all riding WS_NAME_MAX, the wall's
 * one truth (the t997 formula law: every mention one number).
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

/* t998 — the workspace name's ONE wall: the rename input's maxLength,
 * the rename commit's slice, the create input's maxLength, the create
 * guard, the create slice, and both voices' cap faces all speak this
 * number — one truth, every mention rides the const (the t997 formula
 * law). The API re-validates 1–60 server-side (api/workspaces/[id]) —
 * the wall's other bank. */
const WS_NAME_MAX = 60;

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
  renaming,
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
  /** t1002 — the rename arc's busy face: TRUE while ANY rename PATCH is
   * in the air (the panel's single renamingId gate). The open input
   * speaks the busy branch of its name and carries aria-busy — the
   * commit's re-entry guard is the gate's substance, this is its
   * voice. */
  renaming: boolean;
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
      {/* name row / inline rename. t998 — the input's own flip faces:
          the commit refuses empty and unchanged names with a SILENT
          cancel (the editor just closes), so the voice speaks BEFORE
          the refusal — each discoverable state flips the name while
          the user types, the t982 dialect's four-branch form (empty /
          unchanged / at-cap / rest). The open lands on the unchanged
          face honestly: Enter right now would do nothing. The 60 wall
          is WS_NAME_MAX's truth, the cap face its voice (the t997 wall
          law — walls speak). t1002 — the fifth face rides FIRST: while
          the PATCH is in the air the busy branch speaks (the gate's
          voice, aria-busy beside it) — the flight is sub-perceptual on
          localhost, so the face is unit-pinned at source, not walked. */}
      {editing ? (
        <Input
          value={editName}
          maxLength={WS_NAME_MAX}
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
          aria-busy={renaming || undefined}
          aria-label={
            renaming
              ? "Workspace name (rename in flight)"
              : !editName.trim()
                ? "Workspace name (empty — type a name to rename)"
                : editName.trim() === workspace.name
                  ? "Workspace name (unchanged — edit the name to rename)"
                  : editName.length >= WS_NAME_MAX
                    ? `Workspace name (at the ${WS_NAME_MAX}-character limit)`
                    : "Workspace name"
          }
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
          {/* t998 — the delete door's refusal rides the NAME (the t982
              zoom-clamp dialect): the title already spoke the default's
              reason, but title is hover-only — the screen reader heard
              "Delete Main" on a dead button with no why. The name now
              carries the reason on the disabled face, the plain form on
              the enabled one. */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRequestDelete();
            }}
            disabled={isDefault}
            aria-label={
              isDefault
                ? `Delete ${workspace.name} (the default workspace cannot be deleted)`
                : `Delete ${workspace.name}`
            }
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
  /* t1002 — the rename's BUSY GATE: the commit's PATCH is awaited void —
   * during the flight the editor stays open and the blur door still
   * fires, so a blur while the first PATCH is in the air re-enters
   * commitRename and re-PATCHes (idempotent, but the shape is real).
   * renamingId is the flight's one truth: the commit refuses re-entry
   * while it is set, the open input speaks the busy face, and the
   * finally lands BOTH the gate's release and the editor's close — the
   * mirror of the create/delete gates' own busy states (creating /
   * deleting) beside it. */
  const [renamingId, setRenamingId] = React.useState<string | null>(null);

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
    /* t1002 — the re-entry guard rides FIRST: a blur fired while the
     * PATCH is in the air re-enters here with the editor still open —
     * the busy gate refuses the second commit. The flight's own mouth:
     * nothing mutates the editor while the rename is unresolved, and
     * the open input's busy face is the gate's voice. */
    if (renamingId) return;
    const id = editingId;
    if (!id) return;
    const trimmed = editName.trim();
    const current = workspaces.find((w) => w.id === id)?.name ?? "";
    /* t998 — the two silent refusals (empty, unchanged) close the
     * editor without a word BY DESIGN (a refused commit is a cancel,
     * not an error) — their voice lives on the input's flip faces,
     * which speak each state before Enter lands. During the flight
     * the gate holds these refusals too: the finally closes the editor
     * when the PATCH lands, so a blur's early return leaves the open
     * editor to the busy face, not to a silent close. */
    if (!trimmed || trimmed === current) {
      cancelEdit();
      return;
    }
    setRenamingId(id);
    void renameWorkspace(id, trimmed.slice(0, WS_NAME_MAX)).finally(() => {
      setRenamingId(null);
      cancelEdit();
    });
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

  // t1000 — the create dialog's doors keep no draft: EVERY close path
  // (the Cancel button, Escape, the outside click, the X) routes through
  // this ONE mouth (the t999 one-mouth law's dialog form), so a reopened
  // dialog opens EMPTY instead of resurrecting the abandoned text. The
  // success path rides the same door — a created workspace and a
  // cancelled draft close identically clean.
  const closeCreate = React.useCallback(() => {
    setNewName("");
    setCreateOpen(false);
  }, []);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (trimmed.length < 1 || trimmed.length > WS_NAME_MAX || creating) return;
    setCreating(true);
    const ok = await createWorkspace(trimmed.slice(0, WS_NAME_MAX));
    setCreating(false);
    if (ok) closeCreate();
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
              renaming={renamingId !== null}
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
            <AlertDialogCancel disabled={deleting} aria-label={deleting ? "Cancel (the workspace is being deleted)" : "Cancel"}>Cancel</AlertDialogCancel>
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

      {/* new workspace dialog — onOpenChange is the Radix door for the
          Escape / outside-click / X paths; the t1000 law routes it (and
          the Cancel button below) through closeCreate so the draft dies
          with the dialog on every exit */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) closeCreate(); }}>
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
            {/* t998 — the create input rides the same wall's voice: the
                cap face flips the name at the limit (a paste past 60
                truncates silently — the voice speaks); at rest the
                attribute is UNDEFINED (the t997 ghost-guard dialect —
                the Label element carries the plain name, the attribute
                only appears to refuse). */}
            <Input
              id="new-workspace-name"
              value={newName}
              maxLength={WS_NAME_MAX}
              autoFocus
              placeholder="e.g. Classification round 2"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              aria-label={
                newName.length >= WS_NAME_MAX
                  ? `Name (at the ${WS_NAME_MAX}-character limit)`
                  : undefined
              }
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeCreate}
              disabled={creating}
              aria-label={creating ? "Cancel (the workspace is being created)" : "Cancel"}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={creating || newName.trim().length < 1}
              aria-label={creating ? "Create workspace (the workspace is being created)" : newName.trim().length < 1 ? "Create workspace (name the workspace first)" : "Create workspace"}
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
