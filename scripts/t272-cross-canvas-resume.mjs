/**
 * t272 — the cross-canvas résumé closes its loop (the t271 leftover:
 * "history 行的跨 project 活体见证", which turned into a REAL orphan find).
 *
 * The story: the connection and its run records are GLOBAL (one
 * remote-connections.json + one engine-state.json), but the job is
 * PER-PROJECT. t271's existence check reads the workflow store — the store
 * is the world the inspector can open — so an entry whose job lives on
 * ANOTHER project's canvas renders as a dumb history row. What the suite
 * ALSO found: DELETE /api/projects/[id] used db.job.deleteMany, bypassing
 * the single-job DELETE route's clearRunRecord — a deleted project left
 * ORPHAN records the résumé would count and render forever, on every
 * canvas, pointing at doors that no longer exist anywhere.
 *
 * The fix + the deepening:
 *   - the project DELETE performs the same ceremony per job (clearRunRecord)
 *     — "records only live while their job does" now holds at project
 *     granularity too
 *   - the résumé's DTO carries per-entry EXISTENCE (server-side DB check):
 *     exists=true + projectName → "lives on the “X” project's canvas";
 *     exists=false → "gone (deleted)"; absent → the pre-t272 merged guess.
 *     The history row speaks THREE honest states instead of one merged
 *     guess — and names the canvas the job actually lives on.
 *
 * Phases:
 *   A  demo truth (roster 21, mock cluster, rig stubs)
 *   B  the ledger (source assertions: cascade sweep + ordering, DTO fields,
 *      the async résumé, three await'd routes, the three-state UI)
 *   C  the live loop:
 *      C1  a SECOND project is born (create + auto-active)
 *      C2  six-micrograph import on the second canvas
 *      C3  probeless connection + bare-API motioncorr dispatch → completes
 *          (the record lands in the GLOBAL state file)
 *      C4  switch BACK to the demo project → 21 jobs, the second canvas's
 *          jobs are not here
 *      C5  the résumé still counts the run (connection is global) and the
 *          entry NOW carries exists=true + projectName="t272 Cross Canvas"
 *      C6  the dialog on the demo canvas renders the entry as a DUMB HISTORY
 *          ROW (no data-resume-jump) whose tooltip names the OTHER canvas —
 *          t271's existence check, witnessed across projects
 *      C7  DELETE the second project → the records die WITH it → the résumé
 *          field is omitted entirely (t270's zero-run contract, third
 *          witness, at project granularity) + the card stands down
 *      shots: the cross-canvas history row, the post-delete empty dialog
 *   D  console clean
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readlinkSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const MICS_DIR = "/home/z/my-project/data/relion/t272-mics";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";
const RIG_BIN = "/home/z/my-project/services/mock-cluster/fs/opt/bin";
const SECOND_NAME = "t272 Cross Canvas";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

async function pollUntil(fn, deadlineMs, intervalMs = 1200) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

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

const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s.runs ?? s;
  } catch {
    return {};
  }
};

async function deleteJob(id) {
  try {
    await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH });
  } catch { /* best effort */ }
}

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

let weLaunchedMock = false;
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: "/home/z/my-project", stdio: "pipe" });
  weLaunchedMock = true;
  for (let i = 0; i < 20 && !(await mockListening()); i++) await sleep(500);
}

const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (jobs0.jobs ?? []).length;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1720, height: 940 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const createdJobs = [];
const connIds = [];
let secondProjectId = null;

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);
  must(
    ["motioncor2", "relion_run_motioncorr"].every((b) => existsSync(path.join(RIG_BIN, b))),
    "the rig ships the motioncorr stubs (motioncor2 / relion_run_motioncorr)"
  );

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");
  const projRoute = src("src/app/api/projects/[id]/route.ts");

  must(
    projRoute.includes('import { clearRunRecord, isRunAlive, stopRun } from "@/lib/relion/engine";'),
    "the project DELETE route imports clearRunRecord"
  );
  must(
    projRoute.includes("for (const { id: jobId } of projectJobs) clearRunRecord(jobId);"),
    "the project DELETE sweeps every job's run record (the ceremony, per job)"
  );
  const clearIdx = projRoute.indexOf("for (const { id: jobId } of projectJobs) clearRunRecord(jobId);");
  const delManyIdx = projRoute.indexOf("await db.job.deleteMany(");
  must(
    clearIdx !== -1 && delManyIdx !== -1 && clearIdx < delManyIdx,
    "ORDER LAW: the records die BEFORE the job rows (t272's own ledger entry)"
  );
  must(
    !projRoute.includes("intentionally left untouched"),
    "the old 'records untouched' note is RETIRED (it described the orphan bug)"
  );

  const types = src("src/lib/remote/types.ts");
  must(
    types.includes("exists?: boolean;") && types.includes("projectName?: string;"),
    "the résumé entry DTO carries exists + projectName (optional — pre-t272 rows lack them)"
  );

  const rr = src("src/lib/remote/remote-run.ts");
  must(
    rr.includes("export async function connectionRunResume("),
    "the résumé aggregate is async (the existence check queries the DB)"
  );
  must(
    rr.includes('select: { id: true, project: { select: { name: true } } }'),
    "the existence check fetches the owning project's NAME in the same query"
  );
  must(
    rr.includes("e.exists = true;") && rr.includes("e.exists = false;"),
    "the aggregate speaks both truths (alive anywhere / gone everywhere)"
  );

  const connRoute = src("src/app/api/remote/connections/route.ts");
  const connIdRoute = src("src/app/api/remote/connections/[id]/route.ts");
  must(
    connRoute.includes("await Promise.all(") && connRoute.includes("await withRunResume("),
    "GET/POST ride the async résumé (Promise.all + await — no bare DTO eraser)"
  );
  must(
    connIdRoute.includes("await withRunResume("),
    "PATCH rides the async résumé too (every layer tells the same story)"
  );

  const dlgSrc = src("src/components/workflow/remote-cluster-dialog.tsx");
  must(
    dlgSrc.includes("e.exists === true") && dlgSrc.includes("project's canvas — switch to that project"),
    "the history row NAMES the canvas the job lives on (exists=true branch)"
  );
  must(
    dlgSrc.includes('"the job is gone (deleted) — the résumé keeps it as history"'),
    "the gone-everywhere row says exactly that, with no canvas guess (exists=false branch)"
  );
  must(
    dlgSrc.includes("the job is gone (deleted, or another project's canvas)"),
    "the pre-t272 merged wording survives for rows the server did not grade"
  );
  must(
    dlgSrc.includes('data-resume-gone={e.exists === false ? "gone" : undefined}'),
    "the gone row carries a data hook (the CSS/test seam of the third state)"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (second canvas → dispatch → cross-canvas row → cascade) ==");

  // C0 — the demo project's id (to switch back to). The registry has a
  // cross-site guard — the same-origin SH headers are load-bearing here.
  const projects0 = await (await fetch(`${BASE}/api/projects`, { headers: SH })).json();
  const demoProject = (projects0.projects ?? [])[0];
  must(!!demoProject?.id, `the demo project exists (${demoProject?.name ?? "?"})`);
  const demoId = demoProject?.id ?? null;
  if (!demoId) throw new Error("no demo project — the cross-canvas loop cannot proceed");

  // C1 — a SECOND project is born; creating sets it active
  const mkProj = await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({ name: SECOND_NAME, mode: "spa" }),
  });
  const mkProjBody = await mkProj.json().catch(() => ({}));
  must(mkProj.status === 201, `the second project is created (got ${mkProj.status})`);
  secondProjectId = mkProjBody?.project?.id ?? null;
  must(!!secondProjectId, `the second project has an id (${secondProjectId ?? "absent"})`);

  const projects1 = await (await fetch(`${BASE}/api/projects`, { headers: SH })).json();
  const secondMeta = (projects1.projects ?? []).find((p) => p.id === secondProjectId);
  must(
    !!secondMeta && (projects1.projects ?? []).length >= 2,
    `the registry lists both canvases (${(projects1.projects ?? []).map((p) => p.name).join(" | ")})`
  );
  const activeJobs = await (await fetch(`${BASE}/api/jobs`)).json();
  must(
    (activeJobs.jobs ?? []).length === 0,
    `creation flipped the active pointer — the second canvas starts EMPTY (${(activeJobs.jobs ?? []).length} jobs)`
  );

  // C2 — six tiny but valid MRC micrographs + a REAL local import job,
  //      dispatched on the SECOND canvas
  mkdirSync(MICS_DIR, { recursive: true });
  const names = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc", "mic_05.mrc", "mic_06.mrc"];
  for (const n of names) {
    const W = 64, H = 64;
    const buf = Buffer.alloc(1024 + W * H * 4);
    buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
    buf.writeInt32LE(2, 12); // mode 2 = float32
    buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
    buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
    buf.write("MAP ", 208, "ascii");
    buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
    for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
    writeFileSync(path.join(MICS_DIR, n), buf);
  }
  must(names.every((n) => existsSync(path.join(MICS_DIR, n))), "six mock micrographs fabricated (64x64 float32)");

  const mkJob = async (body) => {
    const r = await fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = await r.json();
    if (r.status === 201 && b.job?.id) createdJobs.push(b.job.id);
    return b.job;
  };
  const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
    const r = await fetch(`${BASE}/api/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
    });
    return r.status;
  };
  const readJob = async (id) => {
    const d = await (await fetch(`${BASE}/api/jobs`)).json();
    return (d.jobs ?? []).find((x) => x.id === id) ?? null;
  };
  const readConns = async () => {
    const d = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
    return d.connections ?? d ?? [];
  };

  const importJob = await mkJob({
    type: "import",
    name: "t272 Import (second canvas)",
    params: { micrographsPath: MICS_DIR, pixelSize: 1.77 },
  });
  must(!!importJob?.id, "the import job exists on the SECOND canvas");
  await fetch(`${BASE}/api/jobs/${importJob.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({}),
  });
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed (engine-native)");

  // C3 — a probeless connection + the bare-API dispatch on the second canvas
  const connId = `qa-t272-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: connId,
      name: "QA t272 CrossCanvas",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 201, `the probeless connection is created (got ${mk.status})`);

  const jobM = await mkJob({ type: "motioncorr", name: "t272 MotionCorr (second canvas)" });
  const eM = await mkEdge(importJob.id, jobM.id, "micrographs", "movies");
  must(eM === 200 || eM === 201, `import → probeless-remote motioncorr wired (${eM})`);
  const dispatchM = await fetch(`${BASE}/api/jobs/${jobM.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatchM.status === 200 || dispatchM.status === 201, `probeless dispatch accepted (${dispatchM.status})`);
  const completedM = await pollUntil(async () => {
    const j = await readJob(jobM.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 90_000);
  must(completedM?.status === "completed", `the cluster motioncorr completes on the second canvas (${completedM?.status})`);
  must(
    !!stateRuns()[jobM.id],
    "the run record landed in the GLOBAL state file (connection and records know no project)"
  );

  // C4 — switch BACK to the demo project
  const sw = await fetch(`${BASE}/api/projects/switch`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({ id: demoId }),
  });
  must(sw.status === 200 || sw.status === 201, `switched back to the demo canvas (${sw.status})`);
  const demoJobs = await pollUntil(async () => {
    const d = await (await fetch(`${BASE}/api/jobs`)).json();
    const n = (d.jobs ?? []).length;
    return n === 21 ? d : null;
  }, 15_000);
  must(!!demoJobs, "the demo canvas shows its 21 jobs again");
  const demoIds = new Set((demoJobs?.jobs ?? []).map((j) => j.id));
  must(
    !demoIds.has(jobM.id) && !demoIds.has(importJob.id),
    "the second canvas's jobs are NOT on this canvas (per-project store)"
  );

  // C5 — the résumé still counts the run, and the entry now speaks existence
  const readResume = async () => {
    const list = await readConns();
    return (Array.isArray(list) ? list : []).find((c) => c.id === connId)?.resume ?? null;
  };
  const resume1 = await pollUntil(async () => {
    const r = await readResume();
    return r && r.total >= 1 ? r : null;
  }, 10_000);
  must(!!resume1 && resume1.total === 1, `the résumé has its entry on the demo canvas too (total ${resume1?.total ?? "?"})`);
  const entry = resume1?.recent?.[0];
  must(
    entry?.jobId === jobM.id && entry?.exists === true,
    `the entry's existence is GRADED by the server (exists ${entry?.exists})`
  );
  must(
    entry?.projectName === SECOND_NAME,
    `the entry names the canvas the job lives on ("${entry?.projectName ?? "absent"}")`
  );

  // C6 — the dialog on the demo canvas: the entry is a DUMB HISTORY ROW
  //      whose tooltip names the other canvas
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch(() => {});
  await sleep(1500);
  const card = page.locator("[data-run-resume]").first();
  must(await card.isVisible().catch(() => false), "the résumé card renders inside the cluster dialog");
  const jumpBtn = page.locator(`[data-resume-jump][data-resume-entry="${jobM.id}"]`).first();
  must(
    !(await jumpBtn.isVisible().catch(() => false)),
    "the cross-canvas entry is NOT a jump button (this store cannot open that door)"
  );
  const rowEl = page.locator(`[data-resume-entry="${jobM.id}"]`).first();
  must(await rowEl.isVisible().catch(() => false), "the cross-canvas entry still renders (history, not a void)");
  const rowTitle = ((await rowEl.getAttribute("title").catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(
    rowTitle.includes("project's canvas") && rowTitle.includes(SECOND_NAME) && rowTitle.includes("switch to that project"),
    `the history row's tooltip NAMES the other canvas ("${rowTitle.slice(0, 110)}")`
  );
  must(
    !rowTitle.includes("gone (deleted)"),
    "the alive-on-another-canvas row does NOT claim the job is gone (three states, no lies)"
  );
  // t270's lesson, kept: the résumé card lives deep in the editor's 60vh
  // scroll area — bring the row into the frame BEFORE the shot.
  await rowEl.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/t272-cross-canvas-history-row.png` });

  // C7 — DELETE the second project: the records die WITH it (the cascade),
  //      and the résumé stands down entirely
  const delProj = await fetch(`${BASE}/api/projects/${secondProjectId}`, {
    method: "DELETE",
    headers: SH,
  });
  must(delProj.status === 200, `the second project is deleted (got ${delProj.status})`);
  secondProjectId = null; // consumed — finally must not double-delete
  const resumeGone = await pollUntil(async () => {
    const list = await readConns();
    const c = (Array.isArray(list) ? list : []).find((x) => x.id === connId);
    return c && c.resume == null ? c : null;
  }, 10_000);
  must(!!resumeGone, "after the project died, the résumé field is OMITTED (t270's zero-run contract, project granularity)");
  must(
    !stateRuns()[jobM.id] && !stateRuns()[importJob.id],
    "the cascade swept BOTH records out of the global state file (no orphans)"
  );

  // the dialog, witnessed from the other side: the card stands down
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch(() => {});
  await sleep(1500);
  const cardAfter = await page.locator("[data-run-resume]").count();
  must(cardAfter === 0, `the résumé card stood down with its last record (${cardAfter} cards)`);
  await page.screenshot({ path: `${SHOTS}/t272-post-delete-empty-dialog.png` });

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt272: ALL PASS" : `\nt272: ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  console.log("== cleanup ==");
  try { execSync("pkill -f relion_run_motioncorr", { stdio: "pipe" }); } catch { /* none */ }
  for (const id of [...createdJobs].reverse()) await deleteJob(id);
  for (const cid of [...connIds].reverse()) {
    try {
      await fetch(`${BASE}/api/remote/connections/${cid}`, { method: "DELETE", headers: SH });
    } catch { /* best effort */ }
  }
  if (secondProjectId) {
    try {
      await fetch(`${BASE}/api/projects/${secondProjectId}`, { method: "DELETE", headers: SH });
      console.log("  (cleanup) removed the second project");
    } catch { /* best effort */ }
  }
  try {
    const projectsNow = await (await fetch(`${BASE}/api/projects`, { headers: SH })).json();
    const demo = (projectsNow.projects ?? []).find((p) => p.name !== SECOND_NAME);
    if (demo) {
      await fetch(`${BASE}/api/projects/switch`, {
        method: "POST",
        headers: { ...SH, "Content-Type": "application/json" },
        body: JSON.stringify({ id: demo.id }),
      });
    }
  } catch { /* best effort */ }
  try { rmSync(MICS_DIR, { recursive: true, force: true }); } catch { /* gone */ }
  try {
    const fs = await import("node:fs");
    const ids = createdJobs.map((id) => id.slice(-8));
    const projDir = "/home/z/my-project/data/relion";
    for (const proj of fs.readdirSync(projDir)) {
      const inner = path.join(projDir, proj);
      let entries = [];
      try { entries = fs.readdirSync(inner); } catch { continue; }
      for (const d of entries) {
        if (!ids.some((s) => d.endsWith(`_${s}`))) continue;
        try { rmSync(path.join(inner, d), { recursive: true, force: true }); } catch { /* best effort */ }
      }
      const link = path.join(inner, "micrographs");
      try {
        const st = fs.lstatSync(link);
        if (st.isSymbolicLink() && readlinkSync(link) === MICS_DIR) rmSync(link, { force: true });
      } catch { /* not a link */ }
    }
  } catch { /* best effort */ }
  try {
    execSync(
      `node services/mock-cluster/test-client.mjs 'rm -rf /projects/cryoflow/*/motioncorr_* /projects/cryoflow/*/import_* /projects/cryoflow/*/micrographs'`,
      { cwd: "/home/z/my-project", stdio: "pipe", timeout: 30_000 }
    );
  } catch { /* best effort */ }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
  await sleep(1500);
  try {
    const after = await (await fetch(`${BASE}/api/jobs`)).json();
    const n = (after.jobs ?? []).length;
    must(n === 21, `roster restored to 21 (got ${n})`);
  } catch (e) {
    must(false, `roster check failed (${e.message})`);
  }
  await browser.close().catch(() => {});
}
