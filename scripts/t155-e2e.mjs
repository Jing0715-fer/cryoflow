// t155 — Task 155: the favorites row is orderable — drag (or Alt+arrows)
// a chip, the last explicit order wins.
//
// The favorites chips (Task 133) were fixed in star order: first-starred
// first, no way to promote the type you actually reach for every hour.
// Task 155 lets the user reorder — pointer drag with a 5px threshold and
// an amber insertion caret, plus the keyboard twin (Alt+←/→ on a focused
// chip) so ordering is not a pointer-only privilege. The chip is a
// click-to-add button FIRST: the reorder drag lives in its OWN pointer
// family (favDragRef, never drag-to-create's dragRef), a drag that ends
// on its own chip is a same-slot no-op with NO caret theater, and the
// browser's synthesized click after a real drag is swallowed so the add
// contract stays exactly what it was.
//
// Phase S — purge + roster snapshot + keeper + seed FAV_KEY 3 types.
// Phase X — source oracle: the separate drag family, the event-path
//           reorder (persist-then-set, never in an updater), the
//           same-slot no-caret rule, the keyboard twin.
// Phase B — the drag: extract (3rd chip) dragged before import (1st) →
//           caret visible mid-drag, dragging chip marked, DOM order and
//           storage both flip to [extract, import, motioncorr].
// Phase C — reload: the reordered row survives (storage is the truth).
// Phase D — the add contract survives: a plain chip CLICK (no movement)
//           still adds the job (roster diff, cleaned by id afterwards).
// Phase E — the keyboard twin: Alt+ArrowLeft / Alt+ArrowRight swap
//           neighbors and persist; at the edge the same key is a no-op.
// Phase F — dropping OUTSIDE the row cancels: no reorder, no caret, and
//           CRUCIALLY no job — the fav drag must never become
//           drag-to-create.
// Phase G — screenshots (caret mid-drag + the reordered row).
// Phase Z — strict console, id-cleaned roster restored.
//
// Run: node scripts/t155-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t155-shot";
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

const purgeT155 = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T155"}}}).then(r=>{console.log("purged",r.count);return p.$disconnect()})'`,
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

const makeJob = async (name, type, y) => {
  const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
  const j = created?.job ?? created;
  must(!!j?.id, `${name}: created (${type})`);
  seededIds.push(j.id);
  return j;
};

/** Real pointer drag (mouse events, stepped) — the reorder listens on
 *  window pointermove, so the drag must be a REAL pointer stream. */
const dragChipTo = async (chipLoc, targetX, targetY) => {
  await chipLoc.scrollIntoViewIfNeeded();
  await sleep(150);
  const box = await chipLoc.boundingBox();
  must(!!box && box.x > 0, `chip visible for drag (x=${box?.x?.toFixed(0)})`);
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(targetX, targetY, { steps: 10 });
  await sleep(120);
};

async function main() {
  /* ---------------- Phase S — clean world + keeper + seed --------------- */
  step("--- Phase S: purge + snapshot + keeper + fav seed ---");
  purgeT155();
  const rosterBefore = (await roster()).length;
  const keeper = await makeJob("T155 Keeper", "motioncorr", 60);
  stampEx(keeper.id, { status: "running", progress: 20, startedAt: new Date(Date.now() - 15_000).toISOString() });

  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });

  await p.goto(BASE, { waitUntil: "networkidle" });
  // seed BEFORE anything reads it, then reload so the palette boots from it
  await p.evaluate((v) => window.localStorage.setItem("cryoflow-fav-types", JSON.stringify(v)),
    ["import", "motioncorr", "extract"]);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1000);

  /* ---------------- Phase X — source oracle ------------------------------- */
  step("--- Phase X: source oracle — a separate drag family ---");
  const src = execSync("cat src/components/workflow/palette.tsx", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/interface FavDragState \{/.test(src), "oracle: the reorder drag has its OWN state family");
  must(/favDragRef = React\.useRef<FavDragState \| null>\(null\);/.test(src),
    "oracle: its ref is never drag-to-create's dragRef");
  must(/suppressFavClickRef\.current = true;/.test(src) && /if \(suppressFavClickRef\.current\) \{/.test(src),
    "oracle: a real drag swallows the click the browser synthesizes after it");
  must(/const next = \[\.\.\.favs\];[\s\S]{0,200}writeFavs\(next\);\s*\n\s*setFavs\(next\);/.test(src),
    "oracle: the reorder persists on the EVENT path (persist-then-set, pure updater law)");
  must(/e\.altKey && \(e\.key === "ArrowLeft" \|\| e\.key === "ArrowRight"\)/.test(src),
    "oracle: the keyboard twin (Alt+Left/Right) exists on the chip");
  must(/data-fav-chip=""[\s\S]{0,80}data-fav-chip-index=\{i\}/.test(src),
    "oracle: chips expose data-fav-chip-index for the insertion probe");
  must(/const sameSlot = typeof k === "number" && \(k === fd\.fromIndex \|\| k === fd\.fromIndex \+ 1\);/.test(src),
    "oracle: a same-slot drop shows NO caret (no theater for a no-op)");

  /* ---------------- Phase B — the drag reorders --------------------------- */
  step("--- Phase B: drag extract before import — the order flips ---");
  const seedOrder = await chipOrder();
  must(JSON.stringify(seedOrder) === JSON.stringify(["import", "motioncorr", "extract"]),
    `seeded order renders as-is (${seedOrder.join(" → ")})`);

  const extractChip = p.locator('[data-testid="palette-fav-chip-extract"]');
  const importChip = p.locator('[data-testid="palette-fav-chip-import"]');
  const target = await importChip.boundingBox();
  must(!!target && target.x > 0, "import chip visible as the drop target");
  // drop LEFT of import's midpoint → k=0 → extract becomes first
  await dragChipTo(extractChip, target.x + 6, target.y + target.height / 2);
  // mid-drag: the caret is on, the dragged chip is marked
  must((await p.locator('[data-fav-caret="before"]').count()) === 1,
    "the amber insertion caret is ON during the drag (inset-shadow edge on the target chip)");
  must((await extractChip.getAttribute("data-fav-dragging")) === "true",
    "the dragged chip wears the dragging marker");
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t155-caret-mid-drag.png` });
  await p.mouse.up();
  await sleep(300);

  const afterDrag = await chipOrder();
  must(JSON.stringify(afterDrag) === JSON.stringify(["extract", "import", "motioncorr"]),
    `DOM order flipped (${afterDrag.join(" → ")})`);
  must((await p.evaluate((k) => window.localStorage.getItem(k), FAV_KEY)) ===
    JSON.stringify(["extract", "import", "motioncorr"]),
    "storage holds the SAME order (the last explicit reorder wins)");
  must((await p.locator('[data-testid="palette-fav-caret"]').count()) === 0,
    "the caret retired after the drop (no lingering theater)");
  must((await extractChip.getAttribute("data-fav-dragging")) === null,
    "the dragging marker cleared after the drop");

  /* ---------------- Phase C — the reorder survives a reload --------------- */
  step("--- Phase C: reload — storage is the truth ---");
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(900);
  const afterReload = await chipOrder();
  must(JSON.stringify(afterReload) === JSON.stringify(["extract", "import", "motioncorr"]),
    `reordered row survives the reload (${afterReload.join(" → ")})`);

  /* ---------------- Phase D — the add contract survives ------------------- */
  step("--- Phase D: a plain chip CLICK still adds the job ---");
  const beforeD = await roster();
  const beforeIds = new Set(beforeD.map((j) => j.id));
  await p.locator('[data-testid="palette-fav-chip-motioncorr"]').click();
  await sleep(1200);
  const rosterD = await roster();
  const added = rosterD.find((j) => !beforeIds.has(j.id)) ?? null;
  must(!!added && rosterD.length === beforeD.length + 1,
    `the click added exactly one job (${rosterD.length} == ${beforeD.length} + 1)`);
  must(added?.type === "motioncorr",
    `the added job is the chip's type (${added?.type})`);
  if (added?.id) addedJobIds.push(added.id);
  must((await p.locator('[data-fav-caret]').count()) === 0,
    "no caret ever appeared for a plain click (threshold holds)");

  /* ---------------- Phase E — the keyboard twin --------------------------- */
  step("--- Phase E: Alt+arrows swap neighbors and persist ---");
  // current: extract(0) import(1) motioncorr(2); focus import, Alt+Left
  const importChip2 = p.locator('[data-testid="palette-fav-chip-import"]');
  await importChip2.scrollIntoViewIfNeeded();
  await importChip2.focus();
  await p.keyboard.press("Alt+ArrowLeft");
  await sleep(300);
  const afterLeft = await chipOrder();
  must(JSON.stringify(afterLeft) === JSON.stringify(["import", "extract", "motioncorr"]),
    `Alt+Left swapped 0↔1 (${afterLeft.join(" → ")})`);
  must((await p.evaluate((k) => window.localStorage.getItem(k), FAV_KEY)) ===
    JSON.stringify(["import", "extract", "motioncorr"]),
    "the keyboard reorder persisted too");
  await p.keyboard.press("Alt+ArrowRight");
  await sleep(300);
  must(JSON.stringify(await chipOrder()) === JSON.stringify(["extract", "import", "motioncorr"]),
    "Alt+Right swaps back (the twin is symmetric)");
  // edge: first chip + Alt+Left is a no-op
  await p.locator('[data-testid="palette-fav-chip-extract"]').focus();
  await p.keyboard.press("Alt+ArrowLeft");
  await sleep(300);
  must(JSON.stringify(await chipOrder()) === JSON.stringify(["extract", "import", "motioncorr"]),
    "at the left edge the key is a no-op (order unchanged)");

  /* ---------------- Phase F — dropping outside the row cancels ------------ */
  step("--- Phase F: drop outside the row — no reorder, NO JOB ---");
  const beforeF = (await roster()).length;
  const storageBeforeF = await p.evaluate((k) => window.localStorage.getItem(k), FAV_KEY);
  const importChip3 = p.locator('[data-testid="palette-fav-chip-import"]');
  const importBox = await importChip3.boundingBox();
  await dragChipTo(importChip3, importBox.x + 40, 8); // drag way up to the page top — no chip there
  must((await p.locator('[data-fav-caret]').count()) === 0,
    "no caret over a non-chip target (a reorder is never guessed)");
  await p.mouse.up();
  await sleep(400);
  must((await p.evaluate((k) => window.localStorage.getItem(k), FAV_KEY)) === storageBeforeF,
    "storage unchanged after the outside drop");
  must((await roster()).length === beforeF,
    `NO job appeared — the fav drag never becomes drag-to-create (${beforeF})`);

  /* ---------------- Phase G — screenshot ---------------------------------- */
  step("--- Phase G: screenshot ---");
  must(execSync(`test -f ${OUT}/t155-caret-mid-drag.png && echo yes`).toString().trim() === "yes",
    "the mid-drag caret screenshot is on disk");

  /* ---------------- Phase Z — console + cleanup ---------------------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, pageErrors.length ? `page errors: ${pageErrors[0]}` : "0 page errors");
  const isGenericRadiusEcho = (t) => /Failed to load resource.*404/.test(t);
  const genN = consoleErrors.filter(isGenericRadiusEcho).length;
  const radiusN = badResponses.filter((l) => l.startsWith("404")).length;
  must(genN <= radiusN,
    `generic 404 echoes accountable to the radius (${genN} <= ${radiusN})`);
  const hardConsole = consoleErrors.filter((t) => !/\[Fast Refresh\]/.test(t) && !isGenericRadiusEcho(t));
  must(hardConsole.length === 0, hardConsole.length ? `console errors: ${hardConsole[0]}` : "0 console errors");

  await p.close(); p = null;
  await b.close(); b = null;
  for (const id of addedJobIds) deleteJobById(id);
  purgeT155();
  const after = await roster();
  must(after.length === rosterBefore, `roster restored (${after.length} == ${rosterBefore})`);

  console.log(`\nT155 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
