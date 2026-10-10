"use client";

import * as React from "react";
import { toast } from "@/hooks/use-toast";
import {
  PENDING_SHARE_KEY,
  decodeSharePayload,
} from "@/lib/view-link";
import { useWorkflowStore } from "@/lib/store";

/**
 * t822 — the shared view's landing pad. A pose-in-URL link
 * (`/?view=<payload>`) stages itself here ONCE, cleans the address bar
 * FIRST (reload must never re-fly — the one-shot contract the PENDING_VIEW
 * handshake established), and then drives the store's own openJob dialect
 * (the wall-jump machinery: cross-project switch via the payload's
 * projectId hint, workspace hop, canvas + inspect). The viewer consumes
 * the staged pose when its map opens.
 *
 * The boot race is respected: the store's projects arrive asynchronously
 * (the t407 lesson — a first visit can beat the fetch), so the landing
 * retries the openJob drive a few times before it speaks an honest miss.
 * Every exit owes a verdict: the landing, or the honest could-not-land.
 * A malformed payload never stages at all — it is bounced here with its
 * own honest toast, so the viewer's consumer only ever sees well-formed
 * shares.
 */
export function SharedViewLanding() {
  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const sp = new URLSearchParams(window.location.search);
      const raw = sp.get("view");
      if (!raw) return;

      // clean the bar FIRST — before any await, before any store work:
      // a reload (or a re-share of the address-bar text) must never
      // re-fly the pose. The one-shot contract starts here.
      sp.delete("view");
      const rest = sp.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (rest ? `?${rest}` : "")
      );

      const share = decodeSharePayload(raw);
      if (!share) {
        toast({
          title: "This shared link could not be read",
          description:
            "The view payload inside the URL is malformed or truncated — ask for a fresh link.",
        });
        return;
      }

      // stage before the landing drive — the viewer may mount fast
      try {
        sessionStorage.setItem(PENDING_SHARE_KEY, raw);
      } catch {
        /* private mode — the landing still drives; the pose just cannot
           wait for the viewer. The drive below still lands the job. */
      }

      // the wall-jump dialect, with retries for the boot race
      for (let attempt = 0; attempt < 6 && alive; attempt += 1) {
        await useWorkflowStore.getState().openJob(share.jobId, {
          projectId: share.projectId ?? null,
        });
        if (useWorkflowStore.getState().jobs.some((j) => j.id === share.jobId)) {
          if (!alive) return;
          toast({
            title: "Shared view landed",
            description: `“${share.name}” is here — open the map in the 3D viewer to fly to it.`,
          });
          return;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
      if (alive) {
        try {
          sessionStorage.removeItem(PENDING_SHARE_KEY);
        } catch {
          /* nothing staged is nothing owed */
        }
        toast({
          title: "Shared view could not land",
          description:
            "The link's job is not in any project this browser can reach right now.",
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return null;
}
