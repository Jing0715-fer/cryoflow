/* t192 dark recon — the ninth-time-deferred dark portrait, done RIGHT:
 * toggle the class (html.dark via the app's own switch, NOT emulateMedia),
 * walk every major dialog surface, 2x portraits, plus a PROGRAMMATIC audit:
 *   (a) light patches — effective solid bg luminance > 0.82 while dark
 *   (b) illegible text — contrast(color, effective bg) < 2.2 for direct text
 * Suspects written to /tmp/t192-dark-suspects.json for adjudication. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t192";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const AUDIT_FN = () => {
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (s) => {
    const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const effBg = (el) => {
    // walk up compositing translucent layers over the first solid one
    const layers = [];
    let cur = el;
    while (cur && cur instanceof Element) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 0.99) break; }
      cur = cur.parentElement;
    }
    if (!layers.length) return { r: 255, g: 255, b: 255, solid: false };
    let acc = layers[0].a >= 0.99 ? layers[0] : { ...layers[0] };
    if (layers[0].a < 0.99) {
      // composite translucent chain downward over an assumed dark page (#0b0f14)
      let base = { r: 11, g: 15, b: 20 };
      for (let i = layers.length - 1; i >= 0; i--) {
        const L = layers[i];
        base = {
          r: L.r * L.a + base.r * (1 - L.a),
          g: L.g * L.a + base.g * (1 - L.a),
          b: L.b * L.a + base.b * (1 - L.a),
        };
      }
      acc = { ...base, a: 1 };
    }
    return { ...acc, solid: true };
  };
  const out = [];
  const all = document.querySelectorAll("body *");
  for (const el of all) {
    const box = el.getBoundingClientRect();
    if (box.width < 10 || box.height < 8) continue;
    if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none") continue;
    const bg = effBg(el);
    const bgL = lum(bg.r, bg.g, bg.b);
    // (a) light patch: solid-ish effective bg that is near-white while dark
    if (bg.solid && bgL > 0.82) {
      const sat = Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b);
      out.push({
        kind: "light-patch", tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 90)) || "",
        text: (el.textContent || "").trim().slice(0, 40),
        bg: `rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0}) sat=${sat}`,
        box: `${box.x | 0},${box.y | 0} ${box.width | 0}x${box.height | 0}`,
      });
      continue;
    }
    // (b) illegible text: direct text nodes too dark for the effective bg
    const hasText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 1
    );
    if (!hasText) continue;
    const fg = parse(st.color);
    if (!fg) continue;
    const fgL = lum(fg.r, fg.g, fg.b);
    const contrast = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);
    if (contrast < 2.2) {
      out.push({
        kind: "low-contrast", tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 90)) || "",
        text: (el.textContent || "").trim().slice(0, 40),
        fg: st.color, bg: `rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0})`, ratio: contrast.toFixed(2),
        box: `${box.x | 0},${box.y | 0} ${box.width | 0}x${box.height | 0}`,
      });
    }
  }
  return out;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const suspects = {};
const shoot = async (name) => {
  await sleep(650);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const s = await page.evaluate(AUDIT_FN);
  suspects[name] = s;
  console.log(`${name}: ${s.length} suspects`);
};

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2400);

// 1. dark ON via the app's own switch
await page.locator('button[aria-label="Switch to dark theme"]').click();
await sleep(900);
const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
console.log("html.dark =", dark);
if (!dark) { console.error("DARK TOGGLE FAILED"); process.exit(1); }

// 2. workflow canvas
await shoot("dark-canvas");

// 3. dashboard (Shift+D) — includes pipeline analytics
await page.keyboard.press("Shift+KeyD");
await sleep(1600);
await shoot("dark-dashboard");
await page.keyboard.press("Shift+KeyD");
await sleep(1200);

// 4. job inspector (idle job card) + HPC sweep dialog
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const idle = jobs.filter((j) => j.status === "idle").sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0];
await page.locator(`[data-job="${idle.id}"]`).first().click({ force: true });
await sleep(1600);
await shoot("dark-inspector");
await page.locator('button[aria-label="Generate Slurm sbatch script for this job"]').first().click();
await sleep(1500);
await page.locator('button[aria-label="Run queue simulation"]').click();
await sleep(1800);
await page.locator('button[aria-label="Compare cluster profiles"]').click();
await sleep(2200);
await shoot("dark-hpc-sweep");
await page.keyboard.press("Escape");
await sleep(700);

// 5. command palette
await page.keyboard.press("Control+k");
await sleep(900);
await shoot("dark-command-palette");
await page.keyboard.press("Escape");
await sleep(500);

// 6. shortcuts dialog
await page.keyboard.press("Shift+Slash");
await sleep(900);
await shoot("dark-shortcuts");
await page.keyboard.press("Escape");
await sleep(500);

// 7. template presets (canvas toolbar button)
await page.locator('button[title*="Create 10 pre-wired jobs"]').first().click().catch(() => {});
await sleep(1100);
await shoot("dark-template-presets");
await page.keyboard.press("Escape");
await sleep(500);

writeFileSync("/tmp/t192-dark-suspects.json", JSON.stringify(suspects, null, 1));
const total = Object.values(suspects).reduce((a, s) => a + s.length, 0);
console.log(`TOTAL suspects: ${total}`);
await browser.close();
