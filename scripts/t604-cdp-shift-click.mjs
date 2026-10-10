/**
 * t604 CDP shift-click — a REAL shift-click at viewport coordinates,
 * dispatched through the CDP Input domain (modifiers=8 is Shift). The
 * card's multi-select toggle lives in the React pointer sequence and
 * reads e.shiftKey on BOTH pointerdown and pointerup (job-card.tsx) —
 * synthetic dispatchEvent could fake it, but a real CDP press is the
 * same input a human finger makes (the t600 tuition: reach for the real
 * input whenever the harness can).
 *
 * Usage: node scripts/t604-cdp-shift-click.mjs <cdp-port> <x> <y> [modifier] (8=Shift, 0=plain)
 * Prints JSON {ok:true} on success, exits 0.
 */

import { execSync } from "node:child_process";
import WebSocket from "ws";

const [port, x, y] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const MOD = Number(process.argv[5] || 0); /* 8 = Shift, 0 = plain */
if (!port || !Number.isFinite(x) || !Number.isFinite(y)) {
  console.error(JSON.stringify({ ok: false, reason: "usage: node t604-cdp-shift-click.mjs <port> <x> <y>" }));
  process.exit(2);
}

const list = JSON.parse(execSync(`curl -s http://127.0.0.1:${port}/json/list`, { encoding: "utf8" }));
const page = list.find((t) => t.type === "page");
if (!page) {
  console.error(JSON.stringify({ ok: false, reason: "no page target" }));
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const my = ++id;
  const onMsg = (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.id === my) {
      ws.off("message", onMsg);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  };
  ws.on("message", onMsg);
  ws.send(JSON.stringify({ id: my, method, params }));
});

try {
  await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
  const base = { x, y, button: "left", buttons: 1, clickCount: 1 };
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...base, buttons: 0 });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...base, modifiers: MOD });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base, modifiers: MOD, buttons: 0 });
  console.log(JSON.stringify({ ok: true, x, y }));
  process.exit(0);
} catch (e) {
  console.error(JSON.stringify({ ok: false, reason: String(e.message || e).slice(0, 120) }));
  process.exit(1);
} finally {
  try { ws.close(); } catch { /* gone */ }
}
