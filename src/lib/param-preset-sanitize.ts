/**
 * CryoFlow — the server-side trust boundary for the user param presets'
 * shelf (Task 715).
 *
 * The client lib (lib/user-param-presets.ts) is friendly; this file is
 * NOT trusting. The shelf row is one JSON blob the browser PUTs whole,
 * so the route hands every payload through this whitelist before a
 * single byte touches the database — same posture as the camera
 * bookmarks' per-entry sanitize (api/jobs/[id]/camera-bookmarks), but
 * extracted into a pure module so the unit probe can pin the laws
 * without importing next/server or the Prisma client.
 *
 * WHAT GETS IN:
 *   id        — non-empty string, capped at 64 chars (client ids are
 *               `upp-<ms>-<rand>`; foreign shapes simply won't survive)
 *   type      — non-empty string, capped at 64 chars (a JOB_TYPES key on
 *               the client; the server cannot enumerate that list, the
 *               apply gate on the client stays the semantic check)
 *   name      — non-empty string, capped at 80 chars (the UI's own rule
 *               is 1..60; the door is wider than the UI by design —
 *               imports and future faces may speak slightly differently)
 *   createdAt — finite number, clamped to [0, now + 60s] (clock skew
 *               tolerated, timestamps from 1970 or the far future not)
 *   params    — plain object, ≤64 keys, each key ≤64 chars, each value a
 *               SCALAR (finite number / string ≤256 chars / boolean).
 *               Nulls, arrays, nested objects and non-finite numbers are
 *               exactly what the client's snapshot law already refuses —
 *               the door re-refuses them so a crafted payload can't park
 *               a JSON bomb or a prototype-pollution-shaped key on the
 *               shelf.
 *
 * THE LIST — capped at 48 presets (the UI has no pagination because the
 * honest shelf of one user never approaches this; the cap exists so the
 * row stays a shelf and never becomes a dump).
 */

export interface SanitizedPreset {
  id: string;
  type: string;
  name: string;
  params: Record<string, number | string | boolean>;
  createdAt: number;
}

/** Sanitize ONE preset entry — exported for the file-import path
 *  (t717): the portability module walks a file's entries through the
 *  same single-entry gate so the file path and the API path cannot
 *  drift apart, and counts each refusal as a receipt line instead of
 *  relying on the whole-shelf skip-not-sink behavior. */
export function sanitizePresetEntry(raw: unknown): SanitizedPreset | null {
  return sanitizePreset(raw);
}

/** The shelf's cap, single-sourced: the server door and the file-import
 *  merge both read THIS number (t717 — two caps would eventually
 *  disagree about how big a shelf may be). */
export const MAX_PRESETS = 48;
const MAX_PARAM_KEYS = 64;
const MAX_ID_CHARS = 64;
const MAX_TYPE_CHARS = 64;
const MAX_NAME_CHARS = 80;
const MAX_KEY_CHARS = 64;
const MAX_VALUE_CHARS = 256;

const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const isScalar = (v: unknown): v is number | string | boolean =>
  isFiniteNum(v) || typeof v === "string" || typeof v === "boolean";

function sanitizePreset(raw: unknown): SanitizedPreset | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== "string" || !p.id) return null;
  if (typeof p.type !== "string" || !p.type) return null;
  if (typeof p.name !== "string" || !p.name) return null;
  if (!isFiniteNum(p.createdAt)) return null;
  if (!p.params || typeof p.params !== "object" || Array.isArray(p.params)) return null;

  const rawParams = p.params as Record<string, unknown>;
  const keys = Object.keys(rawParams).filter((k) => k.length > 0 && k.length <= MAX_KEY_CHARS);
  if (keys.length > MAX_PARAM_KEYS) return null;
  const params: Record<string, number | string | boolean> = {};
  for (const k of keys) {
    const v = rawParams[k];
    if (!isScalar(v)) continue; // a non-scalar knob is skipped, not fatal —
    // mirrors the client's snapshot law (refuse the value, keep the entry)
    if (typeof v === "string" && v.length > MAX_VALUE_CHARS) continue;
    params[k] = v;
  }

  return {
    id: p.id.slice(0, MAX_ID_CHARS),
    type: p.type.slice(0, MAX_TYPE_CHARS),
    name: p.name.slice(0, MAX_NAME_CHARS),
    params,
    createdAt: Math.min(Date.now() + 60_000, Math.max(0, p.createdAt)),
  };
}

/** Sanitize a whole shelf payload. Non-array input reads as "nothing
 *  survived"; individual bad entries are skipped while good neighbours
 *  live on (a corrupt row never sinks the shelf — the gallery's law). */
export function sanitizePresetShelf(raw: unknown): SanitizedPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: SanitizedPreset[] = [];
  for (const r of raw.slice(0, MAX_PRESETS)) {
    const entry = sanitizePreset(r);
    if (entry) out.push(entry);
  }
  return out;
}
