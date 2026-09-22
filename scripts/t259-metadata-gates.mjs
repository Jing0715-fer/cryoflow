// t259 — the metadata door (Task 259): the last t251 ledger line.
// The hardening ring grew job-data doors (t251), write doors (t252), and
// the subvolume doors (t254/t255) — but the APPLICATION-METADATA surfaces
// stayed open on purpose ("low sensitivity") until this pass made the
// threat model honest:
//   - GET /api/system, GET /api/hpc/profiles, GET /api/projects (+ the
//     fsc-index and pipeline-script reads) leak the environment map, the
//     SUBMISSION TARGETS (ssh hosts/accounts), and the project census to
//     a DNS-rebinding page — the one cross-site read the origin check
//     alone passes.
//   - The same surfaces' JSON writes (profiles POST, projects
//     POST/switch/rename/delete) were "ledger class" (t252): strict
//     request.json() stops FORM-borne CSRF (forms cannot send JSON) —
//     but a cross-site no-cors FETCH can POST a text/plain body that
//     request.json() parses happily. Blind state change, silently.
// t259 puts isLocalRequest in front of all of them: Fetch Metadata
// slams the cross-site fetch (no-cors included — the browser stamps
// sec-fetch-site: cross-site regardless of CORS mode), Host pinning
// catches the rebound page. Same-origin UI calls always pass.
//
// Phases:
//   A  demo truth — homepage 200, roster 23
//   B  the ledger — every door file, the guard's widened signature, the
//      doctrine comments, the test-suite adaptations — asserted at source
//   C  the gate matrix — 8 routes × 4 states (bare / cross-origin /
//      rebound-host / same-origin), live through the RUNNING server
//   C2 the no-cors kill — a text/plain JSON POST with cross-site metadata
//      dies at the door AND the registry is unchanged behind it (the t252
//      residual gap, proven closed, not assumed)
//   D  the UI still lives — same-origin page renders its data through the
//      new doors (jobs canvas populated, projects switchable)
//   E  console clean
//
// Run: node scripts/t259-metadata-gates.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const SH = { "sec-fetch-site": "same-origin" };

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

/** node-fetch probe: no Fetch Metadata unless extraHeaders says so. */
async function probe(method, url, extraHeaders = {}, body) {
  const r = await fetch(BASE + url, { method, headers: extraHeaders, body });
  // drain the body so the socket returns to the pool
  try { await r.text(); } catch { /* ignore */ }
  return r.status;
}

/** curl probe — the ONLY way to fake a rebound Host header from node. */
function curlStatus(method, url, headers = []) {
  const h = headers.map((x) => `-H ${JSON.stringify(x)}`).join(" ");
  const m = method === "POST" ? `-X POST -d ${JSON.stringify("{}")}` : "";
  try {
    return Number(
      execSync(`curl -s -o /dev/null -w "%{http_code}" ${m} ${h} ${JSON.stringify(BASE + url)}`, {
        encoding: "utf8",
      }).trim()
    );
  } catch {
    return -1;
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1720, height: 940 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  const roster0 = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
  must(roster0.length === 23, `roster identity 23 (got ${roster0.length})`);

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");

  const guardSrc = src("src/lib/http-guard.ts");
  must(
    guardSrc.includes("export function isLocalRequest(request: Request): boolean"),
    "the guard's signature is the WIDEST request shape (plain Request)"
  );
  must(
    guardSrc.includes("NextRequest callers\n * pass structurally"),
    "the widening is documented (bare-Request handlers fit without casts)"
  );

  // every door file carries the guard import AND at least one live gate
  const doors = [
    ["src/app/api/system/route.ts", "system status"],
    ["src/app/api/system/select/route.ts", "RELION selection write"],
    ["src/app/api/hpc/profiles/route.ts", "profile registry read+write"],
    ["src/app/api/projects/route.ts", "project registry read+write"],
    ["src/app/api/projects/switch/route.ts", "project switch write"],
    ["src/app/api/projects/[id]/route.ts", "project rename/delete"],
    ["src/app/api/projects/[id]/fsc-index/route.ts", "fsc-index read"],
    ["src/app/api/projects/[id]/pipeline-script/route.ts", "pipeline-script read"],
    ["src/app/api/projects/[id]/duplicate/route.ts", "project duplicate (t252 door, kept)"],
  ];
  for (const [file, why] of doors) {
    const s = src(file);
    must(s.includes('isLocalRequest') && s.includes('from "@/lib/http-guard"'), `${why}: the door file wires the guard`);
    must((s.match(/isLocalRequest\(request\)/g) ?? []).length >= 1, `${why}: at least one handler checks it`);
  }
  must(
    src("src/app/api/hpc/profiles/route.ts").includes("retarget every future sbatch"),
    "the highest-value door says WHY in its own doctrine comment"
  );
  must(
    src("src/app/api/projects/[id]/duplicate/route.ts").includes("Write door (t252)"),
    "the t252 duplicate door survives unchanged (no double-guard drift)"
  );

  // test-suite adaptation: the family speaks same-origin where it must
  must(
    src("scripts/t185-e2e.mjs").includes('const SH = { "sec-fetch-site": "same-origin" }'),
    "t185's profiles probes speak same-origin (the t251 doctrine, applied)"
  );
  must(
    src("scripts/t182-e2e.mjs").includes('"sec-fetch-site": "same-origin"'),
    "t182's jfetch injects the same-origin metadata at the single helper"
  );

  // ---- Phase C: the gate matrix (live server) -----------------------------
  console.log("== PHASE C: the gate matrix ==");
  const projs = (await (await fetch(`${BASE}/api/projects`, { headers: SH })).json()).projects ?? [];
  const pid = projs[0]?.id;
  must(!!pid, "same-origin projects GET works and yields a project id");

  const matrix = [];
  // [label, probeFn] — bare: no metadata (node default) → 403
  // cross: attacker origin → 403 · rebind: faked Host → 403 (curl only)
  // own: same-origin metadata → route speaks (200/4xx-but-not-403)
  const routes = [
    ["GET /api/system", "GET", "/api/system"],
    ["GET /api/hpc/profiles", "GET", "/api/hpc/profiles"],
    ["GET /api/projects", "GET", "/api/projects"],
    ["GET fsc-index", "GET", `/api/projects/${pid}/fsc-index`],
    ["GET pipeline-script", "GET", `/api/projects/${pid}/pipeline-script`],
    ["POST /api/projects", "POST", "/api/projects"],
    ["POST /api/projects/switch", "POST", "/api/projects/switch"],
    ["POST /api/hpc/profiles", "POST", "/api/hpc/profiles"],
    ["POST system/select", "POST", "/api/system/select"],
  ];
  for (const [label, method, url] of routes) {
    const body = method === "POST" ? JSON.stringify({}) : undefined;
    const bare = await probe(method, url, body ? { "Content-Type": "application/json" } : {}, body);
    const cross = await probe(
      method, url,
      { Origin: "https://evil.example", "sec-fetch-site": "cross-site", ...(body ? { "Content-Type": "application/json" } : {}) },
      body
    );
    const rebind = curlStatus(method, url, [
      "Host: attacker.com",
      "Origin: http://attacker.com",
      ...(method === "POST" ? ["Content-Type: application/json"] : []),
    ]);
    matrix.push([label, bare, cross, rebind]);
    must(bare === 403, `${label}: bare (no metadata) → 403 (got ${bare})`);
    must(cross === 403, `${label}: cross-origin → 403 (got ${cross})`);
    must(rebind === 403, `${label}: rebound Host → 403 (got ${rebind})`);
  }

  // own-origin: the route SPEAKS (200, or 400/404 route-speak — never 403)
  const ownGet = await probe("GET", "/api/projects", SH);
  must(ownGet === 200, `same-origin projects GET → 200 (got ${ownGet})`);
  const ownBad = await probe("POST", "/api/projects", { ...SH, "Content-Type": "application/json" }, JSON.stringify({}));
  must(ownBad === 400, `same-origin empty POST → 400 route-speak, NOT 403 (got ${ownBad})`);

  // ---- C2: the no-cors kill -----------------------------------------------
  console.log("== PHASE C2: the no-cors kill (t252 residual gap, closed) ==");
  const profilesBefore = (await (await fetch(`${BASE}/api/hpc/profiles`, { headers: SH })).json()).profiles ?? [];
  must(profilesBefore.length >= 1, "profile registry read back before the attack");
  // EXACTLY what a malicious page's no-cors fetch sends: a simple request
  // (no preflight), text/plain body (allowed in no-cors), cross-site
  // metadata stamped by the browser. request.json() parses the body fine —
  // which is precisely why the DOOR must stop it, not the parser.
  const kill = await probe("POST", "/api/hpc/profiles", {
    "Content-Type": "text/plain",
    "sec-fetch-site": "cross-site",
    Origin: "https://evil.example",
  }, JSON.stringify({ profiles: [{ id: "pwned", name: "pwned" }] }));
  must(kill === 403, `no-cors JSON-as-text profiles POST → 403 (got ${kill})`);
  const profilesAfter = (await (await fetch(`${BASE}/api/hpc/profiles`, { headers: SH })).json()).profiles ?? [];
  must(
    profilesAfter.length === profilesBefore.length &&
      JSON.stringify(profilesAfter) === JSON.stringify(profilesBefore),
    "the registry behind the door is BYTE-IDENTICAL (blind write died)"
  );

  // ---- Phase D: the UI still lives ----------------------------------------
  console.log("== PHASE D: the UI lives through the doors ==");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  const jobCards = await page.locator("[data-job]").count();
  must(jobCards >= 20, `the canvas renders its jobs through the new doors (${jobCards} cards)`);
  // the header's project switcher reads /api/projects — it must show data
  const headerText = ((await page.locator("header").first().innerText().catch(() => "")) ?? "").trim();
  must(headerText.length > 0, "the header renders (project name came through the projects door)");

  // ---- cleanup none needed: probes died at the door, nothing persisted ----
} finally {
  console.log("== cleanup ==");
  // the door stopped every probe BEFORE state changed — but sweep anyway,
  // defensively: no t259 probe project may exist
  try {
    const projs = (await (await fetch(`${BASE}/api/projects`, { headers: SH })).json()).projects ?? [];
    for (const p of projs.filter((x) => (x.name ?? "").startsWith("t259"))) {
      await fetch(`${BASE}/api/projects/${p.id}`, { method: "DELETE", headers: SH });
      console.log(`  (sweep) removed probe project "${p.name}"`);
    }
  } catch { /* best effort */ }
  const after = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
  must(after.length === 23, `roster still 23 (got ${after.length})`);
}

// ---- Phase E: console clean ----------------------------------------------
console.log("== PHASE E: console ==");
must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}: ${consoleErrors[0] ?? ""})`);

await browser.close();
console.log(fail === 0 ? "\nt259: ALL PASS" : `\nt259: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
