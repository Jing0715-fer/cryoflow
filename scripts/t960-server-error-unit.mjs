#!/usr/bin/env node
/**
 * t960 — the SERVER-ERROR unit (node-only): the error envelope's
 * server-side birthplace pinned, and the "Internal server error"
 * catch-all dialect banned at the tree level.
 *
 * THE DISEASE (this unit's birth): the t959 audit proved the server
 * plane honest at the SHAPE level — one refusal dialect, every `{ error }`
 * with a status — but 78 catch-alls still spoke the generic dialect at
 * the STRING level: they caught a real error, logged it, and told the
 * client "Internal server error". The reason was IN SCOPE and was thrown
 * away. The family already had the honest idiom in 19 files; the
 * catch-alls were the split dialect.
 *
 * THE CURE (what this unit pins):
 *  - src/lib/server-error.ts — serverErrorReply (the one birthplace for
 *    the unexpected-failure reply: log parity + the error's own message
 *    when it has one, "<tag> failed" the honest fallback) and
 *    serverErrorMessage (the same voice for the degrade-gracefully
 *    doors whose contract carries the error inside a 200 payload);
 *  - 77 catch-alls re-keyed to the birthplace (71 two-line catches +
 *    6 chart-route catches that keep their ChartJobNotFound guard);
 *  - continue-sources re-keyed to serverErrorMessage (the 200-degrade
 *    contract shape untouched, the reason rides in the field);
 *  - the tree tripwires: zero "Internal server error" in src/app, the
 *    ≥77 call sites can't quietly revert, one definition, one import
 *    source.
 *
 *   node scripts/unit-runner.mjs scripts/t960-server-error-unit.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t960-server-error-unit.json";

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  ${name}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`); }
}

/* ---- the live imports (the lib's own wells) ---- */
const { serverErrorMessage: sem, serverErrorReply: ser } = await import("@/lib/server-error");

/* ---- S: serverErrorMessage's faces ---- */
{
  const e = new Error("the round file is gone");
  ok("S1 the error's own message rides", sem("GET /api/x", e) === "the round file is gone");
  ok("S2 empty message falls to the tag", sem("GET /api/x", new Error("")) === "GET /api/x failed");
  ok("S3 whitespace message falls to the tag", sem("GET /api/x", new Error("   ")) === "GET /api/x failed");
  ok("S4 a string throw falls to the tag", sem("GET /api/x", "weird") === "GET /api/x failed");
  ok("S5 a plain-object throw falls to the tag", sem("GET /api/x", { code: "P2002" }) === "GET /api/x failed");
  ok("S6 null falls to the tag", sem("GET /api/x", null) === "GET /api/x failed");
}

/* ---- R: serverErrorReply's shapes (console.error stubbed) ---- */
{
  const origErr = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try {
    const res = ser("GET /api/jobs", new Error("connect ECONNREFUSED"));
    ok("R1 the 500 rides the response", res.status === 500, `status=${res.status}`);
    const body = await res.json();
    ok("R2 the error's own message is the door's text", body.error === "connect ECONNREFUSED", JSON.stringify(body).slice(0, 60));
    ok("R3 the reply speaks json", (res.headers.get("content-type") ?? "").includes("application/json"));
    ok("R4 log parity — one call, 'TAG failed:' first", calls.length === 1 && calls[0][0] === "GET /api/jobs failed:", JSON.stringify(calls[0]?.[0]));
    ok("R5 the logged second arg is the error itself", calls[0]?.[1] instanceof Error);

    const fb = ser("POST /api/edges", new Error(""));
    const fbBody = await fb.json();
    ok("R6 the tag fallback speaks when the message is empty", fbBody.error === "POST /api/edges failed", fbBody.error);
  } finally {
    console.error = origErr;
  }
}

/* ---- A: the tree tripwires ---- */
const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
};
{
  const offenders = [];
  for (const f of walk(path.join(ROOT, "src/app"))) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/internal server error/i.test(line)) offenders.push(`${path.relative(ROOT, f)}:${i + 1}`);
    });
  }
  ok("A1 zero 'Internal server error' in src/app", offenders.length === 0, offenders.slice(0, 4).join(", "));
}
{
  let sites = 0;
  for (const f of walk(path.join(ROOT, "src/app/api"))) {
    sites += (readFileSync(f, "utf8").match(/serverErrorReply\(/g) ?? []).length;
  }
  ok("A2 the re-keyed sites all speak the birthplace", sites >= 77, `sites=${sites}`);
}
{
  let defs = 0, defFiles = [];
  for (const f of walk(path.join(ROOT, "src"))) {
    const n = (readFileSync(f, "utf8").match(/export function serverErrorReply/g) ?? []).length;
    if (n) { defs += n; defFiles.push(path.relative(ROOT, f)); }
  }
  ok("A3 one definition — the single birthplace", defs === 1 && defFiles[0] === "src/lib/server-error.ts", defFiles.join(","));
}
{
  const rogues = [];
  for (const f of walk(path.join(ROOT, "src"))) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/import\s+\{[^}]*serverError(Retry|Reply)|serverErrorReply\s*\}\s*from/.test(line)) {
        // normalize: the import line must draw from @/lib/server-error
        if (!/from "@\/lib\/server-error"/.test(line)) rogues.push(`${path.relative(ROOT, f)}:${i + 1}`);
      }
    });
  }
  ok("A4 every import draws from @/lib/server-error", rogues.length === 0, rogues.slice(0, 4).join(", "));
}

/* ---- the receipt ---- */
const receipt = { instrument: "t960-server-error-unit", pass, fail, at: new Date().toISOString() };
const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nSERVER-ERROR-UNIT t960: ${pass}/${pass + fail} ${fail === 0 ? "green — the door's reason is in scope and it STAYS in scope" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
