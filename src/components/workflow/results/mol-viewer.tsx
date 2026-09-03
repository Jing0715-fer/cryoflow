"use client";

/**
 * CryoFlow — Mol* 3D map viewer dialog wrapper.
 *
 * The heavy molstar integration lives in ./molstar-embed and is loaded
 * with next/dynamic (ssr:false) so it only enters the bundle when the
 * user actually opens the 3D viewer.
 */

import dynamic from "next/dynamic";
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
    <div className="flex h-[70vh] items-center justify-center text-xs text-muted-foreground">
      Preparing 3D viewer…
    </div>
  ),
});

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 sm:p-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Box className="h-4 w-4 text-teal-600" aria-hidden="true" />
            {name}
            <span className="font-mono text-[11px] font-normal text-muted-foreground">{path}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Isosurface rendering of the MRC map — drag to rotate, scroll to zoom.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[70vh] w-full px-6 pb-6">
          {open && <MolStarEmbed jobId={job.id} path={path} name={name} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
