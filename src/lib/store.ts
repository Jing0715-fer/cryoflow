"use client";

/**
 * CryoFlow — global workflow state (zustand).
 */

import { create } from "zustand";
import { toast } from "@/hooks/use-toast";
import { CARD_W, CARD_H, jobType } from "./workflow";
import type { EdgeDTO, JobDTO, ProjectDTO } from "./types";

interface WorkflowState {
  jobs: JobDTO[];
  edges: EdgeDTO[];
  project: ProjectDTO | null;
  selectedId: string | null;
  pendingFrom: string | null;
  zoom: number;
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  addJob: (type: string) => Promise<void>;
  moveJobCommit: (id: string, x: number, y: number) => Promise<void>;
  saveJob: (id: string, patch: { name?: string; params?: Record<string, number | string> }) => Promise<void>;
  runJob: (id: string) => Promise<boolean>;
  resetJob: (id: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  connect: (from: string, to: string) => Promise<void>;
  removeEdge: (id: string) => Promise<void>;
  pollTick: () => Promise<void>;

  select: (id: string | null) => void;
  setPendingFrom: (id: string | null) => void;
  cancelConnect: () => void;
  setZoom: (zoom: number) => void;
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

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  jobs: [],
  edges: [],
  project: null,
  selectedId: null,
  pendingFrom: null,
  zoom: 1,
  loading: true,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [p, j, e] = await Promise.all([
        api<{ project: ProjectDTO }>("/api/project"),
        api<{ jobs: JobDTO[] }>("/api/jobs"),
        api<{ edges: EdgeDTO[] }>("/api/edges"),
      ]);
      set({
        project: p.project,
        jobs: j.jobs,
        edges: e.edges,
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load project";
      set({ loading: false, error: msg });
      errToast(msg);
    }
  },

  addJob: async (type) => {
    const spec = jobType(type);
    if (!spec) {
      errToast(`Unknown job type: ${type}`);
      return;
    }
    const { jobs, selectedId } = get();
    const n = jobs.length;
    const selected = jobs.find((j) => j.id === selectedId);
    const x = selected ? selected.x + CARD_W + 64 : 16 + (n % 3) * (CARD_W + 64);
    const y = selected ? selected.y + 48 : 220 + Math.floor(n / 3) * (CARD_H + 60);
    try {
      const { job } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ type, x, y }),
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
      const { job } = await api<{ job: JobDTO }>(`/api/jobs/${id}/run`, {
        method: "POST",
      });
      set({ jobs: get().jobs.map((j) => (j.id === id ? job : j)) });
      toast({ title: "Job started", description: `${job.name} is now running` });
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
        pendingFrom: get().pendingFrom === id ? null : get().pendingFrom,
      });
      toast({ title: "Job deleted", description: "Removed from the workflow" });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to delete job");
    }
  },

  connect: async (from, to) => {
    const { edges } = get();
    if (from === to) return;
    if (edges.some((e) => e.fromJobId === from && e.toJobId === to)) {
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
        body: JSON.stringify({ fromJobId: from, toJobId: to }),
      });
      set({ edges: [...get().edges, edge], pendingFrom: null });
      const fromName = get().jobs.find((j) => j.id === from)?.name ?? "Job";
      const toName = get().jobs.find((j) => j.id === to)?.name ?? "job";
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
      // announce transitions running → completed
      for (const job of jobs) {
        const before = prev.find((p) => p.id === job.id);
        if (before?.status === "running" && job.status === "completed") {
          toast({
            title: `${job.name} completed`,
            description: job.result ?? undefined,
          });
        }
      }
    } catch {
      // polling errors are transient — keep the interval alive
    }
  },

  select: (id) => set({ selectedId: id }),
  setPendingFrom: (id) => set({ pendingFrom: id }),
  cancelConnect: () => set({ pendingFrom: null }),
  setZoom: (zoom) => set({ zoom }),
}));
