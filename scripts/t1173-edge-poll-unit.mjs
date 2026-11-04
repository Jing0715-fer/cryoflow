// t1173 — THE WIRE POLL UNIT: the edges lane's ride on the poll becomes a
// standing instrument.
//
// The vein: t1172's flights filmed F2.2's select rider reading DISABLED on
// the re-opened dialog — and the autopsy named a REAL app gap, not a film
// bug: the poll only refreshed JOBS (t370's lane), so a wire created
// outside the browser (another tab, the AI's server-side tools, an API
// script, a film's throwaway world) reached an open canvas only on a full
// reload. The select rider's plan re-derives from the store's edge truth,
// and the store never learned the API-drawn wire — the gate closed
// honestly over a world the browser could not see.
//
// The cure rides ONE ingest (ingestEdgesTick) with every law carried home
// from its own well: the t393 token (an unmoved wire world answers ~40
// bytes), the t370 tombstones (a pre-commit GET cannot resurrect a wire
// the user saw vanish — and the restore path revives), the orphan filter
// (a wire outrunning its card is dropped AND the token stays unadopted —
// the next tick re-fetches and lands it: self-healing, no token trap),
// reference stability (unchanged wires reuse their objects; an
// all-unchanged tick sets nothing), and the in-flight re-attach
// (unconfirmedEdges — connect's AND the adopt's client-minted ids whose
// POST is in the air — never blink in a poll race).
//
// This seat pins the source laws (comments stripped — prose quoting a
// poison is not a破戒) and runs the merge semantics on fixtures through a
// spec twin, so the next window's drift flaps here instead of living
// quietly.
//
// node scripts/t1173-edge-poll-unit.mjs
//

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project";
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** strip block + line comments so prose mentioning a poison never flaps a pin */
function codeOf(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const store = codeOf(read("src/lib/store.ts"));
const route = codeOf(read("src/app/api/edges/route.ts"));

// ── A — the route law: the token rides the wire read ────────────────────

ok("A1 the route minted its own edgesVersionOf (the t393 shape carried home)", /function edgesVersionOf\(projectId: string, body: string\)/.test(route));
ok("A2 the hash is the two-lane djb2 family (33/31, the 5381/52711 seeds, length + project tail)", /h1 = \(h1 \* 33 \+ c\) \| 0;/.test(route) && /h2 = \(h2 \* 31 \+ c\) \| 0;/.test(route) && /\.\$\{body\.length\}\.\$\{projectId\.slice\(-6\)\}/.test(route));
ok("A3 the token verdict answers unchanged ONLY on a caller-seen match", /if \(seen && seen === edgesVersionOf\(active\.project\.id, body\)\)/.test(route) && /unchanged: true/.test(route));
ok("A4 the body is serialized ONCE and returned verbatim (the hashed string IS the traveled string)", /const body = JSON\.stringify\(\{ edges \}\);/.test(route) && /new NextResponse\(body, \{/.test(route));
ok("A5 the t710 read-half door still speaks first", route.indexOf("isLocalRequest(request)") < route.indexOf("getActiveProject()"));

// the pure twin of the hash FORMAT (the route fn is not importable bare;
// the twin pins the token's shape the client stores and re-sends)
function edgesVersionTwin(projectId, body) {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i);
    h1 = (h1 * 33 + c) | 0;
    h2 = (h2 * 31 + c) | 0;
  }
  return `${h1.toString(36)}.${h2.toString(36)}.${body.length}.${projectId.slice(-6)}`;
}
const golden = edgesVersionTwin("cmw0xcq9z0000uc04ftgfqcls", JSON.stringify({ edges: [] }));
ok("A6 the token's shape: lane.lane.length.projecttail", /^\-?[0-9a-z]+\.\-?[0-9a-z]+\.\d+\.gfqcls$/.test(golden), golden);
ok("A7 the token is deterministic and body-sensitive", edgesVersionTwin("p1", JSON.stringify({ edges: [1] })) !== edgesVersionTwin("p1", JSON.stringify({ edges: [2] })) && edgesVersionTwin("p1", "x") === edgesVersionTwin("p1", "x"));

// ── B — the store law: ONE ingest, every law carried home ───────────────

ok("B1 pollTick's first act is the wire leg (the jobs-unchanged early return can never starve it)", store.indexOf("await ingestEdgesTick(get, set);") < store.indexOf("const token = get().jobsVersion;"));
ok("B2 the ingest guards itself (one at a time — the pollInFlight law, wire edition)", /let edgesIngestInFlight = false;/.test(store) && /if \(edgesIngestInFlight\) return;/.test(store));
ok("B3 the token rides the wire GET (null → full body)", /token \? `\/api\/edges\?v=\$\{encodeURIComponent\(token\)\}` : "\/api\/edges"/.test(store));
ok("B4 an unchanged wire world costs zero work", /if \(edata\.unchanged\) return;/.test(store));
ok("B5 the tombstone filter runs before the merge (withoutResurrectedEdges)", /const fresh = withoutResurrectedEdges\(edata\.edges \?\? \[\]\);/.test(store));
ok("B6 the orphan filter: both endpoints must be cards the store holds", /jobIds\.has\(e\.fromJobId\) && jobIds\.has\(e\.toJobId\)/.test(store));
ok("B7 a dropped tick keeps the old token (the self-heal — the full body comes back next tick)", /edgesVersion: dropped \? get\(\)\.edgesVersion : version,/.test(store));
ok("B8 an all-unchanged tick adopts only the token (never a new array ref)", /if \(!changed\) \{[\s\S]*?if \(!dropped && version !== get\(\)\.edgesVersion\) set\(\{ edgesVersion: version \}\);[\s\S]*?return;/m.test(store));
ok("B9 reference stability: the 5-field edgeEquals reuses the previous object", /function edgeEquals\(a: EdgeDTO, b: EdgeDTO\): boolean/.test(store) && /a\.fromPort === b\.fromPort &&/.test(store) && /if \(old && edgeEquals\(old, e\)\) return old;/.test(store));
ok("B10 the in-flight re-attach: unconfirmed wires the server list lacks stay in the store", /unconfirmedEdges\.has\(e\.id\) && !keepIds\.has\(e\.id\)/.test(store));
ok("B11 refreshEdges rides the ONE ingest (the t419 naive replace is gone)", /refreshEdges: async \(\) => \{[\s\S]*?await ingestEdgesTick\(get, set\);[\s\S]*?\},/m.test(store));
ok("B12 removeEdge tombstones at the vanishing (the t370 law, wire edition)", /tombstoneEdgeIds\(\[id\]\);/.test(store));
ok("B13 the failure-restore revives the tombstone (an intentional comeback is never filtered)", /reviveEdgeIds\(\[id\]\);/.test(store));
ok("B14 the adopt's optimistic wires enroll in unconfirmedEdges (connect's bookkeeping, shared)", /for \(const ne of newEdges\) unconfirmedEdges\.add\(ne\.id\);/.test(store) && /unconfirmedEdges\.delete\(ne\.id\);/.test(store));
ok("B15 load() turns the wire token over WITH the project (the aliasing law)", /edgesVersion: null,/.test(store));
ok("B16 the tombstone trio shares the jobs' TTL window", /const recentlyDeletedEdges = new Map<string, number>\(\);/.test(store) && /now - at > TOMBSTONE_TTL_MS/.test(store));

// ── C — the merge semantics, on fixtures (the spec twin) ────────────────

// The twin re-derives ingestEdgesTick's merge from the pinned laws so the
// SEMANTICS run: orphan drop + token hold, the landing tick, the
// tombstone, the no-op, the in-flight re-attach. The source pins above
// bind the twin to the file; a drift in either flaps.

function makeIngest() {
  const state = {
    jobs: [{ id: "jA" }, { id: "jB" }],
    edges: [],
    edgesVersion: null,
    sets: [],
  };
  const tombstones = new Map();
  const unconfirmed = new Set();
  const TTL = 15_000;
  let now = 1_000_000;
  const withoutResurrected = (list) =>
    list.filter((e) => !(tombstones.has(e.id) && now - tombstones.get(e.id) <= TTL));
  const edgeEquals = (a, b) =>
    a.id === b.id && a.fromJobId === b.fromJobId && a.toJobId === b.toJobId &&
    a.fromPort === b.fromPort && a.toPort === b.toPort;
  return {
    state,
    unconfirmed,
    tombstone: (ids) => { for (const id of ids) tombstones.set(id, now); },
    revive: (ids) => { for (const id of ids) tombstones.delete(id); },
    tick(edata) {
      if (edata.unchanged) return;
      now += 9_000; // the idle cadence moves time between ticks
      const fresh = withoutResurrected(edata.edges ?? []);
      const version = edata.version ?? null;
      const prev = state.edges;
      const jobIds = new Set(state.jobs.map((j) => j.id));
      let dropped = false;
      const keep = fresh.filter((e) => {
        if (jobIds.has(e.fromJobId) && jobIds.has(e.toJobId)) return true;
        dropped = true;
        return false;
      });
      const keepIds = new Set(keep.map((e) => e.id));
      const flying = prev.filter((e) => unconfirmed.has(e.id) && !keepIds.has(e.id));
      const target = [...keep, ...flying];
      const prevById = new Map(prev.map((e) => [e.id, e]));
      let changed = prev.length !== target.length;
      const merged = target.map((e) => {
        const old = prevById.get(e.id);
        if (old && edgeEquals(old, e)) return old;
        changed = true;
        return e;
      });
      if (!changed) {
        if (!dropped && version !== state.edgesVersion) {
          state.edgesVersion = version;
          state.sets.push({ edgesVersion: version });
        }
        return;
      }
      state.edges = merged;
      state.edgesVersion = dropped ? state.edgesVersion : version;
      state.sets.push({ edges: merged, edgesVersion: state.edgesVersion });
    },
  };
}

const wire = (id, from, to, fromPort, toPort) => ({ id, fromJobId: from, toJobId: to, fromPort, toPort });

// C1 — a wire outrunning its card: dropped, token kept, the next tick (the
// card landed) lands the wire AND the token — the self-heal, no trap.
{
  const g = makeIngest();
  g.tick({ edges: [wire("e1", "jA", "jGHOST")], version: "v1" });
  ok("C1a the orphan wire is dropped and the token stays unadopted", g.state.edges.length === 0 && g.state.edgesVersion === null);
  g.state.jobs.push({ id: "jGHOST" });
  g.tick({ edges: [wire("e1", "jA", "jGHOST")], version: "v1" });
  ok("C1b the next tick lands the wire AND adopts the token (self-healed)", g.state.edges.length === 1 && g.state.edgesVersion === "v1");
}
// C2 — a wire the user saw vanish cannot resurrect from a pre-commit GET;
// the restore path revives it on purpose.
{
  const g = makeIngest();
  g.state.edges = [wire("e1", "jA", "jB")];
  g.tombstone(["e1"]);
  g.tick({ edges: [wire("e1", "jA", "jB")], version: "v2" });
  ok("C2a the tombstoned wire never rides back in", g.state.edges.length === 0);
  g.state.edges = [];
  g.revive(["e1"]);
  g.tick({ edges: [wire("e1", "jA", "jB")], version: "v3" });
  ok("C2b the revived wire lands on purpose", g.state.edges.length === 1);
}
// C3 — an unchanged body is a zero-render no-op that still adopts the
// token; a body that moved but renders identically is the same no-op.
{
  const g = makeIngest();
  g.state.edges = [wire("e1", "jA", "jB", "particles", "particles")];
  g.state.edgesVersion = "v1";
  g.tick({ unchanged: true });
  ok("C3a the unchanged tick is zero work", g.state.sets.length === 0);
  g.tick({ edges: [wire("e1", "jA", "jB", "particles", "particles")], version: "v2" });
  ok("C3b the render-identical body adopts the token only", g.state.sets.length === 1 && g.state.edgesVersion === "v2" && g.state.edges.length === 1);
}
// C4 — an in-flight optimistic wire the server list lacks survives the
// poll race; the landing retires the id and the server truth takes over.
{
  const g = makeIngest();
  g.state.edges = [wire("opt1", "jB", "jA")];
  g.unconfirmed.add("opt1");
  g.tick({ edges: [wire("e1", "jA", "jB")], version: "v4" });
  ok("C4a the flying wire re-attaches through the poll race", g.state.edges.some((e) => e.id === "opt1") && g.state.edges.some((e) => e.id === "e1"));
  g.unconfirmed.delete("opt1");
  g.state.edges = g.state.edges.filter((e) => e.id !== "opt1");
  g.tick({ edges: [wire("e1", "jA", "jB")], version: "v5" });
  ok("C4b after the landing the server truth is the only truth", g.state.edges.length === 1 && g.state.edges[0].id === "e1");
}
// C5 — a port flip is a real change (the reference-stability compare is
// 5 fields, not an id check).
{
  const g = makeIngest();
  g.state.edges = [wire("e1", "jA", "jB", "particles", "particles")];
  g.tick({ edges: [wire("e1", "jA", "jB", "half1", "particles")], version: "v6" });
  ok("C5 the port flip lands as a change", g.state.edges[0].fromPort === "half1" && g.state.edgesVersion === "v6");
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
