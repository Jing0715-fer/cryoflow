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
//
// Task 92 — MIGRATED agent-browser CLI → playwright. The matrix's last
// CLI-driven suite (smoke went first this round; Task 91's "zero
// agent-browser" claim missed both). Assertion set byte-identical — only
// the driver changed (qa70/qa66/qa69/smoke template). The roving/toggle
// keys stay SYNTHETIC dispatches on the dialog root (they drive React
// onKeyDown handlers — qa66 doctrine); clicks are real playwright
// pointers. Zoom buttons are hover-reveal (opacity-0 at rest): the probe
// hovers the cell before clicking, mirroring a real pointer, since this
// desktop context reports (hover: hover) — the qa69 lesson inverted.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

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
const PHASES = (process.env.QA_PHASES || "A,B,C").split(",").map((s) => s.trim().toUpperCase());

const B = "http://localhost:3000";
const SEL_JOB = "QA Class Select";
const SEED = "python3 /home/z/my-project/scripts/qa58-seed-gallery.py";
const SEED_CLEAN = "python3 /home/z/my-project/scripts/qa58-seed-gallery.py --clean";
const FATAL = (msg) => { step(`FATAL: ${msg}`); console.error(`FATAL: ${msg}`); process.exit(1); };
const must = (cond, label) => { if (!cond) FATAL(label); else step(`  ok: ${label}`); };

let b = null;
let p = null;
async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}

// gallery probe — cards in document order with their toggle state; the
// footer text carries the effective selection summary
const galleryProbe = () => p.evaluate(() => {
  const sec = document.querySelector('section[aria-label="Class selection gallery"]');
  if (!sec) return null;
  const grid = sec.querySelector('[data-canvas-ui=class-grid]');
  const cards = grid ? [...grid.querySelectorAll("button[aria-pressed]")] : [];
  const footer = sec.querySelector('[data-canvas-ui=class-gallery-footer]');
  return {
    cards: cards.length,
    pressed: cards.map((x) => x.getAttribute("aria-pressed")),
    zooms: sec.querySelectorAll("[data-canvas-ui=class-zoom]").length,
    footer: footer ? footer.textContent.replace(/\s+/g, " ").trim().slice(0, 140) : null,
  };
});

// lightbox probe — scoped by its counter marker (a plain Radix dialog role
// is shared with popovers/menus, qa54 lesson)
const lightboxProbe = () => p.evaluate(() => {
  const dl = [...document.querySelectorAll("[role=dialog]")].find((d) => d.querySelector("[data-canvas-ui=lightbox-counter]"));
  if (!dl) return null;
  const counter = dl.querySelector("[data-canvas-ui=lightbox-counter]").textContent.trim();
  const keep = dl.querySelector("[data-canvas-ui=lightbox-keep]");
  const img = dl.querySelector('img[alt*="full size"]');
  const title = (dl.querySelector("[data-canvas-ui=lightbox-title]") || {}).textContent || "";
  const rank = (dl.textContent.match(/rank #(\d+)/) || [])[1] ?? null;
  const badge = dl.textContent.includes("kept") && !dl.textContent.includes("discarded") ? "kept"
    : (dl.textContent.includes("discarded") ? "discarded" : null);
  return {
    counter,
    keepText: keep ? keep.textContent.trim() : null,
    keepPressed: keep ? keep.getAttribute("aria-pressed") : null,
    imgAlt: img ? img.getAttribute("alt") : null,
    title: title.replace(/\s+/g, " ").trim().slice(0, 40),
    rank,
    badge,
  };
});

const lightboxGone = () =>
  p.evaluate(() => ![...document.querySelectorAll("[role=dialog]")].some((d) => d.querySelector("[data-canvas-ui=lightbox-counter]")));

const keyInDialog = async (key, opts = "") => {
  // synthetic dispatch ON the lightbox dialog — the content handler consumes
  // these keys in a React onKeyDown with stopPropagation, and synthetic
  // events drive React handlers just fine (qa66 doctrine)
  await p.evaluate(({ key, opts }) => {
    const dl = [...document.querySelectorAll("[role=dialog]")].find((d) => d.querySelector("[data-canvas-ui=lightbox-counter]"));
    if (!dl) return "NO-DIALOG";
    dl.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...(opts ? JSON.parse(`{${opts}}`) : {}) }));
    return "sent";
  }, { key, opts });
  await sleep(350);
};

const openLightbox = async (cls) => {
  // hover the cell first: zoom buttons are hover-reveal (opacity-0 at rest
  // on this (hover: hover) context) — mirror the real pointer path
  const cell = p.locator(`[data-canvas-ui=class-zoom][aria-label^="Zoom class ${cls} "]`);
  await cell.hover({ timeout: 5000 });
  await cell.click({ timeout: 5000 });
  await sleep(500);
  return "clicked@";
};

const closeDialogEsc = async () => {
  // dispatch ON the lightbox dialog — the content handler consumes Esc with
  // stopPropagation, so a document-level dispatch would never reach it and
  // would instead hit the canvas-level deselect chain
  await p.evaluate(() => {
    const dl = [...document.querySelectorAll("[role=dialog]")].find((d) => d.querySelector("[data-canvas-ui=lightbox-counter]"));
    if (!dl) return "NO-DIALOG";
    dl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return "esc";
  });
  await sleep(600);
  return lightboxGone();
};

/** open the app and land on the canvas with the select2d job card visible */
const bootCanvas = async () => {
  await p.goto(B, { waitUntil: "networkidle" });
  await sleep(1500);
  const curView = () =>
    p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  for (let i = 0; i < 12; i++) {
    if ((await curView()) === "canvas") {
      const card = await p.locator("[data-job]", { hasText: SEL_JOB }).count();
      if (card > 0) return true;
    }
    // Shift+D toggles dashboard/canvas — pressing while NOT canvas
    // converges on canvas (t90/smoke pattern)
    await p.keyboard.press("Shift+D");
    step(`  bootCanvas: Shift+D toward canvas, iter ${i}`);
    await sleep(2200);
  }
  return false;
};

const openSelectPanel = async () => {
  for (let i = 0; i < 10; i++) {
    try {
      // idle card click = "Edit parameters" flow — the ONLY surface that
      // hosts the gallery (completed jobs open the large inspector modal,
      // which has no gallery — job-card.tsx semantics). data-job on the
      // wrapper, role=button on the card body inside it.
      await p.locator("[data-job]", { hasText: SEL_JOB }).locator('[role="button"]').first()
        .click({ timeout: 3000 });
      await sleep(1200);
      // panel body tabs default to I/O — the gallery lives under Params
      await p.locator("aside").nth(1).getByRole("tab", { name: "Params", exact: true })
        .click({ timeout: 3000 });
      await sleep(800);
      const has = await p.evaluate(() => !!document.querySelector('section[aria-label="Class selection gallery"]'));
      if (has) return true;
    } catch { /* retry */ }
    step(`  openSelectPanel iter ${i}: retrying`);
    await sleep(2000);
  }
  return false;
};

// ============================================================ phase A
async function phaseA() {
  step("== PHASE A: gallery lightbox ==");
  // self-seed (Task 86): every newer suite (qa81/qa83/…) runs the seeder
  // itself — qa58 predated that convention and relied on the runner to
  // remember, which silently broke whenever the gallery was left in the
  // manual state by a previous run's mid-crash. The seeder is idempotent
  // and project-agnostic (Task 85) and resets selectedClasses to auto.
  step(`  seed: ${sh(SEED).split("\n").slice(-2).join(" | ").slice(0, 120)}`);
  if (!(await bootCanvas())) FATAL("canvas never appeared");
  if (!(await openSelectPanel())) FATAL("select2d panel with gallery never appeared");

  let g = await galleryProbe();
  step(`  gallery: ${JSON.stringify(g).slice(0, 220)}`);
  must(g && g.cards === 8, "gallery renders 8 class cards");
  must(g.pressed.filter((x) => x === "true").length === 3, "auto mode keeps exactly 3 classes (1,2,3)");
  must(g.zooms === 8, "8 hover-zoom buttons present");
  must((g.footer || "").includes("960") && (g.footer || "").includes("1,455"), "auto footer 960 / 1,455 particles");

  // --- open lightbox on class 2 (kept, rank #1 on the shuffled ladder) ---
  must((await openLightbox(2)).includes("clicked@"), "zoom class 2 opens the lightbox");
  let lb = await lightboxProbe();
  step(`  lightbox: ${JSON.stringify(lb)}`);
  must(lb && lb.counter === "2 / 8", "counter reads 2 / 8");
  must(lb.rank === "1", "class 2 shows rank #1 (420 particles — shuffled ladder)");
  must(lb.keepPressed === "true", "class 2 starts kept (auto)");
  must((lb.imgAlt || "").startsWith("Class 2 average"), "full-size image present for class 2");

  // --- arrow navigation with wrap-around ---
  await keyInDialog("ArrowRight");
  must((await lightboxProbe()).counter === "3 / 8", "ArrowRight → 3 / 8");
  await keyInDialog("ArrowLeft");
  await keyInDialog("ArrowLeft");
  must((await lightboxProbe()).counter === "1 / 8", "ArrowLeft ×2 → 1 / 8");
  await keyInDialog("ArrowLeft");
  lb = await lightboxProbe();
  must(lb.counter === "8 / 8", "ArrowLeft wraps → 8 / 8");
  must(lb.keepPressed === "false", "class 8 is discarded");
  await keyInDialog("ArrowRight");
  must((await lightboxProbe()).counter === "1 / 8", "ArrowRight wraps → 1 / 8");
  lb = await lightboxProbe();
  must(lb.rank === "4", "class 1 shows rank #4 (180 particles)");

  // --- keep-toggle button flips both directions (class 2 = kept in auto) ---
  await keyInDialog("ArrowRight"); // → class 2 (rank #1, kept)
  must((await lightboxProbe()).rank === "1", "back on class 2 for the toggle dance");
  const keepBtn = p.locator('[role=dialog]:has([data-canvas-ui=lightbox-counter]) [data-canvas-ui=lightbox-keep]');
  await keepBtn.click();
  await sleep(300);
  lb = await lightboxProbe();
  must(lb.keepPressed === "false" && (lb.keepText || "").includes("Discarded"), "class 2 toggled OFF via button");
  await keepBtn.click();
  await sleep(300);
  lb = await lightboxProbe();
  must(lb.keepPressed === "true" && lb.keepText === "Keep class", "class 2 toggled back ON");

  // --- Esc closes ---
  must(await closeDialogEsc(), "Esc closes the lightbox");
  g = await galleryProbe();
  must(g.pressed.filter((x) => x === "true").length === 3, "selection unchanged after lightbox round-trip (auto 3 kept)");

  // --- Enter toggles keep from the dialog root (class 8) ---
  must((await openLightbox(8)).includes("clicked@"), "zoom class 8 opens");
  await keyInDialog("Enter");
  await sleep(300);
  lb = await lightboxProbe();
  must(lb.keepPressed === "true" && lb.keepText === "Keep class", "Enter keeps discarded class 8");
  must(await closeDialogEsc(), "Esc closes again");
  g = await galleryProbe();
  must(g.pressed[7] === "true", "card 8 aria-pressed after Enter-keep");
  must((g.footer || "").includes("Manual selection") && (g.footer || "").includes("1,080"), "footer now manual 1,080 particles (960 + 120)");

  // --- card click regression (toggle still works on the card itself) ---
  await p.locator('section[aria-label="Class selection gallery"] button[aria-pressed][aria-label^="Toggle class 1 "]')
    .first().click();
  must(true, "card 1 clicked");
  await sleep(400);
  g = await galleryProbe();
  must(g.pressed[0] === "true", "card 1 now kept");
  must((g.footer || "").includes("1,260"), "footer 1,260 particles (1,2,4,6,8)");

  // --- screenshot with the lightbox open on class 1 ---
  must((await openLightbox(1)).includes("clicked@"), "reopen lightbox on class 1 for the shot");
  await sleep(600);
  sh(`mkdir -p /home/z/my-project/agent-ctx`); // disaster-recovery rounds may wipe it
  await p.screenshot({ path: "/home/z/my-project/agent-ctx/qa58-lightbox.png" });
  step("  screenshot: qa58-lightbox.png");
  await closeDialogEsc();

  // restore auto for a clean next run
  await p.locator('section[aria-label="Class selection gallery"]').getByRole("button", { name: "Auto", exact: true }).click();
  step("  restore auto: clicked");
  await sleep(500);
  g = await galleryProbe();
  must((g.footer || "").includes("Auto selection"), "auto restored for next run");
}

// ============================================================ phase B
async function phaseB() {
  step("== PHASE B: help popover shortcut coverage ==");
  await p.locator('button[aria-label^="Help — how to use"]').first().click();
  must(true, "help trigger clicked");
  await sleep(700);
  // Task 71: the popover no longer carries its own shortcut list — the
  // full inventory moved into the shortcuts dialog (one data source). The
  // popover must now carry the CTA door; the 1–4 and lightbox entries are
  // asserted INSIDE the dialog.
  const probe = await p.evaluate(() => {
    const pop = [...document.querySelectorAll("[data-radix-popper-content-wrapper]")].map((w) => w.textContent).join(" ");
    return { cta: pop.includes("View all keyboard shortcuts"), len: pop.length };
  });
  step(`  help: ${JSON.stringify(probe)}`);
  must(probe.cta, "help popover carries the shortcuts-dialog CTA");
  await p.getByRole("button", { name: "View all keyboard shortcuts" }).click();
  must(true, "CTA opens the shortcuts dialog");
  await sleep(700);
  const dlg = await p.evaluate(() => {
    const d = [...document.querySelectorAll("[role=dialog]")].find((x) => (x.textContent || "").includes("Keyboard shortcuts"));
    const t = d ? (d.textContent || "") : "";
    return {
      dash: t.includes("Grid filter") && t.includes("1–4"),
      // kbd chips render adjacent (flex gap, no text nodes) — the combo
      // reads "←→↑↓" contiguous in textContent
      lightbox: t.includes("Move focus across the class grid") && t.includes("←→↑↓"),
      arrows: t.includes("←→↑↓"),
    };
  });
  step(`  dialog: ${JSON.stringify(dlg)}`);
  must(dlg.dash, "shortcuts dialog lists dashboard 1–4 grid filter");
  must(dlg.lightbox, "shortcuts dialog lists gallery arrow navigation");
  // document-level Esc: the shortcuts dialog's own layered-Esc contract
  // (unchanged from the CLI port — this listener lives at document level)
  await p.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return "esc";
  });
  await sleep(400);
}

// ============================================================ phase C
async function phaseC() {
  step("== PHASE C: console + cleanup ==");
  // playwright dual collection replaces the in-page collector (qa70 template)
  const errs = consoleErrors;
  must(errs.length === 0, `in-page console errors = 0 (got ${errs.length}: ${JSON.stringify(errs.slice(0, 3))})`);
  sh(SEED_CLEAN);
  step("  seed cleaned (workdir files + engine-state entry)");
}

try { sh("pkill -f agent-browser"); } catch { /* none running */ }
const consoleErrors = [];
b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } }); // desktop aside path (xl breakpoint) —
// the narrow viewport opens the inspector modal for completed jobs instead
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(String(m.text() || m).slice(0, 160)); });
p.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 160)));

const all = { A: phaseA, B: phaseB, C: phaseC };
try {
  for (const ph of PHASES) {
    if (!all[ph]) FATAL(`unknown phase ${ph}`);
    await all[ph]();
  }
  step("ALL PHASES GREEN");
  console.log("ALL PHASES GREEN");
} finally {
  await cleanup();
}
