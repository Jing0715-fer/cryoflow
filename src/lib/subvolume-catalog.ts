/**
 * The sub-volume crop catalog's PURE well (t892 — the shelf's math and
 * shape laws): no fs, no db, no clock — numbers in, numbers out.
 *
 * The 3D viewer's send-to-new-job (t255) materializes each kept box as a
 * real .mrc in the parent job's SubVolumes/ folder, and the MRC header
 * contract (src/lib/mrc.ts) makes every crop self-describing: `start`
 * carries "where do I sit in the map I was cut from" (the parent start +
 * the box offset, so a crop of a crop answers in the GRANDPARENT's voxel
 * space) and nx/ny/nz carry the box's own dims. This well turns that
 * geometry into the two faces the shelf needs:
 *
 *   · cropBoxFractions — the re-anchor math: a listed crop becomes the
 *     [lo,hi] fraction box the viewer's applyClipBoxIntent already speaks
 *     (the t260 anchored-box law — wireframe, 2D tiles and export/send all
 *     follow), expressed in the PARENT FILE's voxel space (crop.start
 *     minus the parent file's own start, over the parent's dims);
 *   · sortCrops — the shelf's order: newest first, capped (a shelf, not
 *     an archive — the Files tab remains the full listing);
 *   · cropParentName — the provenance line (t893): which shelf sibling a
 *     crop-of-crop was cut from, spoken only when TWO INDEPENDENT
 *     witnesses agree (the law below).
 *
 * The laws:
 *   - null is the honest "no answer": a crop whose box lies outside the
 *     parent (a stale crop of a different map, or a renamed world) has NO
 *     re-anchor geometry — the shelf shows the row and withholds the
 *     action, it never guesses a box;
 *   - fractions clamp to [0,1] and refuse hi <= lo (a degenerate box is
 *     not a box);
 *   - the same bytes answer the same, every time (node-runnable — the
 *     unit seat rides jiti without a browser).
 */

export interface SubvolumeCrop {
  /** file name inside the job's SubVolumes/ folder */
  name: string;
  /** workdir-relative path (`SubVolumes/<name>`) — the Files tab's tongue */
  rel: string;
  /** the crop's own grid dims (header nx/ny/nz) */
  dims: [number, number, number];
  /** the crop's voxel offset in the map it was cut from (header start —
   *  the GRANDPARENT's space when the parent is itself a crop) */
  start: [number, number, number];
  /** file size in bytes (the stat's honesty beside the header's geometry) */
  bytes: number;
  mtimeMs: number;
}

/** The parent map's own header geometry — the piece the client cannot see
 *  (molstar speaks the grid's dims but never the file's start fields). */
export interface ParentMapGeometry {
  dims: [number, number, number];
  start: [number, number, number];
}

/** The anchored-box shape the viewer's applyClipBoxIntent speaks. */
export interface FractionBox {
  lo: [number, number, number];
  hi: [number, number, number];
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * The re-anchor math: where does this crop sit inside the PARENT FILE the
 * viewer is showing? `crop.start` answers in the grandparent's voxel space
 * (readMrcSubvolume writes parent start + box offset), so the box offset
 * inside the parent file is `crop.start - parent.start`, and the fractions
 * are that offset over the parent's dims. Returns null when the crop's box
 * does not lie inside the parent (stale world) or the numbers degenerate —
 * the shelf withholds the anchor action, it never anchors a guessed box.
 */
export function cropBoxFractions(
  crop: Pick<SubvolumeCrop, "dims" | "start">,
  parent: ParentMapGeometry
): FractionBox | null {
  const lo: [number, number, number] = [0, 0, 0];
  const hi: [number, number, number] = [0, 0, 0];
  for (let a = 0 as 0 | 1 | 2; a < 3; a = (a + 1) as 0 | 1 | 2) {
    const pd = parent.dims[a];
    const off = crop.start[a] - parent.start[a];
    if (!Number.isFinite(pd) || pd <= 0) return null;
    if (!Number.isFinite(off) || off < 0 || off + crop.dims[a] > pd) return null;
    if (!Number.isFinite(crop.dims[a]) || crop.dims[a] <= 0) return null;
    lo[a] = clamp01(off / pd);
    hi[a] = clamp01((off + crop.dims[a]) / pd);
    if (hi[a] <= lo[a]) return null;
  }
  return { lo, hi };
}

/**
 * The shelf's order and cap: newest first (mtime desc), at most `cap`
 * rows — the Files tab remains the full listing; the shelf is a working
 * surface, not an archive. Ties keep the name's order (a stable sort's
 * honest tie-break, no second key invented).
 */
export function sortCrops(crops: SubvolumeCrop[], cap = 24): SubvolumeCrop[] {
  return [...crops].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, cap);
}

/**
 * The provenance line's witness law (t893 — the crop chain's next half):
 * a crop's header proves GEOMETRY but cannot prove WHO it was cut from
 * (the bytes of "cut from the map" and "cut from a crop at the same spot"
 * are identical), so the cut edge needs a second witness — and the
 * writer's own naming convention minted one. `readMrcSubvolume`'s callers
 * name every crop `<parent stem>_crop_<ox>-<ox+sx>_<oy>-<oy+sy>_<oz>-<oz+sz>.mrc`
 * where the offsets answer in the CUT-FROM FILE's own grid. Two witnesses,
 * each independent of the other:
 *
 *   · the NAME (the stem chain): everything before the LAST `_crop_`
 *     marker is the parent file's name — a chain of two crops carries the
 *     parent's whole `_crop_…` name inside its own;
 *   · the HEADERS (the start arithmetic): `crop.start − parent.start`
 *     must equal the name's offsets (both starts ride the grandparent's
 *     frame — the difference cancels it), and the box must fit inside the
 *     parent's own dims.
 *
 * The line speaks only when BOTH agree; every disagreement is an honest
 * null, never a guess:
 *   · no `_crop_` marker, or the offsets segment unparsable/mismatched
 *     with the crop's own dims — the name is prose-broken;
 *   · the stem names no shelf sibling (a DIRECT crop of the map: its
 *     "parent" is the map itself, not a row on the shelf — the common
 *     case stays unmarked, noise down; or a renamed/deleted parent —
 *     the chain's witness is gone);
 *   · the start arithmetic disagrees with the name — the two witnesses
 *     contradict, and neither is trusted alone.
 *
 * Frame-free by construction: only start DIFFERENCES and the parent's
 * own dims appear, so the map's geometry (even `parent: null`) is never
 * needed. O(shelf) — one pass over the sibling list, 24 cap.
 */
export function cropParentName(
  crop: Pick<SubvolumeCrop, "name" | "dims" | "start">,
  siblings: ReadonlyArray<Pick<SubvolumeCrop, "name" | "dims" | "start">>
): string | null {
  const marker = "_crop_";
  const last = crop.name.lastIndexOf(marker);
  if (last < 0) return null;
  // the offsets segment: "<ox>-<ox+sx>_<oy>-<oy+sy>_<oz>-<oz+sz>.mrc"
  const suffix = crop.name.slice(last + marker.length);
  if (!suffix.endsWith(".mrc")) return null;
  const segs = suffix.slice(0, -4).split("_");
  if (segs.length !== 3) return null;
  const offsets: [number, number, number] = [0, 0, 0];
  for (let a = 0 as 0 | 1 | 2; a < 3; a = (a + 1) as 0 | 1 | 2) {
    const seg = segs[a];
    const dash = seg.indexOf("-");
    if (dash <= 0) return null;
    const lo = Number(seg.slice(0, dash));
    const hi = Number(seg.slice(dash + 1));
    if (!Number.isInteger(lo) || !Number.isInteger(hi)) return null;
    if (hi - lo !== crop.dims[a]) return null; // the name must match the header's dims
    offsets[a] = lo;
  }
  const parentName = `${crop.name.slice(0, last)}.mrc`;
  if (parentName === crop.name) return null; // a self-named chain is no chain
  const parent = siblings.find((s) => s.name === parentName);
  if (!parent) return null; // direct crop of the map, or the witness left the shelf
  for (let a = 0 as 0 | 1 | 2; a < 3; a = (a + 1) as 0 | 1 | 2) {
    if (crop.start[a] - parent.start[a] !== offsets[a]) return null;
    if (offsets[a] + crop.dims[a] > parent.dims[a]) return null; // outside the parent's own grid
  }
  return parentName;
}
