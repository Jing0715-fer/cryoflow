/**
 * t615 — chore witness: ProjectPanel dead-code removal, page behavior
 * UNCHANGED. The file used to carry the whole sidebar "Projects" panel
 * (cards, stats, rename, delete) on top of NewProjectDialog; the panel was
 * retired by the Workspaces tab (t613/t614) and t614's probe proved it dead
 * (only NewProjectDialog is imported). This window cut 489 lines + 6 dead
 * import blocks. The honest witness is the LIVE consumer: the project
 * dashboard still opens the New project dialog, and the canvas behind it
 * is untouched.
 *
 * Faces: hydrate 12 cards; Shift+D (window keydown — synthetic dispatch is
 * honest for non-Radix listeners, t584 doctrine) flips to the dashboard;
 * the dashboard's "New project" button opens the DIALOG (title + name
 * input + Create button present); Cancel closes it; Shift+D back; canvas
 * 12c/13e intact; console clean throughout.
 *
 * Usage: node scripts/t615-panel-cut-witness.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* CDP dedicated port 9334 (9323 = t578, 9324 = t584/t604, 9325 = t605,
 * 9326 = t607, 9327 = t608, 9328 = t609, 9329 = t610, 9330 = t611,
 * 9331 = t612, 9332 = t613, 9333 = t614) + fresh profile (t581 lesson) */
const CDP_PORT = "9334";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t615-harness-chrome-profile";
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
/* real pointer input via the snapshot ref flow (the honest path for
 * buttons living inside Radix-wrapped trees — t614 tuition) */
const clickRef = (needle) => {
  try {
    const snap = sh("agent-browser snapshot -i 2>/dev/null");
    const line = snap.split("\n").find((l) => l.includes(needle));
    const m = line && line.match(/\[ref=(e\d+)\]/);
    if (!m) return "no-ref";
    sh(`agent-browser click @${m[1]} >/dev/null 2>&1`);
    return "clicked";
  } catch {
    return "click-failed";
  }
};
/* Shift+D — the view flip rides a window keydown listener (non-Radix),
 * synthetic dispatch is honest here (t584/t585 doctrine) */
const shiftD = async () => {
  await readJson(`(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "D", shiftKey: true, bubbles: true }));
    return JSON.stringify("sent");
  })()`);
};

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

  const world0 = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    return JSON.stringify({ cards, edges });
  })()`);
  check("canvas 12 cards / 13 edges pre-flight", world0?.cards === 12 && world0?.edges === 13, JSON.stringify(world0));

  /* D1 the view flip */
  await shiftD();
  const dash = await pollUntil(async () => {
    const v = await readJson(`(() => {
      const btns = Array.from(document.querySelectorAll("button")).filter((b) => (b.textContent || "").includes("New project"));
      return JSON.stringify(btns.length);
    })()`);
    return typeof v === "number" && v > 0 ? v : null;
  }, 15000, 400);
  check("D1 Shift+D flips to dashboard (New project button present)", typeof dash === "number" && dash > 0, `buttons=${dash}`);
  await sleep(600);

  /* D2 the dialog opens — the live consumer of the surviving half */
  const clicked = clickRef("New project");
  check("D2 New project button clicked", clicked === "clicked", String(clicked));
  const dlg = await pollUntil(async () => {
    const v = await readJson(`(() => {
      const dialog = document.querySelector('[role="dialog"][data-state="open"]');
      if (!dialog) return JSON.stringify(null);
      const title = Array.from(dialog.querySelectorAll("h2")).some((h) => (h.textContent || "").trim() === "New project");
      const input = !!dialog.querySelector("#new-project-name");
      const create = Array.from(dialog.querySelectorAll("button")).some((b) => (b.textContent || "").includes("Create project"));
      const modeSelect = !!dialog.querySelector("#new-project-mode");
      return JSON.stringify({ title, input, create, modeSelect });
    })()`);
    return v && v.title && v.input ? v : null;
  }, 10000, 400);
  check("D2 dialog mounted with title + name input", !!dlg, JSON.stringify(dlg));
  check("D2 dialog carries Create button + mode select", dlg?.create === true && dlg?.modeSelect === true, JSON.stringify(dlg));

  /* D3 the dialog's remote lane still renders (local/cluster radio cards) */
  const lanes = await readJson(`(() => {
    const dialog = document.querySelector('[role="dialog"][data-state="open"]');
    if (!dialog) return JSON.stringify(null);
    const tabs = Array.from(dialog.querySelectorAll('[role="tab"]')).map((t) => (t.textContent || "").trim());
    return JSON.stringify(tabs);
  })()`);
  check("D3 data-location lanes intact (This machine / Cluster SSH)", Array.isArray(lanes) && lanes.length === 2 && lanes[0].startsWith("This machine") && lanes[1].startsWith("Cluster"), JSON.stringify(lanes));

  /* D4 Cancel closes — the dialog's own lifecycle is untouched.
   * Read via the D2-proven IIFE-string path: the bare-boolean eval's
   * double-encoded "false" flaked in the 300ms poll loop (both runs),
   * while the same selector inside an IIFE returning JSON string reads
   * rock solid (diag: BEFORE "true" → AFTER "false", product correct). */
  const cancelled = clickRef("Cancel");
  check("D4 Cancel clicked", cancelled === "clicked", String(cancelled));
  const closed = await pollUntil(async () => {
    const v = await readJson(`(() => {
      const open = !!document.querySelector('[role="dialog"][data-state="open"]');
      return JSON.stringify(open ? "open" : "closed");
    })()`);
    return v === "closed" ? v : null;
  }, 8000, 300);
  check("D4 dialog closed", closed === "closed", `state=${closed}`);

  /* R back to canvas — world untouched by the cut */
  await shiftD();
  const backCanvas = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof v === "number" && v === 12 ? v : null;
  }, 15000, 400);
  check("R Shift+D back to canvas, 12 cards", backCanvas === 12, `got ${backCanvas}`);
  const worldAfter = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    return JSON.stringify({ cards, edges });
  })()`);
  check("R canvas 12c/13e intact after round-trip", worldAfter?.cards === 12 && worldAfter?.edges === 13, JSON.stringify(worldAfter));

  /* no crash overlay anywhere in the trip (honest error = shadow dialog pair,
   * NOT the dev-tools portal — t614 tuition) */
  const errors = await readJson(`(() => {
    const bad = Array.from(document.querySelectorAll("nextjs-portal")).filter((p) =>
      p.shadowRoot && p.shadowRoot.querySelector("[data-nextjs-dialog]")
    ).length;
    return JSON.stringify(bad);
  })()`);
  check("R zero Next dev crash dialogs", errors === 0, `got ${errors}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { if (chromeProc) chromeProc.kill(); } catch { /* */ }
}

console.log(`\n=== ${pass}/${pass + fail} passed ===`);
process.exit(fail === 0 ? 0 : 1);
