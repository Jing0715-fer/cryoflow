// t121 — Task 121: the diagnosis family closes the loop — negative teaser +
// signature table 6→8.
//
// Task 119/120 left two edges open: (1) a failed job whose log matches NO
// known signature kept the Overview card SILENT — the user couldn't tell
// whether the diagnosis ran at all; (2) two of the most common cluster
// deaths (MPI abort, Python wrapper traceback) were not in the table, and
// the gpu-oom comment CLAIMED std::bad_alloc coverage it didn't have.
//
// Three states now: null = not scanned / no log (honest silence);
// [] = scanned, nothing matched (the calm zinc negative teaser says so);
// non-empty = the classic rose teaser. The negative CTA lands the console
// in Full mode where the strip is absent BY DESIGN (findings.length > 0
// gate) — the log itself is the answer.
//
// Phase S — three seeds: "NewSig" failed job whose short log carries ONLY
//           the new signatures (std::bad_alloc L3 → gpu-oom, Python
//           traceback L4, MPI_ABORT L8 — first-occurrence order oracle);
//           "Custom" failed job whose log matches nothing (negative oracle);
//           "NoLog" failed job with NO log files (null-state oracle).
// Phase A — screen: NewSig teaser counts 3 with the new chips in order and
//           NO negative attribute; Custom shows the negative teaser (aria,
//           0-findings pill, note, zero chips) whose CTA lands Full mode
//           with the strip ABSENT; NoLog stays silent (status + null gate).
// Phase B — paper: NewSig labels print, CTAs don't; Custom prints the
//           negative note ("information, not alarm" on paper too); NoLog
//           paper is diagnosis-free. A4 portrait throughout.
// Phase F — static: table has 8 entries / no /g flags / new regexes; the
//           three-state wiring; icon map additions; negative print rules;
//           compiled chunks in BOTH worlds.
// Phase Z — cleanup (rows deleted → logs 404), console clean.
//
// Run: node scripts/t121-e2e.mjs   (server on :3000, fresh build REQUIRED —
// F-phase reads compiled chunks)
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

// ---------- seed (t119/t120 conventions) ----------
const ENGINE_STATE = "/home/z/my-project/data/engine-state.json";
const flipStatus = (id, status, progress) =>
  sh(`node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.job.update({where:{id:'${id}'},data:{status:'${status}',progress:${progress}}}).then(()=>p.\\$disconnect())"`);

// the probe's own oracle: the EIGHT signatures, re-derived from the API text
// (independent of the app's module — the two must agree; t121 added the
// mpi-abort / python-traceback rows and the std::bad_alloc alternative)
const PATTERNS = [
  ["oom-kill", /\bKilled\b|oom-kill(?:er)?\b/i],
  ["gpu-oom", /cuda[\w: ]*(?:error|out of memory)|out of memory|hipError|std::bad_alloc/i],
  ["disk-full", /no space left on device|disk quota exceeded|read-only file system/i],
  ["missing-input", /no such file or directory/i],
  ["permission", /permission denied/i],
  ["segfault", /segmentation fault|\bcore dumped\b/i],
  ["mpi-abort", /MPI_ABORT was invoked/i],
  ["python-traceback", /Traceback \(most recent call last\)/],
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

// NewSig stdout: ONLY new-signature lines + neutral filler — a short log, so
// tail window == full log and the strip sees the same evidence the teaser
// does. Order asserts first-occurrence ordering across the three new ids.
const NEWSIG_STDOUT = [
  "RELION: 3D auto-refine (t121 new-signature seed)",
  "Reading 20480 particles ... done",
  "terminate called after throwing an instance of 'std::bad_alloc'",
  "Traceback (most recent call last):",
  "  File 'topaz_wrapper.py', line 42, in <module>",
  "ModuleNotFoundError: No module named 'topaz'",
  "-------------------------------------------------------",
  "MPI_ABORT was invoked on rank 1 in communicator MPI_COMM_WORLD",
];
const NEWSIG_STDERR = [""];
// Custom stdout: a RELION-native custom failure that matches NOTHING in the
// table — the negative teaser's whole existence. Checked against all 8.
const CUSTOM_STDOUT = [
  "RELION: 3D auto-refine (t121 custom-failure seed)",
  "Reading 20480 particles ... done",
  "ERROR: unknown particle size — check the mask diameter parameter",
  "Iteration 01: E-step ... aborted",
  "Cleaning up temporary files ... done",
];
const CUSTOM_STDERR = [""];

const makeJobRow = async (name, x, y) => {
  const ws = (await (await api("/api/workspaces")).json()).workspaces ?? [];
  must(ws.length > 0, `${name}: a workspace exists to host the seed`);
  const created = await (
    await api("/api/jobs", "POST", {
      type: "refine3d", name, workspaceId: ws[0].id, x, y,
    })
  ).json();
  const j = created?.job ?? created;
  must(j?.id && j?.name, `${name}: created via POST /api/jobs`);
  return j;
};

const seedJob = async (name, x, y, stdoutLines, stderrLines, tailNeedle) => {
  const j = await makeJobRow(name, x, y);
  const proj = j.projectId;
  const wd = `/home/z/my-project/data/relion/${proj}/refine3d_${j.id.slice(-8)}`;
  mkdirSync(wd, { recursive: true });
  writeFileSync(`${wd}/run.out`, stdoutLines.join("\n") + "\n");
  writeFileSync(`${wd}/run.err`, stderrLines.join("\n") + "\n");
  const state = existsSync(ENGINE_STATE) ? JSON.parse(readFileSync(ENGINE_STATE, "utf8")) : {};
  state[j.id] = {
    jobId: j.id, projectId: proj, type: "refine3d", pid: null,
    cmd: "t121 seed (diagnosis family closure)", workdir: wd,
    logFile: `${wd}/run.out`, errFile: `${wd}/run.err`,
    startedAt: new Date().toISOString(), outputs: {},
    done: true, exitCode: 1,
  };
  writeFileSync(ENGINE_STATE, JSON.stringify(state, null, 2));
  flipStatus(j.id, "failed", 31);
  seeded.push({ id: j.id, name: j.name, workdir: wd });
  const tailApi = await (await api(`/api/jobs/${j.id}/log`)).json();
  const fullApi = await (await api(`/api/jobs/${j.id}/log?full=1`)).json();
  must(typeof fullApi.tail === "string" && fullApi.tail.includes(stdoutLines[0]),
    `${name}: full-log API returns the crafted run.out`);
  must(typeof tailApi.tail === "string" && tailApi.tail.includes(tailNeedle),
    `${name}: tail API returns its window (needle "${tailNeedle}")`);
  const st = (await listJobs()).find((x) => x.id === j.id)?.status;
  must(st === "failed", `${name}: status flipped to failed (verified via list API)`);
  return { id: j.id, name: j.name, workdir: wd, tailText: tailApi.tail, fullText: fullApi.tail };
};

// NoLog: a failed job that never produced a log — the null state's reason
// to exist. No workdir, no engine-state entry, so the log route must 404.
const seedNoLog = async (name, x, y) => {
  const j = await makeJobRow(name, x, y);
  flipStatus(j.id, "failed", 0);
  seeded.push({ id: j.id, name: j.name, workdir: null });
  const code = await fetch(`${BASE}/api/jobs/${j.id}/log?full=1`).then((r) => r.status).catch(() => 0);
  must(code === 404, `${name}: log route honestly 404s (got ${code})`);
  return { id: j.id, name: j.name };
};

// ---------- browser helpers (t118/t119/t120 conventions) ----------
// The fit zoom (28 jobs on this canvas) renders cards at ~55x24 px, where a
// fixed floating chip (the minimap toggle) can cover a card's center and eat
// the click; far seeds can also sit OUTSIDE the viewport. openInspector
// therefore steers first: zoom OUT (wheel is zoom-to-cursor) pulls distant
// content toward the cursor, zoom IN at the card enlarges it beyond any
// fixed-size occluder, and five click points per pass outflank partial
// coverage. Every pass re-measures the real bbox — no assumed geometry.
const CLICK_FRACS = [[0.5, 0.5], [0.1, 0.18], [0.9, 0.18], [0.1, 0.82], [0.9, 0.82]];
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
  const loc = p.locator(`[data-job]`, { hasText: name }).first();
  for (let i = 0; i < 12; i++) {
    // reach first (find Enter = focusJob centers at legibility zoom —
    // robust to any fit/viewport state), then verify the RIGHT inspector:
    // a jittered click must not bless a neighbor's dialog (t113 lesson)
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
    const box = await loc.boundingBox().catch(() => null);
    if (box && box.width > 0) {
      const [fx, fy] = CLICK_FRACS[i % CLICK_FRACS.length];
      await p.mouse.click(Math.round(box.x + box.width * fx), Math.round(box.y + box.height * fy));
    } else {
      await loc.click().catch(() => {});
    }
    await sleep(1200);
    const ok = await p.evaluate((nm) => {
      const dl = document.querySelector("[data-inspector-dialog]");
      return !!dl && dl.getAttribute("data-state") === "open" && (dl.textContent || "").includes(nm);
    }, name).catch(() => false);
    if (ok) return true;
    await sleep(700);
  }
  return false;
};
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
const stripCount = async () => {
  const n = await p.locator("[data-log-diagnosis]").count().catch(() => 0);
  if (n === 0) return 0;
  const aria = (await p.locator("[data-log-diagnosis]").getAttribute("aria-label").catch(() => "")) ?? "";
  const m = aria.match(/(\d+) finding/);
  return m ? Number(m[1]) : -1;
};
const consoleIsFull = async () => {
  const t = await p.locator("[data-log-console]").first().textContent().catch(() => "");
  return /\(\s*full\s*\)|lines \(full\)/.test(t ?? "");
};
const negAttr = async () =>
  (await p.locator("[data-overview-diagnosis]").getAttribute("data-ovd-negative").catch(() => null));

// ---------- phases ----------
console.log("== PHASE S: three seeds — new signatures / custom failure / no log ==");
for (const s of await listJobs()) {
  if (s.name.startsWith("t121 ")) {
    await api(`/api/jobs/${s.id}`, "DELETE");
    try { rmSync(`/home/z/my-project/data/relion/${s.projectId}/refine3d_${s.id.slice(-8)}`, { recursive: true, force: true }); } catch {}
    step(`  pre-cleaned leaked row ${s.name}`);
  }
}
const all = await listJobs();
// one horizontal row, same y: stacked seeds drift off-viewport (each +260)
// and the fit zoom + min-zoom clamp leaves them unreachable. The FIRST line
// below the existing content (M+260) is the empirically visible one — the
// M+780 line landed at screen y≈974, outside the 900px viewport.
const rowY = all.reduce((m, j) => Math.max(m, (j.y ?? 0) + 260), 800);
const newSig = await seedJob("t121 NewSig", 140, rowY, NEWSIG_STDOUT, NEWSIG_STDERR, "MPI_ABORT was invoked");
const custom = await seedJob("t121 Custom", 520, rowY, CUSTOM_STDOUT, CUSTOM_STDERR, "mask diameter");
const noLog = await seedNoLog("t121 NoLog", 900, rowY);

const oracleFull = deriveFindings(newSig.fullText);
must(oracleFull.length === 3, `S: new-signature oracle derives 3 findings (got ${oracleFull.length})`);
must(oracleFull.map((f) => f.id).join(",") === "gpu-oom,python-traceback,mpi-abort",
  `S: first-occurrence order bad_alloc → traceback → MPI_ABORT (got ${oracleFull.map((f) => f.id).join(",")})`);
must(oracleFull[0].firstLine === 3 && oracleFull[1].firstLine === 4 && oracleFull[2].firstLine === 8,
  `S: anchors at L3/L4/L8 (got ${oracleFull.map((f) => f.firstLine).join("/")})`);
must(oracleFull.every((f) => ["gpu-oom", "python-traceback", "mpi-abort"].includes(f.id)),
  "S: the three findings are exactly the NEW signatures (no legacy pattern fired)");
must(deriveFindings(custom.fullText).length === 0,
  "S: custom-failure oracle derives ZERO findings (the negative state's oracle)");
must(newSig.fullText.split("\n").length < 600, "S: NewSig log is SHORT — tail window == full log");

console.log("== PHASE A: screen leg — new chips, negative teaser, honest silence ==");
await boot();
must(await openInspector("t121 NewSig"), "A1 inspector opened on the new-signature job");
must(await waitLogLoaded("MPI_ABORT"), "A2 smart default lands on Log and the log loads");
must(await stripCount() === 3,
  `A3 tail strip shows 3 (short log, windows coincide; got ${await stripCount()})`);
must(await openOverviewTab(), "A4 Overview tab active (real pointer click)");
must(await waitTeaser(), "A5 diagnosis teaser rendered on the failed summary");
const sigAria = await p.locator("[data-overview-diagnosis]").getAttribute("aria-label");
must(sigAria === "Failure diagnosis: 3 findings in the full log",
  `A6 teaser aria announces 3 full-log findings (got "${sigAria}")`);
const sigChips = await readChips();
must(sigChips.map((c) => c.id).join(",") === "gpu-oom,python-traceback,mpi-abort",
  `A7 chip order matches first occurrence (got ${sigChips.map((c) => c.id).join(",")})`);
must((await p.locator("[data-ovd-chip=mpi-abort]").getAttribute("title") ?? "").includes("read upward"),
  "A8 mpi-abort chip hover points UP the log (the symptom/cause doctrine)");
must((await p.locator("[data-ovd-chip=python-traceback]").getAttribute("title") ?? "").includes("environment"),
  "A9 python-traceback chip hover names the wrapper's environment");
must((sigChips.find((c) => c.id === "gpu-oom")?.label ?? "").includes("Out-of-memory"),
  "A10 bad_alloc lands in the gpu-oom family chip (the comment is finally true)");
must((await negAttr()) === null, "A11 positive teaser does NOT carry the negative attribute");
must((await p.locator("[data-overview-diagnosis] button").textContent() ?? "").includes("Open the full diagnosis"),
  "A12 positive teaser keeps its classic CTA");
await p.keyboard.press("Escape");
await sleep(900);

// the negative state — the round's headline
must(await openInspector("t121 Custom"), "A13 inspector opened on the custom-failure job");
must(await waitLogLoaded("mask diameter"), "A14 its log loads in the console");
must(await openOverviewTab(), "A15 Overview active");
must(await waitTeaser(), "A16 the NEGATIVE teaser rendered (not silence)");
must((await negAttr()) === "", "A17 negative teaser carries data-ovd-negative");
const negAria = await p.locator("[data-overview-diagnosis]").getAttribute("aria-label");
must(negAria === "No known failure signature matched the full log",
  `A18 negative aria says what happened (got "${negAria}")`);
const negPill = (await p.locator("[data-overview-diagnosis] .ovd-count").textContent())?.trim();
must(negPill === "0 findings", `A19 count pill reads "0 findings" (got "${negPill}")`);
must((await p.locator("[data-overview-diagnosis]").count()) === 1 &&
  (await readChips()).length === 0, "A20 negative teaser carries ZERO chips");
const negNote = await p.locator(".ovd-negative-note").textContent();
must((negNote ?? "").includes("custom to this job"), "A21 the negative note names the custom cause");
must((await p.locator(".ovd-negative-note").isVisible()), "A22 negative note visible");
must((await p.locator("[data-overview-diagnosis] button").textContent() ?? "").includes("Read the full log"),
  "A23 negative CTA says Read the full log");
// the jump lands Full mode where the strip is absent BY DESIGN
await p.locator("[data-overview-diagnosis] button").first().click();
await sleep(1200);
must(await p.locator('[role="tab"]').filter({ hasText: /^Log$/ }).first().getAttribute("data-state")
  .catch(() => "") === "active", "A24 negative CTA landed on the Log tab");
must(await waitLogLoaded("mask diameter"), "A25 full log loaded after the jump");
must(await consoleIsFull(), "A26 console is in FULL mode (the scanned window)");
must((await p.locator("[data-log-diagnosis]").count()) === 0,
  "A27 strip ABSENT at zero findings by design — the log itself is the answer");
await p.keyboard.press("Escape");
await sleep(900);

// the null state — honest silence for a job that never produced a log
must(await openInspector("t121 NoLog"), "A28 inspector opened on the no-log job");
must(await openOverviewTab(), "A29 its Overview active");
await sleep(1500);
must((await p.locator("[data-overview-diagnosis]").count()) === 0,
  "A30 NULL STATE: no log → no teaser of either kind (honest silence, not a fake negative)");
must((await p.locator("text=Job failed").count()) > 0, "A31 the failed summary card itself still stands");
await p.keyboard.press("Escape");
await sleep(700);

console.log("== PHASE B: paper leg — negative prints calm, positive prints evidence ==");
must(await openInspector("t121 NewSig"), "B1 inspector reopened on the new-signature job");
must(await openOverviewTab(), "B2 Overview active for the report");
await sleep(1200);
const pdfA = "/tmp/t121-newsig.pdf";
await p.pdf({ path: pdfA, format: "A4" });
const txtA = sh(`pdftotext ${pdfA} -`);
must(/failure diagnosis/i.test(txtA), "B3 teaser header on paper");
must(/3 findings/.test(txtA), "B4 full-log count on paper");
must(/MPI abort/i.test(txtA), "B5 mpi-abort label on paper");
must(/Python traceback/i.test(txtA), "B6 python-traceback label on paper");
must(/out-of-memory/i.test(txtA), "B7 gpu-oom label (bad_alloc family) on paper");
must(!/read the full log/i.test(txtA), "B8 negative CTA text absent from the POSITIVE paper");
must(!/open the full diagnosis/i.test(txtA), "B9 jump button is screen chrome");
await p.keyboard.press("Escape");
await sleep(700);
must(await openInspector("t121 Custom"), "B10 inspector reopened on the custom job");
must(await openOverviewTab(), "B11 Overview active");
await sleep(1200);
const pdfB = "/tmp/t121-custom.pdf";
await p.pdf({ path: pdfB, format: "A4" });
const txtB = sh(`pdftotext ${pdfB} -`);
must(/failure diagnosis/i.test(txtB), "B12 negative teaser header on paper");
must(/0 findings/.test(txtB), "B13 zero-findings pill on paper");
must(/no known failure signature matched/i.test(txtB), "B14 the negative note prints — information, not alarm");
must(!/read the full log/i.test(txtB), "B15 negative CTA is screen chrome");
must(!/MPI abort|Python traceback/i.test(txtB), "B16 no false signature labels on the negative paper");
await p.keyboard.press("Escape");
await sleep(700);
must(await openInspector("t121 NoLog"), "B17 no-log job reopened");
must(await openOverviewTab(), "B18 its Overview active");
await sleep(1200);
const pdfC = "/tmp/t121-nolog.pdf";
await p.pdf({ path: pdfC, format: "A4" });
const txtC = sh(`pdftotext ${pdfC} -`);
must(!/failure diagnosis/i.test(txtC), "B19 no-log paper carries NO diagnosis block");
await p.keyboard.press("Escape");
await sleep(600);

console.log("== PHASE F: static contracts ==");
const ji = readFileSync("/home/z/my-project/src/components/workflow/job-inspector.tsx", "utf8");
must(ji.includes('data-ovd-negative=""'), "F1 negative teaser carries its variant hook");
must(ji.includes("No known failure signature matched the full log"), "F2 negative aria text lives in the component");
must(ji.includes("Read the full log"), "F3 negative CTA label");
must(ji.includes("diagnosis.length === 0 ? ("), "F4 the zero branch is its own conditional");
must(ji.includes("useState<LogFinding[] | null>(null)"), "F5 three-state store: null | [] | findings");
must(ji.includes('"mpi-abort": XOctagon'), "F6 mpi-abort icon mapped");
must(ji.includes('"python-traceback": Bug'), "F7 python-traceback icon mapped");
must(ji.includes("diagnosis?: LogFinding[] | null;"), "F8 prop chain accepts all three states");
const mod = readFileSync("/home/z/my-project/src/lib/log-diagnosis.ts", "utf8");
must(/id: "mpi-abort"/.test(mod), "F9 mpi-abort pattern in the single-source table");
must(/id: "python-traceback"/.test(mod), "F10 python-traceback pattern in the table");
must(mod.includes("MPI_ABORT was invoked") && mod.includes("Traceback \\(most recent call last\\)"),
  "F11 both regexes are the runtimes' exact native text");
must(mod.includes("std::bad_alloc"), "F12 gpu-oom regex now catches std::bad_alloc (comment made true)");
must(!/re: [^\n]*\/[a-z]*g[a-z]*[,;]\s*$/.test(mod) && !/re: [^\n]*\/[a-z]*g[a-z]*[,;]/.test(mod),
  "F13 every pattern regex stays non-global (flags checked AFTER the closing slash — 'segmentation' must not trip it)");
must((mod.match(/id: "/g) ?? []).length === 8, "F14 the table has exactly 8 signatures");
const cssFlat = () => readFileSync("/home/z/my-project/src/app/globals.css", "utf8").replace(/\n\s*/g, " ");
must(cssFlat().includes("[data-overview-diagnosis][data-ovd-negative] .ovd-head-label"),
  "F15 negative print re-ink overrides the shared rose header");
must(cssFlat().includes("[data-ovd-negative] .ovd-negative-note"), "F16 negative note prints dark");
const builtCss = sh(
  `rg -l 'data-ovd-negative' /home/z/my-project/.next/static/chunks/ --glob '*.css' | head -1`
);
must(builtCss.length > 0, "F17 negative rules reached the compiled css");
const builtStatic = sh(
  `rg -l 'data-ovd-negative' /home/z/my-project/.next/static/chunks/ --glob '*.js' | head -1`
);
const builtStandalone = sh(
  `rg -l 'data-ovd-negative' /home/z/my-project/.next/standalone/.next/static/chunks/ --glob '*.js' | head -1`
);
must(builtStatic.length > 0 && builtStandalone.length > 0,
  "F18 negative teaser in BOTH compiled worlds (static + standalone)");
const builtSig = sh(
  `rg -l 'MPI_ABORT was invoked' /home/z/my-project/.next/standalone/.next/server/ 2>/dev/null | head -1`
);
must(builtSig.length > 0, "F19 the new signature text reached the server bundle too");

console.log("== PHASE Z: cleanup + hygiene ==");
await cleanup();
await sleep(500);
const remaining = await listJobs();
must(!remaining.some((x) => x.name.startsWith("t121 ")), "Z1 all three seeded jobs deleted");
for (const s of seeded) {
  const code = await fetch(`${BASE}/api/jobs/${s.id}/log`).then((r) => r.status).catch(() => 0);
  must(code === 404, `Z2 ${s.name}: run record cascaded (log 404, got ${code})`);
}
must(consoleErrors.every((e) => /Failed to load resource.*404|status of 404/i.test(e)),
  `Z3a every console error is Chromium's automatic 404 resource log — the null\n       state's honest fetches (log route 404s ×4: Log tab + ?full=1 across two\n       inspector opens); got ${JSON.stringify(consoleErrors)}`);
must(pageErrors.length === 0,
  `Z3b zero page errors (${pageErrors.length})`);
const non404 = consoleErrors.filter((e) => !/404/i.test(e));
must(non404.length === 0, `Z3c no application console errors beyond the honest 404s (${non404.length})`);

console.log(`T121 ALL PASS (${PASS} assertions)`);
process.exit(0);
