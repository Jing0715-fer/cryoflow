/**
 * t570 CDP media-verify — READ-ONLY check that the test browser tells
 * the desktop truth. The Chrome this harness launches carries
 * --blink-settings primaryHoverType/primaryPointerType (desktop
 * capability bits), which alone make (hover: hover)/(pointer: fine)
 * match. Earlier versions of this script ALSO called
 * Emulation.setTouchEmulationEnabled/setEmulatedMedia — and those calls
 * themselves flipped hover back to none (emulation state replaces the
 * real capability bits the moment it exists). Lesson learned: the launch
 * flags are the whole trick; verify, never touch.
 *
 * Usage: node scripts/t570-cdp-hover-shim.mjs <cdp-port>
 * Exit:  0 = every page reports hover:hover + pointer:fine; 1 = any page
 *        lies (phone media), -1 = no page targets found.
 */

import { execSync } from "node:child_process";
import WebSocket from "ws";

const port = process.argv[2] ?? "9321";
const sh = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();

const list = JSON.parse(sh(`curl -s http://127.0.0.1:${port}/json/list`));
const pages = list.filter((t) => t.type === "page");
if (pages.length === 0) {
  console.error(JSON.stringify({ ok: false, reason: "no page targets", port }));
  process.exit(-1);
}

let id = 0;
const results = [];
for (const page of pages) {
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
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
    const probe = await send("Runtime.evaluate", {
      expression: "JSON.stringify({h: matchMedia('(hover: hover)').matches, p: matchMedia('(pointer: fine)').matches})",
      returnByValue: true,
    });
    results.push({ url: (page.url || "about:blank").slice(0, 40), ...JSON.parse(probe.result.value) });
  } catch (e) {
    results.push({ url: (page.url || "?").slice(0, 40), error: String(e.message || e).slice(0, 80) });
  } finally {
    try { ws.close(); } catch { /* gone */ }
  }
}

const allGood = results.length > 0 && results.every((r) => r.h === true && r.p === true);
console.log(JSON.stringify({ ok: allGood, results }));
if (allGood) process.exit(0);
process.exit(1);
