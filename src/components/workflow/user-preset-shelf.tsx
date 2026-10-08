"use client";

/**
 * CryoFlow — the preset shelf's dashboard face (Task 716, carried further
 * in Task 717).
 *
 * The preset family's faces so far: the inspector's "Wear preset" row
 * (t713 — apply to the open job), the palette's "Add from your presets"
 * group (t714 — start a job from a snapshot), the server mirror
 * (t715 — the shelf follows the user across browsers), and this
 * OVERVIEW face (t716 — every snapshot across every type on one shelf).
 * Task 717 adds the fifth face HERE, because carry is a shelf-level
 * verb: export the whole shelf as one JSON file and import one back —
 * the t715 mirror crosses browsers but not machines, and a companion
 * app that moves between a laptop and a workstation needs an honest
 * file. The merge laws live in lib/preset-portability.ts (pure, probed);
 * this component only composes: parse against the CURRENT shelf, show
 * the receipt, land the merge through writeUserParamPresets() — the
 * single write well (localStorage + the t715 mirror + the changed
 * event), never a second storage path.
 *
 * DATA DIALECT — the palette's, exactly: loadUserParamPresets() (sync,
 * localStorage), reconcileUserParamPresets() fire-and-forget on mount
 * (t715 — a snapshot saved on another browser lands via the changed
 * event), USER_PARAM_PRESETS_EVENT listener re-reads, recentFirst()
 * display order. No second truth, no TTL cache — the shelf rides the
 * user's own browser plus the t715 mirror.
 *
 * EMPTY LAW — AMENDED in t717. The original law rendered nothing at
 * zero snapshots (a decorative empty shelf pretends the feature
 * exists). Carry changes the premise: at zero the shelf has a LIVE
 * function — import is the only way a fresh machine's empty shelf ever
 * fills — so the empty state now renders the header and the import
 * door, no grid, no fake cards. An empty state with a working mouth is
 * function, not decoration; an empty state without one was decoration.
 * `presets === null` (unread first frame) still renders nothing.
 *
 * DELETE SEMANTICS — honest about what deletion does NOT do: presets
 * are snapshots, not links. A job that already wore this preset keeps
 * its current params; the confirm dialog says so, because "delete"
 * next to a params list reads like it might reset something.
 *
 * THE SECOND DICTIONARY DOOR (t733) — the palette's rows have had one
 * since t730: an info mouth that opens the Type Card (what is this
 * type, where from, where next, what to tune). A snapshot's type line
 * is exactly where that question gets asked on the shelf — a preset
 * IS tuned knowledge about a type, and reading the type's four answers
 * belongs next to it. Same TypeCardDialog instance (zero second face),
 * same span-as-button grammar, same sentence; only the size is the
 * card's dialect (t732's two-sizes-one-badge law, third verse). No
 * onAdded housekeeping: the dialog closes itself after a successful
 * add (the store's addJob rides the active project), and the shelf
 * behind it is exactly as it was.
 */

import * as React from "react";
import { Download, Info, SlidersHorizontal, Upload, X } from "lucide-react";
import { TypeIcon } from "./icons";
import { TypeCardDialog } from "./type-card-dialog"; // t733 — the shelf's dictionary door: the palette's card, same face
import { jobType } from "@/lib/workflow";
import { fmtAgo } from "@/lib/duration";
import {
  loadUserParamPresets,
  deleteUserParamPreset,
  writeUserParamPresets,
  recentFirst,
  reconcileUserParamPresets,
  USER_PARAM_PRESETS_EVENT,
  type UserParamPreset,
} from "@/lib/user-param-presets";
import {
  exportShelfPayload,
  exportShelfFilename,
  importShelfPayload,
  type ImportReceipt,
} from "@/lib/preset-portability";
import { downloadText } from "@/lib/download";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

/** 8 cards keep the section a glance, not a scroll; the overflow button
 *  says honestly how many more exist and expands in place (the
 *  SavedViewsGallery / FailedJobsStrip law). */
const SHELF_CAP = 8;
/** the params preview shows the first three knobs — the full list lives
 *  in the inspector's apply dialog and the card's title tooltip */
const PREVIEW_CAP = 3;
/** the import preview lists at most six incoming snapshots — the receipt
 *  counts tell the whole story, the list is just the face */
const IMPORT_PREVIEW_CAP = 6;

const REFUSAL_LINES: Record<string, string> = {
  unreadable: "That file is not readable JSON.",
  shape: "That file is not a CryoFlow presets file.",
  kind: "That file is not a CryoFlow presets file.",
  version: "That file was written by a different version of CryoFlow.",
};

export function UserPresetShelf() {
  const [presets, setPresets] = React.useState<UserParamPreset[] | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  // t733 — the dictionary door's single key (the palette's cardKey
  // law): one card at a time, open = key !== null, closing resets.
  const [cardKey, setCardKey] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<UserParamPreset | null>(null);
  // t717 import states — the dialog is a three-phase face
  // (pick file → preview receipt → done) over three slots
  const [importOpen, setImportOpen] = React.useState(false);
  const [pendingReceipt, setPendingReceipt] = React.useState<ImportReceipt | null>(null);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [appliedCount, setAppliedCount] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const refresh = () => setPresets(loadUserParamPresets());
    refresh();
    // t715 — adopt the server shelf (fire-and-forget): the reconcile
    // announces through the changed event and the listener re-reads.
    void reconcileUserParamPresets();
    window.addEventListener(USER_PARAM_PRESETS_EVENT, refresh);
    return () => window.removeEventListener(USER_PARAM_PRESETS_EVENT, refresh);
  }, []);

  const closeImport = () => {
    setImportOpen(false);
    setPendingReceipt(null);
    setRefusal(null);
    setAppliedCount(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onExport = () => {
    if (!presets || presets.length === 0) return; // the button is hidden at zero — belt for the a11y path
    downloadText(exportShelfFilename(), exportShelfPayload(presets), "application/json");
  };

  const onFileChosen = async (file: File | null) => {
    if (!file) return;
    setRefusal(null);
    let text = "";
    try {
      text = await file.text();
    } catch {
      setRefusal(REFUSAL_LINES.unreadable);
      return;
    }
    // parse against the CURRENT shelf, read fresh at drop time —
    // not the mount-time snapshot (another face may have saved since)
    const receipt = importShelfPayload(text, loadUserParamPresets());
    if (!receipt.ok) {
      setRefusal(REFUSAL_LINES[receipt.reason ?? "shape"] ?? REFUSAL_LINES.shape);
      return;
    }
    setPendingReceipt(receipt);
  };

  const onImportApply = () => {
    if (!pendingReceipt) return;
    const count = pendingReceipt.added.length;
    // the single write well — the changed event repaints the shelf
    // behind the dialog, so the new cards ARE part of the feedback
    writeUserParamPresets(pendingReceipt.shelf);
    setAppliedCount(count);
    setPendingReceipt(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // first read hasn't landed yet (or fetch+read failed — localStorage
  // reads don't throw, so null only ever means "not read yet"): render
  // nothing for one frame rather than a flash of empty.
  // t717 AMENDMENT — zero snapshots now renders the header + the import
  // door (see EMPTY LAW in the header note); only the unread frame
  // stays dark.
  if (presets === null) return null;

  const isEmpty = presets.length === 0;
  const types = new Set(presets.map((p) => p.type));
  const shelf = isEmpty ? [] : showAll ? recentFirst(presets) : recentFirst(presets).slice(0, SHELF_CAP);
  const hidden = isEmpty ? 0 : presets.length - shelf.length;

  return (
    <section
      aria-label="Your parameter presets across all job types"
      data-testid="preset-shelf"
      className="card-lift rounded-xl border bg-card px-4 py-3.5 sm:px-5"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold tracking-tight">Your presets</h2>
        <span className="text-[11px] text-muted-foreground">
          {presets.length} snapshot{presets.length === 1 ? "" : "s"} · {types.size} type
          {types.size === 1 ? "" : "s"} · follows you across browsers{isEmpty ? "" : " and files"}
        </span>
        {/* the carry verbs — shelf-level, so they live in the overview's
            header (t717); export is hidden at zero (an empty file is not
            a feature), import is always reachable (a fresh machine's
            empty shelf is exactly who needs it) */}
        <div className="ml-auto flex items-center gap-1">
          {!isEmpty ? (
            <button
              type="button"
              data-testid="preset-shelf-export"
              onClick={onExport}
              aria-label="Export presets to a file"
              title="Download your presets as a JSON file — carry them to another machine"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Download className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            data-testid="preset-import-open"
            onClick={() => setImportOpen(true)}
            aria-label="Import presets from a file"
            title="Import presets from a CryoFlow presets file (.json)"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Upload className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      {isEmpty ? (
        /* the empty shelf is a DOOR, not a facade (t717 amended law):
           the one live action a zero shelf has, drawn like the +N-more
           dashed row so the grammar stays the wall's */
        <button
          type="button"
          data-testid="preset-import-empty-door"
          onClick={() => setImportOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-xs text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Upload className="size-3.5 shrink-0" aria-hidden="true" />
          Import presets from a file (.json) — or save one from any job's inspector
        </button>
      ) : (
      <div data-atomic-grid className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {shelf.map((p) => {
          const t = jobType(p.type);
          const knobs = Object.keys(p.params).length;
          const preview = Object.entries(p.params).slice(0, PREVIEW_CAP);
          return (
            <div
              key={p.id}
              data-testid="preset-shelf-card"
              data-preset-id={p.id}
              className="group/preset relative flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-2.5 transition-all motion-reduce:transition-none hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded ring-1 ring-inset",
                    t?.color.soft,
                    t?.color.border
                  )}
                  aria-hidden="true"
                >
                  <TypeIcon name={t?.icon ?? "boxes"} className={cn("size-2.5", t?.color.text)} />
                </span>
                <span className="truncate text-[10px] text-muted-foreground" title={p.type}>
                  {t?.label ?? p.type}
                </span>
                {/* t733 — the shelf's dictionary door: the same TypeCard the
                    palette's rows open (t730), reached from the type line
                    where the question actually lives. Same span-as-button
                    grammar (pointerdown swallowed, Enter/Space spoken),
                    same sentence; the size is the card's compact dialect
                    (t732's two-sizes-one-badge law, third verse). The key
                    is p.type verbatim — an unknown type gets an honest
                    no-op card (the dialog renders null on no spec). */}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`About ${t?.label ?? p.type} — params, ports, neighbours`}
                  title={`About ${t?.label ?? p.type} — params, ports, neighbours`}
                  data-testid={`shelf-info-${p.type}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCardKey(p.type);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setCardKey(p.type);
                    }
                  }}
                  className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/0 transition-all hover:text-muted-foreground group-hover/preset:text-muted-foreground/60 focus-visible:text-muted-foreground hover:bg-accent"
                >
                  <Info className="size-2.5" aria-hidden="true" />
                </span>
                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {knobs} {knobs === 1 ? "knob" : "knobs"} · {fmtAgo(p.createdAt)}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 pr-5">
                <span className="truncate text-xs font-semibold" title={p.name}>
                  {p.name}
                </span>
              </div>
              {/* the snapshot's face — the first three knobs as key=value
                  chips; a knob list IS the identity of a params snapshot,
                  so the cards show it instead of hiding it behind hover */}
              <div className="flex flex-wrap gap-1" title={Object.entries(p.params).map(([k, v]) => `${k}=${String(v)}`).join("  ")}>
                {preview.map(([k, v]) => (
                  <span
                    key={k}
                    className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                  >
                    {k}={String(v)}
                  </span>
                ))}
                {knobs > PREVIEW_CAP ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/70">
                    +{knobs - PREVIEW_CAP}
                  </span>
                ) : null}
              </div>
              {/* the delete mouth — the wall's floating-chip grammar:
                  hover swaps it into view, focus-visible keeps it honest
                  for keyboards, focus-within keeps it visible while held */}
              <button
                type="button"
                data-testid="preset-shelf-delete"
                onClick={() => setDeleteTarget(p)}
                aria-label={`Delete preset “${p.name}”`}
                title={`Delete “${p.name}” — jobs already wearing it keep their params`}
                className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition-opacity motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 group-hover/preset:opacity-100 group-focus-within/preset:opacity-100"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </div>
          );
        })}
        {hidden > 0 ? (
          <button
            type="button"
            data-testid="preset-shelf-expand"
            onClick={() => setShowAll(true)}
            className="flex min-h-[64px] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-muted"
          >
            +{hidden} more snapshot{hidden === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
      )}

      {/* the confirm states what deletion does NOT do — presets are
          snapshots, not links; a wearing job is untouched */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="preset-shelf-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This removes the snapshot from your shelf (here and on any other browser).
              Jobs that already applied it keep their current params — presets are
              snapshots, not links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Keep it</AlertDialogCancel>
            <AlertDialogAction
              data-testid="preset-shelf-delete-confirm"
              className="h-8 bg-danger text-xs text-white hover:bg-danger/90"
              onClick={() => {
                if (deleteTarget) deleteUserParamPreset(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* the carry mouth (t717) — three phases in one dialog: pick a
          file, preview the receipt (what lands, what is skipped and WHY,
          in counts), then the landed count. The merge itself is lib law
          (preset-portability.ts); this dialog only narrates it. */}
      <Dialog open={importOpen} onOpenChange={(o) => !o && closeImport()}>
        <DialogContent data-testid="preset-import-dialog" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Import presets</DialogTitle>
            <DialogDescription className="text-xs">
              Load a presets file exported from CryoFlow. Import adds — it never
              overwrites or deletes what is already on your shelf.
            </DialogDescription>
          </DialogHeader>

          {appliedCount !== null ? (
            /* phase 3 — done. The shelf behind this dialog already
               repainted (the changed event fired inside the write). */
            <div className="flex flex-col gap-3">
              <p data-testid="preset-import-receipt" className="text-xs text-muted-foreground">
                Imported {appliedCount} preset{appliedCount === 1 ? "" : "s"} — your shelf is up to date
                here and on any other browser.
              </p>
              <DialogFooter>
                <button
                  type="button"
                  data-testid="preset-import-close"
                  onClick={closeImport}
                  className="h-8 rounded-md border bg-background px-3 text-xs font-medium transition-colors motion-reduce:transition-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  Done
                </button>
              </DialogFooter>
            </div>
          ) : pendingReceipt ? (
            /* phase 2 — the receipt, every nonzero clause spoken */
            <div className="flex flex-col gap-3">
              <p data-testid="preset-import-preview" className="text-xs">
                {pendingReceipt.added.length > 0 ? (
                  <>
                    <span className="font-medium">{pendingReceipt.added.length}</span> new preset
                    {pendingReceipt.added.length === 1 ? "" : "s"} will land
                  </>
                ) : (
                  <>Nothing new to add</>
                )}
                {pendingReceipt.duplicates > 0
                  ? ` · ${pendingReceipt.duplicates} already on your shelf`
                  : ""}
                {pendingReceipt.invalid > 0 ? ` · ${pendingReceipt.invalid} refused (bad entries)` : ""}
                {pendingReceipt.overflow > 0
                  ? ` · ${pendingReceipt.overflow} past the 48-shelf cap`
                  : ""}
                .
              </p>
              {pendingReceipt.added.length > 0 ? (
                <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-1">
                  {pendingReceipt.added.slice(0, IMPORT_PREVIEW_CAP).map((p) => {
                    const t = jobType(p.type);
                    const knobs = Object.keys(p.params).length;
                    return (
                      <li
                        key={p.id}
                        className="flex min-w-0 items-center gap-1.5 rounded-md border bg-card px-2 py-1.5"
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded ring-1 ring-inset",
                            t?.color.soft,
                            t?.color.border
                          )}
                          aria-hidden="true"
                        >
                          <TypeIcon name={t?.icon ?? "boxes"} className={cn("size-2.5", t?.color.text)} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium" title={p.name}>
                          {p.name}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {knobs} {knobs === 1 ? "knob" : "knobs"}
                        </span>
                      </li>
                    );
                  })}
                  {pendingReceipt.added.length > IMPORT_PREVIEW_CAP ? (
                    <li className="px-2 text-[10px] text-muted-foreground">
                      +{pendingReceipt.added.length - IMPORT_PREVIEW_CAP} more in the file
                    </li>
                  ) : null}
                </ul>
              ) : null}
              <DialogFooter>
                <button
                  type="button"
                  onClick={closeImport}
                  className="h-8 rounded-md border bg-background px-3 text-xs font-medium transition-colors motion-reduce:transition-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="preset-import-apply"
                  onClick={onImportApply}
                  disabled={pendingReceipt.added.length === 0}
                  className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors motion-reduce:transition-none hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50"
                >
                  Import {pendingReceipt.added.length > 0 ? pendingReceipt.added.length : ""}
                </button>
              </DialogFooter>
            </div>
          ) : (
            /* phase 1 — pick. A real <input type=file> under a dashed
               label: click-to-browse, .json only (the kind header does
               the real checking; accept is the courtesy). */
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors motion-reduce:transition-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                <Upload className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs text-muted-foreground">
                  Choose a presets file (.json) exported from CryoFlow
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  data-testid="preset-import-file"
                  className="sr-only"
                  onChange={(e) => {
                    void onFileChosen(e.target.files?.[0] ?? null);
                  }}
                />
              </label>
              {refusal ? (
                <p role="alert" className="text-xs text-danger">
                  {refusal}
                </p>
              ) : null}
              <DialogFooter>
                <button
                  type="button"
                  onClick={closeImport}
                  className="h-8 rounded-md border bg-background px-3 text-xs font-medium transition-colors motion-reduce:transition-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  Cancel
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* t733 — the dictionary door's shelf host: the same card the
          palette opens, keyed by the one cardKey. No onAdded
          housekeeping — after a successful add the dialog closes
          itself (the store's addJob rides the active project), and
          the shelf behind it is unchanged. */}
      <TypeCardDialog
        typeKey={cardKey}
        open={cardKey !== null}
        onOpenChange={(o) => {
          if (!o) setCardKey(null);
        }}
        onNavigate={(key) => setCardKey(key)}
      />
    </section>
  );
}
