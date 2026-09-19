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
 * one MPI rank per GPU, --gres=gpu:N); the connection's useSlurm flag
 * preselects the mode. The module picker also grew a free-text door: a
 * beta/hidden module the probe never listed can be typed by its exact
 * name (the dispatch's module-load guard reports an honest exit-127 if
 * the name is wrong).
 *
 * t300 — two more defaults became CHOICES: a REMOTE project locks the
 * dialog to its bound cluster (the project's picked paths are absolute
 * THERE — another connection would strand the data), and slurm mode
 * grows the "node / partition" picker from the probe's sinfo inventory
 * (the detected node groups, each with its GPU/node figure and hostname
 * list — picking "brain2" lands the job on that node).
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
import { Loader2, Minus, Plus, Server } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO } from "@/lib/types";
import type { RemoteRunTarget } from "@/lib/remote/types";
import {
  RemoteClusterDialog,
  readActiveRemoteConnectionId,
  useRemoteConnections,
} from "./remote-cluster-dialog";

const CUSTOM_MODULE_VALUE = "__custom__";
const PARTITION_AUTO = "__auto__";
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

/** The relion --gpu flag's device list for N GPUs: "0", "0:1", "0:1:2"… */
function gpuListFor(n: number): string {
  return Array.from({ length: Math.max(1, n) }, (_, i) => i).join(":");
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

  // t300 — the GPU width's ceiling: the SELECTED node group's per-node
  // GPUs (sinfo), falling back to the widest partition the probe saw, else 8.
  const selectedGroup =
    partition === PARTITION_AUTO ? null : partitionInventory.find((p) => p.partition === partition) ?? null;
  const maxGpus = Math.max(
    1,
    Math.min(8, selectedGroup?.gpusPerNode ?? partitionInventory[0]?.gpusPerNode ?? 8)
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
              // but the CPU contract
              ...(logPick ? {} : { gpus }),
              ...(partition !== PARTITION_AUTO ? { partition } : {}),
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
        className="sm:max-w-lg"
        onKeyDown={onEscapeClose(() => setOpen(false))}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="size-4 text-primary" aria-hidden="true" />
            Run on cluster · {job.name}
          </DialogTitle>
          <DialogDescription>
            Dispatch this job over SSH — inputs are staged to the cluster and the
            chosen relion module is loaded. Direct mode starts the process on the
            login node; Slurm mode submits an sbatch script (one MPI rank per GPU)
            and the scheduler places it on a compute node. When it finishes, key
            files (STAR, logs, small images) sync back; bulky maps and stacks stay
            on the cluster, listed in Results and fetchable on demand.
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
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Connection</p>
                <Select
                  value={connId}
                  onValueChange={(v) => {
                    setConnId(v);
                    setModule("");
                    setCustomModule("");
                  }}
                >
                  <SelectTrigger className="h-9 text-sm" aria-label="Cluster connection">
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
                <p className="text-[11px] text-muted-foreground">relion module</p>
                {probedModules.length > 0 ? (
                  <Select
                    value={module}
                    onValueChange={(v) => {
                      setModule(v);
                      if (v !== CUSTOM_MODULE_VALUE) setCustomModule("");
                    }}
                  >
                    <SelectTrigger className="h-9 font-mono text-[13px]" aria-label="relion module to load">
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
                    className="h-9 font-mono text-[13px]"
                    maxLength={200}
                    aria-label="relion module to load"
                  />
                )}
                {module === CUSTOM_MODULE_VALUE ? (
                  <div className="space-y-0.5">
                    <Input
                      autoFocus
                      value={customModule}
                      onChange={(e) => setCustomModule(e.target.value.trim())}
                      placeholder="relion/beta_5.0_gpu_ompi5_cuda118"
                      className="h-9 font-mono text-[13px]"
                      maxLength={200}
                      aria-label="Custom module name"
                    />
                    <p className="text-[10px] leading-snug text-muted-foreground/80">
                      Hidden or beta module? Type its exact name — the run&apos;s module-load
                      guard verifies it on the cluster and reports an honest error if the
                      name is wrong. You can also verify it once in the cluster manager.
                    </p>
                  </div>
                ) : probedModules.length === 0 ? (
                  <p className="text-[10px] leading-snug text-amber-600 dark:text-amber-400">
                    module not probed — Test the connection first (Remote clusters in the top bar),
                    or type the exact module name above.
                  </p>
                ) : null}
              </div>

              {/* t297 — the mode door: direct nohup vs Slurm sbatch */}
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Run mode</p>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v === "slurm" ? "slurm" : "direct")}
                >
                  <SelectTrigger className="h-9 text-sm" aria-label="Run mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct" className="text-xs">
                      Direct — nohup process on the login node
                    </SelectItem>
                    <SelectItem
                      value="slurm"
                      className="text-xs"
                      disabled={!slurmAvailable}
                    >
                      Slurm — sbatch to the scheduler{slurmAvailable ? "" : " (no Slurm client on this cluster)"}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {!slurmAvailable && mode === "slurm" ? (
                  <p className="text-[10px] leading-snug text-amber-600 dark:text-amber-400" role="alert">
                    This cluster&apos;s probe saw no Slurm client — run Test &amp; probe again or use direct mode.
                  </p>
                ) : null}
              </div>

              {/* t300 — the detected node picker (slurm mode): the
                  probe's sinfo inventory as submit targets. Each option is
                  a node group with its GPU/node figure + hostnames; picking
                  one pins the sbatch (--partition, plus --nodelist when the
                  group is a single node — "Auto" lets the scheduler decide). */}
              {mode === "slurm" && partitionInventory.length > 0 ? (
                <div className="space-y-1" data-node-picker-row="">
                  <p className="text-[11px] text-muted-foreground">Node / partition</p>
                  <Select value={partition} onValueChange={setPartition}>
                    <SelectTrigger className="h-9 text-sm" aria-label="Node or partition to submit to">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                  <p className="text-[10px] leading-snug text-muted-foreground/80">
                    Detected node groups from this cluster&apos;s sinfo — the pick lands the job there
                    ({"--partition"}
                    {selectedGroup && selectedGroup.hosts?.length === 1 ? ", --nodelist pins the node" : ""}).
                  </p>
                </div>
              ) : null}

              {/* t297 — the GPU width stepper (slurm mode only): the
                  sbatch6gpu.sh pattern at the width the user picks.
                  t320 — EXCEPT the LoG picker: RELION refuses --gpu on it
                  outright, so the row states the CPU contract instead of
                  offering a width the dispatch would never send. */}
              {mode === "slurm" ? (
                logPick ? (
                  <div className="space-y-1" data-gpu-width-row="" data-log-cpu-row="">
                    <p className="text-[11px] text-muted-foreground">GPUs to request</p>
                    <p className="rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-[11px] leading-snug text-muted-foreground">
                      0 × GPU — CPU-only picker
                    </p>
                    <p className="text-[10px] leading-snug text-muted-foreground/80">
                      Laplacian-of-Gaussian picking runs on the CPU — RELION rejects{" "}
                      <span className="font-mono">--gpu</span> on the LoG picker (its own error:
                      "does not support GPU acceleration"), so no GPUs are requested or
                      allocated. Switch Picking method to References or Topaz to use GPUs.
                    </p>
                  </div>
                ) : (
                <div className="space-y-1" data-gpu-width-row="">
                  <p className="text-[11px] text-muted-foreground">GPUs to request</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => setGpus((g) => Math.max(1, g - 1))}
                      disabled={gpus <= 1}
                      aria-label="One GPU less"
                    >
                      <Minus className="size-3.5" aria-hidden="true" />
                    </Button>
                    <span
                      className="min-w-14 rounded-md border bg-muted/40 px-2 py-1.5 text-center font-mono text-sm font-semibold tabular-nums"
                      aria-live="polite"
                      aria-label={`${gpus} GPU${gpus === 1 ? "" : "s"} requested`}
                    >
                      {gpus} × GPU
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => setGpus((g) => Math.min(maxGpus, g + 1))}
                      disabled={gpus >= maxGpus}
                      aria-label="One GPU more"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </Button>
                    <p className="min-w-0 flex-1 text-[10px] leading-snug text-muted-foreground/80">
                      One MPI rank per GPU —{" "}
                      <span className="font-mono">--gres=gpu:{gpus}</span>,{" "}
                      <span className="font-mono">mpirun -n {gpus}</span>,{" "}
                      <span className="font-mono">--gpu {gpuListFor(gpus)}</span>
                      {(selectedGroup ?? partitionInventory[0]) != null
                        ? ` · ${(selectedGroup ?? partitionInventory[0])!.partition} offers ${(selectedGroup ?? partitionInventory[0])!.gpusPerNode}/node`
                        : ""}
                    </p>
                  </div>
                </div>
                )
              ) : null}

              {/* t306 — the array split stepper (slurm mode, eligible types
                  only): 1 = a single job (the old contract), 2..64 shards
                  ride ONE sbatch --array=1-N%4 — each task slices the input
                  STAR by SLURM_ARRAY_TASK_ID, and the last task home merges
                  the shard output stars back into the canonical one, so
                  downstream jobs and Results never learn it was an array. */}
              {mode === "slurm" && arrayEligible ? (
                <div className="space-y-1" data-array-shards-row="">
                  <p className="text-[11px] text-muted-foreground">Array split</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => setShards((s) => Math.max(1, s - 1))}
                      disabled={shards <= 1}
                      aria-label="One shard fewer"
                    >
                      <Minus className="size-3.5" aria-hidden="true" />
                    </Button>
                    <span
                      className="min-w-20 rounded-md border bg-muted/40 px-2 py-1.5 text-center font-mono text-sm font-semibold tabular-nums"
                      aria-live="polite"
                      aria-label={shards >= 2 ? `${shards} array shards` : "single job, no split"}
                    >
                      {shards >= 2 ? `${shards} shards` : "1 × job"}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => setShards((s) => Math.min(ARRAY_MAX_SHARDS, s + 1))}
                      disabled={shards >= ARRAY_MAX_SHARDS}
                      aria-label="One shard more"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </Button>
                    <p className="min-w-0 flex-1 text-[10px] leading-snug text-muted-foreground/80">
                      {shards >= 2 ? (
                        <>
                          One <span className="font-mono">sbatch --array=1-{shards}%4</span> — each
                          shard takes every {shards}
                          <sup className="text-[8px]">th</sup> micrograph; the last shard home merges
                          the outputs. 1 job = no split.
                        </>
                      ) : (
                        <>Split per micrograph for data-parallel steps (MotionCorr, CTF Find). 1 job = no split.</>
                      )}
                    </p>
                  </div>
                </div>
              ) : null}

              {conn ? (
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">
                    {conn.username}@{conn.host}
                  </span>
                  <span aria-hidden="true">·</span>
                  {effectiveModule ? (
                    <Badge variant="outline" className="h-4 px-1 font-mono text-[9.5px] text-foreground/80">
                      module {effectiveModule}
                    </Badge>
                  ) : (
                    <span>no module</span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span data-run-mode-line="">
                    {mode === "slurm"
                      ? `sbatch${conn.slurmPartition ? ` · ${conn.slurmPartition}` : ""}${logPick ? " · CPU (LoG picker)" : gpus > 0 ? ` · ${gpus} GPU(s)` : ""}${arrayEligible && shards >= 2 ? ` · array 1-${shards}%4` : ""}`
                      : "runs direct (no scheduler)"}
                  </span>
                </p>
              ) : null}
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
