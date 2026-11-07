#!/usr/bin/env node
/**
 * t867 probe — walk the completed roster, open each candidate's inspector,
 * switch to Results (mousedown door), and read the "Maps and images"
 * gallery's tiles (data-tile-path). Reports which host carries stacks
 * (.mrcs) and which carries maps (.mrc) — the instrument's host choice is
 * measured, never pinned.
 *
 *   node scripts/t867-gallery-probe.mjs
 */
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const sleep = (s) => execSync(`sleep ${s}`);

const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw.slice(0, 120) };
  }
};

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};
const roster = async () => {
  const r = await fetch(`${BASE}/api/jobs`, { headers: SH });
  const b = await r.json();
  return b.jobs ?? b;
};

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';

const ESC_ALL =
  '(() => { let n = 0; for (let i = 0; i < 6; i++) { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) break; const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); n++; } return JSON.stringify({ esc: n, left: document.querySelectorAll("[role=dialog]").length }); })()';

const READ_GALLERY =
  '(() => { const sec = document.querySelector(\'section[aria-label="Maps and images"]\'); if (!sec) return JSON.stringify({ gallery: false }); const tiles = Array.from(sec.querySelectorAll("button[data-tile-path]")); return JSON.stringify({ gallery: true, tiles: tiles.length, paths: tiles.slice(0, 30).map((t) => t.getAttribute("data-tile-path")), chips: Array.from(sec.querySelectorAll("button[aria-pressed]")).length }); })()';

const jobs = await roster();
const candidates = jobs.filter(
  (j) => j.status === "completed" && !j.id.startsWith("cmututold") // the seeded trio has no real outputs
);
console.log(`candidates: ${candidates.length}`);

ab("open http://localhost:3000");
sleep(4);

const report = {};
for (const j of candidates) {
  evalJson(plainClick(j.id));
  sleep(2);
  evalJson(tabMouseDown("Results"));
  sleep(3);
  const g = evalJson(READ_GALLERY);
  report[j.type + " " + j.name] = g.gallery
    ? { tiles: g.tiles, chips: g.chips, stacks: g.paths.filter((p) => p && p.endsWith(".mrcs")).length, maps: g.paths.filter((p) => p && p.endsWith(".mrc") && !p.endsWith(".mrcs")).length, sample: g.paths.slice(0, 6) }
    : { gallery: false };
  console.log(`${j.type} (${j.name}): ${JSON.stringify(report[j.type + " " + j.name]).slice(0, 220)}`);
  evalJson(ESC_ALL);
  sleep(1.5);
}
ab("close");
console.log("\nDONE");
