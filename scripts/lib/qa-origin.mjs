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
 *
 * ⚠ THE DOOR'S-OWN-TEST EXCLUSION (t714, learned the expensive way):
 * a probe whose SUBJECT is the bare lane — any suite asserting
 * "no metadata → 403" (t251 PHASE B, t252's blind-write phase, t259's
 * gate matrix) — MUST NOT install this shim: it would dress the bare
 * request in same-origin evidence and the assertion would test the
 * shim, not the door. The t710 mass install threaded this import into
 * 289 files mechanically and threaded it into these three too; the
 * t25 batch's 5-window rotation ceiling is what exposed the poisoning
 * (18/6 fails whose every line read "bare got 200"). Bare-column
 * probes belong on the manual-exclusion list, exactly like the
 * t708-writers-sweep precedent ("its bare column IS the door's own
 * test — covered by design").
 *
 * ⚠ THE TRANSITIVE RULE (t714, second half of the same lesson): a
 * SHARED module that installs this shim at its top level poisons every
 * consumer — t254 imported resolveRefineHost() and got its bare fetch
 * dressed by qa-refine-host.mjs's own install, even after t254's own
 * install was removed. Shared libs under scripts/ must stay
 * shim-free (they serve bare-column probes and normal probes alike);
 * each entry-point script installs the shim for ITSELF, exactly once,
 * after checking its own assertions don't own a bare column.
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
