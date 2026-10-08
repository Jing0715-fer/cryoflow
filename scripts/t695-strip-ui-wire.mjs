// t695 — the key-numbers strip's UI face must AGREE WITH THE WIRE (scripts lane, zero product build).
//
// Task 695's live QA sweep measured the t692 strip-aliveness census at the UI
// layer for the first time — and produced FIVE measurement artifacts before one
// honest reading: a text-selector that does not exist, a view-state shadow
// (minimap read from the wrong view), stale agent-browser refs failing SILENTLY
// ("Unknown ref: e18" after the roster rows re-rendered), the inspector's smart
// default tab (completed jobs land on RESULTS — the strip lives on OVERVIEW,
// the t363 lineage), and an unverified negative (no tenant check behind the
// first "no strip" read). Two of those artifacts nearly manufactured a fake
// census-vs-UI contradiction (ctffind "dead" in the UI while the wire said
// alive). This probe encodes the CLEAN protocol so no future window re-derives
// it: navigate with verification after every hop, verify the tenant by name,
// click the Overview tab explicitly, and only then read the face.
//
// The contract under test — TWO strip instances, one grammar (t347):
//   Results tab (JobResults, results-view.tsx):   strip iff outputs-API summary.stats non-empty
//   Overview tab (OverviewTab, job-inspector.tsx): strip iff summary non-empty OR the t347
//     receipt fallback parses a count out of job.result — the RECEIPT DIALECT IS
//     OVERVIEW-ONLY (JobResults never reads job.result)
// The probe recomputes the RIGHT side from the same wire the app reads and
// asserts the LEFT side on BOTH tabs for the whole roster. It follows the world
// (no job ids, no pinned counts): after the build-day B-class filename fixes
// land (t692's batch), the wire wakes 6 more strips and this probe verifies
// them for free.
//
// parseResultCounts is copied VERBATIM from src/lib/result-counts.ts (the
// t689 lesson: a helper copied by halves re-imports the bug). The day the lib
// dialect changes, this copy must follow — drift here is a probe bug.
//
// Run: node scripts/t695-strip-ui-wire.mjs   (server on :3000)
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  FAIL: ${label}`); }
};

async function pollUntil(fn, deadlineMs, intervalMs = 400) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

// ---- verbatim copy of src/lib/result-counts.ts (receipt dialect) -----------
function toNum(s) { return Number(s.replace(/,/g, "")); }
function parseResultCounts(result) {
  if (!result) return null;
  let t = result.replace(/^REAL:\s*/, "");
  t = t.replace(/^REMOTE\[[^\]]*\]:\s*/, "");
  if (!t) return null;
  const out = {};
  let m;
  if ((m = t.match(/([\d,]+) of [\d,]+ particles kept/))) {
    out.particles = toNum(m[1]);
  } else if ((m = t.match(/= ([\d,]+) particles/))) {
    out.particles = toNum(m[1]);
  } else if ((m = t.match(/([\d,]+) particles/))) {
    out.particles = toNum(m[1]);
  } else if ((m = t.match(/\(([\d,]+) rows\)/))) {
    out.particles = toNum(m[1]);
  }
  if ((m = t.match(/([\d,]+) micrographs?/))) {
    out.micrographs = toNum(m[1]);
  }
  if ((m = t.match(/([\d,]+) classes?/))) {
    // t539 shapes live in the lib; the probe only needs presence, and every
    // class-bearing receipt line matches the generic tail shape. Verbatim
    // scope note: the lib picks specific shapes first (populated / kept);
    // for PRESENCE the generic match cannot false-positive a classless line
    // because it still requires the literal word "classes" + a number.
    out.classes = toNum(m[1]);
  }
  return Object.values(out).some((v) => Number.isFinite(v) && v > 0) ? out : null;
}

// ---- the browser -----------------------------------------------------------
const consoleErrors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => consoleErrors.push(String(err)));

console.log("== PHASE A: the wire's own truth (API + receipt expectation) ==");
const jobsRes = await page.request.get(`${BASE}/api/jobs`, { headers: { Origin: BASE } });
must(jobsRes.ok(), "jobs API answers 200");
const jobsBody = await jobsRes.json();
const jobs = jobsBody.jobs ?? jobsBody;
const completed = jobs.filter((j) => j.status === "completed");
console.log(`  world: ${jobs.length} jobs, ${completed.length} completed`);
must(jobs.length >= 12, "roster world is the demo scale (>= 12 jobs)");

const expected = new Map(); // jobId -> {name, wantStrip, via}
for (const j of completed) {
  const oRes = await page.request.get(`${BASE}/api/jobs/${j.id}/outputs`, { headers: { Origin: BASE } });
  const o = oRes.ok() ? await oRes.json() : null;
  const stats = o?.summary?.stats ?? [];
  const receipt = parseResultCounts(j.result);
  const want = stats.length > 0 || receipt != null;
  expected.set(j.id, {
    name: j.name,
    wantStrip: want,
    wantOnResults: stats.length > 0, // the Results instance never reads the receipt
    via: stats.length > 0 ? (receipt != null ? "summary+receipt" : "summary") : receipt != null ? "receipt-only" : "neither",
  });
}
const wireAlive = [...expected.values()].filter((e) => e.wantStrip).length;
console.log(`  wire verdict: ${wireAlive}/${completed.length} strips must be alive`);
must(wireAlive >= 5, "wire alive count is census-scale (>= 5 — t692 baseline)");

console.log("== PHASE B: the UI face, per completed job (clean protocol) ==");
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);

// The five-artifact lesson 1: a navigation that is not VERIFIED is a silent
// failure. Every hop below asserts the world actually moved.
const dashClicked = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const dash = tabs.find((t) => t.textContent.trim() === "Dashboard");
  if (!dash) return false;
  dash.click();
  return true;
});
must(dashClicked, "Dashboard tab found and clicked");
await pollUntil(async () =>
  (await page.evaluate(() => document.querySelectorAll("[data-roster-row]").length)) > 0, 8000);
const rosterRows = await page.evaluate(() => document.querySelectorAll("[data-roster-row]").length);
must(rosterRows >= completed.length, `roster renders on Dashboard (got ${rosterRows} rows)`);

// The five-artifact lesson 2: the roster row's door is the INNER BUTTON
// (the div is the semantic shell — project-dashboard.tsx t80 lesson), and
// lesson 3: the tenant must be verified by NAME before any face reading.
let uiAlive = 0;
let checked = 0;
for (const [jobId, exp] of expected) {
  // Every iteration re-verifies its own runway: openJob's jump leaves the
  // view on the canvas, and the roster only renders on the Dashboard — the
  // probe's first run measured this as 16 consecutive "row not found" FAILs
  // after one successful open. A navigation that is not re-verified is a
  // silent failure (the same lesson, per-iteration shape).
  const onDash = await page.evaluate(() => document.querySelectorAll("[data-roster-row]").length > 0);
  if (!onDash) {
    const reDash = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      const dash = tabs.find((t) => t.textContent.trim() === "Dashboard");
      if (!dash) return false;
      dash.click();
      return true;
    });
    must(reDash, `${exp.name} — re-navigated to Dashboard (view was left elsewhere)`);
    const rows = await pollUntil(async () =>
      page.evaluate(() => document.querySelectorAll("[data-roster-row]").length), 8000);
    must(rows > 0, `${exp.name} — roster re-rendered (${rows} rows)`);
  }
  const clicked = await page.evaluate((id) => {
    const row = [...document.querySelectorAll("[data-roster-row]")].find(
      (r) => r.getAttribute("data-job-id") === id
    );
    if (!row) return false;
    const btn = row.querySelector("button");
    if (!btn) return false;
    btn.click();
    return true;
  }, jobId);
  if (!clicked) { fail++; console.log(`  FAIL: ${exp.name} — roster row/button not found (stale view?)`); continue; }

  // openJob jumps to the canvas and opens the inspector; the header must
  // name THIS job before anything else is read.
  const tenantReady = await pollUntil(async () =>
    page.evaluate(() => {
      const h = document.querySelector('[data-insp-face="header"]');
      return h ? h.innerText : "";
    }).then((t) => t.includes(exp.name)), 8000);
  must(tenantReady, `${exp.name} — inspector tenant verified by name`);

  // smart default: a completed job lands on the Results tab (t363 lineage);
  // its strip instance reads the SUMMARY leg only — verified just below.
  const selTab = await page.evaluate(() => {
    const face = document.querySelector('[data-insp-face="tabs"]');
    const sel = face?.querySelector('[data-state="active"], [aria-selected="true"]');
    return sel ? sel.textContent.trim() : null;
  });
  must(selTab === "Results", `${exp.name} — smart default tab is Results (got ${selTab})`);
  // The Results tab MAY carry its own strip instance (t347: one grammar, both
  // surfaces) — its presence must agree with the SUMMARY leg alone. JobResults
  // fetches its outputs on mount: the strip mounts when the fetch lands, so
  // the read polls briefly instead of racing the wire.
  const stripOnResults = await pollUntil(
    async () => {
      const present = await page.evaluate(() => !!document.querySelector("[data-key-arrival]"));
      return present === exp.wantOnResults ? present : undefined;
    },
    6000
  );
  must(stripOnResults === exp.wantOnResults,
    `${exp.name} — Results-tab strip ${exp.wantOnResults ? "present" : "absent"} as the summary leg says`);

  // lesson 5: only now — tenant verified, right tab — may the face be read.
  const ovClicked = await page.evaluate(() => {
    const face = document.querySelector('[data-insp-face="tabs"]');
    const ov = [...(face?.querySelectorAll("button") ?? [])].find((b) => /overview/i.test(b.textContent));
    if (!ov) return false;
    ov.click();
    return true;
  });
  must(ovClicked, `${exp.name} — Overview tab clicked`);
  await sleep(400);
  // the Overview strip mounts when ITS outputs fetch lands — same poll, no race
  const got = await pollUntil(
    async () => {
      const g = await page.evaluate(() => ({
        strip: !!document.querySelector("[data-key-arrival]"),
        receipt: !!document.querySelector("[data-receipt-counts]"),
      }));
      return g.strip === exp.wantStrip ? g : undefined;
    },
    6000
  ) ?? { strip: false, receipt: false };
  must(got.strip === exp.wantStrip,
    `${exp.name} — strip ${exp.wantStrip ? "ALIVE" : "silent"} as the wire says (via ${exp.via})`);
  if (exp.wantStrip && got.strip) uiAlive++;
  if (exp.via === "receipt-only") {
    // a receipt-speaking job must be SILENT on Results (that instance cannot
    // read job.result) and ALIVE on Overview — the dialect's house boundary
    must(!stripOnResults, `${exp.name} — receipt dialect stays off the Results tab`);
    must(got.receipt, `${exp.name} — the receipt badge is the Overview speaker`);
  }
  checked++;

  // close the inspector (Escape → inspect(null)); verify the door closed —
  // an open inspector would swallow the next row's click.
  await page.keyboard.press("Escape");
  await pollUntil(async () =>
    page.evaluate(() => !document.querySelector('[data-insp-face="header"]')), 5000);
}

must(checked === completed.length, `every completed job got its face read (${checked}/${completed.length})`);
must(uiAlive === wireAlive, `UI alive count agrees with the wire (${uiAlive} == ${wireAlive})`);

console.log("== PHASE C: console hygiene ==");
must(consoleErrors.length === 0, `zero console errors across the sweep (got ${consoleErrors.length})`);

await browser.close();
console.log(`\n==== t695 strip-ui-wire: ${pass} pass / ${fail} fail ====`);
process.exit(fail > 0 ? 1 : 0);
