"use client";

/**
 * CryoFlow — job results/output viewer.
 *
 * Backend: /api/jobs/[id]/outputs walks the REAL RELION engine workdir
 * (MRC maps/stacks, STAR tables, FSC curves, logs). This component lays
 * them out as: FSC chart (when postprocess data exists) → MRC gallery
 * (thumbnails + 3D Mol* viewer for volumes) → STAR tables → logs &
 * reports → workdir footer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// t350 — per-iteration class snapshots (live + picker)
import { ClassIterationGallery } from "./class-iteration-gallery";
import {
  AlertTriangle,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudDownload,
  Copy,
  Crop,
  ExternalLink,
  FileDown,
  FileText,
  FolderOpen,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  ScrollText,
  Table2,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  onEscapeClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { buildFscSvg, fscMilestones, fscNyquist, fscTableMarkdown } from "@/lib/fsc-snapshot";
import { buildProfileReportHtml } from "@/lib/report-html";
import {
  angdistSummaryMarkdown,
  buildAngdistHeatmapSvg,
  buildCtfScatterSvg,
  buildGuinierSvg,
  buildMotionDriftSvg,
  buildResolutionSvg,
  ctfTableMarkdown,
  guinierTableMarkdown,
  motionTableMarkdown,
  resolutionTableMarkdown,
  svgToPngDataUrl,
  buildTopazSvg,
  topazTableMarkdown,
  type AngDistSnapshot,
  type CtfSnapshotMicrograph,
  type MotionSnapshotMicrograph,
  type TopazSnapshotEpoch,
} from "@/lib/report-snapshots";
import type { JobDTO } from "@/lib/types";
import type { OutputSummary, SummaryStat } from "@/lib/relion/output-summary";
import { cn } from "@/lib/utils";
import { FscChart } from "./fsc-chart";
import { TopazTrainingChart } from "./topaz-training-chart";
import { MrcImage } from "./mrc-image";
import { MolViewer, type MolViewerTarget } from "./mol-viewer";
import { useAnchorParent } from "./anchor-parent";
import { StarTable } from "./star-table";
import { QuickHistSection } from "./density-histogram";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type OutputKind = "mrc" | "star" | "text" | "image";

interface OutputFile {
  path: string;
  name: string;
  kind: OutputKind;
  size: number;
  /** t289 — the file lives on the cluster (key-files sync policy): the
   *  tile renders a fetch-gated card; every viewer door (preview,
   *  download, Mol*) pulls it over SSH on the explicit click. */
  remote?: boolean;
  slices?: number;
  /** volume grid [nx, ny, nz] — 3D maps only */
  dims?: [number, number, number];
  label?: string;
  rows?: number;
  /** map header summary for 3D volumes — origin inside its parent, voxel
   *  spacing, density stats (server mirrors the MrcHeader read it already
   *  did; stacks don't carry one) */
  map?: {
    origin: [number, number, number];
    pixel: number;
    dmin: number;
    dmax: number;
    dmean: number;
    rms: number;
  };
}

interface OutputsResponse {
  workdir: string | null;
  engine: "relion";
  files: OutputFile[];
  /** t330 — per-type key numbers (particles above all); null when this
   *  listing yields no honest count */
  summary?: OutputSummary | null;
  /** t330 — WARNING lines from run.out (deduped, capped) */
  warnings?: string[];
  note?: string;
}

/** t330 — the load failure carries its own diagnosis: which LAYER failed
 *  (record gone / server error / route unreachable / network), so the card
 *  can say what to do instead of a bare "HTTP 404" the user reads as a
 *  broken cluster. The raw detail rides along as the secondary line. */
interface LoadError {
  friendly: string;
  raw: string;
  kind: "gone" | "server" | "route" | "network";
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileUrl(jobId: string, file: OutputFile, extra: string): string {
  return `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(file.path)}${extra}`;
}

/** Density numbers live in wildly different ranges (raw detector counts
 *  vs normalized float maps); one decimal rule keeps the badges honest
 *  without a unit per row. (Shared with the inspector's reference card —
 *  t257 — so both badges speak the same number language.) */
export function formatStat(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 10_000 || abs < 0.001)) return v.toExponential(2);
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(3).replace(/\.?0+$/, "");
}

/** Where did an Import Map's file come from? The mapPath parameter tells
 *  the story: a crop sent from the 3D viewer lives in a parent job's
 *  SubVolumes/ folder (t255's send-to-new-job writes there), anything
 *  else is a standalone pick from the file browser. (Shared with the
 *  inspector's reference card — t257 — one source, both cards agree.) */
export function mapSourceNote(mapPath: string): { kind: "crop" | "standalone"; label: string } {
  const norm = mapPath.replace(/\\/g, "/");
  const idx = norm.toLowerCase().lastIndexOf("/subvolumes/");
  if (idx >= 0) {
    const parentDir = norm.slice(0, idx).split("/").filter(Boolean).pop();
    return { kind: "crop", label: parentDir || "the parent job" };
  }
  return { kind: "standalone", label: norm.split("/").filter(Boolean).pop() || mapPath };
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

/** t363 — the job types whose Results tab is anchored by the LIVE
 *  iteration gallery (the same set the gallery itself renders for). While
 *  one of these runs REMOTELY the local mirror stays empty until the
 *  sync-back lands at finalize — the outputs listing carries no files, and
 *  the old "no on-disk outputs" early return kept the gallery unmounted
 *  for the WHOLE run: the exact "intermediate results only arrive when
 *  everything finishes" field report. For these types the gallery mounts
 *  above the (still empty) file sections and streams rounds live from the
 *  cluster. */
const ITERATION_GALLERY_TYPES = new Set(["class2d", "class3d", "refine3d", "initialmodel"]);

export function JobResults({ job, refreshKey = 0 }: { job: JobDTO; refreshKey?: number }) {
  const [data, setData] = useState<OutputsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);

  const [imageFile, setImageFile] = useState<OutputFile | null>(null);
  /** t286 — the quick-look dialog's display window: the histogram strip
   *  (or its σ presets) commands the PNG render (lo → black, hi → white);
   *  null = AUTO, the 2–98 percentile answers. Reset per file. */
  const [imgWindow, setImgWindow] = useState<{ lo: number; hi: number } | null>(null);
  // t287 — the stack dialog's slice cursor (0-based). The montage stays
  // the overview; the slice cursor picks WHICH particle image the single
  // view and the histogram speak.
  const [stackSlice, setStackSlice] = useState(0);
  // t288 — the montage overview follows the display window ONLY when the
  // user asks: sixteen images are sixteen distributions, so by default
  // every cell speaks its own auto stretch. The toggle is the explicit
  // command over all of them (and survives slice steps — it's the
  // reader's intent, not a command over any one image's pixels; the
  // window itself still resets per image, so the montage silently
  // returns to auto with it). Reset per file, like the window.
  const [montageWin, setMontageWin] = useState(false);
  const [starFile, setStarFile] = useState<OutputFile | null>(null);
  const [textFile, setTextFile] = useState<OutputFile | null>(null);
  /** t260 — the shared Mol* dialog opens on a TARGET (job + file + optional
   *  anchored clip box), not just a file of THIS job: the identity card's
   *  "show in parent" door aims it at the PARENT's map with the clip planes
   *  pre-anchored on the crop's box. One dialog, many doors, one language. */
  const [molTarget, setMolTarget] = useState<MolViewerTarget | null>(null);
  const [copied, setCopied] = useState(false);

  /** one automatic retry per failure run — a dev-server HMR blip or a
   *  mid-restart 404 recovers without the user ever seeing the card; a
   * "record gone" verdict never retries (it would say the same thing) */
  const retriedRef = useRef(false);

  const loadOnce = useCallback(async (): Promise<"ok" | LoadError> => {
    try {
      const res = await fetch(`/api/jobs/${job.id}/outputs`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        const raw = body?.error ?? `HTTP ${res.status}`;
        if (body?.error === "Job not found") {
          return {
            kind: "gone",
            raw,
            friendly:
              "This job's record is no longer in the app's database — the canvas may be showing a stale view. Close this inspector and reload the page.",
          };
        }
        if (res.status >= 500) {
          return {
            kind: "server",
            raw,
            friendly:
              "The app server hit an internal error while listing outputs — check the server console; a retry may succeed.",
          };
        }
        if (res.status === 404) {
          return {
            kind: "route",
            raw,
            friendly:
              "The app server answered 404 for the outputs route — it may be mid-restart or running a stale build. Retry, then reload the page (and after a git pull: install + rebuild before starting).",
          };
        }
        return {
          kind: "route",
          raw,
          friendly: "The outputs listing failed to load.",
        };
      }
      setData((await res.json()) as OutputsResponse);
      return "ok";
    } catch (err) {
      return {
        kind: "network",
        raw: err instanceof Error ? err.message : String(err),
        friendly:
          "The app server did not answer — is it still running? (This listing reads the job's local workdir; the cluster connection is not involved.)",
      };
    }
  }, [job.id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let r = await loadOnce();
    if (r !== "ok" && r.kind !== "gone" && !retriedRef.current) {
      retriedRef.current = true;
      // brief pause — an HMR/restart blip needs a beat to come back
      await new Promise((res) => setTimeout(res, 1200));
      r = await loadOnce();
    }
    if (r === "ok") {
      retriedRef.current = false; // success re-arms the one-shot retry
    } else {
      setError(r);
    }
    setLoading(false);
  }, [loadOnce]);

  useEffect(() => {
    void load();
  }, [load]);

  // external refresh signal (inspector's live polling while the job runs)
  const firstKey = useRef(refreshKey);
  /* where the 3D viewer returns focus on close — the Maps gallery the user
   * started from (its "View in 3D" trigger dies with the image dialog, so
   * Radix's default restore-focus would orphan focus onto <body> and the
   * inspector's focus-outside guard would then dismiss the whole modal) */
  const molFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (refreshKey !== firstKey.current) void load();
  }, [refreshKey, load]);

  // t286 — a display window belongs to the file it was drawn on: opening
  // another file resets to AUTO (the strip's key={path} resets its toggle
  // the same way — two resets, one honest per-file world).
  // t287 — and to the IMAGE it was drawn on inside a stack: a different
  // slice is a different distribution with its own μ/σ, so the old
  // lo/hi pair would be a stale command over new pixels — stepping the
  // slice resets the window too (the slice view and the histogram both
  // snap back to AUTO together).
  const imgPath = imageFile?.path ?? null;
  useEffect(() => {
    setImgWindow(null);
  }, [imgPath, stackSlice]);
  // opening another FILE restarts the stack at its first image
  useEffect(() => {
    setStackSlice(0);
  }, [imgPath]);
  // t288 — and resets the montage's follow-window toggle (the toggle is
  // the reader's intent across SLICES, but across FILES a fresh dialog
  // starts honest: overview auto, window auto)
  useEffect(() => {
    setMontageWin(false);
  }, [imgPath]);

  // latest-iteration first: for finished jobs the FINAL classes/maps are what
  // users come to see (run_it025_classes beats run_it000_classes)
  const mrcFiles = useMemo(() => {
    const files = data?.files.filter((f) => f.kind === "mrc") ?? [];
    const iterOf = (name: string): number => {
      const m = name.match(/^run_it(\d+)_/i);
      return m ? Number(m[1]) : -1;
    };
    return [...files].sort((a, b) => {
      const ia = iterOf(a.name);
      const ib = iterOf(b.name);
      if (ia !== ib) return ib - ia; // higher iteration first
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, [data]);
  const starFiles = useMemo(() => data?.files.filter((f) => f.kind === "star") ?? [], [data]);
  const logFiles = useMemo(
    () => data?.files.filter((f) => f.kind === "text" || f.kind === "image") ?? [],
    [data]
  );

  const copyWorkdir = useCallback(async () => {
    if (!data?.workdir) return;
    try {
      await navigator.clipboard.writeText(data.workdir);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, [data?.workdir]);

  const [reportBusy, setReportBusy] = useState(false);

  /** Run report → Markdown download. The file list and summary come from
   *  data already on screen; resolution lines and the FSC section earn
   *  their place by arriving (postprocess FSC first, then the live refine
   *  value) — a failed fetch is simply not a line, honest gaps over
   *  placeholder dashes. The FSC section carries a milestone-resolution
   *  table plus a self-drawn curve snapshot (PNG data URL, 2× rasterized
   *  from a standalone SVG — never scraped from the class-styled DOM
   *  chart); both degrade to nothing when the data or the browser says no. */
  const buildRunReportMd = useCallback(async (): Promise<{
    md: string;
    chartBits: string[];
    slug: string;
  } | null> => {
    try {
      interface FscBody {
        source: "postprocess" | "model" | null;
        sourceFile: string | null;
        shells: {
          freq: number;
          res: number;
          fsc: number;
          correctedFsc?: number;
          phaseRandomizedFsc?: number;
        }[];
        resolutionAt143: number | null;
        resolutionAt05: number | null;
        reportedResolution: number | null;
        reportedLabel: string | null;
      }
      // wrapped in an object: TS's control-flow analysis narrows bare `let`
      // locals back to null after the await (closures assign them), an
      // object property keeps the declared union
      const found: {
        fsc: FscBody | null;
        res: { current: number | null; best: number | null; points: { iteration: number; resolution: number }[] } | null;
        ctf: { micrographs: CtfSnapshotMicrograph[]; summary: { count: number; meanDefocus: number; maxAstigmatism: number; meanFom: number; worstResolution: number } | null } | null;
        motion: { micrographs: MotionSnapshotMicrograph[]; summary: { count: number; meanTotal: number; maxTotal: number; worstName: string | null; meanEarly: number; meanLate: number } | null } | null;
        ang: AngDistSnapshot | null;
        topaz: { epochs: TopazSnapshotEpoch[]; source: string | null } | null;
      } = { fsc: null, res: null, ctf: null, motion: null, ang: null, topaz: null };
      await Promise.all([
        fetch(`/api/jobs/${job.id}/fsc`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((d: FscBody) => {
            if (d.resolutionAt143 != null || (d.shells ?? []).length > 0) found.fsc = d;
          })
          .catch(() => {}),
        fetch(`/api/jobs/${job.id}/resolution`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then(
            (d: {
              current?: number | null;
              best?: number | null;
              points?: { iteration: number; resolution: number }[];
            }) => {
              if (
                d.current != null ||
                d.best != null ||
                (d.points ?? []).length > 0
              )
                found.res = {
                  current: d.current ?? null,
                  best: d.best ?? null,
                  points: d.points ?? [],
                };
            }
          )
          .catch(() => {}),
        // CTF fit quality (CtfFind-style micrographs_ctf.star) + motion drift
        // (MotionCorr-style corrected_micrographs.star) + orientation
        // distribution (refine/class data star) — same honest-arrival
        // contract: an empty or failed fetch simply is not a section.
        fetch(`/api/jobs/${job.id}/motion`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then(
            (d: {
              micrographs?: MotionSnapshotMicrograph[];
              summary?: { count: number; meanTotal: number; maxTotal: number; worstName: string | null; meanEarly: number; meanLate: number } | null;
            }) => {
              if ((d.micrographs ?? []).length > 0)
                found.motion = { micrographs: d.micrographs!, summary: d.summary ?? null };
            }
          )
          .catch(() => {}),
        fetch(`/api/jobs/${job.id}/ctf`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then(
            (d: {
              micrographs?: CtfSnapshotMicrograph[];
              summary?: { count: number; meanDefocus: number; maxAstigmatism: number; meanFom: number; worstResolution: number } | null;
            }) => {
              if ((d.micrographs ?? []).length > 0)
                found.ctf = { micrographs: d.micrographs!, summary: d.summary ?? null };
            }
          )
          .catch(() => {}),
        fetch(`/api/jobs/${job.id}/angdist`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((d: AngDistSnapshot) => {
            if (d.total > 0 && (d.cells ?? []).length > 0) found.ang = d;
          })
          .catch(() => {}),
        // Topaz training progress — per-epoch loss curves from run.out / a
        // workdir training log. Cheap route (log tail only), so it rides
        // unconditionally in the parallel set: a non-topaz job answers an
        // empty epochs list and simply earns no section.
        fetch(`/api/jobs/${job.id}/topaz-training`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then(
            (d: { epochs?: TopazSnapshotEpoch[]; source?: string | null }) => {
              if ((d.epochs ?? []).length > 0)
                found.topaz = { epochs: d.epochs!, source: d.source ?? null };
            }
          )
          .catch(() => {}),
      ]);
      const fsc = found.fsc;

      // Resolution lines — each earns its place by arriving
      const resLines: string[] = [];
      if (fsc?.resolutionAt143 != null)
        resLines.push(`FSC 0.143 resolution: **${fsc.resolutionAt143.toFixed(2)} Å**`);
      if (fsc?.resolutionAt05 != null)
        resLines.push(`FSC 0.5 (half-bit) resolution: **${fsc.resolutionAt05.toFixed(2)} Å**`);
      if (fsc?.reportedResolution != null)
        resLines.push(
          `RELION reported: **${fsc.reportedResolution.toFixed(2)} Å**${
            fsc.reportedLabel ? ` — ${fsc.reportedLabel}` : ""
          }`
        );
      const nyq = fsc ? fscNyquist(fsc.shells) : null;
      if (nyq != null && Number.isFinite(nyq))
        resLines.push(`Box Nyquist limit (2 × pixel size): **${nyq.toFixed(2)} Å**`);
      const res = found.res;
      if (res && (res.current != null || res.best != null)) {
        const cur = res.current != null ? `${res.current.toFixed(2)} Å` : "—";
        const best = res.best != null ? `${res.best.toFixed(2)} Å` : "—";
        resLines.push(`Refinement resolution: current **${cur}**, best **${best}**`);
      }

      // Snapshot sections — each earns its place by arriving; a failed
      // rasterization degrades to the table alone, never a broken embed
      const snapshot = async (
        built: { svg: string; width: number; height: number } | null
      ): Promise<string | null> => {
        if (!built) return null;
        return await svgToPngDataUrl(built.svg, built.width, built.height);
      };

      // Resolution progress — the convergence story (per-iteration curve)
      let progressSection: string[] | null = null;
      if (res && res.points.length >= 2) {
        const table = resolutionTableMarkdown(res.points);
        const png = await snapshot(buildResolutionSvg({ title: job.name, points: res.points }));
        const block: string[] = ["## Resolution progress", ""];
        block.push("Per-iteration `_rlnCurrentResolution` (gold-standard half when available).", "");
        if (table) block.push(table, "");
        if (png) {
          const lastPt = res.points[res.points.length - 1];
          block.push(`![Resolution progress — ${lastPt.resolution.toFixed(2)} Å at iteration ${lastPt.iteration} for ${job.name}](${png})`, "");
        } else {
          block.push("_Curve snapshot unavailable in this browser — the table above is the full data._", "");
        }
        progressSection = block;
      }

      // FSC section — milestone table + curve snapshot, each optional
      let fscSection: string[] | null = null;
      if (fsc && fsc.shells.length > 0) {
        const rows = fscMilestones(fsc.shells);
        const table = fscTableMarkdown(rows, fsc.source);
        const src = fsc.sourceFile ? `\`Source: ${fsc.sourceFile}\`` : null;
        const png = await snapshot(
          buildFscSvg({
            title: job.name,
            source: fsc.source,
            sourceFile: fsc.sourceFile,
            shells: fsc.shells,
            resolutionAt143: fsc.resolutionAt143,
          })
        );
        const block: string[] = ["## FSC curve", ""];
        if (src) block.push(src, "");
        if (table) block.push(table, "");
        if (png) {
          block.push(`![FSC curve${fsc.resolutionAt143 != null ? ` — ${fsc.resolutionAt143.toFixed(2)} Å` : ""} for ${job.name}](${png})`, "");
        } else {
          block.push("_Curve snapshot unavailable in this browser — the table above is the full data._", "");
        }
        fscSection = block;
      }

      // Guinier plot — postprocess-only evidence for the applied B-factor
      let guinierSection: string[] | null = null;
      if (fsc?.source === "postprocess") {
        try {
          const g = await fetch(`/api/jobs/${job.id}/guinier`, { cache: "no-store" }).then((r) =>
            r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
          );
          const gPts: { x: number; lnAmp: number | null; lnAmpSharpened?: number | null }[] =
            g.points ?? [];
          if (gPts.length >= 4) {
            const block: string[] = ["## Guinier plot", ""];
            if (g.bfactor != null)
              block.push(`Applied B-factor: **${Number(g.bfactor).toFixed(1)} Å²**`, "");
            const table = guinierTableMarkdown(gPts);
            if (table) block.push(table, "");
            const png = await snapshot(
              buildGuinierSvg({ title: job.name, points: gPts, bfactor: g.bfactor ?? null })
            );
            if (png) {
              block.push(`![Guinier plot for ${job.name}](${png})`, "");
            } else {
              block.push("_Curve snapshot unavailable in this browser — the table above is the full data._", "");
            }
            guinierSection = block;
          }
        } catch {
          /* no guinier data — honest gap */
        }
      }

      // CTF fit quality — per-micrograph defocus/astigmatism/FOM evidence
      let ctfSection: string[] | null = null;
      const ctf = found.ctf;
      if (ctf && ctf.micrographs.length >= 3) {
        const block: string[] = ["## CTF fit quality", ""];
        const s = ctf.summary;
        if (s)
          block.push(
            `${s.count} micrographs — mean defocus **${s.meanDefocus.toFixed(2)} µm**, astigmatism ≤ **${s.maxAstigmatism.toFixed(2)} µm**${s.worstResolution > 0 ? `, worst fit **${s.worstResolution.toFixed(1)} Å**` : ""}${s.meanFom > 0 ? `, mean FOM **${s.meanFom.toFixed(3)}**` : ""}.`,
            ""
          );
        const table = ctfTableMarkdown(ctf.micrographs);
        if (table) block.push(table, "");
        const png = await snapshot(buildCtfScatterSvg({ title: job.name, micrographs: ctf.micrographs }));
        if (png) {
          block.push(`![CTF defocus scatter for ${job.name}](${png})`, "");
        } else {
          block.push("_Scatter snapshot unavailable in this browser — the table above is the full data._", "");
        }
        ctfSection = block;
      }

      // Motion drift — per-micrograph accumulated motion (MotionCorr)
      let motionSection: string[] | null = null;
      const motion = found.motion;
      if (motion && motion.micrographs.length >= 3) {
        const block: string[] = ["## Accumulated motion", ""];
        const s = motion.summary;
        if (s)
          block.push(
            `${s.count} micrographs — mean drift **${s.meanTotal.toFixed(1)} Å** (early ${s.meanEarly.toFixed(1)} / late ${s.meanLate.toFixed(1)})${s.worstName ? `, worst **${s.worstName}** at **${s.maxTotal.toFixed(1)} Å**` : ""}. Bars sort worst-first: teal = early frames (stage settling), amber = late frames (beam-induced).`,
            ""
          );
        const table = motionTableMarkdown(motion.micrographs);
        if (table) block.push(table, "");
        const png = await snapshot(buildMotionDriftSvg({ title: job.name, micrographs: motion.micrographs }));
        if (png) {
          block.push(`![Accumulated motion for ${job.name}](${png})`, "");
        } else {
          block.push("_Motion snapshot unavailable in this browser — the table above is the full data._", "");
        }
        motionSection = block;
      }

      // Angular distribution — orientation coverage from the final data star
      let angSection: string[] | null = null;
      const ang = found.ang;
      if (ang) {
        const block: string[] = ["## Angular distribution", ""];
        block.push(angdistSummaryMarkdown(ang), "");
        const png = await snapshot(buildAngdistHeatmapSvg({ ...ang, title: job.name }));
        if (png) {
          block.push(`![Orientation distribution heatmap for ${job.name}](${png})`, "");
        } else {
          block.push("_Heatmap snapshot unavailable in this browser — the summary table above is the full data._", "");
        }
        angSection = block;
      }

      // Topaz training — per-epoch convergence of the particle-picker model
      let topazSection: string[] | null = null;
      const topaz = found.topaz;
      if (topaz && topaz.epochs.length >= 2) {
        const block: string[] = ["## Topaz training", ""];
        if (topaz.source) block.push(`Source: \`${topaz.source}\``, "");
        const last = [...topaz.epochs].sort((a, b) => a.it - b.it).at(-1);
        const trainLast = last?.trainLoss;
        if (last && trainLast != null)
          block.push(
            `${topaz.epochs.length} epoch${topaz.epochs.length === 1 ? "" : "s"} — final train loss **${trainLast.toFixed(3)}**${last.testLoss != null ? `, test loss **${last.testLoss.toFixed(3)}**` : ""}. Lower is better; a widening train/test gap is the overfitting signature.`,
            ""
          );
        const table = topazTableMarkdown(topaz.epochs);
        if (table) block.push(table, "");
        const png = await snapshot(buildTopazSvg({ title: job.name, epochs: topaz.epochs }));
        if (png) {
          block.push(`![Topaz training loss curves for ${job.name}](${png})`, "");
        } else {
          block.push("_Curve snapshot unavailable in this browser — the table above is the full data._", "");
        }
        topazSection = block;
      }

      const fmtDur = (s: number) =>
        s >= 3600
          ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`
          : s >= 60
            ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
            : `${Math.round(s)}s`;
      const textCount = data?.files.filter((f) => f.kind === "text").length ?? 0;
      const slug =
        job.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "job";

      // Contents block — earns its place the same way sections do: a slim
      // report navigates fine by scrolling, a full QC dossier (8+ sections)
      // needs a jump list. Slugs are GitHub-style so the auto heading ids
      // and the explicit anchors below agree wherever both exist.
      const slugifyHeading = (h: string) =>
        h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const sections: { title: string; slug: string }[] = [
        { title: "Summary", slug: "summary" },
        { title: "Resolution", slug: "resolution" },
        ...(progressSection ? [{ title: "Resolution progress", slug: "resolution-progress" }] : []),
        ...(fscSection ? [{ title: "FSC curve", slug: "fsc-curve" }] : []),
        ...(guinierSection ? [{ title: "Guinier plot", slug: "guinier-plot" }] : []),
        ...(ctfSection ? [{ title: "CTF fit quality", slug: "ctf-fit-quality" }] : []),
        ...(motionSection ? [{ title: "Accumulated motion", slug: "accumulated-motion" }] : []),
        ...(angSection ? [{ title: "Angular distribution", slug: "angular-distribution" }] : []),
        ...(topazSection ? [{ title: "Topaz training", slug: "topaz-training" }] : []),
        { title: "Outputs on disk", slug: "outputs-on-disk" },
      ];
      const toc =
        sections.length >= 5
          ? [
              "**Contents**",
              "",
              ...sections.map((s, i) => `${i + 1}. [${s.title}](#${s.slug})`),
              "",
            ]
          : [];

      const mdLines = [
        `# CryoFlow run report — ${job.name}`,
        "",
        "| Field | Value |",
        "| --- | --- |",
        `| Job type | \`${job.type}\` |`,
        `| Status | ${job.status} |`,
        `| Engine | ${job.engine ?? "relion"} |`,
        `| Created | ${job.createdAt} |`,
        `| Started | ${job.startedAt ?? "—"} |`,
        `| Duration | ${job.duration > 0 ? fmtDur(job.duration) : "—"} |`,
        `| Workdir | \`${data?.workdir ?? "—"}\` |`,
        "",
        ...toc,
        "## Summary",
        "",
        job.result ?? "No summary line recorded.",
        "",
        // t330 — the key numbers and warnings from the on-screen listing
        // ride the report: a reader of the paper trail sees the particle
        // count and the amber warnings without opening the app.
        ...(data?.summary && data.summary.stats.length > 0
          ? [
              "**Key numbers**",
              "",
              ...data.summary.stats.map((s) => `- ${s.label}: **${s.value}**`),
              ...(data.summary.coverage?.note
                ? [`- ⚠ ${data.summary.coverage.note}`]
                : []),
              "",
            ]
          : []),
        ...(data?.warnings && data.warnings.length > 0
          ? [
              "**Run warnings**",
              "",
              ...data.warnings.map((w) => `- ⚠ \`${w}\``),
              "",
            ]
          : []),
        "## Resolution",
        "",
        resLines.length > 0 ? resLines.map((l) => `- ${l}`).join("\n") : "_No resolution data available for this job._",
        "",
        ...(progressSection ?? []),
        ...(fscSection ?? []),
        ...(guinierSection ?? []),
        ...(ctfSection ?? []),
        ...(motionSection ?? []),
        ...(angSection ?? []),
        ...(topazSection ?? []),
        "## Outputs on disk",
        "",
        `- ${mrcFiles.length} map/image file${mrcFiles.length === 1 ? "" : "s"}${mrcFiles[0] ? ` — latest: \`${mrcFiles[0].name}\`` : ""}`,
        `- ${starFiles.length} STAR table${starFiles.length === 1 ? "" : "s"}${starFiles[0] ? ` — latest: \`${starFiles[0].name}\`` : ""}`,
        `- ${textCount} text/log file${textCount === 1 ? "" : "s"}`,
        "",
        `_Generated by CryoFlow on ${new Date().toISOString()}_`,
        // navigation footer — a dossier that opens with a Contents ends with
        // the way back to it (only when the TOC exists; slim reports don't
        // manufacture navigation for three sections)
        ...(toc.length > 0 ? ["", "---", "", "[↑ Back to contents](#contents)"] : []),
        "",
      ];
      // anchor pass — every h2 gets an explicit invisible anchor so the
      // Contents links resolve even in renderers that don't slugify headings
      // (GitHub's sanitizer keeps both id and name on <a>; VS Code, Obsidian
      // and Typora honor id). Derived from the heading text itself, so anchor
      // and TOC can never drift apart.
      const md = mdLines
        .flatMap((line) => {
          // the Contents block is bold text, not an h2 — it still needs a
          // target so the footer's “Back to contents” link resolves
          if (line === "**Contents**") return [`<a id="contents" name="contents"></a>`, "", line];
          const h = /^## (.+)$/.exec(line);
          if (!h) return [line];
          const s = slugifyHeading(h[1]);
          return [`<a id="${s}" name="${s}"></a>`, "", line];
        })
        .join("\n");

      const chartBits = [
        fscSection ? "FSC table & curve snapshot" : null,
        progressSection ? "resolution progress chart" : null,
        guinierSection ? "Guinier plot" : null,
        ctfSection ? "CTF fit quality scatter" : null,
        angSection ? "orientation distribution map" : null,
        topazSection ? "Topaz training curves" : null,
      ].filter(Boolean) as string[];
      return { md, chartBits, slug };
    } catch {
      return null;
    }
  }, [job, data, mrcFiles, starFiles]);

  // t241: the run dossier's two doors share ONE builder — the md bytes
  // are the well, the two media are the mouths. The md door is the lab
  // notebook's paste source; the HTML door is the portable echo (the
  // same bytes dressed as a standalone document — t237's law for the
  // per-job family). One busy state guards both: while either medium is
  // being collected, both doors rest.
  const downloadBytes = (content: string, name: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportReport = useCallback(async () => {
    setReportBusy(true);
    try {
      const built = await buildRunReportMd();
      if (!built) throw new Error("collect failed");
      downloadBytes(
        built.md,
        // id suffix keeps same-named jobs' reports distinguishable in Downloads
        `cryoflow-report-${built.slug}-${job.id.slice(-6)}.md`,
        "text/markdown;charset=utf-8",
      );
      // toast names what the report actually carries — the FSC phrase stays
      // first so the long-standing assertion-friendly wording survives
      toast({
        title: "Run report downloaded",
        description:
          built.chartBits.length > 0
            ? `Markdown + ${built.chartBits.join(" + ")} — paste straight into lab notes or an issue.`
            : "Markdown — paste straight into lab notes or an issue.",
      });
    } catch {
      toast({ title: "Report export failed", variant: "destructive" });
    } finally {
      setReportBusy(false);
    }
  }, [buildRunReportMd, job]);

  const exportReportHtml = useCallback(async () => {
    setReportBusy(true);
    try {
      const built = await buildRunReportMd();
      if (!built) throw new Error("collect failed");
      downloadBytes(
        buildProfileReportHtml(built.md),
        `cryoflow-report-${built.slug}-${job.id.slice(-6)}.html`,
        "text/html;charset=utf-8",
      );
      toast({
        title: "Portable report downloaded",
        description:
          "Self-contained HTML — opens in any browser with its contents and figures, no app needed.",
      });
    } catch {
      toast({ title: "Report export failed", variant: "destructive" });
    } finally {
      setReportBusy(false);
    }
  }, [buildRunReportMd, job]);

  /* ---------------- render ---------------- */

  if (loading && !data) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }

  if (error) {
    const errorCard = (
      <div
        data-outputs-error={error.kind}
        className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs"
      >
        <div className="flex items-start gap-2 text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Could not load outputs</p>
            <p className="mt-0.5 leading-relaxed text-destructive/90">{error.friendly}</p>
            <p className="mt-1 font-mono text-[10px] text-destructive/70">{error.raw}</p>
            {error.kind !== "gone" && error.kind !== "network" && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                This listing reads the job's local workdir — the cluster connection is not involved.
              </p>
            )}
          </div>
        </div>
        <div className="mt-2 pl-5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            aria-busy={loading}
            className="h-7 gap-1.5 px-2 text-[11px]"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" />
            Retry
          </Button>
        </div>
      </div>
    );
    // t363 — a classification job's LIVE GALLERY outranks a failed OUTPUTS
    // listing: the gallery feeds from /iterations (its own wire, its own
    // honest error card), while the listing only enriches the tab below it.
    // A transient listing failure (dev-server restart, a busy poll) must
    // not hide the rounds the user is watching — the card stays, with the
    // listing's own Retry beneath.
    if (ITERATION_GALLERY_TYPES.has(job.type)) {
      return (
        <div className="space-y-4">
          <ClassIterationGallery job={job} refreshKey={refreshKey} />
          {errorCard}
        </div>
      );
    }
    return errorCard;
  }

  // t363 — see ITERATION_GALLERY_TYPES above: a classification run keeps
  // its Results tab alive (the gallery + an honest empty-note) instead of
  // the early "no on-disk outputs" panel
  if (!data || (data.files.length === 0 && !ITERATION_GALLERY_TYPES.has(job.type))) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-8 text-center">
        <FolderOpen className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground/80">No on-disk outputs</p>
        <p className="max-w-55 text-xs leading-relaxed text-muted-foreground">
          {data?.note ?? "This job produced no browsable files."}
        </p>
        {job.result && (
          <p className="mt-1 max-w-full truncate rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground" title={job.result}>
            {job.result}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Only RELION-engine jobs write maps, STAR tables and logs to disk.
        </p>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="mt-1 h-7 text-[11px]">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* t350 — class snapshots per iteration: live while a remote
          classification runs (cluster-side counts, rendered averages),
          a class picker once it finished (per-class stars → next job) */}
      <ClassIterationGallery job={job} refreshKey={refreshKey} />

      {/* t363 — an empty listing on a gallery type = the run is remote and
          the mirror has not landed yet (or the job wrote nothing browsable):
          say so instead of a bare "0 output files" header */}
      {data.files.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground/80">No on-disk outputs yet</p>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            {job.status === "running" || job.status === "pending"
              ? "The cluster is writing this run — class snapshots above update live; the full file listing lands here when the run finishes."
              : (data.note ?? "This job produced no browsable files.")}
          </p>
          {job.result && (
            <p
              className="max-w-full truncate rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground"
              title={job.result}
            >
              {job.result}
            </p>
          )}
        </div>
      )}

      {/* header row */}
      {data.files.length > 0 && (
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {data.files.length} output file{data.files.length === 1 ? "" : "s"}
          {data.note ? ` · ${data.note}` : ""}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void exportReport()}
            disabled={reportBusy}
            aria-busy={reportBusy}
            className="h-7 gap-1.5 px-2 text-[11px]"
            aria-label="Export run report"
            title="Download a Markdown summary of this run — metadata, resolution, FSC table & curve snapshot, outputs"
          >
            <FileDown className={cn("h-3.5 w-3.5", reportBusy && "animate-pulse motion-reduce:animate-none")} aria-hidden="true" />
            Report
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void exportReportHtml()}
            disabled={reportBusy}
            aria-busy={reportBusy}
            className="h-7 gap-1.5 px-2 text-[11px]"
            aria-label="Export run report as HTML"
            title="Download the same report as a self-contained HTML document — opens in any browser with contents and figures, no app needed"
          >
            <Globe className={cn("h-3.5 w-3.5", reportBusy && "animate-pulse motion-reduce:animate-none")} aria-hidden="true" />
            HTML
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            className="h-7 gap-1.5 px-2 text-[11px]"
            aria-label="Refresh outputs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>
      )}

      {/* t330 — the key numbers lead the Results view: particles above all
          (the user's "这个信息很关键"), micrographs coverage beside them, the
          amber completeness note when output didn't cover every micrograph. */}
      {data.summary && <KeyNumbersStrip summary={data.summary} />}

      {/* t330 — run.out warnings surfaced: the user saw "some warnings" in
          Extract and had to read raw logs to know what they were. */}
      {data.warnings && data.warnings.length > 0 && <WarningsCard warnings={data.warnings} />}

      {/* Import Map identity card — the map's own story (t256): size and
          spacing from the header, the density statistics the header
          records, and where this grid sits inside its parent when it's a
          sub-volume crop. The gallery below shows what the map LOOKS
          like; this card says what the map IS. t258 closes the loop the
          other way too: the card's "View in 3D" jumps straight into the
          Mol* viewer — no detour through the gallery tile → image dialog
          → "View in 3D" relay. t260 adds the door the story always
          implied: "show in parent" opens the PARENT's map with the clip
          planes anchored on the crop's own box. */}
      {job.type === "mapimport" && mrcFiles[0]?.map && mrcFiles[0]?.dims && (
        <MapIdentityCard job={job} file={mrcFiles[0]} onView3D={setMolTarget} />
      )}

      {/* FSC curve (live: half-map FSC while refining, masked FSC after postprocess) */}
      <FscChart jobId={job.id} running={job.status === "running"} projectId={job.projectId} />

      {/* Topaz training curve (t266): the Overview tab carries this chart
          too, but the smart default lands a COMPLETED job on Results — an
          Overview-only mount made the curve invisible exactly when it was
          finished and most worth reading. Dual-mount like the FSC chart;
          the component self-hides when the log has no epoch progress. */}
      <TopazTrainingChart jobId={job.id} running={job.status === "running"} />

      {/* Maps & images gallery */}
      {mrcFiles.length > 0 && (
        <section aria-label="Maps and images" data-canvas-ui="maps-gallery" tabIndex={-1} ref={molFocusRef} className="outline-none">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
            <Layers className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
            Maps &amp; images
            <span className="font-normal text-muted-foreground">({mrcFiles.length})</span>
          </h4>
          {mrcFiles.length > 9 ? (
            <div className="max-h-80 overflow-y-auto pr-1">
              <MrcGallery
                job={job}
                files={mrcFiles}
                onOpen={setImageFile}
                onFetched={() => void load()}
                onView3D={(f) => setMolTarget({ job, path: f.path, name: f.label ?? f.name })}
              />
            </div>
          ) : (
            <MrcGallery
              job={job}
              files={mrcFiles}
              onOpen={setImageFile}
              onFetched={() => void load()}
              onView3D={(f) => setMolTarget({ job, path: f.path, name: f.label ?? f.name })}
            />
          )}
        </section>
      )}

      {/* STAR tables */}
      {starFiles.length > 0 && (
        <section aria-label="STAR tables">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
            <Table2 className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
            STAR tables
            <span className="font-normal text-muted-foreground">({starFiles.length})</span>
          </h4>
          <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {starFiles.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => setStarFile(f)}
                  /* data-print-keep: the row IS document content on paper
                     (file name + row count + size) — the Task 114 glass
                     door hides raw controls, not wrapped records (Task 116) */
                  data-print-keep=""
                  className="flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors hover:border-violet-600/40 hover:bg-violet-600/5"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden="true" />
                  <span className="truncate font-mono text-[11px]">{f.label ?? f.name}</span>
                  {typeof f.rows === "number" && (
                    <span className="shrink-0 rounded-full border border-violet-600/25 bg-violet-600/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                      {f.rows.toLocaleString()} rows
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {formatBytes(f.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Logs & reports */}
      {logFiles.length > 0 && (
        <section aria-label="Logs and reports">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
            <ScrollText className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            Logs &amp; reports
            <span className="font-normal text-muted-foreground">({logFiles.length})</span>
          </h4>
          <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {logFiles.map((f) =>
              f.kind === "image" ? (
                <li key={f.path}>
                  <a
                    href={fileUrl(job.id, f, "&format=raw")}
                    download={f.name}
                    className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors hover:border-amber-600/40 hover:bg-amber-600/5"
                  >
                    <FileDown className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <span className="truncate">{f.label ?? f.name}</span>
                    <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatBytes(f.size)}
                    </span>
                  </a>
                </li>
              ) : (
                <li key={f.path}>
                  <button
                    type="button"
                    onClick={() => setTextFile(f)}
                    /* data-print-keep: same paper contract as the STAR rows
                       above — the wrapped name/size record must print */
                    data-print-keep=""
                    className="flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors hover:border-amber-600/40 hover:bg-amber-600/5"
                  >
                    <ScrollText className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <span className="truncate font-mono text-[11px]">{f.name}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {formatBytes(f.size)}
                    </span>
                  </button>
                </li>
              )
            )}
          </ul>
        </section>
      )}

      {/* workdir footer */}
      {data.workdir && (
        <footer className="flex items-center gap-1.5 border-t pt-3 text-[11px] text-muted-foreground">
          <span className="shrink-0 font-medium">workdir:</span>
          <span className="truncate font-mono" title={data.workdir}>
            {data.workdir}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void copyWorkdir()}
            className="h-6 w-6 shrink-0 p-0"
            aria-label="Copy workdir path"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3 w-3" aria-hidden="true" />
            )}
          </Button>
        </footer>
      )}

      {/* ---------------- dialogs ---------------- */}

      {/* map / stack dialog */}
      <Dialog open={imageFile !== null} onOpenChange={(o) => !o && setImageFile(null)}>
        <DialogContent
          className="max-h-[90dvh] max-w-2xl overflow-y-auto sm:max-w-2xl"
          onKeyDown={onEscapeClose(() => setImageFile(null))}
        >
          {imageFile && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <Layers className="h-4 w-4 text-teal-600" aria-hidden="true" />
                  {imageFile.label ?? imageFile.name}
                </DialogTitle>
                <DialogDescription className="font-mono text-[11px]">
                  {imageFile.path} · {formatBytes(imageFile.size)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {imageFile.name.toLowerCase().endsWith(".mrcs") ? (
                  <>
                    <MrcImage
                      src={
                        fileUrl(job.id, imageFile, "&format=png&montage=16") +
                        (montageWin && imgWindow ? `&lo=${imgWindow.lo}&hi=${imgWindow.hi}` : "")
                      }
                      alt={`${imageFile.name} montage`}
                      className="bg-zinc-950 p-2"
                    />
                    {/* t288 — the overview takes commands, but only by
                        name: sixteen images are sixteen distributions, so
                        the toggle (default OFF) is the explicit act of
                        commanding all of them with one window. With no
                        window set there is nothing to follow — the toggle
                        is disabled and says so. */}
                    <div
                      className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground"
                      data-canvas-ui="stack-montage-meta"
                      /* the hook reads the montage's ACTUAL behavior (is
                         it windowed right now?), not the toggle's intent:
                         aria-pressed owns the intent, disabled owns the
                         interactivity, this owns the deed */
                      data-montage-window={montageWin && imgWindow ? "on" : "off"}
                    >
                      <span>
                        Stack of {imageFile.slices ?? "?"} particle images — showing the first{" "}
                        {Math.min(16, imageFile.slices ?? 16)} ·{" "}
                        {montageWin && imgWindow ? "windowed" : "auto contrast"}
                      </span>
                      <button
                        type="button"
                        aria-pressed={montageWin}
                        disabled={!imgWindow}
                        data-canvas-ui="stack-montage-window"
                        onClick={() => setMontageWin((w) => !w)}
                        title={
                          !imgWindow
                            ? "Set a display window first (σ presets or the lo/hi fields below) — then the montage can follow it"
                            : montageWin
                              ? "The montage follows the display window — every cell renders lo → black, hi → white"
                              : "Command the montage with the display window — sixteen images are sixteen distributions; by default each cell speaks its own auto stretch"
                        }
                        className={
                          "rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors " +
                          (montageWin && imgWindow
                            ? "border-violet-700/60 bg-violet-950/30 text-violet-700 dark:border-violet-400/50 dark:bg-violet-950/40 dark:text-violet-300"
                            : "border-border/60 bg-background/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50")
                        }
                      >
                        follow window
                      </button>
                    </div>
                    {(
                      /* t287 — THE STACK SPEAKS: a slice cursor (prev/next +
                         a range slider) drives ONE slice view and the
                         histogram below — "is this particle even usable?"
                         is answered by THAT image's distribution, not the
                         stack-wide blur of thousands. Stepping the slice
                         resets the display window (a different image is a
                         different distribution — the old lo/hi pair would
                         be a stale command over new pixels). */
                      <>
                        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 shrink-0 p-0"
                            disabled={stackSlice <= 0}
                            aria-label="Previous particle image"
                            data-canvas-ui="stack-slice-prev"
                            onClick={() => setStackSlice((s) => Math.max(0, s - 1))}
                          >
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(0, (imageFile.slices ?? 1) - 1)}
                            value={stackSlice}
                            onChange={(e) => setStackSlice(Math.trunc(Number(e.target.value)) || 0)}
                            className="h-1.5 flex-1 accent-teal-600"
                            aria-label="Particle image index"
                            data-canvas-ui="stack-slice-range"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 shrink-0 p-0"
                            disabled={stackSlice >= (imageFile.slices ?? 1) - 1}
                            aria-label="Next particle image"
                            data-canvas-ui="stack-slice-next"
                            onClick={() =>
                              setStackSlice((s) => Math.min((imageFile.slices ?? 1) - 1, s + 1))
                            }
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <span
                            className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
                            data-canvas-ui="stack-slice-readout"
                          >
                            slice {stackSlice + 1} of {imageFile.slices ?? "?"}
                          </span>
                        </div>
                        <MrcImage
                          src={
                            fileUrl(
                              job.id,
                              imageFile,
                              `&format=png&montage=0&scale=large&slice=${stackSlice}`
                            ) + (imgWindow ? `&lo=${imgWindow.lo}&hi=${imgWindow.hi}` : "")
                          }
                          alt={`${imageFile.name} particle image ${stackSlice + 1}`}
                          className="bg-zinc-950 p-2"
                        />
                        <p className="text-center text-[11px] text-muted-foreground">
                          Particle image {stackSlice + 1} · {(imageFile.slices ?? 1)} in the stack
                          {imgWindow ? " · windowed" : " · auto contrast"}
                        </p>
                        <QuickHistSection key={imageFile.path}
                          jobId={job.id}
                          path={imageFile.path}
                          slice={stackSlice}
                          window={imgWindow}
                          onWindowChange={setImgWindow}
                        />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <MrcImage
                      src={
                        fileUrl(job.id, imageFile, "&format=png&scale=large") +
                        (imgWindow
                          ? `&lo=${imgWindow.lo}&hi=${imgWindow.hi}`
                          : "")
                      }
                      alt={`${imageFile.name} central slice`}
                      className="bg-zinc-950 p-2"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        Central slice (z={Math.floor((imageFile.slices ?? 1) / 2)} of{" "}
                        {imageFile.slices ?? 1}) · {(imageFile.slices ?? 1) > 1
                          ? `${imageFile.slices} sections`
                          : "single section"}
                      </p>
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
                        onClick={() => {
                          setMolTarget({ job, path: imageFile.path, name: imageFile.label ?? imageFile.name });
                          setImageFile(null);
                        }}
                      >
                        <Box className="h-3.5 w-3.5" aria-hidden="true" />
                        View in 3D (Mol*)
                      </Button>
                    </div>
                    {/* t284 — the quick look speaks distributions: the SAME
                        histogram instrument the ortho panel carries, here
                        read-only (a dialog has no contour context to cut).
                        Default OFF — the first look walks the whole file on
                        the server; the toggle makes that an explicit ask and
                        the (path, mtime, size) cache makes the rest free.
                        key={path} resets the toggle when another file opens.
                        t286 — the same strip now also COMMANDS the display:
                        the σ presets / draggable handles lift their window
                        into imgWindow, and the <MrcImage> above re-renders
                        with &lo=&hi= (one state, two consumers). */}
                    <QuickHistSection key={imageFile.path}
                      jobId={job.id}
                      path={imageFile.path}
                      window={imgWindow}
                      onWindowChange={setImgWindow}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* STAR table dialog */}
      <Dialog open={starFile !== null} onOpenChange={(o) => !o && setStarFile(null)}>
        <DialogContent
          className="max-w-4xl sm:max-w-4xl"
          onKeyDown={onEscapeClose(() => setStarFile(null))}
        >
          {starFile && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <Table2 className="h-4 w-4 text-violet-600" aria-hidden="true" />
                  {starFile.label ?? starFile.name}
                </DialogTitle>
                <DialogDescription className="font-mono text-[11px]">{starFile.path}</DialogDescription>
              </DialogHeader>
              <StarTable job={job} path={starFile.path} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* text preview dialog */}
      <Dialog open={textFile !== null} onOpenChange={(o) => !o && setTextFile(null)}>
        <DialogContent
          className="max-w-3xl sm:max-w-3xl"
          onKeyDown={onEscapeClose(() => setTextFile(null))}
        >
          {textFile && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <ScrollText className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  {textFile.name}
                </DialogTitle>
                <DialogDescription className="font-mono text-[11px]">
                  {textFile.path} · last 64 KB
                </DialogDescription>
              </DialogHeader>
              <TextPreview jobId={job.id} path={textFile.path} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Mol* 3D viewer dialog — opens on whatever target the doors aim
          it at (this job's files, or the parent map through the card) */}
      <MolViewer
        job={molTarget?.job ?? job}
        path={molTarget?.path ?? ""}
        name={molTarget?.name ?? ""}
        open={molTarget !== null}
        onOpenChange={(o) => !o && setMolTarget(null)}
        restoreFocusRef={molFocusRef}
        initialClipBox={molTarget?.box ?? null}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Import Map identity card                                            */
/* ------------------------------------------------------------------ */

/**
 * The Import Map job's identity card (t256). Everything on it is read
 * from the map's own header (the outputs route mirrors MrcHeader — no
 * extra I/O) plus the mapPath parameter the job was configured with:
 *
 *  - the grid size and voxel spacing (dims + cella/nz),
 *  - the density statistics the header records (min/max/mean/σ),
 *  - the sub-volume anchor (start fields) — non-zero means this map was
 *    CUT from a parent (readMrcSubvolume writes parent start + box
 *    offset), and the crop's SubVolumes path names that parent,
 *  - or the honest "standalone" note when the map came from Browse.
 *
 * The Maps gallery answers "what does it look like"; this card answers
 * "what is it, and where did it come from" — the box-subregion chain
 * (crop → import → focused refinement) reads legibly on the card alone.
 */
function MapIdentityCard({
  job,
  file,
  onView3D,
}: {
  job: JobDTO;
  file: OutputFile;
  /** t258/t260 — opens the results-view's SHARED Mol* dialog on a target.
   *  The dialog instance lives at the results-view level (the gallery's
   *  "View in 3D" uses the same one); the card just aims it — at its own
   *  map, or (t260) at the PARENT's map with the clip planes anchored on
   *  this crop's box. */
  onView3D?: (t: MolViewerTarget) => void;
}) {
  const map = file.map;
  const dims = file.dims;
  const mapPath = String(job.params?.mapPath ?? "");
  const source = map && mapPath ? mapSourceNote(mapPath) : null;
  const anchored = map ? !map.origin.every((v) => v === 0) : false;

  // t260 — resolve the parent while the card reads as a crop: the graph
  // edges into this job name the candidates, the geometric check (parent
  // grid holds origin+dims) picks the map. Hooks order: the resolver runs
  // BEFORE any early return, silent (null job id) when the crop story
  // isn't there — the door appears only when the story is verifiable.
  const anchorBox =
    map && dims && anchored && source?.kind === "crop"
      ? { start: [...map.origin] as [number, number, number], size: [...dims] as [number, number, number] }
      : null;
  const parent = useAnchorParent(anchorBox ? job.id : null, anchorBox);

  if (!map || !dims) return null;

  return (
    <section
      aria-label="Imported map"
      data-canvas-ui="map-identity"
      className="rounded-lg border border-teal-600/30 bg-teal-600/[0.04] p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
          <Box className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden="true" />
          Imported map
        </h4>
        <span className="truncate font-mono text-[11px] text-muted-foreground" title={file.name}>
          {file.name}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-teal-600/25 bg-teal-600/10 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300">
          {dims.join(" × ")} vox
        </span>
        {map.pixel > 0 && (
          <span className="rounded-full border border-teal-600/25 bg-teal-600/10 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300">
            {map.pixel.toFixed(2)} Å / voxel
          </span>
        )}
        <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
          min {formatStat(map.dmin)}
        </span>
        <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
          max {formatStat(map.dmax)}
        </span>
        <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
          mean {formatStat(map.dmean)}
        </span>
        {map.rms > 0 && (
          <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            σ {formatStat(map.rms)}
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {anchored && source?.kind === "crop" ? (
          <>
            Sub-volume anchor at{" "}
            <span className="font-mono text-foreground/80">({map.origin.join(", ")})</span> voxels
            in the parent map — crop of{" "}
            <span className="font-mono text-foreground/80" title={mapPath}>
              {source.label}
            </span>
            , sent from the 3D viewer.
          </>
        ) : !anchored && source?.kind === "crop" ? (
          <>
            Crop of{" "}
            <span className="font-mono text-foreground/80" title={mapPath}>
              {source.label}
            </span>{" "}
            — anchored at the parent&apos;s origin.
          </>
        ) : (
          <>Standalone map — picked from the file browser, no parent offset.</>
        )}
      </p>

      {/* t258/t260 — the identity card's doors into the 3D viewer: "View
          in 3D" opens the crop itself (shared dialog, gallery park);
          "Show in parent" opens the PARENT's map with the clip planes
          anchored on this crop's box — the card's story, finally walked
          backwards to its origin. Outline styling (not the gallery tile's
          solid teal) — these are secondary actions INSIDE a card, one
          nesting level down; violet speaks the clip's own colour. */}
      {(onView3D || parent) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {onView3D && (
            <Button
              size="sm"
              variant="outline"
              data-testid="map-card-view-3d"
              className="h-7 gap-1.5 border-teal-600/40 px-2.5 text-[11px] text-teal-700 hover:bg-teal-600/10 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200"
              onClick={() => onView3D({ job, path: file.path, name: file.name })}
            >
              <Box className="h-3.5 w-3.5" aria-hidden="true" />
              View in 3D
            </Button>
          )}
          {onView3D && parent && (
            <Button
              size="sm"
              variant="outline"
              data-testid="map-card-show-parent"
              className="h-7 gap-1.5 border-violet-600/40 px-2.5 text-[11px] text-violet-700 hover:bg-violet-600/10 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200"
              onClick={() =>
                onView3D({
                  job: parent.job,
                  path: parent.file.path,
                  name: parent.file.name,
                  box: anchorBox,
                })
              }
            >
              <Crop className="h-3.5 w-3.5" aria-hidden="true" />
              Show in parent
            </Button>
          )}
          <span className="text-[10px] text-muted-foreground">
            {onView3D && parent
              ? "open the parent map, clipped to this crop's box"
              : parent
                ? "the parent map is one click away"
                : "open this map in the Mol* viewer"}
          </span>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery                                                             */
/* ------------------------------------------------------------------ */

/** run_it025_… → 25; final artifacts (no it-prefix) → null. */
function iterOfName(name: string): number | null {
  const m = name.match(/^run_it(\d+)_/i);
  return m ? Number(m[1]) : null;
}

type IterFilter = "final" | "all" | number;

/** occupancy of one round of a classification run (from /classes API) */
interface ClassOcc {
  cls: number;
  count: number;
  fraction: number;
}

/**
 * Per-class occupancy strip under a classes.mrcs gallery tile.
 * The montage renders slices in class order (class001 → N), so each bar
 * pairs with the tile above it; hover shows count + share.
 */
function ClassOccupancyStrip({ occ }: { occ: ClassOcc[] }) {
  const max = Math.max(...occ.map((c) => c.fraction), 0.01);
  return (
    <div className="mt-1 flex items-end gap-[3px]" aria-label="Per-class particle occupancy">
      {occ.map((c) => (
        <span
          key={c.cls}
          className="group/bar relative flex-1"
          title={`Class ${c.cls}: ${c.count.toLocaleString()} particles (${(c.fraction * 100).toFixed(1)}%)`}
        >
          <span
            className={cn(
              "block w-full rounded-[2px] bg-teal-500/60 transition-colors group-hover/bar:bg-teal-500",
              c.fraction === max && "bg-emerald-500/70 group-hover/bar:bg-emerald-500"
            )}
            style={{ height: `${4 + Math.round((c.fraction / max) * 14)}px` }}
            aria-hidden="true"
          />
          <span className="sr-only">
            Class {c.cls}: {c.count} particles
          </span>
        </span>
      ))}
    </div>
  );
}

function MrcGallery({
  job,
  files,
  onOpen,
  onFetched,
  onView3D,
}: {
  job: JobDTO;
  files: OutputFile[];
  onOpen: (file: OutputFile) => void;
  /** t289 — a remote file finished fetching over SSH: the listing refreshes
   *  so the tile graduates to a fully local one. */
  onFetched: () => void;
  /** t289 — the remote tile's 3D door (Mol* fetches the raw bytes over
   *  SSH through the same lazy route). */
  onView3D: (file: OutputFile) => void;
}) {
  // iterations present on disk, newest first
  const iters = useMemo(() => {
    const set = new Set<number>();
    for (const f of files) {
      const it = iterOfName(f.name);
      if (it != null) set.add(it);
    }
    return [...set].sort((a, b) => b - a);
  }, [files]);
  const maxIter = iters.length > 0 ? iters[0] : -1;

  // default: final round only (+ non-iteration final artifacts)
  const [filter, setFilter] = useState<IterFilter>("final");

  const shown = useMemo(() => {
    if (filter === "all") return files;
    if (filter === "final") {
      // newest iteration + final artifacts without an iteration prefix
      return files.filter((f) => {
        const it = iterOfName(f.name);
        return it == null || it === maxIter;
      });
    }
    return files.filter((f) => iterOfName(f.name) === filter);
  }, [files, filter, maxIter]);

  // class occupancy for classification jobs — the strip follows the
  // displayed round (?iter= selects it; "all" pins to the final round)
  const isClassify = /class2d|class3d/i.test(job.type);
  const occIter = filter === "all" || filter === "final" ? maxIter : filter;
  const [occByIter, setOccByIter] = useState<Record<number, ClassOcc[]>>({});
  useEffect(() => {
    if (!isClassify || occIter == null || occIter < 0) return;
    if (occByIter[occIter]) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}/classes?iter=${occIter}`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { classes: ClassOcc[] };
        if (!cancelled && body.classes?.length) {
          setOccByIter((prev) => ({ ...prev, [occIter]: body.classes }));
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isClassify, occIter, job.id, occByIter]);

  return (
    <div>
      {/* iteration filter chips */}
      {iters.length > 1 || (iters.length === 1 && files.length > iters.length) ? (
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Round
          </span>
          <button
            type="button"
            aria-pressed={filter === "final"}
            onClick={() => setFilter("final")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors",
              filter === "final"
                ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-teal-600/40 hover:text-foreground"
            )}
          >
            final{maxIter >= 0 ? ` · it${String(maxIter).padStart(3, "0")}` : ""}
          </button>
          {iters.map((it) => (
            <button
              key={it}
              type="button"
              aria-pressed={filter === it}
              onClick={() => setFilter(it)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums transition-colors",
                filter === it
                  ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:border-teal-600/40 hover:text-foreground"
              )}
            >
              it{String(it).padStart(3, "0")}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              filter === "all"
                ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-teal-600/40 hover:text-foreground"
            )}
          >
            all {files.length}
          </button>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {shown.length} of {files.length} shown
          </span>
        </div>
      ) : null}

      {/* compact thumbnail grid — click any tile to enlarge */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((f) => {
          const it = iterOfName(f.name);
          const isFinal = it != null && it === maxIter;
          // t289 — cluster-resident files never auto-load: the fetch is the
          // user's explicit click, never a render side effect
          if (f.remote) {
            return (
              <RemoteFileTile
                key={f.path}
                job={job}
                file={f}
                onFetched={onFetched}
                onView3D={onView3D}
              />
            );
          }
          return (
            <button
              key={f.path}
              type="button"
              onClick={() => onOpen(f)}
              /* data-print-block: the tile is a stacked visual record
                 (image + name + meta) — it prints as a block, not a flex
                 row, and never splits across a page (Task 116) */
              data-print-block=""
              className="group relative rounded-lg border p-1.5 text-left transition-all hover:border-teal-600/50 hover:shadow-sm"
              aria-label={`Enlarge ${f.label ?? f.name}`}
              title={`Click to enlarge — ${f.label ?? f.name}`}
            >
              {isFinal && (
                <span className="absolute right-2 top-2 z-10 rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                  final
                </span>
              )}
              <div className="relative">
                {/* hover zoom affordance over the image itself */}
                <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-zinc-950/80 text-white opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100">
                  <ZoomIn className="size-3.5" aria-hidden="true" />
                </span>
                <MrcImage
                  src={
                    f.name.toLowerCase().endsWith(".mrcs")
                      ? fileUrl(job.id, f, "&format=png&montage=16")
                      : fileUrl(job.id, f, "&format=png")
                  }
                  alt={f.label ?? f.name}
                  className="aspect-square"
                />
              </div>
              <p className="mt-1 truncate text-[10px] font-medium text-foreground/85" title={f.label ?? f.name}>
                {f.label ?? f.name}
              </p>
              <p className="truncate text-[9px] text-muted-foreground">
                {f.name.toLowerCase().endsWith(".mrcs")
                  ? `${f.slices ?? "?"} imgs · ${formatBytes(f.size)}`
                  : `${f.slices ?? 1}³ · ${formatBytes(f.size)}`}
              </p>
              {/* class-average stacks get the per-class occupancy strip
                  (bars pair with the montage tiles above, class order) */}
              {isClassify && it != null && it === occIter && occByIter[it] ? (
                <ClassOccupancyStrip occ={occByIter[it]} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* t289 — cluster-resident file tile                                    */
/* ------------------------------------------------------------------ */

/**
 * A map/stack that finalize LEFT ON THE CLUSTER (key-files policy). It
 * never auto-loads — a render must not cost an SSH transfer — every door
 * is an explicit click:
 *   Fetch & preview  mounts MrcImage; the png request lazy-fetches the
 *                    file over SSH server-side, then renders; onLoaded
 *                    refreshes the listing so the tile graduates to a
 *                    fully local one.
 *   ⤓ Download       the raw route streams the fetched bytes to disk.
 *   Mol* 3D          opens the shared viewer; Mol* pulls the raw bytes
 *                    through the same lazy route — "preview the file ON
 *                    the cluster" in one click, cached forever after.
 */
function RemoteFileTile({
  job,
  file,
  onFetched,
  onView3D,
}: {
  job: JobDTO;
  file: OutputFile;
  onFetched: () => void;
  onView3D: (file: OutputFile) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const isStack = file.name.toLowerCase().endsWith(".mrcs");
  const src = fileUrl(job.id, file, isStack ? "&format=png&montage=16" : "&format=png");
  return (
    <div
      className="group relative flex flex-col rounded-lg border border-dashed p-1.5 transition-colors hover:border-teal-600/50"
      data-remote-file=""
      data-remote-path={file.path}
    >
      <span className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border border-teal-600/40 bg-background/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-700 shadow-sm dark:text-teal-300">
        <Cloud className="size-2.5" aria-hidden="true" />
        on cluster
      </span>
      <div className="relative">
        {fetching ? (
          <MrcImage
            src={src}
            alt={`${file.label ?? file.name} (fetched from the cluster)`}
            className="aspect-square"
            onLoaded={onFetched}
          />
        ) : (
          <button
            type="button"
            onClick={() => setFetching(true)}
            className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border border-border/50 bg-muted/40 text-muted-foreground transition-colors hover:border-teal-600/40 hover:text-foreground"
            aria-label={`Fetch ${file.label ?? file.name} from the cluster and preview it`}
            title={`Fetch & preview — pulls ${formatBytes(file.size)} from the cluster over SSH, then renders it (stays on this machine afterwards)`}
            data-canvas-ui="remote-fetch-preview"
          >
            <CloudDownload className="size-5" aria-hidden="true" />
            <span className="text-[10px] font-semibold tabular-nums">{formatBytes(file.size)}</span>
            <span className="px-1.5 text-center text-[9px] leading-tight text-muted-foreground/80">
              not synced — click to fetch over SSH
            </span>
          </button>
        )}
      </div>
      <p className="mt-1 truncate text-[10px] font-medium text-foreground/85" title={file.label ?? file.name}>
        {file.label ?? file.name}
      </p>
      <div className="mt-0.5 flex items-center gap-1">
        {fetching ? (
          <span className="flex flex-1 items-center gap-1 text-[9px] text-muted-foreground" role="status">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            fetching over SSH…
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-6 flex-1 gap-1 px-1 text-[10px]"
            onClick={() => setFetching(true)}
            data-canvas-ui="remote-fetch-btn"
          >
            <CloudDownload className="size-3" aria-hidden="true" />
            Fetch &amp; preview
          </Button>
        )}
        {!isStack ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-teal-600"
            onClick={() => onView3D(file)}
            aria-label={`View ${file.label ?? file.name} in 3D (Mol*)`}
            title="View in 3D — Mol* pulls this map from the cluster over SSH"
            data-canvas-ui="remote-view-3d"
          >
            <Box className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
        <a
          href={fileUrl(job.id, file, "&format=raw")}
          download={file.name}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Download ${file.label ?? file.name} from the cluster`}
          title="Download — pulls the file from the cluster, then saves it"
          data-canvas-ui="remote-download"
        >
          <FileDown className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* t330 — key numbers strip + run warnings card                        */
/* ------------------------------------------------------------------ */

/** tone → value color: particles get the teal the maps speak, classes the
 *  violet of STAR tables, incomplete coverage the amber of warnings */
const STAT_TONE_CLASS: Record<string, string> = {
  particle: "text-teal-600 dark:text-teal-300",
  micrograph: "text-foreground",
  class: "text-violet-600 dark:text-violet-300",
  warn: "text-amber-600 dark:text-amber-300",
};

/**
 * t347 — exported: the inspector's Overview tab now leads with the same
 * key-numbers strip the Results view opens with (one grammar, both
 * surfaces — the user's 「颗粒数需要显示得醒目些，不仅在任务窗口中」).
 */
export function KeyNumbersStrip({ summary }: { summary: OutputSummary }) {
  if (summary.stats.length === 0) return null;
  return (
    <section
      aria-label="Key numbers"
      data-key-numbers=""
      data-print-keep=""
      className="flex flex-wrap gap-2"
    >
      {summary.stats.map((s: SummaryStat) => (
        <div
          key={s.key}
          data-stat={s.key}
          className="min-w-28 flex-1 rounded-lg border bg-card px-3 py-2.5"
          title={s.hint}
        >
          <p
            className={cn(
              "text-xl font-bold leading-tight tabular-nums",
              STAT_TONE_CLASS[s.tone ?? "micrograph"]
            )}
          >
            {s.value}
          </p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {s.label}
          </p>
        </div>
      ))}
      {summary.coverage?.note && (
        <p
          data-coverage-note=""
          className="flex w-full items-start gap-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300"
        >
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {summary.coverage.note}
        </p>
      )}
    </section>
  );
}

function WarningsCard({ warnings }: { warnings: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section
      aria-label="Run warnings"
      data-warnings-card=""
      data-print-keep=""
      className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <span className="font-medium text-amber-700 dark:text-amber-300">
          {warnings.length} warning{warnings.length === 1 ? "" : "s"} in run.out
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
          {warnings.map((w, i) => (
            <li
              key={i}
              className="break-words rounded bg-amber-500/10 px-2 py-1 font-mono text-[10px] leading-relaxed text-amber-800 dark:text-amber-200"
            >
              {w}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Text preview                                                        */
/* ------------------------------------------------------------------ */

function TextPreview({ jobId, path }: { jobId: string; path: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=text`
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        if (!cancelled) setText(await res.text());
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load file");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, path]);

  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error}
      </p>
    );
  }
  if (text === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading file…
      </div>
    );
  }
  return (
    <pre
      className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/90"
      aria-label="File content preview"
    >
      {text}
    </pre>
  );
}
