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
// Run: node scripts/qa67-e2e.mjs   (server on :3000; self-seeds since Task 161)
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
// t631 — the forensics must be dumped BEFORE cleanup closes the browser;
// a camera that dies with the crime scene is a decoration, not a camera.
const dumpForensics = () => {
  try {
    const out = execSync(`${AB} eval --stdin`, {
      encoding: "utf8", timeout: 15_000,
      input: `JSON.stringify({md: (window.__mdLog||[]).slice(0,20), errs: (window.__qaErrs||[]).slice(0,6), url: location.href.slice(0,50)})`,
    }).trim();
    console.log(`  [forensics] ${out}`);
  } catch { console.log(`  [forensics] unavailable (browser gone)`); }
};
const must = (cond, label) => {
  if (!cond) { console.log(`FATAL: ${label}`); dumpForensics(); cleanup(); process.exit(1); }
  PASS++;
  console.log(`  ok: ${label}`);
};
function cleanup() {
  try { sh(`${AB} close`); } catch {}
  // t630 rollout — the tenant's radius first (orthovol.mrc is a TENANT of
  // the qa58 pair's workdir), then the host pair goes home through the
  // seeder's take-home (radius + product-door DELETE). Tenant BEFORE host
  // — the iron law's second clause; reversed order leaves a dangling
  // engine-state entry (t629's Z7 fail class).
  try { sh("python3 /home/z/my-project/scripts/qa67-seed-volume.py --clean"); } catch (e) { console.log(`  tenant clean warn: ${String(e).slice(0, 90)}`); }
  try { sh("python3 /home/z/my-project/scripts/qa58-seed-gallery.py --take-home"); } catch (e) { console.log(`  take-home warn: ${String(e).slice(0, 90)}`); }
}

const errCollector = `(() => {
  if (window.__qaErrColl) return 'errcoll-kept';
  window.__qaErrs = [];
  window.addEventListener('error', (e) => window.__qaErrs.push(String(e.message || e).slice(0, 160)));
  window.addEventListener('unhandledrejection', (e) => window.__qaErrs.push('rej:' + String((e.reason && e.reason.message) || e.reason).slice(0, 160)));
  // t631 forensic camera — did the CDP mouse events actually reach the page?
  window.__mdLog = [];
  ['mousedown','mouseup','click'].forEach(t => window.addEventListener(t, (e) => {
    if (window.__mdLog.length < 40) window.__mdLog.push(t + '@' + Math.round(e.clientX) + ',' + Math.round(e.clientY) + ' trusted:' + e.isTrusted + ' on:' + (e.target.tagName || '?') + '.' + String(e.target.className || '').slice(0, 20));
  }, true));
  window.__qaErrColl = true;
  return 'errcoll-on';
})()`;
const realClick = async (findExpr) => {
  // t631 — the moving-target lesson, upgraded from the blind-coordinates
  // lesson: the canvas auto-pans itself back after scrollIntoView (~120px
  // drift within 1s), so ANY coordinate measured at scroll time is stale
  // by the time the click lands. The sighted click: scroll only if the
  // element is out of view, wait for the pan to settle, re-measure, and
  // verify with elementFromPoint that the element (or a descendant) really
  // is under the crosshair BEFORE firing the mouse sequence.
  for (let round = 0; round < 6; round++) {
    const st = evalJs(`(() => {
      const el = (${findExpr}); if (!el) return null;
      const r0 = el.getBoundingClientRect();
      if (r0.bottom < 0 || r0.top > window.innerHeight) el.scrollIntoView({ block: 'center' });
      return 'scrolled';
    })()`);
    if (!st || st === "null") return "NO-ELEMENT";
    await sleep(600); // let any auto-pan / pan-restore settle
    // t631 encoding lesson — return the OBJECT, not JSON.stringify(it):
    // the CLI JSON-encodes whatever eval returns, so a string return gets
    // double-encoded and JSON.parse hands back the inner STRING whose
    // .covered is undefined — the sighted click then never fires.
    const pos = () => evalJs(`(() => {
      const el = (${findExpr}); if (!el) return null;
      const r = el.getBoundingClientRect();
      const x = Math.round(r.x + r.width/2), y = Math.round(r.y + r.height/2);
      const hit = (y < 0 || y > window.innerHeight) ? null : document.elementFromPoint(x, y);
      return { x, y, covered: !!hit && (hit === el || el.contains(hit)) };
    })()`);
    const s1 = JSON.parse(await pos());
    if (!s1 || s1.covered === undefined) return "NO-ELEMENT";
    await sleep(600); // second sample — the canvas layout animation must be DONE
    const c = JSON.parse(await pos());
    if (!c || c.covered === undefined) return "NO-ELEMENT";
    // t631 — 2px tolerance: dialogs with lazy images shift layout while
    // loading; exact-equality stability was too brittle (UNVERIFIED loops).
    const stable = Math.abs(s1.x - c.x) <= 2 && Math.abs(s1.y - c.y) <= 2;
    if (process.env.QA67_DEBUG) console.log(`    [dbg] r${round}: s1=${JSON.stringify(s1)} s2=${JSON.stringify(c)} stable=${stable}`);
    if (c.covered && stable) {
      sh(`${AB} mouse move ${c.x} ${c.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${c.x},${c.y}`;
    }
    await sleep(400);
  }
  return "UNVERIFIED"; // never fire blind — the caller's loop will retry
};

// ---- job id (from the API, same lookup the seed used) ----------------------
// Task 161 — self-seed (Task 87 doctrine, same as qa66): the ortho chain
// consumes qa58's class2d base (star/mrcs/entry) AND qa67's orthovol.
// Earlier suites' cleans legitimately remove the landlord's own files
// (the cleanup-radius protocol — qa_lib.py), so "the standing world" is
// NOT a contract. Seeding here makes the suite order-independent:
// qa59 → qa67 back-to-back must work without a qa66 in between.
sh("python3 /home/z/my-project/scripts/qa58-seed-gallery.py >/dev/null 2>&1");
sh("python3 /home/z/my-project/scripts/qa67-seed-volume.py >/dev/null 2>&1");
console.log("  ok: self-seeded (qa58 base + qa67 volume, Task 87 doctrine)");
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
// t631 — NO emulated viewport: `set viewport 1600 900` renders the page in
// a 1600×900 space while CDP mouse events fire in the physical window's
// 1280×577 space (overlay, top-left anchored, no scaling). Anything below
// y=577 is visible-and-verifiable to eval but UNREACHABLE to the mouse —
// the exact void where the orthovol clicks died. Keep page == window and
// let the sighted click scroll within the page instead.
sh(`${AB} open ${B}`);
await sleep(5000);
evalJs(errCollector);

// dashboard → canvas
// t631 — the vacuous-truth bug: the old probe returned 'CARD'/'NOCARD' and
// checked `probe.includes("CARD")` — "NOCARD" CONTAINS "CARD", so the probe
// was true from iteration zero whether or not any canvas existed. It never
// verified anything; the suite marched onto empty canvases (jobs stream in
// asynchronously) and clicked into the void. Honest booleans + explicit
// job-card count now.
let onCanvas = false;
for (let i = 0; i < 14 && !onCanvas; i++) {
  const stRaw = evalJs(`JSON.stringify((() => {
    const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${CARD}'));
    const h1 = (document.querySelector('h1')||{}).textContent || '';
    return { card: !!card, dash: h1.includes('Dashboard'), jobCards: document.querySelectorAll('[data-job]').length };
  })())`);
  let st = {};
  try { const once = JSON.parse(stRaw); st = typeof once === "string" ? JSON.parse(once) : once; } catch {}
  if (process.env.QA67_DEBUG) console.log(`    [trace] i${i}: card=${st.card} dash=${st.dash} jobCards=${st.jobCards}`);
  if (st.card && (st.jobCards || 0) > 0) { onCanvas = true; break; }
  if (st.dash) {
    evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
    await sleep(2200);
  } else await sleep(2000);
}
must(onCanvas, "canvas renders with the class2d job card");

// t631 bisect — run the suite's OWN boot + one sighted click, then stop and
// dump. Discriminates "the boot poisons the session" from "a later step does".
if (process.env.QA67_ONLY_BOOT) {
  const state = unq(evalJs(`JSON.stringify({h1: (document.querySelector('h1')||{}).textContent, roleBtns: document.querySelectorAll('[role=button]').length, qaCard: [...document.querySelectorAll('[role=button]')].filter(x => (x.textContent||'').includes('QA Class2D Source')).length, anyQAText: document.body.textContent.includes('QA Class2D Source')})`));
  console.log(`  [bisect] page state: ${state}`);
  const r = await realClick(`[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${CARD}'))`);
  console.log(`  [bisect] card realClick -> ${r}`);
  await sleep(2500);
  const inspector = unq(evalJs(`String([...document.querySelectorAll('[role=tab]')].some(t=>['Overview','Log','Results','Files'].includes(t.textContent.trim())))`));
  const md = unq(evalJs(`JSON.stringify((window.__mdLog||[]).slice(0,8))`));
  console.log(`  [bisect] inspector=${inspector} mdLog=${md}`);
  process.exit(inspector === "true" ? 0 : 3);
}

// completed job card → big inspector modal → Results tab
// t631 — the toggle death-spiral lesson: on a slow (OOM-night) render the
// fixed 1800ms window can miss the modal's tabs; the loop then re-clicks
// the CARD, which TOGGLES the modal closed. Ask the dialog's state first,
// poll for the tab (waiting law), and never blind-click the card while the
// inspector is already open.
let inResults = false;
for (let i = 0; i < 8 && !inResults; i++) {
  const inspectorOpen = unq(evalJs(`String([...document.querySelectorAll('[role=tab]')].some(t => ['Overview','Log','Results','Files'].includes(t.textContent.trim())))`)) === "true";
  if (!inspectorOpen) {
    const c = await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${CARD}'))`,
    );
    if (!c.includes("clicked@")) { await sleep(1500); continue; }
    let opened = false;
    for (let w = 0; w < 12 && !opened; w++) { await sleep(500); opened = unq(evalJs(`String([...document.querySelectorAll('[role=tab]')].some(t => ['Overview','Log','Results','Files'].includes(t.textContent.trim())))`)) === "true"; }
    if (!opened) continue;
  }
  let tabFound = false;
  for (let w = 0; w < 8 && !tabFound; w++) { await sleep(400); tabFound = unq(evalJs(`String([...document.querySelectorAll('[role=tab]')].some(t => t.textContent.trim() === 'Results'))`)) === "true"; }
  if (!tabFound) continue;
  await realClick(
    `[...document.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === 'Results')`,
  );
  let sec = false;
  for (let w = 0; w < 10 && !sec; w++) { await sleep(500); sec = unq(evalJs(`String(!!document.querySelector('section[aria-label="Maps and images"]'))`)) === "true"; }
  inResults = sec;
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
// t631 — 15s starved the server-side slice reconstruction (strided reads
// for x/y planes) on a memory-pressured night; 60s is still honest — the
// images DO arrive, they just render at OOM-night speed.
let loaded = 0;
for (let i = 0; i < 30; i++) {
  loaded = Number(unq(evalJs(`String([...document.querySelectorAll('[data-canvas-ui^=ortho-tile] img')].filter(im => im.naturalWidth > 0).length)`)));
  if (loaded >= 3) break;
  await sleep(2000);
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
// t631 — the fixed 1400ms window assumed debounce+state+render beats
// memory pressure; poll for the src propagation instead.
let ySrc1 = "";
for (let i = 0; i < 15; i++) {
  ySrc1 = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-y] img')?.src || 'none')`));
  if (ySrc1 !== ySrc0 && ySrc1.includes("pos=1")) break;
  await sleep(1000);
}
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
