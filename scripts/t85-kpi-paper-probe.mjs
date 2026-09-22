// t85 probe — Task 85 visual-contract verification (palette badges, KPI
// paper unwrap, roster band dark-paper contrast). Runs against the
// restored gallery; self-cleaning.
//   P  palette — Notes rows carry the amber class-count capsule; Class
//      notes rows carry the amber "Class N" chip (same badge dialect as
//      canvas card / dashboard row)
//   K  KPI paper — screen truncates + shows kbd chrome; print unwraps
//      label/sub (whitespace-normal) and hides interactive chrome
//   R  roster band paper color — under print emulation the thead band's
//      muted-foreground resolves to the PAPER remap (oklch 0.45) in BOTH
//      light and dark mode, never the dark-mode screen value (0.685 —
//      ~2:1 on white paper, the contrast worry that motivated the check)
// Run: node scripts/t85-kpi-paper-probe.mjs   (server on :3000)
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SEL = "QA Class Select";
const SRC = "QA Class2D Source";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const req = async (path, method, body) => {
  const res = await fetch(BASE + path, body
    ? { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : { method });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

/* ---------------- seed: one job note + two class notes ---------------- */
const jobs = (await req("/api/jobs")).json.jobs;
const sel = jobs.find((j) => j.name === SEL);
const src = jobs.find((j) => j.name === SRC);
must(sel != null && src != null, "S1 gallery chain present");
// the granularity twin needs a host with BOTH granularities — the idle
// select2d carries the job note AND the class notes, so its Notes-group
// row must show the amber capsule (the canvas card Row 1 twin)
// PATCH params merge only accepts number/string/boolean values — classNotes
// rides as a JSON-ENCODED STRING (same channel the gallery's debounced
// writer uses; parseClassNotes decodes both shapes on the read side)
await req(`/api/jobs/${sel.id}`, "PATCH", {
  note: "t85 probe job note",
  params: { classNotes: JSON.stringify({ 3: "t85 probe class note three", 7: "t85 probe class note seven" }) },
});

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
try {
  /* ---------------- P: palette badges ---------------- */
  console.log("P — palette badge dialect");
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-canvas="viewport"]');
  await p.keyboard.press("Control+k");
  await p.waitForSelector('[role="dialog"] [cmdk-input]', { timeout: 5000 });
  await p.locator("[cmdk-input]").fill("note");
  await sleep(400);

  const badge = p.locator('[data-palette-note-classbadge=""]').first();
  must((await badge.count()) > 0, "P1 Notes row with class notes carries the amber capsule");
  must((await badge.textContent()).trim() === "2", "P2 capsule shows the class-note count (2)");
  const chip = p.locator('[data-palette-classnote-chip=""]').first();
  must((await chip.count()) > 0, "P3 Class-notes row carries the amber Class N chip");
  must((await chip.textContent()).includes("Class"), "P4 chip reads Class N");
  await p.keyboard.press("Escape");
  await sleep(200);

  /* ---------------- K: KPI paper unwrap ---------------- */
  console.log("K — KPI screen truncate vs paper unwrap");
  await p.keyboard.press("Shift+D");
  await sleep(700);
  const curView = () =>
    p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  for (let i = 0; i < 4 && (await curView()) !== "dashboard"; i++) {
    await p.keyboard.press("Shift+D");
    await sleep(600);
  }
  must((await curView()) === "dashboard", "K0 dashboard reached");

  const kpiScreen = await p.evaluate(() => {
    const label = [...document.querySelectorAll("p")].find((el) =>
      el.textContent.trim() === "Projects"); // a drill-down card — carries kbd chrome
    if (!label) return null;
    const kbd = label.closest(".card-lift")?.querySelector("kbd");
    return {
      nowrap: getComputedStyle(label).whiteSpace === "nowrap",
      title: label.getAttribute("title"),
      kbdVisible: kbd != null && getComputedStyle(kbd).display !== "none",
    };
  });
  must(kpiScreen != null, "K1 KPI card found");
  must(kpiScreen?.nowrap === true, "K2 screen: label truncates (nowrap)");
  must(kpiScreen?.kbdVisible === true, "K3 screen: kbd shortcut badge visible");

  await p.emulateMedia({ media: "print" });
  const kpiPrint = await p.evaluate(() => {
    const label = [...document.querySelectorAll("p")].find((el) =>
      el.textContent.trim() === "Total jobs");
    if (!label) return null;
    const card = label.closest(".card-lift");
    const kbd = card?.querySelector("kbd");
    // the sub <p> is the text column's third paragraph (value / label / sub)
    const sub = label.parentElement?.querySelectorAll("p")[2];
    return {
      wraps: getComputedStyle(label).whiteSpace === "normal",
      overflowVisible: getComputedStyle(label).overflowX === "visible",
      kbdHidden: kbd == null || getComputedStyle(kbd).display === "none",
      subWraps: sub != null && getComputedStyle(sub).whiteSpace === "normal",
      subHiddenPaper: sub != null && getComputedStyle(sub).display !== "none",
    };
  });
  must(kpiPrint?.wraps === true, "K4 print: label unwraps (whitespace-normal)");
  must(kpiPrint?.overflowVisible === true, "K5 print: no ellipsis clip on paper");
  must(kpiPrint?.kbdHidden === true, "K6 print: kbd chrome hidden (no-print)");
  must(kpiPrint?.subWraps === true, "K7 print: sub line unwraps too");

  /* ---------------- R: roster band paper color ---------------- */
  console.log("R — roster band paper contrast (dark-mode print)");
  const bandColor = () =>
    p.evaluate(() => {
      const th = document.querySelector('[data-roster-head] th');
      const thead = document.querySelector('[data-roster-head]');
      if (!th || !thead) return null;
      const cs = getComputedStyle(th);
      return { color: cs.color, headDisplay: getComputedStyle(thead).display,
               text: th.textContent.trim().slice(0, 30) };
    });
  const light = await bandColor();
  // flip to dark under print emulation — next-themes reads localStorage,
  // but a live class flip exercises the same CSS the storage path lands on
  await p.evaluate(() => document.documentElement.classList.add("dark"));
  await sleep(150);
  const dark = await bandColor();
  await p.evaluate(() => document.documentElement.classList.remove("dark"));
  // Chromium reports oklch() computed values in lab() — compare LIGHTNESS:
  // paper remap ≈ L 36.3, the dark screen gray (0.685) would be ≈ L 73
  const lightness = (c) => {
    const m = c?.match(/lab\(([\d.]+)\s/);
    return m ? Number(m[1]) : null;
  };
  const lLight = lightness(light?.color);
  const lDark = lightness(dark?.color);
  must(light?.headDisplay === "table-header-group", "R1 print: thead is a header group");
  must(lLight != null && lLight < 50, `R2 print+light: band ink is dark paper gray (L=${lLight})`);
  must(lDark != null && lDark < 50, `R3 print+dark: band ink is dark paper gray (L=${lDark})`);
  must(lDark != null && lLight != null && Math.abs(lDark - lLight) < 1,
    "R4 print+dark: identical to print+light — the dark screen gray never leaks");
  await p.emulateMedia({ media: null });
} finally {
  /* ---------------- Z: cleanup ---------------- */
  // note:"" clears (route stores null for empty; a literal null is ignored
  // by the PATCH validation) and classNotes:"{}" resets the map
  await req(`/api/jobs/${sel.id}`, "PATCH", { note: "", params: { classNotes: "{}" } });
  await req(`/api/jobs/${src.id}`, "PATCH", { note: "" });
  await b.close();
}
console.log(fail === 0 ? "T85 PROBE ALL PASS" : `T85 PROBE ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
