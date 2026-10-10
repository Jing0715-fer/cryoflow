import React from "react";

/**
 * Task 142 — the canonical wall-clock ticker, one hook for every readout.
 *
 * Doctrine (Task 141): the initial value is 0, never Date.now() — a lazy
 * initializer runs during render, and a server-side render would freeze
 * its value into the flight payload as hydration arithmetic. Consumers
 * gate on now > 0 and render nothing until the first effect tick lands;
 * the clock reading never enters the first frame.
 *
 * The interval exists only while `active` — an idle world costs zero
 * timers. Activation aligns immediately (setNow on the effect's mount)
 * so a re-activated readout never shows a stale first frame.
 *
 * (React-namespace useState/useEffect on purpose: the body must stay
 * byte-identical to the card implementation it canonizes — and the lint
 * rule's static linking only blesses the namespace form.)
 */
export function useNow(active: boolean): number {
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

/* ------------------------------------------------------------------------- */

/**
 * The print doc's clock — a CLIENT-ONLY value, hydration-safe by
 * construction (the t232 doctrine, recast in the canonical shape).
 *
 * The print header/footer stamp the print date. A date computed during
 * the first render would freeze the SERVER's clock into the prerendered
 * HTML and hydrate to a different client value (the mismatch React
 * refuses); the old cure filled it from an effect (first frame empty,
 * setState on mount) — correct, but a whole extra render pass the
 * set-state-in-effect rule rightly complains about. The canonical cure
 * is a store the client owns: subscribe is a no-op (the clock never
 * pushes — the value refreshes only when something else re-renders the
 * doc, which for a print stamp is never), getSnapshot reads the client
 * clock (stable within a day — Object.is compares strings by value), and
 * the SERVER snapshot is the empty string, so hydration starts matched
 * and React swaps in the client clock right after mount. Byte-for-byte
 * the observable behavior of the effect version, with zero effects.
 */
const subscribeNoop = () => () => {};
const formatPrintedDate = () =>
  new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export function usePrintedDate(): string {
  return React.useSyncExternalStore(
    subscribeNoop,
    formatPrintedDate,
    () => "",
  );
}
