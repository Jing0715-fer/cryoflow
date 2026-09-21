"use client";

/**
 * CryoFlow — live node usage in the Run-on-cluster dialog (t327).
 *
 * The user's own show_free_gpu.sh, promoted into the submit path: one row
 * per node — what it HAS (Gres=gpu:N, CPUTot) and what is already spoken
 * for (AllocTRES=cpu=X,gres/gpu=Y), the exact fields their script greps
 * out of `scontrol show nodes`. The panel rides the
 * /api/remote/connections/[id]/usage route (one SSH exec of
 * `scontrol show nodes -o`, short-TTL cached server-side) so opening the
 * dialog never storms the login node: an auto-refresh every 30s while
 * the Slurm panel is alive, plus a manual refresh that bypasses the
 * cache.
 *
 * Honesty rules (the project's own doctrine):
 *   - the usage is INFORMATIONAL — it never blocks or gates the Send
 *     button; a cluster without scontrol, or an SSH hiccup, degrades to
 *     a rose note that says exactly what failed;
 *   - the bars show USED share; the FREE count is the number that
 *     matters, so it carries the color (enough for the ask = emerald,
 *     less than the ask = amber, none = rose) — never a decorative
 *     gradient;
 *   - the ask line states what THIS submission would need right now
 *     (per-task GPUs × simultaneous tasks, the %4 array concurrency
 *     included) and compares it to the picked partition's free GPUs —
 *     the user picks a partition with their eyes open, which is the
 *     whole point of the ticket.
 *
 * t332 — the rows became PICKS: with onPickNode wired (the run dialog),
 * clicking a node pins the submission to it (`--nodelist`) — the pick
 * the partition dropdown could never express (a single node inside a
 * multi-host group). The pinned row wears the pin (ring + MapPin), the
 * ask line re-scopes to THAT node's free GPUs, and the mismatch guard
 * releases the pin when a later partition change would strand it (a
 * --partition/--nodelist contradiction is a submit-time refusal on
 * real controllers). Still informational: the Send predicate never
 * consults the pick, and unavailable rows (DRAIN/DOWN…) refuse the
 * click honestly instead of composing a doomed sbatch.
 */

import * as React from "react";
import { Activity, Loader2, MapPin, RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNow } from "@/lib/use-now";
import {
  nodeFreeCpus,
  nodeFreeGpus,
  nodeUnavailable,
  sortNodesForDisplay,
  type SlurmNodeUsage,
} from "@/lib/hpc/slurm-usage";

/** What /api/remote/connections/[id]/usage answers (mirrored client side). */
interface ClusterUsageResponse {
  ok: boolean;
  checkedAt?: string;
  nodes?: SlurmNodeUsage[];
  command?: string;
  error?: string;
}

/** The colored dot + word for a node's state. */
function StateChip({ state }: { state: string }) {
  const tone =
    state === "IDLE"
      ? "text-emerald-600 dark:text-emerald-400"
      : state === "MIXED"
        ? "text-amber-600 dark:text-amber-400"
        : state === "ALLOCATED"
          ? "text-muted-foreground"
          : nodeUnavailable({ state })
            ? "text-rose-600 dark:text-rose-400"
            : "text-muted-foreground";
  return (
    <span className={cn("shrink-0 font-mono text-[10px] font-medium", tone)}>
      {state || "—"}
    </span>
  );
}

/** One thin used-share bar. The bar is decoration (aria-hidden); the free
 *  count text carries the meaning. */
function ShareBar({
  used,
  total,
  tone,
}: {
  used: number;
  total: number;
  tone: "enough" | "tight" | "none" | "neutral";
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <span className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <span
        className={cn(
          "block h-full rounded-full transition-[width] duration-300",
          tone === "none"
            ? "bg-rose-500/70"
            : tone === "tight"
              ? "bg-amber-500/70"
              : "bg-foreground/30"
        )}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

export function ClusterUsagePanel({
  connectionId,
  /** the picked partition (null = Auto — the scheduler picks). */
  partition,
  /** what this submission needs NOW: per-task GPUs × simultaneous tasks. */
  ask,
  /** t332 — the node the sbatch pins (--nodelist), picked from THIS
   *  list; the row wears the pin and the highlight. null/absent when
   *  the caller offers no picking (the panel stays read-only). */
  pinnedNode = null,
  /** t332 — row click → pick that node for the submission (null =
   *  release). Absent = read-only rows (no pointer, no hint). */
  onPickNode,
}: {
  connectionId: string;
  partition: string | null;
  ask: { gpus: number; tasks: number };
  pinnedNode?: string | null;
  onPickNode?: (node: SlurmNodeUsage | null) => void;
}) {
  const [data, setData] = React.useState<ClusterUsageResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [failedOnce, setFailedOnce] = React.useState(false);

  const load = React.useCallback(
    async (bypassCache: boolean) => {
      if (!connectionId) return;
      if (bypassCache) setRefreshing(true);
      try {
        const r = await fetch(
          `/api/remote/connections/${encodeURIComponent(connectionId)}/usage` +
            (bypassCache ? "?refresh=1" : "")
        );
        const d = (await r.json()) as ClusterUsageResponse;
        setData(d);
        if (!d.ok) setFailedOnce(true);
      } catch {
        setData({ ok: false, error: "request failed — the app server could not be reached" });
        setFailedOnce(true);
      } finally {
        setLoading(false);
        if (bypassCache) setRefreshing(false);
      }
    },
    [connectionId]
  );

  // fetch on mount + whenever the connection changes, then keep it alive
  // with a 30s auto-refresh while the panel exists (the server's own TTL
  // dedupes clusters: two dialogs never double the SSH load).
  React.useEffect(() => {
    setData(null);
    setLoading(true);
    setFailedOnce(false);
    void load(false);
    const t = window.setInterval(() => void load(false), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const now = useNow(!!data?.checkedAt);
  const ageSec = React.useMemo(() => {
    if (!data?.checkedAt || !now) return null;
    return Math.max(0, Math.round((now - Date.parse(data.checkedAt)) / 1000));
  }, [data?.checkedAt, now]);

  const nodes = React.useMemo(
    () => (data?.ok && data.nodes ? sortNodesForDisplay(data.nodes) : []),
    [data]
  );

  // t332/t340 — the mismatch guard is RETIRED. It fired on the
  // partition prop, which the dialog AUTO-INITIALIZES to the connection's
  // default — so pinning any node outside that default released the pin
  // the instant it landed (the "dead pick" the field reports kept meeting:
  // click a node, the box never shows it). Real coherence now lives one
  // level deeper: the pinned submission resolves the node's OWN partition
  // (scontrol, server-side), and the dialog's preview/payload ignore the
  // partition state entirely while a pin speaks — a
  // --partition/--nodelist contradiction can no longer be composed from
  // here. An explicit group pick still releases the pin atomically in the
  // dropdown's own onValueChange, and a node that leaves its partition
  // between pick and submit meets the engine's live pre-flight.

  // the ask line's truth: which nodes this ask could land on, and how
  // many GPUs are free there (a partition's rows are highlighted; Auto
  // reads the whole cluster).
  const askLine = React.useMemo(() => {
    if (nodes.length === 0) return null;
    const gpusNeeded = ask.gpus * Math.max(1, ask.tasks);
    // t332 — a pinned node re-scopes the ask: the WHOLE submission lands
    // on that node (an array's shards too — --nodelist binds every task),
    // so the free count that matters is the node's own, not the
    // partition's sum. The need phrase keeps the shards arithmetic when
    // an array rides.
    const need =
      ask.tasks > 1
        ? `${gpusNeeded} GPUs at once (${ask.tasks} shards × ${ask.gpus})`
        : `${gpusNeeded} GPU(s)`;
    const pinnedRow = pinnedNode ? nodes.find((n) => n.node === pinnedNode) : undefined;
    if (pinnedRow) {
      if (gpusNeeded <= 0) {
        const cpus = nodeFreeCpus(pinnedRow);
        return cpus > 0
          ? {
              tone: "enough" as const,
              text: `Your ask: CPU only — pinned to ${pinnedRow.node}, ${cpus.toLocaleString()} cores free there.`,
            }
          : {
              tone: "tight" as const,
              text: `Your ask: CPU only — pinned to ${pinnedRow.node}, but no cores are free there; the job will queue.`,
            };
      }
      if (pinnedRow.gpuTotal === 0) {
        return {
          tone: "tight" as const,
          text: `Your ask: ${need} pinned to ${pinnedRow.node} — that node reports NO GPUs (Gres lists none); pick a different node.`,
        };
      }
      const free = nodeFreeGpus(pinnedRow);
      return free >= gpusNeeded
        ? {
            tone: "enough" as const,
            text: `Your ask: ${need} pinned to ${pinnedRow.node} — ${free} free there now.`,
          }
        : {
            tone: "tight" as const,
            text: `Your ask: ${need} pinned to ${pinnedRow.node} — only ${free} free there; the job will queue until GPUs release.`,
          };
    }
    const target = partition
      ? nodes.filter((n) => n.partitions.includes(partition))
      : nodes;
    if (target.length === 0) {
      return {
        tone: "neutral" as const,
        text: `Your ask: ${gpusNeeded > 0 ? `${gpusNeeded} GPU(s)` : "CPU only"} — no node reports the "${partition}" partition right now.`,
      };
    }
    if (gpusNeeded <= 0) {
      const cpus = target.reduce((a, n) => a + nodeFreeCpus(n), 0);
      return {
        tone: "enough" as const,
        text: `Your ask: CPU only — ${cpus.toLocaleString()} cores free ${
          partition ? `in ${partition}` : "across the cluster"
        }.`,
      };
    }
    // a single task's GPUs must sit on ONE node (MPI width / single-GPU
    // steps never span nodes in this app's sbatch); an array's concurrent
    // shards may spread, so the sum is the honest ceiling there.
    const bestNode = target.reduce(
      (best, n) => (nodeFreeGpus(n) > nodeFreeGpus(best) ? n : best),
      target[0]
    );
    const singleNodeFree = nodeFreeGpus(bestNode);
    const sumFree = target.reduce((a, n) => a + nodeFreeGpus(n), 0);
    const where = partition ?? "auto";
    if (ask.tasks > 1) {
      return sumFree >= gpusNeeded
        ? {
            tone: "enough" as const,
            text: `Your ask: ${gpusNeeded} GPUs at once (${ask.tasks} shards × ${ask.gpus}) — ${sumFree} free across ${where}'s nodes.`,
          }
        : {
            tone: "tight" as const,
            text: `Your ask: ${gpusNeeded} GPUs at once (${ask.tasks} shards × ${ask.gpus}) — only ${sumFree} free across ${where}'s nodes; shards will queue.`,
          };
    }
    return singleNodeFree >= ask.gpus
      ? {
          tone: "enough" as const,
          text: `Your ask: ${ask.gpus} GPU(s) on ${where} — ${singleNodeFree} free on ${bestNode.node} now.`,
        }
      : {
          tone: "tight" as const,
          text: `Your ask: ${ask.gpus} GPU(s) on ${where} — only ${singleNodeFree} free on ${bestNode.node}; the job will queue until GPUs release.`,
        };
    // t332 — pinnedNode rides the deps: the pinned branch must re-scope
    // the moment the pick lands (a memo that ignores its own input is a
    // stale lie — caught browser-live)
  }, [nodes, partition, ask, pinnedNode]);

  return (
    <div className="space-y-2" data-cluster-usage-panel="">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-foreground/90">
          <Activity className="size-3.5 text-primary" aria-hidden="true" />
          Live node usage
        </p>
        <span className="flex items-center gap-1.5">
          {ageSec != null ? (
            <span className="font-mono text-[10px] text-muted-foreground/80" data-usage-age="">
              {ageSec < 5 ? "just now" : `${ageSec}s ago`}
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => void load(true)}
            disabled={refreshing || loading || !connectionId}
            aria-label="Refresh live node usage"
            title="Refresh (bypasses the 15s cache)"
          >
            {refreshing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        </span>
      </div>

      {/* t332 — the picking hint: the rows are picks when the caller
          wires onPickNode (the run dialog); read-only callers see no
          affordance that would lie. */}
      {onPickNode && !loading && data?.ok && nodes.length > 0 ? (
        <p className="px-1 text-[10px] leading-snug text-muted-foreground/85" data-usage-pick-hint="">
          Click a node to pin this submission to it — the sbatch lands{" "}
          <span className="font-mono">--nodelist</span> on that node; click the pinned row
          again to release.
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-1.5 rounded-md border bg-muted/20 p-2.5" aria-label="Loading node usage">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-muted/70" />
          ))}
        </div>
      ) : !data?.ok ? (
        <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/[0.06] px-2.5 py-2" role="note">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          <p className="text-[10.5px] leading-snug text-rose-700 dark:text-rose-300">
            Live usage unavailable — {data?.error ?? "unknown error"}. The submit
            button still works; this panel is informational.
          </p>
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded-md border bg-muted/20 px-2.5 py-2 text-[10.5px] leading-snug text-muted-foreground">
          Slurm reported no nodes — usage appears when the scheduler does.
        </div>
      ) : (
        <div
          className="nice-scroll max-h-56 space-y-1.5 overflow-y-auto rounded-md border bg-muted/20 p-2"
          role="list"
          aria-label="Node GPU and CPU usage"
        >
          {nodes.slice(0, 32).map((n) => {
            const gFree = nodeFreeGpus(n);
            const cFree = nodeFreeCpus(n);
            const isTarget =
              partition != null && n.partitions.includes(partition);
            // t332 — the pick state: pinned (the sbatch's --nodelist),
            // pickable (an available node + a wired picker), or honestly
            // refused (DRAIN/DOWN… never composes a doomed sbatch)
            const pinned = pinnedNode === n.node;
            const unavailable = nodeUnavailable({ state: n.state });
            const pickable = !!onPickNode && !unavailable;
            const gTone =
              n.gpuTotal === 0
                ? "neutral"
                : gFree === 0
                  ? "none"
                  : ask.gpus > 0 && gFree < ask.gpus * Math.max(1, ask.tasks)
                    ? "tight"
                    : "enough";
            const pickLabel = n.gpuTotal > 0
              ? `${n.node}: ${gFree}/${n.gpuTotal} GPUs free — pin this submission to it`
              : `${n.node}: ${cFree}/${n.cpuTotal} CPUs free, no GPUs — pin this submission to it`;
            return (
              <div key={n.node} role="listitem" data-usage-node={n.node}>
                {/* t332 — the row is a real button when picking is wired:
                    keyboard + focus + aria-pressed come native; the whole
                    occupancy block stays visible inside it. */}
                <button
                  type="button"
                  onClick={pickable ? () => onPickNode?.(pinned ? null : n) : undefined}
                  disabled={!pickable}
                  aria-pressed={pinned}
                  aria-label={pickLabel}
                  title={
                    pinned
                      ? `Pinned — click to release (--nodelist=${n.node})`
                      : pickable
                        ? `Submit to this node (--nodelist=${n.node})`
                        : `${n.state} — not taking jobs right now`
                  }
                  className={cn(
                    "w-full rounded-md border bg-background/60 px-2.5 py-2 text-left transition-colors",
                    pickable &&
                      "cursor-pointer hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !pickable && "cursor-not-allowed opacity-70",
                    pinned
                      ? "border-primary bg-primary/[0.05] ring-1 ring-primary/30"
                      : isTarget && "border-primary/50 ring-1 ring-primary/25"
                  )}
                >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {pinned ? (
                      <MapPin className="size-3 shrink-0 text-primary" aria-hidden="true" />
                    ) : null}
                    <span
                      className={cn(
                        "truncate font-mono text-[11px] font-semibold",
                        pinned ? "text-primary" : "text-foreground/90"
                      )}
                    >
                      {n.node}
                    </span>
                    {n.partitions.slice(0, 2).map((p) => (
                      <span
                        key={p}
                        className={cn(
                          "shrink-0 rounded border px-1 font-mono text-[9.5px] leading-4",
                          p === partition
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "bg-muted/60 text-muted-foreground"
                        )}
                      >
                        {p}
                      </span>
                    ))}
                  </span>
                  <StateChip state={n.state} />
                </div>
                {n.gpuTotal > 0 ? (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-7 shrink-0 font-mono text-[9.5px] font-semibold text-muted-foreground">
                        GPU
                      </span>
                      <ShareBar used={n.gpuAlloc} total={n.gpuTotal} tone={gTone} />
                      <span
                        className={cn(
                          "w-[86px] shrink-0 text-right font-mono text-[10px] tabular-nums",
                          gFree === 0
                            ? "text-rose-600 dark:text-rose-400"
                            : gTone === "tight"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {gFree}/{n.gpuTotal} free
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-7 shrink-0 font-mono text-[9.5px] font-semibold text-muted-foreground">
                        CPU
                      </span>
                      <ShareBar
                        used={n.cpuAlloc}
                        total={n.cpuTotal}
                        tone={cFree === 0 ? "none" : "neutral"}
                      />
                      <span className="w-[86px] shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                        {cFree}/{n.cpuTotal} free
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="w-7 shrink-0 font-mono text-[9.5px] font-semibold text-muted-foreground">
                      CPU
                    </span>
                    <ShareBar
                      used={n.cpuAlloc}
                      total={n.cpuTotal}
                      tone={cFree === 0 ? "none" : "neutral"}
                    />
                    <span className="w-[86px] shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {cFree}/{n.cpuTotal} free
                    </span>
                  </div>
                )}
                </button>
              </div>
            );
          })}
          {nodes.length > 32 ? (
            <p className="px-1 py-0.5 text-[10px] text-muted-foreground">
              +{nodes.length - 32} more nodes not shown.
            </p>
          ) : null}
        </div>
      )}

      {askLine ? (
        <p
          className={cn(
            "flex items-start gap-1.5 px-1 text-[10.5px] leading-snug",
            askLine.tone === "enough"
              ? "text-emerald-700 dark:text-emerald-300"
              : askLine.tone === "tight"
                ? "text-amber-700 dark:text-amber-300"
                : "text-muted-foreground"
          )}
          data-usage-ask-line=""
        >
          {askLine.tone === "tight" ? (
            <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          ) : null}
          {askLine.text}
        </p>
      ) : null}

      {!failedOnce && data?.ok ? (
        <p className="px-1 text-[10px] leading-snug text-muted-foreground/70">
          From this cluster&apos;s{" "}
          <span className="font-mono">{data.command ?? "scontrol show nodes -o"}</span> —
          totals are Gres/CPUTot, usage is AllocTRES (the fields show_free_gpu.sh reads).
          Auto-refreshes every 30s.
        </p>
      ) : null}
    </div>
  );
}
