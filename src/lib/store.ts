"use client";

/**
 * CryoFlow — global workflow state (zustand).
 */

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
} from "./types";

/** Pending connection: source job + the output port being wired. */
export interface PendingFrom {
  jobId: string;
  port: string;
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
  /** RELION environment status (refreshed on load). */
  system: SystemStatusClient | null;
  selectedId: string | null;
  pendingFrom: PendingFrom | null;
  /** Pan + zoom of the free canvas viewport. */
  viewport: Viewport;
  /** Job type key being dragged from the palette (drop target hint). */
  paletteDrag: string | null;
  /** Increments on every one-click auto-arrange (canvas fit-views on change). */
  layoutEpoch: number;
  loading: boolean;
  error: string | null;
  /** Transient live-drag offset (canvas coords) so edges follow the card in real time. */
  dragLive: { id: string; dx: number; dy: number } | null;

  load: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  createProject: (input: { name: string; mode: string; engine: string }) => Promise<boolean>;
  renameProject: (id: string, name: string) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  fetchLog: (jobId: string) => Promise<string | null>;
  addJob: (type: string) => Promise<void>;
  addJobAt: (type: string, x: number, y: number) => Promise<void>;
  moveJobCommit: (id: string, x: number, y: number) => Promise<void>;
  applyLayout: () => Promise<void>;
  saveJob: (id: string, patch: { name?: string; params?: Record<string, number | string | boolean> }) => Promise<void>;
  runJob: (id: string) => Promise<boolean>;
  resetJob: (id: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  connect: (from: string, to: string, fromPort?: string, toPort?: string) => Promise<void>;
  removeEdge: (id: string) => Promise<void>;
  pollTick: () => Promise<void>;

  select: (id: string | null) => void;
  setPendingFrom: (pending: PendingFrom | null) => void;
  cancelConnect: () => void;
  setViewport: (patch: Partial<Viewport>) => void;
  panBy: (dx: number, dy: number) => void;
  setDragLive: (live: { id: string; dx: number; dy: number } | null) => void;
  setPaletteDrag: (type: string | null) => void;
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
  system: null,
  selectedId: null,
  pendingFrom: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  paletteDrag: null,
  layoutEpoch: 0,
  loading: true,
  error: null,
  dragLive: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [p, j, e, sys, projs] = await Promise.all([
        api<{ project: ProjectDTO | null }>("/api/project"),
        api<{ jobs: JobDTO[] }>("/api/jobs"),
        api<{ edges: EdgeDTO[] }>("/api/edges"),
        api<SystemStatusClient>("/api/system").catch(() => null),
        api<{ projects: ProjectSummaryDTO[] }>("/api/projects").catch(() => ({ projects: [] })),
      ]);
      set({
        project: p.project ?? null,
        jobs: j.jobs,
        edges: e.edges,
        system: sys,
        projects: projs.projects,
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load project";
      set({ loading: false, error: msg });
      errToast(msg);
    }
  },

  switchProject: async (id) => {
    try {
      await api<{ ok: boolean }>("/api/projects/switch", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ id }),
      });
      set({ selectedId: null, pendingFrom: null, viewport: { x: 0, y: 0, zoom: 1 } });
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
      set({ selectedId: null, pendingFrom: null });
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
        body: JSON.stringify({ type, x: cx, y: cy }),
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
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to run job");
      return false;
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
        pendingFrom: get().pendingFrom?.jobId === id ? null : get().pendingFrom,
      });
      toast({ title: "Job deleted", description: "Removed from the workflow" });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to delete job");
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
    const prev = get().jobs;
    try {
      const { jobs } = await api<{ jobs: JobDTO[] }>("/api/jobs");
      set({ jobs });
      // announce transitions running → completed / failed
      for (const job of jobs) {
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
  setPendingFrom: (pending) => set({ pendingFrom: pending }),
  cancelConnect: () => set({ pendingFrom: null }),
  setViewport: (patch) =>
    set((s) => ({
      viewport: { ...s.viewport, ...patch, zoom: clamp(patch.zoom ?? s.viewport.zoom, ZOOM_MIN, ZOOM_MAX) },
    })),
  panBy: (dx, dy) =>
    set((s) => ({ viewport: { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy } })),
  setDragLive: (live) => set({ dragLive: live }),
  setPaletteDrag: (type) => set({ paletteDrag: type }),
}));
