/**
 * Task 194 — the sweep earns a REPORT: the Markdown HUMAN twin of the
 * machine CSV (t188). The buildSweepReport builder derives from the
 * sweep rows (never from the CSV string — no parse-of-parse), feeds
 * clipboard + download + the data-md carrier, and the report speaks
 * people-units (1h 03m, %) while the CSV keeps raw minutes.
 *
 * Phases:
 *   S — baseline world (roster 26, trio registry, 2 GPU racers)
 *   X — source oracles (ONE builder, mdCell GFM escaping, carrier,
 *       retirement, four doors named, failure doctrine carried)
 *   B — live wire: compare → export report → the bytes speak the
 *       race's truth (winner bold, numbers equal the wire) → download
 *       receipt → re-compare retires BOTH formats → doors re-arm
 *   Z — the world was only read
 *
 * Run: node scripts/t194-e2e.mjs   (server on :3000)
 */
import { existsSync, readFileSync } from "fs";
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r/g, "");
const PROFILE_FILE = path.resolve("data/hpc-profiles.json");

let pass = 0;
const failures = [];
function must(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL: ${label}`);
  }
}
function section(name) {
  console.log(`== ${name} ==`);
}
const post = async (body) => {
  const r = await fetch(BASE + "/api/hpc/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return { status: r.status, d: await r.json() };
};
/** "1h 03m" | "63m" | "4.2m" → minutes (the report's human grammar). */
const parseFmtMin = (s) => {
  const h = /^(\d+)h\s+(\d+)m$/.exec(s.trim());
  if (h) return Number(h[1]) * 60 + Number(h[2]);
  const m = /^(\d+(?:\.\d+)?)m$/.exec(s.trim());
  return m ? Number(m[1]) : NaN;
};
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

const browser = await chromium.launch();
const consoleErrors = [];
const failedUrls = [];
function trackConsole(pageRef, label) {
  pageRef.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ label, text: msg.text() });
  });
  pageRef.on("response", (res) => {
    if (res.status() >= 400) failedUrls.push({ label, url: res.url(), status: res.status() });
  });
}

/* ================= S — baseline ================= */
section("S: baseline world");
const list0 = await (await fetch(BASE + "/api/jobs")).json();
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);
const profiles0 = (await (await fetch(BASE + "/api/hpc/profiles")).json()).profiles ?? [];
const gpuProfiles = profiles0.filter((p) => p.gpusPerNode >= 1);
must(
  !existsSync(PROFILE_FILE) && profiles0.length === 3 && gpuProfiles.length === 2,
  `S2 default world — trio registry, ${gpuProfiles.length} GPU profiles to report`
);
must(
  gpuProfiles.some((p) => /h100/i.test(p.name)) && gpuProfiles.some((p) => /a100/i.test(p.name)),
  "S3 the two known racers are present (A100 vs H100)"
);

/* ================= X — source oracles ================= */
section("X: the report is written once");
const simSrc = src("src/components/workflow/hpc-queue-sim.tsx");

must(
  simSrc.includes("const buildSweepReport = (rows: SweepRow[], bestId: string | null): string"),
  "X1 ONE Markdown builder from the sweep rows (the human twin has one father)"
);
must(
  simSrc.includes('replace(/\\|/g, "\\\\|")') && simSrc.includes("mdCell"),
  "X2 mdCell escapes GFM pipes (a pipe in a name cannot end the column early)"
);
must(
  simSrc.includes("buildSweepReport(sweep, bestRow?.p.id ?? null)") &&
    simSrc.includes("navigator.clipboard.writeText(md)") &&
    simSrc.includes("downloadText(fname, md);"),
  "X3 ONE md string feeds both the clipboard and the download (no parse-of-parse)"
);
must(
  /data-csv=\{lastCsv \?\? undefined\}\s*\n\s*data-md=\{lastMd \?\? undefined\}/.test(simSrc),
  "X4 both formats ride the ALWAYS-ATTACHED comparison div (t191 carrier doctrine)"
);
must(
  simSrc.includes("setLastMd(null);"),
  "X5 a re-compare retires the report too (stale prose cannot survive)"
);
must(
  simSrc.includes('aria-label="Copy comparison as Markdown"') &&
    simSrc.includes('aria-label="Download comparison as Markdown"'),
  "X6 both report doors have their own names"
);
must(
  (simSrc.match(/disabled={!sweep.length}/g) ?? []).length === 4,
  "X7 all four export doors refuse an empty race"
);
must(
  simSrc.includes("never silently dropped") && simSrc.includes("**${best.p.name}**"),
  "X8 the failure doctrine carries into prose and the winner gets bolded"
);

/* ================= B — live wire through the UI ================= */
section("B: the report carries the race's truth");
const bctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const bpage = await bctx.newPage();
trackConsole(bpage, "report");
await bpage.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
const doorList = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const doorJob = doorList.filter((j) => j.status === "idle").sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0];
const dHpc = bpage.locator('button[aria-label="Generate Slurm sbatch script for this job"]').first();
let bPanel = false;
for (let i = 0; i < 6 && !bPanel; i++) {
  const card = bpage.locator(`[data-job="${doorJob.id}"]`).first();
  try {
    await card.click({ timeout: 2500, force: i >= 3 });
  } catch { /* retry */ }
  await sleep(1300);
  bPanel = await dHpc.isVisible().catch(() => false);
}
if (bPanel) {
  await dHpc.click();
  await sleep(1400);
  await bpage.locator('button[aria-label="Run queue simulation"]').click();
  await sleep(1500);
  await bpage.locator('button[aria-label="Compare cluster profiles"]').click();
  await sleep(3000);
  const comp = bpage.locator('[aria-label="Profile comparison"]');
  must(await comp.isVisible().catch(() => false), "B1 the comparison block renders in the report session");

  const copyMd = bpage.locator('button[aria-label="Copy comparison as Markdown"]');
  must(await copyMd.isEnabled().catch(() => false), "B2 Copy Report is enabled once the race has rows");
  await copyMd.click();
  await sleep(900);
  const note = (await bpage.locator('[aria-label="Export status"]').textContent().catch(() => "")) ?? "";
  must(
    /Copied|Downloaded/.test(note),
    `B3 the report export speaks (${note.trim().slice(0, 60)})`
  );

  const md = (await comp.getAttribute("data-md").catch(() => null)) ?? "";
  must(md.startsWith("# HPC sweep") && md.length > 400, `B4 data-md carries report bytes (${md.length} chars)`);

  const verdict = md.split("\n").find((l) => l.includes("wins with a")) ?? "";
  must(
    /\*\*[^*]+\*\*/.test(verdict) && /\d+% faster than the slowest contestant/.test(verdict),
    `B5 the verdict names a bolded winner with a margin (${verdict.slice(0, 80)}…)`
  );

  const tableRows = md.split("\n").filter((l) => /^\| \d+ \|/.test(l));
  must(tableRows.length === 2, `B6 one table row per racer (${tableRows.length})`);
  const h100Row = tableRows.find((l) => /h100/i.test(l));
  const a100Row = tableRows.find((l) => /a100/i.test(l));
  must(!!h100Row && !!a100Row, "B7 both known racers sit in the table");

  const bolded = tableRows.filter((l) => l.includes("**"));
  must(
    bolded.length === 1 && /h100/i.test(bolded[0]),
    "B8 exactly one bolded makespan and it sits on the true winner (H100)"
  );

  // the report's numbers must equal the wire (the rows' truth)
  const a100Wire = await post({ clusterGpus: 16, arrayConcurrency: 16, gpuSpeedup: 25 });
  const h100Wire = await post({ clusterGpus: 16, arrayConcurrency: 32, gpuSpeedup: 40 });
  const cells = (l) => l.split("|").map((c) => c.trim());
  const hC = cells(h100Row ?? "");
  const aC = cells(a100Row ?? "");
  must(
    hC[6] === "ok" && aC[6] === "ok",
    "B9 no row was dropped or errored (status ok ×2)"
  );
  must(
    close(parseFmtMin(hC[7]?.replace(/\*\*/g, "") ?? ""), h100Wire.d.makespanMin, 0.51) &&
      close(parseFmtMin(aC[7] ?? ""), a100Wire.d.makespanMin, 0.51),
    `B10 report makespans equal the wire's (H100 ${hC[7]} ≈ ${h100Wire.d.makespanMin}m, A100 ${aC[7]} ≈ ${a100Wire.d.makespanMin}m)`
  );
  must(
    close(parseFloat(hC[8] ?? ""), h100Wire.d.gpuUtilization * 100, 0.51) &&
      close(parseFloat(aC[8] ?? ""), a100Wire.d.gpuUtilization * 100, 0.51),
    "B11 report utilization equals the wire's (percent scale)"
  );
  must(
    close(parseFloat(hC[10] ?? ""), Math.round(h100Wire.d.totalGpuHours * 10) / 10, 0.001) &&
      close(parseFloat(aC[10] ?? ""), Math.round(a100Wire.d.totalGpuHours * 10) / 10, 0.001),
    "B12 report GPU-hours equal the wire's (1-decimal rounding)"
  );
  must(
    md.includes("GPU-hours ≈ cost proxy"),
    "B13 the cost-proxy caveat rides along (a report that hides the cost lies)"
  );

  // the explicit download path — the receipt names the .md file
  await bpage.locator('button[aria-label="Download comparison as Markdown"]').click();
  await sleep(900);
  const dlNote = (await bpage.locator('[aria-label="Export status"]').textContent().catch(() => "")) ?? "";
  must(
    /^Downloaded hpc-sweep-report-\d{4}-\d{2}-\d{2}T.*\.md/.test(dlNote.trim()),
    `B14 the download receipt names the report file (${dlNote.trim().slice(0, 46)}…)`
  );

  // a re-compare retires BOTH formats — bytes leave the carrier, at
  // any observer speed (the carrier never unmounts)
  await bpage.locator('button[aria-label="Compare cluster profiles"]').click();
  await sleep(3200);
  const comp2 = bpage.locator('[aria-label="Profile comparison"]');
  must(
    (await comp2.getAttribute("data-md").catch(() => "gone")) === null,
    "B15 the re-compare retired the report bytes from the carrier"
  );
  must(
    (await comp2.getAttribute("data-csv").catch(() => "gone")) === null,
    "B16 the re-compare retired the CSV bytes too (one retirement, both formats)"
  );

  // the doors re-arm on the fresh race
  await bpage.locator('button[aria-label="Copy comparison as CSV"]').click();
  await sleep(900);
  const csvBack = (await comp2.getAttribute("data-csv").catch(() => null)) ?? "";
  must(csvBack.length > 0, "B17 the CSV door re-arms after retirement (bytes return, fresh race)");

  await bpage.keyboard.press("Escape");
  await sleep(800);
} else {
  must(false, "B1 the comparison block renders in the report session (aside never opened)");
}
await bctx.close();

/* ================= Z — the world was only read ================= */
section("Z: the world was only read");
const afterList = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(afterList.length === jobs0.length, `Z1 roster size unchanged (${afterList.length})`);
const afterIds = new Set(afterList.map((j) => j.id));
must(jobs0.every((j) => afterIds.has(j.id)), "Z2 roster identity — nothing stayed behind");
must(!existsSync(PROFILE_FILE), "Z3 the registry file was never written");
const badTraffic = failedUrls.filter((u) => (u.status ?? 0) >= 500 || u.status === 404);
must(badTraffic.length === 0, `Z4 no 5xx/404 browser traffic (${badTraffic.length})`);
must(consoleErrors.length === 0, `Z5 console clean (${consoleErrors.length})`);

console.log(
  failures.length === 0
    ? `\nT194 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT194 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);
