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
