"use client";

/**
 * CryoFlow — HPC / Slurm submission dialog.
 *
 * Generates a DRY-RUN sbatch script for the selected job (the engine's real
 * argv, paths translated onto the chosen cluster profile) and shows the
 * GPU scheduling strategy (array / multi-GPU / single / CPU). On a real
 * cluster login node the script is submission-ready; in the sandbox the
 * /api/hpc/simulate companion projects how the whole workflow schedules.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, Loader2, Server, Check } from "lucide-react" ;
import { cn } from "@/lib/utils";

interface ProfileBrief {
  id: string; name: string; partition: string; gpuModel: string; gpusPerNode: number; host: string | null;
}
interface SbatchResponse {
  script: string;
  strategy: { mode: string; gpus: number; shards: number; minutes: number; reason: string };
  slurmNotes: string[];
  argv: string[];
  error?: string;
  jobName?: string;
  jobType?: string;
  note?: string;
}

const MODE_COLOR: Record<string, string> = {
  "multi-gpu": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  array: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30",
  single: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  cpu: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

export function HpcSbatchDialog({ jobId, compact = false }: { jobId: string; compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [profiles, setProfiles] = React.useState<ProfileBrief[]>([]);
  const [profileId, setProfileId] = React.useState("");
  const [data, setData] = React.useState<SbatchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch("/api/hpc/profiles")
      .then((r) => r.json())
      .then((d: { profiles?: ProfileBrief[] } | null) => {
        if (!alive || !d || !Array.isArray(d.profiles)) return;
        const list: ProfileBrief[] = d.profiles;
        const gpu = list.filter((p) => p.id !== "local-workstation");
        setProfiles(gpu.length ? gpu : list);
        setProfileId((prev) => prev || (gpu[0]?.id ?? list[0]?.id ?? ""));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  React.useEffect(() => {
    if (!open || !profileId) return;
    let alive = true;
    setLoading(true);
    setData(null);
    fetch(`/api/hpc/sbatch/${jobId}?profile=${encodeURIComponent(profileId)}`)
      .then((r) => r.json())
      .then((d: SbatchResponse) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData({ script: "", strategy: { mode: "cpu", gpus: 0, shards: 0, minutes: 0, reason: "" }, slurmNotes: [], argv: [], error: "Request failed" }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, profileId, jobId]);

  const copy = async () => {
    if (!data?.script) return;
    try {
      await navigator.clipboard.writeText(data.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={compact ? "ghost" : "outline"}
          size={compact ? "icon" : "sm"}
          className={compact ? "size-8 shrink-0 text-muted-foreground hover:text-foreground" : undefined}
          aria-label="Generate Slurm sbatch script for this job"
          title="HPC / Slurm submission script (dry-run)"
        >
          <Server className={compact ? "size-4" : "size-4"} aria-hidden="true" />
          {compact ? null : <span className="ml-1.5">HPC</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="size-4 text-primary" aria-hidden="true" />
            Slurm submission · {data?.jobName ?? "…"}
          </DialogTitle>
          <DialogDescription>
            Dry-run sbatch generation — the engine&apos;s real command for this job, wrapped for the
            selected cluster profile. Submit on a login node with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">sbatch script.sh</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={profileId} onValueChange={setProfileId}>
            <SelectTrigger className="h-8 w-64 text-xs" aria-label="Cluster profile">
              <SelectValue placeholder="Cluster profile" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data?.strategy ? (
            <Badge variant="outline" className={cn("border text-[10px]", MODE_COLOR[data.strategy.mode] ?? "")}>
              {data.strategy.mode}
            </Badge>
          ) : null}
          {data?.strategy ? (
            <Badge variant="outline" className="text-[10px]">
              {data.strategy.gpus > 0 ? `${data.strategy.gpus} × GPU` : "CPU"}
              {data.strategy.shards > 1 ? ` · ${data.strategy.shards} shards` : ""}
            </Badge>
          ) : null}
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => void copy()} disabled={!data?.script}>
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied ? "Copied" : "Copy script"}
          </Button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> Generating…
          </div>
        ) : data?.error ? (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] p-3 text-xs text-rose-700 dark:text-rose-300">
            {data.error}
          </div>
        ) : (
          <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[10.5px] leading-relaxed" tabIndex={0} aria-label="Generated sbatch script">
            {data?.script ?? ""}
          </pre>
        )}

        {data?.slurmNotes?.length ? (
          <div className="space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {data.slurmNotes.map((n, i) => (
              <p key={i} className="flex gap-1.5">
                <span className="text-primary" aria-hidden="true">›</span>
                {n}
              </p>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
