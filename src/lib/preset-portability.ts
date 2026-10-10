/**
 * CryoFlow — the user param presets' portability laws (Task 717), the
 * preset family's FIFTH face: carry.
 *
 * The family so far: the inspector's wear face (t713 — apply to the open
 * job), the palette's start face (t714 — launch a job from a snapshot),
 * the server mirror (t715 — the shelf follows the user across browsers),
 * the dashboard shelf (t716 — every snapshot on one overview). All four
 * live inside one machine: the t715 mirror crosses BROWSERS but not
 * MACHINES, and a single-user companion app that moves between a laptop
 * and a workstation needs an honest file. This module is that file —
 * the whole shelf as one JSON payload out, and a gated, receipted merge
 * back in.
 *
 * THE FILE'S IDENTITY — a `kind` header, not a guess. Any .json dropped
 * on the import mouth is refused by kind before a single entry is
 * examined: a package-lock.json or an exported workflow must fail with
 * "not a presets file", never with a silently empty import. Version on
 * the same line: a future shape change can refuse old files with a
 * reason instead of mis-reading them.
 *
 * THE IMPORT DOOR — the server's own whitelist speaks again. Entries
 * pass through lib/param-preset-sanitize.ts (t715's trust boundary) one
 * by one, so a crafted file meets exactly the same caps and scalar laws
 * the database door enforces — the file path and the API path cannot
 * drift apart because they share the one gate.
 *
 * MERGE LAWS (never removes, never renames, never overwrites):
 *   - EXACT TWINS are skipped: same type + same name + same params
 *     (key-order-insensitive). createdAt is NOT part of the twin test —
 *     the same snapshot re-exported from another machine carries a
 *     different timestamp but is still the same tuning.
 *   - ID COLLISIONS re-mint: a preset is identified by id internally but
 *     faced by name; when the file's id is already taken the entry lands
 *     under a fresh id with its name intact. Free ids are preserved.
 *   - THE CAP IS COUNTED, not silent: the shelf holds MAX_PRESETS (the
 *     server door's own cap, single-sourced from the sanitize module);
 *     entries that fall past it are counted in the receipt as overflow.
 *   - IMPORT NEVER DELETES: an oversized existing shelf just receives
 *     nothing; the receipt's counts tell the user why.
 *
 * PURITY — no storage, no DOM, no network. The component composes:
 *   importShelfPayload(text, loadUserParamPresets()) → writeUserParamPresets(receipt.shelf)
 * so the single write well (the t713 lib's persist, dual-writing the
 * t715 mirror) stays the only path the merged shelf can take.
 */

import {
  sanitizePresetEntry,
  MAX_PRESETS,
  type SanitizedPreset,
} from "@/lib/param-preset-sanitize";
import type { UserParamPreset } from "@/lib/user-param-presets";

export const PRESET_PAYLOAD_KIND = "cryoflow-user-param-presets";
export const PRESET_PAYLOAD_VERSION = 1;

/** The receipt the import dialog renders — every clause a count or a
 *  reason, so "what happened to my file" is never a guess. */
export interface ImportReceipt {
  ok: boolean;
  /** machine reason for a refused FILE (not entries): "unreadable" |
   *  "shape" | "kind" | "version" — the component humanizes */
  reason?: string;
  /** the entries that actually landed (post re-id, post cap) */
  added: UserParamPreset[];
  /** the FULL merged shelf to write (existing first, imports after) */
  shelf: UserParamPreset[];
  /** exact twins already on the shelf (or earlier in the same file) */
  duplicates: number;
  /** entries the door refused (bad shape, non-scalar params, …) */
  invalid: number;
  /** entries that fell past the shelf cap */
  overflow: number;
}

/** The whole shelf as one honest file: kind header for identity, the
 *  presets in the lib's exact wire shape (what the t715 PUT speaks —
 *  the file is the same dialect, frozen). Pretty-printed: these files
 *  get opened, diffed and hand-edited by scientists. */
export function exportShelfPayload(presets: UserParamPreset[]): string {
  return JSON.stringify(
    {
      kind: PRESET_PAYLOAD_KIND,
      version: PRESET_PAYLOAD_VERSION,
      exportedAt: Date.now(),
      presets,
    },
    null,
    2
  );
}

/** Date-stamped filename — a downloads folder full of "presets.json"
 *  copies is how export features get distrusted. */
export function exportShelfFilename(now: Date = new Date()): string {
  return `cryoflow-param-presets-${now.toISOString().slice(0, 10)}.json`;
}

/** key-order-insensitive params comparison — JSON.parse preserves file
 *  order, so a hand-reordered file must still read as the twin it is. */
function stableParams(params: Record<string, number | string | boolean>): string {
  return JSON.stringify(params, Object.keys(params).sort());
}

type TwinShape = Pick<UserParamPreset, "type" | "name" | "params">;

function isTwin(a: TwinShape, b: TwinShape): boolean {
  return a.type === b.type && a.name === b.name && stableParams(a.params) === stableParams(b.params);
}

function fail(reason: string, existing: UserParamPreset[]): ImportReceipt {
  return { ok: false, reason, added: [], shelf: existing, duplicates: 0, invalid: 0, overflow: 0 };
}

function mintId(now: number): string {
  return `upp-${now}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Parse + gate + merge a presets file against the current shelf. Never
 *  touches storage: the caller writes receipt.shelf through the lib's
 *  single write well when (and only when) it accepts the receipt. */
export function importShelfPayload(
  text: string,
  existing: UserParamPreset[],
  opts: { now?: number } = {}
): ImportReceipt {
  const now = opts.now ?? Date.now();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail("unreadable", existing);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fail("shape", existing);
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.kind !== PRESET_PAYLOAD_KIND) return fail("kind", existing);
  if (obj.version !== PRESET_PAYLOAD_VERSION) return fail("version", existing);

  // the server door speaks again, entry by entry — bad neighbors are
  // skipped and COUNTED (a corrupt entry is a receipt line, not a sink)
  const rawList = Array.isArray(obj.presets) ? obj.presets : [];
  const doorPassed: SanitizedPreset[] = [];
  let invalid = 0;
  for (const r of rawList) {
    const entry = sanitizePresetEntry(r);
    if (entry) doorPassed.push(entry);
    else invalid += 1;
  }

  const shelf: UserParamPreset[] = existing.map((p) => ({ ...p }));
  const added: UserParamPreset[] = [];
  let duplicates = 0;
  let overflow = 0;

  for (const e of doorPassed) {
    if (shelf.length >= MAX_PRESETS) {
      overflow += 1;
      continue;
    }
    // twin against the shelf-so-far — existing entries AND entries this
    // same file added earlier (a file with internal twins dies once)
    if (shelf.some((s) => isTwin(s, e))) {
      duplicates += 1;
      continue;
    }
    let id = e.id;
    while (shelf.some((s) => s.id === id)) id = mintId(now);
    const preset: UserParamPreset = {
      id,
      type: e.type,
      name: e.name,
      params: e.params,
      createdAt: e.createdAt,
    };
    shelf.push(preset);
    added.push(preset);
  }

  return { ok: true, added, shelf, duplicates, invalid, overflow };
}
