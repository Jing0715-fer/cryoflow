/**
 * t1151 — the HPC profile registry, the AGENT face: a PURE presenter.
 *
 * The user's tuned sbatch vocabulary learned to speak in t259 (the
 * metadata door: the registry names the SUBMISSION TARGETS — ssh hosts,
 * accounts, filesystem roots) and the profiles editor gives every field
 * a face (Partition, QoS, GPUs / node, Time limit, Array throttle,
 * RELION home, Data root, ctffind binary, Environment preparation
 * lines). The registry's ONLY consumers were the editor and the sbatch
 * dry-run door — no agent tool could quote it: a user asking 「集群上我
 * 的 profile 是什么配置」 or "which partition / how many GPUs / what
 * walltime" forced the model to invent submission targets. Inventing a
 * sbatch vocabulary the user tuned by hand is how a twin is born.
 *
 * Laws:
 *  - THE READ RIDES THE ONE FATHER — loadProfilesVerdict (lib/hpc/
 *    slurm.ts) is the SAME read loadProfiles serves (its own father,
 *    byte-equal); the three faces — never-persisted / corrupt /
 *    persisted — each get their own word (the t753 law: the
 *    unknown-able is shown, never hidden).
 *  - THE DEFAULTS ARE EXAMPLES, AND THE FACE SAYS SO — the house
 *    defaults carry example.org hosts; a model quoting them as the
 *    user's real cluster invents a cluster that does not exist.
 *  - THE DISPLAY DIALECT IS THE EDITOR'S — the field words are the
 *    editor's own labels ("GPUs / node", "Time limit (min)", "Array
 *    throttle", "Sim speed × (simulator only)", "ctffind binary",
 *    "RELION home", "Data root", "Local data root (pinned by the
 *    server)"), the rows ride the registry's OWN order (the editor
 *    sidebar's order — no sort law exists here), and host: null speaks
 *    its own meaning (submit locally).
 *  - NO AGE JUDGMENT — a profile does not rot: the face speaks the
 *    walltime and the throttle, never a pace. The module takes no
 *    clock at all.
 *  - THE REGISTRY IS THE SERVER'S — one global file; it speaks across
 *    projects and browsers (the list_job_types precedent). No project
 *    scope, no user scope.
 *  - READ-ONLY QUOTER — the sbatch dry-run door wears ONE profile by
 *    its id for ONE job's script; the real remote lane rides the
 *    CONNECTION's own Slurm settings (list_clusters is the
 *    connections' roster — the cousin line drawn). The agent never
 *    writes a profile.
 *  - PURE — no React, no store, no db, no fs, no clock (the rows come
 *    fed; the module never touches the registry's file).
 */

/** Structurally the tools' AiToolResult — the pure module defines its
 *  own shape so it never imports the tool executor's world (db, prisma,
 *  the engine, the fs). */
export interface HpcProfileToolResult {
  ok: boolean;
  summary: string;
  detail?: unknown;
}

/** The registry's own row, fed whole — structurally the lib's
 *  SlurmProfile (re-declared here so the pure module never imports the
 *  engine-carrying lib). */
export interface HpcProfileRowInput {
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

export interface HpcProfilesInput {
  /** False = the house defaults answer (the registry was never saved). */
  persisted: boolean;
  /** True = the saved registry could not be read or parsed. */
  corrupt: boolean;
  profiles: HpcProfileRowInput[];
}

export interface HpcProfileRow {
  id: string;
  name: string;
  /** The editor's "Login host"; null = submits locally. */
  host: string | null;
  hostMode: "cluster" | "local";
  partition: string;
  account: string | null;
  qos: string | null;
  /** The editor's "Time limit (min)" — 0 = no explicit limit. */
  timeLimitMin: number;
  nodes: number;
  gpusPerNode: number;
  gpuModel: string;
  relionHome: string;
  dataRoot: string;
  localRoot: string;
  /** The editor's "Environment preparation lines", byte for byte. */
  envLines: string[];
  ctffind: string | null;
  /** The editor's "Array throttle" (the Slurm %N cap). */
  arrayConcurrency: number;
  /** The editor's "Sim speed ×" — simulator only. */
  gpuSpeedup: number;
}

const hostWordOf = (host: string | null): string =>
  host ? host : "submits locally (the Slurm client on this machine)";

/** t1151 — the registry's agent face. Feed it the verdict father's read;
 *  it returns the registry's own rows (the editor's order and words)
 *  plus a summary that names every profile so a skim answers "what
 *  submission targets do I have?" without opening the annex. */
export function presentHpcProfiles(input: HpcProfilesInput): HpcProfileToolResult {
  if (input.corrupt) {
    return {
      ok: true,
      summary:
        "The saved profile registry could not be read or parsed — the house defaults answer until the next " +
        "save rewrites it (the loader's own fall-through, now said aloud). Quote nothing as the user's tuning " +
        "until then.",
      detail: { persisted: true, corrupt: true, profiles: [] },
    };
  }

  if (!input.persisted) {
    return {
      ok: true,
      summary:
        "The profile registry has never been saved on this server — these are the HOUSE DEFAULTS: a local " +
        "workstation profile (submits locally) and two EXAMPLE clusters whose hosts end in .example.org. " +
        "They are examples, not the user's real clusters — quote them as defaults, never as a reachable " +
        "submission target. Tune them in the cluster profiles editor; a save lands them as the registry's own rows.",
      detail: {
        persisted: false,
        corrupt: false,
        profiles: input.profiles.map((p) => presentRow(p)),
      },
    };
  }

  if (input.profiles.length === 0) {
    return {
      ok: true,
      summary:
        "The saved profile registry holds 0 profiles — an emptied registry is the deletion's truth, not a " +
        "missing sync. The sbatch dry-run door has no translation target until a profile is saved.",
      detail: { persisted: true, corrupt: false, profiles: [] },
    };
  }

  const rows = input.profiles.map((p) => presentRow(p));
  const listing = rows
    .map(
      (r) =>
        `"${r.name}" → ${r.partition} on ${hostWordOf(r.host)} ` +
        `(${r.nodes} node${r.nodes === 1 ? "" : "s"} × ${r.gpusPerNode} GPU${r.gpusPerNode === 1 ? "" : "s"}/node ${r.gpuModel})`
    )
    .join("; ");
  const summary =
    `The profile registry holds ${rows.length} profile${rows.length === 1 ? "" : "s"} ` +
    `(the editor's own order): ${listing}. ` +
    "Wear one through the sbatch dry-run door (it translates one job's script onto the profile's paths, " +
    "env and GPU strategy); the real remote lane rides the connection's own Slurm settings — list_clusters " +
    "is the connections' roster, this is the sbatch translation vocabulary. The registry is the SERVER's — " +
    "it speaks across projects and browsers.";

  return {
    ok: true,
    summary,
    detail: { persisted: true, corrupt: false, profiles: rows },
  };
}

function presentRow(p: HpcProfileRowInput): HpcProfileRow {
  return {
    id: p.id,
    name: p.name,
    host: p.host,
    hostMode: p.host ? "cluster" : "local",
    partition: p.partition,
    account: p.account,
    qos: p.qos,
    timeLimitMin: p.timeLimitMin,
    nodes: p.nodes,
    gpusPerNode: p.gpusPerNode,
    gpuModel: p.gpuModel,
    relionHome: p.relionHome,
    dataRoot: p.dataRoot,
    localRoot: p.localRoot,
    envLines: p.envLines,
    ctffind: p.ctffind,
    arrayConcurrency: p.arrayConcurrency,
    gpuSpeedup: p.gpuSpeedup,
  };
}
