"use client";

/**
 * Task 257 — the reference wears its face.
 *
 * t256 gave the IMPORT MAP's own Results view an identity card; t257 gives
 * the CONSUMER side the same story: a class3d/refine3d job eating a
 * reference map shows what that reference IS (grid, voxel spacing, density
 * stats, sub-volume anchor) and WHERE it came from (a crop sent from the
 * 3D viewer, a standalone import, or an upstream model job) — read from
 * the provider's own outputs, the same data plane the t256 card rides
 * (zero new server I/O: the outputs route already mirrors the MrcHeader
 * read it already did).
 *
 * Resolution: the consumer's `--ref` input path (parsed from its run cmd)
 * is matched against the CANDIDATE PROVIDERS' output listings — candidates
 * are the graph edges pointing volume-ish ports into this job's reference
 * input. The match is by exact path (provider workdir + relative file
 * path), with a basename+dims fallback for relocated links. One provider
 * owns any given path, so the first hit is THE provider.
 *
 * Honest absence: no --ref input → the card does not render at all; a
 * --ref that no provider's listing explains renders the slim path-only
 * state ("identity unresolved") — the reader is told the path even when
 * the story behind it isn't on disk (yet).
 */

import * as React from "react";
import { Box, CornerDownRight, Crop } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { jobType } from "@/lib/workflow";
import type { JobDTO } from "@/lib/types";
import { TypeIcon } from "./icons";
import { MolViewer, type MolViewerTarget } from "./results/mol-viewer";
import { useAnchorParent } from "./results/anchor-parent";
import { formatStat, mapSourceNote } from "./results/results-view";

/** Minimal slice of the outputs listing the card needs. */
interface RefFile {
  path: string;
  name: string;
  kind: string;
  dims?: [number, number, number];
  map?: {
    origin: [number, number, number];
    pixel: number;
    dmin: number;
    dmax: number;
    dmean: number;
    rms: number;
  };
}

interface RefOutputs {
  workdir: string | null;
  files?: RefFile[];
}

/** Output ports a reference can legally arrive through (mapimport's
 *  model_mrc, initialmodel/class3d's model, refine3d's map). Particles and
 *  half-map edges are never the reference — they don't get fetched. */
const REF_PORTS = new Set(["model_mrc", "model", "map"]);

function joinPath(dir: string, rel: string): string {
  const d = dir.replace(/\/+$/, "");
  return `${d}/${rel.replace(/^\/+/, "")}`;
}

function baseName(p: string): string {
  return p.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? p;
}

export function ReferenceMapCard({ job, refPath }: { job: JobDTO; refPath: string | null }) {
  const edges = useWorkflowStore((s) => s.edges);
  const jobs = useWorkflowStore((s) => s.jobs);
  const [resolved, setResolved] = React.useState<{
    providerId: string;
    file: RefFile;
  } | null>(null);
  const [searched, setSearched] = React.useState(false);
  // t258 — the card's own Mol* dialog. It mounts (closed) as soon as the
  // card has a resolved, viewable map: that moment is the 3D intent the
  // pre-warm in MolViewer wants, and it lets the button flip open the
  // dialog with zero first-click compilation cost. t260 — the dialog
  // opens on a TARGET (which job's map + optional anchored clip box), so
  // "show in parent" can aim it at the PARENT's map through the same
  // instance.
  const [viewTarget, setViewTarget] = React.useState<MolViewerTarget | null>(null);
  const cardRef = React.useRef<HTMLElement | null>(null);

  const candidateIds = React.useMemo(
    () =>
      edges
        .filter((e) => e.toJobId === job.id && REF_PORTS.has(e.fromPort ?? ""))
        .map((e) => e.fromJobId),
    [edges, job.id]
  );
  const candidateKey = candidateIds.join("|");

  React.useEffect(() => {
    if (!refPath || candidateIds.length === 0) {
      setResolved(null);
      setSearched(!refPath); // no refPath = the card is gone anyway
      return;
    }
    let alive = true;
    setResolved(null);
    setSearched(false);
    (async () => {
      for (const pid of candidateIds) {
        try {
          const res = await fetch(`/api/jobs/${pid}/outputs`, { cache: "no-store" });
          if (!res.ok) continue;
          const data = (await res.json()) as RefOutputs;
          const wd = data.workdir ?? "";
          const files = data.files ?? [];
          // exact match first: the provider's own listing explains the path
          let hit =
            wd && refPath
              ? files.find((f) => joinPath(wd, f.path) === refPath.replace(/\/+$/, ""))
              : undefined;
          // fallback: a relocated copy with the same name that carries a map
          if (!hit) {
            hit = files.find((f) => f.dims && f.map && f.name === baseName(refPath!));
          }
          if (hit && alive) {
            setResolved({ providerId: pid, file: hit });
            setSearched(true);
            return;
          }
        } catch {
          // the provider may not even be listed yet — keep scanning
        }
      }
      if (alive) setSearched(true);
    })();
    return () => {
      alive = false;
    };
    // candidateKey is the stable identity of the candidate list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, refPath, candidateKey]);

  const provider = resolved ? jobs.find((j) => j.id === resolved.providerId) : undefined;
  const map = resolved?.file.map;
  const dims = resolved?.file.dims;
  const anchored = map ? !map.origin.every((v) => v === 0) : false;
  const viewable = Boolean(provider && resolved && map && dims);

  // t260 — the reference came from a crop: resolve the crop's PARENT (the
  // provider's own incoming edges + the geometric box check) so the card
  // can offer "show in parent" — the reference story walked back to its
  // origin. Hooks order: the resolver runs BEFORE any early return, silent
  // (null ids) when the crop story isn't there (standalone imports,
  // model-job providers, no --ref at all).
  const parentOfCrop = useAnchorParent(
    provider && provider.type === "mapimport" && anchored && map && dims
      ? provider.id
      : null,
    map && dims && anchored
      ? { start: [...map.origin] as [number, number, number], size: [...dims] as [number, number, number] }
      : null
  );
  const cropBox: MolViewerTarget["box"] =
    map && dims && anchored
      ? { start: [...map.origin] as [number, number, number], size: [...dims] as [number, number, number] }
      : null;

  if (!refPath) return null;

  // provenance: an Import Map speaks through its mapPath param (the same
  // parser the t256 identity card uses); a model job speaks through what
  // it is. The link opens the provider in this inspector.
  let provenance: React.ReactNode = null;
  if (provider) {
    if (provider.type === "mapimport") {
      const mapPath = String(provider.params?.mapPath ?? "");
      const source = mapPath ? mapSourceNote(mapPath) : null;
      if (source?.kind === "crop") {
        provenance = (
          <>
            crop of <span className="font-mono text-foreground/80" title={mapPath}>{source.label}</span>,
            sent from the 3D viewer.
          </>
        );
      } else {
        provenance = <>picked from the file browser.</>;
      }
    } else {
      const spec = jobType(provider.type);
      provenance = (
        <>
          produced by the{" "}
          <span className="text-foreground/80">{spec?.label ?? provider.type}</span> job{" "}
          <span className="font-mono text-foreground/80">{provider.name}</span>.
        </>
      );
    }
  }

  return (
    <section
      ref={cardRef}
      aria-label="Reference map"
      data-canvas-ui="reference-map"
      data-print-atomic=""
      tabIndex={-1}
      className="rounded-xl border border-teal-600/30 bg-teal-600/[0.04] p-4 outline-none"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
          <Box className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden="true" />
          Reference map
        </h4>
        {provider ? (
          <button
            type="button"
            data-testid="reference-provider-chip"
            onClick={() => useWorkflowStore.getState().inspect(provider.id)}
            title={`Open the provider job "${provider.name}"`}
            className="flex min-w-0 items-center gap-1 rounded-full border border-teal-600/25 bg-teal-600/10 px-2 py-0.5 text-[10px] font-semibold text-teal-700 transition-colors hover:bg-teal-600/20 dark:text-teal-300"
          >
            <TypeIcon
              name={jobType(provider.type)?.icon ?? "Box"}
              className="h-3 w-3 shrink-0"
            />
            <span className="max-w-[16rem] truncate">{provider.name}</span>
            <CornerDownRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {resolved && map && dims ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className="max-w-[18rem] truncate rounded-full border border-teal-600/25 bg-teal-600/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-teal-700 dark:text-teal-300"
              title={resolved.file.name}
            >
              {resolved.file.name}
            </span>
            <span className="rounded-full border border-teal-600/25 bg-teal-600/10 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300">
              {dims.join(" × ")} vox
            </span>
            {map.pixel > 0 && (
              <span className="rounded-full border border-teal-600/25 bg-teal-600/10 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300">
                {map.pixel.toFixed(2)} Å / voxel
              </span>
            )}
            <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
              min {formatStat(map.dmin)}
            </span>
            <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
              max {formatStat(map.dmax)}
            </span>
            <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
              mean {formatStat(map.dmean)}
            </span>
            {map.rms > 0 && (
              <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                σ {formatStat(map.rms)}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {anchored ? (
              <>
                Sub-volume anchor at{" "}
                <span className="font-mono text-foreground/80">({map.origin.join(", ")})</span>{" "}
                voxels in the parent map —{" "}
              </>
            ) : null}
            {provenance}
          </p>

          {/* t258/t260 — the doors: "View in 3D" opens the reference itself;
              "Show in parent" (crop references only) opens the PARENT's
              map with the clip planes anchored on the reference's box.
              Same outline-teal secondary-action language as the t256 card;
              the parent door speaks violet — the clip's own colour. */}
          {viewable && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="reference-view-3d"
                onClick={() =>
                  setViewTarget({ job: provider!, path: resolved!.file.path, name: resolved!.file.name })
                }
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-teal-600/40 px-2.5 text-[11px] font-medium text-teal-700 transition-colors hover:bg-teal-600/10 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200"
              >
                <Box className="h-3.5 w-3.5" aria-hidden="true" />
                View in 3D
              </button>
              {parentOfCrop && (
                <button
                  type="button"
                  data-testid="reference-show-parent"
                  onClick={() =>
                    setViewTarget({
                      job: parentOfCrop.job,
                      path: parentOfCrop.file.path,
                      name: parentOfCrop.file.name,
                      box: cropBox,
                    })
                  }
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-violet-600/40 px-2.5 text-[11px] font-medium text-violet-700 transition-colors hover:bg-violet-600/10 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200"
                >
                  <Crop className="h-3.5 w-3.5" aria-hidden="true" />
                  Show in parent
                </button>
              )}
              <span className="text-[10px] text-muted-foreground">
                {parentOfCrop
                  ? "open the parent map, clipped to this crop's box"
                  : "open the reference in the Mol* viewer"}
              </span>
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground" title={refPath}>
          {refPath.split("/").slice(-2).join("/")}
          {searched ? (
            <span className="ml-2 font-sans text-[10px]">
              — identity unresolved: the upstream job hasn&apos;t produced this map (yet)
            </span>
          ) : null}
        </p>
      )}

      {/* t258/t260 — the card's own viewer dialog. Mounted (closed) once the
          reference is resolvable to a viewable map, so MolViewer's mount-
          time pre-warm compiles the molstar chunk while the user reads the
          card, not while they wait. The dialog opens on the current TARGET
          (the reference, or the parent map through the show-in-parent
          door); restoreFocus parks on the card itself: the buttons that
          opened it live here, and the inspector's focus-outside guard
          needs a home for focus on close. */}
      {viewable && provider && resolved && (
        <MolViewer
          job={viewTarget?.job ?? provider}
          path={viewTarget?.path ?? resolved.file.path}
          name={viewTarget?.name ?? resolved.file.name}
          open={viewTarget !== null}
          onOpenChange={(o) => !o && setViewTarget(null)}
          restoreFocusRef={cardRef}
          initialClipBox={viewTarget?.box ?? null}
        />
      )}
    </section>
  );
}
