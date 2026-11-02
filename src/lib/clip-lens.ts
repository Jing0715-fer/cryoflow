/**
 * clip-lens — the 3D clip's SESSION MEMORY (t1034 — the lens seat).
 *
 * The clip work used to die with the dialog: MolViewer remounts the embed
 * on every open (the pre-warm doctrine), so a slab hunted down over
 * minutes of scrubbing evaporated the moment the dialog closed — only an
 * EXPLICIT bookmark (a user-created asset, localStorage + server mirror)
 * could carry it. The lens is the missing middle tier: the clip state the
 * user LEFT the viewer in, remembered per map for as long as the tab
 * lives, restored without a single click.
 *
 * The storage doctrine is the viewport memory's (store.ts, Task 99):
 *   - sessionStorage — lives exactly as long as the tab: a reload (F5)
 *     keeps the clip, closing the tab burns it. Never localStorage (that
 *     tier is the bookmarks' — the explicit saves), never a cross-tab
 *     leak (a second tab opens the map unclipped, its own lens).
 *   - every entry is SHAPE-CHECKED on the way in and on the way out —
 *     corrupted or stale-shaped data is dropped, not trusted.
 *   - writes debounce (400 ms trailing) — the intent appliers fire per
 *     drag frame and sessionStorage IO is synchronous; the disk sees ONE
 *     write per gesture.
 *   - the #13 law: the write rides the INTENT appliers (event-handler
 *     paths — sliders, toggles, keyboard verbs, bookmark restores), never
 *     an effect or a render.
 *
 * The lens speaks the embed's own state languages verbatim (the
 * one-grammar law at the memory seat): the scalar/box clip pair exactly
 * as clipStateRef holds it, the oblique cut exactly as obliqueClipRef
 * holds it — no re-derivation, no dialect conversion. Restore is the
 * bookmark path's own dialect (applyClipIntent + applyObliqueClipIntent),
 * so the sliders, the flip button, the readouts, the wireframe and the
 * 2D tiles all adopt the recalled state through the same commit paths
 * that serve every other intent.
 *
 * Priority at open (the explicit always beats the remembered):
 * the subvolume handoff (initialClipBox — the "show in parent" door)
 * stands the lens down for that mount, and a shared / deep-linked view
 * lands after the lens (its fetch sits between the two restores) and
 * overwrites it — both explicit paths re-write the lens with the arriving
 * state, so the lens always mirrors what the user LAST left on screen.
 *
 * The automatic memory owes an explicit way out: forgetClipLens (t1035)
 * drops one map's entry on the user's verb — the screen keeps its clip,
 * the memory starts fresh, and the panel's lens chip is the face that
 * makes the silent tier visible (and forgettable) while it holds.
 *
 * t1037 — the memory's second reach: the CROSS-MAP CARRY. The lens keys
 * per map (a jobId|path pair), so a slab hunted down on the full map was
 * invisible the moment the half-map opened — the explicit bookmark tier
 * could carry it cross-job, but the automatic tier stopped at the map's
 * own key. crossMapLensOffer scans the SAME job's other keys for live
 * entries (the all-off whisper never offers — the t1034 law) and the
 * embed's apply verb adopts the sibling's geometry through the SAME
 * commit paths as every other intent, after which it is this map's own
 * remembered state. No new storage dialect: the offer READS the v1
 * record and writes nothing.
 */

import { normalizeInterval } from "@/lib/clip-interval";

/** the oblique cut's memory — the embed's obliqueClipRef verbatim */
export interface ClipLensOblique {
  on: boolean;
  theta: number; // 0…180
  phi: number; // 0…360
  offset: number; // −1…1
  invert: boolean;
}

/** one map's remembered clip — the embed's clipStateRef (minus the local
 *  rev counter, a change-detection detail that must never travel) plus
 *  the oblique cut, one entry per map identity */
export interface ClipLensEntry {
  on: boolean;
  x: number;
  y: number;
  z: number;
  invert: boolean;
  box: { lo: [number, number, number]; hi: [number, number, number] } | null;
  oblique: ClipLensOblique;
}

export const CLIP_LENS_KEY = "cryoflow.clipLens.v1";

/** trailing-debounce window for the sessionStorage flush (the viewport
 *  memory's own figure — one write per gesture, not per drag frame) */
export const CLIP_LENS_PERSIST_MS = 400;

/** The lens's identity is the MAP, not the job: one job can carry several
 *  maps (a half-map beside the full map), and clip fractions belong to the
 *  grid they were scrubbed on — a jobId-only key would dress one map in
 *  another's geometry. jobId has no "|" (a cuid); workdir-relative paths
 *  carry no "|" either, so the pair joins losslessly. */
export function clipLensKeyOf(jobId: string, path: string): string {
  return `${jobId}|${path}`;
}

const isBool = (v: unknown): v is boolean => v === true || v === false;

/** a single fraction is the degenerate interval — the clamp is the t905
 *  law's own mouth (normalizeInterval clamps to [0,1] and an equal pair
 *  never swaps), never a hand-copied Math.min/Math.max chain */
const frac01 = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? normalizeInterval(v, v)[0] : null;

const clampNum = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const saneOblique = (v: unknown): ClipLensOblique | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isBool(o.on) || !isBool(o.invert)) return null;
  const theta = typeof o.theta === "number" && Number.isFinite(o.theta) ? clampNum(o.theta, 0, 180) : null;
  const phi = typeof o.phi === "number" && Number.isFinite(o.phi) ? clampNum(o.phi, 0, 360) : null;
  const offset = typeof o.offset === "number" && Number.isFinite(o.offset) ? clampNum(o.offset, -1, 1) : null;
  return theta === null || phi === null || offset === null
    ? null
    : { on: o.on, theta, phi, offset, invert: o.invert };
};

/** Shape-check one stored entry. Clamps what clamps honestly (fractions to
 *  [0,1], the oblique angles to their dials, a crossed box pair back to
 *  the sorted kept region), refuses what does not — the return IS the
 *  gate: null drops the entry, never trusts it. */
export function saneClipLens(v: unknown): ClipLensEntry | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  if (!isBool(e.on) || !isBool(e.invert)) return null;
  const x = frac01(e.x);
  const y = frac01(e.y);
  const z = frac01(e.z);
  if (x === null || y === null || z === null) return null;
  let box: ClipLensEntry["box"];
  if (e.box === null) {
    box = null; // the scalar language — a valid shape, remembered as-is
  } else if (e.box && typeof e.box === "object") {
    const b = e.box as Record<string, unknown>;
    if (!Array.isArray(b.lo) || !Array.isArray(b.hi) || b.lo.length !== 3 || b.hi.length !== 3) return null;
    const lo: [number, number, number] = [0, 0, 0];
    const hi: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const l = frac01(b.lo[i]);
      const h = frac01(b.hi[i]);
      if (l === null || h === null) return null;
      // the crossed pair sorts — the kept region never lies (t905)
      lo[i] = normalizeInterval(l, h)[0];
      hi[i] = normalizeInterval(l, h)[1];
    }
    box = { lo, hi };
  } else {
    return null;
  }
  const oblique = saneOblique(e.oblique);
  return oblique ? { on: e.on, x, y, z, invert: e.invert, box, oblique } : null;
}

type LensRecord = Record<string, ClipLensEntry>;

/** the in-RAM record — hydrated once per JS realm (the module outlives the
 *  dialog's remounts), flushed to sessionStorage on the debounce */
let ram: LensRecord | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const readStore = (): LensRecord => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(CLIP_LENS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: LensRecord = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = saneClipLens(v);
      if (entry) out[k] = entry; // corrupted or stale-shaped — dropped, not trusted
    }
    return out;
  } catch {
    return {}; // private mode / corrupt JSON — the lens starts empty
  }
};

const ensureRam = (): LensRecord => {
  if (ram === null) ram = readStore();
  return ram;
};

const scheduleFlush = (): void => {
  if (typeof window === "undefined") return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      window.sessionStorage.setItem(CLIP_LENS_KEY, JSON.stringify(ram ?? {}));
    } catch {
      /* private mode / quota — the lens stays in-RAM, a reload just forgets */
    }
  }, CLIP_LENS_PERSIST_MS);
};

/** The remembered clip for this map, or null. Re-checked on the way out —
 *  defense in depth on top of the hydrate-time check. */
export function readClipLens(jobId: string, path: string): ClipLensEntry | null {
  const hit = ensureRam()[clipLensKeyOf(jobId, path)];
  return hit ? saneClipLens(hit) : null;
}

/** Record the clip state an intent just produced. An unsane state never
 *  enters the lens — the write is the same gate the read trusts. */
export function writeClipLens(jobId: string, path: string, entry: ClipLensEntry): void {
  const sane = saneClipLens(entry);
  if (!sane) return;
  ensureRam()[clipLensKeyOf(jobId, path)] = sane;
  scheduleFlush();
}

/**
 * t1036 — the recall's honest voice.
 *
 * The t1034 recall toast spoke ONE name — "Clip recalled" — for every
 * live geometry the lens brings back. But the lens's entry carries TWO
 * families the UI names differently: the clip planes (the violet panel's
 * own vocabulary) and the oblique 3D cut (the ✂ chip's). A session that
 * left ONLY the cut on heard the clip's name over the cut's return —
 * the honest-name arc's missed face (t1005's census, the viewer wing).
 *
 * The voice is a PURE lib seat: the embed's effect reads the entry and
 * speaks whatever this answers — one mouth for the recall's words, the
 * same law the wall faces and the refusal names ride. The four branches
 * are the whole truth table:
 *   - nothing live  → null (the t1034 whisper law: geometry remembered
 *     under an off toggle is a whisper, not news — the caller stays
 *     silent, no toast, no write)
 *   - clip + cut    → "Clip recalled", both named in the description
 *   - clip only     → "Clip recalled", the t1034 words verbatim
 *   - cut only      → "3D cut recalled", the cut's own name and words
 */
export function clipRecallVoice(saved: ClipLensEntry): { title: string; description: string } | null {
  const clipLive = saved.on === true;
  const cutLive = saved.oblique.on === true;
  if (!clipLive && !cutLive) return null;
  if (clipLive && cutLive) {
    return {
      title: "Clip recalled",
      description: "The clip planes and the 3D cut you shaped earlier in this tab are back.",
    };
  }
  if (clipLive) {
    return {
      title: "Clip recalled",
      description: "The cross-section you shaped earlier in this tab is back.",
    };
  }
  return {
    title: "3D cut recalled",
    description: "The 3D cut you left on this map earlier in this tab is back.",
  };
}

/** t1035 — the lens's EXPLICIT door: forget this map's remembered clip.
 *
 * The lens is automatic (that is its whole point — no click carries the
 * work across an open), so it owes the user an equally explicit way out:
 * one verb that drops the map's entry and leaves nothing behind. The
 * clip on SCREEN stays as it is — this speaks to the MEMORY, never the
 * scene; the next intent re-records (the memory restarts), which is the
 * honest semantics of a forget-me-not.
 *
 * Mechanics the debounce cannot be trusted with: a forget is an explicit
 * user act, not a drag frame — the pending trailing flush (if any) is
 * RETIRED and the post-drop record flushes NOW. A forget that waited for
 * the debounce could ride behind a reload (or a fast dialog close) and
 * never land; the drop must be on the disk before the verb returns.
 *
 * Returns whether an entry actually existed — the caller's toast gate
 * speaks only when something was really forgotten (the honest-silence
 * law: a forget of nothing is a whisper, not news). */
export function forgetClipLens(jobId: string, path: string): boolean {
  const key = clipLensKeyOf(jobId, path);
  const rec = ensureRam();
  if (!(key in rec)) return false; // a forget of nothing — the whisper: no drop, no write, the pending flush keeps its own schedule
  delete rec[key];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(CLIP_LENS_KEY, JSON.stringify(rec));
    } catch {
      /* private mode / quota — the RAM drop stands; a reload just forgets */
    }
  }
  return true;
}

/**
 * t1037 — the cross-map offer: a SIBLING map's live remembered clip.
 *
 * The lens keys per map, so its memory was a one-map memory: a slab
 * shaped on the full map never reached the half-map open — the QC pair
 * (the same slab on both maps, the agreement story FSC tells) had to
 * walk the explicit bookmark tier to carry four clicks' worth of
 * geometry. This scan is the automatic tier's second reach: read the
 * record, keep the SAME job's other keys whose entries speak live
 * geometry (clipRecallVoice's null IS the all-off whisper — an offer of
 * nothing is a lie the t1034 law forbids), and return ONE offer.
 *
 * The pick is deterministic: alphabetical by path, the stable order the
 * census itself greps by (run_class001 sorts before its half-maps — the
 * canonical QC source leads). The count travels so the face can say
 * "and more" honestly without minting a second row. The label is the
 * map's basename — unless the job's live siblings collide on one (two
 * directories, same filename), where the parent segment joins so the
 * row never names two maps with one word.
 *
 * Pure read: the record is scanned, never written — the offer is the
 * lens's mouth, not a mutation.
 */
export interface ClipLensOffer {
  path: string; // the sibling's map path (the record key's own half)
  label: string; // the sibling's spoken name — basename, de-collided
  entry: ClipLensEntry; // the sibling's live remembered state
  count: number; // how many siblings hold live memory (1 = just this one)
}

export function crossMapLensOffer(jobId: string, ownPath: string): ClipLensOffer | null {
  if (typeof window === "undefined") return null;
  const rec = ensureRam();
  const prefix = `${jobId}|`;
  const live: { path: string; entry: ClipLensEntry }[] = [];
  for (const [k, v] of Object.entries(rec)) {
    if (!k.startsWith(prefix)) continue;
    const p = k.slice(prefix.length);
    if (p === ownPath) continue;
    const entry = saneClipLens(v);
    if (!entry) continue; // corrupted or stale-shaped — the read's own gate
    if (clipRecallVoice(entry) === null) continue; // the all-off whisper offers nothing
    live.push({ path: p, entry });
  }
  if (live.length === 0) return null;
  live.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  // the label's honesty: basenames that collide inside one offer set grow
  // the parent segment, so two directories never share one spoken name
  const base = (p: string): string => p.split("/").pop() || p;
  const bases = new Map<string, number>();
  for (const l of live) bases.set(base(l.path), (bases.get(base(l.path)) ?? 0) + 1);
  const labelOf = (p: string): string => {
    const b = base(p);
    if ((bases.get(b) ?? 0) <= 1) return b;
    const segs = p.split("/");
    return segs.length >= 2 ? `${segs[segs.length - 2]}/${b}` : b;
  };
  const chosen = live[0];
  return { path: chosen.path, label: labelOf(chosen.path), entry: chosen.entry, count: live.length };
}

/**
 * t1037 — the carry's honest voice: what the embed says when the
 * sibling's geometry lands HERE. The voice-seat law (t1036 F2) at the
 * carry's seat: the words live in the lib, the component speaks through
 * them — and the family naming follows the same truth table the recall
 * speaks (clip planes, 3D cut, both), because a cut-only carry must
 * never hear the clip's name over the ✂'s work. The sibling's label
 * rides in every description — the carry names WHERE the geometry came
 * from, the honesty the plain recall never owed (its source was the
 * map's own past). The title speaks the carry's own verb ("carried") —
 * the recall's "recalled" stays the own-memory's word; one verb per
 * act, the vocabulary grows by one honest word, not by blur.
 */
export function clipCarryVoice(
  label: string,
  entry: ClipLensEntry
): { title: string; description: string } | null {
  const clipLive = entry.on === true;
  const cutLive = entry.oblique.on === true;
  if (!clipLive && !cutLive) return null; // the carry never speaks a whisper
  if (clipLive && cutLive) {
    return {
      title: "Clip carried",
      description: `The clip planes and the 3D cut remembered for ${label} now shape this map — remembered for this map too.`,
    };
  }
  if (clipLive) {
    return {
      title: "Clip carried",
      description: `The cross-section remembered for ${label} now shapes this map — remembered for this map too.`,
    };
  }
  return {
    title: "3D cut carried",
    description: `The 3D cut remembered for ${label} now opens this map — remembered for this map too.`,
  };
}
