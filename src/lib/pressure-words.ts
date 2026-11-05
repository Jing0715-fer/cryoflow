/**
 * t880 — the pressure face's client-safe word birthplace.
 *
 * diagnostics.ts owns the READER (the dmesg spawn, /proc reads — node
 * only); this module owns the WORDS the browser speaks about them. The
 * t1165 precedent (world-durability-words.ts): one father per word, a
 * lane the dialog and the AI presenter share, zero node imports — the
 * client mirror and the server's payload compose the same clause from
 * the same arithmetic, so a kills-count and its tempo can never drift
 * apart between the card and the locator line.
 */

export interface OomTempoInput {
  oomKills: number | null;
  uptimeHours: number | null;
}

/**
 * The tempo word: the war's tempo, not just its count. Nine kills mean
 * nothing without the boot's length — nine kills in 90 minutes is a
 * violent box (the t879 witness campaign), nine kills in a month is
 * weather. One father, one precision: kills-per-day at one decimal
 * below ten, integer above. Null when either input is absent — the
 * caller's own sentence already speaks the count, never a guessed rate.
 */
export function oomTempoWord(oomKills: number | null, uptimeHours: number | null): string | null {
  if (oomKills == null || oomKills <= 0 || uptimeHours == null) return null;
  if (uptimeHours < 1) {
    return oomKills === 1 ? "a kill within the first hour up" : `${oomKills} kills within the first hour up`;
  }
  const perDay = (oomKills / uptimeHours) * 24;
  const word = perDay >= 10 ? Math.round(perDay).toString() : perDay.toFixed(1);
  return `≈${word}/day over ${uptimeHours < 10 ? uptimeHours.toFixed(1) : Math.round(uptimeHours)}h up`;
}
