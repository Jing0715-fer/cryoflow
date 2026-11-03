#!/usr/bin/env node
/**
 * t959 — the ERROR ENVELOPE unit (node-only): the audit's laws pinned at
 * the reader, the classifier, the retry well, and the tree itself.
 *
 * THE AUDIT (this unit's birth): the API routes speak ONE refusal
 * dialect — 357 `json({ error })` bodies, every one with an explicit
 * status; the bare-text/binary responses are success payloads guarded by
 * earlier `{ error }` returns; the one `{ message }` outlier is the root
 * ping's 200 body. The server plane was already honest. The CLIENT plane
 * was not: eleven fetch sites discarded the envelope and threw
 * `route said 400` / `HTTP 400`, so a door that named its reason reached
 * the user as a status number. The cure is threefold:
 *  - httpErrorFrom — the one birthplace for the last hop: the door's own
 *    text is the message when it spoke, `HTTP <status>` when it didn't,
 *    and the status rides the error STRUCTURALLY;
 *  - classifyFetchFailure — status-native FIRST (the string shape stops
 *    being load-bearing), the string pattern stays as legacy fallback;
 *  - the eleven sites re-keyed — and this unit greps the tree so the
 *    discarder idiom can never quietly grow back.
 *
 *   node scripts/unit-runner.mjs scripts/t959-http-envelope-unit.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t959-http-envelope-unit.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* ---- the live imports (the lib's own wells) ---- */
const { httpErrorFrom } = await import("@/lib/http-error");
const { classifyFetchFailure, fetchJsonRetry } = await import("@/lib/retry-fetch");

/* ---- Response stubs (plain objects — the shape is the contract) ---- */
const jsonRes = (status, body, okStatus = status >= 200 && status < 300) => ({
  ok: okStatus,
  status,
  json: async () => {
    if (body === undefined) throw new TypeError("not JSON");
    return typeof body === "string" ? JSON.parse(body) : body;
  },
});
const textRes = (status, text) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => { throw new TypeError(`Unexpected token in "${text.slice(0, 8)}"`); },
});

/* ---- H: httpErrorFrom — the reader's own laws ---- */
/* H1 — the door spoke: its text IS the message, the status rides structurally */
{
  const err = await httpErrorFrom(jsonRes(400, { error: "Text preview is for log/text files" }));
  ok("H1 message IS the door's reason", err.message === "Text preview is for log/text files", JSON.stringify(err.message));
  ok("H1 status rides structurally", err.status === 400, String(err.status));
  ok("H1 instanceof Error", err instanceof Error);
}
/* H2 — the door was silent (non-JSON body): the honest status fallback */
{
  const err = await httpErrorFrom(textRes(500, "<html>gateway</html>"));
  ok("H2 non-JSON body falls back to HTTP <status>", err.message === "HTTP 500", JSON.stringify(err.message));
  ok("H2 status rides structurally", err.status === 500, String(err.status));
}
/* H3 — JSON body without an error key: same honest fallback */
{
  const err = await httpErrorFrom(jsonRes(404, { detail: "no such thing" }));
  ok("H3 error-less JSON falls back", err.message === "HTTP 404", JSON.stringify(err.message));
  ok("H3 status rides", err.status === 404, String(err.status));
}
/* H4 — empty-object JSON body (the reader's own catch-idiom shape) */
{
  const err = await httpErrorFrom(jsonRes(502, {}));
  ok("H4 empty JSON object falls back", err.message === "HTTP 502", JSON.stringify(err.message));
}

/* ---- C: classifyFetchFailure — status-native first, string legacy ---- */
/* C1 — the status branch: 4xx non-429 definitive, everything else transient */
{
  const mk = (status) => Object.assign(new Error("whatever the text is"), { status });
  ok("C1 status 404 → definitive", classifyFetchFailure(mk(404)) === "definitive");
  ok("C1 status 400 → definitive", classifyFetchFailure(mk(400)) === "definitive");
  ok("C1 status 429 → transient", classifyFetchFailure(mk(429)) === "transient");
  ok("C1 status 500 → transient", classifyFetchFailure(mk(500)) === "transient");
  ok("C1 status 503 → transient", classifyFetchFailure(mk(503)) === "transient");
}
/* C2 — the STATUS WINS over the message: the shape is no longer load-bearing */
{
  const liar = Object.assign(new Error("HTTP 400"), { status: 500 });
  ok("C2 status 500 beats a lying HTTP-400 text", classifyFetchFailure(liar) === "transient");
  const honest = Object.assign(new Error("the door's own long reason"), { status: 404 });
  ok("C2 status 404 wins over free text", classifyFetchFailure(honest) === "definitive");
}
/* C3 — the legacy string fallback (third-party throws without a status) */
{
  ok("C3 legacy 'HTTP 404' → definitive", classifyFetchFailure(new Error("HTTP 404")) === "definitive");
  ok("C3 legacy 'HTTP 429' → transient", classifyFetchFailure(new Error("HTTP 429")) === "transient");
  ok("C3 legacy 'HTTP 500' → transient", classifyFetchFailure(new Error("HTTP 500")) === "transient");
  ok("C3 network 'fetch failed' → transient", classifyFetchFailure(new TypeError("fetch failed")) === "transient");
  ok("C3 free text → transient", classifyFetchFailure(new Error("route said 400")) === "transient");
}

/* ---- F: fetchJsonRetry — the well's throws now carry the status too ---- */
const realFetch = globalThis.fetch;
try {
  /* F1 — definitive 404: ONE attempt, throws with status attached */
  {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return jsonRes(404, { error: "No such job" }); };
    // NOTE: the well does NOT read the envelope — its contract stays the
    // status text (charts self-hide on it); the status now ALSO rides.
    let caught = null;
    try { await fetchJsonRetry("/api/x", { retries: 3, backoffMs: 1 }); }
    catch (e) { caught = e; }
    ok("F1 definitive throws on first attempt", calls === 1, String(calls));
    ok("F1 message keeps the standing text", caught?.message === "HTTP 404", JSON.stringify(caught?.message));
    ok("F1 status rides structurally", caught?.status === 404, String(caught?.status));
  }
  /* F2 — transient 500 twice then 200: retries land */
  {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return calls <= 2 ? jsonRes(500, {}) : jsonRes(200, { fine: true });
    };
    const out = await fetchJsonRetry("/api/x", { retries: 3, backoffMs: 1 });
    ok("F2 retries a 500 then lands", out && out.fine === true && calls === 3, `calls=${calls}`);
  }
  /* F3 — 429 is transient: retries, and the final throw carries the status */
  {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return jsonRes(429, {}); };
    let caught = null;
    try { await fetchJsonRetry("/api/x", { retries: 1, backoffMs: 1 }); }
    catch (e) { caught = e; }
    ok("F3 429 retries (2 attempts)", calls === 2, String(calls));
    ok("F3 final 429 throw carries status", caught?.status === 429, String(caught?.status));
    ok("F3 final 429 classifies transient", classifyFetchFailure(caught) === "transient");
  }
  /* F4 — network TypeError retries too (the connection-layer law) */
  {
    let calls = 0;
    globalThis.fetch = async () => { calls++; if (calls < 2) throw new TypeError("ECONNRESET"); return jsonRes(200, { ok: 1 }); };
    const out = await fetchJsonRetry("/api/x", { retries: 2, backoffMs: 1 });
    ok("F4 network error retried then landed", out?.ok === 1 && calls === 2, `calls=${calls}`);
  }
} finally {
  globalThis.fetch = realFetch;
}

/* ---- A: the audit's own tripwires (the tree grep) ---- */
const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
};
const srcFiles = walk(path.join(ROOT, "src"));

/* A1 — no bare envelope-discarder throws remain in components/lib */
{
  const offenders = [];
  for (const f of srcFiles) {
    if (!/\/src\/(components|lib)\//.test(f)) continue;
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/throw new Error\(`(route said|HTTP) \$\{res\.status\}`\)/.test(line)) {
        offenders.push(`${path.relative(ROOT, f)}:${i + 1}`);
      }
    });
  }
  ok("A1 zero envelope-discarder throws in the tree", offenders.length === 0, offenders.slice(0, 4).join(", "));
}
/* A2 — the eleven re-keyed sites read httpErrorFrom (the idiom's readers) */
{
  let readers = 0;
  for (const f of srcFiles) {
    if (!/\/src\//.test(f)) continue;
    readers += (readFileSync(f, "utf8").match(/httpErrorFrom\(/g) ?? []).length;
  }
  // 11 call sites + the unit's own greps don't count (this file is under scripts/)
  ok("A2 the re-keyed sites all read httpErrorFrom", readers >= 11, `readers=${readers}`);
}
/* A3 — the ONE {message} outlier is the root ping, and it is a 200 body */
{
  const apiFiles = walk(path.join(ROOT, "src/app/api"));
  const messageSites = [];
  for (const f of apiFiles) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/json\(\{\s*message:/.test(line)) messageSites.push(`${path.relative(ROOT, f)}:${i + 1}`);
    });
  }
  ok("A3 exactly one {message} site in the API tree", messageSites.length === 1, messageSites.join(", "));
  if (messageSites.length === 1) {
    const body = readFileSync(path.join(ROOT, messageSites[0].replace(/:\d+$/, "")), "utf8");
    ok("A3 the outlier is the root ping (Hello, world!)", body.includes("Hello, world!"));
  }
}
/* A4 — every json({ error refusal carries a status on the same line */
{
  const missing = [];
  for (const f of walk(path.join(ROOT, "src/app/api"))) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/json\(\{\s*error:/.test(line) && !/status/.test(line)) {
        missing.push(`${path.relative(ROOT, f)}:${i + 1}`);
      }
    });
  }
  ok("A4 every {error} refusal carries a status", missing.length === 0, missing.slice(0, 4).join(", "));
}

/* ---- the receipt ---- */
const receipt = { instrument: "t959-http-envelope-unit", pass, fail, at: new Date().toISOString() };
const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nHTTP-ENVELOPE-UNIT t959: ${pass}/${pass + fail} ${fail === 0 ? "green — the door's own reason rides, the string shape is no longer load-bearing" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
