// t120 — Task 120: the Overview leg of the failure diagnosis (Task 119's
// strip answers WHY in the Log tab; the Overview summary now carries the
// verdict too).
//
// The Log console unmounts with its tab (Radix Tabs), so a user reading the
// Overview of a failed job saw "Job failed" and nothing more. Now the failed
// summary card carries a diagnosis teaser: the finding COUNT across the
// WHOLE run.out (one ?full=1 fetch — a failed job's log is static), one chip
// per signature (the actionable hint on hover), and a jump button that lands
// the Log console in FULL mode — so the strip's count equals the teaser's on
// arrival (parity by construction, not by coincidence of windows). Any
// manual tab change drops the console back to its tail default.
//
// The probe walks all of it:
// Phase S — seed a failed job whose stdout carries the gpu-oom + missing-input
//           signatures EARLY (L5/L6) behind 700+ filler lines (so the default
//           600-line tail EXCLUDES them) and the stderr trio late; plus a
//           COMPLETED control whose log says "Killed" (status gate proof).
//           Oracles: full-text diagnosis = 5 findings, tail-text = 3 — the
//           window split is the fixture's whole point.
// Phase A — screen: strip (tail window) still 3 on arrival [Task 119 intact];
//           Overview teaser counts 5 with chips in full-log first-occurrence
//           order; jump lands Full mode and strip count == teaser count;
//           manual tab round-trip returns to tail (3); control shows nothing.
// Phase B — paper: the Overview report carries the teaser (header, count,
//           labels, ground-truth note) and NOT the jump button (screen
//           chrome); A4 portrait; control paper stays clean.
// Phase F — static: teaser hooks, ?full=1 wiring, one-shot initialMode,
//           print re-ink rules, compiled chunks (both worlds), matrix glob.
// Phase Z — cleanup (jobs deleted → run records cascade → logs 404),
//           workdirs removed, console clean.
//
// Run: node scripts/t120-e2e.mjs   (server on :3000)
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const seeded = [];
async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const s of seeded) {
    try {
      const code = await fetch(`${BASE}/api/jobs/${s.id}`, { method: "DELETE" })
        .then((r) => r.status).catch(() => 0);
      if (code === 200 && s.workdir) {
        try { rmSync(s.workdir, { recursive: true, force: true }); } catch {}
      }
    } catch {}
  }
}
const must = (cond, label) => {
  if (!cond) {
    console.log(`FATAL: ${label}`);
    void cleanup().then(() => process.exit(1));
    throw new Error(`FATAL: ${label}`);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};
const step = (m) => console.log(m);
process.on("SIGINT", () => { console.log("SIGINT"); process.exit(1); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(1); });

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000 }).trim();
const api = async (path, method = "GET", body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
};
const listJobs = async () => {
  const j = await (await api("/api/jobs")).json();
  return j.jobs ?? j;
};

// ---------- seed (t119 conventions) ----------
const ENGINE_STATE = "/home/z/my-project/data/engine-state.json";
const flipStatus = (id, status, progress) =>
  sh(`node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.job.update({where:{id:'${id}'},data:{status:'${status}',progress:${progress}}}).then(()=>p.\\$disconnect())"`);

// the probe's own oracle: the SAME six signatures, re-derived from the API
// text (independent of the app's module — the two must agree)
const PATTERNS = [
  ["oom-kill", /\bKilled\b|oom-kill(?:er)?\b/i],
  ["gpu-oom", /cuda[\w: ]*(?:error|out of memory)|out of memory|hipError/i],
  ["disk-full", /no space left on device|disk quota exceeded|read-only file system/i],
  ["missing-input", /no such file or directory/i],
  ["permission", /permission denied/i],
  ["segfault", /segmentation fault|\bcore dumped\b/i],
];
function deriveFindings(text) {
  const out = [];
  const by = new Map();
  text.split("\n").forEach((line, i) => {
    for (const [id, re] of PATTERNS) {
      if (!re.test(line)) continue;
      const ex = by.get(id);
      if (ex) ex.count += 1;
      else {
        const f = { id, firstLine: i + 1, count: 1, excerpt: line.replace(/\s+/g, " ").trim() };
        by.set(id, f);
        out.push(f);
      }
    }
  });
  return out;
}

// stdout: signatures EARLY (L5/L6), then 704 filler lines — combined length
// > 600 so the console's default tail window EXCLUDES the early evidence
const STDOUT_LINES = [
  "RELION: 3D auto-refine (t120 seed)",
  "Reading 20480 particles ... done",
  "CTF: estimating per-particle defocus ...",
  "Iteration 01: E-step ... done",
  "CUDA error: out of memory when allocating workspace",
  "No such file or directory: ../MotionCorr/job008/corrected_micrographs.star",
  ...Array.from({ length: 704 }, (_, k) => `Iteration ${String((k % 25) + 2).padStart(2, "0")}: M-step ... 0.${600 + (k % 100)}`),
];
const STDERR_LINES = [
  "Killed",
  "touch: cannot touch 'run.out': No space left on device",
  "cat: results/star: Permission denied",
];

const seedJob = async (name, status, progress, stdoutLines, stderrLines, tailNeedle) => {
  const ws = (await (await api("/api/workspaces")).json()).workspaces ?? [];
  must(ws.length > 0, `${name}: a workspace exists to host the seed`);
  const jobs = await listJobs();
  const maxY = jobs.reduce((m, j) => Math.max(m, (j.y ?? 0) + 260), 800);
  const created = await (
    await api("/api/jobs", "POST", {
      type: "refine3d", name, workspaceId: ws[0].id, x: 140, y: maxY + 260,
    })
  ).json();
  const j = created?.job ?? created;
  must(j?.id && j?.name, `${name}: created via POST /api/jobs`);
  const proj = j.projectId;
  const wd = `/home/z/my-project/data/relion/${proj}/refine3d_${j.id.slice(-8)}`;
  mkdirSync(wd, { recursive: true });
  writeFileSync(`${wd}/run.out`, stdoutLines.join("\n") + "\n");
  writeFileSync(`${wd}/run.err`, stderrLines.join("\n") + "\n");
  const state = existsSync(ENGINE_STATE) ? JSON.parse(readFileSync(ENGINE_STATE, "utf8")) : {};
  state[j.id] = {
    jobId: j.id, projectId: proj, type: "refine3d", pid: null,
    cmd: "t120 seed (overview diagnosis leg)", workdir: wd,
    logFile: `${wd}/run.out`, errFile: `${wd}/run.err`,
    startedAt: new Date().toISOString(), outputs: {},
    done: true, exitCode: status === "failed" ? 1 : 0,
  };
  writeFileSync(ENGINE_STATE, JSON.stringify(state, null, 2));
  flipStatus(j.id, status, progress);
  seeded.push({ id: j.id, name: j.name, workdir: wd });
  // both windows through the SAME api the app reads. NOTE: the diag fixture
  // is DELIBERATELY longer than the 600-line tail window, so the tail api is
  // verified against a LATE needle — the first stdout line lives outside it
  // by design (only the full window is promised to carry it).
  const tailApi = await (await api(`/api/jobs/${j.id}/log`)).json();
  const fullApi = await (await api(`/api/jobs/${j.id}/log?full=1`)).json();
  must(typeof fullApi.tail === "string" && fullApi.tail.includes(stdoutLines[0]),
    `${name}: full-log API returns the crafted run.out`);
  must(typeof tailApi.tail === "string" && tailApi.tail.includes(tailNeedle),
    `${name}: tail API returns its window (needle "${tailNeedle}")`);
  const st = (await listJobs()).find((x) => x.id === j.id)?.status;
  must(st === status, `${name}: status flipped to ${status} (verified via list API)`);
  return { id: j.id, name: j.name, workdir: wd, tailText: tailApi.tail, fullText: fullApi.tail };
};

// ---------- browser helpers (t118/t119 conventions) ----------
const boot = async () => {
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(4500);
  for (let i = 0; i < 10; i++) {
    const card = await p.locator("[data-job]").first().isVisible().catch(() => false);
    if (card) return;
    await sleep(1500);
  }
  must(false, "boot: canvas cards visible");
};
const openInspector = async (name) => {
  for (let i = 0; i < 8; i++) {
    // reach FIRST (Task 136 doctrine, backfilled after the boot-fit click
    // point landed on the zoom-controls' find-toggle button — fixed
    // widgets legally cover some canvas points, and a world-dependent
    // screen point is never trustworthy): Ctrl+F → name → Enter =
    // focusJob centers the card mid-viewport at legibility zoom, away
    // from every fixed widget, then the click lands on a visible target.
    await p.keyboard.press("Control+f").catch(() => {});
    const bar = p.locator('[data-testid="canvas-find-input"]');
    if (await bar.isVisible().catch(() => false)) {
      await bar.fill(name);
      await sleep(300);
      await p.keyboard.press("Enter");
      await sleep(800);
      await p.keyboard.press("Escape");
      await sleep(400);
    }
    await p.locator(`[data-job]`, { hasText: name }).first().click({ timeout: 3000 }).catch(() => {});
    await sleep(1200);
    // the RIGHT inspector — a covered/jittered click must not bless a
    // neighbor's dialog (the t113 lineage lesson)
    const open = await p.evaluate((nm) => {
      const dl = document.querySelector("[data-inspector-dialog]");
      return !!dl && dl.getAttribute("data-state") === "open" && (dl.textContent || "").includes(nm);
    }, name).catch(() => false);
    if (open) return true;
    await sleep(1500);
  }
  return false;
};
// Radix TabsTrigger activates on real pointer events — playwright's click
// dispatches them (t112/t113 lesson: synthetic .click() is dead)
const openTab = async (label) => {
  let tab = "";
  for (let i = 0; i < 6 && tab !== "active"; i++) {
    await p.locator('[role="tab"]').filter({ hasText: new RegExp(`^${label}$`) }).first().click().catch(() => {});
    await sleep(900);
    tab = (await p.locator('[role="tab"]').filter({ hasText: new RegExp(`^${label}$`) })
      .first().getAttribute("data-state").catch(() => "")) ?? "";
  }
  return tab === "active";
};
const openLogTab = () => openTab("Log");
const openOverviewTab = () => openTab("Overview");
const waitTeaser = async () => {
  for (let i = 0; i < 16; i++) {
    const n = await p.locator("[data-overview-diagnosis]").count().catch(() => 0);
    if (n === 1) return true;
    await sleep(600);
  }
  return false;
};
const waitLogLoaded = async (needle) => {
  for (let i = 0; i < 20; i++) {
    const body = await p.locator("[data-log-console] [role=log]").textContent().catch(() => "");
    if (body && body.includes(needle)) return true;
    await sleep(700);
  }
  return false;
};
const readChips = () =>
  p.evaluate(() =>
    [...document.querySelectorAll("[data-overview-diagnosis] [data-ovd-chip]")].map((el) => ({
      id: el.getAttribute("data-ovd-chip"),
      label: el.querySelector(".ovd-chip-label")?.textContent ?? "",
      title: el.getAttribute("title") ?? "",
    }))
  );
const stripAria = async () =>
  (await p.locator("[data-log-diagnosis]").getAttribute("aria-label").catch(() => "")) ?? "";
const consoleIsFull = async () => {
  const t = await p.locator("[data-log-console]").first().textContent().catch(() => "");
  return { full: /\(\s*full\s*\)|lines \(full\)/.test(t ?? ""), text: t ?? "" };
};

// ---------- phases ----------
console.log("== PHASE S: seed failed + control, both log windows verified ==");
for (const s of await listJobs()) {
  if (s.name === "t120 Diag" || s.name === "t120 Clean") {
    await api(`/api/jobs/${s.id}`, "DELETE");
    try { rmSync(`/home/z/my-project/data/relion/${s.projectId}/refine3d_${s.id.slice(-8)}`, { recursive: true, force: true }); } catch {}
    step(`  pre-cleaned leaked row ${s.name}`);
  }
}
const diag = await seedJob("t120 Diag", "failed", 47, STDOUT_LINES, STDERR_LINES, "M-step");
const clean = await seedJob(
  "t120 Clean", "completed", 100,
  ["RELION: control run (t120 seed)", "Killed appears in passing (idle chatter)",
   "Iteration 01: E-step ... done", "Final map written ... done"],
  ["", ""], "Final map written",
);
const expectedFull = deriveFindings(diag.fullText);
const expectedTail = deriveFindings(diag.tailText);
must(expectedFull.length === 5, `S: full-log oracle derives 5 findings (got ${expectedFull.length})`);
must(expectedFull[0].id === "gpu-oom" && expectedFull[0].firstLine === 5,
  "S: gpu-oom anchors at L5 of the FULL log");
must(expectedFull[1].id === "missing-input" && expectedFull[1].firstLine === 6,
  "S: missing-input anchors at L6");
must(expectedFull.slice(2).map((f) => f.id).join(",") === "oom-kill,disk-full,permission",
  "S: stderr trio follows in first-occurrence order");
must(diag.fullText.split("\n").length > 600, `S: log exceeds the 600-line tail window (${diag.fullText.split("\n").length} lines)`);
must(expectedTail.length === 3, `S: tail-window oracle derives 3 findings (got ${expectedTail.length})`);
must(!expectedTail.some((f) => f.id === "gpu-oom" || f.id === "missing-input"),
  "S: the tail window EXCLUDES the early stdout evidence (the fixture's whole point)");
must(deriveFindings(clean.fullText).some((f) => f.id === "oom-kill"),
  "S: control log DOES contain a Killed signature (status gate is what hides the teaser)");

console.log("== PHASE A: screen leg — teaser counts the WHOLE log, jump restores parity ==");
await boot();
must(await openInspector("t120 Diag"), "A1 inspector opened on the failed job");
must(await waitLogLoaded("Killed"), "A2 smart default lands on Log and the log loads");
must(await stripAria() === "Failure diagnosis: 3 findings",
  `A3 strip in the tail window still shows 3 (Task 119 intact; got "${await stripAria()}")`);
must(await openOverviewTab(), "A4 Overview tab active (real pointer click)");
must(await waitTeaser(), "A5 diagnosis teaser rendered on the failed summary");
const teaserAria = await p.locator("[data-overview-diagnosis]").getAttribute("aria-label");
must(teaserAria === "Failure diagnosis: 5 findings in the full log",
  `A6 teaser aria announces 5 full-log findings (got "${teaserAria}")`);
const countPill = (await p.locator("[data-overview-diagnosis] .ovd-count").textContent())?.trim();
must(countPill === "5 findings", `A7 count pill reads "5 findings" (got "${countPill}")`);
const chips = await readChips();
must(chips.length === 5, `A8 five chips rendered (got ${chips.length})`);
must(chips.map((c) => c.id).join(",") === expectedFull.map((f) => f.id).join(","),
  `A9 chip order matches the FULL log's first occurrence (${chips.map((c) => c.id).join(",")})`);
must(chips[0].label.includes("Out-of-memory error"), "A10 gpu-oom chip names the allocator");
must(chips[1].label.includes("Missing file"), "A11 missing-input chip names the miss");
const t0 = await p.locator("[data-ovd-chip=oom-kill]").getAttribute("title");
const t4 = await p.locator("[data-ovd-chip=permission]").getAttribute("title");
must((t0 ?? "").includes("lower the thread count"), "A12 oom-kill chip hover carries the actionable hint");
must((t4 ?? "").includes("ownership"), "A13 permission chip hover carries the actionable hint");
must(await p.locator("[data-overview-diagnosis] .ovd-note").isVisible(),
  "A14 ground-truth note visible (sm+ viewport)");
must((await p.locator("[data-overview-diagnosis] .ovd-head-label").textContent()).trim()
  .toLowerCase() === "failure diagnosis", "A15 teaser header reads Failure diagnosis");
// the jump: parity by construction — Full mode, strip count == teaser count
await p.locator("[data-overview-diagnosis] button").first().click();
await sleep(1200);
must(await p.locator('[role="tab"]').filter({ hasText: /^Log$/ }).first().getAttribute("data-state")
  .catch(() => "") === "active", "A16 jump landed on the Log tab");
must(await waitLogLoaded("Killed"), "A17 full log loaded after the jump");
const fullState = await consoleIsFull();
must(fullState.full, "A18 console is in FULL mode after the jump (one-shot initialMode)");
must(await stripAria() === "Failure diagnosis: 5 findings",
  `A19 PARITY: strip count equals teaser count on arrival (got "${await stripAria()}")`);
// manual tab round-trip: the one-shot flag clears, the tail default returns
must(await openOverviewTab(), "A20 manual switch back to Overview");
must(await waitTeaser(), "A21 teaser still present on return");
must(await openLogTab(), "A22 manual switch to Log via its trigger");
must(await waitLogLoaded("Killed"), "A23 log reloaded after remount");
const backState = await consoleIsFull();
must(!backState.full, "A24 one-shot flag CLEARED: manual return lands in tail mode");
must(await stripAria() === "Failure diagnosis: 3 findings",
  `A25 strip back to the tail window's honest 3 (got "${await stripAria()}")`);
// status gate: the completed control shows no teaser anywhere
await p.keyboard.press("Escape");
await sleep(900);
must((await p.locator("[data-inspector-dialog][data-state=open]").count()) === 0,
  "A26 inspector closed via Escape");
must(await openInspector("t120 Clean"), "A27 inspector opened on the control job");
must(await openOverviewTab(), "A28 control's Overview active");
must((await p.locator("[data-overview-diagnosis]").count()) === 0,
  "A29 STATUS GATE: completed job shows NO teaser (even with 'Killed' in its log)");
await p.keyboard.press("Escape");
await sleep(700);

console.log("== PHASE B: paper leg — the Overview report carries the verdict ==");
must(await openInspector("t120 Diag"), "B1 inspector reopened on the failed job");
must(await openOverviewTab(), "B2 Overview active for the report");
await sleep(1200);
const pdfPath = "/tmp/t120-overview.pdf";
await p.pdf({ path: pdfPath, format: "A4" });
const txt = sh(`pdftotext ${pdfPath} -`);
must(/failure diagnosis/i.test(txt), "B3 teaser header on paper");
must(/5 findings/.test(txt), "B4 full-log count on paper");
must(/out-of-memory error/i.test(txt), "B5 gpu-oom label on paper");
must(/missing file/i.test(txt), "B6 missing-input label on paper");
must(/oom killer/i.test(txt), "B7 oom-kill label on paper");
must(/disk full or read-only/i.test(txt), "B8 disk-full label on paper");
must(/permission denied/i.test(txt), "B9 permission label on paper");
must(/across the full run\.out/i.test(txt), "B10 ground-truth note on paper");
must(!/open the full diagnosis/i.test(txt),
  "B11 jump button is screen chrome — absent from paper");
must(/job failed/i.test(txt), "B12 failed summary card prints around the teaser");
const geo = sh(`pdfinfo ${pdfPath} | rg 'Page size'`);
must(/Page size:\s*595(\.\d+)? x 842(\.\d+)? pts/.test(geo),
  `B13 Overview report page is A4 portrait (got "${geo}")`);
await p.keyboard.press("Escape");
await sleep(700);
must(await openInspector("t120 Clean"), "B14 control reopened");
must(await openOverviewTab(), "B15 control's Overview active");
const pdfClean = "/tmp/t120-overview-clean.pdf";
await p.pdf({ path: pdfClean, format: "A4" });
const txtClean = sh(`pdftotext ${pdfClean} -`);
must(!/failure diagnosis/i.test(txtClean), "B16 control paper carries NO diagnosis");
await p.keyboard.press("Escape");
await sleep(600);

console.log("== PHASE F: static contracts ==");
const ji = readFileSync("/home/z/my-project/src/components/workflow/job-inspector.tsx", "utf8");
must(ji.includes('data-overview-diagnosis=""'), "F1 teaser carries the data hook");
must(ji.includes("data-ovd-chip={f.id}"), "F2 chips carry per-pattern hooks");
must(ji.includes("diagnoseLog(body.tail)"), "F3 teaser diagnoses the FULL log text");
must(ji.includes("log?full=1"), "F4 the one ?full=1 fetch is wired");
must(ji.includes("initialMode"), "F5 LogConsole takes the one-shot initial mode");
must(ji.includes("setLogJumpFull(true)"), "F6 the jump sets the full-mode flag");
must(ji.includes("setLogJumpFull(false); setTab(v);"), "F7 any manual tab change clears the flag");
must(ji.includes("!jobId || !jobFailed"), "F7a the fetch gates on the failed status");
const mod = readFileSync("/home/z/my-project/src/lib/log-diagnosis.ts", "utf8");
must(/export function diagnoseLog/.test(mod), "F8 single source intact (diagnoseLog exported)");
const cssFlat = () => readFileSync("/home/z/my-project/src/app/globals.css", "utf8").replace(/\n\s*/g, " ");
must(cssFlat().includes("[data-overview-diagnosis] .ovd-head-label"),
  "F9 print re-ink covers the teaser header");
must(/\[data-overview-diagnosis\]\s*\[data-ovd-chip\]\s*{[^}]*break-inside: avoid/.test(cssFlat()),
  "F10 chips print atomically");
must(cssFlat().includes("[data-overview-diagnosis] .ovd-chip-label"),
  "F11 chip labels re-ink on paper");
const builtCss = sh(
  `rg -l 'data-overview-diagnosis' /home/z/my-project/.next/static/chunks/ --glob '*.css' | head -1`
);
must(builtCss.length > 0, "F12 print rules reached the compiled css");
const builtStatic = sh(
  `rg -l 'data-overview-diagnosis' /home/z/my-project/.next/static/chunks/ --glob '*.js' | head -1`
);
const builtStandalone = sh(
  `rg -l 'data-overview-diagnosis' /home/z/my-project/.next/standalone/.next/static/chunks/ --glob '*.js' | head -1`
);
must(builtStatic.length > 0 && builtStandalone.length > 0,
  "F13 teaser markup in BOTH compiled worlds (static + standalone)");
must(/for f in scripts\/t1\[0-9\]\[0-9\]-e2e\.mjs; do/.test(
  readFileSync("/home/z/my-project/scripts/run-matrix.sh", "utf8")
  ),
  "F14 matrix glob auto-includes t120 (t1[0-9][0-9] pattern)");

console.log("== PHASE Z: cleanup + hygiene ==");
await cleanup();
await sleep(500);
const remaining = await listJobs();
must(!remaining.some((x) => x.name === "t120 Diag" || x.name === "t120 Clean"),
  "Z1 both seeded jobs deleted");
for (const s of seeded) {
  const code = await fetch(`${BASE}/api/jobs/${s.id}/log`).then((r) => r.status).catch(() => 0);
  must(code === 404, `Z2 ${s.name}: run record cascaded (log 404, got ${code})`);
}
must(consoleErrors.length === 0 && pageErrors.length === 0,
  `Z3 console clean (${consoleErrors.length} console + ${pageErrors.length} page errors)`);

console.log(`T120 ALL PASS (${PASS} assertions)`);
process.exit(0);
