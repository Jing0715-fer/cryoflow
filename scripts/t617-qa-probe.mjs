/**
 * t617 — QA PROBE: the inspector modal's faces, mapped live BEFORE the
 * product moves. The lane: JobInspector (the big modal) is the family's
 * next unscanned surface (t616 handoff ②) — this probe answers, from the
 * running world:
 *   P1  the world (12c/13e) + a job census read from the card aria-labels
 *   P2  a real card click (pointerdown/up — the card listens on pointer
 *       events, not click) mounts the modal ([data-inspector-dialog])
 *   P3  the five face candidates EXIST and are SILENT (animationName none
 *       — the gap is live): status accent, dialog header, tabs bar, the
 *       active tab panel, the workdir footer
 *   P4  the smart default tab (completed → results per t363)
 *   P5  the footer's workdir word arrives DATA-GATED (the outputs fetch
 *       lands after the wave's start — poll, don't assume)
 *   P6  THE RADIX TRUTH: the four tabpanels NEVER unmount — inactive
 *       panels stay mounted (hidden, children stripped) — and the panel
 *       queries must be scoped to [data-inspector-dialog] because the
 *       app shell's own sidebar rail (catalog/workspaces) speaks the
 *       same ui/tabs dialect and pollutes any document-wide [role=tabpanel]
 *       query (the t617-diag crime scene)
 *   P7  a real Escape (agent-browser press) closes the modal
 *   P8  re-open = fresh dialog nodes again (every open is a new arrival)
 *   P9  the error net (page errors + the dev portal's honest dialog pair)
 *
 * CDP port 9336 (9335 = t616), fresh profile (t581 lesson).
 * Usage: node scripts/t617-qa-probe.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const CDP_PORT = "9336";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t617-probe-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";

let chromeProc = null;
async function launchDesktopChrome() {
  chromeProc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--hide-scrollbars", "--window-size=1280,720",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
    "about:blank",
  ], { stdio: "ignore", detached: false });
  const ready = await pollUntil(() => {
    try { return sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200"; }
    catch { return false; }
  }, 15000, 300);
  return ready;
}
const applyShim = () => {
  try { return sh(`node ${SHIM} ${CDP_PORT} 2>/dev/null`).includes('"ok":true'); }
  catch { return false; }
};
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const readJson = async (js, tries = 3) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < tries; i++) {
    try {
      const t = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
      let v = t;
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
      if (typeof v === "string") {
        if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
        else if (v === "true") v = true;
        else if (v === "false") v = false;
      }
      return v;
    } catch { await sleep(600); }
  }
  return null;
};
async function pollUntil(fn, timeoutMs = 120000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}
/* ref extraction reads ref= wherever it sits (the state+ref shared-bracket
 * tuition, t616) */
const clickRef = (needle, rolePrefix = "- button ") => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const snap = sh("agent-browser snapshot -i 2>/dev/null");
      const line = snap.split("\n").find((l) => l.trimStart().startsWith(rolePrefix) && l.includes(needle));
      const m = line && line.match(/ref=(e\d+)/);
      if (m) {
        sh(`agent-browser click @${m[1]} >/dev/null 2>&1`);
        return "clicked";
      }
    } catch { /* */ }
    sleep(500);
  }
  return "no-ref";
};

try {
  console.log(`[boot] close-all + desktop Chrome on ${CDP_PORT}`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* fresh start */ }
  const chromeUp = await launchDesktopChrome();
  if (!chromeUp) {
    console.error("FATAL: desktop Chrome never opened its CDP port");
    process.exit(2);
  }
  await sleep(400);
  let connected = false;
  for (let i = 0; i < 3 && !connected; i++) {
    try {
      const out = sh(`agent-browser connect ${CDP_PORT} 2>&1`);
      connected = !/relaunched|failed|✗/i.test(out);
      if (!connected) console.log(`  … connect attempt ${i + 1}: ${out.slice(0, 80)}`);
    } catch { /* */ }
    if (!connected) await sleep(800);
  }
  check("P0 agent-browser connected", connected, `port ${CDP_PORT}`);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  check("P0 hover shim applied", applyShim());
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof n === "number" && n === 12 ? n : null;
  }, 120000, 500);
  check("P1 EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);

  /* ---------- P1: the world + the job census (from the card labels) ---------- */
  const census = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    const portal = document.querySelector("nextjs-portal");
    const errDialog = portal && portal.shadowRoot
      ? !!portal.shadowRoot.querySelector("[data-nextjs-dialog-overlay], [data-nextjs-dialog]")
      : false;
    const jobs = Array.from(document.querySelectorAll("[data-job]")).map((el) => {
      const btn = el.querySelector("[role='button']");
      const label = btn ? (btn.getAttribute("aria-label") || "") : "";
      const m = label.match(/, (\\w+)\\)?$/);
      return { id: el.dataset.job, status: m ? m[1] : label };
    });
    return JSON.stringify({ cards, edges, errDialog, jobs });
  })()`);
  check("P1 canvas 12c/13e", census?.cards === 12 && census?.edges === 13, JSON.stringify({ cards: census?.cards, edges: census?.edges }));
  check("P1 no error dialog in the dev portal", census?.errDialog === false);
  const statuses = {};
  for (const j of census?.jobs ?? []) statuses[j.status] = (statuses[j.status] || 0) + 1;
  console.log(`  · job census: ${JSON.stringify(statuses)}`);
  const target = (census?.jobs ?? []).find((j) => j.status !== "idle");
  check("P1 a submitted (non-idle) card exists", !!target, JSON.stringify(target));

  /* ---------- P2: a real card click mounts the modal ---------- */
  const cardLabel = (census?.jobs ?? []).indexOf(target) >= 0
    ? null : null; /* the label is rebuilt below from the snapshot needle = the job id's card name */
  /* find the card's aria-label via its id (labels carry "name — type, status") */
  const labelOf = await readJson(`(() => {
    const el = document.querySelector("[data-job='${target.id}'] [role='button']");
    return JSON.stringify(el ? el.getAttribute("aria-label") : null);
  })()`);
  check("P2 the card's aria-label read", typeof labelOf === "string" && labelOf.length > 0, String(labelOf));
  const needle = labelOf.split(" — ")[0].slice(0, 24);
  const cardClick = clickRef(needle, "- button ");
  check("P2 the card clicked (real pointer input)", cardClick === "clicked", String(cardClick));
  const dialogUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog][data-state='open']"))`);
    return n === true ? "open" : null;
  }, 15000, 200);
  check("P2 the inspector modal mounted", dialogUp === "open", String(dialogUp));

  /* ---------- P3: the five face candidates exist and are SILENT ---------- */
  const faces = await readJson(`(() => {
    const root = document.querySelector("[data-inspector-dialog]");
    if (!root) return JSON.stringify({ gone: true });
    const accent = root.querySelector(":scope > div[aria-hidden='true']");
    const header = root.querySelector("[data-slot='dialog-header']");
    const tabsWrap = root.querySelector(".no-print.border-b");
    const panel = root.querySelector("[role='tabpanel'][data-state='active']");
    const footer = root.querySelector(":scope > footer");
    const silent = (el) => el ? getComputedStyle(el).animationName : null;
    const triggers = Array.from(root.querySelectorAll("[role='tab']")).map((t) => ({
      v: t.textContent.trim(), active: t.dataset.state === "active",
    }));
    return JSON.stringify({
      accent: !!accent, header: !!header, tabsWrap: !!tabsWrap, panel: !!panel, footer: !!footer,
      anAccent: silent(accent), anHeader: silent(header), anTabs: silent(tabsWrap),
      anPanel: silent(panel), anFooter: silent(footer),
      triggers,
    });
  })()`);
  check("P3 the five face candidates exist",
    faces?.accent === true && faces?.header === true && faces?.tabsWrap === true && faces?.panel === true,
    JSON.stringify(faces));
  check("P3 the gap is live (all faces animationName=none)",
    faces?.anAccent === "none" && faces?.anHeader === "none" && faces?.anTabs === "none" && faces?.anPanel === "none",
    JSON.stringify({ a: faces?.anAccent, h: faces?.anHeader, t: faces?.anTabs, p: faces?.anPanel, f: faces?.anFooter }));
  check("P3 four tab triggers present", (faces?.triggers ?? []).length === 4, JSON.stringify(faces?.triggers));

  /* ---------- P4: the smart default tab ---------- */
  const activeTrigger = (faces?.triggers ?? []).find((t) => t.active);
  check("P4 the smart default tab is results (completed job)", activeTrigger?.v === "Results", JSON.stringify(activeTrigger));

  /* ---------- P5: the footer's workdir word (data-gated — poll) ---------- */
  const ftr = await pollUntil(async () => {
    const v = await readJson(`(() => {
      const f = document.querySelector("[data-inspector-dialog] > footer");
      if (!f) return JSON.stringify({ present: false });
      const mono = f.querySelector("span.font-mono");
      return JSON.stringify({ present: true, workdir: mono ? mono.textContent.slice(0, 40) : null });
    })()`);
    return v?.present === true ? v : null;
  }, 30000, 400);
  check("P5 the workdir footer arrives (data-gated) with a path", ftr?.present === true && typeof ftr?.workdir === "string" && ftr.workdir.length > 0, JSON.stringify(ftr));

  /* ---------- P6: THE RADIX TRUTH (scoped to the dialog) ---------- */
  const stash = await readJson(`(() => {
    const p = document.querySelector("[data-inspector-dialog] [role='tabpanel'][data-state='active']");
    window.__t617stash = { node: p, id: p ? p.id : null };
    return JSON.stringify("stashed");
  })()`);
  check("P6 the panel node stashed (dialog-scoped)", stash === "stashed", String(stash));
  const logClick = clickRef("Log", "- tab ");
  check("P6 the Log tab clicked (real input — Radix triggers)", logClick === "clicked", String(logClick));
  const switched = await pollUntil(async () => {
    const v = await readJson(`(() => {
      const tabs = Array.from(document.querySelectorAll("[data-inspector-dialog] [role='tab']"));
      const active = tabs.find((t) => t.dataset.state === "active");
      return JSON.stringify(active ? active.textContent.trim() : null);
    })()`);
    return v === "Log" ? "log-active" : null;
  }, 10000, 200);
  check("P6 the Log tab is active", switched === "log-active", String(switched));
  const raduxTruth = await readJson(`(() => {
    const panels = Array.from(document.querySelectorAll("[data-inspector-dialog] [role='tabpanel']"));
    const active = panels.find((p) => p.dataset.state === "active");
    return JSON.stringify({
      count: panels.length,
      allFourStayMounted: panels.length === 4,
      activeIsStash: active === window.__t617stash.node,
      stashNowHidden: window.__t617stash.node ? window.__t617stash.node.hidden : null,
      stashEmptied: window.__t617stash.node ? window.__t617stash.node.childElementCount === 0 : null,
      activeNotEmpty: active ? active.childElementCount > 0 : null,
    });
  })()`);
  check("P6 THE RADIX TRUTH — 4 panels stay mounted, inactive hidden+emptied",
    raduxTruth?.count === 4 && raduxTruth?.allFourStayMounted === true && raduxTruth?.stashNowHidden === true && raduxTruth?.stashEmptied === true,
    JSON.stringify(raduxTruth));
  check("P6 the div identity persists (nomination, not mount, will be the cue)",
    raduxTruth?.activeIsStash === false && raduxTruth?.activeNotEmpty === true,
    JSON.stringify(raduxTruth));

  /* ---------- P7: a real Escape closes ---------- */
  const esc = sh(`agent-browser press Escape 2>&1`).trim();
  const closed = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
    return n === false ? "closed" : null;
  }, 10000, 200);
  check("P7 the real Escape closed the modal", closed === "closed", `esc=${esc.slice(0, 40)} result=${closed}`);

  /* ---------- P8: re-open = fresh dialog nodes ---------- */
  const firstDialog = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
  check("P8 the dialog unmounted on close", firstDialog === false, JSON.stringify(firstDialog));
  const cardClick2 = clickRef(needle, "- button ");
  check("P8 the card clicked again", cardClick2 === "clicked", String(cardClick2));
  const dialogUp2 = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog][data-state='open']"))`);
    return n === true ? "open" : null;
  }, 15000, 200);
  check("P8 the modal re-mounted fresh", dialogUp2 === "open", String(dialogUp2));
  /* close it again for a clean exit */
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(600);

  /* ---------- P9: the error net ---------- */
  const rWorld = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const portal = document.querySelector("nextjs-portal");
    const errDialog = portal && portal.shadowRoot
      ? !!portal.shadowRoot.querySelector("[data-nextjs-dialog-overlay], [data-nextjs-dialog]")
      : false;
    return JSON.stringify({ cards, errDialog });
  })()`);
  check("P9 canvas intact after the round-trip", rWorld?.cards === 12, JSON.stringify(rWorld));
  check("P9 no error dialog in the dev portal", rWorld?.errDialog === false);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { if (chromeProc) chromeProc.kill(); } catch { /* */ }
}

console.log(`\n=== ${pass}/${pass + fail} passed ===`);
process.exit(fail === 0 ? 0 : 1);
