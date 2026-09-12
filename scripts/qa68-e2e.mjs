// qa68 — Task 67: bidirectional 3D↔2D slice linkage.
//
// Phase A — dims in the outputs listing:
//   volume mrc files now carry `dims: [nx,ny,nz]` (stacks don't) — the
//   orthogonal panel's voxel readouts ride on it.
// Phase B — reverse sync (3D → 2D) + voxel readouts:
//   open the viewer + ortho panel, mirror a tile into 3D (⌖), then drive
//   the 3D cross-section (End on the position slider, axis switch to Y)
//   and assert the matching 2D tile FOLLOWS (readout in voxel indices,
//   render URL updated, cyan flash) while the other tiles hold still;
//   the event loop must terminate (srcs stabilize).
// Phase C — layering sanity: one Esc still peels only the viewer.
//
// Run: node scripts/qa68-e2e.mjs   (server on :3000, qa58+qa67 seeded)
import { execSync } from "node:child_process";
const AB = "agent-browser";
const B = "http://localhost:3000";
const CARD = "QA Class2D Source";
const VOL = "orthovol.mrc";
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

// ---- job id ----------------------------------------------------------------
const jobsRaw = execSync(`curl -s http://localhost:3000/api/jobs`, { encoding: "utf8" });
const jobs = JSON.parse(jobsRaw);
const list = Array.isArray(jobs) ? jobs : jobs.jobs;
const SRC_ID = list.find((j) => j.name === CARD)?.id;
if (!SRC_ID) { console.log("FATAL: seed job missing"); process.exit(1); }

// ===========================================================================
console.log("— PHASE A: dims in the outputs listing —");

const raw = execSync(`curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/jobs/${SRC_ID}/outputs"`, { encoding: "utf8" });
const data = JSON.parse(raw);
const vol = data.files.find((f) => f.name === VOL);
const stack = data.files.find((f) => f.name === "run_it012_unmasked_classes.mrcs");
must(!!vol && Array.isArray(vol.dims) && vol.dims.join(",") === "64,64,64",
  `volume carries dims [64,64,64] (got ${vol && JSON.stringify(vol.dims)})`);
must(vol?.slices === 64, "volume slices count intact");
must(!!stack && stack.slices === 8 && stack.dims === undefined,
  `stack keeps slices-only (dims absent — got ${stack && JSON.stringify(stack.dims)})`);

console.log(`PHASE A GREEN (${PASS} asserts)`);

// ===========================================================================
console.log("— PHASE B: reverse sync (3D → 2D) —");

sh(`${AB} close`); await sleep(1200);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${B}`);
await sleep(5000);
evalJs(errCollector);

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

let inResults = false;
for (let i = 0; i < 6 && !inResults; i++) {
  const c = await realClick(
    `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${CARD}'))`,
  );
  if (c.includes("clicked@")) {
    await sleep(1800);
    await realClick(`[...document.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === 'Results')`);
    await sleep(1200);
    inResults = unq(evalJs(`String(!!document.querySelector('section[aria-label="Maps and images"]'))`)) === "true";
  } else await sleep(1500);
}
must(inResults, "inspector opens on the Results tab with Maps & images");

for (let i = 0; i < 5; i++) {
  await realClick(
    `[...document.querySelectorAll('button[aria-label^="Enlarge"]')].find(b => (b.getAttribute('aria-label')||'').includes('orthovol'))`,
  );
  await sleep(1400);
  if (unq(evalJs(`String([...document.querySelectorAll('button')].some(b => (b.textContent||'').includes('View in 3D')))`)) === "true") break;
  await sleep(800);
}
for (let i = 0; i < 5; i++) {
  await realClick(`[...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('View in 3D'))`);
  await sleep(1500);
  if (unq(evalJs(`String(!!document.querySelector('[data-canvas-ui=ortho-panel]'))`)) === "true") break;
}
let viewerOpen = false;
for (let i = 0; i < 10 && !viewerOpen; i++) {
  viewerOpen = unq(evalJs(`String(!!document.querySelector('[data-canvas-ui=ortho-panel]'))`)) === "true";
  if (!viewerOpen) await sleep(2000);
}
must(viewerOpen, "Mol* dialog opens with the orthogonal slice strip");

await realClick(`document.querySelector('[data-canvas-ui=ortho-panel] button[aria-expanded]')`);
let tiles = 0;
for (let i = 0; i < 6 && tiles < 3; i++) {
  tiles = Number(unq(evalJs(`String(document.querySelectorAll('[data-canvas-ui^=ortho-tile] img').length)`)));
  if (tiles < 3) await sleep(1200);
}
must(tiles === 3, `strip expands to three plane tiles (${tiles})`);

// voxel readouts ride on dims: pos 0.5 of 64 → index 33 (1-based)
let readout = "";
for (let i = 0; i < 8 && !readout; i++) {
  readout = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-z]')?.textContent.match(/z \\d+\\/\\d+/)?.[0] || '')`));
  if (!readout) await sleep(900); // dims fetch may still be in flight
}
must(readout === "z 33/64", `XY tile readout shows the voxel index (got ${readout || "none"})`);

// ⌖ mirror the XY plane into 3D (slice on, axis z, pos = 0.5)
await realClick(`document.querySelector('[data-canvas-ui=ortho-tile-z] button[aria-label^="Show the XY plane"]')`);
await sleep(1200);
// the 3D cross-section row must be alive before we drive it
let slice3d = "";
for (let i = 0; i < 8 && !slice3d.startsWith("OK"); i++) {
  slice3d = unq(evalJs(`(() => {
    const t = [...document.querySelectorAll('button[aria-label="Toggle cross-section plane"]')].pop();
    const s = document.querySelector('[role=slider][aria-label^="Cross-section plane position"]');
    if (!t) return 'NO-TOGGLE';
    if (!s) return 'NO-SLIDER';
    return 'OK pressed=' + t.getAttribute('aria-pressed');
  })()`));
  if (!slice3d.startsWith("OK")) await sleep(1200);
}
must(slice3d.startsWith("OK") && slice3d.includes("true"),
  `crosshair lights the 3D cross-section (got ${slice3d})`);

// drive the 3D position slider to the far edge (End → pos = 1)
await realClick(`document.querySelector('[role=slider][aria-label^="Cross-section plane position"]')`);
await sleep(400);
sh(`${AB} press End`);
// Task 160 window fix: the flash window is 650ms (FOLLOW_FLASH_MS), but a
// single agent-browser eval COLD-STARTS a CLI process per call (~0.3-1s
// under load) — one sample can easily land after the flash has already
// cleared, which is exactly what started failing under this round's load
// (playwright sampling caught the flash alive at t≈2ms AND t≈1062ms, so
// the product and the echo chain are fine). Sample THROUGH the window:
// any sighting of the cyan border inside ~2.5s is the same assertion.
let zFlash = "false";
for (let i = 0; i < 20 && zFlash !== "true"; i++) {
  zFlash = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-z]')?.className.includes('border-cyan-500') || false)`));
  if (zFlash !== "true") await sleep(120);
}
must(zFlash === "true", "driven tile flashes cyan while following");
await sleep(1400); // debounce + fetch + render
const zReadout = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-z]')?.textContent.match(/z \\d+\\/\\d+/)?.[0] || 'none')`));
must(zReadout === "z 64/64", `3D slider drives the XY tile (got ${zReadout})`);
const zSrc = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-z] img')?.src || 'none')`));
must(zSrc.includes("axis=z&pos=1"), "followed position reaches the render URL");

// axis switch on the 3D side (Y) → the XZ tile follows to the same plane
await realClick(`[...document.querySelectorAll('div[role=group][aria-label="Cross-section axis"] button')].find(b => b.textContent.trim() === 'Y')`);
await sleep(1600); // debounce + render
const yReadout = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-y]')?.textContent.match(/y \\d+\\/\\d+/)?.[0] || 'none')`));
must(yReadout === "y 64/64", `axis switch drives the XZ tile (got ${yReadout})`);
const ySrc = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-y] img')?.src || 'none')`));
must(ySrc.includes("axis=y&pos=1"), "XZ tile renders the mirrored plane");
const zHold = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-z] img')?.src || 'none')`));
must(zHold.includes("axis=z&pos=1"), "XY tile holds its plane while Y follows");

// the event loop terminates: positions stop moving once the 3D state is quiet
const snap = () => unq(evalJs(`[...document.querySelectorAll('[data-canvas-ui^=ortho-tile] img')].map(i => i.src).join('|')`));
const s1 = snap();
await sleep(900);
const s2 = snap();
must(s1 === s2, "event loop terminates — render URLs stabilize");

const errsB = JSON.parse(evalJs(`({ errs: window.__qaErrs || [] })`)).errs;
must(errsB.length === 0, `zero page errors in Phase B (got ${JSON.stringify(errsB)})`);
console.log(`PHASE B GREEN (${PASS} asserts)`);

// ===========================================================================
console.log("— PHASE C: layering sanity —");

sh(`${AB} press Escape`);
await sleep(900);
const layer1 = unq(evalJs(`(() => {
  const ortho = !!document.querySelector('[data-canvas-ui=ortho-panel]');
  const insp = !!document.querySelector('[role=dialog]');
  return (ortho ? 'ORTHO ' : 'no-ortho ') + (insp ? 'INSP' : 'no-insp');
})() + ''`));
must(layer1.trim() === "no-ortho INSP", `Esc peels only the viewer (got ${layer1})`);

const errsC = JSON.parse(evalJs(`({ errs: window.__qaErrs || [] })`)).errs;
must(errsC.length === 0, `zero page errors overall (got ${JSON.stringify(errsC)})`);
console.log(`PHASE C GREEN (${PASS} asserts)`);

cleanup();
console.log(`QA68 GREEN (${PASS} asserts)`);
