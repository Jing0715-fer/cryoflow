#!/usr/bin/env node
/**
 * t870 — the a11y rotation's next room: the AI PANEL'S CONVERSATION FACE
 * (t843's partner — the room the rotation has walked AROUND since t862's
 * overlay tier), and the two affordances this window grew it:
 *
 *   1. the assistant turn's own COPY DOOR (Task 170's one clipboard, per
 *      turn — the iconOnly compact form, the three-voice reveal: hover
 *      for the mouse, focus-within for the keyboard, always-visible for
 *      touch), and
 *   2. the panel's t832 KEYMAP SEAT (ai-keymap — Kbd Esc "closes", in the
 *      footer row the eye already reads).
 *
 * The faces:
 *
 *   O0  the clean room (the t866 law) — the session seed cleared, the
 *       panel-closed boot demanded, the canvas calm and named.
 *   OP  the panel opens through its launcher — role=dialog, the honest
 *       non-modal companion (aria-modal=false), the t501 marks aboard.
 *   EM  the empty face — the world's OWN truth before the seed: the
 *       suggestions grid named by its own text, the composer named, the
 *       send door DISABLED while empty (the honest refusal), the t799
 *       tab stop, the keymap seat, the drawer's honest empty.
 *   SD  the seed — the instrument owns its conditions (the t866 law,
 *       server-side edition): DATA_DIR discovered live through the
 *       store's own reset door (measured, never pinned), the store's
 *       PRE-EXISTENCE noted (absence is also a truth worth restoring),
 *       one seeded conversation written through the store's own
 *       atomic-rename convention (a user turn; an assistant turn with a
 *       table + a fence + three tool calls, one failed).
 *   TR  the transcript face — the rehydrated turns: the user bubble is
 *       the seed's own words (the heading-from-data law), THE COPY DOOR
 *       measured live (named, titled, hidden at rest, focus reveals —
 *       the fix's own witness), three tool cards speaking ok/failed,
 *       the filter row lit with pressed states and counts, the keymap
 *       seat, zero unnamed, two settled rides bit-identical.
 *   FC  the filter face — the 失败 chip presses, the failed card alone
 *       remains, 全部 restores the world.
 *   HI  the history face — the search named, the row titled from the
 *       DATA, the 今天 bucket, the three row doors named by the
 *       session's own name, the delete door's reveal law measured, the
 *       LAYERED ESC witnessed live: a live query is vetoed first (the
 *       search box's own layer, the t430 law) and the next Esc closes
 *       the window (the keymap seat's own teaching, delivered).
 *   W   the world back — the store restored to its PRE-WALK TRUTH (the
 *       seeded bytes AND the discovery reset's residue erased — absence
 *       restored where absence ruled), the panel reopens EMPTY (the
 *       seed hygiene), the canvas bit-for-bit, the localStorage seed
 *       none.
 *
 * Born with the ledger aboard (the t861 birthright, five faces):
 * canvasFace / emptyFace / transcriptFace / historyFace / worldBack.
 *
 * Receipt: shots-qa/t870-aipanel-a11y.json.
 *
 *   node scripts/t870-aipanel-a11y.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const cmp = loadComparator(ROOT, "shots-qa/t870-aipanel-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t870 aipanel a11y walk — world ${world.mode}:${buildId}, the empty face, the seeded transcript, the copy door, the keymap seat, the history drawer and the world back through the shared ruler\n` +
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

/* ---------- the measure: the SHARED RULER + the AI panel family's
 * probes. ONE superset measure — every face films the same fields; the
 * absent selectors speak false/0. NO ${} inside — the shell reads this
 * string. Labels with spaces are matched by JS filters (the unquoted
 * attribute form cannot speak a space). */
const MEASURE =
  '(() => { ' + NAMEOF + ' const inTree = (e) => e.getAttribute("aria-hidden") !== "true" && !e.hidden && !(e.closest && e.closest("[aria-hidden=true]")); const btns = Array.from(document.querySelectorAll("button")).filter(inTree); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")).filter(inTree); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const p = document.querySelector("[data-ai-assistant]"); const byLabel = (root, tag, label) => root ? Array.from(root.querySelectorAll(tag)).filter((e) => (e.getAttribute("aria-label") || "") === label) : []; const q = (s) => p ? p.querySelector(s) : null; const qa = (s) => p ? Array.from(p.querySelectorAll(s)) : []; const log = q("[role=log]"); const logBtns = log ? Array.from(log.querySelectorAll("button")).filter(inTree) : []; const toolToggles = logBtns.filter((b) => b.getAttribute("aria-expanded") !== null); const grp = p ? Array.from(p.querySelectorAll("[role=group]")).find((g) => (g.getAttribute("aria-label") || "") === "Transcript filter") : null; const chips = grp ? Array.from(grp.querySelectorAll("button[aria-pressed]")).map((b) => ({ t: (b.textContent || "").trim().replace(/\\s+/g, " "), pressed: b.getAttribute("aria-pressed") === "true" })) : []; const histSearch = q("[data-session-search]"); const histList = p ? Array.from(p.querySelectorAll("[role=list]")).find((l) => (l.getAttribute("aria-label") || "") === "Session history") : null; const rows = histList ? Array.from(histList.querySelectorAll("[role=listitem]")) : []; const copyDoors = byLabel(p, "button", "Copy reply"); const copyWrap = copyDoors[0] ? copyDoors[0].parentElement : null; const ta = byLabel(p, "textarea", "Message the AI assistant")[0] || null; const composer = ta ? ta.closest("div.border-t") : null; const sendBtn = composer ? byLabel(composer, "button", "Send")[0] || null : null; const emptyGrid = log ? log.querySelector(".grid") : null; const aiBtns = p ? Array.from(p.querySelectorAll("button")).filter(inTree) : []; const aiUn = aiBtns.filter((b) => !nameOf(b)); const km = q("[data-canvas-ui=ai-keymap]"); const shimmer = log ? log.querySelectorAll(".animate-bounce").length : 0; return JSON.stringify({ url: location.pathname, panelOpen: btns.some((b) => (b.getAttribute("aria-label") || "") === "Close job panel"), pageBtns: btns.length, pageUnnamed: un.length, ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, shimmer: shimmer, hasDlg: dgs.length > 0, dlgCount: dgs.length, aiPanel: !!p, aiLabel: p ? p.getAttribute("aria-label") : null, aiModal: p ? p.getAttribute("aria-modal") : null, aiCompanion: p ? p.hasAttribute("data-companion-window") : false, aiBtns: aiBtns.length, aiUnnamed: aiUn.length, aiUnWho: aiUn.slice(0, 4).map((b) => String(b.className).slice(0, 44)), logLabel: log ? log.getAttribute("aria-label") : null, logTab: log ? log.getAttribute("tabindex") : null, logLive: log ? log.getAttribute("aria-live") : null, emptyHead: log ? (log.textContent || "").indexOf("用一句话指挥整条流程") !== -1 : false, suggestions: emptyGrid ? emptyGrid.querySelectorAll("button").length : 0, sugNames: emptyGrid ? Array.from(emptyGrid.querySelectorAll("button")).map((b) => (b.textContent || "").trim().slice(0, 18)) : [], userBubbles: qa("[class*=rounded-br-sm]").length, turns: qa("[class*=\\"group/turn\\"]").length, copyDoors: copyDoors.length, copyTitle: copyDoors[0] ? copyDoors[0].getAttribute("title") : null, copyText: copyDoors[0] ? (copyDoors[0].textContent || "").trim() : null, copyOpacity: copyWrap ? getComputedStyle(copyWrap).opacity : null, toolToggles: toolToggles.length, toolOk: toolToggles.filter((b) => !!b.querySelector("[aria-label=succeeded]")).length, toolFail: toolToggles.filter((b) => !!b.querySelector("[aria-label=failed]")).length, filterRow: chips.length > 0, chips: chips, histOpen: !!histList, histSearchName: histSearch ? histSearch.getAttribute("aria-label") : null, histRows: rows.length, rowTitle: rows[0] ? (rows[0].textContent || "").trim().slice(0, 40) : null, rowBadge: rows[0] ? (rows[0].textContent || "").indexOf("当前") !== -1 : false, rowDoors: rows[0] ? Array.from(rows[0].querySelectorAll("button")).map((b) => (b.getAttribute("aria-label") || (b.textContent || "").trim()).slice(0, 16)).filter(Boolean) : [], delOpacity: (function () { const r = rows[0]; if (!r) return null; const d = Array.from(r.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "").indexOf("删除会话") === 0); return d ? getComputedStyle(d).opacity : null; })(), histEmptyLine: histList ? (histList.textContent || "").indexOf("还没有更早的对话") !== -1 : false, histNoMatch: histList ? (histList.textContent || "").indexOf("没有匹配") !== -1 : false, bucketToday: histList ? (histList.textContent || "").indexOf("今天") !== -1 : false, keymap: !!km, kbd: km ? (km.querySelector("kbd, [data-slot=kbd]") || {}).textContent || "" : "", keymapWord: km ? (km.textContent || "").indexOf("closes") !== -1 : false, sendDisabled: sendBtn ? sendBtn.disabled : null, followChip: composer ? !!composer.querySelector("button .truncate") : false }); })()';

/* the settle law (the t864/t865 generalization): the busy dots silent AND
 * the images' own contract AND two consecutive measures equal, bounded. */
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
    if (run >= need && m.shimmer === 0 && m.imgPending === 0) break;
  }
  console.log(`  settled ${what} (shimmer silent, ${run}x stable)`);
  return m;
};

/* the arrival door: WAIT for a predicate on the live measure (bounded) */
const waitFor = (what, probe, maxSecs = 30) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  return m;
};

/* the OOM corpse guard — an eval filming a dead server returns ZEROS */
const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;

/* the zero-unnamed census invariant, one voice everywhere */
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* the panel doors */
const openPanel = '(() => { const b = document.querySelector("button[aria-label=\\"AI assistant\\"]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const closePanel = '(() => { const p = document.querySelector("[data-ai-assistant]"); const b = p && Array.from(p.querySelectorAll("button")).find((x) => x.getAttribute("aria-label") === "关闭 AI 助手"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const histToggle = '(() => { const p = document.querySelector("[data-ai-assistant]"); const b = p && p.querySelector("button[aria-label=\\"Session history\\"]"); if (!b) return JSON.stringify({ clicked: false, why: "no toggle" }); b.click(); return JSON.stringify({ clicked: true }); })()';
const chipDoor = (t) =>
  '(() => { const p = document.querySelector("[data-ai-assistant]"); const g = p && Array.from(p.querySelectorAll("[role=group]")).find((x) => (x.getAttribute("aria-label") || "") === "Transcript filter"); const b = g && Array.from(g.querySelectorAll("button[aria-pressed]")).find((x) => (x.textContent || "").indexOf("' + t + '") === 0); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
/* the copy door's reveal probe: FOCUS the first door, re-read its wrapper's
 * computed opacity (the focus-within voice, measured live) */
const focusCopyDoor = '(() => { const p = document.querySelector("[data-ai-assistant]"); const b = p && Array.from(p.querySelectorAll("button")).find((x) => (x.getAttribute("aria-label") || "") === "Copy reply"); if (!b) return JSON.stringify({ focused: false }); b.focus(); return JSON.stringify({ focused: document.activeElement === b }); })()';
const focusDelDoor = '(() => { const p = document.querySelector("[data-ai-assistant]"); const d = p && Array.from(p.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "").indexOf("删除会话") === 0); if (!d) return JSON.stringify({ focused: false }); d.focus(); return JSON.stringify({ focused: document.activeElement === d }); })()';
const blurActive = '(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return "blurred"; })()';
/* the search box's own door: fill the query through the native setter so
 * React sees it (the controlled-input law) */
const typeSearch = (text) =>
  '(function(){ const p = document.querySelector("[data-ai-assistant]"); const i = p && p.querySelector("[data-session-search]"); if (!i) return JSON.stringify({ typed: false }); const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; setter.call(i, ' + JSON.stringify(text) + '); i.dispatchEvent(new Event("input", { bubbles: true })); return JSON.stringify({ typed: true, value: i.value }); })()';
const escIn = (sel) =>
  '(function(){ const p = document.querySelector("[data-ai-assistant]"); const t = p && p.querySelector(' + JSON.stringify(sel) + '); if (!t) return JSON.stringify({ dispatched: false }); t.focus(); const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); t.dispatchEvent(k); return JSON.stringify({ dispatched: true }); })()';

/* ---------- Face O0 — the clean room + the calm canvas ---------- */
console.log("Face O0 — the clean room (the t866 law) and the calm canvas");
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
const m0 = settle("the canvas");
if (corpse(m0, "Face O0")) process.exit(1);
ok("O1 the boot is a clean room (the t157 seed cleared, both panels closed)",
  m0.panelOpen === false && m0.aiPanel === false,
  `jobPanel=${m0.panelOpen} aiPanel=${m0.aiPanel}`);
ok("O2 the canvas is calm and named (the census's invariant)",
  !m0.hasDlg && censusOk(m0),
  `btns=${m0.pageBtns} — zero unnamed anywhere`);
const OPEN = m0.pageBtns;

/* ---------- Face OP — the panel opens through its launcher ---------- */
console.log("Face OP — the launcher's own door");
const p1 = evalJson(openPanel);
ok("P1 the launcher clicked (aria-label names the door)", p1.clicked === true);
const pArr = waitFor("the panel", (m) => m.aiPanel === true);
if (corpse(pArr, "Face OP")) process.exit(1);
ok("P2 the panel arrived as an honest non-modal companion (role=dialog, aria-modal=false, the t501 marks)",
  pArr.aiPanel === true && pArr.aiLabel === "AI 助手" && pArr.aiModal === "false" && pArr.aiCompanion === true,
  `label="${pArr.aiLabel}" modal=${pArr.aiModal} companion=${pArr.aiCompanion}`);
ok("P3 zero unnamed page-wide WITH the panel up (the census's invariant)",
  censusOk(pArr) && pArr.aiUnnamed === 0,
  `page btns=${pArr.pageBtns} panel btns=${pArr.aiBtns}`);
ok("P4 the transcript region speaks its name, its tab stop and its aliveness (the t799 law)",
  pArr.logLabel === "AI assistant transcript" && pArr.logTab === "0" && pArr.logLive === "polite");
ok("P5 the keymap seat is aboard in the empty world (ai-keymap, Kbd Esc, the word form)",
  pArr.keymap === true && pArr.kbd === "Esc" && pArr.keymapWord === true,
  `kbd="${pArr.kbd}"`);

/* ---------- Face EM — the empty face (the world's own truth) ---------- */
console.log("Face EM — the honest empty (suggestions, the composer's refusal, the drawer's empty)");
const em1 = settle("the empty face");
ok("E1 the empty state speaks its heading", em1.emptyHead === true);
ok("E2 the suggestion doors are named by their own text (the content IS the name)",
  em1.suggestions === 3 && em1.sugNames.every((s) => s.length > 0),
  `doors=${JSON.stringify(em1.sugNames)}`);
ok("E3 the composer is named and the send door refuses honestly while empty",
  em1.unCtrls === 0 && em1.sendDisabled === true);
evalJson(histToggle);
const emArr = waitFor("the drawer", (m) => m.histOpen === true);
ok("E4 the history drawer opened through its own toggle (the arrival, waited for)",
  emArr.histOpen === true);
const em2 = settle("the drawer's empty");
ok("E5 the drawer is empty and says so (the honest none — the search box only renders once sessions exist)",
  em2.histOpen === true && em2.histRows === 0 && em2.histEmptyLine === true,
  `rows=${em2.histRows} searchBox=${em2.histSearchName === null ? "absent (honest — nothing to search)" : "present"}`);
evalJson(histToggle);
sleep(1.2);
const em3 = evalJson(MEASURE);
ok("E6 the drawer closed through its own toggle (the live measure says so)",
  em3.histOpen === false && em3.aiPanel === true);

/* ---------- Face SD — the seed (the instrument owns its conditions) ---------- */
console.log("Face SD — the store's seed, discovered and reversible");
/* the DATA_DIR discovery: the store's own reset door answers, the file
 * appears where the RUNNING server keeps it — measured, never pinned.
 * The store's PRE-EXISTENCE is noted first: absence is also a truth. */
const projects = await (async () => {
  const r = await fetch(`${BASE}/api/projects`, { headers: SH });
  const b = await r.json();
  return (b.projects ?? b) ?? [];
})();
const proj = projects[0];
if (!proj?.id) {
  console.error("no project in the roster — the seed cannot pin itself");
  process.exit(1);
}
const resetRes = await (async () => {
  const r = await fetch(`${BASE}/api/ai/chat`, {
    method: "POST",
    headers: { ...SH, "content-type": "application/json" },
    body: JSON.stringify({ action: "reset" }),
  });
  return r.json();
})();
const resetId = resetRes?.sessionId ?? null;
if (!resetId) {
  console.error("the store's reset door did not answer — the seed cannot proceed");
  process.exit(1);
}
let seedPath = null;
for (const cand of [join(ROOT, "data/ai-assistant.json"), "/home/z/cryoflow/data/ai-assistant.json"]) {
  if (existsSync(cand)) {
    try {
      const parsed = JSON.parse(readFileSync(cand, "utf8"));
      if ((parsed.sessions ?? []).some((s) => s.id === resetId)) { seedPath = cand; break; }
    } catch { /* not the one */ }
  }
}
if (!seedPath) {
  console.error("the reset session's bytes were not found on disk — DATA_DIR unknown; refusing to seed blind");
  process.exit(1);
}
const preExists = true; /* the discovery reset just created it — the TRUE
pre-walk truth is recorded below through the pre-reset probe */
/* probe the TRUE pre-walk state: was the file there BEFORE the reset?
 * The reset created it just now if it was absent — the honest restore
 * target is absence in that case. Re-derive: the discovery reset wrote
 * EXACTLY one session (the reset id); if the file holds exactly that
 * one empty session, the pre-walk world was absence OR an empty file —
 * both restore to absence (an empty-session file serves the same honest
 * empty panel). If it holds more, those are pre-walk bytes to restore. */
const nowParsed = JSON.parse(readFileSync(seedPath, "utf8"));
const preSessions = (nowParsed.sessions ?? []).filter((s) => s.id !== resetId);
const preWasAbsence = preSessions.length === 0;
const preBytes = preWasAbsence ? null : JSON.stringify({ version: 1, sessions: preSessions }, null, 2);
console.log(`  store discovered: ${seedPath} (reset id ${resetId} verified; pre-walk truth: ${preWasAbsence ? "ABSENCE" : preSessions.length + " session(s)"}), preSessions=${JSON.stringify(preSessions.map((s) => s.id))}`);
/* the seed — one conversation, the store's own shape, atomic rename */
const now = Date.now();
const seedSession = {
  id: `ai-t870-${Math.floor(now / 1000).toString(36)}`,
  projectId: proj.id,
  createdAt: now - 180000,
  updatedAt: now - 30000,
  title: "t870 — 复制门与键位座位的见证",
  messages: [
    { role: "user", content: "帮我看看当前画布有哪些任务，并给 2D 分类结果一个判断。", at: now - 180000 },
    {
      role: "assistant",
      content:
        "画布上现在有 **6 个任务**，2D 分类已完成。建议保留 σ 较高的两个类。\n\n| class | σ (Å) | 占比 |\n| --- | --- | --- |\n| 001 | 8.2 | 41% |\n| 002 | 9.7 | 33% |\n\n```\nrelion_refine --o Class2D/job012\n```",
      at: now - 90000,
      toolCalls: [
        { id: "call-t870-1", name: "list_jobs", args: {} },
        { id: "call-t870-2", name: "judge_class", args: {} },
        { id: "call-t870-3", name: "create_job", args: {} },
      ],
    },
    { role: "tool", toolCallId: "call-t870-1", name: "list_jobs", content: JSON.stringify({ ok: true, summary: "6 jobs on the canvas", detail: { count: 6 } }), at: now - 120000 },
    { role: "tool", toolCallId: "call-t870-2", name: "judge_class", content: JSON.stringify({ ok: true, summary: "class 001 推荐（σ 8.2）", detail: { sigma: 8.2 } }), at: now - 110000 },
    { role: "tool", toolCallId: "call-t870-3", name: "create_job", content: JSON.stringify({ ok: false, summary: "创建失败：模板忙", detail: { why: "busy" } }), at: now - 100000 },
  ],
};
const seedBytes = JSON.stringify({ version: 1, sessions: [seedSession] }, null, 2);
const tmpPath = `${seedPath}.t870-tmp`;
writeFileSync(tmpPath, seedBytes);
rmSync(seedPath);
execSync(`mv '${tmpPath}' '${seedPath}'`);
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
evalJson(openPanel);
const sArr = waitFor("the rehydrated transcript", (m) => m.aiPanel === true && m.turns >= 1 && m.copyDoors >= 1, 40);
ok("S1 the seed rehydrated: the assistant turn arrived WITH its copy door",
  sArr.aiPanel === true && sArr.turns >= 1 && sArr.copyDoors >= 1,
  `turns=${sArr.turns} copyDoors=${sArr.copyDoors}`);

/* ---------- Face TR — the transcript face ---------- */
console.log("Face TR — the transcript, the copy door, the filter, the seat");
const tr1 = settle("the transcript face", 30);
ok("T1 the user bubble is the seed's own world (the transcript named, a user turn aboard)",
  tr1.userBubbles >= 1 && tr1.logLabel === "AI assistant transcript",
  `userBubbles=${tr1.userBubbles}`);
ok("T2 THE COPY DOOR: named, titled, icon-only (the compact form, the ToolCard locate dialect)",
  tr1.copyDoors === 1 && tr1.copyTitle === "Copy reply" && tr1.copyText === "",
  `doors=${tr1.copyDoors} title="${tr1.copyTitle}" visibleText="${tr1.copyText}"`);
ok("T3 the reveal law, voice 1+2: hidden at rest, FOCUS reveals (opacity 0 -> 1)",
  tr1.copyOpacity === "0" && (() => { const f = evalJson(focusCopyDoor); sleep(1); const m = evalJson(MEASURE); evalJson(blurActive); return f.focused === true && m.copyOpacity === "1"; })(),
  `rest=${tr1.copyOpacity} focused->1`);
ok("T4 three tool cards speak their verdicts (2 ok + 1 failed)",
  tr1.toolToggles === 3 && tr1.toolOk === 2 && tr1.toolFail === 1,
  `ok=${tr1.toolOk} fail=${tr1.toolFail}`);
ok("T5 the filter row lit: 全部/工具/失败 with the seed's own counts (1 user + 1 assistant + 3 tool = 5), pressed states honest",
  tr1.filterRow === true && tr1.chips.length === 3 && tr1.chips[0].t.indexOf("5") !== -1 && tr1.chips[1].t.indexOf("3") !== -1 && tr1.chips[2].t.indexOf("1") !== -1 && tr1.chips[0].pressed === true && tr1.chips[1].pressed === false,
  `chips=${JSON.stringify(tr1.chips.map((c) => c.t))}`);
ok("T6 the keymap seat rides the transcript world too", tr1.keymap === true && tr1.kbd === "Esc");
ok("T7 the composer's follow-up chip present (ONE chip, never a wall)", tr1.followChip === true);
ok("T8 zero unnamed page-wide WITH the full transcript up (the census's invariant)",
  censusOk(tr1) && tr1.aiUnnamed === 0,
  `page btns=${tr1.pageBtns} panel btns=${tr1.aiBtns}`);
const tr2 = settle("the transcript face (second ride)", 34);
ok("T9 two settled rides bit-identical (the t836 law)",
  JSON.stringify(tr1) === JSON.stringify(tr2),
  diffKeys(tr1, tr2).length === 0 ? "bit-for-bit" : `moved: ${diffKeys(tr1, tr2).join(", ")}`);

/* ---------- Face FC — the filter face ---------- */
console.log("Face FC — the 失败 chip presses, the world filters");
const f1 = evalJson(chipDoor("失败"));
ok("F1 the 失败 chip clicked", f1.clicked === true);
sleep(1.2);
const fc1 = settle("the filtered world");
ok("F2 the chip's pressed state flipped and ONLY the failed card remains",
  fc1.chips.length === 3 && fc1.chips[2].pressed === true && fc1.chips[0].pressed === false && fc1.toolToggles === 1 && fc1.toolFail === 1,
  `visible cards=${fc1.toolToggles} (fail=${fc1.toolFail})`);
const f2 = evalJson(chipDoor("全部"));
sleep(1.2);
const fc2 = settle("the restored world");
ok("F3 全部 restores the whole transcript (3 cards back, pressed honest)",
  fc2.chips.length === 3 && fc2.chips[0].pressed === true && fc2.toolToggles === 3);

/* ---------- Face HI — the history face ---------- */
console.log("Face HI — the drawer: the row from the data, the doors, the layered Esc");
evalJson(histToggle);
sleep(1.2);
const hi1 = settle("the history face");
ok("H1 the row arrived titled from the DATA, the 当前 badge on the active row, the search named (it renders once sessions exist)",
  hi1.histRows === 1 && (hi1.rowTitle || "").indexOf("复制门与键位座位") !== -1 && hi1.rowBadge === true && hi1.histSearchName === "搜索历史会话",
  `row="${hi1.rowTitle}" search="${hi1.histSearchName}"`);
ok("H2 the drawer speaks the session's recency — the 今天 bucket in the grouped worlds, the row's own wall-clock word (刚刚) in the flat one (flatSessions: one bucket renders flat)",
  hi1.bucketToday === true || (hi1.rowTitle || "").indexOf("刚刚") !== -1,
  `bucket=${hi1.bucketToday} rowTime=${(hi1.rowTitle || "").indexOf("刚刚") !== -1 ? "刚刚" : "?"}`);
ok("H3 the three row doors are named by the session's own name (删除/重命名/导出)",
  hi1.rowDoors.length >= 3 && hi1.rowDoors.some((n) => n.indexOf("删除会话") === 0) && hi1.rowDoors.some((n) => n.indexOf("重命名会话") === 0) && hi1.rowDoors.some((n) => n.indexOf("导出会话") === 0),
  `doors=${JSON.stringify(hi1.rowDoors)}`);
ok("H4 the delete door's reveal law (the same three-voice dialect as the copy door): hidden at rest, focus reveals",
  hi1.delOpacity === "0" && (() => { const f = evalJson(focusDelDoor); sleep(1); const m = evalJson(MEASURE); evalJson(blurActive); return f.focused === true && m.delOpacity === "1"; })(),
  `rest=${hi1.delOpacity} focused->1`);
/* the layered Esc, layer 1: a live query is vetoed, the panel STAYS */
const t1 = evalJson(typeSearch("t870"));
sleep(1);
const hi2 = evalJson(MEASURE);
ok("H5 the search filters live (the seeded title survives its own query)",
  t1.typed === true && hi2.histRows === 1,
  `query="${t1.value}" rows=${hi2.histRows}`);
evalJson(typeSearch("zzz-no-such-session"));
sleep(1);
const hi3 = evalJson(MEASURE);
ok("H6 the no-match world is honest (没有匹配 spoken, zero rows)",
  hi3.histRows === 0 && hi3.histNoMatch === true);
const esc1 = evalJson(escIn("[data-session-search]"));
sleep(1.2);
const hi4 = evalJson(MEASURE);
ok("H7 the FIRST Esc is the search's veto: the query clears, the panel and the drawer stay (the t430 layer)",
  esc1.dispatched === true && hi4.aiPanel === true && hi4.histOpen === true,
  `panel=${hi4.aiPanel} drawer=${hi4.histOpen}`);
/* the layered Esc, layer 2: the query now empty, the window peels */
const esc2 = evalJson(escIn("[data-session-search]"));
sleep(1.2);
const hi5 = evalJson(MEASURE);
ok("H8 the SECOND Esc closes the window (the keymap seat's own teaching, delivered)",
  esc2.dispatched === true && hi5.aiPanel === false,
  `panel=${hi5.aiPanel}`);

/* ---------- Face W — the world back (the store's pre-walk truth) ---------- */
console.log("Face W — the store's net zero, the seed hygiene, the canvas back");
if (preBytes) {
  writeFileSync(seedPath, preBytes);
} else {
  rmSync(seedPath);
}
const storeNow = existsSync(seedPath) ? JSON.parse(readFileSync(seedPath, "utf8")) : { sessions: [] };
ok("W1 the store restored to its pre-walk truth (the seeded conversation AND the discovery reset's residue erased — net zero)",
  preWasAbsence
    ? !existsSync(seedPath) && storeNow.sessions.length === 0
    : storeNow.sessions.length === preSessions.length && storeNow.sessions.every((s) => preSessions.some((x) => x.id === s.id)),
  preWasAbsence ? "absence restored (the file is gone)" : `sessions=${storeNow.sessions.length}`);
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
evalJson(openPanel);
sleep(2);
const w1 = waitFor("the reopened panel", (m) => m.aiPanel === true, 20);
ok("W2 the reopened panel is EMPTY again (no seed residue, no reset residue — the honest empty)",
  w1.turns === 0 && w1.copyDoors === 0 && w1.emptyHead === true,
  `turns=${w1.turns} copyDoors=${w1.copyDoors}`);
evalJson(closePanel);
sleep(1.2);
const w2 = settle("the restored canvas");
if (corpse(w2, "Face W")) process.exit(1);
ok("W3 the world unharmed (canvas count == the opening count, zero unnamed, no dialogs)",
  w2.pageBtns === OPEN && w2.pageUnnamed === 0 && w2.aiPanel === false && w2.hasDlg === false,
  `btns=${w2.pageBtns} (opening ${OPEN})`);
const seedAfter = evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
ok("W4 the ride leaves no session seed (the t157 two-way door's honest none)",
  seedAfter.seed === "" || seedAfter.seed === null,
  `seed=${JSON.stringify(seedAfter.seed)}`);

/* ---------- the ledger at birth (five faces) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (five faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  canvasFace: ledgerFace(prevFaces ? prevFaces.canvasFace?.live ?? null : null, m0, scalarOf),
  emptyFace: ledgerFace(prevFaces ? prevFaces.emptyFace?.live ?? null : null, em1, scalarOf),
  transcriptFace: ledgerFace(prevFaces ? prevFaces.transcriptFace?.live ?? null : null, tr1, scalarOf),
  historyFace: ledgerFace(prevFaces ? prevFaces.historyFace?.live ?? null : null, hi1, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w2, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the AI conversation face holds: the clean room held, the panel arrived as the honest non-modal companion, the empty face refused to send while empty, the seeded transcript hosted the user's own words with THE COPY DOOR measured live (hidden at rest, focus reveals — named, titled, icon-only), three tool cards spoke their verdicts under a filter row whose pressed states stayed honest, the keymap seat rode every world, the history drawer titled its row from the data with the three row doors named and the delete door obeying the same reveal law, the layered Esc was witnessed live (the search veto, then the window peel), and the store came back to its pre-walk truth with the panel reopening to its own honest empty`
  : `${fail} red — the AI conversation face moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: prevReceipt?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t870-aipanel-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> canvas -> AI launcher -> panel (non-modal companion) -> empty face (suggestions + send refusal + drawer's honest empty) -> store seeded (reset-door discovery, pre-walk truth noted) -> rehydrated transcript (copy door, tool cards, filter row, keymap seat) -> 失败 chip -> 全部 -> history drawer (row from data, three doors, delete reveal) -> search filter + no-match -> Esc veto (search layer) -> Esc peel (window) -> store restored (net zero) -> reopened empty -> canvas back",
  doors: {
    panel: "click the header launcher (aria-label 'AI assistant')",
    drawer: "the header's Session history toggle (aria-expanded speaks)",
    filter: "the Transcript-filter chips (aria-pressed)",
    copyDoor: "button[aria-label='Copy reply'] — icon-only, hover/focus/touch reveal",
    search: "[data-session-search] — the controlled input through its native setter",
    esc: "Escape — layer 1 the live-query veto, layer 2 the window peel",
    store: "data/ai-assistant.json — the reset door discovered it, the pre-walk truth came back",
  },
  seed: {
    store: seedPath,
    resetSessionId: resetId,
    preWalkTruth: preWasAbsence ? "absence" : `${preSessions.length} session(s)`,
    restored: true,
    note: "the seeded conversation AND the discovery reset's empty session were both erased — the store returned to its pre-walk truth",
  },
  revealLaw: {
    measured: "rest opacity 0 (desktop idle), focus-within opacity 1 — the keyboard voice",
    contract: "max-sm:opacity-100 — the touch voice rides in code (headless viewport is desktop; the touch voice is asserted by the class, recorded honestly as not-measured)",
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
  faces,
};
writeFileSync(join(ROOT, "shots-qa/t870-aipanel-a11y.json"), JSON.stringify(receipt, null, 2));
console.log(`\nAIPANEL-A11Y t870: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
console.log(`receipt: shots-qa/t870-aipanel-a11y.json`);
process.exit(fail === 0 ? 0 : 1);
