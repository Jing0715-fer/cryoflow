/**
 * t474 — the dialog takes the roll (every SAVED provider's health).
 *
 * t472 taught the ACTIVE provider to confess on the header badge; the
 * settings dialog's rail still showed the other saved providers mute —
 * the user could save-and-activate a dead endpoint the roster had
 * already given up on. The roll call (providerRosterHealth + GET
 * /api/ai/providers/health + the dialog's dots) makes every saved
 * provider answer in one parallel sweep.
 *
 * This bench pins:
 *  T1  roster shape — saved ids answer, nothing is invented (a dangling
 *      activeProvider adds no row), the zero-config identity gets the
 *      synthetic builtin row, unsaved catalog ids stay out
 *  T2  the four honest states through the roster against REAL HTTP
 *      surfaces (in-process Bun.serve: 200 / closed port / 401 / 500)
 *  T3  the TTL across the roster — one probe per provider per window
 *      (server hit count is the evidence), refresh re-tests AND writes
 *      the fresh answers back (the next cached call agrees with them)
 *  T4  the secret law through the roster — a marker key never enters a
 *      detail sentence, the refusal says "the saved key was refused"
 *  T5  a mixed roster — the saved builtin row answers in-process (no
 *      network) beside a probed custom row
 *
 * Run: bun run scripts/t474-roster-health-bench.ts
 */

import path from "path";
import os from "os";
import { mkdirSync, mkdtempSync } from "fs";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t474-roster-health-"));
const DATA_DIR = path.join(TMP, "data");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;

let pass = 0;
let fail = 0;

/* minimal Bun.serve surface for the in-process HTTP fixtures (no @types/bun) */
declare const Bun: {
  serve(options: {
    port: number;
    fetch(): Response | Promise<Response>;
  }): { stop(close: boolean): void; port: number };
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

const { providerRosterHealth, invalidateProviderHealth } = await import("../src/lib/ai/health");

/* a port that answers, then dies — the refusal fixture needs a REAL
   recently-alive port (an arbitrary unused one may just as well be
   firewalled; a stopped listener refuses honestly) */
function takePortThenDie(): number {
  const s = Bun.serve({ port: 0, fetch: () => new Response("gone") });
  const port = s.port;
  s.stop(true);
  return port;
}

/* a counting server — hit count is the TTL evidence (checkedAt can tie
   within the same millisecond, the t472 T4b lesson) */
function countingServer(status: number) {
  let hits = 0;
  const s = Bun.serve({
    port: 0,
    fetch: () => {
      hits++;
      return status === 200
        ? Response.json({ data: [] })
        : new Response("no", { status });
    },
  });
  return { server: s, hits: () => hits, base: `http://127.0.0.1:${s.port}/v1` };
}

/* ------------------------------------------------------------------ */
/* T1 — roster shape                                                    */
/* ------------------------------------------------------------------ */

console.log("T1 — the roster answers for the saved, invents nothing");

{
  const live = countingServer(200);
  const dead = takePortThenDie();
  const roster = await providerRosterHealth({
    activeProvider: "t1-live",
    providers: {
      "t1-live": { apiKey: "", model: "m", baseUrl: live.base },
      "t1-dead": { apiKey: "", model: "m", baseUrl: `http://127.0.0.1:${dead}/v1` },
    },
  });
  must(Object.keys(roster).length === 2, "T1a every saved provider answers, nothing more");
  must(roster["t1-live"]?.state === "ok", "T1b the live row says ok");
  must(roster["t1-dead"]?.state === "unreachable", "T1c the dead row says unreachable");
  live.server.stop(true);
}

{
  // dangling activeProvider: the badge already says needsSetup — the
  // roster must NOT invent a row for a config that does not exist
  const roster = await providerRosterHealth({
    activeProvider: "ghost",
    providers: { "t1-saved": { apiKey: "", model: "m", baseUrl: null } },
  });
  must(
    Object.keys(roster).length === 1 && roster.ghost === undefined && roster["t1-saved"] !== undefined,
    "T1d a dangling activeProvider adds no row",
  );
}

{
  // zero-config identity — the derived builtin row answers (mirrors
  // activeProviderHealth's synthesis; the roster always has one truth)
  const roster = await providerRosterHealth({ activeProvider: null, providers: {} });
  must(
    roster.builtin?.state === "ok" && roster.builtin.detail.includes("in-process SDK lane"),
    "T1e zero-config → the synthetic builtin row answers",
  );
}

{
  // zero-config with builtin ALREADY saved — exactly one row, no dupe
  const roster = await providerRosterHealth({
    activeProvider: "builtin",
    providers: { builtin: { apiKey: "", model: "glm-4-plus", baseUrl: null } },
  });
  must(
    Object.keys(roster).length === 1 && roster.builtin?.state === "ok",
    "T1f a saved builtin is the whole roster",
  );
}

/* ------------------------------------------------------------------ */
/* T2 — the four honest states, through the roster                      */
/* ------------------------------------------------------------------ */

console.log("T2 — four states, one sweep");

{
  invalidateProviderHealth();
  const ok200 = countingServer(200);
  const dead = takePortThenDie();
  const rej = countingServer(401);
  const err = countingServer(500);
  const roster = await providerRosterHealth({
    activeProvider: null,
    providers: {
      "t2-ok": { apiKey: "", model: "m", baseUrl: ok200.base },
      "t2-dead": { apiKey: "", model: "m", baseUrl: `http://127.0.0.1:${dead}/v1` },
      "t2-rej": { apiKey: "sk-t2", model: "m", baseUrl: rej.base },
      "t2-err": { apiKey: "", model: "m", baseUrl: err.base },
    },
  });
  must(roster["t2-ok"]?.state === "ok" && typeof roster["t2-ok"].latencyMs === "number", "T2a 200 → ok with latency");
  must(roster["t2-ok"]?.detail.includes(`${ok200.base}/models`), "T2b the ok sentence names what was probed");
  must(
    roster["t2-dead"]?.state === "unreachable" && roster["t2-dead"].detail.includes("could not be reached"),
    "T2c a refusal says could not be reached (not a timeout)",
  );
  must((roster["t2-dead"]?.latencyMs ?? 9e9) < 2000, "T2d the refusal came back fast (it was not a hang)");
  must(
    roster["t2-rej"]?.state === "rejected" && roster["t2-rej"].detail.includes("the saved key was refused"),
    "T2e 401 with a key → the key was refused",
  );
  must(roster["t2-err"]?.state === "error" && roster["t2-err"].detail.includes("HTTP 500"), "T2f 500 → error names the status");
  for (const s of [ok200, rej, err]) s.server.stop(true);
}

/* ------------------------------------------------------------------ */
/* T3 — the TTL across the roster + refresh writes back                 */
/* ------------------------------------------------------------------ */

console.log("T3 — one probe per window; refresh re-tests and becomes the cache");

{
  invalidateProviderHealth();
  const live = countingServer(200);
  const cfg = { apiKey: "", model: "m", baseUrl: live.base };
  const data = { activeProvider: "t3-live", providers: { "t3-live": cfg } };

  await providerRosterHealth(data);
  const afterFirst = live.hits();
  await providerRosterHealth(data);
  must(live.hits() === afterFirst, "T3a the second roster call inside the window re-probes nothing");

  const refreshed = await providerRosterHealth(data, { refresh: true });
  must(live.hits() === afterFirst + 1, "T3b refresh re-tested (the hit count moved by one)");

  const cached = await providerRosterHealth(data);
  must(
    live.hits() === afterFirst + 1 && cached["t3-live"]?.checkedAt === refreshed["t3-live"]?.checkedAt,
    "T3c refresh WROTE the cache — the next cached call agrees with it",
  );
  live.server.stop(true);
}

/* ------------------------------------------------------------------ */
/* T4 — the secret law through the roster                               */
/* ------------------------------------------------------------------ */

console.log("T4 — the marker key never enters a roster sentence");

{
  invalidateProviderHealth();
  const SECRET = "sk-MARKER-ROSTER-SECRET-DO-NOT-QUOTE-4747";
  const rej = countingServer(401);
  const roster = await providerRosterHealth({
    activeProvider: null,
    providers: { "t4-rej": { apiKey: SECRET, model: "m", baseUrl: rej.base } },
  });
  const detail = roster["t4-rej"]?.detail ?? "";
  must(detail.includes("the saved key was refused"), "T4a the refusal says the key was refused");
  must(!detail.includes("MARKER") && !detail.includes(SECRET), "T4b the key itself never crosses into the sentence");
  rej.server.stop(true);
}

/* ------------------------------------------------------------------ */
/* T5 — a mixed roster: builtin beside a probed custom                  */
/* ------------------------------------------------------------------ */

console.log("T5 — the saved builtin answers in-process, beside the probed");

{
  invalidateProviderHealth();
  const live = countingServer(200);
  const roster = await providerRosterHealth({
    activeProvider: "builtin",
    providers: {
      builtin: { apiKey: "", model: "glm-4-plus", baseUrl: null },
      "t5-live": { apiKey: "", model: "m", baseUrl: live.base },
    },
  });
  must(
    roster.builtin?.state === "ok" && roster.builtin.latencyMs === null && roster.builtin.detail.includes("in-process SDK lane"),
    "T5a the builtin row: ok, no latency, no endpoint to miss",
  );
  must(roster["t5-live"]?.state === "ok", "T5b the custom row was actually probed");
  live.server.stop(true);
}

console.log(`\nt474: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
