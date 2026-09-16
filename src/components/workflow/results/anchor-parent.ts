"use client";

/**
 * Task 260 — the anchor box's way home.
 *
 * The t256/t257 cards KNOW a map is a sub-volume crop (the header's start
 * fields, surfaced as `map.origin`); t258 let the cards open the crop
 * itself in Mol*. But the crop's story lives in the PARENT: "show me
 * where this crop came from" means opening the parent's map with the clip
 * box anchored exactly on the crop's box. This hook resolves that parent.
 *
 * Resolution (client-side, same graph-walking doctrine as the t257 card):
 *  1. candidates = graph edges pointing INTO the import job (t255's send
 *     route wires parent→import; a hand-wired edge works identically),
 *  2. each candidate's outputs listing is fetched (the t256 data plane —
 *     zero new server I/O),
 *  3. the parent's volume file must GEOMETRICALLY contain the crop's box:
 *     dims[axis] ≥ origin[axis] + size[axis] on every axis. A foreign or
 *     half-/mask volume never passes, so no name heuristics decide alone.
 *
 * Chain safety: MRC start fields chain ACROSS generations (readMrcSubvolume
 * writes parent-start + box-offset), so a crop of a crop carries its
 * grandparent's coordinates. The door only opens when the parent's own
 * start is zero — otherwise the box would anchor in the wrong frame, and
 * an honestly absent door beats a lying one.
 */

import * as React from "react";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO } from "@/lib/types";

/** The crop's box, in the parent's voxel frame — exactly what the MRC
 *  header's start fields + the crop's own dims record. */
export interface AnchorBox {
  start: [number, number, number];
  size: [number, number, number];
}

export interface AnchorParent {
  job: JobDTO;
  /** the parent's map file, path RELATIVE to the parent's workdir — the
   *  exact contract MolViewer's `path` prop speaks */
  file: { path: string; name: string; dims: [number, number, number] };
}

/** what the async resolution actually produces before the store lookup
 *  turns the id into a job object */
interface ResolvedParent {
  jobId: string;
  file: { path: string; name: string; dims: [number, number, number] };
}

interface ParentFile {
  path: string;
  name: string;
  kind: string;
  dims?: [number, number, number];
  map?: { origin: [number, number, number] };
}

/** contains(box, parent): the parent grid must hold the whole box. */
function contains(parent: ParentFile, box: AnchorBox): boolean {
  if (!parent.dims || parent.kind !== "mrc") return false;
  // chain safety — a parent with its own non-zero start would shift the
  // crop's coordinates into another frame; the door stays silent instead
  if (parent.map && !parent.map.origin.every((v) => v === 0)) return false;
  // half-maps and masks share the parent's grid but are not the map the
  // crop was cut from; .mrcs stacks are movies, not volumes
  if (/half|mask|mrcs/i.test(parent.name)) return false;
  return parent.dims.every((d, i) => d >= box.start[i] + box.size[i]);
}

/**
 * Resolve the parent job + map file for a crop's anchor box.
 *
 * @param importJobId the mapimport job whose map is the crop (null = the
 *        caller hasn't confirmed the crop story — the hook stays silent)
 * @param box the crop's anchor box in parent voxels (null likewise silent)
 */
export function useAnchorParent(
  importJobId: string | null,
  box: AnchorBox | null
): AnchorParent | null {
  const edges = useWorkflowStore((s) => s.edges);
  const jobs = useWorkflowStore((s) => s.jobs);
  const [resolved, setResolved] = React.useState<ResolvedParent | null>(null);

  const candidateIds = React.useMemo(
    () =>
      importJobId
        ? edges.filter((e) => e.toJobId === importJobId).map((e) => e.fromJobId)
        : [],
    [edges, importJobId]
  );
  const candidateKey = candidateIds.join("|");

  React.useEffect(() => {
    if (!importJobId || !box || candidateIds.length === 0) {
      setResolved(null);
      return;
    }
    let alive = true;
    setResolved(null);
    (async () => {
      for (const pid of candidateIds) {
        try {
          const res = await fetch(`/api/jobs/${pid}/outputs`, { cache: "no-store" });
          if (!res.ok) continue;
          const data = (await res.json()) as { files?: ParentFile[] };
          const hit = (data.files ?? []).find((f) => contains(f, box));
          if (hit && hit.dims && alive) {
            setResolved({
              jobId: pid,
              file: { path: hit.path, name: hit.name, dims: hit.dims },
            });
            return;
          }
        } catch {
          // the candidate may not be listed yet — keep scanning
        }
      }
    })();
    return () => {
      alive = false;
    };
    // candidateKey is the stable identity of the candidate list; the box
    // speaks through its joined voxel coordinates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importJobId, candidateKey, box?.start.join(","), box?.size.join(",")]);

  const job = resolved ? jobs.find((j) => j.id === resolved.jobId) : undefined;
  return resolved && job ? { job, file: resolved.file } : null;
}
