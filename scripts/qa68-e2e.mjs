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
// Run: node scripts/qa68-e2e.mjs   (server on :3000; self-seeds since Task 161)
import { execSync } from "node:child_process";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();
const AB = "agent-browser";
const B = "http://localhost:3000";
const CARD = "QA Class2D Source";
const VOL = "orthovol.mrc";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
let PASS = 0;
// t631 — forensics BEFORE cleanup closes the browser (qa67 doctrine).
const dumpForensics = () => {
  try {
    const out = execSync(`${AB} eval --stdin`, {
      encoding: "utf8", timeout: 15_000,
      input: `JSON.stringify({md: (window.__mdLog||[]).slice(0,10), errs: (window.__qaErrs||[]).slice(0,6), tabs: [...document.querySelectorAll('[role=tab]')].map(t=>t.textContent.trim()).slice(0,9), jobCards: document.querySelectorAll('[data-job]').length, url: location.href.slice(0,50)})`,
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
  // t630 rollout — this suite consumes BOTH fixtures (qa58 base + qa67
  // volume): tenant radius first, then the host pair goes home. Same
  // order law as qa67; reversed order dangles the engine-state entry.
  try { sh("python3 /home/z/my-project/scripts/qa67-seed-volume.py --clean"); } catch (e) { console.log(`  tenant clean warn: ${String(e).slice(0, 90)}`); }
  try { sh("python3 /home/z/my-project/scripts/qa58-seed-gallery.py --take-home"); } catch (e) { console.log(`  take-home warn: ${String(e).slice(0, 90)}`); }
}

const errCollector = `(() => {
  if (window.__qaErrColl) return 'errcoll-kept';
  window.__qaErrs = [];
  window.addEventListener('error', (e) => window.__qaErrs.push(String(e.message || e).slice(0, 160)));
  window.addEventListener('unhandledrejection', (e) => window.__qaErrs.push('rej:' + String((e.reason && e.reason.message) || e.reason).slice(0, 160)));
  window.__mdLog = [];
  ['mousedown','mouseup','click'].forEach(t => window.addEventListener(t, (e) => {
    if (window.__mdLog.length < 40) window.__mdLog.push(t + '@' + Math.round(e.clientX) + ',' + Math.round(e.clientY) + ' trusted:' + e.isTrusted + ' on:' + (e.target.tagName || '?'));
  }, true));
  window.__qaErrColl = true;
  return 'errcoll-on';
})()`;
const realClick = async (findExpr) => {
  // t631 — the sighted click (qa67 doctrine): scroll only if out of view,
  // settle, verify with elementFromPoint, and RETURN OBJECTS from eval (a
  // JSON.stringify string return gets double-encoded by the CLI and
  // .covered reads undefined — the click then never fires).
  for (let round = 0; round < 6; round++) {
    const st = evalJs(`(() => {
      const el = (${findExpr}); if (!el) return null;
      const r0 = el.getBoundingClientRect();
      if (r0.bottom < 0 || r0.top > window.innerHeight) el.scrollIntoView({ block: 'center' });
      return 'scrolled';
    })()`);
    if (!st || st === "null") return "NO-ELEMENT";
    await sleep(600);
    const pos = () => evalJs(`(() => {
      const el = (${findExpr}); if (!el) return null;
      const r = el.getBoundingClientRect();
      const x = Math.round(r.x + r.width/2), y = Math.round(r.y + r.height/2);
      const hit = (y < 0 || y > window.innerHeight) ? null : document.elementFromPoint(x, y);
      return { x, y, covered: !!hit && (hit === el || el.contains(hit)) };
    })()`);
    const s1 = JSON.parse(await pos());
    if (!s1 || s1.covered === undefined) return "NO-ELEMENT";
    await sleep(600);
    const c = JSON.parse(await pos());
    if (!c || c.covered === undefined) return "NO-ELEMENT";
    // t631 — 2px tolerance: dialogs with lazy images shift layout while
    // loading; exact-equality stability was too brittle (UNVERIFIED loops).
    const stable = Math.abs(s1.x - c.x) <= 2 && Math.abs(s1.y - c.y) <= 2;
    if (c.covered && stable) {
      sh(`${AB} mouse move ${c.x} ${c.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${c.x},${c.y}`;
    }
    await sleep(400);
  }
  return "UNVERIFIED";
};

// ---- job id ----------------------------------------------------------------
// Task 161 — self-seed (Task 87 doctrine, same as qa66): qa68 consumes
// qa58's class2d base (star/mrcs/entry) AND qa67's orthovol, and earlier
// suites' cleans legitimately remove the landlord's own files (the
// cleanup-radius protocol — qa_lib.py). Seeding here makes the suite
// order-independent: qa59 → qa68 back-to-back must work.
sh("python3 /home/z/my-project/scripts/qa58-seed-gallery.py >/dev/null 2>&1");
sh("python3 /home/z/my-project/scripts/qa67-seed-volume.py >/dev/null 2>&1");
console.log("  ok: self-seeded (qa58 base + qa67 volume, Task 87 doctrine)");
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
// t631 — same as qa67: no emulated viewport (page must equal the physical
// window or CDP clicks beyond 1280×577 land in the void).
sh(`${AB} open ${B}`);
await sleep(5000);
evalJs(errCollector);

let onCanvas = false;
// t631 — the vacuous-truth fix (qa67 doctrine): 'NOCARD'.includes("CARD")
// is TRUE, so the old probe passed from iteration zero. Honest booleans
// + an explicit job-card count (jobs stream in asynchronously).
for (let i = 0; i < 14 && !onCanvas; i++) {
  const stRaw = evalJs(`JSON.stringify((() => {
    const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${CARD}'));
    const h1 = (document.querySelector('h1')||{}).textContent || '';
    return { card: !!card, dash: h1.includes('Dashboard'), jobCards: document.querySelectorAll('[data-job]').length };
  })())`);
  let st = {};
  try { const once = JSON.parse(stRaw); st = typeof once === "string" ? JSON.parse(once) : once; } catch {}
  if (st.card && (st.jobCards || 0) > 0) { onCanvas = true; break; }
  if (st.dash) {
    evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
    await sleep(2200);
  } else await sleep(2000);
}
must(onCanvas, "canvas renders with the class2d job card");

// t631 — the toggle death-spiral fix (qa67 doctrine): ask the inspector's
// state first, poll for the tab, never blind-click the card while open.
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
  await realClick(`[...document.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === 'Results')`);
  let sec = false;
  for (let w = 0; w < 10 && !sec; w++) { await sleep(500); sec = unq(evalJs(`String(!!document.querySelector('section[aria-label="Maps and images"]'))`)) === "true"; }
  inResults = sec;
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
// t631 — a freshly bounced dev server cold-compiles the outputs route on
// first hit; 7s starved the dims fetch. 60s is still honest — the readout
// DOES arrive.
for (let i = 0; i < 30 && !readout; i++) {
  readout = unq(evalJs(`String(document.querySelector('[data-canvas-ui=ortho-tile-z]')?.textContent.match(/z \\d+\\/\\d+/)?.[0] || '')`));
  if (!readout) await sleep(2000);
}
must(readout === "z 33/64", `XY tile readout shows the voxel index (got ${readout || "none"})`);

// ⌖ mirror the XY plane into 3D (slice on, axis z, pos = 0.5)
// t631 — the mirror click used to be fired ONCE and its result discarded:
// inside the Mol* dialog the tiles' PNGs stream in and shift layout, so a
// single sighted click can honestly return UNVERIFIED. Retry with settle.
let mirrorClick = "not-fired";
for (let i = 0; i < 5; i++) {
  mirrorClick = await realClick(`document.querySelector('[data-canvas-ui=ortho-tile-z] button[aria-label^="Show the XY plane"]')`);
  if (process.env.QA68_DEBUG) console.log(`  [dbg] mirror try${i} -> ${mirrorClick}`);
  if (mirrorClick.includes("clicked@")) break;
  await sleep(1500);
}
await sleep(1200);
// the 3D cross-section row must be alive before we drive it
// t631 — 10s starved the Mol* canvas mount on a memory-pressured night
// (the embed applies the mirrored intent once its canvas is up); 60s.
let slice3d = "";
for (let i = 0; i < 30 && !slice3d.startsWith("OK"); i++) {
  slice3d = unq(evalJs(`(() => {
    const t = [...document.querySelectorAll('button[aria-label="Toggle cross-section plane"]')].pop();
    const s = document.querySelector('[role=slider][aria-label^="Cross-section plane position"]');
    if (!t) return 'NO-TOGGLE';
    if (!s) return 'NO-SLIDER';
    return 'OK pressed=' + t.getAttribute('aria-pressed');
  })()`));
  if (!slice3d.startsWith("OK")) await sleep(2000);
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
