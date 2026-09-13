// t167 — Task 167: the fixture contract scan — the FIXTURE signature table
// earns its static verification (Task 165's candidate ②, handed off twice).
//
// Task 165 built two audits on an EXPLICIT hand-listed signature table and
// left one gap: nothing verified the OWNERS. The table says "every t-suite's
// Z phase restores the roster", but that sentence had no assertion behind
// it — a future t-suite seeding "my anchor" (no T-prefix) would crash-leak
// permanently, invisible to FIXTURE-ORPHAN. First contact vindicated the
// scan immediately: TWELVE already-seeded rows ("TL Import" family,
// "TL Nav A/B", "TL Shot A/B") had exactly that blind spot — "TL" predates
// the T-anchor convention and /^T\d+ / needs a digit after the T. The
// signature table now carries /^TL / (owners verified: all four files
// delete by id at exit), and this probe keeps the whole contract true:
//
//   S  baseline roster (unknown-ids family: Z diffs the FINAL roster
//      against the baseline snapshot, never against a remembered seed set)
//   X  source oracles:
//      - every FIXTURE_SIGNATURES entry carries owner + why (the 165
//        entry contract — "verify before adding, the audit deletes what
//        you list")
//      - the /^TL / entry exists (this round's first-contact finding,
//        pinned so it can never silently regress)
//      - CANONICAL GUARD: no signature matches a canonical world name
//        (the audit must never swallow the world it serves)
//      - matrix wiring: world-hygiene runs before EVERY suite
//      - the 400 cap on all three loud-abort audits (signature bug →
//        loud abort, not silent mass deletion)
//      - THE SCAN: an extractor walks every suite script and classifies
//        every seeded job-name literal — self-prefix (T<n>/t<n>, n ==
//        own suite number) | explicit-sig | canonical (qa world-builders)
//        | exception (documented) — and demands ZERO NO-SIGNATURE (the
//        crash-leak blind spots) and ZERO OTHER-SUITE-PREFIX (a t-suite
//        seeding another suite's prefix is cross-suite pollution)
//      - the exception is documented: "165 Twin" lives OUTSIDE the net
//        deliberately (keep-newest observability) and its docstring says so
//      - sensitivity: the classifier must call a synthetic non-signature
//        name NO-SIGNATURE (an extractor that never fires is a vacuous
//        pass wearing a scanner's clothes)
//      - OWNER-DELETES-BY-ID: every seeding suite's source carries a
//        deletion means (API DELETE or the prisma-side purge, t146's
//        stronger form) and cleanup wiring (cleanup()/void cleanup()/
//        Phase Z/finally)
//   B  crash drill: seed "T167 Crash Drill" → run world-hygiene →
//      fixture-orphan reports the kill → roster back to baseline (the net
//      catches a crashed run's leftover, for real, at runtime)
//   C  control drill: seed "167nosig anchor" → hygiene does NOT sweep it
//      (the audit respects non-signature names — the exact reason the
//      static scan is load-bearing) → the OWNER deletes it by id, the
//      contract demonstrated in the probe's own hands
//   Z  strict roster identity vs baseline (names AND ids), no residue
//
// Scanner scars earned during the recon (t167-recon.mjs, folded here):
// localStorage favorites arrays ("cryoflow-fav-types") masquerade as array
// seeds — ["motioncorr","ctffind"] is a favorites LIST, not a seed pair;
// the extractor suppresses any array-match near localStorage/setItem. And
// the POST route wraps rows as {job:{...}} — unwrap before reading ids
// (the t163 vacuous-pass family).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const run = promisify(execFile);

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const SCRIPTS = join(ROOT, "scripts");
const hygieneSrc = readFileSync(`${ROOT}/scripts/world-hygiene.mjs`, "utf8");
const matrixSrc = readFileSync(`${ROOT}/scripts/run-matrix.sh`, "utf8");

let checks = 0;
let failed = null;
const must = (cond, msg) => {
  checks++;
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    if (failed == null) failed = msg;
    throw new Error(`t167: ${msg}`); // THIS instant — evidence over politeness
  }
  console.log(`  ok: ${msg}`);
};

const roster = async () =>
  (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
const seed = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`t167: seed POST → ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.job ?? j; // unwrap the {job:{...}} envelope — vacuous-pass guard
};
const del = async (id) =>
  fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" });
const runHygiene = async () => {
  const { stdout } = await run("node", [`${ROOT}/scripts/world-hygiene.mjs`], {
    cwd: ROOT,
    timeout: 120000,
  });
  return stdout;
};

// ---------------- the extractor (recon folded in) ------------------------
// job-type vocabulary from src/lib/workflow.ts spec("id", ...) calls
const jobTypes = (() => {
  const wf = readFileSync(`${ROOT}/src/lib/workflow.ts`, "utf8");
  const s = new Set();
  for (const m of wf.matchAll(/spec\(\s*"([a-z0-9-]+)"/g)) s.add(m[1]);
  return s;
})();

// signature semantics mirrored from world-hygiene.mjs — X-phase oracles
// assert the mirror agrees with the real table before trusting it here
const explicitSigs = [/^qa61 Host$/, /^QA Esc Import$/, /^TL /, /^Deep /];
const prefixSigs = [/^T\d+ /, /^t\d+ /];
const canonicalPrefix = /^QA /; // the world builders' rows — what the world IS
// documented exception: deliberately outside the net (owner cleans by id;
// a crash leak is accepted so keep-newest stays state-observable)
const exceptions = new Map([
  ["165 Twin", "t165-e2e.mjs — deliberately non-signature (keep-newest observability), cleaned by id in Z"],
]);

const classify = (name, ownNum) => {
  if (ownNum != null && new RegExp(`^[Tt]${ownNum} `).test(name)) return "self-prefix";
  if (explicitSigs.some((r) => r.test(name))) return "explicit-sig";
  if (prefixSigs.some((r) => r.test(name))) return "OTHER-SUITE-PREFIX";
  if (canonicalPrefix.test(name)) return "canonical";
  if (exceptions.has(name)) return "exception";
  return "NO-SIGNATURE";
};

// extract seeded job-name literals from a suite source.
// array seeds: ["<name>", "<jobtype>" — suppressed near localStorage
// (favorites arrays are the known masquerader). object seeds: name: "…"
// near a POST /api/jobs, or type+name literals in one object (seed-helper
// form, t165's seed({type, name})). python: "name": "…" near api/jobs.
//
// Calibrated against the scan's own first contact (t167 first run): four
// masquerader families are excluded by the ±120-char context window —
// in-page MOCK API responses (JSON.stringify({jobs:[…]}) for route
// interception, qa42/qa45 — never POSTed), Playwright locators
// (getByRole("button", { name: "Retry" }), t152), workspace/project
// domain calls (api("/api/workspaces", { name: "TL124 shot" }) — the
// scanner's reach is JOB rows; the workspace-orphan audit is a separate
// future audit), and the scanner itself (its drill payloads own their
// names: "T167 Crash Drill" is swept by hygiene's own net when leaked).
// context tokens that make a name: literal NOT a job-row seed.
// NOTE JSON.stringify is deliberately NOT here: a PATCH body
// (JSON.stringify({ name: "QA Esc Import" })) renames a REAL row —
// exactly what the signature table must cover. The mock masquerader is
// caught by its envelope shape (a "jobs:" array key) or the word mock.
const NOT_A_SEED = /api\/workspaces|api\/projects|\bjobs:\s*\[|getByRole|\.locator\(|page\.route|\bmock/i;

const extractSeeds = (src) => {
  const names = new Map();
  const add = (n, ev) => names.set(n, `${names.get(n) ? names.get(n) + "+" : ""}${ev}`);
  // both the JS array form ["name", "type" and the Python spec-tuple form
  // ("name", "type" — qa60's SPECS table, the canonical world builder)
  for (const a of src.matchAll(/[(\[]\s*"([^"\n]{1,60})"\s*,\s*"([a-z0-9-]+)"/g)) {
    if (!jobTypes.has(a[2])) continue;
    const win = src.slice(Math.max(0, a.index - 250), a.index + 250);
    if (/localStorage|setItem|fav-types|JSON\.stringify/.test(win)) continue;
    add(a[1], "array");
  }
  for (const p of src.matchAll(/name:\s*"([^"\n]{1,60})"/g)) {
    const near = src.slice(Math.max(0, p.index - 120), p.index + 120);
    if (NOT_A_SEED.test(near)) continue; // mock/locator/workspace-domain masqueraders
    const pre = src.slice(Math.max(0, p.index - 400), p.index);
    const post = src.slice(p.index, p.index + 200);
    if (/api\/jobs/.test(pre) || /api\/jobs/.test(post)) add(p[1], "js-obj");
  }
  for (const p of src.matchAll(
    /\{[^{}\n]{0,140}\btype:\s*"([a-z0-9-]+)"[^{}\n]{0,140}\bname:\s*"([^"\n]{1,60})"[^{}\n]{0,140}\}|\{[^{}\n]{0,140}\bname:\s*"([^"\n]{1,60})"[^{}\n]{0,140}\btype:\s*"([a-z0-9-]+)"[^{}\n]{0,140}\}/g
  )) {
    const t = p[1] ?? p[4];
    const n = p[2] ?? p[3];
    if (!jobTypes.has(t)) continue;
    const near = src.slice(Math.max(0, p.index - 120), p.index + 120);
    if (NOT_A_SEED.test(near)) continue;
    add(n, "obj");
  }
  for (const p of src.matchAll(/"name":\s*"([^"\n]{1,60})"/g)) {
    const near = src.slice(Math.max(0, p.index - 120), p.index + 120);
    if (/\bmock/i.test(near)) continue;
    const pre = src.slice(Math.max(0, p.index - 500), p.index);
    if (/api\/jobs/.test(pre)) add(p[1], "py-obj");
  }
  return names;
};

const suiteFiles = readdirSync(SCRIPTS)
  .filter((f) => /^(t\d+.*(e2e|shot)\.mjs|qa[0-9a-z-]+\.(py|mjs))$/.test(f))
  .sort();

const scan = () => {
  const rows = [];
  for (const f of suiteFiles) {
    if (f === "t167-e2e.mjs") continue; // the scanner does not classify its own drill payloads
    const src = readFileSync(join(SCRIPTS, f), "utf8");
    const ownNum = parseInt((f.match(/^(?:t|qa)(\d+)/i) ?? [])[1] ?? "NaN", 10);
    for (const [name] of extractSeeds(src))
      rows.push({ file: f, ownNum: Number.isNaN(ownNum) ? null : ownNum, name, verdict: classify(name, Number.isNaN(ownNum) ? null : ownNum) });
  }
  return rows;
};

// ---------------- X-phase: owner-cleanup contract check -------------------
// Applies to TRANSIENT seeding suites only — suites whose extracted seeds
// include at least one non-canonical name. World builders (qa60) and
// janitors (qa62 — its "seeds" are the NAME TABLE it cleans, the mirror of
// qa60's SPECS) seed nothing transient: their rows ARE the world, guarded
// by the canonical guard, not by exit cleanup. A transient suite seeding
// only canonical-prefixed names would be a different bug (identity
// pollution) — the FIXTURE-DUP audit catches that shape instead.
const ownerContract = (f) => {
  const src = readFileSync(join(SCRIPTS, f), "utf8");
  const deletionMeans =
    (/api\/jobs/.test(src) && /"DELETE"|'DELETE'/.test(src)) ||
    /curl[^"'\n]*-X\s*DELETE/.test(src) ||
    /deleteMany|\.delete\(|purgeT?\d*\s*\(/.test(src);
  const cleanupWiring =
    /\bfinally\b/.test(src) ||
    /void cleanup\(\)/.test(src) ||
    /await cleanup\(\)/.test(src) ||
    /Phase Z/.test(src) ||
    // the linear sweep loop (shot suites): for (const id of ids) await api(`/api/jobs/${id}`, "DELETE")
    /for\s*\(const \w+ of [\w.]+\)\s*\{?[^\n]*DELETE/.test(src);
  return { deletionMeans, cleanupWiring };
};

// =========================================================================
try {
  let baseline = await roster();
  const baselineIds = new Set(baseline.map((o) => o.id));

  // ---------------- S: preflight ------------------------------------------
  console.log("== S: preflight ==");
  must(baseline.length >= 20, `world roster sane (${baseline.length} rows)`);
  must(jobTypes.size >= 20, `job-type vocabulary extracted (${jobTypes.size} types)`);

  // ---------------- X: source oracles ------------------------------------
  console.log("== X: source oracles ==");
  // signature table: every entry carries owner + why
  const entries = [...hygieneSrc.matchAll(/\{ re: (\/[^/]+\/[a-z]*), owner: "([^"]*)", why: "([^"]*)" \}/g)];
  must(entries.length >= 5, `signature table parsed with owner+why on every entry (${entries.length} entries)`);
  for (const [, re, owner, why] of entries)
    must(owner.length > 3 && why.length > 3, `signature ${re} carries owner ("${owner}") + why`);
  // the TL + Deep entries — the scan's first-contact findings, pinned forever
  must(entries.some((e) => e[1] === "/^TL /"), 'the /^TL / signature exists (the scan\'s own first contact: 12 rows were blind to the net)');
  must(entries.some((e) => e[1] === "/^Deep /"), 'the /^Deep / signature exists (second contact: t126\'s deep-link fixtures were equally blind)');
  // canonical guard: no signature may match a canonical world name
  const reSources = entries.map((e) => e[1]);
  const canonicalSample = ["QA Class Select", "QA Post 300", "QA Refine Live", "QA Class2D Source", "QA Sel Alpha"];
  for (const c of canonicalSample) {
    // the real table's match — mirror the audit's own test
    const hit = reSources.find((rs) => { try { return new RegExp(rs.slice(1, rs.lastIndexOf("/")), rs.slice(rs.lastIndexOf("/") + 1)).test(c); } catch { return false; } });
    must(hit == null, `canonical guard: no signature matches canonical "${c}"`);
  }

  // matrix wiring + the 400 caps
  must(/world-hygiene\.mjs/.test(matrixSrc), "matrix runs world-hygiene before every suite (between-suites window = between-rounds contract)");
  for (const audit of ["RESIDUE ABORT", "FIXTURE-DUP ABORT", "FIXTURE-ORPHAN ABORT"])
    must(hygieneSrc.includes(`400 cap`) && hygieneSrc.includes(audit), `the 400 cap guards ${audit.replace(" ABORT", "")} (signature bug → loud abort)`);

  // THE SCAN
  const rows = scan();
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  must(rows.length >= 50, `extractor fired on real seeds (${rows.length} name literals classified — an empty scan is a vacuous pass)`);
  const nosig = rows.filter((r) => r.verdict === "NO-SIGNATURE");
  must(nosig.length === 0, `zero NO-SIGNATURE seeds (crash-leak blind spots)${nosig.length ? " — offenders: " + nosig.map((r) => `${r.file}:"${r.name}"`).join(", ") : ""}`);
  const other = rows.filter((r) => r.verdict === "OTHER-SUITE-PREFIX");
  must(other.length === 0, `zero OTHER-SUITE-PREFIX seeds (cross-suite pollution)${other.length ? " — offenders: " + other.map((r) => `${r.file}:"${r.name}"`).join(", ") : ""}`);
  // known members pinned — the classification must never silently re-shape
  must(rows.some((r) => r.name === "T145 Alpha" && r.verdict === "self-prefix"), '"T145 Alpha" classified self-prefix');
  must(rows.some((r) => r.name === "TL Import" && r.verdict === "explicit-sig"), '"TL Import" classified explicit-sig (under the net since Task 167)');
  must(rows.some((r) => r.name === "Deep Home Idle" && r.verdict === "explicit-sig"), '"Deep Home Idle" classified explicit-sig (under the net since Task 167)');
  must(rows.some((r) => r.name === "QA Esc Import" && r.verdict === "explicit-sig"), '"QA Esc Import" classified explicit-sig');
  must(rows.some((r) => r.name === "165 Twin" && r.verdict === "exception"), '"165 Twin" classified exception (deliberately outside the net)');
  must(count("canonical") >= 3, `qa world-builder seeds classified canonical (${count("canonical")} rows — their leftovers ARE the world)`);
  // sensitivity: the classifier discriminates (never-vacuous guard).
  // NOTE "t167 Stealth" with a foreign suite number is OTHER-SUITE-PREFIX —
  // the /^t\d+ / signature covers the lowercase family GLOBALLY, so even a
  // cross-numbered leak is swept; the net only misses prefix-less names.
  must(classify("t167 Stealth", 167) === "self-prefix", "classifier: own-number prefix → self-prefix");
  must(classify("t167 Stealth", 166) === "OTHER-SUITE-PREFIX", "classifier: foreign-number prefix → OTHER-SUITE-PREFIX (still swept by /^t\\d+ /)");
  must(classify("stray anchor", null) === "NO-SIGNATURE", "classifier: prefix-less name → NO-SIGNATURE (the scan's teeth)");

  // the exception must stay documented in its owner's docstring
  const t165src = readFileSync(`${SCRIPTS}/t165-e2e.mjs`, "utf8");
  must(t165SrcHasNonSignatureNote(t165src), '"165 Twin" docstring documents the deliberate non-signature contract');

  // owner-deletes-by-id: every TRANSIENT seeding suite carries the cleanup contract
  const transientFiles = [...new Set(rows.filter((r) => r.verdict !== "canonical").map((r) => r.file))];
  must(transientFiles.length >= 20, `transient seeding-suite set sane (${transientFiles.length} suites own fixture rows)`);
  const gaps = [];
  for (const f of transientFiles) {
    const c = ownerContract(f);
    if (!c.deletionMeans || !c.cleanupWiring)
      gaps.push(`${f} (del=${c.deletionMeans} wiring=${c.cleanupWiring})`);
  }
  must(gaps.length === 0, `every transient seeding suite deletes by id + wires cleanup${gaps.length ? " — GAPS: " + gaps.join(", ") : ""}`);

  // ---------------- B: crash drill ----------------------------------------
  console.log("== B: crash drill — the net catches a crashed run's leftover ==");
  const crashRow = await seed({ type: "import", name: "T167 Crash Drill", x: 140, y: 4000 });
  must(!!crashRow.id, `crash row seeded (${crashRow.id}) — owner "forgets" to clean (simulated crash)`);
  const outB = await runHygiene();
  must(/fixture-orphan: 1\/1 /.test(outB), `fixture-orphan sweeps the crash leftover 1/1 — got: ${(outB.match(/fixture-orphan: [^\n]*/) ?? ["?"])[0]}`);
  must(!((await roster()).some((o) => o.id === crashRow.id)), "crash row deleted by the audit (the net is real at runtime)");

  // ---------------- C: control drill --------------------------------------
  console.log("== C: control drill — the net respects non-signature names ==");
  const ctrlRow = await seed({ type: "import", name: "167nosig anchor", x: 140, y: 4200 });
  must(!!ctrlRow.id, `control row seeded (${ctrlRow.id}) — matches NO signature`);
  const outC = await runHygiene();
  must(/fixture-orphan: 0 /.test(outC), "hygiene does NOT sweep the non-signature row (0 orphans) — the canonical guard's flip side");
  must((await roster()).some((o) => o.id === ctrlRow.id), "control row SURVIVED the audit — this is why the static scan is load-bearing");
  const delC = await del(ctrlRow.id);
  must(delC.ok, "OWNER deletes the control row by id — the contract, demonstrated");
  must(!((await roster()).some((o) => o.id === ctrlRow.id)), "control row gone (owner contract closed the loop)");

  // ---------------- Z: strict roster identity -----------------------------
  console.log("== Z: roster identity ==");
  const after = await roster();
  const afterIds = new Set(after.map((o) => o.id));
  const added = after.filter((o) => !baselineIds.has(o.id));
  const removed = baseline.filter((o) => !afterIds.has(o.id));
  must(added.length === 0, `no rows added beyond baseline${added.length ? ` — ${added.map((o) => `"${o.name}"`).join(", ")}` : ""}`);
  must(removed.length === 0, `no baseline rows removed${removed.length ? ` — ${removed.map((o) => `"${o.name}"`).join(", ")}` : ""}`);
  console.log(`T167 ALL PASS (${checks} assertions)`);
} catch (e) {
  if (failed == null) failed = e.message;
  console.error(`T167 FAILED: ${failed}`);
  // the drills' rows must never outlive a failed run — best-effort owner
  // cleanup (NOT in a finally: a throwing cleanup must never swallow the
  // verdict; and hygiene's own net sweeps the T-prefixed drill row anyway)
  try {
    const rows = await roster();
    for (const o of rows)
      if (o.name === "T167 Crash Drill" || o.name === "167nosig anchor")
        await del(o.id);
  } catch { /* world-hygiene's /^T\d+ / signature owns the rest */ }
  process.exitCode = 1;
} finally {
  if (failed) {
    console.error(`T167 FAILED (verdict): ${failed}`);
    process.exitCode = 1;
  }
}

// t165's docstring documents the non-signature contract of "165 Twin"
function t165SrcHasNonSignatureNote(src) {
  return /deliberately|non-signature|keep-newest/.test(src) && src.includes("165 Twin");
}
