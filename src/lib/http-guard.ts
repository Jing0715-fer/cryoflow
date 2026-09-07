/**
 * CryoFlow — lightweight same-origin guard for sensitive read routes.
 *
 * CryoFlow is a LOCAL single-user companion app, so there is no login to
 * put in front of /api/fs/browse. The realistic threat is a malicious web
 * page open in the same browser (drive-by): without a check, that page can
 * fetch("http://localhost:3000/api/fs/browse?path=/home/...") — a CORS
 * "opaque" read is blocked by the browser, but route handlers still EXECUTE
 * and side channels / no-cors POST variants make blind probing viable.
 *
 * The guard exploits what browsers ALWAYS send on same-origin fetches:
 *   - `Sec-Fetch-Site: same-origin` (all fetch/XHR same-origin requests)
 *   - `Origin` (POST/PUT/DELETE and cross-origin fetches) — host must equal Host
 *   - `Referer` fallback for older engines
 * Cross-site requests carry attacker origins → mismatch → 403. Direct
 * address-bar navigation ("none") stays allowed. curl-style clients with
 * NO fetch metadata at all are REJECTED — QA scripts should send
 * `-H "Origin: http://localhost:3000"` when they need this route.
 *
 * Residual risk (documented): DNS-rebinding makes Origin == Host from the
 * browser's view and passes. Full defense would pin an allowlist of hosts;
 * for a desktop companion tool the origin check closes the realistic
 * drive-by door without breaking any user flow.
 */

import type { NextRequest } from "next/server";

export function isSameOriginRequest(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return true;

  const host = request.headers.get("host");
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  // No fetch metadata at all (curl, scripts, some proxies) — not a browser
  // same-origin context → deny by default on this sensitive surface.
  return false;
}
