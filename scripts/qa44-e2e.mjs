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

const JID = process.env.QA_JID || (() => {
  // resolve job id by NAME — the hardcoded fixture id died with the old
  // DB (qa53 lesson: ids drift across seeds, names survive; restore
  // the sandbox with scripts/restore-gallery.py when missing)
  const raw = execSync(`curl -s --max-time 20 "http://localhost:3000/api/jobs"`,
    { encoding: "utf8", timeout: 60_000 });
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : parsed.jobs ?? [];
  const j = arr.find((x) => x.name === "QA Refine3D" && x.status === "completed");
  if (!j) throw new Error('host job "QA Refine3D" (completed) not found — run scripts/restore-gallery.py first');
  return j.id;
})();
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
  // modern entry chain, all-atomic edition: CLI `click` resolves the rect
  // and clicks in one step (realClick's measure-then-move window let the
  // canvas settle onto a stale point → deselect → inspector self-close
  // flap); inside the Radix modal, programmatic .click() drives the
  // handlers with zero coordinates. orthovol.mrc is self-seeded (qa67
  // seeder, QA_VOL_HOST selects the refine3d sandbox).
  sh(`QA_VOL_HOST="QA Refine3D" python3 /home/z/my-project/scripts/qa67-seed-volume.py >/dev/null 2>&1 || true; python3 /home/z/my-project/scripts/seed-refine-halves.py >/dev/null 2>&1 || true`);
  // world reset: a fresh load guarantees no stale modal overlaying the nav
  // (a leftover inspector from a prior phase covers everything otherwise)
  // the CLI JSON-encodes eval output — a bare `true` comes back as `"true"`
  // (the unq() lesson from qa54/qa68); compare through this helper
  const truthy = (s) => String(s).replace(/^"|"$/g, "") === "true";
  const pollClose = async (n) => {
    for (let c = 0; c < n; c++) {
      const anyDialog = truthy(evalJs(`String(!!document.querySelector('[role=dialog]'))`));
      if (!anyDialog) return true;
      evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Close inspector'); b ? b.click() : 0; return 'done'; })()`);
      await sleep(1500);
    }
    return !truthy(evalJs(`String(!!document.querySelector('[role=dialog]'))`));
  };
  // phase A may have left the inspector open (its card click opens it) —
  // close BEFORE navigating, so the nav is reachable either way
  await pollClose(4);
  // navigate; `open` may no-op on the same URL — verify the generation via
  // performance.timeOrigin and force location.reload() when unchanged
  const before = evalJs(`String(performance.timeOrigin)`);
  sh(`${AB} errors --clear >/dev/null 2>&1 || true`);
  sh(`${AB} open http://localhost:3000`);
  await sleep(2500);
  if (evalJs(`String(performance.timeOrigin)`) === before) {
    evalJs(`location.reload(); 'reloading'`);
    await sleep(2500);
  }
  // wait for the app's DATA LOAD to land (cards render) — modal restore
  // timing rides on the same load, so only now does "no dialog" mean it
  let loaded = false;
  for (let c = 0; c < 20 && !loaded; c++) {
    loaded = truthy(evalJs(`String([...document.querySelectorAll('[role=button]')].some(x => (x.textContent||'').includes('QA Refine3D')))`,));
    if (!loaded) await sleep(1500);
  }
  await pollClose(10);
  // the world-reset reload wiped the suite's toast observer — re-arm it
  // BEFORE any restore path can fire (the pending-view restore lands as
  // soon as the bookmark list loads, possibly before Mol* is ready)
  evalJs(toastObserver);
  await sleep(800);
  const cliClick = (sel) => {
    try { sh(`${AB} click '${sel}'`); return true; } catch { return false; }
  };
  const resultsTab = `(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>x.textContent.trim()==='Results'); t ? t.click() : 0; return t ? 'tab' : 'NO-TAB'; })()`;
  for (let i = 0; i < 8; i++) {
    const hasInspector = truthy(evalJs(`String([...document.querySelectorAll('[role=tab]')].some(t => t.textContent.trim() === 'Results'))`));
    if (!hasInspector) {
      const dash = cliClick(`[title^="Project dashboard"]`);
      // wait for the dashboard to actually mount — clicking the row before
      // the view switches logs a CLI "not found" that pollutes the error
      // buffer the suite asserts on later
      let onDash = false;
      for (let w = 0; w < 8 && !onDash; w++) {
        await sleep(800);
        onDash = truthy(evalJs(`String(!!document.querySelector('section[aria-label="Active project spotlight"]'))`));
      }
      const rowPresent = truthy(evalJs(`String(!!document.querySelector('[title^="Open QA Refine3D"]'))`));
      const row = rowPresent ? cliClick(`[title^="Open QA Refine3D"]`) : "absent";
      step(`  entry ${i}: dash=${dash} row=${row}`);
      await sleep(3200);
      if (!truthy(evalJs(`String([...document.querySelectorAll('[role=tab]')].some(t => t.textContent.trim() === 'Results'))`))) continue;
    }
    evalJs(resultsTab);
    await sleep(1200);
    // programmatic click — a PHYSICAL click on a tile inside the Radix
    // modal stack closes the whole stack (overlay pointerdown races the
    // nested dialog); el.click() drives the handler with no pointer events
    const tile = evalJs(`(() => { const b=[...document.querySelectorAll('button[aria-label^="Enlarge"]')].find(x => (x.getAttribute('aria-label')||'').includes('orthovol')); if (!b) return 'NO-TILE'; b.click(); return 'clicked'; })()`);
    step(`  tile ${i}: ${tile}`);
    // the central-slice PNG is rendered server-side — poll for the dialog's
    // "View in 3D" button instead of a single fixed wait
    let ready = false;
    for (let w = 0; w < 12 && !ready; w++) {
      await sleep(1500);
      ready = truthy(evalJs(`String([...document.querySelectorAll('button')].some(b => (b.textContent||'').includes('View in 3D')))`));
    }
    step(`  enlarge-dialog ${i}: tile=${tile} ready=${ready}`);
    if (!ready) continue;
    let v3d = "";
    for (let k = 0; k < 6; k++) {
      v3d = evalJs(
        `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('View in 3D')); b ? b.click() : 0; return b ? 'v3d-clicked' : 'V3D-WAIT'; })()`,
      );
      if (v3d.includes("v3d-clicked")) break;
      await sleep(1500);
    }
    step(`  v3d: ${v3d}`);
    for (let w = 0; w < 75; w++) {
      await sleep(2000);
      const probe = evalJs(`({m: typeof window.__molstar, s: !!document.querySelector('[role=slider]')})`).replace(/\s+/g, "");
      if (w % 10 === 9) step(`  ready-wait ${w}: ${probe.slice(0, 50)}`);
      if (probe.includes('"m":"object"') && probe.includes('"s":true')) {
        // the "View in 3D" spawn no longer auto-closes the image dialog —
        // it stays up and covers the viewer toolbar. Close THAT dialog by
        // its own Close button — a blanket Escape tears down the whole
        // Radix stack (inspector + Mol* pane die with it)
        evalJs(`(() => {
          const dlgs = [...document.querySelectorAll('[role=dialog][data-state=open]')];
          const img = dlgs.find(d => [...d.querySelectorAll('button')].some(b => (b.textContent||'').includes('View in 3D')));
          if (!img) return 'no-image-dialog';
          const c = [...img.querySelectorAll('button')].find(b => (b.textContent||'').trim() === 'Close');
          if (!c) return 'no-close';
          c.click();
          return 'closed';
        })()`);
        await sleep(1500);
        return true;
      }
    }
    return false;
  }
  return false;
};

const ensurePopover = async (uiName, triggerAria) => {
  // Radix Popover triggers fire on POINTERDOWN — a programmatic t.click()
  // never opens it. Poke first (cheap when already open), then verify and
  // follow up with a physical CLI click while the panel is still absent.
  for (let i = 0; i < 4; i++) {
    const state = evalJs(`(() => {
      const p = document.querySelector('[data-canvas-ui=${uiName}]');
      if (p) return 'was-open';
      const t = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').startsWith('${triggerAria}'));
      if (!t) return 'NO-TRIGGER';
      t.click();
      return 'poked';
    })()`);
    await sleep(1200);
    const open = evalJs(`String(!!document.querySelector('[data-canvas-ui=${uiName}]'))`).replace(/^"|"$/g, "") === "true";
    if (open) return "was-open";
    if (String(state).includes("NO-TRIGGER")) return "NO-TRIGGER";
    // physical CLI clicks refuse covered points (the trigger can sit under
    // the inspector footer inside the modal scroll area); a synthetic
    // PointerEvent pair drives Radix's pointerdown handler with no geometry
    evalJs(`(() => {
      const t = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').startsWith('${triggerAria}'));
      if (!t) return 'NO-TRIGGER';
      const r = t.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0, pointerId: 1 };
      t.dispatchEvent(new PointerEvent('pointerdown', opts));
      t.dispatchEvent(new PointerEvent('pointerup', opts));
      t.dispatchEvent(new MouseEvent('click', opts));
      return 'pointer-poked';
    })()`);
    await sleep(1200);
  }
  return evalJs(`String(!!document.querySelector('[data-canvas-ui=${uiName}]'))`).includes("true") ? "was-open" : "NEVER-OPENED";
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
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('QA Refine3D') && (x.textContent||'').includes('completed'))`,
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
  await ensurePopover("camera-bookmarks", "Camera view bookmarks");
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
  // self-clean (Task 103 doctrine: clean before seeding, not after): the
  // overlay session persists server-side — clear it + the local mirror
  sh(`curl -s -X PUT "http://localhost:3000/api/jobs/${JID}/overlay-session" -H "Content-Type: application/json" -d '{"entries":[],"mode":"replace"}' > /dev/null`);
  evalJs(`(localStorage.removeItem('${OV_KEY}'), 'cleared')`);
  await sleep(800);
  const base = ovEntries();
  step(`  baseline entries: ${JSON.stringify(base)}`);
  if (JSON.stringify(base) !== "[]") throw new Error(`overlay row not clean: ${JSON.stringify(base)}`);

  const openP = await ensurePopover("layers-popover", "Overlay maps");
  step(`  layers popover: ${openP}`);
  // map choices load lazily after the popover opens — poll for them
  let pick = "NO-CHOICE";
  for (let i = 0; i < 10 && pick === "NO-CHOICE"; i++) {
    await sleep(1000);
    pick = unq(evalJs(`(() => {
      const p = document.querySelector('[data-canvas-ui=layers-popover]');
      const b = p && p.querySelector('button[data-testid^=map-choice-]:not([disabled])');
      if (!b) return 'NO-CHOICE';
      b.click(); return b.getAttribute('data-testid');
    })()`));
  }
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
