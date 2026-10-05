/**
 * t614 — opening QA probe (world read-only): the Workspaces tab's lane.
 *
 * t613's exit lane named "projects grid 卡片的 innards 家族扫描" — but the
 * ledger needed a reality check (t610/t613's own doctrine): ProjectPanel
 * is DEAD CODE (only NewProjectDialog is imported; the sidebar's
 * "Workspaces" tab renders workspace-panel.tsx). The honest lane is the
 * LIVE sibling: the WorkspacePanel's faces (header / hint / workspace
 * cards / stats rows) have never been scanned by the arrival family.
 *
 * QA faces: hydrate 12 cards, 12c/13e/12dots, console clean, roster 12/1.
 * Lane recon — P2 the Radix tab trigger is synthetically clickable;
 * P3 mount semantics (TabsContent unmounts on leave — every entry is a
 * fresh mount, so arrival replays honestly per entry); P4 the GAP (every
 * workspace face mounts SILENT inside the risen sidebar); P5 the chrome
 * inventory (the New button and the running chip's animate-spin spinner
 * are living words the entrance must never nominate); P6 the world's
 * workspace count.
 *
 * Usage: node scripts/t614-qa-probe.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* read-only lane — CDP dedicated port 9333 (9323 = t578, 9324 = t584/t604,
 * 9325 = t605, 9326 = t607, 9327 = t608, 9328 = t609, 9329 = t610,
 * 9330 = t611, 9331 = t612, 9332 = t613) + fresh profile (t581 lesson) */
const CDP_PORT = "9333";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t614-harness-chrome-profile";
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
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
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
/* the tab click — REAL input via the snapshot ref flow. Tuition of the
 * window: Radix Tabs triggers swallow synthetic .click() (the t611 "not
 * Radix" lesson extends to tabs: the trigger listens to pointer events a
 * JS click never sends). agent-browser's click @ref dispatches real
 * pointer input; the panel mounting is the proof. */
const clickTab = (needle) => {
  try {
    const snap = sh("agent-browser snapshot -i 2>/dev/null");
    const line = snap.split("\n").find((l) => l.includes("- tab ") && l.includes(needle));
    const m = line && line.match(/\[ref=(e\d+)\]/);
    if (!m) return "no-ref";
    sh(`agent-browser click @${m[1]} >/dev/null 2>&1`);
    return "clicked";
  } catch (e) {
    return "click-failed";
  }
};

/* the workspace faces scan — the card discriminator is the title prefix
 * the source prints (Switch the canvas / Active workspace); the stats row
 * is the card's mt-2 flex-wrap child; spinners are the card's own
 * animate-spin nodes (the living word) */
const WS_SCAN = `(() => {
  const cards = Array.from(document.querySelectorAll('[role="button"]')).filter((c) => {
    const t = c.getAttribute("title") || "";
    return t.startsWith("Switch the canvas") || t.startsWith("Active workspace");
  });
  const anim = (el) => (el ? getComputedStyle(el).animationName : "absent");
  const statsRows = cards.map((c) => Array.from(c.children).find((ch) => (ch.className || "").includes("mt-2"))).filter(Boolean);
  const spinners = cards.flatMap((c) => Array.from(c.querySelectorAll(".animate-spin")));
  const header = Array.from(document.querySelectorAll("p")).find((p) => (p.textContent || "").trim() === "Workspaces");
  const hint = Array.from(document.querySelectorAll("p")).find((p) => (p.textContent || "").startsWith("Each workspace is a separate canvas"));
  const newBtn = document.querySelector('button[aria-label="Create a new workspace"]');
  const count = header ? header.parentElement.querySelector("span.tabular-nums") : null;
  return JSON.stringify({
    cards: cards.length,
    cardAnims: [...new Set(cards.map(anim))],
    statsAnim: [...new Set(statsRows.map(anim))],
    spinnerCount: spinners.length,
    spinnerAnim: [...new Set(spinners.map(anim))],
    headerPresent: !!header,
    headerAnim: anim(header),
    hintPresent: !!hint,
    hintAnim: anim(hint),
    newBtnPresent: !!newBtn,
    newBtnAnim: anim(newBtn),
    wsCount: count ? count.textContent : null,
  });
})()`;

let chromeUp = false;
try {
  console.log(`[boot] close-all + desktop Chrome on ${CDP_PORT}`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* fresh start */ }
  chromeUp = await launchDesktopChrome();
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
    } catch { await sleep(800); }
    if (!connected) await sleep(800);
  }
  check("agent-browser connected to desktop Chrome", connected, `port ${CDP_PORT}`);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  check("hover shim applied", applyShim());
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof n === "number" && n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);

  /* world shape */
  const world = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    const dots = document.querySelectorAll("[data-canvas-ui='minimap-dot']").length;
    return JSON.stringify({ cards, edges, dots });
  })()`);
  check("canvas 12 cards", world?.cards === 12, `got ${world?.cards}`);
  check("canvas 13 edges", world?.edges === 13, `got ${world?.edges}`);
  check("minimap 12 dots", world?.dots === 12, `got ${world?.dots}`);

  /* pre-click: the Workspaces panel should NOT be mounted (catalog is the
   * default tab) — the card scan reads zero */
  const preCards = await readJson(`(() => {
    const cards = Array.from(document.querySelectorAll('[role="button"]')).filter((c) => {
      const t = c.getAttribute("title") || "";
      return t.startsWith("Switch the canvas") || t.startsWith("Active workspace");
    });
    return JSON.stringify(cards.length);
  })()`);
  check("P3 pre-click: ws panel unmounted", preCards === 0, `got ${preCards}`);

  /* P2 the click — synthetic .click() on the Radix trigger; the panel
   * appearing is the proof (Radix triggers listen to real click events) */
  const clicked = await clickTab("Workspaces");
  check("P2 Workspaces tab clicked", clicked === "clicked", String(clicked));
  const opened = await pollUntil(async () => {
    const n = await readJson(`(() => {
      const cards = Array.from(document.querySelectorAll('[role="button"]')).filter((c) => {
        const t = c.getAttribute("title") || "";
        return t.startsWith("Switch the canvas") || t.startsWith("Active workspace");
      });
      return JSON.stringify(cards.length);
    })()`);
    return typeof n === "number" && n > 0 ? n : null;
  }, 15000, 300);
  check("P2 ws panel mounted", typeof opened === "number" && opened > 0, `cards=${opened}`);
  await sleep(1200); /* let any existing animation settle so reads are settled reads */

  /* P4/P5/P6 the gap + chrome + inventory, live */
  const ws = await readJson(WS_SCAN);
  check("P6 world workspace inventory", ws && typeof ws.cards === "number", `cards=${ws?.cards} wsCount=${ws?.wsCount} spinner=${ws?.spinnerCount}`);
  check("P4 the GAP is live (cards silent)", ws?.cardAnims?.length === 1 && ws.cardAnims[0] === "none", JSON.stringify(ws?.cardAnims));
  check("P4 the GAP is live (stats silent)", ws?.statsAnim?.length === 1 && ws.statsAnim[0] === "none", JSON.stringify(ws?.statsAnim));
  check("P4 header/hint present and silent", ws?.headerPresent === true && ws?.hintPresent === true && ws?.headerAnim === "none" && ws?.hintAnim === "none", `header=${ws?.headerAnim} hint=${ws?.hintAnim}`);
  check("P5 New button is chrome (silent)", ws?.newBtnPresent === true && ws?.newBtnAnim === "none", `anim=${ws?.newBtnAnim}`);
  check("P5 spinner inventory recorded", typeof ws?.spinnerCount === "number", `spinners=${ws?.spinnerCount} anim=${JSON.stringify(ws?.spinnerAnim)}`);

  /* P3 leave → unmount */
  const left = await clickTab("Catalog");
  check("P3 Catalog click", left === "clicked", String(left));
  await sleep(800);
  const afterLeave = await readJson(`(() => {
    const cards = Array.from(document.querySelectorAll('[role="button"]')).filter((c) => {
      const t = c.getAttribute("title") || "";
      return t.startsWith("Switch the canvas") || t.startsWith("Active workspace");
    });
    return JSON.stringify(cards.length);
  })()`);
  check("P3 unmount on leave", afterLeave === 0, `got ${afterLeave}`);

  /* P3 return → remount */
  const back = await clickTab("Workspaces");
  check("P3 Workspaces click back", back === "clicked", String(back));
  await sleep(800);
  const afterBack = await readJson(`(() => {
    const cards = Array.from(document.querySelectorAll('[role="button"]')).filter((c) => {
      const t = c.getAttribute("title") || "";
      return t.startsWith("Switch the canvas") || t.startsWith("Active workspace");
    });
    return JSON.stringify(cards.length);
  })()`);
  check("P3 remount on return", typeof afterBack === "number" && afterBack > 0, `got ${afterBack}`);

  /* R world return-path: canvas untouched, no crash overlay */
  const worldAfter = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    return JSON.stringify({ cards, edges });
  })()`);
  check("R canvas intact after tab round-trip", worldAfter?.cards === 12 && worldAfter?.edges === 13, JSON.stringify(worldAfter));
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { if (chromeProc) chromeProc.kill(); } catch { /* */ }
}

console.log(`\n=== ${pass}/${pass + fail} passed ===`);
process.exit(fail === 0 ? 0 : 1);
