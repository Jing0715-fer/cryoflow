/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t617-diag — two crime scenes from the probe:
 *   D1 the workdir footer: does it render for the first completed card?
 *      (dump DialogContent's direct children — tags + classes — plus the
 *      in-page fetch of the outputs API)
 *   D2 the tab-switch node identity: stash the active tabpanel, click the
 *      Log trigger for real, dump ALL tabpanels (mounted? state? same
 *      node as stash?) — Radix Presence should unmount inactive content.
 * CDP port 9336, fresh profile.
 * Usage: node scripts/t617-diag.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const CDP_PORT = "9336";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t617-diag-chrome-profile";
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
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* */ }
  const up = await launchDesktopChrome();
  if (!up) { console.error("FATAL no chrome"); process.exit(2); }
  await sleep(400);
  sh(`agent-browser connect ${CDP_PORT} >/dev/null 2>&1`);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  try { sh(`node ${SHIM} ${CDP_PORT} >/dev/null 2>&1`); } catch { /* */ }
  await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 120000, 500);
  console.log("world hydrated");

  const labelOf = await readJson(`(() => {
    const el = document.querySelector("[data-job] [role='button']");
    return JSON.stringify(el ? el.getAttribute("aria-label") : null);
  })()`);
  const needle = String(labelOf).split(" — ")[0].slice(0, 24);
  console.log("card needle:", needle, "→", clickRef(needle, "- button "));
  const up2 = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog][data-state='open']"))`);
    return n === true ? "open" : null;
  }, 15000, 200);
  console.log("dialog:", up2);
  await sleep(2500); /* the outputs fetch has landed by now */

  /* ---------- D1: the footer + the direct children census ---------- */
  const d1 = await readJson(`(() => {
    const root = document.querySelector("[data-inspector-dialog]");
    const kids = Array.from(root.children).map((c) => ({
      tag: c.tagName.toLowerCase(),
      cls: (c.className || "").toString().slice(0, 50),
      hidden: c.hasAttribute("hidden") || (c.getAttribute("aria-hidden") === "true" && c.offsetHeight === 0),
    }));
    const ftr = root.querySelector(":scope > footer");
    return JSON.stringify({ kids, footerPresent: !!ftr, footerText: ftr ? ftr.textContent.slice(0, 60) : null });
  })()`);
  console.log("D1 children:", JSON.stringify(d1, null, 1));

  /* the in-page fetch (the exact call loadOutputs makes) */
  const d1b = await readJson(`(async () => {
    const id = document.querySelector("[data-job]").dataset.job;
    const res = await fetch("/api/jobs/" + id + "/outputs", { cache: "no-store" });
    const body = await res.json();
    return JSON.stringify({ ok: res.ok, workdir: typeof body.workdir, err: body.error || null });
  })()`);
  console.log("D1 in-page fetch:", JSON.stringify(d1b));

  /* ---------- D2: the tab-switch node identity ---------- */
  await readJson(`(() => {
    const p = document.querySelector("[role='tabpanel'][data-state='active']");
    window.__t617d = { stash: p, stashTag: p ? p.className : null };
    return JSON.stringify("stashed");
  })()`);
  console.log("Log click:", clickRef("Log", "- tab "));
  await pollUntil(async () => {
    const v = await readJson(`(() => {
      const t = Array.from(document.querySelectorAll("[data-inspector-dialog] [role='tab']")).find((x) => x.dataset.state === "active");
      return JSON.stringify(t ? t.textContent.trim() : null);
    })()`);
    return v === "Log" ? "ok" : null;
  }, 10000, 200);
  const d2 = await readJson(`(() => {
    const panels = Array.from(document.querySelectorAll("[role='tabpanel']")).map((p) => ({
      id: p.id || null,
      state: p.dataset.state,
      hidden: p.hidden,
      same: p === window.__t617d.stash,
      cls: p.className.slice(0, 40),
    }));
    const active = document.querySelector("[role='tabpanel'][data-state='active']");
    return JSON.stringify({
      panels,
      activeIsStash: active === window.__t617d.stash,
      stashDetached: window.__t617d.stash && !window.__t617d.stash.isConnected,
    });
  })()`);
  console.log("D2 panels:", JSON.stringify(d2, null, 1));

  sh(`agent-browser press Escape >/dev/null 2>&1`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { if (chromeProc) chromeProc.kill(); } catch { /* */ }
}
