/**
 * CryoFlow — per-type key numbers for a job's outputs (t330).
 *
 * The user's ask: "每一步的UI界面结果中都要突出 particles 的数量，这个信息
 * 很关键" — every step's Results view must lead with THE number that step is
 * about (particles picked / extracted / classified, micrographs covered,
 * classes). This module computes those numbers from the outputs listing the
 * /api/jobs/[id]/outputs route already walks — pure, fs-free (the route
 * supplies file readers), and client-importable for the types.
 *
 * Honesty rules (the whole file's law):
 *  - a number is returned only when it was actually counted from a LOCAL,
 *    readable file; remote-only or oversized stars yield NO stat, never a
 *    guess (the t289 "on cluster" card speaks for those).
 *  - coverage (extract/autopick) is covered-vs-total from real star columns
 *    (_rlnMicrographName distinct in this job's star vs the --i input star);
 *    when the input star is unreadable the total is null and the stat shows
 *    the covered count alone — never an invented denominator.
 *  - scanStarColumn is O(n): the shared parseStar keeps a pending-token
 *    slice per row (fine for ≤2 MB display budgets, quadratic beyond), so
 *    the big particle stars (tens of MB) get this purpose-built scanner —
 *    a 30 MB particles.star counts in well under a second.
 */

/* ------------------------------------------------------------------ */
/* Types (shared route ↔ client)                                       */
/* ------------------------------------------------------------------ */

export interface SummaryFile {
  /** path relative to the job's workdir */
  path: string;
  name: string;
  kind: "mrc" | "star" | "text" | "image";
  size: number;
  /** parsed row count for small STAR files (the walk's ≤2 MB budget) */
  rows?: number;
  /** number of images in a .mrcs stack */
  slices?: number;
  /** t289 — the file is on the cluster, not on this machine */
  remote?: boolean;
}

export type StatTone = "particle" | "micrograph" | "class" | "warn";

export interface SummaryStat {
  /** stable key — also the DOM's data-stat test seam */
  key: string;
  /** display value (already formatted, e.g. "12,345" or "38 / 42") */
  value: string;
  label: string;
  hint?: string;
  tone?: StatTone;
}

export interface OutputSummary {
  /** display-ordered big numbers; empty array never happens (null instead) */
  stats: SummaryStat[];
  /** extract/autopick completeness — the honest partial-extraction signal */
  coverage?: {
    covered: number;
    total: number | null;
    /** prebuilt amber note for covered < total (the strip renders verbatim) */
    note?: string;
  };
}

export interface SummarizeDeps {
  /** Read a LOCAL star's text by workdir-relative path (null = remote-only,
   *  missing, or over the read cap). The route supplies the fs. */
  readStarText: (relPath: string) => string | null;
  /** Read a star by ABSOLUTE path — the recorded command's --i input star
   *  lives in the upstream job's workdir, not this one. */
  readStarAbs?: (absPath: string) => string | null;
  /** the recorded launch command (coverage's input star comes from --i) */
  cmd?: string;
}

/* ------------------------------------------------------------------ */
/* O(n) STAR column scanner                                            */
/* ------------------------------------------------------------------ */

/**
 * Count rows + distinct values of one column across every loop that has it.
 * Quote-aware tokenization with `#` comments — the same semantics as
 * parseStar's tokenizer, but the row buffer stays row-width small (no
 * per-row array slicing of the whole token stream). `transform` maps a
 * value before it joins the distinct set (e.g. an image name → its
 * micrograph's stack base).
 */
export function scanStarColumn(
  text: string,
  column: string,
  transform?: (v: string) => string
): { rows: number; distinct: number } | null {
  let rows = 0;
  let distinct = 0;
  const seen = new Set<string>();
  let sawColumn = false;

  let inLoop = false;
  let headerPhase = false;
  let columns: string[] = [];
  let targetIdx = -1;
  let pending: string[] = [];

  const flushLoop = () => {
    inLoop = false;
    headerPhase = false;
    columns = [];
    targetIdx = -1;
    pending = [];
  };

  const lines = text.split("\n");
  for (const rawLine of lines) {
    // quote-aware tokenizer (mirrors parseStar: quotes strip, # ends line)
    let quote: string | null = null;
    let cur = "";
    const tokens: string[] = [];
    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine[i];
      if (quote) {
        if (ch === quote) quote = null;
        else cur += ch;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if (ch === "#") break;
      if (ch === " " || ch === "\t" || ch === "\r") {
        if (cur.length > 0) {
          tokens.push(cur);
          cur = "";
        }
        continue;
      }
      cur += ch;
    }
    if (cur.length > 0) tokens.push(cur);
    if (tokens.length === 0) continue;

    const head = tokens[0];
    if (head.startsWith("data_")) {
      flushLoop();
      continue;
    }
    if (head === "loop_") {
      flushLoop();
      inLoop = true;
      headerPhase = true;
      continue;
    }
    if (head === "stop_") {
      flushLoop();
      continue;
    }
    if (!inLoop) continue;
    if (headerPhase && head.startsWith("_")) {
      columns.push(head);
      if (head === column) targetIdx = columns.length - 1;
      continue;
    }
    headerPhase = false;
    if (targetIdx < 0) continue; // this loop doesn't carry the column
    sawColumn = true;
    pending.push(...tokens);
    const width = columns.length;
    while (pending.length >= width && width > 0) {
      const v = pending[targetIdx];
      if (v != null) {
        const key = transform ? transform(v) : v;
        if (!seen.has(key)) seen.add(key);
      }
      rows++;
      pending = pending.length > width ? pending.slice(width) : [];
    }
  }
  if (!sawColumn) return null;
  distinct = seen.size;
  return { rows, distinct };
}

/* ------------------------------------------------------------------ */
/* run.out warning extraction                                          */
/* ------------------------------------------------------------------ */

/**
 * Collect WARNING lines from a run log (t330 — the user saw "some warnings"
 * in the Extract step and had to read raw run.out to know what they were).
 * Deduped by leading text, capped at 20, each trimmed to 240 chars.
 * Machine-log dialects matched: "WARNING:" anywhere in the line (bare, or
 * prefixed "relion_preprocess: WARNING: …"). The colon is REQUIRED — prose
 * like "not a warning line" must never become a card (the suite's own
 * fixture caught exactly that false positive).
 */
export function parseRunWarnings(logText: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of logText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !/WARNING:/i.test(line)) continue;
    const cleaned = line.replace(/\s+/g, " ");
    const key = cleaned.slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned.length > 240 ? `${cleaned.slice(0, 237)}…` : cleaned);
    if (out.length >= 20) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The summarizer                                                      */
/* ------------------------------------------------------------------ */

const nfmt = (n: number) => n.toLocaleString("en-US");

function fileByName(files: SummaryFile[], base: string): SummaryFile | undefined {
  const lower = base.toLowerCase();
  return files.find((f) => !f.remote && f.name.toLowerCase() === lower);
}

function firstByName(files: SummaryFile[], bases: string[]): SummaryFile | undefined {
  for (const b of bases) {
    const f = fileByName(files, b);
    if (f) return f;
  }
  return undefined;
}

/** highest-iteration file matching /^prefix(\d+)suffix$/ (ties: last name) */
function latestByPattern(files: SummaryFile[], re: RegExp): SummaryFile | undefined {
  let best: SummaryFile | undefined;
  let bestIt = -1;
  for (const f of files) {
    if (f.remote) continue;
    const m = re.exec(f.name);
    if (!m) continue;
    const it = m[1] ? parseInt(m[1], 10) : 0;
    if (it >= bestIt) {
      best = f;
      bestIt = it;
    }
  }
  return best;
}

/** the --i (or --part_star) star path from the recorded command */
function inputStarPath(cmd?: string): string | null {
  if (!cmd) return null;
  const toks = cmd.split(/\s+/);
  for (let i = 0; i < toks.length - 1; i++) {
    if (toks[i] === "--i" || toks[i] === "--part_star") {
      const p = toks[i + 1];
      if (p && !p.startsWith("-")) return p;
    }
  }
  return null;
}

/** the micrograph a particle row's image name points at: RELION names
 * extract stacks `<mic base>_extract.mrcs` and image names
 * `000042@extra/mic_01_extract.mrcs` — the stack base names the micrograph
 * (the fallback path for stars without _rlnMicrographName) */
function micBaseFromImageName(v: string): string {
  const p = v.includes("@") ? v.slice(v.indexOf("@") + 1) : v;
  const base = p.split("/").pop() ?? p;
  return base.replace(/_extract\.(mrcs|mrc)$/i, "").replace(/\.(mrcs|mrc)$/i, "");
}

/** distinct micrograph count of the run's INPUT star (cmd --i) — the honest
 *  denominator for coverage; null when the star isn't locally readable */
function totalMicrographs(deps: SummarizeDeps): number | null {
  const p = inputStarPath(deps.cmd);
  if (!p || !deps.readStarAbs) return null;
  const text = deps.readStarAbs(p);
  if (!text) return null;
  return scanStarColumn(text, "_rlnMicrographName")?.distinct ?? null;
}

function micStat(covered: number, total: number | null, label: string): SummaryStat {
  return {
    key: "micrographs",
    value: total != null ? `${nfmt(covered)} / ${nfmt(total)}` : nfmt(covered),
    label,
    tone: total != null && covered < total ? "warn" : "micrograph",
  };
}

/**
 * Per-type key numbers, or null when this job type / listing yields no
 * honest number (postprocess → the FSC chart speaks; mapimport → the
 * identity card; a remote-only particles.star → the t289 fetch card).
 */
export function summarizeOutputs(
  type: string,
  files: SummaryFile[],
  deps: SummarizeDeps
): OutputSummary | null {
  const rowsOf = (f?: SummaryFile): number | null =>
    f && typeof f.rows === "number" ? f.rows : null;

  switch (type) {
    case "import": {
      const mics = firstByName(files, ["micrographs.star", "movies.star"]);
      const n = rowsOf(mics);
      if (n == null || !mics) return null;
      return {
        stats: [
          {
            key: "micrographs",
            value: nfmt(n),
            label: mics.name.toLowerCase() === "movies.star" ? "movies imported" : "micrographs imported",
            tone: "micrograph",
          },
        ],
      };
    }

    case "motioncorr": {
      const mics = fileByName(files, "corrected_micrographs.star");
      const n = rowsOf(mics);
      if (n == null) return null;
      return {
        stats: [{ key: "micrographs", value: nfmt(n), label: "micrographs corrected", tone: "micrograph" }],
      };
    }

    case "ctffind": {
      const mics = fileByName(files, "micrographs_ctf.star");
      const n = rowsOf(mics);
      if (n == null) return null;
      return {
        stats: [{ key: "micrographs", value: nfmt(n), label: "micrographs with CTF", tone: "micrograph" }],
      };
    }

    case "autopick": {
      // per-mic coordinate stars under micrographs/ (+ optional combined star)
      const perMic = files.filter((f) => !f.remote && /_autopick\.star$/i.test(f.name));
      const combined = fileByName(files, "autopick.star");
      let picks = 0;
      let covered = 0;
      if (perMic.length > 0) {
        covered = perMic.length;
        picks = perMic.reduce((s, f) => s + (f.rows ?? 0), 0);
      } else if (combined) {
        picks = combined.rows ?? 0;
        const text = deps.readStarText(combined.path);
        covered = text ? (scanStarColumn(text, "_rlnMicrographName")?.distinct ?? 0) : 0;
      }
      if (picks <= 0) return null;
      const total = totalMicrographs(deps);
      const stats: SummaryStat[] = [
        { key: "particles", value: nfmt(picks), label: "particles picked", tone: "particle" },
        micStat(covered, total, "micrographs with picks"),
      ];
      return {
        stats,
        coverage:
          covered > 0
            ? {
                covered,
                total,
                note:
                  total != null && covered < total
                    ? `${covered} of ${total} micrographs produced picks — ${total - covered} had none`
                    : undefined,
              }
            : undefined,
      };
    }

    case "extract": {
      const star = fileByName(files, "particles.star");
      if (!star) return null;
      // the star may be over the walk's 2 MB display budget — re-read it
      // (route caps the read) and count with the O(n) scanner
      const text = deps.readStarText(star.path);
      let scanned = text ? scanStarColumn(text, "_rlnMicrographName") : null;
      if (text && !scanned) {
        // fallback: stars without _rlnMicrographName (the mock's simplified
        // shape, old-style datasets) still name each row's micrograph via
        // the extract stack in _rlnImageName
        const img = scanStarColumn(text, "_rlnImageName", micBaseFromImageName);
        if (img) scanned = { rows: img.rows, distinct: img.distinct };
      }
      const particles = star.rows ?? scanned?.rows ?? null;
      if (particles == null) return null;
      const covered = scanned?.distinct ?? null;
      const total = covered != null ? totalMicrographs(deps) : null;
      const stats: SummaryStat[] = [
        { key: "particles", value: nfmt(particles), label: "particles extracted", tone: "particle" },
      ];
      if (covered != null) stats.push(micStat(covered, total, "micrographs with particles"));
      return {
        stats,
        coverage:
          covered != null
            ? {
                covered,
                total,
                note:
                  total != null && covered < total
                    ? `${covered} of ${total} micrographs produced particles — ${total - covered} had none`
                    : undefined,
              }
            : undefined,
      };
    }

    case "class2d": {
      const data =
        latestByPattern(files, /^run_it(\d+)_data\.star$/) ??
        firstByName(files, ["run_data.star"]);
      const classes =
        latestByPattern(files, /^run_it(\d+)_classes\.mrcs?$/) ??
        firstByName(files, ["run_unmasked_classes.mrcs", "run_classes.mrcs", "run_classes.mrc"]);
      const parts = rowsOf(data);
      const k = classes?.slices ?? null;
      if (parts == null && k == null) return null;
      const stats: SummaryStat[] = [];
      if (parts != null)
        stats.push({ key: "particles", value: nfmt(parts), label: "particles classified", tone: "particle" });
      if (k != null) stats.push({ key: "classes", value: nfmt(k), label: "classes", tone: "class" });
      return { stats };
    }

    case "class3d":
    case "initialmodel": {
      const data =
        latestByPattern(files, /^run_it(\d+)_data\.star$/) ??
        firstByName(files, ["run_data.star"]);
      const parts = rowsOf(data);
      // class maps at the LATEST iteration (run_itNNN_classKKK.mrc)
      let k: number | null = null;
      const classMaps = files.filter((f) => !f.remote && /^run_it\d+_class\d+\.mrcs?$/i.test(f.name));
      let latest = -1;
      for (const f of classMaps) {
        const it = parseInt((/^run_it(\d+)_/.exec(f.name) ?? [])[1] ?? "0", 10);
        if (it > latest) latest = it;
      }
      if (latest >= 0)
        k = classMaps.filter(
          (f) => parseInt((/^run_it(\d+)_/.exec(f.name) ?? [])[1] ?? "0", 10) === latest
        ).length;
      if (parts == null && k == null) return null;
      const stats: SummaryStat[] = [];
      if (parts != null)
        stats.push({
          key: "particles",
          value: nfmt(parts),
          label: type === "class3d" ? "particles classified" : "particles seeded",
          tone: "particle",
        });
      if (k != null) stats.push({ key: "classes", value: nfmt(k), label: "classes", tone: "class" });
      return { stats };
    }

    case "refine3d":
    case "polish":
    case "ctfrefine":
    case "subtract":
    case "symexpand":
    case "rebalance":
    case "tomo_extract": {
      const star = firstByName(files, [
        "run_data.star",
        "shiny.star",
        "particles_polished.star",
        "particles_ctf_refine.star",
        "particles_subtracted.star",
        "particles.star",
      ]);
      const n = rowsOf(star);
      if (n == null) return null;
      const label =
        type === "refine3d"
          ? "particles refined"
          : type === "polish"
            ? "particles polished"
            : type === "ctfrefine"
              ? "particles CTF-refined"
              : type === "subtract"
                ? "particles subtracted"
                : "particles";
      return { stats: [{ key: "particles", value: nfmt(n), label, tone: "particle" }] };
    }

    case "select":
    case "select2d":
    case "joinstar": {
      const star = firstByName(files, ["particles.star", "join_particles.star"]);
      const n = rowsOf(star);
      if (n == null) return null;
      return {
        stats: [
          {
            key: "particles",
            value: nfmt(n),
            label: type === "joinstar" ? "particles joined" : "particles selected",
            tone: "particle",
          },
        ],
      };
    }

    default:
      // postprocess (FSC chart speaks), mapimport (identity card), topaztrain
      // (training curve), maskcreate/localres (single map) — no key numbers
      return null;
  }
}
