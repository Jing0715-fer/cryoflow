"use client";

import dynamic from "next/dynamic";

/**
 * CryoFlow — the home route.
 *
 * t391 — this file used to carry the ENTIRE application body (10k+ lines of
 * client graph: canvas, inspector, panels, dialogs). Next 16's dev server
 * EAGERLY compiles the entry page at boot, so that graph was the single
 * biggest allocation on the box — its compile peak and, worse, its RESIDUAL
 * baseline sat under every API workload (the sweep, the log streaming, the
 * job runs) and small boxes spent their whole day OOM-reaping the server
 * mid-run. The body now lives in components/workflow/app-shell.tsx and
 * loads as its own chunk:
 *
 *   · the BOOT compile is this thin shell (fast, tiny);
 *   · the app chunk compiles on the FIRST BROWSER VISIT, when nothing else
 *     competes for memory — and never again (the chunk is cached);
 *   · API-only sessions (a long cluster run with the tab closed, the diag
 *     harnesses, headless operation) never pay for UI they never render;
 *   · the production standalone build is mechanically unchanged — the
 *     browser just gets a standard loading shell on first paint.
 */
const AppShell = dynamic(() => import("@/components/workflow/app-shell").then((m) => m.AppShell), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-label="Loading CryoFlow"
      className="flex h-dvh flex-col items-center justify-center gap-3 bg-background text-muted-foreground"
    >
      <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground/80" />
      <p className="text-sm">Loading CryoFlow…</p>
    </div>
  ),
});

export default function Home() {
  return <AppShell />;
}
