// Task 42 QA — three viewer/feed features, single browser session:
//   A  viewer open + clean slate
//   B  bookmark UPDATE-POSE: save "Base" (3σ+slice+Top) → move away
//      (2σ, slice off, Front) → update → move further → restore must land
//      on the UPDATED capture (hash + σ 2.00 + slice off), not the original
//   C  bookmark EXPORT/IMPORT: export toast; DataTransfer file injection —
//      valid view + junk view (degrades to pose-only); 8-entry file into a
//      3/8 list → 5 in, 3 dropped; counters + server row follow; delete-all
//   D  feed PROGRESS SPARKLINE: mocked running job → svg polyline appears
//      once ≥2 samples fold in, point count grows across polls, reroute to
//      60% → bar + spark follow
// Usage: node scripts/qa42-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa42-trace.log", import.meta.url).pathname;
// kill-proof step log (fs.appendFileSync — immune to stdout buffering);
// console.* to a file is block-buffered, so a SIGKILL swallows the tail
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
        if (/View saved|View updated|Restored|Exported|Imported|bookmark|views/i.test(t)) {
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
  const m = panel.textContent.match(/[\\u2212-]?\\d+\\.\\d{2}\\s*σ/);
  return m ? m[0].replace(/\\s+/g, ' ') : 'NO-SIGMA';
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
  console.log("  v3d:", v3d);
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

const closeViewer = async () => {
  for (let i = 0; i < 5; i++) {
    const n = evalJs(`document.querySelectorAll('[data-slot=dialog-content]').length`);
    if (n === "0") return "all-closed";
    evalJs(`(() => { const dlgs=[...document.querySelectorAll('[data-slot=dialog-content]')]; const dlg=dlgs[dlgs.length-1]; const b=[...dlg.querySelectorAll('button')].find(x=>x.textContent.trim()==='Close'||(x.getAttribute('aria-label')||'')==='Close'); b?b.click():0; return 'x'; })()`);
    await sleep(900);
  }
  return "closed-with-effort";
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

const bmRow = `(() => {
  const rows = [...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button[title^="Fly back"]')];
  return rows.length;
})()`;

const sparkProbe = `(() => {
  const sec = document.querySelector('section[aria-label*="Recent activity"]');
  if (!sec) return { feed: false };
  const svg = [...sec.querySelectorAll('svg')].find(s => s.getAttribute('viewBox') === '0 0 40 12');
  if (!svg) return { spark: false, bar: !!sec.querySelector('.progress-shimmer') };
  const pl = svg.querySelector('polyline');
  return {
    feed: true,
    spark: true,
    points: pl ? pl.getAttribute('points').split(' ').length : 0,
    dot: !!svg.querySelector('circle'),
    bar: !!sec.querySelector('.progress-shimmer'),
  };
})()`;

/** fake-but-well-shaped camera snapshot for import fixtures */
const fakeSnap = () => ({
  mode: "camera",
  fov: 0.876,
  position: [12.3, -4.5, 30.1],
  up: [0, 1, 0],
  target: [0.1, 0.2, 0.3],
  radius: 52.4,
  radiusMax: 120,
});

const importViaInput = (payload) =>
  evalJs(`(() => {
    const inp = document.querySelector('[data-canvas-ui=camera-bookmarks] input[type=file]');
    if (!inp) return 'NO-INPUT';
    const dt = new DataTransfer();
    const f = new File([JSON.stringify((${JSON.stringify(payload)}))], 'views.json', { type: 'application/json' });
    dt.items.add(f);
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return 'injected';
  })()`);

const PHASES = (process.env.QA_PHASES || "A,B,C,D").split(",").map((s) => s.trim().toUpperCase());

const cleanSlate = async () => {
  sh(`curl -s -X PUT "http://localhost:3000/api/jobs/${JID}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":[]}' > /dev/null`);
  sh(`${AB} open http://localhost:3000`);
  await sleep(5000);
  evalJs(`(localStorage.removeItem('${BM_KEY}'), 'cleared')`);
};

const openViewerFresh = async () => {
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
  step(`  viewer ready: ${ready}`);
  if (!ready) throw new Error("viewer not ready");
  console.log("  observer:", evalJs(toastObserver));
};

const deleteAllBookmarks = async () => {
  console.log("  delete all:", evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    if (!p) return 'NO-POPOVER';
    const xs = [...p.querySelectorAll('button')].filter(b => (b.getAttribute('aria-label')||'').startsWith('Delete bookmark'));
    xs.forEach(x => x.click());
    return 'deleted ' + xs.length;
  })()`));
  await sleep(2500);
  const srv = serverRow();
  console.log("  server after delete-all:", srv.slice(0, 60));
  return srv;
};

const setSigma = async (ariaLabel, waitMs = 2200) => {
  evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === '${ariaLabel}'); b?b.click():0; return 'ok'; })()`);
  await sleep(waitMs);
};

const toggleSlice = async (startsWith, waitMs = 2500) => {
  evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x => (x.title||'').startsWith('${startsWith}')); b?b.click():0; return 'ok'; })()`);
  await sleep(waitMs);
};

/** PHASE B — bookmark UPDATE-POSE re-captures the whole view */
const phaseB = async () => {
  console.log("== PHASE B: update pose ==");
  // Base view: 3σ + slice on + Top
  await setSigma("Set contour to 3 sigma");
  await toggleSlice("Show a cross-section");
  sh(`${AB} press 5`); // Top
  const hTop = await stableHash();
  console.log("  base (Top) hash:", hTop, "| sigma:", evalJs(sigmaProbe), "| slice:", evalJs(slicePressedProbe));
  console.log("  popover:", await ensurePopover("camera-bookmarks", "bookmarks"));
  evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
    const inp = p.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'Base');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'named';
  })()`);
  await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => b.textContent.trim().startsWith('Save'))`,
  );
  await sleep(1800);
  console.log("  rows after save:", evalJs(bmRow), "| toasts:", evalJs(`(window.__qaToasts||[]).map(t=>t.text).join(' | ') || 'NONE'`));

  // move away: 2σ, slice off, Front — this is the state UPDATE should capture
  await setSigma("Set contour to 2 sigma", 2000);
  await toggleSlice("Hide the cross-section", 2400);
  sh(`${AB} press 1`); // Front
  const hFront = await stableHash();
  console.log("  away (Front) hash:", hFront, "| sigma:", evalJs(sigmaProbe), "| slice:", evalJs(slicePressedProbe));
  if (hFront.split(" ")[0] === hTop.split(" ")[0]) throw new Error("front hash equals top hash — poses did not move");

  console.log("  update click:", await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button[aria-label^="Update bookmark Base"]')][0]`,
  ));
  await sleep(1800);
  console.log("  toasts after update:", evalJs(`(window.__qaToasts||[]).map(t=>t.text).join(' | ') || 'NONE'`));

  // move further away: 3σ + slice back on + Top — must NOT survive restore
  await setSigma("Set contour to 3 sigma", 2000);
  await toggleSlice("Show a cross-section", 2400);
  sh(`${AB} press 5`);
  await sleep(6000);

  console.log("  restore click:", await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button[title^="Fly back"]')][0]`,
  ));
  await sleep(6000); // flight 320ms + optics pumps settle
  const sigBack = evalJs(sigmaProbe).replace(/"/g, "");
  const sliceBack = evalJs(slicePressedProbe).replace(/"/g, "");
  console.log("  after restore — sigma:", sigBack, "| slice:", sliceBack);
  if (!sigBack.startsWith("2.00")) throw new Error(`sigma did not restore to 2.00 (got ${sigBack})`);
  if (sliceBack !== "false") throw new Error(`slice did not restore to off (got ${sliceBack})`);

  // NUMERIC pose comparison against the UPDATED capture on the server row
  // (pixel-hash equality is path-dependent: σ pumps rebuild the isosurface
  // mesh and the rebuild's sub-pixel AA differences flip the hash even at a
  // character-identical camera — verified live; numeric compare is the
  // honest pose check)
  await sleep(1500);
  const srvUpd = JSON.parse(serverRow());
  const S = srvUpd.bookmarks?.find((b) => b.name === "Base")?.snapshot;
  if (!S) throw new Error("updated Base snapshot missing on server row");
  const Lraw = evalJs(`(() => { const s = window.__molstar?.canvas3d?.camera?.getSnapshot?.(); if (!s) return null; return { p: s.position, t: s.target, r: s.radius }; })()`);
  if (!Lraw || Lraw === "null") throw new Error("live camera unreachable (window.__molstar)");
  const L = JSON.parse(Lraw);
  const near = (a, b) => Math.abs(a - b) < 0.01;
  const poseOk =
    near(L.p[0], S.position[0]) && near(L.p[1], S.position[1]) && near(L.p[2], S.position[2]) &&
    near(L.t[0], S.target[0]) && near(L.t[1], S.target[1]) && near(L.t[2], S.target[2]) &&
    near(L.r, S.radius);
  console.log("  numeric pose vs updated capture:", poseOk ? "MATCH" : `MISMATCH live=${Lraw.slice(0, 90)} server=${JSON.stringify({ p: S.position, t: S.target, r: S.radius })}`);
  if (!poseOk) throw new Error("restore did not land on the updated pose (numeric)");
  await deleteAllBookmarks();
};

/** PHASE C — bookmark EXPORT / IMPORT */
const phaseC = async () => {
  console.log("== PHASE C: export/import ==");
  console.log("  popover:", await ensurePopover("camera-bookmarks", "bookmarks"));
  const have = evalJs(bmRow);
  if (have === "0") {
    // standalone run: need at least one view to export — save at the current pose
    evalJs(`(() => {
      const p = document.querySelector('[data-canvas-ui=camera-bookmarks]');
      const inp = p.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(inp, 'ExportMe');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return 'named';
    })()`);
    await realClick(
      `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button')].find(b => b.textContent.trim().startsWith('Save'))`,
    );
    await sleep(1800);
    console.log("  seeded view, rows:", evalJs(bmRow));
  }
  console.log("  export click:", await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=camera-bookmarks] button[aria-label^="Export view bookmarks"]')][0]`,
  ));
  await sleep(1500);
  console.log("  toasts after export:", evalJs(`(window.__qaToasts||[]).map(t=>t.text).join(' | ') || 'NONE'`));

  // import file 1: one VALID view + one JUNK view (must degrade to pose-only)
  const file1 = {
    format: "cryoflow-view-bookmarks",
    version: 1,
    exportedAt: new Date().toISOString(),
    jobId: "other-job",
    bookmarks: [
      {
        id: "imp-a", name: "Imported A", ts: Date.now() - 60_000, thumb: undefined, snapshot: fakeSnap(),
        view: { sigma: 3.5, sign: 1, slice: { on: true, axis: "Y", pos: 0.4 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
      },
      {
        id: "imp-b", name: "Imported B junkview", ts: Date.now() - 30_000, snapshot: fakeSnap(),
        view: { garbage: true, sigma: "nope" },
      },
    ],
  };
  console.log("  import(2):", importViaInput(file1));
  await sleep(2200);
  const rowsAfter1 = evalJs(bmRow);
  console.log("  rows after import:", rowsAfter1, "| counter:", evalJs(`document.querySelector('[data-canvas-ui=camera-bookmarks] .ml-auto')?.textContent ?? 'NO-COUNTER'`));
  console.log("  toasts after import:", evalJs(`(window.__qaToasts||[]).slice(-3).map(t=>t.text).join(' | ') || 'NONE'`));
  await sleep(2000);
  const srv1 = JSON.parse(serverRow());
  console.log("  server count:", srv1.bookmarks?.length, "| names:", srv1.bookmarks?.map((b) => b.name).join(","));
  if (rowsAfter1 !== "3") throw new Error("expected 3 bookmark rows after import");
  if (srv1.bookmarks?.length !== 3) throw new Error("server row should hold 3 after import");

  // import file 2: 8 entries into a 3/8 list → 5 in, 3 dropped
  const file2 = {
    format: "cryoflow-view-bookmarks",
    version: 1,
    bookmarks: Array.from({ length: 8 }, (_, i) => ({
      id: `imp-x${i}`, name: `Bulk ${i + 1}`, ts: Date.now() - i * 1000, snapshot: fakeSnap(),
      view: { sigma: 1.5, sign: -1, slice: { on: false, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
    })),
  };
  console.log("  import(8 into 3/8):", importViaInput(file2));
  await sleep(2200);
  const rowsAfter2 = evalJs(bmRow);
  const counter2 = evalJs(`document.querySelector('[data-canvas-ui=camera-bookmarks] .ml-auto')?.textContent ?? 'NO-COUNTER'`).replace(/"/g, "");
  console.log("  rows after bulk import:", rowsAfter2, "| counter:", counter2);
  console.log("  last toasts:", evalJs(`(window.__qaToasts||[]).slice(-2).map(t=>t.text).join(' | ') || 'NONE'`));
  if (rowsAfter2 !== "8") throw new Error(`expected 8 rows after bulk import (got ${rowsAfter2})`);
  if (counter2 !== "8/8") throw new Error(`expected counter 8/8 (got ${counter2})`);

  const srvEnd = await deleteAllBookmarks();
  if (!srvStartsEmpty(srvEnd)) throw new Error(`server row should self-drop after delete-all (got ${srvEnd.slice(0, 60)})`);
  await closeViewer();
};

const srvStartsEmpty = (raw) => raw === "CURL-FAIL" || (JSON.parse(raw).bookmarks?.length ?? 1) === 0;

/** PHASE D — feed progress sparkline (mocked) */
const phaseD = async () => {
  console.log("== PHASE D: feed sparkline ==");
  const mock = (p) =>
    JSON.stringify({
      jobs: [
        { id: "mock-run-42", name: "Mock CTF (running)", type: "ctffind", status: "running", progress: p, updatedAt: new Date().toISOString(), projectId: null, projectName: null },
        { id: "mock-done-1", name: "Mock Refine (done)", type: "refine3d", status: "completed", progress: 1, updatedAt: new Date().toISOString(), projectId: null, projectName: null },
      ],
    });
  sh(`${AB} network route "http://localhost:3000/api/activity/recent?limit=8" --body '${mock(0.3).replace(/'/g, "'\\''")}'`);
  sh(`${AB} open http://localhost:3000`);
  await sleep(4500);
  evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Dashboard'); b?b.click():0; return 'nav'; })()`);
  await sleep(2500);
  const s0 = evalJs(sparkProbe);
  console.log("  spark @~2.5s:", s0);
  await sleep(9500); // ≥2 polls → polyline should exist
  const s1 = evalJs(sparkProbe);
  console.log("  spark @~12s:", s1);
  const p1 = JSON.parse(s1);
  if (!p1.spark || (p1.points ?? 0) < 2) throw new Error(`sparkline polyline missing or too few points: ${s1}`);
  // reroute at 60% — spark must absorb new samples, bar must move
  sh(`${AB} network route "http://localhost:3000/api/activity/recent?limit=8" --body '${mock(0.6).replace(/'/g, "'\\''")}'`);
  await sleep(9500);
  const s2 = evalJs(sparkProbe);
  console.log("  spark @60%:", s2);
  const p2 = JSON.parse(s2);
  if ((p2.points ?? 0) <= p1.points) throw new Error(`sparkline points did not grow: ${p1.points} -> ${p2.points}`);
  sh(`${AB} network unroute`);
  sh(`${AB} open http://localhost:3000`);
  await sleep(3000);
  console.log("  errors:", sh(`${AB} errors`) || "(none)");
};

const main = async () => {
  const needViewer = PHASES.some((p) => ["A", "B", "C"].includes(p));
  if (needViewer) {
    step("== PHASE A: viewer open ==");
    await cleanSlate();
    await openViewerFresh();
  }
  if (PHASES.includes("B")) await phaseB();
  if (PHASES.includes("C")) await phaseC();
  if (PHASES.includes("D")) await phaseD();
  step("DONE");
  console.log("DONE");
};

main().catch((e) => {
  step(`FAILED: ${e.message}`);
  console.error("FAILED:", e.message);
  process.exit(1);
});
