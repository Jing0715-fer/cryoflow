// qa63-smoke — post-writeRuns-migration smoke + console probe.
// Bootstraps dashboard → canvas → inspector (QA Post 320) → FSC compare
// dialog open/close, then asserts ZERO page errors. ~60 s total (fits the
// tool-call window that kept eating longer calls this window).
//
// t1164 — the NO-TRACE contract, now a pin: the suite seeds the FSC
// fixture family (QA * jobs, idempotent by name), rides the server,
// and PROVES the world it leaves behind is the world it found — the
// take-home runs on every exit path (normal / FATAL / throw) AND its
// result is asserted (assertNoLeftovers: zero QA-family jobs in the
// dev lane before SMOKE GREEN). A silent cleanup failure can no
// longer dress up as a green suite (t1163's live catch).
//
// Task 92 — MIGRATED agent-browser CLI → playwright (the last matrix
// member still on the old channel; Task 91's "zero agent-browser" claim
// missed it and qa58). Assertion set byte-identical, driver swapped per
// the qa70/qa66/qa69 migration template. The boot view depends on the
// store's persisted last view, so the Shift+D toggle loop converges on
// canvas from either start (press only while NOT canvas; t90 pattern).
//
// Run: node scripts/qa63-smoke.mjs   (server must be on :3000)
import { chromium } from "playwright";
import { execSync, spawnSync } from "node:child_process";

const B = "http://localhost:3000";
const HOST_JOB = "QA Post 320";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// t633 — the whole fsc fixture family goes home (t630 seeder). Sync so a
// FATAL can run it inline before exit (playwright's exit hook reaps the
// browser process tree); the normal path calls the same verb at the end.
// t1164 — the take-home returns its truth (bool): t1163's live catch —
// a silent take-home warn left 5 QA jobs standing in the world, and the
// next strict world-gate ride refused a DRIFTED world the suite had
// made — proved that a WARNED cleanup is a cleanup that did not
// happen. The no-trace-neighbor law is not a habit, it is a PIN: the
// normal path asserts zero QA-family jobs LEFT before it may say SMOKE
// GREEN (assertNoLeftovers, below), and the FATAL path still takes its
// specimens home on the way out.
const takeHomeHome = () => {
  try { sh("python3 /home/z/my-project/scripts/qa60-seed-fsc.py --take-home"); return true; } catch (e) { console.log(`  take-home warn: ${String(e).slice(0, 120)}`); return false; }
};

// t1164 — the no-trace proof: the dev lane's job table holds ZERO
// QA-family rows after the take-home (the seeder's whole family is
// named QA * — QA Post 300/320/385, QA Refine 410; the tracked demo
// spine's 15 jobs are all tutorial-named and are NEVER touched). The
// count runs against the same lane the :3000 server serves — the
// world the next reader (and the next world-gate probe) will see.
const assertNoLeftovers = () => {
  // spawnSync argv-direct — an inline `node -e` inside sh() would hand
  // the code to a shell, and the shell eats `$disconnect` as its own
  // variable (observed live: p.() syntax error, the first draft died
  // of quote-nesting). No shell, no expansion, no third quoting layer.
  const r = spawnSync(
    "node",
    [
      "-e",
      "const{PrismaClient}=require('@prisma/client');" +
        "const p=new PrismaClient({datasources:{db:{url:'file:/home/z/my-project/db/cryoflow.db'}}});" +
        "p.job.count({where:{name:{startsWith:'QA '}}}).then(c=>{console.log(c);return p.$disconnect();})",
    ],
    { encoding: "utf8", timeout: 60_000 },
  );
  const leftover = (r.stdout || "").trim().split("\n").filter(Boolean).slice(-1)[0] ?? `spawn-${r.status ?? "?"}`;
  must(leftover === "0", `take-home leaves no QA-family jobs (got ${leftover} standing)`);
};

const must = (cond, label) => {
  if (!cond) {
    // t630 doctrine — a FATAL takes its specimens home too (the old
    // bare exit(1) leaked the seeded family live on t633's narrow runway;
    // the next run's idempotent re-seed had to eat the dog food)
    console.log(`FATAL: ${label}`);
    takeHomeHome();
    process.exit(1);
  }
  console.log(`  ok: ${label}`);
};

// ---- boot -----------------------------------------------------------------
try { sh("pkill -f agent-browser"); } catch { /* none running */ }
// self-seed (Task 86 doctrine): the compare-dialog row count includes the
// RUNNING fixture, and qa62's --clean deletes exactly that job — running
// this suite right after qa62 (the matrix's alphabetical order) left 4
// rows vs the expected 5. Seed is idempotent by name, so the world this
// suite needs exists regardless of who ran before.
try { sh("python3 /home/z/my-project/scripts/qa60-seed-fsc.py >/dev/null 2>&1"); } catch { /* seed best-effort */ }
// t633 — the whole body lives in main() so ANY throw (goto timeout,
// evaluate context destroyed) reaches the catch, which takes the seeded
// family home before exiting: the old top-level TLA shape let a goto
// TimeoutError bypass must() entirely and leak all five rows (witnessed
// live twice on the narrow runway; the idempotent re-seed ate it)
async function main() {
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
// dual collection replaces the old window.__qaErrs injection (qa70 template)
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(String(m.text() || m).slice(0, 160)); });
p.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 160)));

// t523 two-stage law — networkidle never settles on a 2s-polling app
// (the last suite in the family still trusting it); arrive on
// domcontentloaded and let the canvas-convergence loop below wait for the
// REAL truth (the host job's card), not the network's silence
await p.goto(B, { waitUntil: "domcontentloaded" });
await sleep(1500);

const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
let onCanvas = false;
for (let i = 0; i < 10 && !onCanvas; i++) {
  if ((await curView()) === "canvas") {
    const card = await p.locator(`[data-job]`, { hasText: HOST_JOB }).count();
    if (card > 0) onCanvas = true;
  }
  if (!onCanvas) {
    await p.keyboard.press("Shift+D"); // toggle dashboard/canvas — converges
    await sleep(2200);
  }
}
must(onCanvas, "canvas renders with seeded job cards");

// ---- reach via find (Task 136 doctrine, backfilled here after the smoke
// false-failed twice: world-hygiene moves + restore events make the
// remembered viewport untrustworthy — the host card sat 474px ABOVE the
// viewport and playwright cannot scroll a transformed canvas. Ctrl+F →
// name → Enter (focusJob: center + legibility zoom) reaches any card in
// any world state; Esc leaves the selection intact (t134 contract).) ----
await p.keyboard.press("Control+f");
const findInput = p.locator('[data-testid="canvas-find-input"]');
if (await findInput.isVisible().catch(() => false)) {
  await findInput.fill(HOST_JOB);
  await sleep(300);
  await p.keyboard.press("Enter");
  await sleep(800);
  await p.keyboard.press("Escape");
  await sleep(400);
}

// ---- inspector -------------------------------------------------------------
let modal = false;
for (let i = 0; i < 5 && !modal; i++) {
  // data-job lives on the wrapper, role=button on the card body INSIDE it —
  // two elements, so the locator must chain, not compound
  const card = p.locator("[data-job]", { hasText: HOST_JOB }).locator('[role="button"]').first();
  try {
    await card.click({ timeout: 3000 });
    await sleep(1500);
    modal = await p.evaluate((host) => {
      const dl = [...document.querySelectorAll("[role=dialog]")].find((d) => (d.textContent || "").includes(host));
      return !!dl;
    }, HOST_JOB);
  } catch { await sleep(1500); }
}
must(modal, "inspector modal opens for the completed postprocess job");

// ---- the results tab (t523 fix) ----
// The inspector grew tabs (qa49's "results tab: tab-clicked" walked the same
// road); the FSC section lives behind the Results tab now — the old
// "open modal, see FSC" assumption has been silently false since the tab
// lands, and the suite has been REAL-FAILing on it since at least t522's
// family run (its report carried the verdict nobody read).
const tab = await p.evaluate(() => {
  const t = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim().includes("Results"));
  if (!t) return "NO-TAB";
  t.click();
  return "tab-clicked";
});
must(tab === "tab-clicked", "results tab exists and opens (the inspector's tabbed body)");
// t630 waiting law, third lesson — the tab's appearance is not the data's
// appearance: the FSC section rides a chart fetch that can lose to compiler
// pressure on a narrow runway (witnessed live: the fixed 2.5s window died
// while compare-dialog polling later in this file was already sane)
let fsc = false;
for (let i = 0; i < 30 && !fsc; i++) {
  await sleep(500);
  fsc = await p.evaluate(() =>
    !!document.querySelector('section[aria-label="Fourier-shell correlation"]'));
}
must(fsc, "FSC section rendered inside inspector (state→workdir resolution alive post-migration)");

// ---- compare dialog open/close ---------------------------------------------
let dialog = false;
let rowCount = "0";
for (let i = 0; i < 5 && !dialog; i++) {
  try {
    await p.locator('[role=dialog] button[aria-label*="compare"], [role=dialog] button[title*="compare"]')
      .first().click({ timeout: 3000 });
    // t630 waiting law, same lesson again — the dialog's OPEN is not the
    // rows' arrival: the project FSC scan rides a workdir-walking index
    // fetch that loses to compiler pressure on a narrow runway (the old
    // single 1.8s window read 0 rows five times in a row, live)
    for (let k = 0; k < 30 && !dialog; k++) {
      await sleep(500);
      rowCount = String(await p.locator("[data-testid=fsc-compare-row]").count());
      dialog = Number(rowCount) >= 5;
    }
  } catch { await sleep(1500); }
}
must(dialog, `compare dialog opens with rows (got ${rowCount}, expect 5)`);

// Esc closes only the dialog (inspector survives — qa61 layered-escape contract).
// Dispatch on the DIALOG element (qa62 pattern): target must be a DOM node on
// the React root's bubble path — a document-target event never reaches the
// Radix/React onKeyDown handlers.
const escRet = await p.evaluate(() => {
  const dl = [...document.querySelectorAll("[role=dialog]")].find((d) => d.querySelector("[data-testid=fsc-compare-list]"));
  if (dl) dl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return dl ? "esc-dispatched" : "esc-NO-DIALOG";
});
// Radix unmounts on animation end — poll instead of a fixed sleep (a 1s
// wait raced the exit animation and false-failed this assertion once)
let cmpGone = false;
for (let i = 0; i < 10 && !cmpGone; i++) {
  await sleep(400);
  cmpGone = (await p.locator("[data-testid=fsc-compare-list]").count()) === 0;
}
const afterEsc = await p.evaluate((host) => {
  const cmp = !!document.querySelector("[data-testid=fsc-compare-row]");
  const insp = [...document.querySelectorAll("[role=dialog]")].some((d) => (d.textContent || "").includes(host));
  return (cmp ? "CMP" : "NOCMP") + (insp ? "+INSP" : "+NOINSP");
}, HOST_JOB);
must(afterEsc === "NOCMP+INSP", `Esc closes compare dialog, inspector survives - got "${afterEsc}" (dispatch: ${escRet}, cmpGone: ${cmpGone})`);

// ---- console verdict --------------------------------------------------------
must(consoleErrors.length === 0, `console errors: ${consoleErrors.length === 0 ? "0" : `**${consoleErrors.length}** ${JSON.stringify(consoleErrors.slice(0, 5))}`}`);

await b.close();
// the normal path uses the same take-home verb the FATAL path uses —
// and t1164 makes it PROVE the no-trace law before the green word:
// a warned-but-failed cleanup left 5 jobs standing once (t1163's
// live catch); that silence is now impossible.
takeHomeHome();
assertNoLeftovers();
// t1164 — the byte-half of the no-trace contract: the ride through
// the product doors leaves SQLite freelist pages the deletes never
// return, and the page-quantized size is a pinned face (t1021's
// family). The rider compacts what IT moved — no trace, in rows OR
// in bytes.
spawnSync("node", ["/home/z/my-project/scripts/world-snapshot.mjs", "vacuum"], {
  encoding: "utf8",
  timeout: 60_000,
});
console.log("SMOKE GREEN");
}

main().catch((e) => {
  console.error(e);
  takeHomeHome();
  process.exit(1);
});
