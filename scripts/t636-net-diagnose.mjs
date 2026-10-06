// t636-net-diagnose.mjs — the three-way discriminator for the fetch hang.
//  1. cross-origin fetch from about:blank (network path pure)
//  2. /proc/net/tcp snapshot while the app page hangs (kernel's view)
//  3. a second page's fetch while the first is hung (pool poisoning?)
// Run: node scripts/t636-net-diagnose.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const B = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const race = (p, ms, tag) =>
  Promise.race([p.then((v) => `${tag}: ${v}`, (e) => `${tag}: ERR ${e}`), new Promise((res) => setTimeout(() => res(`${tag}: TIMEOUT ${ms}ms`), ms))]);

const b = await chromium.launch();

// --- 1. pure network path from about:blank --------------------------------
{
  const p = await b.newPage();
  await p.goto("about:blank");
  const r = await race(
    p.evaluate(() => fetch("http://localhost:3000/api/jobs").then((x) => x.status)),
    6000, "cross-origin /api/jobs"
  );
  console.log(r);
  await p.close();
}

// --- 2. app page: fill, hang, snapshot the kernel table --------------------
{
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto(B, { waitUntil: "domcontentloaded", timeout: 30000 });
  const input = p.locator('input[placeholder="Search projects…"]');
  let visible = false;
  for (let i = 0; i < 10 && !visible; i++) {
    visible = await input.isVisible().catch(() => false);
    if (!visible) { await p.keyboard.press("Shift+D"); await sleep(1800); visible = await input.isVisible().catch(() => false); }
  }
  await input.fill("class");
  await sleep(2500);

  const snap = () => {
    const rows = (readFileSync("/proc/net/tcp", "utf8") + readFileSync("/proc/net/tcp6", "utf8")).split("\n").slice(1).filter((l) => l.trim());
    const states = {};
    for (const line of rows) {
      const f = line.trim().split(/\s+/);
      const local = f[1];
      const port = parseInt(local.split(":")[1], 16);
      if (port === 3000) {
        const st = f[3];
        states[st] = (states[st] || 0) + 1;
      }
    }
    // 01=ESTABLISHED 06=TIME_WAIT 08=CLOSE_WAIT 04=FIN_WAIT1 05=FIN_WAIT2
    const names = { "01": "ESTAB", "06": "TIME_WAIT", "08": "CLOSE_WAIT", "04": "FIN1", "05": "FIN2", "0B": "CLOSING" };
    return Object.entries(states).map(([k, v]) => `${names[k] || k}=${v}`).join(" ") || "none";
  };
  console.log(`[kernel while hung] ${snap()}`);

  const r2 = await race(
    p.evaluate(() => fetch("/api/jobs?diag=1").then((x) => x.status)),
    5000, "same-page fetch"
  );
  console.log(r2);
  console.log(`[kernel after] ${snap()}`);

  // --- 3. a fresh page while the first is hung ------------------------------
  {
    const p2 = await b.newPage();
    await p2.goto("about:blank");
    const r3 = await race(
      p2.evaluate(() => fetch("http://localhost:3000/api/jobs?diag=2").then((x) => x.status)),
      5000, "second-page fetch"
    );
    console.log(r3);
    await p2.close();
  }
  await p.close();
}

await b.close();
