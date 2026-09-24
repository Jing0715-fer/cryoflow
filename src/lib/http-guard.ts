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

/**
 * t259 — the guard's parameter type is the WIDEST request shape (a plain
 * Request): the guard only reads `request.headers`, NextRequest callers
 * pass structurally, and route handlers that destructure a bare `Request`
 * (e.g. the pipeline-script route) fit too. Narrow types would force a
 * cast at every door.
 */
import os from "os";

/* ---------------------------------------------------------------------- */
/* t377 — the gateway-forwarded lane                                        */
/* ---------------------------------------------------------------------- */

/**
 * CryoFlow is also served BEHIND A REVERSE PROXY (the hosted-preview
 * deployment): the browser talks to the proxy's hostname, the proxy
 * forwards to us on loopback. Every request the gateway proxies carries
 * its forwarding signature — Caddy's `header_up X-Real-IP/X-Forwarded-For/
 * X-Forwarded-Proto` REPLACE whatever the client sent, so a request that
 * arrives with all three came through OUR gateway, not around it.
 *
 * This lane is OPT-IN via `CRYOFLOW_TRUST_GATEWAY=1` in the environment
 * the server starts with:
 *
 *   - Default (unset, e.g. the local companion deployment): the guard is
 *     bit-identical to the pre-t377 behavior. A drive-by page talking
 *     straight to localhost:3000 can forge X-Real-IP & friends in
 *     fetch() headers, so the host pin must NOT lean on them un-trusted.
 *   - Trusted-gateway deployments: the app port is only reachable THROUGH
 *     the proxy (loopback-bound, not exposed), so the three headers are a
 *     proxy-stamped proof of provenance and the hostile-origin gate
 *     (`isSameOriginRequest`, driven by browser-enforced Sec-Fetch-* /
 *     Origin) still applies on top.
 */
const TRUST_GATEWAY = process.env.CRYOFLOW_TRUST_GATEWAY === "1";

/** True when the request carries our reverse proxy's full signature. */
function isGatewayForwarded(request: Request): boolean {
  return Boolean(
    request.headers.get("x-real-ip") &&
      request.headers.get("x-forwarded-for") &&
      request.headers.get("x-forwarded-proto")
  );
}

export function isSameOriginRequest(request: Request): boolean {
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

  // No browser fetch metadata at all (curl, scripts, some proxies) — not a
  // browser same-origin context → deny by default on this sensitive surface.
  // t377 exception: behind a trusted reverse proxy, a hop that stripped every
  // metadata header still carries the proxy's forwarding signature. The
  // browser's own hostile-origin evidence (Sec-Fetch-Site: cross-site, a
  // foreign Origin/Referer) has already had its say ABOVE — reaching this
  // line means none of it was present, and the request came through our
  // gateway. QA scripts should send `-H "Origin: http://localhost:3000"`
  // when they bypass the gateway on this route.
  if (TRUST_GATEWAY && isGatewayForwarded(request)) return true;
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
export function isAllowedHost(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;
  // strip the port ("localhost:3000") / bracketed IPv6 zone ("[::1]:3000")
  const hostname = (host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0])
    .trim()
    .toLowerCase();
  if (OWN_HOSTNAMES.has(hostname)) return true;
  // t377 — the gateway lane: a trusted reverse proxy may present the app
  // under ITS OWN hostname (the hosted-preview deployment). The request is
  // not naming this machine because it never talked to this machine
  // directly — it talked to our gateway. The proxy's forwarding signature
  // (which the client cannot forge THROUGH the gateway, `header_up`
  // replaces) vouches for the hop; `isSameOriginRequest` still gates the
  // browser-origin evidence on top.
  return TRUST_GATEWAY && isGatewayForwarded(request);
}

/**
 * Both gates for the host-sensitive surfaces (host-FS listing, workdir
 * file bytes): fetch-metadata same-origin first (cheap door slam for
 * drive-bys), then Host pinning (rebinding backstop).
 */
export function isLocalRequest(request: Request): boolean {
  return isSameOriginRequest(request) && isAllowedHost(request);
}
