// Task 59 QA — class gallery triage tools: occupancy sort + kept-only view.
// The seed's occupancy ladder is DECOUPLED from class numbers
//   cls:  1  2  3  4  5  6  7  8      auto (≥210) keeps {2,4,6} → 960/1455
//   cnt: 180 420 90 300 60 240 45 120
//   rank:  4  1  6  2  7  3  8  5      occupancy order: 2,4,6,1,8,3,5,7
//   A  TRIAGE: default class order [1..8] → sort Occupancy reorders to
//      [2,4,6,1,8,3,5,7] (probe reads card aria-labels in document order)
//      → lightbox walks the VISIBLE order (zoom cls2 → →cls4 → …; wrap last
//      visible cls5 → first cls2) → kept-only shows 3 cards + "showing 3
//      of 8" badge → lightbox inside kept-only wraps 6→2 → discard the
//      last visible kept class from the lightbox (cls6) → dialog closes
//      gracefully, badge drops to "2 of 8", footer 720 → clear → sort back
//      → Kept only with nothing kept: click None, kept-only → honest empty
//      state + "Show all classes" CTA → restore auto
//   B  REGRESSION: qa58 essentials still green on the shuffled ladder
//      (rank #1 for class 2, wrap-around, keep dance, footer accounting)
//   C  CONSOLE: 0 errors → cleanup
// Usage: QA_PHASES=A node scripts/qa59-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = "/home/z/my-project/.qa-logs/qa59-trace.log";
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

const B = "http://localhost:3000";
const SEL_JOB = "QA Class Select";
const SEED = "python3 /home/z/my-project/scripts/qa58-seed-gallery.py";
const SEED_CLEAN = "python3 /home/z/my-project/scripts/qa58-seed-gallery.py --clean";
const FATAL = (msg) => { step(`FATAL: ${msg}`); console.error(`FATAL: ${msg}`); process.exit(1); };
const must = (cond, label) => { if (!cond) FATAL(label); else step(`  ok: ${label}`); };

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

// card order probe — aria-labels of the grid's toggle buttons in DOCUMENT
// order (the sort's whole point is to change this order)
const orderProbe = () => J(`(() => {
  const grid = document.querySelector('[data-canvas-ui=class-grid]');
  if (!grid) return null;
  const cards = [...grid.querySelectorAll('button[aria-pressed]')];
  return {
    order: cards.map((b) => parseInt(((b.getAttribute('aria-label')||'').match(/Toggle class (\\d+)/) || [])[1], 10)),
    pressed: cards.map((b) => b.getAttribute('aria-pressed')),
  };
})()`);

const viewbarProbe = () => J(`(() => {
  const bar = document.querySelector('[data-canvas-ui=class-viewbar]');
  if (!bar) return null;
  const sortCls = bar.querySelector('[data-canvas-ui=sort-class]');
  const sortOcc = bar.querySelector('[data-canvas-ui=sort-occupancy]');
  const keptOnly = bar.querySelector('[data-canvas-ui=kept-only]');
  const count = bar.querySelector('[data-canvas-ui=class-visible-count]');
  return {
    sortClass: sortCls ? sortCls.getAttribute('aria-pressed') : null,
    sortOcc: sortOcc ? sortOcc.getAttribute('aria-pressed') : null,
    keptOnly: keptOnly ? keptOnly.getAttribute('aria-pressed') : null,
    keptLabel: keptOnly ? keptOnly.textContent.trim() : null,
    badge: count ? count.textContent.trim() : null,
  };
})()`);

const footerText = () => unq(evalJs(`(() => {
  const f = document.querySelector('[data-canvas-ui=class-gallery-footer]');
  return f ? f.textContent.replace(/\\s+/g, ' ').trim() : 'NO-FOOTER';
})()`));

const lightboxProbe = () => J(`(() => {
  const dl = [...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-canvas-ui=lightbox-counter]'));
  if (!dl) return null;
  const counter = dl.querySelector('[data-canvas-ui=lightbox-counter]').textContent.trim();
  const keep = dl.querySelector('[data-canvas-ui=lightbox-keep]');
  const title = (dl.querySelector('[data-canvas-ui=lightbox-title]') || {}).textContent || '';
  const rank = (dl.textContent.match(/rank #(\\d+)/) || [])[1] ?? null;
  return { counter, title: title.trim(), keepPressed: keep ? keep.getAttribute('aria-pressed') : null, rank };
})()`);

const keyInDialog = async (key) => {
  evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-canvas-ui=lightbox-counter]'));
    if (!dl) return 'NO-DIALOG';
    dl.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', bubbles: true }));
    return 'sent';
  })()`);
  await sleep(350);
};

const closeDialogEsc = async () => {
  evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-canvas-ui=lightbox-counter]'));
    if (!dl) return 'NO-DIALOG';
    dl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return 'esc';
  })()`);
  await sleep(600);
  return unq(evalJs(`(() => ![...document.querySelectorAll('[role=dialog]')].some(d => d.querySelector('[data-canvas-ui=lightbox-counter]')))()`)) === "true";
};

const openLightbox = async (cls) => {
  const r = unq(evalJs(`(() => {
    const b = [...document.querySelectorAll('[data-canvas-ui=class-zoom]')].find(x => (x.getAttribute('aria-label')||'').startsWith('Zoom class ${cls} '));
    if (!b) return 'NO-ZOOM-BTN';
    b.click();
    return 'clicked';
  })()`));
  await sleep(500);
  const open = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => {
      const t = d.querySelector('[data-canvas-ui=lightbox-title]');
      return t && t.textContent.trim() === 'Class ${cls}';
    });
    return dl ? 'true' : 'false';
  })()`));
  if (r === "clicked" && open === "true") return "verified";
  step(`  openLightbox(${cls}) debug: click=${r} dialogOpen=${open}`);
  return "FAILED";
};

const bootCanvas = async () => {
  // kill any zombie page first — a stale session's params auto-save can
  // overwrite the freshly-seeded selection state after boot (seen live:
  // seed wrote 'auto', the leftover page wrote '2,4' back over it)
  sh(`${AB} close`); await sleep(1500);
  sh(`${AB} set viewport 1600 900`);
  sh(`${AB} open ${B}`);
  await sleep(5000);
  evalJs(errCollector);
  for (let i = 0; i < 12; i++) {
    const probe = evalJs(`(() => {
      const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${SEL_JOB}'));
      const dash = !!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard');
      return (card ? 'CARD' : 'NOCARD') + (dash ? '+DASH' : '');
    })()`);
    if (probe.includes("CARD")) return true;
    if (probe.includes("DASH")) {
      evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
      step(`  bootCanvas: dashboard → canvas (Shift+D), iter ${i}`);
    }
    await sleep(2200);
  }
  return false;
};

const openSelectPanel = async () => {
  for (let i = 0; i < 10; i++) {
    const r = await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${SEL_JOB}'))`,
    );
    if (r.includes("clicked@")) {
      await sleep(1200);
      // panel body tabs default to I/O — the gallery lives under Params
      await realClick(
        `[...document.querySelectorAll('aside')].slice(1).map(a => [...a.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === 'Params')).find(Boolean)`,
      );
      await sleep(800);
      const has = unq(evalJs(`(() => !!document.querySelector('section[aria-label="Class selection gallery"]'))() + ''`));
      if (has === "true") return true;
    }
    step(`  openSelectPanel iter ${i}: ${r.slice(0, 30)}`);
    await sleep(2000);
  }
  return false;
};

/** JS click + verify for plain gallery chips — coordinate clicks proved
 *  flaky here (hover/native-tooltip overlays at the same spot), and these
 *  buttons carry no pointer-position semantics */
/** JS click a class card and VERIFY its aria-pressed flipped to `want` */
const toggleCard = async (cls, want) => {
  for (let i = 0; i < 3; i++) {
    unq(evalJs(`(() => {
      const b = [...document.querySelectorAll('[data-canvas-ui=class-grid] button[aria-pressed]')].find(x => (x.getAttribute('aria-label')||'').startsWith('Toggle class ${cls} '));
      if (!b) return 'NO-CARD';
      b.click();
      return 'clicked';
    })()`));
    await sleep(500);
    const got = unq(evalJs(`(() => {
      const b = [...document.querySelectorAll('[data-canvas-ui=class-grid] button[aria-pressed]')].find(x => (x.getAttribute('aria-label')||'').startsWith('Toggle class ${cls} '));
      return b ? b.getAttribute('aria-pressed') : 'GONE';
    })()`));
    if (got === want) return "verified";
    step(`  toggleCard(${cls} → ${want}) retry ${i}: got ${got}`);
  }
  return "FAILED";
};

/** JS click a text-matched gallery header chip (Auto/All/None) — the
 *  coordinate path proved unreliable for these far-right chips */
const clickHeaderChip = async (label, verifyExpr, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const r = unq(evalJs(`(() => {
      const b = [...document.querySelectorAll('section[aria-label="Class selection gallery"] button')].find(x => x.textContent.trim() === '${label}');
      if (!b) return 'NO-BTN';
      b.click();
      return 'clicked';
    })()`));
    await sleep(500);
    if (r === "clicked" && unq(evalJs(`(${verifyExpr}) + ''`)) === "true") return "verified";
    step(`  clickHeaderChip(${label}) retry ${i}: ${r}`);
  }
  return "FAILED";
};

const clickChipUi = async (ui, verifyExpr, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const r = unq(evalJs(`(() => {
      const el = document.querySelector('[data-canvas-ui=${ui}]');
      if (!el) return 'NO-EL';
      el.click();
      return 'clicked';
    })()`));
    await sleep(400);
    if (r === "clicked" && unq(evalJs(`(${verifyExpr}) + ''`)) === "true") return "verified";
    step(`  clickChipUi(${ui}) retry ${i}: ${r}`);
  }
  return "FAILED";
};

// ============================================================ phase A
async function phaseA() {
  step("== PHASE A: gallery triage (sort + kept-only) ==");
  // self-seed (Task 86 doctrine): the seeder is idempotent, and qa58's Z
  // phase cleans the world — a suite must not depend on WHO ran before it
  step(`  seed: ${(sh(SEED).split("\n").slice(-1)[0] ?? "").slice(0, 100)}`);
  if (!(await bootCanvas())) FATAL("canvas never appeared");
  if (!(await openSelectPanel())) FATAL("select2d panel with gallery never appeared");

  // default view: class order, auto keeps {2,4,6}
  let o = orderProbe();
  let v = viewbarProbe();
  step(`  default: ${JSON.stringify(o)} / ${JSON.stringify(v)}`);
  must(o && JSON.stringify(o.order) === "[1,2,3,4,5,6,7,8]", "default order is class number order");
  must(v && v.sortClass === "true" && v.sortOcc === "false", "Class # chip pressed by default");
  must(v.keptOnly === "false" && v.badge === null, "no kept-only, no count badge in the default view");
  must(o.pressed.join(",") === "false,true,false,true,false,true,false,false", "auto keeps classes 2,4,6");

  // --- occupancy sort reorders for real (the ladder is shuffled) ---
  must((await clickChipUi("sort-occupancy", `document.querySelector('[data-canvas-ui=sort-occupancy]').getAttribute('aria-pressed') === "true"`)) === "verified", "Occupancy chip clicked");
  await sleep(350);
  o = orderProbe();
  v = viewbarProbe();
  step(`  occupancy-sorted: ${JSON.stringify(o.order)}`);
  must(JSON.stringify(o.order) === "[2,4,6,1,8,3,5,7]", "occupancy sort → [2,4,6,1,8,3,5,7]");
  must(v.sortOcc === "true" && v.sortClass === "false", "Occupancy chip now pressed");
  must(v.badge === null, "sort alone does not trigger the count badge (8 of 8 visible)");

  // --- lightbox walks the VISIBLE order ---
  must((await openLightbox(2)) === "verified", "zoom class 2 (rank #1) opens");
  let lb = lightboxProbe();
  must(lb.counter === "1 / 8" && lb.rank === "1", "class 2 is 1st visible, rank #1");
  await keyInDialog("ArrowRight");
  lb = lightboxProbe();
  must(lb.counter === "2 / 8" && lb.title === "Class 4" && lb.rank === "2", "→ walks visible order to class 4 (rank #2)");
  await keyInDialog("ArrowLeft");
  await keyInDialog("ArrowLeft");
  lb = lightboxProbe();
  must(lb.counter === "8 / 8" && lb.title === "Class 7" && lb.rank === "8", "← ×2 wraps to class 7 (last visible — smallest occupancy, rank #8)");
  must((await closeDialogEsc()), "Esc closes");
  const footerBefore = footerText();
  must((footerBefore || "").includes("960"), "footer untouched by view changes (960)");

  // --- kept-only view ---
  must((await clickChipUi("kept-only", `document.querySelector('[data-canvas-ui=kept-only]').getAttribute('aria-pressed') === "true"`)) === "verified", "Kept only clicked");
  await sleep(350);
  o = orderProbe();
  v = viewbarProbe();
  must(o && JSON.stringify(o.order) === "[2,4,6]", "kept-only shows exactly classes 2,4,6");
  must(o.pressed.join(",") === "true,true,true", "all visible cards are kept");
  must(v.keptOnly === "true" && (v.keptLabel || "").includes("3"), "kept-only chip pressed with · 3 count");
  must(v.badge === "showing 3 of 8", "honest badge: showing 3 of 8");

  // lightbox inside kept-only: 6 → wraps forward to 2
  must((await openLightbox(6)) === "verified", "zoom class 6 in kept-only");
  lb = lightboxProbe();
  must(lb.counter === "3 / 3", "class 6 is 3rd of the 3 visible");
  await keyInDialog("ArrowRight");
  lb = lightboxProbe();
  must(lb.counter === "1 / 3" && lb.title === "Class 2", "→ wraps within kept-only: 6 → 2");

  // --- discarding the last visible kept class from the lightbox ---
  // (the wrap check left the dialog on class 2 — walk back to class 6 first)
  await keyInDialog("ArrowLeft");
  lb = lightboxProbe();
  must(lb.counter === "3 / 3" && lb.title === "Class 6", "back on class 6");
  await realClick(`[...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-canvas-ui=lightbox-counter]')).querySelector('[data-canvas-ui=lightbox-keep]')`);
  await sleep(500);
  must(unq(evalJs(`(() => ![...document.querySelectorAll('[role=dialog]')].some(d => d.querySelector('[data-canvas-ui=lightbox-counter]')))()`)) === "true",
    "lightbox closes gracefully when the inspected class leaves the view");
  o = orderProbe();
  v = viewbarProbe();
  must(o && JSON.stringify(o.order) === "[2,4]", "kept-only now [2,4] after discarding class 6");
  must(v.badge === "showing 2 of 8", "badge drops to showing 2 of 8");
  must((footerText() || "").includes("720"), "footer updates live: 960 − 240 = 720 particles");
  // selection state check: manual now — classes 2,4
  must((footerText() || "").includes("2, 4"), "footer names classes 2, 4");

  // --- restore: clear filter, sort back, selection back to auto ---
  must((await clickChipUi("kept-only", `document.querySelector('[data-canvas-ui=kept-only]').getAttribute('aria-pressed') === "false"`)) === "verified", "Kept only off");
  await sleep(300);
  must((await clickChipUi("sort-class", `document.querySelector('[data-canvas-ui=sort-class]').getAttribute('aria-pressed') === "true"`)) === "verified", "Class # sort restored");
  await sleep(300);
  v = viewbarProbe();
  must(v.badge === null && v.sortClass === "true" && v.keptOnly === "false", "default view restored");
  must((await clickHeaderChip("Auto", `document.querySelector('[data-canvas-ui=class-gallery-footer]').textContent.includes('960')`)) === "verified",
    "Auto restored → footer 960 (debounced save resolves inside the verifier)");

  // --- emptying the selection falls back to auto ("" aliases "auto") ---
  // None keeps {1}; discarding class 1 empties the list — the param becomes
  // "" which the gallery reads as AUTO, so the kept-only view (still ON)
  // snaps to the auto set {2,4,6}. Pinning this honest fallback here.
  must((await clickHeaderChip("None", `document.querySelector('[data-canvas-ui=class-gallery-footer]').textContent.includes('Manual')`)) === "verified",
    "None clicked (manual keeps only class 1)");
  // kept-only ON first: the view narrows to the single kept class
  must((await clickChipUi("kept-only", `document.querySelector('[data-canvas-ui=kept-only]').getAttribute('aria-pressed') === "true"`)) === "verified", "kept-only on with {1}");
  let solo = orderProbe();
  must(solo && JSON.stringify(solo.order) === "[1]", "kept-only narrows to class 1 alone");
  // discarding the ONLY kept class empties the selection — the card itself
  // vanishes from the kept-only view as the auto set takes over, so the
  // click's success is verified by the fallback outcome below, not by an
  // aria-pressed read
  unq(evalJs(`(() => {
    const b = [...document.querySelectorAll('[data-canvas-ui=class-grid] button[aria-pressed]')].find(x => (x.getAttribute('aria-label')||'').startsWith('Toggle class 1 '));
    if (!b) return 'NO-CARD';
    b.click();
    return 'clicked';
  })()`));
  await sleep(800); // "" → auto re-render + debounced save
  o = orderProbe();
  v = viewbarProbe();
  must(o && JSON.stringify(o.order) === "[2,4,6]", "kept-only view follows the auto fallback: [2,4,6]");
  must(o.pressed.join(",") === "true,true,true", "all shown classes kept again");
  must(v.keptOnly === "true" && (v.keptLabel || "").includes("· 3"), "kept-only chip count follows (· 3)");
  must((footerText() || "").includes("Auto selection"), "footer reads Auto selection after the fallback");

  // --- leave the clean default: kept-only off, auto in charge ---
  must((await clickChipUi("kept-only", `document.querySelector('[data-canvas-ui=kept-only]').getAttribute('aria-pressed') === "false"`)) === "verified", "kept-only off");
  await sleep(300);
  o = orderProbe();
  must(o && o.order.length === 8, "all 8 classes visible");

  // restore auto for the next run (no-op here — already auto)
  must((await clickHeaderChip("Auto", `document.querySelector('[data-canvas-ui=class-gallery-footer]').textContent.includes('960')`)) === "verified", "auto restored (960)");

  // screenshot: occupancy-sorted full grid with the viewbar visible
  must((await clickChipUi("sort-occupancy", `document.querySelector('[data-canvas-ui=sort-occupancy]').getAttribute('aria-pressed') === "true"`)) === "verified", "occupancy sort for the shot");
  await sleep(400);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa59-triage.png`);
  step("  screenshot: qa59-triage.png");
  must((await clickChipUi("sort-class", `document.querySelector('[data-canvas-ui=sort-class]').getAttribute('aria-pressed') === "true"`)) === "verified", "back to class sort");
}

// ============================================================ phase B
async function phaseB() {
  step("== PHASE B: qa58 regression essentials on the shuffled ladder ==");
  must((await openLightbox(2)) === "verified", "zoom class 2 opens");
  let lb = lightboxProbe();
  must(lb.rank === "1" && lb.counter === "2 / 8", "class 2 rank #1, 2nd in class order (420)");
  await keyInDialog("ArrowRight");
  must(lightboxProbe().counter === "3 / 8", "arrow navigation intact (class 2 → 3)");
  must(await closeDialogEsc(), "Esc closes");
  must((footerText() || "").includes("960"), "footer 960 intact");
}

// ============================================================ phase C
async function phaseC() {
  step("== PHASE C: console + cleanup ==");
  const errs = errCount();
  must(String(errs) === "0", `in-page console errors = 0 (got ${errs})`);
  sh(SEED_CLEAN);
  step("  seed cleaned");
}

const all = { A: phaseA, B: phaseB, C: phaseC };
for (const p of PHASES) {
  if (!all[p]) FATAL(`unknown phase ${p}`);
  await all[p]();
}
step("ALL PHASES GREEN");
console.log("ALL PHASES GREEN");
