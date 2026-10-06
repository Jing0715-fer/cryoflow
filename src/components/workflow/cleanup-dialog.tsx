"use client";

/**
 * CryoFlow — CleanupDialog (t331, 「增加清理中间过程文件的功能，包括本地
 * 和cluster」): the preview-and-execute surface for intermediate-file
 * cleanup on BOTH sides of the wire.
 *
 * The dialog is the t327 doctrine's destructive sibling: the PLAN is
 * information (per-side tier groups, counts, bytes, consequences spelled
 * out, the keep-set's own account visible), and DELETION is an explicit,
 * two-step choice (checkboxes per tier — only "safe" defaults on — then a
 * confirm that names the counts). The dialog never sends a file list:
 * the POST carries only scopes + tiers, and the server re-plans against
 * the live tree (a preview that drifts cannot delete the wrong thing).
 *
 * Honesty surfaces:
 *   - a cluster that cannot answer degrades to a rose note — the LOCAL
 *     side still cleans (one side's outage never blocks the other);
 *   - the bulk tier (movies / particle stacks) carries the downstream
 *     consequence line when wired jobs have not run yet;
 *   - a running/queued job refuses with its reason (the t318 respect).
 */

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Eraser,
  HardDrive,
  History,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CLEANUP_TIERS,
  type CleanupPlan,
  type CleanupSidePlan,
  type CleanupTierId,
} from "@/lib/hpc/cleanup";
import { toast } from "@/hooks/use-toast";
import type { CleanupHistoryEntry } from "@/lib/relion/cleanup-history";
import type { JobDTO } from "@/lib/types";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface CleanupDialogProps {
  job: JobDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** called after a successful cleanup so the caller can refresh listings */
  onCleaned?: () => void;
}

export function CleanupDialog({ job, open, onOpenChange, onCleaned }: CleanupDialogProps) {
  const [plan, setPlan] = React.useState<CleanupPlan | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tierSel, setTierSel] = React.useState<Record<CleanupTierId, boolean>>({
    safe: true,
    diagnostics: false,
    bulk: false,
  });
  const [scopeLocal, setScopeLocal] = React.useState(true);
  const [scopeRemote, setScopeRemote] = React.useState(true);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [executing, setExecuting] = React.useState(false);
  // t522 — the shovel's own past: this job's ledger entries (either door),
  // newest first, at most three on the strip. The audit rides with the ask.
  const [history, setHistory] = React.useState<CleanupHistoryEntry[] | null>(null);

  const loadHistory = React.useCallback(async () => {
    try {
      const res = await fetch("/api/cleanup-history", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { entries?: CleanupHistoryEntry[] };
      setHistory((body.entries ?? []).filter((e) => e.jobId === job.id).slice(0, 3));
    } catch {
      /* the strip is a witness too — an unreachable ledger just stays hidden */
    }
  }, [job.id]);

  const loadPlan = React.useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/jobs/${job.id}/cleanup${refresh ? "?refresh=1" : ""}`,
          { cache: "no-store" }
        );
        const body = (await res.json()) as CleanupPlan | { error: string };
        if (!res.ok || "error" in body) {
          setError("error" in body ? body.error : `the plan failed (HTTP ${res.status})`);
          setPlan(null);
        } else {
          setPlan(body);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "the plan could not be fetched");
        setPlan(null);
      } finally {
        setLoading(false);
      }
    },
    [job.id]
  );

  React.useEffect(() => {
    if (open) {
      void loadPlan();
      void loadHistory();
    }
  }, [open, loadPlan, loadHistory]);

  // the offered tiers reset the checkboxes to their doctrine defaults
  // every time a fresh plan lands (safe on, the sharp ones opt-in)
  const offered = React.useMemo(() => {
    if (!plan) return [] as CleanupTierId[];
    const set = new Set<CleanupTierId>();
    for (const g of plan.local.groups) set.add(g.tier);
    if (plan.remote) for (const g of plan.remote.groups) set.add(g.tier);
    return (["safe", "diagnostics", "bulk"] as CleanupTierId[]).filter((t) => set.has(t));
  }, [plan]);

  const localSelected = plan?.local.exists ?? false;
  const remoteAvailable = plan?.remote?.exists ?? false;
  const remoteKnown = plan?.remote?.known ?? false;

  // what the current selection would do (the confirm line's own numbers —
  // recomputed from the plan, never from a stale snapshot)
  const selection = React.useMemo(() => {
    let files = 0;
    let bytes = 0;
    const sides: string[] = [];
    if (plan) {
      if (scopeLocal && plan.local.exists) {
        sides.push("local");
        for (const g of plan.local.groups) {
          if (tierSel[g.tier]) {
            files += g.count;
            bytes += g.bytes;
          }
        }
      }
      if (scopeRemote && plan.remote?.exists) {
        sides.push("cluster");
        for (const g of plan.remote.groups) {
          if (tierSel[g.tier]) {
            files += g.count;
            bytes += g.bytes;
          }
        }
      }
    }
    return { files, bytes, sides };
  }, [plan, tierSel, scopeLocal, scopeRemote]);

  const canClean =
    !!plan &&
    plan.runnable &&
    selection.files > 0 &&
    (scopeLocal || scopeRemote) &&
    (!scopeLocal || localSelected) &&
    (!scopeRemote || remoteAvailable);

  const downstreamNotRun = React.useMemo(
    () =>
      (plan?.downstream ?? []).filter(
        (d) => d.status !== "completed" && d.status !== "failed"
      ),
    [plan]
  );
  const bulkOffered = offered.includes("bulk") && tierSel.bulk;

  const execute = async () => {
    setExecuting(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          local: scopeLocal && (plan?.local.exists ?? false),
          remote: scopeRemote && (plan?.remote?.exists ?? false),
          tiers: offered.filter((t) => tierSel[t]),
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        local?: { deleted: number; freedBytes: number; errors: string[] };
        remote?: { deleted: number; freedBytes: number; errors: string[]; manifestRewritten: boolean } | null;
      };
      if (!res.ok || body.error) {
        toast({
          title: "Cleanup refused",
          description: body.error ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      const parts: string[] = [];
      if (body.local) parts.push(`${body.local.deleted} local file${body.local.deleted === 1 ? "" : "s"} · ${fmtBytes(body.local.freedBytes)} freed`);
      if (body.remote) parts.push(`${body.remote.deleted} cluster file${body.remote.deleted === 1 ? "" : "s"} · ${fmtBytes(body.remote.freedBytes)} freed`);
      const errs = [...(body.local?.errors ?? []), ...(body.remote?.errors ?? [])];
      toast({
        title: "Intermediates cleaned",
        description: parts.length > 0 ? parts.join(" · ") : "nothing matched the selection",
        ...(errs.length > 0
          ? {
              variant: "destructive",
              description: `${parts.join(" · ")} — ${errs.length} error${errs.length === 1 ? "" : "s"}: ${errs[0]}`,
            }
          : {}),
      });
      onCleaned?.();
      void loadHistory();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Cleanup failed",
        description: e instanceof Error ? e.message : "the request could not be sent",
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-cleanup-dialog=""
          className="flex max-h-[85vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogHeader className="shrink-0 border-b px-5 py-4 sm:px-6">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Eraser className="size-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              Clean intermediates
            </DialogTitle>
            <DialogDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium text-foreground/90">{job.name}</span>
              <Badge variant="outline" className="h-4 px-1 font-mono text-[9.5px] font-normal text-foreground/80">
                {job.type}
              </Badge>
              <span>— chainable outputs, logs, resume checkpoints and cluster twins always stay.</span>
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Surveying the run directory…
              </div>
            ) : error ? (
              <div
                role="alert"
                className="rounded-md border border-rose-500/30 bg-danger/[0.06] px-3 py-2.5 text-xs text-danger"
              >
                {error}
              </div>
            ) : plan ? (
              <div className="flex flex-col gap-4">
                {plan.runnable ? null : (
                  <div
                    role="note"
                    className="rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300"
                    data-cleanup-blocked-note=""
                  >
                    {plan.reason}
                  </div>
                )}

                {history && history.length > 0 ? (
                  <div
                    data-cleanup-history=""
                    className="rounded-md border bg-muted/30 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <History className="size-3" aria-hidden="true" />
                      Recent cleanups on this job
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {history.map((e, i) => (
                        <li
                          key={`${e.at}-${i}`}
                          className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-muted-foreground"
                        >
                          <span className="font-mono text-[10px] text-foreground/60">
                            {new Date(e.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </span>
                          <Badge
                            variant="outline"
                            className="h-3.5 px-1 font-mono text-[8.5px] font-normal uppercase tracking-wide text-foreground/70"
                          >
                            {e.door}
                          </Badge>
                          {!e.ok ? (
                            <span className="text-amber-700 dark:text-amber-300">
                              refused — {e.error ?? "no reason recorded"}
                            </span>
                          ) : (
                            <span>
                              {[
                                e.local ? `${e.local.deleted} local file${e.local.deleted === 1 ? "" : "s"} · ${fmtBytes(e.local.freedBytes)}` : null,
                                e.remote ? `${e.remote.deleted} cluster file${e.remote.deleted === 1 ? "" : "s"} · ${fmtBytes(e.remote.freedBytes)}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "nothing matched the tiers"}
                              {" · "}
                              {e.tiers.join("+")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <SideCard
                  side="local"
                  icon={<HardDrive className="size-3.5" aria-hidden="true" />}
                  title="This machine"
                  sidePlan={plan.local}
                  tierSel={tierSel}
                  onTier={(t, v) => setTierSel((s) => ({ ...s, [t]: v }))}
                  scopeChecked={scopeLocal}
                  onScope={(v) => setScopeLocal(v)}
                  scopeDisabled={!plan.local.exists}
                />

                {plan.remote ? (
                  <SideCard
                    side="remote"
                    icon={<Server className="size-3.5" aria-hidden="true" />}
                    title={
                      plan.remote.connection
                        ? `Cluster — ${plan.remote.connection.user}@${plan.remote.connection.host}`
                        : "Cluster"
                    }
                    sidePlan={plan.remote}
                    tierSel={tierSel}
                    onTier={(t, v) => setTierSel((s) => ({ ...s, [t]: v }))}
                    scopeChecked={scopeRemote}
                    onScope={(v) => setScopeRemote(v)}
                    scopeDisabled={!plan.remote.exists}
                  />
                ) : null}

                {bulkOffered && downstreamNotRun.length > 0 ? (
                  <div
                    role="note"
                    data-cleanup-downstream-warning=""
                    className="rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300"
                  >
                    <span className="inline-flex items-center gap-1 font-medium">
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                      {downstreamNotRun.length} downstream job{downstreamNotRun.length === 1 ? "" : "s"}{" "}
                      {downstreamNotRun.length === 1 ? "reads" : "read"} these images and{" "}
                      {downstreamNotRun.length === 1 ? "has" : "have"} not run yet:{" "}
                      {downstreamNotRun.map((d) => `${d.name} (${d.status})`).join(", ")}.
                    </span>{" "}
                    Deleting the bulk tier breaks their next run — completed downstream jobs keep their own outputs.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 flex-wrap items-center gap-2 border-t bg-muted/30 px-5 py-3 sm:px-6">
            <span
              data-cleanup-keep-line=""
              className="mr-auto hidden min-w-0 truncate text-[11px] text-muted-foreground sm:block"
            >
              {plan && (plan.local.exists || plan.remote?.exists)
                ? `${plan.local.kept.count + (plan.remote?.kept.count ?? 0)} file${
                    plan.local.kept.count + (plan.remote?.kept.count ?? 0) === 1 ? "" : "s"
                  } stay (outputs · logs · checkpoints · twins)`
                : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => void loadPlan(true)}
              disabled={loading || executing}
              aria-label="Re-survey the run directory (fresh)"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => onOpenChange(false)}
              disabled={executing}
            >
              Close
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1.5 px-3 text-xs"
              disabled={!canClean || executing}
              onClick={() => setConfirmOpen(true)}
              aria-label={`Clean ${selection.files} files (about ${fmtBytes(selection.bytes)})`}
              data-cleanup-run-line=""
            >
              {executing ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Eraser className="size-3.5" aria-hidden="true" />
              )}
              {selection.files > 0
                ? `Clean ${selection.files} file${selection.files === 1 ? "" : "s"} · ~${fmtBytes(selection.bytes)}`
                : "Clean…"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-cleanup-confirm="">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Delete {selection.files} intermediate file{selection.files === 1 ? "" : "s"} (~{fmtBytes(selection.bytes)})?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              On {selection.sides.length > 0 ? selection.sides.join(" + ") : "no side"}:{" "}
              {offered
                .filter((t) => tierSel[t])
                .map((t) => CLEANUP_TIERS.find((m) => m.id === t)?.label.toLowerCase())
                .join(", ")}
              . The keep-set (chainable outputs, logs, resume checkpoints, cluster twins) is not touched. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs" disabled={executing}>
              Keep them
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 gap-1.5 bg-rose-600 text-xs text-white hover:bg-rose-700"
              disabled={executing}
              onClick={(e) => {
                e.preventDefault();
                void execute();
              }}
            >
              {executing ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
              Delete them
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* One side (local / cluster)                                           */
/* ------------------------------------------------------------------ */

function SideCard({
  side,
  icon,
  title,
  sidePlan,
  tierSel,
  onTier,
  scopeChecked,
  onScope,
  scopeDisabled,
}: {
  side: "local" | "remote";
  icon: React.ReactNode;
  title: string;
  sidePlan: CleanupSidePlan;
  tierSel: Record<CleanupTierId, boolean>;
  onTier: (t: CleanupTierId, v: boolean) => void;
  scopeChecked: boolean;
  onScope: (v: boolean) => void;
  scopeDisabled: boolean;
}) {
  const freeable = sidePlan.groups.reduce((s, g) => s + g.bytes, 0);
  return (
    <section
      data-cleanup-side={side}
      className="rounded-lg border bg-card"
      aria-label={`${title} cleanup`}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-muted/40 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/90">
          {icon}
          {title}
        </span>
        {sidePlan.error ? (
          <span
            role="note"
            className="min-w-0 basis-full truncate text-[11px] text-danger"
            title={sidePlan.error}
          >
            {sidePlan.error}
          </span>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground" title={sidePlan.workdir ?? ""}>
              {sidePlan.workdir}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {freeable > 0 ? `${fmtBytes(freeable)} freeable` : "nothing to clean"}
            </span>
          </>
        )}
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <Checkbox
            checked={scopeChecked && !scopeDisabled}
            disabled={scopeDisabled}
            onCheckedChange={(v) => onScope(v === true)}
            aria-label={`Clean the ${side === "local" ? "local copy" : "cluster copy"}`}
            data-cleanup-scope={side}
          />
          clean
        </label>
      </header>
      {sidePlan.note ? (
        <p className="border-b bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">{sidePlan.note}</p>
      ) : null}
      <div className="flex flex-col divide-y">
        {sidePlan.groups.length === 0 ? (
          <p className="px-3 py-2.5 text-[11px] text-muted-foreground">
            {sidePlan.error ? "unavailable" : sidePlan.exists ? "nothing intermediate found" : "no run directory"}
          </p>
        ) : (
          sidePlan.groups.map((g) => (
            <div key={g.tier} data-cleanup-tier-row={g.tier} className="px-3 py-2.5">
              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={tierSel[g.tier]}
                  onCheckedChange={(v) => onTier(g.tier, v === true)}
                  aria-label={`${g.label} — ${g.count} files, ${fmtBytes(g.bytes)}`}
                  className="mt-0.5"
                  data-cleanup-tier-check={g.tier}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-xs font-medium text-foreground/90">{g.label}</span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {g.count} file{g.count === 1 ? "" : "s"} · {fmtBytes(g.bytes)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {g.consequence}
                  </span>
                  {g.files.length > 0 ? (
                    <span className="mt-1.5 block max-h-24 overflow-y-auto rounded border bg-muted/30 px-2 py-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {g.files.slice(0, 8).map((f) => (
                        <span key={f.path} className="block truncate" title={`${f.path} — ${fmtBytes(f.size)}`}>
                          {f.path} <span className="tabular-nums opacity-70">{fmtBytes(f.size)}</span>
                        </span>
                      ))}
                      {g.count > g.files.slice(0, 8).length ? (
                        <span className="block opacity-70">
                          + {g.count - g.files.slice(0, 8).length} more (largest shown)
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </label>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
