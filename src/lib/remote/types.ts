/**
 * CryoFlow — remote cluster types (CLIENT-SAFE: imported by UI + API routes).
 *
 * The remote layer lets the browser app (running on a laptop) drive RELION on
 * an SSH-reachable cluster: the user describes HOW to log in (host/user/auth),
 * CryoFlow probes WHICH relion versions `module load` offers, and every run
 * can be dispatched to a chosen connection + module. This file is the single
 * shape contract between the /api/remote/* routes, the run engine and the UI.
 */

/** How to authenticate against the SSH server. */
export type RemoteAuthMethod = "agent" | "key" | "password";

/**
 * A saved SSH cluster connection. Secrets (password / passphrase) are stored
 * in data/remote-connections.json (0600, local machine only) and NEVER leave
 * the server — every API response returns RemoteConnectionDTO (no secrets).
 */
export interface RemoteConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: RemoteAuthMethod;
  /** Path to a private key file ON THIS MACHINE (authMethod=key). */
  privateKeyPath: string | null;
  /** Key passphrase (authMethod=key, optional). */
  passphrase: string | null;
  /** Login password (authMethod=password). */
  password: string | null;
  /**
   * Cluster-side directory that mirrors the local RELION workdir root
   * (data/relion). Job workdirs are created under <remoteRoot>/<projectId>/…
   * and outputs sync back into the local mirror after completion.
   */
  remoteRoot: string;
  /** Default `module load` target (e.g. "relion/5.0.1") — probed or manual. */
  defaultModule: string | null;
  /** Extra environment lines sourced before runs (exports, other modules). */
  envLines: string[];
  /** Submit through Slurm (sbatch) instead of a direct nohup process. */
  useSlurm: boolean;
  /**
   * t289 — what finalize syncs back into the LOCAL mirror:
   *   "key-files"  text outputs (.star/.log/…) always; binary outputs only
   *                up to keyFileMb (class averages yes, maps & stacks stay
   *                on the cluster — listed + fetchable on demand)
   *   "everything" the previous behavior: every file under the caps below
   * Absent (pre-t289 records) reads as "key-files" — bulky maps stopped
   * silently landing on the laptop by default.
   */
  syncPolicy?: "key-files" | "everything";
  /** t289 — per-file cap (MB) for the key-files policy's binary leg. */
  keyFileMb?: number;
  /** File sync caps (MB) — per single file and per whole workdir sync-back. */
  maxFileMb: number;
  maxTotalMb: number;
  /** Last successful probe result (module list etc.) — informational. */
  lastProbe: RemoteProbe | null;
}

/** Secret-free projection returned by every API route. */
export type RemoteConnectionDTO = Omit<
  RemoteConnection,
  "password" | "passphrase"
> & {
  /** True when a secret is stored (so the UI can show "saved" vs "empty"). */
  hasPassword: boolean;
  hasPassphrase: boolean;
  /**
   * t270 — the connection's run résumé: what this cluster has DONE for the
   * user, aggregated from the run records. Absent while nothing ever ran
   * ("no résumé" is itself the honest state — the UI renders no card).
   */
  resume?: ConnectionRunResume;
};

/** One recent run in the résumé (newest first in the parent list). */
export interface ConnectionRunResumeEntry {
  jobId: string;
  jobType: string;
  done: boolean;
  exitCode: number | null;
  startedAt: string;
  /** t269 ledger fragments — present when the run reached that stage. */
  stagedMs?: number;
  syncMs?: number;
  syncedFiles?: number;
  syncedBytes?: number;
  /**
   * t272 — does the job still exist on ANY canvas? The connection and the
   * run records are global; the job is per-project. Absent (pre-t272 DTO)
   * means the server did not say — the UI keeps the honest merged wording.
   * true with the job absent from THIS canvas = "another project's canvas";
   * false = the job is gone everywhere (the résumé keeps it as history).
   */
  exists?: boolean;
  /** t272 — the owning project's name, when the job still exists. */
  projectName?: string;
}

/** Aggregate of every remote run dispatched through one connection. */
export interface ConnectionRunResume {
  total: number;
  completed: number;
  failed: number;
  /** ISO time of the most recent run (any terminal state counts). */
  lastRunAt: string | null;
  /**
   * The résumé's rows, newest first. The list route keeps ≤3 (the reading
   * line); t295's panorama route returns EVERY entry under the same shape —
   * the card's expand swaps the full aggregate in wholesale.
   */
  recent: ConnectionRunResumeEntry[];
}

/** What `module avail` / `module spider` revealed about a cluster. */
export interface RemoteProbe {
  ok: boolean;
  checkedAt: string;
  /** `uname -a` of the login node (shown in the UI). */
  uname: string | null;
  /** "lmod" | "envmodules" | "none". */
  moduleSystem: string;
  /** All relion module names found, e.g. ["relion/4.4.1", "relion/5.0.1"]. */
  relionModules: string[];
  /** module → install root (…/bin contains relion_refine), when resolvable. */
  relionHomes: Record<string, string>;
  /** mpirun availability per module (module → true/false). */
  relionMpi: Record<string, boolean>;
  /** ctffind executable per module (module → path), when found. */
  relionCtffind: Record<string, string>;
  /**
   * External (non-relion) programs per module (module → key → absolute
   * cluster path): motioncor2, topaz, modelangelo, dynamight, tomo_denoise,
   * tomo_pick. Resolved ON the cluster after `module load` — the argv a
   * cluster run builds must reference cluster paths, never local ones
   * (t262's finding #3, hardened t264: externals belong to the world they
   * run in).
   */
  externals: Record<string, Record<string, string>>;
  /** Slurm client (sbatch/squeue) present on the login node. */
  slurm: boolean;
  /** GPU names from nvidia-smi (empty = no GPUs visible on login node). */
  gpus: string[];
  /**
   * t289 — the login node's $HOME (absolute, no ~). The dialog uses it to
   * show the remote root RESOLVED ("~/cryoflow → /home/cryo/cryoflow") —
   * a root the user can see is a root the user can trust. Optional: probes
   * recorded before t289 lack it.
   */
  homeDir?: string | null;
  /** First error line when the probe could not complete. */
  error?: string;
  /**
   * t268 — wall-clock cost of the whole probe round-trip (ms). The probe is
   * load-bearing (t267: the dispatch runs it itself), so its cost is part of
   * the connection's honest story: the dialog shows it next to the check
   * time, and a slow cluster's dispatch latency is visible instead of felt.
   * Optional because lastProbe records saved before t268 lack it.
   */
  durationMs?: number;
}

/** Where + how a job should run on the cluster. */
export interface RemoteRunTarget {
  connectionId: string;
  /** Module to load (defaults to connection.defaultModule). */
  module: string | null;
  /** "direct" = nohup process, "slurm" = sbatch submission. */
  mode: "direct" | "slurm";
}

/** Per-job remote execution info (attached to JobDTO while relevant). */
export interface RemoteRunInfo {
  connectionId: string;
  connectionName: string;
  host: string;
  user: string;
  module: string;
  mode: "direct" | "slurm";
  /** Cluster-side working directory. */
  remoteWorkdir: string;
  /** Slurm job id (mode=slurm). */
  slurmId?: string;
  /** Cluster-side pid (mode=direct). */
  pid?: number;
  /** Lifecycle phase (staging = uploading inputs to the cluster). */
  phase: "staging" | "running";
  /** Bytes staged to the cluster so far (feedback while staging). */
  stagedBytes?: number;
  /** Non-fatal note (ssh loss, capped sync-back …). */
  note?: string;
  /** t269 — wall-clock staging duration (ms), set when staging hands off to the spawn. */
  stagedMs?: number;
  /** t269 — wall-clock sync-back duration (ms), set at finalize. */
  syncMs?: number;
  /** t269 — files + bytes pulled back to the local mirror at finalize. */
  syncedFiles?: number;
  syncedBytes?: number;
}

/**
 * Engine-side remote run state, embedded in RunRecord.remote (server only,
 * but kept client-safe so the DTO can project fragments of it).
 */
export interface RemoteRunState {
  connectionId: string;
  connectionName: string;
  /** host:port as configured. */
  host: string;
  user: string;
  /** The `module load` target used for this run ("" = none/bare install). */
  module: string;
  mode: "direct" | "slurm";
  /** Expanded remote workdir root (no leading ~). */
  remoteRoot: string;
  remoteWorkdir: string;
  /** direct mode: cluster-side session leader pid. */
  pid: number | null;
  /** slurm mode: scheduler job id. */
  slurmId: string | null;
  /** Lifecycle: staging inputs → running → (done flips on RunRecord). */
  phase: "staging" | "running";
  /** Cluster-side outputs (filled at finalize) — key → remote path. */
  remoteOutputs?: Record<string, string>;
  /** Bytes + count pulled back to the local mirror at finalize. */
  syncedFiles?: number;
  syncedBytes?: number;
  /** Files left on the cluster (over the sync caps) — relative names. */
  skippedFiles?: string[];
  /** Non-fatal notes surfaced in the UI (ssh loss, staging interrupted). */
  note?: string;
  /** Total bytes staged TO the cluster (inputs) — user feedback. */
  stagedBytes?: number;
  /** t269 — wall-clock staging duration (ms), set when staging hands off to the spawn. */
  stagedMs?: number;
  /** t269 — wall-clock sync-back duration (ms), set at finalize. */
  syncMs?: number;
  /**
   * Staging heartbeat (ms epoch) — touched every 10s by the background
   * staging task while it is alive. The poll sweep reads it to tell
   * "still uploading" from "task vanished without a trace" (a void-spawned
   * task whose SSH exec hangs has no supervisor; without the beat the row
   * waited out the 30min fallback). Absent on pre-heartbeat ledgers and
   * records read after a restart before the first beat — those still fall
   * back to the age window.
   */
  stagingBeat?: number;
}
