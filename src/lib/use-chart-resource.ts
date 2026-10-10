"use client";

/**
 * CryoFlow — the chart panels' shared fetch state machine (t491).
 *
 * Seven result panels (fsc / guinier / angdist / ctf / motion / topaz /
 * resolution) each hand-rolled the same effect: fetchJsonRetry once
 * (plus a poll interval while the job runs), set data, catch silently.
 * Five of them even kept an `error` state — and then rendered `null`
 * with it, throwing the face away. The result: a chart that died to a
 * transient blip (dev-server OOM, Turbopack first-hit 500, a restart)
 * was INDISTINGUISHABLE from a chart that honestly has no data. On the
 * OOM-prone dev lane the panels went dark and nobody could tell a
 * wound from an absence.
 *
 * The hook is the one birthplace of the fix's vocabulary:
 *   - loading   — first fetch in flight (panels stay hidden, as before)
 *   - ready     — data arrived (the panel still decides renderability)
 *   - empty     — definitive 4xx: genuinely no data → self-hide contract
 *                 PRESERVED (this is honest absence, not a failure)
 *   - wounded   — transient failures exhausted their retries → the panel
 *                 renders a visible ChartErrorStrip with a Retry chip.
 *                 Silence here would be a lie that reads as "no data".
 *
 * A poll blip with a live chart on screen keeps the last good data
 * (lastGood ref): a running job's 30 s poll failing once must not kill
 * the view it was refreshing. Only a chart that never got data goes
 * visibly wounded.
 *
 * Consumers:
 *   const { status, data, error, retry } = useChartResource<FscResponse>(
 *     `/api/jobs/${jobId}/fsc`, { pollMs: running ? 30_000 : null });
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { classifyFetchFailure, fetchJsonRetry } from "./retry-fetch";

export type ChartResourceStatus = "loading" | "ready" | "empty" | "wounded";

export interface ChartResource<T> {
  status: ChartResourceStatus;
  /** the fetched body when ready; null while loading/empty/wounded */
  data: T | null;
  /** the final failure's message — meaningful when wounded AND when
   *  empty (t492: the reason for an absence is still information; the
   *  enhancement panels hide on empty and never read it, but a view the
   *  user explicitly opened — the STAR dialog — owes its reader the
   *  verdict, not a blank hole) */
  error: string | null;
  /** re-fire the fetch (the strip's Retry chip); also re-runs after a
   *  url change, resetting lastGood so one job's data never bleeds into
   *  another's panel. */
  retry: () => void;
}

export function useChartResource<T>(
  url: string,
  { pollMs }: { pollMs?: number | null } = {}
): ChartResource<T> {
  const [state, setState] = useState<{
    status: ChartResourceStatus;
    data: T | null;
    error: string | null;
  }>({ status: "loading", data: null, error: null });
  const [nonce, setNonce] = useState(0);
  // last good body lives in a ref (not state): a poll blip with data on
  // screen keeps the ready face instead of flickering through wounded
  const lastGood = useRef<T | null>(null);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  // t492 — the reset to `loading` when the resource identity changes
  // (url / poll cadence / retry nonce) lives in RENDER, not in the
  // effect: React's official "adjusting state when a prop changes"
  // pattern. The old effect-body setState was a cascading render (the
  // set-state-in-effect lint was right); the reset is state
  // derivation, and the effect below only does what effects are for —
  // talking to the network.
  const [prevKey, setPrevKey] = useState<string | null>(null);
  const key = `${url}#${pollMs ?? "nopoll"}#${nonce}`;
  if (key !== prevKey) {
    setPrevKey(key);
    setState({ status: "loading", data: null, error: null });
  }

  useEffect(() => {
    let cancelled = false;
    // ref writes live in the effect (render may not touch refs); the
    // key above guarantees the effect re-runs on every identity change,
    // so lastGood is cleared exactly when the reset above happens
    lastGood.current = null;
    const load = async () => {
      try {
        const body = await fetchJsonRetry<T>(url);
        if (cancelled) return;
        lastGood.current = body;
        setState({ status: "ready", data: body, error: null });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "fetch failed";
        if (classifyFetchFailure(err) === "definitive") {
          // honest absence — the self-hide contract stays intact. The
          // reason still travels in `error` (t492): enhancement panels
          // self-hide and never read it, user-initiated views quote it.
          lastGood.current = null;
          setState({ status: "empty", data: null, error: msg });
        } else if (lastGood.current != null) {
          // poll blip with a live chart on screen — keep it (stale but
          // alive); the next poll gets a fresh chance to heal
          setState((s) => (s.data != null ? s : { status: "wounded", data: null, error: msg }));
        } else {
          setState({
            status: "wounded",
            data: null,
            error: msg,
          });
        }
      }
    };
    void load();
    if (!pollMs) {
      return () => {
        cancelled = true;
      };
    }
    const t = setInterval(() => void load(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [url, pollMs, nonce]);

  return { ...state, retry };
}
