// Task 41 QA — bookmarks become FULL views (pose + contour σ + slice + clip),
// keyboard B quick-save, overlay-session concurrent merge (API covered by
// curl; this script covers the viewer-side chains). Single browser session:
//   A  viewer open + clean slate
//   B  distinctive optics (3σ + slice on) → named bookmark → chips in row
//      + view field on the server row
//   C  move away (2σ, slice off, Front) → restore → σ text / slice pressed
//      / pose hash all return exactly
//   D  keyboard B quick-save (auto name, toast) + delete-all self-drop
// Usage: node scripts/qa41-e2e.mjs
import { execSync } from "node:child_process";

const AB = "agent-browser";
const JID = process.env.QA_JID || "cmts0qoho0003p8da75rvxycc";
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

const toastObserver = `(() => {
  window.__qaToasts = [];
  const t0 = Date.now();
  window.__qaMo && window.__qaMo.disconnect();
  window.__qaMo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/View saved|Restored|bookmark/i.test(t)) {
          window.__qaToasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 200) });
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
  return h + ' ' + c.width + 'x' + c.height;
})()`;

// σ text from the CONTOUR PANEL (scoped — bookmark chips carry σ text too)
const sigmaProbe = `(() => {
  const panel = [...document.querySelectorAll('div')].find(d => d.className?.includes?.('rounded-2xl') && d.textContent.includes('Contour'));
  if (!panel) return 'NO-PANEL';
  const m = panel.textContent.match(/([\\u2212-]?\\d+\\.\\d{2})\\s*σ/);
  return m ? m[1] : 'NO-SIGMA';
})()`;

const slicePressedProbe = `(() => {
  const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-pressed') !== null && x.textContent.trim() === 'Slice'));
  return b ? b.getAttribute('aria-pressed') : 'NO-TOGGLE';
})()`;

const serverRow = () => {
  for (let i = 0; i < 3; i++) {
    try {
      const out = sh(`curl -s --max-time 20 "http://localhost:3000/api/jobs/${JID}/camera-bookmarks"`);
      if (out.startsWith("{")) return out;
    } catch {
      /* retry */
    }
    sleep(3000);
  }
  return "CURL-FAIL";
};

const openViewer = async () => {
  let card = "";
  for (let i = 0; i < 14; i++) {
    card = realClick(
      `[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Enlarge Half-map 1 (iter 1)')`,
    );
    if (card.includes("clicked@")) break;
    await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('3D Auto-Refine 1') && (x.textContent||'').includes('completed'))`,
    );
    await sleep(2200);
  }
  if (!card.includes("clicked@")) throw new Error("half-map card never appeared");
  await sleep(1500);
  let v3d = "";
  for (let i = 0; i < 12; i++) {
    v3d = evalJs(
      `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('View in 3D')); b ? b.click() : 0; return b ? 'v3d-clicked' : 'V3D-WAIT'; })()`,
    );
    if (v3d.includes("v3d-clicked")) break;
    await sleep(2000);
  }
  console.log("  v3d:", v3d);
  for (let i = 0; i < 75; i++) {
    await sleep(2000);
    const probe = evalJs(`({m: typeof window.__molstar, s: !!document.querySelector('[role=slider]')})`).replace(/\s+/g, "");
    if (probe.includes('"m":"object"') && probe.includes('"s":true')) return true;
  }
  return false;
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

const stableHash = async (maxPolls = 15) => {
  let prev = "";
  for (let i = 0; i < maxPolls; i++) {
    await sleep(2500);
    const h = evalJs(canvasHash);
    if (h && h === prev) return h;
    prev = h;
  }
  return prev;
};

const main = async () => {
  /* ---------- PHASE A: viewer open + clean slate ----------------------- */
  console.log("== PHASE A: viewer open ==");
  sh(`curl -s -X PUT "http://localhost:3000/api/jobs/${JID}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":[]}' > /dev/null`);
  sh(`${AB} open http://localhost:3000`);
  await sleep(5000);
  evalJs(`(localStorage.removeItem('${BM_KEY}'), 'cleared')`);
  let node = "";
  for (let i = 0; i < 20 && !node.includes("clicked@"); i++) {
    node = realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('3D Auto-Refine 1') && (x.textContent||'').includes('completed'))`,
    );
    if (!node.includes("clicked@")) await sleep(2000);
  }
  if (!node.includes("clicked@")) throw new Error("job node never appeared");
  await sleep(2200);
  const ready = await openViewer();
  console.log("  viewer ready:", ready);
  if (!ready) throw new Error("viewer not ready");
  console.log("  observer:", evalJs(toastObserver));
  console.log("  sigma initial:", evalJs(sigmaProbe), "| slice initial:", evalJs(slicePressedProbe));

  /* ---------- PHASE B: save a FULL view (3σ + slice) -------------------- */
  console.log("== PHASE B: save full view ==");
  console.log("  3σ click:", evalJs(
    `(() => { const b=[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Set contour to 3 sigma'); b?b.click():0; return b?'ok':'NO-BTN'; })()`,
  ));
  await sleep(2500);
  console.log("  slice toggle:", evalJs(
    `(() => { const b=[...document.querySelectorAll('button')].find(x => (x.title||'').startsWith('Show a cross-section')); b?b.click():0; return b?'ok':'NO-BTN'; })()`,
  ));
  await sleep(3000);
  console.log("  sigma now:", evalJs(sigmaProbe), "| slice now:", evalJs(slicePressedProbe));
  sh(`${AB} press 5`); // Top pose
  const hTop = await stableHash();
  console.log("  top hash (settled):", hTop);

  console.log("  popover:", await ensurePopover("camera-bookmarks", "bookmarks"));
  const nameInput = evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    if (!p) return 'NO-POPOVER';
    const inp = p.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'Full optics');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'named';
  })()`);
  console.log("  name:", nameInput);
  console.log("  save:", await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => b.textContent.trim().startsWith('Save'))`,
  ));
  await sleep(1500);
  const chips = evalJs(`(() => {
    const row = [...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => (b.title||'').includes('Fly back'));
    return row ? row.textContent.replace(/\\s+/g, ' ').slice(0, 140) : 'NO-ROW';
  })()`);
  console.log("  row text (chips):", chips);
  await sleep(2000);
  const srvRaw = serverRow();
  if (srvRaw === "CURL-FAIL") throw new Error("server unreachable after save");
  const srv = JSON.parse(srvRaw);
  console.log("  server view field:", JSON.stringify(srv.bookmarks[0]?.view ?? null));
  await realClick(`document.querySelector('[role=slider]')`);
  await sleep(600);

  /* ---------- PHASE C: move away, then fly back ------------------------- */
  console.log("== PHASE C: restore full view ==");
  console.log("  2σ click:", evalJs(
    `(() => { const b=[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Set contour to 2 sigma'); b?b.click():0; return b?'ok':'NO-BTN'; })()`,
  ));
  await sleep(2000);
  console.log("  slice off:", evalJs(
    `(() => { const b=[...document.querySelectorAll('button')].find(x => (x.title||'').startsWith('Hide the cross-section')); b?b.click():0; return b?'ok':'NO-BTN'; })()`,
  ));
  await sleep(2000);
  console.log("  moved away — sigma:", evalJs(sigmaProbe), "| slice:", evalJs(slicePressedProbe));
  sh(`${AB} press 1`); // Front pose
  const hFront = await stableHash();
  console.log("  front hash (settled):", hFront);

  console.log("  popover(2):", await ensurePopover("camera-bookmarks", "bookmarks"));
  console.log("  restore click:", await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => (b.title||'').includes('Fly back'))`,
  ));
  const hBack = await stableHash();
  console.log("  back hash:", hBack, "| pose restored:", hBack.split(" ")[0] === hTop.split(" ")[0]);
  // optics settle through their own pumps — give them a beat, then probe
  await sleep(3000);
  console.log("  after restore — sigma:", evalJs(sigmaProbe), "| slice:", evalJs(slicePressedProbe));
  await realClick(`document.querySelector('[role=slider]')`);
  await sleep(600);

  /* ---------- PHASE D: keyboard B quick-save + cleanup ------------------ */
  console.log("== PHASE D: B key ==");
  console.log("  observer(2):", evalJs(toastObserver));
  sh(`${AB} press b`);
  await sleep(1500);
  console.log("  toasts:", evalJs(`(window.__qaToasts||[]).map(t=>t.text).join(' | ') || 'NONE'`));
  console.log("  popover(3):", await ensurePopover("camera-bookmarks", "bookmarks"));
  const rows = evalJs(`document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button[title^="Fly back"]').length`);
  console.log("  bookmark rows:", rows);
  console.log("  delete all:", evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const xs = [...p.querySelectorAll('button')].filter(b => (b.getAttribute('aria-label')||'').startsWith('Delete bookmark'));
    xs.forEach(x => x.click());
    return 'deleted ' + xs.length;
  })()`));
  await sleep(2500);
  const srvEnd = serverRow();
  console.log("  server after delete-all:", srvEnd);
  console.log("  errors:", sh(`${AB} errors`) || "(none)");
  console.log("DONE");
};

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
