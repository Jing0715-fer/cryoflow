/**
 * t707 — the Origin door shim for QA/probe scripts.
 *
 * The t251 hardening (and its t707 saved-state closure) put an
 * isLocalRequest gate on job-data routes: headerless curl-style clients
 * are rejected by design. The guard's own doc line names the cure —
 * "QA scripts should send -H Origin: http://localhost:3000". Instead of
 * threading a header through every fetch call site, a script installs
 * this shim ONCE at the top and every subsequent fetch to an http(s)
 * URL speaks the door's language automatically: an Origin header whose
 * host equals the request's host — the same evidence a same-origin
 * browser fetch carries, no more.
 *
 *   import { installOriginDoor } from "./lib/qa-origin.mjs";
 *   installOriginDoor();
 *
 * Idempotent; a no-op when headers already carry Origin (script wins).
 * Browser-driven pages are unaffected — the shim only patches the Node
 * process it runs in.
 */
const ORIGIN_HEADERS = ["origin", "Origin"];

export function installOriginDoor() {
  const original = globalThis.fetch;
  if (original.__originDoor) return original.__originDoor;
  const patched = (input, init = {}) => {
    try {
      const url =
        typeof input === "string"
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL(input.url);
      if (url.protocol === "http:" || url.protocol === "https:") {
        const h = init.headers;
        const has = (hdrs) =>
          !!hdrs &&
          ORIGIN_HEADERS.some((k) =>
            typeof hdrs.has === "function"
              ? hdrs.has(k)
              : typeof hdrs === "object"
                ? k in hdrs
                : false,
          );
        if (!has(h) && !(typeof input === "object" && input !== null && has(input.headers))) {
          init = {
            ...init,
            headers: {
              ...(h && typeof h === "object" && typeof h.has !== "function" ? h : {}),
              Origin: `${url.protocol}//${url.host}`,
            },
          };
        }
      }
    } catch {
      /* unparseable input — hand it to fetch untouched and let it error */
    }
    return original(input, init);
  };
  patched.__originDoor = patched;
  globalThis.fetch = patched;
  return patched;
}
