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
  params: Record<string, ParamValue>;
  result: string | null;
  duration: number;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Which execution engine owns this job (computed per response, not stored). */
  engine?: "sim" | "relion";
  /** True when a real-run log file exists on disk (computed, not stored). */
  hasLog?: boolean;
  /** Owning workspace id (server always assigns one; null = pre-migration). */
  workspaceId?: string | null;
  /** Soft link: non-null when this job MIRRORS another job's outputs.
   *  Linked jobs are read-only — downstream jobs consume the original. */
  linkedJobId?: string | null;
  /** Convenience: the ORIGINAL's name (links only, computed per response). */
  linkedName?: string | null;
  /** Convenience: the ORIGINAL's workspace name (links only, computed). */
  linkedWorkspaceName?: string | null;
  /** How many links in the whole project reference THIS job (originals only).
   *  Powers "referenced elsewhere" badges + delete warnings. */
  linkCount?: number;
}

/** Sidebar workspace row (GET /api/workspaces). */
export interface WorkspaceDTO {
  id: string;
  projectId: string;
  name: string;
  order: number;
  createdAt: string;
  stats?: {
    total: number;
    running: number;
    completed: number;
    failed: number;
    /** Jobs in this workspace that are soft links to originals elsewhere. */
    links: number;
  };
}

export interface EdgeDTO {
  id: string;
  fromJobId: string;
  toJobId: string;
  /** Output port name on the source job (e.g. "particles", "half1"). */
  fromPort?: string;
  /** Input port name on the target job (e.g. "reference", "mask"). */
  toPort?: string;
}

export interface ProjectDTO {
  id: string;
  name: string;
  createdAt: string;
  /** 'spa' | 'tomo' (merged from data/projects.json, not stored in DB). */
  mode?: string;
  /** 'sim' | 'relion' (merged from data/projects.json, not stored in DB). */
  engine?: string;
  /** Job statistics (computed on the server for the project panel). */
  stats?: { total: number; running: number; completed: number; failed: number };
}

export interface ProjectSummaryDTO {
  id: string;
  name: string;
  mode: string;
  engine: string;
}

/** Parameters are numbers, enum strings, booleans or filesystem paths. */
export type ParamValue = number | string | boolean;

export type ParamType = "number" | "select" | "bool" | "path";

export interface ParamSchema {
  key: string;
  label: string;
  type: ParamType;
  default: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
  hint?: string;
  /**
   * RELION GUI tab this parameter lives in ("I/O", "CTF", "Sampling",
   * "Optimisation", "Compute", "Reference", …). Defaults to "Additional".
   */
  tab?: string;
  /**
   * Expert option — collapsed behind the per-tab "expert options" toggle,
   * exactly like RELION's "expert" flag in the GUI job windows.
   */
  advanced?: boolean;
  /**
   * Path params with filePick open the browser dialog on the "Files &
   * pattern" tab by default (multi-select + wildcard preview) instead of the
   * folder tab — RELION Import style.
   */
  filePick?: boolean;
}

/* ------------------------------------------------------------------ */
/* Ports (multi-port connections)                                      */
/* ------------------------------------------------------------------ */

/**
 * Data flowing through a port — mirrors the RELION pipeliner node types
 * (Movies, Micrographs, Coordinates, Particles, 2D references, 3D maps,
 * half-maps, masks, tilt series, tomograms, generic STAR metadata).
 */
export type PortKind =
  | "movies"
  | "micrographs"
  | "coords"
  | "particles"
  | "references2d"
  | "volume"
  | "halfmap"
  | "mask"
  | "star"
  | "tiltseries"
  | "tomograms";

export interface PortSpec {
  /** Stable port id: "particles", "half1", "reference", "mask"… */
  name: string;
  /** RELION-style GUI label ("Input images STAR file (.star)"). */
  label: string;
  /** Output data kind. */
  kind?: PortKind;
  /** Input accepted kinds ("*" = any, e.g. External). */
  accepts?: (PortKind | "*")[];
  /** Input may receive several edges (select, joinstar, external…). */
  multiple?: boolean;
}

/** Tailwind fragments used to tint ports by data kind. */
export interface PortColor {
  dot: string;
  ring: string;
  label: string;
}

/** Execution tier:
 *  - core:     fully implemented real engine (native builders + CLI)
 *  - cmd:      real RELION command template, runs the real binary
 *  - external: requires an external binary (MotionCor2 / python+torch / topaz)
 */
export type JobTier = "core" | "cmd" | "external";

export interface JobTypeSpec {
  key: string;
  label: string;
  group: string;
  /** Palette collapse category (RELION job-browser tree). */
  category: string;
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
  /** Ordered RELION GUI tabs for the params panel. */
  tabs: string[];
  /** Named inputs (left edge of the card). */
  inputs: PortSpec[];
  /** Named outputs (right edge of the card). */
  outputs: PortSpec[];
  params: ParamSchema[];
  /** "{n}" is replaced by a deterministic pseudo value. */
  resultTemplate: string;
  tier: JobTier;
}

/** WSL probe result — distinguishes "no WSL" from "WSL ok, RELION not on PATH". */
export interface WslStatusClient {
  /** WSL itself is installed AND a distro responds. */
  available: boolean;
  /** Why WSL is unavailable: "no-wsl" (wsl.exe absent) | "no-distro" (no running distro). */
  unavailableReason: "no-wsl" | "no-distro" | null;
  /** RELION bin dir inside WSL (null when not found). */
  relionPath: string | null;
  /** RELION install root inside WSL (parent of bin/). */
  relionHome: string | null;
  /** RELION version inside WSL (when found). */
  version: string | null;
  /** How RELION was found: "login-shell PATH" | "RELION_HOME env" | "filesystem search" | null. */
  source: string | null;
  /** Default WSL distro name (when available). */
  distro: string | null;
  /** Human-readable result with actionable guidance (may be multi-line). */
  note: string;
  /** mpirun path inside the distro (null → serial binaries only). Optional: older cached payloads may omit it. */
  mpirunPath?: string | null;
  /** relion_refine_mpi present in the distro bin dir (MPI-capable install). */
  mpiBinary?: boolean;
  /** ctffind path inside the distro (null → CTF jobs cannot run there). */
  ctffindPath?: string | null;
}

/** Light-weight mirror of RelionStatus (server module) for the client store. */
export interface SystemStatusClient {
  found: boolean;
  /**
   * How jobs can execute the detected RELION:
   *  - "native": the app process can spawn the binaries at `path` directly
   *              (host install, or the server itself runs inside the same Linux/WSL fs).
   *  - "wsl":    RELION lives inside WSL; `path` is a distro-internal path that this
   *              process cannot spawn directly (Windows host) — bridge required.
   *  - null:     not found anywhere.
   */
  execution: "native" | "wsl" | null;
  version: string | null;
  path: string | null;
  source: string | null;
  wsl: WslStatusClient;
  binaries: { name: string; present: boolean }[];
  externals: { name: string; present: boolean }[];
  checkedAt: string;
}
