// t261 — the remote cluster surface earns its citizenship (Task 261).
// The parallel-window remote-dispatch feature (5b737b3) shipped 5,600 lines
// with zero family coverage — and its first review found two things:
//   1. GET /api/remote/connections was UNGATED: even secret-stripped, the
//      list names the cluster targets (hosts, usernames, auth methods) —
//      the same class t259 gated on /api/hpc/profiles. Door added.
//   2. The dialog's "Test" button called POST .../connections/[id]/test —
//      a route that DID NOT EXIST (404; the core save→test→probe loop was
//      dead in the UI). Route built: gate + probe + lastProbe persistence.
// This suite pins both fixes and gives the feature its first family suite:
//   A  demo truth — homepage 200, roster 21, the mock cluster answering
//   B  the ledger — the GET door, the test route (gate + probe + persist),
//      the 0600 secret registry, the DTO stripping, the ssh quoting helper
//   C  the doors matrix — GET/POST/PATCH/DELETE × bare/cross/rebind → 403,
//      same-origin speaks; the no-cors text/plain kill with the registry
//      byte-identical behind the door
//   D  the live loop — create → test (mock cluster inventory: relion
//      modules, module system) → lastProbe persisted → patch (rename,
//      secret keep/clear semantics) → delete → 404; the dialog opens and
//      lists the connection
//   E  console clean
//
// Run: node scripts/t261-remote-connections.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { Socket } from "node:net";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// same-origin metadata — what every same-origin browser fetch carries
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

/** node fetch probe — drains the body, returns the status. */
async function probe(method, url, headers = {}, body) {
  const r = await fetch(`${BASE}${url}`, { method, headers, body, redirect: "manual" });
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

/** TCP probe of the mock cluster's SSH port. */
function mockListening() {
  return new Promise((resolve) => {
    const sock = new Socket();
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(1500);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(MOCK_PORT, "127.0.0.1");
  });
}

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// the mock cluster: reuse a running one, launch ours otherwise (the
// launcher orphans the server so it survives this script's shell)
let weLaunchedMock = false;
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: "/home/z/my-project", stdio: "pipe" });
  weLaunchedMock = true;
  for (let i = 0; i < 20 && !(await mockListening()); i++) await sleep(500);
}

const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (jobs0.jobs ?? []).length;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1720, height: 940 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const createdIds = []; // connection ids for cleanup (newest first)

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");

  const listRoute = src("src/app/api/remote/connections/route.ts");
  const getBody = listRoute.slice(listRoute.indexOf("export async function GET"), listRoute.indexOf("export async function POST"));
  must(
    getBody.includes("isLocalRequest(request)"),
    "the registry READ carries the door (hosts+usernames are t259-class metadata)"
  );
  must(
    listRoute.includes("hasPassword/hasPassphrase booleans only"),
    "the registry strips secrets — booleans only across the wire"
  );

  const testRoute = src("src/app/api/remote/connections/[id]/test/route.ts");
  must(
    testRoute.includes("isLocalRequest(request)") && testRoute.includes("probeConnection(conn)"),
    "the test route: gated AND probing (the dialog's Test button is no longer a 404)"
  );
  must(
    testRoute.includes("patchConnection(id, { lastProbe: probe })"),
    "the probe PERSISTS into the registry (the run dialog preselects from lastProbe)"
  );

  const conns = src("src/lib/remote/connections.ts");
  must(conns.includes("mode: 0o600") && conns.includes("chmodSync(REGISTRY_FILE, 0o600)"), "the secret registry is written 0600 (twice-guarded against umask)");
  must(
    conns.includes("const { password, passphrase, ...rest } = c;"),
    "the DTO projection strips the secret fields at the source"
  );
  must(
    conns.includes('if (typeof v === "string") return v.length > 0 ? v.slice(0, 512) : null;'),
    "secret semantics: empty string CLEARS, absent KEEPS (the form never echoes secrets)"
  );

  must(
    src("src/lib/remote/ssh.ts").includes("shellSingleQuote"),
    "the ssh layer quotes paths before they touch a shell"
  );
  must(
    !!src("services/mock-cluster/server.mjs"),
    "the mock cluster ships with the repo (the feature's own test rig)"
  );

  // ---- Phase C: the doors matrix -------------------------------------------
  console.log("== PHASE C: the doors matrix ==");
  // the registry file's EXISTENCE is not a given (a freshly seeded sandbox has zero
  // connections and the product answers that with an honest empty list — the
  // existsSync guard in connections.ts); the suite's baseline read must
  // tolerate the same empty state (ENOENT ≠ a broken registry)
  const registryBefore = existsSync("/home/z/my-project/data/remote-connections.json")
    ? readFileSync("/home/z/my-project/data/remote-connections.json", "utf8")
    : "[]";

  const getBare = await probe("GET", "/api/remote/connections");
  const getCross = await probe("GET", "/api/remote/connections", {
    Origin: "https://evil.example",
    "sec-fetch-site": "cross-site",
  });
  const getRebind = curlStatus("GET", "/api/remote/connections", ["Host: attacker.com", "Origin: http://attacker.com"]);
  must(getBare === 403, `connections GET: bare → 403 (got ${getBare})`);
  must(getCross === 403, `connections GET: cross-origin → 403 (got ${getCross})`);
  must(getRebind === 403, `connections GET: rebound Host → 403 (got ${getRebind})`);

  const postBody = JSON.stringify({ host: "evil.example", username: "attacker", password: "nope" });
  const postBare = await probe("POST", "/api/remote/connections", { "Content-Type": "application/json" }, postBody);
  const postCross = await probe(
    "POST", "/api/remote/connections",
    { Origin: "https://evil.example", "sec-fetch-site": "cross-site", "Content-Type": "application/json" },
    postBody
  );
  const postRebind = curlStatus("POST", "/api/remote/connections", [
    "Host: attacker.com",
    "Origin: http://attacker.com",
    "Content-Type: application/json",
  ]);
  must(postBare === 403, `connections POST: bare → 403 (got ${postBare})`);
  must(postCross === 403, `connections POST: cross-origin → 403 (got ${postCross})`);
  must(postRebind === 403, `connections POST: rebound Host → 403 (got ${postRebind})`);

  // PATCH/DELETE on a (nonexistent) id — the door answers before the 404
  const patchBare = await probe("PATCH", "/api/remote/connections/no-such-id", { "Content-Type": "application/json" }, "{}");
  const delBare = await probe("DELETE", "/api/remote/connections/no-such-id");
  must(patchBare === 403, `connections PATCH: bare → 403 door before not-found (got ${patchBare})`);
  must(delBare === 403, `connections DELETE: bare → 403 door before not-found (got ${delBare})`);

  // same-origin: the route SPEAKS (200 list, 400 route-speak — never 403)
  const ownGet = await probe("GET", "/api/remote/connections", SH);
  must(ownGet === 200, `same-origin connections GET → 200 (got ${ownGet})`);
  const ownBadPost = await probe("POST", "/api/remote/connections", { ...SH, "Content-Type": "application/json" }, "{}");
  must(ownBadPost === 400, `same-origin empty POST → 400 route-speak, NOT 403 (got ${ownBadPost})`);

  // the no-cors kill: EXACTLY what a malicious page's no-cors fetch sends —
  // a simple request (no preflight), text/plain body, cross-site metadata
  // stamped by the browser. NODE fakes the cross-site metadata (a browser
  // cannot spoof sec-fetch-site — and a page.evaluate fetch would be
  // SAME-ORIGIN, which is the door passing, not the door being tested —
  // first-run lesson: that variant really DID create the attacker row).
  // request.json() would parse the body fine, which is why the DOOR must
  // stop it. The registry must stay byte-identical behind the door.
  const nocors = await probe("POST", "/api/remote/connections", {
    "Content-Type": "text/plain",
    Origin: "https://evil.example",
    "sec-fetch-site": "cross-site",
    "sec-fetch-mode": "no-cors",
    "sec-fetch-dest": "empty",
  }, JSON.stringify({ host: "evil.example", username: "attacker", password: "nope" }));
  must(nocors === 403, `the no-cors cross-site drive-by dies at the door (got ${nocors})`);
  const registryAfter = readFileSync("/home/z/my-project/data/remote-connections.json", "utf8");
  must(registryAfter === registryBefore, "the registry is BYTE-IDENTICAL behind the door");

  // ---- Phase D: the live loop ----------------------------------------------
  console.log("== PHASE D: the live loop (create → test → patch → delete) ==");
  const connId = `qa-t261-${Date.now().toString(36)}`;
  createdIds.push(connId);
  const mk = await page.evaluate(async ({ connId, SH }) => {
    const r = await fetch("/api/remote/connections", {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: connId,
        name: "QA Mock Cluster",
        host: "127.0.0.1",
        port: 3022,
        username: "cryo",
        password: "demo",
        authMethod: "password",
        remoteRoot: "/projects/cryoflow",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, { connId, SH });
  must(mk.status === 201, `the connection is created (got ${mk.status})`);
  must(
    mk.body?.connection?.hasPassword === true && !("password" in (mk.body?.connection ?? {})),
    "the DTO answers hasPassword:true and NEVER the secret itself"
  );

  // the test route — the mock cluster's real inventory over real SSH
  const test = await page.evaluate(async ({ connId, SH }) => {
    const r = await fetch(`/api/remote/connections/${connId}/test`, { method: "POST", headers: SH });
    return { status: r.status, body: await r.json() };
  }, { connId, SH });
  must(test.status === 200 && test.body?.ok === true, `the probe logs in and completes (got ${test.status}, ok=${test.body?.ok})`);
  must(
    (test.body?.probe?.relionModules?.length ?? 0) >= 1,
    `the inventory finds relion modules (${(test.body?.probe?.relionModules ?? []).join(", ")})`
  );
  must(
    typeof test.body?.probe?.moduleSystem === "string" && test.body.probe.moduleSystem !== "none",
    `the module system is identified (${test.body?.probe?.moduleSystem})`
  );
  const listed = await page.evaluate(async (SH) => {
    const r = await fetch("/api/remote/connections", { headers: SH });
    return r.json();
  }, SH);
  const mine = (listed.connections ?? []).find((c) => c.id === connId);
  must(
    !!mine?.lastProbe?.checkedAt && mine.lastProbe.relionModules?.length >= 1,
    "the probe PERSISTED into the registry (lastProbe rides the list)"
  );

  // PATCH: rename + the secret's keep/clear semantics
  const renamed = await page.evaluate(async ({ connId, SH }) => {
    const r = await fetch(`/api/remote/connections/${connId}`, {
      method: "PATCH",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "QA Mock Renamed" }),
    });
    return r.json();
  }, { connId, SH });
  must(renamed?.connection?.name === "QA Mock Renamed", "the rename lands");
  must(renamed?.connection?.hasPassword === true, "a patch WITHOUT the secret field KEEPS it");
  const cleared = await page.evaluate(async ({ connId, SH }) => {
    const r = await fetch(`/api/remote/connections/${connId}`, {
      method: "PATCH",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ password: "" }),
    });
    return r.json();
  }, { connId, SH });
  must(cleared?.connection?.hasPassword === false, 'a patch with password:"" CLEARS it (documented semantics)');

  // the test route on a nonexistent id — 404 route-speak. NODE-side: a
  // deliberate 404 fetched from the PAGE gets logged by Chrome as a failed
  // resource and pollutes the console verdict (first-run lesson).
  const missing = await probe("POST", "/api/remote/connections/no-such-id/test", SH);
  must(missing === 404, `the test route 404s honestly on an unknown id (got ${missing})`);

  // ---- the UI: the dialog opens and lists the connection -------------------
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true });
  await sleep(1200);
  const dlg = page.locator('[role="dialog"]').last();
  must(await dlg.isVisible().catch(() => false), "the remote-clusters dialog opens from the header");
  const dlgText = ((await dlg.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(
    dlgText.includes("QA Mock Renamed"),
    `the dialog lists the live connection ("${dlgText.slice(0, 100)}")`
  );
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, "t261-remote-dialog-2x.png") });
  console.log("  (shot) t261-remote-dialog-2x.png");

  // DELETE + the honest 404 after (node-side — the deliberate 404 stays out
  // of the page's console)
  const del = await page.evaluate(async ({ connId, SH }) => {
    const r = await fetch(`/api/remote/connections/${connId}`, { method: "DELETE", headers: SH });
    return r.status;
  }, { connId, SH });
  must(del === 200, `the connection is deleted (got ${del})`);
  createdIds.pop();
  const delAgain = await probe("DELETE", `/api/remote/connections/${connId}`, SH);
  must(delAgain === 404, `deleting an absent connection 404s honestly (got ${delAgain})`);
} finally {
  // ---- cleanup: connections die (including any attack residue — the
  // self-heal doctrine: this suite sweeps its own leftovers AND the
  // no-cors-attack shape), our mock dies with us, roster intact ----------
  console.log("== cleanup ==");
  {
    const SHh = { Origin: BASE, "Sec-Fetch-Site": "same-origin", Host: "localhost:3000" };
    try {
      const list = (await (await fetch(`${BASE}/api/remote/connections`, { headers: SHh })).json()).connections ?? [];
      for (const c of list) {
        if (createdIds.includes(c.id) || c.host === "evil.example" || c.username === "attacker" || String(c.id).startsWith("qa-t261-")) {
          await fetch(`${BASE}/api/remote/connections/${c.id}`, { method: "DELETE", headers: SHh });
          console.log(`  (self-heal) swept connection "${c.id}"`);
        }
      }
    } catch { /* best effort */ }
  }
  if (weLaunchedMock) {
    try { execSync("fuser -k 3022/tcp"); } catch { /* already down */ }
    console.log("  (cleanup) stopped the mock cluster we launched");
  }
  const after = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
  must(after.length === 21, `roster restored to 21 (got ${after.length})`);
}

// ---- Phase E: console clean ----------------------------------------------
console.log("== PHASE E: console ==");
must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}: ${consoleErrors[0] ?? ""})`);

await browser.close();
console.log(fail === 0 ? "\nt261: ALL PASS" : `\nt261: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
