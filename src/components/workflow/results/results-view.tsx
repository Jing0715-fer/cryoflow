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
import {
  AlertTriangle,
  Box,
  Check,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  FolderOpen,
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
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { buildFscSvg, fscMilestones, fscNyquist, fscTableMarkdown } from "@/lib/fsc-snapshot";
import {
  angdistSummaryMarkdown,
  buildAngdistHeatmapSvg,
  buildCtfScatterSvg,
  buildGuinierSvg,
  buildResolutionSvg,
  ctfTableMarkdown,
  guinierTableMarkdown,
  resolutionTableMarkdown,
  svgToPngDataUrl,
  buildTopazSvg,
  topazTableMarkdown,
  type AngDistSnapshot,
  type CtfSnapshotMicrograph,
  type TopazSnapshotEpoch,
} from "@/lib/report-snapshots";
import type { JobDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FscChart } from "./fsc-chart";
import { MrcImage } from "./mrc-image";
import { MolViewer } from "./mol-viewer";
import { StarTable } from "./star-table";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type OutputKind = "mrc" | "star" | "text" | "image";

interface OutputFile {
  path: string;
  name: string;
  kind: OutputKind;
  size: number;
  slices?: number;
  label?: string;
  rows?: number;
}

interface OutputsResponse {
  workdir: string | null;
  engine: "relion";
  files: OutputFile[];
  note?: string;
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

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function JobResults({ job, refreshKey = 0 }: { job: JobDTO; refreshKey?: number }) {
  const [data, setData] = useState<OutputsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<OutputFile | null>(null);
  const [starFile, setStarFile] = useState<OutputFile | null>(null);
  const [textFile, setTextFile] = useState<OutputFile | null>(null);
  const [molFile, setMolFile] = useState<OutputFile | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/outputs`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as OutputsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load outputs");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [job.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // external refresh signal (inspector's live polling while the job runs)
  const firstKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== firstKey.current) void load();
  }, [refreshKey, load]);

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
  const exportReport = useCallback(async () => {
    setReportBusy(true);
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
        ang: AngDistSnapshot | null;
        topaz: { epochs: TopazSnapshotEpoch[]; source: string | null } | null;
      } = { fsc: null, res: null, ctf: null, ang: null, topaz: null };
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
        // CTF fit quality (CtfFind-style micrographs_ctf.star) + orientation
        // distribution (refine/class data star) — same honest-arrival
        // contract: an empty or failed fetch simply is not a section.
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
        "## Resolution",
        "",
        resLines.length > 0 ? resLines.map((l) => `- ${l}`).join("\n") : "_No resolution data available for this job._",
        "",
        ...(progressSection ?? []),
        ...(fscSection ?? []),
        ...(guinierSection ?? []),
        ...(ctfSection ?? []),
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

      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // id suffix keeps same-named jobs' reports distinguishable in Downloads
      a.download = `cryoflow-report-${slug}-${job.id.slice(-6)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      // toast names what the report actually carries — the FSC phrase stays
      // first so the long-standing assertion-friendly wording survives
      const chartBits = [
        fscSection ? "FSC table & curve snapshot" : null,
        progressSection ? "resolution progress chart" : null,
        guinierSection ? "Guinier plot" : null,
        ctfSection ? "CTF fit quality scatter" : null,
        angSection ? "orientation distribution map" : null,
        topazSection ? "Topaz training curves" : null,
      ].filter(Boolean) as string[];
      toast({
        title: "Run report downloaded",
        description:
          chartBits.length > 0
            ? `Markdown + ${chartBits.join(" + ")} — paste straight into lab notes or an issue.`
            : "Markdown — paste straight into lab notes or an issue.",
      });
    } catch {
      toast({ title: "Report export failed", variant: "destructive" });
    } finally {
      setReportBusy(false);
    }
  }, [job, data, mrcFiles, starFiles]);

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
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">Could not load outputs</p>
          <p className="text-destructive/80">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.files.length === 0) {
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
      {/* header row */}
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
            onClick={() => void load()}
            className="h-7 gap-1.5 px-2 text-[11px]"
            aria-label="Refresh outputs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {/* FSC curve (live: half-map FSC while refining, masked FSC after postprocess) */}
      <FscChart jobId={job.id} running={job.status === "running"} />

      {/* Maps & images gallery */}
      {mrcFiles.length > 0 && (
        <section aria-label="Maps and images">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
            <Layers className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
            Maps &amp; images
            <span className="font-normal text-muted-foreground">({mrcFiles.length})</span>
          </h4>
          {mrcFiles.length > 9 ? (
            <div className="max-h-80 overflow-y-auto pr-1">
              <MrcGallery job={job} files={mrcFiles} onOpen={setImageFile} />
            </div>
          ) : (
            <MrcGallery job={job} files={mrcFiles} onOpen={setImageFile} />
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
        <DialogContent className="max-w-2xl sm:max-w-2xl">
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
                      src={fileUrl(job.id, imageFile, "&format=png&montage=16")}
                      alt={`${imageFile.name} montage`}
                      className="bg-zinc-950 p-2"
                    />
                    <p className="text-center text-[11px] text-muted-foreground">
                      Stack of {imageFile.slices ?? "?"} particle images — showing the first{" "}
                      {Math.min(16, imageFile.slices ?? 16)}
                    </p>
                  </>
                ) : (
                  <>
                    <MrcImage
                      src={fileUrl(job.id, imageFile, "&format=png&scale=large")}
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
                          setMolFile(imageFile);
                          setImageFile(null);
                        }}
                      >
                        <Box className="h-3.5 w-3.5" aria-hidden="true" />
                        View in 3D (Mol*)
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* STAR table dialog */}
      <Dialog open={starFile !== null} onOpenChange={(o) => !o && setStarFile(null)}>
        <DialogContent className="max-w-4xl sm:max-w-4xl">
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
        <DialogContent className="max-w-3xl sm:max-w-3xl">
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

      {/* Mol* 3D viewer dialog */}
      <MolViewer
        job={job}
        path={molFile?.path ?? ""}
        name={molFile?.label ?? molFile?.name ?? ""}
        open={molFile !== null}
        onOpenChange={(o) => !o && setMolFile(null)}
      />
    </div>
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
}: {
  job: JobDTO;
  files: OutputFile[];
  onOpen: (file: OutputFile) => void;
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
          return (
            <button
              key={f.path}
              type="button"
              onClick={() => onOpen(f)}
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
