/**
 * CryoFlow — counts read from a job's result receipt (t347).
 *
 * The user's ask: 「每个job的照片数或颗粒数需要显示得醒目些，不仅在
 * 任务窗口中，最好也在job的卡片上直接显示出来」 — every job's
 * micrograph/particle count must be prominent, on the inspector AND on the
 * canvas card itself.
 *
 * The card has no per-job file access — but it does not need any: the
 * engine's finalize writes an HONEST counted number into `job.result`
 * ("82,000 particles extracted", "motion corrected, 382 micrographs",
 * "2D classification finished — 50 classes · 82,000 particles · …"), and
 * remote runs carry the same dialect through collectOutputs
 * ("REMOTE[user@host · module]: …"). This module parses that dialect —
 * pure string work, client-safe, zero I/O.
 *
 * Honesty rules:
 *  - a number appears only when the receipt actually wrote one (a result
 *    line without a count yields null — the card shows no badge, never a
 *    guess);
 *  - SELECT keeps the KEPT count (the number that step's output actually
 *    carries), symexpand the EXPANDED total;
 *  - unknown result shapes (failures, "exited 0", ...) yield null.
 */

export interface ResultCounts {
  particles?: number;
  micrographs?: number;
  classes?: number;
}

/** "82,000" / "82000" → 82000; returns NaN-lookalike → caller checks > 0. */
function toNum(s: string): number {
  return Number(s.replace(/,/g, ""));
}

/**
 * Parse the engine's result-receipt dialect into countable numbers.
 * Strips the "REAL: " and "REMOTE[origin]: " prefixes first — both lanes
 * write the same body text.
 */
export function parseResultCounts(result: string | null | undefined): ResultCounts | null {
  if (!result) return null;
  let t = result.replace(/^REAL:\s*/, "");
  t = t.replace(/^REMOTE\[[^\]]*\]:\s*/, "");
  if (!t) return null;

  const out: ResultCounts = {};
  let m: RegExpMatchArray | null;

  // particles — the specific shapes first (they pick the RIGHT number),
  // the generic "N particles" last
  if ((m = t.match(/([\d,]+) of [\d,]+ particles kept/))) {
    // Select: "12,345 of 82,000 particles kept" — the KEPT count is what
    // this step's output carries
    out.particles = toNum(m[1]);
  } else if ((m = t.match(/= ([\d,]+) particles/))) {
    // Symexpand: "82,000 × 4 = 328,000 particles" — the expanded total
    out.particles = toNum(m[1]);
  } else if ((m = t.match(/([\d,]+) particles/))) {
    // extracted / imported / converted / classified / refined / polished /
    // picked / subtracted / seeded / written …
    out.particles = toNum(m[1]);
  } else if ((m = t.match(/\(([\d,]+) rows\)/))) {
    // JoinStar: "joined STAR (82,000 rows)" — the joined row count
    out.particles = toNum(m[1]);
  }

  // micrographs — "382 micrographs", "… across 382 micrographs", "382
  // micrographs imported", "CTF estimated for 382 micrographs"
  if ((m = t.match(/([\d,]+) micrographs?/))) {
    out.micrographs = toNum(m[1]);
  }

  // classes — class2d "50 classes · …", select "40/50 classes (…)"
  if ((m = t.match(/([\d,]+) classes/))) {
    out.classes = toNum(m[1]);
  }

  if (
    (out.particles == null || !Number.isFinite(out.particles) || out.particles <= 0) &&
    (out.micrographs == null || !Number.isFinite(out.micrographs) || out.micrographs <= 0) &&
    (out.classes == null || !Number.isFinite(out.classes) || out.classes <= 0)
  ) {
    return null;
  }
  // drop any individually-invalid entry (keeps the interface clean)
  if (out.particles != null && (!Number.isFinite(out.particles) || out.particles <= 0)) delete out.particles;
  if (out.micrographs != null && (!Number.isFinite(out.micrographs) || out.micrographs <= 0)) delete out.micrographs;
  if (out.classes != null && (!Number.isFinite(out.classes) || out.classes <= 0)) delete out.classes;
  return out;
}

/**
 * Compact display form for the card chip: 82,000 → "82k", 1,234,567 →
 * "1.2M", 382 → "382". Full numbers under 10k read fine untruncated.
 */
export function formatCountCompact(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 10_000) {
    const v = n / 1_000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return n.toLocaleString("en-US");
}

/** Full display form with thousands separators: 82000 → "82,000". */
export function formatCountFull(n: number): string {
  return n.toLocaleString("en-US");
}
