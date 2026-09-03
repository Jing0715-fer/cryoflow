/**
 * CryoFlow — shared DTO types (client + server safe, no runtime deps).
 */

export type JobStatus = "idle" | "running" | "completed" | "failed";

export interface JobDTO {
  id: string;
  projectId: string;
  type: string;
  name: string;
  x: number;
  y: number;
  status: string;
  progress: number;
  /** Parsed from the JSON string stored in the DB ({} fallback). */
  params: Record<string, number | string>;
  result: string | null;
  duration: number;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Which execution engine owns this job (computed per response, not stored). */
  engine?: "sim" | "relion";
  /** True when a real-run log file exists on disk (computed, not stored). */
  hasLog?: boolean;
}

export interface EdgeDTO {
  id: string;
  fromJobId: string;
  toJobId: string;
}

export interface ProjectDTO {
  id: string;
  name: string;
  createdAt: string;
  /** 'spa' | 'tomo' (merged from data/projects.json, not stored in DB). */
  mode?: string;
  /** 'sim' | 'relion' (merged from data/projects.json, not stored in DB). */
  engine?: string;
}

export interface ProjectSummaryDTO {
  id: string;
  name: string;
  mode: string;
  engine: string;
}

/** Parameters are numbers or enum strings. */
export type ParamValue = number | string;

export interface ParamSchema {
  key: string;
  label: string;
  type: "number" | "select";
  default: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
  hint?: string;
}

/**
 * Execution tier:
 * - core:     fully implemented real engine (native builders + CLI)
 * - cmd:      real RELION command template, runs the real binary
 * - external: requires an external binary (MotionCor2 / python+torch / topaz)
 */
export type JobTier = "core" | "cmd" | "external";

export interface JobTypeSpec {
  key: string;
  label: string;
  group: string;
  /** lucide icon NAME — resolved through the client-side iconMap. */
  icon: string;
  color: {
    /** icon / label text color classes (light + dark). */
    text: string;
    /** solid background fragment (color bar, dots). */
    bg: string;
    /** border fragment (port rings). */
    border: string;
    /** soft tinted background fragment. */
    soft: string;
  };
  description: string;
  /** simulated run duration in ms (server adds ±15% jitter). */
  duration: number;
  params: ParamSchema[];
  /** "{n}" is replaced by a deterministic pseudo value. */
  resultTemplate: string;
  tier: JobTier;
}

/** Light-weight mirror of RelionStatus (server module) for the client store. */
export interface SystemStatusClient {
  found: boolean;
  version: string | null;
  path: string | null;
  source: string | null;
  wsl: { available: boolean; relionPath: string | null; note: string };
  binaries: { name: string; present: boolean }[];
  externals: { name: string; present: boolean }[];
  checkedAt: string;
}
