/**
 * CryoFlow — the ACTIVE AI provider's health, probed server-side. t472.
 *
 * The t468 lesson, turned into furniture: a mock-dialect baseUrl slept in
 * the real settings file for three windows because nothing ever looked at
 * it — the first chat answered "fetch failed" in milliseconds and the user
 * had to debug a dead port from a chat error. The probe flips the order:
 * the badge learns the endpoint is dead BEFORE the user asks a question.
 *
 * Laws:
 *  - SHORT TIMEOUT — a probe never hangs a settings read (AbortSignal 2.5s).
 *  - TTL CACHE — one probe per provider per minute, not per render; the
 *    PUT route invalidates so the very next GET re-tests what changed.
 *  - FOUR HONEST STATES — "ok" (answered 2xx, or the in-process builtin
 *    lane which has no endpoint to miss), "unreachable" (network-level
 *    failure: refused / DNS / timeout), "rejected" (401/403 — the endpoint
 *    is alive and refuses the key), "error" (any other HTTP answer).
 *  - ZERO SECRETS — the detail sentence names what was tried and what came
 *    back; it never echoes the API key.
 */

import type { AiProviderHealthDto } from "./types";
import type { AiProviderConfig } from "./settings";
import { aiProvider } from "./providers";

const PROBE_TIMEOUT_MS = 2_500;
const CACHE_TTL_MS = 60_000;

export type { AiProviderHealthDto, AiProviderHealthState } from "./types";

interface CacheEntry {
  health: AiProviderHealthDto;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** t472 — the PUT route's dial tone: next GET re-tests what just changed. */
export function invalidateProviderHealth(): void {
  cache.clear();
}

function cacheKey(providerId: string, cfg: AiProviderConfig): string {
  return `${providerId}|${cfg.baseUrl ?? ""}|${cfg.model}`;
}

/** The models-listing URL per flavor (the cheapest endpoint that answers). */
function probeUrlAndHeaders(
  flavor: string,
  baseUrl: string,
  apiKey: string,
): { url: string; headers: Record<string, string> } {
  if (flavor === "anthropic") {
    const base = baseUrl.replace(/\/+$/, "");
    return {
      url: `${base}/v1/models`,
      headers: apiKey ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } : { "anthropic-version": "2023-06-01" },
    };
  }
  if (flavor === "gemini") {
    const base = baseUrl.replace(/\/+$/, "");
    return { url: `${base}/v1beta/models`, headers: {} };
  }
  // openai dialect (and every OpenAI-compatible custom endpoint)
  const base = baseUrl.replace(/\/+$/, "");
  return {
    url: `${base}/models`,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  };
}

/**
 * Probe ONE provider config (no cache — the cached face is
 * `providerHealthFor`). Network-level failure → "unreachable"; a 401/403 →
 * "rejected"; any other HTTP answer → "error"; 2xx → "ok".
 */
export async function probeProviderHealth(
  providerId: string,
  cfg: AiProviderConfig,
): Promise<AiProviderHealthDto> {
  const provider = aiProvider(providerId);
  const flavor = provider?.flavor ?? "openai";
  const checkedAt = new Date().toISOString();

  if (flavor === "builtin") {
    return {
      providerId,
      state: "ok",
      detail: "in-process SDK lane — no endpoint to miss",
      latencyMs: null,
      checkedAt,
    };
  }
  if (!cfg.baseUrl) {
    return {
      providerId,
      state: "unreachable",
      detail: "no base URL is saved — nothing to probe",
      latencyMs: null,
      checkedAt,
    };
  }

  const { url, headers } = probeUrlAndHeaders(flavor, cfg.baseUrl, cfg.apiKey);
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      redirect: "manual",
    });
  } catch (err) {
    // t472 honesty: a REFUSAL (millisecond ECONNREFUSED) is not a TIMEOUT —
    // the two get different sentences (the bench's first live read caught
    // the draft saying "did not answer within 2.5s" for an 11ms refusal).
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    let why: string;
    if (timedOut) {
      why = `did not answer within ${PROBE_TIMEOUT_MS / 1000}s`;
    } else {
      const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
      const raw = cause instanceof Error ? cause.message : err instanceof Error ? err.message : "network error";
      why = `could not be reached (${raw.slice(0, 140)})`;
    }
    return {
      providerId,
      state: "unreachable",
      detail: `${cfg.baseUrl} ${why}`,
      latencyMs: Date.now() - started,
      checkedAt,
    };
  }
  const latencyMs = Date.now() - started;
  if (res.ok) {
    return {
      providerId,
      state: "ok",
      detail: `${url} answered ${res.status} in ${latencyMs}ms`,
      latencyMs,
      checkedAt,
    };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      providerId,
      state: "rejected",
      detail: `${cfg.baseUrl} is alive but answered ${res.status} — ${cfg.apiKey ? "the saved key was refused" : "no key is saved and the endpoint demands one"}`,
      latencyMs,
      checkedAt,
    };
  }
  return {
    providerId,
    state: "error",
    detail: `${cfg.baseUrl} answered HTTP ${res.status}`,
    latencyMs,
    checkedAt,
  };
}

/**
 * The cached face the settings route serves: one probe per provider per
 * TTL window, keyed by id + baseUrl + model so an edit re-tests naturally.
 */
export async function providerHealthFor(
  providerId: string,
  cfg: AiProviderConfig,
): Promise<AiProviderHealthDto> {
  const key = cacheKey(providerId, cfg);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.health;
  const health = await probeProviderHealth(providerId, cfg);
  cache.set(key, { health, expiresAt: Date.now() + CACHE_TTL_MS });
  return health;
}

/**
 * The ACTIVE provider's health — what GET /api/ai/settings serves and the
 * badge wears. When nothing is configured the derived builtin lane answers
 * (mirroring aiSettingsDto's synthesis), so the badge always has a truth.
 * A dangling activeProvider (no saved config) → null: the badge already
 * says needsSetup; a second sentence would be noise.
 */
export async function activeProviderHealth(
  data: { activeProvider: string | null; providers: Record<string, AiProviderConfig> },
): Promise<AiProviderHealthDto | null> {
  const id = data.activeProvider ?? "builtin";
  const cfg = data.providers[id];
  if (!cfg) {
    // the derived builtin row (zero-config identity) — synthesize it here
    if (id === "builtin" && !data.activeProvider) {
      return providerHealthFor("builtin", { apiKey: "", model: "glm-4-plus", baseUrl: null });
    }
    return null;
  }
  return providerHealthFor(id, cfg);
}
