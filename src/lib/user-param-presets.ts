/**
 * CryoFlow — user-authored parameter presets (Task 713).
 *
 * The missing half of the preset family: JOB_PRESETS (lib/job-presets.ts)
 * is the CURATED face — a static, developer-written table applied at ADD
 * time from the command palette. This module is the USER face — "I tuned
 * this 2D classification's params until the classes finally separated;
 * save that exact combination so any sibling job of the same type can
 * wear it in one click." Two faces, one dialect: a preset is a params
 * object over one job type, scalar values only, spec keys only.
 *
 * STORAGE LAYER — the t712 law says ask first. These presets live in
 * localStorage (`cryoflow.user-param-presets:v1`), the same layer the
 * canvas viewport bookmarks live on and the same layer the Mol* camera
 * bookmarks mirror instantly. Since Task 715 they ALSO live on the
 * server (the camera-bookmark dual-mirror pattern): one PresetShelf row
 * behind /api/param-presets holding the WHOLE collection in this same
 * wire shape. The dialect below is unchanged — load/add/delete stay
 * sync and local (the inspector's and palette's laws don't move),
 * persist() dual-writes (local first, then a fire-and-forget PUT whose
 * failure the session shrugs off — localStorage stays the session
 * truth), and reconcileUserParamPresets() adopts the server list when
 * one exists (the shelf row's existence is the synced flag: a fresh
 * server that never saw a shelf must not be mistaken for "the user
 * deleted everything on another browser").
 *
 * APPLY SEMANTICS — a snapshot, not a diff. Saving expands the job's
 * params to a FULL spec-key snapshot (stored value when present, the
 * spec default when not), so "wear this preset" means "look exactly like
 * the job I saved" — partial presets would silently inherit the target
 * job's stray knobs and the user would never know which half came from
 * where. The server's PATCH params route merges incoming over current,
 * which gives exactly the wanted landing: every spec key replaced by the
 * preset's value, legacy keys (gallery picks, engine flags) untouched.
 *
 * The type gate is structural: a preset of type X can only be applied to
 * a job of type X (the spec keys would not match otherwise — applying a
 * ctffind snapshot to a class2d job would at best drop every key at the
 * server's scalar filter and at worst lie about having succeeded).
 */

export const USER_PARAM_PRESETS_KEY = "cryoflow.user-param-presets:v1";

/** Cross-component refresh signal — the same dialect as
 *  SAVED_VIEWS_CHANGED_EVENT (lib/view-link.ts): a custom event on window,
 *  so an inspector opened in two surfaces (or a future palette face) stays
 *  in step without a shared store slice for browser-local data. */
export const USER_PARAM_PRESETS_EVENT = "cryoflow:param-presets-changed";

export interface UserParamPreset {
  id: string;
  /** job type key (JOB_TYPES key) — the apply gate's own vocabulary */
  type: string;
  name: string;
  /** FULL spec-key snapshot (scalar values only) — see APPLY SEMANTICS */
  params: Record<string, number | string | boolean>;
  createdAt: number;
}

function isScalar(v: unknown): v is number | string | boolean {
  return typeof v === "number" || typeof v === "string" || typeof v === "boolean";
}

/** Read the whole list, oldest first. Never throws: a corrupted or
 *  foreign-shaped blob degrades to "no presets" — a convenience store
 *  must not take the inspector down with it. */
export function loadUserParamPresets(): UserParamPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USER_PARAM_PRESETS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is UserParamPreset =>
        p != null &&
        typeof p === "object" &&
        typeof (p as UserParamPreset).id === "string" &&
        typeof (p as UserParamPreset).type === "string" &&
        typeof (p as UserParamPreset).name === "string" &&
        (p as UserParamPreset).params != null &&
        typeof (p as UserParamPreset).params === "object"
    );
  } catch {
    return [];
  }
}

const SHELF_ENDPOINT = "/api/param-presets";

/** bumped on every local write — the reconcile's dirty-guard reads it so
 *  a save that happens DURING a fetch is never overwritten by the stale
 *  snapshot the fetch comes back with (the camera-bookmark dirtyRef
 *  dialect, module-scoped because this lib is module-scoped). A sequence
 *  counter, not a timestamp: two events in the same millisecond must
 *  not coalesce into "no save happened". */
let localWriteSeq = 0;

function pushShelfToServer(list: UserParamPreset[]): void {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  try {
    void window
      .fetch(SHELF_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presets: list }),
      })
      .catch(() => {
        /* offline / server down — localStorage stays the session truth;
         * the next reconcile or save re-pushes. The mirror is an
         * optimization over the local list, never a gate on it. */
      });
  } catch {
    /* fetch itself refused (CSP, privacy mode) — same shrug */
  }
}

function persist(list: UserParamPreset[]): void {
  if (typeof window === "undefined") return;
  localWriteSeq += 1;
  try {
    window.localStorage.setItem(USER_PARAM_PRESETS_KEY, JSON.stringify(list));
  } catch {
    // quota/privacy-mode refusal — the caller's UI already treats the
    // in-memory list as the truth for this session; nothing to escalate
  }
  pushShelfToServer(list);
  window.dispatchEvent(new CustomEvent(USER_PARAM_PRESETS_EVENT));
}

/** Expand a job's params to a FULL spec-key snapshot: stored value when
 *  present (scalar-checked), the spec default when not, spec keys only.
 *  `specParams` is the type's param schema (workflow.ts's ParamSchema[]). */
export function snapshotSpecParams(
  specParams: { key: string; default?: unknown }[],
  stored: Record<string, unknown> | null | undefined
): Record<string, number | string | boolean> {
  const snap: Record<string, number | string | boolean> = {};
  const src = stored ?? {};
  for (const p of specParams) {
    const raw = src[p.key];
    if (isScalar(raw)) snap[p.key] = raw;
    else if (isScalar(p.default)) snap[p.key] = p.default;
    // neither present nor a scalar default → the key does not join the
    // snapshot (a knob with no honest value has no place in a preset)
  }
  return snap;
}

export function addUserParamPreset(
  type: string,
  name: string,
  params: Record<string, number | string | boolean>
): UserParamPreset[] {
  const preset: UserParamPreset = {
    id: `upp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    name,
    params,
    createdAt: Date.now(),
  };
  const next = [...loadUserParamPresets(), preset];
  persist(next);
  return next;
}

export function deleteUserParamPreset(id: string): UserParamPreset[] {
  const next = loadUserParamPresets().filter((p) => p.id !== id);
  persist(next);
  return next;
}

/** The one public BULK write (Task 717 — the portability face): the
 *  file-import dialog computes a merged shelf with lib/preset-portability.ts
 *  (pure — no storage there) and lands it through THIS function, so the
 *  whole merged shelf rides the same single write well every other
 *  mutation uses: localStorage first, then the t715 fire-and-forget PUT,
 *  then the changed event. Import never builds a second storage path. */
export function writeUserParamPresets(list: UserParamPreset[]): UserParamPreset[] {
  persist(list);
  return list;
}

/** The presets that can legally land on this job type — the gate the UI
 *  reads; the server's spec-key filter stays the second gate regardless. */
export function presetsForType(presets: UserParamPreset[], type: string): UserParamPreset[] {
  return presets.filter((p) => p.type === type);
}

/** Adopt the server shelf into this browser — the dual-mirror's second
 *  half (Task 715). Fire-and-forget: surfaces call it on open/mount and
 *  let the changed event deliver the result. Laws:
 *  - synced:true  → the server list IS the truth (even when empty —
 *    a deletion on another browser propagates); adopt, re-seed the local
 *    mirror, announce via the changed event. Skipped silently when the
 *    server list already equals the local one (no event storms on
 *    every palette open).
 *  - synced:false → a server that never saw a shelf; the local list is
 *    the truth and nothing moves (the first local save creates the row).
 *  - fetch failed → the local list restores everything, silently.
 *  - a local write that lands DURING the fetch wins (localWriteSeq
 *    dirty-guard) — the user's just-made save is never regressed by a
 *    stale snapshot.
 *  In-flight dedup: two surfaces opening at once fire one GET, not two. */
let reconcileInFlight: Promise<void> | null = null;

export function reconcileUserParamPresets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (reconcileInFlight) return reconcileInFlight;
  const seqAtStart = localWriteSeq;
  reconcileInFlight = (async () => {
    try {
      const r = await window.fetch(SHELF_ENDPOINT, { signal: AbortSignal.timeout(2500) });
      if (!r.ok) return; // 403/404/500 — local list stays the truth
      const j = (await r.json()) as { presets?: unknown; synced?: boolean };
      if (!Array.isArray(j?.presets)) return;
      if (j.synced !== true) return; // fresh server — local is the truth
      if (localWriteSeq !== seqAtStart) return; // dirty-guard: local save raced ahead
      const server = j.presets.filter(
        (p): p is UserParamPreset =>
          p != null &&
          typeof p === "object" &&
          typeof (p as UserParamPreset).id === "string" &&
          typeof (p as UserParamPreset).type === "string" &&
          typeof (p as UserParamPreset).name === "string" &&
          (p as UserParamPreset).params != null &&
          typeof (p as UserParamPreset).params === "object"
      );
      const local = loadUserParamPresets();
      if (JSON.stringify(server) === JSON.stringify(local)) return; // already in step
      try {
        window.localStorage.setItem(USER_PARAM_PRESETS_KEY, JSON.stringify(server));
      } catch {
        return; // private mode — session stays on the local list
      }
      window.dispatchEvent(new CustomEvent(USER_PARAM_PRESETS_EVENT));
    } catch {
      /* offline / timeout — the local copy keeps its truth */
    }
  })().finally(() => {
    reconcileInFlight = null;
  });
  return reconcileInFlight;
}

/** Newest first, stable, non-mutating — the palette's "Add from your
 *  presets" group reads this: the snapshot the user saved most recently
 *  is the one they most likely want as a starting point, and an old
 *  favorite is still one scroll away. loadUserParamPresets() returns
 *  oldest-first (storage order); this is the display dialect, not a
 *  different truth. */
export function recentFirst(presets: UserParamPreset[]): UserParamPreset[] {
  return [...presets].sort((a, b) => b.createdAt - a.createdAt);
}

/** How many spec keys the snapshot would actually MOVE on this job —
 *  the apply dialog's "M of N differ" line, computed against the job's
 *  current effective params (stored ?? default), not just the raw stored
 *  map (a stored value equal to the default is not a change). */
export function countEffectiveDiffs(
  preset: UserParamPreset,
  specParams: { key: string; default?: unknown }[],
  stored: Record<string, unknown> | null | undefined
): number {
  const src = stored ?? {};
  let diffs = 0;
  for (const [key, value] of Object.entries(preset.params)) {
    const cur = key in src && isScalar(src[key]) ? src[key] : specParams.find((p) => p.key === key)?.default;
    if (String(cur) !== String(value)) diffs += 1;
  }
  return diffs;
}
