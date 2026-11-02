/**
 * Elapsed-time formatting for the running-job readout (Task 141).
 *
 * The dialect deliberately differs between the two twins that share
 * this roof: elapsed is a FACT — no "~", and it carries seconds so the
 * 1s ticker visibly advances (the readout must look alive, or the user
 * cannot tell a running job from a hung one at a glance). ETA is a
 * PREDICTION — "~" and minute-grain only (seconds would be false
 * precision). t1032 retired the ETA twin's second birth: formatEta
 * USED to live in job-card.tsx while lib readers (the roster's CSV
 * father) had no honest way to reach it — the twins now share ONE roof
 * here, and job-card re-exports so every existing call site (and the
 * t1153 census's word-class boundary naming this file) stays put.
 *
 * Kept free of type annotations and imports on purpose: the e2e probe
 * lifts this exact source (strip the `export ` prefix, eval) as its
 * oracle — the product's formatter is the only formatter (Task 138
 * doctrine, function edition). A hand-copied oracle drifts; this one
 * cannot.
 */

/**
 * "42s" / "12m 05s" / "1h 04m" — fact grain: seconds under an hour,
 * minutes beyond it (nobody watches a 3-hour run tick by the second).
 * Negative / NaN input clamps to "0s" — a clock never reads backwards.
 */
export function formatElapsed(ms) {
  if (!Number.isFinite(ms)) return "0s";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  const ss = s % 60;
  if (m < 60) return m + "m " + String(ss).padStart(2, "0") + "s";
  const h = Math.floor(m / 60);
  return h + "h " + String(m % 60).padStart(2, "0") + "m";
}

/**
 * "~3h 5m" / "~12m" / "~45s" — the PREDICTION twin: minute-grain and
 * the "~" prefix (seconds would be false precision — a pace-derived
 * ETA re-reads every iteration; Task 141's dialect). Retired here by
 * t1032 (one roof for the two time words; the roster's CSV father was
 * the reader that had no honest way to reach job-card.tsx).
 */
export function formatEta(ms) {
  const s = Math.round(ms / 1000);
  if (s < 90) return "~" + s + "s";
  const m = Math.round(s / 60);
  if (m < 90) return "~" + m + "m";
  const h = Math.floor(m / 60);
  return "~" + h + "h " + (m % 60) + "m";
}
