import * as React from "react";
import { useActiveWorkspaceJobs, useWorkflowStore } from "@/lib/store";

/**
 * Task 143 — the browser tab joins the census.
 *
 * The heartbeat arc has reached every chrome layer a scientist can see
 * while LOOKING at the app: cards (t141), footer census (t140), the
 * batch's age (t142), the inspector, the roster. The one surface nobody
 * sees while looking at the app is the browser tab itself — and that is
 * exactly the surface a scientist sees when they are NOT looking: a
 * batch kicked off, then email, then ten other tabs. The tab must say
 * which workspace is alive and whether something broke.
 *
 * Two glance surfaces, one doctrine:
 *   title   — "W2 · 2 running · 1 failed · CryoFlow". Counts only, the
 *             glance granularity (t142's StageChip lesson: a glance
 *             surface speaks counts, a reading surface speaks time — a
 *             1s ticker never touches this hook, so the tab never
 *             flickers and an idle world pays zero timers).
 *   favicon — the app mark with a state dot: teal-400 while runners
 *             live, rose-500 when anything failed. The dot is presence,
 *             not count — at tab-strip size (16px) a number is noise,
 *             a color is a signal. Failed outranks running: the alarm
 *             color wins the pixel.
 *
 * Presence-derived like the footer census: a zero segment is omitted
 * (a filter that doesn't exist cannot speak), and a quiet world
 * restores BOTH surfaces to the state they were found in — the pristine
 * metadata title and the mark without a dot. "Restore the state you
 * found" is the footer toggle's contract, extended to the tab.
 *
 * Hydration doctrine (t141): this hook has ZERO render output — title
 * and favicon live entirely inside an effect, so the server-streamed
 * <title> is never reconciled against anything and no clock value can
 * enter first-paint. The pristine title is captured on the first
 * effect run (client-only) BEFORE any write, even when the world boots
 * with runners already alive.
 *
 * The favicon link is OWNED by this hook (marked data-cf-tab): CryoFlow
 * ships no static icon file, so the hook creates the link once and
 * rewrites href per state — one source of truth for the mark, no
 * multiple-icon-link ambiguity across browsers.
 */

const BRAND = "CryoFlow";

type FaviconState = "quiet" | "running" | "failed";

/** The app mark: a dark tile with a teal CTF ring (Thon rings are how
 *  cryo-EM judges micrograph quality — the brand IS the domain). The
 *  state dot sits top-right; teal-400 = alive, rose-500 = alarm
 *  (STATUS_CHIP's running/failed dialect, borrowed not reinvented). */
function faviconHref(state: FaviconState): string {
  const dot =
    state === "failed"
      ? '<circle cx="18.5" cy="5.5" r="4" fill="#f43f5e" stroke="#f8fafc" stroke-width="1.2"/>'
      : state === "running"
        ? '<circle cx="18.5" cy="5.5" r="4" fill="#2dd4bf" stroke="#f8fafc" stroke-width="1.2"/>'
        : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect x="0.5" y="0.5" width="23" height="23" rx="6.5" fill="#0f172a"/>` +
    `<circle cx="12" cy="12" r="6.5" fill="none" stroke="#14b8a6" stroke-width="2"/>` +
    `<circle cx="12" cy="12" r="1.8" fill="#e2e8f0"/>` +
    dot +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Create-or-reuse the hook-owned favicon link; href writes are guarded
 *  so an unchanged state never makes the browser re-fetch the icon. */
function setFavicon(state: FaviconState): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-cf-tab]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-cf-tab", "true");
    document.head.appendChild(link);
  }
  const href = faviconHref(state);
  if (link.getAttribute("href") !== href) link.setAttribute("href", href);
}

/** Pristine title captured once per tab (module scope: React strict
 *  mode's double effect run must capture the same pre-write value). */
let baseTitle: string | null = null;

export function useTabCensus(): void {
  const jobs = useActiveWorkspaceJobs();
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);

  // primitive derivations only — the effect re-runs when a COUNT
  // changes, not on every poll tick's object churn
  const running = React.useMemo(
    () => jobs.reduce((n, j) => n + (j.status === "running" ? 1 : 0), 0),
    [jobs]
  );
  const failed = React.useMemo(
    () => jobs.reduce((n, j) => n + (j.status === "failed" ? 1 : 0), 0),
    [jobs]
  );
  const wsName = React.useMemo(() => {
    if (activeWorkspaceId == null) return null;
    return workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null;
  }, [workspaces, activeWorkspaceId]);

  React.useEffect(() => {
    if (baseTitle === null) baseTitle = document.title;
    if (running <= 0 && failed <= 0) {
      // quiet world: both surfaces restore the state they found
      document.title = baseTitle;
      setFavicon("quiet");
      return;
    }
    // census order mirrors the footer's FIND_STATUSES reading order
    // (running first, failed after); the workspace name leads because
    // tab strips truncate the TAIL and the live info must survive
    const parts = [
      ...(wsName ? [wsName] : []),
      ...(running > 0 ? [`${running} running`] : []),
      ...(failed > 0 ? [`${failed} failed`] : []),
      BRAND,
    ];
    document.title = parts.join(" · ");
    // alarm precedence: the rose dot outranks the teal one — a batch
    // that is both running and failing advertises the failing half
    setFavicon(failed > 0 ? "failed" : "running");
  }, [running, failed, wsName]);
}
