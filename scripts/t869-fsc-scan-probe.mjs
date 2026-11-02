const SH = { Origin: "http://localhost:3000", Referer: "http://localhost:3000/", "Sec-Fetch-Site": "same-origin" };
const BASE = "http://localhost:3000";
const { execSync } = await import("node:child_process");
const sleep = (s) => execSync(`sleep ${s}`);
const ab = (js) => execSync(`agent-browser eval ${JSON.stringify(js)}`, { encoding: "utf8", cwd: process.cwd() });
const evalJson = (js) => { const raw = ab(js).trim(); let o; try { o = JSON.parse(raw); } catch { throw new Error(raw.slice(0, 150)); } if (typeof o === "string") { try { const i = JSON.parse(o); if (i && typeof i === "object") return i; } catch {} } return o; };

const MEASURE =
  '(() => { const ds = Array.from(document.querySelectorAll("[role=dialog]")); const top = ds[ds.length - 1]; ' +
  'const rows = top ? top.querySelectorAll("[data-fsc-row], [role=option], li").length : 0; ' +
  'const scanning = top ? /Scanning for FSC/.test(top.textContent || "") : false; ' +
  'const err = top ? /could not|failed|error/i.test((top.querySelector("[class*=destructive], [role=alert]") || {}).textContent || "") : false; ' +
  'const badge = top ? (Array.from(top.querySelectorAll("*")).find((e) => e.children.length === 0 && /^\\d+\\/\\d+$/.test((e.textContent || "").trim())) || {}).textContent : null; ' +
  'const rowNames = top ? Array.from(top.querySelectorAll("[data-fsc-row], [role=option]")).slice(0, 8).map((r) => (r.textContent || "").trim().slice(0, 40)) : []; ' +
  'return JSON.stringify({ dlg: ds.length, rows: rows, scanning: scanning, err: err, badge: badge, rowNames: rowNames }); })()';

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

(async () => {
  const jobs = (await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json()).jobs;
  const post = jobs.find((j) => j.type === "postprocess");
  evalJson(plainClick(post.id));
  for (let i = 0; i < 20; i++) { const v = evalJson('(() => JSON.stringify({ dlg: document.querySelectorAll("[role=dialog]").length }))()'); if (v.dlg >= 1) break; sleep(1); }
  evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "Results"); if (t) t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return "ok"; })()');
  sleep(2);
  evalJson('(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (b) b.click(); return "ok"; })()');
  console.log("dialog opened; the scan's own timeline:");
  for (let i = 0; i < 18; i++) {
    const v = evalJson(MEASURE);
    console.log(`  +${String(i).padStart(2)}s`, JSON.stringify(v));
    if (!v.scanning && v.rows >= 1) break;
    sleep(1);
  }
  // the re-scan door's own walk — one click, same timeline
  const rc = evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length-1]; const b = Array.from(d.querySelectorAll("button")).find((x) => /re-?scan/i.test(x.textContent || "")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true, label: (b.textContent || "").trim() }); })()');
  console.log("re-scan:", JSON.stringify(rc));
  for (let i = 0; i < 12; i++) {
    const v = evalJson(MEASURE);
    console.log(`  re+${String(i).padStart(2)}s`, JSON.stringify(v));
    if (!v.scanning) break;
    sleep(1);
  }
})();
