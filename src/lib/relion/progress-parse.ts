/**
 * t319 — RELION progress parsing, PURE (no fs/db/ssh imports): the same
 * function serves the local engine (log files on disk) and the remote sweep
 * (log text over SSH), and being pure it is importable client-side and by
 * test tooling without dragging the engine's world along.
 *
 * The parser speaks RELION's REAL dialects (verified against the sources:
 * src/time.cpp's progress_bar, ctffind_runner.cpp, motioncorr_runner.cpp,
 * preprocessing.cpp, autopicker.cpp, ml_optimiser.cpp). The old
 * `micrograph-lines / 6` heuristic (a hardcoded 6-micrograph EMPIAR
 * denominator) read a REAL 1034-micrograph ctffind log as "99% after 60
 * lines" and then, whenever the sliding tail window held no countable line,
 * handed null back and the caller fell to the DB's dispatch-time 0 — the
 * user's 99% → 0% → 99% oscillation. The dialects, by family:
 *
 *  1. RELION's OWN TIME BAR (src/time.cpp progress_bar) — THE signal for the
 *     per-image jobs (ctffind / motioncorr / extract / autopick): a GLOBAL
 *     elapsed/total-time estimate rewritten in place with \r:
 *       init:  "000/??? sec ~~(,_,\">    [oo]"
 *       tick:  "\r%3.2f/%3.2f min ~~(,_,\"> ... [oo]"   (unit flips to hrs
 *              past an hour; sec below a minute; " yum!\n" when finished)
 *     The ctffind/motioncor2 SUBPROCESS output never reaches run.out
 *     (ctffind_runner redirects it to per-micrograph logs), so the bar is
 *     unpolluted. elapsed/total is a ratio — self-adapting to any N.
 *  2. ITERATION HEADERS (ml_optimiser.cpp) — the refine family:
 *       " Expectation iteration 3 of 25"      (class2d/class3d/refine3d/…)
 *       " Gradient optimisation iteration 3 of 25"  (initialmodel)
 *     The per-iteration expectation step re-inits its own time bar, so the
 *     freshest bar ratio is the progress WITHIN the current iteration:
 *     overall = ((iter − 1) + barRatio) / totalIter.
 *  3. n/N COUNTERS — the mock fakes' dialect ("Micrograph 5/1034: …") and
 *     any future n/N printer: a direct ratio, denominator included.
 *
 * \r COLLAPSE: RELION rewrites bars in place — each physical line is cut to
 * its freshest segment (after the LAST \r) so stale slices never speak.
 */

export type ProgressParams = Record<string, number | string | boolean>;

/**
 * t353 — the refine family: jobs whose logs speak "Expectation/Gradient
 * optimisation iteration N of M" and whose time bar is PER-ITERATION. For
 * these, a tail window holding ONLY a bar (the iteration header has
 * scrolled out) cannot place that bar in the run's timeline — the bar is
 * the progress WITHIN one iteration, never of the whole run.
 *
 * The field shape (2026-10, 6-rank class2d "7 of 20 shows 99%"): RELION
 * rewrites the bar in place with \r — one physical line per rank that
 * grows ~40 bytes per tick, six ranks ticking for a quarter hour per
 * iteration. The 4096-byte tail the sweeps read (local readTail + the
 * remote heartbeat's `tail -c 4096`) filled with bar segments LONG before
 * iteration 7 ended, the "Expectation iteration 7 of 20" header left the
 * window, and the parser fell through to the per-image branch which
 * treats the bar as GLOBAL — at each iteration's end the bar reads
 * ~0.99 → 99% (pct's clamp), and the monotonic contract froze it there.
 * The honest verdict for a refine-family bare bar is null: the caller
 * holds the last header-derived value (the staircase — each iteration's
 * header re-enters the window the moment it is printed).
 */
const REFINE_FAMILY = new Set(["class2d", "class3d", "refine3d", "initialmodel", "multibody"]);

export function parseProgressText(
  type: string,
  tail: string,
  params: ProgressParams
): number | null {
  try {
    if (!tail) return null;
    const collapsed = tail
      .split("\n")
      .map((line) => {
        const idx = line.lastIndexOf("\r");
        return idx >= 0 ? line.slice(idx + 1) : line;
      })
      .join("\n");

    // ---- (1) iteration headers: the refine family ------------------------
    // REAL: " Expectation iteration 3 of 25" / "Gradient optimisation
    // iteration 3 of 25" (ml_optimiser.cpp:3734/3725) — the header carries
    // its own total, authoritative over our --iter param. MOCK/legacy:
    // "it [003]" rows. Take the LAST header (freshest iteration).
    let iterNow: number | null = null;
    let iterTotal: number | null = null;
    for (const m of collapsed.matchAll(
      /(?:expectation|optimisation)\s+iteration\s+(\d+)\s+of\s+(\d+)/gi
    )) {
      const n = parseInt(m[1], 10);
      const t = parseInt(m[2], 10);
      if (Number.isFinite(n) && Number.isFinite(t) && t > 0 && n > 0) {
        iterNow = n;
        iterTotal = t;
      }
    }
    const paramIter = Number(params.iterations ?? NaN);
    if (iterTotal == null && Number.isFinite(paramIter) && paramIter > 0) {
      iterTotal = paramIter;
    }
    if (iterNow == null && iterTotal != null) {
      const itMatches = [...collapsed.matchAll(/(?:^|\s)it\s*\[?\s*(\d+)/gi)].map((m) =>
        parseInt(m[1], 10)
      );
      const iterMatches = [...collapsed.matchAll(/iteration\s*:?\s*(\d+)/gi)].map((m) =>
        parseInt(m[1], 10)
      );
      const all = [...itMatches, ...iterMatches].filter((v) => Number.isFinite(v));
      if (all.length > 0) iterNow = Math.max(...all);
    }

    // ---- (2) RELION's time bar: the freshest elapsed/total wins -----------
    // Formats (src/time.cpp): "%3.2f/%3.2f min", "%3.2f/%3.2f hrs",
    // "%4u/%4u sec". The init placeholder "000/??? sec" never matches (???
    // is not a digit). The bar is GLOBAL for per-image jobs and
    // per-iteration for the refine family — the combination happens below.
    let barRatio: number | null = null;
    for (const m of collapsed.matchAll(
      /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(sec|min|hrs)\b/g
    )) {
      const el = parseFloat(m[1]);
      const tot = parseFloat(m[2]);
      if (Number.isFinite(el) && Number.isFinite(tot) && tot > 0) {
        barRatio = Math.min(1, Math.max(0, el / tot));
      }
    }

    const pct = (frac: number) => Math.max(1, Math.min(99, Math.round(frac * 100)));

    // ---- refine family: iterations × (optionally) the in-iteration bar ----
    if (iterNow != null && iterTotal != null && iterNow > 0) {
      const frac =
        barRatio != null
          ? (iterNow - 1 + barRatio) / iterTotal
          : iterNow / iterTotal;
      return pct(frac);
    }

    // ---- per-image jobs: the GLOBAL bar is the ground truth ---------------
    // t353 — but ONLY for the per-image family (ctffind/motioncorr/extract/
    // autopick/import: one GLOBAL bar for the whole run, src/time.cpp driven
    // by the image loop). For the refine family a bare bar is the
    // WITHIN-iteration bar with its header scrolled out of the window —
    // reading it as global is exactly the "7 of 20 shows 99%" lie. Null:
    // the caller holds the last honest value (the monotonic contract).
    if (barRatio != null) return REFINE_FAMILY.has(type) ? null : pct(barRatio);

    // ---- n/N counters (the mock fakes' dialect, denominator included) -----
    let countedRatio: number | null = null;
    for (const m of collapsed.matchAll(
      /(?:micrograph|movie|particle|frame)\s+(\d+)\s*\/\s*(\d+)/gi
    )) {
      const n = parseInt(m[1], 10);
      const t = parseInt(m[2], 10);
      if (Number.isFinite(n) && Number.isFinite(t) && t > 0 && n >= 0) {
        countedRatio = Math.min(1, n / t);
      }
    }
    // t353 — same family gate for the n/N counters: a refine-family counter
    // ("particle 5/350000") counts the CURRENT iteration's expectation step,
    // not the run. The mock dialects set iterNow above ("it [003]") so this
    // only fires for genuinely header-less refine windows — hold, don't lie.
    if (countedRatio != null) return REFINE_FAMILY.has(type) ? null : pct(countedRatio);

    // nothing honest to say — the CALLER keeps the previous progress
    // (t319's monotonic contract: a running job's bar never regresses)
    return null;
  } catch {
    return null;
  }
}
