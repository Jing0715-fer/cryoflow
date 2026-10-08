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
 * bookmarks mirror instantly. A per-browser asset is the honest first
 * version for a local single-user companion app; a server-row sync (the
 * camera-bookmark dual-mirror pattern) is the natural next layer when a
 * cross-browser face asks for it — the shape here is already the wire
 * shape that sync would PUT.
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

function persist(list: UserParamPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_PARAM_PRESETS_KEY, JSON.stringify(list));
  } catch {
    // quota/privacy-mode refusal — the caller's UI already treats the
    // in-memory list as the truth for this session; nothing to escalate
  }
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

/** The presets that can legally land on this job type — the gate the UI
 *  reads; the server's spec-key filter stays the second gate regardless. */
export function presetsForType(presets: UserParamPreset[], type: string): UserParamPreset[] {
  return presets.filter((p) => p.type === type);
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
