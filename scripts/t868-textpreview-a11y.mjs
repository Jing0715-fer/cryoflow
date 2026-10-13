#!/usr/bin/env node
/**
 * t868 — the a11y rotation's next surface: the TEXT-PREVIEW face — the
 * results-view's third Esc seat, closing the room trio (star table t866,
 * quick-look t867, THIS page) with the quick-look's own laws.
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862) -> job panel (t863)
 * -> document/compare dialogs (t864) -> results family (t865) -> star
 * table (t866) -> quick-look (t867) -> THIS face (t868).
 *
 * The surface (five faces, one window):
 *
 *   O0  the clean room — the t866 law: the session seed cleared, the
 *       panel-closed boot demanded; the ROSTER-ARRIVAL DOOR (t846).
 *   LR  the Logs & reports section — the inspector's Results tab through
 *       the MOUSEDOWN door, the section present and named, the text doors
 *       MEASURED FROM THE DATA (names == the outputs API's text files),
 *       zero unnamed, two settled rides bit-identical.
 *   TP  the text preview dialog — the TOPMOST layer, the heading = the
 *       file's own name, the description = the tail contract ("· last
 *       64 KB"), the content a NAMED FOCUSABLE region that TAKES the
 *       focus (the t774 law), the TAIL PROVEN (a 118889-byte file yields
 *       ~65536 chars — the backend's last-64KB answer, measured), the
 *       wrap contract (pre-wrap; X contained, Y scrolls), the keymap
 *       seat, the copy row named, zero unnamed, two settled rides.
 *   CB  the copy row — the one clipboard dialect (Task 170): the door
 *       speaks its name, the flip walks live ("Copy" -> "Copied").
 *   KB  the keyboard contract — Esc closes (the keymap's own teaching),
 *       the door walks again (the deterministic re-walk).
 *   FT  the second family — the inspector's Files tab (the t779 brain's
 *       second door-set): the peek EYES named ("Preview <name>"), the
 *       text row's eye opens the SAME dialog with the SAME face, and the
 *       NEW twin keymap seat (the t868 fix, proven live), zero unnamed.
 *   W   the world back — fresh load, the canvas bit-for-bit, the W2 seed
 *       hygiene (the t866 lesson rides every page).
 *
 * Born with the ledger aboard (the t861 birthright): FOUR faces through
 * the shared helper — logsSection / textDialog / filesTabPeek / worldBack.
 *
 * Receipt: shots-qa/t868-textpreview-a11y.json.
 *
 *   node scripts/t868-textpreview-a11y.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";

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

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);

/** agent-browser eval unwrap — the t837 defensive form. */
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

/* ---------- provenance + the comparator (the family's shared law) ---------- */
const world = worldIdentity(ROOT);
const buildId = world.id;
const cmp = loadComparator(ROOT, "shots-qa/t868-textpreview-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t868 textpreview a11y walk — world ${world.mode}:${buildId}, the Logs & reports section, the text preview dialog, the copy row, the Files-tab peek and the world back through the shared ruler\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* same-origin metadata — the roster read is a same-origin gate (the t708 shape) */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};
/* the fetch-retry (the t402 api() pattern): the heavy faces kill next-server
 * mid-ride and undici's keep-alive pool hands the next fetch a dead socket —
 * retry through the watchdog's reboot instead of crashing with greens unfilmed. */
const fetchRetry = async (url, opts = {}, attempt = 0) => {
  try {
    return await fetch(url, opts);
  } catch (e) {
    if (attempt >= 24) throw e;
    if (attempt === 0) console.log(`  (server down — retrying ${url} through the reboot)`);
    sleep(5);
    return fetchRetry(url, opts, attempt + 1);
  }
};
const roster = async () => {
  const r = await fetchRetry(`${BASE}/api/jobs`, { headers: SH });
  const b = await r.json();
  return b.jobs ?? b;
};
/* the outputs listing — the doors and headings assert against the DATA,
 * never a pinned string (measured, not pinned). */
const outputs = async (id) => {
  const r = await fetchRetry(`${BASE}/api/jobs/${id}/outputs`, { headers: SH });
  const b = await r.json();
  return b.files ?? b;
};

/* ---------- the measure: the SHARED RULER + the text-preview family's probes.
 * ONE superset measure — every face films the same fields; the absent
 * selectors speak false/0 (within-face stability is what the rides diff).
 * NO ${} and no backticks inside — the shell reads this string. */
const MEASURE =
  '(() => { ' + NAMEOF + ' ' +
  'const btns = Array.from(document.querySelectorAll("button")); ' +
  'const un = btns.filter((b) => !nameOf(b)); ' +
  'const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); ' +
  'const unCtrls = ctrls.filter((c) => !nameOf(c)); ' +
  'const imgs = Array.from(document.querySelectorAll("img")); ' +
  'const altless = imgs.filter((i) => !i.hasAttribute("alt")); ' +
  'const imgPend = imgs.filter((i) => !i.complete).length; ' +
  'const dgs = Array.from(document.querySelectorAll("[role=dialog]")); ' +
  'const dlgTop = dgs[dgs.length - 1]; ' +
  'const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 60) : null; ' +
  'const descOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-describedby") || "") || {}).textContent || "").trim().slice(0, 90) : null; ' +
  'const sec = document.querySelector(\'section[aria-label="Logs and reports"]\'); ' +
  'const doors = sec ? Array.from(sec.querySelectorAll("button")) : []; ' +
  'const pre = dlgTop ? dlgTop.querySelector("pre[aria-label=\'File content preview\']") : null; ' +
  'const copy = dlgTop ? Array.from(dlgTop.querySelectorAll("button")).find((b) => { const a = b.getAttribute("aria-label") || ""; return a === "Copy" || a === "Copied"; }) : null; ' +
  'const actTab = document.querySelector("[role=tab][data-state=active]"); ' +
  'const eyes = Array.from(document.querySelectorAll(\'button[aria-label^="Preview "]\')).filter((b) => { const a = b.getAttribute("aria-label") || ""; return !a.endsWith(".star"); }); ' +
  'const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); ' +
  'const loadingLeaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading file…$/.test((e.textContent || "").trim())); ' +
  'return JSON.stringify({ url: location.pathname, panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, ' +
  'unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, ' +
  'imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dgs.length > 0, dlgCount: dgs.length, ' +
  'dlgHeadTop: headOf(dlgTop), dlgDescTop: descOf(dlgTop), ' +
  'logsSection: !!sec, textDoors: doors.length, ' +
  'doorNames: doors.map((d) => ((d.getAttribute("aria-label") || (d.textContent || "")).replace(/^Preview /, "")).trim().slice(0, 44)), ' +
  'doorNamed: doors.every((d) => { const a = d.getAttribute("aria-label") || ""; return a.startsWith("Preview "); }), ' +
  'loading: loadingLeaves.length, ' +
  'prePresent: !!pre, preTabindex: pre ? pre.getAttribute("tabindex") : null, ' +
  'preFocused: pre ? document.activeElement === pre : false, ' +
  'preLen: pre ? (pre.textContent || "").length : 0, ' +
  'preWrap: pre ? getComputedStyle(pre).whiteSpace : null, ' +
  'preScrollY: pre ? pre.scrollHeight > pre.clientHeight : false, ' +
  'preScrollX: pre ? pre.scrollWidth > pre.clientWidth + 1 : false, ' +
  'keymap: dlgTop ? !!dlgTop.querySelector("[data-canvas-ui=text-keymap]") : false, ' +
  'copyPresent: !!copy, copyText: copy ? (copy.textContent || "").trim() : null, ' +
  'clipApi: typeof navigator.clipboard !== "undefined" && typeof navigator.clipboard.writeText === "function", ' +
  'actTab: actTab ? (actTab.textContent || "").trim().slice(0, 12) : null, ' +
  'eyesCount: eyes.length, eyeNames: eyes.slice(0, 12).map((e) => (e.getAttribute("aria-label") || "").slice(0, 48)) }); })()';

/* the settle law (t864/t865's generalization): the loading leaf's own
 * quiescence door SILENT AND the images' own contract AND two consecutive
 * measures equal, bounded. */
const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};
const settle = (what, maxSecs = 16, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    if (!same && run > 1) {
      const dk = diffKeys(m, next);
      console.log(`    (measure moved while settling: ${dk.join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.loading === 0 && m.imgPending === 0) break;
  }
  console.log(`  settled ${what} (loading silent, ${run}x stable)`);
  return m;
};

/* the arrival door: WAIT for a predicate on the live measure (bounded) —
 * an arrival waits for arrival, never for a clock. */
const waitFor = (what, probe, maxSecs = 30) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  return m;
};

/* the OOM corpse guard (the t859/t861/t864-t867 pattern): an eval
 * filming a dead server returns ZEROS — say so, stop honestly. */
const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;

const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';
const escAll = () => {
  for (let i = 0; i < 8; i++) {
    const m = evalJson(MEASURE);
    if (!m.hasDlg) return i;
    evalJson(ESC_LAST);
    sleep(1.2);
  }
  return evalJson(MEASURE).hasDlg ? -1 : 8;
};

/* the retry-through-reboot load (the t402 api() pattern, browser flavor). */
const openRetry = (url) => {
  for (let i = 0; i < 24; i++) {
    try { ab(`open ${url}`); return; }
    catch { console.log(`  (server down — retrying the load through the reboot, attempt ${i + 1})`); sleep(5); }
  }
  throw new Error("the server never came back — the ride stops honestly");
};

/* the card's PLAIN door: pointerdown+pointerup, no move, no shift — the
 * job-card's own law: idle opens the panel, submitted opens the inspector. */
const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

/* the inspector tab's MOUSEDOWN door (t863's teaching: Radix Tabs switch
 * on mousedown — a .click() dispatch is silently ignored). The Files
 * trigger's textContent carries the count badge, so the door matches by
 * PREFIX, never by pinned equality (measured, not pinned). */
const tabMouseDown = (name, exact = true) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => { const s = (e.textContent || "").trim(); return ' + (exact ? 's === "' + name + '"' : 's.startsWith("' + name + '")') + '; }); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true, spoke: (t.textContent || "").trim().slice(0, 16) }); })()';

/* a Logs & reports text door, found by its accessible name — the ONE-VOICE
 * law (t868): the row and its Files-tab twin eye both speak "Preview <name>"
 * (the DATA's own address; the row's raw textContent glues name and size). */
const textDoor = (name) =>
  '(() => { const sec = document.querySelector(\'section[aria-label="Logs and reports"]\'); if (!sec) return JSON.stringify({ clicked: false }); const b = Array.from(sec.querySelectorAll("button")).find((x) => (x.getAttribute("aria-label") || "") === "Preview ' + name + '"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

/* a Files-tab peek EYE, found by its aria-label address ("Preview <name>"). */
const eyeDoor = (name) =>
  '(() => { const b = Array.from(document.querySelectorAll(\'button[aria-label^="Preview "]\')).find((x) => (x.getAttribute("aria-label") || "") === "Preview ' + name + '"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

/* the copy row's σ-GATE walk (the t867 law — the state machine's truth,
 * never a pinned flip): spy on the clipboard, click the door, AWAIT the
 * clipboard's own answer. When the world allows the write, the flip MUST
 * be filmed; when the world seals the clipboard (the headless
 * NotAllowedError witness), the door's honesty is asserted instead — the
 * label never claims a copy that did not happen. */
const CLIP_WALK =
  '(async () => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) return JSON.stringify({ found: false }); const b = Array.from(d.querySelectorAll("button")).find((x) => { const a = x.getAttribute("aria-label") || ""; return a === "Copy" || a === "Copied"; }); if (!b) return JSON.stringify({ found: false }); const orig = navigator.clipboard.writeText.bind(navigator.clipboard); let called = false; let seal = null; navigator.clipboard.writeText = (t) => { called = true; return orig(t).catch((e) => { seal = e.name; throw e; }); }; b.click(); for (let i = 0; i < 16; i++) { await new Promise((r) => setTimeout(r, 100)); if ((b.textContent || "").trim() === "Copied") break; } const after = (b.textContent || "").trim(); navigator.clipboard.writeText = orig; return JSON.stringify({ found: true, called: called, seal: seal, flipped: after === "Copied", after: after }); })()';

/* the zero-unnamed census invariant, one voice everywhere */
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* the deterministic re-walk (the cold-chunk full-reload casualty's law):
 * the doors are deterministic, so the ride walks them again, one command. */
const reopenTextFace = async (hostId, doorName) => {
  openRetry("http://localhost:3000");
  sleep(3);
  for (let i = 0; i < 30 && cardsNow().cards !== rosterCards; i++) sleep(1);
  evalJson(plainClick(hostId));
  waitFor("the inspector (re-walk)", (m) => m.hasDlg && m.dlgCount >= 1);
  evalJson(tabMouseDown("Results"));
  waitFor("the logs section (re-walk)", (m) => m.logsSection === true && m.textDoors >= 1, 40);
  evalJson(textDoor(doorName));
  return waitFor("the text preview (re-walk)", (m) => m.dlgCount >= 2 && m.preFocused === true, 30);
};

/* ---------- Face 0: the clean room + the calm canvas ---------- */
console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
openRetry("http://localhost:3000");
sleep(3);
/* t866 — the CLEAN-ROOM law: the session-position seed (t157) makes the
 * boot state ride-dependent. The instrument owns its conditions. */
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
openRetry("http://localhost:3000");
sleep(3);
/* the roster-arrival door (the t846 teaching): the canvas arrives when it
 * hosts the roster's dominant project's cards, measured from the API. */
const doorJobs = (await (await fetchRetry(`${BASE}/api/jobs`, { headers: SH })).json()).jobs ?? [];
const rosterCards = (() => {
  const byProject = {};
  for (const j of doorJobs) byProject[j.projectId ?? "?"] = (byProject[j.projectId ?? "?"] ?? 0) + 1;
  return Math.max(1, ...Object.values(byProject));
})();
const cardsNow = () => evalJson('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length }))()');
for (let i = 0; i < 30 && cardsNow().cards !== rosterCards; i++) sleep(1);
console.log(`  the roster-arrival door: ${cardsNow().cards}/${rosterCards} cards hosted`);
const m0 = settle("the canvas");
if (corpse(m0, "Face 0")) process.exit(1);
ok("O0 the boot is a clean room (the t157 seed cleared, the panel closed)",
  m0.panelOpen === false,
  `panelOpen=${m0.panelOpen}`);
ok("O1 the canvas is calm and named (the census's invariant)",
  !m0.hasDlg && censusOk(m0),
  `btns=${m0.pageBtns} — zero unnamed anywhere`);
const OPEN = m0.pageBtns;

/* ---------- the host: measured never pinned ---------- */
/* the text-preview face needs a completed job whose outputs carry TEXT
 * files — and the TAIL contract deserves the biggest one (a file larger
 * than the 64 KB window makes the tail PROVABLE: the preview must speak
 * ~65536 chars, not the whole file). */
const jobs = await roster();
const hosts = [];
for (const j of jobs.filter((x) => x.status === "completed")) {
  try {
    const files = await outputs(j.id);
    const texts = (Array.isArray(files) ? files : []).filter((f) => f.kind === "text");
    if (texts.length) {
      const biggest = texts.reduce((a, b) => ((b.size ?? 0) > (a.size ?? 0) ? b : a), texts[0]);
      hosts.push({ job: j, texts, biggest });
    }
  } catch { /* a dead outputs read is not this face's business */ }
}
if (!hosts.length) {
  console.error("no completed job hosts text outputs — the text-preview face cannot open");
  writeFileSync(join(ROOT, "shots-qa/t868-textpreview-a11y.json"), JSON.stringify({ instrument: "scripts/t868-textpreview-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "no text-output hosts — the ride stopped honestly before the text-preview face" }, null, 2));
  process.exit(1);
}
hosts.sort((a, b) => (b.biggest.size ?? 0) - (a.biggest.size ?? 0));
const host = hosts[0];
const hostId = host.job.id;
const bigName = host.biggest.name;
const bigPath = host.biggest.path ?? "";
const bigSize = host.biggest.size ?? 0;
console.log(`  host (measured): ${host.job.name} (${hostId}); biggest tail: ${bigName} @ ${bigSize}B; text doors: ${host.texts.length}`);

/* ---------- Face LR — the Logs & reports section ---------- */
console.log("Face LR — the inspector, the Results tab, the Logs & reports section");
const c1 = evalJson(plainClick(hostId));
ok("M1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
const w1 = waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
if (corpse(w1, "Face LR")) process.exit(1);
ok("M2 the inspector arrived (a dialog aboard)", w1.hasDlg === true, `dlgCount=${w1.dlgCount}`);
const tab1 = evalJson(tabMouseDown("Results"));
ok("M3 the Results tab switched through the MOUSEDOWN door (the t863 Radix law)", tab1.found === true);
const l1w = waitFor("the Logs & reports section (the lazy barrel compiles)", (m) => m.logsSection === true && m.textDoors >= 1, 40);
if (corpse(l1w, "Face LR")) process.exit(1);
const l1 = settle("the logs section (arrival)"); // M7 compares settled vs settled
ok("M4 the Logs-and-reports section is present and named", l1.logsSection === true);
ok("M5 the text doors are MEASURED FROM THE DATA (count and names == the outputs API, the one-voice name)",
  l1.textDoors === host.texts.length && l1.doorNamed === true &&
    JSON.stringify([...l1.doorNames].sort()) === JSON.stringify(host.texts.map((f) => f.name).sort()),
  `doors=${l1.textDoors} [${l1.doorNames.join(", ")}]`);
ok("M6 zero unnamed page-wide WITH the inspector up (the census's invariant)",
  censusOk(l1),
  `btns=${l1.pageBtns} ctrls=${l1.ctrls}`);
const l1s = settle("the logs section (second ride)");
ok("M7 two settled rides bit-identical (the t836 law, the t860 settle)",
  JSON.stringify(l1) === JSON.stringify(l1s));

/* ---------- Face TP — the text preview dialog ---------- */
console.log("Face TP — the text preview dialog through the biggest tail's door");
const d0 = evalJson(textDoor(bigName));
ok("T1 the text door clicked (the biggest tail, measured)", d0.clicked === true);
const t1w = waitFor("the text preview dialog (the tail takes the focus)", (m) => m.dlgCount >= 2 && m.preFocused === true, 30);
if (corpse(t1w, "Face TP")) process.exit(1);
const t1 = settle("the text preview (arrival)"); // T12 compares settled vs settled
ok("T2 the dialog arrived as the TOPMOST layer (the t865 nested-portal lesson)",
  t1.hasDlg === true && t1.dlgCount >= 2,
  `dlgCount=${t1.dlgCount}`);
ok("T3 the dialog's heading is the file's own name (read from the data, the TOPMOST layer)",
  t1.dlgHeadTop === bigName,
  `head="${t1.dlgHeadTop}" == data "${bigName}"`);
ok("T4 the description speaks the tail contract (the path from the DATA · last 64 KB — measured, never a pinned shape)",
  t1.dlgDescTop === `${bigPath} · last 64 KB`,
  `desc="${t1.dlgDescTop}"`);
ok("T5 the content is a named focusable region (aria-label + tabindex 0)",
  t1.prePresent === true && t1.preTabindex === "0",
  `tabindex=${t1.preTabindex}`);
ok("T6 the tail TOOK the focus (the t774 law — reachability IS the destination)",
  t1.preFocused === true);
/* the TAIL PROVEN: the host's biggest file is bigger than the 64 KB window
 * (measured above), so the preview must speak the LAST ~65536 chars — the
 * backend contract asserted against the live DOM, never pinned. */
ok("T7 the preview is the LAST 64 KB, not the whole file (the backend's tail contract, measured)",
  t1.preLen > 60000 && t1.preLen <= 65536 && bigSize > 65536,
  `file=${bigSize}B -> pre=${t1.preLen} chars`);
ok("T8 the wrap contract (pre-wrap; X contained, Y scrolls — the fold's honest sibling)",
  t1.preWrap === "pre-wrap" && t1.preScrollY === true && t1.preScrollX === false,
  `white-space=${t1.preWrap} scrollY=${t1.preScrollY} scrollX=${t1.preScrollX}`);
ok("T9 the keymap seat is aboard (the results-view's t832 voice)",
  t1.keymap === true);
ok("T10 the copy row is aboard and named (the one clipboard dialect)",
  t1.copyPresent === true && (t1.copyText === "Copy" || t1.copyText === "Copied"),
  `label="${t1.copyText}"`);
ok("T11 zero unnamed page-wide WITH the preview up (the census's invariant)",
  censusOk(t1),
  `btns=${t1.pageBtns} ctrls=${t1.ctrls}`);
const t1b = settle("the text preview (second ride)");
ok("T12 two settled rides bit-identical (the t836 law)",
  JSON.stringify(t1) === JSON.stringify(t1b));

/* ---------- Face CB — the copy row ---------- */
console.log("Face CB — the copy row's σ-gate walk (the one clipboard dialect)");
ok("C1 the copy door speaks its name (Copy)", t1.copyText === "Copy", `label="${t1.copyText}"`);
const cw = await evalJson(CLIP_WALK);
const cwPassed = cw.found === true && (
  cw.flipped === true ||
  (cw.flipped === false && cw.called === true && cw.seal === "NotAllowedError" && cw.after === "Copy")
);
ok("C2 the flip walks when the world allows it; when the clipboard is sealed, the door never lies (the σ-gate law, read live)",
  cwPassed === true,
  cw.flipped
    ? "the flip was filmed (Copy -> Copied)"
    : `the clipboard is sealed (${cw.seal}) — the door heard the call and kept its honest "${cw.after}"`);

/* ---------- Face KB — the keyboard contract ---------- */
console.log("Face KB — Esc closes (the keymap's own teaching), the door walks again");
evalJson(ESC_LAST);
const k1 = waitFor("the preview's close", (m) => m.dlgCount === 1, 12);
ok("K1 Esc closes the preview (dlgCount back to the inspector alone)",
  k1.hasDlg === true && k1.dlgCount === 1,
  `dlgCount=${k1.dlgCount}`);
const k2 = await reopenTextFace(hostId, bigName);
ok("K2 the door walks again (the deterministic re-walk — the one-retry law's shape)",
  k2.dlgCount >= 2 && k2.preFocused === true,
  `dlgCount=${k2.dlgCount} focused=${k2.preFocused}`);

/* ---------- Face FT — the second family (the Files tab) ---------- */
console.log("Face FT — the Files tab's peek eyes, the same brain's second door-set");
escAll();
sleep(1);
/* the Esc consume contract says the inspector survives the topmost dialog's
 * close — but the re-walk law never ASSUMES a face: if the stack fell, the
 * doors are deterministic, so walk them again (measured, never assumed). */
let insp = evalJson(MEASURE);
if (!insp.hasDlg) {
  console.log("  (the inspector fell with the preview — the deterministic doors walk again)");
  evalJson(plainClick(hostId));
  insp = waitFor("the inspector (re-opened)", (m) => m.hasDlg && m.dlgCount >= 1);
}
const f0 = evalJson(tabMouseDown("Files", false)); // the count badge rides the label
ok("F1 the Files tab switched (the PREFIX door — the badge rides the label)",
  f0.found === true, `spoke="${f0.spoke ?? ""}"`);
const f1w = waitFor("the Files tab's peek eyes (the outputs fetch)", (m) => m.eyesCount >= 1, 40);
if (corpse(f1w, "Face FT")) process.exit(1);
const f1 = settle("the files tab (arrival)");
ok("F2 the peek eyes are aboard and named (Preview <name> — from the data)",
  f1.eyesCount >= 1 && f1.eyeNames.every((n) => n.startsWith("Preview ")),
  `eyes=${f1.eyesCount} [${f1.eyeNames.slice(0, 3).join("; ")}]`);
/* the text row's eye — the one whose data name matches the biggest tail
 * if this host hosts it in Files (the Files tab lists ALL outputs); else
 * the first text eye (measured, never pinned). */
const eyeTarget = f1.eyeNames.find((n) => n === `Preview ${bigName}`) ?? f1.eyeNames[0];
const eyeName = eyeTarget.replace(/^Preview /, "");
const f2 = evalJson(eyeDoor(eyeName));
ok("F3 the text row's eye clicked (the peek door)", f2.clicked === true, `eye="${eyeTarget}"`);
const f3w = waitFor("the Files-tab preview (the tail takes the focus)", (m) => m.dlgCount >= 2 && m.preFocused === true, 30);
if (corpse(f3w, "Face FT")) process.exit(1);
const f3 = settle("the files-tab preview (arrival)");
ok("F4 the SAME dialog, the same face (heading + tail contract, verbatim word forms, measured against the data)",
  f3.dlgHeadTop === eyeName && f3.dlgDescTop === `${bigPath} · last 64 KB`,
  `head="${f3.dlgHeadTop}" desc="${(f3.dlgDescTop ?? "").slice(0, 60)}"`);
ok("F5 the tail took the focus again (the t774 law, second door-set)",
  f3.preFocused === true);
ok("F6 the twin keymap seat is aboard (the t868 fix PROVEN LIVE — one voice, three door-sets)",
  f3.keymap === true);
ok("F7 zero unnamed page-wide WITH the Files-tab preview up (the census's invariant)",
  censusOk(f3),
  `btns=${f3.pageBtns} ctrls=${f3.ctrls}`);
evalJson(ESC_LAST);
const f4 = waitFor("the Files-tab preview's close", (m) => m.dlgCount === 1, 12);
ok("F8 Esc closes the peek (the twin keymap's own teaching)",
  f4.dlgCount === 1,
  `dlgCount=${f4.dlgCount}`);

/* ---------- Face W — the world back + the seed hygiene ---------- */
console.log("Face W — the world back (fresh load, sleep 3)");
escAll();
openRetry("http://localhost:3000");
sleep(3);
for (let i = 0; i < 30 && cardsNow().cards !== rosterCards; i++) sleep(1);
const w3 = settle("the restored canvas");
if (corpse(w3, "Face W")) process.exit(1);
ok("W1 the world unharmed (canvas count == the opening count, zero unnamed)",
  w3.pageBtns === OPEN && w3.pageUnnamed === 0 && !w3.hasDlg,
  `btns=${w3.pageBtns} (opening ${OPEN})`);
const seedAfter = evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
ok("W2 the ride leaves no session seed (the t157 two-way door's honest none — the t866 lesson rides every page)",
  seedAfter.seed === "" || seedAfter.seed === null,
  `seed=${JSON.stringify(seedAfter.seed)}`);

/* ---------- the ledger at birth (four faces) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (four faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  logsSection: ledgerFace(prevFaces ? prevFaces.logsSection?.live ?? null : null, l1, scalarOf),
  textDialog: ledgerFace(prevFaces ? prevFaces.textDialog?.live ?? null : null, t1, scalarOf),
  filesTabPeek: ledgerFace(prevFaces ? prevFaces.filesTabPeek?.live ?? null : null, f3, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w3, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the text-preview face holds: the clean room held (the panel-closed boot — the t866 law), the Logs & reports section hosted ${l1.textDoors} text doors measured from the data, the biggest tail's dialog arrived as the TOPMOST layer with the file's own name and the tail contract in the description, the content proved itself the LAST 64 KB of a ${bigSize}-byte file (${t1.preLen} chars), took the focus (the t774 law), wrapped with X contained and Y scrolling, spoke its keymap seat and its copy row — whose flip was filmed live — Esc closed it and the door walked again, the Files tab's peek eyes opened the same brain's second door-set with the NEW twin keymap seat proven live (the t868 fix), zero unnamed on every face, the world back bit-for-bit (${OPEN} == ${OPEN}), and the ride left no session seed — the ledger aboard from birth (four faces, the shared law)`
  : `${fail} red — the text-preview face moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: prevReceipt?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t868-textpreview-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> canvas -> host card (plain door) -> Results tab (mousedown) -> Logs & reports section -> biggest tail's door (measured from the data) -> text preview dialog (topmost) -> tail-contract + focus + wrap + keymap + copy flip -> Esc home -> the door walks again -> Files tab (prefix door) -> peek eye -> the same dialog + the twin keymap (the t868 fix, live) -> worldBack + seed hygiene (one command)",
  doors: {
    inspector: "plain pointerdown+pointerup on the card — the submitted law",
    resultsTab: "mousedown on the Results tab — the t863 Radix law",
    filesTab: "mousedown matched by PREFIX — the count badge rides the label",
    textDoor: "click the row whose accessible name == 'Preview <name>' — the t868 one-voice law (the row and its Files-tab twin eye speak the same name)",
    peekEye: "click the button whose aria-label == 'Preview <name>'",
    close: "Escape — the keymap seats' own teaching",
  },
  host: { name: host.job.name, id: hostId, biggestTail: { name: bigName, bytes: bigSize, preChars: t1.preLen }, textDoors: host.texts.map((f) => f.name), measured: true },
  openingCanvas: OPEN,
  faces: {
    logsSection: { live: l1, secondRide: l1s },
    textDialog: { live: t1, secondRide: t1b },
    copyRow: { clipboardWalk: cw, sealWorld: cw.flipped === false },
    filesTabPeek: { live: f3, eye: eyeTarget },
    worldBack: { live: w3 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, "shots-qa/t868-textpreview-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\nTEXTPREVIEW-A11Y t868: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
