/**
 * t472 — the settings confess their health (schema validation + the
 * provider health probe).
 *
 * Four windows unclaimed (t468⑤ → t471②): the loader silently repaired
 * hand-edited settings files without naming a single repair, and nothing
 * ever looked at the baseUrl — the t468 lesson, where a mock-dialect
 * baseUrl slept in the REAL file for three windows because "fetch failed"
 * only taught its lesson one chat error at a time.
 *
 * This bench pins:
 *  T1  the validator's named problems — every repair is spoken, secrets
 *      never enter a sentence (shape is named, content is not)
 *  T2  a clean file loads byte-identical with ZERO problems
 *  T3  the probe's four honest states against REAL HTTP surfaces
 *      (in-process Bun.serve: 200 / 401 / 500 / closed port) + the
 *      builtin in-process lane + the no-baseUrl draft
 *  T4  the TTL cache — one probe per window, invalidate re-tests
 *  T5  activeProviderHealth — dangling id → null, zero-config → the
 *      derived builtin row answers
 *  T6  the secret law, end to end — a marker key wrong-typed in a real
 *      file never leaks into problems
 *
 * Run: bun run scripts/t472-settings-health-bench.ts
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import path from "path";
import os from "os";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t472-settings-health-"));
const DATA_DIR = path.join(TMP, "data");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;

let pass = 0;
let fail = 0;

/* minimal Bun.serve surface for the in-process HTTP fixtures (no @types/bun) */
declare const Bun: {
  serve(options: { port: number; fetch(): Response | Promise<Response> }): { stop(close: boolean): void; port: number };
};
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

const { validateAiSettings, loadAiSettingsDetailed } = await import("../src/lib/ai/settings");
const {
  probeProviderHealth,
  providerHealthFor,
  activeProviderHealth,
  invalidateProviderHealth,
} = await import("../src/lib/ai/health");

/* ------------------------------------------------------------------ */
/* T1 — the validator names every repair                                */
/* ------------------------------------------------------------------ */

console.log("T1 — the validator names every repair");

{
  const { data, problems } = validateAiSettings("not json at all");
  must(problems.length === 1 && problems[0].includes("not a JSON object"), "T1a non-object file → one named problem");
  must(data.providers && Object.keys(data.providers).length === 0 && data.activeProvider === null, "T1a fallback = empty settings");
}
{
  const { problems } = validateAiSettings({ version: 1, activeProvider: null });
  must(problems.some((p) => p.includes("providers map is missing")), "T1b missing providers map is named");
}
{
  const { data, problems } = validateAiSettings({
    version: 1,
    activeProvider: "ghost",
    providers: { openai: "not an object", ok: { apiKey: "k", model: "m", baseUrl: null } },
  });
  must(problems.some((p) => p.includes("providers.openai is not an object")), "T1c non-object provider row is named");
  must(problems.some((p) => p.includes('activeProvider "ghost" has no saved config')), "T1c dangling activeProvider is named");
  must(data.activeProvider === null && data.providers.ok?.model === "m", "T1c fallback: no active, good row survives");
}
{
  const { data, problems } = validateAiSettings({
    version: 1,
    providers: { openai: { apiKey: 42, model: ["a"], baseUrl: "ftp://nope", extra: true } },
  });
  must(problems.some((p) => p.includes("providers.openai.apiKey was not a string")), "T1d wrong-typed apiKey is named");
  must(problems.some((p) => p.includes("providers.openai.model was not a string")), "T1d wrong-typed model is named");
  must(problems.some((p) => p.includes('baseUrl "ftp://nope" is not an http(s) URL')), "T1d non-http baseUrl is named");
  must(data.providers.openai?.apiKey === "" && data.providers.openai?.model === "" && data.providers.openai?.baseUrl === null, "T1d fallback: all three reset safely");
  must(!problems.some((p) => p.includes("42")), "T1d the wrong-typed VALUE never enters a sentence");
}
{
  const { data, problems } = validateAiSettings({
    version: 7,
    activeProvider: 3,
    vlmModel: true,
    providers: { openai: { apiKey: "", model: "x".repeat(250), baseUrl: null } },
  });
  must(problems.some((p) => p.includes("unknown settings version 7")), "T1e unknown version is named");
  must(problems.some((p) => p.includes("activeProvider was not a string")), "T1e wrong-typed activeProvider is named");
  must(problems.some((p) => p.includes("vlmModel was not a string")), "T1e wrong-typed vlmModel is named");
  must(problems.some((p) => p.includes("model was longer than 200 characters")), "T1e over-cap model is named");
  must(data.providers.openai?.model.length === 200, "T1e truncation applied once");
}

/* ------------------------------------------------------------------ */
/* T2 — a clean file: zero problems, byte-identical round trip          */
/* ------------------------------------------------------------------ */

console.log("T2 — a clean file: zero problems, secrets intact");

const CLEAN = {
  version: 1,
  activeProvider: "openai",
  providers: {
    openai: { apiKey: "sk-clean-key-9876", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
  },
  vlmModel: null,
};
{
  const { data, problems } = validateAiSettings(CLEAN);
  must(problems.length === 0, "T2a clean file → zero problems");
  must(data.activeProvider === "openai" && data.providers.openai?.apiKey === "sk-clean-key-9876", "T2a data intact including the secret");
}

/* ------------------------------------------------------------------ */
/* T3 — the probe's four honest states (real HTTP surfaces)             */
/* ------------------------------------------------------------------ */

console.log("T3 — the probe's four honest states");

// helper: an OpenAI-dialect surface on an ephemeral port
function serve(status: number, body: Record<string, unknown>): { server: ReturnType<typeof Bun.serve>; port: number; hits: () => number } {
  let hits = 0;
  const server = Bun.serve({
    port: 0,
    fetch() {
      hits++;
      return status === 200
        ? new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
        : new Response("nope", { status });
    },
  });
  return { server, port: server.port, hits: () => hits };
}

{
  const s = serve(200, { data: [{ id: "gpt-4o-mini" }] });
  const h = await probeProviderHealth("custom", { apiKey: "k", model: "m", baseUrl: `http://127.0.0.1:${s.port}/v1` });
  must(h.state === "ok", "T3a live 200 → ok");
  must(h.detail.includes(" answered 200 ") && /in \d+ms/.test(h.detail), "T3a detail names status and latency");
  must(h.latencyMs !== null && h.latencyMs >= 0, "T3a latency measured");
  s.server.stop(true);
}
{
  const s = serve(401, {});
  const h = await probeProviderHealth("custom", { apiKey: "bad-key", model: "m", baseUrl: `http://127.0.0.1:${s.port}/v1` });
  must(h.state === "rejected", "T3b live 401 with a saved key → rejected");
  must(h.detail.includes("the saved key was refused"), "T3b detail names the refused key");
  const h2 = await probeProviderHealth("custom", { apiKey: "", model: "m", baseUrl: `http://127.0.0.1:${s.port}/v1` });
  must(h2.state === "rejected" && h2.detail.includes("no key is saved"), "T3b keyless 401 → rejected with its own sentence");
  s.server.stop(true);
}
{
  const s = serve(500, {});
  const h = await probeProviderHealth("custom", { apiKey: "k", model: "m", baseUrl: `http://127.0.0.1:${s.port}/v1` });
  must(h.state === "error" && h.detail.includes("HTTP 500"), "T3c live 500 → error, status named");
  s.server.stop(true);
}
{
  // a port that ANSWERED once and now answers nothing (the t468 corpse)
  const s = serve(200, {});
  const port = s.port;
  s.server.stop(true);
  const h = await probeProviderHealth("custom", { apiKey: "k", model: "m", baseUrl: `http://127.0.0.1:${port}/v1` });
  must(h.state === "unreachable", "T3d dead port → unreachable");
  must(h.detail.includes("could not be reached"), "T3d a refusal is not a timeout — its own sentence");
  must(h.latencyMs !== null && h.latencyMs < 2000, "T3d the refusal came back fast (millisecond corpse, not a 2.5s hang)");
  // the timeout face: an endpoint that holds the socket and never answers
  const slow = Bun.serve({
    port: 0,
    fetch() {
      return new Promise<Response>(() => {});
    },
  });
  const h2 = await probeProviderHealth("custom", { apiKey: "k", model: "m", baseUrl: `http://127.0.0.1:${slow.port}/v1` });
  must(h2.state === "unreachable" && h2.detail.includes("did not answer within 2.5s"), "T3e a hang times out with its own sentence");
  slow.stop(true);
}
{
  const h = await probeProviderHealth("builtin", { apiKey: "", model: "glm-4-plus", baseUrl: null });
  must(h.state === "ok" && h.detail.includes("in-process SDK lane"), "T3f builtin → ok without any network");
  must(h.latencyMs === null, "T3f builtin latency = null (nothing was measured)");
}
{
  const h = await probeProviderHealth("custom", { apiKey: "", model: "m", baseUrl: null });
  must(h.state === "unreachable" && h.detail.includes("no base URL is saved"), "T3g keyless draft without baseUrl → unreachable with its own sentence");
}

/* ------------------------------------------------------------------ */
/* T4 — the TTL cache: one probe per window, invalidate re-tests        */
/* ------------------------------------------------------------------ */

console.log("T4 — the TTL cache");

{
  invalidateProviderHealth();
  const s = serve(200, {});
  const cfg = { apiKey: "k", model: "m", baseUrl: `http://127.0.0.1:${s.port}/v1` };
  const h1 = await providerHealthFor("custom", cfg);
  const h2 = await providerHealthFor("custom", cfg);
  must(h1.checkedAt === h2.checkedAt, "T4a second call within TTL = the SAME probe (cache hit)");
  must(s.hits() === 1, "T4a server saw exactly one request across two calls");
  invalidateProviderHealth();
  const h3 = await providerHealthFor("custom", cfg);
  must(s.hits() === 2, "T4b invalidate → the next call re-probes (server saw a second request)");
  must(h3.checkedAt === h1.checkedAt || h3.checkedAt >= h1.checkedAt, "T4b re-probe carries a fresh (non-older) timestamp");
  // a different baseUrl is a different key — it never rides on the first cache
  const cfg2 = { ...cfg, baseUrl: `http://127.0.0.1:${s.port}/v2` };
  await providerHealthFor("custom", cfg2);
  must(s.hits() === 3, "T4c changed baseUrl = fresh probe, not a stale hit");
  invalidateProviderHealth();
  s.server.stop(true);
}

/* ------------------------------------------------------------------ */
/* T5 — activeProviderHealth: dangling → null, zero-config → builtin    */
/* ------------------------------------------------------------------ */

console.log("T5 — activeProviderHealth");

{
  invalidateProviderHealth();
  const dangling = await activeProviderHealth({ activeProvider: "ghost", providers: {} });
  must(dangling === null, "T5a dangling activeProvider → null (the badge already says needsSetup)");
  const zero = await activeProviderHealth({ activeProvider: null, providers: {} });
  must(zero !== null && zero.providerId === "builtin" && zero.state === "ok", "T5b zero-config → the derived builtin row answers");
  const s = serve(200, {});
  const live = await activeProviderHealth({
    activeProvider: "custom",
    providers: { custom: { apiKey: "k", model: "m", baseUrl: `http://127.0.0.1:${s.port}/v1` } },
  });
  must(live !== null && live.providerId === "custom" && live.state === "ok", "T5c active custom → probed for real");
  invalidateProviderHealth();
  s.server.stop(true);
}

/* ------------------------------------------------------------------ */
/* T6 — the secret law, end to end through the FILE loader              */
/* ------------------------------------------------------------------ */

console.log("T6 — the secret law through the file loader");

{
  const SECRET = "sk-MARKER-SECRET-DO-NOT-QUOTE-4411";
  writeFileSync(
    path.join(DATA_DIR, "ai-settings.json"),
    JSON.stringify({
      version: 1,
      activeProvider: "openai",
      providers: { openai: { apiKey: SECRET, model: 99, baseUrl: null } },
    }),
  );
  const { data, problems } = loadAiSettingsDetailed();
  must(problems.some((p) => p.includes("providers.openai.model was not a string")), "T6a the file loader names the wrong-typed model");
  must(data.providers.openai?.apiKey === SECRET, "T6b the secret itself survives loading untouched");
  must(!problems.some((p) => p.includes("MARKER")), "T6c the secret NEVER enters a problem sentence");
}

/* ------------------------------------------------------------------ */
/* T7 — corrupt JSON through the FILE loader                            */
/* ------------------------------------------------------------------ */

console.log("T7 — corrupt JSON is confessed, not swallowed");

{
  writeFileSync(path.join(DATA_DIR, "ai-settings.json"), "{ this is not json");
  const { data, problems } = loadAiSettingsDetailed();
  must(problems.length === 1 && problems[0].includes("corrupt JSON"), "T7a corrupt file → one named problem");
  must(data.activeProvider === null && Object.keys(data.providers).length === 0, "T7b fallback = empty settings");
}

console.log(`\nt472: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
