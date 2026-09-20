/**
 * Failure diagnosis — pattern recognition over the engine log.
 *
 * When a job fails, the Log tab answers WHAT happened (the log itself);
 * this module answers WHY, the way a colleague skimming the tail would:
 * a handful of well-known failure signatures (OOM kill, CUDA/GPU memory,
 * full disk, missing upstream file, permissions, segfault, MPI abort,
 * Python traceback) each mapped to an actionable next step. The Log tab
 * strip (job-inspector) renders the findings; nothing else interprets log
 * text — this table is the single source of that interpretation, so a
 * pattern tweak heals every surface. A failed log matching NOTHING is
 * itself a verdict the UI reports honestly (Task 121 negative teaser):
 * "no known signature — the cause is custom, the log is the truth".
 *
 * Deliberately conservative: every pattern is a string the OS/runtime
 * itself emits (errno text, shell kill message, CUDA error text), never
 * a loose word like "error" — RELION chatter says "error" all day and a
 * loose match would cry wolf on healthy runs. A finding is a hint with
 * provenance (line number + excerpt), not a verdict; the strip says so.
 */

export interface LogFinding {
  /** Stable pattern id (probe contract + icon key). */
  id: string;
  /** One-line diagnosis — what happened. */
  label: string;
  /** Actionable next step — what to do about it. */
  hint: string;
  /** How many lines matched (first occurrence plus repeats). */
  count: number;
  /** 1-based line number of the first match, in the window the user is
   *  reading (tail window numbering — the excerpt sits right there). */
  firstLine: number;
  /** Trimmed first matching line, whitespace-collapsed, ≤200 chars. */
  excerpt: string;
}

export interface LogPattern {
  id: string;
  /** Stateless (non-global) regex — .test() must not carry lastIndex. */
  re: RegExp;
  label: string;
  hint: string;
}

export const LOG_PATTERNS: LogPattern[] = [
  {
    id: "oom-kill",
    // the shell's exact word for SIGKILL, plus the kernel's oom announcement
    re: /\bKilled\b|oom-kill(?:er)?\b/i,
    label: "Process killed — the OOM killer is the usual suspect",
    hint: "The host ran out of memory: lower the thread count, shrink the box or batch size, or move to a bigger machine — then re-run.",
  },
  {
    id: "gpu-oom",
    // CUDA's allocation failure text; "out of memory" catches the RAM
    // allocator's phrasing and std::bad_alloc is the C++ runtime's name
    // for the same death (same remedy family) — Task 121 made the comment
    // true by adding the marker itself
    re: /cuda[\w: ]*(?:error|out of memory)|out of memory|hipError|std::bad_alloc/i,
    label: "Out-of-memory error (GPU/RAM allocator)",
    hint: "Reduce memory pressure: fewer threads, smaller batch, or a smaller box — GPU jobs can also split the data across cards.",
  },
  {
    id: "disk-full",
    // errno strings as the engine writes them
    re: /no space left on device|disk quota exceeded|read-only file system/i,
    label: "Disk full or read-only",
    hint: "Free space in the project/scratch directory (old jobs, intermediate movies), check the quota, then re-run.",
  },
  {
    id: "missing-input",
    re: /no such file or directory/i,
    label: "Missing file — an upstream output did not land",
    hint: "Check that the upstream job finished and wrote its outputs, and verify the input path in the I/O tab.",
  },
  {
    id: "permission",
    re: /permission denied/i,
    label: "Permission denied",
    hint: "The engine lacks rights on that path — check ownership and permissions of the workspace directory.",
  },
  {
    id: "segfault",
    re: /segmentation fault|\bcore dumped\b/i,
    label: "Segmentation fault (native crash)",
    hint: "A native binary crashed — often threading or CUDA related; try fewer threads or a different GPU build before re-running.",
  },
  {
    id: "mpi-abort",
    // OpenMPI's exact abort announcement — the runtime itself, not RELION
    // chatter; the abort is the symptom, the cause prints earlier
    re: /MPI_ABORT was invoked/i,
    label: "MPI abort — a rank asked the runtime to stop",
    hint: "An MPI rank called MPI_ABORT: the root cause is usually printed earlier in the log — switch to Full mode and read upward from the first error.",
  },
  {
    id: "python-traceback",
    // CPython's own traceback header — the interpreter, not a loose word;
    // Topaz/cryolo and other wrappers die here
    re: /Traceback \(most recent call last\)/,
    label: "Python traceback (script failure)",
    hint: "A Python wrapper crashed — the traceback's last line names the exception; check the wrapper's environment (module versions, CUDA_VISIBLE_DEVICES) before re-running.",
  },
  {
    // t320 — relion_autopick's own hard refusal (autopicker.cpp read():
    // do_gpu && do_LoG → REPORT_ERROR, argv-parse time, before the first
    // micrograph). The dispatch now omits --gpu for LoG picking; this
    // pattern heals the residual surfaces — a re-run of an OLD saved
    // script, a hand-edited sbatch, or a future regression — by naming
    // the flag pair itself.
    id: "autopick-log-gpu",
    re: /Laplacian-of-Gaussian picker does not support GPU acceleration/i,
    label: "LoG picker + --gpu — RELION refuses the flag pair outright",
    hint: "The Laplacian-of-Gaussian picker is CPU-only: relion_autopick hard-errors when --gpu rides --LoG (its own message: \"does not support GPU acceleration. Please remove --gpu option.\"). CryoFlow's dispatch already sends no GPUs for LoG picking — if this is an old or hand-edited script, remove the --gpu line, or switch Picking method to References or Topaz to pick on GPUs.",
  },
  {
    // t334 — relion_preprocess's own size-check refusal (image.h's Image::
    // write, REPORT_ERROR("write: target and source objects have different
    // size") — line 1534 in the 5.0 betas). The write is the per-micrograph
    // particle stack: the FIRST particle replaces the .mrcs blindly, every
    // later particle APPENDS — and the append reads the file already on disk
    // and refuses when its dimensions differ from the particle being written.
    // A single fresh run has one box size, so a mismatch always means the
    // stack path was occupied by ANOTHER generation (a re-run before the
    // t333 fresh-start wipe, with a changed Box size / Downsample) or by a
    // concurrent writer (two processes extracting the same micrograph —
    // duplicate rows in the micrographs STAR). The Beijing field report:
    // a copied extraction job died 83% in, 865 stacks written, on exactly
    // this line.
    id: "extract-stack-size-clash",
    re: /write: target and source objects have different size/i,
    label: "Particle stack write refused — the target .mrcs already has a different box size",
    hint:
      "RELION writes one .mrcs stack per micrograph (--part_dir + the micrograph's name) and appends each particle after the first; the append checks the file already on disk (image.h \"target and source objects have different size\") and refuses on a dimension mismatch. Within one run the box never changes — so that stack path was already occupied by an earlier generation with a DIFFERENT Box size / Downsample (a re-run before the fresh-start wipe), or two processes wrote the same micrograph at once (duplicate micrograph rows in the input STAR). Remedy: re-run the job (the dispatch now clears the previous generation's stacks on the cluster before submitting) or make a fresh extraction job — with the box size you want, the clean run completes. The micrograph that died is the one in progress where the log stops; its half-written stack stayed on the cluster (this job's Results/Files lists it).",
  },
  {
    // t338 — rwMRC.h's own bounds refusal, the READ-side twin of the t334
    // write clash above. The field report: a 2D classification died ~1
    // minute in at
    //   readMRC: Image number 341 exceeds stack size 340 of image
    //   00000341@…/extract_…/micrographs/…_Fractions_DW.mrcs
    // while the upstream extraction had COMPLETED (exit 0) — its
    // particles.star simply numbers more images than the stack holds.
    // That is the t334 collision's SILENT variant: two same-stem rows in
    // the extraction's input STAR ("X.mrc" + "X.mrcs" — both compose the
    // SAME stack path) made two writers share one .mrcs; the later
    // writer's first particle blindly truncated the earlier writer's
    // images, and the merged star kept BOTH writers' rows. The
    // consumer-side gate (t338) now refuses such stars at dispatch with
    // the same numbers; this pattern heals the logs that already died.
    id: "readmrc-exceeds-stack",
    re: /readMRC: Image number \d+ exceeds stack size \d+/i,
    label: "Particles STAR outruns its stack — an image number points past the .mrcs end",
    hint:
      "relion_refine tried to read the image the STAR names (image 341 of a stack holding 340) and rwMRC refused. The upstream extraction COMPLETED, but its output is internally inconsistent: same-stem rows in ITS input STAR (e.g. \"X.mrc\" and \"X.mrcs\" of the same micrograph — both compose the SAME .mrcs stack path) made two writers share one stack; the later writer's first particle blindly truncated the earlier writer's, while the merged STAR kept both writers' rows. Remedy: re-run the UPSTREAM extraction job — its dispatch now refuses colliding inputs with the offending rows named (de-duplicate the import or rename the colliding files first) — then run this job again. The dispatch's consumer-side check now also refuses a star that outruns its stacks before any GPU time is spent.",
  },
  {
    // t312 — relion_run_ctffind's own terminal words (ctffind_runner.cpp):
    // the per-micrograph skip warning and the all-failed exit line.
    // t314 — the hint was REWRITTEN: the first cut blamed raw movie stacks
    // first, and the Beijing follow-up proved those inputs were
    // motion-corrected *_Fractions_DW.mrc micrographs. An every-micrograph
    // refusal that takes seconds (not minutes) means ctffind rejected the
    // INPUTS or the FILE FORMAT outright — no fit was ever attempted — so
    // the suspects are ordered by that physics, with the header-checking
    // command the user can run themselves on the cluster.
    id: "ctffind-no-fit",
    re: /failed to estimate CTF parameters for any micrograph|cannot get CTF values for/i,
    label: "CTF estimation failed on every micrograph",
    hint: "ctffind rejected every micrograph at once — the input itself is the suspect, not the fitting. Check in order: (1) single-section MRCs? NZ>1 means raw frame stacks (run MotionCorr first: Import → MotionCorr → CTF; .eer is always raw) — an MRC's own header settles it, on the cluster run: head -c 16 <file>.mrc | od -An -td4 (NX NY NZ MODE); (2) does this ctffind build read the file mode — float16 / MRC mode 12 needs a recent ctffind, and a bundled 4.1 may predate it; (3) the Import pixel size must match the real data (Falcon 4i: ~0.5 Å unbinned, ~1.0 Å binned ×2); (4) widen ResMin/ResMax if the fit RUNS but finds nothing. The per-micrograph .ctf files and ctffind logs inside the job directory carry the literal error.",
  },
];

/** Collapse each line the way the console displays it (\r progress bars →
 *  final frame) so numbering matches what the user sees. */
function displayLine(raw: string): string {
  const idx = raw.lastIndexOf("\r");
  const line = idx >= 0 ? raw.slice(idx + 1) : raw;
  return line.replace(/\s+/g, " ").trim();
}

const EXCERPT_CAP = 200;

function excerptOf(line: string): string {
  const t = displayLine(line);
  return t.length > EXCERPT_CAP ? `${t.slice(0, EXCERPT_CAP)}…` : t;
}

/**
 * Diagnose pre-split display lines (as rendered by the Log console).
 * One finding per pattern (first match wins the excerpt; repeats only
 * bump count), ordered by first occurrence — the strip reads top-down
 * in the same order the log produced the evidence.
 */
export function diagnoseLines(lines: string[]): LogFinding[] {
  const found: LogFinding[] = [];
  const byId = new Map<string, LogFinding>();
  for (let i = 0; i < lines.length; i++) {
    for (const p of LOG_PATTERNS) {
      if (!p.re.test(lines[i])) continue;
      const ex = byId.get(p.id);
      if (ex) {
        ex.count += 1;
      } else {
        const f: LogFinding = {
          id: p.id,
          label: p.label,
          hint: p.hint,
          count: 1,
          firstLine: i + 1,
          excerpt: excerptOf(lines[i]),
        };
        byId.set(p.id, f);
        found.push(f);
      }
    }
  }
  return found;
}

/** Convenience wrapper: raw log text → findings. \r-collapsed to match
 *  the console's display lines (line numbers are display numbers). */
export function diagnoseLog(text: string | null | undefined): LogFinding[] {
  if (!text) return [];
  return diagnoseLines(text.split("\n"));
}

/* ------------------------------------------------------------------ */
/* t323 — the silent mid-run death                                      */
/* ------------------------------------------------------------------ */

/** A RELION progress-bar frame: the worm mascot, the owl eyes, or the
 *  elapsed/total time bar ("0.31/3.82 hrs") — the dialects time.cpp
 *  prints while a run is ALIVE. If the log's last visible line is one of
 *  these, the process died between two heartbeats. */
const PROGRESS_FRAME_RE = /~~\(,_,">|\[oo\]|\/\d+(?:\.\d+)?\/(?:\d+(?:\.\d+)?|\?\?\?)\s*(?:sec|min|hrs)\b/;

/** t323-a (review) — a COMPLETED bar is not a live frame: time.cpp marks
 *  the end of a run with the same worm/bar dialect plus " yum!" — a run
 *  that finished its bar and then failed at the wrapper/merge layer must
 *  not get the external-kill story over its own completion line. */
const isLiveFrame = (line: string): boolean =>
  PROGRESS_FRAME_RE.test(line) && !/yum!/.test(line);

/**
 * t323 — the silent-death autopsy: a FAILED run whose log ends on a live
 * progress frame and matches no known signature. Verified against RELION
 * master: every in-code death PRINTS (RelionError → "ERROR: …" + "in: …
 * .cpp, line N" + backtrace on stderr; the pipeline_control exit wrapper →
 * "exiting with an error/abort" on stdout), so a log that simply STOPS
 * means the process was killed from outside — the login node's CPU-job
 * reaper, the OOM killer, or a scheduler walltime — or crashed so hard the
 * harness never narrated it. The user's 576-micrograph LoG autopick (ETA
 * 3.82 hrs, dead at 0.31, both streams error-free) was exactly this shape
 * and the strip used to answer "0 findings".
 *
 * Only consulted when the signature table found NOTHING (a real error
 * outranks the autopsy — an error-then-death log also ends without a bar
 * frame, so the ordering is doubly safe). Returns null when the tail is
 * not a live frame (empty log, clean completion line, error text).
 */
export function silentRunDeathFinding(lines: string[]): LogFinding | null {
  const display = lines.map((l) => {
    const idx = l.lastIndexOf("\r");
    return (idx >= 0 ? l.slice(idx + 1) : l).replace(/\s+$/, "");
  });
  // the stderr section separator (remote log view) is structural, not a
  // log line — skip past it when it trails
  const tail: string[] = [];
  let lastFrameIdx = -1;
  for (let i = display.length - 1; i >= 0 && tail.length < 3; i--) {
    const t = display[i].trim();
    if (!t) continue;
    if (t === "----- stderr -----") break;
    // the FIRST hit walking down is the deepest (newest) line — the death
    // spot the excerpt and the line chip both point at
    if (tail.length === 0) lastFrameIdx = i;
    tail.unshift(t);
  }
  if (tail.length === 0) return null;
  // t323-a — only LIVE frames count: a " yum!" completion frame wears the
  // same worm dialect but means the run FINISHED its bar — the failure (if
  // any) happened after it and the autopsy has no story for that.
  if (!tail.some((l) => isLiveFrame(l))) return null;
  const last = tail[tail.length - 1];
  return {
    id: "silent-run-death",
    label: "The log stops mid-run — the process died without an error signature",
    hint: "RELION printed no error (no ERROR line, no backtrace, no 'exiting with'): every in-code RELION death narrates itself, so a log that just stops means an external kill — the usual suspects are the login node's CPU-job reaper (multi-hour runs must go through Slurm/sbatch, not direct mode), the OOM killer, or a walltime limit. Re-run via Slurm mode (the run dialog), consider the array shard split for embarrassingly-parallel types, and check the cluster's own record: sacct -j <jobid> and the job directory.",
    count: 1,
    // t323-a — the last frame's 1-based display line (the deepest line the
    // downward walk found; a trailing "" from split("\n") used to report
    // one past the end)
    firstLine: lastFrameIdx + 1,
    excerpt: last.length > EXCERPT_CAP ? `${last.slice(0, EXCERPT_CAP)}…` : last,
  };
}

/**
 * t323 — the failure-scanner entry point the UI calls: the signature
 * table first (an OS/runtime-narrated death outranks the autopsy), the
 * silent-death autopsy as the fallback when nothing matched and the log
 * ends on a live progress frame.
 */
export function diagnoseFailureLines(lines: string[]): LogFinding[] {
  const base = diagnoseLines(lines);
  if (base.length > 0) return base;
  const silent = silentRunDeathFinding(lines);
  return silent ? [silent] : [];
}

/** Text-form twin of diagnoseFailureLines (the Overview teaser's diet). */
export function diagnoseFailureLog(text: string | null | undefined): LogFinding[] {
  if (!text) return [];
  return diagnoseFailureLines(text.split("\n"));
}
