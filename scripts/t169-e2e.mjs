// t169 — Task 169: the tables stop being copied — ONE parser, FOUR tables,
// ZERO mirrors. Task 165's signature tables grew by hand-listing; Task 167's
// scanner classified with a HAND-COPIED mirror of the fixture table while
// its X phase parsed the real one — two readings of one truth in the same
// file — and Task 168's W scan copied the three domain tables again. A
// mirror goes stale the moment the real table evolves: a 7th entry would be
// invisible to the classifier, which would false-alarm NO-SIGNATURE on the
// new owner's seeds while every "mirror agrees" oracle stayed green (they
// only ever pinned SELECTED members, never mirror==table).
//
// This probe pins the replacement contract:
//   S  baseline roster + the real parse (the lib module)
//   X  parser-contract oracles: per-table floors (fixture 6 / project 4 /
//      ws 5 / tpl 4), every entry owner+why, canonicalProject exact, the
//      first-contact members pinned by their source literals, and the
//      prefix-family derivation (T/t → prefix-kind; explicit nets → not)
//   B  CORE runtime drills THROUGH the parsed table: a drill name is
//      derived from a parsed regex (assert the derivation, seed it, run
//      world-hygiene, watch the audits sweep it) — job fixture-orphan,
//      ws-orphan, template-orphan, plus the prefix-less control the parsed
//      table must NOT touch (owner deletes by id, the 165 contract in the
//      probe's own hands). The project domain has no drill here BY
//      DESIGN: t168's C1 owns the faceshift window, and duplicating that
//      drill buys no new truth while adding the riskiest window in the
//      world to every matrix round.
//   C  canonical insurance over the LIVE world: every parsed regex from
//      all four tables, tested against every roster name + the canonical
//      trio + the canonical project → ZERO hits (the table must never eat
//      the world it serves — now over the whole world, not a sample)
//   D  the parser is an ENFORCER: a table with a missing why, a renamed
//      table, a computed re:, an emptied table — each must THROW; plus
//      the zero-roster guard static pin (extent-fit's j.length > 0, Task
//      168's first contact) and the MIRROR-FREE oracle: t167/t168 sources
//      must no longer declare hand-copied signature arrays (a surviving
//      mirror is a second source of truth — the t166 doctrine)
//   Z  roster identity vs the S baseline (unknown-id diff both ways)
//
// Run: node scripts/t169-e2e.mjs   (server on :3000, no browser needed)

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHygieneTables, isPrefixFamily } from "./lib/hygiene-tables.mjs";
const run = promisify(execFile);

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const SCRIPTS = join(ROOT, "scripts");
const hygieneSrc = readFileSync(`${ROOT}/scripts/world-hygiene.mjs`, "utf8");

let checks = 0;
let failed = null;
const must = (cond, msg) => {
  checks++;
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    if (failed == null) failed = msg;
    throw new Error(`t169: ${msg}`); // fail THIS instant — evidence over politeness
  }
  console.log(`  ok: ${msg}`);
};

// hoisted drill handles — Z's cleanup must never be shadowed by a try-body
// redeclaration (the t164 lesson)
let drillJobId = null;      // B's "T169 Drill Anchor" fixture row
let drillWsId = null;       // B's "T169 dest" workspace
let drillTplId = null;      // B's "T169 branch" template
let controlId = null;       // B's prefix-less control row (owner deletes by id)

const roster = async () =>
  (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
const seed = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`t169: seed POST → ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.job ?? j; // unwrap the {job:{...}} envelope — the vacuous-pass guard
};
const del = async (id) => fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" });
const seedWs = async (name) => {
  const r = await fetch(`${BASE}/api/workspaces`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error(`t169: seedWs → ${r.status}`);
  const w = await r.json();
  return w.workspace ?? w;
};
const seedTpl = async (name) => {
  const r = await fetch(`${BASE}/api/custom-template`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      payload: { jobs: [{ type: "import", dx: 0, dy: 0, params: {} }], edges: [] },
    }),
  });
  if (!r.ok) throw new Error(`t169: seedTpl → ${r.status}`);
  const t = await r.json();
  return t.template ?? t;
};
const runHygiene = async () => {
  const { stdout } = await run("node", [`${ROOT}/scripts/world-hygiene.mjs`], {
    cwd: ROOT,
    timeout: 120000,
  });
  return stdout;
};

// ==========================================================================
try {
  // ---------------- S: baseline + the real parse --------------------------
  console.log("== S: baseline + the real parse ==");
  const baseline = await roster();
  const baselineIds = new Set(baseline.map((o) => o.id));
  must(baseline.length >= 20, `world roster sane (${baseline.length} rows)`);
  const T = parseHygieneTables(hygieneSrc); // throws loudly if the table drifted
  must(T.fixture.length > 0 && T.project.length > 0 && T.ws.length > 0 && T.tpl.length > 0,
    `all four tables parsed live (${T.fixture.length}/${T.project.length}/${T.ws.length}/${T.tpl.length})`);

  // ---------------- X: parser-contract oracles ----------------------------
  console.log("== X: parser-contract oracles ==");
  // per-table floors — today's known mass; the member pins below are the teeth
  must(T.fixture.length >= 6, `fixture floor 6 (${T.fixture.length})`);
  must(T.project.length >= 4, `project floor 4 (${T.project.length})`);
  must(T.ws.length >= 5, `ws floor 5 (${T.ws.length})`);
  must(T.tpl.length >= 4, `tpl floor 4 (${T.tpl.length})`);
  // every entry of every table carries the 165 entry contract
  let ownerless = 0;
  for (const e of [...T.fixture, ...T.project, ...T.ws, ...T.tpl])
    if (e.owner.length <= 3 || e.why.length <= 3) ownerless++;
  must(ownerless === 0, `all ${T.fixture.length + T.project.length + T.ws.length + T.tpl.length} entries carry owner + why (the 165 contract, machine-checked across all four tables)`);
  // the canonical project guard, parsed — not a copied string
  must(T.canonicalProject === "β-Galactosidase Tutorial (demo)",
    `canonicalProject parsed from the audit's own constant ("${T.canonicalProject}")`);
  // first-contact members pinned by their exact source literals
  for (const [tbl, lit, why] of [
    ["fixture", "/^TL /", "the scan's first contact (12 blind rows)"],
    ["fixture", "/^Deep /", "second contact (t126's fixtures)"],
    ["project", "/^TL\\d+ /", "the project-domain shape (TL126 cross)"],
    ["project", "/^QA MultiSelect$/", "the sleeping Task-30 artifact"],
    ["ws", "/^QA Overflow$/", "qa77's transient"],
    ["ws", "/^Deep /", "the ws-domain Deep generation"],
    ["tpl", "/^Tuned 2D branch/", "t127-shot's shelf row"],
  ]) {
    must(T[tbl].some((e) => e.literal === lit), `${tbl} table pins ${lit} (${why})`);
  }
  // prefix-family derivation: behavior, not a copied kind field
  const fixturePrefix = T.fixture.filter(isPrefixFamily).map((e) => e.literal);
  must(fixturePrefix.length === 2 && fixturePrefix.includes("/^T\\d+ /") && fixturePrefix.includes("/^t\\d+ /"),
    `prefix families derived from behavior (${fixturePrefix.join(" | ")})`);
  must(T.fixture.filter((e) => !isPrefixFamily(e)).every((e) => ["/^qa61 Host$/", "/^QA Esc Import$/", "/^TL /", "/^Deep /"].includes(e.literal)),
    "explicit nets derive non-prefix (qa61 Host / QA Esc Import / TL / Deep)");

  // ---------------- B: CORE — drills THROUGH the parsed table -------------
  console.log("== B: drills through the parsed table ==");
  // the drill names are DERIVED from parsed regexes: pick the fixture table's
  // T-anchor prefix entry, build a name, and assert the parsed re matches it —
  // the drill consumes whatever the table says TODAY, not a copied shape
  const anchorEntry = T.fixture.find((e) => e.literal === "/^T\\d+ /");
  must(!!anchorEntry, "the fixture T-anchor entry is parsed");
  const drillName = `T169 Drill Anchor`;
  must(anchorEntry.re.test(drillName), `drill derivation: ${anchorEntry.literal} tests "${drillName}" (the parsed table IS the net)`);
  const drillJob = await seed({ type: "import", name: drillName });
  drillJobId = drillJob.id ?? drillJob.job?.id;
  must(!!drillJobId, `B1 ${drillName} seeded (id ${drillJobId})`);
  // workspace + template drills ride the same derivation shape (their tables
  // carry their own T/t families — the old mirror hand-copied this as dom:"all")
  const wsAnchor = T.ws.find((e) => e.literal === "/^T\\d+ /");
  must(!!wsAnchor && wsAnchor.re.test("T169 dest"), "ws drill derivation: the ws table's own T-anchor tests \"T169 dest\"");
  const drillWs = await seedWs("T169 dest");
  drillWsId = drillWs.id ?? drillWs.workspace?.id;
  must(!!drillWsId, `B2 T169 dest workspace seeded (id ${drillWsId})`);
  const tplAnchor = T.tpl.find((e) => e.literal === "/^T\\d+ /");
  must(!!tplAnchor && tplAnchor.re.test("T169 branch"), "tpl drill derivation: the tpl table's own T-anchor tests \"T169 branch\"");
  const drillTpl = await seedTpl("T169 branch");
  drillTplId = drillTpl.id ?? drillTpl.template?.id;
  must(!!drillTplId, `B3 T169 branch template seeded (id ${drillTplId})`);

  const out = await runHygiene();
  must(/fixture-orphan: 1\/1 /.test(out), "B4 fixture-orphan swept the job drill 1/1 (the parsed regex, live in the audit)");
  must(/ws-orphan: 1\/1 /.test(out), "B5 ws-orphan swept the workspace drill 1/1");
  drillWsId = null; // the audit already deleted it — keep the finally quiet
  must(/template-orphan: 1\/1 /.test(out), "B6 template-orphan swept the template drill 1/1");
  drillTplId = null; // the audit already deleted it — keep the finally quiet
  must(/domain-sweep: project 0 · workspace 1 · template 1/.test(out),
    "B7 the ledger line reads project 0 · workspace 1 · template 1");
  const afterB = await roster();
  must(!afterB.some((o) => o.id === drillJobId), "B8 the drill job row is really gone");
  drillJobId = null; // the audit already deleted it — keep the finally quiet

  // the control: a prefix-less name NO parsed signature may touch
  const ctrlName = "169nosig stray";
  must(!T.fixture.some((e) => e.re.test(ctrlName)), `B9 the control derives uncaught: no parsed fixture re tests "${ctrlName}" (why the static scan is load-bearing)`);
  const ctrl = await seed({ type: "import", name: ctrlName });
  controlId = ctrl.id ?? ctrl.job?.id;
  must(!!controlId, `B10 ${ctrlName} seeded (id ${controlId})`);
  const out2 = await runHygiene();
  must(!/fixture-orphan: [1-9]/.test(out2), "B11 hygiene did NOT sweep the control (the parsed table respects non-signature names)");
  const afterCtrl = await roster();
  must(afterCtrl.some((o) => o.id === controlId), "B12 the control row survived the audits");
  const dr = await del(controlId);
  controlId = null; // owner deleted by id — the 165 contract, in the probe's hands
  must(dr.ok, "B13 the owner deleted the control by id (the contract demonstrated)");

  // ---------------- C: canonical insurance over the LIVE world ------------
  console.log("== C: canonical insurance over the live world ==");
  const live = await roster();
  const allRes = [...T.fixture, ...T.project, ...T.ws, ...T.tpl];
  const eaten = [];
  for (const o of live)
    for (const e of allRes)
      if (e.re.test(o.name ?? "")) { eaten.push(`"${o.name}" ~ ${e.literal}`); break; }
  must(eaten.length === 0, `C1 zero parsed signatures match any of the ${live.length} live roster rows${eaten.length ? " — WOULD EAT: " + eaten.slice(0, 4).join(", ") : ""} (the table must never eat the world it serves)`);
  const canonicalNames = [
    ["project", "β-Galactosidase Tutorial (demo)"],
    ["workspace", "Main"],
    ["workspace", "QA WS Breathe"],
    ["workspace", "QA WS Pos Two"],
  ];
  for (const [dom, name] of canonicalNames) {
    const table = dom === "project" ? T.project : T.ws;
    const hit = table.find((e) => e.re.test(name));
    must(hit == null, `C2 the ${dom} canonical "${name}" matches no parsed ${dom}-table signature${hit ? ` (HIT: ${hit.literal})` : ""}`);
  }

  // ---------------- D: the parser is an enforcer --------------------------
  console.log("== D: the parser enforces the literal contract ==");
  const expectThrow = (label, src) => {
    try {
      parseHygieneTables(src);
      must(false, `D ${label}: parser must THROW`);
    } catch (e) {
      must(String(e.message).startsWith("hygiene-tables:"), `D ${label}: throws loudly (${String(e.message).slice(0, 72)}…)`);
    }
  };
  expectThrow("missing why",
    hygieneSrc.replace('owner: "qa61-e2e.mjs", why: "narrow-sheet prop, deleted at exit"', 'owner: "qa61-e2e.mjs"'));
  expectThrow("renamed table",
    hygieneSrc.replace("const FIXTURE_SIGNATURES = [", "const FIXTURE_SIGS_V2 = ["));
  expectThrow("computed re",
    hygieneSrc.replace("{ re: /^TL /,", "{ re: TL_RE,"));
  expectThrow("emptied table",
    hygieneSrc.replace(
      /const WS_SIGNATURES = \[[\s\S]*?\];/,
      "const WS_SIGNATURES = [ /* swept away */ ];"
    ));
  // the zero-roster guard static pin — extent-fit's empty-roster fence
  // (Task 168's first contact: a faceshifted empty roster exploded far=null)
  must(hygieneSrc.includes("while (j.length > 0 && fitZoom(j) < zm"),
    "D the extent-fit zero-roster guard is pinned in source (j.length > 0 && …)");
  // the MIRROR-FREE oracle: the scanner suites consume the parser now —
  // a surviving hand-copied signature array is a second source of truth
  const t167src = readFileSync(`${SCRIPTS}/t167-e2e.mjs`, "utf8");
  const t168src = readFileSync(`${SCRIPTS}/t168-e2e.mjs`, "utf8");
  must(!t167src.includes("const explicitSigs = [") && !t167src.includes("const prefixSigs = ["),
    "D t167 declares no hand-copied fixture mirror (the parser is the only reading)");
  must(!t168src.includes("const sigs = ["),
    "D t168 declares no hand-copied domain mirror (dom-tagged copies are gone)");
  must(t167src.includes("parseHygieneTables(") && t168src.includes("parseHygieneTables("),
    "D both scanners consume the shared parser (the contract they enforce is the one they run)");

  // ---------------- Z: roster identity ------------------------------------
  console.log("== Z: roster identity ==");
  const final = await roster();
  const unknownNew = final.filter((o) => !baselineIds.has(o.id));
  const unknownGone = baseline.filter((b) => !final.some((o) => o.id === b.id));
  must(unknownNew.length === 0 && unknownGone.length === 0,
    `Z roster identical to baseline (new: [${unknownNew.map((o) => o.name).join(", ") || "none"}] / gone: [${unknownGone.map((o) => o.name).join(", ") || "none"}])`);
} finally {
  // the net: whatever failed above, the drills never outlive this run
  for (const [label, id] of [["drill job", drillJobId], ["control", controlId]]) {
    if (id) {
      const r = await del(id);
      console.log(`  cleanup: ${label} ${r.ok ? "deleted" : "DELETE FAILED"} (${id})`);
    }
  }
  if (drillWsId) {
    const r = await fetch(`${BASE}/api/workspaces/${drillWsId}`, { method: "DELETE" });
    console.log(`  cleanup: drill workspace ${r.ok ? "deleted" : "DELETE FAILED"} (${drillWsId})`);
  }
  if (drillTplId) {
    const r = await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(drillTplId)}`, { method: "DELETE" });
    console.log(`  cleanup: drill template ${r.ok ? "deleted" : "DELETE FAILED"} (${drillTplId})`);
  }
}

if (failed) {
  console.error(`T169 FAILED (${failed})`);
  process.exit(1);
}
console.log(`T169 ALL PASS (${checks} assertions)`);
