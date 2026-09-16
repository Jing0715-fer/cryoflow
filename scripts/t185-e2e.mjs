/* t185 — the registry earns its management face.
 *
 * Task 184 collected the last cwd debt; the HPC profile registry's POST
 * validator stood complete — but NO UI consumed it. The registry's only
 * face was the sbatch dialog's read-only Select; edits meant hand-writing
 * hpc-profiles.json and praying the shape-guard forgives. Task 185 wires
 * the management loop: HpcProfilesEditor (list rail + grouped form +
 * add/duplicate/two-step-delete + save) mounted in the sbatch dialog's
 * toolbar, the sbatch selection re-reading the registry after every save
 * (profilesVersion bump), and the editor re-rendering from the server's
 * RESPONSE — what the server kept, never what was sent.
 *
 * Probe layers:
 *   S  baseline world (roster 21, registry = built-in trio, no
 *      hpc-profiles.json persisted — the canonical default world)
 *   X  source oracles — the editor POSTs and re-renders from the response;
 *      localRoot renders read-only (server-pinned, Task 184); ids are
 *      deduped client-side (the server does NOT dedupe); the sbatch dialog
 *      re-fetches on profilesVersion and keeps the selection only if the
 *      saved registry still has it; the editor trigger is NOT display-
 *      hidden (Task 179's touch lesson); numeric inputs carry the server's
 *      clamps
 *   B  live wire — POST rename → GET reflects; POST a custom profile with
 *      a HOSTILE localRoot → the response pins it to the server's contract
 *      root; POST numbers beyond the clamps → the server rewrites them;
 *      unknown fields dropped; POST >8 profiles → server keeps 8; POST []
 *      → 400; POST garbage → 400; restore the canonical no-file world
 *   M  mobile 390 — card → aside panel → sbatch dialog → editor trigger
 *      visible & tappable (no hover gate), editor opens, rail + form in
 *      view, no horizontal overflow
 *   D  desktop 1440 — the full management loop THROUGH THE UI: open the
 *      sbatch dialog from the aside, open the editor, rename a profile,
 *      save (server view shown), close — the sbatch Select carries the new
 *      name; reopen, add a profile, delete it through the TWO-STEP
 *      confirm, save; the registry returns to the renamed trio
 *   Z  world restore — hpc-profiles.json deleted (canonical default world
 *      returns: GET serves the built-in trio, default names), roster
 *      identity, no 5xx/404 traffic, console clean
 */
import { readFileSync, existsSync, rmSync } from "fs";
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
// t259 — the profiles route now sits behind the metadata door; node fetch
// carries no Fetch Metadata, so every call below speaks "same-origin"
// exactly as a browser would (the t251 doctrine: QA scripts send the
// headers the door checks).
const SH = { "sec-fetch-site": "same-origin" };
const REPO = process.cwd();
const DATA_DIR = process.env.CRYOFLOW_DATA_DIR ?? path.join(REPO, "data");
const PROFILE_FILE = path.join(DATA_DIR, "hpc-profiles.json");
const src = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Conservative comment stripper — line-anchored, strings win (t184 lesson). */
const stripComments = (s) =>
  s
    .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, "")
    .replace(/\/\*[^*\n]*\*\//g, "")
    .replace(/^[ \t]*\/\/[^\n]*$/gm, "")
    .replace(/[ \t]\/\/[^\n]*/g, "");

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

/* ================= S — baseline world ================= */
section("S: baseline world");
const list0 = await (await fetch(BASE + "/api/jobs")).json();
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);

const profilesRaw = (await (await fetch(BASE + "/api/hpc/profiles", { headers: SH })).json()).profiles ?? [];
must(profilesRaw.length === 3, `S2 registry is the built-in trio (${profilesRaw.length})`);
must(
  profilesRaw.some((p) => p.id === "local-workstation") &&
    profilesRaw.some((p) => p.id === "slurm-gpu-cluster"),
  "S3 the built-in ids are present"
);
// SELF-HEAL (t182 S-phase doctrine): a crashed earlier run leaves its
// renamed registry persisted — the canonical world has NO file. A residue
// file is a probe-owned artifact; heal it and re-read so the S baseline
// and every later name assertion stand on the default world.
if (existsSync(PROFILE_FILE)) {
  rmSync(PROFILE_FILE);
  console.log("  heal: residue hpc-profiles.json from a crashed run deleted");
}
const profiles0 = (await (await fetch(BASE + "/api/hpc/profiles", { headers: SH })).json()).profiles ?? [];
must(!existsSync(PROFILE_FILE), "S4 canonical default world — no hpc-profiles.json persisted");

const idleJobs = jobs0.filter((j) => j.status === "idle");
must(idleJobs.length > 0, `S5 idle jobs exist for the aside door (${idleJobs.length})`);
// leftmost idle card = safest click target in the default viewport
const doorJob = idleJobs.slice().sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0];
must(!!doorJob, `S6 door job picked (${doorJob?.name ?? "none"})`);

/* ================= X — source oracles ================= */
section("X: the management loop is written once");
const editorSrc = stripComments(src("src/components/workflow/hpc-profiles-editor.tsx"));
const sbatchSrc = stripComments(src("src/components/workflow/hpc-sbatch-dialog.tsx"));

must(editorSrc.includes("/api/hpc/profiles"), "X1 the editor speaks to the profiles route");
must(
  editorSrc.includes('method: "POST"'),
  "X2 the editor consumes the POST half (the validator gets its first UI)"
);
must(
  editorSrc.includes("setProfiles(body.profiles)"),
  "X3 after a save the UI re-renders from the server's RESPONSE, not the sent body"
);
must(
  editorSrc.includes("readOnly") && editorSrc.includes("Local data root"),
  "X4 localRoot renders read-only — the server owns that name (Task 184 contract)"
);
must(
  editorSrc.includes("custom-") && editorSrc.includes("taken.has"),
  "X5 ids are deduped client-side — the server does not dedupe"
);
must(editorSrc.includes("MAX_PROFILES = 8"), "X6 the client mirrors the server's 8-profile cap");
must(
  editorSrc.includes("Confirm delete?"),
  "X7 the destructive delete is two-step"
);
must(
  editorSrc.includes("profiles.length <= 1") || editorSrc.includes("profiles.length === 1"),
  "X8 the list refuses to drop below one profile"
);
must(
  sbatchSrc.includes("profilesVersion"),
  "X9 the sbatch dialog re-reads the registry after an editor save"
);
must(
  sbatchSrc.includes("list.some((p) => p.id === prev)") ||
    sbatchSrc.includes("list.some((p) => p.id === prev)"),
  "X10 the sbatch selection survives only if the saved registry still has it"
);
must(
  sbatchSrc.includes("<HpcProfilesEditor"),
  "X11 the editor mounts inside the sbatch dialog's toolbar"
);
must(
  !/className="[^"]*(hidden|md:hidden|sm:hidden)[^"]*"/.test(editorSrc.split("DialogTrigger")[1]?.split("</DialogTrigger>")[0] ?? ""),
  "X12 the editor trigger is never display-hidden (Task 179 touch lesson)"
);
must(
  ["timeLimitMin", "nodes", "gpusPerNode", "arrayConcurrency", "gpuSpeedup"].every((k) =>
    editorSrc.includes(`${k}: { min:`)
  ),
  "X13 the numeric inputs carry the server's clamps as their contract"
);

/* ================= B — live wire ================= */
section("B: the POST validator is the whole contract");
// B1 rename through the wire
const renamed = profiles0.map((p) =>
  p.id === "slurm-gpu-cluster" ? { ...p, name: "t185 Renamed Cluster" } : p
);
const post1 = await fetch(BASE + "/api/hpc/profiles", {
  method: "POST",
  headers: { "sec-fetch-site": "same-origin", "Content-Type": "application/json" },
  body: JSON.stringify({ profiles: renamed }),
});
must(post1.ok, "B1 rename POST accepted");
const after1 = (await (await fetch(BASE + "/api/hpc/profiles", { headers: SH })).json()).profiles ?? [];
must(
  after1.find((p) => p.id === "slurm-gpu-cluster")?.name === "t185 Renamed Cluster",
  "B2 GET reflects the rename (the file now persists)"
);
must(existsSync(PROFILE_FILE), "B3 the save persisted hpc-profiles.json");

// B4 hostile localRoot — the server pins it to the contract root
const hostile = {
  ...profiles0[1],
  id: "custom-1",
  name: "t185 Hostile Root",
  localRoot: "/etc/hostile",
};
const post2 = await fetch(BASE + "/api/hpc/profiles", {
  method: "POST",
  headers: { "sec-fetch-site": "same-origin", "Content-Type": "application/json" },
  body: JSON.stringify({ profiles: [...profiles0, hostile] }),
});
const body2 = await post2.json();
const hostileKept = (body2.profiles ?? []).find((p) => p.id === "custom-1");
must(post2.ok && !!hostileKept, "B4 the custom profile is accepted");
must(
  hostileKept && hostileKept.localRoot !== "/etc/hostile" && hostileKept.localRoot.includes("data/relion"),
  `B5 the server pins localRoot to the contract root (“${hostileKept?.localRoot ?? "none"}”)`
);

// B6 clamps — numbers beyond the range come back rewritten
const clamped = {
  ...profiles0[1],
  id: "custom-2",
  name: "t185 Clamps",
  timeLimitMin: 999999,
  nodes: -3,
  gpusPerNode: 500,
  arrayConcurrency: 100000,
  gpuSpeedup: 0,
  evilUnknownField: true,
};
const post3 = await fetch(BASE + "/api/hpc/profiles", {
  method: "POST",
  headers: { "sec-fetch-site": "same-origin", "Content-Type": "application/json" },
  body: JSON.stringify({ profiles: [...profiles0, clamped] }),
});
const body3 = await post3.json();
const kept3 = (body3.profiles ?? []).find((p) => p.id === "custom-2");
must(
  kept3 && kept3.timeLimitMin === 43200 && kept3.nodes === 1 && kept3.gpusPerNode === 64,
  `B6 the clamps rewrite the extremes (${kept3?.timeLimitMin}/${kept3?.nodes}/${kept3?.gpusPerNode})`
);
must(
  kept3 && kept3.arrayConcurrency === 512 && kept3.gpuSpeedup === 1,
  "B7 the throttle and speed clamps hold"
);
must(kept3 && !("evilUnknownField" in kept3), "B8 unknown fields are dropped");

// B9 the cap — nine profiles in, eight out
const nine = [
  ...profiles0,
  { id: "c1", name: "c1" },
  { id: "c2", name: "c2" },
  { id: "c3", name: "c3" },
  { id: "c4", name: "c4" },
  { id: "c5", name: "c5" },
  { id: "c6", name: "c6" },
];
const post4 = await fetch(BASE + "/api/hpc/profiles", {
  method: "POST",
  headers: { "sec-fetch-site": "same-origin", "Content-Type": "application/json" },
  body: JSON.stringify({ profiles: nine }),
});
const body4 = await post4.json();
must(post4.ok && (body4.profiles ?? []).length === 8, `B9 nine in, eight kept (${(body4.profiles ?? []).length})`);

// B10 the refusals
const post5 = await fetch(BASE + "/api/hpc/profiles", {
  method: "POST",
  headers: { "sec-fetch-site": "same-origin", "Content-Type": "application/json" },
  body: JSON.stringify({ profiles: [] }),
});
must(post5.status === 400, "B10 an empty registry is refused (400)");
const post6 = await fetch(BASE + "/api/hpc/profiles", {
  method: "POST",
  headers: { "sec-fetch-site": "same-origin", "Content-Type": "application/json" },
  body: JSON.stringify({ profiles: "garbage" }),
});
must(post6.status === 400, "B11 a non-array body is refused (400)");

// restore the renamed trio (D phase expects the UI's own state)
const postR = await fetch(BASE + "/api/hpc/profiles", {
  method: "POST",
  headers: { "sec-fetch-site": "same-origin", "Content-Type": "application/json" },
  body: JSON.stringify({ profiles: renamed }),
});
must(postR.ok, "B12 registry restored to the renamed trio for the UI phases");

/* ================= M — mobile 390 ================= */
section("M: the door is reachable at 390");
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
trackConsole(mpage, "mobile");
await mpage.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
// NO zoom — 3x pushes the leftmost card half off-screen (x=-96) and
// playwright refuses off-viewport clicks; at default pan the door card's
// center is inside the viewport and the locator click lands (qa66 doctrine)
const mHpc = mpage.locator('button[aria-label="Generate Slurm sbatch script for this job"]').first();
// open the aside via the door job's card
let mPanel = false;
for (let i = 0; i < 6 && !mPanel; i++) {
  const card = mpage.locator(`[data-job="${doorJob.id}"]`).first();
  try {
    await card.click({ timeout: 2500, force: i >= 3 });
  } catch { /* try again — the canvas may need a beat */ }
  await sleep(1300);
  mPanel = await mHpc.isVisible().catch(() => false);
}
must(mPanel, "M1 the aside panel opens with the HPC entry visible at 390");
if (mPanel) {
  await mHpc.click();
  await sleep(1400);
  const mTrigger = mpage.locator('button[aria-label="Manage cluster profiles"]');
  const mTrigVisible = await mTrigger.isVisible().catch(() => false);
  must(mTrigVisible, "M2 the editor trigger is visible inside the sbatch dialog (no hover gate)");
  if (mTrigVisible) {
    await mTrigger.click();
    await sleep(1400);
    const mRail = await mpage.evaluate(() => {
      const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) =>
        (d.textContent || "").includes("Cluster profiles")
      );
      if (!dlg) return { dlg: false, overflowX: false };
      const rect = document.documentElement.getBoundingClientRect();
      return {
        dlg: true,
        overflowX: document.documentElement.scrollWidth > rect.width + 2,
        rail: !!dlg.querySelector('[aria-label="Profile list"]'),
        form: !!dlg.querySelector('[aria-label="Profile display name"]'),
      };
    });
    must(mRail.dlg, "M3 the editor dialog opens on top");
    must(mRail.rail && mRail.form, "M4 rail + form both mounted at 390");
    must(!mRail.overflowX, "M5 no horizontal overflow at 390");
    await mpage.keyboard.press("Escape");
    await sleep(500);
  }
  await mpage.keyboard.press("Escape");
  await sleep(500);
}
await mctx.close();

/* ================= D — desktop management loop ================= */
section("D: the full loop through the UI");
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await dctx.newPage();
trackConsole(dpage, "desktop");
await dpage.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
const dHpc = dpage.locator('button[aria-label="Generate Slurm sbatch script for this job"]').first();
let dPanel = false;
for (let i = 0; i < 6 && !dPanel; i++) {
  const card = dpage.locator(`[data-job="${doorJob.id}"]`).first();
  try {
    await card.click({ timeout: 2500, force: i >= 3 });
  } catch { /* retry */ }
  await sleep(1300);
  dPanel = await dHpc.isVisible().catch(() => false);
}
must(dPanel, "D1 the aside opens on desktop and the HPC entry shows");
if (dPanel) {
  await dHpc.click();
  await sleep(1400);
  const dlgTitle = await dpage.getByText("Slurm submission").first().textContent().catch(() => "");
  must(!!dlgTitle && /Slurm submission/.test(dlgTitle), `D2 the sbatch dialog opens (“${(dlgTitle ?? "").trim().slice(0, 40)}”)`);

  // open the editor
  await dpage.locator('button[aria-label="Manage cluster profiles"]').click();
  await sleep(1400);
  const nameInput = dpage.locator('input[aria-label="Profile display name"]');
  must(await nameInput.count() > 0, "D3 the editor form is mounted");

  // rename the FIRST profile (local-workstation) through the form
  const before = (await (await fetch(BASE + "/api/hpc/profiles", { headers: SH })).json()).profiles ?? [];
  const firstName = before[0].name;
  await nameInput.first().fill("t185 Local Box");
  await sleep(500); // the marker is React state — give the render a beat
  const dirty = await dpage.getByText("unsaved edits").isVisible().catch(() => false);
  must(dirty, "D4 the dirty marker speaks while edits are unsent");
  await dpage.getByRole("button", { name: "Save to server" }).click();
  await sleep(1200);
  const flash = await dpage.getByText("Saved — server view shown").isVisible().catch(() => false);
  must(flash, "D5 the saved flash names the server's view");
  const afterRename = (await (await fetch(BASE + "/api/hpc/profiles", { headers: SH })).json()).profiles ?? [];
  must(
    afterRename[0]?.name === "t185 Local Box" && afterRename[0]?.name !== firstName,
    `D6 the registry reflects the UI rename (“${afterRename[0]?.name}”)`
  );

  // close the editor — Escape resolves to the INNERMOST dialog (the
  // footer "Close" button collides with Radix's own X in accessible name)
  await dpage.keyboard.press("Escape");
  await sleep(900);
  const selectText = await dpage.locator('button[aria-label="Cluster profile"]').first().textContent().catch(() => "");
  must(
    !!selectText && (selectText.includes("Local Box") || selectText.includes("Renamed")),
    `D7 the sbatch Select shows the saved registry (“${(selectText ?? "").trim().slice(0, 50)}”)`
  );

  // reopen — add a profile: Add edits LOCAL state first, Save posts it
  await dpage.locator('button[aria-label="Manage cluster profiles"]').click();
  await sleep(1300);
  await dpage.getByRole("button", { name: "Add", exact: true }).click();
  await sleep(600);
  const beforeSave = (await (await fetch(BASE + "/api/hpc/profiles", { headers: SH })).json()).profiles ?? [];
  must(beforeSave.length === 3, `D8 Add alone stays local — the server is untouched (${beforeSave.length})`);
  await dpage.getByRole("button", { name: "Save to server" }).click();
  await sleep(1200);
  const afterAdd = (await (await fetch(BASE + "/api/hpc/profiles", { headers: SH })).json()).profiles ?? [];
  must(afterAdd.length === 4, `D9 Save posts the new profile to the server (${afterAdd.length})`);
  must(
    afterAdd.some((p) => p.id === "custom-1"),
    "D10 the new profile lands with the client-deduped custom-1 id"
  );

  // select it back and delete it (two-step) — by NAME, exact text (Task 182
  // lesson: the id never appears in the rail button's face)
  await dpage.locator('[aria-label="Profile list"] button', { hasText: "New cluster profile" }).first().click();
  await sleep(500);
  const delBtn = dpage.getByRole("button", { name: "Delete profile" });
  await delBtn.click();
  await sleep(400);
  const confirmBtn = dpage.getByRole("button", { name: "Confirm delete profile" });
  must(await confirmBtn.isVisible().catch(() => false), "D11 the delete turns into a confirm step");
  await confirmBtn.click();
  await sleep(600);
  await dpage.getByRole("button", { name: "Save to server" }).click();
  await sleep(1200);
  const afterDelete = (await (await fetch(BASE + "/api/hpc/profiles", { headers: SH })).json()).profiles ?? [];
  must(
    afterDelete.length === 3 && !afterDelete.some((p) => p.id === "custom-1"),
    `D12 the two-step delete lands on the server (${afterDelete.length})`
  );

  // the localRoot field is read-only in the UI (the contract made visible)
  const lockState = await dpage.evaluate(() => {
    const inp = document.querySelector('input[aria-label="Local data root (pinned by server)"]');
    return inp ? { readOnly: inp.readOnly, val: inp.value } : null;
  });
  must(
    lockState && lockState.readOnly && lockState.val.includes("data/relion"),
    `D13 localRoot renders read-only with the contract value (“${lockState?.val ?? "none"}”)`
  );

  await dctx.close();
}

/* ================= Z — world restore ================= */
section("Z: the canonical default world returns");
// the canonical world has NO persisted registry — deleting the file the
// probe's phases created returns GET to the built-in trio (byte-equal
// semantics with S2/S3)
if (existsSync(PROFILE_FILE)) rmSync(PROFILE_FILE);
must(!existsSync(PROFILE_FILE), "Z1 hpc-profiles.json removed — the default world is restored");
const finalProfiles = (await (await fetch(BASE + "/api/hpc/profiles", { headers: SH })).json()).profiles ?? [];
must(
  finalProfiles.length === 3 &&
    finalProfiles.some((p) => p.id === "slurm-gpu-cluster" && p.name.includes("4×A100")),
  "Z2 GET serves the built-in trio again (no persisted ghost)"
);
const listZ = await (await fetch(BASE + "/api/jobs")).json();
const jobsZ = Array.isArray(listZ) ? listZ : listZ.jobs ?? [];
must(jobsZ.length === 21, `Z3 roster identity (${jobsZ.length})`);

const real5xx = failedUrls.filter((f) => f.status >= 500);
const real404 = failedUrls.filter((f) => f.status === 404);
must(real5xx.length === 0, `Z4 no 5xx (${real5xx.length})`);
must(real404.length === 0, `Z5 no 404 (${real404.length})`);
must(consoleErrors.length === 0, `Z6 console clean (${consoleErrors.length})`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
if (real5xx.length || real404.length) console.log(failedUrls.slice(0, 8));

await browser.close();
console.log(
  failures.length === 0
    ? `\nT185 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT185 FAILURES (${failures.length}):`
);
if (failures.length) failures.forEach((f) => console.log(`  - ${f}`));
process.exit(failures.length === 0 ? 0 : 1);
