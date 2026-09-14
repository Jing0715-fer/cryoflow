"use client";

/**
 * CryoFlow — HPC cluster profile registry editor.
 *
 * The registry's management face. GET /api/hpc/profiles serves the merged
 * view (persisted hpc-profiles.json, else the built-in example trio); POST
 * replaces the registry behind the server's shape-guard: every field is
 * clamped to a documented range, unknown fields are dropped, and localRoot
 * is PINNED by the server to this machine's contract data/relion (Task 184:
 * one directory gets one name, and the server owns that name).
 *
 * The editor is honest about that contract:
 *   - localRoot renders read-only with a lock — editing it locally would
 *     be a lie the server silently unwinds;
 *   - the numeric inputs carry the same min/max the server clamps with;
 *   - after a save the UI re-renders from the RESPONSE (what the server
 *     actually kept), never from what was sent;
 *   - a dirty dot marks unsent edits, and a two-step confirm keeps the
 *     destructive delete honest;
 *   - the list refuses to drop below one profile (the server 400s an
 *     empty registry anyway) and keeps ids unique client-side — the
 *     server does not dedupe, so the client must.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  onEscapeClose,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Copy, Lock, Loader2, Plus, Server, Settings2, SlidersHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- */
/* Wire shape (mirrors SlurmProfile from the server contract)        */
/* ---------------------------------------------------------------- */

interface ProfileFull {
  id: string;
  name: string;
  host: string | null;
  partition: string;
  account: string | null;
  qos: string | null;
  timeLimitMin: number;
  nodes: number;
  gpusPerNode: number;
  gpuModel: string;
  relionHome: string;
  dataRoot: string;
  localRoot: string;
  envLines: string[];
  ctffind: string | null;
  arrayConcurrency: number;
  gpuSpeedup: number;
}

const GPU_MODELS = ["A100", "H100", "V100", "RTX4090"] as const;

/** The server's clamps (POST route) — mirrored so the form speaks the same contract. */
const CLAMP = {
  timeLimitMin: { min: 0, max: 43200, dflt: 720 },
  nodes: { min: 1, max: 1024, dflt: 4 },
  gpusPerNode: { min: 0, max: 64, dflt: 4 },
  arrayConcurrency: { min: 1, max: 512, dflt: 16 },
  gpuSpeedup: { min: 1, max: 1000, dflt: 25 },
} as const;

const MAX_PROFILES = 8;
const MAX_ENV_LINES = 12;

const MODEL_BADGE: Record<string, string> = {
  A100: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  H100: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  V100: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  RTX4090: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30",
};

/* ---------------------------------------------------------------- */
/* Field-level atoms                                                 */
/* ---------------------------------------------------------------- */

function Field({
  label, hint, children, className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[10px] leading-snug text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h4>
      <Separator className="flex-1" />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* The editor                                                        */
/* ---------------------------------------------------------------- */

export function HpcProfilesEditor({
  onChanged,
  activeId,
}: {
  /** Fired after a successful save — the parent re-reads the registry. */
  onChanged?: (profiles: ProfileFull[]) => void;
  /** Id of the profile the parent dialog currently submits with (list marker). */
  activeId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [profiles, setProfiles] = React.useState<ProfileFull[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/hpc/profiles")
      .then((r) => r.json())
      .then((d: { profiles?: ProfileFull[] } | null) => {
        if (!d || !Array.isArray(d.profiles) || d.profiles.length === 0) return;
        setProfiles(d.profiles);
        setSelectedId((prev) =>
          prev && d.profiles!.some((p) => p.id === prev) ? prev : d.profiles![0].id
        );
        setDirty(false);
      })
      .catch(() => setError("Could not load the profile registry."))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  const patch = (fields: Partial<ProfileFull>) => {
    if (!selected) return;
    setDirty(true);
    setError(null);
    setProfiles((list) => list.map((p) => (p.id === selected.id ? { ...p, ...fields } : p)));
  };

  const nextCustomId = (list: ProfileFull[]): string => {
    // The server does NOT dedupe ids — the client owns uniqueness.
    const taken = new Set(list.map((p) => p.id));
    for (let n = 1; n < 1000; n++) {
      const id = `custom-${n}`;
      if (!taken.has(id)) return id;
    }
    return `custom-${Date.now().toString(36)}`;
  };

  const addProfile = () => {
    if (profiles.length >= MAX_PROFILES) return;
    setDirty(true);
    setError(null);
    const id = nextCustomId(profiles);
    const fresh: ProfileFull = {
      id,
      name: "New cluster profile",
      host: "",
      partition: "gpu",
      account: null,
      qos: null,
      timeLimitMin: CLAMP.timeLimitMin.dflt,
      nodes: CLAMP.nodes.dflt,
      gpusPerNode: CLAMP.gpusPerNode.dflt,
      gpuModel: "A100",
      relionHome: "/opt/relion/5.0.1",
      dataRoot: "/lustre/project/cryoflow",
      localRoot: profiles[0]?.localRoot ?? "",
      envLines: ["module load relion/5.0.1 cuda/12.2"],
      ctffind: null,
      arrayConcurrency: CLAMP.arrayConcurrency.dflt,
      gpuSpeedup: CLAMP.gpuSpeedup.dflt,
    };
    setProfiles((list) => [...list, fresh]);
    setSelectedId(id);
  };

  const duplicateProfile = () => {
    if (!selected || profiles.length >= MAX_PROFILES) return;
    setDirty(true);
    setError(null);
    const id = nextCustomId(profiles);
    const clone: ProfileFull = { ...selected, id, name: `${selected.name} copy`.slice(0, 120) };
    const at = profiles.findIndex((p) => p.id === selected.id) + 1;
    setProfiles((list) => [...list.slice(0, at), clone, ...list.slice(at)]);
    setSelectedId(id);
  };

  const deleteProfile = () => {
    if (!selected || profiles.length <= 1) return;
    setDirty(true);
    setError(null);
    const at = profiles.findIndex((p) => p.id === selected.id);
    const rest = profiles.filter((p) => p.id !== selected.id);
    setProfiles(rest);
    setSelectedId(rest[Math.max(0, at - 1)]?.id ?? rest[0].id);
    setConfirmDelete(false);
  };

  React.useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const save = async () => {
    if (!profiles.length) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hpc/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profiles: profiles.map((p) => ({
            ...p,
            // empty env lines are typing residue, not configuration
            envLines: p.envLines.filter((l) => l.trim().length > 0).slice(0, MAX_ENV_LINES),
          })),
        }),
      });
      const body = (await res.json().catch(() => null)) as { profiles?: ProfileFull[]; error?: string } | null;
      if (!res.ok || !body || !Array.isArray(body.profiles)) {
        setError(body?.error ?? `Save failed (HTTP ${res.status})`);
        return;
      }
      // The response is the truth — re-render from what the server kept,
      // never from what was sent (clamps may have rewritten numbers).
      setProfiles(body.profiles);
      setSelectedId((prev) =>
        prev && body.profiles!.some((p) => p.id === prev) ? prev : body.profiles![0].id
      );
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2600);
      onChanged?.(body.profiles);
    } catch {
      setError("Save request failed — the registry is untouched.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setConfirmDelete(false);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 shrink-0 text-muted-foreground hover:text-foreground before:absolute before:-inset-1.5 before:rounded-md before:content-['']"
          aria-label="Manage cluster profiles"
          title="Manage cluster profiles"
        >
          <Settings2 className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-4xl"
        onKeyDown={onEscapeClose(() => setOpen(false))}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
            Cluster profiles
            <Badge variant="outline" className="text-[10px] font-normal">
              {profiles.length} / {MAX_PROFILES}
            </Badge>
            {activeId ? (
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                submitting with: {activeId}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            The registry behind every sbatch generation. The server clamps numbers, drops unknown
            fields, and pins{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">localRoot</code>{" "}
            to this machine&apos;s data root — the form mirrors that contract.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> Loading registry…
          </div>
        ) : (
          <div className="flex min-h-0 gap-4">
            {/* ---------------- left rail: the registry list ---------------- */}
            <div className="flex w-56 shrink-0 flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Registry
                </h4>
                <span className="text-[10px] text-muted-foreground/70">{profiles.length}</span>
              </div>
              <div className="max-h-[56vh] space-y-1 overflow-y-auto pr-0.5" role="list" aria-label="Profile list">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="listitem"
                    onClick={() => {
                      setSelectedId(p.id);
                      setConfirmDelete(false);
                    }}
                    className={cn(
                      "w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                      p.id === selectedId
                        ? "border-primary/50 bg-primary/[0.06]"
                        : "border-transparent hover:border-border hover:bg-muted/50",
                      p.id === activeId ? "shadow-[inset_2px_0_0_0] shadow-primary/60" : ""
                    )}
                    aria-pressed={p.id === selectedId}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium">{p.name || p.id}</span>
                      {p.id === activeId ? (
                        <Server className="size-3 shrink-0 text-primary" aria-label="active in sbatch dialog" />
                      ) : null}
                    </span>
                    <span className="mt-1 flex items-center gap-1">
                      <Badge variant="outline" className={cn("border px-1 py-0 text-[9px]", MODEL_BADGE[p.gpuModel] ?? "")}>
                        {p.gpuModel}
                      </Badge>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {p.host ? p.host : "local submit"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 flex-1 text-[11px]"
                  onClick={addProfile}
                  disabled={profiles.length >= MAX_PROFILES}
                >
                  <Plus className="size-3" aria-hidden="true" /> Add
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 shrink-0 px-0"
                  onClick={duplicateProfile}
                  disabled={!selected || profiles.length >= MAX_PROFILES}
                  aria-label="Duplicate selected profile"
                  title="Duplicate selected profile"
                >
                  <Copy className="size-3" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* ---------------- right: the selected profile's form ---------------- */}
            {selected ? (
              <div className="min-w-0 flex-1 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: "56vh" }}>
                <div className="space-y-3">
                  <SectionTitle>Identity</SectionTitle>
                  <div className="grid grid-cols-5 gap-3">
                    <Field label="Display name" className="col-span-3">
                      <Input
                        value={selected.name}
                        onChange={(e) => patch({ name: e.target.value.slice(0, 120) })}
                        className="h-8 text-xs"
                        maxLength={120}
                        aria-label="Profile display name"
                      />
                    </Field>
                    <Field
                      label="Profile id"
                      hint="Stable key — sbatch links and scripts reference it."
                      className="col-span-2"
                    >
                      <Input
                        value={selected.id}
                        readOnly
                        className="h-8 bg-muted/50 font-mono text-[11px] text-muted-foreground"
                        aria-label="Profile id (read-only)"
                      />
                    </Field>
                  </div>
                </div>

                <div className="space-y-3">
                  <SectionTitle>Connection</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Login host" hint="Empty = submit from this machine (local slurm client).">
                      <Input
                        value={selected.host ?? ""}
                        onChange={(e) => patch({ host: e.target.value.slice(0, 200) })}
                        placeholder="login.cluster.example.org"
                        className="h-8 text-xs"
                        maxLength={200}
                        aria-label="Login host"
                      />
                    </Field>
                    <Field label="Partition">
                      <Input
                        value={selected.partition}
                        onChange={(e) => patch({ partition: e.target.value.slice(0, 60) })}
                        className="h-8 text-xs"
                        maxLength={60}
                        aria-label="Slurm partition"
                      />
                    </Field>
                    <Field label="Account">
                      <Input
                        value={selected.account ?? ""}
                        onChange={(e) => patch({ account: e.target.value.trim() ? e.target.value.slice(0, 60) : null })}
                        placeholder="—"
                        className="h-8 text-xs"
                        maxLength={60}
                        aria-label="Slurm account"
                      />
                    </Field>
                    <Field label="QoS">
                      <Input
                        value={selected.qos ?? ""}
                        onChange={(e) => patch({ qos: e.target.value.trim() ? e.target.value.slice(0, 60) : null })}
                        placeholder="—"
                        className="h-8 text-xs"
                        maxLength={60}
                        aria-label="Slurm QoS"
                      />
                    </Field>
                  </div>
                </div>

                <div className="space-y-3">
                  <SectionTitle>Resources</SectionTitle>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label={`Time limit (min)`} hint={`${CLAMP.timeLimitMin.min}–${CLAMP.timeLimitMin.max}`}>
                      <Input
                        type="number"
                        min={CLAMP.timeLimitMin.min}
                        max={CLAMP.timeLimitMin.max}
                        value={selected.timeLimitMin}
                        onChange={(e) => patch({ timeLimitMin: Number(e.target.value) })}
                        className="h-8 text-xs"
                        aria-label="Time limit in minutes"
                      />
                    </Field>
                    <Field label="Nodes" hint={`${CLAMP.nodes.min}–${CLAMP.nodes.max}`}>
                      <Input
                        type="number"
                        min={CLAMP.nodes.min}
                        max={CLAMP.nodes.max}
                        value={selected.nodes}
                        onChange={(e) => patch({ nodes: Number(e.target.value) })}
                        className="h-8 text-xs"
                        aria-label="Node count"
                      />
                    </Field>
                    <Field label="GPUs / node" hint={`${CLAMP.gpusPerNode.min}–${CLAMP.gpusPerNode.max}`}>
                      <Input
                        type="number"
                        min={CLAMP.gpusPerNode.min}
                        max={CLAMP.gpusPerNode.max}
                        value={selected.gpusPerNode}
                        onChange={(e) => patch({ gpusPerNode: Number(e.target.value) })}
                        className="h-8 text-xs"
                        aria-label="GPUs per node"
                      />
                    </Field>
                    <Field label="GPU model">
                      <Select value={selected.gpuModel} onValueChange={(v) => patch({ gpuModel: v })}>
                        <SelectTrigger className="h-8 text-xs" aria-label="GPU model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GPU_MODELS.map((m) => (
                            <SelectItem key={m} value={m} className="text-xs">
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Array throttle" hint={`%N · ${CLAMP.arrayConcurrency.min}–${CLAMP.arrayConcurrency.max}`}>
                      <Input
                        type="number"
                        min={CLAMP.arrayConcurrency.min}
                        max={CLAMP.arrayConcurrency.max}
                        value={selected.arrayConcurrency}
                        onChange={(e) => patch({ arrayConcurrency: Number(e.target.value) })}
                        className="h-8 text-xs"
                        aria-label="Array concurrency throttle"
                      />
                    </Field>
                    <Field label="Sim speed ×" hint={`simulator only · ${CLAMP.gpuSpeedup.min}–${CLAMP.gpuSpeedup.max}`}>
                      <Input
                        type="number"
                        min={CLAMP.gpuSpeedup.min}
                        max={CLAMP.gpuSpeedup.max}
                        value={selected.gpuSpeedup}
                        onChange={(e) => patch({ gpuSpeedup: Number(e.target.value) })}
                        className="h-8 text-xs"
                        aria-label="Simulated GPU speed multiplier"
                      />
                    </Field>
                  </div>
                </div>

                <div className="space-y-3">
                  <SectionTitle>Cluster paths</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="RELION home" hint="Module dir or /opt install root on the cluster.">
                      <Input
                        value={selected.relionHome}
                        onChange={(e) => patch({ relionHome: e.target.value.slice(0, 300) })}
                        className="h-8 font-mono text-[11px]"
                        maxLength={300}
                        aria-label="Cluster RELION home"
                      />
                    </Field>
                    <Field label="Data root" hint="Cluster-side project root (shared FS).">
                      <Input
                        value={selected.dataRoot}
                        onChange={(e) => patch({ dataRoot: e.target.value.slice(0, 300) })}
                        className="h-8 font-mono text-[11px]"
                        maxLength={300}
                        aria-label="Cluster data root"
                      />
                    </Field>
                    <Field label="ctffind binary" hint="Used when the cluster lacks the module.">
                      <Input
                        value={selected.ctffind ?? ""}
                        onChange={(e) => patch({ ctffind: e.target.value.trim() ? e.target.value.slice(0, 300) : null })}
                        placeholder="—"
                        className="h-8 font-mono text-[11px]"
                        maxLength={300}
                        aria-label="ctffind binary path"
                      />
                    </Field>
                    <Field label="Local data root" hint="Pinned by the server — this machine's contract path.">
                      <div className="relative">
                        <Input
                          value={selected.localRoot}
                          readOnly
                          className="h-8 bg-muted/50 pr-7 font-mono text-[11px] text-muted-foreground"
                          aria-label="Local data root (pinned by server)"
                        />
                        <Lock className="absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/70" aria-hidden="true" />
                      </div>
                    </Field>
                  </div>
                </div>

                <div className="space-y-3">
                  <SectionTitle>Environment prep</SectionTitle>
                  <Field
                    label={`Shell lines run before RELION (${selected.envLines.length} / ${MAX_ENV_LINES})`}
                    hint="module load · conda activate · exports — one command per line."
                  >
                    <Textarea
                      value={selected.envLines.join("\n")}
                      onChange={(e) => {
                        const lines = e.target.value.split("\n").slice(0, MAX_ENV_LINES);
                        patch({ envLines: lines });
                      }}
                      className="min-h-[72px] font-mono text-[11px] leading-relaxed"
                      aria-label="Environment preparation lines"
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center justify-center text-xs text-muted-foreground">
                Select a profile.
              </div>
            )}
          </div>
        )}

        {error ? (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] p-2.5 text-xs text-rose-700 dark:text-rose-300" role="alert">
            {error}
          </div>
        ) : null}

        <DialogFooter className="flex items-center gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400",
              confirmDelete && "bg-rose-500/10"
            )}
            onClick={() => (confirmDelete ? deleteProfile() : setConfirmDelete(true))}
            disabled={!selected || profiles.length <= 1}
            aria-label={confirmDelete ? "Confirm delete profile" : "Delete profile"}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {confirmDelete ? "Confirm delete?" : "Delete"}
          </Button>
          <div className="flex items-center gap-2">
            {savedFlash ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400" role="status">
                <Check className="size-3.5" aria-hidden="true" /> Saved — server view shown
              </span>
            ) : dirty ? (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground" role="status">
                <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" /> unsaved edits
              </span>
            ) : null}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => void save()} disabled={saving || loading || !profiles.length}>
              {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
              Save to server
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
