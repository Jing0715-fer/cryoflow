/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t616 — opening QA probe (world read-only + restore-able clicks): the
 * Catalog tab's lane.
 *
 * t615's exit lane named "JobPalette (Catalog 标签) 家族扫描 — the sidebar's
 * last unscanned face" — and the ledger rule says check reality first
 * (t610/t614's own doctrine): the sidebar's REAL faces are JobPalette
 * (default Catalog tab, mounted from the server HTML at boot) and
 * WorkspacePanel (t614's wave, already sung). The honest lane is the
 * palette: header row, favorites, recents, 14 category headers, 40 job
 * rows (folded inside their grid wrappers), footer legend — none of them
 * has ever joined the arrival grammar.
 *
 * QA faces: hydrate 12 cards, 12c/13e/12dots, no error dialog.
 * Lane recon:
 *   P1  the palette is mounted at BOOT (default tab — no click needed)
 *   P2  the GAP: header / category headers / visible rows / footer are
 *       all SILENT (animationName=none)
 *   P3  the chrome inventory: search input (lens), fav filter button
 *       (action verb), "/" kbd hint — silent, and the wave must never
 *       nominate them
 *   P4  the world's inventory: 14 category headers (the docstring says
 *       13 — reality wins), 1 expanded category (import, 3 visible rows),
 *       all 40 rows in the DOM (folded rows render inside their grid
 *       wrappers — only the OPEN category's rows can be nominated), the
 *       fresh profile holds no favorites / recents (the wave's boot
 *       composition is the static catalog: 19 faces)
 *   P5  the fold law recon: a collapsed category's row is INVISIBLE
 *       (wrapper opacity-0 + grid-rows-[0fr]) but MOUNTED
 *   P6  the mount semantics: tab leave unmounts the palette, return
 *       remounts it (a FRESH node — every entry is a new surfacing, so
 *       the arrival replays honestly per entry)
 *   R   the canvas intact, the error net empty
 *
 * Usage: node scripts/t616-qa-probe.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* read-only lane — CDP dedicated port 9335 (9323 = t578, 9324 = t584/t604,
 * 9325 = t605, 9326 = t607, 9327 = t608, 9328 = t609, 9329 = t610,
 * 9330 = t611, 9331 = t612, 9332 = t613, 9333 = t614, 9334 = t615)
 * + fresh profile (t581 lesson) */
const CDP_PORT = "9335";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t616-probe-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
let chromeProc = null;
async function launchDesktopChrome() {
  chromeProc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--hide-scrollbars", "--window-size=1280,720",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
    "about:blank",
  ], { stdio: "ignore", detached: false });
  const ready = await pollUntil(() => {
    try { return sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200"; }
    catch { return false; }
  }, 15000, 300);
  return ready;
}
const applyShim = () => {
  try { return sh(`node ${SHIM} ${CDP_PORT} 2>/dev/null`).includes('"ok":true'); }
  catch { return false; }
};
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const readJson = async (js, tries = 3) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < tries; i++) {
    try {
      const t = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
      let v = t;
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
      if (typeof v === "string") {
        if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
        else if (v === "true") v = true;
        else if (v === "false") v = false;
      }
      return v;
    } catch { await sleep(600); }
  }
  return null;
};
async function pollUntil(fn, timeoutMs = 120000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}
/* REAL input via the snapshot ref flow (t614 tuition: Radix tabs triggers
 * swallow synthetic .click() — the trigger listens to pointer events a JS
 * click never sends). The needle matches the ROLE line, not any text:
 * tabs are "- tab " lines (t614's filter — the first probe run lost the
 * Catalog return to a non-tab line that also said "Catalog"), category
 * headers are "- button" lines inside the nav (canvas cards also say
 * "Motion Correction" — the needle alone is not a discriminator). */
const clickRef = (needle, rolePrefix = "- tab ", exactName = false) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const snap = sh("agent-browser snapshot -i 2>/dev/null");
      const lines = snap.split("\n");
      const line = lines.find((l) =>
        l.trimStart().startsWith(rolePrefix)
        && (exactName ? l.includes(`"${needle}"`) : l.includes(needle))
      );
      if (!line && attempt === 0) {
        console.log(`    … attempt 1 saw ${lines.length} lines; button lines w/ needle="${needle}":`);
        lines.filter((l) => l.trimStart().startsWith("- button")).slice(0, 60).forEach((l) => {
          if (l.includes(needle) || /MOTION|Motion/i.test(l)) console.log(`      HIT ${l.trim().slice(0, 110)}`);
        });
        console.log(`      (total button lines: ${lines.filter((l) => l.trimStart().startsWith("- button")).length})`);
      }
      /* THE WINDOW'S TUITION: state and ref share ONE bracket pair in the
       * aria snapshot — "- button \"MOTION 1\" [expanded=false, ref=e46]".
       * The t614-era regex /\[ref=(e\d+)\]/ demanded a bracket immediately
       * before ref, so every line carrying a state attribute (expanded,
       * selected) silently failed the ref extraction — the find matched,
       * the ref came back null, three attempts burned. Read ref= wherever
       * it sits. */
      const m = line && line.match(/ref=(e\d+)/);
      if (m) {
        sh(`agent-browser click @${m[1]} >/dev/null 2>&1`);
        return "clicked";
      }
    } catch (e) { console.log(`    … clickRef attempt ${attempt + 1} threw: ${String(e).slice(0, 80)}`); }
    sleep(500);
  }
  /* the crime scene: the button lines the LAST snapshot actually held */
  try {
    const snap = sh("agent-browser snapshot -i 2>/dev/null");
    const btns = snap.split("\n").filter((l) => l.trimStart().startsWith("- button") && /MOTION|Motion|Catalog/i.test(l));
    console.log(`    … no-ref crime scene (${btns.length} relevant button lines):`);
    btns.slice(0, 8).forEach((l) => console.log(`      ${l.trim().slice(0, 100)}`));
  } catch { /* */ }
  return "no-ref";
};

/* the palette scan — every selector reads a SOURCE hook, not a style guess */
const PAL_SCAN = `(() => {
  const anim = (el) => (el ? getComputedStyle(el).animationName : "absent");
  const hdrP = Array.from(document.querySelectorAll("p")).find((p) => (p.textContent || "").trim() === "Job Types");
  const hdrRow = hdrP ? hdrP.parentElement : null;
  const search = document.querySelector('input[aria-label="Search job types"]');
  const favFilter = document.querySelector('[data-testid="palette-fav-filter"]');
  const kbd = Array.from(document.querySelectorAll("kbd")).find((k) => (k.textContent || "").trim() === "/");
  const nav = document.querySelector('nav[aria-label="RELION 5 job type catalog"]');
  const catHdrs = nav ? Array.from(nav.querySelectorAll("button[aria-expanded]")) : [];
  const rows = nav ? Array.from(nav.querySelectorAll('button[aria-label^="Drag to canvas"]')) : [];
  /* the honest visibility read: the row's own box keeps its height inside
   * the folded wrapper (overflow hidden clips the PAINT, not the box —
   * getBoundingClientRect stays 46px), so visibility is the WRAPPER's
   * state: gridTemplateRows "0px" = folded, anything else = open */
  const wrapperOf = (r) => r.closest(".grid");
  const isOpenRow = (r) => {
    const w = wrapperOf(r);
    if (!w) return false;
    const cs = getComputedStyle(w);
    return cs.opacity !== "0" && cs.gridTemplateRows !== "0px";
  };
  const openRows = rows.filter(isOpenRow);
  const ftrTitled = document.querySelector('[title="Runs on the real RELION engine"]');
  const ftr = ftrTitled ? ftrTitled.closest(".border-t") : null;
  const favRow = document.querySelector('[data-testid="palette-favs-row"]');
  const favCount = document.querySelector('[data-testid="palette-favs-count"]');
  const expanders = catHdrs.map((b) => b.getAttribute("aria-expanded"));
  /* the folded-row check: a row inside a COLLAPSED category is mounted but
   * its wrapper is opacity-0 + 0-height (the grid trick) */
  const motionHdr = catHdrs.find((b) => (b.textContent || "").includes("Motion"));
  const motionRow = motionHdr
    ? rows.find((r) => (r.getAttribute("aria-label") || "").toLowerCase().includes("motion correction"))
    : null;
  const motionWrapper = motionRow ? motionRow.closest(".grid") : null;
  return JSON.stringify({
    hdrPresent: !!hdrRow, hdrAnim: anim(hdrRow),
    searchPresent: !!search, searchAnim: anim(search),
    favFilterPresent: !!favFilter, favFilterAnim: anim(favFilter),
    kbdPresent: !!kbd,
    navPresent: !!nav,
    catCount: catHdrs.length,
    catAnims: [...new Set(catHdrs.map(anim))],
    expandedCount: expanders.filter((v) => v === "true").length,
    rowTotal: rows.length,
    rowAnims: [...new Set(rows.map(anim))],
    openRowCount: openRows.length,
    ftrPresent: !!ftr, ftrAnim: anim(ftr),
    favRowPresent: !!favRow, favCount: favCount ? favCount.textContent : null,
    recentLabelPresent: !!Array.from(document.querySelectorAll("p")).find((p) => (p.textContent || "").trim() === "Recently used"),
    motionFolded: motionRow ? {
      mounted: true,
      wrapperOpacity: motionWrapper ? getComputedStyle(motionWrapper).opacity : null,
      wrapperRows: motionWrapper ? getComputedStyle(motionWrapper).gridTemplateRows : null,
      rowBoxHeight: motionRow.getBoundingClientRect().height,
    } : { mounted: false },
  });
})()`;

let chromeUp = false;
try {
  console.log(`[boot] close-all + desktop Chrome on ${CDP_PORT}`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* fresh start */ }
  chromeUp = await launchDesktopChrome();
  if (!chromeUp) {
    console.error("FATAL: desktop Chrome never opened its CDP port");
    process.exit(2);
  }
  await sleep(400);
  let connected = false;
  for (let i = 0; i < 3 && !connected; i++) {
    try {
      const out = sh(`agent-browser connect ${CDP_PORT} 2>&1`);
      connected = !/relaunched|failed|✗/i.test(out);
      if (!connected) console.log(`  … connect attempt ${i + 1}: ${out.slice(0, 80)}`);
    } catch { await sleep(800); }
    if (!connected) await sleep(800);
  }
  check("agent-browser connected", connected, `port ${CDP_PORT}`);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  check("hover shim applied", applyShim());
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof n === "number" && n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);

  /* ---------- Q: the world ---------- */
  const world = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    const dots = document.querySelectorAll("[data-canvas-ui='minimap-dot']").length;
    const portal = document.querySelector("nextjs-portal");
    const errDialog = portal && portal.shadowRoot
      ? !!portal.shadowRoot.querySelector("[data-nextjs-dialog-overlay], [data-nextjs-dialog]")
      : false;
    return JSON.stringify({ cards, edges, dots, errDialog });
  })()`);
  check("Q canvas 12c/13e/12dots", world?.cards === 12 && world?.edges === 13 && world?.dots === 12, JSON.stringify(world));
  check("Q no error dialog in the dev portal", world?.errDialog === false);

  /* ---------- P1/P2/P3/P4: the palette, live ---------- */
  await sleep(1200); /* any boot animation would have settled; reads are settled reads */
  const pal = await readJson(PAL_SCAN);
  check("P1 the palette mounts at BOOT (default tab)", pal?.hdrPresent === true && pal?.navPresent === true, JSON.stringify({ hdr: pal?.hdrPresent, nav: pal?.navPresent }));
  check("P2 the GAP is live — header silent", pal?.hdrAnim === "none", `anim=${pal?.hdrAnim}`);
  check("P2 the GAP is live — every category header silent", pal?.catAnims?.length === 1 && pal.catAnims[0] === "none", JSON.stringify(pal?.catAnims));
  check("P2 the GAP is live — every row silent", pal?.rowAnims?.length === 1 && pal.rowAnims[0] === "none", JSON.stringify(pal?.rowAnims));
  check("P2 the GAP is live — footer silent", pal?.ftrAnim === "none", `anim=${pal?.ftrAnim}`);
  check("P3 the search lens is present and silent", pal?.searchPresent === true && pal?.searchAnim === "none", `anim=${pal?.searchAnim}`);
  check("P3 the fav filter verb is present and silent", pal?.favFilterPresent === true && pal?.favFilterAnim === "none", `anim=${pal?.favFilterAnim}`);
  check("P3 the / kbd hint is present", pal?.kbdPresent === true);
  check("P4 reality: 14 category headers (the docstring says 13 — reality wins)", pal?.catCount === 14, `got ${pal?.catCount}`);
  check("P4 exactly one category expanded at boot", pal?.expandedCount === 1, `got ${pal?.expandedCount}`);
  check("P4 the boot composition shows 3 rows (import)", pal?.openRowCount === 3, `got ${pal?.openRowCount}`);
  check("P4 all 40 rows mounted (folded rows render inside their wrappers)", pal?.rowTotal === 40, `got ${pal?.rowTotal}`);
  check("P4 the fresh profile holds no favorites row", pal?.favRowPresent === false, `favRow=${pal?.favRowPresent} count=${pal?.favCount}`);
  check("P4 the fresh profile holds no recents section", pal?.recentLabelPresent === false);
  check("P5 the folded row: mounted, invisible (wrapper opacity 0, zero track; the box keeps its height — clipping is the wrapper's word)", pal?.motionFolded?.mounted === true && pal.motionFolded.wrapperOpacity === "0" && pal.motionFolded.wrapperRows === "0px" && pal.motionFolded.rowBoxHeight > 0, JSON.stringify(pal?.motionFolded));

  /* ---------- P5b: the fold opens (restore-able) ---------- */
  /* the category header has no aria-label — its accessible name is the
 * title (cat.hint): "Beam-induced motion correction". "Motion" alone
 * matches the row button (Drag to canvas to add Motion Correction) —
 * a no-op click, but never the fold. */
  /* reality (snapshot dump): the category header's accessible name reads
 * "MOTION 1" — the uppercase label span and the count badge compose it;
 * no canvas card shares that name. */
  const openedCat = clickRef("MOTION 1", "- button");
  check("P5b Motion category clicked (real input)", openedCat === "clicked", String(openedCat));
  await sleep(600);
  const afterOpen = await readJson(PAL_SCAN);
  check("P5b the fold opens — motion row now visible", afterOpen?.openRowCount === 4, `openRows=${afterOpen?.openRowCount}`);
  const closedCat = clickRef("MOTION 1", "- button");
  check("P5b Motion collapsed back", closedCat === "clicked", String(closedCat));
  await sleep(600);
  const afterClose = await readJson(PAL_SCAN);
  check("P5b the world restored (3 open rows)", afterClose?.openRowCount === 3, `openRows=${afterClose?.openRowCount}`);

  /* ---------- P6: the mount semantics ---------- */
  const stash = await readJson(`(() => {
    const hdrP = Array.from(document.querySelectorAll("p")).find((p) => (p.textContent || "").trim() === "Job Types");
    window.__t616node = hdrP ? hdrP.parentElement : null;
    return JSON.stringify(!!window.__t616node);
  })()`);
  check("P6 a palette node stashed", stash === true);
  const left = clickRef("Workspaces");
  check("P6 Workspaces tab clicked", left === "clicked", String(left));
  const gone = await pollUntil(async () => {
    const r = await readJson(`(() => {
      const hdrP = Array.from(document.querySelectorAll("p")).find((p) => (p.textContent || "").trim() === "Job Types");
      return JSON.stringify({ hdrGone: !hdrP, stashDead: window.__t616node ? !document.contains(window.__t616node) : null });
    })()`);
    return r?.hdrGone === true ? r : null;
  }, 10000, 400);
  check("P6 leave unmounts the palette", gone?.hdrGone === true && gone?.stashDead === true, JSON.stringify(gone));
  const back = clickRef("Catalog");
  check("P6 Catalog tab clicked", back === "clicked", String(back));
  const returned = await pollUntil(async () => {
    const r = await readJson(`(() => {
      const hdrP = Array.from(document.querySelectorAll("p")).find((p) => (p.textContent || "").trim() === "Job Types");
      return JSON.stringify({ hdrBack: !!hdrP, freshNode: hdrP ? hdrP.parentElement !== window.__t616node : false });
    })()`);
    return r?.hdrBack === true ? r : null;
  }, 10000, 400);
  check("P6 return remounts a FRESH palette", returned?.hdrBack === true && returned?.freshNode === true, JSON.stringify(returned));

  /* ---------- R: the return path ---------- */
  const rWorld = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    const portal = document.querySelector("nextjs-portal");
    const errDialog = portal && portal.shadowRoot
      ? !!portal.shadowRoot.querySelector("[data-nextjs-dialog-overlay], [data-nextjs-dialog]")
      : false;
    return JSON.stringify({ cards, edges, errDialog });
  })()`);
  check("R canvas intact (12c/13e)", rWorld?.cards === 12 && rWorld?.edges === 13, JSON.stringify(rWorld));
  check("R no error dialog in the dev portal", rWorld?.errDialog === false);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { if (chromeProc) chromeProc.kill(); } catch { /* */ }
}

console.log(`\n=== ${pass}/${pass + fail} passed ===`);
process.exit(fail === 0 ? 0 : 1);
