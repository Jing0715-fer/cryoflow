"use client";

/**
 * CryoFlow — the preset shelf's dashboard face (Task 716).
 *
 * The preset family's faces so far: the inspector's "Wear preset" row
 * (t713 — apply to the open job), the palette's "Add from your presets"
 * group (t714 — start a job from a snapshot), the server mirror
 * (t715 — the shelf follows the user across browsers). All of them are
 * LOCAL to a context: delete/manage a preset today requires opening a
 * job of that very type. This section is the OVERVIEW face — every
 * snapshot across every type on one shelf, where "tuned parameters are
 * work product" gets the same dignity the saved-views wall gives to
 * hunted viewing angles.
 *
 * DATA DIALECT — the palette's, exactly: loadUserParamPresets() (sync,
 * localStorage), reconcileUserParamPresets() fire-and-forget on mount
 * (t715 — a snapshot saved on another browser lands via the changed
 * event), USER_PARAM_PRESETS_EVENT listener re-reads, recentFirst()
 * display order. No second truth, no TTL cache — the shelf rides the
 * user's own browser plus the t715 mirror.
 *
 * EMPTY LAW — zero snapshots means no section (the heatmap's
 * totalJobs=0 law): a decorative empty shelf pretends the feature
 * exists when the user gave it no data. The section simply does not
 * render until the first snapshot lands.
 *
 * DELETE SEMANTICS — honest about what deletion does NOT do: presets
 * are snapshots, not links. A job that already wore this preset keeps
 * its current params; the confirm dialog says so, because "delete"
 * next to a params list reads like it might reset something.
 */

import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { TypeIcon } from "./icons";
import { jobType } from "@/lib/workflow";
import { fmtAgo } from "@/lib/duration";
import {
  loadUserParamPresets,
  deleteUserParamPreset,
  recentFirst,
  reconcileUserParamPresets,
  USER_PARAM_PRESETS_EVENT,
  type UserParamPreset,
} from "@/lib/user-param-presets";
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

export function UserPresetShelf() {
  const [presets, setPresets] = React.useState<UserParamPreset[] | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<UserParamPreset | null>(null);

  React.useEffect(() => {
    const refresh = () => setPresets(loadUserParamPresets());
    refresh();
    // t715 — adopt the server shelf (fire-and-forget): the reconcile
    // announces through the changed event and the listener re-reads.
    void reconcileUserParamPresets();
    window.addEventListener(USER_PARAM_PRESETS_EVENT, refresh);
    return () => window.removeEventListener(USER_PARAM_PRESETS_EVENT, refresh);
  }, []);

  // first read hasn't landed yet (or fetch+read failed — localStorage
  // reads don't throw, so null only ever means "not read yet"): render
  // nothing for one frame rather than a flash of empty
  if (presets === null || presets.length === 0) return null;

  const types = new Set(presets.map((p) => p.type));
  const shelf = showAll ? recentFirst(presets) : recentFirst(presets).slice(0, SHELF_CAP);
  const hidden = presets.length - shelf.length;

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
          {types.size === 1 ? "" : "s"} · follows you across browsers
        </span>
      </div>
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
    </section>
  );
}
