#!/usr/bin/env node
/* t871 cleanup — the probe's failed cleanup left "QA Probe" behind; the
 * ws-orphan law demands the census back at 1. This walks the product's
 * own delete door and confirms. */
import { execSync } from "node:child_process";
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const ev = (js, trim = 400) => console.log(ab(`eval ${JSON.stringify(js)}`).trim().slice(0, trim));
const sleep = (s) => execSync(`sleep ${s}`);

/* open the workspaces tab */
ev('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => /Workspaces/.test((e.textContent || "").trim())); if (!t) return "no-tab"; const r = t.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; t.dispatchEvent(new PointerEvent("pointerdown", o)); t.dispatchEvent(new MouseEvent("mousedown", o)); t.dispatchEvent(new PointerEvent("pointerup", o)); t.dispatchEvent(new MouseEvent("mouseup", o)); return "tab"; })()');
sleep(2);
ev('(() => { const b = document.querySelector(\'button[aria-label="Delete QA Probe"]\'); if (!b) return JSON.stringify({ gone: true, note: "already clean" }); b.click(); return "delete-open"; })()');
sleep(1);
ev('(() => { const b = Array.from(document.querySelectorAll("[role=alertdialog] button")).find((x) => /Delete workspace/.test((x.textContent || "").trim())); if (!b) return "no-confirm"; b.click(); return "deleted"; })()');
sleep(2);
ev('(() => { const h = document.querySelector("[data-ws-header]"); const list = document.querySelector("[aria-label=Workspaces]"); return JSON.stringify({ count: h ? (h.querySelector("span.tabular-nums") || {}).textContent : null, rows: list ? list.querySelectorAll("div[role=button]").length : -1, names: list ? Array.from(list.querySelectorAll("div[role=button] p")).map((p) => (p.textContent || "").trim()) : [] }); })()');
