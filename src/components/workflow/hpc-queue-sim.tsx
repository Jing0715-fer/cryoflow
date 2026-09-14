"use client";

/**
 * CryoFlow — HPC queue simulation panel (the /api/hpc/simulate UI consumer).
 *
 * The simulate route replays the ACTIVE project's real job graph through a
 * Slurm-shaped scheduler (priority-FIFO + afterok dependency edges + GPU
 * pool first-fit + array shards) using REAL measured sandbox durations
 * scaled by the profile's GPU speedup. This panel is its face: a compact
 * run form (cluster shape + GPU speedup), a KPI band (makespan, GPU
 * utilization, average wait, GPU-hours) and a Gantt of the schedule.
 *
 * Contract notes carried over from sibling panels:
 * - "Server view shown": numeric inputs are re-synced from the RESPONSE
 *   after every run (the server clamps to its contract ranges — what the
 *   UI displays is what the server kept, never what was sent). A subtle
 *   footnote flags when a clamp happened.
 * - "One job, one row": array shards land as multiple segments on the
 *   job's row (they share one slurmId family), so the Gantt reads like
 *   sacct --start output rather than a shard dump.
 * - Durations are project-wide and live: extracted micrograph/particle
 *   counts and measured run durations from engine-state feed the model.
 * - "Compare profiles" (t187): the sweep answers "same graph, different
 *   hardware class" — every GPU profile is simulated with ITS OWN
 *   declared shape (nodes × GPUs/node = the pool, its own array
 *   throttle, its own speed multiplier), never the form's numbers. The
 *   fastest profile wears the crown; clicking a row ADOPTS its shape
 *   into the form and re-runs the single Gantt (compare → adopt →
 *   inspect, one loop).
 * - "Sweep export" (t188): the comparison table leaves the dialog —
 *   Copy CSV puts the race on the clipboard, Download CSV saves it as
 *   hpc-sweep-<stamp>.csv (and is the fallback when the clipboard is
 *   denied). ONE builder feeds BOTH paths and the data-csv observation
 *   attribute — the exported bytes are never a second derivation. The
 *   CSV is machine-readable (raw minutes, not "1h 03m"), one row per
 *   profile in race order, failures included with status=error; a
 *   re-compare retires the previous export so stale numbers cannot
 *   sneak into a report.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, GanttChart, Layers, Loader2, Play, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadText } from "@/lib/download";
import { jobType } from "@/lib/workflow";
import { MODEL_BADGE } from "./hpc-profiles-editor";

interface SimBar {
  key: string; type: string; slurmId: string;
  start: number; end: number; gpus: number; nodes: string[];
}
interface SimEvent { t: number; key: string; slurmId: string; state: string; detail?: string }
interface SimResponse {
  project: { id: string; name: string; jobs: number; edges: number };
  cluster: { gpus: number; nodes: number; arrayConcurrency: number };
  speedup: number;
  data: { micrographs: number; particles: number };
  events: SimEvent[];
  bars: SimBar[];
  makespanMin: number;
  gpuUtilization: number;
  avgWaitMin: number;
  totalGpuHours: number;
  clusterGpus: number;
  note?: string;
  error?: string;
}
interface SimParams { clusterGpus: number; nodes: number; arrayConcurrency: number; gpuSpeedup: number }

/** The brief a sweep row needs — every field comes from the profile. */
interface SweepProfile {
  id: string; name: string; gpuModel: string;
  gpusPerNode: number; nodes: number; arrayConcurrency: number; gpuSpeedup: number;
}
interface SweepRow {
  p: SweepProfile;
  r?: { makespanMin: number; gpuUtilization: number; avgWaitMin: number; totalGpuHours: number };
  err?: string;
}

/**
 * The sweep's exit into reports (t188): a CSV contract that reads like
 * sacct output — snake_case headers, raw minutes (machine-readable, NOT
 * the "1h 03m" display format), utilization as a percent number, one
 * row per profile in race order, failed profiles present with
 * status=error so a report never silently drops a contestant.
 */
const SWEEP_CSV_HEADER =
  "profile,gpu_model,nodes,gpus_per_node,gpus,array_conc,speedup,status,fastest,makespan_min,gpu_util_pct,avg_wait_min,gpu_hours,error";

/** RFC 4180 cell: quote what needs quoting, double embedded quotes. */
const csvCell = (v: string | number | boolean | undefined | null): string => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * ONE builder for BOTH export paths (clipboard + download) — the same
 * string that goes to the clipboard is what lands in the file. values
 * come from the sweep rows (the RESPONSE echo), never from the DOM.
 */
const buildSweepCsv = (rows: SweepRow[], bestId: string | null): string =>
  [
    SWEEP_CSV_HEADER,
    ...rows.map((row) =>
      [
        row.p.name,
        row.p.gpuModel,
        row.p.nodes,
        row.p.gpusPerNode,
        row.p.gpusPerNode * row.p.nodes,
        row.p.arrayConcurrency,
        row.p.gpuSpeedup,
        row.r ? "ok" : "error",
        !!row.r && row.p.id === bestId,
        row.r?.makespanMin ?? "",
        row.r ? Math.round(row.r.gpuUtilization * 1000) / 10 : "",
        row.r?.avgWaitMin ?? "",
        row.r ? Math.round(row.r.totalGpuHours * 10) / 10 : "",
        row.err ?? "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n");

const sweepCsvFilename = (): string =>
  `hpc-sweep-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.csv`;

/**
 * Markdown cell — the pipe table's quoting rule (t194). A `|` inside a
 * cell would end the column early and a newline would end the row, so
 * escape the pipe and flatten the newline: the mdCell twin of csvCell
 * (the CSV needed RFC 4180, the table needs GFM — each grammar gets the
 * escaping IT lies about).
 */
const mdCell = (v: string | number | boolean | undefined | null): string =>
  String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

const sweepReportFilename = (): string =>
  `hpc-sweep-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;

/**
 * The sweep's exit into prose (t194): the Markdown HUMAN twin of the
 * machine CSV. Same father — the sweep rows — but a different grammar:
 * the CSV speaks raw minutes and snake_case for spreadsheets; the
 * report speaks verdict, table and failures for people. ONE builder
 * feeds clipboard + download + the data-md carrier, and it derives
 * from the rows, NEVER from the CSV string — parsing your own export
 * to write a summary is a second derivation waiting to drift.
 */
const buildSweepReport = (rows: SweepRow[], bestId: string | null): string => {
  const ok = rows.filter((r) => r.r);
  const failed = rows.filter((r) => !r.r);
  const best = ok.find((r) => r.p.id === bestId) ?? null;
  const worst = ok.reduce<SweepRow | null>(
    (w, r) => (!w || r.r!.makespanMin > w.r!.makespanMin ? r : w),
    null,
  );
  const lines: string[] = [];
  lines.push("# HPC sweep — cluster profile comparison", "");
  lines.push(
    `Generated ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC · CryoFlow queue simulation`,
    "",
  );
  // The verdict — one sentence a human can act on, margins included.
  if (best?.r && worst?.r && worst.r.makespanMin > best.r.makespanMin) {
    const margin = Math.max(0, Math.round((1 - best.r.makespanMin / worst.r.makespanMin) * 100));
    lines.push(
      `${ok.length} of ${rows.length} profiles simulated on the same workflow graph. ` +
      `**${best.p.name}** wins with a ${fmtMin(best.r.makespanMin)} makespan — ` +
      `${margin}% faster than the slowest contestant (${fmtMin(worst.r.makespanMin)}) — ` +
      `at a cost of ${(Math.round(best.r.totalGpuHours * 10) / 10).toFixed(1)} GPU-hours.`,
    );
  } else if (best?.r) {
    lines.push(
      `${ok.length} of ${rows.length} profiles simulated on the same workflow graph. ` +
      `**${best.p.name}** wins with a ${fmtMin(best.r.makespanMin)} makespan at a cost of ` +
      `${(Math.round(best.r.totalGpuHours * 10) / 10).toFixed(1)} GPU-hours.`,
    );
  } else {
    lines.push(`${rows.length} profiles entered the race; none finished — see the failures below.`);
  }
  lines.push("");
  // The race table — human units (1h 03m, %), winner's makespan bold.
  lines.push("| # | Profile | GPU | Shape | Speedup | Status | Makespan | Utilization | Avg wait | GPU-hours |");
  lines.push("|--:|---------|-----|-------|--------:|--------|---------:|------------:|---------:|----------:|");
  rows.forEach((row, i) => {
    lines.push(
      [
        String(i + 1),
        row.p.name,
        row.p.gpuModel,
        `${row.p.nodes}×${row.p.gpusPerNode}`,
        `×${row.p.gpuSpeedup}`,
        row.r ? "ok" : "error",
        row.r
          ? row.p.id === bestId
            ? `**${fmtMin(row.r.makespanMin)}**`
            : fmtMin(row.r.makespanMin)
          : "—",
        row.r ? `${Math.round(row.r.gpuUtilization * 100)}%` : "—",
        row.r ? fmtMin(row.r.avgWaitMin) : "—",
        row.r ? `${(Math.round(row.r.totalGpuHours * 10) / 10).toFixed(1)}` : "—",
      ]
        .map(mdCell)
        .map((c) => `| ${c} `)
        .join("") + "|",
    );
  });
  // Failed profiles stay visible — a report that drops a contestant lies.
  if (failed.length > 0) {
    lines.push("");
    lines.push("Failed profiles (kept visible, never silently dropped):", "");
    for (const f of failed) lines.push(`- ${f.p.name} — ${f.err ?? "unavailable"}`);
  }
  lines.push("");
  lines.push(
    "> GPU-hours ≈ cost proxy — the fastest cluster is not always the cheapest. " +
    "The machine twin of this report is the CSV export (raw minutes, snake_case).",
  );
  return lines.join("\n") + "\n";
};

// Blob download lives in @/lib/download (t191 collected the private twins —
// two consumers deriving the anchor dance independently is two chances to fork).

/** Per-type bar triplets — same badge language as the sibling HPC panels. */
const TYPE_COLOR: Record<string, string> = {
  import: "bg-sky-500/25 border-sky-500/40 text-sky-700 dark:text-sky-300",
  motioncorr: "bg-cyan-500/25 border-cyan-500/40 text-cyan-700 dark:text-cyan-300",
  ctf: "bg-teal-500/25 border-teal-500/40 text-teal-700 dark:text-teal-300",
  extract: "bg-violet-500/25 border-violet-500/40 text-violet-700 dark:text-violet-300",
  select: "bg-amber-500/25 border-amber-500/40 text-amber-700 dark:text-amber-300",
  class2d: "bg-fuchsia-500/25 border-fuchsia-500/40 text-fuchsia-700 dark:text-fuchsia-300",
  class3d: "bg-indigo-500/25 border-indigo-500/40 text-indigo-700 dark:text-indigo-300",
  refine3d: "bg-rose-500/25 border-rose-500/40 text-rose-700 dark:text-rose-300",
  postprocess: "bg-emerald-500/25 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  maskcreate: "bg-green-500/25 border-green-500/40 text-green-700 dark:text-green-300",
};
const FALLBACK_COLOR = "bg-slate-500/25 border-slate-500/40 text-slate-700 dark:text-slate-300";

const fmtMin = (m: number): string => {
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;
  return m >= 10 ? `${Math.round(m)}m` : `${(Math.round(m * 10) / 10).toFixed(1)}m`;
};

/** One compact labelled numeric input (server clamp ranges as min/max). */
function NumField(props: {
  label: string; value: number; min: number; max: number; title: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5" title={props.title}>
      <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        {props.label}
      </span>
      <input
        type="number"
        className="h-7 w-[4.5rem] rounded-md border bg-background px-2 text-[11px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={props.value}
        min={props.min}
        max={props.max}
        aria-label={props.label}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) props.onChange(Math.round(n));
        }}
      />
    </label>
  );
}

export function HpcQueueSim({ gpusPerNode }: { gpusPerNode?: number }) {
  const [open, setOpen] = React.useState(false);
  const [sim, setSim] = React.useState<SimResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [clamped, setClamped] = React.useState(false);
  const [sweep, setSweep] = React.useState<SweepRow[] | null>(null);
  const [sweeping, setSweeping] = React.useState(false);
  // Sweep export (t188 CSV + t194 Markdown report): the note is the
  // user-facing receipt; lastCsv/lastMd are the exact strings handed to
  // clipboard/download (the probe's observation boundary — one source
  // per format, no second derivation). The bytes ride the comparison
  // block's ALWAYS-ATTACHED header div (t191's carrier doctrine), not
  // the 4-second note.
  const [exportNote, setExportNote] = React.useState<string | null>(null);
  const [lastCsv, setLastCsv] = React.useState<string | null>(null);
  const [lastMd, setLastMd] = React.useState<string | null>(null);
  const noteTimer = React.useRef<number | null>(null);
  const [params, setParams] = React.useState<SimParams>({
    clusterGpus: 8, nodes: 4, arrayConcurrency: 8, gpuSpeedup: 25,
  });
  // Prefill the GPU pool from the selected profile's node shape — but a
  // value the user typed is theirs; the prefill only speaks when untouched.
  const gpusTouched = React.useRef(false);

  React.useEffect(() => {
    if (gpusTouched.current || !gpusPerNode || gpusPerNode < 1) return;
    setParams((p) => ({ ...p, clusterGpus: Math.min(64, gpusPerNode) }));
  }, [gpusPerNode]);

  const run = async (override?: Partial<SimParams>) => {
    setLoading(true);
    setError(null);
    setOpen(true);
    const sent: SimParams = { ...params, ...override };
    try {
      const r = await fetch("/api/hpc/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sent),
      });
      const d = (await r.json()) as SimResponse;
      if (!r.ok) {
        setError(d?.error ?? `HTTP ${r.status}`);
      } else {
        setSim(d);
        // Server view shown — the echo is the truth about the cluster shape.
        const echoed: SimParams = {
          clusterGpus: d.cluster?.gpus ?? sent.clusterGpus,
          nodes: d.cluster?.nodes ?? sent.nodes,
          arrayConcurrency: d.cluster?.arrayConcurrency ?? sent.arrayConcurrency,
          gpuSpeedup: d.speedup ?? sent.gpuSpeedup,
        };
        setClamped(
          echoed.clusterGpus !== sent.clusterGpus ||
          echoed.nodes !== sent.nodes ||
          echoed.arrayConcurrency !== sent.arrayConcurrency ||
          echoed.gpuSpeedup !== sent.gpuSpeedup,
        );
        setParams(echoed);
      }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  // The sweep: every GPU profile races with its OWN declared shape —
  // pool = nodes × GPUs/node, its own throttle, its own multiplier.
  // Sequential posts (no request storm), progressive rendering (rows
  // land one by one like a race), isolated per-profile failures.
  const compare = async () => {
    setSweeping(true);
    setError(null);
    setOpen(true);
    // A new race retires the previous export — stale numbers must not
    // survive into a report.
    setExportNote(null);
    setLastCsv(null);
    setLastMd(null);
    try {
      const d = (await fetch("/api/hpc/profiles").then((r) => r.json())) as { profiles?: SweepProfile[] };
      const gpuProfiles = (d.profiles ?? []).filter((p) => p.gpusPerNode >= 1);
      const rows: SweepRow[] = [];
      setSweep([]);
      for (const p of gpuProfiles) {
        try {
          const res = await fetch("/api/hpc/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clusterGpus: p.gpusPerNode * p.nodes,
              arrayConcurrency: p.arrayConcurrency,
              gpuSpeedup: p.gpuSpeedup,
            }),
          });
          const j = (await res.json()) as SimResponse;
          rows.push(
            res.ok
              ? { p, r: { makespanMin: j.makespanMin, gpuUtilization: j.gpuUtilization, avgWaitMin: j.avgWaitMin, totalGpuHours: j.totalGpuHours } }
              : { p, err: j?.error ?? `HTTP ${res.status}` },
          );
        } catch {
          rows.push({ p, err: "Request failed" });
        }
        setSweep([...rows]);
      }
    } catch {
      setSweep([]);
    } finally {
      setSweeping(false);
    }
  };

  // Export the sweep: copy to clipboard, falling back to a download when
  // the clipboard is denied (headless, permissions, insecure context).
  // The CSV is built ONCE — clipboard, file and the data-csv observation
  // attribute all receive the same string.
  const flashNote = (text: string) => {
    setExportNote(text);
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setExportNote(null), 4000);
  };
  const exportCsv = async (mode: "copy" | "download") => {
    if (!sweep?.length) return;
    const csv = buildSweepCsv(sweep, bestRow?.p.id ?? null);
    setLastCsv(csv);
    if (mode === "copy") {
      try {
        await navigator.clipboard.writeText(csv);
        flashNote(`Copied ${sweep.length} profile row${sweep.length === 1 ? "" : "s"} to the clipboard`);
        return;
      } catch {
        // clipboard denied — the download is the honest fallback
      }
    }
    const fname = sweepCsvFilename();
    downloadText(fname, csv);
    flashNote(`Downloaded ${fname}${mode === "copy" ? " (clipboard unavailable)" : ""}`);
  };

  // The report export (t194): the Markdown twin walks the SAME fallback
  // chain as the CSV — copy first, and when the clipboard is denied the
  // download is the honest second door, with the receipt saying so.
  const exportMd = async (mode: "copy" | "download") => {
    if (!sweep?.length) return;
    const md = buildSweepReport(sweep, bestRow?.p.id ?? null);
    setLastMd(md);
    if (mode === "copy") {
      try {
        await navigator.clipboard.writeText(md);
        flashNote(`Copied the sweep report (${sweep.length} profile${sweep.length === 1 ? "" : "s"}) to the clipboard`);
        return;
      } catch {
        // clipboard denied — the download is the honest fallback
      }
    }
    const fname = sweepReportFilename();
    downloadText(fname, md);
    flashNote(`Downloaded ${fname}${mode === "copy" ? " (clipboard unavailable)" : ""}`);
  };

  // Adopt a sweep row: its declared shape becomes the form's shape (and
  // the user's — the prefill must never stomp an explicit adoption),
  // then the single Gantt re-runs so compare → adopt → inspect is one loop.
  const adopt = (row: SweepRow) => {
    if (!row.r) return;
    gpusTouched.current = true;
    void run({
      clusterGpus: row.p.gpusPerNode * row.p.nodes,
      arrayConcurrency: row.p.arrayConcurrency,
      gpuSpeedup: row.p.gpuSpeedup,
    });
  };

  // One row per job (first-appearance order = scheduling order), array
  // shards grouped as segments on the shared row.
  const rows = React.useMemo(() => {
    if (!sim?.bars?.length) return [] as { key: string; type: string; segs: SimBar[] }[];
    const order: string[] = [];
    const byKey = new Map<string, SimBar[]>();
    for (const b of sim.bars) {
      let list = byKey.get(b.key);
      if (!list) { list = []; byKey.set(b.key, list); order.push(b.key); }
      list.push(b);
    }
    return order.map((key) => {
      const segs = (byKey.get(key) ?? []).slice().sort((a, b) => a.start - b.start);
      return { key, type: segs[0]?.type ?? "", segs };
    });
  }, [sim]);

  const pendingEpisodes = sim?.events?.filter((e) => e.state === "PENDING").length ?? 0;
  const makespan = sim?.makespanMin ?? 0;

  // Sweep verdicts: fastest wears the crown, bars scale to the slowest.
  const okRows = sweep?.filter((r) => r.r) ?? [];
  const bestRow = okRows.reduce<SweepRow | null>(
    (w, r) => (!w || r.r!.makespanMin < w.r!.makespanMin ? r : w),
    null,
  );
  const worstMakespan = Math.max(0, ...okRows.map((r) => r.r!.makespanMin));

  return (
    <section
      aria-label="Queue simulation"
      className="mt-1 space-y-3 border-t pt-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <GanttChart className="size-4 text-primary" aria-hidden="true" />
        <span className="text-xs font-medium">Queue simulation</span>
        <span className="text-[10.5px] text-muted-foreground">
          projects how the whole workflow schedules on this cluster class —
          real graph, real edges, real measured durations
        </span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void compare()}
          disabled={sweeping}
          aria-label="Compare cluster profiles"
          title="Simulate every GPU profile with its own declared shape (nodes × GPUs/node × throttle × speedup)"
        >
          {sweeping
            ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            : <Layers className="size-3.5" aria-hidden="true" />}
          {sweep ? "Re-compare" : "Compare"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void run()}
          disabled={loading}
          aria-label="Run queue simulation"
        >
          {loading
            ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            : <Play className="size-3.5" aria-hidden="true" />}
          {sim || loading ? "Re-run" : "Run"}
        </Button>
      </div>

      {open ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <NumField
              label="GPUs" value={params.clusterGpus} min={1} max={64}
              title="GPU pool size (1–64) — the scheduler first-fits bars onto this pool"
              onChange={(v) => { gpusTouched.current = true; setParams((p) => ({ ...p, clusterGpus: v })); }}
            />
            <NumField
              label="Nodes" value={params.nodes} min={1} max={16}
              title="Node count (1–16) — one bar lands per node regardless of its GPU share"
              onChange={(v) => setParams((p) => ({ ...p, nodes: v }))}
            />
            <NumField
              label="Array conc." value={params.arrayConcurrency} min={1} max={64}
              title="Array job concurrency (1–64) — how many shards of one array job may run at once"
              onChange={(v) => setParams((p) => ({ ...p, arrayConcurrency: v }))}
            />
            <NumField
              label="GPU speedup" value={params.gpuSpeedup} min={1} max={500}
              title="Cluster-class GPU speedup vs the sandbox (×1–×500) — scales measured GPU-job durations"
              onChange={(v) => setParams((p) => ({ ...p, gpuSpeedup: v }))}
            />
            {clamped ? (
              <span className="pb-1 text-[10px] italic text-amber-600 dark:text-amber-400" role="status">
                clamped to the server&apos;s contract ranges
              </span>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] p-3 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          ) : sim ? (
            <>
              <div className="grid grid-cols-4 gap-2" aria-label="Simulation KPIs">
                {[
                  { k: "Makespan", v: fmtMin(sim.makespanMin) },
                  { k: "GPU util", v: `${Math.round(sim.gpuUtilization * 100)}%` },
                  { k: "Avg wait", v: fmtMin(sim.avgWaitMin) },
                  {
                    k: "GPU hours",
                    v: `${sim.totalGpuHours >= 10 ? Math.round(sim.totalGpuHours) : (Math.round(sim.totalGpuHours * 10) / 10).toFixed(1)}h`,
                  },
                ].map((cell) => (
                  <div key={cell.k} className="rounded-md border bg-muted/30 px-2.5 py-1.5">
                    <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{cell.k}</div>
                    <div className="text-sm font-semibold tabular-nums" aria-label={`${cell.k} ${cell.v}`}>{cell.v}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span>{sim.project.jobs} jobs · {sim.project.edges} deps</span>
                <span>{sim.data.micrographs} micrographs · {sim.data.particles.toLocaleString()} particles</span>
                {pendingEpisodes > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    {pendingEpisodes} pending episode{pendingEpisodes === 1 ? "" : "s"} (Resources)
                  </span>
                ) : null}
              </div>

              {rows.length ? (
                <div
                  className="max-h-64 space-y-1 overflow-y-auto rounded-md border bg-muted/20 p-3"
                  aria-label="Simulated schedule (Gantt)"
                >
                  <div className="flex items-center gap-2" aria-hidden="true">
                    <div className="w-28 shrink-0" />
                    <div className="relative h-3.5 flex-1 text-[8.5px] tabular-nums text-muted-foreground">
                      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                        <span
                          key={f}
                          className={cn(
                            "absolute top-0",
                            f === 0 && "left-0",
                            f === 0.25 && "left-1/4 -translate-x-1/2",
                            f === 0.5 && "left-1/2 -translate-x-1/2",
                            f === 0.75 && "left-3/4 -translate-x-1/2",
                            f === 1 && "left-full -translate-x-full",
                          )}
                        >
                          {fmtMin(makespan * f)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {rows.map((row) => {
                    const spec = jobType(row.type);
                    const label = spec?.label ?? row.type;
                    const color = TYPE_COLOR[row.type] ?? FALLBACK_COLOR;
                    return (
                      <div key={row.key} className="flex items-center gap-2">
                        <div
                          className="w-28 shrink-0 truncate text-[9.5px] text-muted-foreground"
                          title={`${label} (${row.segs[0]?.slurmId ?? ""})`}
                        >
                          {label}
                        </div>
                        <div className="relative h-[18px] flex-1 overflow-hidden rounded bg-background/60">
                          {[0.25, 0.5, 0.75].map((f) => (
                            <div
                              key={f}
                              className="absolute inset-y-0 w-px bg-foreground/[0.06]"
                              style={{ left: `${f * 100}%` }}
                              aria-hidden="true"
                            />
                          ))}
                          {row.segs.map((s) => {
                            const span = makespan > 0 ? ((s.end - s.start) / makespan) * 100 : 0;
                            return (
                              <div
                                key={s.slurmId + String(s.start)}
                                className={cn(
                                  "absolute inset-y-0.5 flex items-center overflow-hidden rounded-[3px] border px-1",
                                  color,
                                )}
                                style={{
                                  left: `${makespan > 0 ? (s.start / makespan) * 100 : 0}%`,
                                  width: `${Math.max(0.6, span)}%`,
                                }}
                                title={`${s.slurmId} · ${label} · ${s.gpus > 0 ? `${s.gpus}×GPU` : "CPU"} · ${fmtMin(s.end - s.start)} · ${s.nodes.join(", ")}`}
                              >
                                {s.gpus > 0 && span >= 8 ? (
                                  <span className="text-[8.5px] font-semibold tabular-nums">{s.gpus}G</span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                  Nothing to schedule — the active graph has no jobs.
                </div>
              )}

              {sim.note ? (
                <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground" title={sim.note}>
                  {sim.note}
                </p>
              ) : null}
            </>
          ) : null}

          {sweep ? (
            <div
              className="space-y-1.5 rounded-md border bg-muted/20 p-3"
              aria-label="Profile comparison"
              data-csv={lastCsv ?? undefined}
              data-md={lastMd ?? undefined}
            >
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                <Layers className="size-3.5 text-primary" aria-hidden="true" />
                Profile comparison
                <span className="text-[10px] font-normal text-muted-foreground">
                  — same graph, each profile&apos;s own declared shape
                </span>
                <div className="flex-1" />
                <span className="text-[9.5px] tabular-nums text-muted-foreground">
                  {okRows.length}/{sweep.length} simulated
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[10px]"
                  disabled={!sweep.length}
                  onClick={() => void exportCsv("copy")}
                  aria-label="Copy comparison as CSV"
                  title="Copy the race as CSV (raw minutes, machine-readable) — falls back to a download when the clipboard is denied"
                >
                  <Copy className="size-3" aria-hidden="true" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[10px]"
                  disabled={!sweep.length}
                  onClick={() => void exportCsv("download")}
                  aria-label="Download comparison as CSV"
                  title="Save the race as hpc-sweep-<timestamp>.csv — the same bytes the copy path puts on the clipboard"
                >
                  <Download className="size-3" aria-hidden="true" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[10px]"
                  disabled={!sweep.length}
                  onClick={() => void exportMd("copy")}
                  aria-label="Copy comparison as Markdown"
                  title="Copy the race as a Markdown report (verdict, table, failures) — falls back to a download when the clipboard is denied"
                >
                  <Copy className="size-3" aria-hidden="true" />
                  Report
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[10px]"
                  disabled={!sweep.length}
                  onClick={() => void exportMd("download")}
                  aria-label="Download comparison as Markdown"
                  title="Save the race as hpc-sweep-report-<timestamp>.md — the same bytes the copy path puts on the clipboard"
                >
                  <Download className="size-3" aria-hidden="true" />
                  Report
                </Button>
              </div>
              {sweep.length === 0 ? (
                <p className="text-[10.5px] italic text-muted-foreground">
                  No GPU profiles to race — give a profile at least one GPU per node.
                </p>
              ) : (
                sweep.map((row) => {
                  const gpus = row.p.gpusPerNode * row.p.nodes;
                  const isBest = !!row.r && bestRow?.p.id === row.p.id;
                  return (
                    <button
                      key={row.p.id}
                      type="button"
                      onClick={() => adopt(row)}
                      disabled={!row.r}
                      className={cn(
                        "block w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                        row.r ? "cursor-pointer hover:bg-muted/50" : "cursor-not-allowed opacity-60",
                        isBest ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-border/60",
                      )}
                      title={
                        row.r
                          ? `Adopt this shape (${gpus} GPUs · ×${row.p.gpuSpeedup}) and re-run the schedule above`
                          : (row.err ?? "unavailable")
                      }
                      aria-label={`Adopt ${row.p.name}${row.r ? ` — ${fmtMin(row.r.makespanMin)} makespan` : " — unavailable"}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn("shrink-0 border px-1 py-0 text-[9px]", MODEL_BADGE[row.p.gpuModel] ?? "")}
                        >
                          {row.p.gpuModel}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{row.p.name}</span>
                        <span className="hidden shrink-0 text-[9.5px] tabular-nums text-muted-foreground sm:inline">
                          {gpus} GPUs · ×{row.p.gpuSpeedup} · %{row.p.arrayConcurrency}
                        </span>
                        {isBest ? (
                          <span className="flex shrink-0 items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                            <Trophy className="size-3" aria-hidden="true" />
                            fastest
                          </span>
                        ) : null}
                        {row.err ? (
                          <span className="shrink-0 text-[9.5px] italic text-rose-600 dark:text-rose-400">{row.err}</span>
                        ) : null}
                        {row.r ? (
                          <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                            <span className="w-14 text-right text-xs font-semibold" aria-label={`Makespan ${fmtMin(row.r.makespanMin)}`}>
                              {fmtMin(row.r.makespanMin)}
                            </span>
                            <span className="w-9 text-right text-[10px] text-muted-foreground">
                              {Math.round(row.r.gpuUtilization * 100)}%
                            </span>
                            <span className="w-10 text-right text-[10px] text-muted-foreground">
                              {fmtMin(row.r.avgWaitMin)}
                            </span>
                            <span className="w-10 text-right text-[10px] text-muted-foreground">
                              {(Math.round(row.r.totalGpuHours * 10) / 10).toFixed(1)}h
                            </span>
                          </span>
                        ) : null}
                      </div>
                      <div className="relative mt-1.5 h-1 overflow-hidden rounded bg-muted">
                        {row.r ? (
                          <div
                            className={cn(
                              "absolute inset-y-0 left-0 rounded",
                              isBest ? "bg-emerald-500/70" : "bg-slate-400/50",
                            )}
                            style={{ width: `${worstMakespan > 0 ? Math.max(2, (row.r.makespanMin / worstMakespan) * 100) : 2}%` }}
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
              <p className="text-[9.5px] leading-relaxed text-muted-foreground">
                GPU-hours ≈ cost proxy — the fastest cluster is not always the cheapest.
                Click a row to adopt its shape and re-run the schedule above.
              </p>
              {exportNote ? (
                <p
                  className="text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400"
                  role="status"
                  aria-label="Export status"
                  data-csv={lastCsv ?? undefined}
                >
                  {exportNote}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
