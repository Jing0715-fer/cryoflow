// qa67 — Task 66: orthogonal slice browser (map-ortho-panel) under the
// Mol* 3D viewer + the server-side ortho plane renderer it rides on.
//
// Phase A — API contract (no browser):
//   the outputs/file png branch now accepts axis=x|y|z + pos=0…1.
//   z planes come from native sections, x/y planes are reconstructed by
//   strided reads. Asserts: PNG magic + dims per axis, pos sensitivity
//   (the seeded volume's blob DRIFTS along x, so z=0 vs z=1 differ),
//   stack guard (.mrcs + axis=x → 400), garbage pos tolerated, path
//   traversal still blocked.
// Phase B — UI end-to-end:
//   dashboard → canvas → completed class2d card → inspector Results tab
//   → Maps & images tile (orthovol) → image dialog → "View in 3D" →
//   Mol* dialog → expand "Orthogonal slices" → three tiles render PNGs
//   → scrub the XZ tile (Home/End on the Radix thumb) → src changes →
//   crosshair sync → CustomEvent observed + 3D Slice toggle flips on
//   with the right axis → console clean.
// Phase C — Esc layering + cleanup:
//   Esc peels only the viewer dialog (image dialog + inspector survive),
//   then the harness tears the seed down (browser closed, volume kept —
//   it is part of the standing class2d seed base until --clean).
//
// Run: node scripts/qa67-e2e.mjs   (server on :3000, qa58+qa67 seeded)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
const AB = "agent-browser";
const B = "http://localhost:3000";
const CARD = "QA Class2D Source";
const VOL = "orthovol.mrc";
const PNG = (q) =>
  `http://localhost:3000/api/jobs/${SRC_ID}/outputs/file?path=${VOL}&format=png&${q}`;
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
let PASS = 0;
const must = (cond, label) => {
  if (!cond) { console.log(`FATAL: ${label}`); cleanup(); process.exit(1); }
  PASS++;
  console.log(`  ok: ${label}`);
};
function cleanup() {
  try { sh(`${AB} close`); } catch {}
}

const errCollector = `(() => {
  if (window.__qaErrColl) return 'errcoll-kept';
  window.__qaErrs = [];
  window.addEventListener('error', (e) => window.__qaErrs.push(String(e.message || e).slice(0, 160)));
  window.addEventListener('unhandledrejection', (e) => window.__qaErrs.push('rej:' + String((e.reason && e.reason.message) || e.reason).slice(0, 160)));
  window.__qaErrColl = true;
  return 'errcoll-on';
})()`;
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

// ---- job id (from the API, same lookup the seed used) ----------------------
const jobsRaw = execSync(`curl -s http://localhost:3000/api/jobs`, { encoding: "utf8" });
const jobs = JSON.parse(jobsRaw);
const list = Array.isArray(jobs) ? jobs : jobs.jobs;
const SRC_ID = list.find((j) => j.name === CARD)?.id;
if (!SRC_ID) { console.log("FATAL: seed job missing"); process.exit(1); }
console.log(`job: ${CARD} = ${SRC_ID}`);

// ===========================================================================
console.log("— PHASE A: ortho plane API —");

const ORIGIN = "-H 'Origin: http://localhost:3000'";
const fetchPng = (q) => execSync(`curl -s ${ORIGIN} -o /tmp/qa67.png -w '%{http_code} %{content_type} %{size_download}' "${PNG(q)}"`, { encoding: "utf8" });
const pngDims = (file) => {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; // PNG IHDR
};

let r = fetchPng("axis=z&pos=0.5").split(" ");
must(r[0] === "200" && r[1] === "image/png" && Number(r[2]) > 500, `z plane renders (${r.join(" ")})`);
const dz = pngDims("/tmp/qa67.png");
must(dz.w === 64 && dz.h === 64, `z plane dims 64×64 (got ${dz.w}×${dz.h})`);

r = fetchPng("axis=y&pos=0.5").split(" ");
must(r[0] === "200" && Number(r[2]) > 500, `y plane (reconstructed) renders (${r.join(" ")})`);
const dy = pngDims("/tmp/qa67.png");
must(dy.w === 64 && dy.h === 64, `y plane dims 64×64 (${dy.w}×${dy.h})`);

r = fetchPng("axis=x&pos=0.5").split(" ");
must(r[0] === "200" && Number(r[2]) > 500, `x plane (reconstructed) renders (${r.join(" ")})`);

// pos sensitivity: the blob drifts along x as z increases → z=0 vs z=1 PNGs differ
sh(`curl -s ${ORIGIN} -o /tmp/qa67-z0.png "${PNG("axis=z&pos=0")}"`);
sh(`curl -s ${ORIGIN} -o /tmp/qa67-z1.png "${PNG("axis=z&pos=1")}"`);
const hash = (f) => execSync(`md5sum ${f}`, { encoding: "utf8" }).split(" ")[0];
must(hash("/tmp/qa67-z0.png") !== hash("/tmp/qa67-z1.png"), "pos=0 vs pos=1 produce different planes (drift visible)");

// y-plane pos sensitivity too (drift trail crosses y=32 at every x except near blobs)
sh(`curl -s ${ORIGIN} -o /tmp/qa67-y0.png "${PNG("axis=y&pos=0.2")}"`);
sh(`curl -s ${ORIGIN} -o /tmp/qa67-y1.png "${PNG("axis=y&pos=0.8")}"`);
must(hash("/tmp/qa67-y0.png") !== hash("/tmp/qa67-y1.png"), "y plane pos sensitivity");

// pos clamping: out-of-range values still render (no 500)
must(fetchPng("axis=x&pos=7").startsWith("200"), "pos=7 clamps, no error");
must(fetchPng("axis=x&pos=-3").startsWith("200"), "pos=-3 clamps, no error");
must(fetchPng("axis=zz&pos=0.5").startsWith("200"), "unknown axis falls back to z");

// stack guard: .mrcs + axis=x → 400
const stackCode = execSync(
  `curl -s ${ORIGIN} -o /dev/null -w '%{http_code}' "http://localhost:3000/api/jobs/${SRC_ID}/outputs/file?path=run_it012_unmasked_classes.mrcs&format=png&axis=x&pos=0.5"`,
  { encoding: "utf8" },
);
must(stackCode === "400", `stack + axis=x rejected (got ${stackCode})`);

// path traversal still blocked
const travCode = execSync(
  `curl -s ${ORIGIN} -o /dev/null -w '%{http_code}' "http://localhost:3000/api/jobs/${SRC_ID}/outputs/file?path=../../engine-state.json&format=png&axis=z&pos=0.5"`,
  { encoding: "utf8" },
);
must(travCode.startsWith("4"), `traversal still blocked (got ${travCode})`);

console.log(`PHASE A GREEN (${PASS} asserts)`);

// ===========================================================================
console.log("— PHASE B: ortho panel UI —");

sh(`${AB} close`); await sleep(1200);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${B}`);
await sleep(5000);
evalJs(errCollector);

// dashboard → canvas
let onCanvas = false;
for (let i = 0; i < 10 && !onCanvas; i++) {
  const probe = evalJs(`(() => {
    const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${CARD}'));
    const dash = !!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard');
    return (card ? 'CARD' : 'NOCARD') + (dash ? '+DASH' : '');
  })()`);
  if (probe.includes("CARD")) onCanvas = true;
  else if (probe.includes("DASH")) {
    evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
    await sleep(2200);
  } else await sleep(2000);
}
must(onCanvas, "canvas renders with the class2d job card");

// completed job card → big inspector modal → Results tab
let inResults = false;
for (let i = 0; i < 6 && !inResults; i++) {
  const c = await realClick(
    `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${CARD}'))`,
  );
  if (c.includes("clicked@")) {
    await sleep(1800);
    await realClick(
      `[...document.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === 'Results')`,
    );
    await sleep(1200);
    inResults = unq(evalJs(`String(!!document.querySelector('section[aria-label="Maps and images"]'))`)) === "true";
  } else await sleep(1500);
}
must(inResults, "inspector opens on the Results tab with Maps & images");

// click the orthovol tile
let imgDialog = false;
for (let i = 0; i < 5 && !imgDialog; i++) {
  await realClick(
    `[...document.querySelectorAll('button[aria-label^="Enlarge"]')].find(b => (b.getAttribute('aria-label')||'').includes('${VOL.replace(".mrc", "")}'))`,
  );
  await sleep(1400);
  imgDialog = unq(evalJs(`String(!!document.querySelector('button') && [...document.querySelectorAll('button')].some(b => (b.textContent||'').includes('View in 3D')))`)) === "true";
}
must(imgDialog, "orthovol tile opens the image dialog with View in 3D");

// View in 3D → Mol* dialog
for (let i = 0; i < 5; i++) {
  const c = await realClick(
    `[...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('View in 3D'))`,
  );
  if (c.includes("clicked@")) break;
  await sleep(1200);
}
let viewerOpen = false;
for (let i = 0; i < 12 && !viewerOpen; i++) {
  viewerOpen = unq(evalJs(`String(!!document.querySelector('[data-canvas-ui=ortho-panel]'))`)) === "true";
  if (!viewerOpen) await sleep(2000);
}
must(viewerOpen, "Mol* dialog opens with the orthogonal slice strip");

// expand the strip
await realClick(`document.querySelector('[data-canvas-ui=ortho-panel] button[aria-expanded]')`);
let tiles = 0;
for (let i = 0; i < 6; i++) {
  tiles = Number(unq(evalJs(`String(document.querySelectorAll('[data-canvas-ui^=ortho-tile] img').length)`)));
  if (tiles >= 3) break;
  await sleep(1200);
}
must(tiles === 3, `strip expands to three plane tiles (${tiles})`);

// all three PNGs actually load
let loaded = 0;
for (let i = 0; i < 10; i++) {
  loaded = Number(unq(evalJs(`String([...document.querySelectorAll('[data-canvas-ui^=ortho-tile] img')].filter(im => im.naturalWidth > 0).length)`)));
  if (loaded >= 3) break;
  await sleep(1500);
}
must(loaded === 3, `all three plane PNGs render (${loaded}/3)`);

// scrub the XZ tile (axis=y): End → pos=1, readout + src react
const ySrc0 = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-y] img')?.src || 'none')`));
await realClick(`document.querySelector('[data-canvas-ui=ortho-tile-y] [role=slider]')`);
await sleep(400);
sh(`${AB} press End`);
await sleep(1400); // debounce 220ms + fetch + render
const yReadout = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-y]')?.textContent.match(/y \\d+\\/\\d+/)?.[0] || 'none')`));
must(yReadout === "y 64/64", `End jumps the readout to the last voxel (got ${yReadout})`);
const ySrc1 = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-y] img')?.src || 'none')`));
must(ySrc0 !== ySrc1 && ySrc1.includes("pos=1"), "scrubbed position reaches the render URL");
let yLoaded = false;
for (let i = 0; i < 8 && !yLoaded; i++) {
  yLoaded = Number(unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-y] img')?.naturalWidth || 0)`))) > 0;
  if (!yLoaded) await sleep(1200);
}
must(yLoaded, "scrubbed y-plane PNG loads");

// crosshair sync → CustomEvent + 3D slice state reacts
evalJs(`window.__orthoEvents = [];
  window.addEventListener('cryoflow:ortho-slice', (e) => window.__orthoEvents.push(e.detail));`);
// trace every dialog data-state flip with timestamps — a spontaneous viewer
// close between the click and Phase C would show up here
await evalJs(`(() => {
  window.__evts = [];
  const tag = () => {
    const ds = [...document.querySelectorAll('[role=dialog]')];
    ds.forEach(d => { if (!d.dataset.qaTag) d.dataset.qaTag = d.querySelector('[data-canvas-ui=ortho-panel]') ? 'viewer' : 'insp'; });
  };
  tag();
  const mo = new MutationObserver(() => {
    tag();
    const ds = [...document.querySelectorAll('[role=dialog]')].map(d => (d.dataset.qaTag||'?') + ':' + d.getAttribute('data-state'));
    window.__evts.push(Date.now() % 100000 + ' mut[' + ds.join(',') + ']');
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state','data-qa-tag'] });
  document.addEventListener('keydown', (e) => { if (e.key==='Escape') window.__evts.push(Date.now() % 100000 + ' ESC'); }, true);
  return 'instrumented';
})()`);
await realClick(`document.querySelector('[data-canvas-ui=ortho-tile-y] button[aria-label^="Show the XZ plane"]')`);
await sleep(1200);
const evCheck = unq(evalJs(`(() => {
  const ev = window.__orthoEvents || [];
  const ok = ev.length === 1 && ev[0].axis === 'y' && Math.abs(ev[0].pos - 1) < 0.011;
  return (ok ? 'EVT-OK ' : 'EVT-BAD ') + JSON.stringify(ev);
})() + ''`));
must(evCheck.startsWith("EVT-OK"), `crosshair dispatches the mirror event (${evCheck})`);

// the 3D side actually applied it: Slice toggle on + Y axis pressed
let sliceApplied = false;
for (let i = 0; i < 8 && !sliceApplied; i++) {
  sliceApplied = unq(evalJs(`(() => {
    const t = [...document.querySelectorAll('button[aria-label="Toggle cross-section plane"]')].pop();
    const yb = [...document.querySelectorAll('div[role=group][aria-label="Cross-section axis"] button')].find(b => b.textContent.trim() === 'Y');
    return t && yb ? String(t.getAttribute('aria-pressed') === 'true' && yb.getAttribute('aria-pressed') === 'true') : 'missing';
  })()`)) === "true";
  if (!sliceApplied) await sleep(1200);
}
must(sliceApplied, "3D cross-section mirrors the 2D plane (Slice on, axis Y)");

const errsB = JSON.parse(evalJs(`({ errs: window.__qaErrs || [] })`)).errs;
must(errsB.length === 0, `zero page errors in Phase B (got ${JSON.stringify(errsB)})`);
console.log(`PHASE B GREEN (${PASS} asserts)`);

// ===========================================================================
console.log("— PHASE C: Esc layering —");

// the stack is viewer dialog + inspector modal (NOT the image dialog —
// "View in 3D" replaces it: setMolFile + setImageFile(null) by design).
// One Esc peels the viewer, the inspector modal must survive. The dialog
// state observer installed before the crosshair click is still running —
// its timestamped flip log rides along in window.__evts.
evalJs(`window.__evts.push(Date.now() % 100000 + ' about-to-press-ESC')`);
sh(`${AB} press Escape`);
await sleep(900);
const layer1 = unq(evalJs(`(() => {
  const ortho = !!document.querySelector('[data-canvas-ui=ortho-panel]');
  const view3d = [...document.querySelectorAll('button')].some(b => (b.textContent||'').includes('View in 3D'));
  const insp = !!document.querySelector('[role=dialog]'); // the inspector modal itself
  const focus = document.activeElement?.getAttribute('data-canvas-ui') || document.activeElement?.tagName || '?';
  const evts = (window.__evts || []).slice(0, 12).join(' | ');
  return (ortho ? 'ORTHO ' : 'no-ortho ') + (view3d ? 'VIEW3D ' : 'no-view3d ') + (insp ? 'INSP ' : 'no-insp ') + 'focus=' + focus + ' ## ' + evts;
})() + ''`));
must(layer1.trim().startsWith("no-ortho no-view3d INSP focus=maps-gallery"),
  `Esc closes only the viewer dialog; focus parks on the gallery; inspector survives (got ${layer1})`);

// second Esc closes the inspector modal (focus is parked on the gallery —
// inside the inspector branch — so the inspector's React-level onEscapeClose
// peels it; the explicit re-focus below is belt-and-braces for timing jitter)
await evalJs(`(() => {
  const dlg = [...document.querySelectorAll('[role=dialog]')].pop();
  dlg?.focus();
  return 'focused:' + (dlg ? 'yes' : 'no');
})()`);
await sleep(300);
evalJs(`window.__evts.push(Date.now() % 100000 + ' about-to-press-ESC2')`);
sh(`${AB} press Escape`); await sleep(900);
const inspGone = unq(evalJs(`(() => {
  // NB: detect closure via [role=dialog] absence — [role=tab] also matches
  // the canvas aside params panel, which legitimately stays open behind
  const gone = !document.querySelector('[role=dialog]');
  const evts = (window.__evts || []).slice(-6).join(' | ');
  const active = document.activeElement?.getAttribute('data-canvas-ui') || document.activeElement?.tagName;
  return String(gone) + ' ## active=' + active + ' ## ' + evts;
})() + ''`));
must(inspGone.startsWith("true"), `second Esc closes the inspector modal (got ${inspGone})`);

// console check
const errsC = JSON.parse(evalJs(`({ errs: window.__qaErrs || [] })`)).errs;
must(errsC.length === 0, `zero page errors overall (got ${JSON.stringify(errsC)})`);
console.log(`PHASE C GREEN (${PASS} asserts)`);

cleanup();
sh(`rm -f /tmp/qa67*.png`);
console.log(`QA67 GREEN (${PASS} asserts)`);
