/**
 * CryoFlow — intermediate-file cleanup: the pure planner (CLIENT-SAFE).
 *
 * t331 — the user's ticket: 「增加清理中间过程文件的功能，包括本地和
 * cluster」. In a RELION project the disk hogs are NOT the results — they
 * are the intermediate process files: every iteration's `run_it###_*`
 * copies (the final one carries the science forward), the array shards a
 * parallel run leaves behind, the per-micrograph CTF spectra, and — the
 * real terabytes — the corrected movies and particle stacks that live on
 * long after the STAR files that index them were extracted.
 *
 * This module is the SHARED BRAIN of the cleanup feature, and it is pure
 * by the t320/t326/t327 recipe (zero imports): the route feeds it a walked
 * listing (local readdir or one SSH find over the cluster workdir), the
 * dialog renders its tier meta, the diag asserts its truth table — all
 * three speak the same classification, so the file the user SAW in the
 * preview is exactly the file the server DELETES.
 *
 * THE KEEP-SET IS THE CONTRACT (everything else is negotiable):
 *   1. symlinked entries — the import job's `micrographs` link is the door
 *      to the user's raw data, never a candidate for deletion;
 *   2. the run's own account — every output the record registered
 *      (record.outputs) and every CLUSTER twin (remoteOutputs, t324: a
 *      downstream remote consumer chains off the copy in place);
 *   3. the chainable winners — REMOTE_OUTPUT_CANDIDATES' exact names +
 *      the winning glob hit per key (the non-winning siblings are
 *      intermediates: redundant copies of a kept chainable);
 *   4. the final iteration of every `run_it###_<suffix>` family — RELION
 *      --continue resumes from the HIGHEST iteration, so keeping it keeps
 *      the resume contract (t306's checkpoint doctrine);
 *   5. the witnesses — run.out/run.err (the diagnosis layer reads them,
 *      t323), .cf-exit/.cf-pid (the poll's verdict + liveness), the
 *      dispatch scripts (.cf-run.sh/.cf-sbatch.sh — the run's own
 *      documentation), .cf-remote-manifest.json (the cluster ledger);
 *   6. anything UNRECOGNIZED — a file the planner cannot name is not
 *      intermediate, it is UNKNOWN, and unknown means keep. Conservative
 *      by construction: a new RELION output shape degrades to "stays",
 *      never to "silently deleted".
 *
 * TIERS (deletion is always the user's explicit choice; safe is the only
 * default-on tier — the t327 doctrine, "information, not a gate", lands
 * here as "consequences are spelled out, choices stay checked boxes"):
 *   safe         iteration intermediates, array scratch, merge temps —
 *                nothing downstream or resume-critical can miss them;
 *   diagnostics  CTF spectra + FSC/Guinier .eps plots — the numbers stay
 *                in the STAR files, the rendered curves do not;
 *   bulk         corrected movies / particle stacks (type-gated to the
 *                producers: motioncorr, extract, polish) — the STAR keeps
 *                its rows, the images they point at go. The biggest bytes
 *                and the sharpest consequences: a downstream job that has
 *                not run yet will not find them.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type CleanupTierId = "safe" | "diagnostics" | "bulk";

/** One walked file (local readdir or one SSH find — same shape). */
export interface CleanupFileEntry {
  /** path relative to the run workdir, posix separators */
  path: string;
  /** bytes on disk (0 for symlinks / unknown) */
  size: number;
  /** a symlink entry — input-data doors are never deletable */
  link?: boolean;
}

export interface CleanupGroup {
  tier: CleanupTierId;
  label: string;
  consequence: string;
  /** the largest files first — the preview list (capped, see CAP) */
  files: CleanupFileEntry[];
  /** true when `files` is a cap of a longer list */
  truncated: boolean;
  count: number;
  bytes: number;
  /**
   * EVERY member path of the group (workdir-relative), present only when
   * the caller passes { fullPaths: true }. The plan payload rides the
   * capped `files` window; the EXECUTION pass needs the whole list (the
   * server deletes from its own classification, never from the payload).
   */
  paths?: string[];
}

export interface CleanupSidePlan {
  /** the side's workdir is present + listable */
  exists: boolean;
  workdir: string | null;
  groups: CleanupGroup[];
  /** what survives — the keep-set's own account (informational) */
  kept: { count: number; bytes: number };
  /** honest degradation (SSH failure, unsupported find) — the OTHER side
   * still cleans; this side says exactly what went wrong */
  error?: string;
  note?: string;
}

export interface CleanupDownstream {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface CleanupPlan {
  ok: boolean;
  /** false while the run is alive (local pid / remote staging, PENDING or
   * RUNNING) or the job never ran — the GET still answers (the dialog
   * shows the reason), the POST refuses (409). */
  runnable: boolean;
  reason?: string;
  job: { id: string; name: string; type: string; status: string };
  local: CleanupSidePlan;
  remote: (CleanupSidePlan & {
    /** a remote run record exists at all */
    known: boolean;
    connection: { id: string; name: string; host: string; user: string } | null;
  }) | null;
  downstream: CleanupDownstream[];
  checkedAt: string;
}

export interface CleanupExecuteSide {
  deleted: number;
  freedBytes: number;
  /** per-file failures, verbatim (a vanished file is a skip, not an error) */
  errors: string[];
}

export interface CleanupExecuteResult {
  ok: boolean;
  error?: string;
  local?: CleanupExecuteSide;
  remote?: (CleanupExecuteSide & { manifestRewritten: boolean }) | null;
}

/** The candidates table is INJECTED (engine's REMOTE_OUTPUT_CANDIDATES) —
 * this module stays import-free so the client bundle can share the tier
 * grammar without dragging the fs-touching engine along. */
export interface CleanupCandidates {
  key: string;
  exact?: string[];
  glob?: string;
  pick?: "latest" | "first";
}

export interface CleanupClassifyContext {
  /** job type — gates the bulk tier to the image-stack producers */
  type: string;
  /** record.outputs, normalized to workdir-relative posix paths */
  outputsRel?: string[];
  /** remote twins (remoteOutputs), normalized to workdir-relative */
  twinsRel?: string[];
  candidates?: CleanupCandidates[];
  /** remote side (informational — the witness list is shared, the
   * manifest keeps on both) */
  isRemote?: boolean;
}

export interface CleanupClassifyOpts {
  /** populate each group's `paths` with EVERY member (the execution leg);
   * the plan payload leaves it out (transport courtesy) */
  fullPaths?: boolean;
}

/* ------------------------------------------------------------------ */
/* Tier meta — the dialog and the diag pin these strings                */
/* ------------------------------------------------------------------ */

export const CLEANUP_TIERS: Array<{
  id: CleanupTierId;
  label: string;
  consequence: string;
  defaultOn: boolean;
}> = [
  {
    id: "safe",
    label: "Iteration & scratch files",
    consequence:
      "Old per-iteration copies (run_it###_*), array shard scratch and merge temps. The final iteration of every family stays, so re-runs resume from checkpoints and every chainable output is untouched.",
    defaultOn: true,
  },
  {
    id: "diagnostics",
    label: "CTF & plot diagnostics",
    consequence:
      "Per-micrograph CTF spectra and FSC/Guinier .eps plots stop rendering in the viewers. The fitted values themselves stay in the STAR files.",
    defaultOn: false,
  },
  {
    id: "bulk",
    label: "Bulk image data",
    consequence:
      "Corrected movies / particle stacks referenced by the output STAR. Downstream jobs that have not run yet will miss these images — completed downstream jobs keep their own outputs.",
    defaultOn: false,
  },
];

/** Types whose .mrc/.mrcs payload is reproducible-from-input bulk data —
 * the only ones offered the bulk tier. A class2d's `run_classes.mrcs` is
 * a RESULT (chainable, kept); a motioncorr's corrected movie is a
 * stepping stone to the next job. */
const BULK_TYPES = new Set(["motioncorr", "extract", "polish"]);

/** The witnesses + bookkeeping that always stay (both sides). */
const KEEP_ROOT_NAMES = new Set([
  "run.out",
  "run.err",
  "note.txt",
  ".cf-pid",
  ".cf-exit",
  ".cf-run.sh",
  ".cf-sbatch.sh",
  ".cf-remote-manifest.json",
]);

/** CryoFlow's own array-run scratch (t306): shard STARs, per-task rc
 * files, the merge lock + merge temp — pure intermediates by design. */
const SAFE_DOT_PATTERNS = [/^\.cf-shard-/, /^\.cf-array-rc-/, /^\.cf-merge(\.cf-merge)?$/, /^\.cf-merge\.lock$/];

/** How many files per group ride the plan payload (largest first). The
 * POST never consumes this list — the server re-walks — so the cap is a
 * transport courtesy, not a correctness bound. */
export const CLEANUP_GROUP_FILE_CAP = 24;

/* ------------------------------------------------------------------ */
/* Glob dialect (bash character classes → RegExp)                       */
/* ------------------------------------------------------------------ */

/**
 * Convert a bash glob (the candidates table's dialect: `*`, `?`,
 * `[0-9]` classes — no globstar, `*` does not cross `/`) into an anchored
 * RegExp. Everything else is escaped literally.
 */
export function globToRegExp(glob: string): RegExp {
  let out = "^";
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === "*") {
      out += "[^/]*";
      i++;
    } else if (ch === "?") {
      out += "[^/]";
      i++;
    } else if (ch === "[") {
      const close = glob.indexOf("]", i + 1);
      if (close > i + 1) {
        // pass the class through, stripping a leading ! (bash negation —
        // unused in the table, but the dialect should not silently lie)
        let cls = glob.slice(i + 1, close);
        if (cls.startsWith("!")) cls = "^" + cls.slice(1);
        out += `[${cls.replace(/\\/g, "\\\\")}]`;
        i = close + 1;
      } else {
        out += "\\[";
        i++;
      }
    } else {
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i++;
    }
  }
  return new RegExp(out + "$");
}

/* ------------------------------------------------------------------ */
/* The keep-set                                                         */
/* ------------------------------------------------------------------ */

/** `run_it###_<suffix>` at the workdir root → [iteration, family suffix]. */
export function iterationFamilyOf(
  path: string
): { iter: number; suffix: string } | null {
  const m = /^run_it(\d+)_(.+)$/.exec(path.includes("/") ? path.split("/").pop()! : path);
  if (!m) return null;
  // only at the ROOT: a nested run_it### file is not RELION's dialect
  if (path.includes("/")) return null;
  return { iter: Number(m[1]), suffix: m[2] };
}

/**
 * The chainable winners a listing holds, per the candidates table's own
 * semantics (exact names first — a canonical name beats a globbed sibling;
 * then the winning glob hit per key: "latest" = byte-order max, "first" =
 * any match — RELION zero-pads it###, so byte order IS numeric up to 999
 * iterations, the t324 doctrine). Returns keep-paths + the non-winning
 * glob matches (redundant copies of a kept chainable → safe tier).
 */
export function candidateVerdicts(
  files: CleanupFileEntry[],
  candidates: CleanupCandidates[]
): { keep: Set<string>; redundant: Set<string> } {
  const keep = new Set<string>();
  const redundant = new Set<string>();
  for (const cand of candidates) {
    const globRe = cand.glob ? globToRegExp(cand.glob) : null;
    const globHits: string[] = [];
    for (const f of files) {
      const base = f.path.includes("/") ? "" : f.path; // exact names are root-level
      if (base && (cand.exact ?? []).includes(base)) {
        keep.add(f.path);
      } else if (globRe && globRe.test(f.path)) {
        globHits.push(f.path);
      }
    }
    if (globHits.length > 0) {
      // byte order (LC_ALL=C doctrine — never locale-surprised)
      globHits.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const winner = cand.pick === "first" ? globHits[0] : globHits[globHits.length - 1];
      keep.add(winner);
      for (const p of globHits) if (p !== winner) redundant.add(p);
    }
  }
  return { keep, redundant };
}

/* ------------------------------------------------------------------ */
/* Classification                                                       */
/* ------------------------------------------------------------------ */

interface GroupAcc {
  tier: CleanupTierId;
  files: CleanupFileEntry[];
  paths: string[];
  count: number;
  bytes: number;
  truncated: boolean;
}

function newGroup(tier: CleanupTierId): GroupAcc {
  return { tier, files: [], paths: [], count: 0, bytes: 0, truncated: false };
}

/**
 * Classify a walked listing into tier groups + the keep-set account.
 * PURE: same listing + same context → same plan, on every side that runs
 * it (the diag's unit table, the route's GET and the route's POST all
 * call THIS — the preview and the deletion cannot disagree).
 */
export function classifyCleanup(
  files: CleanupFileEntry[],
  ctx: CleanupClassifyContext,
  opts: CleanupClassifyOpts = {}
): { groups: CleanupGroup[]; kept: { count: number; bytes: number } } {
  const acc: Record<CleanupTierId, GroupAcc> = {
    safe: newGroup("safe"),
    diagnostics: newGroup("diagnostics"),
    bulk: newGroup("bulk"),
  };
  let keptCount = 0;
  let keptBytes = 0;

  const outputs = new Set(ctx.outputsRel ?? []);
  const twins = new Set(ctx.twinsRel ?? []);
  const verdicts = candidateVerdicts(files, ctx.candidates ?? []);

  // final iteration per `run_it###_<suffix>` family (the resume contract)
  const familyMax = new Map<string, number>();
  for (const f of files) {
    const fam = iterationFamilyOf(f.path);
    if (!fam) continue;
    const cur = familyMax.get(fam.suffix);
    if (cur === undefined || fam.iter > cur) familyMax.set(fam.suffix, fam.iter);
  }
  const finalIters = new Set<string>();
  for (const f of files) {
    const fam = iterationFamilyOf(f.path);
    if (fam && fam.iter === familyMax.get(fam.suffix)) finalIters.add(f.path);
  }

  const bulkAllowed = BULK_TYPES.has(ctx.type);

  for (const f of files) {
    const base = f.path.includes("/") ? null : f.path;
    const lower = f.path.toLowerCase();

    // ---- the keep-set (the contract) --------------------------------
    if (f.link) {
      keptCount++; keptBytes += f.size; continue;             // input doors
    }
    if (base && KEEP_ROOT_NAMES.has(base)) {
      keptCount++; keptBytes += f.size; continue;             // witnesses
    }
    if (outputs.has(f.path) || twins.has(f.path)) {
      keptCount++; keptBytes += f.size; continue;             // own account
    }
    if (verdicts.keep.has(f.path)) {
      keptCount++; keptBytes += f.size; continue;             // chainable winners
    }
    if (finalIters.has(f.path)) {
      keptCount++; keptBytes += f.size; continue;             // resume checkpoints
    }

    // ---- deletable tiers --------------------------------------------
    // safe: scratch + redundant chainable copies + beaten iterations
    if (base && SAFE_DOT_PATTERNS.some((re) => re.test(base))) { add(acc.safe, f); continue; }
    if (/^shard_\d+(\/|$)/.test(f.path)) { add(acc.safe, f); continue; }
    if (lower.endsWith(".tmp")) { add(acc.safe, f); continue; }
    if (verdicts.redundant.has(f.path)) { add(acc.safe, f); continue; }
    const fam = iterationFamilyOf(f.path);
    if (fam && fam.iter < (familyMax.get(fam.suffix) ?? 0)) { add(acc.safe, f); continue; }

    // diagnostics: plots + spectra (the numbers live in the STARs)
    if (lower.endsWith(".eps") || lower.endsWith(".ctf") || lower.endsWith("_ctf.mrc")) {
      add(acc.diagnostics, f); continue;
    }

    // bulk: the image stacks themselves (type-gated producers only)
    if (bulkAllowed && (lower.endsWith(".mrc") || lower.endsWith(".mrcs"))) {
      add(acc.bulk, f); continue;
    }

    // ---- unknown = keep (conservative by construction) ---------------
    keptCount++; keptBytes += f.size;
  }

  const groups: CleanupGroup[] = [];
  for (const tier of ["safe", "diagnostics", "bulk"] as const) {
    const g = acc[tier];
    if (g.count === 0) continue;
    const meta = CLEANUP_TIERS.find((t) => t.id === tier)!;
    g.files.sort((a, b) => b.size - a.size || (a.path < b.path ? -1 : 1));
    groups.push({
      tier,
      label: meta.label,
      consequence: meta.consequence,
      files: g.files.slice(0, CLEANUP_GROUP_FILE_CAP),
      truncated: g.count > CLEANUP_GROUP_FILE_CAP,
      count: g.count,
      bytes: g.bytes,
      ...(opts.fullPaths ? { paths: g.paths } : {}),
    });
  }
  return { groups, kept: { count: keptCount, bytes: keptBytes } };
}

function add(g: GroupAcc, f: CleanupFileEntry): void {
  g.count++;
  g.bytes += f.size;
  g.files.push(f);
  g.paths.push(f.path);
}

/** Which tiers a plan offers at all (drives the dialog's checkboxes). */
export function planTiers(plan: CleanupPlan): CleanupTierId[] {
  const tiers = new Set<CleanupTierId>();
  for (const g of plan.local.groups) tiers.add(g.tier);
  if (plan.remote) for (const g of plan.remote.groups) tiers.add(g.tier);
  return (["safe", "diagnostics", "bulk"] as CleanupTierId[]).filter((t) =>
    tiers.has(t)
  );
}
