/**
 * The assistant panel's floating-window restore arithmetic — the
 * meaning behind the persisted geometry's reopen (t902, the whisper's
 * fourth seat).
 *
 * The panel persists its window geometry (localStorage, one echo per
 * gesture — the t638 law) and restores it on the next desktop mount.
 * The restore is not always faithful: the viewport may have SHRUNK
 * since the shape was written (a smaller monitor, devtools open, a
 * half-snapped window), and clampGeo then hands back a DIFFERENT
 * window — smaller, pulled back inside the screen. Remembered state
 * that fails to restore faithfully is INVISIBLE — the user just finds
 * their window "somewhere else" — so the component whispers the edit
 * (the t901 grammar's fourth seat: the house mono voice at whisper
 * level; silence is the honest voice at an exact restore; the user's
 * first gesture on the window takes ownership).
 *
 * This module owns the arithmetic so it can be unit-receipted (the
 * t653 law: the meaning lives in lib, the UI imports it, the clamp the
 * restore applies can never drift from the clamp the drags apply).
 *
 * Voice note: this lib serves the assistant panel, whose own surface
 * voice is Chinese (the t502 stale banner speaks Chinese) — the
 * summary clauses below speak the panel's language, unlike the
 * English-speaking fsc-compare dialog's whisper (t901).
 */

/** the floating window's shape — moved verbatim from the panel (the
 * drag/resize/restore faces share ONE geometry type) */
export interface WinGeo {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const GEO_MIN_W = 360;
export const GEO_MIN_H = 420;
/** t500's mobile breakpoint, t638 — the full-screen face ignores
 * geometry (its narrow clamp would poison the persisted desktop
 * shape), so every WRITE path re-checks the live viewport. */
export const GEO_MOBILE_BP = 768;

/**
 * Keep the window inside the viewport: size clamped to [min, viewport−16],
 * position clamped to the 8px margins. The ONE clamp every face reads —
 * the drags, the resize listener, and the restore.
 */
export function clampGeo(g: WinGeo, vw: number, vh: number): WinGeo {
  const w = Math.min(Math.max(g.w, GEO_MIN_W), Math.max(vw - 16, GEO_MIN_W));
  const h = Math.min(Math.max(g.h, GEO_MIN_H), Math.max(vh - 16, GEO_MIN_H));
  return {
    w,
    h,
    x: Math.min(Math.max(g.x, 8), Math.max(vw - w - 8, 8)),
    y: Math.min(Math.max(g.y, 8), Math.max(vh - h - 8, 8)),
  };
}

/** the home position (top-right) — a view concern, but its arithmetic
 * rides the same primitives so the home corner obeys the same clamp */
export function defaultGeo(vw: number, vh: number): WinGeo {
  const w = Math.min(560, Math.max(vw - 32, GEO_MIN_W));
  const h = Math.min(760, Math.max(vh - 96, GEO_MIN_H));
  return clampGeo({ w, h, x: vw - w - 24, y: 64 }, vw, vh);
}

/** an axis family the restore had to edit */
export type GeoRestoreEdit = { axis: "size" | "position" };

/**
 * Restore the persisted shape under TODAY'S viewport.
 *
 * The clamp is applied (the same clamp the drags apply — one law),
 * and any axis family the clamp MOVED is reported as an edit:
 * - "size": the remembered w/h did not fit (the screen shrank);
 * - "position": the remembered x/y did not fit (measured AFTER the
 *   size clamp — a smaller window may fit where the big one didn't,
 *   and only the honest survivors are named).
 * An exact fit returns NO edits — the component stays silent (silence
 * is the exact-restore voice).
 */
export function restoreGeo(
  saved: WinGeo,
  vw: number,
  vh: number
): { geo: WinGeo; edits: GeoRestoreEdit[] } {
  const geo = clampGeo(saved, vw, vh);
  const edits: GeoRestoreEdit[] = [];
  if (geo.w !== saved.w || geo.h !== saved.h) edits.push({ axis: "size" });
  if (geo.x !== saved.x || geo.y !== saved.y) edits.push({ axis: "position" });
  return { geo, edits };
}

/**
 * The whisper's clause line — the panel's own Chinese voice, one line:
 * 「记住的窗口没原样回来 — 尺寸被收紧到屏幕内 · 位置被拉回屏幕内」.
 * An empty edit list returns "" (the component never renders the
 * whisper for it — silence is the exact-restore voice).
 */
export function restoreGeoSummary(edits: GeoRestoreEdit[]): string {
  const parts: string[] = [];
  if (edits.some((e) => e.axis === "size")) parts.push("尺寸被收紧到屏幕内");
  if (edits.some((e) => e.axis === "position")) parts.push("位置被拉回屏幕内");
  if (parts.length === 0) return "";
  return `记住的窗口没原样回来 — ${parts.join(" · ")}`;
}
