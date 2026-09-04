"use client";

/**
 * CryoFlow — global workflow state (zustand).
 */

import * as React from "react";
import { create } from "zustand";
import { toast } from "@/hooks/use-toast";
import { CARD_W, CARD_H, CANVAS_W, CANVAS_H, ZOOM_MAX, ZOOM_MIN, jobType, portsCompatible } from "./workflow";
import { autoLayout } from "./layout";
import type {
  EdgeDTO,
  JobDTO,
  ProjectDTO,
  ProjectSummaryDTO,
  SystemStatusClient,
  WorkspaceDTO,
} from "./types";

/**
 * Pending connection: the port being wired.
 * - dir "out" (default): wire started from an output port — click/drop on an
 *   input port of another job to finish.
 * - dir "in": wire started from an input port (reverse wiring) — click/drop
 *   on an output port of another job to finish.
 */
export interface PendingFrom {
  jobId: string;
  port: string;
  dir?: "out" | "in";
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface WorkflowState {
  jobs: JobDTO[];
  edges: EdgeDTO[];
  project: ProjectDTO | null;
  /** All projects (for the project management panel). */
  projects: ProjectSummaryDTO[];
  /** Workspaces of the ACTIVE project (sidebar tab + header switcher). */
  workspaces: WorkspaceDTO[];
  /** Canvas filter: only jobs of this workspace render. Null while loading. */
  activeWorkspaceId: string | null;
  /** Which top-level view is active: the node canvas or the project dashboard. */
  view: "canvas" | "dashboard";
  /** RELION environment status (refreshed on load). */
  system: SystemStatusClient | null;
  /** True while a forced re-detect is in flight (Re-detect button spinner). */
  systemRefreshing: boolean;
  selectedId: string | null;
  /** Job opened in the large inspector modal (submitted jobs only). */
  inspectId: string | null;
  pendingFrom: PendingFrom | null;
  /** Pan + zoom of the free canvas viewport. */
  viewport: Viewport;
  /** Job type key being dragged from the palette (drop target hint). */
  paletteDrag: string | null;
  /** Increments on every one-click auto-arrange (canvas fit-views on change). */
  layoutEpoch: number;
  /** Job to center the canvas on (inspector "Focus" button). */
  focusJobId: string | null;
  /** Increments per focus request so the canvas effect re-fires. */
  focusEpoch: number;
  loading: boolean;
  error: string | null;
  /** True while a card is being dragged — polling pauses so no re-render
   *  ever interrupts the drag loop (the card + wires are patched via DOM). */
  dragActive: boolean;

  load: () => Promise<void>;
  /** Force a fresh RELION/WSL environment probe (bypasses the 60s cache). */
  refreshSystem: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  createProject: (input: { name: string; mode: string; engine: string }) => Promise<boolean>;
  renameProject: (id: string, name: string) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  /** Re-fetch the workspace list of the ACTIVE project (keeps the current
   *  selection when it still exists; otherwise falls back to the first). */
  refreshWorkspaces: () => Promise<void>;
  switchWorkspace: (id: string) => void;
  createWorkspace: (name: string) => Promise<boolean>;
  renameWorkspace: (id: string, name: string) => Promise<boolean>;
  deleteWorkspace: (id: string) => Promise<boolean>;
  /** Cross-workspace MOVE (PATCH workspaceId) — the job keeps its edges;
   *  wires render wherever BOTH endpoints are visible. */
  moveJob: (id: string, workspaceId: string) => Promise<boolean>;
  /** Cross-workspace COPY-as-link (POST /api/jobs {linkedJobId}) — the new
   *  node mirrors the original and downstream jobs consume its outputs. */
  linkJobTo: (id: string, workspaceId: string) => Promise<void>;
  fetchLog: (jobId: string) => Promise<string | null>;
  addJob: (type: string) => Promise<void>;
  addJobAt: (type: string, x: number, y: number) => Promise<void>;
  moveJobCommit: (id: string, x: number, y: number) => Promise<void>;
  applyLayout: () => Promise<void>;
  saveJob: (id: string, patch: { name?: string; params?: Record<string, number | string | boolean> }) => Promise<void>;
  runJob: (id: string) => Promise<boolean>;
  /** POST /stop — SIGTERM→SIGKILL the job's process tree; re-run resumes
   *  refine-family jobs from their checkpoint via RELION --continue. */
  stopJob: (id: string) => Promise<void>;
  resetJob: (id: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  /** Clone a job (params + position offset) as a fresh idle draft. */
  duplicateJob: (id: string) => Promise<void>;
  connect: (from: string, to: string, fromPort?: string, toPort?: string) => Promise<void>;
  removeEdge: (id: string) => Promise<void>;
  pollTick: () => Promise<void>;

  select: (id: string | null) => void;
  /** Open the big job inspector (submitted jobs); null closes it. */
  inspect: (id: string | null) => void;
  /** Switch the top-level view (canvas ⇄ project dashboard). */
  setView: (view: "canvas" | "dashboard") => void;
  setPendingFrom: (pending: PendingFrom | null) => void;
  cancelConnect: () => void;
  setViewport: (patch: Partial<Viewport>) => void;
  panBy: (dx: number, dy: number) => void;
  setDragActive: (active: boolean) => void;
  setPaletteDrag: (type: string | null) => void;
  /** Center the canvas on a job ("Focus" from the inspector). */
  focusJob: (id: string) => void;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data;
}

/** Client-side cycle check: would edge from→to create a cycle? */
function wouldCreateCycle(edges: EdgeDTO[], from: string, to: string): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.fromJobId) ?? [];
    list.push(e.toJobId);
    adj.set(e.fromJobId, list);
  }
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    if (cur === from) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adj.get(cur) ?? []) stack.push(next);
  }
  return false;
}

/** Reference-stable job comparison for pollTick: when nothing changed we
 *  keep the OLD object references so every React.memo'd card (and the
 *  memo'd edge layer) skips re-rendering — polls become zero-cost. */
function jobEquals(a: JobDTO, b: JobDTO): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.name === b.name &&
    a.x === b.x &&
    a.y === b.y &&
    a.status === b.status &&
    a.progress === b.progress &&
    a.result === b.result &&
    a.duration === b.duration &&
    a.startedAt === b.startedAt &&
    a.updatedAt === b.updatedAt &&
    a.engine === b.engine &&
    a.hasLog === b.hasLog &&
    (a.workspaceId ?? null) === (b.workspaceId ?? null) &&
    (a.linkedJobId ?? null) === (b.linkedJobId ?? null) &&
    (a.linkedName ?? null) === (b.linkedName ?? null) &&
    (a.linkCount ?? 0) === (b.linkCount ?? 0) &&
    JSON.stringify(a.params) === JSON.stringify(b.params)
  );
}

function errToast(msg: string) {
  toast({ title: "Something went wrong", description: msg, variant: "destructive" });
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  jobs: [],
  edges: [],
  project: null,
  projects: [],
  workspaces: [],
  activeWorkspaceId: null,
  view: "canvas",
  system: null,
  systemRefreshing: false,
  selectedId: null,
  inspectId: null,
  pendingFrom: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  paletteDrag: null,
  layoutEpoch: 0,
  focusJobId: null,
  focusEpoch: 0,
  loading: true,
  error: null,
  dragActive: false,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [p, j, e, sys, projs, ws] = await Promise.all([
        api<{ project: ProjectDTO | null }>("/api/project"),
        api<{ jobs: JobDTO[] }>("/api/jobs"),
        api<{ edges: EdgeDTO[] }>("/api/edges"),
        api<SystemStatusClient>("/api/system").catch(() => null),
        api<{ projects: ProjectSummaryDTO[] }>("/api/projects").catch(() => ({ projects: [] })),
        api<{ workspaces: WorkspaceDTO[] }>("/api/workspaces").catch(() => ({ workspaces: [] })),
      ]);
      // keep the current workspace when it still exists (e.g. project-level
      // reloads), otherwise land on the project's first workspace
      const currentWs = get().activeWorkspaceId;
      const wsList = ws.workspaces;
      const activeWs =
        currentWs && wsList.some((w) => w.id === currentWs)
          ? currentWs
          : (wsList[0]?.id ?? null);
      set({
        project: p.project ?? null,
        jobs: j.jobs,
        edges: e.edges,
        system: sys,
        projects: projs.projects,
        workspaces: wsList,
        activeWorkspaceId: activeWs,
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load project";
      set({ loading: false, error: msg });
      errToast(msg);
    }
  },

  refreshWorkspaces: async () => {
    try {
      const { workspaces } = await api<{ workspaces: WorkspaceDTO[] }>("/api/workspaces");
      const current = get().activeWorkspaceId;
      set({
        workspaces,
        activeWorkspaceId:
          current && workspaces.some((w) => w.id === current)
            ? current
            : (workspaces[0]?.id ?? null),
      });
    } catch {
      /* transient — the panel keeps showing the previous list */
    }
  },

  switchWorkspace: (id) => {
    if (get().activeWorkspaceId === id) return;
    // leaving the old canvas: clear selection/pending wire so the new
    // workspace doesn't start with stale state from the previous one
    set({ activeWorkspaceId: id, selectedId: null, pendingFrom: null });
  },

  createWorkspace: async (name) => {
    try {
      const { workspace } = await api<{ workspace: WorkspaceDTO }>("/api/workspaces", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ name }),
      });
      set({ workspaces: [...get().workspaces, workspace] });
      toast({ title: "Workspace created", description: workspace.name });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to create workspace");
      return false;
    }
  },

  renameWorkspace: async (id, name) => {
    try {
      await api<{ workspace: WorkspaceDTO }>(`/api/workspaces/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ name }),
      });
      set({
        workspaces: get().workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
      });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to rename workspace");
      return false;
    }
  },

  deleteWorkspace: async (id) => {
    try {
      const { movedCount, fallback } = await api<{
        ok: boolean;
        movedCount: number;
        fallback: string;
      }>(`/api/workspaces/${id}`, { method: "DELETE" });
      toast({
        title: "Workspace deleted",
        description:
          movedCount > 0
            ? `${movedCount} job${movedCount === 1 ? "" : "s"} moved to "${fallback}"`
            : undefined,
      });
      await get().refreshWorkspaces();
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to delete workspace");
      return false;
    }
  },

  moveJob: async (id, workspaceId) => {
    const { jobs, workspaces } = get();
    const job = jobs.find((j) => j.id === id);
    const target = workspaces.find((w) => w.id === workspaceId);
    if (!job || !target || job.workspaceId === workspaceId) return false;
    // optimistic: the job leaves this canvas immediately
    set({
      jobs: jobs.map((j) => (j.id === id ? { ...j, workspaceId } : j)),
      selectedId: get().selectedId === id ? null : get().selectedId,
    });
    try {
      await api(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ workspaceId }),
      });
      toast({
        title: "Job moved",
        description: `${job.name} → workspace "${target.name}" — its wires now render where both endpoints live`,
      });
      return true;
    } catch (err) {
      // revert the optimistic move
      set({ jobs: get().jobs.map((j) => (j.id === id ? { ...j, workspaceId: job.workspaceId } : j)) });
      errToast(err instanceof Error ? err.message : "Failed to move job");
      return false;
    }
  },

  linkJobTo: async (id, workspaceId) => {
    const { workspaces, viewport, jobs } = get();
    const source = jobs.find((j) => j.id === id);
    const target = workspaces.find((w) => w.id === workspaceId);
    if (!source || !target) return;
    // place the link at the current viewport center of the TARGET canvas
    const x = clamp(
      Math.round(-viewport.x + 480 / viewport.zoom - CARD_W / 2),
      0,
      CANVAS_W - CARD_W
    );
    const y = clamp(
      Math.round(-viewport.y + 360 / viewport.zoom - CARD_H / 2),
      0,
      CANVAS_H - CARD_H
    );
    try {
      const { job } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type: source.type,
          linkedJobId: source.id,
          workspaceId,
          x,
          y,
        }),
      });
      // append the link AND bump the original's referenced-count badge in
      // the same optimistic batch (a poll may never fire when nothing runs)
      set({
        jobs: [...get().jobs, job].map((j) =>
          j.id === id ? { ...j, linkCount: (j.linkCount ?? 0) + 1 } : j
        ),
        activeWorkspaceId: workspaceId,
        selectedId: job.id,
        pendingFrom: null,
      });
      get().focusJob(job.id);
      toast({
        title: "Linked copy created",
        description: `“${job.name}” in "${target.name}" — wire downstream jobs to it; they consume the original's outputs`,
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to copy as link");
    }
  },

  refreshSystem: async () => {
    if (get().systemRefreshing) return;
    set({ systemRefreshing: true });
    try {
      const sys = await api<SystemStatusClient>("/api/system?force=1");
      set({ system: sys });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to re-detect RELION environment");
    } finally {
      set({ systemRefreshing: false });
    }
  },

  switchProject: async (id) => {
    try {
      await api<{ ok: boolean }>("/api/projects/switch", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ id }),
      });
      set({
        selectedId: null,
        inspectId: null,
        pendingFrom: null,
        viewport: { x: 0, y: 0, zoom: 1 },
        activeWorkspaceId: null, // load() lands on the project's first workspace
      });
      await get().load();
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to switch project");
    }
  },

  createProject: async (input) => {
    try {
      await api<{ ok: boolean }>("/api/projects", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
      });
      await get().load();
      toast({ title: "Project created", description: input.name });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to create project");
      return false;
    }
  },

  renameProject: async (id, name) => {
    try {
      await api<{ ok: boolean }>(`/api/projects/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ name }),
      });
      await get().load();
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to rename project");
      return false;
    }
  },

  deleteProject: async (id) => {
    try {
      await api<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" });
      set({ selectedId: null, inspectId: null, pendingFrom: null });
      await get().load();
      toast({ title: "Project deleted" });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to delete project");
      return false;
    }
  },

  fetchLog: async (jobId) => {
    try {
      const data = await api<{ tail: string }>(`/api/jobs/${jobId}/log`);
      return data.tail;
    } catch {
      return null;
    }
  },

  addJob: async (type) => {
    // legacy keyboard path: place in the middle of the current viewport
    const { viewport } = get();
    const x = clamp(-viewport.x + 480 / viewport.zoom - CARD_W / 2, 0, CANVAS_W - CARD_W);
    const y = clamp(-viewport.y + 360 / viewport.zoom - CARD_H / 2, 0, CANVAS_H - CARD_H);
    await get().addJobAt(type, x, y);
  },

  addJobAt: async (type, x, y) => {
    const spec = jobType(type);
    if (!spec) {
      errToast(`Unknown job type: ${type}`);
      return;
    }
    const cx = clamp(Math.round(x - CARD_W / 2), 0, CANVAS_W - CARD_W);
    const cy = clamp(Math.round(y - CARD_H / 2), 0, CANVAS_H - CARD_H);
    try {
      const { job } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type,
          x: cx,
          y: cy,
          workspaceId: get().activeWorkspaceId ?? undefined,
        }),
      });
      set({ jobs: [...get().jobs, job], selectedId: job.id });
      toast({
        title: "Job added",
        description: `${job.name} placed on the canvas`,
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to add job");
    }
  },

  moveJobCommit: async (id, x, y) => {
    // optimistic
    set({ jobs: get().jobs.map((j) => (j.id === id ? { ...j, x, y } : j)) });
    try {
      await api(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ x, y }),
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to save position");
    }
  },

  applyLayout: async () => {
    const { jobs, edges } = get();
    if (jobs.length === 0) return;
    const positions = autoLayout(
      jobs.map((j) => ({ id: j.id, type: j.type })),
      edges.map((e) => ({ fromJobId: e.fromJobId, toJobId: e.toJobId }))
    );
    const updates = [...positions.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y }));
    set({
      jobs: get().jobs.map((j) => ({ ...j, ...(positions.get(j.id) ?? {}) })),
      layoutEpoch: get().layoutEpoch + 1,
    });
    try {
      await api("/api/jobs/layout", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ updates }),
      });
      toast({ title: "Workflow tidied", description: `${updates.length} jobs auto-arranged` });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to save layout");
    }
  },

  saveJob: async (id, patch) => {
    try {
      const { job } = await api<{ job: JobDTO }>(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(patch),
      });
      set({ jobs: get().jobs.map((j) => (j.id === id ? job : j)) });
      toast({ title: "Saved", description: `${job.name} updated` });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to save job");
    }
  },

  runJob: async (id) => {
    try {
      const data = await api<{ job: JobDTO; error?: string }>(`/api/jobs/${id}/run`, {
        method: "POST",
      });
      set({ jobs: get().jobs.map((j) => (j.id === id ? data.job : j)) });
      if (data.error) {
        // honest real-engine failure — surfaced via the job result too
        toast({
          title: "Real engine refused to start",
          description: data.error,
          variant: "destructive",
        });
        return false;
      }
      toast({ title: "Job started", description: `${data.job.name} is now running` });
      // CryoSPARC-style: submitting a job opens its inspector page
      set({ inspectId: id, selectedId: null });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to run job");
      return false;
    }
  },

  stopJob: async (id) => {
    try {
      const data = await api<{ job: JobDTO; stopped: boolean; message: string }>(
        `/api/jobs/${id}/stop`,
        { method: "POST" }
      );
      set({ jobs: get().jobs.map((j) => (j.id === id ? data.job : j)) });
      toast({
        title: data.stopped ? "Job stopped" : "Job already idle",
        description: data.message,
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to stop job");
    }
  },

  resetJob: async (id) => {
    try {
      const { job } = await api<{ job: JobDTO }>(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: "idle" }),
      });
      set({ jobs: get().jobs.map((j) => (j.id === id ? job : j)) });
      toast({ title: "Job reset", description: `${job.name} returned to idle` });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to reset job");
    }
  },

  deleteJob: async (id) => {
    try {
      await api(`/api/jobs/${id}`, { method: "DELETE" });
      set({
        jobs: get().jobs.filter((j) => j.id !== id),
        edges: get().edges.filter((e) => e.fromJobId !== id && e.toJobId !== id),
        selectedId: get().selectedId === id ? null : get().selectedId,
        inspectId: get().inspectId === id ? null : get().inspectId,
        pendingFrom: get().pendingFrom?.jobId === id ? null : get().pendingFrom,
      });
      toast({ title: "Job deleted", description: "Removed from the workflow" });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to delete job");
    }
  },

  duplicateJob: async (id) => {
    const src = get().jobs.find((j) => j.id === id);
    if (!src) return;
    const x = clamp(src.x + 48, 0, CANVAS_W - CARD_W);
    const y = clamp(src.y + 40, 0, CANVAS_H - CARD_H);
    try {
      const { job } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type: src.type,
          x,
          y,
          name: `${src.name} (copy)`,
          params: src.params,
        }),
      });
      set({ jobs: [...get().jobs, job], selectedId: job.id, inspectId: null });
      toast({
        title: "Job duplicated",
        description: `${job.name} placed beside the original — edit & connect it, then run`,
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to duplicate job");
    }
  },

  connect: async (from, to, fromPort, toPort) => {
    const { edges, jobs } = get();
    if (from === to) return;
    const fromJob = jobs.find((j) => j.id === from);
    const toJob = jobs.find((j) => j.id === to);
    if (fromPort && toPort && fromJob && toJob) {
      if (!portsCompatible(fromJob.type, fromPort, toJob.type, toPort)) {
        toast({
          title: "Port mismatch",
          description: "That output cannot feed this input",
          variant: "destructive",
        });
        return;
      }
    }
    if (
      edges.some(
        (e) => e.fromJobId === from && e.toJobId === to && e.fromPort === fromPort && e.toPort === toPort
      )
    ) {
      toast({ title: "Already connected", description: "That edge already exists" });
      return;
    }
    if (wouldCreateCycle(edges, from, to)) {
      toast({
        title: "Connection refused",
        description: "Would create a cycle",
        variant: "destructive",
      });
      return;
    }
    try {
      const { edge } = await api<{ edge: EdgeDTO }>("/api/edges", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ fromJobId: from, toJobId: to, fromPort, toPort }),
      });
      set({ edges: [...get().edges, edge], pendingFrom: null });
      const fromName = fromJob?.name ?? "Job";
      const toName = toJob?.name ?? "job";
      toast({ title: "Connected", description: `${fromName} → ${toName}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect";
      toast({ title: "Connection refused", description: msg, variant: "destructive" });
    }
  },

  removeEdge: async (id) => {
    try {
      await api(`/api/edges/${id}`, { method: "DELETE" });
      set({ edges: get().edges.filter((e) => e.id !== id) });
      toast({ title: "Edge removed" });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to remove edge");
    }
  },

  pollTick: async () => {
    // never fight an active card drag with a re-render — the drag loop owns
    // the screen until the pointer goes up
    if (get().dragActive) return;
    const prev = get().jobs;
    try {
      const { jobs } = await api<{ jobs: JobDTO[] }>("/api/jobs");
      // reference stability: reuse the previous object for every job whose
      // fields did not change (JSON.parse gives brand-new refs each time)
      let changed = prev.length !== jobs.length;
      const merged = prev.length === jobs.length
        ? jobs.map((j, i) => {
            const old = prev[i];
            if (old && old.id === j.id && jobEquals(old, j)) return old;
            changed = true;
            return j;
          })
        : jobs;
      if (!changed) return; // identical tick — zero re-renders
      set({ jobs: merged });
      // announce transitions running → completed / failed
      for (const job of merged) {
        const before = prev.find((p) => p.id === job.id);
        if (before?.status !== "running") continue;
        if (job.status === "completed") {
          toast({
            title: `${job.name} completed`,
            description: job.result ?? undefined,
          });
        } else if (job.status === "failed") {
          toast({
            title: `${job.name} failed`,
            description: job.result ?? undefined,
            variant: "destructive",
          });
        }
      }
    } catch {
      // polling errors are transient — keep the interval alive
    }
  },

  select: (id) => set({ selectedId: id }),

  inspect: (id) => {
    if (id !== null) {
      // inspector replaces the right-side editing panel
      set({ inspectId: id, selectedId: null });
    } else {
      set({ inspectId: null });
    }
  },
  setView: (view) => set({ view }),
  setPendingFrom: (pending) => set({ pendingFrom: pending }),
  cancelConnect: () => set({ pendingFrom: null }),
  setViewport: (patch) =>
    set((s) => ({
      viewport: { ...s.viewport, ...patch, zoom: clamp(patch.zoom ?? s.viewport.zoom, ZOOM_MIN, ZOOM_MAX) },
    })),
  panBy: (dx, dy) =>
    set((s) => ({ viewport: { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy } })),
  setDragActive: (active) => set({ dragActive: active }),
  setPaletteDrag: (type) => set({ paletteDrag: type }),

  focusJob: (id) =>
    set((s) => ({
      focusJobId: id,
      focusEpoch: s.focusEpoch + 1,
      // the modal would cover the canvas — close it so the user sees the focus
      inspectId: null,
    })),
}));

/* ------------------------------------------------------------------ */
/* Workspace-scoped derivations (shared by canvas, minimap, KPI bar)    */
/* ------------------------------------------------------------------ */

/**
 * Jobs of the ACTIVE workspace (reference-stable across polls — the store's
 * jobs array keeps unchanged object refs, so this memo survives poll ticks
 * and memoized cards keep skipping re-renders).
 */
export function useActiveWorkspaceJobs(): JobDTO[] {
  const jobs = useWorkflowStore((s) => s.jobs);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  return React.useMemo(
    () =>
      activeWorkspaceId == null
        ? jobs
        : jobs.filter((j) => (j.workspaceId ?? "") === activeWorkspaceId),
    [jobs, activeWorkspaceId]
  );
}

/** Edges whose BOTH endpoints live in the active workspace (the render rule:
 *  a wire only draws where both of its jobs are visible — cross-workspace
 *  data flow goes through linked copies instead). */
export function useActiveWorkspaceEdges(): EdgeDTO[] {
  const edges = useWorkflowStore((s) => s.edges);
  const jobs = useWorkflowStore((s) => s.jobs);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  return React.useMemo(() => {
    if (activeWorkspaceId == null) return edges;
    const visible = new Set(
      jobs.filter((j) => (j.workspaceId ?? "") === activeWorkspaceId).map((j) => j.id)
    );
    return edges.filter((e) => visible.has(e.fromJobId) && visible.has(e.toJobId));
  }, [edges, jobs, activeWorkspaceId]);
}
