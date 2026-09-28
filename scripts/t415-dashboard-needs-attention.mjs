// t415 — the dashboard's Needs-attention strip: failed jobs become a click.
//
// The footer bar has counted failures for a long time ("1 failed"), but the
// count was a dead end: the KPI grid drill-down works in PRESENCE (which
// projects have failures), so the actual failed JOB in a non-active project
// was invisible — this world's t265 Topaz Train heritage sat red in the
// footer while the dashboard offered nothing clickable. t415 surfaces the
// red: a strip under the KPI band (only when the world speaks a failure —
// green world renders nothing), each failed job a chip with its home
// project and recency, click → the store's shared deep-link landing
// (openJob with the projectId hint — cross-project rows switch the canvas).
//
//   0  the honest fail fixture FIRST — a motioncorr dispatched to the mock
//      and STOPPED mid-run (stop → failed, the product's own semantics).
//      The suite owns its failure: the original draft asserted the t265
//      Topaz Train HERITAGE row, which the t417-era world rebuild retired
//      (the sandbox reboot of 04:14 wiped the DB — a fresh world speaks no
//      inherited failures). A suite that needs a failed world CREATES one.
//   A  the API lens — GET /api/activity/recent?status=failed returns ONLY
//      failed jobs (the fixture among them); ?status=bogus is ignored
//      (never guessed); the plain call is unchanged (no filter, no
//      regression)
//   B  the strip — renders on the dashboard with the fixture named on a
//      chip; the count badge matches the API's number; the ACTIVE
//      project's chip correctly omits the project name (the product's
//      create-a-project switches active — the chip is a same-project one)
//   C  the jump — chip click lands on the job's canvas + the inspector
//      dialog speaks the job's name (Task 126's landing law, one more door)
//   D  zero-noise honesty — deleting the fixture project drops the strip
//      ENTIRELY on a green world (nothing lingers — the strip mirrors the
//      world's failed set, and the rebuilt world's failed set is empty)
//   E  console clean + roster identity (the world's own job count, captured
//      before the fixture — the 46 was the OLD world's number)
//
// Run: node scripts/t415-dashboard-needs-attention.mjs   (server on :3000)
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";

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
  "Content-Type": "application/json",
};

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: SH,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const b = await res.json().catch(() => ({}));
  return { status: res.status, body: b };
}

async function pollUntil(fn, ms, step = 1500) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await sleep(step);
  }
}

const FIXTURE_JOB = "t415 strip motioncorr";

// ---- the world's own numbers, captured BEFORE the fixture lands ----------
const rosterBefore = ((await api("GET", "/api/jobs")).body?.jobs ?? []).length;
const failedBefore = ((await api("GET", "/api/activity/recent?limit=20&status=failed")).body?.jobs ?? []).length;

console.log("== PHASE 0: the honest fail fixture — the suite owns its failure ==");
const mk = await api("POST", "/api/projects", { name: "t415 strip fixture" });
const proj = mk.body?.project;
must(mk.status === 201 && !!proj?.id, "the fixture project exists");
const imp = await api("POST", "/api/jobs", {
  projectId: proj.id,
  type: "import",
  name: "t415 strip import",
  x: 120,
  y: 120,
  params: { empiarData: true, micrographsPath: "" },
});
const mcr = await api("POST", "/api/jobs", {
  projectId: proj.id,
  type: "motioncorr",
  name: FIXTURE_JOB,
  x: 420,
  y: 120,
});
must(imp.status === 201 && mcr.status === 201, "import + motioncorr created");
const impId = imp.body?.job?.id;
const mcrId = mcr.body?.job?.id;
const edge = await api("POST", "/api/edges", { fromJobId: impId, toJobId: mcrId });
must(edge.status === 201, "import → motioncorr wired");

const conn = await api("POST", "/api/remote/connections", {
  name: "t415 strip conn",
  host: "127.0.0.1",
  port: 3022,
  username: "cryo",
  password: "demo",
  remoteWorkdir: "/projects/cryoflow/t415-strip",
});
const connId = conn.body?.connection?.id;
must(conn.status === 201 && !!connId, "the mock connection exists");

const runImp = await api("POST", `/api/jobs/${impId}/run`, {});
must(runImp.status === 200, `the import runs (${runImp.status})`);
const impDone = await pollUntil(async () => {
  const j = await api("GET", "/api/jobs");
  const row = (j.body?.jobs ?? []).find((x) => x.id === impId);
  return row?.status === "completed" ? row : null;
}, 90_000);
must(!!impDone, "the import completes (the EMPIAR leg)");

const run = await api("POST", `/api/jobs/${mcrId}/run`, {
  remote: { connectionId: connId, module: "relion/5.0.1", mode: "slurm" },
});
must(run.status === 200, `the motioncorr dispatches (${run.status})`);
// stop mid-run — the product's own stop semantics: status failed
const running = await pollUntil(async () => {
  const j = await api("GET", "/api/jobs");
  const row = (j.body?.jobs ?? []).find((x) => x.id === mcrId);
  return row?.status === "running" ? row : null;
}, 60_000);
must(!!running, "the motioncorr reaches running on the mock");
const stop = await api("POST", `/api/jobs/${mcrId}/stop`, {});
must(stop.status === 200, "the stop lands");
const failedRow = await pollUntil(async () => {
  const j = await api("GET", "/api/jobs");
  const row = (j.body?.jobs ?? []).find((x) => x.id === mcrId);
  return row?.status === "failed" ? row : null;
}, 30_000);
must(!!failedRow, "the stopped job speaks failed");

const consoleErrors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

try {
  console.log("== PHASE A: the API lens ==");
  {
    const failed = await api("GET", "/api/activity/recent?limit=20&status=failed");
    must(failed.status === 200, "the filtered read answers 200");
    const rows = failed.body?.jobs ?? [];
    must(
      rows.length >= 1 && rows.every((j) => j.status === "failed"),
      `the status lens returns ONLY failed jobs (${rows.length} rows)`
    );
    must(
      rows.some((j) => j.name === FIXTURE_JOB),
      `the fixture failed job speaks through the lens (${FIXTURE_JOB})`
    );
    const bogus = await api("GET", "/api/activity/recent?limit=20&status=nonsense");
    const bogusRows = bogus.body?.jobs ?? [];
    const plain = await api("GET", "/api/activity/recent?limit=20");
    must(
      bogus.status === 200 && bogusRows.length === (plain.body?.jobs ?? []).length,
      "a bogus status is IGNORED, not guessed (same rows as the plain call)"
    );
    must(
      (plain.body?.jobs ?? []).some((j) => j.status !== "failed"),
      "the plain call stays unfiltered (mixed statuses)"
    );
  }

  console.log("== PHASE B: the strip renders with the fixture named ==");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Dashboard" }).click();
  await page.getByTestId("needs-attention").waitFor({ state: "visible", timeout: 15000 });
  must(true, "the strip renders (the world speaks a failure)");
  const badge = await page
    .getByTestId("needs-attention")
    .locator("span.rounded-full")
    .first()
    .textContent();
  must(/^\d+ failed$/.test((badge ?? "").trim()), `the count badge speaks (${(badge ?? "").trim()})`);
  const fixtureChip = page.getByTestId("needs-attention-chip").filter({ hasText: FIXTURE_JOB });
  must((await fixtureChip.count()) === 1, `the fixture failed job is a chip (${FIXTURE_JOB})`);
  // creating the fixture project SWITCHED the app's active project to it
  // (the product's own create semantics), so its chip is a SAME-project
  // chip — the project name is correctly omitted.
  must(
    (await fixtureChip.textContent())?.includes("t415 strip fixture") === false,
    "the ACTIVE project's chip correctly omits the project name"
  );
  await page.screenshot({ path: `${SHOTS}/t415-needs-attention-strip.png` });

  console.log("== PHASE C: the jump — chip click lands on canvas + inspector ==");
  const viewBefore = await page.getByRole("tab", { name: "Workflow" }).getAttribute("aria-selected");
  await fixtureChip.click();
  // Task 126's landing dialect: canvas view + the submitted job's inspector
  // (the dialog is Radix-modal — background tabs go aria-hidden while it
  // holds the page, so every background read waits for the Escape below)
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  // the inspector's content streams in AFTER the dialog shell mounts — wait
  // for the heading itself (the name), not just the shell
  const heading = dialog.getByRole("heading", { name: FIXTURE_JOB });
  await heading.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  const dialogSpeaks = await heading.isVisible().catch(() => false);
  must(dialogSpeaks, "the inspector dialog speaks the failed job's name");
  must((await dialog.count()) === 1, "exactly one inspector landed");
  await page.screenshot({ path: `${SHOTS}/t415-jump-landing.png` });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  const viewAfter = await page.getByRole("tab", { name: "Workflow" }).getAttribute("aria-selected");
  must(viewBefore === "false" && viewAfter === "true", "the view flipped to the canvas");

  console.log("== PHASE D: zero-noise honesty — the cleanup empties the strip ==");
  const del = await api("DELETE", `/api/projects/${proj.id}`);
  must(del.status === 200, "the fixture project deletes");
  const delConn = await api("DELETE", `/api/remote/connections/${connId}`);
  must(delConn.status === 200, "the fixture connection deletes");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Dashboard" }).click();
  await sleep(1200);
  // the world's failed set is EMPTY again (the fixture was its only
  // failure — failedBefore spoke the pre-fixture truth) — the strip must
  // DISAPPEAR entirely: a green world renders nothing, chips and all.
  const failedNow = (await api("GET", "/api/activity/recent?limit=20&status=failed")).body?.jobs ?? [];
  const chipCount = await page.getByTestId("needs-attention-chip").count();
  if (failedNow.length === 0) {
    const stripGone = await page
      .getByTestId("needs-attention")
      .waitFor({ state: "detached", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    must(stripGone, "the strip disappears on a green world (nothing lingers)");
    must(chipCount === 0, `zero chips remain (${chipCount})`);
  } else {
    must(
      chipCount === failedNow.length,
      `the strip mirrors the world's failed set (${failedNow.length} failed — nothing lingers)`
    );
  }
  await page.screenshot({ path: `${SHOTS}/t415-strip-cleanup.png` });
} finally {
  console.log("== cleanup ==");
  // fixtures die via the API above — the browser is past its last read
  await browser.close().catch(() => {});
}

console.log("== PHASE E: console + roster ==");
{
  const noise = consoleErrors.filter(
    (e) => !e.includes("ERR_CONNECTION_REFUSED") // the poller's rebirth-window noise
  );
  must(noise.length === 0, `console clean (0 real errors; got ${noise.length}${noise.length ? ": " + noise[0].slice(0, 120) : ""})`);
  const jobs = (await api("GET", "/api/jobs")).body?.jobs ?? [];
  must(jobs.length === rosterBefore, `roster restored to the world's own ${rosterBefore} (got ${jobs.length})`);
  must(
    jobs.every((j) => !(j.name ?? "").includes("t415 strip")),
    "zero fixture residue in the world"
  );
}

console.log(fail === 0 ? "\nt415: ALL PASS" : `\nt415: ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;
