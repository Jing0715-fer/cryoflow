// Task 48 QA — single browser session:
//   A  Saved-views GALLERY: seed a bookmark with thumb+view → dashboard
//      renders the cross-project wall (name, σ/slice chips, job·project
//      breadcrumb) → click a card → deep-links to the canvas with the
//      pending-view handoff in sessionStorage
//   B  PENDING-VIEW RESTORE: open the 3D viewer → once its bookmark list
//      loads, the pending view is consumed (key cleared), a toast names
//      the view, σ jumps to the bookmark's 3.00 and Slice flips on
//   C  console + cleanup: PUT [] → gallery section disappears (honest
//      empty) → console 0 errors
// Usage: QA_PHASES=A,B,C node scripts/qa48-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa48-trace.log", import.meta.url).pathname;
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
const PKEY = "cryoflow:pending-view";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 90_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));
const PHASES = (process.env.QA_PHASES || "A,B,C").split(",").map((s) => s.trim().toUpperCase());

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
        if (/restored|Saved view|not found/i.test(t)) {
          window.__qaToasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 200) });
        }
      }
    }
  });
  window.__qaMo.observe(document.body, { childList: true, subtree: true });
  return 'observer-on';
})()`;
const lastToasts = (n = 2) => unq(evalJs(`(window.__qaToasts||[]).slice(-${n}).map(t=>t.text).join(' | ') || 'NONE'`));

const putBm = (list, jid = JID) => {
  for (let i = 0; i < 3; i++) {
    try {
      sh(`curl -s --max-time 30 -X PUT "http://localhost:3000/api/jobs/${jid}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":${JSON.stringify(list)}}'`);
      return;
    } catch { sleep(2500); } // transient (OOM restart window) — retry
  }
};

const openDashboard = async () => {
  sh(`${AB} open http://localhost:3000`);
  await sleep(4500);
  evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Dashboard'); b?b.click():0; return 'nav'; })()`);
  await sleep(2500);
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

// σ text from the CONTOUR PANEL (scoped — bookmark chips carry σ text too)
const sigmaProbe = `(() => {
  const panel = [...document.querySelectorAll('div')].find(d => d.className?.includes?.('rounded-2xl') && d.textContent.includes('Contour'));
  if (!panel) return 'NO-PANEL';
  const m = panel.textContent.match(/([\\u2212-]?\\d+\\.\\d{2})\\s*σ/);
  return m ? m[1] : 'NO-SIGMA';
})()`;

const galleryProbe = () => J(`(() => {
  const sec = document.querySelector('section[aria-label="Saved 3D views across all projects"]');
  if (!sec) return null;
  return {
    header: (sec.querySelector('h2')?.textContent || '').trim(),
    meta: (sec.querySelector('h2')?.nextElementSibling?.textContent || '').replace(/\\s+/g, ' ').trim(),
    cards: [...sec.querySelectorAll('button[title^="Open “"]')].map(b => ({
      title: (b.getAttribute('title') || '').slice(0, 90),
      name: (b.querySelector('span.truncate')?.textContent || '').trim(),
      chips: [...b.querySelectorAll('span.font-mono')].map(x => x.textContent.trim()),
      hasImg: !!b.querySelector('img'),
      crumb: ([...b.querySelectorAll('span')].find(s => (s.className || '').includes('mt-0'))?.textContent || '').replace(/\\s+/g, ' ').trim(),
    })),
  };
})()`);

/** PHASE A — gallery wall + deep-link handoff */
const phaseA = async () => {
  console.log("== PHASE A: gallery wall ==");
  // generate a real thumbnail via canvas so the wall shows a picture
  const THUMB = unq(evalJs(`(() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 40;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 64, 40);
    g.addColorStop(0, '#0f766e'); g.addColorStop(1, '#134e4a');
    x.fillStyle = g; x.fillRect(0, 0, 64, 40);
    x.fillStyle = 'rgba(255,255,255,0.85)';
    x.beginPath(); x.arc(32, 20, 8, 0, Math.PI * 2); x.fill();
    return c.toDataURL('image/png');
  })()`));
  if (!THUMB.startsWith("data:image/png;base64,")) throw new Error(`thumb gen failed: ${THUMB.slice(0, 40)}`);
  const seed = [{
    id: "qa48v1",
    name: "Gallery Top",
    ts: Date.now(),
    thumb: THUMB,
    snapshot: { mode: "camera", fov: 0.876, position: [12.3, -4.5, 30.1], up: [0, 1, 0], target: [0.1, 0.2, 0.3], radius: 52.4, radiusMax: 120, fog: 0, clipFar: 0, minNear: 0, minFar: 0 },
    view: { sigma: 3, sign: 1, slice: { on: true, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
  }];
  putBm(seed);
  const back = sh(`curl -s --max-time 20 "http://localhost:3000/api/jobs/${JID}/camera-bookmarks"`).replace(/\s+/g, "").slice(0, 80);
  step(`  seeded: ${back}`);

  await openDashboard();
  let g = null;
  for (let i = 0; i < 10 && !g; i++) {
    await sleep(2000);
    g = galleryProbe();
  }
  step(`  gallery: ${JSON.stringify(g)?.slice(0, 300)}`);
  if (!g) throw new Error("gallery section missing after seeding");
  if (g.header !== "Saved views") throw new Error(`header wrong: ${g.header}`);
  if (!/\d+ bookmarks? · \d+ jobs? · click to jump/.test(g.meta)) throw new Error(`meta wrong: ${g.meta}`);
  const card = g.cards.find((c) => c.name === "Gallery Top");
  if (!card) throw new Error(`card missing: ${JSON.stringify(g.cards)}`);
  if (!card.hasImg) throw new Error("thumbnail img missing");
  if (!card.chips.some((c) => c === "3.00 σ")) throw new Error(`σ chip wrong: ${card.chips}`);
  if (!card.chips.some((c) => c === "slice Z")) throw new Error(`slice chip wrong: ${card.chips}`);
  if (!card.crumb.includes("·")) throw new Error(`breadcrumb wrong: ${card.crumb}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa48-gallery.png`);

  // click → deep-link: view flips to canvas + pending handoff is set.
  // el.click() direct — coordinate clicks proved flaky here (qa46 lesson)
  const clk = unq(evalJs(`(() => {
    const b = [...document.querySelectorAll('section[aria-label="Saved 3D views across all projects"] button')]
      .find(x => (x.getAttribute('title')||'').includes('Gallery Top'));
    if (!b) return 'NO-CARD';
    b.click(); return 'clicked';
  })()`));
  step(`  card click: ${clk}`);
  if (clk !== "clicked") throw new Error(clk);
  await sleep(3000);
  const st = J(`({ pending: (() => { try { return JSON.parse(sessionStorage.getItem('${PKEY}') || 'null'); } catch { return 'BAD'; } })(), onDash: [...document.querySelectorAll('h1')].some(h => h.textContent.trim() === 'Dashboard') })`);
  step(`  after click: pending=${JSON.stringify(st.pending)} onDash=${st.onDash}`);
  if (st.onDash) throw new Error("still on dashboard — deep link did not navigate");
  if (!st.pending || st.pending.jobId !== JID || st.pending.bookmarkId !== "qa48v1")
    throw new Error(`pending handoff wrong: ${JSON.stringify(st.pending)}`);
};

/** PHASE B — viewer consumes the pending view */
const phaseB = async () => {
  console.log("== PHASE B: pending-view restore ==");
  // self-seed when run standalone (fresh browser = empty sessionStorage);
  // the bookmark row must still exist on the server (phase A/C seed it)
  const seeded = unq(evalJs(`(() => {
    const k = sessionStorage.getItem('${PKEY}');
    if (k) return 'had:' + k.slice(0, 60);
    sessionStorage.setItem('${PKEY}', JSON.stringify({ jobId: '${JID}', bookmarkId: 'qa48v1' }));
    return 'seeded';
  })()`));
  step(`  pending: ${seeded}`);
  // re-seed the server row — standalone batches run across OOM restarts
  // and a previous batch's phase C may have wiped it
  putBm([{
    id: "qa48v1",
    name: "Gallery Top",
    ts: Date.now(),
    snapshot: { mode: "camera", fov: 0.876, position: [12.3, -4.5, 30.1], up: [0, 1, 0], target: [0.1, 0.2, 0.3], radius: 52.4, radiusMax: 120, fog: 0, clipFar: 0, minNear: 0, minFar: 0 },
    view: { sigma: 3, sign: 1, slice: { on: true, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
  }]);
  step("  server row re-seeded");
  evalJs(toastObserver);
  const ready = await openViewer();
  if (!ready) {
    const errs = sh(`${AB} errors`) || "(none)";
    step(`  viewer-not-ready console: ${errs.slice(0, 300)}`);
    throw new Error("viewer never became ready");
  }
  await sleep(1500);

  const st = J(`({ pending: sessionStorage.getItem('${PKEY}'), sigma: (${sigmaProbe}) })`);
  const toasts = lastToasts(3);
  step(`  after ready: pending=${st.pending} sigma=${st.sigma}`);
  step(`  toasts: ${toasts}`);
  // getItem returns null when the key is gone — that IS the consumed state
  if (st.pending != null && st.pending !== "")
    throw new Error(`pending not consumed: ${st.pending}`);
  if (!/Gallery Top.*restored|restored.*Gallery Top/i.test(toasts))
    throw new Error(`restore toast missing: ${toasts}`);
  if (st.sigma !== "3.00") throw new Error(`sigma did not fly to 3.00: ${st.sigma}`);

  const sliceOn = unq(evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-pressed') !== null && x.textContent.trim() === 'Slice');
    return b ? b.getAttribute('aria-pressed') : 'NO-TOGGLE';
  })()`));
  step(`  slice toggle: ${sliceOn}`);
  if (sliceOn !== "true") throw new Error(`slice did not ride along: ${sliceOn}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa48-restored.png`);
};

/** PHASE C — cleanup + console + honest empty state */
const phaseC = async () => {
  console.log("== PHASE C: cleanup ==");
  putBm([]);
  evalJs(`sessionStorage.removeItem('${PKEY}'); 'cleared'`);
  const row = sh(`curl -s --max-time 20 "http://localhost:3000/api/jobs/${JID}/camera-bookmarks"`).replace(/\s+/g, "");
  step(`  server row after clean: ${row.slice(0, 60)}`);
  if (!row.startsWith('{"bookmarks":[]}')) throw new Error(`server row not clean: ${row.slice(0, 80)}`);

  // filter CLI command-failure artifacts (✗ lines — the agent-browser CLI
  // records its own failed commands in the same buffer); the contract is
  // about PAGE errors (RangeError etc.), which survive the filter
  const errsRaw = sh(`${AB} errors`) || "(none)";
  const errs = errsRaw.split("\n").filter(l => !l.startsWith("✗") && l.trim() !== "").join(" || ") || "(none)";
  step(`  console errors: ${errs}`);
  if (errs !== "(none)") throw new Error("console errors present");

  // gallery honest-empty: after reload the section is gone
  await openDashboard();
  await sleep(2000);
  const g = galleryProbe();
  step(`  gallery after clean: ${JSON.stringify(g)}`);
  if (g !== null) throw new Error("gallery still renders with no bookmarks");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa48-final.png`);
};

(async () => {
  if (PHASES.includes("A")) await phaseA();
  else {
    // standalone batches: land on the canvas first (root view) — phase B
    // opens the viewer from here, phase C only needs the page alive
    sh(`${AB} open http://localhost:3000`);
    await sleep(5000);
  }
  if (PHASES.includes("B")) await phaseB();
  if (PHASES.includes("C")) await phaseC();
  step("ALL PHASES GREEN");
  sh(`${AB} close`);
})().catch((e) => {
  step(`FATAL: ${e.message}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa48-fatal.png`);
  sh(`${AB} close`);
  process.exit(1);
});
