"use client";

/**
 * CryoFlow — the session QC report (t197): the page where the report
 * families meet under one cover.
 *
 * Three families speak here, each in its OWN voice and its own provenance:
 *   • the pipeline glance — live from the workflow store (cheap, always
 *     current);
 *   • the map QC section — buildProfileReport's output bound VERBATIM,
 *     measured WITHOUT the viewer: the session's latest succeeded job
 *     with 3D maps is profiled through the same map-profile API the
 *     slice instrument drinks from, so the job-level report answers the
 *     FSC question (do the halves corroborate each other?) even for
 *     people who never opened a single map;
 *   • the scheduling sweep annex — the store's lastSweep bound VERBATIM
 *     through buildSweepReport, exactly the bytes the HPC panel exports.
 *
 * The binding father (buildSessionReport) never parses the families'
 * outputs — the session report does not re-translate the families'
 * translations, it binds them.
 *
 * Contracts carried over from the family's earlier rounds:
 * - ONE md string feeds clipboard + download + the data-md carrier (no
 *   parse-of-parse, t194); the carrier is ALWAYS attached (t191).
 * - Copy falls back to a download when the clipboard is denied, and the
 *   receipt SAYS so — honesty covers both worlds (t188 B3 / t195 D5).
 * - No timestamps in the bytes — the same session state yields the same
 *   document; the filename carries the stamp (t195's doctrine).
 * - Every family with nothing to say gets an honest empty state that
 *   teaches where its numbers come from (t195's empty doctrine).
 * - The report is the ONE dialog that IS a document: while it is open,
 *   body[data-report-print] flips the print contract from "dialogs step
 *   aside" (Task 70) to "only the report prints" — Markdown→PDF is the
 *   whole point of a report page.
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
import { Copy, Download, FileDown, Printer } from "lucide-react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { downloadText } from "@/lib/download";
import type { JobDTO } from "@/lib/types";
import {
  buildProfileReport,
  buildSessionReport,
  buildSweepReport,
  sessionReportFilename,
  type ReportOverlay,
} from "@/lib/qc-report";
import { useWorkflowStore } from "@/lib/store";

/** one candidate's 3D-map set (paths relative to the job's workdir) */
interface MapBrief {
  jobId: string;
  main: { path: string; name: string };
  overlays: { path: string; name: string }[];
}

/** t212: one volume owner, as the walk records it. The SAME walk that
 *  picks the deep-report winner now RECORDS every owner it passes —
 *  the inventory costs zero extra outputs probes, and no map hides
 *  below the fold (the t211 lesson, generalized: the old walk stopped
 *  at the first winner and left the rest of the world unseen). */
interface MapOwner extends MapBrief {
  jobName: string;
  volumeCount: number;
}

interface OutputsResponse {
  files?: { path: string; name: string; kind: string; dims?: [number, number, number]; label?: string }[];
}
interface ProfileResponse {
  bins?: number[];
  error?: string;
}

/** Full-map variants lead the report; halves and masked maps compare. */
const MAIN_MAP_RE = /half0|postprocess\.mrc$/i;

/** Types that can ever own a true 3D volume (t211). The walk probes these
 *  FIRST — an import/motioncorr/ctffind/extract candidate has never held a
 *  map, and spending the probe budget on them is how the old walk lied:
 *  its cap of 8 newest completed jobs landed exactly on the demo
 *  pipeline's map-less upper half while a Refine3D four rows down owned
 *  four volumes — and the report declared a world WITH maps to have none.
 *  A lying instrument is the gravest sin; the walk now spends its budget
 *  on plausible owners before it touches the never-volume tail. */
const VOLUME_CAPABLE_RE = /refine3d|class3d|postprocess|multibody/i;

/** The walk's probe budget. Volume-capable candidates ride the front of
 *  the queue (see VOLUME_CAPABLE_RE), so the budget lands on real map
 *  owners; 24 covers the demo world's whole roster well past three
 *  times — the honest failure mode is "scanned them all, none speaks",
 *  never "never asked". */
const MAP_BRIEF_CAP = 24;

/** Newest first — as a real three-way comparator. The old one-liner
 *  `(a.updatedAt < b.updatedAt ? 1 : -1)` answers -1 on EQUAL stamps,
 *  silently reversing same-instant jobs (a gallery restore writes them
 *  all at once); the id tiebreak keeps the order deterministic. */
const byRecency = (a: JobDTO, b: JobDTO) =>
  a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1;

/**
 * t213 — the roster's rows are doors. t210 taught the strip that a name
 * on a bracket should never be a dead end (a covered door is a lying
 * door); t212 put every owner's NAME on the paper — but a name on a
 * roster you cannot press is still a dead end. The inventory's rows now
 * open the owner's results through openJob (the palette's own engine:
 * workspace hops, landing repair, then the inspector for a non-idle
 * job). The doors live ONLY on the screen: the exported bytes stay
 * plain Markdown — a door needs a page to open — so the paper's
 * contracts (t194 one-md, t212's byte pins) are untouched.
 *
 * Mechanics: the rendered document is one ReactMarkdown tree, so the
 * doors ride a component override keyed on the ONE table whose head is
 * exactly [Job, Main map, Volumes] — the Comparison table (Map | Bins |
 * Peak at | Agreement r | Verdict) and any future family keep their
 * plain rows. A context carries "this is the inventory" down from the
 * table element; thead neutralizes it (a head row is a label, not a
 * door); each body row is a door only when its rendered cells match a
 * walk owner (jobName | mainName | volumeCount) — an unmatched row
 * stays plain, because a door must promise what the paper says.
 */
const InventoryTableContext = React.createContext(false);

/** The inventory table's exact head trio — the only door-carrying table
 *  on the paper. Matched against the RENDERED head (hast), so markdown
 *  cosmetics above or below can never turn another table into doors. */
const OWNER_HEAD = ["Job", "Main map", "Volumes"];

/** Collect the rendered words of a hast node (cells carry plain text —
 *  the doors read what the reader reads, not the markdown source). */
function hastText(n: unknown): string {
  if (!n || typeof n !== "object") return "";
  const e = n as { type?: string; value?: string; children?: unknown[] };
  if (e.type === "text") return e.value ?? "";
  return (e.children ?? []).map(hastText).join("");
}

/** hast shape helpers. The markdown pipeline interleaves whitespace TEXT
 *  nodes BETWEEN and INSIDE a table's parts (table → text · thead · text
 *  · tbody · text; thead's tr → text · th · text · th …) — a child must
 *  be FOUND by tagName, never taken by position (t213 RUN=1's lesson:
 *  children[0] of a table is a newline, not the head). */
type HastEl = { tagName?: string; children?: unknown[] };
const asHastEl = (n: unknown): HastEl | undefined => (n && typeof n === "object" ? (n as HastEl) : undefined);
const hastKids = (n: unknown): unknown[] => asHastEl(n)?.children ?? [];
const hastTag = (n: unknown): string | undefined => asHastEl(n)?.tagName;

/** Walk the candidates and return EVERY volume owner, in walk order —
 *  owners[0] is the deep-report winner (the newest capable candidate
 *  that speaks), the rest ride the inventory. Unreadable candidates are
 *  skipped (the next one may speak); the walk returns what it heard. */
async function walkVolumeOwners(jobIds: string[], signal: AbortSignal): Promise<MapOwner[]> {
  const owners: MapOwner[] = [];
  for (const jobId of jobIds.slice(0, MAP_BRIEF_CAP)) {
    if (signal.aborted) return owners;
    try {
      const d = (await fetch(`/api/jobs/${jobId}/outputs`, { signal }).then((r) => r.json())) as OutputsResponse;
      const volumes = (d.files ?? []).filter(
        (f) => f.kind === "mrc" && Array.isArray(f.dims) && f.dims.length === 3,
      );
      if (volumes.length === 0) continue;
      const sorted = [...volumes].sort(
        (a, b) => Number(MAIN_MAP_RE.test(b.name)) - Number(MAIN_MAP_RE.test(a.name)),
      );
      const jobName = useWorkflowStore.getState().jobs.find((j) => j.id === jobId)?.name ?? jobId;
      owners.push({
        jobId,
        jobName,
        main: { path: sorted[0].path, name: sorted[0].label ?? sorted[0].name },
        overlays: sorted.slice(1, 3).map((f) => ({ path: f.path, name: f.label ?? f.name })),
        volumeCount: volumes.length,
      });
    } catch {
      if (signal.aborted) return owners;
      // this candidate's outputs are unreadable — the next one may speak
    }
  }
  return owners;
}

/** Profile the brief's maps on the shared Z axis and hand the family
 *  builder exactly what it would have received from the viewer: the
 *  main landscape plus adopted comparison terrains. */
async function measureMapQc(
  brief: MapBrief,
  signal: AbortSignal,
): Promise<{ jobId: string; report: string }> {
  const paths = [brief.main.path, ...brief.overlays.map((o) => o.path)];
  const fetched = await Promise.all(
    paths.map(async (p) => {
      const d = (await fetch(
        `/api/jobs/${brief.jobId}/map-profile?path=${encodeURIComponent(p)}&axis=z`,
        { signal },
      ).then((r) => r.json())) as ProfileResponse;
      if (!Array.isArray(d.bins) || d.bins.length === 0) throw new Error("no landscape");
      return d.bins;
    }),
  );
  const overlays: ReportOverlay[] = brief.overlays.map((o, i) => ({ name: o.name, bins: fetched[i + 1] }));
  const report = buildProfileReport({
    mapName: brief.main.name,
    jobId: brief.jobId,
    axis: "z",
    bins: fetched[0],
    overlays,
    pendingOverlays: 0,
  });
  return { jobId: brief.jobId, report };
}

export default function SessionReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const project = useWorkflowStore((s) => s.project);
  const jobs = useWorkflowStore((s) => s.jobs);
  const lastSweep = useWorkflowStore((s) => s.lastSweep);

  const [mapQc, setMapQc] = React.useState<{ jobId: string; report: string } | null>(null);
  const [mapPending, setMapPending] = React.useState(false);
  const [mapError, setMapError] = React.useState(false);
  /** t212: every volume owner in walk order, from the SAME walk that
   *  picks the deep-report winner — settled before the measurement,
   *  so the paper still lists the world even if a profile then fails. */
  const [mapInventory, setMapInventory] = React.useState<
    { jobId: string; jobName: string; mainName: string; volumeCount: number }[] | null
  >(null);
  const [note, setNote] = React.useState<string | null>(null);
  const noteTimer = React.useRef<number | null>(null);

  const flashNote = (text: string) => {
    setNote(text);
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 4000);
  };

  // The report is the one dialog that IS a document: while open, the body
  // carries the print-exception flag — Task 70's "dialogs step aside on
  // paper" contract is scoped away for exactly this dialog, and cleaned
  // up on close/unmount so no other printout inherits the flag.
  React.useEffect(() => {
    if (open) document.body.setAttribute("data-report-print", "");
    else document.body.removeAttribute("data-report-print");
    return () => document.body.removeAttribute("data-report-print");
  }, [open]);

  // Map QC is measured ONCE per open (a snapshot of the session's maps):
  // the walk + profiles are the expensive part, statcache makes repeats
  // cheap but the assembly is still async — the section says so while it
  // works (the pending doctrine: the summary does not guess).
  React.useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setMapQc(null);
    setMapError(false);
    setMapInventory(null);
    setMapPending(true);
    (async () => {
      // t211 walk: volume-capable types first (each tier newest-first,
      // deterministic under equal stamps), then the never-volume tail —
      // the walk cannot end at a map-less upper half while a Refine3D
      // waits below the fold.
      const done = useWorkflowStore.getState().jobs.filter((j) => j.status === "completed");
      const doneIds = [
        ...done.filter((j) => VOLUME_CAPABLE_RE.test(j.type)).sort(byRecency),
        ...done.filter((j) => !VOLUME_CAPABLE_RE.test(j.type)).sort(byRecency),
      ].map((j) => j.id);
      const owners = await walkVolumeOwners(doneIds, ctrl.signal);
      if (ctrl.signal.aborted) return;
      // the inventory is a fact of the WALK — it settles even when the
      // deep measurement below then refuses (partial truth over silence)
      setMapInventory(
        owners.map((o) => ({ jobId: o.jobId, jobName: o.jobName, mainName: o.main.name, volumeCount: o.volumeCount })),
      );
      if (owners.length === 0) {
        setMapPending(false);
        return; // honest empty state — no job here owns a volume
      }
      try {
        const qc = await measureMapQc(owners[0], ctrl.signal);
        if (ctrl.signal.aborted) return;
        setMapQc(qc);
        setMapPending(false);
      } catch {
        if (ctrl.signal.aborted) return;
        setMapError(true);
        setMapPending(false);
      }
    })();
    return () => ctrl.abort();
  }, [open]);

  const pipeline = React.useMemo(() => {
    const succeeded = jobs.filter((j) => j.status === "completed").length;
    const running = jobs.filter((j) => j.status === "running").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    return { total: jobs.length, succeeded, running, failed, waiting: jobs.length - succeeded - running - failed };
  }, [jobs]);

  const md = React.useMemo(
    () =>
      buildSessionReport({
        projectName: project?.name ?? null,
        pipeline,
        mapQc,
        mapPending,
        mapError,
        mapInventory,
        sweep: lastSweep ? buildSweepReport(lastSweep.rows, lastSweep.bestId) : null,
      }),
    [project?.name, pipeline, mapQc, mapPending, mapError, mapInventory, lastSweep],
  );

  // t213: pressing a door hands the reader to the owner's results. The
  // engine is openJob — the SAME door the command palette uses (landing
  // repair, workspace hops, then the inspector for a completed job) —
  // and the paper closes: the results panel lives on the canvas, not
  // under the dialog. The landing itself is the receipt.
  const pressOwner = React.useCallback(
    (owner: { jobId: string }) => {
      void useWorkflowStore.getState().openJob(owner.jobId);
      onOpenChange(false);
    },
    [onOpenChange],
  );

  // The rendered document's component overrides (t213): the ONE table
  // whose head is exactly OWNER_HEAD carries doors on its body rows; the
  // thead neutralizes the context (a head row is a label, not a door);
  // every other table — the Comparison table, any future family — keeps
  // its plain rows. Row→owner matching is on the RENDERED cells against
  // the settled walk inventory; an unmatched row stays plain (a door
  // must promise what the paper says). Keyboard pressable (Enter/Space)
  // — a door that needs a mouse is half a door.
  const mdComponents = React.useMemo<Components>(() => {
    type TableProps = React.ComponentPropsWithoutRef<"table"> & ExtraProps;
    type TheadProps = React.ComponentPropsWithoutRef<"thead"> & ExtraProps;
    type TrProps = React.ComponentPropsWithoutRef<"tr"> & ExtraProps;
    return {
      table: ({ node, children, ...rest }: TableProps) => {
        // find the head row by tagName — position lies (whitespace text
        // nodes interleave every table part; see the hast helpers above)
        const head = hastKids(node).find((c) => hastTag(c) === "thead");
        const headRow = hastKids(head).find((c) => hastTag(c) === "tr");
        const headTexts = hastKids(headRow)
          .filter((c) => hastTag(c) === "th")
          .map(hastText);
        const isInventory =
          headTexts.length === OWNER_HEAD.length && OWNER_HEAD.every((h, i) => headTexts[i] === h);
        if (!isInventory) return <table {...rest}>{children}</table>;
        return (
          <InventoryTableContext.Provider value={true}>
            <table {...rest}>{children}</table>
          </InventoryTableContext.Provider>
        );
      },
      thead: ({ node, children, ...rest }: TheadProps) => (
        <InventoryTableContext.Provider value={false}>
          <thead {...rest}>{children}</thead>
        </InventoryTableContext.Provider>
      ),
      tr: ({ node, children, ...rest }: TrProps) => {
        const inInventory = React.useContext(InventoryTableContext);
        const cells = hastKids(node)
          .filter((c) => hastTag(c) === "td" || hastTag(c) === "th")
          .map(hastText);
        const owner = mapInventory?.find(
          (o) => cells[0] === o.jobName && cells[1] === o.mainName && cells[2] === String(o.volumeCount),
        );
        if (!inInventory || !owner) return <tr {...rest}>{children}</tr>;
        return (
          <tr
            {...rest}
            data-owner-door={owner.jobId}
            tabIndex={0}
            aria-label={`Open ${owner.jobName}'s results — ${owner.mainName}, ${owner.volumeCount} ${owner.volumeCount === 1 ? "volume" : "volumes"}`}
            className="cursor-pointer transition-colors hover:bg-violet-500/10 focus-visible:bg-violet-500/15 focus-visible:outline-none"
            onClick={() => pressOwner(owner)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pressOwner(owner);
              }
            }}
          >
            {children}
          </tr>
        );
      },
    };
  }, [mapInventory, pressOwner]);

  const exportMd = async (mode: "copy" | "download") => {
    if (mode === "copy") {
      try {
        await navigator.clipboard.writeText(md);
        flashNote("Copied the session QC report to the clipboard");
        return;
      } catch {
        // clipboard denied — the download is the honest fallback, and the
        // receipt names the degradation (the report speaks both worlds)
        downloadText(sessionReportFilename(), md, "text/markdown;charset=utf-8");
        flashNote("Downloaded session-qc-report-….md (clipboard unavailable)");
        return;
      }
    }
    downloadText(sessionReportFilename(), md, "text/markdown;charset=utf-8");
    flashNote("Downloaded session-qc-report-….md");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-report-doc
        data-md={md}
        className="max-w-4xl sm:max-w-4xl"
        aria-label="Session QC report"
      >
        <DialogHeader className="no-print">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileDown className="h-4 w-4 text-violet-600" aria-hidden="true" />
            Session QC report
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            The report families meet: pipeline glance · map QC (measured, not viewed) · the sweep verdict, bound verbatim.
          </DialogDescription>
        </DialogHeader>

        {/* the doors — copy / download speak Markdown, print speaks paper */}
        <div className="no-print flex flex-wrap items-center justify-end gap-1.5" data-report-doors>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-violet-600 hover:bg-violet-600/15 hover:text-violet-600"
            aria-label="Copy session report"
            onClick={() => exportMd("copy")}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy report
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-violet-600 hover:bg-violet-600/15 hover:text-violet-600"
            aria-label="Download session report"
            onClick={() => exportMd("download")}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download report
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-violet-600 hover:bg-violet-600/15 hover:text-violet-600"
            aria-label="Print session report"
            title="Print / save as PDF — the paper contract prints exactly this document"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Print
          </Button>
        </div>

        {note && (
          <p
            className="no-print rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300"
            role="status"
          >
            {note}
          </p>
        )}

        {/* the document itself — the families' bytes, rendered */}
        <div className="report-doc max-h-[62vh] overflow-y-auto pr-1" data-report-body>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{md}</ReactMarkdown>
        </div>
      </DialogContent>
    </Dialog>
  );
}
