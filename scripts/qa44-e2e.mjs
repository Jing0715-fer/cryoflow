// Task 44 QA — single browser session:
//   A  viewer open + regression probes (canvas / corner keys / sliders)
//   B  duplicate-name UX: save "Beta" (clean toast) → type "beta " (case/space
//      dupe) → live amber hint #bm-name-dupe-hint + aria-invalid → save →
//      amber "already exists" toast; inline rename to a dup name → same toast;
//      clear input → hint resets
//   C  overlay PUT chain functional regression: add overlay via Layers panel →
//      debounced PUT lands (server row = 1 entry) → remove → row empties and
//      STAYS empty (no phantom resurrect after extra wait)
//   D  console errors + screenshot + cleanup (server rows emptied)
// Usage: node scripts/qa44-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa44-trace.log", import.meta.url).pathname;
const step = (m) => {
  const line = `[${(Date.now() / 1000).toFixed(0)}] ${m}`;
  try { appendFileSync(LOGF, line + "\n"); } catch { /* ignore */ }
  console.log(m);
};
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => { step(`SIGNAL ${sig} — dying`); process.exit(1); });
}
process.on("exit", (c) => step(`exit code=${c}`));
process.on("uncaughtException", (e) => { step(`uncaught: ${e.message}`); process.exit(2); });
process.on("unhandledRejection", (e) => { step(`unhandledRejection: ${e}`); process.exit(3); });

const JID = process.env.QA_JID || "cmts0qoho0003p8da75rvxycc";
const BM_KEY = `cryoflow.mol-camera-bookmarks:${JID}`;
const OV_KEY = `cryoflow.mol-overlays:${JID}`;
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 90_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");

const realClick = async (findExpr) => {
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
step("helpers ready");

// covers every toast this suite produces (incl. the amber dup toast)
const toastObserver = `(() => {
  window.__qaToasts = [];
  const t0 = Date.now();
  window.__qaMo && window.__qaMo.disconnect();
  window.__qaMo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/View saved|View renamed|already exists/i.test(t)) {
          window.__qaToasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 200) });
        }
      }
    }
  });
  window.__qaMo.observe(document.body, { childList: true, subtree: true });
  return 'observer-on';
})()`;
const lastToasts = (n = 2) => unq(evalJs(`(window.__qaToasts||[]).slice(-${n}).map(t=>t.text).join(' | ') || 'NONE'`));

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
    card = await realClick(
      `[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Enlarge Half-map 1 (iter 1)')`,
    );
    if (card.includes("clicked@")) break;
    await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('3D Auto-Refine 1') && (x.textContent||'').includes('completed'))`,
    );
    step(`  openViewer iter ${i}: enlarge=${card.slice(0, 24)}`);
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
  step(`  v3d: ${v3d}`);
  for (let i = 0; i < 75; i++) {
    await sleep(2000);
    const probe = evalJs(`({m: typeof window.__molstar, s: !!document.querySelector('[role=slider]')})`).replace(/\s+/g, "");
    if (i % 10 === 9) step(`  ready-wait ${i}: ${probe.slice(0, 50)}`);
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

const bmNames = () => {
  const raw = sh(`curl -s --max-time 20 "http://localhost:3000/api/jobs/${JID}/camera-bookmarks"`);
  try { return JSON.parse(raw).bookmarks.map((b) => b.name); } catch { return ["CURL-FAIL"]; }
};
const ovEntries = () => {
  const raw = sh(`curl -s --max-time 20 "http://localhost:3000/api/jobs/${JID}/overlay-session"`);
  try { return JSON.parse(raw).entries ?? []; } catch { return ["CURL-FAIL"]; }
};
const putBm = (list) =>
  sh(`curl -s -X PUT "http://localhost:3000/api/jobs/${JID}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":${JSON.stringify(list)}}' > /dev/null`);

/** PHASE A — open + regression */
const phaseA = async () => {
  step("== PHASE A: viewer open ==");
  putBm([]);
  sh(`${AB} open http://localhost:3000`);
  await sleep(5000);
  evalJs(`(localStorage.removeItem('${BM_KEY}'), localStorage.removeItem('${OV_KEY}'), 'cleared')`);
  let node = "";
  for (let i = 0; i < 20 && !node.includes("clicked@"); i++) {
    node = await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('3D Auto-Refine 1') && (x.textContent||'').includes('completed'))`,
    );
    if (!node.includes("clicked@")) await sleep(2000);
  }
  if (!node.includes("clicked@")) throw new Error("job node never appeared");
  await sleep(2200);
  const ready = await openViewer();
  step(`  viewer ready: ${ready}`);
  if (!ready) throw new Error("viewer not ready");
  const h = unq(evalJs(canvasHash));
  const keys = unq(evalJs(`document.querySelectorAll('[data-canvas-ui] button').length + ' corner-btns / ' + document.querySelectorAll('[role=slider]').length + ' sliders'`));
  step(`  canvas: ${h.split(" ")[1] ?? h} | ui: ${keys}`);
  if (!h.includes("x")) throw new Error("no volume canvas mounted");
  console.log("  observer:", evalJs(toastObserver));
};

/** PHASE B — duplicate-name UX */
const phaseB = async () => {
  console.log("== PHASE B: duplicate-name UX ==");
  await ensurePopover("camera-bookmarks", "bookmarks");
  const type = (txt) => evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const inp = p && p.querySelector('input[maxlength="40"]');
    if (!inp) return 'NO-INPUT';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, ${JSON.stringify(txt)});
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'typed';
  })()`);

  // B1 clean save — "Beta" is new
  if (unq(type("Beta")) !== "typed") throw new Error("name input missing");
  await sleep(300);
  const hint0 = evalJs(`(!!document.getElementById('bm-name-dupe-hint') + '')`);
  step(`  B1 clean-name hint: ${hint0} (expect false)`);
  if (hint0 === "true") throw new Error("dupe hint fired for a fresh name");
  evalJs(`(() => { const p = document.querySelector('[data-canvas-ui=camera-bookmarks]'); const b=[...p.querySelectorAll('button')].find(x=>x.textContent.trim()==='Save'); b.click(); return 'saved'; })()`);
  await sleep(1200);
  const t1 = lastToasts(1);
  step(`  B1 toast: ${t1}`);
  if (!/View saved/.test(t1)) throw new Error(`expected "View saved", got ${t1}`);

  // B2 dupe while typing — "beta " (case-insensitive + trailing space)
  type("beta ");
  await sleep(400);
  const probe = JSON.parse(unq(evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const inp = p.querySelector('input[maxlength="40"]');
    const hint = document.getElementById('bm-name-dupe-hint');
    return { hint: !!hint, hintAmber: hint ? /amber/.test(hint.className) : false,
             hintText: hint ? hint.textContent.replace(/\\s+/g,' ').trim() : '',
             invalid: inp.getAttribute('aria-invalid') };
  })()`)));
  step(`  B2 typing-dupe: ${JSON.stringify(probe)}`);
  if (!probe.hint || !probe.hintAmber || probe.invalid !== "true") throw new Error("live dupe hint failed");
  if (!/already in the list/.test(probe.hintText)) throw new Error("hint text wrong");

  // B3 dupe save → amber toast, still saves
  evalJs(`(() => { const p = document.querySelector('[data-canvas-ui=camera-bookmarks]'); const b=[...p.querySelectorAll('button')].find(x=>x.textContent.trim()==='Save'); b.click(); return 'saved'; })()`);
  await sleep(1200);
  const t3 = lastToasts(1);
  step(`  B3 toast: ${t3}`);
  if (!/already exists/.test(t3)) throw new Error(`expected amber dup toast, got ${t3}`);
  const names3 = bmNames();
  step(`  B3 server names: ${JSON.stringify(names3)}`);
  if (!(names3.filter((n) => n === "beta").length === 2 || names3.filter((n) => n.toLowerCase() === "beta").length === 2))
    throw new Error(`expected 2×Beta on server, got ${JSON.stringify(names3)}`);

  // B4 hint resets when the input clears
  type("");
  await sleep(300);
  const hint4 = evalJs(`(!!document.getElementById('bm-name-dupe-hint') + '')`);
  step(`  B4 cleared hint: ${hint4} (expect false)`);
  if (hint4 === "true") throw new Error("dupe hint did not reset");

  // B5 inline rename to a dup name → amber toast, rename commits
  evalJs(`(() => { const p = document.querySelector('[data-canvas-ui=camera-bookmarks]'); const b = p.querySelector('button[aria-label="Rename bookmark Beta"]'); if (!b) return 'NO-PENCIL'; b.click(); return 'pencil'; })()`);
  await sleep(500);
  evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const inp = p.querySelector('input[maxlength="40"]:not([placeholder])') || [...p.querySelectorAll('input')].find(i => i.value === 'Beta');
    if (!inp) return 'NO-REN-INPUT';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'beta'); // same as the OTHER row → dup
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ren-typed';
  })()`);
  evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const inp = [...p.querySelectorAll('input')].find(i => i.value === 'beta');
    if (!inp) return 'NO-FOCUS';
    inp.focus();
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    inp.blur();
    return 'ren-committed';
  })()`);
  await sleep(1400);
  const t5 = lastToasts(2);
  step(`  B5 toasts: ${t5}`);
  if (!/already exists/.test(t5)) throw new Error(`expected amber dup toast on rename, got ${t5}`);
  const names5 = bmNames();
  step(`  B5 server names: ${JSON.stringify(names5)}`);
  if (!names5.every((n) => n.toLowerCase() === "beta")) throw new Error(`rename did not land: ${JSON.stringify(names5)}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa44-dup-hint.png`);
  step("  screenshot saved");
};

/** PHASE C — overlay PUT chain functional regression */
const phaseC = async () => {
  console.log("== PHASE C: overlay PUT chain ==");
  const base = ovEntries();
  step(`  baseline entries: ${JSON.stringify(base)}`);
  if (JSON.stringify(base) !== "[]") throw new Error(`overlay row not clean: ${JSON.stringify(base)}`);

  const openP = await ensurePopover("layers-popover", "Overlay maps");
  step(`  layers popover: ${openP}`);
  const pick = unq(evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=layers-popover]');
    const b = p && p.querySelector('button[data-testid^=map-choice-]:not([disabled])');
    if (!b) return 'NO-CHOICE';
    b.click(); return b.getAttribute('data-testid');
  })()`));
  step(`  picked: ${pick}`);
  if (pick === "NO-CHOICE") throw new Error("no addable map choice");

  // row appears + debounced PUT (900ms) lands
  let row = "";
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    row = unq(evalJs(`(!!document.querySelector('[data-testid^=overlay-row-]') + '')`));
    if (row === "true") break;
  }
  if (row !== "true") throw new Error("overlay row never appeared");
  await sleep(1600); // 900ms debounce + transport
  const e1 = ovEntries();
  step(`  after add: ${JSON.stringify(e1.map((x) => x.path))}`);
  if (e1.length !== 1) throw new Error(`expected 1 server entry, got ${e1.length}`);

  // remove → tombstoned merge flush → row empties and STAYS empty
  evalJs(`(() => {
    const b = document.querySelector('button[aria-label^="Remove overlay"]');
    if (!b) return 'NO-REMOVE'; b.click(); return 'removed';
  })()`);
  await sleep(1600);
  const e2 = ovEntries();
  await sleep(2000); // phantom-resurrect watch: a late out-of-order PUT would repopulate
  const e3 = ovEntries();
  step(`  after remove: ${JSON.stringify(e2.map((x) => x.path))} | +2s: ${JSON.stringify(e3.map((x) => x.path))}`);
  if (e2.length !== 0 || e3.length !== 0) throw new Error(`overlay remove did not stick: ${JSON.stringify(e2)} → ${JSON.stringify(e3)}`);
  sh(`${AB} screenshot /home/z/my-project/qa44-overlay.png`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa44-overlay.png`);
  step("  screenshot saved");
};

/** PHASE D — console + cleanup */
const phaseD = async () => {
  console.log("== PHASE D: console + cleanup ==");
  const errs = unq(evalJs(`(window.__qaErrors || []).join(' || ') || 'NONE'`));
  step(`  console errors: ${errs}`);
  if (errs !== "NONE") throw new Error("console errors present");
  // cleanup: empty both server rows + local mirrors
  putBm([]);
  sh(`curl -s -X PUT "http://localhost:3000/api/jobs/${JID}/overlay-session" -H "Content-Type: application/json" -d '{"entries":[],"mode":"replace"}' > /dev/null`);
  evalJs(`(localStorage.removeItem('${BM_KEY}'), localStorage.removeItem('${OV_KEY}'), 'cleared')`);
  step(`  cleanup: bm=${JSON.stringify(bmNames())} ov=${JSON.stringify(ovEntries())}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa44-final.png`);
};

const consoleWatch = `(() => {
  window.__qaErrors = window.__qaErrors || [];
  if (!window.__qaErrHook) {
    window.__qaErrHook = true;
    const orig = console.error;
    console.error = (...a) => { window.__qaErrors.push(String(a[0]).slice(0, 160)); orig(...a); };
    window.addEventListener('error', (e) => window.__qaErrors.push('window: ' + String(e.message).slice(0, 140)));
  }
  return 'watch-on';
})()`;

(async () => {
  await phaseA();
  evalJs(consoleWatch);
  await phaseB();
  await phaseC();
  await phaseD();
  step("ALL PHASES GREEN");
})().catch((e) => {
  step(`FATAL: ${e.message}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa44-fatal.png`);
  process.exit(1);
});
