// Task 40 QA — bookmark cloud sync + contact-sheet thumbnails + Recent feed
// live progress bars. Single browser session, five phases:
//   A  viewer open (real-input click chain, inherited from qa37-39)
//   B  bookmark save WITH thumbnail: toast + localStorage thumb + <img> row
//      + server row (curl) carries the thumb
//   C  cross-session restore: wipe localStorage, reopen viewer →
//      "Restored 1 view bookmark" toast + thumb from server + pose hash
//      flies back exactly (steady-state hashing, qa39 lesson)
//   D  delete: X button → server row self-drops (empty PUT semantics)
//   E  dashboard feed: mocked running job → 3px progress bar + % + 4 s poll
// Usage: node scripts/qa40-e2e.mjs
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
        if (/Restored|View saved|bookmark/i.test(t)) {
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

const serverRow = () => {
  try {
    return sh(`curl -s --max-time 20 "http://localhost:3000/api/jobs/${JID}/camera-bookmarks"`);
  } catch {
    return "CURL-FAIL";
  }
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
    const probe = evalJs(`({m: typeof window.__molstar, s: !!document.querySelector('[role=slider]'), c: document.querySelectorAll('canvas').length})`).replace(/\s+/g, "");
    if (i % 5 === 4) console.log("   poll", i, probe);
    if (probe.includes('"m":"object"') && probe.includes('"s":true')) return true;
  }
  return false;
};

const closeViewer = async () => {
  evalJs(`(() => { const dlgs=[...document.querySelectorAll('[data-slot=dialog-content]')]; const dlg=dlgs[dlgs.length-1]; const b=[...dlg.querySelectorAll('button')].find(x=>x.textContent.trim()==='Close'); b?b.click():0; return b?'closing':'NO-CLOSE'; })()`);
  await sleep(900);
  // the inspector dialog may remain — close it too, then the slice dialog
  for (let i = 0; i < 4; i++) {
    const n = evalJs(`document.querySelectorAll('[data-slot=dialog-content]').length`);
    if (n === "0") return "all-closed";
    evalJs(`(() => { const dlgs=[...document.querySelectorAll('[data-slot=dialog-content]')]; const dlg=dlgs[dlgs.length-1]; const b=[...dlg.querySelectorAll('button')].find(x=>x.textContent.trim()==='Close'||(x.getAttribute('aria-label')||'')==='Close'); b?b.click():0; return 'x'; })()`);
    await sleep(900);
  }
  return "closed-with-effort";
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
  // headless SwiftShader renders at a few fps — 320 ms camera transitions
  // take seconds of wall time (qa39 lesson). Poll until two consecutive
  // hashes agree, then return the settled value.
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
  await sleep(4500);
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
  console.log("  toasts:", evalJs(toastObserver));

  /* ---------- PHASE B: save bookmark with thumbnail -------------------- */
  console.log("== PHASE B: bookmark + thumbnail ==");
  sh(`${AB} press 5`); // Top view — a defined pose
  const hTop = await stableHash();
  console.log("  top hash (settled):", hTop);

  console.log("  popover:", await ensurePopover("camera-bookmarks", "bookmarks"));
  const nameInput = evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    if (!p) return 'NO-POPOVER';
    const inp = p.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'QA channel axis');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'named';
  })()`);
  console.log("  name:", nameInput);
  console.log("  save:", await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => b.textContent.trim().startsWith('Save'))`,
  ));
  await sleep(1200);
  console.log("  toasts:", evalJs(`(window.__qaToasts||[]).map(t=>t.text).join(' | ') || 'NONE'`));

  const local = evalJs(`(() => { const l = JSON.parse(localStorage.getItem('${BM_KEY}')||'[]'); return { n: l.length, thumb: l[0]?.thumb?.slice(0,40) ?? null, name: l[0]?.name ?? null }; })()`);
  console.log("  localStorage:", local);
  const rowImg = evalJs(`(() => { const p = document.querySelector('[data-canvas-ui=camera-bookmarks]'); const img = p && p.querySelector('img'); return img ? { src: img.src.slice(0, 30), w: img.width, h: img.height } : 'NO-IMG'; })()`);
  console.log("  popover row <img>:", rowImg);
  await sleep(800);
  const srv = serverRow();
  const srvParsed = JSON.parse(srv);
  console.log("  server row:", { n: srvParsed.bookmarks.length, name: srvParsed.bookmarks[0]?.name, hasThumb: typeof srvParsed.bookmarks[0]?.thumb === "string" && srvParsed.bookmarks[0].thumb.startsWith("data:image/jpeg") });
  await realClick(`document.querySelector('[role=slider]')`); // dismiss popover
  await sleep(600);

  /* ---------- PHASE C: cross-session restore --------------------------- */
  console.log("== PHASE C: cross-session restore ==");
  console.log("  close:", await closeViewer());
  await sleep(1200);
  console.log("  wipe local:", evalJs(`(localStorage.removeItem('${BM_KEY}'), 'wiped')`));
  console.log("  observer:", evalJs(toastObserver)); // BEFORE reopen — toast fires in mount window
  const ready2 = await openViewer();
  console.log("  viewer ready(2):", ready2);
  if (!ready2) throw new Error("viewer not ready(2)");
  await sleep(1500);
  console.log("  toasts(2):", evalJs(`(window.__qaToasts||[]).map(t=>t.text).join(' | ') || 'NONE'`));
  const local2 = evalJs(`(() => { const l = JSON.parse(localStorage.getItem('${BM_KEY}')||'[]'); return { n: l.length, thumb: l[0]?.thumb?.slice(0,30) ?? null }; })()`);
  console.log("  localStorage rebuilt:", local2);

  // pose fidelity: swing to Front (settled), then fly back via the bookmark
  sh(`${AB} press 1`);
  const hFront = await stableHash();
  console.log("  front hash (settled):", hFront);
  console.log("  popover(2):", await ensurePopover("camera-bookmarks", "bookmarks"));
  console.log("  restore click:", await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => (b.title||'').includes('Fly back to'))`,
  ));
  const hBack = await stableHash();
  console.log("  back hash (settled):", hBack, "| restored==top:", hBack.split(" ")[0] === hTop.split(" ")[0]);
  await realClick(`document.querySelector('[role=slider]')`);
  await sleep(600);

  /* ---------- PHASE D: delete → server row self-drops ------------------ */
  console.log("== PHASE D: delete ==");
  console.log("  popover(3):", await ensurePopover("camera-bookmarks", "bookmarks"));
  console.log("  delete:", evalJs(`(() => { const p = document.querySelector('[data-canvas-ui=camera-bookmarks]'); const x = p && [...p.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').startsWith('Delete bookmark')); x?x.click():0; return x?'deleted':'NO-X'; })()`));
  await sleep(1500);
  const srv2 = serverRow();
  const local3 = evalJs(`(() => { const l = JSON.parse(localStorage.getItem('${BM_KEY}')||'[]'); return l.length; })()`);
  console.log("  server after delete:", srv2, "| local:", local3);

  /* ---------- PHASE E: dashboard feed progress bar (mocked) ------------ */
  console.log("== PHASE E: feed progress ==");
  console.log("  close viewer:", await closeViewer());
  // mock: one running job at 42% + real completed row shape
  const mock = JSON.stringify({
    jobs: [
      { id: "mock-run-1", name: "Mock CTF (running)", type: "ctffind", status: "running", progress: 0.42, updatedAt: new Date().toISOString(), projectId: null, projectName: null },
      { id: "mock-done-1", name: "Mock Refine (done)", type: "refine3d", status: "completed", progress: 1, updatedAt: new Date().toISOString(), projectId: null, projectName: null },
    ],
  });
  sh(`${AB} network route "http://localhost:3000/api/activity/recent?limit=8" --body '${mock.replace(/'/g, "'\\''")}'`);
  sh(`${AB} open http://localhost:3000`);
  await sleep(4500);
  evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Dashboard'); b?b.click():0; return 'nav'; })()`);
  await sleep(2200);
  const feed = evalJs(`(() => {
    const sec = document.querySelector('section[aria-label*="Recent activity"]');
    if (!sec) return 'NO-FEED';
    const rows = [...sec.querySelectorAll('button')];
    const bar = sec.querySelector('.progress-shimmer');
    const pct = [...sec.querySelectorAll('span')].map(s => s.textContent).find(t => /^\\d+%$/.test(t || ''));
    return { rows: rows.length, hasBar: !!bar, barWidth: bar ? bar.style.width : null, pctLabel: pct ?? null, running: sec.textContent.includes('Running') || sec.textContent.includes('running') };
  })()`);
  console.log("  feed:", feed);
  await sleep(5000);
  const polls = sh(`${AB} network requests --filter activity/recent`).split("\n").filter((l) => l.includes("recent")).length;
  console.log("  recent requests seen (initial+polls):", polls);
  sh(`${AB} network unroute`);
  sh(`${AB} open http://localhost:3000`);
  await sleep(2500);
  console.log("  errors:", sh(`${AB} errors`) || "(none)");
  console.log("DONE");
};

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
