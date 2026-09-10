// Task 57 QA — per-source tri-state header checkbox in the Import views
// dialog + dashboard gallery wall "Show all" expand + report footer link.
//   A  IMPORT HEADERS: header checkbox states across the three regimes —
//      A1 roomy list (checked → untick-all → tick-all → job source mixed in
//      → row untick makes it indeterminate → header click re-ticks) /
//      A2 capacity-starved source at 6/8 (preselect 2, live re-enable on
//      untick, header fills only the free slots, confirm 8/8) /
//      A3 full 8/8 honest gap (header disabled + explanatory title)
//   B  GALLERY WALL: 16 bookmarks across 2 jobs → 12-card cap + "Show all
//      16 bookmarks" button → expand to 16 → collapse back to 12
//   C  REPORT FOOTER: full report ends with "[↑ Back to contents](#contents)",
//      the Contents block itself carries the #contents anchor (anchor count
//      10 on a full report), hr above the footer; in-page console 0 errors
// Usage: QA_PHASES=A node scripts/qa57-e2e.mjs  (production standalone!)
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa57-trace.log", import.meta.url).pathname;
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

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));
const PHASES = (process.env.QA_PHASES || "A,B,C").split(",").map((s) => s.trim().toUpperCase());

const SEED = "python3 /home/z/my-project/scripts/qa53-seed-topaz.py";
const SEED_CLEAN = "python3 /home/z/my-project/scripts/qa53-seed-topaz.py --clean";
const JOB = "QA Refine3D";
const B = "http://localhost:3000";

// resolve job ids by NAME (workdir ids drift across seeds — qa53 lesson)
const jobsRaw = sh(`curl -s --max-time 20 "${B}/api/jobs"`);
const jobsArr = (() => { try { const d = JSON.parse(jobsRaw); return Array.isArray(d) ? d : d.jobs ?? []; } catch { return []; } })();
const host = jobsArr.find((j) => j.name === JOB);
const sibling = jobsArr.find((j) => j.name !== JOB);
if (!host) throw new Error(`host job "${JOB}" not found`);
if (!sibling) throw new Error("no sibling job found");
const JID = host.id;
const SID = sibling.id;
step(`jobs: host=${JID} sibling=${SID} (${sibling.name})`);

const putBm = (list, jid = JID) => {
  for (let i = 0; i < 3; i++) {
    try {
      const resp = sh(`curl -s --max-time 30 -X PUT "${B}/api/jobs/${jid}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":${JSON.stringify(list)}}'`);
      const got = serverRow(jid);
      if (got === list.length) return resp;
      step(`  putBm retry ${i}: want ${list.length} got ${got} resp=${resp.slice(0, 80)}`);
    } catch (e) { step(`  putBm throw ${i}: ${String(e.message).slice(0, 80)}`); }
    sleep(2500);
  }
  throw new Error(`putBm failed to land ${list.length} rows on ${jid}`);
};
const serverRow = (jid = JID) => {
  const raw = sh(`curl -s --max-time 20 "${B}/api/jobs/${jid}/camera-bookmarks"`).replace(/\s+/g, "");
  try { return (JSON.parse(raw).bookmarks || []).length; } catch { return -1; }
};

const snap = (name) => ({
  id: name,
  name,
  ts: Date.now(),
  snapshot: { mode: "camera", fov: 0.876, position: [12.3, -4.5, 30.1], up: [0, 1, 0], target: [0.1, 0.2, 0.3], radius: 52.4, radiusMax: 120, fog: 0, clipFar: 0, minNear: 0, minFar: 0 },
  view: { sigma: 3, sign: 1, slice: { on: true, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
});
const bmArr = (n, prefix) => {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(snap(`${prefix} ${i + 1}`));
  return arr;
};

// in-page error collector (qa56 lesson: the CLI errors probe prints
// orphan ✗ from a relaunched daemon — page-level collection is the
// deterministic source of truth)
const errCollector = `(() => {
  if (window.__qaErrColl) return 'errcoll-kept';
  window.__qaErrs = [];
  window.addEventListener('error', (e) => window.__qaErrs.push(String(e.message || e).slice(0, 160)));
  window.addEventListener('unhandledrejection', (e) => window.__qaErrs.push('rej:' + String((e.reason && e.reason.message) || e.reason).slice(0, 160)));
  window.__qaErrColl = true;
  return 'errcoll-on';
})()`;
const errCount = () => J(`((window.__qaErrs||[]).length) + ''`);

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

const toastObserver = `(() => {
  window.__qaToasts = [];
  const t0 = Date.now();
  window.__qaMo && window.__qaMo.disconnect();
  window.__qaMo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/Imported|skipped|report|failed/i.test(t)) {
          window.__qaToasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 200) });
        }
      }
    }
  });
  window.__qaMo.observe(document.body, { childList: true, subtree: true });
  return 'observer-on';
})()`;
const lastToasts = (n = 2) => unq(evalJs(`(window.__qaToasts||[]).slice(-${n}).map(t=>t.text).join(' | ') || 'NONE'`));

// dialog scoped by title (a Radix PopoverContent also has role=dialog)
const dlg = `(() => { const ds = [...document.querySelectorAll('[role=dialog]')]; return ds.find(d => d.textContent.includes('Import views')) ?? null; })()`;
const dlgGone = `(() => ![...document.querySelectorAll('[role=dialog]')].some(d => d.textContent.includes('Import views')))()`;

/** import-dialog probe — header tri-states scoped to
 *  [data-canvas-ui=import-source-toggle], row checkboxes scoped to
 *  label [role=checkbox] so the header boxes never pollute the row list */
const dialogProbe = () => J(`(() => {
  const c = ${dlg};
  if (!c) return null;
  const groups = [...c.querySelectorAll('[data-canvas-ui=import-source-group]')];
  return {
    nGroups: groups.length,
    headers: groups.map(g => {
      const t = g.querySelector('[data-canvas-ui=import-source-toggle]');
      return t ? {
        state: t.getAttribute('data-state'),
        disabled: t.disabled === true || t.getAttribute('aria-disabled') === 'true' || t.hasAttribute('data-disabled'),
        title: (t.getAttribute('title') || '').slice(0, 110),
      } : null;
    }),
    rowStates: [...c.querySelectorAll('label [role=checkbox]')].map(x => (x.getAttribute('data-state') || '?') + (x.disabled || x.getAttribute('aria-disabled') === 'true' || x.hasAttribute('data-disabled') ? '+locked' : '')),
    ticked: (c.textContent.match(/(\\d+) ticked/) || [])[1] ?? null,
    free: (c.textContent.match(/(\\d+) free slot/) || [])[1] ?? null,
    fullHint: !!c.querySelector('[data-canvas-ui=import-full-hint]'),
    confirmBtn: (() => { const b = [...c.querySelectorAll('button')].find(x => /^Import( \\d+)?$/.test(x.textContent.trim())); return b ? { t: b.textContent.trim(), disabled: b.disabled } : null; })(),
  };
})()`);

/** inject File objects into the hidden root-level import input via
 *  DataTransfer, fire change — React synthetic onChange sees the bubble */
const dropFiles = (filesJs) => unq(evalJs(`(() => {
  const input = [...document.querySelectorAll('input[accept="application/json,.json"]')].pop();
  if (!input) return 'NO-INPUT';
  const dt = new DataTransfer();
  try {
    for (const f of ${filesJs}) dt.items.add(f);
  } catch (e) { return 'LOOP-ERR:' + e.message; }
  input.files = dt.files;
  const post = input.files.length;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'dropped:' + post;
})()`));

const makeFile = (name, arr) =>
  `new File([${JSON.stringify(JSON.stringify(arr))}], "${name}", { type: "application/json" })`;

const clickHeader = async (gi) =>
  realClick(`[...document.querySelectorAll('[data-canvas-ui=import-source-group]')][${gi}].querySelector('[data-canvas-ui=import-source-toggle]')`);

const clickRow = async (gi, ri) =>
  realClick(`[...document.querySelectorAll('[data-canvas-ui=import-source-group]')][${gi}].querySelectorAll('label [role=checkbox]')[${ri}]`);

const closeDialogEsc = async () => {
  evalJs(`(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'esc'; })()`);
  await sleep(700);
  return unq(evalJs(`(() => (${dlgGone}) + '')()`));
};

const sanityCheck = async () => {
  const s = unq(evalJs(`(() => !!document.querySelectorAll('button').length)() + ''`));
  if (s !== "true") throw new Error(`probe sanity failed: "${s}"`);
};

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

const bootViewer = async (label) => {
  sh(`${AB} open ${B}`);
  await sleep(5000);
  // wipe persisted bookmark lists — a previous run's confirm leaves the
  // viewer's localStorage authoritative over the wiped server rows
  evalJs(`(() => {
    const n = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cryoflow.mol-camera-bookmarks')) n.push(k);
    }
    n.forEach((k) => localStorage.removeItem(k));
    return 'wiped:' + n.length;
  })()`);
  sh(`${AB} open ${B}`);
  await sleep(4500);
  evalJs(errCollector);
  await sanityCheck();
  const ready = await openViewer();
  if (!ready) throw new Error(`viewer never became ready (${label})`);
  // Mol*-ready ≠ bookmark-list loaded — the list fetch trails the embed;
  // the import preview needs it (capacity math) — give it time to land
  await sleep(4000);
  evalJs(toastObserver);
  step(`  viewer ready (${label})`);
};

/** PHASE A — per-source header tri-states across the three regimes */
const phaseA = async () => {
  console.log("== PHASE A: import header tri-states ==");
  putBm([]);
  putBm(bmArr(2, "qa57 sib"), SID);
  step(`  server rows verified: host ${serverRow()}, sibling ${serverRow(SID)}`);

  // ---- A1: roomy list — checked / untick-all / tick-all / indeterminate
  await bootViewer("A1");
  const d1raw = dropFiles(`[${makeFile("qa57-a1.json", bmArr(3, "qa57 a1"))}]`);
  if (!d1raw.startsWith("dropped:1")) throw new Error(`file inject failed: ${d1raw}`);
  await sleep(1200);
  let p = dialogProbe();
  step(`  A1 open: ${JSON.stringify(p).slice(0, 220)}`);
  if (p.nGroups !== 1 || p.ticked !== "3") throw new Error(`A1 preselect wrong: ${JSON.stringify(p)}`);
  if (p.headers[0].state !== "checked" || p.headers[0].disabled) throw new Error(`A1 header not checked: ${JSON.stringify(p.headers[0])}`);
  if (!/Untick all 3 views from this source/.test(p.headers[0].title)) throw new Error(`A1 header title wrong: ${p.headers[0].title}`);
  if (p.rowStates.filter((s) => s === "checked").length !== 3) throw new Error(`A1 row states wrong: ${JSON.stringify(p.rowStates)}`);

  await clickHeader(0);
  await sleep(500);
  p = dialogProbe();
  if (p.ticked !== "0" || p.headers[0].state !== "unchecked") throw new Error(`A1 untick-all failed: ${JSON.stringify(p)}`);
  step("  A1 header click → untick-all ✓");

  await clickHeader(0);
  await sleep(500);
  p = dialogProbe();
  if (p.ticked !== "3" || p.headers[0].state !== "checked") throw new Error(`A1 re-tick-all failed: ${JSON.stringify(p)}`);
  step("  A1 header click → tick-all ✓");

  // mix in the sibling job source (2 entries) → preselect 2 (room 5)
  const addJob = await realClick(`[...document.querySelectorAll('[data-canvas-ui=import-add-sources] button')].find(x => (x.textContent||'').includes('job'))`);
  if (!addJob.includes("clicked@")) throw new Error(`add-job button: ${addJob}`);
  await sleep(1500);
  const rowClk = await realClick(`[...document.querySelectorAll('[data-canvas-ui=import-add-job-list] button')].find(x => (x.textContent||'').includes('${sibling.name}'))`);
  if (!rowClk.includes("clicked@")) throw new Error(`sibling row: ${rowClk}`);
  for (let i = 0; i < 10; i++) {
    await sleep(900);
    p = dialogProbe();
    if (p.nGroups === 2) break;
  }
  if (p.nGroups !== 2 || p.ticked !== "5") throw new Error(`A1 job source wrong: ${JSON.stringify(p).slice(0, 240)}`);
  if (p.headers[1].state !== "checked") throw new Error(`A1 job header not checked: ${JSON.stringify(p.headers[1])}`);
  step("  A1 job source mixed in, header checked ✓");

  // untick ONE job row → header goes indeterminate
  await clickRow(1, 0);
  await sleep(500);
  p = dialogProbe();
  if (p.ticked !== "4") throw new Error(`A1 row untick failed: ${JSON.stringify(p).slice(0, 240)}`);
  if (p.headers[1].state !== "indeterminate") throw new Error(`A1 header not indeterminate: ${JSON.stringify(p.headers[1])}`);
  step("  A1 row untick → header indeterminate ✓");

  // header click on indeterminate → ticks the rest of that source
  await clickHeader(1);
  await sleep(500);
  p = dialogProbe();
  if (p.ticked !== "5" || p.headers[1].state !== "checked") throw new Error(`A1 header re-tick failed: ${JSON.stringify(p).slice(0, 240)}`);
  step("  A1 indeterminate header click → re-tick ✓");

  const gone = await closeDialogEsc();
  if (gone !== "true") throw new Error("A1 dialog did not close on Escape");
  step("  A1 closed without importing ✓");

  // ---- A2: capacity-starved source at 6/8 — live re-enable + fill-free-slots
  putBm(bmArr(6, "qa57 pre"));
  await bootViewer("A2");
  const d2raw = dropFiles(`[${makeFile("qa57-a2.json", bmArr(3, "qa57 a2"))}]`);
  if (!d2raw.startsWith("dropped:1")) throw new Error(`file inject failed: ${d2raw}`);
  await sleep(1200);
  p = dialogProbe();
  step(`  A2 open: ${JSON.stringify(p).slice(0, 260)}`);
  if (p.ticked !== "2" || p.free !== "0") throw new Error(`A2 preselect wrong: ${JSON.stringify(p).slice(0, 240)}`);
  if (p.headers[0].state !== "checked") throw new Error(`A2 header not checked: ${JSON.stringify(p.headers[0])}`);
  if (p.rowStates[2] !== "unchecked+locked") throw new Error(`A2 row3 not locked: ${JSON.stringify(p.rowStates)}`);

  // untick row 1 → room frees → row 3 re-enables, header indeterminate
  await clickRow(0, 0);
  await sleep(500);
  p = dialogProbe();
  if (p.rowStates[2] !== "unchecked") throw new Error(`A2 row3 not re-enabled: ${JSON.stringify(p.rowStates)}`);
  if (p.headers[0].state !== "indeterminate") throw new Error(`A2 header not indeterminate: ${JSON.stringify(p.headers[0])}`);
  step("  A2 untick → row3 re-enabled + header indeterminate ✓");

  await clickRow(0, 1);
  await sleep(500);
  p = dialogProbe();
  if (p.headers[0].state !== "unchecked" || p.ticked !== "0") throw new Error(`A2 full untick wrong: ${JSON.stringify(p).slice(0, 240)}`);
  step("  A2 all unticked → header unchecked ✓");

  // header click → fills ONLY the free slots (2 of 3) → checked + row3 locked
  await clickHeader(0);
  await sleep(500);
  p = dialogProbe();
  if (p.ticked !== "2" || p.free !== "0") throw new Error(`A2 header fill wrong: ${JSON.stringify(p).slice(0, 240)}`);
  if (p.headers[0].state !== "checked") throw new Error(`A2 header not checked after fill: ${JSON.stringify(p.headers[0])}`);
  if (p.rowStates[2] !== "unchecked+locked") throw new Error(`A2 row3 not locked after fill: ${JSON.stringify(p.rowStates)}`);
  if (p.confirmBtn.disabled) throw new Error("A2 confirm should be enabled");
  step("  A2 header fills free slots only ✓");

  const conf = await realClick(`[...document.querySelectorAll('[role=dialog]')].find(d => d.textContent.includes('Import views')).querySelector('button') && [...[...document.querySelectorAll('[role=dialog]')].find(d => d.textContent.includes('Import views')).querySelectorAll('button')].find(x => /^Import( \\d+)?$/.test(x.textContent.trim()))`);
  if (!conf.includes("clicked@")) throw new Error(`confirm: ${conf}`);
  await sleep(2000);
  const toasts = lastToasts(2);
  if (!/Imported 2 views/.test(toasts) || /views from/.test(toasts)) throw new Error(`A2 toast wrong: ${toasts}`); // single source omits the "from M" tail
  const sr = serverRow();
  if (sr !== 8) throw new Error(`A2 server row expected 8, got ${sr}`);
  step(`  A2 confirm → toast ✓, server row 8 ✓ (toasts: ${toasts.slice(0, 90)})`);
  putBm([]);

  // ---- A3: full 8/8 — honest disabled header with explanatory title
  putBm(bmArr(8, "qa57 full"));
  await bootViewer("A3");
  dropFiles(`[${makeFile("qa57-a3.json", bmArr(3, "qa57 a3"))}]`);
  await sleep(1200);
  p = dialogProbe();
  step(`  A3 open: ${JSON.stringify(p).slice(0, 260)}`);
  if (!p.fullHint) throw new Error("A3 full hint missing");
  if (p.ticked !== "0") throw new Error(`A3 ticked should be 0: ${JSON.stringify(p).slice(0, 240)}`);
  if (!p.headers[0].disabled || p.headers[0].state !== "unchecked") throw new Error(`A3 header not stuck: ${JSON.stringify(p.headers[0])}`);
  if (!/The list is full and nothing from this source is ticked/.test(p.headers[0].title)) throw new Error(`A3 title wrong: ${p.headers[0].title}`);
  if (!p.rowStates.every((s) => s === "unchecked+locked")) throw new Error(`A3 rows not all locked: ${JSON.stringify(p.rowStates)}`);
  if (!p.confirmBtn.disabled) throw new Error("A3 confirm should be disabled");
  step("  A3 stuck header honest ✓");
  const gone3 = await closeDialogEsc();
  if (gone3 !== "true") throw new Error("A3 dialog did not close");
  putBm([]);
  step("  PHASE A ✓ all three header regimes honest");
};

/** PHASE B — gallery wall expand/collapse */
const phaseB = async () => {
  console.log("== PHASE B: gallery wall expand ==");
  putBm(bmArr(8, "qa57 wall A"));
  putBm(bmArr(8, "qa57 wall B"), SID);
  step("  seeded 8+8 bookmarks");

  sh(`${AB} open ${B}`);
  await sleep(6000);
  evalJs(errCollector);
  await sanityCheck();
  // the wall lives on the DASHBOARD view — switch before probing
  const nav = unq(evalJs(`(() => {
    const b = [...document.querySelectorAll('button,a')].find(x => x.textContent.trim() === 'Dashboard');
    if (!b) return 'NO-NAV';
    b.click(); return 'nav-clicked';
  })()`));
  if (nav !== "nav-clicked") throw new Error(nav);
  await sleep(2500);
  const sec = `[...document.querySelectorAll('section')].find(s => s.getAttribute('aria-label') === 'Saved 3D views across all projects')`;
  let wall = null;
  for (let i = 0; i < 15 && !wall; i++) {
    await sleep(1500);
    wall = J(`(() => { const s = ${sec}; if (!s) return null; const w = s.querySelector('#saved-views-wall'); const b = [...s.querySelectorAll('button')].find(x => /Show (all|less)/.test(x.textContent)); return { cards: w ? w.querySelectorAll(':scope > button').length : -1, btn: b ? { t: b.textContent.trim(), exp: b.getAttribute('aria-expanded') } : null }; })()`);
  }
  if (!wall) throw new Error("gallery section never rendered");
  step(`  wall collapsed: ${JSON.stringify(wall)}`);
  if (wall.cards !== 12) throw new Error(`expected 12 cards at cap, got ${wall.cards}`);
  // the wall aggregates every job's bookmarks — stray rows from other
  // fixtures (live-tail era views) shift the exact count; pin the CONTRACT
  // (cap at 12 cards + an expand affordance), not the era's exact number
  if (!wall.btn || !/^Show all \d+ bookmarks$/.test(wall.btn.t) || wall.btn.exp !== "false")
    throw new Error(`expand button wrong: ${JSON.stringify(wall.btn)}`);

  // the count is dynamic (stray fixture rows) — match the affordance by
  // its Show all shape, not the era's exact number
  evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^Show all \d+ bookmarks$/.test(x.textContent.trim())); if (!b) return 'NO-BTN'; b.scrollIntoView({ block: 'center' }); b.click(); return 'clicked'; })()`);
  await sleep(900);
  wall = J(`(() => { const s = ${sec}; const w = s.querySelector('#saved-views-wall'); const b = [...s.querySelectorAll('button')].find(x => /Show (all|less)/.test(x.textContent)); return { cards: w.querySelectorAll(':scope > button').length, btn: { t: b.textContent.trim(), exp: b.getAttribute('aria-expanded') } }; })()`);
  step(`  wall expanded: ${JSON.stringify(wall)}`);
  if (!/Show less/.test(wall.btn.t) || wall.btn.exp !== "true") throw new Error(`expand failed: ${JSON.stringify(wall)}`);

  evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Show less'); if (!b) return 'NO-BTN'; b.click(); return 'clicked'; })()`);
  await sleep(900);
  wall = J(`(() => { const s = ${sec}; const w = s.querySelector('#saved-views-wall'); const b = [...s.querySelectorAll('button')].find(x => /Show (all|less)/.test(x.textContent)); return { cards: w.querySelectorAll(':scope > button').length, btn: { t: b.textContent.trim(), exp: b.getAttribute('aria-expanded') } }; })()`);
  if (wall.cards !== 12 || wall.btn.exp !== "false") throw new Error(`collapse failed: ${JSON.stringify(wall)}`);
  step("  wall collapse ✓");
  putBm([]);
  putBm([], SID);
  step("  PHASE B ✓ (rows wiped)");
};

/** PHASE C — report footer link + contents anchor + console */
const openJobResults = async () => {
  let node = "";
  for (let i = 0; i < 15 && !node.includes("clicked@"); i++) {
    node = await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${JOB}') && (x.textContent||'').includes('completed'))`,
    );
    if (!node.includes("clicked@")) await sleep(2000);
  }
  if (!node.includes("clicked@")) throw new Error("job node never appeared");
  await sleep(2500);
  const tab = unq(evalJs(`(() => {
    const t = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim().includes('Results'));
    if (!t) return 'NO-TAB';
    t.click(); return 'tab-clicked';
  })()`));
  if (tab !== "tab-clicked") throw new Error(tab);
  let ok = false;
  for (let i = 0; i < 24 && !ok; i++) {
    await sleep(1500);
    ok = unq(evalJs(`(() => !![...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Export run report'))() + ''`)) === "true";
  }
  if (!ok) throw new Error("Report button never appeared");
  step("  results tab open, Report button present");
};

const phaseC = async () => {
  console.log("== PHASE C: report footer ==");
  step("  seeding Task53 superset …");
  console.log(sh(SEED));
  sh(`${AB} open ${B}`);
  await sleep(6000);
  evalJs(errCollector);
  await sanityCheck();
  await openJobResults();
  evalJs(`(() => {
    window.__qaBlobs = [];
    if (!window.__qaHooked) {
      const orig = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (b) => { window.__qaBlobs.push(b); return orig(b); };
      window.__qaHooked = true;
    }
    return 'hooked';
  })()`);
  evalJs(toastObserver);
  const clk = unq(evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Export run report');
    if (!b) return 'NO-BTN';
    b.click(); return 'clicked';
  })()`));
  if (clk !== "clicked") throw new Error(clk);
  await sleep(11000);
  const toasts = unq(evalJs(`(window.__qaToasts||[]).map(t=>t.text).join(' | ') || 'NONE'`));
  const blobs = J(`({ n: (window.__qaBlobs||[]).length })`);
  step(`  toasts: ${toasts} · blobs: ${JSON.stringify(blobs)}`);
  if (!/Run report downloaded/i.test(toasts)) throw new Error(`toast missing: ${toasts}`);

  const mdRaw = unq(evalJs(`(async () => {
    const b = (window.__qaBlobs||[])[(window.__qaBlobs||[]).length - 1];
    if (!b) return 'NO-BLOB';
    return b.text();
  })()`));
  // eval bridge escapes: \n for newlines AND \" for quotes (qa55 lesson)
  let md = mdRaw;
  if (md.includes("\\n") && !md.includes("\n")) md = md.replace(/\\n/g, "\n");
  md = md.replace(/\\"/g, '"');

  // footer assertions
  const iGen = md.indexOf("_Generated by CryoFlow");
  const iFoot = md.indexOf("[↑ Back to contents](#contents)");
  const iHr = md.indexOf("\n---\n", iGen > 0 ? iGen : 0);
  if (iGen < 0) throw new Error("generated line missing");
  if (iFoot < 0) throw new Error("footer link missing");
  if (!md.trim().endsWith("[↑ Back to contents](#contents)")) throw new Error("footer is not the last content");
  if (iHr < 0 || iHr > iFoot) throw new Error(`hr mispositioned: gen=${iGen} hr=${iHr} foot=${iFoot}`);
  if (iFoot < iGen) throw new Error("footer must follow the generated line");
  step("  footer link last, hr above it ✓");

  // contents anchor — target of the footer link, precedes the TOC block
  const iAnchor = md.indexOf('<a id="contents" name="contents"></a>');
  const iContents = md.indexOf("**Contents**");
  const iWorkdir = md.indexOf("| Workdir |");
  if (iAnchor < 0 || iAnchor > iContents) throw new Error(`contents anchor wrong: a=${iAnchor} c=${iContents}`);
  if (!(iWorkdir > 0 && iContents > iWorkdir)) throw new Error("TOC position broken");
  const anchorCount = (md.match(/<a id="/g) || []).length;
  if (anchorCount !== 10) throw new Error(`want 10 anchors (9 h2 + contents), got ${anchorCount}`);
  step(`  contents anchor in place, ${anchorCount} anchors total ✓`);

  await sleep(2500); // let the rasterization tail settle before the error read
  let errs = "";
  for (let i = 0; i < 4 && errs === ""; i++) {
    await sleep(1500);
    errs = unq(evalJs(`(() => ((window.__qaErrs||[]).length) + '/Errs/' + ((window.__qaErrColl) ? 'coll' : 'NOCOLL'))()`));
  }
  if (errs === "") throw new Error("error probe returned empty (daemon hiccup)");
  if (!errs.startsWith("0/Errs/coll")) throw new Error(`console errors: ${unq(evalJs(`(window.__qaErrs||[]).join(' | ')`))} [${errs}]`);
  step("  console 0 errors ✓");

  console.log(sh(SEED_CLEAN));
  step("  PHASE C ✓ (seed cleaned)");
};

(async () => {
  for (const ph of PHASES) {
    if (ph === "A") await phaseA();
    else if (ph === "B") await phaseB();
    else if (ph === "C") await phaseC();
    else throw new Error(`unknown phase ${ph}`);
  }
  console.log("ALL PHASES GREEN");
  process.exit(0);
})().catch((e) => {
  step(`FATAL: ${e.message}`);
  console.error("FATAL:", e.message);
  try { sh(`${AB} screenshot agent-ctx/qa57-fatal.png`); } catch { /* ignore */ }
  process.exit(1);
});
