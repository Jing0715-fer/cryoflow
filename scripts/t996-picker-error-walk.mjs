#!/usr/bin/env node
/**
 * t996 — the PICKER'S FETCH-ERROR FACE WALK (the t994 entry's candidate
 * ②, carried through t995; the t996 entry's candidate ①):
 *
 * The rounds picker (t398's popover — the alertdialog plane's sibling)
 * has carried a phase-level fetch-error face since birth: the server's
 * own reason in the message, the "could not read the rounds" fallback,
 * and the "Try again" affordance whose click IS the ?refresh=1 lane
 * (the 8s TTL bypassed by construction). No walk had ever witnessed it
 * live — the transport has never died under the popover in the whole
 * family's history. This window kills the transport under the open
 * popover and watches the face keep its promises:
 *
 *   leg 2   the happy face: the palette's ENTER mouth lands the edit
 *           panel of the standing face "Rounds Face (t989)" (idle), the
 *           Rounds trigger opens the picker, the READY face holds — no
 *           loading, no error, no Try again — and the refresh affordance
 *           sits in its header (the ?refresh=1 lane, load(true));
 *   leg 3   THE TRANSPORT DIES: the dev server is SIGTERMed under the
 *           OPEN popover (the walk asserts zero non-terminal jobs at the
 *           kill's door — no sim can be orphaned), the refresh button is
 *           real-clicked IN PLACE (load(true), the TTL bypassed), and
 *           the FETCH-ERROR FACE BLOOMS: the destructive message (the
 *           transport's own words), the Try again affordance present;
 *           Try again under the outage refuses honestly (the error face
 *           returns); the popover NEVER closed — the in-place contract;
 *   leg 4   THE RESURRECTION: the server is re-spawned byte-identically
 *           (same env pin, same cwd, same flags — the world's own
 *           process restored), the shell answers 200 again, and the SAME
 *           Try again click lands the READY face — the affordance
 *           recovers the picker in place, no reopen, no reload;
 *   leg 5   world honesty: the popover closes by its own Escape, the
 *           edit panel closes, the fingerprint as-found = as-left (the
 *           walk minted nothing — the face was already in the world),
 *           the server stands at 200 at the shell.
 *
 * RIDE LAWS inherited: WIDE-FIRST; the palette's ENTER mouth; the
 * FOCUS GATE; the CONDITIONAL Escape; the companion closes through
 * [aria-label="关闭 AI 助手"] + a shut poll; the popover is
 * [aria-label="Rounds you can continue from"]; fresh `agent-browser
 * open` before the rider; poll-then-probe everywhere (the phase trace
 * rides the receipt); the t992 birth law (c) — this walk mints NO job,
 * so every standing population count stays true without a re-key.
 *
 * THE T996 BIRTH LAWS (paid by the first ride's reds, preserved by the
 * t991 law — the receipt t996-picker-error-walk-red1.json keeps them):
 *   BL1  THE API-BODY LAW RE-PROVEN: a bare `curl /api/jobs` (no Origin
 *        envelope) answers the http-guard's 403 and the reader reads
 *        rows=0 — the world-read rides the kit's api() (the t989 law,
 *        the harness's own pants never lie twice);
 *   BL2  THE PANEL'S TAB DOOR: the edit panel is the border-l aside and
 *        its picker lives behind the PARAMS tab — an idle face's
 *        as-found latch is I/O, the tab answers only a REAL pointer
 *        event (el.click() is a no-op on the Radix tab), so the walk
 *        opens the panel's own Params door before reaching for the
 *        Rounds trigger (the tab latch as-found ≠ the tab latch as-left
 *        — session state, not world state, the fingerprint unaffected);
 *   BL3  THE PGREP SELF-MATCH: `pgrep -f "next dev -p 3000"` matches
 *        the asking sh -c's own cmdline — the [v] character class
 *        breaks the self-match (the kill list is the server's pids
 *        only).
 *
 *   node scripts/t996-picker-error-walk.mjs
 */
import net from "node:net";
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, pollTraced, realClick,
  shot, api, readJobs, jobsArr, fingerprint, serverFirst, finish, phaseTrace,
} = createWalk({ name: "t996-picker-error-walk", receiptFile: "t996-picker-error-walk.json" });

const FACE_NAME = "Rounds Face (t989)";
const POPOVER_SEL = `[aria-label="Rounds you can continue from"]`;
const TRIGGER_SEL = `button[aria-label="Pick which previous round to continue from"]`;
const REFRESH_SEL = `button[aria-label="Re-read the rounds from the engine and the cluster"]`;

/* the popover-scoped readers — every face read is scoped to the picker's
 * own plane (the family's scoping law: never a page-wide guess) */
const popState = `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p || p.getBoundingClientRect().width === 0) return JSON.stringify({ up: false }); const btn = [...p.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Try again'); const err = [...p.querySelectorAll('p')].find((x) => (x.className ?? '').includes('text-destructive')); const loading = (p.textContent ?? '').includes('Reading checkpoints'); const refresh = !!p.querySelector(${JSON.stringify(REFRESH_SEL)}); return JSON.stringify({ up: true, tryAgain: !!btn, msg: err ? (err.textContent ?? '').trim() : null, loading, refresh }); })()`;

const mockOpen = () => new Promise((res) => {
  const s = net.connect(3022, "127.0.0.1");
  s.on("connect", () => { s.end(); res(true); });
  s.on("error", () => res(false));
  setTimeout(() => { s.destroy(); res(false); }, 4000);
});

/* BL2's executable form — the panel's Params door, shared by leg 2 and
 * leg 4's remount fallback (the tab latch resets to the smart default
 * on a remount — the t994 law — so the fallback re-opens the door). */
const openParamsDoor = async () => {
  const panelUp = await poll(`(() => { const ed = (${panelOf}); return JSON.stringify({ up: !!ed && ed.getBoundingClientRect().width > 0 }); })()`, (v) => v.up, 12, 500);
  const tabClick = await realClick(`(() => { const ed = (${panelOf}); if (!ed) return null; return [...ed.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Params') ?? null; })()`);
  const tabActive = await poll(`(() => { const ed = (${panelOf}); if (!ed) return JSON.stringify({ act: false }); const tab = [...ed.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Params'); return JSON.stringify({ act: tab?.getAttribute('data-state') === 'active' }); })()`, (v) => v.act, 10, 500);
  return { panelUp: !!panelUp && panelUp.up, tabClick: String(tabClick).startsWith("clicked@"), tabActive: !!tabActive && tabActive.act, tabClickRaw: String(tabClick) };
};

const TERM = new Set(["completed", "failed", "cancelled", "idle"]);
const worldRead = async (tag) => {
  let body = null;
  for (let attempt = 0; attempt < 3 && !body; attempt++) {
    if (attempt > 0) await sleep(4000);
    try { body = JSON.parse(api("GET", "/api/jobs")); } catch { body = null; }
    if (body && typeof body === "object") { const a = Array.isArray(body) ? body : body.jobs ?? []; if (a.length === 0) body = null; }
  }
  const arr = Array.isArray(body) ? body : body?.jobs ?? [];
  return { arr, fp: fingerprint(arr) };
};

console.log("=== t996 picker fetch-error walk ===");

/* LEG 0 — the shell bed rolls: the mock's door, the world's shape, the
 * kill's precondition (zero non-terminal jobs — no sim can be orphaned) */
console.log("leg 0: the shell bed rolls");
const mock = await mockOpen();
ok("the mock cluster's door is open (:3022 TCP)", mock);
serverFirst();
const asFound = await worldRead("as-found");
ok("the world carries TWENTY-TWO jobs (the standing fleet restored (the t1003 restoration — 15 demo + seven standing faces))", asFound.arr.length === 22, `rows=${asFound.arr.length}`);
const live = asFound.arr.filter((j) => !TERM.has(j.status));
ok("ZERO non-terminal jobs (the kill orphans nothing)",
  live.length === 0, live.map((j) => `${j.name}:${j.status}`).join(","));

/* LEG 1 — the wide-first law */
console.log("leg 1: the wide-first opening");
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
const alive = await poll(`(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`, (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);
const shut = await poll(
  `(() => { const b = document.querySelector('[aria-label="关闭 AI 助手"]'); if (!b) return JSON.stringify({ shut: true }); const r = b.getBoundingClientRect(); return JSON.stringify({ shut: r.width === 0 }); })()`,
  (x) => x.shut, 4, 400);
ok("the companion is shut (the ride plane is clear)", !!shut && shut.shut);

/* LEG 2 — the happy face: palette ENTER mouth → the edit panel → the
 * Rounds trigger → the READY face (no loading, no error, no Try again) */
console.log("leg 2: the happy face (ready, refresh in the header)");
sh(`${AB} press Control+K`);
await sleep(700);
await poll(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`, (v) => v.up, 10, 400);
evalJs(`(() => { const i = document.querySelector('[cmdk-input]'); if (i) i.focus(); return 'f'; })()`);
sh(`${AB} keyboard type "Rounds Face"`);
const row = await poll(
  `(() => { const items = [...document.querySelectorAll('[cmdk-item]')]; const hit = items.find((it) => (it.textContent ?? '').includes('Rounds Face')); return JSON.stringify({ found: !!hit }); })()`,
  (v) => v.found, 12, 400);
ok("the palette's Jobs group answers the face's name", !!row && row.found);
let jumpLanded = false;
for (let attempt = 1; attempt <= 3 && !jumpLanded; attempt++) {
  sh(`${AB} press Enter`);
  const landed = await poll(
    `(() => { const name = document.querySelector('input[aria-label="Job name"]'); return JSON.stringify({ shut: !document.querySelector('[cmdk-input]'), hosted: !!name && name.value === ${JSON.stringify(FACE_NAME)} }); })()`,
    (v) => v.shut && v.hosted, 10, 500);
  if ((jumpLanded = !!landed)) break;
  const pal = evalJson(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`);
  if (pal?.up) { sh(`${AB} press Escape`); await sleep(500); sh(`${AB} press Control+K`); await sleep(700); await poll(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`, (v) => v.up, 10, 400); evalJs(`(() => { const i = document.querySelector('[cmdk-input]'); if (i) i.focus(); return 'f'; })()`); sh(`${AB} keyboard type "Rounds Face"`); await sleep(800); }
}
ok("the jump landed — the edit panel hosts the face", jumpLanded);
/* BL2 — the panel's TAB DOOR: the picker lives behind the Params tab;
 * an idle face's as-found latch is I/O and the tab answers only a real
 * pointer event (el.click() is a no-op on the Radix tab). */
const panelOf = `(() => { const eds = [...document.querySelectorAll('aside')].filter((a) => (a.className ?? '').includes('border-l') && [...a.querySelectorAll('input[aria-label="Job name"]')].some((i) => i.value === ${JSON.stringify(FACE_NAME)})); return eds[0] ?? null; })()`;
const door2 = await openParamsDoor();
ok("the edit panel is on screen (the border-l aside, width > 0)", door2.panelUp);
ok("the Params tab opened through the real pointer path (the panel's own door)", door2.tabClick, door2.tabClickRaw);
ok("the Params tab is the active face (data-state speaks)", door2.tabActive);
const headerBadge = `(() => { const name = document.querySelector('input[aria-label="Job name"]'); if (!name || name.value !== ${JSON.stringify(FACE_NAME)}) return JSON.stringify({ word: null, panel: false }); const header = name.closest('div[class*="border-b"]'); const badge = header ? [...header.querySelectorAll('span')].find((sp) => sp.textContent.trim().toLowerCase() === 'idle' && (sp.className ?? '').includes('rounded-full')) : null; return JSON.stringify({ word: badge ? badge.textContent.trim().toLowerCase() : null, panel: true }); })()`;
const badgeIdle = await poll(headerBadge, (v) => v.panel && v.word === "idle", 10, 500);
ok("the panel's badge says idle (the header-scoped read)", !!badgeIdle && badgeIdle.panel && badgeIdle.word === "idle");
const trigClick = await realClick(`[...document.querySelectorAll(${JSON.stringify(TRIGGER_SEL)})].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the Rounds trigger clicked through the real mouse path", String(trigClick).startsWith("clicked@"), String(trigClick));
const happy = await pollTraced(popState, (v) => v.up && !v.loading && !v.tryAgain && !v.msg, 24, 500, "ready");
ok("THE READY FACE HOLDS (no loading, no error, no Try again)", !!happy && happy.up && !happy.tryAgain, JSON.stringify(happy));
ok("the refresh affordance sits in the ready header (the load(true) lane)", !!happy && happy.refresh === true);

/* LEG 3 — THE TRANSPORT DIES under the open popover */
console.log("leg 3: the kill + the fetch-error face");
const atKill = await worldRead("at-kill");
ok("ZERO non-terminal jobs re-asserted at the kill's door",
  atKill.arr.filter((j) => !TERM.has(j.status)).length === 0, `rows=${atKill.arr.length}`);
const pids = sh(`pgrep -f "next de[v] -p 3000"; pgrep -f "next-serve[r]"`).split("\n").map((x) => x.trim()).filter((x) => /^\d+$/.test(x));
ok("the dev server's processes found (parent + next-server)", pids.length >= 1, pids.join(","));
if (pids.length >= 1) sh(`kill -TERM ${pids.join(" ")} 2>/dev/null; true`);
let down = false;
for (let i = 0; i < 24 && !down; i++) {
  const code = sh(`curl -s -o /dev/null -w '%{http_code}' --max-time 2 ${BASE}/`).trim();
  down = code === "000";
  if (!down) await sleep(500);
}
if (!down) { sh(`kill -KILL ${pids.join(" ")} 2>/dev/null; true`); await sleep(1500); down = sh(`curl -s -o /dev/null -w '%{http_code}' --max-time 2 ${BASE}/`).trim() === "000"; }
ok("THE TRANSPORT IS DEAD (:3000 answers 000)", down);
const rfClick = await realClick(`(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return null; return p.querySelector(${JSON.stringify(REFRESH_SEL)}); })()`);
ok("the refresh clicked IN PLACE (the popover never closed)", String(rfClick).startsWith("clicked@"), String(rfClick));
const errFace = await pollTraced(popState, (v) => v.up && v.tryAgain && !!v.msg, 24, 500, "error");
ok("THE FETCH-ERROR FACE BLOOMS (Try again present, the destructive message speaks)",
  !!errFace && errFace.up && errFace.tryAgain === true && !!errFace.msg, `msg=${JSON.stringify(errFace?.msg)}`);
ok("the message is the transport's own words (non-empty, no server reason to borrow)",
  !!errFace && !!errFace.msg && errFace.msg.length > 0, `len=${errFace?.msg?.length}`);
shot("t996-picker-error.png");
const taClick = await realClick(`(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return null; return [...p.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Try again'); })()`);
ok("Try again clicked under the outage (the affordance takes the hit)", String(taClick).startsWith("clicked@"), String(taClick));
const refused = await pollTraced(popState, (v) => v.up && v.tryAgain && !!v.msg, 24, 500, "refused");
ok("THE OUTAGE REFUSAL IS HONEST (the error face returns, Try again still stands)",
  !!refused && refused.up && refused.tryAgain === true && !!refused.msg, `msg=${JSON.stringify(refused?.msg)}`);
shot("t996-tryagain-refused.png");

/* LEG 4 — THE RESURRECTION (byte-identical re-spawn, same env pin) and
 * the recovery through whichever honest door the app's own remount
 * leaves open: the in-place race (Try again survives the outage and
 * recovers the face where it stands) or the remount branch (the t994
 * law — a pollTick refetch remounts the panel and strips the popover;
 * the walk witnesses the death, re-opens the panel's Params door, and
 * the fresh load lands ready; the refresh lane then holds). Both
 * branches are fully asserted; the receipt names the path taken. */
console.log("leg 4: the resurrection + the affordance's recovery");
sh(`DATABASE_URL="file:/home/z/my-project/db/cryoflow.db" nohup node node_modules/next/dist/bin/next dev -p 3000 >> /home/z/my-project/scripts/.t996-server.log 2>&1 &`);
let upAgain = false;
for (let i = 0; i < 240 && !upAgain; i++) {
  const code = sh(`curl -s -o /dev/null -w '%{http_code}' --max-time 3 ${BASE}/`).trim();
  if ((upAgain = code === "200")) break;
  if (i % 10 === 0) phaseTrace.push(`respawn i${i}: ${code}`);
  await sleep(500);
}
ok("THE SERVER ANSWERS 200 AGAIN (the world's process restored)", upAgain);
/* the fast race: the app's pollTick refetch (8s cadence) may remount
 * the panel and strip the popover — the walk polls Try again at 300ms
 * and clicks the moment it stands */
let recoveryPath = null;
let ta2 = null;
for (let i = 0; i < 20 && !ta2; i++) {
  const v = evalJson(popState);
  if (v && v.up && v.tryAgain) { ta2 = await realClick(`(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return null; return [...p.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Try again'); })()`); break; }
  if (v && !v.up) break;
  await sleep(300);
}
if (ta2 && String(ta2).startsWith("clicked@")) {
  recoveryPath = "in-place";
  ok("THE SAME TRY AGAIN CLICKED AFTER THE RESURRECTION (the in-place race won — the affordance never left)", true, String(ta2));
  const recovered = await pollTraced(popState, (v) => v.up && !v.tryAgain && !v.msg && !v.loading, 60, 2000, "recovered");
  ok("THE READY FACE RETURNS THROUGH THE AFFORDANCE (no reopen, no reload)",
    !!recovered && recovered.up && !recovered.tryAgain && !recovered.msg, JSON.stringify(recovered));
} else {
  recoveryPath = "remount-reopen";
  const stripped = await poll(popState, (v) => v && v.up === false, 8, 400);
  ok("THE REMOUNT LAW RODE THE RECOVERY (the pollTick refetch stripped the popover — the t994 face, witnessed)",
    !!stripped && stripped.up === false);
  const door4 = await openParamsDoor();
  ok("the panel's Params door re-opened (the tab latch reset to the smart default)",
    door4.panelUp && door4.tabClick && door4.tabActive, door4.tabClickRaw);
  const reTrig = await realClick(`[...document.querySelectorAll(${JSON.stringify(TRIGGER_SEL)})].find((b) => b.getBoundingClientRect().width > 0)`);
  ok("the picker re-opened through its own trigger (the honest re-entry)", String(reTrig).startsWith("clicked@"), String(reTrig));
  const reReady = await pollTraced(popState, (v) => v.up && !v.tryAgain && !v.msg && !v.loading, 60, 2000, "reopened-ready");
  ok("THE FRESH LOAD LANDS READY (the transport's recovery through the picker's own door)",
    !!reReady && reReady.up && !reReady.tryAgain && !reReady.msg, JSON.stringify(reReady));
  const rf2 = await realClick(`(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return null; return p.querySelector(${JSON.stringify(REFRESH_SEL)}); })()`);
  ok("the refresh lane holds with the transport alive (load(true) answers)", String(rf2).startsWith("clicked@"), String(rf2));
  const rfReady = await pollTraced(popState, (v) => v.up && !v.tryAgain && !v.msg && !v.loading, 40, 1500, "refresh-held");
  ok("the ready face holds after the refresh (the lane's second witness)",
    !!rfReady && rfReady.up && !rfReady.tryAgain && !rfReady.msg, JSON.stringify(rfReady));
}
shot("t996-tryagain-recovered.png");

/* LEG 5 — world honesty: the own-door closes, the fingerprint holds */
console.log("leg 5: the own-door closes + the world's honesty");
sh(`${AB} press Escape`);
await sleep(600);
const popGone = await poll(`(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); return JSON.stringify({ gone: !p || p.getBoundingClientRect().width === 0 }); })()`, (v) => v.gone, 8, 400);
ok("the popover closed by its own Escape (the Radix layer's honest door)", !!popGone && popGone.gone);
sh(`${AB} press Escape`);
await sleep(600);
const dlgGone = await poll(`(() => { const d = document.querySelector('[data-slot="dialog-content"]'); return JSON.stringify({ gone: !d || d.getBoundingClientRect().width === 0 }); })()`, (v) => v.gone, 8, 400);
ok("the edit panel closed (the dialog's own door)", !!dlgGone && dlgGone.gone);
const asLeft = await worldRead("as-left");
ok("the world carries TWENTY-TWO jobs as-left (nothing minted)", asLeft.arr.length === 22, `rows=${asLeft.arr.length}`);
ok("THE FINGERPRINT AS-FOUND = AS-LEFT (byte-identical)", asFound.fp === asLeft.fp);
const closeCode = sh(`curl -s -o /dev/null -w '%{http_code}' --max-time 5 ${BASE}/`).trim();
ok("the server stands at 200 at the shell (the close gate)", closeCode === "200", `code=${closeCode}`);

finish({
  face: FACE_NAME,
  transportMsg: refused?.msg ?? null,
  recoveryPath,
  asFound: asFound.fp,
  asLeft: asLeft.fp,
});
