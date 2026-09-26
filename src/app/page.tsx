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
  loading: () => <BootSkeleton />,
});

/**
 * t393 — the boot skeleton. The thin shell's old loading state (a lone
 * centered spinner) flashed a blank white void for the app chunk's first
 * compile and then the WHOLE layout popped in at once. The skeleton now
 * PREVIEWS the real chrome with the exact dimensions it will resolve to —
 * h-14 header, w-72 catalog rail, w-[380px] inspector rail, min-h-9 footer,
 * the same responsive breakpoints — so the loading → app transition is a
 * content swap inside a stable frame instead of a layout jump. The canvas
 * hint (dot grid + two job-card ghosts) tells the user what kind of app is
 * coming; the small central spinner + label keeps the progress explicit
 * (role="status" for screen readers, as before).
 */
function BootSkeleton() {
  const railRow = (
    <div className="flex items-center gap-3 rounded-md border bg-card/60 p-2">
      <div className="size-8 shrink-0 rounded bg-muted animate-pulse" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-2 w-1/2 rounded bg-muted/70 animate-pulse" />
      </div>
    </div>
  );
  const panelRow = (
    <div className="space-y-2">
      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
      <div className="h-8 w-full rounded-md border bg-muted/40 animate-pulse" />
    </div>
  );
  return (
    <div
      role="status"
      aria-label="Loading CryoFlow"
      className="flex h-dvh flex-col bg-background text-muted-foreground"
    >
      {/* header ghost — h-14, the real banner's exact height */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="flex items-center gap-3">
          <div className="size-7 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="hidden items-center gap-1 sm:flex">
            <div className="h-7 w-20 rounded-md bg-muted animate-pulse" />
            <div className="h-7 w-20 rounded-md bg-muted/50 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden h-8 w-40 rounded-md border bg-muted/40 animate-pulse sm:block" />
          <div className="size-8 rounded-md border bg-muted/40 animate-pulse" />
          <div className="hidden size-8 rounded-md border bg-muted/40 animate-pulse sm:block" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* catalog rail ghost — w-72 at lg, the real rail's exact width */}
        <div className="hidden w-72 shrink-0 flex-col gap-2 border-r bg-sidebar/30 p-3 lg:flex">
          <div className="h-3 w-20 rounded bg-muted animate-pulse" />
          <div className="h-9 w-full rounded-md border bg-muted/40 animate-pulse" />
          <div className="mt-1 space-y-2">{railRow}{railRow}{railRow}{railRow}</div>
        </div>

        {/* canvas ghost — the dot grid the real canvas paints, two job cards */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-40 [background-size:24px_24px] [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)]"
          />
          <div
            aria-hidden="true"
            className="absolute top-1/4 left-[12%] w-44 space-y-2 rounded-lg border bg-card/70 p-3"
          >
            <div className="h-3.5 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-2 w-1/2 rounded bg-muted/70 animate-pulse" />
          </div>
          <div
            aria-hidden="true"
            className="absolute top-[38%] left-[42%] w-44 space-y-2 rounded-lg border bg-card/70 p-3"
          >
            <div className="h-3.5 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-2 w-1/3 rounded bg-muted/70 animate-pulse" />
          </div>
          {/* the explicit progress moment — small, central, quiet */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="size-7 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-muted-foreground/70" />
            <p className="text-sm">Loading CryoFlow…</p>
          </div>
        </div>

        {/* inspector rail ghost — w-[380px] at xl, the real panel's exact width */}
        <div className="hidden w-[380px] shrink-0 flex-col gap-4 border-l bg-card/40 p-4 xl:flex">
          <div className="h-5 w-44 rounded bg-muted animate-pulse" />
          {panelRow}{panelRow}{panelRow}
        </div>
      </div>

      {/* footer ghost — min-h-9, the real footer's exact height */}
      <div className="flex min-h-9 shrink-0 items-center justify-between border-t px-4">
        <div className="h-3 w-48 rounded bg-muted animate-pulse" />
        <div className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
      </div>
    </div>
  );
}

export default function Home() {
  return <AppShell />;
}
