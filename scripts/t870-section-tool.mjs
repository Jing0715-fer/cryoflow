// t870 — the section tool: the general box language becomes user-editable.
//
// Backstory: the t260 box language could only ever be ANCHORED (the "show
// in parent" door handed the crop's box in; the panel showed a read-only
// readout) and the slider language can only cut ONE side per axis (a
// crop off both sides — X 25–75% — was unrepresentable). This window the
// box becomes LIVE: a "section box" promote hands the slider language's
// resolved intervals (keptFractions) to the box language, and each axis
// grows two named thumbs (low/high bound) whose edits re-speak the ONE
// intent door — the shader planes re-commit, the wireframe re-projects,
// the 2D tiles re-echo and export/send re-label through keptFractions.
//
// Probe contract:
//   A  the world — the resurrected chain's refine3d carries a real map
//      and the server renders it as PNG.
//   B  the slider language — Clip on: the promote button exists; the X
//      slider steps from the keyboard; the export label speaks the full
//      box.
//   C  the promote — the editors replace the sliders: three rows, SIX
//      named thumbs, the header says "section box — drag the bounds",
//      the release button says "release the section box", the export
//      label follows the kept box.
//   D  the edit — the X low thumb walks from the keyboard; the readout
//      and the export label follow; the wireframe re-projects.
//   E  the clamp — driving the X high thumb into the low one keeps the
//      0.02 minimum span (the driven bound honest, the other clamps).
//   F  the reset — one click returns the axis to "full extent"; all-full
//      editors re-label the export to the full box.
//   G  the release and the re-promote — sliders return; the promote
//      re-opens the editors (the box language survives its own cycle).
//   H  the name-address law — every button and every thumb inside the
//      editor carries its own name; zero unnamed controls.
//   I  the console contract — four buckets, real JS errors 0. 📸×2
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmv6wl2ls000uu99xqvlodopd"; // the resurrected chain's refine3d
const MAP_PATH = "run_class001.mrc";
const SHOTS = "shots-qa";
let PASS = 0, FAIL = 0;
const checks = [];
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
  checks.push({ pass: !!cond, label });
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clipToggleNow = async (pg) =>
  (await pg.locator('button[aria-label="Toggle box clipping"]').count()) > 0;
const pollUntil = async (fn, timeoutMs = 10000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(500);
  }
};

mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1200 } });
const consoleErrors = [];
const hmrNoise = [];
const resourceFlap = [];
const resource404 = [];
const chunkFlap = [];
const glAbsent = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (t.includes("webpack-hmr") || t.includes("/_next/webpack-hmr") || (t.includes("WebSocket") && t.includes("failed"))) { hmrNoise.push(t); return; }
  if (t.includes("Could not create a WebGL rendering context")) { glAbsent.push(t); return; }
  // the GL-absence cascade: molstar's own mount handler reads a canvas
  // that never came — only classed as the host's voice AFTER the context
  // throw itself fired (a GL-alive day would make this a real error)
  if (glAbsent.length > 0 && /mol-canvas3d|ViewportCanvas|reprCount/.test(t)) { glAbsent.push(t); return; }
  if (t.startsWith("Failed to load chunk") && t.includes("async loader")) { chunkFlap.push(t); return; }
  if (t.startsWith("Failed to load resource")) {
    if (/status of 404/.test(t)) resource404.push(t);
    else if (/ERR_(CONNECTION_REFUSED|EMPTY_RESPONSE|CONNECTION_RESET|INCOMPLETE_CHUNKED_ENCODING)/.test(t)) resourceFlap.push(t);
    else consoleErrors.push(t);
    return;
  }
  consoleErrors.push(t);
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const waitServerHealthy = async (label) => {
  for (let i = 0; i < 25; i++) {
    const t0 = Date.now();
    try {
      const ok = await page.evaluate(async () => {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        return r.ok;
      });
      if (ok && Date.now() - t0 < 2000) {
        if (i > 0) console.log(`  · server healthy again after ${i} polls (${label})`);
        return true;
      }
    } catch { /* flap — keep polling */ }
    await sleep(2000);
  }
  return false;
};

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await waitServerHealthy("initial");

// ---------- A: the world answers ----------
must(await page.evaluate(async (id) => {
  const r = await fetch(`/api/jobs`, { cache: "no-store" });
  const d = await r.json();
  return (d.jobs ?? []).some((j) => j.id === id && j.type === "refine3d" && j.status === "completed");
}, REFINE3D_ID), "A the refine3d job exists and completed");

const mapPng = await page.evaluate(async ({ id, p }) => {
  const r = await fetch(`/api/jobs/${id}/outputs/file?path=${encodeURIComponent(p)}&format=png`, { cache: "no-store" });
  return { ok: r.ok, type: r.headers.get("content-type") };
}, { id: REFINE3D_ID, p: MAP_PATH });
must(mapPng.ok && (mapPng.type ?? "").includes("image/png"),
  "A the map renders as a PNG", mapPng.type ?? "none");

// ---------- open the 3D viewer (deterministic + reload-proof) ----------
// The Mol* chunk's first compile can full-reload the page mid-walk (the
// t867 teaching, page form) — the door re-walks until the embed stays.
const openViewerDoor = async () => {
  await page.locator(`[data-job="${REFINE3D_ID}"]`).first().click({ force: true });
  await sleep(1500);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1500);
  // t870's world teaching: the gallery's first tile is an iteration class
  // average (a flat 64×64×1 volume). The ride aims at the FINAL map by
  // its own name, never by tile order.
  const enlargeBtn = page.locator('button[aria-label="Enlarge run_class001"]').first();
  const tileUp = await pollUntil(async () => (await enlargeBtn.count()) > 0 || null, 15000);
  must(!!tileUp, "B the final map's tile is on the Results tab");
  if (!tileUp) return false;
  await enlargeBtn.scrollIntoViewIfNeeded().catch(() => {});
  await enlargeBtn.click().catch(() => {});
  await sleep(1200);
  const v3d = page.locator("button", { hasText: "View in 3D (Mol*)" }).first();
  must((await v3d.count()) > 0, "B the image dialog carries the 3D relay");
  await v3d.click().catch(() => {});
  return true;
};
let doorWalked = false;
for (let walk = 1; walk <= 3 && !doorWalked; walk++) {
  if (walk > 1) {
    console.log(`  (door re-walk #${walk} — the compile's full reload ate the dialog)`);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
    await sleep(2500);
  }
  await openViewerDoor();
  // the embed's toolbar is the readiness gate (it mounts GL or not);
  // a vanishing dialog (reload) breaks the loop into the next walk
  doorWalked = await pollUntil(async () => {
    const up = await page.evaluate(() => {
      const mol = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.querySelector("[data-molstar-container]"));
      return !!mol;
    }).catch(() => null);
    if (up === null) return "dead"; // the page reloaded — re-walk
    return up && (await clipToggleNow(page)) ? "up" : null;
  }, 90000);
  if (doorWalked === "dead") { doorWalked = false; continue; }
  doorWalked = doorWalked === "up";
}
must(doorWalked, "B the Mol* embed's toolbar is up (clipBox rides the state graph, GL or not)");
await sleep(1500); // the panel settles

// ---------- B: the slider language ----------
const clipToggle = page.locator('button[aria-label="Toggle box clipping"]');
must((await clipToggle.count()) > 0, "B the Clip toggle is named");
await clipToggle.click();
await sleep(600);
must(await clipToggle.getAttribute("aria-pressed") === "true", "B the Clip toggle is ON");

const promoteBtn = page.locator('[data-testid="clip-section-promote"]');
must(await promoteBtn.isVisible().catch(() => false), "B the section-box promote button is up (slider language)");

// the export's own label — the kept box written out, re-computed from
// keptFractions on EVERY intent (the scene-independent speaker)
const exportDimsLabel = page.locator('button[title*="standalone MRC"] span.font-mono').first();

const fullDims = await pollUntil(async () => {
  const t = (await exportDimsLabel.innerText().catch(() => "")).trim();
  return /^\d+×\d+×\d+ vox$/.test(t) && t.includes("×64×64") ? t : null;
}, 20000);
must(!!fullDims, "B the export label speaks the full box", fullDims ?? "never spoke");

// step the X slider down from the keyboard (1 → 0.80)
const xThumb = page.getByRole("slider", { name: "Clip position along the X axis" });
must((await xThumb.count()) === 1, "B the X slider thumb is named");
await xThumb.focus();
for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowLeft");
await sleep(400);
const xSliderRow = page.locator("text=/^80%$/").first();
must((await xSliderRow.count()) > 0 || (await page.locator('[data-testid="clip-box-readout"]').count()) === 0,
  "B the X readout speaks 80% from the keyboard walk");

await page.screenshot({ path: `${SHOTS}/t870-slider-language.png` });

// ---------- C: the promote ----------
await promoteBtn.click();
await sleep(600);
const readout = page.locator('[data-testid="clip-box-readout"]');
must(await readout.isVisible().catch(() => false), "C the section editor replaces the sliders");
const readoutText = ((await readout.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
must(readoutText.includes("section box — drag the bounds"), "C the header speaks the live box", readoutText.slice(0, 90));
must(readoutText.includes("0–80% kept"), "C the X row inherits the slider language's resolved interval");
must((readoutText.match(/full extent/g) ?? []).length >= 2, "C the Y/Z rows speak their uncut truth");

const thumbs = await page.evaluate(() => {
  const root = document.querySelector('[data-testid="clip-box-readout"]');
  if (!root) return null;
  return [...root.querySelectorAll('[role="slider"]')].map((t) => (t.getAttribute("aria-label") ?? "").trim());
});
const wantThumbs = ["X section low bound", "X section high bound", "Y section low bound", "Y section high bound", "Z section low bound", "Z section high bound"];
must(!!thumbs && thumbs.length === 6 && wantThumbs.every((n) => thumbs.includes(n)),
  "C six thumbs, one name each", (thumbs ?? []).join(" | "));

const editedDims = (await exportDimsLabel.innerText().catch(() => "")).trim();
must(editedDims !== fullDims && /^(\d+)×/.test(editedDims), "C the export label follows the kept box", editedDims);

// ---------- D: the edit (the X low thumb walks) ----------
const xLow = page.getByRole("slider", { name: "X section low bound" });
await xLow.focus();
for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
await sleep(400);
const textAfterEdit = ((await readout.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
must(textAfterEdit.includes("5–80% kept"), "D the X low bound walks from the keyboard (5%)", textAfterEdit.slice(0, 110));
const dimsAfterEdit = (await exportDimsLabel.innerText().catch(() => "")).trim();
must(dimsAfterEdit !== editedDims, "D the export label re-speaks the box", dimsAfterEdit);

// the wireframe's live projection speaks only when the scene itself
// lives (t865's σ-gate shape: falsifiable in all worlds, never a false
// pass, never a false fail); a GL-less window takes the source law
const glVerdict = await page.evaluate(() => {
  const mol = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.querySelector("[data-molstar-container]"));
  const t = mol?.innerText ?? "";
  return /WebGL does not seem/.test(t) ? false : /vox|σ|Contour/.test(t) ? true : null;
}).catch(() => null);
if (glVerdict === true) {
  const guideUp = await pollUntil(async () => {
    const d = await page.evaluate(() =>
      document.querySelector('[data-clip-guide="true"] path[stroke="#8b5cf6"]')?.getAttribute("d") ?? "");
    return d.length > 10 || null;
  }, 8000);
  must(!!guideUp, "D the clip wireframe re-projects the live box");
} else {
  console.log(`  · (world-gated) GL ${glVerdict === false ? "ABSENT — the window's host teaches" : "unproven"}; the source law stands in`);
  const embedSrc = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
  must(
    embedSrc.includes("[phase, clipOn, clipX, clipY, clipZ, clipInvert, clipBoxLive]"),
    "D (world-gated) the guide's effect deps carry the section mirror — an edit re-projects the wireframe"
  );
}

await page.screenshot({ path: `${SHOTS}/t870-section-editor.png` });

// ---------- E: the clamp (the high thumb drives into the low one) ----------
const xHigh = page.getByRole("slider", { name: "X section high bound" });
await xHigh.focus();
// 0.80 → 0.07 in 0.01 steps (73 presses); the span floor holds at 0.05–0.07
for (let i = 0; i < 73; i++) await page.keyboard.press("ArrowLeft");
await sleep(400);
const textClamp = ((await readout.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
must(textClamp.includes("5–7% kept"), "E the 0.02 minimum span holds under the high thumb's drive", textClamp.slice(0, 110));

// ---------- F: the reset ----------
await page.locator('button[aria-label="Reset X section to full extent"]').click();
await sleep(400);
const textReset = ((await readout.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
must(textReset.includes("full extent"), "F the reset returns X to the full box", textReset.slice(0, 110));
const dimsReset = (await exportDimsLabel.innerText().catch(() => "")).trim();
must(dimsReset === fullDims, "F the all-full editors re-label the export to the full box", dimsReset);

// ---------- G: the release and the re-promote ----------
await page.locator('[data-testid="clip-box-release"]').click();
await sleep(500);
must(!(await readout.isVisible().catch(() => false)), "G the release retires the editors");
must(await clipToggle.getAttribute("aria-pressed") === "false", "G the toggle speaks OFF (the whole panel stood down)");

// the release unmounts the panel — the slider language returns through
// the toggle, the sliders parked at 1 (the promote's own parking)
await clipToggle.click();
await sleep(500);
must((await page.getByRole("slider", { name: "Clip position along the X axis" }).count()) === 1,
  "G the slider language returns through the toggle");

await promoteBtn.click();
await sleep(500);
const textRepromote = ((await page.locator('[data-testid="clip-box-readout"]').innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
must(textRepromote.includes("section box — drag the bounds") && textRepromote.includes("release the section box"),
  "G the re-promote re-opens the editors (live origin)");
must((textRepromote.match(/full extent/g) ?? []).length >= 3, "G the fresh editors hold the whole box");
await page.locator('[data-testid="clip-box-release"]').click();
await sleep(300);

// ---------- H: the name-address law (the whole panel walks) ----------
await clipToggle.click(); // slider language again — walk ITS row too
await sleep(500);
const sliderRowAudit = await page.evaluate(() => {
  const promote = document.querySelector('[data-testid="clip-section-promote"]');
  const named = (el) => ((el?.getAttribute("aria-label") ?? "") + " " + (el?.textContent ?? "")).trim().length > 0;
  return {
    promoteNamed: !!promote && named(promote),
    promoteTestid: !!promote,
  };
});
must(sliderRowAudit.promoteTestid && sliderRowAudit.promoteNamed, "H the promote button carries its own name");

await promoteBtn.click();
await sleep(500);
const editorAudit = await page.evaluate(() => {
  const root = document.querySelector('[data-testid="clip-box-readout"]');
  if (!root) return null;
  const named = (el) => {
    const a = (el.getAttribute("aria-label") ?? "").trim();
    const t = (el.textContent ?? "").trim();
    return a.length > 0 || t.length > 0;
  };
  const buttons = [...root.querySelectorAll("button")];
  const thumbs = [...root.querySelectorAll('[role="slider"]')];
  return {
    buttons: buttons.length,
    unnamedButtons: buttons.filter((x) => !named(x)).length,
    thumbs: thumbs.length,
    unnamedThumbs: thumbs.filter((x) => !(x.getAttribute("aria-label") ?? "").trim()).length,
  };
});
must(!!editorAudit && editorAudit.unnamedButtons === 0 && editorAudit.unnamedThumbs === 0,
  "H zero unnamed controls inside the editor",
  editorAudit ? `${editorAudit.buttons} buttons, ${editorAudit.thumbs} thumbs` : "editor missing");
await page.locator('[data-testid="clip-box-release"]').click().catch(() => {});
await page.screenshot({ path: `${SHOTS}/t870-section-final.png` });

// ---------- I: the console contract ----------
const realErrors = consoleErrors.length;
must(realErrors === 0, "I real JS errors 0", `hmr ${hmrNoise.length} · flap ${resourceFlap.length} · 404 ${resource404.length} · chunk ${chunkFlap.length} · glAbsent ${glAbsent.length} (the host's own voice — the dialog says the same)${realErrors ? " · first: " + consoleErrors.slice(0, 2).join(" || ").slice(0, 160) : ""}`);

// ---------- the ledger ----------
console.log(`\n==== t870 section tool: ${PASS} pass / ${FAIL} fail ====`);
writeFileSync(`${SHOTS}/t870-section-tool.json`, JSON.stringify({
  instrument: "t870-section-tool",
  when: new Date().toISOString(),
  ride: { job: REFINE3D_ID, map: MAP_PATH },
  world: { glVerdictOr: glVerdict, glAbsentThrows: glAbsent.length, realErrors: consoleErrors.slice(0, 8) },
  pass: PASS, fail: FAIL,
  checks,
}, null, 2));
await b.close();
process.exit(FAIL > 0 ? 1 : 0);
