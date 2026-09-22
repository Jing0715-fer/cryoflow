// t163 — Task 163: the favorites row reorders on TOUCH — long-press lifts,
// drift is scroll, the drop machinery is shared with the mouse.
//
// Task 155's reorder activation was a 5px threshold — unwinnable on a
// touchscreen: the browser claims the first finger wiggle for the sidebar's
// pan (pointercancel fires long before 5px of pointermove accumulates), and
// touch-action:none on the chip is not an option because a chip-sized target
// is squarely inside the scroll surface. Task 163 gives touch its OWN
// activation into the SAME drop machinery: hold ~450ms within 10px of drift
// and the chip LIFTS (arming halo charges on the same 450ms clock so the
// lift reads as the halo's completion); drift past the slop first kills the
// arm (the gesture was a scroll — the sidebar pans natively); an early
// release is a tap (the add contract fires). After the lift a native
// non-passive touchmove veto (React 17+ attaches synthetic touchmove
// passively — a passive listener cannot veto) keeps the pan from starting
// mid-reorder, and a touch LIFT suppresses the chip's click even with no
// movement (a long-press is a reorder claim, never an add) while every
// fresh pointerdown resets the suppressor so no stale flag eats the next
// genuine tap.
//
// Phase S — purge + roster snapshot + keeper + seed FAV_KEY 4 types.
// Phase X — source oracle: the touch fields in their own drag family, the
//           tuning constants, the non-passive veto, the suppressor reset,
//           the arming/lifted attrs, the gated touch-none, the haptic guard,
//           the timer-killing cleanup, the CSS halo under motion-safe.
// Phase T — the synthetic touch pointer stream (PointerEvent dispatch):
//   T1 arming — pointerdown(touch): arming attr ON, halo class ON, and the
//      chip is NOT lifted early (the hold is real time, not instant).
//   T2 lift — past ~450ms: lifted attr ON, arming cleared, row lift-active.
//   T3 drop — caret on the neighbor's first half, release: DOM order AND
//      storage flip, no job added, every gesture attr cleared.
//   T4 lift-no-move — release after lift with no movement + a simulated
//      browser click: NO add, order intact; the NEXT tap (fresh
//      pointerdown reset) adds exactly one job — the contract survives.
//   T5 slop cancel — an 18px move at ~150ms kills the arm (arming attr
//      gone at once, never lifts), and the tap still adds: scroll won.
//   T6 pointercancel — mid-hold cancel clears arming and the pending
//      timer: nothing lifts from a gesture the finger already left.
// Phase R — REAL touch through CDP (Input.dispatchTouchEvent): hold lifts,
//      a vertical probe + horizontal move keeps the sidebar scroll frozen
//      (the veto held) and the caret alive (no pointercancel), the drop
//      reorders and persists.
// Phase M — mouse regression: the 5px threshold family still reorders and
//      wears the FADE look (data-fav-dragging, never data-fav-lifted).
// Phase K — the keyboard twin (Alt+←/→) still swaps and persists.
// Phase Z — strict console/pageerror/4xx, roster restored to the snapshot,
//           screenshots (arming halo, touch lift mid-drag, mouse drag).
//
// Run: node scripts/t163-e2e.mjs   (server on :3000, fresh build REQUIRED)

import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t163-shot";
const FAV_KEY = "cryoflow-fav-types";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
const seededIds = [];
const addedJobIds = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

const stampEx = (id, data) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:${JSON.stringify(data)}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

const purgeT163 = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T163"}}}).then(r=>{console.log("purged",r.count);return p.$disconnect()})'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

const deleteJobById = (id) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.delete({where:{id:"${id}"}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}

const must = (cond, label) => {
  if (!cond) {
    console.log(`FAIL: ${label}`);
    void cleanup().then(() => process.exit(1));
    throw new Error(`FAIL: ${label}`);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};
const step = (m) => console.log(m);
process.on("SIGINT", () => { console.log("SIGINT"); process.exit(1); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(1); });

const chipOrder = async () =>
  p.locator('[data-testid="palette-favs-row"] [data-testid^="palette-fav-chip-"]').evaluateAll(
    (els) => els.map((e) => e.getAttribute("data-testid").replace("palette-fav-chip-", ""))
  );

const chipBox = async (key) => {
  const loc = p.locator(`[data-testid="palette-fav-chip-${key}"]`);
  await loc.scrollIntoViewIfNeeded();
  await sleep(150);
  const box = await loc.boundingBox();
  must(!!box && box.x > 0 && box.y > 0, `chip ${key} visible for the gesture (x=${box?.x?.toFixed(0)},y=${box?.y?.toFixed(0)})`);
  return box;
};

/** Dispatch a synthetic PointerEvent from inside the page. pointerdown
 *  targets the chip (React's delegated root listener must see it); moves
 *  and ups go to window (the reorder family listens there). Returns the
 *  chip's center or an explicit point. */
const firePointer = async (sel, type, x, y, pointerType = "touch") =>
  p.evaluate(([sel, type, x, y, pointerType]) => {
    const target = sel === "window" ? window : document.querySelector(sel);
    if (!target) return "NO-EL";
    const hasButton = type !== "pointermove";
    const ev = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 4242,
      pointerType,
      isPrimary: true,
      button: hasButton ? 0 : -1,
      buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
      clientX: x,
      clientY: y,
    });
    target.dispatchEvent(ev);
    return "OK";
  }, [sel, type, x, y, pointerType]);

/** Sample an attribute until it appears (or deadline). Returns ms when
 *  first seen, or -1. */
const waitForAttr = async (sel, attr, deadlineMs, pollMs = 50) => {
  const t0 = Date.now();
  for (;;) {
    const v = await p.evaluate(([sel, attr]) => {
      const el = document.querySelector(sel);
      return el ? el.getAttribute(attr) : null;
    }, [sel, attr]);
    if (v === "true") return Date.now() - t0;
    if (Date.now() - t0 > deadlineMs) return -1;
    await sleep(pollMs);
  }
};

const makeJob = async (name, type, y) => {
  const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
  const j = created?.job ?? created;
  must(!!j?.id, `${name}: created (${type})`);
  seededIds.push(j.id);
  return j;
};

async function main() {
  /* ---------------- Phase S — clean world + keeper + seed --------------- */
  step("--- Phase S: purge + snapshot + keeper + fav seed ---");
  purgeT163();
  const rosterBefore = await roster();
  const keeper = await makeJob("T163 Keeper", "motioncorr", 60);
  stampEx(keeper.id, { status: "running", progress: 20, startedAt: new Date(Date.now() - 15_000).toISOString() });

  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.evaluate((v) => window.localStorage.setItem("cryoflow-fav-types", JSON.stringify(v)),
    ["import", "motioncorr", "extract", "refine3d"]);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1000);

  const seedOrder = await chipOrder();
  must(JSON.stringify(seedOrder) === JSON.stringify(["import", "motioncorr", "extract", "refine3d"]),
    `seeded order renders as-is (${seedOrder.join(" → ")})`);
  must((await p.locator('[data-fav-arming]').count()) === 0,
    "no arming chip at rest (the halo is gesture-scoped)");

  /* ---------------- Phase X — source oracle ------------------------------- */
  step("--- Phase X: source oracle — one grammar per pointer family ---");
  const src = execSync("cat src/components/workflow/palette.tsx", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/touch: boolean;\s*\n\s*liftTimer: number \| null;/.test(src),
    "oracle: the drag family carries touch bookkeeping (family + timer)");
  must(/const FAV_LONG_PRESS_MS = 450;/.test(src) && /const FAV_TOUCH_SLOP_PX = 10;/.test(src),
    "oracle: the tuning constants exist (450ms hold, 10px finger slop)");
  must(/e\.pointerType === "touch"/.test(src),
    "oracle: activation branches on the POINTER FAMILY, not buttons");
  must(/suppressFavClickRef\.current = false;\s*\n\s*const touch =/.test(src),
    "oracle: every fresh pointerdown resets the stale click suppressor");
  must(/navigator\.vibrate\?\.\(15\)/.test(src),
    "oracle: the lift haptic is guarded (progressive enhancement)");
  must(/row\?\.addEventListener\("touchmove", favTouchVeto, \{ passive: false \}\)/.test(src),
    "oracle: the pan veto is a NATIVE non-passive touchmove listener");
  must(/if \(favDragRef\.current\?\.active\) e\.preventDefault\(\);/.test(src),
    "oracle: the veto preventDefaults only while a lift is active");
  must(/favDragType && "touch-none"/.test(src),
    "oracle: touch-none lands on the row ONLY while a lift is active");
  must(/data-fav-lifted=\{lifting \? "true" : undefined\}/.test(src) &&
       /data-fav-arming=\{arming \? "true" : undefined\}/.test(src),
    "oracle: arming and lifted are SEPARATE probe-visible states");
  must(/if \(favDragRef\.current\?\.liftTimer != null\) clearTimeout\(favDragRef\.current\.liftTimer\);/.test(src),
    "oracle: the cleanup kills the pending lift timer (no ghost lifts)");
  const css = execSync("cat src/app/globals.css", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/\.fav-chip-arming/.test(css) && /fav-arm-halo 450ms linear/.test(css) &&
       /prefers-reduced-motion: no-preference/.test(css),
    "oracle: the arming halo is 450ms-linear and motion-safe-gated (CSS)");

  /* ---------------- Phase T1+T2 — arming then lift ------------------------- */
  step("--- Phase T1: touch down — the chip arms, nothing lifts yet ---");
  const exBox = await chipBox("extract");
  const cx = exBox.x + exBox.width / 2;
  const cy = exBox.y + exBox.height / 2;
  const exSel = '[data-testid="palette-fav-chip-extract"]';
  must((await firePointer(exSel, "pointerdown", cx, cy)) === "OK",
    "pointerdown(touch) dispatched on the extract chip");
  await sleep(80);
  must((await p.locator('[data-fav-arming="true"]').count()) === 1,
    "the held chip wears the arming marker (the halo charge is visible)");
  must((await p.evaluate(() => {
    const el = document.querySelector('[data-fav-arming="true"]');
    return el ? getComputedStyle(el).animationName : "NONE";
  })) === "fav-arm-halo",
    "the arming halo animation is RUNNING on the held chip");
  await sleep(140); // ~220ms into the hold
  must((await p.locator('[data-fav-lifted="true"]').count()) === 0,
    "220ms into the hold: NO lift (the hold is real time, not instant)");

  step("--- Phase T2: hold past 450ms — the chip lifts ---");
  const liftMs = await waitForAttr(exSel, "data-fav-lifted", 900);
  must(liftMs >= 0 && 200 + liftMs >= 380, `the lift lands near the timer (${200 + liftMs}ms into the hold)`);
  must((await p.locator('[data-fav-arming="true"]').count()) === 0,
    "the arming halo retired at the lift (charge completed, not looping)");
  must((await p.locator('[data-testid="palette-favs-row"]').getAttribute("data-fav-lift-active")) === "true",
    "the row declares a live lift (touch-none gate engaged)");
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t163-touch-lifted.png` });

  /* ---------------- Phase T3 — the touch reorder --------------------------- */
  step("--- Phase T3: move to the neighbor — caret, drop, persist ---");
  const rosterT3Before = (await roster()).length;
  const imBox = await chipBox("import");
  // first quarter of the import chip → insertion BEFORE it (k = 0)
  const dropX = imBox.x + 6;
  const dropY = imBox.y + imBox.height / 2;
  await firePointer("window", "pointermove", dropX, dropY);
  await sleep(150);
  must((await p.locator('[data-fav-caret="before"]').count()) === 1,
    "the amber caret sits BEFORE the import chip mid-drag");
  await p.screenshot({ path: `${OUT}/t163-touch-caret.png` });
  await firePointer("window", "pointerup", dropX, dropY);
  await sleep(300);
  const afterTouch = await chipOrder();
  must(JSON.stringify(afterTouch) === JSON.stringify(["extract", "import", "motioncorr", "refine3d"]),
    `the touch drop reordered (${afterTouch.join(" → ")})`);
  must((await p.evaluate((k) => window.localStorage.getItem(k), FAV_KEY)) ===
    JSON.stringify(["extract", "import", "motioncorr", "refine3d"]),
    "storage holds the touch order (the same last-explicit-wins law)");
  must((await roster()).length === rosterT3Before,
    `the touch reorder added NO job (roster ${rosterT3Before})`);
  must((await p.locator('[data-fav-lifted="true"], [data-fav-arming="true"]').count()) === 0,
    "every touch gesture attr cleared after the drop");
  must((await p.locator('[data-testid="palette-favs-row"]').getAttribute("data-fav-lift-active")) === null,
    "the row's lift-active retired (touch-none gate released)");

  /* ---------------- Phase T4 — lift without move is never an add ----------- */
  step("--- Phase T4: lift, release, synthesized click — still no add ---");
  const exBox2 = await chipBox("extract");
  const cx2 = exBox2.x + exBox2.width / 2;
  const cy2 = exBox2.y + exBox2.height / 2;
  const storageT4 = await p.evaluate((k) => window.localStorage.getItem(k), FAV_KEY);
  const rosterBeforeT4Ids = new Set((await roster()).map((j) => j.id));
  const rosterT4Before = rosterBeforeT4Ids.size;
  await firePointer(exSel, "pointerdown", cx2, cy2);
  await sleep(700); // lift
  must((await p.locator('[data-fav-lifted="true"]').count()) === 1,
    "the chip lifted again (hold two)");
  await firePointer("window", "pointerup", cx2, cy2);
  await sleep(80);
  // the browser MAY synthesize a click after the touch — simulate it
  await p.evaluate((sel) => document.querySelector(sel).click(), exSel);
  await sleep(600);
  must((await roster()).length === rosterT4Before,
    `the post-lift synthesized click did NOT add (${rosterT4Before} still)`);
  must((await p.evaluate((k) => window.localStorage.getItem(k), FAV_KEY)) === storageT4,
    "the no-move lift reordered nothing either");
  // the NEXT genuine tap must add — the fresh pointerdown reset the flag
  await firePointer(exSel, "pointerdown", cx2, cy2);
  await sleep(60);
  await firePointer("window", "pointerup", cx2, cy2);
  await sleep(60);
  await p.evaluate((sel) => document.querySelector(sel).click(), exSel);
  await sleep(1000);
  const rosterT4 = await roster();
  must(rosterT4.length === rosterT4Before + 1, `the NEXT genuine tap adds again (${rosterT4.length} == ${rosterT4Before} + 1)`);
  const addedJob = rosterT4.find((j) => !rosterBeforeT4Ids.has(j.id));
  must(!!addedJob && addedJob.type === "extract",
    `the tap added the chip's type (${addedJob?.type})`);
  if (addedJob?.id) addedJobIds.push(addedJob.id);

  /* ---------------- Phase T5 — drift past the slop is a scroll ------------- */
  step("--- Phase T5: an 18px drift kills the arm — the tap still adds ---");
  const exBox3 = await chipBox("extract");
  const cx3 = exBox3.x + exBox3.width / 2;
  const cy3 = exBox3.y + exBox3.height / 2;
  const rosterT5Before = (await roster()).length;
  await firePointer(exSel, "pointerdown", cx3, cy3);
  await sleep(120);
  must((await p.locator('[data-fav-arming="true"]').count()) === 1,
    "arming again (third gesture)");
  await firePointer("window", "pointermove", cx3 + 18, cy3 + 6);
  await sleep(80);
  must((await p.locator('[data-fav-arming="true"]').count()) === 0,
    "the arming halo died THE INSTANT the drift passed the slop");
  await sleep(600); // well past 450ms from pointerdown
  must((await p.locator('[data-fav-lifted="true"]').count()) === 0,
    "no lift ever came (a scroll claim, not a reorder claim)");
  await firePointer("window", "pointerup", cx3 + 18, cy3 + 6);
  await sleep(60);
  await p.evaluate((sel) => document.querySelector(sel).click(), exSel);
  await sleep(1000);
  const rosterT5 = await roster();
  must(rosterT5.length === rosterT5Before + 1,
    `the reverted tap ADDS (scroll won, contract intact: ${rosterT5.length})`);
  const addedT5Job = rosterT5.find((j) => !rosterBeforeT4Ids.has(j.id) && !addedJobIds.includes(j.id));
  must(!!addedT5Job && addedT5Job.type === "extract",
    `the reverted tap's job is the chip's type (${addedT5Job?.type})`);
  if (addedT5Job?.id) addedJobIds.push(addedT5Job.id);

  /* ---------------- Phase T6 — pointercancel kills the pending lift -------- */
  step("--- Phase T6: pointercancel mid-hold — nothing lifts after ---");
  const exBox4 = await chipBox("extract");
  const cx4 = exBox4.x + exBox4.width / 2;
  const cy4 = exBox4.y + exBox4.height / 2;
  await firePointer(exSel, "pointerdown", cx4, cy4);
  await sleep(120);
  must((await p.locator('[data-fav-arming="true"]').count()) === 1,
    "arming (fourth gesture)");
  await p.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel", {
    bubbles: true, cancelable: false, pointerId: 4242, pointerType: "touch", isPrimary: true,
  })));
  await sleep(80);
  must((await p.locator('[data-fav-arming="true"]').count()) === 0,
    "the cancel cleared the arming halo at once");
  await sleep(600);
  must((await p.locator('[data-fav-lifted="true"]').count()) === 0,
    "the pending timer died with the gesture (no ghost lift at ~720ms)");
  must((await p.locator('[data-fav-caret]').count()) === 0,
    "no caret residue after the cancel");

  /* ---------------- Phase R — REAL touch through CDP ----------------------- */
  step("--- Phase R: real touch via CDP — lift, vetoed pan, drop ---");
  // order entering R: [extract, import, motioncorr, refine3d]; hold
  // extract (index 0), drop before motioncorr (index 2) → [import, extract,
  // motioncorr, refine3d]
  const mcPre = await chipBox("motioncorr");
  void mcPre;
  const exBox5 = await chipBox("extract");
  const cx5 = exBox5.x + exBox5.width / 2;
  const cy5 = exBox5.y + exBox5.height / 2;
  const scrollBefore = await p.evaluate(() => {
    let el = document.querySelector('[data-testid="palette-favs-row"]');
    let sum = 0;
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 4) sum += el.scrollTop;
      el = el.parentElement;
    }
    return sum;
  });
  const cdp = await p.context().newCDPSession(p);
  const tp = (x, y) => [{ x, y, id: 1, force: 1, radiusX: 4, radiusY: 4 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(cx5, cy5) });
  const realLift = await waitForAttr(exSel, "data-fav-lifted", 1200);
  must(realLift >= 0, "the REAL hold lifted the chip (browser pipeline -> timer)");
  // a vertical probe: without the veto this pans the sidebar and
  // pointercancels the drag; with it, the scroll freezes and the
  // pointer stream survives
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(cx5, cy5 - 30) });
  await sleep(120);
  const mcBox2 = await p.locator('[data-testid="palette-fav-chip-motioncorr"]').boundingBox();
  must(!!mcBox2 && mcBox2.x > 0, "motioncorr box fresh for the real drop");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(mcBox2.x + 6, mcBox2.y + mcBox2.height / 2) });
  await sleep(150);
  must((await p.locator('[data-fav-caret="before"]').count()) === 1,
    "the caret survived a vertical probe (the veto kept the pan dead)");
  const scrollAfter = await p.evaluate(() => {
    let el = document.querySelector('[data-testid="palette-favs-row"]');
    let sum = 0;
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 4) sum += el.scrollTop;
      el = el.parentElement;
    }
    return sum;
  });
  must(scrollBefore === scrollAfter,
    `the sidebar scroll is FROZEN through the lifted drag (${scrollBefore} == ${scrollAfter})`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(400);
  const afterReal = await chipOrder();
  must(JSON.stringify(afterReal) === JSON.stringify(["import", "extract", "motioncorr", "refine3d"]),
    `the real touch drop reordered (${afterReal.join(" → ")})`);
  must((await p.evaluate((k) => window.localStorage.getItem(k), FAV_KEY)) ===
    JSON.stringify(["import", "extract", "motioncorr", "refine3d"]),
    "the real touch order persisted");
  must((await roster()).length === rosterT5Before + 1,
    "the real touch reorder added NO job");
  await cdp.detach();

  /* ---------------- Phase M — mouse regression ----------------------------- */
  step("--- Phase M: the mouse family is untouched (5px, fade look) ---");
  // order entering M: [import, extract, motioncorr, refine3d]; drag
  // motioncorr (index 2) before import (index 0) → [motioncorr, import,
  // extract, refine3d]
  const mcChip = p.locator('[data-testid="palette-fav-chip-motioncorr"]');
  const mcBox = await chipBox("motioncorr");
  await p.mouse.move(mcBox.x + mcBox.width / 2, mcBox.y + mcBox.height / 2);
  await p.mouse.down();
  await p.mouse.move(mcBox.x + mcBox.width / 2 + 9, mcBox.y + mcBox.height / 2, { steps: 4 });
  await sleep(120);
  must((await mcChip.getAttribute("data-fav-dragging")) === "true",
    "a mouse drag wears the FADE marker (data-fav-dragging)");
  must((await mcChip.getAttribute("data-fav-lifted")) === null,
    "a mouse drag NEVER wears the lift look (families stay distinct)");
  const imBox3 = await p.locator('[data-testid="palette-fav-chip-import"]').boundingBox();
  must(!!imBox3 && imBox3.x > 0, "import box fresh for the mouse drop");
  await p.mouse.move(imBox3.x + 6, imBox3.y + imBox3.height / 2, { steps: 8 });
  await sleep(150);
  must((await p.locator('[data-fav-caret="before"]').count()) === 1,
    "the caret sits before import mid-mouse-drag");
  await p.mouse.up();
  await sleep(300);
  const afterMouse = await chipOrder();
  must(JSON.stringify(afterMouse) === JSON.stringify(["motioncorr", "import", "extract", "refine3d"]),
    `the mouse drag still reorders (${afterMouse.join(" → ")})`);

  /* ---------------- Phase K — the keyboard twin ---------------------------- */
  step("--- Phase K: Alt+arrows still swap and persist ---");
  // focus import (index 1); Alt+Left swaps it with motioncorr and back
  const imChip2 = p.locator('[data-testid="palette-fav-chip-import"]');
  await imChip2.scrollIntoViewIfNeeded();
  await imChip2.focus();
  await p.keyboard.press("Alt+ArrowLeft");
  await sleep(300);
  const afterKey = await chipOrder();
  must(JSON.stringify(afterKey) === JSON.stringify(["import", "motioncorr", "extract", "refine3d"]),
    `Alt+Left swapped 1↔0 (${afterKey.join(" → ")})`);
  must((await p.evaluate((k) => window.localStorage.getItem(k), FAV_KEY)) ===
    JSON.stringify(["import", "motioncorr", "extract", "refine3d"]),
    "the keyboard swap persisted");
  await p.keyboard.press("Alt+ArrowRight");
  await sleep(300);
  must(JSON.stringify(await chipOrder()) === JSON.stringify(["motioncorr", "import", "extract", "refine3d"]),
    "Alt+Right swaps back (the twin is symmetric)");
  await p.screenshot({ path: `${OUT}/t163-final-row.png` });

  /* ---------------- Phase Z — strict console + roster restored ------------- */
  step("--- Phase Z: strict console + roster restored ---");
  must(pageErrors.length === 0, `0 pageerrors (got ${pageErrors.length}: ${pageErrors[0] ?? ""})`);
  must(consoleErrors.length === 0, `0 console errors (got ${consoleErrors.length}: ${consoleErrors[0] ?? ""})`);
  must(badResponses.length === 0, `0 responses >= 400 (got: ${badResponses.slice(0, 3).join(" | ")})`);
  for (const id of addedJobIds) deleteJobById(id);
  for (const id of seededIds) deleteJobById(id);
  const rosterZ = await roster();
  must(rosterZ.length === rosterBefore.length,
    `roster restored (${rosterZ.length} == ${rosterBefore.length})`);
  must((await p.evaluate((k) => window.localStorage.getItem(k), FAV_KEY)) ===
    JSON.stringify(["motioncorr", "import", "extract", "refine3d"]),
    "the favorite order keeps the user's last explicit arrangement");

  console.log(`T163 ALL PASS (${PASS} assertions)`);
  await cleanup();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("T163 ERROR:", e?.message ?? e);
  await cleanup();
  process.exit(1);
});
