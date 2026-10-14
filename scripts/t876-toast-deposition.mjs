#!/usr/bin/env node
/** t876 probe — the toast's own deposition: ride the idempotent save and
 * sample the toast DOM tightly (every ~0.35s, 24 samples), recording EVERY
 * candidate (role=status, [data-radix-toast-announce], the viewport's li
 * count, the viewport's text). Then delete the born file (the absence
 * restored). */
import { execSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const SETTINGS_FILE = join(ROOT, "data/ai-settings.json");
const SH = {
  Origin: BASE, Referer: `${BASE}/`, "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty", "Content-Type": "application/json",
};
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try { out = JSON.parse(raw); } catch { return { unparseable: raw.slice(0, 120) }; }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch { /* a plain string — the value itself */ }
  }
  return out;
};
const sleepMs = (ms) => execSync(`node -e "setTimeout(()=>{},${ms})"`);

const existedAtStart = existsSync(SETTINGS_FILE);
if (existedAtStart) console.log(`(the settings file already exists: ${statSync(SETTINGS_FILE).size}B)`);
const dto0 = await (await fetch(`${BASE}/api/ai/settings`, { headers: SH })).json();

ab("open http://localhost:3000");
execSync("sleep 3");
ab("click '[aria-label=\"AI assistant\"]'");
execSync("sleep 2");
ab("click '[aria-label=\"AI provider settings\"]'");
execSync("sleep 3"); // the animation tax

const SAVE = '(() => { const b = Array.from(document.querySelectorAll("[role=dialog] button")).find((x) => (x.textContent || "").indexOf("保存并启用") >= 0); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()';
console.log("save click:", evalJson(SAVE));

const SNAP = '(() => { const vp = document.querySelector("[data-radix-toast-viewport], ol[data-radix-collection-root], ol"); const roles = Array.from(document.querySelectorAll("[role=status]")).map((e) => (e.textContent || "").trim().slice(0, 60)); const announce = Array.from(document.querySelectorAll("[data-radix-toast-announce]")).map((e) => (e.textContent || "").trim().slice(0, 60)); const lis = Array.from(document.querySelectorAll("ol li")).filter((li) => (li.getAttribute("data-radix-toast-impl") !== null || (li.className || "").indexOf("toast") >= 0 || li.closest("[data-radix-toast-viewport]"))); const vpText = vp ? (vp.textContent || "").trim().slice(0, 80) : null; return JSON.stringify({ roles: roles, announce: announce, liCount: lis.length, liText: lis.slice(0, 2).map((l) => (l.textContent || "").trim().slice(0, 60)), vpText: vpText }); })()';

for (let i = 0; i < 24; i++) {
  const s = evalJson(SNAP);
  const hit = (s.roles?.length ?? 0) + (s.announce?.length ?? 0) + (s.liCount ?? 0);
  console.log(`t+${(i * 0.35).toFixed(1)}s roles=${JSON.stringify(s.roles)} announce=${JSON.stringify(s.announce)} li=${s.liCount} vp=${JSON.stringify(s.vpText)}`);
  if (hit > 0 && i > 4) break; // keep sampling past the dialog close
  sleepMs(350);
}

const born = !existedAtStart && existsSync(SETTINGS_FILE);
if (born) {
  rmSync(SETTINGS_FILE);
  console.log(`(the born file deleted: ${!existsSync(SETTINGS_FILE)})`);
}
const dtoBack = await (await fetch(`${BASE}/api/ai/settings`, { headers: SH })).json();
console.log(`(final DTO == opening: ${JSON.stringify(dtoBack) === JSON.stringify(dto0)})`);
