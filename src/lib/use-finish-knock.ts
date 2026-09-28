"use client";

/**
 * CryoFlow — the finish knock's PRESENCE (t438).
 *
 * The brain lives in lib/finish-knock.ts (pure, benched); this hook is
 * its ears and hands, mounted once in AppShell next to the tab census:
 *
 *   ears   a zustand subscription on the store's job list — the same
 *          stream the toast sweep reads (the poll tick's `finished`
 *          array never leaves store.ts; diffing prev→next jobs here
 *          reproduces the identical transition set with the identical
 *          law, without surgery on the store's hot path).
 *
 *   hands  three channels applied per plan: knocks → the title census
 *          (via the module counter use-tab-census subscribes to),
 *          chime → WebAudio, notification → the OS. The visible/hidden
 *          split is enforced inside planKnock — this hook never
 *          re-checks it.
 *
 *   ack    returning to the tab clears the count — the same reflex
 *          that makes a returning poll tick refresh the cards. The
 *          title knock is a "you missed something", not a ledger.
 *
 * Self-protection (no armed flag needed): the diff law only fires on
 * running → final, and a fresh boot / project switch fills the list
 * with jobs whose PREVIOUS status this tab never saw as running — the
 * law's silence is the boot's silence.
 */

import { useEffect } from "react";
import { useWorkflowStore } from "@/lib/store";
import {
  addKnocks,
  clearKnocks,
  diffFinishEvents,
  knockPermission,
  planKnock,
  playKnockChime,
  readKnockSound,
  sendKnockNotification,
} from "@/lib/finish-knock";

export function useFinishKnock(): void {
  useEffect(() => {
    const unsub = useWorkflowStore.subscribe((state, prev) => {
      // identity gate: subscription fires on EVERY set (selection,
      // notes, dialogs…) — only a replaced job list can carry finishes
      if (state.jobs === prev.jobs) return;
      const events = diffFinishEvents(prev.jobs, state.jobs);
      if (events.length === 0) return;
      const plan = planKnock(events, {
        hidden: document.hidden,
        soundOn: readKnockSound(),
        perm: knockPermission(),
      });
      if (plan.knocks > 0) addKnocks(plan.knocks);
      if (plan.chime) playKnockChime();
      if (plan.notification) sendKnockNotification(plan.notification);
    });

    const onVis = () => {
      if (document.visibilityState === "visible") clearKnocks();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
}
