/**
 * CryoFlow — the world durability WORDS (t1165, grown to seven in
 * t1166).
 *
 * The pure, client-safe half of the world's durability face: the
 * verdicts' ladder order, the relative age word and the verdict's own
 * prose. ZERO node imports — the System diagnostics dialog (a client
 * component) and the server's diagnostics reader (src/lib/diagnostics.ts)
 * both speak from this ONE birthplace; a second formatter is how two
 * faces drift.
 *
 * The verdicts are the t1162 probe ladder's own words (t1166 added
 * MUTE-LIVE, the lane's own silence) — this module never re-derives a
 * verdict (the doorbell law: one probe, many mouths); it only gives the
 * quoted verdict its color bucket, its age word and its recommended
 * move.
 */

/** The seven verdicts the probe ladder speaks, in ladder order. */
export const WORLD_DURABILITY_VERDICTS = [
  "NO-SNAPSHOT",
  "LIED",
  "EMPTY-LIVE",
  "MUTE-LIVE",
  "DRIFTED",
  "STALE",
  "FRESH",
] as const;

/**
 * The age word — ONE father for the dialog card, the presenter and the
 * bench. Buckets: <90s just now · <60m minutes · <36h hours · days.
 * A null/absent/unparseable stamp speaks null — the caller decides the
 * honest absence (never a guessed "0m ago").
 */
export function relativeAgeWord(iso: string | null, now = new Date()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 90) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * The verdict's meaning in the world's own words (the t1160–t1164
 * ladder's prose): the card renders it under the verdict so the
 * operator reads the RECOMMENDED MOVE, not a bare label.
 */
export function worldVerdictNote(verdict: string): string {
  switch (verdict) {
    case "NO-SNAPSHOT":
      return "The tracked home is missing or unreadable — the recycle cannot be answered. Re-export builds a new home.";
    case "LIED":
      return "The snapshot contradicts itself (its own counts disagree with its rows) — do not trust it; re-export.";
    case "EMPTY-LIVE":
      return "The live lane is empty while the snapshot carries a spine — the recycle's signature. Restore is the recovery's business.";
    case "MUTE-LIVE":
      return "The live lane did not answer at all (locked, corrupt, or not a database) — the probe is blind, not the world empty; check the db lane before trusting any verdict.";
    case "DRIFTED":
      return "The live world moved since the export (count shift or fresher rows) — restore to turn back, or re-export to adopt.";
    case "STALE":
      return "The tracked home rides an older tree head while the data is faithful — re-export when convenient.";
    case "FRESH":
      return "The tracked home matches the tree head and the live counts — the world can be restored bit-for-bit.";
    default:
      return `An unknown verdict (${verdict}) — the instrument spoke a word this panel does not know; read the probe's own output.`;
  }
}
