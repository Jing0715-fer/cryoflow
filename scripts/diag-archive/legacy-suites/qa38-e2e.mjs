// Task 38 QA — server-backed overlay session + turntable footer composite +
// speed persistence. Single browser session, five phases:
//   A  clean slate (server row emptied, localStorage cleared) + viewer open
//   B  turntable speed persistence (Quick → localStorage)
//   C  turntable recording: composite canvas probed live (footer text
//      pixels), toast text, camera-restored canvas hash
//   D  add overlay → debounced server mirror verified via in-page GET
//   E  "cross-browser" restore: wipe localStorage, reopen → server wins
//   F  self-heal: bogus server entry is dropped and the row self-deletes
// Usage: node scripts/qa38-e2e.mjs
import { execSync } from "node:child_process";

const AB = "agent-browser";
const JID = process.env.QA_JID || "cmts0qoho0003p8da75rvxycc";
const OVERLAY_KEY = `cryoflow.mol-overlays:${JID}`;
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// multiline JS goes through --stdin: zero shell-escaping mangling
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 90_000, input: expr }).trim();

/** real-input click (trusted events) via element-finding expression */
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

const toastObserver = `(() => {
  window.__qaToasts = [];
  const t0 = Date.now();
  window.__qaMo && window.__qaMo.disconnect();
  window.__qaMo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/Turntable|Restored|overlay|exported|discarded/i.test(t)) {
          window.__qaToasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 220) });
        }
      }
    }
  });
  window.__qaMo.observe(document.body, { childList: true, subtree: true });
  return 'observer-on';
})()`;

const canvasHash = `(() => {
  const c = [...document.querySelectorAll('canvas')].find(x => x.width > 50 && x.height > 50);
  if (!c) return 'no-canvas';
  const s = c.toDataURL('image/png'); let h = 0;
  for (let i = 0; i < s.length; i += 997) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return h;
})()`;

const openViewer = async () => {
  // Escape closes the WHOLE dialog (viewer + job inspector are one Radix
  // dialog), so reopening may need the full chain: job node → inspector →
  // enlarge → View in 3D. If the enlarge button never shows, re-click the
  // job node first.
  let card = "";
  for (let i = 0; i < 14; i++) {
    card = realClick(
      `[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Enlarge Half-map 1 (iter 1)')`,
    );
    if (card.includes("clicked@")) break;
    // inspector gone? reopen it via the canvas job node
    await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('3D Auto-Refine 1') && (x.textContent||'').includes('completed'))`,
    );
    await sleep(2200);
  }
  if (!card.includes("clicked@")) throw new Error("half-map card never appeared");
  await sleep(1500);
  // the View in 3D button only renders once the MrcImage has loaded — poll
  let v3d = "";
  for (let i = 0; i < 12; i++) {
    v3d = evalJs(
      `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('View in 3D')); b ? b.click() : 0; return b ? 'v3d-clicked' : 'V3D-WAIT'; })()`,
    );
    if (v3d.includes("v3d-clicked")) break;
    await sleep(2000);
  }
  console.log("  v3d:", v3d);
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    // agent-browser eval prints pretty-printed JSON — normalize whitespace
    // before matching (compact-substring matching silently never hits)
    const probe = evalJs(`({m: typeof window.__molstar, s: !!document.querySelector('[role=slider]')})`).replace(/\s+/g, "");
    if (probe.includes('"m":"object"') && probe.includes('"s":true')) return true;
  }
  return false;
};

const closeViewer = async () => {
  sh(`${AB} press Escape`);
  await sleep(1200);
  // dialog gone? (View in 3D button only exists inside it)
  const gone = evalJs(
    `[...document.querySelectorAll('button')].every(x => !x.textContent.trim().startsWith('View in 3D'))`,
  );
  // molstar keeps the plugin alive per mount — wait for teardown
  await sleep(1500);
  return gone.includes("true");
};

const ensurePopover = async (uiName, triggerAria) => {
  const open = evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=${uiName}]');
    if (!p) { const t = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').includes('${triggerAria}')); if (!t) return 'NO-TRIGGER'; t.click(); return 'opened'; }
    return 'was-open';
  })()`);
  await sleep(1200);
  return open;
};

const serverGet = `fetch('/api/jobs/${JID}/overlay-session').then(r => r.json()).then(j => JSON.stringify(j.entries)).catch(e => 'ERR:' + e.message)`;

const main = async () => {
  /* ---------- PHASE A: clean slate + viewer open ---------------------- */
  console.log("== PHASE A: clean slate ==");
  sh(
    `curl -s -X PUT http://localhost:3000/api/jobs/${JID}/overlay-session -H "Content-Type: application/json" -d '{"entries":[]}'`,
  );
  sh(`${AB} open http://localhost:3000`);
  await sleep(4000);
  console.log("  localStorage wipe:", evalJs(`(localStorage.removeItem('${OVERLAY_KEY}'), 'cleared')`));

  let node = "";
  for (let i = 0; i < 20 && !node.includes("clicked@"); i++) {
    node = realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('3D Auto-Refine 1') && (x.textContent||'').includes('completed'))`,
    );
    if (!node.includes("clicked@")) await sleep(2000);
  }
  if (!node.includes("clicked@")) throw new Error("job node never appeared");
  console.log("  job node:", node);
  await sleep(2200);

  const ready = await openViewer();
  console.log("  viewer ready:", ready);
  if (!ready) throw new Error("viewer not ready");
  console.log("  toasts:", evalJs(toastObserver));

  // no overlays should be active on a clean slate
  const badge = evalJs(
    `(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').startsWith('Overlay maps')); return b ? b.getAttribute('aria-label') : 'NO-LAYERS-BTN'; })()`,
  );
  console.log("  layers badge:", badge);

  /* ---------- PHASE B: turntable speed persistence -------------------- */
  console.log("== PHASE B: speed persistence ==");
  console.log("  popover:", await ensurePopover("turntable-popover", "Record a turntable video"));
  const pick = evalJs(`(() => {
    const b = document.querySelector('[data-testid=turntable-speed-5000]');
    if (!b) return 'NO-QUICK-BTN';
    b.click(); return 'quick-picked';
  })()`);
  console.log("  pick:", pick);
  await sleep(400);
  console.log(
    "  stored speed:",
    evalJs(`localStorage.getItem('cryoflow.mol-turntable-speed')`),
    "(expect 5000)",
  );
  const quickActive = evalJs(
    `document.querySelector('[data-testid=turntable-speed-5000]').getAttribute('aria-pressed')`,
  );
  console.log("  quick aria-pressed:", quickActive, "(expect true)");

  /* ---------- PHASE C: turntable recording with footer ---------------- */
  console.log("== PHASE C: record with footer ==");
  console.log("  toasts:", evalJs(toastObserver));
  console.log("  idle hash:", evalJs(canvasHash));
  // capture the canvas MediaRecorder is handed (the composite, not the GL one)
  console.log(
    "  wrap:",
    evalJs(`(() => {
      const orig = HTMLCanvasElement.prototype.captureStream;
      if (!window.__qaWrapped) {
        HTMLCanvasElement.prototype.captureStream = function (fps) { window.__qaComposite = this; return orig.call(this, fps); };
        window.__qaWrapped = true;
      }
      return 'wrapped';
    })()`),
  );
  const rec = evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Record 360'));
    if (!b) return 'NO-RECORD-BTN';
    b.click(); return 'recording';
  })()`);
  console.log("  record:", rec);
  await sleep(3500); // mid-recording: composite exists and is being painted

  const footerProbe = evalJs(`(() => {
    const cc = window.__qaComposite;
    if (!cc) return 'NO-COMPOSITE';
    const gl = [...document.querySelectorAll('canvas')].find(x => x.width > 50 && x.height > 50);
    const delta = gl ? cc.height - gl.height : -1;
    const probe = document.createElement('canvas');
    probe.width = cc.width; probe.height = cc.height;
    const pctx = probe.getContext('2d');
    pctx.drawImage(cc, 0, 0);
    const scale = cc.width / Math.max(1, gl ? gl.clientWidth || cc.width : cc.width);
    const footerH = Math.round(44 * scale);
    const strip = pctx.getImageData(0, cc.height - footerH, cc.width, footerH).data;
    let dark = 0;
    for (let i = 0; i < strip.length; i += 4) {
      if (strip[i] < 120 && strip[i + 1] < 120 && strip[i + 2] < 120) dark++;
    }
    return JSON.stringify({ composite: true, delta, scale: +scale.toFixed(3), darkTextPixels: dark });
  })()`);
  console.log("  footer probe:", footerProbe, "(delta>0 + dark pixels = footer burned in)");

  for (let i = 0; i < 16; i++) {
    await sleep(1000);
    const probe = evalJs(
      `(() => JSON.stringify({ badge: !!document.querySelector('[data-testid=turntable-rec-badge]'), obs: window.__qaToasts.length }))()`,
    );
    if (probe.includes('"badge":false') && JSON.parse(probe).obs > 0 && i > 5) break;
  }
  console.log("  toasts seen:", evalJs(`JSON.stringify(window.__qaToasts)`));
  const idleHash = evalJs(canvasHash);
  console.log("  post hash:", idleHash, "(must equal idle hash)");
  // NOTE: no Escape here — it bubbles to the Radix dialog and closes the
  // whole viewer; the turntable popover simply closes on the next click
  await sleep(800);

  /* ---------- PHASE D: overlay add → server mirror --------------------- */
  console.log("== PHASE D: overlay → server mirror ==");
  console.log("  toasts:", evalJs(toastObserver));
  console.log("  layers popover:", await ensurePopover("layers-popover", "Overlay maps"));
  const add = evalJs(`(() => {
    const b = document.querySelector('[data-testid^=map-choice-]');
    if (!b) return 'NO-CANDIDATE';
    if (b.disabled) return 'CANDIDATE-DISABLED';
    b.click(); return 'overlay-adding: ' + b.getAttribute('data-testid');
  })()`);
  console.log("  add:", add);
  await sleep(4500); // build + 900ms debounce + PUT (run5 showed 2.5s misses it)
  console.log("  server rows:", evalJs(serverGet), "(expect 1 entry)");
  const badge2 = evalJs(
    `(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').startsWith('Overlay maps')); return b ? b.getAttribute('aria-label') : 'NO-LAYERS-BTN'; })()`,
  );
  console.log("  layers badge:", badge2, "(expect 1 active)");

  /* ---------- PHASE E: cross-browser restore --------------------------- */
  console.log("== PHASE E: restore from server ==");
  if (!(await closeViewer())) console.log("  WARN: dialog may still be open");
  console.log("  wipe local:", evalJs(`(localStorage.removeItem('${OVERLAY_KEY}'), 'cleared')`));
  // observer BEFORE reopening: the restore toast fires during the mount
  // wait, before the post-open probe could ever see it
  console.log("  toasts:", evalJs(toastObserver));
  const ready2 = await openViewer();
  console.log("  viewer ready:", ready2);
  await sleep(3000); // restore path: GET server → addOverlay(s) → toast
  console.log("  toasts seen:", evalJs(`JSON.stringify(window.__qaToasts.filter(t => /Restored/.test(t.text)))`));
  const badge3 = evalJs(
    `(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').startsWith('Overlay maps')); return b ? b.getAttribute('aria-label') : 'NO-LAYERS-BTN'; })()`,
  );
  console.log("  layers badge:", badge3, "(expect 1 active — restored from SERVER)");
  console.log("  local repopulated:", evalJs(`(localStorage.getItem('${OVERLAY_KEY}')||'').slice(0, 80)`));
  // speed choice survived the reopen too
  await sleep(1200);
  console.log("  speed key still:", evalJs(`localStorage.getItem('cryoflow.mol-turntable-speed')`));

  /* ---------- PHASE F: self-heal a stale server entry ------------------ */
  console.log("== PHASE F: self-heal ==");
  if (!(await closeViewer())) console.log("  WARN: dialog may still be open");
  sh(
    `curl -s -X PUT http://localhost:3000/api/jobs/${JID}/overlay-session -H "Content-Type: application/json" -d '{"entries":[{"path":"gone_forever.mrc","name":"Phantom map","color":"#FF00FF","alpha":0.5,"sigmaOffset":0}]}'`,
  );
  console.log("  wipe local:", evalJs(`(localStorage.removeItem('${OVERLAY_KEY}'), 'cleared')`));
  console.log("  toasts:", evalJs(toastObserver));
  const ready3 = await openViewer();
  console.log("  viewer ready:", ready3);
  await sleep(3500);
  console.log(
    "  restore toasts:",
    evalJs(`JSON.stringify(window.__qaToasts.filter(t => /Restored/.test(t.text)))`),
    "(expect [] — phantom dropped)",
  );
  const badge4 = evalJs(
    `(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').startsWith('Overlay maps')); return b ? b.getAttribute('aria-label') : 'NO-LAYERS-BTN'; })()`,
  );
  console.log("  layers badge:", badge4, "(expect 0 active)");
  await sleep(1500); // empty-session PUT (deleteMany) lands
  console.log("  server after heal:", evalJs(serverGet), "(expect [] — row self-deleted)");

  console.log("== CONSOLE ==");
  sh(`${AB} errors`);
};

main().catch((e) => {
  console.error("FAILED:", e.message?.slice(0, 400));
  process.exit(1);
});
