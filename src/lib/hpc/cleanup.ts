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
 * stepping stone to the next job.
 * t339 — exported for the sync-back planner (remote/sync-policy.ts): a
 * type that is bulk for DELETION is bulk for SYNC — both mean "per-
 * micrograph image product", so the local mirror keeps these jobs'
 * metadata only under the key-files policy. */
export const BULK_TYPES = new Set(["motioncorr", "extract", "polish"]);

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

/* ------------------------------------------------------------------ */
/* The re-run wipe (t333)                                              */
/* ------------------------------------------------------------------ */

/**
 * t333 — the fresh-start wipe, the field report's blade: 「reset&，re-run
 * 或者delete任务时会先清除之前已生成的文件吗？」 answered by a crash — a
 * re-run of an extraction with a changed box size died at
 * relion_preprocess image.h:1534 ("write: target and source objects have
 * different size") because the previous run's .mrcs stacks still sat in
 * the STABLE workdir (<root>/<type>_<jobid8>); a NEW job (empty workdir)
 * sailed. The doctrine this classifier serves: **a fresh start is a fresh
 * directory** — RELION GUI's "Overwrite" answer, given automatically.
 *
 * The keep-set here is the t331 contract's FRESH-RUN dialect (a different
 * question earns a different answer — post-run cleanup preserves the
 * chainables for viewing/resume; a re-run is about to REGENERATE them):
 *   1. symlinks — input-data doors, as ever;
 *   2. note.txt — a user's margin note is not a run product;
 *   3. .cf-remote-manifest.json — the LEDGER. The remote wipe prunes it
 *      entry-by-entry (rewriteManifestAfterCleanup) and the new run's
 *      finalize rewrites it; deleting it wholesale would blank the Files
 *      tab while the cluster still holds the old outputs;
 *   4. anything UNRECOGNIZED — unknown still means keep (a new RELION
 *      output shape degrades to "stays", never to "silently deleted").
 *
 * Everything RECOGNIZED as a previous generation's product dies:
 * iteration families (ALL of them — a fresh start has no resume
 * contract), the product extensions (.star/.mrc/.mrcs/.eps/.ctf/.sav/
 * .tmp — inputs never live in the workdir: they ride absolute paths, the
 * project tree, _staged/ or in-place twins, so an extension hit here is
 * a product), the array-shard subtrees, the .cf-* scratch + scripts +
 * verdict dotfiles (all re-made by the new dispatch), and run.out/run.err
 * (the engines append — without this, generation 2's log would open
 * appended to generation 1's).
 *
 * t385 — the one tree that must NEVER enter the wipe set: .cryoflow_prev/.
 * The re-run clear is now a RENAME-ASIDE (stashRemoteRunProducts in
 * remote-cleanup): stale products move into the workdir's .cryoflow_prev/
 * <epoch>/ archive and are reclaimed by a DETACHED background rm — the
 * synchronous unlink storm (the t344/t385 field reports: "batch 1: SSH
 * failed (timeout after 180000ms)" twice on a loaded login node — NFS
 * REMOVE is a synchronous RPC per file, and hundreds of them blow ANY
 * per-batch budget) is off the dispatch's critical path entirely. If the
 * archive's own files were classified wipe, the NEXT re-run would try to
 * rm the whole archived generation synchronously again — the exact
 * slow-death the rename-aside exists to kill. So the archive tree is
 * keep-set here (it is reclaimed detached, never wiped in place).
 */
const WIPE_EXTENSIONS = new Set([
  ".star",
  ".mrc",
  ".mrcs",
  ".eps",
  ".ctf",
  ".sav",
  ".tmp",
]);

/** The rename-aside archive's root name (the t370 hygiene's choice,
 * kept). Lives INSIDE the workdir: same filesystem (a cheap mv),
 * root-level iteration globs never see into it, and deleting the
 * workdir deletes the archive with it. */
export const RUN_ARCHIVE_DIRNAME = ".cryoflow_prev";

/** Is this workdir-relative path inside the rename-aside archive? */
export function isRunArchivePath(relPath: string): boolean {
  return relPath === RUN_ARCHIVE_DIRNAME || relPath.startsWith(RUN_ARCHIVE_DIRNAME + "/");
}

export interface RerunWipeResult {
  /** workdir-relative posix paths the fresh start deletes (every
   * recognized product of the previous generation). */
  wipe: string[];
  /** what survives the wipe (informational, the same account the plan
   * keeps: doors, the ledger, notes, unknowns). */
  kept: { count: number; bytes: number };
}

/**
 * Classify a walked workdir listing for a FRESH re-run. PURE (same
 * recipe as classifyCleanup): the local engine lane, the remote dispatch
 * leg and the diag all speak this one classification, so what the
 * dispatch deletes is exactly what the diag asserts.
 *
 * t394 — opts.keepIterations: a re-run whose argv carries an explicit
 * --continue pointing INSIDE this very workdir keeps the whole run_it###_*
 * family at its live positions. That is RELION's own restart world (the
 * local lane's resume branch has always relied on it): the continued run
 * rewrites each iteration file as it reaches it, and the chosen round's
 * optimiser + siblings are the STATE the run resumes from — wiping them
 * would dangle the user's --continue path one line after the wipe. The
 * keep applies to the WHOLE family (not just the chosen round): RELION
 * derives every sibling name from the optimiser path itself, and a future
 * continue from a different round must find its own siblings alive.
 * Products, scratch and logs still die — the crash this blade kills was
 * the extract .mrcs append, and relion_refine REWRITES its iteration files
 * wholesale (no append semantics to collide with).
 */
export function classifyRerunWipe(
  files: CleanupFileEntry[],
  opts: { keepIterations?: boolean } = {}
): RerunWipeResult {
  const wipe: string[] = [];
  let keptCount = 0;
  let keptBytes = 0;
  for (const f of files) {
    const name = f.path.includes("/") ? f.path.split("/").pop()! : f.path;
    const lower = name.toLowerCase();
    const dot = lower.lastIndexOf(".");

    // ---- the fresh-run keep-set -------------------------------------
    if (f.link) {
      keptCount++; keptBytes += f.size; continue;               // input doors
    }
    if (name === "note.txt" || name === ".cf-remote-manifest.json") {
      keptCount++; keptBytes += f.size; continue;               // note + ledger
    }
    // t385 — the rename-aside archive NEVER wipes in place (see the
    // module story above): a wipe hit here would drag the whole archived
    // generation back onto the synchronous path the archive exists to
    // dodge, and the archive's own bytes die detached (reclaim) instead.
    if (isRunArchivePath(f.path)) {
      keptCount++; keptBytes += f.size; continue;               // archived gens
    }

    // ---- recognized products ----------------------------------------
    if (/^shard_\d+(\/|$)/.test(f.path)) { wipe.push(f.path); continue; } // array scratch subtree
    if (iterationFamilyOf(f.path)) {
      // t394 — the explicit-continue keep (see the opts doc above)
      if (opts.keepIterations) { keptCount++; keptBytes += f.size; continue; }
      wipe.push(f.path); continue;                                   // run_it###_* (all of them)
    }
    if (name.startsWith(".cf-")) { wipe.push(f.path); continue; }         // scratch/scripts/verdict — re-made
    if (name === "run.out" || name === "run.err") { wipe.push(f.path); continue; } // fresh logs
    if (dot > 0 && WIPE_EXTENSIONS.has(lower.slice(dot))) { wipe.push(f.path); continue; }

    // ---- unknown = keep (conservative by construction) ---------------
    keptCount++;
    keptBytes += f.size;
  }
  return { wipe, kept: { count: keptCount, bytes: keptBytes } };
}
