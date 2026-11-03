// t1127 — the qa69 Phase B NO-SLIDER probe, third round: nav-proof (the
// dev lane's compile-settled reloads destroy evaluation contexts), open-
// aware (the first enlarge already opens the dialog — never click twice),
// and answers the original question: did the slice intent land, and does
// the slider selector match?
import { chromium } from "playwright";

const B = "http://localhost:3000";
const CARD = "QA Class2D Source";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, hasTouch: true });
const p = await ctx.newPage();
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120)); });
const consoleErrors = [];
p.on("framenavigated", (f) => {
  if (f === p.mainFrame()) console.log(`[nav] ${new Date().toISOString().slice(11, 19)} ${f.url()}`);
});

// nav-proof evaluate: retry once after a context-destroying navigation
const evalSafe = async (fn, arg) => {
  for (let i = 0; i < 3; i++) {
    try { return await p.evaluate(fn, arg); }
    catch (e) {
      if (!String(e).includes("context was destroyed") && !String(e).includes("Execution context")) throw e;
      console.log("[nav-recovery] re-warming after navigation");
      await p.goto(B, { waitUntil: "domcontentloaded" }).catch(() => {});
      await sleep(2500);
    }
  }
  return null;
};

await p.goto(B, { waitUntil: "networkidle" });
await sleep(2500);
await evalSafe(() => {
  window.__probe = { slice: 0, sliceState: 0, detail: null };
  window.addEventListener("cryoflow:ortho-slice", (e) => {
    window.__probe.slice++;
    window.__probe.detail = JSON.stringify(e.detail);
  });
  window.addEventListener("cryoflow:ortho-slice-state", () => { window.__probe.sliceState++; });
});

// drive: canvas → card → Results → enlarge (open-aware) → expand → sync
let stage = "canvas";
for (let round = 0; round < 30 && stage !== "done"; round++) {
  if (stage === "canvas") {
    const ok = await evalSafe(
      (card) => [...document.querySelectorAll("[role=button]")].some((x) => (x.textContent || "").includes(card)),
      CARD,
    );
    if (ok) { stage = "card"; continue; }
    await p.keyboard.press("Shift+D").catch(() => {});
    await sleep(2200);
  } else if (stage === "card") {
    try {
      await p.locator('[role="button"]', { hasText: CARD }).first().click({ timeout: 6000 });
      stage = "results";
    } catch { await sleep(1500); }
    await sleep(1600);
  } else if (stage === "results") {
    try {
      await p.locator('[role="tab"]', { hasText: /^Results$/ }).first().click({ timeout: 6000 });
      stage = "enlarge";
    } catch { stage = "card"; }
    await sleep(1400);
  } else if (stage === "enlarge") {
    const open = await evalSafe(() => !!document.querySelector('[data-canvas-ui="ortho-panel"]'));
    if (open) { stage = "expand"; continue; }
    const btnThere = await evalSafe(
      () => !!document.querySelector('button[aria-label^="Enlarge"][aria-label*="orthovol"]'),
    );
    if (!btnThere) { stage = "results"; continue; } // a nav reset us — walk back
    try {
      await p.locator('button[aria-label^="Enlarge"][aria-label*="orthovol"]').first().click({ timeout: 6000 });
    } catch { /* covered or mid-nav — the open check re-decides */ }
    await sleep(2000);
  } else if (stage === "expand") {
    const tiles = await evalSafe(() => document.querySelectorAll('[data-canvas-ui^="ortho-tile"] img').length);
    if ((tiles ?? 0) >= 3) { stage = "sync"; continue; }
    const stripThere = await evalSafe(() => !!document.querySelector('[data-canvas-ui="ortho-panel"] button[aria-expanded]'));
    if (!stripThere) { stage = "enlarge"; continue; } // a nav reset us — walk back
    try {
      await p.locator('[data-canvas-ui="ortho-panel"] button[aria-expanded]').first().click({ timeout: 5000 });
    } catch { /* retry */ }
    await sleep(1400);
  } else if (stage === "sync") {
    // DECISIVE READ: dispatch the SAME event the tile button dispatches —
    // no click path, no hit-testing. If the slider mounts, the plumbing
    // is sound and the ride's click never dispatched; if it does not, the
    // embed's listener or intent path is broken (a real product bug).
    await evalSafe(() =>
      window.dispatchEvent(new CustomEvent("cryoflow:ortho-slice", { detail: { axis: "z", pos: 0.5 } })),
    );
    await sleep(1800);
    const after = await evalSafe(() => ({
      probe: window.__probe || null,
      sliders: [...document.querySelectorAll('[role=slider]')].map((s) => s.getAttribute("aria-label")),
      axisGroups: document.querySelectorAll('[role=group][aria-label="Cross-section axis"]').length,
      pressed: [...document.querySelectorAll('button[aria-label="Toggle cross-section plane"]')].map((t) => t.getAttribute("aria-pressed")),
    }));
    console.log("AFTER DIRECT DISPATCH:", JSON.stringify(after, null, 1));
    // then the real click, dialog-scoped, for the click-path comparison
    try {
      await p.locator('[role="dialog"] [data-canvas-ui="ortho-tile-z"] button[aria-label^="Show the XY plane"]').first()
        .click({ timeout: 6000 });
      console.log("dialog-scoped sync click: LANDED");
    } catch (e) {
      console.log("dialog-scoped sync click BLOCKED:", String(e).slice(0, 100));
    }
    await sleep(1500);
    stage = "done";
  }
}

const post = await evalSafe(() => ({
  probe: window.__probe || null,
  toggles: document.querySelectorAll('button[aria-label="Toggle cross-section plane"]').length,
  pressed: [...document.querySelectorAll('button[aria-label="Toggle cross-section plane"]')].map((t) => t.getAttribute("aria-pressed")),
  sliders: [...document.querySelectorAll('[role=slider]')].map((s) => s.getAttribute("aria-label")),
  axisGroups: document.querySelectorAll('[role=group][aria-label="Cross-section axis"]').length,
  slicePanel: !!document.querySelector(".border-cyan-600\\/25"),
}));
console.log("stage:", stage);
console.log("POST:", JSON.stringify(post, null, 1));

await b.close();
console.log("console errors:", consoleErrors.length, consoleErrors.slice(0, 3));
