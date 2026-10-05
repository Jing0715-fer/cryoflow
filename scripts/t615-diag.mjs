import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CDP_PORT = "9334";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t615-diag-chrome-profile";
let proc;
try {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch {}
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
  proc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--hide-scrollbars", "--window-size=1280,720",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
    "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 30; i++) {
    try { if (sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200") break; } catch {}
    await sleep(300);
  }
  sh(`agent-browser connect ${CDP_PORT} >/dev/null 2>&1`);
  sh(`agent-browser open http://localhost:3000 >/dev/null 2>&1`);
  await sleep(4000);

  // open dashboard + dialog
  sh(`agent-browser eval "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))" >/dev/null 2>&1`);
  await sleep(1500);
  const snap1 = sh("agent-browser snapshot -i 2>/dev/null");
  const line = snap1.split("\n").find((l) => l.includes("New project"));
  const m = line && line.match(/\[ref=(e\d+)\]/);
  console.log("new-project ref:", m && m[1]);
  sh(`agent-browser click @${m[1]} >/dev/null 2>&1`);
  await sleep(1200);

  // what does the snapshot show for Cancel?
  const snap2 = sh("agent-browser snapshot -i 2>/dev/null");
  const cancelLines = snap2.split("\n").filter((l) => l.includes("Cancel"));
  console.log("cancel-matching snapshot lines:");
  cancelLines.forEach((l) => console.log("   ", l.slice(0, 140)));

  const dlgOpen = sh(`agent-browser eval "JSON.stringify(!!document.querySelector('[role=\\"dialog\\"][data-state=\\"open\\"]'))" 2>/dev/null`);
  console.log("dialog-open read BEFORE cancel:", dlgOpen);

  const cm = (cancelLines[0] || "").match(/\[ref=(e\d+)\]/);
  if (cm) {
    sh(`agent-browser click @${cm[1]} >/dev/null 2>&1`);
    await sleep(900);
  }
  const dlgOpen2 = sh(`agent-browser eval "JSON.stringify(!!document.querySelector('[role=\\"dialog\\"][data-state=\\"open\\"]'))" 2>/dev/null`);
  console.log("dialog-open read AFTER cancel:", dlgOpen2);

  // the exact eval the harness runs, raw output
  const raw = sh(`agent-browser eval ${JSON.stringify("JSON.stringify(!!document.querySelector('[role=\"dialog\"][data-state=\"open\"]'))")} 2>/dev/null`);
  console.log("harness-style eval raw output:", JSON.stringify(raw));
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch {}
  try { if (proc) proc.kill(); } catch {}
}
