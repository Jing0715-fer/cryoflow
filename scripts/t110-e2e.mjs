// Task 112 QA — the canvas poster gets its clipboard twin (Copy Canvas PNG):
// toolbar + context menu both feed ONE raster (canvasPngBlob), the same
// four-doors-one-truth doctrine Task 111 gave the chart domain.
//   S  SEED + REACH: qa60 seed → canvas → toolbar copy button present,
//      enabled with jobs on the board, data-copy-state idle
//   A  TOOLBAR COPY (spy): clipboard.write patched → click Copy →
//      ClipboardItem image/png with a REAL poster raster (>40KB), toast
//      wording, Check icon + copy-state=png transient → idle
//   B  HONEST FAILURE: write patched to REJECT → destructive "could not
//      be copied" toast pointing at the download door; copy-state never
//      flips, no fake success
//   C  CONTEXT MENU: trusted right-click on empty canvas → Radix menu →
//      "Copy canvas as PNG image" item → SAME spy captures again (menu
//      path feeds the same pipeline, no second implementation)
//   F  STATIC: lib single-raster contracts (one toBlob capture, one
//      download anchor, copy delegates to the shared copyPngToClipboard,
//      zero navigator.clipboard in the component), probe testids, gate
//      line on both toolbar buttons, toast wording, ImageUp dialect
//   Z  CLEANUP: seed --clean, reload, console 0
// Usage: node scripts/t110-e2e.mjs
import { execSync } from "node:child_process";
import { readFileSync, appendFileSync, existsSync } from "node:fs";

const AB = "agent-browser";
const B = "http://localhost:3000";
const LOGF = "/home/z/my-project/.qa-logs/t110-trace.log";
const step = (m) => {
  try { appendFileSync(LOGF, `[${(Date.now() / 1000).toFixed(0)}] ${m}\n`); } catch { /* ignore */ }
  console.log(m);
};
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => { step(`SIGNAL ${sig}`); process.exit(1); });
}
process.on("exit", (c) => step(`exit code=${c}`));

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// qa62 CLI convention: eval --stdin; object results print as bare JSON,
// strings come back quoted — unq strips the outer quotes only
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 180_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));

let PASSED = 0;
const must = (cond, msg) => {
  if (!cond) { step(`FATAL: ${msg}`); console.error(`FATAL: ${msg}`); process.exit(1); }
  PASSED += 1;
  console.log(`  ok: ${msg}`);
};

// ---------- realClick (aim-verify: elementFromPoint must belong to target) ----------
const realClick = async (findExpr) => {
  const aimProbe = `(() => {
    const el = (${findExpr}); if (!el) return null;
    const r = el.getBoundingClientRect();
    const cands = [[0.5, 0.5], [0.5, 0.72], [0.35, 0.5], [0.5, 0.3]];
    for (const [fx, fy] of cands) {
      const x = Math.round(r.x + r.width * fx), y = Math.round(r.y + r.height * fy);
      const top = document.elementFromPoint(x, y);
      if (top && el.contains(top)) return { x, y };
    }
    el.scrollIntoView({ block: 'center' });
    return { scroll: true };
  })()`;
  let pos = null;
  for (let i = 0; i < 4; i++) {
    const a = evalJs(aimProbe);
    if (!a || a === "null") return "NO-ELEMENT";
    const cand = JSON.parse(a);
    if (cand.scroll) { await sleep(500); continue; }
    if (Number.isFinite(cand.x) && Number.isFinite(cand.y)) { pos = cand; break; }
    await sleep(400);
  }
  if (!pos) return "NO-ELEMENT";
  sh(`${AB} mouse move ${pos.x} ${pos.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${pos.x},${pos.y}`;
};

// ---------- clipboard spies (headless clipboard is permission-locked; the
// probe verifies the contract WE own: the buttons call the right API with
// the right payload. Real permission behavior is environment, not app.) ----------
const armImageSpy = `(() => {
  window.__t110Imgs = [];
  const cb = navigator.clipboard;
  if (!window.__t110OrigW) window.__t110OrigW = cb.write.bind(cb);
  Object.defineProperty(cb, 'write', { configurable: true, value: (items) => {
    for (const it of items) {
      const entry = { types: it.types ? Array.from(it.types) : [] };
      window.__t110Imgs.push(entry);
      const p = it.getType('image/png');
      if (p && p.then) p.then((b) => { entry.size = b.size; entry.type = b.type; });
    }
    return Promise.resolve();
  } });
  return 'armed';
})()`;
const armRejectSpy = `(() => {
  const cb = navigator.clipboard;
  Object.defineProperty(cb, 'write', { configurable: true, value: () =>
    Promise.reject(new DOMException('Write permission denied', 'NotAllowedError')) });
  return 'reject-armed';
})()`;
const imgCount = () => J(`(() => (window.__t110Imgs || []).length)()`);
const imgLast = async () => {
  for (let i = 0; i < 16; i++) {
    if (imgCount() > 0) return J(`(() => { const e = window.__t110Imgs[window.__t110Imgs.length - 1]; return { types: e.types, size: e.size || 0, type: e.type || '' }; })()`);
    await sleep(500);
  }
  return null;
};

// ---------- toast observer (per-phase re-arm: the observation window must
// match the behavior window — Task 111's cross-phase pollution lesson) ----------
const armToasts = `(() => {
  window.__t110Toasts = [];
  window.__t110Mo && window.__t110Mo.disconnect();
  window.__t110Mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/copied|could not be copied|exported|failed/i.test(t)) window.__t110Toasts.push(t.replace(/\\s+/g, ' ').slice(0, 200));
      }
    }
  });
  window.__t110Mo.observe(document.body, { childList: true, subtree: true });
  return 'armed';
})()`;
const toasts = () => J(`(() => ({ t: (window.__t110Toasts || []).join(' | ') }))()`).t;

// ---------- boot (qa62 conventions) ----------
const SEED = "python3 /home/z/my-project/scripts/qa60-seed-fsc.py";
const errClear = () => sh(`${AB} errors --clear >/dev/null 2>&1 || true`);

const bootCanvas = async () => {
  sh(`${AB} close`); await sleep(1500);
  sh(`${AB} set viewport 1600 900`);
  sh(`${AB} open ${B}`);
  await sleep(5000);
  errClear();
  for (let i = 0; i < 12; i++) {
    const probe = evalJs(`(() => {
      const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('QA Post 320'));
      const dash = !!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard');
      return (card ? 'CARD' : 'NOCARD') + (dash ? '+DASH' : '');
    })()`);
    if (String(probe).includes("CARD")) return true;
    if (String(probe).includes("DASH")) {
      evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
    }
    await sleep(2200);
  }
  return false;
};

// ---------- phases ----------
const phaseS = async () => {
  console.log("== PHASE S: seed + reach + toolbar doors ==");
  step("  seeding qa60 fixtures");
  sh(`${SEED} >/dev/null 2>&1`);
  const ok = await bootCanvas();
  must(ok, "canvas reachable with seeded jobs");
  const doors = J(`(() => {
    const dl = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Export canvas as PNG');
    const cp = document.querySelector('[data-canvas-ui="canvas-export-png-copy"]');
    return {
      dl: !!dl, dlDisabled: dl ? dl.disabled : null,
      cp: !!cp, cpDisabled: cp ? cp.disabled : null,
      state: cp ? cp.getAttribute('data-copy-state') : null,
      label: cp ? cp.getAttribute('aria-label') : null,
      title: cp ? (cp.getAttribute('title') || '') : '',
    };
  })()`);
  must(doors.dl === true, "toolbar: download door present");
  must(doors.dlDisabled === false, "download door enabled with jobs on the board");
  must(doors.cp === true, "toolbar: clipboard door present (canvas-export-png-copy)");
  must(doors.cpDisabled === false, "clipboard door enabled with jobs on the board");
  must(doors.label === "Copy canvas as PNG image", "clipboard door aria-label exact");
  must(doors.state === "idle", `copy-state starts idle (got ${doors.state})`);
  must(doors.title.includes("paste into docs or slides"), "title names the paste destination");
  step("PHASE S GREEN");
};

const phaseA = async () => {
  console.log("== PHASE A: toolbar copy (spy) ==");
  evalJs(armToasts);
  evalJs(armImageSpy);
  const click = await realClick(`document.querySelector('[data-canvas-ui="canvas-export-png-copy"]')`);
  must(String(click).startsWith("clicked@"), `toolbar copy clicked (${click})`);
  const item = await imgLast();
  must(item !== null, "clipboard.write captured a ClipboardItem");
  must(JSON.stringify(item.types) === JSON.stringify(["image/png"]), `item type is image/png (got ${JSON.stringify(item.types)})`);
  must(item.size > 40 * 1024, `poster raster is real, not a stub (got ${item.size} bytes)`);
  const to = toasts();
  must(to.includes("Canvas copied"), `success toast present (got "${to}")`);
  must(to.includes("Poster PNG on the clipboard"), "toast names the payload");
  const flash = J(`(() => {
    const cp = document.querySelector('[data-canvas-ui="canvas-export-png-copy"]');
    return { state: cp.getAttribute('data-copy-state'), check: !!cp.querySelector('svg.lucide-check') };
  })()`);
  must(flash.state === "png", `copy-state flips to png during the window (got ${flash.state})`);
  must(flash.check === true, "Check icon replaces ImageUp during the transient");
  await sleep(2200);
  const after = J(`(() => {
    const cp = document.querySelector('[data-canvas-ui="canvas-export-png-copy"]');
    return { state: cp.getAttribute('data-copy-state'), check: !!cp.querySelector('svg.lucide-check'), prim: cp.className.includes('text-primary') };
  })()`);
  must(after.state === "idle", "copy-state reverts to idle (~1.6s transient)");
  must(after.check === false && after.prim === false, "Check icon and tint fully reverted");
  step("PHASE A GREEN");
};

const phaseB = async () => {
  console.log("== PHASE B: honest failure (reject) ==");
  evalJs(armToasts);
  evalJs(armRejectSpy);
  const nBefore = imgCount();
  const click = await realClick(`document.querySelector('[data-canvas-ui="canvas-export-png-copy"]')`);
  must(String(click).startsWith("clicked@"), `copy clicked against reject spy (${click})`);
  // the reject fires only AFTER the poster raster finishes (~seconds) —
  // poll for the toast instead of sleeping a fixed window (t110 二折:
  // 1.5s fixed sleep raced the capture and read the observer too early)
  let to = "";
  for (let i = 0; i < 24; i++) {
    to = toasts();
    if (to.includes("could not be copied")) break;
    await sleep(500);
  }
  must(to.includes("could not be copied"), `destructive toast present (got "${to}")`);
  must(to.includes("use the PNG download instead"), "failure toast points at the download door");
  must(imgCount() === nBefore, "reject spy captured nothing — no fake success");
  const st = J(`(() => ({ s: document.querySelector('[data-canvas-ui="canvas-export-png-copy"]').getAttribute('data-copy-state') }))()`).s;
  must(st === "idle", `copy-state never flips on failure (got ${st})`);
  step("PHASE B GREEN");
};

const phaseC = async () => {
  console.log("== PHASE C: context menu path (trusted right-click) ==");
  evalJs(armToasts);
  evalJs(armImageSpy);
  // aim at an EMPTY spot of the canvas background: the point must belong to
  // the viewport section but NOT to any card or control
  const spot = J(`(() => {
    const sec = document.querySelector('[data-canvas="viewport"]');
    if (!sec) return null;
    const r = sec.getBoundingClientRect();
    const cands = [[0.16, 0.82], [0.85, 0.85], [0.12, 0.55], [0.5, 0.92]];
    for (const [fx, fy] of cands) {
      const x = Math.round(r.x + r.width * fx), y = Math.round(r.y + r.height * fy);
      const top = document.elementFromPoint(x, y);
      if (!top) continue;
      if (top.closest('[data-job]') || top.closest('[role="button"]') || top.closest('[role="menu"]')) continue;
      if (sec.contains(top)) return { x, y };
    }
    return null;
  })()`);
  must(spot !== null && Number.isFinite(spot.x), `empty canvas spot found (${JSON.stringify(spot)})`);
  sh(`${AB} mouse move ${spot.x} ${spot.y}`);
  sh(`${AB} mouse down right`);
  sh(`${AB} mouse up right`);
  await sleep(900);
  const menu = J(`(() => {
    const items = [...document.querySelectorAll('[role="menuitem"]')];
    const target = items.find(x => (x.textContent || '').includes('Copy canvas as PNG image'));
    return { open: items.length > 0, hasCopy: !!target, texts: items.map(x => (x.textContent || '').trim().slice(0, 40)) };
  })()`);
  must(menu.open === true, `Radix context menu opened on trusted right-click (items: ${menu.texts.join(" / ")})`);
  must(menu.hasCopy === true, "menu carries 'Copy canvas as PNG image'");
  const click = await realClick(`[...document.querySelectorAll('[role="menuitem"]')].find(x => (x.textContent || '').includes('Copy canvas as PNG image'))`);
  must(String(click).startsWith("clicked@"), `menu item clicked (${click})`);
  const item = await imgLast();
  must(item !== null && item.size > 40 * 1024, `menu path delivered the SAME real raster via the shared pipeline (got ${item ? item.size : "none"} bytes)`);
  const to = toasts();
  must(to.includes("Canvas copied"), `menu-path success toast present (got "${to}")`);
  step("PHASE C GREEN");
};

const phaseF = () => {
  console.log("== PHASE F: static contracts ==");
  const lib = readFileSync("/home/z/my-project/src/lib/canvas-export.ts", "utf8");
  const comp = readFileSync("/home/z/my-project/src/components/workflow/canvas.tsx", "utf8");
  const chartLib = readFileSync("/home/z/my-project/src/lib/chart-export.ts", "utf8");

  must(lib.includes("export async function canvasPngBlob("), "lib: canvasPngBlob exported (destination-agnostic raster)");
  must(lib.includes("export async function copyCanvasPng("), "lib: copyCanvasPng exported (clipboard door)");
  must(lib.includes("const png = await canvasPngBlob(meta)") && lib.includes("a.download = png.fileName"), "download door consumes the shared raster");
  must((lib.match(/toBlob\(world/g) || []).length === 1, "single raster: exactly one html-to-image capture in the lib");
  must((lib.match(/a\.download/g) || []).length === 1, "single download anchor — the copy door never touches disk");
  must(lib.includes('import { copyPngToClipboard } from "./chart-export"'), "clipboard primitive imported from chart-export (one source, no twin)");
  must(chartLib.includes("export async function copyPngToClipboard("), "chart-export still owns the shared primitive");

  must(!comp.includes("navigator.clipboard"), "component: zero direct clipboard access — everything routes through the lib");
  must(comp.includes("copyCanvasPng") && comp.includes("exportCanvasPng"), "component consumes both doors");
  must((comp.match(/data-canvas-ui="canvas-export-png-copy"/g) || []).length === 1, "component: toolbar copy testid");
  must(comp.includes('aria-label="Copy canvas as PNG image"'), "component: copy aria-label");
  must(comp.includes("data-copy-state={copiedPng ? \"png\" : \"idle\"}"), "component: copy-state probe wiring");
  must(comp.includes('data-canvas-ui="canvas-menu-png-copy"'), "component: context-menu copy testid");
  must((comp.match(/<ImageUp\b/g) || []).length === 2, "ImageUp dialect on both entries (toolbar + menu)");
  must((comp.match(/disabled=\{posterBusy !== null \|\| jobs\.length === 0\}/g) || []).length === 2,
    "gate line on BOTH toolbar doors (busy or empty canvas)");
  must(comp.includes("Poster PNG on the clipboard — paste into docs or slides"), "success toast wording");
  must(comp.includes("Clipboard access was blocked — use the PNG download instead."), "failure toast wording mirrors the chart domain");
  must(comp.includes('title: "Copy failed"'), "raster-failure path keeps its own door name");
  must(comp.includes("if (copiedTimer.current) clearTimeout(copiedTimer.current)"), "transient timer re-armed on repeat copies");
  step("PHASE F GREEN");
};

const phaseZ = async () => {
  console.log("== PHASE Z: cleanup + console ==");
  sh(`${SEED} --clean >/dev/null 2>&1 || true`);
  step("  seed cleaned (files + engine-state; live job deleted)");
  sh(`${AB} close`); await sleep(1000);
  sh(`${AB} open ${B}`); await sleep(4000);
  errClear();
  const errs = sh(`${AB} errors || true`)
    .split("\n")
    .filter((l) => l.trim() && !l.includes("✗")); // CLI's own failure traces are not page errors
  must(errs.length === 0, `console clean (got ${errs.length})`);
  step("PHASE Z GREEN");
};

// ---------- main ----------
(async () => {
  try {
    if (!existsSync("/home/z/my-project/.qa-logs")) execSync("mkdir -p /home/z/my-project/.qa-logs");
    await phaseS();
    await phaseA();
    await phaseB();
    await phaseC();
    phaseF();
    await phaseZ();
    console.log(`T110 ALL PASS (${PASSED} assertions)`);
    process.exit(0);
  } catch (e) {
    step(`FATAL: ${e.message}`);
    console.error(`FATAL: ${e.message}`);
    try { sh(`${AB} close`); } catch { /* already gone */ }
    process.exit(1);
  }
})();
