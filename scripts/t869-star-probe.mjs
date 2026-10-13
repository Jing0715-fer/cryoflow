const SH = { Origin: "http://localhost:3000", Referer: "http://localhost:3000/", "Sec-Fetch-Site": "same-origin" };
const BASE = "http://localhost:3000";
import { execSync } from "node:child_process";
const sleep = (s) => execSync(`sleep ${s}`);
const ab = (js) => execSync(`agent-browser eval ${JSON.stringify(js)}`, { encoding: "utf8", cwd: process.cwd() });
const evalJson = (js) => { const raw = ab(js).trim(); let o; try { o = JSON.parse(raw); } catch { throw new Error(raw.slice(0, 150)); } if (typeof o === "string") { try { const i = JSON.parse(o); if (i && typeof i === "object") return i; } catch {} } return o; };

const MEASURE =
  '(() => { const ds = Array.from(document.querySelectorAll("[role=dialog]")); const top = ds[ds.length - 1]; ' +
  'const region = top ? top.querySelector("[role=region]") : null; ' +
  'const cols = top ? Array.from(top.querySelectorAll("th[aria-sort], [role=columnheader][aria-sort]")) : []; ' +
  'const tables = top ? top.querySelectorAll("table").length : 0; ' +
  'const rows = top ? top.querySelectorAll("tbody tr").length : 0; ' +
  'const bodyTxt = top ? (top.textContent || "").slice(0, 200) : ""; ' +
  'return JSON.stringify({ dlg: ds.length, regionLabel: region ? region.getAttribute("aria-label") : null, regionTab: region ? region.getAttribute("tabindex") : null, cols: cols.length, tables: tables, rows: rows, bodyTxt: bodyTxt }); })()';

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

(async () => {
  const jobs = (await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json()).jobs;
  const hosts = [];
  for (const j of jobs.filter((x) => x.status === "completed")) {
    const ob = await (await fetch(`${BASE}/api/jobs/${j.id}/outputs`, { headers: SH })).json();
    const files = ob.files ?? ob;
    if ((Array.isArray(files) ? files : []).some((f) => f.kind === "star")) hosts.push(j);
  }
  console.log("star hosts:", hosts.map((h) => h.type).join(", "));
  const host = hosts[0];
  evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
  execSync(`agent-browser open ${BASE}`, { encoding: "utf8" });
  sleep(3);
  for (let i = 0; i < 20; i++) { const v = evalJson('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length }))()'); if (v.cards === 16) break; sleep(1); }
  evalJson(plainClick(host.id));
  for (let i = 0; i < 20; i++) { const v = evalJson('(() => JSON.stringify({ dlg: document.querySelectorAll("[role=dialog]").length }))()'); if (v.dlg >= 1) break; sleep(1); }
  evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "Results"); if (t) t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return "ok"; })()');
  sleep(2);
  const door = evalJson('(() => { const sec = document.querySelector(\'section[aria-label="STAR tables"]\') || document.querySelector(\'section[aria-label*="STAR"]\') || document.querySelector(\'section[aria-label*="star"]\'); if (!sec) return JSON.stringify({ found: false, sections: Array.from(document.querySelectorAll("section[aria-label]")).map((s) => s.getAttribute("aria-label")) }); const b = sec.querySelector("button"); if (!b) return JSON.stringify({ found: false, sec: sec.getAttribute("aria-label") }); b.click(); return JSON.stringify({ found: true, door: (b.textContent || "").trim().slice(0, 30) }); })()');
  console.log("star door:", JSON.stringify(door));
  for (let i = 0; i < 14; i++) {
    const v = evalJson(MEASURE);
    console.log(`  +${String(i).padStart(2)}s`, JSON.stringify(v).slice(0, 240));
    if (v.cols > 0 && v.rows > 0) break;
    sleep(1);
  }
})();
