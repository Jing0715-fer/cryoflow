// t636-lens-emph-probe.mjs — the type-ahead emphasis probe (playwright
// direct-drive, the qa66 doctrine: a fresh profile beats a sick daemon).
//
// Asserts the t636 lens increment on top of the t635 contract:
//   1. q=class → lens rows every hit-tagged (data-lens-hit ∈ name|type|none),
//      name-hit rows render the token-styled mark span;
//   2. Esc dismisses WITHOUT stealing the query (the t578 law);
//   3. refocus reopens (the t635 focus wiring);
//   4. q=rebalance (demo-only match — no cross-project deep-link, the
//      active pointer must not move) → Enter opens the inspector;
//   5. console stays clean; 📸 with the marks visible.
//
// Run: node scripts/t636-lens-emph-probe.mjs   (server on :3000)
import { chromium } from "playwright";

const B = "http://localhost:3000";
let pass = 0, fail = 0;
const must = (c, l) => {
  if (c) { pass++; console.log(`  ok: ${l}`); }
  else { fail++; console.log(`FAIL: ${l}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
p.on("pageerror", (e) => errors.push(String(e)));
// the wire truth: every /api/activity/recent response the page makes
const wire = [];
p.on("response", (r) => {
  if (r.url().includes("/api/activity/recent")) wire.push(`${r.status()} ${r.url()}`);
});
// and the attempts that never became responses (aborted mid-flight)
const failed = [];
p.on("requestfailed", (r) => {
  if (r.url().includes("/api/activity/recent")) failed.push(`ABORT ${r.url()} :: ${r.failure()?.errorText}`);
});
p.on("request", (r) => {
  if (r.url().includes("/api/activity/recent") && r.url().includes("q="))
    failed.push(`REQ ${r.url()} :: ${JSON.stringify(r.headers())}`);
});
// the leak census: every request and response on the origin — the diff at
// dump time names whatever holds the per-host connection slots forever
const allReq = [];
const allRes = new Set();
p.on("request", (r) => { if (r.url().startsWith(B)) allReq.push({ u: r.url(), m: r.method() }); });
p.on("requestfinished", (r) => allRes.add(r.url()));
p.on("response", (r) => allRes.add(r.url()));

try {
  await p.goto(B, { waitUntil: "domcontentloaded", timeout: 30000 });

  // the t632 convergence ritual: home may land on the canvas — Shift+D
  // walks to the dashboard view, polled (the t523 law: never blind-read)
  const input = p.locator('input[placeholder="Search projects…"]');
  let visible = false;
  for (let i = 0; i < 10 && !visible; i++) {
    visible = await input.isVisible().catch(() => false);
    if (!visible) {
      await p.keyboard.press("Shift+D");
      await sleep(1800);
      visible = await input.isVisible().catch(() => false);
    }
  }
  await input.waitFor({ state: "visible", timeout: 10000 });

  // ---- 1. q=class: rows, hit tags, marks ---------------------------------
  await input.fill("class");
  await p.locator("[data-job-lens]").waitFor({ state: "visible", timeout: 8000 });
  // dev-mode reality: an active page session keeps paying ~3-4s route
  // recompiles (the jobs poll's own data/*.json writes churn the watcher),
  // so the debounced fetch legitimately lands on the wire several seconds
  // late — poll, never blind-read (the t523 law at probe timescale)
  let rows = [];
  for (let i = 0; i < 20 && rows.length === 0; i++) {
    await sleep(1000);
    rows = await p.evaluate(() =>
      [...document.querySelectorAll("[data-lens-row]")].map((r) => r.getAttribute("data-lens-hit"))
    );
  }
  must(rows.length > 0, `lens opens for q=class with ${rows.length} row(s)`);
  must(wire.length > 0, `the lens asked the feed (wire: ${wire.join(" | ") || "SILENT"})`);
  // t637 — the keyboard contract is on screen: the hint footer rides the
  // open popover with its four kbd chips (↑ ↓ ↵ esc). Invisible keys are
  // undiscoverable keys; this assert keeps the bar from regressing away.
  const hints = await p.evaluate(() => ({
    bar: !!document.querySelector("[data-job-lens] [data-lens-hints]"),
    chips: [...document.querySelectorAll("[data-job-lens] [data-lens-hints] kbd")].length,
  }));
  must(hints.bar && hints.chips === 4, `hint footer visible with kbd chips (bar=${hints.bar}, chips=${hints.chips})`);
  if (rows.length === 0) {
    const dump = await p.evaluate(() => {
      const el = document.querySelector("[data-job-lens]");
      return {
        head: el ? el.textContent?.replace(/\s+/g, " ").slice(0, 180) : "NO PANEL",
        spinner: !!el?.querySelector(".animate-spin"),
        count: el?.querySelector("[data-lens-count]")?.textContent ?? null,
      };
    });
    console.log(`  … lens dump: ${JSON.stringify(dump)} · wire=${JSON.stringify(wire)} · attempts=${JSON.stringify(failed)}`);
    // the discriminator: does a MANUAL fetch from this same page resolve?
    const manual = await p.evaluate(
      () =>
        Promise.race([
          fetch("/api/activity/recent?limit=6&q=class&manual=1", { cache: "no-store" })
            .then((r) => `status ${r.status}`)
            .catch((e) => `ERR ${e}`),
          new Promise((res) => setTimeout(() => res("TIMEOUT 5s"), 5000)),
        ])
    );
    console.log(`  … manual fetch from page: ${manual}`);
    // name the leakers: same-URL repeats that never produced a response
    // (one entry per URL is enough to identify the holder class)
    const seen = new Set();
    const pending = allReq.filter((r) => !allRes.has(r.u) && !seen.has(r.u) && seen.add(r.u));
    console.log(`  … pending (${pending.length}): ${pending.slice(0, 8).map((r) => `${r.m} ${r.u.slice(B.length)}`).join(" | ")}`);
  }
  must(
    rows.every((h) => ["name", "type", "none"].includes(h)),
    `every row hit-tagged (seen: ${[...new Set(rows)].join(",") || "none"})`
  );
  const marked = await p.evaluate(
    () =>
      [...document.querySelectorAll('[data-lens-row][data-lens-hit="name"]')].filter((r) =>
        r.querySelector(".bg-primary\\/15")
      ).length
  );
  must(marked > 0, `type-ahead mark renders in ${marked} name-hit row(s)`);
  await p.screenshot({ path: ".qa-logs/t636-lens-emph.png" });

  // ---- 2. Esc: dismiss without stealing the query ------------------------
  await p.keyboard.press("Escape");
  await sleep(400);
  const afterEsc = await p.evaluate(() => ({
    lens: !!document.querySelector("[data-job-lens]"),
    q: document.querySelector('input[placeholder="Search projects…"]')?.value ?? "",
  }));
  must(!afterEsc.lens, "Esc dismisses the lens");
  must(afterEsc.q === "class", `Esc leaves the query untouched (got "${afterEsc.q}")`);

  // ---- 3. refocus reopens -------------------------------------------------
  await input.focus();
  await p.locator("[data-job-lens]").waitFor({ state: "visible", timeout: 5000 });
  must(true, "refocus reopens the dismissed lens (t635 focus wiring)");

  // ---- 4. q=rebalance: the demo-only Enter probe --------------------------
  await input.fill("rebalance");
  let single = [];
  for (let i = 0; i < 20 && single.length === 0; i++) {
    await sleep(1000);
    single = await p.evaluate(() =>
      [...document.querySelectorAll("[data-lens-row]")].map((r) => ({
        hit: r.getAttribute("data-lens-hit"),
        marked: !!r.querySelector(".bg-primary\\/15"),
        text: (r.textContent || "").slice(0, 60),
      }))
    );
  }
  must(single.length >= 1 && single.every((r) => r.hit === "name" && r.marked),
    `q=rebalance: ${single.length} row(s), all name-hit + marked`);

  // ---- 5. Enter opens the inspector ---------------------------------------
  await input.focus();
  await p.keyboard.press("Enter");
  let modal = false;
  for (let i = 0; i < 5 && !modal; i++) {
    await sleep(1200);
    modal = await p.evaluate(() => !!document.querySelector("[role=dialog]"));
  }
  must(modal, "Enter on the highlighted row opens the inspector (t635 contract)");
  await p.keyboard.press("Escape"); // the inspector's own Esc — topmost first
  await sleep(500);

  // ---- 6. the active pointer never moved ----------------------------------
  const { readFileSync } = await import("node:fs");
  const ptr = JSON.parse(readFileSync("/home/z/my-project/data/projects.json", "utf8"));
  must(ptr.active === "cmuwipe6350000demoproject", `active pointer unmoved (${ptr.active})`);

  // ---- 7. console ----------------------------------------------------------
  must(errors.length === 0, `console clean (got ${errors.length}: ${errors.slice(0, 2).join(" | ")})`);

  console.log(`\nt636-lens-emph: ${pass} pass / ${fail} fail`);
} finally {
  await b.close();
}
process.exit(fail === 0 ? 0 : 1);
