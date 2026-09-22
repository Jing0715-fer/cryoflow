"use client";

/**
 * CryoFlow — "Run on cluster" control (job panel action row).
 *
 * The dispatch face of the remote layer: pick a saved SSH connection +
 * the relion module it should load, and the job is POSTed to
 * /api/jobs/[id]/run with { remote: target } — the store's runJobRemote
 * owns the response dialect (busy kinds, waiting/staging, honest
 * failures).
 *
 * t297 — the mode door is finally honest: "direct" (nohup on the login
 * node) or "slurm" (sbatch submission, the sbatch6gpu.sh pattern). In
 * slurm mode a GPU stepper picks the submission width (1–8, default 6 —
 * t349: one WORKER rank per GPU plus a dedicated CPU master, so
 * --ntasks = N+1 while --gres=gpu:N stays N); the connection's useSlurm
 * flag preselects the mode. The module picker also grew a free-text
 * door: a beta/hidden module the probe never listed can be typed by its
 * exact name (the dispatch's module-load guard reports an honest exit-127
 * if the name is wrong).
 *
 * t300 — two more defaults became CHOICES: a REMOTE project locks the
 * dialog to its bound cluster (the project's picked paths are absolute
 * THERE — another connection would strand the data), and slurm mode
 * grows the "node / partition" picker from the probe's sinfo inventory
 * (the detected node groups, each with its GPU/node figure and hostname
 * list — picking "brain2" lands the job on that node).
 *
 * t326 — the information-architecture redesign (the user's receipt:
 * the layout felt neither organized nor pretty). The same knobs, the
 * same contracts (suite-pinned strings, aria grammar, submit body),
 * regrouped so the eye has anchors: a job-identity header (the name +
 * type badge sit under a stable title), SECTIONED form (Cluster / Run
 * mode / Slurm resources), run mode as two selectable CARDS (the
 * structural choice is visible at a glance instead of buried in a
 * dropdown), the Slurm knobs inside a bordered panel that only exists
 * in Slurm mode (cause and effect share a frame), flag-level facts as
 * mono CHIPS on their own line (never squeezed beside a stepper), a
 * submission PREVIEW that renders the sbatch directives these knobs
 * actually produce (honesty: every directive shown is one the dispatch
 * writes), and a lifecycle strip (stage → load → run → sync) that says
 * in two lines what the old five-line intro paragraph buried. The
 * wall-of-text intro is dead; the sync policy it explained lives in
 * the strip's caption.
 *
 * t347 — the height diet (the user's receipt: the submission dialog
 * outgrew one screen). Same knobs, same contracts — a second column
 * instead of a longer scroll: the dialog widened to 2xl, connection +
 * module sit side by side (stacking below sm), the mode cards are one
 * line each, the GPU-width and Array-split rows share a row when both
 * exist, and the two helper paragraphs (node-picker grammar, lifecycle
 * sync policy) moved into title attributes. LAYOUT-ONLY — every data
 * hook, aria grammar, stepper predicate and the submit payload are
 * untouched.
 *
 * Defaults come from the cluster manager's ACTIVE connection
 * (localStorage "cryoflow.remote.active"); modules from that
 * connection's last probe. No connections yet? The dialog offers the
 * manager instead of a dead select.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { isLogAutopick } from "@/lib/relion/log-autopick";
import {
  onEscapeClose,
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { slurmWidthFor } from "@/lib/hpc/gpu-width";
import type { SlurmNodeUsage } from "@/lib/hpc/slurm-usage";
import {
  ChevronRight, HardDriveDownload, Loader2, MapPin, Minus, Network, Package, Play, Plus, Server, Terminal, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store";
import { ClusterUsagePanel } from "./cluster-usage-panel";
import type { JobDTO } from "@/lib/types";
import type { RemoteRunTarget } from "@/lib/remote/types";
import {
  RemoteClusterDialog,
  readActiveRemoteConnectionId,
  useRemoteConnections,
} from "./remote-cluster-dialog";

const CUSTOM_MODULE_VALUE = "__custom__";
const PARTITION_AUTO = "__auto__";
/**
 * t338 — the Select's display value while a node picked from the live
 * usage list pins the submission (--nodelist). The field report: 「从节点
 * 使用情况处选择节点后，node框还是auto没有变化」 — the pin WAS wired
 * (sbatch --nodelist, stepper ceiling, ask line) but the Node/partition
 * box kept showing "Auto", so the pick looked dead. The box is now the
 * single visible truth for WHERE: a pinned node (from the list) or a
 * partition/Auto (from this dropdown) — never both at once, and picking
 * anything here releases the pin.
 *
 * t340 — the pin and the dropdown now land the SAME sbatch composition.
 * The follow-up field report: 「两种选择方式即使选同一个node，但是
 * node框中显示也不一样」，只有下拉选择能提交成功 — the dropdown
 * carried --partition=<group> while the pin SUPPRESSED the partition, so
 * the job fell to the cluster's default partition and the controller
 * refused it ("Requested node configuration is not available"). The pin
 * now resolves and shows the node's OWN partition (the usage row's
 * Partitions=, the same word scontrol gave the server), and the preview
 * writes --partition=<that> + --nodelist=<node> — one grammar, two doors.
 */
const NODE_PIN_VALUE = "__node_pin__";
const ARRAY_MAX_SHARDS = 64;
/**
 * t306/t307 — the types whose remote Slurm run can ride an array split (the
 * dispatch's own ARRAY_FLAVORS gate — per-micrograph embarrassingly parallel,
 * each with a merge the last task home can do honestly: output-star concat
 * for motioncorr/ctffind, path-rewritten particle rows for extract, a
 * collected per-mic coords dir for autopick). The dialog hides the stepper
 * for everything else — a knob that would be refused at dispatch time is not
 * a knob, it is a trap.
 */
const ARRAY_ELIGIBLE_TYPES = new Set(["motioncorr", "ctffind", "extract", "autopick"]);

/** t326 — a section overline: the eye's anchor between form groups. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/90">
      {children}
    </p>
  );
}

/** t326 — a mono flag chip: machine dialect, never squeezed into prose. */
function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] leading-4 text-muted-foreground"
    >
      {children}
    </span>
  );
}

/**
 * t289 — the run-mode dropdown drives this dialog too: pass `dialogOnly`
 * with open/onOpenChange to embed the SAME dialog without the standalone
 * trigger (one dialog component, many doors — the action row's server icon
 * and the Run button's ▾ menu both open it).
 */
export function RemoteRunButton({
  job,
  dialogOnly = false,
  open: openProp,
  onOpenChange,
}: {
  job: JobDTO;
  /** render just the dialog (no trigger) — for controlled callers. */
  dialogOnly?: boolean;
  /** controlled open state (requires dialogOnly). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = React.useState(false);
  const open = dialogOnly ? (openProp ?? false) : openState;
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const { connections, reload } = useRemoteConnections(open);
  const runJobRemote = useWorkflowStore((s) => s.runJobRemote);
  // t300 — a REMOTE project's bound cluster is the dialog's DEFAULT (and
  // locked) target: the project's picked input paths are absolute on THAT
  // cluster — another connection would strand the data.
  const projectRemote = useWorkflowStore((s) => s.project?.remote ?? null);

  const [connId, setConnId] = React.useState("");
  const [module, setModule] = React.useState("");
  // t297 — mode + the sbatch GPU width + the free-text module door
  const [mode, setMode] = React.useState<"direct" | "slurm">("direct");
  const [gpus, setGpus] = React.useState(6);
  // t300 — the detected node group (Slurm partition) this sbatch pins;
  // "__auto__" = the scheduler picks (falls back to the connection default)
  const [partition, setPartition] = React.useState<string>(PARTITION_AUTO);
  // t332 — the node picked straight from the live usage list (the panel's
  // rows): an explicit --nodelist that survives multi-host groups. The
  // full usage row is kept (its gpuTotal caps the stepper); null = no pin
  // (the t300 single-host derivation applies).
  const [pickedNode, setPickedNode] = React.useState<SlurmNodeUsage | null>(null);
  // t306 — the array split (1 = off — the single-job contract; 2..64 shards
  // ride --array=1-N%4). Defaults OFF: a re-run of an old job must submit
  // byte-identical scripts unless the user asks for the split.
  const [shards, setShards] = React.useState(1);
  const [customModule, setCustomModule] = React.useState("");
  const [pending, setPending] = React.useState(false);
  // the nested cluster manager (empty state → add a connection right here)
  const [clusterOpen, setClusterOpen] = React.useState(false);

  const conn = connections.find((c) => c.id === connId) ?? null;
  const probedModules = conn?.lastProbe?.relionModules ?? [];
  const slurmAvailable = conn?.lastProbe?.slurm === true;
  const partitionInventory = conn?.lastProbe?.slurmGpus ?? [];

  // default connection: the project's binding (locked, see below), else
  // keep the current pick, else the ACTIVE one, else first
  React.useEffect(() => {
    if (!open) return;
    if (projectRemote) {
      // the project's cluster wins unconditionally while it exists in the
      // registry — a remote project's data lives THERE
      if (connections.some((c) => c.id === projectRemote.connectionId)) {
        setConnId(projectRemote.connectionId);
        return;
      }
    }
    setConnId((prev) => {
      if (prev && connections.some((c) => c.id === prev)) return prev;
      const active = readActiveRemoteConnectionId();
      if (active && connections.some((c) => c.id === active)) return active;
      return connections[0]?.id ?? "";
    });
  }, [open, connections, projectRemote]);

  // module default follows the connection (its defaultModule, else first probed)
  React.useEffect(() => {
    if (!conn) {
      setModule("");
      return;
    }
    const probed = conn.lastProbe?.relionModules ?? [];
    if (conn.defaultModule && probed.includes(conn.defaultModule)) setModule(conn.defaultModule);
    else setModule(probed[0] ?? conn.defaultModule ?? "");
  }, [conn]);

  // t297 — the mode defaults to the connection's preference, and degrades
  // to direct when this cluster offers no Slurm client (the probe's word).
  React.useEffect(() => {
    if (!conn) return;
    if (conn.useSlurm && conn.lastProbe?.slurm) setMode("slurm");
    else setMode("direct");
  }, [conn]);

  // t300 — partition default: the connection's pinned partition when the
  // probe's inventory actually lists it, else auto
  React.useEffect(() => {
    if (!conn) return;
    setPartition(
      conn.slurmPartition && partitionInventory.some((p) => p.partition === conn.slurmPartition)
        ? conn.slurmPartition
        : PARTITION_AUTO
    );
  }, [conn, partitionInventory]);

  // t332 — a node pin belongs to ONE cluster's inventory: a different
  // connection's nodes are a different world, and the pin must not
  // survive the switch (the panel's rows re-fetch underneath it)
  React.useEffect(() => {
    setPickedNode(null);
  }, [conn?.id]);

  // t300 — the GPU width's ceiling: the SELECTED node group's per-node
  // GPUs (sinfo), falling back to the widest partition the probe saw, else 8.
  // t332 — a node PINNED from the usage list caps the stepper with THAT
  // node's own GPUs (scontrol's word — a 6-GPU node cannot honor
  // --gres=gpu:8 however wide its partition's other machines are; a
  // 0-GPU node keeps the old ceiling and lets the ask line name the
  // contradiction instead).
  const selectedGroup =
    partition === PARTITION_AUTO ? null : partitionInventory.find((p) => p.partition === partition) ?? null;
  const nodePin = pickedNode?.node ?? null;
  // t337 — AUTO is not "the inventory's first group": with no picked
  // partition (and no pin) the script still carries the CONNECTION'S
  // default (conn.slurmPartition — exactly what the engine's
  // effectivePartition resolves to). The stepper's ceiling must be the
  // group the sbatch will actually name, or it offers widths the
  // controller refuses at submit time ("auto" + 6 on a 5-GPU default
  // partition was the user's live receipt).
  const autoGroup = conn?.slurmPartition
    ? partitionInventory.find((p) => p.partition === conn?.slurmPartition) ?? null
    : null;
  const maxGpus = Math.max(
    1,
    Math.min(
      8,
      pickedNode && pickedNode.gpuTotal > 0
        ? pickedNode.gpuTotal
        : (selectedGroup?.gpusPerNode ?? autoGroup?.gpusPerNode ?? partitionInventory[0]?.gpusPerNode ?? 8)
    )
  );
  // clamping the pick when the partition changes (a 5-GPU partition cannot
  // honor a 6-GPU request — the stepper must not offer it)
  React.useEffect(() => {
    setGpus((g) => Math.min(g, maxGpus));
  }, [maxGpus]);

  const disabled = job.status === "running" || job.linkedJobId != null;

  // t306 — the array stepper only exists for eligible types (the dispatch
  // would refuse the split for anything else) and only in slurm mode.
  const arrayEligible = ARRAY_ELIGIBLE_TYPES.has(job.type);

  // t320 — a LoG Auto-picking job is CPU-only (RELION's autopicker.cpp
  // refuses --gpu on the Laplacian-of-Gaussian picker outright). The GPU
  // stepper would be a knob the dispatch refuses at submit time — "a knob
  // that would be refused is not a knob, it is a trap" (the array row's
  // own doctrine): show the CPU contract instead. References/Topaz
  // picking keep the stepper.
  const logPick = isLogAutopick(job.type, job.params);

  /** The module the dispatch will actually load: the free-text door wins
   *  over the select while it carries a value. */
  const effectiveModule =
    module === CUSTOM_MODULE_VALUE ? customModule.trim() : module;

  // t326 — the WIDTH truth: the dispatch honors the GPU-stepper width only
  // for the MPI-multi-GPU types (relion_refine_mpi splits particles across
  // ranks); everything else sizes itself (one GPU per task for motioncorr
  // and References-picking, CPU tasks for ctffind/extract/LoG, single-GPU
  // for the Topaz-style trainers). A stepper promising a width the sbatch
  // would not write is a trap, not a knob — t320's own doctrine, applied
  // to the width. The table is the SAME pure module the strategy derives
  // from (gpu-width.ts): the dialog cannot drift from the dispatch.
  const widthTruth = slurmWidthFor(job.type, { gpus, logAutopick: logPick });
  // and the width is only real when the chosen MODULE can actually run
  // MPI (a no-mpirun module falls back to a sequential single-GPU run —
  // the probe's relionMpi map says which modules carry mpirun)
  const moduleHasMpi = !!conn?.lastProbe?.relionMpi?.[effectiveModule];
  const widthIsReal = !logPick && widthTruth.mode === "multi-gpu" && moduleHasMpi;
  // t349 — the MPI rank count the dispatch writes for a real width:
  // N+1 for N ≥ 2 (RELION's dedicated-master layout — rank 0 is the CPU
  // master, one worker per card), 1 for width 1 (a single process; no
  // split to make on one card). The preview speaks this number, the
  // sbatch carries it (CF_RANKS in the script).
  const mpiRankCount = gpus >= 2 ? gpus + 1 : 1;

  // t326 — the submission preview's partition: the picked group, else the
  // connection's pinned default (exactly what the dispatch's
  // effectivePartition resolves to — the preview never invents a flag).
  // t332 — an explicit node pin speaks for itself: the connection's
  // default partition must not ride along (the engine suppresses it the
  // same way — a --partition=normal + --nodelist=brain3 combo is refused
  // at submit time; the node's own partition is where it lands).
  // t340 — while a usage-list pin speaks, the node's OWN home is the
  // partition that rides — the partition STATE (possibly the
  // auto-initialized connection default) must not compose a contradiction
  // the preview would then lie about. Unknown home → no partition
  // line: the default decides, honestly shown.
  const previewPartition = nodePin
    ? (pickedNode?.partitions?.[0] ?? null)
    : partition !== PARTITION_AUTO
      ? partition
      : (conn?.slurmPartition ?? null);

  // t326 — the sbatch directives these knobs produce. Every entry here is
  // one the dispatch's script builder actually writes (remote-run.ts):
  // --partition (picked or connection default), --nodelist (single-host
  // group), --gres/--ntasks (the MPI width), --array (the split). The
  // preview is a promise the sbatch keeps.
  const sbatchDirectives: string[] = [];
  if (mode === "slurm") {
    if (previewPartition) sbatchDirectives.push(`--partition=${previewPartition}`);
    // t332 — the explicit node pick (the usage list's rows) pins the node
    // outright; the t300 single-host group derivation stands only without
    // one — the user's later, more specific choice speaks
    if (nodePin) sbatchDirectives.push(`--nodelist=${nodePin}`);
    else if (selectedGroup && selectedGroup.hosts?.length === 1)
      sbatchDirectives.push(`--nodelist=${selectedGroup.hosts[0]}`);
    if (logPick) sbatchDirectives.push("--ntasks=1");
    else if (widthIsReal) {
      // t349 — the dedicated-master layout: N workers + 1 CPU master
      sbatchDirectives.push(`--ntasks=${mpiRankCount}`, `--gres=gpu:${gpus}`);
    } else if (widthTruth.gpus === 1) {
      // single-GPU steps, array-1-GPU shards, and the no-mpirun fallback
      // all land the same shape: one GPU task
      sbatchDirectives.push("--ntasks=1", "--gres=gpu:1");
    } else {
      sbatchDirectives.push("--ntasks=1");
    }
    if (arrayEligible && shards >= 2) sbatchDirectives.push(`--array=1-${shards}%4`);
  }

  // t327 — what THIS submission needs from the cluster right now, for
  // the live usage panel's ask line: per-task GPUs (the width truth —
  // the stepper's pick where real, the honest width elsewhere) × the
  // simultaneous tasks (an array's shards capped by the %4 concurrency
  // the sbatch actually writes).
  const usageAsk = React.useMemo(() => {
    const perTask = logPick ? 0 : widthIsReal ? gpus : widthTruth.gpus;
    const tasks = arrayEligible && shards >= 2 ? Math.min(shards, 4) : 1;
    return { gpus: perTask, tasks };
  }, [logPick, widthIsReal, gpus, widthTruth.gpus, arrayEligible, shards]);

  // t326 — radiogroup keyboard grammar: arrows move between the two mode
  // cards (right/down → slurm when the cluster has a client, left/up →
  // direct). Click/Enter/Space ride the native button semantics.
  const onModeCardKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      if (slurmAvailable) setMode("slurm");
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setMode("direct");
    }
  };

  // t326 — the honest width box: what the dispatch will actually request
  // when the stepper's width is not real for this type. Same shape as the
  // LoG CPU box (t320): the contract, stated — not a knob that lies.
  const widthBox = (() => {
    if (widthTruth.mode === "multi-gpu" && !moduleHasMpi)
      return {
        headline: "1 × GPU — this module has no mpirun",
        detail:
          `relion_refine_mpi needs the module's own mpirun — ${effectiveModule || "this module"} ` +
          "was not probed with one, so the dispatch runs the sequential single-GPU path " +
          "(--gres=gpu:1, --ntasks=1, no mpirun). Pick an MPI-capable module to unlock the width stepper.",
      };
    if (widthTruth.mode === "single")
      return {
        headline: "1 × GPU — single-GPU step",
        detail:
          "This step runs on exactly one GPU (--gres=gpu:1, --ntasks=1) — " +
          (job.type === "topaztrain"
            ? "Topaz training converges on one GPU; multi-GPU would need DDP."
            : "the external model works one GPU per job."),
      };
    if (widthTruth.mode === "array" && widthTruth.gpus === 1)
      return {
        headline: "1 × GPU per task",
        detail:
          "Each array shard runs on one GPU (--ntasks=1, --gres=gpu:1, no mpirun) — " +
          "the real parallelism knob is the Array split below (more shards, not wider jobs).",
      };
    // t338 — the extract-specific CPU contract. The field question:
    // 「extraction无法用GPU吗？」 — no: relion_preprocess (RELION's
    // extraction engine) has NO GPU code path; box cutting + normalization
    // run on the CPU, so a GPU allocation would just sit idle (and shrink
    // the pool the classification jobs need). The honest speed knob is
    // the Array split: N CPU shards, each extracting its share of the
    // micrographs in parallel.
    if (job.type === "extract")
      return {
        headline: "0 × GPU — CPU-only extraction",
        detail:
          "relion_preprocess (RELION's extraction engine) has no GPU code path — box cutting and " +
          "normalization run on the CPU, so no GPUs are requested or allocated (a GPU here would sit " +
          "idle while shrinking the pool the classification jobs need). The speed knob is the Array " +
          "split below: N CPU shards, each extracting its share of the micrographs in parallel.",
      };
    if (widthTruth.mode === "array")
      return {
        headline: "0 × GPU — CPU tasks",
        detail:
          "Each array shard is CPU-only (--ntasks=1, no --gres) — the Array split " +
          "below is the parallelism knob.",
      };
    return {
      headline: "0 × GPU — CPU step",
      detail:
        "CPU-bound bookkeeping / postprocessing — no GPU allocation (frees the " +
        "GPU queue for the classification jobs).",
    };
  })();

  // t297 — the GPU width stepper: the sbatch6gpu.sh pattern at the width
  // the user picks — but ONLY where the width is REAL (t326): the
  // MPI-multi-GPU types on an mpirun-capable module. Label left, stepper
  // right, flags as chips on their own line — the machine dialect never
  // gets squeezed into a wrapping sentence again.
  // t320 — the LoG picker: RELION refuses --gpu on it outright, so the
  // row states the CPU contract instead of offering a width the dispatch
  // would never send.
  // t326 — every OTHER non-MPI type gets the same honesty: the width the
  // dispatch will actually request, stated — not a stepper the sbatch
  // would ignore.
  // t347 — the row became a VARIABLE so the compact layout can seat it
  // beside the Array-split row (a 2-col grid when both exist) or
  // full-width, without duplicating the three honesty variants.
  const gpuWidthRow = logPick ? (
    <div className="space-y-1" data-gpu-width-row="" data-log-cpu-row="">
      <p className="text-xs font-medium text-foreground/90">GPUs to request</p>
      <p className="rounded-md border bg-muted/40 px-2.5 py-2 font-mono text-[11px] leading-snug text-muted-foreground">
        0 × GPU — CPU-only picker
      </p>
      <p className="text-[10.5px] leading-snug text-muted-foreground/85">
        Laplacian-of-Gaussian picking runs on the CPU — RELION rejects{" "}
        <span className="font-mono">--gpu</span> on the LoG picker (its own error:
        "does not support GPU acceleration"), so no GPUs are requested or
        allocated. Switch Picking method to References or Topaz to use GPUs.
      </p>
    </div>
  ) : widthIsReal ? (
    <div className="space-y-1" data-gpu-width-row="">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-foreground/90">GPUs to request</p>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setGpus((g) => Math.max(1, g - 1))}
            disabled={gpus <= 1}
            aria-label="One GPU less"
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </Button>
          <span
            className="min-w-16 rounded-md border bg-muted/40 px-2 py-1 text-center font-mono text-sm font-semibold tabular-nums"
            aria-live="polite"
            aria-label={`${gpus} GPU${gpus === 1 ? "" : "s"} requested`}
          >
            {gpus} × GPU
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setGpus((g) => Math.min(maxGpus, g + 1))}
            disabled={gpus >= maxGpus}
            aria-label="One GPU more"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip>--gres=gpu:{gpus}</Chip>
        <Chip>mpirun -n {mpiRankCount}</Chip>
        <Chip title="t349 — each WORKER rank gets its own CUDA_VISIBLE_DEVICES (one card per worker); rank 0 is the CPU master, RELION's np = nGPU + 1 layout">
          {gpus >= 2 ? `1 master + ${gpus} workers (1 worker → 1 card)` : "1 rank → its card (CUDA_VISIBLE_DEVICES)"}
        </Chip>
        {(selectedGroup ?? partitionInventory[0]) != null ? (
          <span className="text-[10px] text-muted-foreground/80">
            {(selectedGroup ?? partitionInventory[0])!.partition} offers{" "}
            {(selectedGroup ?? partitionInventory[0])!.gpusPerNode}/node · {gpus >= 2 ? "1 worker per GPU + 1 CPU master" : "1 rank per GPU"}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/80">{gpus >= 2 ? "1 worker per GPU + 1 CPU master" : "1 rank per GPU"}</span>
        )}
      </div>
    </div>
  ) : (
    <div className="space-y-1" data-gpu-width-row="" data-width-truth-row="">
      <p className="text-xs font-medium text-foreground/90">GPUs to request</p>
      <p className="rounded-md border bg-muted/40 px-2.5 py-2 font-mono text-[11px] leading-snug text-muted-foreground">
        {widthBox.headline}
      </p>
      <p className="text-[10.5px] leading-snug text-muted-foreground/85">
        {widthBox.detail}
      </p>
    </div>
  );

  // t306 — the array split stepper (eligible types only): 1 = a single
  // job (the old contract), 2..64 shards ride ONE sbatch --array=1-N%4 —
  // each task slices the input STAR by SLURM_ARRAY_TASK_ID, and the last
  // task home merges the shard output stars back into the canonical one,
  // so downstream jobs and Results never learn it was an array.
  // t347 — a variable like its GPU neighbor: it renders beside the width
  // row (2-col grid) when the type is eligible, not at all otherwise.
  const arrayRow = (
    <div className="space-y-1" data-array-shards-row="">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-foreground/90">Array split</p>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setShards((s) => Math.max(1, s - 1))}
            disabled={shards <= 1}
            aria-label="One shard fewer"
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </Button>
          <span
            className="min-w-20 rounded-md border bg-muted/40 px-2 py-1 text-center font-mono text-sm font-semibold tabular-nums"
            aria-live="polite"
            aria-label={shards >= 2 ? `${shards} array shards` : "single job, no split"}
          >
            {shards >= 2 ? `${shards} shards` : "1 × job"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setShards((s) => Math.min(ARRAY_MAX_SHARDS, s + 1))}
            disabled={shards >= ARRAY_MAX_SHARDS}
            aria-label="One shard more"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {shards >= 2 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip>sbatch --array=1-{shards}%4</Chip>
          <span className="text-[10px] text-muted-foreground/80">
            each shard takes every {shards}
            <sup className="text-[8px]">th</sup> micrograph; the last shard home
            merges the outputs
          </span>
        </div>
      ) : (
        <p className="text-[10.5px] leading-snug text-muted-foreground/85">
          Split per micrograph for data-parallel steps (MotionCorr, CTF Find). 1 job = no split.
        </p>
      )}
    </div>
  );

  const submit = async () => {
    if (!conn || pending) return;
    setPending(true);
    try {
      const target: RemoteRunTarget = {
        connectionId: conn.id,
        module: effectiveModule || null,
        mode,
        ...(mode === "slurm"
          ? {
              // t320 — a LoG autopick requests no GPUs; omit the width so
              // the dispatch (and its gpusRequested ledger) hear nothing
              // but the CPU contract. t326 — the width rides only when it
              // is REAL (MPI types with an mpirun-capable module); a
              // 1-GPU truth sends its honest 1, everything else omits
              // (the dispatch sizes those by its own strategy).
              ...(logPick || !widthIsReal ? (widthTruth.gpus === 1 ? { gpus: 1 } : {}) : { gpus }),
              // t340 — while a usage-list pin speaks, the partition
              // field stays ABSENT — the server resolves the node's OWN
              // home fresh from scontrol (the freshest word beats any
              // dialog state, and a stale partition state here could only
              // compose the contradiction the engine now refuses).
              ...(nodePin ? {} : partition !== PARTITION_AUTO ? { partition } : {}),
              // t332 — the explicit node pick from the live usage list
              ...(nodePin ? { nodelist: nodePin } : {}),
              ...(arrayEligible && shards >= 2 ? { shards: Math.min(ARRAY_MAX_SHARDS, shards) } : {}),
            }
          : {}),
      };
      const ok = await runJobRemote(job.id, target);
      if (ok) setOpen(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {dialogOnly ? null : (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="relative size-8 shrink-0 text-muted-foreground hover:text-foreground before:absolute before:-inset-1.5 before:rounded-md before:content-['']"
            disabled={disabled}
            aria-label="Run on cluster (SSH)"
            title={
              job.linkedJobId != null
                ? "Linked copies mirror their original — run the original job instead"
                : "Run on cluster (SSH)"
            }
          >
            <Server className="size-4" aria-hidden="true" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className="max-h-[calc(100vh-3rem)] gap-3 overflow-y-auto p-5 sm:max-w-2xl"
        onKeyDown={onEscapeClose(() => setOpen(false))}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Server className="size-4" aria-hidden="true" />
            </span>
            Run on cluster
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{job.name}</span>
              <Badge
                variant="outline"
                className="h-5 px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
              >
                {job.type}
              </Badge>
            </span>
            <span
              className="block text-xs leading-snug"
              title="Stage the inputs over SSH, load the chosen relion module, and submit — key files sync back when it lands."
            >
              SSH-stage inputs → load module → submit; key files sync back.
            </span>
          </DialogDescription>
        </DialogHeader>

        {connections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed px-4 py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Server className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium">No cluster connections yet</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Add an SSH login node (host, user, password or key), probe it for relion
                modules, then come back.
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-9 text-sm" onClick={() => setClusterOpen(true)}>
              Manage clusters
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {/* t326 — SECTION: where it runs. Connection + module share a
                  frame; the identity (user@host · module) is not repeated
                  here — the submission preview owns it. t347 — the two
                  selectors sit side by side (they stack below sm). */}
              <section className="space-y-2" data-section-cluster="">
                <SectionLabel>Cluster</SectionLabel>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground/90">Connection</p>
                    <Select
                      value={connId}
                      onValueChange={(v) => {
                        setConnId(v);
                        setModule("");
                        setCustomModule("");
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm" aria-label="Cluster connection">
                        <SelectValue placeholder="Cluster connection" />
                      </SelectTrigger>
                      <SelectContent>
                        {connections.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span
                                className={
                                  c.lastProbe?.ok
                                    ? "size-1.5 shrink-0 rounded-full bg-emerald-500"
                                    : c.lastProbe
                                      ? "size-1.5 shrink-0 rounded-full bg-rose-500"
                                      : "size-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500"
                                }
                                aria-hidden="true"
                              />
                              <span className="max-w-[220px] truncate">{c.name || `${c.username}@${c.host}`}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground/90">relion module</p>
                    {probedModules.length > 0 ? (
                      <Select
                        value={module}
                        onValueChange={(v) => {
                          setModule(v);
                          if (v !== CUSTOM_MODULE_VALUE) setCustomModule("");
                        }}
                      >
                        <SelectTrigger className="h-8 font-mono text-[13px]" aria-label="relion module to load">
                          <SelectValue placeholder="module" />
                        </SelectTrigger>
                        <SelectContent>
                          {probedModules.map((m) => (
                            <SelectItem key={m} value={m} className="font-mono text-xs">
                              {m}
                            </SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_MODULE_VALUE} className="font-mono text-xs italic">
                            other — type a module name…
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={module === CUSTOM_MODULE_VALUE ? customModule : module}
                        onChange={(e) => {
                          setCustomModule(e.target.value.trim());
                          setModule(CUSTOM_MODULE_VALUE);
                        }}
                        placeholder="relion/beta_5.0_gpu_ompi5_cuda118"
                        className="h-8 font-mono text-[13px]"
                        maxLength={200}
                        aria-label="relion module to load"
                      />
                    )}
                    {module === CUSTOM_MODULE_VALUE ? (
                      <div className="space-y-1">
                        <Input
                          autoFocus
                          value={customModule}
                          onChange={(e) => setCustomModule(e.target.value.trim())}
                          placeholder="relion/beta_5.0_gpu_ompi5_cuda118"
                          className="h-8 font-mono text-[13px]"
                          maxLength={200}
                          aria-label="Custom module name"
                        />
                        <p className="text-[10.5px] leading-snug text-muted-foreground/85">
                          Hidden or beta module? Type its exact name — the run&apos;s module-load
                          guard verifies it on the cluster and reports an honest error if the
                          name is wrong. You can also verify it once in the cluster manager.
                        </p>
                      </div>
                    ) : probedModules.length === 0 ? (
                      <p className="text-[10.5px] leading-snug text-amber-600 dark:text-amber-400">
                        module not probed — Test the connection first (Remote clusters in the top bar),
                        or type the exact module name above.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              {/* t326 — SECTION: how it runs. The mode is the structural
                  choice (it gates everything below), so it stopped being a
                  dropdown: two selectable cards, radiogroup semantics, the
                  Slurm card states its own unavailability instead of a
                  disabled option's parenthetical. t347 — one line per card
                  (icon + name + inline subtitle); the unavailability reason
                  also rides the Slurm card's title. */}
              <section className="space-y-2" data-section-mode="">
                <SectionLabel>Run mode</SectionLabel>
                <div
                  role="radiogroup"
                  aria-label="Run mode"
                  className="grid grid-cols-2 gap-2"
                  data-run-mode-cards=""
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === "direct"}
                    onClick={() => setMode("direct")}
                    onKeyDown={onModeCardKey}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                      mode === "direct"
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/25"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 text-sm font-medium",
                        mode === "direct" && "text-primary"
                      )}
                    >
                      <Terminal className="size-3.5" aria-hidden="true" />
                      Direct
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10.5px] leading-snug text-muted-foreground">
                      nohup on the login node
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === "slurm"}
                    aria-disabled={!slurmAvailable}
                    onClick={() => slurmAvailable && setMode("slurm")}
                    onKeyDown={onModeCardKey}
                    title={
                      slurmAvailable
                        ? undefined
                        : "Slurm needs a scheduler client on the cluster — the connection probe found none, so only Direct (nohup on the login node) is offered."
                    }
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                      mode === "slurm"
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/25"
                        : "hover:bg-muted/50",
                      !slurmAvailable && "cursor-not-allowed opacity-60 hover:bg-transparent"
                    )}
                  >
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 text-sm font-medium",
                        mode === "slurm" && "text-primary"
                      )}
                    >
                      <Network className="size-3.5" aria-hidden="true" />
                      Slurm
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10.5px] leading-snug text-muted-foreground">
                      {slurmAvailable
                        ? "sbatch to the scheduler"
                        : "no Slurm client on this cluster"}
                    </span>
                  </button>
                </div>
              </section>

              {/* t326 — the Slurm bundle: partition + GPU width + array
                  split live inside ONE bordered panel that exists only in
                  Slurm mode — the knobs and the mode that gates them share
                  a frame. */}
              {mode === "slurm" ? (
                <section
                  className="space-y-3 rounded-lg border bg-muted/30 p-3"
                  data-slurm-panel=""
                >
                  <SectionLabel>Slurm resources</SectionLabel>

                  {/* t300 — the detected node picker: the probe's sinfo
                      inventory as submit targets. Each option is a node
                      group with its GPU/node figure + hostnames; picking
                      one pins the sbatch (--partition, plus --nodelist
                      when the group is a single node — "Auto" lets the
                      scheduler decide). */}
                  {partitionInventory.length > 0 ? (
                    <div className="space-y-1" data-node-picker-row="">
                      <p className="text-xs font-medium text-foreground/90">Node / partition</p>
                      {/* t338 — the box mirrors the usage-list pin: while a
                          node picked below pins the submission, THIS select
                          shows that node (not a stale "Auto"), and picking
                          anything here releases the pin — the field report
                          「选了节点后 node 框还是 auto」 was exactly this
                          missing mirror. */}
                      <Select
                        value={nodePin ? NODE_PIN_VALUE : partition}
                        onValueChange={(v) => {
                          if (v === NODE_PIN_VALUE) return; // already the pin
                          // any explicit dropdown pick speaks the LATER,
                          // more deliberate choice: the pin from the usage
                          // list stands down (Auto = scheduler decides
                          // again; a partition = the group's own nodes)
                          setPickedNode(null);
                          setPartition(v);
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm" aria-label="Node or partition to submit to">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {nodePin ? (
                            <SelectItem value={NODE_PIN_VALUE} className="text-xs">
                              <span className="flex flex-col gap-0.5">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <MapPin className="size-3 shrink-0 text-primary" aria-hidden="true" />
                                  <span className="font-mono">{nodePin}</span>
                                  {/* t340 — the node's OWN partition rides the
                                      mirror (the usage row's Partitions= word),
                                      so the box speaks the same grammar as a
                                      group pick: WHERE the job lands, node and
                                      partition both named. */}
                                  {pickedNode?.partitions?.[0] ? (
                                    <span className="shrink-0 rounded border border-primary/40 bg-primary/10 px-1 font-mono text-[9.5px] leading-4 text-primary">
                                      {pickedNode.partitions[0]}
                                    </span>
                                  ) : null}
                                  <span className="text-muted-foreground">— pinned from the live list</span>
                                </span>
                                <span className="text-[10px] font-normal text-muted-foreground">
                                  exact node (--nodelist){pickedNode?.partitions?.[0] ? ` in partition ${pickedNode.partitions[0]} (--partition)` : " · partition unknown — the cluster default decides"} · picked in the usage list below · choose Auto or a group here to release
                                </span>
                              </span>
                            </SelectItem>
                          ) : null}
                          <SelectItem value={PARTITION_AUTO} className="text-xs">
                            <span className="flex flex-col gap-0.5">
                              <span>Auto — scheduler picks</span>
                              <span className="text-[10px] font-normal text-muted-foreground">
                                {conn?.slurmPartition
                                  ? `connection default: ${conn.slurmPartition}`
                                  : "the cluster's default partition"}
                              </span>
                            </span>
                          </SelectItem>
                          {partitionInventory.map((p) => (
                            <SelectItem key={p.partition} value={p.partition} className="text-xs">
                              <span className="flex flex-col gap-0.5">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <span className="font-mono">{p.partition}</span>
                                  {p.hosts && p.hosts.length > 0 ? (
                                    <span className="max-w-[180px] truncate font-mono text-[10px] text-muted-foreground">
                                      {p.hosts.slice(0, 3).join(", ")}
                                      {p.hosts.length > 3 ? ` +${p.hosts.length - 3}` : ""}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="text-[10px] font-normal text-muted-foreground">
                                  {p.gpusPerNode} GPU/node · {p.nodes} node{p.nodes === 1 ? "" : "s"}
                                  {p.model ? ` · ${p.model}` : ""}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p
                        className="text-[10.5px] leading-snug text-muted-foreground/85"
                        title={`Detected node groups from this cluster's sinfo — the pick lands the job there (--partition${
                          selectedGroup && selectedGroup.hosts?.length === 1
                            ? ", plus --nodelist pins the group's single node"
                            : ""
                        }). Or click a node in the live usage list below to pin that exact node — even one node inside a multi-host group. The pin submits with the node's own partition (--partition + --nodelist), the same composition a group pick writes.`}
                      >
                        sinfo groups — the pick lands there (<span className="font-mono">--partition</span>);
                        click a node below to pin <span className="font-mono">--nodelist</span>.
                      </p>
                    </div>
                  ) : null}

                  {/* t327 — live node usage (the user's show_free_gpu.sh,
                      promoted into the submit path): per-node GPU/CPU totals
                      vs AllocTRES, from scontrol over SSH. Informational —
                      it never gates the Send button. Sits under the
                      partition picker it informs.
                      t332 — the rows are PICKS: clicking one pins the
                      submission to that node (--nodelist), the pick this
                      dialog's partition dropdown could never express. */}
                  {conn ? (
                    <ClusterUsagePanel
                      connectionId={conn.id}
                      partition={partition === PARTITION_AUTO ? null : partition}
                      ask={usageAsk}
                      pinnedNode={nodePin}
                      onPickNode={setPickedNode}
                    />
                  ) : null}

                  {/* t347 — GPU width + Array split share one row when
                      both exist (the array-eligible types' width truth is
                      a short honesty box, a natural column mate; below sm
                      the pair stacks). Alone, the GPU row keeps the full
                      width. The rows themselves live in the gpuWidthRow /
                      arrayRow variables above — same JSX, one seat each. */}
                  {arrayEligible ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {gpuWidthRow}
                      {arrayRow}
                    </div>
                  ) : (
                    gpuWidthRow
                  )}
                </section>
              ) : null}

              {/* t326 — the submission preview: the sbatch directives
                  these knobs actually produce (every flag shown is one
                  the dispatch writes), plus the identity line the old
                  footer squeezed into middots. The run-mode dialect line
                  keeps its data-run-mode-line hook. */}
              {conn ? (
                <section className="space-y-1" data-submission-preview="">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <SectionLabel>Submission</SectionLabel>
                    <p className="text-[11px] text-muted-foreground" data-run-mode-line="">
                      {mode === "slurm"
                        ? `sbatch${conn.slurmPartition ? ` · ${conn.slurmPartition}` : ""}${
                            logPick
                              ? " · CPU (LoG picker)"
                              : widthIsReal
                                ? ` · ${gpus} GPU(s)`
                                : widthTruth.gpus === 1
                                  ? " · 1 GPU/task"
                                  : " · CPU"
                          }${arrayEligible && shards >= 2 ? ` · array 1-${shards}%4` : ""}`
                        : "runs direct (no scheduler)"}
                    </p>
                  </div>
                  <div className="overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-[10.5px] leading-[1.6] text-muted-foreground">
                    {mode === "slurm" ? (
                      <>
                        <p className="text-foreground/85">
                          <span className="select-none" aria-hidden="true">$ </span>
                          sbatch .cf-sbatch.sh
                        </p>
                        <p>#SBATCH {sbatchDirectives.join("  ")}</p>
                        {!logPick && widthIsReal ? (
                          <p>
                            mpirun -n {mpiRankCount} …{" "}
                            <span className="text-foreground/70">
                              {gpus >= 2
                                ? `--gpu 0 per rank — 1 CPU master + ${gpus} workers, one worker per card (CUDA_VISIBLE_DEVICES)`
                                : "--gpu 0 — one rank on its card, no MPI split"}
                            </span>
                          </p>
                        ) : widthTruth.gpus === 1 ? (
                          <p>relion … --gpu 0 — one GPU task, no mpirun</p>
                        ) : (
                          <p>single CPU task — no mpirun, no --gpu</p>
                        )}
                      </>
                    ) : (
                      <p className="text-foreground/85">
                        <span className="select-none" aria-hidden="true">$ </span>
                        nohup … on the login node — no scheduler
                      </p>
                    )}
                    <p className="mt-1.5 border-t pt-1.5 text-foreground/75">
                      {conn.username}@{conn.host}
                      {conn.port && conn.port !== 22 ? `:${conn.port}` : ""} ·{" "}
                      {effectiveModule ? `module ${effectiveModule}` : "no module"}
                    </p>
                  </div>
                </section>
              ) : null}

              {/* t326 — the lifecycle strip: what happens after Send, in
                  four steps + the sync policy the old intro paragraph
                  carried. t347 — ONE line; the sync policy rides the
                  strip's title. */}
              <div
                className="rounded-lg border border-dashed bg-muted/20 px-3 py-2"
                data-lifecycle-strip=""
                title="STARs, logs and small images sync back automatically; bulky maps and particle stacks stay on the cluster — listed in Results, fetchable on demand."
              >
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Upload className="size-3 shrink-0" aria-hidden="true" />
                    Stage inputs
                  </span>
                  <ChevronRight className="size-3 shrink-0 text-muted-foreground/40" aria-hidden="true" />
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Package className="size-3 shrink-0" aria-hidden="true" />
                    Load module
                  </span>
                  <ChevronRight className="size-3 shrink-0 text-muted-foreground/40" aria-hidden="true" />
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Play className="size-3 shrink-0" aria-hidden="true" />
                    Run
                  </span>
                  <ChevronRight className="size-3 shrink-0 text-muted-foreground/40" aria-hidden="true" />
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <HardDriveDownload className="size-3 shrink-0" aria-hidden="true" />
                    Sync key files back
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" className="h-9 text-sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1.5 text-sm"
                onClick={() => void submit()}
                disabled={pending || !conn || (mode === "slurm" && !slurmAvailable)}
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Server className="size-3.5" aria-hidden="true" />
                )}
                {pending ? "Sending…" : "Send to cluster"}
              </Button>
            </div>
          </>
        )}

        {/* empty-state deep link: the manager floats on top of this dialog */}
        <RemoteClusterDialog
          open={clusterOpen}
          onOpenChange={(v) => {
            setClusterOpen(v);
            if (!v) reload(); // a connection may have just been created/probed
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
