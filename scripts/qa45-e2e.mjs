// Task 45 QA — single browser session:
//   A  viewer open + regression probes (canvas / corner keys / sliders)
//   B  CROSS-JOB bookmark import: seed a sibling job's server row (full view +
//      junk view) → bookmark popover → "From job" section lists the sibling
//      with "2 views" → click → SAME preview dialog ("from …" source, pose-only
//      badge) → Import 2 → current job's server row + counter follow; delete-all
//      cleanup on BOTH jobs
//   C  sparkline TOUCH tooltip (mocked /api/activity/recent): running row gains
//      a polyline after 2 polls → pointerdown pops the inverted chip
//      ("N samples · a%→b%" + trend arrow) → auto-dismisses ~2s
//   D  console errors + screenshot + unroute + cleanup
// Usage: QA_PHASES=A,B node scripts/qa45-e2e.mjs   (phase-split: AB / CD on the 4GB box —
//        Chrome + Turbopack compile spike together OOM-kill the dev server)
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const PHASES = (process.env.QA_PHASES || "A,B,C,D").split(",");

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa45-trace.log", import.meta.url).pathname;
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

const toastObserver = `(() => {
  window.__qaToasts = [];
  const t0 = Date.now();
  window.__qaMo && window.__qaMo.disconnect();
  window.__qaMo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/Imported|View saved|views/i.test(t)) {
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

const bmNames = (jid = JID, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const raw = sh(`curl -s --max-time 20 "http://localhost:3000/api/jobs/${jid}/camera-bookmarks"`);
      if (raw.startsWith("{")) return JSON.parse(raw).bookmarks.map((b) => b.name);
    } catch { /* dev server under memory pressure — retry */ }
    sleep(2500);
  }
  return ["CURL-FAIL"];
};
const putBm = (list, jid = JID) => {
  for (let i = 0; i < 3; i++) {
    try {
      sh(`curl -s --max-time 30 -X PUT "http://localhost:3000/api/jobs/${jid}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":${JSON.stringify(list)}}'`);
      return;
    } catch { sleep(2500); } // transient (OOM restart window) — retry
  }
};

const deleteAllBookmarks = async () => {
  await ensurePopover("camera-bookmarks", "Camera view bookmarks");
  const hasPopover = evalJs(`(!!document.querySelector('[data-canvas-ui=camera-bookmarks]') + '')`);
  if (hasPopover !== '"true"' && hasPopover !== "true") {
    putBm([]);
    evalJs(`(localStorage.removeItem('${BM_KEY}'), 'ls-cleared')`);
    return bmNames();
  }
  const n = unq(evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const xs = [...p.querySelectorAll('button')].filter(b => (b.getAttribute('aria-label')||'').startsWith('Delete bookmark'));
    xs.forEach(x => x.click());
    return 'deleted ' + xs.length;
  })()`));
  step(`  delete-all: ${n}`);
  await sleep(2500);
  return bmNames();
};

/** pick a sibling job in the same project (not the viewer job) */
const pickSibling = () => {
  let raw = "";
  for (let i = 0; i < 3; i++) {
    try {
      raw = sh(`curl -s --max-time 30 "http://localhost:3000/api/jobs"`);
      if (raw.startsWith("{")) break;
    } catch { /* memory-pressure hiccup — retry */ }
    sleep(2500);
  }
  const jobs = JSON.parse(raw).jobs ?? [];
  const self = jobs.find((j) => j.id === JID);
  if (!self) throw new Error("viewer job not in /api/jobs");
  const sib = jobs.find((j) => j.id !== JID && j.projectId === self.projectId);
  return sib ? { id: sib.id, name: sib.name } : null;
};

/** PHASE A — open + regression */
const phaseA = async () => {
  step("== PHASE A: viewer open ==");
  putBm([]);
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
  step(`  canvas: ${h.split(" ")[1] ?? h}`);
  if (!h.includes("x")) throw new Error("no volume canvas mounted");
  console.log("  observer:", evalJs(toastObserver));
};

/** PHASE B — cross-job import */
const phaseB = async () => {
  console.log("== PHASE B: cross-job import ==");
  const sib = pickSibling();
  if (!sib) throw new Error("no sibling job in the same project");
  step(`  sibling: ${sib.name} (${sib.id})`);
  // seed the sibling's row: one FULL view + one JUNK view (degrades pose-only)
  putBm(
    [
      { id: "sib-a", name: "Top view", ts: Date.now() - 6000, snapshot: { mode: "camera", fov: 0.876, position: [12, -4, 30], up: [0, 1, 0], target: [0, 0, 0], radius: 52, radiusMax: 120 }, view: { sigma: 3.2, sign: 1, slice: { on: true, axis: "Z", pos: 0.5 }, clip: { on: true, x: 0.6, y: 1, z: 1, invert: false } } },
      { id: "sib-b", name: "Legacy pose", ts: Date.now() - 3000, snapshot: { mode: "camera", fov: 0.876, position: [0, 0, 40], up: [0, 1, 0], target: [0, 0, 0], radius: 50, radiusMax: 120 } },
    ],
    sib.id,
  );
  await ensurePopover("camera-bookmarks", "Camera view bookmarks");

  // open the From job section
  const opened = unq(evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const b = p && p.querySelector('button[aria-label="Import view bookmarks from another job"]');
    if (!b) return 'NO-BTN'; b.click(); return 'opened';
  })()`));
  if (opened !== "opened") throw new Error(opened);
  let rows = "";
  for (let i = 0; i < 12; i++) {
    await sleep(1000);
    rows = unq(evalJs(`(() => {
      const sec = document.querySelector('[data-canvas-ui=from-job-list]');
      if (!sec) return 'NO-SEC';
      const btn = [...sec.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(sib.name).slice(0, 40)}) || b.textContent.includes('views'));
      return btn ? btn.textContent.replace(/\\s+/g, ' ').trim() : 'NO-ROW:' + sec.textContent.replace(/\\s+/g, ' ').slice(0, 80);
    })()`));
    if (!rows.startsWith("NO-SEC") && !rows.startsWith("NO-ROW") && /2 views/.test(rows)) break;
  }
  step(`  sibling row: ${rows}`);
  if (!/2 views/.test(rows)) throw new Error(`sibling row should read "2 views": ${rows}`);

  // click the sibling row → preview dialog opens with the SAME pipeline
  await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=from-job-list] button')].find(b => b.textContent.includes('views'))`,
  );
  await sleep(1200);
  const d = JSON.parse(unq(evalJs(`(() => {
    const dlg = [...document.querySelectorAll('[data-slot=dialog-content]')].find(x => x.textContent.includes('Import views'));
    if (!dlg) return 'null';
    const cbs = [...dlg.querySelectorAll('button[role=checkbox]')];
    const imp = [...dlg.querySelectorAll('button')].find(b => /^Import/.test(b.textContent.trim()));
    // Task 54 multi-source: the desc reads "parsed across N sources" and
    // the origin lives in each source group's label (the job's name)
    return { src: (dlg.textContent.match(/parsed (?:from “[^”]+”|across \\d+ sources?)/) || [''])[0],
             groups: [...dlg.querySelectorAll('[data-canvas-ui=import-source-group] span[title]')].map(x => x.getAttribute('title')),
             rows: dlg.querySelectorAll('[role=group] label').length,
             poseOnly: /pose only/.test(dlg.textContent), checked: cbs.filter(b => b.getAttribute('aria-checked') === 'true' && (b.getAttribute('aria-label')||'').startsWith('Import')).length,
             imp: imp ? imp.textContent.trim() : 'NO-BTN' };
  })()`) || "null"));
  step(`  dialog: ${JSON.stringify(d)}`);
  if (!d || !/parsed (?:across|from)/.test(d.src)) throw new Error("dialog source line missing");
  if (!(d.groups || []).some(g => (g || "").includes(sib.name))) throw new Error(`dialog group label should name the sibling job (${sib.name})`);
  if (d.rows !== 2 || !d.poseOnly || d.checked !== 2 || d.imp !== "Import 2") throw new Error("dialog pipeline wrong");

  // Import 2 → current job's row follows
  evalJs(`(() => { const b=[...document.querySelectorAll('[data-slot=dialog-content] button')].find(x=>/^Import 2$/.test(x.textContent.trim())); b?b.click():0; return 'imp'; })()`);
  await sleep(1500);
  const names = bmNames();
  step(`  server after import: ${JSON.stringify(names)}`);
  if (!(names.includes("Top view") && names.includes("Legacy pose"))) throw new Error(`import did not land: ${JSON.stringify(names)}`);
  const t = lastToasts(1);
  if (!/Imported 2 views/.test(t)) throw new Error(`expected "Imported 2 views" toast, got ${t}`);

  // counter follows + section resets on reopen
  await ensurePopover("camera-bookmarks", "Camera view bookmarks");
  const counter = unq(evalJs(`document.querySelector('[data-canvas-ui=camera-bookmarks] .ml-auto')?.textContent ?? 'NO-COUNTER'`));
  step(`  counter: ${counter}`);
  if (counter !== "2/8") throw new Error(`counter should read 2/8, got ${counter}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa45-fromjob.png`);

  // cleanup BOTH rows
  await deleteAllBookmarks();
  putBm([], sib.id);
  step(`  cleanup: cur=${JSON.stringify(bmNames())} sib=${JSON.stringify(bmNames(sib.id))}`);
};

/** PHASE C — sparkline touch tooltip (mocked feed) */
const sparkProbe = `(() => {
  const sec = document.querySelector('section[aria-label*="Recent activity"]');
  if (!sec) return { feed: false };
  const svg = [...sec.querySelectorAll('svg')].find(s => s.getAttribute('viewBox') === '0 0 40 12');
  if (!svg) return { spark: false };
  const pl = svg.querySelector('polyline');
  return { feed: true, spark: true, points: pl ? pl.getAttribute('points').split(' ').length : 0 };
})()`;

const phaseC = async () => {
  console.log("== PHASE C: sparkline touch tooltip ==");
  const mock = (p) =>
    JSON.stringify({
      jobs: [
        { id: "mock-run-45", name: "Mock CTF (running)", type: "ctffind", status: "running", progress: p, updatedAt: new Date().toISOString(), projectId: null, projectName: null },
      ],
    });
  sh(`${AB} network route "http://localhost:3000/api/activity/recent?limit=8" --body '${mock(0.3).replace(/'/g, "'\\''")}'`);
  sh(`${AB} open http://localhost:3000`);
  await sleep(4500);
  evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Dashboard'); b?b.click():0; return 'nav'; })()`);
  await sleep(2500);
  await sleep(9500); // ≥2 polls → polyline exists
  const s1 = JSON.parse(unq(evalJs(sparkProbe)) || "{}");
  step(`  spark: ${JSON.stringify(s1)}`);
  if (!s1.spark || (s1.points ?? 0) < 2) throw new Error(`sparkline missing: ${JSON.stringify(s1)}`);

  // move the mock to 60% — the folded history now has a real trend (0.3→0.6)
  sh(`${AB} network route "http://localhost:3000/api/activity/recent?limit=8" --body '${mock(0.6).replace(/'/g, "'\\''")}'`);
  await sleep(9500);
  const s2 = JSON.parse(unq(evalJs(sparkProbe)) || "{}");
  step(`  spark @60%: ${JSON.stringify(s2)}`);
  if ((s2.points ?? 0) <= s1.points) throw new Error(`sparkline points did not grow: ${JSON.stringify(s1)} -> ${JSON.stringify(s2)}`);

  // pointerdown → inverted chip pops
  const tapped = await realClick(
    `[...document.querySelectorAll('section[aria-label*="Recent activity"] svg')].find(s => s.getAttribute('viewBox') === '0 0 40 12')`,
  );
  step(`  tap: ${tapped}`);
  if (!tapped.includes("clicked@")) throw new Error("sparkline not tappable");
  await sleep(400);
  const chip = unq(evalJs(`document.querySelector('section[aria-label*="Recent activity"] [role=status]')?.textContent.replace(/\\s+/g,' ').trim() ?? 'NO-CHIP'`));
  step(`  chip: ${chip}`);
  if (!/samples · \d+%→\d+%/.test(chip)) throw new Error(`tooltip chip wrong: ${chip}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa45-spark-tip.png`);
  // auto-dismiss ~2s
  await sleep(2400);
  const chip2 = unq(evalJs(`document.querySelector('section[aria-label*="Recent activity"] [role=status]')?.textContent ?? 'GONE'`));
  step(`  chip after 2.4s: ${chip2}`);
  if (chip2 !== "GONE") throw new Error("chip did not auto-dismiss");

  sh(`${AB} network unroute`);
  sh(`${AB} open http://localhost:3000`);
  await sleep(3000);
};

/** console errors + screenshot — asserted at the end of EVERY run so a
 *  phase-split never loses the check */
const phaseErrors = async (label) => {
  const errs = sh(`${AB} errors`) || "(none)";
  step(`  console errors (${label}): ${errs}`);
  if (errs !== "(none)") throw new Error("console errors present");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa45-${label}.png`);
};

(async () => {
  if (PHASES.includes("A")) await phaseA();
  if (PHASES.includes("B")) {
    await phaseB();
    await phaseErrors("b");
  }
  if (PHASES.includes("C")) await phaseC();
  if (PHASES.includes("C") || PHASES.includes("D")) await phaseErrors("cd");
  step("ALL PHASES GREEN");
  sh(`${AB} close`); // free the ~1GB Chrome RSS — the 4GB box shares it with Turbopack
})().catch((e) => {
  step(`FATAL: ${e.message}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa45-fatal.png`);
  sh(`${AB} network unroute`);
  sh(`${AB} close`);
  process.exit(1);
});
