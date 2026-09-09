// t90 — params diff dialog: per-column "Open" affordance (compare→edit→rerun
// loop-closer) + qa70's playwright migration delivered in the same round.
// The dialog always ended at "this parameter differs" — but the NEXT action
// ("go tweak the idle twin, re-run") was manual homework for the entries
// whose jobs may live off-canvas (inspector, roster). Task 90 adds an Open
// row: one button per column, color dot following POSITION (teal left /
// amber right, same doctrine as the table — survives a swap), jump recipe
// identical to the dashboard roster's openJob (Task 77 deep-link repair:
// switch workspace FIRST, then canvas view, then select idle / inspect
// non-idle). Orphans have no canvas to land on → disabled with guidance.
//
// Phases:
//   S  setup — anchor = an EXISTING completed motioncorr; seed two idle
//      t90 motioncorr twins (local + "t90 Offsite" workspace); optionally
//      an orphan (server may assign a default ws — handled conditionally)
//   A  openrow — two buttons, positional color dots, left = row job
//   B  swap — button order flips, dots stay positional
//   C  jump idle — open the idle twin → dialog closes, canvas view,
//      twin card carries the selection ring
//   D  jump completed — open the anchor → inspector opens on it;
//      jump the CROSS-WS twin → canvas switches to its workspace
//   E  orphan — open-0 disabled with guidance (when the seed stays orphan)
//   F  console clean
//   Z  cleanup verified over the API
// Run: node scripts/t90-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const NAME_A = "t90 Mc A";
const NAME_B = "t90 Mc B";
const NAME_ORPHAN = "t90 Mc Orphan";
const WS_OFF = "t90 Offsite";
const SPOT = 'section[aria-label="Active project spotlight"]';

let fail = 0;
let pass = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (cond) pass++; else fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path, method, body) => {
  const res = await fetch(BASE + path, {
    method: method ?? (body ? "PATCH" : "GET"),
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const listJobs = async () => (await api("/api/jobs")).json.jobs ?? [];
const listWs = async () =>
  (await api("/api/workspaces")).json.workspaces ??
  (await api("/api/workspaces")).json ?? [];

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

/* ---------------- setup ---------------- */
console.log("Phase S — setup");
for (const j of (await listJobs()).filter((j) => j.name.startsWith("t90 "))) {
  await api(`/api/jobs/${j.id}`, "DELETE");
}
for (const w of (await listWs()).filter((w) => w.name === WS_OFF)) {
  await api(`/api/workspaces/${w.id}`, "DELETE");
}
await sleep(1200);
const jobsBefore = (await listJobs()).length;
const wsBefore = (await listWs()).length;

const anchor = (await listJobs()).find(
  (j) => j.type === "motioncorr" && j.status === "completed" && !j.name.startsWith("t90")
);
must(anchor != null, `S1 completed motioncorr anchor found (${anchor?.name ?? "none"})`);

const mkWs = await api("/api/workspaces", "POST", { name: WS_OFF });
must(mkWs.status === 200 || mkWs.status === 201, `S2 offsite workspace created (${mkWs.status})`);
const offWsId = (mkWs.json.workspace ?? mkWs.json).id;
const mainWsId = anchor.workspaceId;

const mk = async (name, extra) => {
  const r = await api("/api/jobs", "POST", {
    type: "motioncorr", name, x: anchor.x + 700, y: anchor.y + 560,
    projectId: anchor.projectId ?? undefined, ...extra,
  });
  if (r.status !== 200 && r.status !== 201) throw new Error(`POST ${name}: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.job;
};
const twinA = await mk(NAME_A, { workspaceId: mainWsId, params: { patchX: 7 } });
const twinB = await mk(NAME_B, { workspaceId: offWsId, params: { patchX: 5 } });
// the orphan probe: NO workspaceId on purpose — the server may however
// default-assign one (pre-workspace-era jobs are a legacy concept); the
// suite adapts to whichever contract the server upholds
const orphan = await mk(NAME_ORPHAN, { params: {} });
await sleep(2000); // outlive any zombie debounce window
const orphanNow = (await listJobs()).find((j) => j.id === orphan.id);
const isOrphan = orphanNow && !orphanNow.workspaceId;
must(!!twinA?.id && !!twinB?.id, `S3 twins seeded (local + offsite); orphan stays orphan: ${isOrphan}`);

/* ---------------- browser ---------------- */
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);
const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
for (let i = 0; i < 4 && (await curView()) !== "dashboard"; i++) {
  await p.keyboard.press("Shift+D");
  await sleep(700);
}
must((await curView()) === "dashboard", "A0 dashboard view reached");
await sleep(800);

// helper: open the compare dialog from a roster row (hover-revealed icon),
// picking the given sibling as the right column
const openCompare = async (rowName, siblingName) => {
  const row = p.locator(`${SPOT} [data-roster-row]`, { hasText: rowName }).first();
  await row.hover();
  await sleep(200);
  await row.locator('[data-testid="roster-compare-button"]').click();
  await p.waitForSelector('[data-testid="roster-compare-popover"]');
  await sleep(300);
  const opt = p.locator(`[data-testid="roster-compare-option"][data-sibling-name="${siblingName}"]`).first();
  await opt.click();
  await p.waitForSelector('[data-testid="params-diff-dialog"]');
  await sleep(400);
};

/* ---------------- Phase A: openrow anatomy ---------------- */
console.log("Phase A — openrow anatomy");
await openCompare(anchor.name, NAME_A);
const row0 = await p.evaluate(() => {
  const dlg = document.querySelector('[data-testid="params-diff-dialog"]');
  const btns = [0, 1].map((i) => dlg?.querySelector(`[data-testid="params-diff-open-${i}"]`));
  return btns.map((el) => ({
    label: el?.querySelector("span:last-child")?.textContent?.trim() ?? null,
    dot: el?.querySelector("span.size-1\\.5") ? getComputedStyle(el.querySelector("span.size-1\\.5")).backgroundColor : null,
    disabled: el?.hasAttribute("disabled") ?? null,
    title: el?.getAttribute("title") ?? null,
  }));
});
must(row0.length === 2 && row0[0].label === anchor.name && row0[1].label === NAME_A,
  `A1 open row carries both columns, left = row job (${JSON.stringify(row0.map((r) => r.label))})`);
must(row0[0].dot === "rgb(13, 148, 136)" && row0[1].dot === "rgb(217, 119, 6)",
  `A2 color dots follow POSITION (teal ${row0[0].dot} · amber ${row0[1].dot})`);

/* ---------------- Phase B: swap keeps dots positional ---------------- */
console.log("Phase B — swap keeps dots positional");
await p.locator('[data-testid="params-diff-swap"]').click();
await sleep(300);
const row1 = await p.evaluate(() => {
  const dlg = document.querySelector('[data-testid="params-diff-dialog"]');
  return [0, 1].map((i) => {
    const el = dlg?.querySelector(`[data-testid="params-diff-open-${i}"]`);
    return {
      label: el?.querySelector("span:last-child")?.textContent?.trim() ?? null,
      dot: el?.querySelector("span.size-1\\.5") ? getComputedStyle(el.querySelector("span.size-1\\.5")).backgroundColor : null,
    };
  });
});
must(row1[0].label === NAME_A && row1[1].label === anchor.name,
  `B1 swap flips the button order (${JSON.stringify(row1.map((r) => r.label))})`);
must(row1[0].dot === "rgb(13, 148, 136)" && row1[1].dot === "rgb(217, 119, 6)",
  "B2 dots stay positional through the swap (teal still left)");
await p.locator('[data-testid="params-diff-swap"]').click();
await sleep(250);

/* ---------------- Phase C: jump to the idle twin ---------------- */
console.log("Phase C — jump to the idle twin");
// open-1 = twin A (idle, LOCAL ws) → select on the canvas
await p.locator('[data-testid="params-diff-open-1"]').click();
await sleep(900);
must(await p.evaluate(() => !document.querySelector('[data-testid="params-diff-dialog"]')),
  "C1 dialog closes on jump");
must((await curView()) === "canvas", "C2 view switched to the canvas");
const selRing = await p.evaluate((name) => {
  const card = [...document.querySelectorAll('[data-job] [role="button"]')]
    .find((el) => (el.getAttribute("aria-label") ?? "").startsWith(name));
  if (!card) return null;
  const cls = [...card.classList];
  return { ring: cls.includes("ring-2"), primary: cls.some((c) => c.startsWith("ring-primary")) };
}, NAME_A);
must(selRing?.ring && selRing?.primary,
  `C3 idle twin carries the selection ring (${JSON.stringify(selRing)})`);

/* ---------------- Phase D: jump to the completed anchor + cross-ws twin ---------------- */
console.log("Phase D — jump completed + cross-workspace");
for (let i = 0; i < 4 && (await curView()) !== "dashboard"; i++) {
  await p.keyboard.press("Shift+D");
  await sleep(700);
}
must((await curView()) === "dashboard", "D0 back on the dashboard");
await openCompare(anchor.name, NAME_A);
// open-0 = anchor (completed) → inspect
await p.locator('[data-testid="params-diff-open-0"]').click();
await sleep(1000);
must((await curView()) === "canvas", "D1 jump to completed anchor lands on the canvas");
// the inspector renders as a [role=dialog] — its header carries the job name
const insp = await p.evaluate((name) => {
  const el = [...document.querySelectorAll('[role="dialog"]')]
    .find((d) => (d.textContent || "").includes(name));
  return !!el;
}, anchor.name);
must(insp, `D2 inspector opens on the anchor (${anchor.name})`);
// close the inspector, jump to the cross-ws twin (canvas renders ONE
// workspace — the card can only be visible if the switch happened)
await p.keyboard.press("Escape");
await sleep(500);
for (let i = 0; i < 4 && (await curView()) !== "dashboard"; i++) {
  await p.keyboard.press("Shift+D");
  await sleep(700);
}
// cross-ws leg: pick the OFFSITE twin as the right column this time
await openCompare(anchor.name, NAME_B);
// open-0 = anchor, open-1 = twinB (cross-ws, idle) → jump it
await p.locator('[data-testid="params-diff-open-1"]').click();
await sleep(1200);
const twinBCard = await p.evaluate((id) => !!document.querySelector(`[data-job="${id}"]`), twinB.id);
must((await curView()) === "canvas" && twinBCard,
  "D4 cross-workspace jump switched the canvas to the offsite twin's workspace");
const selRingB = await p.evaluate((name) => {
  const card = [...document.querySelectorAll('[data-job] [role="button"]')]
    .find((el) => (el.getAttribute("aria-label") ?? "").startsWith(name));
  if (!card) return null;
  const cls = [...card.classList];
  return cls.includes("ring-2") && cls.some((c) => c.startsWith("ring-primary"));
}, NAME_B);
must(selRingB === true, "D5 offsite twin (idle) selected after the cross-ws jump");

/* ---------------- Phase E: orphan guard (conditional) ---------------- */
console.log("Phase E — orphan guard");
if (isOrphan) {
  for (let i = 0; i < 4 && (await curView()) !== "dashboard"; i++) {
    await p.keyboard.press("Shift+D");
    await sleep(700);
  }
  await openCompare(NAME_ORPHAN, NAME_A); // orphan anchors LEFT → open-0 = orphan
  const orph = await p.evaluate(() => {
    const el = document.querySelector('[data-testid="params-diff-open-0"]');
    return { disabled: el?.hasAttribute("disabled") ?? false, title: el?.getAttribute("title") ?? "" };
  });
  must(orph.disabled && orph.title.includes("Not on any canvas"),
    `E1 orphan's Open button disabled with guidance ("${orph.title.slice(0, 40)}…")`);
  await p.keyboard.press("Escape");
  await sleep(400);
} else {
  console.log("  skip: server assigned a default workspace to the orphan seed (no live orphan)");
}

/* ---------------- Phase F: console ---------------- */
console.log("Phase F — console");
must(consoleErrors.length === 0, `F1 console clean (got ${consoleErrors.length})`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).map((e) => `    ${e.slice(0, 160)}`).join("\n"));

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
await b.close();
for (const j of (await listJobs()).filter((j) => j.name.startsWith("t90 "))) {
  await api(`/api/jobs/${j.id}`, "DELETE");
}
await sleep(1200);
for (const w of (await listWs()).filter((w) => w.name === WS_OFF)) {
  await api(`/api/workspaces/${w.id}`, "DELETE");
}
await sleep(1500);
const residual = (await listJobs()).filter((j) => j.name.startsWith("t90 "));
must(residual.length === 0, `Z1 t90 jobs deleted (got ${residual.length})`);
const jobsAfter = (await listJobs()).length;
must(jobsAfter === jobsBefore, `Z2 job count restored (${jobsAfter} == baseline ${jobsBefore})`);
const wsAfter = (await listWs()).length;
must(wsAfter === wsBefore, `Z3 workspace count restored (${wsAfter} == baseline ${wsBefore})`);

console.log(fail === 0 ? `\nT90 ALL PASS (${pass} assertions)` : `\nT90 ${fail} FAIL / ${pass} pass`);
process.exit(fail === 0 ? 0 : 1);
