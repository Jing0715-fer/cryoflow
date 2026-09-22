// Task 43 QA — finish the interrupted-session feature set, single browser session:
//   A  viewer open + clean slate + regression probes (canvas / corner keys / slider)
//   B1 inline RENAME (Enter commit): pencil → input → Enter → row + toast
//      "View renamed" + server row + localStorage all follow
//   C  IMPORT PREVIEW DIALOG: DataTransfer file injection → checklist dialog
//      (rows / preselection / pose-only badge / capacity lock / footer counter)
//      → untick → Import N → server row follows; Cancel path; 7-file into 2/8
//      → 6 preselected + 7th checkbox disabled; 1-file into 8/8 → "full" toast,
//      no dialog; delete-all cleanup
//   D  console errors + screenshot
//   B2 inline RENAME Escape-cancel (runs last — Escape bubbles to the viewer
//      dialog per Task 38, so the viewer may close; assert via server+storage)
// Usage: QA_PHASES=A,B1,C,D,B2 node scripts/qa43-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa43-trace.log", import.meta.url).pathname;
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
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 90_000, input: expr }).trim();
// evalJs returns JSON-encoded values — strip the literal quotes on strings
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

// covers every toast this suite produces
const toastObserver = `(() => {
  window.__qaToasts = [];
  const t0 = Date.now();
  window.__qaMo && window.__qaMo.disconnect();
  window.__qaMo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/View saved|View updated|Renamed|Imported|bookmark|views|full/i.test(t)) {
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

const serverRow = () => {
  for (let i = 0; i < 3; i++) {
    try {
      const out = sh(`curl -s --max-time 20 "http://localhost:3000/api/jobs/${JID}/camera-bookmarks"`);
      if (out.startsWith("{")) return out;
    } catch { /* retry */ }
    sleep(3000);
  }
  return "CURL-FAIL";
};
const srvEmpty = (raw) => raw === "CURL-FAIL" || (JSON.parse(raw).bookmarks?.length ?? 1) === 0;
const srvNames = (raw) => (JSON.parse(raw).bookmarks ?? []).map((b) => b.name);

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

const deleteAllBookmarks = async () => {
  await ensurePopover("camera-bookmarks", "Camera view bookmarks"); // the import dialog steals focus and closes it
  const hasPopover = evalJs(`(!!document.querySelector('[data-canvas-ui=camera-bookmarks]') + '')`);
  if (hasPopover !== '"true"' && hasPopover !== "true") {
    // viewer closed (Escape did) — clear both mirrors without the UI
    sh(`curl -s -X PUT "http://localhost:3000/api/jobs/${JID}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":[]}' > /dev/null`);
    evalJs(`(localStorage.removeItem('${BM_KEY}'), 'ls-cleared')`);
    return serverRow();
  }
  const n = unq(evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    if (!p) return 'NO-POPOVER';
    const xs = [...p.querySelectorAll('button')].filter(b => (b.getAttribute('aria-label')||'').startsWith('Delete bookmark'));
    xs.forEach(x => x.click());
    return 'deleted ' + xs.length;
  })()`));
  step(`  delete-all: ${n}`);
  await sleep(2500);
  return serverRow();
};

/** fake-but-well-shaped camera snapshot for import fixtures */
const fakeSnap = () => ({
  mode: "camera", fov: 0.876, position: [12.3, -4.5, 30.1], up: [0, 1, 0],
  target: [0.1, 0.2, 0.3], radius: 52.4, radiusMax: 120,
});
const fullView = () => ({
  sigma: 3.2, sign: 1,
  slice: { on: true, axis: "Z", pos: 0.5 },
  clip: { on: true, x: 0.6, y: 1, z: 1, invert: false },
});

const importViaInput = async (payload, autoConfirm = false) => {
  // the hidden file input lives at the COMPONENT ROOT now (Task 54: a
  // Radix dialog auto-dismisses the popover beneath it, unmounting a
  // popover-scoped input) and imports land in the preview dialog, which
  // needs the confirm click
  const res = evalJs(`(() => {
    const inp = document.querySelector('input[accept="application/json,.json"]');
    if (!inp) return 'NO-INPUT';
    const dt = new DataTransfer();
    const f = new File([JSON.stringify((${JSON.stringify(payload)}))], 'views.json', { type: 'application/json' });
    dt.items.add(f);
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return 'injected';
  })()`);
  if (!String(res).includes("injected")) return res;
  // inject-only mode: the caller drives the preview dialog (qa43 asserts
  // the checklist before confirming); autoConfirm for row-count flows
  if (!autoConfirm) return "injected";
  // confirm with retries — the preview dialog's buttons can lag the open
  for (let k = 0; k < 6; k++) {
    await sleep(1200);
    const r = evalJs(`(() => {
      const dlgs = [...document.querySelectorAll('[role=dialog][data-state=open]')];
      const dlg = dlgs.find(d => (d.textContent||'').includes('Import views'));
      if (!dlg) return 'NO-IMPORT-DIALOG';
      const btn = [...dlg.querySelectorAll('button')].find(b => /^Import( \\d+)?$/.test((b.textContent||'').trim()));
      if (!btn) return 'NO-CONFIRM';
      btn.click();
      return 'confirmed';
    })()`);
    if (String(r).includes("confirmed")) return "confirmed";
    if (String(r).includes("NO-IMPORT-DIALOG")) continue; // dialog may still mount
  }
  return "NEVER-CONFIRMED";
};

/** the import-preview dialog probe — returns a structured object directly */
const dlgProbe = `(() => {
  const d = [...document.querySelectorAll('[data-slot=dialog-content]')].find(x => x.textContent.includes('Import views'));
  if (!d) return null;
  const cbs = [...d.querySelectorAll('button[role=checkbox]')];
  const imp = [...d.querySelectorAll('button')].find(b => /^Import/.test(b.textContent.trim()));
  return {
    desc: (d.textContent.match(/\\d+ of \\d+ entr\\w+ parsed[^—]*— tick what lands/) || [''])[0].replace(/\\s+/g, ' '),
    rows: d.querySelectorAll('[role=group] label').length,
    poseOnly: /pose only/.test(d.textContent),
    // Task 57 added the per-source tri-state HEADER checkbox — count only the
    // per-entry ones (their aria-label starts with 'Import')
    checked: cbs.filter(b => b.getAttribute('aria-checked') === 'true' && (b.getAttribute('aria-label')||'').startsWith('Import')).length,
    locked: cbs.filter(b => b.disabled).length,
    counter: (d.textContent.match(/\\d+\\/8 after import/) || [''])[0],
    importBtn: imp ? imp.textContent.trim() : 'NO-BTN',
    impDisabled: imp ? imp.disabled : null,
  };
})()`;
const dlg = () => JSON.parse(unq(evalJs(dlgProbe)) || "null");

/** PHASE A — open + regression */
const phaseA = async () => {
  step("== PHASE A: viewer open ==");
  sh(`curl -s -X PUT "http://localhost:3000/api/jobs/${JID}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":[]}' > /dev/null`);
  sh(`${AB} open http://localhost:3000`);
  await sleep(5000);
  evalJs(`(localStorage.removeItem('${BM_KEY}'), 'cleared')`);
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

/** PHASE B1 — inline rename, Enter commits */
const phaseB1 = async () => {
  console.log("== PHASE B1: inline rename (Enter) ==");
  await ensurePopover("camera-bookmarks", "Camera view bookmarks");
  // save one bookmark named "Alpha"
  evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const inp = p.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'Alpha');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'named';
  })()`);
  await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => b.textContent.trim().startsWith('Save'))`,
  );
  await sleep(1800);
  console.log("  save toasts:", lastToasts(2));
  // click the pencil on the Alpha row
  const pencil = unq(evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const b = p && p.querySelector('button[aria-label="Rename bookmark Alpha"]');
    if (!b) return 'NO-PENCIL'; b.click(); return 'pencil-clicked';
  })()`));
  if (pencil !== "pencil-clicked") throw new Error(`pencil not found: ${pencil}`);
  await sleep(500);
  // type the new name into the inline input, then Enter
  evalJs(`(() => {
    const inp = document.querySelector('[data-canvas-ui=camera-bookmarks] [data-testid^=bm-rename-] input')
      || [...document.querySelectorAll('input')].find(x => (x.getAttribute('aria-label')||'').includes('Rename'));
    inp.focus(); // real focus so the handler's blur() fires a real blur event
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'Beta prime');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return 'enter-dispatched';
  })()`);
  await sleep(1800);
  console.log("  rename toasts:", lastToasts(3));
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa43-rename.png`);
  const rowName = unq(evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const r = p && [...p.querySelectorAll('button[title^="Fly back"]')].find(x => x.textContent.includes('Beta prime'));
    return r ? 'row-Beta-prime' : 'ROW-MISSING';
  })()`));
  console.log("  row after rename:", rowName);
  if (rowName !== "row-Beta-prime") throw new Error("renamed row missing in popover");
  await sleep(1200);
  const names = srvNames(serverRow());
  console.log("  server names:", JSON.stringify(names));
  if (!names.includes("Beta prime")) throw new Error("server row did not follow rename");
  const ls = unq(evalJs(`(JSON.parse(localStorage.getItem('${BM_KEY}')||'[]').map(b=>b.name).join(','))`));
  console.log("  localStorage names:", ls);
  if (!ls.includes("Beta prime")) throw new Error("localStorage did not follow rename");
};

/** PHASE C — import preview dialog */
const phaseC = async () => {
  console.log("== PHASE C: import preview dialog ==");
  // curl clean slate — works without the viewer being open (the UI-path
  // delete-all at the END of this phase doubles as the rapid-delete
  // PUT-ordering regression test)
  sh(`curl -s -X PUT "http://localhost:3000/api/jobs/${JID}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":[]}' > /dev/null`);
  if (!srvEmpty(serverRow())) throw new Error("curl clean slate failed");
  await ensurePopover("camera-bookmarks", "Camera view bookmarks");

  // ---- C1: 3-entry file (full view + pose-only + junk view) → checklist ----
  const existing = parseInt(unq(evalJs(`document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button[title^="Fly back"]').length + ''`)), 10) || 0;
  console.log(`  existing rows before inject: ${existing}`);
  const file1 = [
    { id: "f1", name: "Imported full", ts: Date.now() - 3600e3, snapshot: fakeSnap(), view: fullView() },
    { id: "f2", name: "Imported pose", ts: Date.now() - 1800e3, snapshot: fakeSnap() },
    { id: "f3", name: "Imported junkview", ts: Date.now() - 600e3, snapshot: fakeSnap(), view: { sigma: "oops" } },
  ];
  console.log("  inject(3):", await importViaInput(file1));
  await sleep(2200);
  const d1 = dlg();
  console.log("  dialog after inject:", JSON.stringify(d1));
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa43-dialog.png`);
  if (!d1) throw new Error("import preview dialog did not open");
  if (!/3 of 3 entr/.test(d1.desc)) throw new Error(`description wrong: ${d1.desc}`);
  if (d1.rows !== 3) throw new Error(`expected 3 rows (got ${d1.rows})`);
  if (!d1.poseOnly) throw new Error("junk view did not degrade to 'pose only' badge");
  if (d1.checked !== 3) throw new Error(`expected 3 preselected (got ${d1.checked})`);
  if (d1.counter !== `${existing + 3}/8 after import`) throw new Error(`counter wrong: ${d1.counter}`);
  if (d1.importBtn !== "Import 3" || d1.impDisabled) throw new Error(`import btn wrong: ${d1.importBtn} disabled=${d1.impDisabled}`);

  // untick row 2 (Imported pose) → Import 2
  evalJs(`(() => {
    const d = [...document.querySelectorAll('[data-slot=dialog-content]')].find(x => x.textContent.includes('Import views'));
    const rows = [...d.querySelectorAll('[role=group] label')];
    const cb = rows[1].querySelector('button[role=checkbox]');
    cb.click();
    return 'unticked-row-2';
  })()`);
  await sleep(600);
  const d2 = dlg();
  console.log("  after untick:", JSON.stringify(d2));
  if (d2.checked !== 2 || d2.importBtn !== "Import 2") throw new Error(`untick did not register: ${JSON.stringify(d2)}`);
  evalJs(`(() => {
    const d = [...document.querySelectorAll('[data-slot=dialog-content]')].find(x => x.textContent.includes('Import views'));
    const b = [...d.querySelectorAll('button')].find(x => x.textContent.trim() === 'Import 2');
    b.click(); return 'confirmed';
  })()`);
  await sleep(2200);
  await ensurePopover("camera-bookmarks", "Camera view bookmarks");
  const rowsAfter = unq(evalJs(`document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button[title^="Fly back"]').length + ''`));
  console.log("  popover rows:", rowsAfter, `(existing ${existing} + 2)`);
  if (!/Imported 2 views/.test(lastToasts(4))) throw new Error("'Imported 2 views' toast missing");
  if (rowsAfter !== String(existing + 2)) throw new Error(`expected ${existing + 2} rows after import (got ${rowsAfter})`);
  await sleep(1200);
  const names1 = srvNames(serverRow());
  console.log("  server names:", JSON.stringify(names1));
  if (!(names1.includes("Imported full") && names1.includes("Imported junkview") && !names1.includes("Imported pose"))) {
    throw new Error("server names did not match the ticked set");
  }

  // ---- C2: cancel path ----
  await ensurePopover("camera-bookmarks", "Camera view bookmarks");
  console.log("  inject(1):", await importViaInput([{ id: "g1", name: "Cancel me", ts: Date.now(), snapshot: fakeSnap() }]));
  await sleep(2000);
  const d3 = dlg();
  console.log("  dialog(1 entry):", JSON.stringify(d3));
  if (!d3 || !/1 of 1 entry parsed/.test(d3.desc)) throw new Error(`singular description wrong: ${d3?.desc}`);
  evalJs(`(() => {
    const d = [...document.querySelectorAll('[data-slot=dialog-content]')].find(x => x.textContent.includes('Import views'));
    const b = [...d.querySelectorAll('button')].find(x => x.textContent.trim() === 'Cancel');
    b.click(); return 'cancelled';
  })()`);
  await sleep(1200);
  const d4 = dlg();
  await ensurePopover("camera-bookmarks", "Camera view bookmarks"); // dialog stole focus → popover self-closed
  const rowsC2 = unq(evalJs(`document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button[title^="Fly back"]').length + ''`));
  console.log("  after cancel — dialog:", JSON.stringify(d4), "| rows:", rowsC2);
  if (d4 !== null) throw new Error("dialog did not close on Cancel");
  if (rowsC2 !== String(existing + 2)) throw new Error(`cancel changed the list: ${rowsC2}`);

  // ---- C3: capacity lock — 7-file into the list → fit-fill + locked tail ----
  await ensurePopover("camera-bookmarks", "Camera view bookmarks");
  const have = existing + 2;
  const room = Math.max(0, 8 - have);
  const pre = Math.min(7, room);
  const file7 = Array.from({ length: 7 }, (_, i) => ({ id: `h${i}`, name: `Bulk ${i + 1}`, ts: Date.now() - i * 1000, snapshot: fakeSnap() }));
  console.log(`  inject(7 into ${have}/8): room=${room} preselect=${pre}`);
  console.log("  inject(7):", await importViaInput(file7));
  await sleep(2200);
  const d5 = dlg();
  console.log("  dialog(7):", JSON.stringify(d5));
  if (!d5) throw new Error("dialog(7) did not open");
  if (d5.checked !== pre) throw new Error(`expected ${pre} preselected (got ${d5.checked})`);
  if (d5.locked !== Math.max(0, 7 - pre)) throw new Error(`expected ${7 - pre} locked checkbox (got ${d5.locked})`);
  if (d5.counter !== "8/8 after import") throw new Error(`counter wrong: ${d5.counter}`);
  evalJs(`(() => {
    const d = [...document.querySelectorAll('[data-slot=dialog-content]')].find(x => x.textContent.includes('Import views'));
    const b = [...d.querySelectorAll('button')].find(x => x.textContent.trim() === 'Import ${pre}');
    b.click(); return 'confirmed-${pre}';
  })()`);
  await sleep(2200);
  await ensurePopover("camera-bookmarks", "Camera view bookmarks"); // dialog stole focus → popover self-closed
  const counter = unq(evalJs(`document.querySelector('[data-canvas-ui=camera-bookmarks] .ml-auto')?.textContent ?? 'NO-COUNTER'`));
  const rowsC3 = unq(evalJs(`document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button[title^="Fly back"]').length + ''`));
  console.log("  after bulk import — rows:", rowsC3, "| counter:", counter);
  if (rowsC3 !== "8" || counter !== "8/8") throw new Error(`bulk import landed wrong: rows=${rowsC3} counter=${counter}`);

  // ---- C4: full list → "Bookmark list is full" toast, NO dialog ----
  await ensurePopover("camera-bookmarks", "Camera view bookmarks");
  console.log("  inject(1 into 8/8):", await importViaInput([{ id: "x1", name: "No room", ts: Date.now(), snapshot: fakeSnap() }]));
  await sleep(2000);
  const d6 = dlg();
  console.log("  dialog after full inject:", JSON.stringify(d6), "| toasts:", lastToasts(2));
  // Task 54 replaced the silent no-open with an HONEST empty dialog: it
  // opens, preselects nothing (0 free slots), disables the confirm and
  // explains "The list already has 8 saved views". Either no dialog or an
  // honest-disabled one satisfies the contract; a confirming dialog fails.
  if (d6 !== null && (d6.impDisabled !== true || d6.checked !== 0))
    throw new Error(`full-list dialog must be honest-empty (got ${JSON.stringify(d6)})`);
  if (!/full/i.test(lastToasts(3))) throw new Error("'Bookmark list is full' toast missing");

  // ---- cleanup ----
  const srvEnd = await deleteAllBookmarks();
  if (!srvEmpty(srvEnd)) throw new Error(`server row should self-drop after delete-all (got ${srvEnd.slice(0, 60)})`);
};

/** PHASE D — console errors + style screenshot */
const phaseD = async () => {
  console.log("== PHASE D: console + screenshot ==");
  const errs = sh(`${AB} errors`) || "(none)";
  console.log("  console errors:", errs);
  if (!/^\(none\)$/.test(errs)) throw new Error(`console errors present: ${errs}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa43-light.png`);
  console.log("  screenshot saved");
};

/** PHASE B2 — Escape-cancel (LAST: Escape may close the viewer dialog) */
const phaseB2 = async () => {
  console.log("== PHASE B2: inline rename (Escape cancels) ==");
  await ensurePopover("camera-bookmarks", "Camera view bookmarks");
  // self-contained: batches that skipped B1 have no "Beta prime" — save one
  const have = unq(evalJs(`(!!document.querySelector('[data-canvas-ui=camera-bookmarks] button[aria-label="Rename bookmark Beta prime"]') + '')`));
  if (have !== "true") {
    console.log("  seeding 'Beta prime' (B1 not in this batch)");
    evalJs(`(() => {
      const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
      const inp = p.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(inp, 'Beta prime');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return 'named';
    })()`);
    await realClick(
      `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => b.textContent.trim().startsWith('Save'))`,
    );
    await sleep(1800);
  }
  const pencil = unq(evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const b = p && p.querySelector('button[aria-label="Rename bookmark Beta prime"]');
    if (!b) return 'NO-PENCIL'; b.click(); return 'pencil-clicked';
  })()`));
  if (pencil !== "pencil-clicked") throw new Error(`pencil(Beta prime) not found: ${pencil}`);
  await sleep(500);
  evalJs(`(() => {
    const inp = [...document.querySelectorAll('input')].find(x => (x.getAttribute('aria-label')||'').includes('Rename bookmark'));
    inp.focus(); // real focus → handler's blur() fires a real blur event
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'Never applied');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return 'escape-dispatched';
  })()`);
  await sleep(1500);
  console.log("  toasts after Esc (must not contain Renamed):", lastToasts(3));
  const names = srvNames(serverRow());
  console.log("  server names:", JSON.stringify(names));
  if (!names.includes("Beta prime") || names.includes("Never applied")) {
    throw new Error(`escape-cancel leaked: ${JSON.stringify(names)}`);
  }
  const ls = unq(evalJs(`(JSON.parse(localStorage.getItem('${BM_KEY}')||'[]').map(b=>b.name).join(','))`));
  console.log("  localStorage names:", ls);
  if (ls.includes("Never applied")) throw new Error("localStorage leaked the cancelled rename");
};

const PHASES = (process.env.QA_PHASES || "A,B1,C,D,B2").split(",").map((s) => s.trim());

const main = async () => {
  // every viewer-dependent phase rides on A's open + clean slate
  if (PHASES.some((p) => ["A", "B1", "C", "B2"].includes(p))) await phaseA();
  if (PHASES.includes("B1")) await phaseB1();
  if (PHASES.includes("C")) await phaseC();
  if (PHASES.includes("D")) await phaseD();
  if (PHASES.includes("B2")) await phaseB2();
  // final cleanup — whatever the phases left behind
  if (!srvEmpty(serverRow())) await deleteAllBookmarks();
  step("DONE");
  console.log("DONE");
};

main().catch((e) => {
  step(`FAILED: ${e.message}`);
  console.error("FAILED:", e.message);
  process.exit(1);
});
