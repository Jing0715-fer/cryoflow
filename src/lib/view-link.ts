/**
 * Dashboard gallery → 3D viewer handoff.
 *
 * Clicking a saved view on the dashboard's cross-project gallery writes a
 * one-shot request here before deep-linking to the job. The viewer
 * consumes it once its plugin is up AND its bookmark list has loaded
 * (so a view that was deleted in the meantime reports honestly instead
 * of silently doing nothing). Fresh intent overwrites stale — the key
 * holds exactly one pending view.
 */
export const PENDING_VIEW_KEY = "cryoflow:pending-view";

export interface PendingView {
  jobId: string;
  bookmarkId: string;
}

/**
 * t670 — "saved views changed"broadcast. The collection now has TWO
 * mutation mouths (the dashboard wall's X, t669; the palette row's X,
 * t670), and the wall's own refetch trigger (jobCount) never fires for a
 * bookmark mutation — a delete from the OTHER mouth would leave the wall
 * holding its stale copy until some unrelated job mutation happened to
 * refresh it. A delete dispatches this; the wall re-reads the route at
 * click-time freshness (never trusts a payload — the same doctrine as its
 * own delete: read fresh, render what the server confirms).
 */
export const SAVED_VIEWS_CHANGED_EVENT = "cryoflow:saved-views-changed";

/**
 * t822 — the shareable view link. A pose travels INSIDE the URL itself
 * (self-contained: the recipient needs no account, no bookmark row, no
 * sync), so "Copy view link" hands a colleague the exact camera in one
 * paste. The payload is versioned and shape-checked on decode — a
 * malformed, truncated or oversized link degrades to an honest toast,
 * never a half-applied pose. The handshake reuses the one-shot doctrine
 * the PENDING_VIEW handshake established: stage once, consume once, and
 * reload never re-flies (the landing cleans the address bar FIRST).
 */
export const PENDING_SHARE_KEY = "cryoflow:pending-shared-view";

export interface SharePayload {
  v: 1;
  jobId: string;
  projectId?: string | null;
  name: string;
  snapshot: Record<string, unknown>;
  view?: Record<string, unknown>;
}

/** URL length budget. A camera pose is small (~0.5KB encoded); a payload
 *  beyond this is a corruption smell, and browsers begin truncating
 *  shared URLs well before 8KB. The copy door refuses past the cap —
 *  honestly, before the clipboard is ever touched. */
export const SHARE_PAYLOAD_MAX = 6000;

/** UTF-8-safe base64url: encodeURIComponent keeps the JSON ASCII-only, so
 *  btoa never throws; the URL-unsafe alphabet (+ / =) is swapped out so
 *  the payload rides a query param unmangled. */
export function encodeSharePayload(p: Omit<SharePayload, "v">): string {
  const json = JSON.stringify({ ...p, v: 1 as const });
  return btoa(encodeURIComponent(json))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The decode is the door's bouncer: anything that is not a well-formed
 *  v1 payload returns null (never a partial pose). Every field the
 *  consumer will trust is checked here, once, in one place. */
export function decodeSharePayload(s: string): SharePayload | null {
  try {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = decodeURIComponent(atob(b64));
    const p = JSON.parse(json) as SharePayload;
    if (!p || p.v !== 1) return null;
    if (typeof p.jobId !== "string" || !p.jobId) return null;
    if (typeof p.name !== "string" || !p.name) return null;
    if (!p.snapshot || typeof p.snapshot !== "object") return null;
    if (p.view !== undefined && (p.view === null || typeof p.view !== "object")) return null;
    return p;
  } catch {
    return null;
  }
}
