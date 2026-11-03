/**
 * CryoFlow — the activity calendar's ONE export father (t1033).
 *
 * The dashboard's activity heatmap is the project's shape-of-time paper
 * (Task 711: one column per week, one row per weekday, one cell per day;
 * the shade speaks `touched`, the tooltip speaks the split) — yet its
 * days could not leave as bytes. This lib is the calendar's data mouth:
 * the SAME cells the tooltips speak, one formula, two surfaces. The
 * grammar chain (t1019 chart faces → t1028 session tables → t1029 one
 * grammar → t1030 file ledger → t1031 params diff → t1032 job roster)
 * visits its SEVENTH seat here.
 *
 * The head words are the tooltip's own facts, in the tooltip's reading
 * order ("Oct 8: 5 touches · 2 created · 1 completed"): Date, Touched,
 * Created, Completed.
 *
 * The Date cell speaks the ISO day — the ADDRESS (sortable, unambiguous,
 * spreadsheet-honest); the tooltip's "Oct 8" is the reading voice, a
 * WIDTH economy — the display-economy law (t1031 F1): the file speaks
 * the value the label MEANS, never the clip. The label formula itself
 * retired here (`heatmapDayLabel`) so the tooltip and any reader of the
 * file speak the SAME bridge — the t1030 twin-retirement law: one
 * formula, two surfaces, no re-typed twin. The shade's own math
 * (levelOf's relative thresholds) stays component-local — the shade is
 * the PAPER's paint, never a cell (the t223 law: rendered facts ride the
 * surface, the bytes keep the facts they mean).
 *
 * Rendered doors never join the bytes: the legend, the today-ring, the
 * month labels are the paper's chrome — only the day cells' four facts
 * travel.
 */

/** The paper's own head words — the tooltip's facts, in its reading order. */
export const HEATMAP_HEAD = ["Date", "Touched", "Created", "Completed"] as const;

/** The wire's day shape — GET /api/activity/heatmap's day rows. */
export interface HeatmapDay {
  date: string;
  created: number;
  completed: number;
  touched: number;
}

/** The row the file holds — the CsvRow contract (the doors' row type). */
export type HeatmapRow = {
  Date: string;
  Touched: number;
  Created: number;
  Completed: number;
};

/**
 * "2026-10-08" → "Oct 8" — the reading voice. A fixed UTC parse, immune
 * to locale drift between server render and hydration (the component's
 * own formula, retired here so the tooltip and the file's bridge are one
 * father's words). Malformed input speaks the input untouched — an
 * address that cannot be parsed is still an address.
 */
export function heatmapDayLabel(iso: string): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
}

/**
 * The calendar's rows — the cells the tooltips speak, one per day, in the
 * wire's own order (the calendar renders the wire's order: the first
 * column opens the window, the last ends today — the caller's order is
 * the section's reading order, never re-sorted).
 *
 * The Date cell speaks the ISO address; the counts travel as numbers —
 * the unit lives in the head's own name ("Touched"), the cell speaks the
 * count the tooltip means ("5 touches" → 5).
 *
 * null/empty input → null: the door's contract (an empty calendar helps
 * nobody, and the empty-state law already refuses to render one — the
 * door's disabled face is the same honesty at the same gate).
 */
export function heatmapRows(
  days: HeatmapDay[] | null | undefined
): HeatmapRow[] | null {
  if (!days || days.length === 0) return null;
  return days.map((d) => ({
    Date: d.date,
    Touched: d.touched,
    Created: d.created,
    Completed: d.completed,
  }));
}
