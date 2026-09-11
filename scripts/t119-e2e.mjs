// t119 — Task 119: failure diagnosis strip (the log answers WHAT, the
// strip answers WHY).
//
// A failed job's Log tab grows a diagnosis panel between the toolbar and
// the console: known failure signatures (OOM kill · CUDA/GPU memory ·
// full disk · missing upstream file · permissions · segfault) recognized
// in run.out/run.err, each with provenance (line number + excerpt) and
// an actionable hint. Pure client-side parsing (src/lib/log-diagnosis.ts)
// — zero API changes; the pattern table is the single interpretation
// source. The strip prints as part of the job report (Task 114 doctrine:
// the paper is the job's post-mortem), which also pays Task 116's debt:
// log ROWS now print from REAL log text, not just static coverage.
//
// The probe walks all of it:
// Phase S — seed a failed job (crafted run.out with a CUDA OOM line +
//           missing-input errno + filler, run.err with Killed + disk +
//           permission behind the stderr separator) + a COMPLETED control
//           whose log says "Killed" (status gate proof); verify through
//           the SAME API the Log console reads
// Phase A — screen: strip visible only on the failed job; finding order
//           matches the log's first-occurrence order; ids/labels/excerpts/
//           badges/hints all contract-checked against an independent
//           re-derivation from the API text (t118 A3 doctrine: assert
//           against the app's observable face); control shows NO strip
// Phase B — paper: the failed job's report carries the diagnosis (labels,
//           hints, excerpts), the stderr separator, and the real log rows
//           — portrait 612×792 (Task 115 contract)
// Phase F — static: pattern table (6 ids, stateless regexes), inspector
//           wiring, print rules, compiled chunks (fresh bundle), matrix glob
// Phase Z — cleanup (jobs deleted → run records cascade → logs 404),
//           workdirs removed, console clean
//
// Run: node scripts/t119-e2e.mjs   (server on :3000)
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
const seeded = []; // {id, name, workdir} — Z deletes every one, FATAL paths included
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
    throw new Error(`FATAL: ${label}`); // halt the phase synchronously —
    // without the throw, execution walks into assertions whose browser
    // is being torn down beneath them (the second hard way)
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

// ---------- seed ----------
const ENGINE_STATE = "/home/z/my-project/data/engine-state.json";
const flipStatus = (id, status, progress) =>
  sh(`node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.job.update({where:{id:'${id}'},data:{status:'${status}',progress:${progress}}}).then(()=>p.\\$disconnect())"`);

// the probe's own oracle: the SAME six signatures, re-derived from the
// API text the console displays (independent of the app's module — the
// two must agree for the strip to be honest)
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

const STDOUT_LINES = [
  "RELION: 3D auto-refine (t119 seed)",
  "Reading 20480 particles ... done",
  "CTF: estimating per-particle defocus ...",
  "Iteration 01: E-step ... done",
  "CUDA error: out of memory when allocating workspace",
  "Retrying allocation on CPU ...",
  "Iteration 05: M-step ... 0.618",
  "Writing rlnImageName ... done",
  "No such file or directory: ../MotionCorr/job008/corrected_micrographs.star",
  "Falling back to local stack ...",
];
const STDERR_LINES = [
  "terminate called after throwing an instance of 'std::runtime_error'",
  "Killed",
  "touch: cannot touch 'run.out': No space left on device",
  "cat: results/star: Permission denied",
];

const seedJob = async (name, status, progress, stdoutLines, stderrLines) => {
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
  // workdir + log files (the run record's logFile/errFile must point at
  // real bytes — getLogTail reads disk, not the DB)
  const proj = j.projectId;
  const wd = `/home/z/my-project/data/relion/${proj}/refine3d_${j.id.slice(-8)}`;
  mkdirSync(wd, { recursive: true });
  writeFileSync(`${wd}/run.out`, stdoutLines.join("\n") + "\n");
  writeFileSync(`${wd}/run.err`, stderrLines.join("\n") + "\n");
  // register the run record the way the engine would (qa61 precedent:
  // the row is the source of truth for status, the state file for runs)
  const state = existsSync(ENGINE_STATE) ? JSON.parse(readFileSync(ENGINE_STATE, "utf8")) : {};
  state[j.id] = {
    jobId: j.id, projectId: proj, type: "refine3d", pid: null,
    cmd: "t119 seed (failure diagnosis)", workdir: wd,
    logFile: `${wd}/run.out`, errFile: `${wd}/run.err`,
    startedAt: new Date().toISOString(), outputs: {},
    done: true, exitCode: status === "failed" ? 1 : 0,
  };
  writeFileSync(ENGINE_STATE, JSON.stringify(state, null, 2));
  flipStatus(j.id, status, progress);
  seeded.push({ id: j.id, name: j.name, workdir: wd });
  // verify through the SAME api the Log console reads
  const log = await (await api(`/api/jobs/${j.id}/log`)).json();
  must(typeof log.tail === "string" && log.tail.includes(stdoutLines[0]),
    `${name}: log API returns the crafted run.out`);
  const st = (await listJobs()).find((x) => x.id === j.id)?.status;
  must(st === status, `${name}: status flipped to ${status} (verified via list API)`);
  return { id: j.id, name: j.name, workdir: wd, logText: log.tail };
};

// ---------- browser helpers (t118 playwright conventions) ----------
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
    // reach FIRST: seeds land at maxY+260 where a small world's fit zoom
    // leaves them BELOW the viewport — playwright's click has no real
    // scroll for a transform-positioned canvas (the t113 family of
    // lessons). The find bar's Enter = focusJob: centers + legibility
    // zoom, then the click lands on a visible, stationary card.
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
    await p.locator(`[data-job]`, { hasText: name }).first().click().catch(() => {});
    await sleep(1200);
    // the RIGHT inspector — a jittered click must not bless a neighbor's
    // dialog (the t113 lineage lesson; t119 seeds have no downstream so
    // the name itself is unambiguous)
    const open = await p.evaluate((nm) => {
      const dl = document.querySelector("[data-inspector-dialog]");
      return !!dl && dl.getAttribute("data-state") === "open" && (dl.textContent || "").includes(nm);
    }, name).catch(() => false);
    if (open) return true;
    await sleep(1500);
  }
  return false;
};
const openLogTab = async () => {
  // Radix TabsTrigger activates on real pointer events — playwright's
  // click dispatches them (t112/t113 lesson: synthetic .click() is dead)
  let tab = "";
  for (let i = 0; i < 6 && tab !== "active"; i++) {
    await p.locator('[role="tab"]').filter({ hasText: /^Log$/ }).first().click().catch(() => {});
    await sleep(900);
    tab = (await p.locator('[role="tab"]').filter({ hasText: /^Log$/ })
      .first().getAttribute("data-state").catch(() => "")) ?? "";
  }
  return tab === "active";
};
const waitLogLoaded = async (needle) => {
  for (let i = 0; i < 20; i++) {
    const body = await p.locator("[data-log-console] [role=log]").textContent().catch(() => "");
    if (body && body.includes(needle)) return true;
    await sleep(700);
  }
  return false;
};
const readFindings = () =>
  p.evaluate(() =>
    [...document.querySelectorAll("[data-log-diagnosis] [data-finding]")].map((li) => ({
      id: li.getAttribute("data-finding"),
      label: li.querySelector(".diag-label")?.textContent ?? "",
      excerpt: li.querySelector(".diag-excerpt")?.textContent ?? "",
      badge: li.querySelector(".diag-linebadge")?.textContent ?? "",
      hint: li.querySelector(".diag-hint")?.textContent ?? "",
    }))
  );

// ---------- phases ----------
console.log("== PHASE S: seed failed + control, verify via log API ==");
// name collision pre-clean: a leaked row from a crashed run would break
// first-match clicks (qa61's second hard way)
for (const s of await listJobs()) {
  if (s.name === "t119 Diag" || s.name === "t119 Clean") {
    await api(`/api/jobs/${s.id}`, "DELETE");
    try { rmSync(`/home/z/my-project/data/relion/${s.projectId}/refine3d_${s.id.slice(-8)}`, { recursive: true, force: true }); } catch {}
    step(`  pre-cleaned leaked row ${s.name}`);
  }
}
const diag = await seedJob(
  "t119 Diag", "failed", 47, STDOUT_LINES, STDERR_LINES,
);
const clean = await seedJob(
  "t119 Clean", "completed", 100,
  ["RELION: control run (t119 seed)", "Killed appears in passing (idle chatter)",
   "Iteration 01: E-step ... done", "Final map written ... done"],
  ["", ""],
);
must(diag.logText.includes("----- stderr -----"), "S: stderr section merged into the log text");
const expected = deriveFindings(diag.logText);
must(expected.length === 5, `S: oracle derives 5 findings (got ${expected.length})`);
must(expected[0].id === "gpu-oom" && expected[0].firstLine === 5,
  "S: gpu-oom anchors at L5 (stdout fully under probe control)");
must(expected[1].id === "missing-input" && expected[1].firstLine === 9,
  "S: missing-input anchors at L9");
must(expected.slice(2).map((f) => f.id).join(",") === "oom-kill,disk-full,permission",
  "S: stderr trio follows in first-occurrence order");
const cleanExpected = deriveFindings(clean.logText);
must(cleanExpected.some((f) => f.id === "oom-kill"),
  "S: control log DOES contain a Killed signature (status gate is what hides the strip)");

console.log("== PHASE A: screen leg — failed job shows the strip, control doesn't ==");
await boot();
must(await openInspector("t119 Diag"), "A1 inspector opened on the failed job");
must(await openLogTab(), "A2 Log tab active (real pointer click)");
must(await waitLogLoaded("Killed"), "A3 log text loaded through the console");
const stripCount = await p.locator("[data-log-diagnosis]").count();
must(stripCount === 1, `A4 diagnosis strip present on the failed job (got ${stripCount})`);
const aria = await p.locator("[data-log-diagnosis]").getAttribute("aria-label");
must(aria === "Failure diagnosis: 5 findings", `A5 aria announces 5 findings (got "${aria}")`);
const findings = await readFindings();
must(findings.length === 5, `A6 five finding cards rendered (got ${findings.length})`);
must(findings.map((f) => f.id).join(",") === expected.map((f) => f.id).join(","),
  `A7 finding order matches the log's first occurrence (${findings.map((f) => f.id).join(",")})`);
for (let i = 0; i < expected.length; i++) {
  const e = expected[i];
  const a = findings[i];
  must(a.badge === `L${e.firstLine}${e.count > 1 ? ` · ×${e.count}` : ""}`,
    `A8.${i + 1} ${e.id}: badge "${a.badge}" carries line + count (expected L${e.firstLine})`);
  must(a.excerpt === e.excerpt, `A9.${i + 1} ${e.id}: excerpt string-equals the oracle's derivation`);
  must(a.hint.trim().length > 20, `A10.${i + 1} ${e.id}: hint present (${a.hint.length} chars)`);
}
must(findings[0].label.includes("Out-of-memory error"), "A11 gpu-oom label names the allocator");
must(findings[2].label.includes("OOM killer"), "A12 oom-kill label names the killer");
must(findings[3].label.includes("Disk full"), "A13 disk-full label names the disk");
must(findings[4].label.includes("Permission denied"), "A14 permission label names the permission");
must(findings[2].hint.includes("lower the thread count"), "A15 oom-kill hint is actionable");
must(findings[4].hint.includes("ownership"), "A16 permission hint is actionable");
must((await p.locator("[data-log-diagnosis] .diag-head-label").textContent()).trim()
  .toLowerCase() === "failure diagnosis", "A17 strip header reads Failure diagnosis");
must(await p.locator("[data-log-diagnosis] .diag-ml").isVisible(),
  "A18 ground-truth note visible on screen (xl viewport)");
const ulH = await p.evaluate(() =>
  document.querySelector("[data-log-diagnosis] ul")?.getBoundingClientRect().height ?? 0);
must(ulH > 0 && ulH <= 230,
  `A18b findings list capped on screen (ul ${Math.round(ulH)}px ≤ 230 — the log keeps its lane)`);
// status gate: ESC (real keyboard — Radix honors it), open the COMPLETED
// control whose log says "Killed" — the strip must NOT appear there
await p.keyboard.press("Escape");
await sleep(900);
must((await p.locator("[data-inspector-dialog][data-state=open]").count()) === 0,
  "A19 inspector closed via Escape");
must(await openInspector("t119 Clean"), "A20 inspector opened on the control job");
must(await openLogTab(), "A21 control's Log tab active");
must(await waitLogLoaded("Killed appears in passing"), "A22 control log text loaded (Killed visible)");
must((await p.locator("[data-log-diagnosis]").count()) === 0,
  "A23 STATUS GATE: completed job with 'Killed' in its log shows NO strip");
await p.keyboard.press("Escape");
await sleep(700);

console.log("== PHASE B: paper leg — the post-mortem prints ==");
must(await openInspector("t119 Diag"), "B1 inspector reopened on the failed job");
must(await openLogTab(), "B2 Log tab active for the report");
const pdfPath = "/tmp/t119-report.pdf";
await p.pdf({ path: pdfPath, format: "A4" });
const txt = sh(`pdftotext ${pdfPath} -`);
must(/failure diagnosis/i.test(txt), "B3 strip header on paper");
must(/5 findings/.test(txt), "B4 finding count on paper");
must(/oom killer/i.test(txt), "B6 oom-kill label on paper");
must(/out-of-memory error/i.test(txt), "B7 gpu-oom label on paper");
must(/disk full or read-only/i.test(txt), "B8 disk-full label on paper");
must(/permission denied/i.test(txt), "B9 permission label on paper");
must(/an upstream output did not land/i.test(txt), "B10 missing-input label on paper");
must(/lower the thread count/i.test(txt), "B11 oom hint on paper");
must(/reduce memory pressure/i.test(txt), "B12 gpu-oom hint on paper");
must(/check the quota/i.test(txt), "B13 disk hint on paper");
must(/upstream job finished/i.test(txt), "B14 missing-input hint on paper");
// Task 116 debt paid: real log ROWS print (not just static coverage)
must(/CUDA error: out of memory/.test(txt), "B15 real log row: CUDA line prints");
must(/corrected_micrographs\.star/.test(txt), "B16 real log row: missing-input path prints");
must(/No space left on device/.test(txt), "B17 real log row: disk line prints");
must(/Permission denied/.test(txt), "B18 real log row: permission line prints");
must(/-{3,}\s*stderr/i.test(txt), "B19 stderr section marker prints (glue-proof match)");
must(/Iteration 05: M-step/.test(txt), "B20 filler RELION rows print (window context)");
// A4 is 595.92×842.88 pts — 612×792 is Letter (the bare page.pdf default
// the earlier print suites ran at). Read the geometry from pdfinfo, not
// from compressed object streams (strings finds no MediaBox there).
const geo = sh(`pdfinfo ${pdfPath} | rg 'Page size'`);
must(/Page size:\s*595(\.\d+)? x 842(\.\d+)? pts/.test(geo),
  `B21 report page is A4 portrait (got "${geo}")`);
await p.keyboard.press("Escape");
await sleep(600);

console.log("== PHASE F: static contracts ==");
const mod = readFileSync("/home/z/my-project/src/lib/log-diagnosis.ts", "utf8");
for (const id of ["oom-kill", "gpu-oom", "disk-full", "missing-input", "permission", "segfault"]) {
  must(mod.includes(`id: "${id}"`), `F1 ${id}: pattern in the single-source table`);
}
must(/export function diagnoseLines/.test(mod), "F2 diagnoseLines exported");
must(/export function diagnoseLog/.test(mod), "F3 diagnoseLog exported");
must(!/re: \/.+\/[a-z]*g[a-z]*/.test(mod),
  "F4 no global regexes in the table (stateless .test() — no lastIndex drift)");
const ji = readFileSync("/home/z/my-project/src/components/workflow/job-inspector.tsx", "utf8");
must(ji.includes('from "@/lib/log-diagnosis"'), "F5 inspector imports the single source");
must(ji.includes("diagnoseLines(lines)"), "F6 inspector diagnoses the DISPLAY lines");
must(ji.includes('job.status === "failed" ? diagnoseLines'), "F7 status gate wired in the memo");
must(ji.includes('data-log-diagnosis=""'), "F8 strip carries the data hook");
must(ji.includes("data-finding={f.id}"), "F9 findings carry per-pattern hooks");
must((ji.match(/FINDING_ICONS/g) || []).length >= 2, "F10 icon map wired");
const cssFlat = () => readFileSync("/home/z/my-project/src/app/globals.css", "utf8").replace(/\n\s*/g, " ");
must(cssFlat().includes("[data-log-diagnosis] .diag-excerpt"),
  "F11 print re-ink covers the excerpt");
must(/\[data-log-diagnosis\]\s*\[data-finding\]\s*{[^}]*break-inside: avoid/.test(cssFlat()),
  "F12 findings print atomically");
must(ji.includes("max-h-52"), "F12a screen guardrail: findings list capped, log keeps its lane");
must(cssFlat().includes("[data-log-diagnosis] ul"), "F12b paper unrolls the guardrail cap");
const builtCss = sh(
  `rg -l 'data-log-diagnosis' /home/z/my-project/.next/static/chunks/ --glob '*.css' | head -1`
);
must(builtCss.length > 0, "F13 print rules reached the compiled css");
const builtStatic = sh(
  `rg -l 'data-log-diagnosis' /home/z/my-project/.next/static/chunks/ --glob '*.js' | head -1`
);
const builtStandalone = sh(
  `rg -l 'data-log-diagnosis' /home/z/my-project/.next/standalone/.next/static/chunks/ --glob '*.js' | head -1`
);
must(builtStatic.length > 0 && builtStandalone.length > 0,
  "F14 strip markup in BOTH compiled worlds (static + standalone)");
must(/for f in scripts\/t1\[0-9\]\[0-9\]-e2e\.mjs; do/.test(
  readFileSync("/home/z/my-project/scripts/run-matrix.sh", "utf8")
  ),
  "F15 matrix glob auto-includes t119 (t1[0-9][0-9] pattern)");

console.log("== PHASE Z: cleanup + hygiene ==");
await cleanup();
await sleep(500);
const remaining = await listJobs();
must(!remaining.some((x) => x.name === "t119 Diag" || x.name === "t119 Clean"),
  "Z1 both seeded jobs deleted");
for (const s of seeded) {
  const code = await fetch(`${BASE}/api/jobs/${s.id}/log`).then((r) => r.status).catch(() => 0);
  must(code === 404, `Z2 ${s.name}: run record cascaded (log 404, got ${code})`);
}
must(consoleErrors.length === 0 && pageErrors.length === 0,
  `Z3 console clean (${consoleErrors.length} console + ${pageErrors.length} page errors)`);

console.log(`T119 ALL PASS (${PASS} assertions)`);
process.exit(0);
