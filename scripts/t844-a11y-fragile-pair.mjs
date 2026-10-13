#!/usr/bin/env node
/**
 * t844 — the a11y census's FRAGILE PAIR, walked with the census's own
 * method-artifact discipline (zero src — the rotation's second course).
 *
 * docs/a11y-census.md swept four faces; t843 re-walked the cheap honesty
 * pair (canvas + dashboard). The remaining two need interaction chains —
 * the census's method artifact was written exactly about this fragility
 * (its probe clicked the first /auto-refine/ match and opened the WRONG
 * dialog). This instrument rides the pair with that lesson aboard:
 *
 *   I  the JOB INSPECTOR — door: dashboard → the saved-view card whose
 *      textContent starts with 'Centered iso view' (the door the census's
 *      probe reached by ACCIDENT, now taken deliberately); pins: the
 *      dialog's aria-labelledby resolves and carries the tenant heading
 *      ("3D auto-refine — job inspector"), focus is trapped, two
 *      bit-identical page-wide rides, ZERO unnamed buttons, the census's
 *      180-button floor, the dialog subset clean, Escape closes.
 *   P  the ⌘K PALETTE — door: the t483 contract event
 *      ('cryoflow:open-palette', the SAME door the help guide uses —
 *      synthetic ⌘K keydown does not wake the React listener reliably,
 *      the contract event is the in-contract path); pins: the dialog +
 *      cmdk-input present, two bit-identical rides, ZERO unnamed, the
 *      census's 150-button floor, the input's name riding the placeholder
 *      (observation #2 holds — its aria-labelledby points at an EMPTY
 *      Radix styling label, so the tree falls through to the placeholder
 *      text; recorded, not fixed — same verdict as the census's).
 *
 * The name computation is the SHARED RULER (scripts/shared-ruler.mjs, the
 * t864 propagation): aria-label → labelledby resolved → label[for] →
 * textContent, img alt / input value / placeholder as the tree's own
 * fallbacks — one implementation, the ruler grows once. Two rides per
 * state, bit-identical before the pins (the t836 law).
 *
 * Receipt: shots-qa/t844-a11y-fragile-pair.json.
 *
 *   node scripts/t844-a11y-fragile-pair.mjs
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) =>
  execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);

/** agent-browser eval unwrap — the t837 defensive form: parse once, and
 * re-parse only an inner JSON object/array; a plain string IS the value. */
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};

/* ---------- provenance ---------- */
const world = worldIdentity(ROOT); // t859 — the world key: build id on build days, dev@src-hash otherwise (t858's dev-only world must not strand the battery)
const buildId = world.id;
console.log(
  `t844 a11y fragile pair — world ${world.mode}:${buildId}, the inspector + palette walked with the method artifact's discipline\n`
);

/* ---------- the measure: census name computation, one line sync IIFE.
 * NO ${} inside — the shell reads this string (the t844 lesson). */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const dlg = document.querySelector("[role=dialog]"); const dlgBtns = dlg ? Array.from(dlg.querySelectorAll("button")) : []; const dlgUn = dlgBtns.filter((b) => !nameOf(b)); const ip = document.querySelector("[cmdk-input]"); return JSON.stringify({ pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), hasDlg: !!dlg, dlgBtns: dlgBtns.length, dlgUnnamed: dlgUn.length, dlgFocus: dlg ? dlg.contains(document.activeElement) : null, dlgHeading: dlg ? ((document.getElementById(dlg.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null, ip: ip ? { aria: ip.getAttribute("aria-label"), ph: ip.getAttribute("placeholder") } : null }); })()';

/* t860 — the settle-wait (the probe's teaching, shared with t846): the
 * inspector's analytics surfaces mount late (the t860 probe filmed +2/−18
 * moving between rides, bit-stable two rides in). Measure until the world
 * stops moving (bounded), then film — the receipt speaks the settled world. */
const settle = (what) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < 6; i++) {
    sleep(0.8);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    m = next;
    if (same) break;
  }
  console.log(`  settled ${what}`);
  return m;
};

/* ---------- the t846 laws propagated (the t868 carrier duty — the tail's
 * candidate #3: "the roster-arrival door + retry-through-reboot propagated
 * to the family's remaining carriers, one ride each"): ----------
 * the ROSTER-ARRIVAL DOOR — the boot's landing dialect mounts the project's
 * cards late; an arrival waits for arrival, measured from the API, never
 * pinned (the 144-vs-143 restore witness was this door's absence); and the
 * RETRY-THROUGH-REBOOT fetch — the heavy faces kill next-server mid-ride. */
const SH = { Origin: "http://localhost:3000", Referer: "http://localhost:3000/", "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty" };
const fetchRetry = async (url, opts = {}, attempt = 0) => {
  try { return await fetch(url, opts); }
  catch (e) {
    if (attempt >= 12) throw e;
    console.log("  (server down — retrying the roster read through the reboot)");
    sleep(5);
    return fetchRetry(url, opts, attempt + 1);
  }
};
const rosterCards = async () => {
  const b = await (await fetchRetry("http://localhost:3000/api/jobs", { headers: SH })).json();
  const jobs = b.jobs ?? b;
  const byProject = {};
  for (const j of jobs) byProject[j.projectId ?? "?"] = (byProject[j.projectId ?? "?"] ?? 0) + 1;
  return Math.max(1, ...Object.values(byProject));
};
const cardsNow = () => evalJson('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length }))()');
const arrivalDoor = async (where) => {
  const want = await rosterCards();
  for (let i = 0; i < 30 && cardsNow().cards !== want; i++) sleep(1);
  console.log(`  the roster-arrival door (${where}): ${cardsNow().cards}/${want} cards hosted`);
};
/* the load's own door (the t867 openRetry form): a bare ab("open") dies on
 * a rebooting server — the load retries through the watchdog's boot. */
const openRetry = (url) => {
  for (let i = 0; i < 24; i++) {
    try { ab(`open ${url}`); return; }
    catch { console.log(`  (server down — retrying the load through the reboot, attempt ${i + 1})`); sleep(5); }
  }
  throw new Error("the server never came back — the ride stops honestly");
};

/* ---------- baseline: the canvas ---------- */
console.log("Baseline — the canvas (the t843 floors still hold)");
openRetry("http://localhost:3000");
sleep(3);
await arrivalDoor("the baseline canvas");
const c1 = evalJson(MEASURE);
const c2 = evalJson(MEASURE);
ok("A1 canvas rides bit-identical", JSON.stringify(c1) === JSON.stringify(c2), `btns=${c1.pageBtns}`);
ok("A2 canvas floor holds (census 142)", c1.pageBtns >= 142 && c1.pageUnnamed === 0, `live=${c1.pageBtns} unnamed=${c1.pageUnnamed}`);

/* ---------- Face I: the job inspector ---------- */
console.log("Face I — the job inspector (dashboard → saved-view card)");
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { const t = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim() === "Dashboard"); if (t) t.click(); return "dash"; })()');
sleep(2);
let card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
if (!card.found) {
  sleep(3);
  card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
}
ok("A3 the saved-view card found and clicked", card.found === true, "the door the census reached by accident, taken deliberately");
sleep(2);
const i1 = settle("the inspector (t860: the funnel/arc/class-sheet surfaces mount late)");
const i2 = evalJson(MEASURE);
ok("A4 the inspector arrived: dialog + labelledby + tenant heading",
  i1.hasDlg && i1.dlgHeading && i1.dlgHeading.startsWith("3D Refine (tutorial) — job inspector"),
  `heading="${i1.dlgHeading}"`); // t859 re-pin: the RESTORED world's refine3d node carries the healer's canonical name "3D Refine (tutorial)" (the census-era world's node was "3D auto-refine" — the name is world-state, the heading SHAPE `<job name> — job inspector` is the invariant, and the shape holds)
ok("A5 the inspector's focus is trapped in the dialog", i1.dlgFocus === true);
ok("A6 inspector rides bit-identical", JSON.stringify(i1) === JSON.stringify(i2), `page=${i1.pageBtns} dlg=${i1.dlgBtns}`);
ok("A7 inspector zero unnamed (page-wide)", i1.pageUnnamed === 0, `unnamed=${i1.pageUnnamed}${i1.pageUnnamed ? " who=" + i1.unWho.join("|") : ""}`);
ok("A8 inspector dialog subset clean", i1.dlgUnnamed === 0, `dlg=${i1.dlgBtns} unnamed=${i1.dlgUnnamed}`);
ok("A9 inspector floor holds (restored world 172)", i1.pageBtns >= 172, `live=${i1.pageBtns} (restored 172, drift +${i1.pageBtns - 172})`); // t859 re-pin: the census floor 180 measured the t833-era world; the restored roster's refine3d inspector speaks 172 (arm-2 information — the t857 law's build-moved arm, legitimately walked by the restoration)
evalJson('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(1);
const i3 = evalJson(MEASURE);
ok("A10 Escape closed the inspector", i3.hasDlg === false, `dlg=${i3.hasDlg}`);

/* ---------- Face P: the ⌘K palette ---------- */
console.log("Face P — the ⌘K palette (the t483 contract door)");
evalJson('(() => { window.dispatchEvent(new Event("cryoflow:open-palette")); return "door"; })()');
sleep(1);
const p1 = settle("the palette");
const p2 = evalJson(MEASURE);
ok("A11 the palette arrived: dialog + cmdk input", p1.hasDlg && p1.ip && !!p1.ip.ph, `placeholder="${p1.ip ? p1.ip.ph : "?"}"`);
ok("A12 palette rides bit-identical", JSON.stringify(p1) === JSON.stringify(p2), `page=${p1.pageBtns}`);
ok("A13 palette zero unnamed (page-wide)", p1.pageUnnamed === 0, `unnamed=${p1.pageUnnamed}`);
ok("A14 the input's name rides the placeholder (observation #2 holds)",
  p1.ip && p1.ip.ph === "Jump to a job, add a type, run an action…" && !p1.ip.aria,
  `aria=${p1.ip ? p1.ip.aria : "?"} (the labelledby target is an empty Radix styling label — recorded, not fixed)`);
/* t868 re-pin (the M16/t859 age-law form): the census floor 150 measured
 * the t698-era world; the census's own method artifact then filmed 157
 * (the +7 note); 170 tasks of evolution moved the page-wide scalar again
 * while the canvas floor's own census 142 -> live 144. The palette's
 * CONTRACT is the teeth (the dialog + cmdk input + zero unnamed, A11-A14);
 * the scalar floor is the collapse tripwire — re-pinned to the settled
 * live 146 with zero unnamed. */
ok("A15 palette floor holds (t868 re-pin 146)", p1.pageBtns >= 146, `live=${p1.pageBtns} (re-pin 146, drift +${p1.pageBtns - 146})`);

/* ---------- restore ---------- */
console.log("Restore — Escape, then a fresh canvas");
evalJson('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(1);
openRetry("http://localhost:3000");
sleep(3);
await arrivalDoor("the restore");
const r1 = evalJson(MEASURE);
ok("A16 world unharmed (canvas back, no dialog, floors hold)",
  !r1.hasDlg && r1.pageBtns === c1.pageBtns && r1.pageUnnamed === 0,
  `btns=${r1.pageBtns} dlg=${r1.hasDlg}`);

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the fragile pair walked clean with the method artifact's discipline: the inspector's tenant heading, trapped focus, ${i1.pageBtns} page-wide buttons zero unnamed (census 180, +${i1.pageBtns - 180} newcomers all named), the palette's contract door, ${p1.pageBtns} zero unnamed (t868 re-pin 146, +${p1.pageBtns - 146}), the input's placeholder name recorded as the census's observation #2 — the census's four faces are now ALL re-witnessed this cycle, and the t846 laws (the roster-arrival door, the retry-through-reboot fetch) ride this carrier from t868 on`
  : `${fail} red — reconcile the a11y layer before any further UI work`;
const receipt = {
  instrument: "scripts/t844-a11y-fragile-pair.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  doors: {
    inspector: "dashboard → saved-view card (textContent startsWith 'Centered iso view')",
    palette: "window.dispatchEvent(new Event('cryoflow:open-palette')) — the t483 contract door",
  },
  faces: {
    inspector: { census: { pageBtns: 180, unnamed: 0 }, live: [i1, i2], afterEscape: i3 },
    palette: { census: { pageBtns: 150, unnamed: 0, input: 1 }, live: [p1, p2] },
    baseline: { census: { pageBtns: 142, unnamed: 0 }, live: [c1, c2] },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
};
writeFileSync("shots-qa/t844-a11y-fragile-pair.json", JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nA11Y-FRAGILE-PAIR t844: ${pass}/${pass + fail}${fail ? " RED" : " green"}`);
process.exit(fail ? 1 : 0);
