// Task 58 QA — class selection gallery inspection lightbox + help popover
// shortcut coverage.
//   A  GALLERY LIGHTBOX: seeded Class2D→Select2D chain renders the gallery
//      (8 cards, auto keeps 3 → footer 960/1455) → hover-zoom buttons →
//      open lightbox on class 2 (title/counter/rank/kept badge/image) →
//      ArrowRight/ArrowLeft navigation incl. wrap-around both directions →
//      keep-toggle button flips kept→discarded→kept → Esc closes → reopen
//      on discarded class 8 + Enter toggles keep (key on dialog root) →
//      close → card 8 aria-pressed + manual footer 1005/1455 → card click
//      regression (class 4 joins) → screenshot with lightbox open
//   B  HELP POPOVER: shortcut list covers the dashboard grid filter keys
//      (1–4) and the new lightbox navigation (← / →)
//   C  CONSOLE: in-page error collector reports 0 errors → cleanup
// Usage: QA_PHASES=A node scripts/qa58-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = "/home/z/my-project/.qa-logs/qa58-trace.log";
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

// in-page error collector (qa56 lesson — page-level, deterministic)
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

// gallery probe — cards in document order with their toggle state; the
// footer text carries the effective selection summary
const galleryProbe = () => J(`(() => {
  const sec = document.querySelector('section[aria-label="Class selection gallery"]');
  if (!sec) return null;
  const grid = sec.querySelector('[data-canvas-ui=class-grid]');
  const cards = grid ? [...grid.querySelectorAll('button[aria-pressed]')] : [];
  const footer = sec.querySelector('[data-canvas-ui=class-gallery-footer]');
  return {
    cards: cards.length,
    pressed: cards.map((b) => b.getAttribute('aria-pressed')),
    zooms: sec.querySelectorAll('[data-canvas-ui=class-zoom]').length,
    footer: footer ? footer.textContent.replace(/\\s+/g, ' ').trim().slice(0, 140) : null,
  };
})()`);

// lightbox probe — scoped by its counter marker (a plain Radix dialog role
// is shared with popovers/menus, qa54 lesson)
const lightboxProbe = () => J(`(() => {
  const dl = [...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-canvas-ui=lightbox-counter]'));
  if (!dl) return null;
  const counter = dl.querySelector('[data-canvas-ui=lightbox-counter]').textContent.trim();
  const keep = dl.querySelector('[data-canvas-ui=lightbox-keep]');
  const img = dl.querySelector('img[alt*="full size"]');
  const title = (dl.querySelector('[data-canvas-ui=lightbox-title]') || {}).textContent || '';
  const rank = (dl.textContent.match(/rank #(\\d+)/) || [])[1] ?? null;
  const badge = dl.textContent.includes('kept') && !dl.textContent.includes('discarded') ? 'kept'
    : (dl.textContent.includes('discarded') ? 'discarded' : null);
  return {
    counter,
    keepText: keep ? keep.textContent.trim() : null,
    keepPressed: keep ? keep.getAttribute('aria-pressed') : null,
    imgAlt: img ? img.getAttribute('alt') : null,
    title: title.replace(/\\s+/g, ' ').trim().slice(0, 40),
    rank,
    badge,
  };
})()`);

const lightboxGone = () => unq(evalJs(
  `(() => ![...document.querySelectorAll('[role=dialog]')].some(d => d.querySelector('[data-canvas-ui=lightbox-counter]')))()`
));

const keyInDialog = async (key, opts = "") => {
  evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-canvas-ui=lightbox-counter]'));
    if (!dl) return 'NO-DIALOG';
    dl.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', bubbles: true${opts ? ", " + opts : ""} }));
    return 'sent';
  })()`);
  await sleep(350);
};

const openLightbox = async (cls) => {
  const r = await realClick(
    `[...document.querySelectorAll('[data-canvas-ui=class-zoom]')].find(b => (b.getAttribute('aria-label')||'').startsWith('Zoom class ${cls} '))`,
  );
  if (!r.includes("clicked@")) return "NO-ZOOM-BTN";
  await sleep(500);
  return r;
};

const closeDialogEsc = async () => {
  // dispatch ON the lightbox dialog — the content handler consumes Esc with
  // stopPropagation, so a document-level dispatch would never reach it and
  // would instead hit the canvas-level deselect chain
  evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-canvas-ui=lightbox-counter]'));
    if (!dl) return 'NO-DIALOG';
    dl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return 'esc';
  })()`);
  await sleep(600);
  return lightboxGone() === "true";
};

/** open the app and land on the canvas with the select2d job card visible */
const bootCanvas = async () => {
  // kill any zombie page first — a stale session's params auto-save can
  // overwrite the freshly-seeded selection state after boot (seen live:
  // seed wrote 'auto', the leftover page wrote '2,4' back over it)
  sh(`${AB} close`); await sleep(1500);
  sh(`${AB} set viewport 1600 900`); // desktop aside path (xl breakpoint) —
  // the narrow viewport opens the inspector modal for completed jobs instead
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
    } else {
      step(`  bootCanvas: waiting for canvas… iter ${i}`);
    }
    await sleep(2200);
  }
  return false;
};

const openSelectPanel = async () => {
  for (let i = 0; i < 10; i++) {
    // idle card click = "Edit parameters" flow — the ONLY surface that
    // hosts the gallery (completed jobs open the large inspector modal,
    // which has no gallery — job-card.tsx semantics)
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

// ============================================================ phase A
async function phaseA() {
  step("== PHASE A: gallery lightbox ==");
  if (!(await bootCanvas())) FATAL("canvas never appeared");
  if (!(await openSelectPanel())) FATAL("select2d panel with gallery never appeared");

  let g = galleryProbe();
  step(`  gallery: ${JSON.stringify(g).slice(0, 220)}`);
  must(g && g.cards === 8, "gallery renders 8 class cards");
  must(g.pressed.filter((p) => p === "true").length === 3, "auto mode keeps exactly 3 classes (1,2,3)");
  must(g.zooms === 8, "8 hover-zoom buttons present");
  must((g.footer || "").includes("960") && (g.footer || "").includes("1,455"), "auto footer 960 / 1,455 particles");

  // --- open lightbox on class 2 (kept, rank #1 on the shuffled ladder) ---
  must((await openLightbox(2)).includes("clicked@"), "zoom class 2 opens the lightbox");
  let lb = lightboxProbe();
  step(`  lightbox: ${JSON.stringify(lb)}`);
  must(lb && lb.counter === "2 / 8", "counter reads 2 / 8");
  must(lb.rank === "1", "class 2 shows rank #1 (420 particles — shuffled ladder)");
  must(lb.keepPressed === "true", "class 2 starts kept (auto)");
  must((lb.imgAlt || "").startsWith("Class 2 average"), "full-size image present for class 2");

  // --- arrow navigation with wrap-around ---
  await keyInDialog("ArrowRight");
  must(lightboxProbe().counter === "3 / 8", "ArrowRight → 3 / 8");
  await keyInDialog("ArrowLeft");
  await keyInDialog("ArrowLeft");
  must(lightboxProbe().counter === "1 / 8", "ArrowLeft ×2 → 1 / 8");
  await keyInDialog("ArrowLeft");
  lb = lightboxProbe();
  must(lb.counter === "8 / 8", "ArrowLeft wraps → 8 / 8");
  must(lb.keepPressed === "false", "class 8 is discarded");
  await keyInDialog("ArrowRight");
  must(lightboxProbe().counter === "1 / 8", "ArrowRight wraps → 1 / 8");
  lb = lightboxProbe();
  must(lb.rank === "4", "class 1 shows rank #4 (180 particles)");

  // --- keep-toggle button flips both directions (class 2 = kept in auto) ---
  await keyInDialog("ArrowRight"); // → class 2 (rank #1, kept)
  must(lightboxProbe().rank === "1", "back on class 2 for the toggle dance");
  await realClick(`[...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-canvas-ui=lightbox-counter]')).querySelector('[data-canvas-ui=lightbox-keep]')`);
  await sleep(300);
  lb = lightboxProbe();
  must(lb.keepPressed === "false" && (lb.keepText || "").includes("Discarded"), "class 2 toggled OFF via button");
  await realClick(`[...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-canvas-ui=lightbox-counter]')).querySelector('[data-canvas-ui=lightbox-keep]')`);
  await sleep(300);
  lb = lightboxProbe();
  must(lb.keepPressed === "true" && lb.keepText === "Keep class", "class 2 toggled back ON");

  // --- Esc closes ---
  must(await closeDialogEsc(), "Esc closes the lightbox");
  g = galleryProbe();
  must(g.pressed.filter((p) => p === "true").length === 3, "selection unchanged after lightbox round-trip (auto 3 kept)");

  // --- Enter toggles keep from the dialog root (class 8) ---
  must((await openLightbox(8)).includes("clicked@"), "zoom class 8 opens");
  await keyInDialog("Enter");
  await sleep(300);
  lb = lightboxProbe();
  must(lb.keepPressed === "true" && lb.keepText === "Keep class", "Enter keeps discarded class 8");
  must(await closeDialogEsc(), "Esc closes again");
  g = galleryProbe();
  must(g.pressed[7] === "true", "card 8 aria-pressed after Enter-keep");
  must((g.footer || "").includes("Manual selection") && (g.footer || "").includes("1,080"), "footer now manual 1,080 particles (960 + 120)");

  // --- card click regression (toggle still works on the card itself) ---
  const card1 = await realClick(
    `[...document.querySelectorAll('section[aria-label="Class selection gallery"] button[aria-pressed]')].filter(b => (b.getAttribute('aria-label')||'').startsWith('Toggle class 1 '))[0]`,
  );
  must(card1.includes("clicked@"), "card 1 clicked");
  await sleep(400);
  g = galleryProbe();
  must(g.pressed[0] === "true", "card 1 now kept");
  must((g.footer || "").includes("1,260"), "footer 1,260 particles (1,2,4,6,8)");

  // --- screenshot with the lightbox open on class 1 ---
  must((await openLightbox(1)).includes("clicked@"), "reopen lightbox on class 1 for the shot");
  await sleep(600);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa58-lightbox.png`);
  step("  screenshot: qa58-lightbox.png");
  await closeDialogEsc();

  // restore auto for a clean next run
  const autoBtn = await realClick(
    `[...document.querySelectorAll('section[aria-label="Class selection gallery"] button')].find(b => b.textContent.trim() === 'Auto')`,
  );
  step(`  restore auto: ${autoBtn.slice(0, 20)}`);
  await sleep(500);
  g = galleryProbe();
  must((g.footer || "").includes("Auto selection"), "auto restored for next run");
}

// ============================================================ phase B
async function phaseB() {
  step("== PHASE B: help popover shortcut coverage ==");
  const opened = await realClick(
    `[...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').startsWith('Help — how to use'))`,
  );
  must(opened.includes("clicked@"), "help trigger clicked");
  await sleep(700);
  // Task 71: the popover no longer carries its own shortcut list — the
  // full inventory moved into the shortcuts dialog (one data source). The
  // popover must now carry the CTA door; the 1–4 and lightbox entries are
  // asserted INSIDE the dialog.
  const probe = J(`(() => {
    const pop = [...document.querySelectorAll('[data-radix-popper-content-wrapper]')].map(w => w.textContent).join(' ');
    return { cta: pop.includes('View all keyboard shortcuts'), len: pop.length };
  })()`);
  step(`  help: ${JSON.stringify(probe)}`);
  must(probe.cta, "help popover carries the shortcuts-dialog CTA");
  const openedDlg = await realClick(
    `[...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('View all keyboard shortcuts'))`,
  );
  must(openedDlg.includes("clicked@"), "CTA opens the shortcuts dialog");
  await sleep(700);
  const dlg = J(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent || '').includes('Keyboard shortcuts'));
    const t = d ? (d.textContent || '') : '';
    return {
      dash: t.includes('Grid filter') && t.includes('1–4'),
      // kbd chips render adjacent (flex gap, no text nodes) — the combo
      // reads "←→↑↓" contiguous in textContent
      lightbox: t.includes('Move focus across the class grid') && t.includes('←→↑↓'),
      arrows: t.includes('←→↑↓'),
    };
  })()`);
  step(`  dialog: ${JSON.stringify(dlg)}`);
  must(dlg.dash, "shortcuts dialog lists dashboard 1–4 grid filter");
  must(dlg.lightbox, "shortcuts dialog lists gallery arrow navigation");
  evalJs(`(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'esc'; })()`);
  await sleep(400);
}

// ============================================================ phase C
async function phaseC() {
  step("== PHASE C: console + cleanup ==");
  const errs = errCount();
  // J() JSON-parses the bare `0` into a NUMBER — compare with String()
  must(String(errs) === "0", `in-page console errors = 0 (got ${errs})`);
  sh(SEED_CLEAN);
  step("  seed cleaned (workdir files + engine-state entry)");
}

const all = { A: phaseA, B: phaseB, C: phaseC };
for (const p of PHASES) {
  if (!all[p]) FATAL(`unknown phase ${p}`);
  await all[p]();
}
step("ALL PHASES GREEN");
console.log("ALL PHASES GREEN");
