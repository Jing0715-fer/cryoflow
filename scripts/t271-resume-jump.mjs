/**
 * t271 — the résumé becomes an index (the observability round, act 5).
 *
 * t270 gave the cluster manager a résumé; its entries carried jobId but were
 * dumb rows — history you could read but not follow. t271 makes a résumé
 * entry whose job still exists a <button>: click = close the cluster dialog
 * and open that job's inspector (the doorway, not a dead end). A run whose
 * job is gone stays a plain history row — the résumé remembers what the
 * canvas forgot, and says so in its tooltip instead of pretending the jump
 * works.
 *
 * Phases:
 *   A  demo truth
 *   B  ledger — RunResumeCard speaks the store (existence check), the jump
 *      button (data-resume-jump, aria-label, ArrowUpRight affordance), the
 *      ORDER LAW inside handleOpenJob (close the dialog BEFORE inspect —
 *      the inspector must not fight another dialog for the foreground),
 *      the prop chain (both ConnectionEditor instances), and the honest
 *      gone-job history row
 *   C  live loop — six micrographs → import → probeless connection →
 *      - C2 a run completes (the résumé has one entry)
 *      - C3 the dialog renders the entry as a BUTTON carrying the job's
 *        name → CLICK → the cluster dialog is GONE and the inspector is
 *        OPEN on that very job (the jump, witnessed end to end)
 *      - C4 the job is deleted → its run record dies with it (the record's
 *        lifecycle is the job's) → the résumé entry leaves and the card
 *        stands down entirely (the zero-run omission contract, witnessed
 *        from the other side — the honesty cuts both ways)
 *   D  console clean
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const MICS_DIR = "/home/z/my-project/data/relion/t271-mics";

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
let job1Id = null;
let importJobId = null;

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);

  // ---- Phase B: the index's ledger ----------------------------------------
  console.log("== PHASE B: the index ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");
  const dlgSrc = src("src/components/workflow/remote-cluster-dialog.tsx");

  must(
    dlgSrc.includes('import { useWorkflowStore } from "@/lib/store";'),
    "the dialog speaks the workflow store (existence is what the inspector can open)"
  );
  must(
    /function RunResumeCard\(\{\s*resume,\s*onOpenJob,/.test(dlgSrc) ||
      dlgSrc.includes("onOpenJob?: (jobId: string) => void;"),
    "RunResumeCard takes the onOpenJob doorway (an optional prop, optional = honest)"
  );
  must(
    dlgSrc.includes("const job = jobs.find((j) => j.id === e.jobId) ?? null;") &&
      dlgSrc.includes("const jumpable = job != null && onOpenJob != null;"),
    "the existence check reads the store (the résumé indexes only real doors)"
  );
  must(
    dlgSrc.includes('data-resume-jump=""') && dlgSrc.includes("onClick={() => onOpenJob?.(e.jobId)}"),
    "a jumpable entry is a real button (data-resume-jump + the onClick doorway)"
  );
  must(
    dlgSrc.includes("group-hover:opacity-70") && dlgSrc.includes("ArrowUpRight"),
    "the hover affordance exists (ArrowUpRight fades in on hover/focus)"
  );
  // ORDER LAW: close the cluster dialog BEFORE opening the inspector —
  // two dialogs fighting for the foreground is a lost user
  const hIdx = dlgSrc.indexOf("const handleOpenJob");
  const closeIdx = dlgSrc.indexOf("onOpenChange(false)", hIdx);
  const inspIdx = dlgSrc.indexOf("inspect(jobId)", hIdx);
  must(
    hIdx > -1 && closeIdx > -1 && inspIdx > -1 && closeIdx < inspIdx,
    "handleOpenJob closes the dialog FIRST, then inspects (the order is the law)"
  );
  must(
    (dlgSrc.match(/onOpenJob=\{handleOpenJob\}/g) ?? []).length === 2,
    "BOTH ConnectionEditor instances ride the doorway (creating + editing)"
  );
  must(
    dlgSrc.includes("the job is gone (deleted, or another project's canvas)") &&
      dlgSrc.includes("the résumé keeps it as history"),
    "the gone-job row speaks honestly (history, not a dead door)"
  );
  must(
    dlgSrc.includes("click one to open its job"),
    "the footer teaches the new verb (click = open the inspector)"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (a doorway, witnessed) ==");

  // C1 — six tiny but valid MRC micrographs + a REAL local import
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

  const importJob = await mkJob({
    type: "import",
    name: "t271 Import",
    params: { micrographsPath: MICS_DIR, pixelSize: 1.77 },
  });
  must(!!importJob?.id, "the import job exists");
  importJobId = importJob.id;
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

  // C2 — a probeless connection; one remote run completes (the résumé is born)
  const connId = `qa-t271-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: connId,
      name: "QA t271 Index",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  const mkBody = await mk.json();
  must(mk.status === 201 && !!mkBody?.connection?.id, `the probeless connection is created (got ${mk.status})`);

  const job1 = await mkJob({ type: "motioncorr", name: "t271 MotionCorr Index" });
  const e = await mkEdge(importJob.id, job1.id, "micrographs", "movies");
  must(e === 200 || e === 201, `import → remote motioncorr wired (${e})`);
  const d = await fetch(`${BASE}/api/jobs/${job1.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(d.status === 200 || d.status === 201, `probeless dispatch accepted (${d.status})`);
  job1Id = job1.id;
  const done1 = await pollUntil(async () => {
    const j = await readJob(job1.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(done1?.status === "completed", `the run completes (${done1?.status}: ${(done1?.result ?? "").slice(0, 50)})`);
  const readResume = async () => {
    const list = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
    return (list.connections ?? []).find((c) => c.id === connId)?.resume ?? null;
  };
  const resume1 = await pollUntil(async () => {
    const r = await readResume();
    return r && r.total >= 1 ? r : null;
  }, 10_000);
  must(!!resume1 && resume1.total === 1, `the résumé has its first entry (total ${resume1?.total ?? "?"})`);

  // C3 — the doorway, witnessed end to end: dialog → entry button → CLICK →
  // the cluster dialog is GONE and the inspector is OPEN on that very job
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch(() => {});
  await sleep(1500);
  const card = page.locator("[data-run-resume]").first();
  must(await card.isVisible().catch(() => false), "the résumé card renders inside the cluster dialog");

  const jumpBtn = page.locator(`[data-resume-jump][data-resume-entry="${job1.id}"]`).first();
  must(await jumpBtn.isVisible().catch(() => false), "the completed run's entry is a real jump button");
  const aria = (await jumpBtn.getAttribute("aria-label").catch(() => "")) ?? "";
  must(
    aria.includes("t271 MotionCorr Index"),
    `the button's aria-label speaks the job's NAME ("${aria}")`
  );
  const entryTxt = ((await jumpBtn.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(
    entryTxt.includes("t271 MotionCorr Index") && entryTxt.includes("motioncorr") && /staged /.test(entryTxt),
    `the entry shows name + type + ledger ("${entryTxt.slice(0, 70)}")`
  );

  // hover for the affordance, then the hero shot of the index
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await jumpBtn.hover().catch(() => {});
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/t271-resume-jump-dialog.png` });

  await jumpBtn.click();
  await sleep(1200);
  const remoteGone = !(await page
    .locator("[data-run-resume]")
    .first()
    .isVisible()
    .catch(() => false));
  must(remoteGone, "the cluster dialog CLOSED itself (the doorway does not leave it looming)");
  const inspector = page.locator("[data-inspector-dialog]").first();
  must(await inspector.isVisible().catch(() => false), "the job inspector OPENED (the résumé was an index)");
  const inspTxt = ((await inspector.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(
    inspTxt.includes("t271 MotionCorr Index"),
    "the inspector is on the VERY job the entry pointed at (not a random neighbor)"
  );
  // the destination shot: what the jump lands on
  await sleep(800);
  await page.screenshot({ path: `${SHOTS}/t271-resume-jump-inspector.png` });
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(600);

  // C4 — the record's lifecycle is the job's: DELETE /api/jobs calls
  // clearRunRecord, so the run's entry leaves the résumé WITH the job, and
  // the zero-run omission contract (t270) makes the whole card stand down.
  // Nothing that is no longer on the books is displayed — the honesty cuts
  // both ways. (The B-phase history row stays for the genuinely unreachable
  // door: a résumé entry whose job lives on ANOTHER project's canvas.)
  await deleteJob(job1.id);
  const resumeAfterDelete = await pollUntil(async () => {
    const r = await readResume();
    return r === null ? "gone" : null;
  }, 10_000);
  must(resumeAfterDelete === "gone", "the deleted job's entry leaves the résumé (the record's life is the job's)");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch(() => {});
  await sleep(1500);
  must(
    (await page.locator("[data-run-resume]").count()) === 0,
    "the résumé card stands down entirely (zero runs omit the field — t270's contract, from the other side)"
  );
  must(
    (await page.locator('text=Run résumé').count()) === 0,
    "no résumé ghost remains in the pane"
  );

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt271: ALL PASS" : `\nt271: ${fail} FAIL`);
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
  try { rmSync(MICS_DIR, { recursive: true, force: true }); } catch { /* gone */ }
  try {
    const fs = await import("node:fs");
    const ids = [job1Id, importJobId].filter(Boolean).map((id) => id.slice(-8));
    const projDir = "/home/z/my-project/data/relion";
    for (const proj of fs.readdirSync(projDir)) {
      const inner = path.join(projDir, proj);
      let entries = [];
      try { entries = fs.readdirSync(inner); } catch { continue; }
      for (const d of entries) {
        if (ids.some((id) => d.includes(id))) {
          try { fs.rmSync(path.join(inner, d), { recursive: true, force: true }); } catch { /* best effort */ }
        }
      }
    }
  } catch { /* best effort */ }
  const jobsZ = await (await fetch(`${BASE}/api/jobs`)).json();
  const rosterZ = (jobsZ.jobs ?? []).length;
  must(rosterZ === 21, `roster restored to 21 (got ${rosterZ})`);
  await browser.close().catch(() => {});
}
