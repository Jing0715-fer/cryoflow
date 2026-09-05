"use client";

/**
 * CryoFlow — Mol* 3D map viewer dialog wrapper.
 *
 * The heavy molstar integration lives in ./molstar-embed and is loaded
 * with next/dynamic (ssr:false) so it only enters the bundle when the
 * user actually opens the 3D viewer.
 */

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { Box } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JobDTO } from "@/lib/types";

const MolStarEmbed = dynamic(() => import("./molstar-embed"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
      Preparing 3D viewer…
    </div>
  ),
});

/* ------------------------------------------------------------------ */
/* Mol* chunk pre-warm                                                 */
/* ------------------------------------------------------------------ */

/**
 * Mol* is ~2 MB of dynamic-imported modules that Turbopack compiles ON
 * FIRST OPEN — on slow disks (notoriously Windows/WSL hosts) that compile
 * alone can take minutes, which users perceive as "stuck on Loading
 * Mol*…". This component only mounts when the inspector shows a job whose
 * results include a 3D map, i.e. when the user has clear 3D intent — that
 * is the right moment to start compiling the chunk in the background:
 * by the time they click "View in 3D" it is usually cached.
 *
 * NOTE deliberately NOT module-level: pre-warming on plain page load
 * compiles a giant chunk for users who never open 3D and, on
 * memory-constrained hosts, can push the dev server into OOM territory
 * while it is still compiling the page itself.
 */
let molstarWarmStarted = false;
function warmMolstar(): void {
  if (molstarWarmStarted) return;
  molstarWarmStarted = true;
  const kick = () => {
    void import("./molstar-embed").catch(() => {
      /* warm-up failure surfaces later at real open time */
    });
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(kick, { timeout: 10_000 });
  } else {
    window.setTimeout(kick, 4_000);
  }
}

interface MolViewerProps {
  job: JobDTO;
  /** map path relative to the job workdir */
  path: string;
  /** display name for the header */
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MolViewer({ job, path, name, open, onOpenChange }: MolViewerProps) {
  // pre-warm the molstar chunk on 3D intent (this component mounting), NOT
  // on page load — see warmMolstar's doc comment
  useEffect(() => {
    warmMolstar();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* near-page-width viewer: the map is the main event, not a thumbnail.
          NOTE the duplicated max-w with the sm: variant — shadcn's base
          DialogContent carries sm:max-w-lg, and a media-query rule beats any
          same-specificity base rule in the compiled CSS, so a plain
          max-w-[…] would silently lose to 512 px on every desktop. */}
      <DialogContent className="flex h-[92vh] w-[94vw] max-w-[min(1500px,94vw)] flex-col gap-0 p-0 sm:max-w-[min(1500px,94vw)] sm:p-0">
        <DialogHeader className="shrink-0 px-6 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Box className="h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
            <span className="min-w-0 shrink truncate">{name}</span>
            <span
              className="min-w-0 flex-1 truncate font-mono text-[11px] font-normal text-muted-foreground"
              title={path}
            >
              {path}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Isosurface rendering of the MRC map — drag to rotate, scroll to zoom, adjust the contour below.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 w-full flex-1 px-6 pb-6">
          {open && <MolStarEmbed jobId={job.id} path={path} name={name} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
