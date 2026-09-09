// qa79 — Dashboard paper unroll e2e.
// Task 79 fixes the dashboard's print contract: the dashboard root is a
// flex-1 overflow-y-auto pane inside a h-dvh shell and the Jobs roster is
// a max-h-80 scroller — on paper Chromium clipped 1798px of content into
// a 745px single page (probe: t79-print-probe.mjs), silently dropping the
// spotlight section and 6 of 12 roster rows. Paper is a document, not a
// viewport. Phases:
//   A  print-media geometry — shell released, root unrolled (scroll ==
//      client), roster unrolled, rows atomic, names unwrapped, breadcrumb
//      strip wraps, app header off the paper, progress bars unharmed
//   B  the paper itself — multi-page PDF, EVERY roster name present,
//      masthead + dashboard subtitle present, interactive chrome absent
//   C  canvas contract not regressed — landscape print still fits one page
//   D  console clean
// Run: node scripts/qa79-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.qa-logs/t79-e2e-dash.pdf";
const OUT_CANVAS = "/home/z/my-project/.qa-logs/t79-e2e-canvas.pdf";
rmSync(OUT, { force: true });
rmSync(OUT_CANVAS, { force: true });

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);

const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
const ensureView = async (target) => {
  for (let i = 0; i < 4; i++) {
    if ((await curView()) === target) return true;
    await p.keyboard.press("Shift+D");
    await sleep(700);
  }
  return (await curView()) === target;
};

must(await ensureView("dashboard"), "A0 dashboard view reached");

/* ---------------- roster inventory (from the live DOM) ---------------- */
const roster = await p.evaluate(() => {
  const spot = 'section[aria-label="Active project spotlight"]';
  const box = document.querySelector(`${spot} .max-h-80`);
  const rows = [...(box?.children ?? [])];
  const names = rows.map((r) => r.querySelector("button .truncate")?.textContent?.trim() ?? "");
  return { rowCount: rows.length, names, nonEmpty: names.filter(Boolean).length };
});
must(roster.rowCount >= 8, `A0b roster has enough rows to paginate (got ${roster.rowCount})`);
must(roster.nonEmpty === roster.rowCount, "A0c every row exposes a name hook");

/* ---------------- Phase A: print-media geometry ---------------- */
console.log("Phase A — print-media geometry");
await p.emulateMedia({ media: "print" });
await sleep(300);

const geo = await p.evaluate(() => {
  const spot = 'section[aria-label="Active project spotlight"]';
  const root = document.querySelector(`${spot}`)?.closest("div.min-h-0.flex-1");
  const box = document.querySelector(`${spot} .max-h-80`);
  const strip = document.querySelector(`${spot} .overflow-x-auto`);
  const row = box?.children[0];
  const nameSpan = row?.querySelector("button .truncate");
  const pathSpan = row?.querySelector("span.block.truncate");
  const bar = document.querySelector(`${spot} [class*="h-1 "]`);
  const header = document.querySelector("header.sticky");
  const cs = (el) => (el ? getComputedStyle(el) : null);
  return {
    rootClient: root?.clientHeight ?? 0,
    rootScroll: root?.scrollHeight ?? 0,
    rosterClient: box?.clientHeight ?? 0,
    rosterScroll: box?.scrollHeight ?? 0,
    rowBreak: cs(row)?.breakInside ?? "",
    nameWrap: cs(nameSpan)?.whiteSpace ?? "",
    pathWrap: cs(pathSpan)?.whiteSpace ?? "",
    stripWrap: cs(strip)?.flexWrap ?? "",
    stripOvX: cs(strip)?.overflowX ?? "",
    barH: bar?.clientHeight ?? -1,
    headerDisplay: cs(header)?.display ?? "",
    bodyH: document.body.scrollHeight,
  };
});
must(geo.rootScroll - geo.rootClient <= 2, `A1 dashboard root unrolled (scroll ${geo.rootScroll} vs client ${geo.rootClient})`);
must(geo.rootClient > 1500, `A2 root grew past one viewport (client ${geo.rootClient}, was 745)`);
must(geo.rosterScroll - geo.rosterClient <= 2, `A3 roster unrolled (scroll ${geo.rosterScroll} vs client ${geo.rosterClient})`);
must(geo.rowBreak === "avoid", `A4 roster rows atomic (break-inside ${geo.rowBreak})`);
must(geo.nameWrap === "normal", `A5 roster names unwrap on paper (${geo.nameWrap})`);
must(geo.pathWrap !== "normal", `A6 path line keeps its truncate (${geo.pathWrap})`);
must(geo.stripWrap === "wrap", `A7 breadcrumb strip wraps on paper (${geo.stripWrap})`);
must(geo.stripOvX === "visible", `A8 breadcrumb strip unclipped (${geo.stripOvX})`);
must(geo.barH >= 0 && geo.barH <= 6, `A9 progress bars unharmed by direct-child scoping (h ${geo.barH})`);
must(geo.headerDisplay === "none", `A10 app header off the paper (${geo.headerDisplay})`);
must(geo.bodyH > 1100, `A11 paper body spans past one page (${geo.bodyH}px)`);

/* ---------------- Phase B: the paper itself ---------------- */
console.log("Phase B — the paper itself");
await p.pdf({ path: OUT, printBackground: true, preferCSSPageSize: false, format: "A4" });
await p.emulateMedia({ media: "screen" });
await sleep(300);

const raw = await (await import("node:fs")).promises.readFile(OUT, "latin1");
const counts = [...raw.matchAll(/\/Count (\d+)/g)].map((m) => +m[1]);
const pages = Math.max(...counts);
must(pages >= 2, `B1 dashboard print spans multiple pages (got ${pages})`);

const txt = execSync(`pdftotext ${OUT} -`, { encoding: "utf8" })
  .replace(/\s+/g, "")
  .toLowerCase();
let missing = 0;
for (const n of roster.names) {
  const key = n.replace(/\s+/g, "").toLowerCase();
  if (!txt.includes(key)) { console.log(`  MISSING: ${n}`); missing++; }
}
must(missing === 0, `B2 every roster name on the paper (${roster.names.length - missing}/${roster.names.length})`);
must(txt.includes("cryoflow—pipelinesnapshot"), "B3 masthead kicker on paper");
must(txt.includes("projectdashboard—allworkspacesataglance"), "B4 dashboard subtitle on paper");
must(!txt.includes("openworkflow") && !txt.includes("switch&open"), "B5 navigation CTAs off the paper (roster + project cards)");
must(!txt.includes("noted") && !txt.includes("unassigned"), "B6 filter chips off the paper (interactive chrome)");

/* ---------------- Phase C: canvas contract not regressed ---------------- */
console.log("Phase C — canvas contract not regressed");
{
  must(await ensureView("canvas"), "C0 back on the canvas");
  await p.waitForSelector('[data-canvas="viewport"]');
  await sleep(500);
  // page.pdf() honors whatever emulateMedia is active (probe t79-media-probe:
  // screen emulation prints the app HEADER and drops the masthead) — the
  // dashboard leg left screen media behind, so re-assert print here
  await p.emulateMedia({ media: "print" });
  await sleep(300);
  await p.pdf({
    path: OUT_CANVAS,
    printBackground: true,
    preferCSSPageSize: true,
  });
  const craw = await (await import("node:fs")).promises.readFile(OUT_CANVAS, "latin1");
  const ccounts = [...craw.matchAll(/\/Count (\d+)/g)].map((m) => +m[1]);
  const cpages = Math.max(...ccounts);
  must(cpages === 1, `C1 canvas print still fits one page (got ${cpages})`);
  const ctxt = execSync(`pdftotext ${OUT_CANVAS} -`, { encoding: "utf8" })
    .replace(/\s+/g, "")
    .toLowerCase();
  must(ctxt.includes("cryoflow—pipelinesnapshot"), "C2 canvas masthead on paper");
  must(!ctxt.includes("cryo-emworkflowbuil"), "C3 app header off the canvas paper too");
}

/* ---------------- Phase D: console clean ---------------- */
must(consoleErrors.length === 0, `D1 console clean (0 errors, got ${consoleErrors.length})`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));

await b.close();
console.log(fail === 0 ? "QA79 ALL PASS" : `QA79 FAILED (${fail})`);
process.exit(fail === 0 ? 0 : 1);
