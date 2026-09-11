// t88 — params diff third entry: inspector sibling picker + column swap.
// Task 87's compare dialog is reachable only by canvas multi-select; Task 88
// adds the entry for the case where the twin run is off-screen or in another
// workspace: the inspector's action toolbar grows a Compare button listing
// SAME-TYPE siblings (same-workspace first, cross-workspace after) with a
// per-sibling diff preview chip computed from the ONE shared diff brain
// (classifyParamRows, now exported from fsc-params-diff). Plus the swap
// button inside ParamsDiffDialog flipping column order while colors stay
// positional.
// Phases:
//   S  setup — anchor = an EXISTING completed motioncorr (inspector opens
//      only for submitted jobs); seed two idle t88 motioncorr siblings
//      (one local, one in a fresh "t88 Offsite" workspace) + one linked
//      copy that must be EXCLUDED; expected chip counts are COMPUTED from
//      the API at runtime (data-driven — no hardcoded param story)
//   A  picker — Compare button, sibling order (local before offsite),
//      link excluded, diff chips match the computed truth, cross-workspace
//      chip shows the workspace name
//   B  dialog — picking the local sibling opens ParamsDiffDialog with the
//      INSPECTED job anchored left (teal), taxonomy counts consistent
//   C  swap — swap button flips thead column order + description + keeps
//      positional colors; Esc closes dialog, inspector survives
//   E  guard — a completed job whose type has NO same-type sibling shows
//      no Compare button at all
//   D  console clean
//   Z  cleanup verified over the API (jobs + the t88 workspace gone)
// Run: node scripts/t88-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const NAME_TWIN = "t88 Mc Twin";
const NAME_OFF = "t88 Mc Offsite";
const NAME_MIRROR = "t88 Mc Mirror";

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

/** inline reimplementation of the shared diff brain (2-job summarize) —
 *  the EXPECTED chip text is derived from the API truth, not hardcoded */
const ser = (v) => JSON.stringify(v) ?? "null";
const summarize2 = (pa, pb) => {
  const keys = new Set([...Object.keys(pa ?? {}), ...Object.keys(pb ?? {})]);
  let changed = 0, partial = 0, same = 0;
  for (const k of keys) {
    const a = pa?.[k], b = pb?.[k];
    const missing = a === undefined || b === undefined;
    const distinct = new Set([a, b].filter((v) => v !== undefined).map(ser));
    if (distinct.size > 1) changed++;
    else if (missing) partial++;
    else same++;
  }
  return { changed, partial, same, total: keys.size };
};
const chipText = (pa, pb) => {
  const s = summarize2(pa, pb);
  if (s.total === 0) return "no params";
  if (s.changed === 0 && s.partial === 0) return "identical";
  const parts = [];
  if (s.changed > 0) parts.push(`${s.changed} differ`);
  if (s.partial > 0) parts.push(`${s.partial} one-sided`);
  return parts.join(" · ");
};
// the chip renders "·" as a flex-gap-separated span — textContent carries
// no spaces; normalize BOTH sides around the separator before comparing
const norm = (t) => t.replace(/\s*·\s*/g, " · ").trim();

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

/* ---------------- setup ---------------- */
console.log("Phase S — setup");
// pre-clean a crashed earlier run (jobs AND the offsite workspace)
for (const j of (await listJobs()).filter((j) => j.name.startsWith("t88 "))) {
  await api(`/api/jobs/${j.id}`, "DELETE");
}
const wsList0 = (await api("/api/workspaces")).json.workspaces ?? (await api("/api/workspaces")).json;
for (const w of wsList0.filter((w) => w.name === "t88 Offsite")) {
  await api(`/api/workspaces/${w.id}`, "DELETE");
}
await sleep(1200);
const jobsBefore = (await listJobs()).length;
const wsList1 = (await api("/api/workspaces")).json.workspaces ?? [];
const wsBefore = wsList1.length;

// anchor: an existing COMPLETED motioncorr — the inspector opens for
// submitted jobs only, and idle seeds can't be inspected. It is then MOVED
// to an empty band just BELOW the content bbox (restored in Z): the
// persisted layout's own cards occupy the bbox interior, and a neighbor's
// badge intercepts clicks on any overlapping card — below-bbox is
// collision-free and the initial fit-all still shows it
const allNow = await listJobs();
const inWs = allNow.filter((j) => j.workspaceId);
const anchor = allNow.find((j) => j.type === "motioncorr" && j.status === "completed" && !j.name.startsWith("t88"));
must(anchor != null, `S1 completed motioncorr anchor found (${anchor?.name ?? "none"})`);
must(inWs.length > 0, "S1b workspace jobs present for bbox math");
const bcx = (Math.min(...inWs.map((j) => j.x)) + Math.max(...inWs.map((j) => j.x))) / 2;
const maxy = Math.max(...inWs.map((j) => j.y));
const anchorHome = { x: anchor.x, y: anchor.y };
const anchorPos = { x: Math.round(bcx) - 350, y: Math.round(maxy) + 240 };
await api(`/api/jobs/${anchor.id}`, "PATCH", { x: anchorPos.x, y: anchorPos.y });

// offsite workspace first (the offsite sibling needs its id)
const mkWs = await api("/api/workspaces", "POST", { name: "t88 Offsite" });
must(mkWs.status === 200 || mkWs.status === 201, `S2 offsite workspace created (${mkWs.status})`);
const offWsId = (mkWs.json.workspace ?? mkWs.json).id;

const mainWsId = anchor.workspaceId;
const mk = async (name, extra) => {
  const r = await api("/api/jobs", "POST", {
    type: "motioncorr", name, x: anchorPos.x + 700, y: anchorPos.y + 560, ...extra,
  });
  if (r.status !== 200 && r.status !== 201) throw new Error(`POST ${name}: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.job;
};
const twin = await mk(NAME_TWIN, { workspaceId: mainWsId, params: { patchX: 7, dosePerFrame: 1.4 } });
const offsite = await mk(NAME_OFF, { workspaceId: offWsId, params: { patchX: 5, dosePerFrame: 1.28, bfactor: 150 } });
const mirror = await mk(NAME_MIRROR, { workspaceId: mainWsId, linkedJobId: anchor.id, params: {} });
must(!!twin?.id && !!offsite?.id && !!mirror?.id, "S3 three t88 siblings seeded (twin/offsite/mirror-link)");

// tripwire: re-read AFTER the debounce window; expected chip text derives
// from what the API actually holds (the zombie-window lesson, t87 S3)
await sleep(2000);
const anchorNow = (await listJobs()).find((j) => j.id === anchor.id);
const twinNow = (await listJobs()).find((j) => j.id === twin.id);
const offNow = (await listJobs()).find((j) => j.id === offsite.id);
const expTwin = chipText(anchorNow.params, twinNow.params);
const expOff = chipText(anchorNow.params, offNow.params);
must(expTwin.length > 0 && expOff.length > 0,
  `S4 expected chips computed from API truth (twin "${expTwin}" · offsite "${expOff}")`);

/* ---------------- browser ---------------- */
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(800);

// Task 129 round: the world grows as template suites apply batches below
// the content bbox — no FIXED zoom-out dance guarantees an old demo card
// stays on screen. Before a data-job click: pan (plain drag from a
// VERIFIED-EMPTY canvas point — a drag started on a card would move the
// job) until the target sits inside the viewport. Bounded, self-healing.
const panUntilVisible = async (id) => {
  for (let i = 0; i < 8; i++) {
    const r = await p.evaluate((jobId) => {
      const el = document.querySelector(`[data-job="${jobId}"]`);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight };
    }, id).catch(() => null);
    if (r == null) return; // not in DOM — the click fails loudly on its own
    if (r.w > 0 && r.x >= 4 && r.y >= 110 && r.x + r.w <= r.vw - 4 && r.y + r.h <= r.vh - 110) return;
    const dx = Math.round(r.vw / 2 - (r.x + r.w / 2));
    const dy = Math.round(r.vh / 2 - (r.y + r.h / 2));
    const origin = await p.evaluate((vw, vh) => {
      const empty = (x, y) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return false;
        if (el.closest('[data-job],[role="button"],[role="toolbar"],[data-canvas-ui="minimap"],[role="dialog"]')) return false;
        return !!el.closest('[data-canvas="viewport"]');
      };
      const cands = [[vw / 2, vh / 2], [vw / 2, vh - 150], [vw / 2, 190], [170, vh / 2], [vw - 170, vh / 2], [vw / 2, vh / 2 + 130], [vw / 2, vh / 2 - 130]];
      for (const [x, y] of cands) if (empty(x, y)) return { x, y };
      return null;
    }, r.vw, r.vh);
    if (!origin) return; // nowhere empty to drag from — let the click speak
    const cx = Math.round(origin.x);
    const cy = Math.round(origin.y);
    await p.mouse.move(cx, cy);
    await p.mouse.down();
    await p.mouse.move(cx + Math.max(-900, Math.min(900, dx)), cy + Math.max(-420, Math.min(420, dy)), { steps: 8 });
    await p.mouse.up();
    await sleep(350);
  }
};

// plain click on a completed card opens the big inspector
await panUntilVisible(anchor.id);
await p.locator(`[data-job="${anchor.id}"]`).first().click();
await p.waitForSelector('[data-testid="job-inspector"], [role="dialog"]');
await sleep(700);
const inspOpen = await p.evaluate(() => !!document.querySelector('[data-testid="inspector-compare-button"]'));
must(inspOpen, "A1 inspector opens with the Compare button (sibling exists)");

/* ---------------- Phase A: picker content ---------------- */
console.log("Phase A — picker content");
await p.locator('[data-testid="inspector-compare-button"]').click();
await p.waitForSelector('[data-testid="inspector-compare-popover"]');
await sleep(400);
let pk = await p.evaluate(() => {
  const pop = document.querySelector('[data-testid="inspector-compare-popover"]');
  const rows = [...(pop?.querySelectorAll('[data-testid="inspector-compare-option"]') ?? [])];
  return rows.map((r) => ({
    name: r.getAttribute("data-sibling-name"),
    wsChip: r.querySelector('[title^="Runs in workspace"]')?.textContent?.trim() ?? null,
    chip: r.querySelector('[data-testid="inspector-sibling-diff"]')?.textContent?.trim() ?? "",
    kind: r.querySelector('[data-testid="inspector-sibling-diff"]')?.getAttribute("data-diff-kind") ?? "",
  }));
});
const names = pk.map((r) => r.name);
must(names.includes(NAME_TWIN) && names.includes(NAME_OFF), `A2 both t88 siblings listed (${JSON.stringify(names)})`);
must(!names.includes(NAME_MIRROR), "A3 linked copy EXCLUDED from the sibling list");
must(!names.includes(anchor.name), "A4 the inspected job itself is not its own sibling");
must(names[names.length - 1] === NAME_OFF,
  `A5 cross-workspace sibling sorts last (order ${JSON.stringify(names)})`);
const twinRow = pk.find((r) => r.name === NAME_TWIN);
const offRow = pk.find((r) => r.name === NAME_OFF);
must(twinRow.wsChip === null, "A6 local sibling carries no workspace chip");
must(offRow.wsChip === "t88 Offsite", `A7 offsite sibling shows its workspace chip (${offRow.wsChip})`);
must(norm(twinRow.chip) === norm(expTwin) && twinRow.kind === (expTwin === "identical" ? "same" : "differs"),
  `A8 twin chip matches the computed truth ("${twinRow.chip}" vs "${expTwin}")`);
must(norm(offRow.chip) === norm(expOff) && offRow.kind === (expOff === "identical" ? "same" : "differs"),
  `A9 offsite chip matches the computed truth ("${offRow.chip}" vs "${expOff}")`);
const chipCount = await p.evaluate(() =>
  document.querySelectorAll('[data-testid="inspector-compare-popover"] [data-testid="inspector-sibling-diff"]').length);
must(chipCount === pk.length, "A10 every row carries a diff chip (no naked rows)");

/* ---------------- Phase B: dialog from picker ---------------- */
console.log("Phase B — dialog from picker");
await p.locator(`[data-testid="inspector-compare-option"][data-sibling-name="${NAME_TWIN}"]`).click();
await p.waitForSelector('[data-testid="params-diff-dialog"]');
await p.waitForSelector('[data-testid="inspector-compare-popover"]', { state: "detached" });
await sleep(400);
let dl = await p.evaluate(() => {
  const dlg = document.querySelector('[data-testid="params-diff-dialog"]');
  const section = dlg?.querySelector('[data-testid="fsc-params-diff"]');
  return {
    desc: dlg?.querySelector('[data-testid="params-diff-dialog"] p, [data-canvas-ui="params-diff-dialog"] p')?.textContent?.trim() ?? "",
    cols: [...(section?.querySelectorAll("thead th[title]") ?? [])].map((t) => t.getAttribute("title")),
    counts: section?.querySelector('[data-testid="fsc-params-counts"]')?.textContent?.trim() ?? "",
    swap: !!dlg?.querySelector('[data-testid="params-diff-swap"]'),
  };
});
must(dl.cols.length === 2 && dl.cols[0]?.startsWith(anchor.name),
  `B1 inspected job anchored LEFT (cols ${JSON.stringify(dl.cols.map((c) => c?.slice(0, 22)))})`);
must(dl.desc.includes(`left column: ${anchor.name}`), `B2 description names the left column ("${dl.desc.slice(-40)}")`);
const expCounts = (() => {
  const s = summarize2(anchorNow.params, twinNow.params);
  const parts = [];
  if (s.changed > 0) parts.push(`${s.changed} differ`);
  if (s.partial > 0) parts.push(`${s.partial} one-sided`);
  if (s.same > 0) parts.push(`${s.same} identical`);
  return parts.join(" · ");
})();
must(dl.counts.includes(expCounts), `B3 dialog counts consistent with the chip brain ("${dl.counts}" ⊇ "${expCounts}")`);
must(dl.swap, "B4 swap button present");

/* ---------------- Phase C: swap ---------------- */
console.log("Phase C — swap columns");
await p.locator('[data-testid="params-diff-swap"]').click();
await sleep(300);
dl = await p.evaluate(() => {
  const dlg = document.querySelector('[data-testid="params-diff-dialog"]');
  const section = dlg?.querySelector('[data-testid="fsc-params-diff"]');
  const swapBtn = dlg?.querySelector('[data-testid="params-diff-swap"]');
  return {
    cols: [...(section?.querySelectorAll("thead th[title]") ?? [])].map((t) => t.getAttribute("title")),
    desc: [...(dlg?.querySelectorAll("p") ?? [])].map((x) => x.textContent?.trim() ?? "").find((t) => t.includes("left column")) ?? "",
    pressed: swapBtn?.getAttribute("aria-pressed"),
  };
});
must(dl.cols[1]?.startsWith(anchor.name) && dl.cols[0]?.startsWith(NAME_TWIN),
  `C1 swap flips the column order (${JSON.stringify(dl.cols.map((c) => c?.slice(0, 22)))})`);
must(dl.desc.includes(`left column: ${NAME_TWIN}`), `C2 description follows the flip ("${dl.desc.slice(-40)}")`);
must(dl.pressed === "true", "C3 swap exposes aria-pressed=true");
await p.locator('[data-testid="params-diff-swap"]').click();
await sleep(250);
dl = await p.evaluate(() => {
  const section = document.querySelector('[data-testid="params-diff-dialog"] [data-testid="fsc-params-diff"]');
  return [...(section?.querySelectorAll("thead th[title]") ?? [])].map((t) => t.getAttribute("title"));
});
must(dl[0]?.startsWith(anchor.name), "C4 second swap restores the anchor-left order");

// fresh pair opens unswapped: close, open the OFFSITE sibling instead
await p.keyboard.press("Escape");
await sleep(400);
const surv = await p.evaluate(() => ({
  dlg: !!document.querySelector('[data-testid="params-diff-dialog"]'),
  insp: !!document.querySelector('[data-testid="inspector-compare-button"]'),
}));
must(!surv.dlg, "C5 Esc closes the diff dialog");
must(surv.insp, "C6 inspector survives the dialog close");
await p.locator('[data-testid="inspector-compare-button"]').click();
await p.waitForSelector('[data-testid="inspector-compare-popover"]');
await p.locator(`[data-testid="inspector-compare-option"][data-sibling-name="${NAME_OFF}"]`).click();
await p.waitForSelector('[data-testid="params-diff-dialog"]');
await sleep(400);
dl = await p.evaluate(() => {
  const section = document.querySelector('[data-testid="params-diff-dialog"] [data-testid="fsc-params-diff"]');
  return [...(section?.querySelectorAll("thead th[title]") ?? [])].map((t) => t.getAttribute("title"));
});
must(dl[0]?.startsWith(anchor.name) && dl[1]?.startsWith(NAME_OFF),
  "C7 a NEW pair opens unswapped (offsite on the right)");
await p.keyboard.press("Escape"); // close the diff dialog
await sleep(300);
await p.keyboard.press("Escape"); // close the INSPECTOR — its modal blocks canvas clicks
await sleep(500);
const inspGone = await p.evaluate(() => !document.querySelector('[data-testid="inspector-compare-button"]'));
must(inspGone, "E0 inspector closed before the guard probe");

/* ---------------- Phase E: no-sibling guard ---------------- */
console.log("Phase E — no-sibling guard");
const singletons = await p.evaluate(() => null); // placeholder — computed below from API
const census = {};
for (const j of await listJobs()) census[j.type] = (census[j.type] ?? 0) + 1;
const soloType = Object.entries(census).find(([t, n]) => n === 1 && t !== "motioncorr");
must(soloType != null, `E1 a singleton type exists for the guard (${soloType?.[0] ?? "none"})`);
if (soloType) {
  const solo = (await listJobs()).find((j) => j.type === soloType[0] && j.status === "completed");
  must(solo != null, `E2 singleton has a completed instance (${solo?.name ?? "none"})`);
  if (solo) {
    await panUntilVisible(solo.id);
    await p.locator(`[data-job="${solo.id}"]`).first().click();
    await sleep(900);
    const guard = await p.evaluate(() => ({
      btn: !!document.querySelector('[data-testid="inspector-compare-button"]'),
    }));
    must(!guard.btn, `E3 ${soloType[0]} with no same-type sibling → no Compare button`);
    // close this inspector before cleanup
    await p.keyboard.press("Escape");
    await sleep(300);
  }
}

/* ---------------- Phase D: console ---------------- */
console.log("Phase D — console");
must(consoleErrors.length === 0, `D1 console clean (got ${consoleErrors.length})`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).map((e) => `    ${e.slice(0, 160)}`).join("\n"));

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
// restore the anchor's original position FIRST (S-phase moved it to the
// bbox center so Reset view could see it) — world-restoring probe
await api(`/api/jobs/${anchor.id}`, "PATCH", { x: anchorHome.x, y: anchorHome.y });
for (const j of (await listJobs()).filter((j) => j.name.startsWith("t88 "))) {
  await api(`/api/jobs/${j.id}`, "DELETE");
}
await sleep(1200);
for (const w of ((await api("/api/workspaces")).json.workspaces ?? []).filter((w) => w.name === "t88 Offsite")) {
  await api(`/api/workspaces/${w.id}`, "DELETE");
}
await sleep(1500);
const residual = (await listJobs()).filter((j) => j.name.startsWith("t88 "));
must(residual.length === 0, `Z1 t88 jobs deleted (got ${residual.length})`);
const jobsAfter = (await listJobs()).length;
must(jobsAfter === jobsBefore, `Z2 job count restored (${jobsAfter} == baseline ${jobsBefore})`);
const wsAfter = ((await api("/api/workspaces")).json.workspaces ?? []).length;
must(wsAfter === wsBefore, `Z3 workspace count restored (${wsAfter} == baseline ${wsBefore})`);
await b.close();

console.log(fail === 0 ? `\nT88 ALL PASS (${pass} assertions)` : `\nT88 ${fail} FAIL / ${pass} pass`);
process.exit(fail === 0 ? 0 : 1);
