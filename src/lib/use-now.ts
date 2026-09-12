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
