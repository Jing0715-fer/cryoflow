// t647 — the status-map family + hue-vocabulary probe.
//
// This window did two things. FIRST it collected the four component-local
// status maps into lib/status-style.ts (STATUS_BADGE/STATUS_FLOOR/
// STATUS_CHIP/STATUS_DOT joined STATUS_TEXT/STATUS_SOFT), under the
// THREE-RUNG LAW: ink = deep 700/300 literals (the 600 token rungs miss
// 4.5:1 for amber/emerald/teal; rose-600 passes, so failed rides the
// token), wash/border = token α vocabulary, solid dots/floors = literal
// rungs; plus idle→zinc neutrality and motion-at-the-call-site.
// SECOND it swept the emerald/amber/teal STATUS vocabulary to the tokens
// (489 sites / 57 files), with identity exemptions (selection, series,
// category tones, the COLORS palette) locked in the census.
//
// Verdicts:
//   A  legislation — seven maps in the lib, the three-rung note, the
//      composed badge (Object.fromEntries), deep-ink literals exactly
//      where the contrast law put them, zinc idle, motionless maps.
//   B  consumption — job-card/canvas/find-bar/footer/dashboard/sibling
//      consume the lib maps; no component-local copy survives.
//   C  sweep — census assert exit 0, codemod idempotent (dry = 0),
//      token vocabulary counts, the identity exemptions ALIVE
//      (class-gallery selection teal + workflow.ts palette untouched).
//   D  living pixels — sandbox equivalence: text-emerald-700 resolves to
//      the palette's emerald-700 bytes, border-amber-400/60 to its
//      color-mix; AND the composed badge literally renders: a real card
//      badge on the canvas carries the STATUS_BADGE.completed composite
//      (border-emerald-400/60 + text-emerald-700) as its className.
//   E  console hygiene.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const BASE = "http://localhost:3000";
let PASS = 0;
let FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) {
    PASS++;
    console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    FAIL++;
    console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
};

// A — legislation
const libSrc = readFileSync("src/lib/status-style.ts", "utf8");
must(
  ["STATUS_TEXT", "STATUS_BORDER", "STATUS_BADGE", "STATUS_DOT", "STATUS_SOFT", "STATUS_FLOOR", "STATUS_CHIP"].every(
    (m) => libSrc.includes(`export const ${m}`),
  ),
  "A the seven-map family lives in lib/status-style.ts",
);
must(libSrc.includes("THREE-RUNG LAW"), "A the three-rung law is written down");
must(
  libSrc.includes("Object.fromEntries") && libSrc.includes("STATUS_BORDER[w]} ${STATUS_TEXT[w]"),
  "A STATUS_BADGE is COMPOSED (border arrangement + ink law, one home per rung)",
);
must(
  libSrc.includes('pending: "text-warning-700 dark:text-warning-300"') &&
    libSrc.includes('running: "text-running-700 dark:text-running-300"') &&
    libSrc.includes('completed: "text-success-700 dark:text-success-300"') &&
    libSrc.includes('failed: "text-danger"'),
  "A ink = deep rung SEMANTIC tokens (t648 rename), EXCEPT failed (rose-600 passes 4.5:1)",
);
must(
  libSrc.includes('idle: "bg-zinc-400/25 dark:bg-zinc-500/30"') &&
    libSrc.includes('idle: "border-zinc-300 dark:border-zinc-600"'),
  "A idle speaks zinc (slate dialect retired)",
);
must(
  /export const STATUS_DOT[\s\S]*?running: "bg-teal-500",/.test(libSrc) &&
    !libSrc.includes('bg-teal-500 animate'),
  "A the dot map holds COLOR only (motion stays at the call site)",
);
must(
  libSrc.includes("border-running/70 bg-running/10") && libSrc.includes("border-success/70 bg-success/10"),
  "A STATUS_CHIP active face = token wash/border under the ink law",
);

// B — consumption
const jobCard = readFileSync("src/components/workflow/job-card.tsx", "utf8");
must(
  !jobCard.includes("export const STATUS_STYLES") &&
    jobCard.includes("STATUS_BADGE,\n  STATUS_FLOOR") &&
    jobCard.includes("STATUS_BADGE[status as StatusWord] ?? STATUS_BADGE.idle"),
  "B job-card consumes STATUS_BADGE/STATUS_FLOOR (local copy extinct)",
);
const canvasSrc = readFileSync("src/components/workflow/canvas.tsx", "utf8");
must(
  canvasSrc.includes('STATUS_FLOOR, type StatusWord } from "@/lib/status-style"') &&
    !canvasSrc.includes('STATUS_FLOOR } from "./job-card"'),
  "B canvas imports the floor from the lib (no re-export relay)",
);
const findBar = readFileSync("src/components/workflow/canvas-find-bar.tsx", "utf8");
const footer = readFileSync("src/components/workflow/footer.tsx", "utf8");
must(
  !findBar.includes("export const STATUS_CHIP") &&
    findBar.includes('STATUS_CHIP } from "@/lib/status-style"') &&
    footer.includes('STATUS_CHIP } from "@/lib/status-style"'),
  "B find-bar + footer consume the lib chip family directly",
);
const dash = readFileSync("src/components/workflow/project-dashboard.tsx", "utf8");
const sib = readFileSync("src/components/workflow/sibling-compare-picker.tsx", "utf8");
must(
  !/const STATUS_DOT[^M]/.test(dash) &&
    dash.includes('STATUS_DOT } from "@/lib/status-style"') &&
    !/const STATUS_DOT/.test(sib) &&
    sib.includes('STATUS_DOT } from "@/lib/status-style"'),
  "B dashboard + sibling dot maps collected (motion re-added at the call site)",
);

// C — sweep
const assert = spawnSync("node", ["scripts/t647-assert.mjs"], { encoding: "utf8" });
must(assert.status === 0, "C census assert: rule-reachable sites are all migrated", (assert.stdout || "").trim().split("\n")[0]);
const dry = spawnSync("node", ["scripts/t647-teal-codemod.mjs", "--dry"], { encoding: "utf8" });
must(/TOTAL 0 edits/.test(dry.stdout), "C codemod idempotent (dry = 0 edits)");

const counter = (needle) => {
  // spawn rg is UNRELIABLE on this box (the rgs that hang); count in-process
  let n = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|css)$/.test(name)) {
        n += (readFileSync(p, "utf8").match(new RegExp(needle.replace(/\//g, "\\/"), "g")) || []).length;
      }
    }
  };
  walk("src");
  return n;
};
must(counter("text-success") >= 20, "C success vocabulary count", `${counter("text-success")}`);
must(counter("text-warning") >= 15, "C warning vocabulary count", `${counter("text-warning")}`);
must(counter("text-running") >= 25, "C running vocabulary count", `${counter("text-running")}`);
must(counter("bg-success/") + counter("bg-warning/") + counter("bg-running/") >= 25, "C wash vocabulary count", `${counter("bg-success/") + counter("bg-warning/") + counter("bg-running/")}`);

const gallerySrc = readFileSync("src/components/workflow/class-gallery.tsx", "utf8");
const wfSrc = readFileSync("src/lib/workflow.ts", "utf8");
must(
  gallerySrc.includes('"bg-teal-600 text-white"') && gallerySrc.includes("focus-visible:ring-teal-500/60"),
  "C identity exemption ALIVE: class-gallery selection teal untouched",
);
must(
  wfSrc.includes('text: "text-teal-600 dark:text-teal-400"') && wfSrc.includes('text: "text-emerald-600 dark:text-emerald-400"'),
  "C identity exemption ALIVE: the COLORS palette keeps its swatch members",
);

// D — living pixels
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
let view = null;
for (let i = 0; i < 12; i++) {
  view = await page.evaluate(() =>
    document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  if (view === "canvas") break;
  await page.waitForTimeout(1_500);
}
must(view === "canvas", "D canvas view reached", `${view}`);

// D1 — the composed badge RENDERS: a real card badge carries the
// STATUS_BADGE.completed composite as its className. The active project's
// world contract says 11 of 12 jobs are completed, so the composite must
// be on screen — this is the single-source map reaching the DOM.
// t523 law: roster cards mount AFTER the canvas view flips — poll, never
// blind-read.
let badgeAlive = { count: 0, sample: "" };
for (let i = 0; i < 12 && badgeAlive.count === 0; i++) {
  badgeAlive = await page.evaluate(() => {
    // the composite interleaves the dark rung (border … dark:border … ink
    // … dark:ink), so assert RUNGS not the concatenation
    const badges = [...document.querySelectorAll("*")].filter(
      (el) =>
        /border-emerald-400\/60/.test(el.className || "") &&
        /text-success-700/.test(el.className || "") &&
        (el.textContent || "").trim().toLowerCase() === "completed",
    );
    return { count: badges.length, sample: badges[0]?.className ?? "" };
  });
  if (badgeAlive.count === 0) await page.waitForTimeout(1_500);
}
must(
  badgeAlive.count > 0,
  "D a real badge wears the STATUS_BADGE.completed composite (border-emerald-400/60 + t648's text-success-700)",
  `count=${badgeAlive.count}`,
);

// D2 — sandbox equivalence: the RUNG TOKEN classes resolve to the
// palette's own bytes (canvas-resolved sRGB; the t646 lesson — never
// memorize hex). t648 recast: the sandbox injects text-success-700 (a
// class that lives in the renamed field — text-emerald-700 no longer
// occurs outside exemption, so JIT may not even emit it), and the
// equivalence now certifies the LEGISLATION: our copied oklch must
// render byte-identical to the palette's own value.
const probe = await page.evaluate(() => {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;visibility:hidden;";
  el.innerHTML = [
    '<span id="t647-ok-ink" class="text-success-700">x</span>',
    '<span id="t647-ref-ok" style="color:oklch(50.8% 0.118 165.612)">x</span>',
    '<span id="t647-badge-border" class="border-emerald-400/60">x</span>',
    `<span id="t647-ref-border" style="border:1px solid color-mix(in oklab, oklch(76.5% 0.177 163.223) 60%, transparent)">x</span>`,
  ].join("");
  document.body.appendChild(el);
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d");
  const bytes = (id, prop) => {
    const c = getComputedStyle(document.getElementById(id))[prop];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  };
  const out = {
    okInk: bytes("t647-ok-ink", "color"),
    refOk: bytes("t647-ref-ok", "color"),
    badgeBorder: bytes("t647-badge-border", "borderTopColor"),
    refBorder: bytes("t647-ref-border", "borderTopColor"),
  };
  el.remove();
  return out;
});
const same = (a, z) => a.every((v, i) => Math.abs(v - z[i]) <= 1);
must(same(probe.okInk, probe.refOk), "D text-success-700 ≡ palette emerald-700 bytes (t648 legislation faithful)", probe.okInk.join(","));
must(same(probe.badgeBorder, probe.refBorder), "D border-emerald-400/60 ≡ color-mix 60% law", probe.badgeBorder.join(","));

// E — console hygiene
must(consoleErrors.length === 0, "E zero console errors", consoleErrors.slice(0, 2).join(" | ") || "0");

mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t647-status-family.png" });
console.log(`t647-probe: ${PASS} pass / ${FAIL} fail`);
try {
  mkdirSync("/tmp/cryoflow-qa", { recursive: true });
  writeFileSync(
    "/tmp/cryoflow-qa/t647-probe-verdict.json",
    JSON.stringify({ PASS, FAIL, badgeAlive, probe }, null, 2),
  );
} catch {}
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
