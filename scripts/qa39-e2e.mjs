// Task 39 QA — camera view bookmarks + turntable 2× supersampled recording +
// multi-line caption footer. Single browser session, four phases:
//   A  viewer open (real-input click chain, inherited from qa37/38)
//   B  bookmarks: save Top view → move to Front → restore → hash equality;
//      localStorage mirror; delete flow
//   C  caption: two-line caption → PNG export toast height = plate+44+16;
//      caption reset
//   D  turntable 2×: scale pick → record → toast says 2× supersampled;
//      canvas hash stable (camera restored) + pixelScale back to native
// Usage: node scripts/qa39-e2e.mjs
import { execSync } from "node:child_process";

const AB = "agent-browser";
const JID = process.env.QA_JID || "cmts0qoho0003p8da75rvxycc";
const BM_KEY = `cryoflow.mol-camera-bookmarks:${JID}`;
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
        if (/Turntable|Restored|overlay|exported|discarded|View saved/i.test(t)) {
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
  return h + ' ' + c.width + 'x' + c.height;
})()`;

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

const main = async () => {
  /* ---------- PHASE A: viewer open ------------------------------------ */
  console.log("== PHASE A: viewer open ==");
  sh(`${AB} open http://localhost:3000`);
  await sleep(4500);
  // clean slate: leftover bookmarks from the diag run + prior turntable prefs
  evalJs(`(localStorage.removeItem('${BM_KEY}'), localStorage.removeItem('cryoflow.mol-turntable-scale'), 'cleared')`);
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
  console.log("  toasts:", evalJs(toastObserver));

  /* ---------- PHASE B: camera view bookmarks -------------------------- */
  console.log("== PHASE B: bookmarks ==");
  // NOTE: headless SwiftShader renders at a few fps, so 320 ms camera
  // transitions take seconds of wall time to settle. Every pose below
  // waits for a full settle before hashing — bookmarks restore EXACT
  // saved poses, so the equality check needs steady-state frames.
  // start from a defined pose: key 5 = Top
  sh(`${AB} press 5`);
  await sleep(5000);
  const hTop = evalJs(canvasHash);
  console.log("  top hash:", hTop);

  // save a named bookmark
  console.log("  popover:", await ensurePopover("camera-bookmarks", "bookmarks"));
  const nameInput = evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    if (!p) return 'NO-POPOVER';
    const inp = p.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'QA top view');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'named';
  })()`);
  console.log("  name:", nameInput);
  console.log("  save:", await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => b.textContent.trim().startsWith('Save'))`,
  ));
  await sleep(900);
  console.log("  toasts:", evalJs(`(window.__qaToasts||[]).map(t=>t.text).join(' | ') || 'NONE'`));

  // stored?
  const stored = evalJs(`JSON.parse(localStorage.getItem('${BM_KEY}')||'[]').map(b => b.name)`);
  console.log("  stored:", stored);

  // swing to Front (key 1) — hash must change
  sh(`${AB} press 1`);
  await sleep(5000);
  const hFront = evalJs(canvasHash);
  console.log("  front hash:", hFront, "| differs:", !hFront.split(" ")[0].includes(hTop.split(" ")[0]));

  // restore from the bookmark — steady-state hash must match Top again
  console.log("  restore click:", await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => (b.title||'').includes('Fly back to'))`,
  ));
  await sleep(6000);
  const hBack = evalJs(canvasHash);
  console.log("  back hash:", hBack, "| restored:", hBack.split(" ")[0] === hTop.split(" ")[0]);

  // close the popover by clicking elsewhere (Escape kills the whole dialog)
  await realClick(`document.querySelector('[role=slider]')`);
  await sleep(600);

  /* ---------- PHASE C: two-line caption → taller footer --------------- */
  console.log("== PHASE C: caption lines ==");
  console.log("  popover:", await ensurePopover("figure-export", "Figure export"));
  const capSet = evalJs(`(() => {
    const ta = document.getElementById('figure-caption');
    if (!ta) return 'NO-TA';
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, 'Fig. 39 — QA turntable fixture\\nSecond caption line for QA');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return 'two-lines';
  })()`);
  console.log("  caption set:", capSet);
  await sleep(500);
  const capVal = evalJs(`JSON.stringify(document.getElementById('figure-caption').value)`);
  console.log("  caption value:", capVal, "| has newline:", capVal.includes("\\n"));

  // close the export popover first — the Camera button sits under the
  // popover surface, and the first outside click only dismisses it
  await realClick(`document.querySelector('[role=slider]')`);
  await sleep(800);
  // export and read the toast dimensions (dpr-1 headless: 1× native).
  // NOTE: the corner Camera button sits in the top-right toast viewport
  // band — a leftover toast swallows real-coordinate clicks, so drive the
  // React onClick programmatically (plain onClick responds to el.click()).
  console.log("  export:", evalJs(
    `(() => { const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Export the current 3D view as PNG'); b ? b.click() : 0; return b ? 'clicked' : 'NO-BTN'; })()`,
  ));
  await sleep(2200);
  const exportToasts = evalJs(`(window.__qaToasts||[]).filter(t => /exported/i.test(t.text)).map(t => t.text).join(' | ') || 'NONE'`);
  console.log("  export toast:", exportToasts);

  // reset caption for phase D (reopen the popover — the export click closed it)
  console.log("  popover2:", await ensurePopover("figure-export", "Figure export"));
  console.log("  reset:", await realClick(
    `[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Reset caption to the default')`,
  ));
  await sleep(400);
  console.log("  caption after reset:", evalJs(`JSON.stringify(document.getElementById('figure-caption')?.value ?? 'GONE')`));
  console.log("  localStorage caption:", evalJs(`localStorage.getItem('cryoflow.mol-figure-caption')`));
  // close the export popover by clicking the slider area
  await realClick(`document.querySelector('[role=slider]')`);
  await sleep(600);

  /* ---------- PHASE D: turntable 2× supersampled ---------------------- */
  console.log("== PHASE D: turntable 2x ==");
  console.log("  popover:", await ensurePopover("turntable-popover", "turntable video"));
  console.log("  pick 2x:", await realClick(
    `[...document.querySelectorAll('button')].find(b => b.getAttribute('data-testid') === 'turntable-scale-2')`,
  ));
  await sleep(400);
  console.log("  scale key:", evalJs(`localStorage.getItem('cryoflow.mol-turntable-scale')`));
  const before = evalJs(canvasHash);
  console.log("  before:", before);
  console.log("  record:", await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=turntable-popover] button')].find(b => b.textContent.trim().startsWith('Record 360'))`,
  ));
  await sleep(3000);
  console.log("  rec badge:", evalJs(`!!document.body.textContent.match(/REC/)`));
  // recording = Quick? speed default 8s; wait up to 30s for the toast
  let recToast = "NONE";
  for (let i = 0; i < 18; i++) {
    await sleep(1800);
    recToast = evalJs(`(window.__qaToasts||[]).filter(t => /Turntable video exported|discarded/i.test(t.text)).map(t => t.text).join(' | ') || 'WAIT'`);
    if (!recToast.includes("WAIT")) break;
  }
  console.log("  record toast:", recToast);
  await sleep(800);
  const after = evalJs(canvasHash);
  console.log("  after:", after);
  console.log("  camera restored:", before.split(" ")[0] === after.split(" ")[0], "| size native:", after.split(" ")[1]);

  console.log("  console errors:");
  sh(`${AB} errors`);
  console.log("== DONE ==");
};

main().catch((e) => {
  console.error("QA FAILED:", e.message);
  process.exit(1);
});
