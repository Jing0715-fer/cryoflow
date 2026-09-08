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
import os from "os";

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

/* ---------------------------------------------------------------------- */
/* Host pinning (#5, round 2) — closes the documented DNS-rebinding gap     */
/* ---------------------------------------------------------------------- */

/**
 * With DNS rebinding an attacker page rebinds their own domain to
 * 127.0.0.1; after the DNS TTL lapses the browser considers the request
 * SAME-origin (origin host == Host header == attacker domain), so
 * `isSameOriginRequest` alone passes. The one header a rebound page
 * cannot fake is `Host` — the browser sets it from the address bar, and
 * for a rebound request it names the ATTACKER's domain, never ours.
 *
 * So: pin Host to the set of names this machine legitimately answers as —
 * loopback names/literals plus every address of our own network
 * interfaces (the app is a desktop companion; LAN access via our own IP
 * is the only legitimate non-loopback form). A rebound `Host:`
 * attacker.com fails the pin even though the origin check saw a match.
 *
 * The interface list is sampled once at module load: addresses change
 * only via DHCP renewals / network switches, and a dev-server restart
 * (the norm for this app) re-samples. Trade-off (documented): access via
 * a custom DNS name for this machine (rare for a companion tool) would
 * be rejected — use the IP or localhost instead.
 */
const OWN_HOSTNAMES: Set<string> = (() => {
  const names = new Set<string>(["localhost", "127.0.0.1", "::1", "[::1]", "::ffff:127.0.0.1"]);
  try {
    for (const infos of Object.values(os.networkInterfaces())) {
      for (const info of infos ?? []) {
        if (!info?.address) continue;
        // skip link-local metadata noise (fe80::… stays allowed as our own
        // address — it IS an interface address; only 0.0.0.0/unspecified is
        // never a real Host)
        if (info.address === "0.0.0.0" || info.address === "::") continue;
        names.add(info.address.toLowerCase());
      }
    }
  } catch {
    /* interface enumeration failed — loopback pins still hold */
  }
  return names;
})();

/** Host-header pin: true when the request's Host names THIS machine. */
export function isAllowedHost(request: NextRequest): boolean {
  const host = request.headers.get("host");
  if (!host) return false;
  // strip the port ("localhost:3000") / bracketed IPv6 zone ("[::1]:3000")
  const hostname = (host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0])
    .trim()
    .toLowerCase();
  return OWN_HOSTNAMES.has(hostname);
}

/**
 * Both gates for the host-sensitive surfaces (host-FS listing, workdir
 * file bytes): fetch-metadata same-origin first (cheap door slam for
 * drive-bys), then Host pinning (rebinding backstop).
 */
export function isLocalRequest(request: NextRequest): boolean {
  return isSameOriginRequest(request) && isAllowedHost(request);
}
