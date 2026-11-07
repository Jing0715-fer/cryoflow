#!/usr/bin/env node
/**
 * t416-verify-fixes — the browser-side witness for this window's six src
 * fixes, run against whatever lane owns :3000 (this window: the webpack DEV
 * lane — the standalone build was environmentally unreachable, see the
 * worklog). Covers the three user-visible doors the fixes touch:
 *
 *   A  console + page errors — the whole session stays clean
 *   B  print doc header/footer — the print date fills after hydration
 *      (usePrintedDate: useSyncExternalStore with an empty server snapshot;
 *      the observable contract is unchanged — date present, no hydration
 *      mismatch in the console)
 *   C  Session QC report dialog — opens, the markdown tables render (the
 *      ReportTr named-function-expression path: the tr override with its
 *      useContext trio), no errors
 *   D  a Refine3D Results view — the ortho panel mounts ([data-ortho-on]
 *      tiles render). This exercises map-ortho-panel's effect ORDER after
 *      the flash-back-timer hook moved above the isStack early return
 *      (the hooks-count crash door, closed structurally)
 *
 * The hpc-profiles-editor a11y wrapper (role=listitem div around the
 * button) is verified by tsc + eslint + code review only this window —
 * its dialog needs the full submit flow; the next standalone window's
 * t293 covers the visual contract.
 */
import { chromium } from "playwright";

const BASE = process.env.CF_BASE ?? "http://localhost:3000";
let pass = 0, fail = 0;
const failures = [];
const must = (c, label) => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; failures.push(label); console.log(`FAIL  ${label}`); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
const pageErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => pageErrors.push(String(e)));

try {
  console.log("== t416-verify-fixes ==");
  // the dev lane can OOM-die-and-resurrect mid-session (the watchdog revives
  // it in ~5-10s) — the goto rides through death windows
  let loaded = false;
  for (let i = 0; i < 6 && !loaded; i++) {
    try {
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120_000 });
      loaded = true;
    } catch {
      console.log(`    (server down at goto attempt ${i + 1} — waiting for the watchdog)`);
      await page.waitForTimeout(9000);
    }
  }
  if (!loaded) throw new Error("the server never came back up after 6 goto attempts");
  await page.waitForSelector("[data-print-foot]", { timeout: 60_000 });
  // the dev lane compiles the home graph on first hit — give it room
  await page.waitForTimeout(3000);

  const foot = await page.textContent("[data-print-foot]");
  must(/\d{4}/.test(foot ?? ""), `B1 print footer carries the date after hydration (${(foot ?? "").trim().slice(0, 60)})`);
  const head = await page.textContent("[data-print-doc]");
  must(/\d{4}/.test(head ?? ""), `B2 print header carries the date after hydration (${(head ?? "").trim().slice(0, 60)})`);

  // C — the session QC report dialog (the ReportTr table path)
  await page.click('button[aria-label="Session QC report"]', { timeout: 30_000 });
  const dlg = page.locator("[role='dialog']");
  await dlg.waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(2500); // the report compiles its lazy chunk + fetches
  const dlgText = (await dlg.textContent()) ?? "";
  must(dlgText.length > 200, `C1 the session report dialog renders its document (${dlgText.length} chars)`);
  const tables = await dlg.locator("table").count();
  must(tables >= 1, `C2 the report's markdown tables render — the ReportTr path (${tables} table(s))`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);

  // D — a Refine3D Results view through the command palette (the t397 dialect)
  await page.click('button[aria-label="Open command palette (Ctrl+K)"]', { timeout: 30_000 });
  const pal = page.locator("[cmdk-input], input[placeholder*='Jump to a job']");
  await pal.waitFor({ state: "visible", timeout: 30_000 });
  await pal.fill("Refine3D");
  await page.waitForTimeout(1200);
  const item = page.locator(`[cmdk-item], [role='option']`).filter({ hasText: "Refine3D" }).first();
  await item.click({ timeout: 30_000 });
  // the inspector opens on the job — switch to Results
  const resultsTab = page.locator("button[value='results']").first();
  await resultsTab.waitFor({ state: "visible", timeout: 60_000 });
  await resultsTab.click();
  const ortho = page.locator("[data-ortho-on]");
  try {
    await ortho.first().waitFor({ state: "visible", timeout: 90_000 });
    must(true, "D1 the ortho panel mounts its tiles (map-ortho-panel renders after the hook-order fix)");
  } catch {
    must(false, "D1 the ortho panel mounts its tiles (map-ortho-panel renders after the hook-order fix)");
  }
} catch (e) {
  console.error("ABORTED AT:", String(e?.message ?? e).slice(0, 400));
  must(false, "the verification ran to completion", String(e?.message ?? e).slice(0, 200));
}

const realConsoleErrors = consoleErrors.filter((t) =>
  // the dev lane's own noise (Fast Refresh / source-map misses) is not the app's
  !/Download the React DevTools|fast refresh|SourceMap| sourcemaps? /i.test(t));
must(realConsoleErrors.length === 0, `A1 zero real console errors (got ${realConsoleErrors.length}${realConsoleErrors.length ? ": " + realConsoleErrors[0].slice(0, 120) : ""})`);
must(pageErrors.length === 0, `A2 zero page errors (got ${pageErrors.length}${pageErrors.length ? ": " + pageErrors[0].slice(0, 120) : ""})`);

await browser.close();
console.log(`\n===== t416-verify-fixes: ${pass} passed, ${fail} failed =====`);
if (failures.length) for (const f of failures) console.log(`  - ${f}`);
process.exit(fail > 0 ? 1 : 0);
