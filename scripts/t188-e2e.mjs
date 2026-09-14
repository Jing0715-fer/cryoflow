/* t188 — the sweep earns its exit into reports (CSV / clipboard export).
 *
 * Task 187 closed the compare loop; Task 188 gives the race a way OUT:
 * Copy CSV puts the comparison on the clipboard, Download CSV saves it
 * as hpc-sweep-<stamp>.csv (and is the honest fallback when the
 * clipboard is denied — headless, permissions, insecure context).
 *
 * The contract, in three clauses:
 * 1. ONE builder feeds BOTH paths AND the data-csv observation
 *    attribute — the exported bytes are never a second derivation, so
 *    asserting on data-csv is asserting on what the clipboard/file got.
 * 2. The CSV is machine-readable: raw minutes (NOT the "1h 03m" display
 *    format), snake_case headers, utilization as a percent number, one
 *    row per profile in race order, failures present with status=error
 *    (a report never silently drops a contestant).
 * 3. A re-compare retires the previous export — stale numbers must not
 *    survive into a report.
 *
 * X pins the builder in source (header contract, RFC 4180 escaping,
 * single-source call site, fallback, stale guard). B drives the UI:
 * run → compare → copy → read data-csv → parse it → the CSV's numbers
 * must equal the numbers the wire served (probe re-posts both shapes
 * itself and compares — the DOM numbers and CSV numbers have a common
 * ancestor but different rounding, so the check is against the API).
 * D runs the full loop: copy → download → re-compare retires the note.
 * Z proves read-only (roster identity, registry never written).
 */
import { readFileSync, existsSync } from "fs";
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
// RFC 4180-aware parser — the H100 display name contains a comma
// ("2×8 GPU, burst queue"), so a naive split(",") would convict the
// product's CORRECT quoting. The probe must parse as strictly as the
// builder writes (the strip-oracle lesson again: naive parsers lie).
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c === "\r") { /* skip */ }
    else cell += c;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
};

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
  `S2 default world — trio registry, ${gpuProfiles.length} GPU profiles to export`
);
must(
  gpuProfiles.some((p) => /h100/i.test(p.name)) && gpuProfiles.some((p) => /a100/i.test(p.name)),
  "S3 the two known racers are present (A100 vs H100)"
);

/* ================= X — source oracles ================= */
section("X: the export is written once");
const simSrc = src("src/components/workflow/hpc-queue-sim.tsx");

must(
  simSrc.includes("makespan_min,gpu_util_pct,avg_wait_min,gpu_hours"),
  "X1 the CSV header is machine-readable (raw minutes, percent util, snake_case)"
);
must(
  simSrc.includes('s.replace(/"/g, \'\x22\x22\')') || simSrc.includes('""'),
  "X2 RFC 4180 escaping — embedded quotes are doubled"
);
must(
  simSrc.includes('navigator.clipboard.writeText(csv)') && simSrc.includes("downloadText(fname, csv);"),
  "X3 ONE csv string feeds both the clipboard and the download"
);
must(
  /data-csv=\{lastCsv \?\? undefined\}\s*\n\s*data-md=\{lastMd \?\? undefined\}/.test(simSrc),
  "X4 the export bytes ride the ALWAYS-ATTACHED comparison div (t191 carrier doctrine, both formats)"
);
must(
  simSrc.includes("catch {\n        // clipboard denied"),
  "X5 clipboard rejection falls back to the download (honest fallback)"
);
must(simSrc.includes("setExportNote(null);\n    setLastCsv(null);"), "X6 a re-compare retires the previous export");
must(
  simSrc.includes('disabled={!sweep.length}') && (simSrc.match(/disabled={!sweep.length}/g) ?? []).length === 4,
  "X7 all four export buttons refuse an empty race"
);
must(
  simSrc.includes('aria-label="Copy comparison as CSV"') && simSrc.includes('aria-label="Download comparison as CSV"'),
  "X8 both export doors have their own names"
);

/* ================= B — live wire through the UI ================= */
section("B: the export carries the wire's truth");
const bctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const bpage = await bctx.newPage();
trackConsole(bpage, "export");
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
  const compOk = await comp.isVisible().catch(() => false);
  must(compOk, "B1 the comparison block renders in the export session");

  const copyBtn = bpage.locator('button[aria-label="Copy comparison as CSV"]');
  must(await copyBtn.isEnabled().catch(() => false), "B2 Copy CSV is enabled once the race has rows");
  await copyBtn.click();
  await sleep(900);
  const status = bpage.locator('[aria-label="Export status"]');
  const note = (await status.textContent().catch(() => "")) ?? "";
  must(
    /Copied|Downloaded/.test(note),
    `B3 the export speaks (${note.trim().slice(0, 60)})`
  );
  const csv = (await bpage.locator('[aria-label="Profile comparison"]').getAttribute("data-csv").catch(() => null)) ?? "";
  must(csv.length > 0, `B4 data-csv carries the exported bytes (${csv.length} chars)`);

  // parse the CSV and compare against the WIRE (probe re-posts itself)
  const rowsCsv = parseCsv(csv);
  const header = rowsCsv[0] ?? [];
  must(
    header[0] === "profile" && header.includes("makespan_min") && header.includes("gpu_hours") && header.includes("status"),
    `B5 header matches the contract (${header.length} columns)`
  );
  must(rowsCsv.length === 3, `B6 one data row per racer + header (${rowsCsv.length} lines)`);

  const a100Wire = await post({ clusterGpus: 16, arrayConcurrency: 16, gpuSpeedup: 25 });
  const h100Wire = await post({ clusterGpus: 16, arrayConcurrency: 32, gpuSpeedup: 40 });
  const byName = {};
  for (const cells of rowsCsv.slice(1)) {
    const key = /h100/i.test(cells[0]) ? "h100" : /a100/i.test(cells[0]) ? "a100" : cells[0];
    byName[key] = {
      status: cells[7], fastest: cells[8],
      makespan: Number(cells[9]), util: Number(cells[10]), gpuHours: Number(cells[12]),
    };
  }
  const a100Csv = byName.a100;
  const h100Csv = byName.h100;
  must(!!a100Csv && !!h100Csv, "B7 both known racers appear in the CSV (keyed by model in the name)");
  must(
    a100Csv?.status === "ok" && h100Csv?.status === "ok",
    "B8 no row was dropped or errored (status=ok ×2)"
  );
  const crowned = rowsCsv.slice(1).filter((c) => c[8] === "true");
  must(
    crowned.length === 1 && /h100/i.test(crowned[0][0]),
    `B9 exactly one fastest flag and it sits on the true winner (${crowned[0]?.[0] ?? "none"})`
  );
  const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
  must(
    close(a100Csv.makespan, a100Wire.d.makespanMin, 0.051) && close(h100Csv.makespan, h100Wire.d.makespanMin, 0.051),
    `B10 CSV makespans equal the wire's (A100 ${a100Csv.makespan}≈${a100Wire.d.makespanMin}, H100 ${h100Csv.makespan}≈${h100Wire.d.makespanMin})`
  );
  must(
    close(a100Csv.util, a100Wire.d.gpuUtilization * 100, 0.101) && close(h100Csv.util, h100Wire.d.gpuUtilization * 100, 0.101),
    "B11 CSV utilization equals the wire's (percent scale)"
  );
  must(
    close(a100Csv.gpuHours, Math.round(a100Wire.d.totalGpuHours * 10) / 10, 0.001) &&
      close(h100Csv.gpuHours, Math.round(h100Wire.d.totalGpuHours * 10) / 10, 0.001),
    "B12 CSV GPU-hours equal the wire's (1-decimal rounding)"
  );
  must(
    h100Csv.makespan <= a100Csv.makespan,
    `B13 the CSV itself tells the honest race (H100 ${h100Csv.makespan} ≤ A100 ${a100Csv.makespan})`
  );

  // the explicit download path
  await bpage.locator('button[aria-label="Download comparison as CSV"]').click();
  await sleep(900);
  const dlNote = (await bpage.locator('[aria-label="Export status"]').textContent().catch(() => "")) ?? "";
  must(
    /^Downloaded hpc-sweep-\d{4}-\d{2}-\d{2}T/.test(dlNote.trim()),
    `B14 the download receipt names the file (${dlNote.trim().slice(0, 40)}…)`
  );

  // a re-compare retires the export
  await bpage.locator('button[aria-label="Compare cluster profiles"]').click();
  await sleep(3000);
  must(
    !(await bpage.locator('[aria-label="Export status"]').isVisible().catch(() => false)),
    "B15 the re-compare retired the previous export (stale numbers cannot survive)"
  );

  await bpage.keyboard.press("Escape");
  await sleep(800);
} else {
  must(false, "B1 the comparison block renders in the export session (aside never opened)");
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
    ? `\nT188 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT188 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);
