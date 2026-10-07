"use client";

/**
 * CryoFlow — ⌘K / Ctrl+K command palette (Linear/n8n-style).
 *
 * Command families, all fuzzy-searchable:
 *   • Jobs      — jump: idle → edit panel, submitted → results inspector
 *   • Run       — one-shot launch for idle jobs
 *   • Job types — add any catalog type onto the canvas
 *   • Projects  — switch the active project (Task 245: the header's
 *                 project SelectTrigger is a door, and a door the palette
 *                 doesn't index is a door the keyboard cannot reach)
 *   • Canvas    — zoom to fit · reset view · tidy layout · theme toggle
 *   • Export    — chart CSV for the job you're looking at, no inspector
 *                 needed (Task 110; same rows, same filename, same toast)
 *   • Copy      — the same chart rows as clipboard TSV (Task 113; one
 *                 fetch-and-derive feeds both destinations, wording mirrors
 *                 the chart domain's copy buttons)
 *
 * Task 245 — the index-completeness law, wired: every interactive header
 * door must have a palette row, except the honestly exempt (the palette's
 * own trigger is self-referential; Print belongs to the browser's native
 * ⌘P/Ctrl+P). The contract lives as data in scripts/t245-e2e.mjs.
 *
 * Opens with Ctrl+K (⌘K) or the header chip, which dispatches the
 * "cryoflow:open-palette" event (keeps the dialog owner decoupled).
 */

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Aperture,
  Command as CommandIcon,
  Activity,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileUp,
  GraduationCap,
  Mountain,
  Keyboard,
  BookOpen,
  Layers,
  LayoutDashboard,
  Loader2,
  Maximize2,
  Moon,
  Network,
  Pencil,
  Play,
  Radar,
  RadioTower,
  RotateCcw,
  Search,
  SlidersHorizontal,
  StickyNote,
  TrendingDown,
  TrendingUp,
  Wand2,
  Waves,
  Workflow,
  X,
  FileTerminal,
  RefreshCcw,
  FolderOpen,
  Github,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { PENDING_VIEW_KEY, SAVED_VIEWS_CHANGED_EVENT } from "@/lib/view-link";
import { cn } from "@/lib/utils";
import { REMOTE_CLUSTERS_OPEN_EVENT } from "./remote-cluster-dialog";
import { PaletteGalleryThumb } from "./palette-gallery-thumb";
import { useWorkflowStore } from "@/lib/store";
import { stageWorkflowFiles } from "@/lib/import-stage";
import { hasJudgment, parseClassNotes } from "@/lib/class-notes";
import type { JobDTO } from "@/lib/types";
import { JOB_TYPES, jobType, CARD_W, CARD_H } from "@/lib/workflow";
import { JOB_PRESETS } from "@/lib/job-presets";
import { exportCanvasPng } from "@/lib/canvas-export";
import { fetchJsonRetry } from "@/lib/retry-fetch";
import { downloadCsv, fileSlug, copyTextToClipboard, rowsToTsv, type CsvRow } from "@/lib/chart-export";
import { CHART_EXPORT_TARGETS, type ChartExportTarget } from "@/lib/chart-rows";
import {
  buildWorkflowFile,
  downloadWorkflowJson,
  workflowFileName,
} from "@/lib/workflow-io";
import { TypeIcon } from "./icons";
import { PipelineScriptDialog } from "./pipeline-script-dialog";

/** t483: exported — the help guide's finding chapter names the palette,
 *  and a named door must open: the guide dispatches this, the palette's
 *  own listener answers (the same owner-listens law, one more reverse
 *  hop). */
export const OPEN_EVENT = "cryoflow:open-palette";

/** t221: the palette's report door — the palette dispatches, the header
 *  (which owns the SessionReportDialog and its reportOpen state) listens.
 *  Same decoupling as OPEN_EVENT, the reverse hop: the palette was the
 *  last surface where the session report had no name — and a door that
 *  exists only on the header strip is a door the keyboard cannot reach
 *  (the t210 doctrine, palette edition). */
export const SESSION_REPORT_EVENT = "cryoflow:open-session-report";

/** t530: the palette's diagnostics door — same handshake, same
 *  owner-listens law: the header owns the panel, the palette only rings
 *  the bell. A box's vitals are facts the keyboard should reach too. */
export const SYSTEM_DIAGNOSTICS_EVENT = "cryoflow:open-system-diagnostics";

/** Per-chart icon + accent for the Export group — the SAME icon the chart's
 *  own header carries, so a palette row is recognizably "that chart" before
 *  it is clicked (cross-surface recognition, not a new icon dialect). */
const CHART_ICONS: Record<
  string,
  { Icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  fsc: { Icon: Waves, tone: "text-teal-600" },
  guinier: { Icon: TrendingDown, tone: "text-amber-600" },
  resolution: { Icon: TrendingUp, tone: "text-teal-600" },
  ctf: { Icon: Radar, tone: "text-teal-600" },
  topaz: { Icon: GraduationCap, tone: "text-fuchsia-600" },
  angdist: { Icon: RadioTower, tone: "text-teal-600" },
};

/* ---------------- t668 — the Saved views group's data half ---------------- */

/** Shape of GET /api/views/gallery — the SAME interfaces the dashboard's
 *  Saved views wall speaks (project-dashboard.tsx). One truth on the wire,
 *  two readers; the palette needs only the jump-relevant slice of it. */
interface SavedViewBookmark {
  id: string;
  name: string;
  ts: number;
  thumb?: string;
}

interface SavedViewEntry {
  projectId: string | null;
  projectName: string | null;
  jobId: string;
  jobName: string;
  jobType: string;
  jobStatus: string;
  updatedAt: string;
  bookmarks: SavedViewBookmark[];
}

type SavedViewsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; views: SavedViewEntry[]; fetchedAt: number }
  | { kind: "absent"; fetchedAt: number };

/** Module-level cache — session-lived, keyed by nothing (there is exactly
 *  one gallery). Ready AND absent share the TTL: a dead wall answers once
 *  per clock window, a fresh save surfaces within it. In-flight dedup so
 *  two rapid opens share one round trip (the t663 doctrine, list-sized). */
const SAVED_VIEWS_TTL_MS = 30_000;
const SAVED_VIEWS_CAP = 8;
let savedViewsCache: SavedViewsState = { kind: "idle" };
let savedViewsInflight: Promise<SavedViewEntry[]> | null = null;

async function fetchSavedViews(): Promise<SavedViewEntry[]> {
  if (savedViewsInflight) return savedViewsInflight;
  savedViewsInflight = (async () => {
    const res = await fetch("/api/views/gallery", { cache: "no-store" });
    if (!res.ok) throw new Error(`views gallery ${res.status}`);
    const body = (await res.json()) as { views?: SavedViewEntry[] };
    return body.views ?? [];
  })().finally(() => {
    savedViewsInflight = null;
  });
  return savedViewsInflight;
}

/** t671 — the fresh-read verb the broadcast listener rides. The embed's
 *  bookmark mutations (save/update/remove all share commitBookmarks, the
 *  THIRD mouth) broadcast SAVED_VIEWS_CHANGED_EVENT; the palette — even
 *  closed, so no state to update — re-reads the route into the module
 *  cache, and the next open shows the truth even inside the 30s TTL
 *  window (a view saved or deleted in the viewer is never haunted by the
 *  clock). In-flight dedup (fetchSavedViews) keeps concurrent
 *  listener+open to one wire round trip; the LAST read wins the cache. */
function refreshSavedViewsCache() {
  void fetchSavedViews()
    .then((views) => {
      savedViewsCache =
        views.length > 0
          ? { kind: "ready", views, fetchedAt: Date.now() }
          : { kind: "absent", fetchedAt: Date.now() };
    })
    .catch(() => {
      savedViewsCache = { kind: "absent", fetchedAt: Date.now() };
    });
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  // t668 — the Saved views group is the palette's first FETCHED group: the
  // camera bookmarks live server-side (BookmarkSession), so the list rides
  // /api/views/gallery — the SAME route the dashboard's Saved views wall
  // reads (one environment one truth). Module-level cache with a short TTL:
  // the palette opens often, the route serves ≤8 jobs with inline thumbs,
  // and ABSENCE is cached by the same clock — a dead wall answers once, a
  // fresh save shows up within half a minute (the t663 cache doctrine,
  // tuned for a list instead of a tile).
  const [savedViews, setSavedViews] = React.useState<SavedViewsState>(savedViewsCache);
  React.useEffect(() => {
    if (!open) return;
    const hit = savedViewsCache;
    if (hit.kind === "ready" && Date.now() - hit.fetchedAt < SAVED_VIEWS_TTL_MS) {
      setSavedViews(hit);
      return;
    }
    if (hit.kind === "absent" && Date.now() - hit.fetchedAt < SAVED_VIEWS_TTL_MS) {
      setSavedViews(hit);
      return;
    }
    setSavedViews({ kind: "loading" });
    let alive = true;
    void fetchSavedViews()
      .then((views) => {
        const next: SavedViewsState =
          views.length > 0
            ? { kind: "ready", views, fetchedAt: Date.now() }
            : { kind: "absent", fetchedAt: Date.now() };
        savedViewsCache = next;
        if (alive) setSavedViews(next);
      })
      .catch(() => {
        savedViewsCache = { kind: "absent", fetchedAt: Date.now() };
        if (alive) setSavedViews(savedViewsCache);
      });
    return () => {
      alive = false;
    };
  }, [open]);
  // t671 — the third mouth's broadcast lands here: the palette listens
  // even while closed (the listener lives on the always-mounted component,
  // not the dialog) and re-reads the route into the module cache, so the
  // TTL window never haunts a view the viewer just saved, updated, or
  // deleted. Palette-open mutations ride the SAME listener (the delete X
  // already shrinks in place; the embed cannot mutate while the palette
  // is open — modal) — one wire shape for every mouth.
  React.useEffect(() => {
    const onSavedViewsChanged = () => refreshSavedViewsCache();
    window.addEventListener(SAVED_VIEWS_CHANGED_EVENT, onSavedViewsChanged);
    return () => window.removeEventListener(SAVED_VIEWS_CHANGED_EVENT, onSavedViewsChanged);
  }, []);
  // t572 — the cascade's disarm flip: the group entrance plays on OPEN,
  // then ~520ms later (after the last rung lands: 210ms delay + 240ms
  // duration) the settled class disarms the animation — because hiding a
  // group while filtering sets display:none, and un-hiding it later would
  // REPLAY the entrance (CSS animations restart on display toggles). The
  // flip resets on close, so every fresh open gets its cascade again:
  // first paint plays, filtering stays silent.
  const [cascadeSettled, setCascadeSettled] = React.useState(false);
  React.useEffect(() => {
    if (!open) {
      setCascadeSettled(false);
      return;
    }
    const t = setTimeout(() => setCascadeSettled(true), 520);
    return () => clearTimeout(t);
  }, [open]);
  // Task 179: the replay-script dialog is a palette-owned export surface —
  // selecting the row closes the palette first, then opens the dialog (the
  // exportJson/native-picker pattern: one modal at a time, no nesting).
  const [pipelineOpen, setPipelineOpen] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const jobs = useWorkflowStore((s) => s.jobs);
  const edges = useWorkflowStore((s) => s.edges);
  const view = useWorkflowStore((s) => s.view);
  const setView = useWorkflowStore((s) => s.setView);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkflowStore((s) => s.switchWorkspace);
  // Task 245 — the project family joins the index: the header's project
  // SelectTrigger is a door (its Workspaces sibling was indexed long ago);
  // the palette reads the SAME store list and calls the SAME switchProject
  // the SelectTrigger does — one environment one truth, every mouth follows.
  const projects = useWorkflowStore((s) => s.projects);
  const project = useWorkflowStore((s) => s.project);
  const switchProject = useWorkflowStore((s) => s.switchProject);
  const noteSpotlight = useWorkflowStore((s) => s.noteSpotlight);
  const toggleNoteSpotlight = useWorkflowStore((s) => s.toggleNoteSpotlight);
  // Task 134 — the palette can jump to ONE job; the find bar lenses ALL
  // of them. The command hands off to the bar (it owns input focus).
  const openFind = useWorkflowStore((s) => s.openFind);
  // Export group target (Task 110): the inspector job, else primary selection
  const inspectId = useWorkflowStore((s) => s.inspectId);
  const selectedId = useWorkflowStore((s) => s.selectedId);

  // Notes group (Task 75; predicate upgraded to hasJudgment in Task 86) —
  // the scientist's margin notes become first-class palette citizens: each
  // judged job is one row whose SEARCH VALUE carries the note TEXT (plus the
  // class note texts, fused below), so fuzzy-typing a phrase from an
  // annotation ("good class", "redo ab initio") finds the job even when its
  // name wouldn't. hasJudgment is the SAME predicate the canvas lens dims
  // by, the header chip counts and the dashboard Noted chip filters — the
  // palette was the last reader still on the raw j.note, which meant a job
  // annotated only through class notes stayed lit on canvas yet was
  // unsearchable here (cross-surface contract break, fixed).
  // Workspace-scoped, same rule the canvas lens dims by.
  const notedJobs = (
    activeWorkspaceId == null
      ? jobs
      : jobs.filter((j) => (j.workspaceId ?? "") === activeWorkspaceId)
  ).filter(hasJudgment);

  // Class notes group (Task 81) — the gallery's per-class annotations become
  // palette citizens too: one row per noted class, searchable by the note
  // TEXT, the class number and the host job's name. Scope: the same active
  // workspace the canvas lens dims by; only IDLE select2d hosts (the edit
  // panel is the only surface with a gallery) whose upstream classification
  // has actually completed — otherwise the jump would land on a panel with
  // no gallery to open, a promise the entry must not make.
  const wsScope = (j: JobDTO) =>
    activeWorkspaceId == null || (j.workspaceId ?? "") === activeWorkspaceId;
  const upstreamDone = (job: JobDTO) => {
    const sources = edges
      .filter((e) => e.toJobId === job.id)
      .map((e) => jobs.find((j) => j.id === e.fromJobId))
      .filter((j): j is JobDTO => j != null && (j.type === "class2d" || j.type === "select2d"));
    const pick = sources.find((j) => j.status === "completed") ?? sources[0];
    return pick != null && pick.status === "completed";
  };
  const notedClasses = jobs
    .filter(wsScope)
    .filter((j) => j.type === "select2d" && j.status === "idle" && upstreamDone(j))
    .flatMap((j) =>
      Object.entries(parseClassNotes(j.params?.classNotes)).map(([cls, text]) => ({
        job: j,
        cls: Number(cls),
        text,
      }))
    )
    .sort((a, b) => a.job.name.localeCompare(b.job.name) || a.cls - b.cls);
  // a 200-class run can theoretically carry hundreds of notes — cap the
  // list, keep the heading honest about the total
  const CLASS_NOTE_CAP = 12;
  const notedClassRows = notedClasses.slice(0, CLASS_NOTE_CAP);

  // Frame galleries group (t659) — the frame WALLS become palette
  // citizens: one row per gallery-capable job, the jump lands INSIDE the
  // lightbox (the Task 81 handshake's second heir rides in the store).
  // Capability = the same contract the inspector mounts the gallery by:
  // import jobs (micrographs node type — a particles import speaks a
  // STAR, not frames) and MotionCorr jobs, both completed — an idle or
  // running job has no wall yet, a promise the entry must not make.
  // Whether the workdir's frames physically exist is a WORLD question
  // the palette does not prefetch: the consumer clears the request
  // honestly when the wall turns out empty (the jump still lands on the
  // job — the arrival is real, only the lightbox is absent).
  const galleryJobs = jobs
    .filter(wsScope)
    .filter((j) => {
      if (j.status !== "completed") return false;
      if (/^motioncorr$/i.test(j.type)) return true;
      return /^import$/i.test(j.type) && String(j.params?.nodeType ?? "micrographs") !== "particles";
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const GALLERY_CAP = 12;
  const galleryRows = galleryJobs.slice(0, GALLERY_CAP);

  // Class averages group (t660) — the OTHER image surface: completed
  // classifications speak class tiles through the inspector's overview
  // teaser (class2d slices of the combined stack; class3d/initialmodel
  // per-class volumes — the exact mount gate the teaser itself uses, so
  // a row never promises a face the inspector would not mount). The
  // arrival is the overview tab: no lightbox, the teaser's grid IS the
  // browse surface. Whether the workdir's stacks physically exist is a
  // world question the palette does not prefetch — the teaser's own
  // self-hide contract answers absence honestly at arrival.
  const classAveragesJobs = jobs
    .filter(wsScope)
    .filter((j) => /^(class2d|class3d|initialmodel)$/i.test(j.type) && j.status === "completed")
    .sort((a, b) => a.name.localeCompare(b.name));
  const CLASS_AVERAGES_CAP = 12;
  const classAveragesRows = classAveragesJobs.slice(0, CLASS_AVERAGES_CAP);

  // Denoise compare group (t665) — the third image-surface family: a
  // completed Topaz denoise run speaks its before/after wall (every
  // denoised micrograph paired with its original under the provider job's
  // workdir — the exact fetch the gallery itself rides). Capability = the
  // gallery's own mount gate (topazdenoise + completed — a running run's
  // index is still growing, an idle one has no wall yet). The arrival is
  // the t659 two-gate shape: the inspector clears the way to the results
  // tab, the WALL consumes (scroll + flash) — a link that promises a
  // before/after comparison must put the comparison in view.
  const denoiseJobs = jobs
    .filter(wsScope)
    .filter((j) => /^topazdenoise$/i.test(j.type) && j.status === "completed")
    .sort((a, b) => a.name.localeCompare(b.name));
  const DENOISE_CAP = 12;
  const denoiseRows = denoiseJobs.slice(0, DENOISE_CAP);

  // Saved views group (t668) — the FOURTH gallery family, and the first one
  // the palette does not derive from the store: saved 3D camera views live
  // in the BookmarkSession table, and the aggregate that spans projects is
  // the SAME /api/views/gallery the dashboard wall reads. One row per
  // bookmark (the jump surface mirrors the wall's flat cards, capped);
  // NO status gate here beyond what the route already serves — the
  // dashboard wall shows exactly these rows, and the jump's arrival is
  // the embed's own honest toast when a view turns out unreadable.
  const savedViewRows =
    savedViews.kind === "ready"
      ? savedViews.views
          .flatMap((v) => v.bookmarks.map((b) => ({ v, b })))
          .slice(0, SAVED_VIEWS_CAP)
      : [];
  const savedViewTotal =
    savedViews.kind === "ready"
      ? savedViews.views.reduce((n, v) => n + v.bookmarks.length, 0)
      : 0;

  // Ctrl+K / ⌘K from anywhere + the header chip's custom event.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpenRequest = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpenRequest);
    };
  }, []);

  const close = () => setOpen(false);

  /** Task 126: the landing dialect lives in the store now — openJob carries
   *  the ghost guard, the workspace/project landing repair, and the same
   *  idle→select+focus / submitted→inspect contract this used to inline.
   *  The palette opens from ANY view (the header trigger is global): from
   *  the dashboard, jumping without a view switch would "arrive"
   *  invisibly — the store action's setView covers that leg too. */
  const jumpToJob = (id: string) => {
    void useWorkflowStore.getState().openJob(id);
    close();
  };

  /** Class-note deep link (Task 81): land on the host job's edit panel with
   *  the lightbox open on the noted class, editor focused. The one-shot
   *  handshake rides in the store (pendingClassFocus) — the panel consumes
   *  it on arrival, so a stale request can never re-open later. */
  const jumpToClassNote = (jobId: string, cls: number) => {
    const s = useWorkflowStore.getState();
    s.select(jobId);
    s.focusJob(jobId);
    s.requestClassFocus(jobId, cls);
    close();
  };

  /** t659 — the Frame galleries deep link: land ON the wall. openJob
   *  carries the view switch + the completed→inspect contract; the
   *  one-shot pendingGalleryFocus handshake rides in the store — the
   *  inspector host switches to the overview tab, the gallery opens the
   *  lightbox at the first frame and consumes the request. Compare mode
   *  deliberately has NO deep link: a tray with zero picks is the t654
   *  lie — the wall is the honest direct destination. */
  const jumpToGallery = (jobId: string) => {
    const s = useWorkflowStore.getState();
    void s.openJob(jobId);
    s.requestGalleryFocus(jobId);
    close();
  };

  /** t660 — the Class averages deep link: land on the classification's
   *  overview tab, where the teaser tiles the classes. No lightbox — the
   *  grid IS the browse surface — so the handshake has ONE consumer (the
   *  inspector host) and no TTL dance (Task 81's sync shape). */
  const jumpToClassAverages = (jobId: string) => {
    const s = useWorkflowStore.getState();
    void s.openJob(jobId);
    s.requestClassAveragesFocus(jobId);
    close();
  };

  /** Denoise-compare deep link (t665): land on the results tab and let the
   *  wall itself finish the arrival (scroll into view + flash) — the two-
   *  gate handshake the frame galleries use, tuned for a wall that lives
   *  below the fold rather than a lightbox. */
  const jumpToDenoise = (jobId: string) => {
    const s = useWorkflowStore.getState();
    void s.openJob(jobId);
    s.requestDenoiseFocus(jobId);
    close();
  };

  /** Saved-views deep link (t668): the dashboard wall's own recipe, VERBATIM
   *  — the one-shot PENDING_VIEW_KEY handshake in sessionStorage (the 3D
   *  embed consumes it once its bookmark list has loaded and flies to the
   *  view; a view deleted in the meantime gets the embed's honest "not
   *  found" toast instead of a silent no-op), then openJob with the
   *  CROSS-PROJECT hint (the gallery spans projects; a row's home project
   *  may not be the active one — the id will not resolve until the switch
   *  lands). No store relay needed: the embed already speaks this door. */
  const jumpToSavedView = (v: SavedViewEntry, b: SavedViewBookmark) => {
    try {
      sessionStorage.setItem(
        PENDING_VIEW_KEY,
        JSON.stringify({ jobId: v.jobId, bookmarkId: b.id })
      );
    } catch {
      /* private mode — the jump still lands on the job */
    }
    void useWorkflowStore.getState().openJob(v.jobId, { projectId: v.projectId });
    close();
  };

  // t670 — the palette row gets the wall's delete face (t669), palette-sized.
  // The contract is the wall's VERBATIM, two palette-owning differences:
  //  • the mutation stays on the per-job camera-bookmarks route — the row
  //    READS FRESH AT CLICK TIME and PUTs the remaining list, never its own
  //    possibly stale TTL cache copy (a view saved in the viewer since this
  //    fetch must survive the delete);
  //  • the palette's OWN clock shrinks with the server's: the module-level
  //    TTL cache drops the bookmark here, so a reopen inside the 30s window
  //    shows the post-delete truth at zero wire cost — the deleted row does
  //    not haunt the list until the TTL expires (the t669 "double clock"
  //    anchor, now owning both halves). The wall's single-flight key
  //    (two rapid deletes would race their read-filter-write cycles),
  //    the honest toasts, and the keep-the-row-on-failure ending all ride
  //    along unchanged.
  const [deletingView, setDeletingView] = React.useState<string | null>(null);
  // t674 — the palette row gets the wall's rename face (t674 wall edition),
  // palette-sized. Same contract, same single gate: the row's X and pencil
  // BOTH wait while any mutation is in flight (a rename and a delete
  // racing their read-modify-write cycles would lose one write), and the
  // row's own TTL cache updates IN PLACE on success — a reopen inside the
  // 30s window shows the new name at zero wire cost (the t670 double-clock
  // law, rename edition). The slot becomes a trio: Mountain (idle) fades
  // on hover, pencil and X sit side by side beneath it — one slot wider
  // than the delete-only era, still zero layout shift on the hover swap.
  const [renamingView, setRenamingView] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const renameCancelRef = React.useRef(false);
  const deleteSavedView = async (v: SavedViewEntry, b: SavedViewBookmark) => {
    const rowKey = `${v.jobId}:${b.id}`;
    if (deletingView) return; // one in-flight delete at a time — the second X waits
    setDeletingView(rowKey);
    try {
      const r = await fetch(`/api/jobs/${v.jobId}/camera-bookmarks`);
      if (!r.ok) throw new Error(`read ${r.status}`);
      const j = (await r.json()) as { bookmarks?: Array<{ id: string }> };
      const rest = (j.bookmarks ?? []).filter((x) => x && x.id !== b.id);
      const w = await fetch(`/api/jobs/${v.jobId}/camera-bookmarks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarks: rest }),
      });
      if (!w.ok) throw new Error(`write ${w.status}`);
      const shrink = (prev: SavedViewsState): SavedViewsState => {
        if (prev.kind !== "ready") return prev;
        const views = prev.views
          .map((row) =>
            row.jobId === v.jobId
              ? { ...row, bookmarks: row.bookmarks.filter((x) => x.id !== b.id) }
              : row
          )
          .filter((row) => row.bookmarks.length > 0);
        return views.length > 0
          ? { ...prev, views }
          : { kind: "absent", fetchedAt: prev.fetchedAt };
      };
      savedViewsCache = shrink(savedViewsCache);
      setSavedViews(savedViewsCache);
      // the OTHER mouth hears it too: the dashboard wall re-reads the route
      // (payload-less broadcast — the wall trusts only its own fresh fetch)
      window.dispatchEvent(new CustomEvent(SAVED_VIEWS_CHANGED_EVENT));
      toast({
        title: `View “${b.name}” deleted`,
        description: `Removed from ${v.jobName}'s saved views.`,
      });
    } catch {
      toast({
        title: "Could not delete the view",
        description:
          "The server did not confirm the removal — the row stays on the palette.",
      });
    } finally {
      setDeletingView(null);
    }
  };

  /** t674 — rename from the palette. The wall's rename contract (same
   *  window) with two palette-owning differences, both inherited from the
   *  delete's t670 edition:
   *   • the row READS FRESH AT COMMIT TIME and PUTs the renamed list —
   *     never its own possibly stale TTL cache copy;
   *   • the palette's OWN clock renames with the server's: the module
   *     cache maps the new name in place, so a reopen inside the 30s
   *     window shows the truth at zero wire cost.
   *  Three honest exits ride along (renamed / dupe-warning-still-commits /
   *  could-not-rename), plus two silent ones (empty draft, untouched
   *  draft) — an edit that never happened is not a fact worth announcing.
   *  The keyboard laws live on the input itself: every keydown stops
   *  propagation (cmdk's Command root would otherwise turn Enter into
   *  the jump gesture and the search field never sees a stranger's
   *  keystrokes), Enter blurs into the commit, Escape raises the cancel
   *  flag first — the embed's rename grammar, row-sized. */
  const renameSavedView = async (v: SavedViewEntry, b: SavedViewBookmark, draft: string) => {
    const nm = draft.trim().slice(0, 40);
    if (!nm || nm === b.name) return; // empty or untouched — silent
    try {
      const r = await fetch(`/api/jobs/${v.jobId}/camera-bookmarks`);
      if (!r.ok) throw new Error(`read ${r.status}`);
      const j = (await r.json()) as { bookmarks?: Array<{ id: string; name?: string }> };
      const list = j.bookmarks ?? [];
      const dupe = list.some(
        (x) => x && x.id !== b.id && (x.name ?? "").trim().toLowerCase() === nm.toLowerCase()
      );
      const w = await fetch(`/api/jobs/${v.jobId}/camera-bookmarks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookmarks: list.map((x) => (x && x.id === b.id ? { ...x, name: nm } : x)),
        }),
      });
      if (!w.ok) throw new Error(`write ${w.status}`);
      const renamer = (prev: SavedViewsState): SavedViewsState => {
        if (prev.kind !== "ready") return prev;
        return {
          ...prev,
          views: prev.views.map((row) =>
            row.jobId === v.jobId
              ? {
                  ...row,
                  bookmarks: row.bookmarks.map((x) =>
                    x.id === b.id ? { ...x, name: nm } : x
                  ),
                }
              : row
          ),
        };
      };
      savedViewsCache = renamer(savedViewsCache);
      setSavedViews(savedViewsCache);
      // the OTHER mouths hear it too: a payload-less broadcast, every
      // aggregate face re-reads the route (the t670/t671 symmetry)
      window.dispatchEvent(new CustomEvent(SAVED_VIEWS_CHANGED_EVENT));
      if (dupe)
        toast({
          title: `A view named “${nm}” already exists`,
          description: "Renamed anyway — consider a distinct name so the menu stays tell-apart.",
          className:
            "border-warning/40 bg-warning-50/95 text-warning-900 dark:border-warning/30 dark:bg-warning-950/80 dark:text-warning-100",
        });
      else
        toast({
          title: "View renamed",
          description: `“${b.name}” is now “${nm}” on ${v.jobName}.`,
        });
    } catch {
      toast({
        title: "Could not rename the view",
        description:
          "The server did not confirm the new name — the row keeps its old name.",
      });
    }
  };

  // one gate for every mutation mouth on the row (see the rename state's comment)
  const busyView = deletingView !== null || renamingView !== null;

  const runJob = (id: string) => {
    void useWorkflowStore.getState().runJob(id);
    close();
  };

  const addType = (type: string) => {
    void useWorkflowStore.getState().addJob(type);
    close();
  };

  /** Preset add: place the type AND apply the curated params in one shot.
   *  The new card lands selected, so the inspector shows exactly which
   *  knobs the preset moved off their defaults. */
  const addPreset = (p: (typeof JOB_PRESETS)[number]) => {
    void useWorkflowStore.getState().addJob(p.type, p.params);
    close();
  };

  const zoomToFit = () => {
    const s = useWorkflowStore.getState();
    const el = document.querySelector('[data-canvas="viewport"]');
    const rect = el?.getBoundingClientRect();
    if (!rect || s.jobs.length === 0) return;
    const minX = Math.min(...s.jobs.map((j) => j.x));
    const maxX = Math.max(...s.jobs.map((j) => j.x + CARD_W));
    const minY = Math.min(...s.jobs.map((j) => j.y));
    const maxY = Math.max(...s.jobs.map((j) => j.y + CARD_H));
    const bw = maxX - minX;
    const bh = maxY - minY;
    const zoom = Math.min(
      Math.max(Math.min(rect.width / (bw + 96), rect.height / (bh + 96), 1), 0.25),
      1
    );
    s.setViewport({
      x: (rect.width - bw * zoom) / 2 - minX * zoom,
      y: (rect.height - bh * zoom) / 2 - minY * zoom,
      zoom: +zoom.toFixed(3),
    });
    close();
  };

  const resetView = () => {
    useWorkflowStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });
    close();
  };

  const tidyLayout = () => {
    void useWorkflowStore.getState().applyLayout();
    close();
  };

  const createTemplate = () => {
    void useWorkflowStore.getState().createTemplate();
    close();
  };

  const openTemplatePresets = () => {
    // close the palette first so the two dialogs never fight over focus
    close();
    useWorkflowStore.getState().setTemplatePresetsOpen(true);
  };

  const openShortcuts = () => {
    // same dance: the palette must yield focus before the dialog opens
    close();
    useWorkflowStore.getState().setShortcutsOpen(true);
  };

  // t482 — the full help guide joins the palette (t245's law: every
  // header door is indexed; the guide is the "?" door's manual)
  const openHelpGuide = () => {
    close();
    useWorkflowStore.getState().setHelpGuideOpen(true);
  };

  // ---- Export chart data (Task 110) + Copy chart data (Task 113) --------
  // Target: the job the user is ALREADY looking at — the open inspector,
  // else the primary canvas selection. No target, no group: a promise the
  // palette must not make.
  const exportTargetJob =
    jobs.find((j) => j.id === (inspectId ?? selectedId)) ?? null;

  // ONE fetch-and-derive for both destinations: the rows the palette hands
  // to the CSV download are the SAME rows it hands to the TSV copy — a
  // second implementation here would be a second truth waiting to drift.
  // Throws on fetch failure (the caller toasts); an empty array is the
  // chart's own "nothing drawn yet" and stays honest in both doors.
  const fetchChartRows = async (
    t: ChartExportTarget,
    job: JobDTO,
  ): Promise<CsvRow[]> => {
    const data = await fetchJsonRetry<unknown>(t.endpoint(job.id));
    return t.rows(data);
  };

  const exportChartRows = (t: ChartExportTarget, job: JobDTO) => {
    // close first (same dance as every other entry); the toast is the
    // receipt — success names the file, an empty result stays honest
    close();
    void (async () => {
      try {
        const rows = await fetchChartRows(t, job);
        if (rows.length === 0) {
          toast({
            title: `${t.label}: no data yet`,
            description: `${job.name} has no rendered rows for this chart — it only exports what the curve draws.`,
          });
          return;
        }
        downloadCsv(`cryoflow-${fileSlug(t.label)}`, rows);
        toast({
          title: `${t.label} exported`,
          description: `${rows.length} row${rows.length === 1 ? "" : "s"} → cryoflow-${fileSlug(t.label)}.csv`,
        });
      } catch {
        toast({
          title: `${t.label} export failed`,
          description: `Could not fetch chart data for ${job.name}.`,
          variant: "destructive",
        });
      }
    })();
  };

  // The clipboard door (Task 113): same rows, paste dialect. Wording mirrors
  // the chart domain's copy buttons — one vocabulary across all surfaces.
  // The failure path points at the EXPORT group (the palette's own CSV
  // door), not at a chart button the palette never showed.
  const copyChartRows = (t: ChartExportTarget, job: JobDTO) => {
    close();
    void (async () => {
      try {
        const rows = await fetchChartRows(t, job);
        if (rows.length === 0) {
          toast({
            title: `${t.label}: no data yet`,
            description: `${job.name} has no rendered rows for this chart — there is nothing to copy.`,
          });
          return;
        }
        const ok = await copyTextToClipboard(rowsToTsv(rows));
        if (ok) {
          toast({
            title: `${t.label} copied`,
            description: `${rows.length} row${rows.length === 1 ? "" : "s"} as TSV — paste straight into a spreadsheet`,
          });
        } else {
          toast({
            title: `${t.label} could not be copied`,
            description: "Clipboard access was blocked — use the CSV export instead.",
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: `${t.label} copy failed`,
          description: `Could not fetch chart data for ${job.name}.`,
          variant: "destructive",
        });
      }
    })();
  };

  const exportPng = () => {
    // same workspace render rule as the canvas (useActiveWorkspaceJobs)
    const s = useWorkflowStore.getState();
    const wsJobs =
      s.activeWorkspaceId == null
        ? s.jobs
        : s.jobs.filter((j) => (j.workspaceId ?? "") === s.activeWorkspaceId);
    const wsName = s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name;
    void exportCanvasPng({
      projectName: s.project?.name ?? "project",
      workspaceName: wsName ?? "workspace",
      jobs: wsJobs,
      edges: s.edges,
      cardW: CARD_W,
      cardH: CARD_H,
    });
    close();
  };

  const exportJson = () => {
    // same workspace-scoped graph the canvas renders (both-endpoints rule
    // for edges is applied inside buildWorkflowFile)
    const s = useWorkflowStore.getState();
    const wsJobs =
      s.activeWorkspaceId == null
        ? s.jobs
        : s.jobs.filter((j) => (j.workspaceId ?? "") === s.activeWorkspaceId);
    const wsName = s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name;
    const file = buildWorkflowFile(
      wsJobs,
      s.edges,
      s.project?.name ?? "project",
      wsName ?? "workspace"
    );
    if (!file) {
      toast({ title: "Nothing to export", description: "The canvas is empty." });
      close();
      return;
    }
    downloadWorkflowJson(file, workflowFileName(wsName ?? "workspace"));
    close();
  };

  const importJson = () => {
    close(); // the native picker takes focus — drop the palette first
    const input = document.createElement("input");
    input.type = "file";
    // multi-file since Task 86 — same funnel the canvas picker uses;
    // Task 92: staging (all-invalid toast / preview hand-off) extracted to
    // stageWorkflowFiles, shared with the canvas input AND the canvas drop
    input.multiple = true;
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return;
      await stageWorkflowFiles(files);
    };
    input.click();
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
    close();
  };

  // t244: the engine joins the action index. The guidance's closing line
  // promises "then press Re-detect — no restart needed"; the palette row is
  // that promise's keyboard-layer door — searchable where every other app
  // action lives, with the toast as the receipt (the chip and the dashboard
  // card update live when the probe returns — one environment, one truth).
  const redetectEngine = () => {
    close();
    toast({
      title: "Re-detecting RELION environment",
      description: "The status chip and the dashboard card update when the probe returns.",
    });
    void useWorkflowStore.getState().refreshSystem();
  };

  return (
    <>
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      // t674 — while a row is being renamed, Escape belongs to the EDIT
      // (cancel the draft), not to the dialog. Radix listens for Escape on
      // the document's CAPTURE phase (use-escape-keydown) — before any
      // bubble-phase handler, so the rename input's stopPropagation can
      // never reach it — but the layer honors defaultPrevented: the
      // official extension point is onEscapeKeyDown. An editing row eats
      // the first Escape (the input cancels the draft); a second Escape —
      // the input gone, the flag cleared — closes the dialog normally.
      onEscapeKeyDown={(e) => {
        if (renamingView) e.preventDefault();
      }}
      title="Command palette"
      description="Search jobs, job types and canvas actions"
      className={cn(
        "sm:max-w-lg",
        // t572 — the cascade rides this class; settled disarms the
        // entrance so filter re-displays stay silent (see the state above)
        "palette-motion",
        cascadeSettled && "palette-motion-settled"
      )}
    >
      <CommandInput placeholder="Jump to a job, add a type, run an action…" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>No results — try a job name or a type like “refine”.</CommandEmpty>

        {/* ---------------- jobs ---------------- */}
        <CommandGroup heading="Jobs">
          {jobs.map((j) => {
            const spec = jobType(j.type);
            return (
              <CommandItem
                key={j.id}
                value={`job ${j.name} ${j.type} ${spec?.label ?? ""} ${j.status}`}
                onSelect={() => jumpToJob(j.id)}
                className="gap-2.5"
              >
                <TypeIcon
                  name={spec?.icon ?? "boxes"}
                  className={`size-4 shrink-0 ${spec?.color.text ?? "text-muted-foreground"}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{j.name}</span>
                <Badge
                  variant="outline"
                  className="ml-auto h-5 shrink-0 rounded-full px-1.5 text-[9px] font-medium capitalize"
                >
                  {j.status}
                </Badge>
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {/* ---------------- notes (annotated jobs) ---------------- */}
        {notedJobs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup
              heading={`Notes · ${notedJobs.length} annotated job${notedJobs.length === 1 ? "" : "s"}`}
            >
              {notedJobs.map((j) => {
                const spec = jobType(j.type);
                // granularity twin (Task 82 doctrine): the StickyNote icon
                // reads "this step is noted", the amber count capsule reads
                // "judgments inside the step are noted" — same visual
                // grammar as the canvas card (Row 1) and dashboard row
                // badges, so the palette speaks the same dialect
                const classNotes = Object.entries(parseClassNotes(j.params?.classNotes));
                // index-first doctrine (Task 83): when a job carries only
                // class notes, the middle column shows the scannable class
                // INDEX (which classes are annotated) — the identity that
                // survives a truncate — instead of an empty cell
                const classIdx = classNotes.map(([k]) => `Class ${k}`).join(", ");
                // the note TEXT is the searchable payload — "note" leading
                // token makes plain "note" queries land in this group first.
                // Class note texts fuse into the payload (Task 86) so a
                // phrase from any judgment finds its HOST row here and its
                // per-annotation row in the Class notes group below. The
                // fusion is capped: a 200-class run's texts must never
                // bloat the fuzzy matcher's haystack.
                const fusedClassTexts = classNotes
                  .map(([, t]) => t)
                  .join(" ")
                  .slice(0, 240);
                return (
                  <CommandItem
                    key={`note-${j.id}`}
                    value={`note ${j.name} ${j.type} ${j.note ?? ""} ${fusedClassTexts}`}
                    onSelect={() => jumpToJob(j.id)}
                    className="gap-2.5"
                  >
                    <StickyNote className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
                    <span className="min-w-0 shrink-0 truncate text-sm font-medium">
                      {j.name}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {j.note || `class notes on ${classIdx}`}
                    </span>
                    {classNotes.length > 0 && (
                      <span
                        data-palette-note-classbadge=""
                        data-palette-note-classcount={classNotes.length}
                        role="img"
                        aria-label={`${classNotes.length} class${classNotes.length === 1 ? "" : "es"} noted`}
                        title={`Class notes on ${classNotes.map(([k]) => `Class ${k}`).join(", ")}`}
                        className="flex h-4 shrink-0 items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                      >
                        <StickyNote className="size-2.5" aria-hidden="true" />
                        {classNotes.length}
                      </span>
                    )}
                    <TypeIcon
                      name={spec?.icon ?? "boxes"}
                      className={`size-3.5 shrink-0 ${spec?.color.text ?? "text-muted-foreground"}`}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* ---------------- class notes (gallery annotations) ---------------- */}
        {notedClassRows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup
              heading={`Class notes · ${notedClasses.length} annotation${notedClasses.length === 1 ? "" : "s"}${notedClasses.length > notedClassRows.length ? ` — first ${notedClassRows.length}` : ""}`}
            >
              {notedClassRows.map(({ job, cls, text }) => {
                const spec = jobType(job.type);
                return (
                  <CommandItem
                    key={`class-note-${job.id}-${cls}`}
                    value={`class note class ${cls} ${job.name} ${job.type} ${text}`}
                    onSelect={() => jumpToClassNote(job.id, cls)}
                    className="gap-2.5"
                  >
                    <StickyNote className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
                    <span
                      data-palette-classnote-chip=""
                      className="flex h-4 shrink-0 items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 font-mono text-[9px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                    >
                      Class {cls}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {text}
                    </span>
                    <span className="max-w-32 shrink-0 truncate text-[11px] text-muted-foreground/70">
                      {job.name}
                    </span>
                    <TypeIcon
                      name={spec?.icon ?? "boxes"}
                      className={`size-3.5 shrink-0 ${spec?.color.text ?? "text-muted-foreground"}`}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* ---------------- frame galleries (t659 deep link) ---------------- */}
        {galleryRows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup
              heading={`Frame galleries · ${galleryJobs.length} wall${galleryJobs.length === 1 ? "" : "s"}${galleryJobs.length > galleryRows.length ? ` — first ${galleryRows.length}` : ""}`}
            >
              {galleryRows.map((j) => {
                const spec = jobType(j.type);
                return (
                  <CommandItem
                    key={`gallery-${j.id}`}
                    value={`frame gallery micrographs wall ${j.name} ${j.type}`}
                    onSelect={() => jumpToGallery(j.id)}
                    className="gap-2.5"
                  >
                    <Aperture className="size-4 shrink-0 text-running-600 dark:text-running-400" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      Frame gallery — <span className="font-medium">{j.name}</span>
                    </span>
                    {/* t663 — the first frame's tile, fetched when the row is
                        active (hover or arrows) and cached module-level; the
                        honest ladder keeps wall-less rows icon-only */}
                    <PaletteGalleryThumb kind="frames" jobId={j.id} label={`First frame of ${j.name}'s wall`} />
                    <TypeIcon
                      name={spec?.icon ?? "boxes"}
                      className={`size-3.5 shrink-0 ${spec?.color.text ?? "text-muted-foreground"}`}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* ---------------- class averages (t660 deep link) ---------------- */}
        {classAveragesRows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup
              heading={`Class averages · ${classAveragesJobs.length} classification${classAveragesJobs.length === 1 ? "" : "s"}${classAveragesJobs.length > classAveragesRows.length ? ` — first ${classAveragesRows.length}` : ""}`}
            >
              {classAveragesRows.map((j) => {
                const spec = jobType(j.type);
                return (
                  <CommandItem
                    key={`class-avg-${j.id}`}
                    value={`class averages tiles classification ${j.name} ${j.type}`}
                    onSelect={() => jumpToClassAverages(j.id)}
                    className="gap-2.5"
                  >
                    <Layers className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      Class averages — <span className="font-medium">{j.name}</span>
                    </span>
                    {/* t663 — the first class tile, same lane rule the teaser
                        obeys (volumes win, the combined stack covers 2D) */}
                    <PaletteGalleryThumb kind="classes" jobId={j.id} label={`First class of ${j.name}`} />
                    <TypeIcon
                      name={spec?.icon ?? "boxes"}
                      className={`size-3.5 shrink-0 ${spec?.color.text ?? "text-muted-foreground"}`}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* ---------------- denoise compare (t665) ---------------- */}
        {denoiseRows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup
              heading={`Denoise compare · ${denoiseJobs.length} run${denoiseJobs.length === 1 ? "" : "s"}${denoiseJobs.length > denoiseRows.length ? ` — first ${denoiseRows.length}` : ""}`}
            >
              {denoiseRows.map((j) => {
                const spec = jobType(j.type);
                return (
                  <CommandItem
                    key={`denoise-cmp-${j.id}`}
                    value={`denoise compare before after pairs topaz ${j.name} ${j.type}`}
                    onSelect={() => jumpToDenoise(j.id)}
                    className="gap-2.5"
                  >
                    {/* t666 — the first pair's tile, the wall's own gate
                        (fully-paired row) and its own base layer (the
                        denoised leg) — the t663 family's third kind */}
                    <PaletteGalleryThumb kind="denoise" jobId={j.id} label={`First pair of ${j.name}'s wall`} />
                    <Wand2 className="size-4 shrink-0 text-fuchsia-600 dark:text-fuchsia-400" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      Denoise compare — <span className="font-medium">{j.name}</span>
                    </span>
                    <TypeIcon
                      name={spec?.icon ?? "boxes"}
                      className={`size-3.5 shrink-0 ${spec?.color.text ?? "text-muted-foreground"}`}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* ---------------- saved 3D views (t668) ---------------- */}
        {savedViewRows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup
              heading={`Saved views · ${savedViewTotal} bookmark${savedViewTotal === 1 ? "" : "s"}${savedViewTotal > savedViewRows.length ? ` — first ${savedViewRows.length}` : ""}`}
            >
              {savedViewRows.map(({ v, b }) => {
                // t674 — the row is now THREE mouths: jump (the row body),
                // delete (X), rename (pencil) — the wall's trio, palette-sized.
                const rowKey = `${v.jobId}:${b.id}`;
                const isRenaming = renamingView === rowKey;
                return (
                <CommandItem
                  key={`saved-view-${v.jobId}:${b.id}`}
                  value={`saved view 3d bookmark ${b.name} ${v.jobName} ${v.jobType}`}
                  onSelect={() => jumpToSavedView(v, b)}
                  data-palette-savedview-row={b.id}
                  className="group/item relative gap-2.5"
                >
                  {/* the thumb the save captured — inline data URL, zero
                      extra fetches (the dashboard card's picture, row-);
                      a thumb-less bookmark keeps the wall's own fallback */}
                  {b.thumb ? (
                    <img
                      src={b.thumb}
                      alt=""
                      data-palette-savedview-thumb=""
                      className="size-10 shrink-0 rounded-md border border-border/60 object-cover"
                    />
                  ) : (
                    <Mountain className="size-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                  )}
                  {/* while a row is being renamed, the name becomes the
                      input — the "Saved view —" prefix dissolves with it
                      (you are editing the name itself, not a labelled
                      field). Every keydown stops propagation: cmdk's
                      Command root would otherwise read Enter as the jump
                      gesture and the arrows as list navigation, and the
                      dialog's Escape-close rides document-level listeners
                      the input must not feed. */}
                  {isRenaming ? (
                    <input
                      data-palette-savedview-rename-input={b.id}
                      value={renameDraft}
                      maxLength={40}
                      autoFocus
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          renameCancelRef.current = true;
                          e.currentTarget.blur();
                        }
                      }}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => {
                        if (renamingView !== rowKey) return;
                        const d = renameDraft;
                        setRenamingView(null);
                        if (renameCancelRef.current) {
                          renameCancelRef.current = false;
                          return;
                        }
                        void renameSavedView(v, b, d);
                      }}
                      aria-label={`Rename saved view “${b.name}”`}
                      className="h-6 min-w-0 flex-1 rounded-md border bg-background px-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm">
                      Saved view — <span className="font-medium">{b.name}</span>
                    </span>
                  )}
                  <span className="max-w-32 shrink-0 truncate text-[11px] text-muted-foreground/70">
                    {v.jobName}
                  </span>
                  {/* t670 — the slot-swap grammar, grown into a TRIO (t674):
                      the Mountain tail (the jump mouth's affordance) fades
                      on hover and the pencil + X pair sits beneath it —
                      the slot is one size wider than the delete-only era,
                      still zero layout shift on the hover swap. The X
                      keeps its t670 anchor name; the pencil takes the
                      wall's floating-chip tones (primary, not destructive
                      — rename builds, delete tears down). stopPropagation
                      keeps cmdk's own onSelect (the jump) out of both
                      mutation clicks; Tab still reaches visible controls
                      (focus-visible + group-focus-within), and
                      motion-reduce keeps the swap from animating. */}
                  <span className="relative flex h-5 w-10 shrink-0 items-center justify-center">
                    <Mountain
                      className="absolute inset-0 m-auto size-3.5 text-teal-600/70 transition-opacity group-hover/item:opacity-0 group-focus-within/item:opacity-0 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      data-palette-savedview-rename={b.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setRenamingView(rowKey);
                        setRenameDraft(b.name);
                      }}
                      disabled={busyView}
                      aria-label={`Rename saved view “${b.name}”`}
                      title={`Rename “${b.name}” — gives this bookmark a new name (Enter saves, Esc cancels)`}
                      className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity motion-reduce:transition-none hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 group-hover/item:opacity-100 group-focus-within/item:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Pencil className="size-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      data-palette-savedview-delete={b.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        void deleteSavedView(v, b);
                      }}
                      disabled={busyView}
                      aria-label={`Delete saved view “${b.name}”`}
                      title={`Delete “${b.name}” — removes this bookmark from ${v.jobName}'s saved views`}
                      className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity motion-reduce:transition-none hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 group-hover/item:opacity-100 group-focus-within/item:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deletingView === rowKey ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <X className="size-3" aria-hidden="true" />
                      )}
                    </button>
                  </span>
                </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* ---------------- run (idle jobs) ---------------- */}
        {jobs.some((j) => j.status === "idle") && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Run">
              {jobs
                .filter((j) => j.status === "idle")
                .map((j) => (
                  <CommandItem
                    key={`run-${j.id}`}
                    value={`run ${j.name} ${j.type}`}
                    onSelect={() => runJob(j.id)}
                    className="gap-2.5"
                  >
                    <Play className="size-4 shrink-0 text-teal-600" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      Run <span className="font-medium">{j.name}</span>
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        {/* ---------------- add job types ---------------- */}
        <CommandGroup heading="Add job type">
          {JOB_TYPES.map((t) => (
            <CommandItem
              key={`type-${t.key}`}
              value={`add ${t.key} ${t.label} ${t.category}`}
              onSelect={() => addType(t.key)}
              className="gap-2.5"
            >
              <TypeIcon name={t.icon} className={`size-4 shrink-0 ${t.color.text}`} />
              <span className="min-w-0 flex-1 truncate text-sm">{t.label}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                {t.category}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* ---------------- add with preset ---------------- */}
        <CommandSeparator />
        <CommandGroup heading="Add with preset">
          {JOB_PRESETS.map((p) => {
            const t = jobType(p.type);
            return (
              <CommandItem
                key={`preset-${p.type}-${p.preset}`}
                value={`preset add ${p.type} ${t?.label ?? ""} ${p.preset} ${p.note}`}
                onSelect={() => addPreset(p)}
                className="gap-2.5"
              >
                <TypeIcon
                  name={t?.icon ?? "boxes"}
                  className={`size-4 shrink-0 ${t?.color.text ?? "text-muted-foreground"}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {t?.label ?? p.type}
                  <span className="ml-1.5 font-medium">{p.preset}</span>
                </span>
                <span className="hidden shrink-0 max-w-40 truncate text-[10px] text-muted-foreground sm:inline">
                  {p.note}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* ---------------- projects (Task 245) ----------------
            Parent before child: the project owns workspaces, so its group
            sits above the Workspaces group. Same row dialect — name,
            (active) marker, a right-aligned verb — and the SAME guard the
            header's ProjectSwitcher enforces: switching to the active
            project is a no-op that just closes (honest, not an error). */}
        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem
                key={`proj-${p.id}`}
                value={`project ${p.name}`}
                onSelect={() => {
                  if (p.id === project?.id) {
                    close(); // already there — the door closes quietly
                    return;
                  }
                  void switchProject(p.id); // reloads jobs/workspaces, lands on the first workspace
                  close();
                }}
                className="gap-2.5"
              >
                <FolderOpen className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p.name}
                  {p.id === project?.id && (
                    <span className="ml-1.5 text-[10px] font-medium text-primary">(active)</span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  switch project
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* ---------------- workspaces ---------------- */}
        {workspaces.length > 0 && (
          <CommandGroup heading="Workspaces">
            {workspaces.map((w) => (
              <CommandItem
                key={`ws-${w.id}`}
                value={`workspace ${w.name}`}
                onSelect={() => {
                  switchWorkspace(w.id);
                  setView("canvas");
                  close();
                }}
                className="gap-2.5"
              >
                <Layers className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {w.name}
                  {w.id === activeWorkspaceId && (
                    <span className="ml-1.5 text-[10px] font-medium text-primary">(active)</span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  switch canvas
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* ---------------- export chart data (Task 110) ---------------- */}
        {exportTargetJob && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Export chart data · ${exportTargetJob.name}`}>
              {CHART_EXPORT_TARGETS.map((t) => {
                const { Icon, tone } = CHART_ICONS[t.key] ?? {
                  Icon: FileSpreadsheet,
                  tone: "text-muted-foreground",
                };
                return (
                  <CommandItem
                    key={`chart-export-${t.key}`}
                    value={`export ${t.label} csv chart data ${exportTargetJob.name}`}
                    onSelect={() => exportChartRows(t, exportTargetJob)}
                    className="gap-2.5"
                  >
                    <Icon className={`size-4 shrink-0 ${tone}`} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.label}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      csv · cryoflow-{fileSlug(t.label)}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {/* Task 113 — the clipboard door reaches the keyboard flow: the
                SAME rows as the export group (one fetchChartRows), paste
                dialect, Copy icon tinted with each chart's tone so a row is
                recognizably "that chart's copy" before it is clicked. PNG
                copy stays palette-excluded: it needs a mounted SVG, and the
                jump-and-scroll orchestration was rejected in Task 110. */}
            <CommandGroup heading={`Copy chart data · ${exportTargetJob.name}`}>
              {CHART_EXPORT_TARGETS.map((t) => {
                const { Icon, tone } = CHART_ICONS[t.key] ?? {
                  Icon: FileSpreadsheet,
                  tone: "text-muted-foreground",
                };
                return (
                  <CommandItem
                    key={`chart-copy-${t.key}`}
                    value={`copy ${t.label} tsv clipboard chart data ${exportTargetJob.name}`}
                    onSelect={() => copyChartRows(t, exportTargetJob)}
                    className="gap-2.5"
                    data-canvas-ui={`palette-chart-copy-${t.key}`}
                  >
                    <Copy className={`size-4 shrink-0 ${tone}`} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.label}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      tsv · clipboard
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        {/* ---------------- canvas + app actions ---------------- */}
        <CommandGroup heading="Engine">
          <CommandItem
            value="re-detect relion environment engine probe refresh discover install scan"
            onSelect={redetectEngine}
            className="gap-2.5"
          >
            <RefreshCcw className="size-4 shrink-0 text-teal-600" />
            <span className="flex-1 text-sm">
              Re-detect RELION environment
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                re-run the probe after installing or moving RELION — no restart needed
              </span>
            </span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Canvas & app">
          <CommandItem
            value="create standard spa pipeline template prewired workflow scaffold"
            onSelect={createTemplate}
            className="gap-2.5"
          >
            <Workflow className="size-4 shrink-0 text-teal-600" />
            <span className="flex-1 text-sm">
              Create standard SPA pipeline
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                10 pre-wired jobs · import → postprocess
              </span>
            </span>
            <CommandShortcut>↵ defaults</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="create spa pipeline with presets symmetry classes scaffold configure"
            onSelect={openTemplatePresets}
            className="gap-2.5"
          >
            <SlidersHorizontal className="size-4 shrink-0 text-teal-600" />
            <span className="flex-1 text-sm">
              Create SPA pipeline with presets…
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                symmetry · class counts · refine mode
              </span>
            </span>
          </CommandItem>
          <CommandItem value="zoom to fit workflow view" onSelect={zoomToFit} className="gap-2.5">
            <Maximize2 className="size-4 shrink-0" />
            <span className="flex-1 text-sm">Zoom to fit workflow</span>
          </CommandItem>
          <CommandItem value="reset view pan zoom 100" onSelect={resetView} className="gap-2.5">
            <RotateCcw className="size-4 shrink-0" />
            <span className="flex-1 text-sm">Reset view (100%)</span>
            <CommandShortcut>0</CommandShortcut>
          </CommandItem>
          <CommandItem value="tidy layout arrange auto" onSelect={tidyLayout} className="gap-2.5">
            <Wand2 className="size-4 shrink-0" />
            <span className="flex-1 text-sm">Tidy layout</span>
          </CommandItem>
          <CommandItem
            value="find search locate ring matches lens canvas discover"
            onSelect={() => {
              if (view !== "canvas") setView("canvas");
              openFind();
              close();
            }}
            className="gap-2.5"
          >
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm">Find on canvas</span>
            <CommandShortcut>⌘/Ctrl F</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="note spotlight annotated annotations margin lens filter dim discover"
            onSelect={() => {
              toggleNoteSpotlight();
              close();
            }}
            className="gap-2.5"
          >
            <StickyNote
              className={`size-4 shrink-0 ${
                noteSpotlight ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground"
              }`}
            />
            <span className="flex-1 text-sm">
              {noteSpotlight ? "Show all jobs (spotlight off)" : "Spotlight noted jobs"}
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                dim cards without a note
              </span>
            </span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="help guide manual how to use cryoflow guide storage graveyard clusters assistant"
            onSelect={openHelpGuide}
            className="gap-2.5"
          >
            <BookOpen className="size-4 shrink-0" />
            <span className="flex-1 text-sm">Help — the full guide</span>
            <span className="text-[10px] text-muted-foreground">manual</span>
          </CommandItem>
          <CommandItem
            value="keyboard shortcuts keys help bindings discover"
            onSelect={openShortcuts}
            className="gap-2.5"
          >
            <Keyboard className="size-4 shrink-0" />
            <span className="flex-1 text-sm">Keyboard shortcuts</span>
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="export canvas png image download poster workflow"
            onSelect={exportPng}
            className="gap-2.5"
          >
            <Download className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              Export canvas as PNG
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                content-fit poster · footer with project · workspace
              </span>
            </span>
          </CommandItem>
          <CommandItem
            value="export workflow json file share graph"
            onSelect={exportJson}
            className="gap-2.5"
          >
            <FileJson className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              Export workflow as JSON
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                graph + params, portable between workspaces
              </span>
            </span>
          </CommandItem>
          <CommandItem
            value="export pipeline shell script replay relion commands dependency order download"
            onSelect={() => {
              close(); // the dialog is the next modal — drop the palette first
              setPipelineOpen(true);
            }}
            className="gap-2.5"
          >
            <FileTerminal className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              Export pipeline as shell script
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                dependency-ordered relion replay · all workspaces · preview before download
              </span>
            </span>
          </CommandItem>
          <CommandItem
            value="import workflow json file load graph"
            onSelect={importJson}
            className="gap-2.5"
          >
            <FileUp className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              Import workflow from JSON…
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                recreate an exported graph below existing content
              </span>
            </span>
          </CommandItem>
          <CommandItem
            value="toggle theme dark light appearance"
            onSelect={toggleTheme}
            className="gap-2.5"
          >
            <Moon className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
            </span>
          </CommandItem>
          <CommandItem
            value="session qc report map inventory amber lens csv printable document"
            onSelect={() => {
              close(); // the report is the next modal — drop the palette first
              window.dispatchEvent(new CustomEvent(SESSION_REPORT_EVENT));
            }}
            className="gap-2.5"
          >
            <FileText className="size-4 shrink-0 text-violet-600" />
            <span className="flex-1 text-sm">
              Open the session QC report
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                pipeline glance · map inventory · sweep verdict, one printable paper
              </span>
            </span>
          </CommandItem>
          <CommandItem
            value="system diagnostics memory lanes disk build guard provenance census vitals health"
            onSelect={() => {
              close(); // the panel is the next modal — drop the palette first
              window.dispatchEvent(new CustomEvent(SYSTEM_DIAGNOSTICS_EVENT));
            }}
            className="gap-2.5"
          >
            <Activity className="size-4 shrink-0 text-teal-600" />
            <span className="flex-1 text-sm">
              Open system diagnostics
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                memory lanes · disk · engine build progress · the running build's provenance
              </span>
            </span>
          </CommandItem>
          <CommandItem
            value="project dashboard management page view"
            onSelect={() => {
              setView(view === "canvas" ? "dashboard" : "canvas");
              setOpen(false);
            }}
            className="gap-2.5"
          >
            <LayoutDashboard className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              {view === "canvas" ? "Open project dashboard" : "Back to workflow canvas"}
            </span>
            <CommandShortcut>⇧D</CommandShortcut>
          </CommandItem>
          {/* Task 245 — the GitHub door joins the index: the header link is
              a real door (Task 179 kept it as the width donor), but unlike
              Print it has NO platform-native keyboard path — so honesty
              puts a row here instead of an exemption. */}
          <CommandItem
            value="github source code repository issues open external link project page"
            onSelect={() => {
              close();
              window.open("https://github.com/Jing0715-fer/cryoflow", "_blank", "noopener,noreferrer");
            }}
            className="gap-2.5"
          >
            <Github className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm">
              Open CryoFlow on GitHub
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                source · issues — opens a new tab
              </span>
            </span>
          </CommandItem>
          {/* t261 — the remote-clusters door joins the index: the parallel
              window's header button arrived without a palette verb, and
              t245's inventory law caught it (13 doors, one unmapped). The
              handshake is a custom event — the palette can't reach the
              header button's state, and the button owns its dialog. */}
          <CommandItem
            value="remote clusters ssh connections probe relion modules dispatch jobs"
            onSelect={() => {
              close();
              window.dispatchEvent(new CustomEvent(REMOTE_CLUSTERS_OPEN_EVENT));
            }}
            className="gap-2.5"
          >
            <Network className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm">
              Manage remote clusters
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                SSH connections · probe relion modules · dispatch jobs
              </span>
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
    {/* Task 179: palette-owned export surface — the pipeline replay script.
        Mounted here so the row's close-then-open handshake keeps one modal
        alive at a time. */}
    <PipelineScriptDialog open={pipelineOpen} onOpenChange={setPipelineOpen} />
    </>
  );
}

/** Header chip that opens the palette (dispatches the custom event). */
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
      className="flex h-8 items-center gap-1 rounded-md border bg-muted/40 px-2 max-sm:px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
      aria-label="Open command palette (Ctrl+K)"
      title="Command palette — Ctrl/⌘ + K"
    >
      <CommandIcon className="size-3" aria-hidden="true" />
      <span className="hidden font-mono text-[10px] sm:inline">K</span>
    </button>
  );
}
