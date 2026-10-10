"use client";

/**
 * t451 — the walk's inheritance: the heir's pulse.
 *
 * The boot's load() calls resumeSubtreeOrch once — that resurrects a
 * walk whose owner died BEFORE this tab opened. But the inheritance
 * story has a second scene: the sibling tab that is ALREADY OPEN when
 * the owner goes silent. Nothing re-runs load() there — the heir needs
 * its own pulse.
 *
 * This hook is that pulse: a slow heartbeat of CHECKS (never claims —
 * the claim law inside resumeSubtreeOrch is the only hand that takes a
 * walk). A check is almost free (one localStorage read) and acts only
 * when every gate opens:
 *   - this tab is visible — "the heir inherits when they show up":
 *     a background tab never steals a walk (background browsers also
 *     throttle timers, so a foreground-only law is the honest one);
 *   - this tab is not already walking its own lane;
 *   - a record exists, owned by a stranger, whose heartbeat went
 *     stale (the owner is dead or gone).
 * Only then does it call resumeSubtreeOrch, whose claim does the
 * taking — the hook decides WHEN to ask, never WHOSE the walk is.
 *
 * Triggers: a slow interval (the walk's plan outlives its owner even
 * when no event fires), visibilitychange and focus (the user just
 * looked at this tab), and the storage event (the owner's last
 * heartbeat, or its final clear, just arrived cross-tab). The storage
 * listener is what makes a fresh claim visible to every sibling at
 * once; the interval is what notices the silence AFTER the last write.
 *
 * Mounted once, in the app shell. No state, no re-renders — the strip
 * renders from the store, the pulse only knocks on its door.
 */

import * as React from "react";

import { useWorkflowStore } from "@/lib/store";
import {
  ORCH_RECORD_KEY,
  ORCH_STALE_MS,
  readSubtreeOrch,
} from "@/lib/subtree-orch-session";
import { getTabId } from "@/lib/tab-identity";

const PULSE_MS = 15_000;

export function useOrchAdoption(): void {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let checking = false;

    const check = () => {
      if (checking) return; // one claim attempt at a time, per tab
      if (document.visibilityState !== "visible") return; // heirs inherit in the foreground
      if (useWorkflowStore.getState().subtreeOrch) return; // this tab walks already
      const rec = readSubtreeOrch();
      if (!rec) return; // no walk to inherit
      if (rec.owner === getTabId()) return; // ours (a reload's resume is load()'s business)
      if (Date.now() - rec.hb < ORCH_STALE_MS) return; // the owner is alive
      checking = true;
      void useWorkflowStore
        .getState()
        .resumeSubtreeOrch()
        .finally(() => {
          checking = false;
        });
    };

    const iv = setInterval(check, PULSE_MS);
    const onWake = () => check();
    const onStorage = (e: StorageEvent) => {
      // the owner's writes (heartbeats, the final clear) land cross-tab
      // here — a cheap nudge; the gates above decide whether it means
      // anything. e.key === null is a clear() — also worth one look.
      if (e.key !== ORCH_RECORD_KEY && e.key !== null) return;
      check();
    };

    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
}
