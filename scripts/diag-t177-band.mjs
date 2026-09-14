/* diag for t177 D11/D12: dissect the desktop band select step by step.
   Reuses the probe's own place/band logic with verbose logging. */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const dpage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await dpage.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

const list = await (await fetch(BASE + "/api/jobs")).json();
const jobs = Array.isArray(list) ? list : list.jobs ?? [];
const compLong = jobs.find((j) => j.status === "completed" && (j.name || "").length >= 10);
const idle = jobs.find((j) => j.status === "idle");
console.log("idle:", idle?.id, idle?.name, "| compLong:", compLong?.id, compLong?.name);

function makePlacer(page) {
  return async function placeCard(id, tx, ty) {
    const job = jobs.find((j) => j.id === id);
    const vp = await page.evaluate(() => {
      const w = document.querySelector('[data-canvas="workspace"]');
      const t = getComputedStyle(w).transform;
      const m = new DOMMatrixReadOnly(t === "none" ? "" : t);
      return { x: m.e, y: m.f, z: m.a };
    });
    console.log(`  [place ${job?.name}] vp=${vp.x.toFixed(0)},${vp.y.toFixed(0)} z=${vp.z.toFixed(3)} world=(${job?.x},${job?.y})`);
    const wx = job?.x ?? 0, wy = job?.y ?? 0;
    const d = await page.evaluate(({ vpx, vpy, vpz, wx, wy, tx, ty }) => ({
      dx: tx - (wx * vpz + vpx), dy: ty - (wy * vpz + vpy),
    }), { vpx: vp.x, vpy: vp.y, vpz: vp.z, wx, wy, tx, ty });
    const W = await page.evaluate(() => innerWidth), H = await page.evaluate(() => innerHeight);
    const cands = [[0.5, 0.42], [0.5, 0.66], [0.28, 0.42], [0.72, 0.42], [0.5, 0.82], [0.3, 0.8]]
      .map(([fx, fy]) => [Math.round(W * fx), Math.round(H * fy)]);
    for (const [sx, sy] of cands) {
      const ok = await page.evaluate(([sx, sy]) => {
        const el = document.elementFromPoint(sx, sy);
        return !!el && !!el.closest('[data-canvas="viewport"]') && !el.closest("[data-job]") && !el.closest("button");
      }, [sx, sy]);
      if (!ok) { console.log(`  [place] start (${sx},${sy}) rejected`); continue; }
      console.log(`  [place] start (${sx},${sy}) delta=(${d.dx.toFixed(0)},${d.dy.toFixed(0)})`);
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(sx + d.dx, sy + d.dy, { steps: 8 });
      await page.mouse.up();
      await sleep(800);
      break;
    }
    return page.evaluate((want) => {
      const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
      const r = c?.getBoundingClientRect();
      if (!r) return null;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height,
        inVp: r.top >= 20 && r.left >= 0 && r.bottom <= innerHeight - 20 && r.right <= innerWidth };
    }, id);
  };
}
const dPlace = makePlacer(dpage);

/* === replicate the probe's D1-D10 preamble exactly === */
// spiral-find compLong like cardPoint does
async function cardSpot(id) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const rect = await dpage.evaluate((want) => {
      const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
      const r = c?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, w: r.width, h: r.height,
        inVp: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth } : null;
    }, id);
    if (rect && rect.inVp) return rect;
    // nudge pan toward it (simplified: pan center)
    await dpage.mouse.move(720, 450);
    await dpage.mouse.down();
    await dpage.mouse.move(720 - 200, 450, { steps: 5 });
    await dpage.mouse.up();
    await sleep(700);
  }
  return null;
}
{
  const rect = await cardSpot(compLong.id);
  console.log("D1 card rect:", JSON.stringify(rect));
  // left-click opens inspector (probe D1)
  await dpage.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2);
  await sleep(1800);
  const insp = await dpage.evaluate(() => !!document.querySelector("[data-inspector-dialog]"));
  console.log("inspector opened:", insp);
  await dpage.keyboard.press("Escape");
  await sleep(1300);
  // right-click → menu → Delete → confirm opens (probe D5)
  const rect2 = await cardSpot(compLong.id);
  await dpage.mouse.click(rect2.x + rect2.w / 2, rect2.y + rect2.h / 2, { button: "right" });
  await sleep(1000);
  const item = await dpage.evaluate(() => {
    const items = [...document.querySelectorAll('[role="menuitem"]')].map((m) => {
      const r = m.getBoundingClientRect();
      return { t: (m.textContent || "").trim().slice(0, 14), x: r.x, y: r.y, w: r.width, h: r.height, vis: r.width > 0 };
    });
    return items.find((m) => m.t.startsWith("Delete") && m.vis) ?? null;
  });
  console.log("delete menuitem:", JSON.stringify(item));
  if (item) {
    await dpage.mouse.move(item.x + item.w / 2, item.y + Math.min(10, item.h / 2));
    await sleep(250);
    await dpage.mouse.down();
    await sleep(120);
    await dpage.mouse.up();
    for (let i = 0; i < 10; i++) {
      await sleep(300);
      const has = await dpage.evaluate(() => !!document.querySelector('[role="alertdialog"]'));
      if (has) break;
    }
    const title = await dpage.evaluate(() => document.querySelector('[role="alertdialog"] h2')?.textContent ?? null);
    console.log("single confirm:", JSON.stringify(title));
    await dpage.evaluate(() => {
      const dlg = document.querySelector('[role="alertdialog"]');
      const c = [...(dlg?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").trim() === "Keep job");
      c?.click();
    });
    await sleep(700);
    // dark round (probe D8-D10)
    await dpage.evaluate(() => document.documentElement.classList.add("dark"));
    await sleep(500);
    const rect3 = await cardSpot(compLong.id);
    await dpage.mouse.click(rect3.x + rect3.w / 2, rect3.y + rect3.h / 2, { button: "right" });
    await sleep(1000);
    const item2 = await dpage.evaluate(() => {
      const items = [...document.querySelectorAll('[role="menuitem"]')].map((m) => {
        const r = m.getBoundingClientRect();
        return { t: (m.textContent || "").trim().slice(0, 14), x: r.x, y: r.y, w: r.width, h: r.height, vis: r.width > 0 };
      });
      return items.find((m) => m.t.startsWith("Delete") && m.vis) ?? null;
    });
    if (item2) {
      await dpage.mouse.move(item2.x + item2.w / 2, item2.y + Math.min(10, item2.h / 2));
      await sleep(250);
      await dpage.mouse.down();
      await sleep(120);
      await dpage.mouse.up();
      await sleep(1200);
      const t2 = await dpage.evaluate(() => document.querySelector('[role="alertdialog"] h2')?.textContent ?? null);
      console.log("single confirm (dark):", JSON.stringify(t2));
      await dpage.evaluate(() => {
        const dlg = document.querySelector('[role="alertdialog"]');
        const c = [...(dlg?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").trim() === "Keep job");
        c?.click();
      });
      await sleep(700);
    } else console.log("dark right-click: no menuitem");
    await dpage.evaluate(() => document.documentElement.classList.remove("dark"));
    await sleep(400);
  }
  // selection state right before the band
  const selBefore = await dpage.evaluate(() => {
    const sel = window.__wfdbg?.selected ?? null;
    const cards = [...document.querySelectorAll("[data-job]")].filter((c) => {
      const inner = c.querySelector("[class*='ring-2']");
      return !!inner;
    }).map((c) => c.getAttribute("data-job"));
    return { innerRing: cards };
  });
  console.log("selection before band:", JSON.stringify(selBefore));
}

const a = await dPlace(idle.id, 600, 350);
console.log("A placed:", JSON.stringify(a));
const b = await dPlace(compLong.id, 850, 350);
console.log("B placed:", JSON.stringify(b));

// re-read A after placing B (placing pans the world)
const a2 = await dpage.evaluate((want) => {
  const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
  const r = c?.getBoundingClientRect();
  return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height } : null;
}, idle.id);
console.log("A re-read:", JSON.stringify(a2));

const minx = Math.min(a2.x, b.x), maxx = Math.max(a2.x, b.x);
const miny = Math.min(a2.y, b.y), maxy = Math.max(a2.y, b.y);
console.log(`band box: centers span x[${minx}..${maxx}] y[${miny}..${maxy}]`);

let start = null;
for (const [dx, dy] of [[-18, -48], [-18, -78], [-46, -48], [-60, -20], [-18, 90], [18, 96]]) {
  const [sx, sy] = [minx + dx, miny + dy];
  if (sx < 4 || sy < 4 || sx > 1440 - 8 || sy > 640) { console.log(`  start (${sx},${sy}) out of bounds`); continue; }
  const what = await dpage.evaluate(([sx, sy]) => {
    const el = document.elementFromPoint(sx, sy);
    if (!el) return "null";
    const tag = el.tagName + (el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 3).join(".") : "");
    return {
      pass: !!el.closest('[data-canvas="viewport"]') && !el.closest("[data-job]") && !el.closest("button"),
      tag,
      edge: !!el.closest(".edge-hit-path") || el.classList?.contains("edge-hit-path"),
    };
  }, [sx, sy]);
  console.log(`  start (${sx},${sy}) →`, JSON.stringify(what));
  if (what.pass) { start = [sx, sy]; break; }
}
if (!start) { console.log("NO START — band never launches"); await browser.close(); process.exit(0); }
console.log("start =", start, "end =", [Math.min(maxx + 16, 1440), maxy + 40]);

await dpage.keyboard.down("Shift");
await dpage.mouse.move(start[0], start[1]);
await dpage.mouse.down();
// observe what the canvas thinks is happening mid-drag
await dpage.mouse.move(Math.min(maxx + 16, 1440), maxy + 40, { steps: 10 });
const midBand = await dpage.evaluate(() => {
  const ants = document.querySelector("[data-band], [class*='band']");
  return { ants: !!ants, shift: null };
});
console.log("mid-drag band overlay:", JSON.stringify(midBand));
await dpage.mouse.up();
await dpage.keyboard.up("Shift");
await sleep(800);

const sel = await dpage.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-job]")];
  return cards.map((c) => ({
    id: c.getAttribute("data-job"),
    cls: (c.className || "").includes("ring-2"),
    inner: !!c.querySelector(".ring-2, [class*='ring-2']"),
    rect: (() => { const r = c.getBoundingClientRect(); return `${r.x.toFixed(0)},${r.y.toFixed(0)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`; })(),
  })).filter((c) => c.cls || c.inner);
});
console.log("ring-ish selected:", JSON.stringify(sel, null, 1));

await dpage.keyboard.press("Delete");
await sleep(900);
const dlg = await dpage.evaluate(() => {
  const d = document.querySelector('[role="alertdialog"]');
  return d ? (d.querySelector("h2, [class*='font-semibold']")?.textContent ?? "?") : null;
});
console.log("dialog after Delete:", JSON.stringify(dlg));
await dpage.evaluate(() => {
  const dlg = document.querySelector('[role="alertdialog"]');
  const c = [...(dlg?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").trim() === "Cancel");
  c?.click();
});
await sleep(500);
await browser.close();
console.log("DIAG DONE");
