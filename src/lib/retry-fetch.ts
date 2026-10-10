/**
 * CryoFlow — transient-failure-tolerant JSON fetch for result panels.
 *
 * Result charts (FSC / Guinier / resolution / orientation …) self-hide
 * permanently when their one-shot fetch fails. In dev, Turbopack compiles
 * an API route ON FIRST HIT and that first response can 500 / hang / drop
 * mid-compile — the user then sees a chart missing until they close and
 * reopen the inspector, with no explanation. The same applies right after
 * a dev-server restart.
 *
 * fetchJsonRetry retries ONLY transient failures — network errors and
 * 5xx/429 — with a short linear backoff. 4xx is definitive (bad path,
 * genuinely missing data) and fails immediately, preserving the
 * "self-hide when the job has no data" contract.
 *
 * t491 — classifyFetchFailure is that same law's readable half: callers
 * that catch a final failure can ask WHICH KIND it was instead of
 * string-matching messages themselves. One birthplace for the
 * definitive/transient boundary — the hook (use-chart-resource) reads
 * it to decide between the honest empty (self-hide) and the visible
 * wound (a strip with a Retry chip).
 */
export type FetchFailureKind = "definitive" | "transient";

/** Which kind of failure ended a fetchJsonRetry run? "definitive" = the
 *  server answered a 4xx (non-429): the path is wrong or the data is
 *  genuinely absent — self-hiding is the honest response. "transient" =
 *  network errors and 5xx/429 exhausted their retries: the server may
 *  recover, so hiding is a LIE (it reads as "no data"). */
export function classifyFetchFailure(err: unknown): FetchFailureKind {
  const msg = err instanceof Error ? err.message : String(err);
  return /^HTTP 4\d\d$/.test(msg) && msg !== "HTTP 429" ? "definitive" : "transient";
}

export async function fetchJsonRetry<T>(
  url: string,
  { retries = 2, backoffMs = 1500, init }: { retries?: number; backoffMs?: number; init?: RequestInit } = {}
): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, backoffMs * attempt));
    try {
      const res = await fetch(url, { cache: "no-store", ...init });
      if (res.ok) return (await res.json()) as T;
      if (res.status < 500 && res.status !== 429) {
        // definitive client-side failure — surface it now
        throw new Error(`HTTP ${res.status}`);
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("HTTP 4")) throw err;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}
