/**
 * Failure diagnosis — pattern recognition over the engine log.
 *
 * When a job fails, the Log tab answers WHAT happened (the log itself);
 * this module answers WHY, the way a colleague skimming the tail would:
 * a handful of well-known failure signatures (OOM kill, CUDA/GPU memory,
 * full disk, missing upstream file, permissions, segfault) each mapped to
 * an actionable next step. The Log tab strip (job-inspector) renders the
 * findings; nothing else interprets log text — this table is the single
 * source of that interpretation, so a pattern tweak heals every surface.
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
    // CUDA's allocation failure text; "out of memory" also catches
    // std::bad_alloc from the RAM allocator (same remedy family)
    re: /cuda[\w: ]*(?:error|out of memory)|out of memory|hipError/i,
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
