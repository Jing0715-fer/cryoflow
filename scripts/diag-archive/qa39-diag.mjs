// Task 39 diagnostic — why does bookmark restore not reproduce the Top hash?
// Steps: Top pose → hash+cam state → save bookmark → read stored snapshot →
// Front pose → restore → sample cam state at 0.4s/1.5s → hash.
import { execSync } from "node:child_process";

const AB = "agent-browser";
const JID = "cmts0qoho0003p8da75rvxycc";
const BM_KEY = `cryoflow.mol-camera-bookmarks:${JID}`;
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 90_000, input: expr }).trim();

const realClick = (findExpr) => {
  const coords = evalJs(
    `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`,
  );
  if (!coords || coords === "null") return "NO-ELEMENT";
  const c = JSON.parse(coords);
  sh(`${AB} mouse move ${c.x} ${c.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${c.x},${c.y}`;
};

const canvasHash = `(() => {
  const c = [...document.querySelectorAll('canvas')].find(x => x.width > 50 && x.height > 50);
  if (!c) return 'no-canvas';
  const s = c.toDataURL('image/png'); let h = 0;
  for (let i = 0; i < s.length; i += 997) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return '' + h;
})()`;

const camState = `(() => {
  const p = window.__molstar;
  if (!p) return 'no-plugin';
  const s = p.canvas3d.camera.state;
  const f = (v) => v && Array.from(v).map(x => +x.toFixed(4));
  return JSON.stringify({ target: f(s.target), up: f(s.up), pos: f(s.position), radius: +Number(s.radius).toFixed(2), fov: +Number(s.fov).toFixed(4) });
})()`;

const main = async () => {
  sh(`${AB} open http://localhost:3000`);
  await sleep(4500);
  let node = "";
  for (let i = 0; i < 20 && !node.includes("clicked@"); i++) {
    node = realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('3D Auto-Refine 1') && (x.textContent||'').includes('completed'))`,
    );
    if (!node.includes("clicked@")) await sleep(2000);
  }
  await sleep(2000);
  let card = "";
  for (let i = 0; i < 14 && !card.includes("clicked@"); i++) {
    card = realClick(
      `[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Enlarge Half-map 1 (iter 1)')`,
    );
    if (!card.includes("clicked@")) await sleep(2200);
  }
  await sleep(1500);
  for (let i = 0; i < 12; i++) {
    const v = evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('View in 3D')); b ? b.click() : 0; return b ? 'ok' : 'wait'; })()`);
    if (v.includes("ok")) break;
    await sleep(2000);
  }
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    const probe = evalJs(`({m: typeof window.__molstar, s: !!document.querySelector('[role=slider]')})`).replace(/\s+/g, "");
    if (probe.includes('"m":"object"') && probe.includes('"s":true')) break;
  }
  console.log("viewer ready");

  // Top pose
  sh(`${AB} press 5`);
  await sleep(1400);
  const hashTop = evalJs(canvasHash);
  const camTop = evalJs(camState);
  console.log("TOP  hash:", hashTop, "cam:", camTop);

  // save bookmark
  const opened = evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    if (p) return 'was-open';
    const t = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').includes('bookmarks'));
    if (!t) return 'NO-TRIGGER';
    t.click(); return 'opened';
  })()`);
  await sleep(1000);
  evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const inp = p.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'Diag top');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'named';
  })()`);
  await realClick(`[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => b.textContent.trim().startsWith('Save'))`);
  await sleep(800);
  const storedSnap = evalJs(`JSON.stringify(JSON.parse(localStorage.getItem('${BM_KEY}')||'[]')[0]?.snapshot?.position)`);
  console.log("STORED position:", storedSnap);

  // Front pose
  sh(`${AB} press 1`);
  await sleep(1400);
  const hashFront = evalJs(canvasHash);
  const camFront = evalJs(camState);
  console.log("FRONT hash:", hashFront, "cam:", camFront);

  // restore (popover is still open from save — click the row)
  await realClick(`[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => (b.title||'').includes('Fly back to'))`);
  await sleep(400);
  const camMid = evalJs(camState);
  console.log("RESTORE@0.4s cam:", camMid);
  await sleep(1500);
  const camEnd = evalJs(camState);
  const hashBack = evalJs(canvasHash);
  console.log("RESTORE@1.9s cam:", camEnd, "hash:", hashBack, "== top:", hashBack === hashTop);
};

main().catch((e) => { console.error("DIAG FAILED:", e.message); process.exit(1); });
