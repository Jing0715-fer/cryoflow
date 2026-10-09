"use client";

/** t478 — the grave's age in honest coarse units (the timestamp lives in
 *  the title; the row wants a glanceable "how long has it been dead"). */
function graveAge(deletedAt: string): string {
  const ms = Date.now() - new Date(deletedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/**
 * StorageDialog — t436: the project storage overview.
 *
 * "How much disk is this project using, and which run is the whale?"
 * The per-job cleanup dialog (t331) speaks bytes but lives inside one
 * job's inspector; this panel lifts the whole project into one view —
 * physical truth walked from data/relion/<projectId>/ (the DB is only
 * metadata here: an orphaned run directory still shows, flagged).
 *
 * Honesty surfaces:
 *   - categories are extension-honest (a .mrc is a Map regardless of
 *     which job wrote it) — the legend says so, the hints explain;
 *   - a truncated walk says "numbers are floors" (the cap is real);
 *   - orphans wear amber and cannot jump to an inspector (there is
 *     none — no job record points at that directory);
 *   - the numbers are stamped with their fetch time and the panel
 *     never pretends to auto-refresh: the disk changes under the user,
 *     the Refresh button is the truth.
 *
 * Row click → that job's inspector (where the per-job Clean button
 * lives — this panel is the map, the inspector is the shovel).
 *
 * t437 — the lens gets teeth: the category chips are now doors. Clicking
 * one drills from the run level to the FILE level (the heaviest files of
 * that category, the route walks them out), with the same row grammar —
 * a bar in the category's color, an inspector jump for rows whose run
 * has a record, amber honesty for the ones that don't.
 *
 * t441 — the shovel comes to visit: the map stops being a bystander.
 *   - an eraser door on every run row (runs table AND the lens's feeding-
 *     runs view) opens the SAME tiered CleanupDialog in place — the run
 *     is the planner's unit, so the door lives on run rows only;
 *   - after a clean the board re-walks and prints the delta as the WALK's
 *     own account (before/after totals, never the planner's word), with
 *     the compared walk's fetch time named so a stale snapshot cannot
 *     quietly inflate the claim;
 *   - the lens grows a second view: feeding RUNS (who holds this
 *     category's bytes, heaviest first) beside the whale FILES.
 *
 * t458 — the run lens, the third view: the category lens (t437) read
 * the disk by CATEGORY first; this is its mirror image, reading by RUN
 * first — either dimension, the same file-level terminus.
 *   - every run row's bar becomes the category STACK (the board's own
 *     palette, the palette's own order) — where a run's bytes live is
 *     now legible without opening anything;
 *   - a weigh door on every run row (and on the lens's feeding-runs)
 *     opens the run lens in place: the run's stack, its category chips,
 *     and its file ledger (the walk's whale rows that live in this run);
 *   - the summary block gains the whale line — the heaviest run, its
 *     bytes, its share — and the line itself is the door;
 *   - the ledger's absence is honest: a run whose files never made the
 *     walk's per-category whale ledger reads "unlisted", amber — a fact
 *     about the ledger, never a claim that the directory is empty.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Eraser,
  HardDrive,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import type { GraveRow } from "@/lib/job-tombstone";
import { useWorkflowStore } from "@/lib/store";
import {
  STORAGE_CATEGORIES,
  fmtBytes,
  type StorageCategoryId,
} from "@/lib/relion/disk-usage";
import {
  formatCleanReceipt,
  isCleanableStatus,
  runsForCategory,
  walkDelta,
} from "@/lib/storage-clean";
import {
  categoriesOfRun,
  filesForRun,
  runCensus,
  runLedgerLine,
  runLedgerState,
  runStackSegments,
  whaleLine,
} from "@/lib/storage-run-lens";
import type { JobDTO } from "@/lib/types";
import { jobType, pourKindsOf, PORT_COLORS } from "@/lib/workflow"; // t764 — the kind vocabulary's TWENTY-FIFTH reader joins the storage board
import { CleanupDialog } from "./cleanup-dialog";

/** the route's response contract, mirrored client-side (the family keeps
 *  route types out of client imports — same shape as PicksBoardResponse) */
interface StorageJobRow {
  jobId: string | null;
  name: string;
  type: string;
  status: string;
  dirName: string;
  bytes: number;
  files: number;
  categories: Record<StorageCategoryId, { bytes: number; files: number }>;
  truncated: boolean;
  exists: boolean;
}

interface StorageFileRow {
  path: string;
  bytes: number;
  category: StorageCategoryId;
  dirName: string;
}

interface StorageTopFileRow extends StorageFileRow {
  jobId: string | null;
  jobName: string | null;
}

interface StorageResponse {
  projectId: string;
  projectName: string;
  totalBytes: number;
  totalFiles: number;
  jobs: StorageJobRow[];
  byCategory: Record<StorageCategoryId, { bytes: number; files: number }>;
  topFiles: StorageTopFileRow[];
  truncated: boolean;
  hasRuns: boolean;
  generatedAt: string;
}

/** deterministic category palette — teal family for the cryo surfaces,
 *  violet for the stacks (the whales), neutrals for the paper trail */
const CATEGORY_COLORS: Record<StorageCategoryId, string> = {
  maps: "bg-teal-500",
  stacks: "bg-violet-500",
  tables: "bg-sky-500",
  logs: "bg-slate-400 dark:bg-slate-600",
  plots: "bg-amber-500",
  other: "bg-zinc-400 dark:bg-zinc-600",
};

const CATEGORY_TEXT: Record<StorageCategoryId, string> = {
  maps: "text-running-700 dark:text-running-300",
  stacks: "text-violet-700 dark:text-violet-300",
  tables: "text-sky-700 dark:text-sky-300",
  logs: "text-slate-600 dark:text-slate-400",
  plots: "text-warning-700 dark:text-warning-300",
  other: "text-zinc-600 dark:text-zinc-400",
};

type JobSort = "heaviest" | "name";

/**
 * t764 — the kind vocabulary's TWENTY-FIFTH reader and the family's
 * TWELFTH testid address: the storage board's three type-naming rows
 * (`{dirName} · {type} · {status}`) speak the pours words in ONE window —
 * the t762 deferred unification verdict, cashed: ONE gated ask, THREE
 * seats, zero one-speaks-two-silent inconsistency (three separate windows
 * would have been surgery bloat; one silent window would have been a
 * lie by omission). The seats are truncate PROSE lines (mono, ellipsis),
 * so the container is inline-flex (the t760 prose law — a block flex
 * would break the sentence into anonymous blocks; the seat's physics is
 * its witness, second staging) and the dots sit right after the type
 * word, BEFORE the status separator: water glued to the word it
 * describes. Unknown types keep the bare line (the undefined law's
 * fifth face); the sr-only ear line speaks the whole pour for readers
 * who hear instead of hover.
 *
 * t769 — the FOURTH seat joins: the graveyard drawer's type chip (the
 * t478 grave row). The row's Restore door promises "its workdir, run
 * record and wires re-attach as if the delete never happened" — the
 * water previews WHICH wires: the promise seat's FIFTH face (picker's
 * selection t763 → diff's side-by-side t766 → cleanup's destruction
 * t767 → remote's dispatch t768 → the grave's RESTORATION). The
 * helper's inline-flex is the intersection form: three prose hosts
 * glue the water to the type word, this flex host seats it as a chip
 * sibling — one container serves both physics (the boundary clause's
 * third staging: context-neutral physics, the row's gap-2 speaks).
 */
function StoragePours({ type }: { type: string }) {
  const spec = jobType(type);
  const pouring = spec ? pourKindsOf(type) : [];
  if (pouring.length === 0) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1"
      data-testid={`storage-pours-${type}`}
    >
      {pouring.map((k) => (
        <span
          key={k}
          aria-hidden="true"
          title={`pours ${k}`}
          className="inline-block size-1.5 rounded-full"
          style={{ background: PORT_COLORS[k].wire }}
        />
      ))}
      <span className="sr-only">pours {pouring.join(", ")}</span>
    </span>
  );
}

/**
 * t441 — the eraser door on a run row: opens the SAME tiered CleanupDialog
 * the inspector hosts. The door mirrors the server's own live-run law as a
 * courtesy pre-filter (a running/pending run's files are being written);
 * the dialog's planner remains the authority. Rose on hover — the shovel
 * is the one destructive affordance on this board, and it should look it.
 */
function CleanDoor({
  name,
  status,
  onOpen,
}: {
  name: string;
  status: string;
  onOpen: () => void;
}) {
  const blocked = !isCleanableStatus(status);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={blocked}
      onClick={onOpen}
      className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-danger-500/10 hover:text-danger-600 dark:hover:text-danger-400"
      aria-label={
        blocked
          ? `${name} is ${status} — cleanup waits until it finishes`
          : `Clean ${name} intermediates`
      }
      title={
        blocked
          ? `${name} is still ${status} — its files are being written; Clean waits for the run to finish`
          : `Clean ${name}'s intermediates — the tiered preview opens right here, no inspector trip needed`
      }
    >
      <Eraser className="size-3.5" aria-hidden="true" />
    </Button>
  );
}

/**
 * t458 — the weigh door on a run row: opens the run lens in place —
 * the run's category stack, chips and file ledger, without leaving the
 * board. The mirror of the category chips' drill (t437): either
 * dimension first, the same terminus. Blue on hover — the lens is a
 * looking affordance, not a destructive one.
 */
function WeighDoor({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onOpen}
      className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400"
      aria-label={`Weigh ${name} by category`}
      title={`Weigh ${name} by category — the run lens opens right here: stack, chips, file ledger`}
    >
      <BarChart3 className="size-3.5" aria-hidden="true" />
    </Button>
  );
}

function sortJobs(
  jobs: StorageResponse["jobs"],
  key: JobSort
): StorageResponse["jobs"] {
  const sorted = [...jobs];
  if (key === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // the API's own order (bytes desc, dirName tiebreak) — stable reuse
    sorted.sort((a, b) => b.bytes - a.bytes || a.dirName.localeCompare(b.dirName));
  }
  return sorted;
}

export default function StorageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const project = useWorkflowStore((s) => s.project);
  const inspect = useWorkflowStore((s) => s.inspect);
  const [data, setData] = React.useState<StorageResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [jobSort, setJobSort] = React.useState<JobSort>("heaviest");
  /** t437: the file lens — a category chip clicked through to the file
   *  level. null = the runs table (the map of runs); a category id = that
   *  category's heaviest files. Survives a Refresh (it is a view, not
   *  data) but is forgotten when the dialog closes. */
  const [lens, setLens] = React.useState<StorageCategoryId | null>(null);
  /** t441: the lens's second view — whale FILES (the heaviest individual
   *  files) or feeding RUNS (who holds this category's bytes). A view,
   *  not data: survives a Refresh, forgotten on close with the lens. */
  const [lensView, setLensView] = React.useState<"files" | "runs">("files");
  /** t458: the run lens — a run dirName clicked through to the run's
   *  own view (stack, chips, file ledger). The category lens's mirror:
   *  the two are siblings at the same drill level, so opening one
   *  closes the other; both are views (survive Refresh, forgotten on
   *  close), and the chip filter inside is forgotten with the lens. */
  const [runLensDir, setRunLensDir] = React.useState<string | null>(null);
  const [runCatFilter, setRunCatFilter] = React.useState<StorageCategoryId | null>(null);
  /** t441: the clean bridge — the run whose tiered cleanup is open, the
   *  pre-clean walk (total + fetch time) the receipt compares against,
   *  and the receipt line itself. All forgotten when the dialog closes. */
  const storeJobs = useWorkflowStore((s) => s.jobs);
  const [cleanJob, setCleanJob] = React.useState<JobDTO | null>(null);
  const preClean = React.useRef<{ total: number; walkedAt: string } | null>(null);
  const [receipt, setReceipt] = React.useState<string | null>(null);
  // t478 — the graveyard drawer's state: the roll call (null = never
  // fetched or the fetch failed — the section stays silent), the id whose
  // restore is in flight, and the restore's own receipt line
  const [graves, setGraves] = React.useState<GraveRow[] | null>(null);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const [graveReceipt, setGraveReceipt] = React.useState<string | null>(null);
  // t479 — the bulk burial: the armed two-step (the records dialog's
  // t294 law), the in-flight lock, and its own error line (the receipt
  // stays teal for what the burial actually did)
  const [burialArmed, setBurialArmed] = React.useState(false);
  const [burying, setBurying] = React.useState(false);
  const [graveError, setGraveError] = React.useState<string | null>(null);
  const restoreFromGraveyard = useWorkflowStore((s) => s.restoreFromGraveyard);

  const projectId = project?.id ?? null;

  const load = React.useCallback(async (): Promise<number | null> => {
    if (!projectId) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/storage`);
      const body: unknown = await res.json();
      if (!res.ok || (body as { error?: string }).error) {
        setError(
          (body as { error?: string }).error ?? `HTTP ${res.status}`
        );
        setData(null);
        return null;
      } else {
        const fresh = body as StorageResponse;
        setData(fresh);
        return fresh.totalBytes;
      }
    } catch {
      setError("The storage walk failed — is the server reachable?");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    if (open && projectId) void load();
    if (!open) {
      // a closed dialog forgets the snapshot — next open walks the disk afresh
      setData(null);
      setError(null);
      setLens(null);
      setLensView("files");
      setRunLensDir(null);
      setRunCatFilter(null);
      setReceipt(null);
      preClean.current = null;
      setCleanJob(null);
      // t478 — the graveyard's roll call is forgotten with the rest
      setGraves(null);
      setGraveReceipt(null);
      setRestoringId(null);
      // t479 — the burial's armed step and its error die with the dialog
      setBurialArmed(false);
      setBurying(false);
      setGraveError(null);
    }
  }, [open, projectId, load]);

  /* ---- the graveyard drawer (t478): the deleted live next door ----
   * t477 gave the agent list_deleted and restore_deleted; this panel is
   * the UI's door onto the SAME graveRowsOf brain. A fetch that fails
   * stays silent (the graveyard is an addition, never a gate on the
   * storage walk), and a restore goes through the store's
   * restoreFromGraveyard — the grave's OWN server-side snapshot feeds the
   * restore, the t370 filter law holds, and the drawer re-reads the roll
   * so the row that just came back reads "already restored" like any
   * other truth. */
  const loadGraves = React.useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/deleted");
      if (!res.ok) return;
      const json = (await res.json()) as { ok?: boolean; graves?: GraveRow[] };
      if (json.ok && Array.isArray(json.graves)) setGraves(json.graves);
    } catch {
      /* silent — the drawer is an addition, never a gate */
    }
  }, []);

  React.useEffect(() => {
    if (open) void loadGraves();
  }, [open, loadGraves]);

  const handleGraveRestore = React.useCallback(
    async (id: string) => {
      setRestoringId(id);
      const out = await restoreFromGraveyard(id);
      setRestoringId(null);
      setGraveReceipt(out.message);
      void loadGraves();
    },
    [restoreFromGraveyard, loadGraves]
  );

  /* ---- t479 — the bulk burial: the drawer's Clear door ----
   * The armed two-step the records dialog's bulk forget taught (t294):
   * the first click arms, the second fires. The scope is always the
   * roll call's OWN arithmetic — spent graves first (the default door
   * spares restorable ones and the receipt names them); only when the
   * roll holds nothing else does the button offer the restorable graves
   * themselves, under a label that says what it means. The route is
   * law regardless of what the client sends: without ?all=1 no
   * restorable grave is ever buried. */
  const spentGraves = graves?.filter((g) => !g.restorable) ?? [];
  const restorableGraves = graves?.filter((g) => g.restorable) ?? [];
  const graveBytesTotal = graves?.reduce((sum, g) => sum + (g.bytes ?? 0), 0) ?? 0;
  // t480 — the burial announces itself: the door's arithmetic BEFORE it
  // fires, read straight off the roll call the drawer already holds (zero
  // new queries — the preview and the route's own arithmetic share one
  // brain, graveRowsOf, so a previewed byte is a reclaimed byte)
  const spentBytes = spentGraves.reduce((sum, g) => sum + (g.bytes ?? 0), 0);
  const restorableBytes = restorableGraves.reduce((sum, g) => sum + (g.bytes ?? 0), 0);

  const clearLabel =
    spentGraves.length > 0
      ? `Clear ${spentGraves.length} spent grave${spentGraves.length === 1 ? "" : "s"}`
      : `Bury ${restorableGraves.length} restorable grave${restorableGraves.length === 1 ? "" : "s"}`;
  // the armed step carries the arithmetic — the user confirms a NUMBER,
  // never a vague threat
  const armedLabel =
    spentGraves.length > 0
      ? `Sure? Bury ${spentGraves.length}${spentBytes > 0 ? `, reclaim ${fmtBytes(spentBytes)}` : ""}`
      : `Sure? ${restorableGraves.length}, ${restorableBytes > 0 ? `${fmtBytes(restorableBytes)}, ` : ""}never coming back`;
  // the spare law, spoken BEFORE the burial — the user should not have to
  // fire the door to learn what it will and will not touch. Silent when
  // there is nothing to spare (the omission law: no restorable graves,
  // no helper line).
  const spareHint =
    spentGraves.length > 0 && restorableGraves.length > 0
      ? `${spentGraves.length} spent grave${spentGraves.length === 1 ? "" : "s"} (${spentBytes > 0 ? `${fmtBytes(spentBytes)}` : "no workdirs"}) will be buried; ${restorableGraves.length} restorable${restorableBytes > 0 ? ` (${fmtBytes(restorableBytes)})` : ""} stay${restorableGraves.length === 1 ? "s" : ""} until you clear again`
      : null;

  const clearTitle =
    spentGraves.length > 0
      ? `Buries ${spentGraves.length} spent grave${spentGraves.length === 1 ? "" : "s"}${spentBytes > 0 ? ` — reclaims ${fmtBytes(spentBytes)}` : " (no surviving workdirs)"}. Restorable graves are spared.`
      : `Buries ${restorableGraves.length} restorable grave${restorableGraves.length === 1 ? "" : "s"} and their workdirs${restorableBytes > 0 ? ` (${fmtBytes(restorableBytes)})` : ""} — they can never come back.`;

  /* ---- t481 — the graves wear epitaphs ----
   * Two reading layers the one-line row could not carry:
   *  - the EPITAPH (a row's chevron): the run's own words (graveRunLine —
   *    the same sentence list_deleted quotes), the result line, the grave's
   *    date of death, the original id a restore brings it back under, the
   *    wires that re-attach, and — for a grave that cannot come back from
   *    here — the why, visible at last instead of living only in a title.
   *    One grave open at a time; the accordion keeps the eight visible
   *    rows tidy.
   *  - the ORDER (Sort: Newest / Heaviest): the weight view puts the
   *    heaviest graves first — bytes desc, weightless graves trailing in
   *    their own newest-first order. Offered only when the roll holds
   *    more than one grave AND at least one carries bytes (a sort the
   *    world cannot answer is a lying door); the overflow line's noun
   *    follows the order (older graves vs more graves). */
  const [openGrave, setOpenGrave] = React.useState<string | null>(null);
  const [graveSort, setGraveSort] = React.useState<"newest" | "weight">("newest");
  const anyGraveBytes = graves?.some((g) => g.bytes !== undefined) ?? false;
  const sortedGraves = React.useMemo(() => {
    if (!graves || graveSort === "newest") return graves ?? [];
    return [...graves].sort(
      (a, b) =>
        // weightless graves (bytes undefined) rank AFTER every weighed one —
        // they claim no bytes, so they claim no weight rank
        (b.bytes ?? -1) - (a.bytes ?? -1) ||
        (a.deletedAt < b.deletedAt ? 1 : a.deletedAt > b.deletedAt ? -1 : 0)
    );
  }, [graves, graveSort]);

  const handleGraveClear = React.useCallback(async () => {
    if (!graves || graves.length === 0) return;
    if (!burialArmed) {
      setBurialArmed(true);
      return;
    }
    setBurying(true);
    setGraveError(null);
    setGraveReceipt(null);
    try {
      // ?all=1 only ever rides the second step — when the spent are
      // already gone and what remains is restorable by name
      const includeRestorable = spentGraves.length === 0;
      const res = await fetch(
        `/api/jobs/deleted${includeRestorable ? "?all=1" : ""}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        buried?: number;
        spared?: { id: string; name?: string }[];
        bytesReclaimed?: number;
        keptWorkdirs?: number;
      };
      if (!res.ok || !json.ok) {
        setGraveError(json.error ?? `HTTP ${res.status}`);
      } else {
        const lines: string[] = [];
        if ((json.buried ?? 0) > 0) {
          lines.push(
            `Buried ${json.buried} grave${json.buried === 1 ? "" : "s"}` +
              ((json.bytesReclaimed ?? 0) > 0
                ? ` — ${fmtBytes(json.bytesReclaimed ?? 0)} reclaimed`
                : "")
          );
        } else {
          lines.push("Nothing to bury — the graveyard moved on since the roll");
        }
        if ((json.keptWorkdirs ?? 0) > 0) {
          lines.push(
            `${json.keptWorkdirs} workdir${json.keptWorkdirs === 1 ? "" : "s"} kept — a live job owns ${json.keptWorkdirs === 1 ? "it" : "them"} now`
          );
        }
        const spared = json.spared ?? [];
        if (spared.length > 0) {
          const named = spared
            .slice(0, 3)
            .map((s) => s.name ?? s.id)
            .join(", ");
          lines.push(
            `${spared.length} restorable grave${spared.length === 1 ? "" : "s"} spared (${named}${spared.length > 3 ? ", …" : ""}) — restore ${spared.length === 1 ? "it" : "them"} or clear again to bury ${spared.length === 1 ? "it" : "them"} too`
          );
        }
        setGraveReceipt(lines.join(" · "));
      }
    } catch {
      setGraveError("The burial failed — is the server reachable?");
    } finally {
      setBurying(false);
      setBurialArmed(false);
      void loadGraves();
      // the burial IS a clean — the map re-walks so the reclaimed bytes
      // leave the totals in the same breath the receipt claims them (the
      // handleCleaned law: a receipt's arithmetic must match a fresh walk)
      void load();
    }
  }, [graves, burialArmed, spentGraves.length, loadGraves, load]);

  /* ---- the clean bridge (t441): the shovel comes to visit the map ----
   * The door hands the run to the SAME tiered CleanupDialog the inspector
   * hosts (one eraser in this app, never a second one); the receipt waits
   * for the fresh walk and speaks only in the walk's own arithmetic. */
  const openClean = React.useCallback(
    (jobId: string) => {
      const job = storeJobs.find((j) => j.id === jobId) ?? null;
      if (!job) return;
      preClean.current = data
        ? {
            total: data.totalBytes,
            walkedAt: new Date(data.generatedAt).toLocaleTimeString(),
          }
        : null;
      setCleanJob(job);
    },
    [storeJobs, data]
  );

  const handleCleaned = React.useCallback(async () => {
    const job = cleanJob;
    const before = preClean.current;
    preClean.current = null;
    const after = await load();
    if (!job) return;
    if (after === null) {
      setReceipt(
        `Cleaned ${job.name} — the fresh walk failed; Refresh re-counts when the board answers`
      );
      return;
    }
    setReceipt(
      formatCleanReceipt(
        job.name,
        walkDelta(before?.total ?? null, after),
        before?.walkedAt
      )
    );
  }, [cleanJob, load]);

  const jobs = data ? sortJobs(data.jobs, jobSort) : [];
  const maxBytes = jobs.length > 0 ? Math.max(...jobs.map((j) => j.bytes), 1) : 1;
  const totalBytes = data?.totalBytes ?? 0;
  const catList = data
    ? STORAGE_CATEGORIES.map((meta) => ({
        ...meta,
        ...(data.byCategory[meta.id] ?? { bytes: 0, files: 0 }),
        share: totalBytes > 0 ? ((data.byCategory[meta.id]?.bytes ?? 0) / totalBytes) * 100 : 0,
      }))
    : [];

  /* ---- the file lens (t437): the active category's heaviest files ---- */
  const lensFiles = React.useMemo(
    () => (data && lens ? data.topFiles.filter((f) => f.category === lens) : []),
    [data, lens]
  );
  const lensMeta = lens ? (catList.find((c) => c.id === lens) ?? null) : null;
  /** t441: the feeding-runs view — one category, sorted by who holds it. */
  const lensRuns = React.useMemo(
    () => (data && lens ? runsForCategory(data.jobs, lens) : []),
    [data, lens]
  );
  const lensRunsMaxBytes =
    lensRuns.length > 0 ? Math.max(...lensRuns.map((r) => r.catBytes), 1) : 1;
  const lensMaxBytes =
    lensFiles.length > 0 ? Math.max(...lensFiles.map((f) => f.bytes), 1) : 1;
  const lensTotalFiles = lens && data ? (data.byCategory[lens]?.files ?? 0) : 0;

  /* ---- the run lens (t458): one run's stack, chips and file ledger ----
   * The census weighs every run once per walk; the whale line reads it.
   * Opening the run lens closes the category lens (siblings at the same
   * drill level — one looking at a time), and the lens's chip filter is
   * forgotten whenever the lens itself moves on. */
  const census = React.useMemo(
    () => (data ? runCensus(data.jobs, data.totalBytes) : []),
    [data]
  );
  const whale = whaleLine(census, data?.totalBytes ?? 0);
  const whaleDir = whale && census[0] ? census[0].row.dirName : null;
  const openRunLens = React.useCallback((dirName: string) => {
    setLens(null);
    setLensView("files");
    setRunLensDir(dirName);
    setRunCatFilter(null);
  }, []);
  const closeRunLens = React.useCallback(() => {
    setRunLensDir(null);
    setRunCatFilter(null);
  }, []);

  const runLensRow =
    data && runLensDir
      ? (data.jobs.find((j) => j.dirName === runLensDir) ?? null)
      : null;
  const runSlices = runLensRow ? categoriesOfRun(runLensRow) : [];
  const runFiles = runLensRow
    ? filesForRun(data?.topFiles ?? [], runLensRow.dirName, runCatFilter ?? undefined)
    : [];
  const runFileMax =
    runFiles.length > 0 ? Math.max(...runFiles.map((f) => f.bytes), 1) : 1;
  /* the ledger's honesty is SCOPED: with a category chip active, "files
   * on disk" means that category's own count (a run whose maps made the
   * ledger says nothing about its logs), so the same three-state law
   * (runLedgerState) answers per scope. */
  const ledgerDiskFiles = runLensRow
    ? runCatFilter
      ? (runLensRow.categories[runCatFilter]?.files ?? 0)
      : runLensRow.files
    : 0;
  const ledgerState = runLensRow
    ? runLedgerState({ files: ledgerDiskFiles }, runFiles.length)
    : "empty";
  const ledgerLine =
    ledgerState === "ledger" ? runLedgerLine(runFiles.length, ledgerDiskFiles) : null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/[0.07] to-transparent px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <HardDrive className="size-4 text-primary" aria-hidden="true" />
            Project storage
          </DialogTitle>
          <DialogDescription>
            What {project?.name ?? "this project"} keeps on disk — the whales first.
            Categories are read from file extensions; the walk is the physical truth.
            Eraser doors clean a run in place; the weigh door (t458) breaks one down
            by category without leaving the board; the numbers re-walk after a clean.
          </DialogDescription>
        </DialogHeader>

        <div className="nice-scroll flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-danger-500/30 bg-danger/[0.06] p-4">
              <p className="text-sm text-danger">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <RotateCcw className="size-3.5" aria-hidden="true" /> Try again
              </Button>
            </div>
          ) : !data ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Walking the run directories…
            </div>
          ) : (
            <>
              {/* ---- the summary: total + fetched-at + refresh ---- */}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total on disk
                  </p>
                  <p className="text-2xl font-semibold tabular-nums tracking-tight">
                    {fmtBytes(data.totalBytes)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.totalFiles.toLocaleString()} file{data.totalFiles === 1 ? "" : "s"} across{" "}
                    {data.jobs.length} run director{data.jobs.length === 1 ? "y" : "ies"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    fetched {new Date(data.generatedAt).toLocaleTimeString()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void load()}
                    disabled={loading}
                    aria-label="Refresh storage numbers"
                  >
                    <RefreshCw
                      className={`size-3.5${loading ? " animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* ---- t458: the whale line — the heaviest run, named by
                   the walk, and the line itself is the door into that
                   run's lens. Silent when there is nothing to name. */}
              {whale && whaleDir && (
                <button
                  type="button"
                  onClick={() => openRunLens(whaleDir)}
                  className="mt-3 flex w-full items-start gap-2 rounded-lg border border-violet-500/30 bg-violet-500/[0.06] px-3 py-2 text-left text-xs text-violet-700 transition-colors hover:bg-violet-500/[0.12] dark:text-violet-300"
                  title="The heaviest run — click to weigh it by category right here"
                  aria-label="The heaviest run — open its run lens"
                >
                  <HardDrive className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {whale}{" "}
                    <span className="font-medium underline decoration-dotted underline-offset-2">
                      Weigh it →
                    </span>
                  </span>
                </button>
              )}

              {/* ---- t441: the clean receipt — the walk's own account of
                   the last clean. Printed only from the fresh reload, so
                   the line is always about the numbers now on screen. */}
              {receipt && (
                <p
                  data-storage-receipt=""
                  className="mt-3 flex items-start gap-2 rounded-lg border border-running/30 bg-running/[0.06] px-3 py-2 text-xs text-running-700 dark:text-running-300"
                >
                  <Eraser className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {receipt}
                </p>
              )}

              {/* ---- the category lens: one stacked bar + lens chips ----
                   t437: a chip is now a door — clicking it drills from the
                   run level into the file level of that category. The bar
                   dims every segment the lens is not looking at. */}
              {totalBytes > 0 ? (
                <div className="mt-4">
                  <div
                    className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label="Disk usage by file category"
                  >
                    {catList.map(
                      (c) =>
                        c.share > 0 && (
                          <div
                            key={c.id}
                            className={`${CATEGORY_COLORS[c.id]} transition-opacity duration-300 ${
                              lens && lens !== c.id ? "opacity-25" : "opacity-100"
                            }`}
                            style={{ width: `${c.share}%` }}
                            title={`${c.label} — ${fmtBytes(c.bytes)} (${c.share.toFixed(0)}%)`}
                          />
                        )
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                    {catList.map(
                      (c) =>
                        c.bytes > 0 && (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={lens === c.id}
                            onClick={() => {
                              // t458: siblings at one drill level — opening
                              // the category lens closes the run lens
                              setRunLensDir(null);
                              setRunCatFilter(null);
                              setLens(lens === c.id ? null : c.id);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors ${
                              CATEGORY_TEXT[c.id]
                            } ${
                              lens === c.id
                                ? "bg-muted font-semibold ring-1 ring-inset ring-border"
                                : lens
                                  ? "opacity-60 hover:opacity-100 hover:bg-muted/40"
                                  : "hover:bg-muted/40"
                            }`}
                            title={`${c.hint} — click to drill into the heaviest ${c.label.toLowerCase()} files`}
                          >
                            <span
                              className={`inline-block size-2 rounded-full ${CATEGORY_COLORS[c.id]}`}
                              aria-hidden="true"
                            />
                            {c.label} {fmtBytes(c.bytes)}
                            <span className="text-muted-foreground">
                              ({c.share.toFixed(0)}%)
                            </span>
                          </button>
                        )
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {data.hasRuns
                    ? "The run directories are all empty — nothing to weigh yet."
                    : "This project has not run anything on this machine yet — no bytes to report."}
                </p>
              )}

              {/* ---- the per-run table (the lens's home view) ----
                   t458: hidden while the run lens is open (the two are
                   the same drill slot); the row bar is now the run's
                   category STACK — the board's palette, the palette's
                   own order — and each row grows a weigh door. */}
              {!lens && !runLensDir && jobs.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Runs
                    </p>
                    <div className="flex items-center gap-1" role="group" aria-label="Sort runs">
                      {(["heaviest", "name"] as const).map((key) => (
                        <Button
                          key={key}
                          variant="ghost"
                          size="sm"
                          aria-pressed={jobSort === key}
                          className={`h-6 px-2 text-[11px] capitalize ${
                            jobSort === key
                              ? "border border-primary/50 bg-primary/[0.06] text-primary"
                              : "border border-transparent text-muted-foreground"
                          }`}
                          onClick={() => setJobSort(key)}
                        >
                          {key === "heaviest" ? "Heaviest first" : "By name"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <ul className="mt-2 divide-y divide-border/60">
                    {jobs.map((job) => {
                      const orphan = job.jobId === null;
                      const cleanRowJob =
                        !orphan && job.jobId
                          ? storeJobs.find((j) => j.id === job.jobId)
                          : undefined;
                      const top = STORAGE_CATEGORIES.map((m) => ({
                        id: m.id,
                        ...(job.categories[m.id] ?? { bytes: 0, files: 0 }),
                      }))
                        .filter((c) => c.bytes > 0)
                        .sort((a, b) => b.bytes - a.bytes)[0];
                      return (
                        <li key={job.dirName} className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={orphan}
                            onClick={() => {
                              if (!job.jobId) return;
                              inspect(job.jobId);
                              onOpenChange(false);
                            }}
                            className={`flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors ${
                              orphan
                                ? "cursor-default bg-warning/[0.05]"
                                : "hover:bg-muted/40"
                            }`}
                            title={
                              orphan
                                ? "No job record points at this directory — a deleted job's leftover, an older server's run, or a shared asset directory (like the project's micrograph store)"
                                : `Open ${job.name}'s inspector — or use the eraser to clean it in place`
                            }
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {job.name}
                                {orphan && (
                                  <span className="ml-2 rounded border border-warning/40 bg-warning/10 px-1 py-px text-[10px] font-medium text-warning-700 dark:text-warning-300">
                                    no job record
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                {job.dirName} · {job.type}{" "}
                                <StoragePours type={job.type} /> · {job.status}
                              </p>
                            </div>
                            <div className="w-28 shrink-0 sm:w-36">
                              {/* t458: the stack — one segment per
                                  above-zero category, in the palette's
                                  own order; a run's bar now says WHERE
                                  its bytes live, not just how many. */}
                              <div
                                className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
                                role="img"
                                aria-label={`${job.name} disk usage by category`}
                              >
                                {runStackSegments(job.categories, maxBytes).map((seg) => (
                                  <div
                                    key={seg.id}
                                    className={`${CATEGORY_COLORS[seg.id]} transition-opacity duration-300`}
                                    style={{ width: `${Math.max(seg.pct, job.bytes > 0 ? 2 : 0)}%` }}
                                    title={`${seg.id} — ${fmtBytes(job.categories[seg.id]?.bytes ?? 0)}`}
                                  />
                                ))}
                              </div>
                              <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                                {top ? (
                                  <>
                                    mostly <span className={CATEGORY_TEXT[top.id]}>{top.id}</span>
                                  </>
                                ) : (
                                  "—"
                                )}
                              </p>
                            </div>
                            <div className="w-20 shrink-0 text-right sm:w-24">
                              <p className="text-sm font-medium tabular-nums">
                                {fmtBytes(job.bytes)}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {job.files.toLocaleString()} file{job.files === 1 ? "" : "s"}
                              </p>
                            </div>
                          </button>
                          {/* t458: the weigh door — the run lens opens
                              in place, no inspector trip needed. */}
                          <WeighDoor name={job.name} onOpen={() => openRunLens(job.dirName)} />
                          {cleanRowJob && (
                            <CleanDoor
                              name={job.name}
                              status={cleanRowJob.status}
                              onOpen={() => {
                                if (!job.jobId) return;
                                openClean(job.jobId);
                              }}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* ---- the run lens (t458): one run, weighed in place —
                   its category stack, its chips, its file ledger. The
                   mirror of the category lens: either dimension first,
                   the same file-level terminus. Orphans keep the amber
                   honesty (physical truth, no inspector to jump to). */}
              {runLensRow && (
                <div className="mt-5" aria-label={`${runLensRow.name} run lens`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Run · {runLensRow.name}
                    </p>
                    <div className="flex items-center gap-1">
                      {runLensRow.jobId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 border border-transparent px-2 text-[11px] text-muted-foreground"
                          onClick={() => {
                            inspect(runLensRow.jobId as string);
                            onOpenChange(false);
                          }}
                          title="Open this run's inspector — the planner's tiers and the shovel live there"
                        >
                          Inspector
                        </Button>
                      )}
                      {(() => {
                        const cleanRowJob = runLensRow.jobId
                          ? storeJobs.find((j) => j.id === runLensRow.jobId)
                          : undefined;
                        return cleanRowJob ? (
                          <CleanDoor
                            name={runLensRow.name}
                            status={cleanRowJob.status}
                            onOpen={() => {
                              if (!runLensRow.jobId) return;
                              openClean(runLensRow.jobId as string);
                            }}
                          />
                        ) : null;
                      })()}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 border border-transparent px-2 text-[11px] text-muted-foreground"
                        onClick={closeRunLens}
                      >
                        <ArrowLeft className="size-3" aria-hidden="true" />
                        All runs
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="text-sm font-semibold">{runLensRow.name}</p>
                      {runLensRow.jobId === null && (
                        <span className="rounded border border-warning/40 bg-warning/10 px-1 py-px text-[10px] font-medium text-warning-700 dark:text-warning-300">
                          no job record
                        </span>
                      )}
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {fmtBytes(runLensRow.bytes)} · {runLensRow.files.toLocaleString()} file
                        {runLensRow.files === 1 ? "" : "s"}
                        {data && data.totalBytes > 0 && runLensRow.bytes > 0
                          ? ` · ${(runLensRow.bytes / data.totalBytes).toFixed(0)}% of the project`
                          : ""}
                      </p>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      {runLensRow.dirName} · {runLensRow.type}{" "}
                      <StoragePours type={runLensRow.type} /> · {runLensRow.status}
                    </p>

                    {/* the run's own stack — the same palette and order
                        the board's rows speak, one size up */}
                    <div
                      className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`${runLensRow.name} disk usage by category`}
                    >
                      {runStackSegments(runLensRow.categories, maxBytes).map((seg) => (
                        <div
                          key={seg.id}
                          className={`${CATEGORY_COLORS[seg.id]} transition-opacity duration-300 ${
                            runCatFilter && runCatFilter !== seg.id ? "opacity-25" : "opacity-100"
                          }`}
                          style={{ width: `${Math.max(seg.pct, runLensRow.bytes > 0 ? 2 : 0)}%` }}
                          title={`${seg.id} — ${fmtBytes(runLensRow.categories[seg.id]?.bytes ?? 0)}`}
                        />
                      ))}
                    </div>

                    {/* the category chips — the filter, in the palette's
                        own order; the run's stack dims everything the
                        chip is not looking at */}
                    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                      <button
                        type="button"
                        aria-pressed={runCatFilter === null}
                        onClick={() => setRunCatFilter(null)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-foreground transition-colors ${
                          runCatFilter === null
                            ? "bg-muted font-semibold ring-1 ring-inset ring-border"
                            : "opacity-60 hover:opacity-100 hover:bg-muted/40"
                        }`}
                        title="All of this run's categories"
                      >
                        All {fmtBytes(runLensRow.bytes)}
                      </button>
                      {runSlices.map((slice) => (
                        <button
                          key={slice.id}
                          type="button"
                          aria-pressed={runCatFilter === slice.id}
                          onClick={() => setRunCatFilter(runCatFilter === slice.id ? null : slice.id)}
                          className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors ${
                            CATEGORY_TEXT[slice.id]
                          } ${
                            runCatFilter === slice.id
                              ? "bg-muted font-semibold ring-1 ring-inset ring-border"
                              : runCatFilter
                                ? "opacity-60 hover:opacity-100 hover:bg-muted/40"
                                : "hover:bg-muted/40"
                          }`}
                          title={`${slice.share.toFixed(0)}% of this run's bytes`}
                        >
                          <span
                            className={`inline-block size-2 rounded-full ${CATEGORY_COLORS[slice.id]}`}
                            aria-hidden="true"
                          />
                          {slice.id} {fmtBytes(slice.bytes)}
                          <span className="text-muted-foreground">
                            ({slice.share.toFixed(0)}%)
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* the file ledger — the walk's whale rows that live
                        in this run, scoped to the chip when one is lit.
                        Three honest states (t458's law): rows, unlisted
                        (amber — a fact about the ledger), or empty. */}
                    {ledgerState === "ledger" ? (
                      <>
                        <p className="mt-2 text-[11px] text-muted-foreground">{ledgerLine}</p>
                        <ul className="mt-1 divide-y divide-border/60">
                          {runFiles.map((f) => {
                            const orphan = runLensRow.jobId === null;
                            return (
                              <li key={f.path ?? `${f.dirName}:${f.bytes}:${f.category}`}>
                                <button
                                  type="button"
                                  disabled={orphan}
                                  onClick={() => {
                                    if (!runLensRow.jobId) return;
                                    inspect(runLensRow.jobId as string);
                                    onOpenChange(false);
                                  }}
                                  className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
                                    orphan
                                      ? "cursor-default bg-warning/[0.05]"
                                      : "hover:bg-muted/40"
                                  }`}
                                  title={
                                    orphan
                                      ? "No job record points at this run — nothing to inspect"
                                      : `Open ${runLensRow.name}'s inspector (its Clean intermediates button lives there)`
                                  }
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-mono text-xs" title={f.path}>
                                      {f.path}
                                    </p>
                                  </div>
                                  <div className="w-24 shrink-0 sm:w-32">
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                      <div
                                        className={`h-full rounded-full ${CATEGORY_COLORS[f.category]}`}
                                        style={{
                                          width: `${Math.max((f.bytes / runFileMax) * 100, 2)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="w-20 shrink-0 text-right sm:w-24">
                                    <p className="text-sm font-medium tabular-nums">
                                      {fmtBytes(f.bytes)}
                                    </p>
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : ledgerState === "unlisted" ? (
                      <p className="mt-2 rounded-md border border-dashed border-warning/40 bg-warning/[0.05] p-3 text-xs text-warning-700 dark:text-warning-300">
                        {ledgerDiskFiles.toLocaleString()} file
                        {ledgerDiskFiles === 1 ? "" : "s"} on disk
                        {runCatFilter ? " in this category" : ""} — but none made the walk's
                        whale ledger (it keeps the heaviest few per category). The run is NOT
                        empty; the full listing lives in its inspector.
                      </p>
                    ) : (
                      <p className="mt-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                        The walk counted no files here
                        {runCatFilter ? " in this category" : ""} — the directory is empty of
                        {runCatFilter ? " that category" : " files"}; Refresh re-walks it.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ---- the file lens (t437): one category's heaviest files ----
                   The runs table names the whale RUNS; this names the whale
                   FILES inside them — the actual bytes a Clean would free.
                   Same row grammar as the runs table: a bar in the lens's
                   own color, a jump to the inspector where the shovel
                   lives, amber honesty for rows with no job record. */}
              {lens && lensMeta && (
                <div className="mt-5" aria-label={`${lensMeta.label} file lens`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {lensView === "files" ? "Files" : "Runs"} · {lensMeta.label}
                    </p>
                    <div className="flex items-center gap-1">
                      {/* t441: the lens's second view — the same category
                          read by RUN (who feeds the whale) instead of by
                          FILE (the whale's teeth). Same grammar as the
                          runs-table sort pair. */}
                      <div
                        className="flex items-center gap-1"
                        role="group"
                        aria-label={`${lensMeta.label} lens view`}
                      >
                        {(["files", "runs"] as const).map((v) => (
                          <Button
                            key={v}
                            variant="ghost"
                            size="sm"
                            aria-pressed={lensView === v}
                            className={`h-6 px-2 text-[11px] ${
                              lensView === v
                                ? "border border-primary/50 bg-primary/[0.06] text-primary"
                                : "border border-transparent text-muted-foreground"
                            }`}
                            onClick={() => setLensView(v)}
                          >
                            {v === "files" ? "Whale files" : "Feeding runs"}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 border border-transparent px-2 text-[11px] text-muted-foreground"
                        onClick={() => setLens(null)}
                      >
                        <ArrowLeft className="size-3" aria-hidden="true" />
                        All runs
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span
                        className={`inline-block size-2.5 shrink-0 self-center rounded-full ${CATEGORY_COLORS[lens]}`}
                        aria-hidden="true"
                      />
                      <p className="text-sm font-semibold">{lensMeta.label}</p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {fmtBytes(lensMeta.bytes)} · {lensMeta.share.toFixed(0)}% of the project
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{lensMeta.hint}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {lensView === "files"
                        ? lensFiles.length === 0
                          ? "no files above zero bytes — the lens is empty"
                          : lensTotalFiles > lensFiles.length
                            ? `the heaviest ${lensFiles.length} of ${lensTotalFiles.toLocaleString()} file${
                                lensTotalFiles === 1 ? "" : "s"
                              } — the whales' whales`
                            : `all ${lensTotalFiles.toLocaleString()} file${
                                lensTotalFiles === 1 ? "" : "s"
                              } in this category`
                        : lensRuns.length === 0
                          ? "no run holds bytes here yet — the lens is empty"
                          : `${lensRuns.length} run${lensRuns.length === 1 ? "" : "s"} feed${
                              lensRuns.length === 1 ? "s" : ""
                            } this category — heaviest first`}
                    </p>

                    {lensView === "files" ? (
                      lensFiles.length > 0 ? (
                      <ul className="mt-2 divide-y divide-border/60">
                        {lensFiles.map((f) => {
                          const orphan = f.jobId === null;
                          return (
                            <li key={f.path}>
                              <button
                                type="button"
                                disabled={orphan}
                                onClick={() => {
                                  if (!f.jobId) return;
                                  inspect(f.jobId);
                                  onOpenChange(false);
                                }}
                                className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
                                  orphan
                                    ? "cursor-default bg-warning/[0.05]"
                                    : "hover:bg-muted/40"
                                }`}
                                title={
                                  orphan
                                    ? "No job record points at this file's run directory — nothing to inspect"
                                    : `Open ${f.jobName}'s inspector (its Clean intermediates button lives there)`
                                }
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-mono text-xs" title={f.path}>
                                    {f.path}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                    {orphan ? (
                                      <span className="rounded border border-warning/40 bg-warning/10 px-1 py-px text-[10px] font-medium text-warning-700 dark:text-warning-300">
                                        no job record · {f.dirName}
                                      </span>
                                    ) : (
                                      f.jobName
                                    )}
                                  </p>
                                </div>
                                <div className="w-24 shrink-0 sm:w-32">
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${CATEGORY_COLORS[lens]}`}
                                      style={{
                                        width: `${Math.max((f.bytes / lensMaxBytes) * 100, 2)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="w-20 shrink-0 text-right sm:w-24">
                                  <p className="text-sm font-medium tabular-nums">
                                    {fmtBytes(f.bytes)}
                                  </p>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      ) : (
                        <p className="mt-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                          Nothing above zero bytes in this category — the disk
                          moved on since the fetch; Refresh re-walks it.
                        </p>
                      )
                    ) : lensRuns.length > 0 ? (
                      <ul
                        className="mt-2 divide-y divide-border/60"
                        aria-label={`Runs holding ${lensMeta.label.toLowerCase()} bytes`}
                      >
                        {lensRuns.map((r) => {
                          const orphan = r.jobId === null;
                          const cleanRowJob =
                            !orphan && r.jobId
                              ? storeJobs.find((j) => j.id === r.jobId)
                              : undefined;
                          return (
                            <li key={r.dirName} className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={orphan}
                                onClick={() => {
                                  if (!r.jobId) return;
                                  inspect(r.jobId);
                                  onOpenChange(false);
                                }}
                                className={`flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors ${
                                  orphan
                                    ? "cursor-default bg-warning/[0.05]"
                                    : "hover:bg-muted/40"
                                }`}
                                title={
                                  orphan
                                    ? `No job record points at this directory — ${r.dirName} holds ${fmtBytes(r.catBytes)} of the ${lensMeta.label.toLowerCase()} but has no inspector`
                                    : `Open ${r.name}'s inspector — ${fmtBytes(r.catBytes)} of ${lensMeta.label.toLowerCase()} lives here`
                                }
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {r.name}
                                    {orphan && (
                                      <span className="ml-2 rounded border border-warning/40 bg-warning/10 px-1 py-px text-[10px] font-medium text-warning-700 dark:text-warning-300">
                                        no job record
                                      </span>
                                    )}
                                  </p>
                                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                    {r.dirName} · {r.type}{" "}
                                    <StoragePours type={r.type} /> · {r.status}
                                  </p>
                                </div>
                                <div className="w-24 shrink-0 sm:w-32">
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${CATEGORY_COLORS[lens]}`}
                                      style={{
                                        width: `${Math.max((r.catBytes / lensRunsMaxBytes) * 100, 2)}%`,
                                      }}
                                    />
                                  </div>
                                  <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                                    {lensMeta.bytes > 0
                                      ? `${((r.catBytes / lensMeta.bytes) * 100).toFixed(0)}% of the lens`
                                      : "—"}
                                  </p>
                                </div>
                                <div className="w-20 shrink-0 text-right sm:w-24">
                                  <p className="text-sm font-medium tabular-nums">
                                    {fmtBytes(r.catBytes)}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {r.catFiles.toLocaleString()} file{r.catFiles === 1 ? "" : "s"}
                                  </p>
                                </div>
                              </button>
                              {/* t458: the weigh door crosses the matrix —
                                  a feeding run of one category opens its
                                  full run lens (all categories) in place. */}
                              <WeighDoor name={r.name} onOpen={() => openRunLens(r.dirName)} />
                              {cleanRowJob && (
                                <CleanDoor
                                  name={r.name}
                                  status={cleanRowJob.status}
                                  onOpen={() => {
                                    if (!r.jobId) return;
                                    openClean(r.jobId);
                                  }}
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                        Nothing above zero bytes in this category — the disk
                        moved on since the fetch; Refresh re-walks it.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {data.truncated && (
                <p className="mt-3 rounded-lg border border-warning/30 bg-warning/[0.06] p-3 text-xs text-warning-700 dark:text-warning-300">
                  The walk hit its entry cap — the numbers above are floors, not totals.
                </p>
              )}

              {/* ---- t478: the graveyard drawer — the deleted live next
                   door. The roll call is graveRowsOf's own rows (the same
                   brain the agent's list_deleted reads); restorable graves
                   wear a Restore door that feeds the grave's OWN snapshot
                   back through the store's restore law; row-less graves
                   and occupied ids say what they can and cannot do.
                   t769 — each grave's type chip speaks the pours (the
                   helper's FOURTH seat): the water previews the wires
                   the Restore door re-attaches, the promise seat's
                   restoration face. */}
              {graves && graves.length > 0 && (
                <div
                  data-testid="graveyard-drawer"
                  className="mt-4 rounded-lg border border-border/70 bg-muted/30 p-3"
                >
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Undo2 className="size-3.5" aria-hidden="true" />
                    Recently deleted ({graves.length})
                    {graveBytesTotal > 0 && (
                      <span
                        className="normal-case tracking-normal tabular-nums text-muted-foreground/80"
                        title="What the deleted jobs' surviving workdirs still weigh on disk — the storage map counts these bytes, the graves name them. Clear the graves to reclaim them."
                      >
                        · {fmtBytes(graveBytesTotal)} still on disk
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="graveyard-clear"
                      className={`ml-auto h-6 shrink-0 gap-1 px-2 text-[11px] ${
                        burialArmed
                          ? "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
                          : "text-muted-foreground hover:text-destructive"
                      }`}
                      disabled={burying || restoringId !== null}
                      onClick={() => void handleGraveClear()}
                      aria-label={
                        burialArmed
                          ? armedLabel
                          : spentGraves.length > 0
                            ? `Clear ${spentGraves.length} spent graves — graves that can no longer be restored`
                            : `Bury ${restorableGraves.length} restorable graves permanently`
                      }
                      title={clearTitle}
                    >
                      <Trash2
                        className={`size-3${burying ? " animate-spin" : ""}`}
                        aria-hidden="true"
                      />
                      {burialArmed ? armedLabel : clearLabel}
                    </Button>
                  </p>
                  {spareHint && (
                    <p
                      data-testid="graveyard-spare-hint"
                      className="mt-1.5 text-[10px] leading-snug text-muted-foreground/80"
                      title={`${restorableGraves.length} restorable grave${restorableGraves.length === 1 ? "" : "s"} the Clear door will NOT touch: ${restorableGraves.map((g) => g.name ?? g.id).join(", ")}`}
                    >
                      {spareHint}
                    </p>
                  )}
                  {sortedGraves.length > 1 && anyGraveBytes && (
                    <div
                      className="mt-1.5 flex items-center justify-end gap-1"
                      role="group"
                      aria-label="Graveyard order"
                    >
                      <span className="text-[10px] text-muted-foreground/70">Sort</span>
                      <button
                        type="button"
                        data-testid="graveyard-sort-newest"
                        aria-pressed={graveSort === "newest"}
                        onClick={() => setGraveSort("newest")}
                        className={`h-5 rounded px-1.5 text-[10px] ${
                          graveSort === "newest"
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Newest first
                      </button>
                      <button
                        type="button"
                        data-testid="graveyard-sort-weight"
                        aria-pressed={graveSort === "weight"}
                        onClick={() => setGraveSort("weight")}
                        className={`h-5 rounded px-1.5 text-[10px] ${
                          graveSort === "weight"
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Heaviest first — the graves still holding workdirs lead, the weightless trail in their own newest-first order"
                      >
                        Heaviest first
                      </button>
                    </div>
                  )}
                  <ul className="mt-2 space-y-1">
                    {sortedGraves.slice(0, 8).map((g) => {
                      const open = openGrave === g.id;
                      return (
                        <li key={g.id} data-testid="graveyard-row" className="block">
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              data-testid="graveyard-row-toggle"
                              className="-m-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-expanded={open}
                              aria-controls={`graveyard-epitaph-${g.id}`}
                              aria-label={`${open ? "Hide" : "Read"} the epitaph of ${g.name ?? g.id}`}
                              title="The grave's epitaph — what its run was, the id it comes back under, its wires"
                              onClick={() => setOpenGrave(open ? null : g.id)}
                            >
                              <ChevronRight
                                className={`size-3 transition-transform${open ? " rotate-90" : ""}`}
                                aria-hidden="true"
                              />
                            </button>
                            <span
                              className="min-w-0 flex-1 truncate font-medium"
                              title={g.run?.result ? `${g.name ?? g.id} — ${g.run.result}` : g.name ?? g.id}
                            >
                              {g.name ?? g.id}
                            </span>
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {g.type}
                            </span>
                            <StoragePours type={g.type} />
                            <span
                              className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                              title={new Date(g.deletedAt).toLocaleString()}
                            >
                              {graveAge(g.deletedAt)}
                            </span>
                            {g.bytes !== undefined && (
                              <span
                                className="shrink-0 text-[10px] tabular-nums text-muted-foreground/80"
                                title={`${fmtBytes(g.bytes)} of run output still in the grave's workdir — reclaim it with Clear`}
                              >
                                {fmtBytes(g.bytes)}
                              </span>
                            )}
                            {g.restorable ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 shrink-0 gap-1 px-2 text-[11px] text-primary hover:text-primary"
                                disabled={restoringId === g.id}
                                onClick={() => void handleGraveRestore(g.id)}
                                aria-label={`Restore ${g.name ?? g.type} to the canvas`}
                                title="Bring it back under its original id — its workdir, run record and wires re-attach as if the delete never happened"
                              >
                                <Undo2
                                  className={`size-3${restoringId === g.id ? " animate-spin" : ""}`}
                                  aria-hidden="true"
                                />
                                Restore
                              </Button>
                            ) : (
                              <span
                                className={`shrink-0 text-[10px] ${g.rowSnapshot ? "text-warning" : "text-muted-foreground/70"}`}
                                title={g.why}
                              >
                                {g.rowSnapshot ? "already restored" : "canvas undo only"}
                              </span>
                            )}
                          </div>
                          {open && (
                            <div
                              id={`graveyard-epitaph-${g.id}`}
                              data-testid="graveyard-epitaph"
                              className="ml-4 mt-1 space-y-0.5 rounded-r border-l-2 border-border/70 bg-background/60 px-2.5 py-1.5 text-[10px] leading-snug text-muted-foreground"
                            >
                              {g.runLine && (
                                <p className="tabular-nums">
                                  {g.runLine}
                                  {g.run?.result ? (
                                    <span className="text-foreground/70"> — “{g.run.result}”</span>
                                  ) : null}
                                </p>
                              )}
                              <p>
                                deleted{" "}
                                <span className="tabular-nums" title="The grave's date of death">
                                  {new Date(g.deletedAt).toLocaleString()}
                                </span>
                              </p>
                              <p>
                                id{" "}
                                <span
                                  className="font-mono text-[9px]"
                                  title="The original id a restore brings it back under"
                                >
                                  {g.id}
                                </span>
                              </p>
                              <p>
                                {g.edges === 0
                                  ? "no wires to neighbours"
                                  : `${g.edges} wire${g.edges === 1 ? "" : "s"} to neighbours — they re-attach when the job comes back`}
                              </p>
                              {!g.restorable && g.why && (
                                <p className={g.rowSnapshot ? "text-warning" : ""}>
                                  {g.why}
                                </p>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {graves.length > 8 && (
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      …and {graves.length - 8} {graveSort === "weight" ? "more" : "older"} grave
                      {graves.length - 8 === 1 ? "" : "s"} the agent can still name (list_deleted)
                    </p>
                  )}
                </div>
              )}
              {/* t479 — the burial's receipt and its error live OUTSIDE the
                  section gate: a FULL burial unmounts the drawer (zero
                  graves), and the one line the user needs — what died, how
                  many bytes came back, who was spared — dies with it if it
                  renders inside. After a full burial the receipt stands
                  alone where the drawer was; after a spare the receipt
                  reads under the surviving rows. */}
              {graveError && (
                <p
                  data-testid="graveyard-error"
                  className="mt-2 rounded-md border border-destructive/30 bg-destructive/[0.06] px-2.5 py-1.5 text-xs text-destructive"
                >
                  {graveError}
                </p>
              )}
              {graveReceipt && (
                <p
                  data-testid="graveyard-receipt"
                  className="mt-2 rounded-md border border-running/30 bg-running/[0.06] px-2.5 py-1.5 text-xs text-running-700 dark:text-running-300"
                >
                  {graveReceipt}
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* t441 — the visiting shovel: the SAME tiered CleanupDialog the
        inspector hosts, mounted only while a run is on the table. Its
        onCleaned triggers the fresh walk and the walk's own receipt. */}
    {cleanJob && (
      <CleanupDialog
        job={cleanJob}
        open
        onOpenChange={(v) => {
          if (!v) setCleanJob(null);
        }}
        onCleaned={() => void handleCleaned()}
      />
    )}
    </>
  );
}
