"use client";

/**
 * CryoFlow — the user parameter presets row, the ONE birthplace (t895).
 *
 * The t713 face of the user-preset family (lib/user-param-presets.ts):
 * SAVE the current job's full spec-key snapshot under a name, WEAR a saved
 * snapshot on this job (one merge PATCH — spec keys replaced, legacy keys
 * untouched), DELETE what outlived its usefulness. The curated face
 * (JOB_PRESETS, command palette "Add with preset") hands a new job its
 * starting params; this face is the user's own memory — "the combination
 * that finally separated the classes".
 *
 * t895 — the row was born in the inspector (Task 713) and lived there
 * alone, but the job has TWO editing faces: the inspector (a completed
 * run audited in place) and the canvas JobPanel (the card's idle click —
 * the PRIMARY editing door, t924's own docblock says so). A user tuning
 * params on the canvas could not save or wear a preset without leaving
 * the panel for the inspector — the shelf's face was on the wrong
 * surface for the editing flow. The row is lifted here VERBATIM (the
 * twins-fork law: twins fork, imports don't) with ONE seam
 * parameterized: what "current" means on each surface.
 *
 *   · inspector — current = the job's persisted params (the audit reads
 *     the saved truth); apply rides the store's single write well
 *     (updateJobParams — the t713 law: optimistic with the surgical
 *     rollback, never a second PATCH path);
 *   · panel — current = the editing FORM's live values (autosave makes
 *     any in-form drift transient, so the form IS the truth the user
 *     sees); apply writes the FORM through the surface's own setter and
 *     the panel's own debounced autosave persists it — never a direct
 *     PATCH (the form state would go stale behind the store's back).
 *
 * The two faces are mutually exclusive by construction (the inspector's
 * "Edit parameters" door closes the inspector and selects the job; the
 * card's idle click selects), so the family's testid addresses stay
 * DOM-unique across both faces — the t984 ambient walk and the t969
 * overflow walk keep reading the same addresses wherever the row stands.
 *
 * Detail laws inherited from the family (unchanged):
 *  - the 1–60 name law mirrors renameJob's server contract, so honest
 *    typing never sees the 400;
 *  - the confirm dialog counts what will MOVE (countEffectiveDiffs speaks
 *    effective values — stored-else-default — not raw stored rows), so the
 *    click lands without surprise;
 *  - feedback is INLINE (a toast disappears, a line under the controls
 *    waits for you); failures still toast from the store action — the two
 *    voices never duplicate one cause;
 *  - the #13 law: every localStorage write rides a handler, never a
 *    render path.
 */

import * as React from "react";
import { BookmarkPlus, ChevronDown, SlidersHorizontal, Trash } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobDTO, ParamValue } from "@/lib/types";
import { jobType } from "@/lib/workflow";
import {
  addUserParamPreset,
  countEffectiveDiffs,
  deleteUserParamPreset,
  loadUserParamPresets,
  presetsForType,
  reconcileUserParamPresets,
  snapshotSpecParams,
  USER_PARAM_PRESETS_EVENT,
  type UserParamPreset,
} from "@/lib/user-param-presets";

export function ParamPresetsRow({
  job,
  addressPrefix,
  storedValues,
  applyValues,
}: {
  /** the job the row wears presets on (type names the snapshot's shelf) */
  job: Pick<JobDTO, "id" | "type">;
  /** the face's address prefix — "inspector" keeps the t713/t969/t984
   *  addresses byte-stable; "panel" names the canvas face's own row */
  addressPrefix: "inspector" | "panel";
  /** what "current" means on THIS surface — the persisted params (the
   *  inspector) or the editing form's live values (the panel) */
  storedValues: Record<string, unknown>;
  /** the surface's own apply well — the inspector rides the store's
   *  updateJobParams; the panel writes its form (the debounced autosave
   *  persists). Resolves true when the values landed. */
  applyValues: (values: Record<string, ParamValue>) => Promise<boolean> | boolean;
}) {
  const spec = jobType(job.type);
  const [presets, setPresets] = React.useState<UserParamPreset[]>([]);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [applyTarget, setApplyTarget] = React.useState<UserParamPreset | null>(null);
  const [name, setName] = React.useState("");
  const [flash, setFlash] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(() => setPresets(loadUserParamPresets()), []);
  React.useEffect(() => {
    refresh();
    // t715 — adopt the server shelf (fire-and-forget): a snapshot saved on
    // another browser lands here via the changed event the reconcile
    // dispatches; offline it shrugs and the local list answers.
    void reconcileUserParamPresets();
    window.addEventListener(USER_PARAM_PRESETS_EVENT, refresh);
    return () => window.removeEventListener(USER_PARAM_PRESETS_EVENT, refresh);
  }, [refresh]);

  const specParams = spec?.params ?? [];
  const stored = storedValues;
  const mine = presetsForType(presets, job.type);
  const typeLabel = spec?.label ?? job.type;

  if (specParams.length === 0) return null;

  const doSave = () => {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 60) return;
    const snap = snapshotSpecParams(specParams, stored);
    addUserParamPreset(job.type, trimmed, snap);
    setName("");
    setSaveOpen(false);
    setFlash(
      `Saved “${trimmed}” — a full snapshot of ${Object.keys(snap).length} params, wearable on any ${typeLabel} job.`
    );
  };

  const doApply = async (p: UserParamPreset) => {
    // diffs speak BEFORE the wire moves anything — stored is still the
    // pre-apply map here, exactly what the confirm dialog counted
    const moved = countEffectiveDiffs(p, specParams, stored);
    setApplyTarget(null);
    setBusy(true);
    const ok = await applyValues(p.params);
    setBusy(false);
    if (ok) {
      setFlash(
        `Applied “${p.name}” — ${Object.keys(p.params).length} params set, ${moved} moved from their previous values.`
      );
    }
    // a refusal already toasted from the store action — silence here is
    // the two-voices rule, not an omission
  };

  return (
    <div
      data-print-atomic=""
      className="insp-card-whisper rounded-xl border bg-card px-4 py-3"
      data-testid={`${addressPrefix}-param-presets`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <BookmarkPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-semibold">Parameter presets</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {mine.length} for {typeLabel}
        </span>
        {/* t969 — the button group was ONE incompressible flex item inside
            the wrapping row: its two nowrap buttons raised the row's
            min-content past the fold's width (+27px LEAK). The group wraps
            INTERNALLY now — at the fold the buttons stack honestly, wide
            they keep sitting side by side at the row's end. */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => {
              setName("");
              setFlash(null);
              setSaveOpen(true);
            }}
            data-testid="preset-save-open"
          >
            <BookmarkPlus className="size-3.5" aria-hidden="true" />
            Save current…
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                disabled={busy}
                aria-label={busy ? "Apply preset (a preset is being applied)" : "Apply preset"}
                data-testid="preset-apply-menu"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                Apply preset
                <ChevronDown className="size-3" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-[11px]">Wear a saved parameter set</DropdownMenuLabel>
              {mine.length === 0 ? (
                <div className="px-2 py-3 text-[11px] leading-relaxed text-muted-foreground">
                  No presets for {typeLabel} yet — tune a job&apos;s params, then save the combination here.
                </div>
              ) : (
                <>
                  {mine.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      className="gap-2"
                      onSelect={() => {
                        setFlash(null);
                        setApplyTarget(p);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.name}</span>
                      <span
                        className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground"
                        title={`${Object.keys(p.params).length} params in this snapshot`}
                      >
                        {Object.keys(p.params).length}p
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {mine.map((p) => (
                    <DropdownMenuItem
                      key={`del-${p.id}`}
                      className="gap-2 text-danger focus:text-danger"
                      onSelect={() => {
                        deleteUserParamPreset(p.id);
                        setFlash(`Deleted “${p.name}”.`);
                      }}
                    >
                      <Trash className="size-3" aria-hidden="true" />
                      <span className="truncate text-xs">Delete “{p.name}”</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {flash && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground" role="status" data-testid="preset-flash">
          {flash}
        </p>
      )}

      {/* the naming dialog — the 1–60 law lives in the disable, not in a
          late error; Enter saves like the note textarea does */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="preset-save-dialog">
          <DialogHeader>
            <DialogTitle className="text-sm">Save current params as preset</DialogTitle>
            <DialogDescription className="text-xs">
              A full snapshot of this job&apos;s {specParams.length} {specParams.length === 1 ? "param" : "params"} for{" "}
              {typeLabel} — wear it on any sibling job later, whatever its current knobs say.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) doSave();
            }}
            placeholder="e.g. My standard pass"
            maxLength={60}
            aria-label="Preset name"
            autoFocus
            data-testid="preset-name-input"
          />
          <p className="text-[10px] text-muted-foreground">
            1–60 characters · stored in this browser (localStorage)
          </p>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!name.trim() || name.trim().length > 60}
              aria-label={!name.trim() ? "Save preset (name the preset first)" : name.trim().length > 60 ? "Save preset (the name is over 60 characters)" : "Save preset"}
              onClick={doSave}
              data-testid="preset-save-confirm"
            >
              Save preset
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* the wear-confirm — the move count is the whole point: an apply
          that changes nothing deserves a glance, one that moves 14 knobs
          deserves a deliberate click */}
      <AlertDialog open={applyTarget !== null} onOpenChange={(o) => !o && setApplyTarget(null)}>
        <AlertDialogContent data-testid="preset-apply-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Apply “{applyTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {applyTarget && (
                <>
                  Sets all {Object.keys(applyTarget.params).length} params of this snapshot —{" "}
                  <span className="font-semibold text-foreground">
                    {countEffectiveDiffs(applyTarget, specParams, stored)}
                  </span>{" "}
                  will move from their current values. Legacy keys (gallery picks, engine flags) stay untouched.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-7 text-xs"
              onClick={() => applyTarget && void doApply(applyTarget)}
              data-testid="preset-apply-confirm"
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
