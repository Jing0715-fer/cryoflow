#!/usr/bin/env node
/* t871 probe — what is the +1 button at the w2 moment? */
import { execSync } from "node:child_process";
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const ev = (js, trim = 700) => console.log(ab(`eval ${JSON.stringify(js)}`).trim().slice(0, trim));
const sleep = (s) => execSync(`sleep ${s}`);

ev('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => /Workspaces/.test((e.textContent || "").trim())); if (!t) return "no-tab"; const r = t.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; t.dispatchEvent(new PointerEvent("pointerdown", o)); t.dispatchEvent(new MouseEvent("mousedown", o)); t.dispatchEvent(new PointerEvent("pointerup", o)); t.dispatchEvent(new MouseEvent("mouseup", o)); return "tab"; })()');
sleep(2);
ev('(() => { const b = document.querySelector(\'button[aria-label="Create a new workspace"]\'); if (!b) return "no-door"; b.click(); return "door"; })()');
sleep(1);
ev('(() => { const ip = document.querySelector("#new-workspace-name"); if (!ip) return "no-ip"; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(ip, "QA Probe"); ip.dispatchEvent(new Event("input", { bubbles: true })); return "typed"; })()');
sleep(1);
ev('(() => { const b = Array.from(document.querySelectorAll("[role=dialog] button")).find((x) => /Create workspace/.test((x.textContent || "").trim())); if (!b) return "no-btn"; b.click(); return "created"; })()');
sleep(3);
ev('(() => { const btns = Array.from(document.querySelectorAll("button")); const names = {}; for (const b of btns) { const n = (b.getAttribute("aria-label") || (b.textContent || "").trim()).slice(0, 36) || "(unnamed)"; names[n] = (names[n] || 0) + 1; } const live = Array.from(document.querySelectorAll("[role=status],[aria-live]")).map((r) => ({ role: r.getAttribute("role"), live: r.getAttribute("aria-live"), text: (r.textContent || "").trim().slice(0, 70), btns: r.querySelectorAll("button").length })); return JSON.stringify({ total: btns.length, names, live }); })()', 2200);
/* cleanup: delete the probe room */
ev('(() => { const b = document.querySelector(\'button[aria-label="Delete QA Probe"]\'); if (!b) return "no-delete-door"; b.click(); return "delete-open"; })()');
sleep(1);
ev('(() => { const b = Array.from(document.querySelectorAll("[role=alertdialog] button")).find((x) => /Delete workspace/.test((x.textContent || "").trim())); if (!b) return "no-confirm"; b.click(); return "deleted"; })()');
sleep(2);
ev('(() => { const h = document.querySelector("[data-ws-header]"); return JSON.stringify({ count: h ? (h.querySelector("span.tabular-nums") || {}).textContent : null }); })()');
