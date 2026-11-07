#!/usr/bin/env node
/**
 * t1142 — THE LEDGER'S SERVER TIER unit: the world's memory outlives
 * the machine.
 *
 * THE SLICE (the t1134 pool's persistence candidate — the t1141 survey
 * named the cost before the wiring: an API + DB row, the ENVELOPE RIDES
 * UNCHANGED, the same reader reads it): the t1135 slice made the ledger
 * sessionStorage (the TAB's memory); t1141 added localStorage (the
 * MACHINE's memory); t1142 adds the SERVER tier — a project-scoped DB
 * row behind the family's door pair, so the memory outlives the machine
 * itself. The lib stays pure (the fetch is injected); the route rides
 * the family's guards; the dialog composes the tiers with the same
 * precedence law one tier deeper.
 *
 * THE LAWS PINNED:
 *   A  the envelope fathers — worldLedgerEnvelope is the ONE
 *      envelope-text father (byte-equal to the storage write);
 *      validateWorldLedgerEnvelope is the ONE trust decision (a refusal
 *      NAMES its reason; absent/empty is the honest absence, not a
 *      refusal); parseWorldLedgerEnvelope is the ONE read father (the
 *      storage getter RIDES it — the extract pinned by source); the
 *      download door's pretty face stays shape-equal; the tooth father
 *      (64 KiB) is the t1141 unit's bound made law.
 *   B  the server fathers — the read: 200+envelope restores, the null
 *      envelope is the server's honest absence, a non-200 or a thrown
 *      fetch is that tier's ABSENCE (never a throw); the write: the
 *      receipt boolean, the body carries the ONE father's bytes, the
 *      URL is the family's grammar, the method/content-type honest.
 *   C  the route — the family's door pair (http-guard both doors, the
 *      phantom 404 both doors, force-dynamic); the tooth 413 BEFORE the
 *      parse; the verdict's own reason spoken at 400; badJsonReply (the
 *      t973 one-birthplace); the verbatim store (no re-stringify — by
 *      ABSENCE of JSON.stringify in the route); the honest absence
 *      (row?.envelope ?? null); the lib's validator is the ONLY trust
 *      decision (no second envelope at the door).
 *   D  the wiring + the schema — the dialog imports BOTH server
 *      fathers; the fill asks AFTER the restore (restoredRef), ONCE per
 *      project (serverFillTriedRef), only on an empty ledger (the
 *      precedence: the deepest tier fills an empty machine), lands
 *      through the functional guard (the live story wins), and is
 *      cancelled with the effect (the ghost-hand law); the push rides
 *      the persist effect fire-and-forget (void — the board never waits
 *      on the network; the empty ledger is never pushed); the schema
 *      row is the envelope VERBATIM, one per project, cascade with the
 *      project.
 *
 * node scripts/unit-runner.mjs scripts/t1142-world-ledger-server-unit.mjs
 */
import { readFileSync } from "node:fs";
import {
  worldLedgerEnvelope,
  worldLedgerJson,
  validateWorldLedgerEnvelope,
  parseWorldLedgerEnvelope,
  readWorldLedgerStorage,
  writeWorldLedgerStorage,
  fetchWorldLedgerServer,
  pushWorldLedgerServer,
  WORLD_LEDGER_ENVELOPE_MAX_BYTES,
  WORLD_LEDGER_STORAGE_KEY,
  WORLD_LEDGER_CAP,
} from "../src/lib/world-vitals.ts";

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const lib = readFileSync("src/lib/world-vitals.ts", "utf8");
const route = readFileSync("src/app/api/projects/[id]/world-ledger/route.ts", "utf8");
const dlg = readFileSync("src/components/workflow/world-health-dialog.tsx", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");

/* ---------- fixtures (the tests construct fakes — the lib stays pure) ---------- */
const snap = (t, jobs = 15, edges = 14, running = 0, completed = 15, failed = 0) =>
  ({ t, jobs, edges, running, completed, failed });
const R1 = [snap(1000), snap(2000, 15, 14, 1, 14), snap(3000, 16, 14, 0, 16)];
const R2 = [snap(5000, 15, 14, 0, 15, 1), snap(6000, 15, 15, 0, 15)];
const fakeStore = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
  };
};
/** The fake fetcher: records the calls, answers from a script. */
const fakeFetcher = (script) => {
  const calls = [];
  const fetcher = async (input, init) => {
    calls.push({ input, init: init ?? null });
    const step = script[calls.length - 1];
    if (typeof step === "function") return step(input, init);
    if (step instanceof Response) return step;
    throw step ?? new Error("network down");
  };
  fetcher.calls = calls;
  return fetcher;
};
const jsonRes = (body, status = 200) => new Response(JSON.stringify(body), { status });

/* ================= A — the envelope fathers ================= */
console.log("\nA — the envelope fathers (one text, one trust decision, one read)");

const store = fakeStore();
writeWorldLedgerStorage(store, R1);
const storedRaw = store.getItem(WORLD_LEDGER_STORAGE_KEY);
ok("A1 the ONE envelope-text father — the storage write stores EXACTLY worldLedgerEnvelope's bytes",
  storedRaw === worldLedgerEnvelope(R1));

ok("A2 the parse round-trip restores the rows (the same reader reads it)",
  JSON.stringify(parseWorldLedgerEnvelope(worldLedgerEnvelope(R1))) === JSON.stringify(R1));

ok("A3 absent (null) is the HONEST ABSENCE, not a refusal — { ok: true, rows: [] }",
  (() => { const v = validateWorldLedgerEnvelope(null); return v.ok === true && v.rows.length === 0; })());
ok("A3b an empty string is the same honest absence",
  (() => { const v = validateWorldLedgerEnvelope(""); return v.ok === true && v.rows.length === 0; })());
ok("A4 bad JSON names bad-json",
  validateWorldLedgerEnvelope("{not json").reason === "bad-json");
ok("A4b a JSON null body names bad-json (not an object is not an envelope)",
  validateWorldLedgerEnvelope("null").reason === "bad-json");
ok("A4c a foreign version names bad-version (the version law's mouth)",
  validateWorldLedgerEnvelope(JSON.stringify({ v: 2, rows: R1 })).reason === "bad-version");
ok("A4d rows-not-an-array names bad-rows",
  validateWorldLedgerEnvelope(JSON.stringify({ v: 1, rows: "no" })).reason === "bad-rows");
ok("A4e over-cap names over-cap (the 240-cap law)",
  validateWorldLedgerEnvelope(JSON.stringify({ v: 1, rows: Array.from({ length: WORLD_LEDGER_CAP + 1 }, (_, i) => snap(i)) })).reason === "over-cap");
ok("A4f an off-shape row names bad-row-shape (never a half-trusted memory)",
  validateWorldLedgerEnvelope(JSON.stringify({ v: 1, rows: [snap(1), { t: 2, jobs: -1 }] })).reason === "bad-row-shape");

ok("A5 the reader's face — every refusal restores the honest []",
  parseWorldLedgerEnvelope("{oops").length === 0
    && parseWorldLedgerEnvelope(JSON.stringify({ v: 9, rows: R1 })).length === 0
    && parseWorldLedgerEnvelope(undefined).length === 0);

ok("A6 the storage getter RIDES the read father — no store [], refusal [], good rows (behavior identical post-extract)",
  readWorldLedgerStorage(null).length === 0
    && (() => { const s = fakeStore(); s.setItem(WORLD_LEDGER_STORAGE_KEY, "{oops"); return readWorldLedgerStorage(s).length === 0; })()
    && (() => { const s = fakeStore(); s.setItem(WORLD_LEDGER_STORAGE_KEY, worldLedgerEnvelope(R2)); return JSON.stringify(readWorldLedgerStorage(s)) === JSON.stringify(R2); })());

const readBody = lib.slice(lib.indexOf("export function readWorldLedgerStorage"), lib.indexOf("export function writeWorldLedgerStorage"));
ok("A6b the extract is REAL — the getter's body parses through the father, no private JSON.parse",
  readBody.includes("parseWorldLedgerEnvelope(raw)") && !readBody.includes("JSON.parse"));

ok("A7 the download door's pretty face stays shape-equal (each door keeps its own face — the t1139 law)",
  (() => {
    const pretty = worldLedgerJson(R1);
    return pretty === JSON.stringify({ v: 1, rows: R1 }, null, 2)
      && JSON.stringify(parseWorldLedgerEnvelope(pretty)) === JSON.stringify(R1);
  })());

ok("A8 the tooth father — 64 KiB (the t1141 unit's byte bound made law)",
  WORLD_LEDGER_ENVELOPE_MAX_BYTES === 65536);

/* ================= B — the server fathers ================= */
console.log("\nB — the server fathers (the read's absence, the write's receipt)");

const URL_PATH = `/api/projects/p1/world-ledger`;
{
  const f = fakeFetcher([jsonRes({ envelope: worldLedgerEnvelope(R2) })]);
  const read = await fetchWorldLedgerServer(f, "p1");
  ok("B1 the read: 200+envelope restores the rows through the ONE parse father",
    read.reachable === true && JSON.stringify(read.rows) === JSON.stringify(R2));
  ok("B1b the URL is the family's grammar", f.calls[0].input === URL_PATH
    && f.calls[0].init?.method === "GET");
}
{
  const f = fakeFetcher([jsonRes({ envelope: null })]);
  const read = await fetchWorldLedgerServer(f, "p1");
  ok("B2 a null envelope is the server's honest absence — reachable, zero rows (never a guessed {})",
    read.reachable === true && read.rows.length === 0);
}
{
  const f = fakeFetcher([new Response("nope", { status: 404 })]);
  const read = await fetchWorldLedgerServer(f, "p1");
  ok("B3 a non-200 is that tier's ABSENCE — [] + unreachable",
    read.reachable === false && read.rows.length === 0);
}
{
  const f = fakeFetcher([new Error("network down")]);
  const read = await fetchWorldLedgerServer(f, "p1");
  ok("B4 a thrown fetch is the same absence and NEVER a throw",
    read.reachable === false && read.rows.length === 0);
}
{
  const f = fakeFetcher([jsonRes({ ok: true })]);
  const receipt = await pushWorldLedgerServer(f, "p1", R1);
  ok("B5 the write: 2xx → the true receipt", receipt === true);
  const call = f.calls[0];
  ok("B5b the body carries the ONE father's bytes (byte-equal to the storage write)",
    JSON.parse(call.init.body).envelope === worldLedgerEnvelope(R1));
  ok("B5c the method and the content-type honest (PUT / application/json)",
    call.init.method === "PUT" && call.init.headers["content-type"] === "application/json");
}
{
  const f = fakeFetcher([new Response("no", { status: 500 })]);
  ok("B6 a non-2xx → the false receipt (a refusal degrades that tier alone)",
    (await pushWorldLedgerServer(f, "p1", R1)) === false);
}
{
  const f = fakeFetcher([new Error("down")]);
  ok("B7 a thrown push is the false receipt and never a throw",
    (await pushWorldLedgerServer(f, "p1", R1)) === false);
}

/* ================= C — the route (the family's door pair) ================= */
console.log("\nC — the route (guards, the tooth, the verdict's voice, the verbatim store)");

ok("C1 the http-guard at BOTH doors (the family's door pair)",
  (route.match(/isLocalRequest\(request\)/g) ?? []).length === 2
    && (route.match(/status: 403/g) ?? []).length === 2);
ok("C2 the phantom gate at BOTH doors (findUnique → 404 — a foreign id is refused)",
  (route.match(/db\.project\.findUnique/g) ?? []).length === 2
    && (route.match(/status: 404/g) ?? []).length === 2);
ok("C3 force-dynamic (the family's freshness law)",
  route.includes('export const dynamic = "force-dynamic"'));
ok("C4 the tooth enforced BEFORE the parse — 64 KiB → 413",
  route.includes("WORLD_LEDGER_ENVELOPE_MAX_BYTES") && route.includes("status: 413")
    && route.indexOf("WORLD_LEDGER_ENVELOPE_MAX_BYTES") < route.indexOf("validateWorldLedgerEnvelope(envelope)"));
ok("C5 the verdict's own reason spoken at 400 (a refusal names itself)",
  route.includes("validateWorldLedgerEnvelope(envelope)") && route.includes("verdict.reason")
    && route.includes("status: 400"));
ok("C6 the malformed frame rides badJsonReply (the t973 one-birthplace)",
  route.includes("badJsonReply("));
ok("C7 the verbatim store — the envelope passes through untouched (NO re-stringify in the route, by ABSENCE)",
  route.includes("upsert({") && route.includes("create: { projectId: id, envelope }")
    && !route.includes("JSON.stringify"));
ok("C8 the honest absence face — row?.envelope ?? null (never a guessed {})",
  route.includes("row?.envelope ?? null"));
ok("C9 the lib's validator is the ONLY trust decision — no JSON.parse of the envelope in the route",
  route.includes('from "@/lib/world-vitals"') && !route.includes("JSON.parse"));

/* ================= D — the wiring + the schema ================= */
console.log("\nD — the dialog's composition + the schema's row");

ok("D1 the dialog imports BOTH server fathers (the one-father law at the door)",
  dlg.includes("fetchWorldLedgerServer,") && dlg.includes("pushWorldLedgerServer,"));
const fillBody = dlg.slice(dlg.indexOf("SERVER tier's fill"), dlg.indexOf("}, [projectId, history.length]"));
ok("D2 the fill asks AFTER the restore (the restore effect declared before the fill effect, and the fill's gate rides the restore's receipt)",
  dlg.indexOf("restoredRef.current = true;") < dlg.indexOf("SERVER tier's fill")
    && fillBody.includes("!projectId || !restoredRef.current"));
ok("D2b the fill's gate rides BOTH keys (the project id and the restore's receipt)",
  fillBody.includes("!projectId || !restoredRef.current"));
ok("D3 ONCE per project — serverFillTriedRef marks before the ask",
  fillBody.includes("serverFillTriedRef.current === projectId") && fillBody.includes("serverFillTriedRef.current = projectId"));
ok("D4 the precedence — a non-empty ledger means the server is NOT EVEN ASKED",
  fillBody.includes("if (history.length > 0) return;"));
ok("D5 the live story wins — the fill lands through the functional guard",
  fillBody.includes("setHistory((prev) => (prev.length === 0 ? read.rows : prev))"));
ok("D6 the ghost-hand law — the fetch is cancelled with the effect",
  fillBody.includes("let cancelled = false;") && fillBody.includes("cancelled = true"));
const persistBody = dlg.slice(dlg.indexOf("if (!restoredRef.current || history.length === 0) return;"), dlg.indexOf("}, [history, projectId]);"));
ok("D7 the push rides the persist effect (the SAME write-through — no second writer)",
  persistBody.includes("writeWorldLedgerTiers(session, local, history);")
    && persistBody.includes("void pushWorldLedgerServer(fetch, projectId, history)"));
ok("D7b fire-and-forget — the void marks the board never waits on the network",
  persistBody.includes("void pushWorldLedgerServer"));
ok("D8 the empty ledger is never written (the honest-absence door — absence stays absent on every tier)",
  persistBody.includes("if (!restoredRef.current || history.length === 0) return;"));
ok("D9 the schema row — model WorldLedger, the envelope VERBATIM, one per project (projectId @id)",
  schema.includes("model WorldLedger {") && schema.includes("projectId String   @id")
    && schema.includes("envelope  String"));
ok("D9b the row dies with its project (the cascade — a world's memory has no meaning without its world)",
  /model WorldLedger \{[\s\S]*?onDelete: Cascade[\s\S]*?\}/.test(schema));
ok("D9c the Project relation holds (worldLedger WorldLedger?)",
  schema.includes("worldLedger WorldLedger?"));

/* ---------- verdict ---------- */
console.log(`\nWORLD-LEDGER-SERVER-UNIT t1142: ${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
