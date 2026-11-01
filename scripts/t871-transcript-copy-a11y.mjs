#!/usr/bin/env node
/**
 * t871 — the a11y rotation + the copy door's kin: the AI PANEL'S
 * TRANSCRIPT-LEVEL COPY DOOR, walked green at birth (the law every new
 * face is born under), and the header it joined measured seat-first.
 *
 * The feature this walk films (the t428 export's sibling — the t870
 * tail's candidate): ONE door in the panel header copies the WHOLE
 * conversation to the clipboard as markdown. The bytes are the session
 * of record's `?format=md` — t428's archival shape, ONE maker, zero
 * drift between what copies and what downloads. The walk proves the
 * zero-drift claim BYTE-FOR-BYTE: it stubs the clipboard, clicks the
 * door, and diffs the recorded bytes against a fresh fetch of the same
 * endpoint.
 *
 * The faces:
 *
 *   O0  the clean room (the t866 law) — the session store cleared, the
 *       panel closed, the canvas calm and named.
 *   OP  the launcher's door — role=dialog, the honest non-modal
 *       companion (aria-modal=false), the t501 marks aboard.
 *   EM  the empty face — and THE NEW DOOR'S HONEST REFUSAL: disabled
 *       while no session of record exists, still named + titled, its
 *       hit-slop quiet (the neighbors are interactive doors — a slop
 *       that shadows a real button lies to the mouse), seated BEFORE
 *       the history toggle (content affordance, then tool affordances).
 *   SD  the seed — the instrument owns its conditions (the t866 law,
 *       server-side edition, the t870 mechanics verbatim): the store's
 *       reset door discovered DATA_DIR, the PRE-WALK TRUTH noted, one
 *       seeded conversation written through the atomic-rename door.
 *   TR  the transcript face — the door at work: enabled now; THE LIVE
 *       COPY measured (the clipboard recorder captures the door's own
 *       write; byte-for-byte == the endpoint's bytes; the archival
 *       shape spoken: # heading, meta line, ## 用户 / ## 助手 sections,
 *       > 工具 quotes); the Copied flip witnessed (the Check icon
 *       arrives, leaves after 1.4 s); the toast spoken; zero unnamed;
 *       two settled rides bit-for-bit.
 *   HI  the history face — light regression: the header grew a button,
 *       the drawer must be exactly what t870 filmed (row from data,
 *       three doors named, search named).
 *   W   the world back — the store restored to its PRE-WALK TRUTH
 *       (absence where absence ruled), the reopened panel empty AND
 *       refusing again (the door's disabled state back), the canvas
 *       bit-for-bit, the t157 seed none.
 *
 * Born with the ledger aboard (the t861 birthright, five faces):
 * canvasFace / emptyFace / transcriptFace / historyFace / worldBack.
 *
 * Receipt: shots-qa/t871-transcript-copy-a11y.json.
 *
 *   node scripts/t871-transcript-copy-a11y.mjs
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
const cmp = loadComparator(ROOT, "shots-qa/t871-transcript-copy-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t871 transcript-copy a11y walk — world ${world.mode}:${buildId}, the header's whole-conversation copy door born and filmed byte-for-byte\n` +
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

/* ---------- the measure: the SHARED RULER + the header door's fields.
 * ONE superset measure — every face films the same fields; the absent
 * selectors speak false/0. NO ${} inside — the shell reads this string.
 * Labels with spaces are matched by JS filters (the unquoted attribute
 * form cannot speak a space — the t870 lesson). */
const MEASURE =
  '(() => { ' + NAMEOF + ' const inTree = (e) => e.getAttribute("aria-hidden") !== "true" && !e.hidden && !(e.closest && e.closest("[aria-hidden=true]")); const btns = Array.from(document.querySelectorAll("button")).filter(inTree); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")).filter(inTree); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const p = document.querySelector("[data-ai-assistant]"); const q = (s) => p ? p.querySelector(s) : null; const qa = (s) => p ? Array.from(p.querySelectorAll(s)) : []; const log = q("[role=log]"); const logBtns = log ? Array.from(log.querySelectorAll("button")).filter(inTree) : []; const toolToggles = logBtns.filter((b) => b.getAttribute("aria-expanded") !== null); const grp = p ? Array.from(p.querySelectorAll("[role=group]")).find((g) => (g.getAttribute("aria-label") || "") === "Transcript filter") : null; const chips = grp ? Array.from(grp.querySelectorAll("button[aria-pressed]")).map((b) => ({ t: (b.textContent || "").trim().replace(/\\s+/g, " "), pressed: b.getAttribute("aria-pressed") === "true" })) : []; const histList = p ? Array.from(p.querySelectorAll("[role=list]")).find((l) => (l.getAttribute("aria-label") || "") === "Session history") : null; const rows = histList ? Array.from(histList.querySelectorAll("[role=listitem]")) : []; const histSearch = q("[data-session-search]"); const copyDoors = p ? Array.from(p.querySelectorAll("button")).filter((b) => (b.getAttribute("aria-label") || "") === "Copy reply") : []; const conv = p ? Array.from(p.querySelectorAll("button")).filter(inTree).find((b) => (b.getAttribute("aria-label") || "") === "Copy conversation as markdown") : null; const ta = p ? Array.from(p.querySelectorAll("textarea")).find((x) => (x.getAttribute("aria-label") || "") === "Message the AI assistant") : null; const composer = ta ? ta.closest("div.border-t") : null; const sendBtn = composer ? Array.from(composer.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "") === "Send") : null; const emptyGrid = log ? log.querySelector(".grid") : null; const aiBtns = p ? Array.from(p.querySelectorAll("button")).filter(inTree) : []; const aiUn = aiBtns.filter((b) => !nameOf(b)); const km = q("[data-canvas-ui=ai-keymap]"); const shimmer = log ? log.querySelectorAll(".animate-bounce").length : 0; return JSON.stringify({ url: location.pathname, panelOpen: btns.some((b) => (b.getAttribute("aria-label") || "") === "Close job panel"), pageBtns: btns.length, pageUnnamed: un.length, ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, shimmer: shimmer, hasDlg: dgs.length > 0, aiPanel: !!p, aiLabel: p ? p.getAttribute("aria-label") : null, aiModal: p ? p.getAttribute("aria-modal") : null, aiCompanion: p ? p.hasAttribute("data-companion-window") : false, aiBtns: aiBtns.length, aiUnnamed: aiUn.length, logLabel: log ? log.getAttribute("aria-label") : null, logTab: log ? log.getAttribute("tabindex") : null, logLive: log ? log.getAttribute("aria-live") : null, emptyHead: log ? (log.textContent || "").indexOf("用一句话指挥整条流程") !== -1 : false, suggestions: emptyGrid ? emptyGrid.querySelectorAll("button").length : 0, turns: qa("[class*=\\"group/turn\\"]").length, copyDoors: copyDoors.length, toolToggles: toolToggles.length, toolOk: toolToggles.filter((b) => !!b.querySelector("[aria-label=succeeded]")).length, toolFail: toolToggles.filter((b) => !!b.querySelector("[aria-label=failed]")).length, filterRow: chips.length > 0, chips: chips, histOpen: !!histList, histSearchName: histSearch ? histSearch.getAttribute("aria-label") : null, histRows: rows.length, rowTitle: rows[0] ? (rows[0].textContent || "").trim().slice(0, 40) : null, rowBadge: rows[0] ? (rows[0].textContent || "").indexOf("当前") !== -1 : false, rowDoors: rows[0] ? Array.from(rows[0].querySelectorAll("button")).map((b) => (b.getAttribute("aria-label") || (b.textContent || "").trim()).slice(0, 16)).filter(Boolean) : [], histEmptyLine: histList ? (histList.textContent || "").indexOf("还没有更早的对话") !== -1 : false, keymap: !!km, kbd: km ? (km.querySelector("kbd, [data-slot=kbd]") || {}).textContent || "" : "", sendDisabled: sendBtn ? sendBtn.disabled : null, convDoor: !!conv, convDisabled: conv ? conv.disabled : null, convTitle: conv ? conv.getAttribute("title") : null, convText: conv ? (conv.textContent || "").trim() : null, convSlop: conv ? getComputedStyle(conv, "::before").display : null, convNext: conv && conv.nextElementSibling ? conv.nextElementSibling.getAttribute("aria-label") : null, convCheck: conv ? !!conv.querySelector("svg.text-success-600") : false }); })()';

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

/* the panel doors (the t870 dialect) */
const openPanel = '(() => { const b = document.querySelector("button[aria-label=\\"AI assistant\\"]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const closePanel = '(() => { const p = document.querySelector("[data-ai-assistant]"); const b = p && Array.from(p.querySelectorAll("button")).find((x) => x.getAttribute("aria-label") === "关闭 AI 助手"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const histToggle = '(() => { const p = document.querySelector("[data-ai-assistant]"); const b = p && p.querySelector("button[aria-label=\\"Session history\\"]"); if (!b) return JSON.stringify({ clicked: false, why: "no toggle" }); b.click(); return JSON.stringify({ clicked: true }); })()';

/* THE DOOR's own helpers: the clipboard recorder (the stub is the page's
 * own API surface — the walk films what the door WROTE, no permissions
 * needed), the door's click, the recorder's read. */
const stubClip = '(() => { window.__t871 = window.__t871 || {}; if (!window.__t871.stub) { try { window.__t871.orig = navigator.clipboard.writeText.bind(navigator.clipboard); } catch (e) { window.__t871.orig = null; } navigator.clipboard.writeText = (t) => { window.__t871.copied = String(t); return Promise.resolve(); }; window.__t871.stub = true; } window.__t871.copied = null; return JSON.stringify({ stubbed: true }); })()';
const readClip = '(() => ({ copied: (window.__t871 && window.__t871.copied) || null }))()';
const clickConv = '(() => { const p = document.querySelector("[data-ai-assistant]"); const b = p && Array.from(p.querySelectorAll("button")).find((x) => (x.getAttribute("aria-label") || "") === "Copy conversation as markdown"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const unstubClip = '(() => { if (window.__t871 && window.__t871.stub) { if (window.__t871.orig) navigator.clipboard.writeText = window.__t871.orig; window.__t871.stub = false; } return JSON.stringify({ restored: true }); })()';

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

/* ---------- Face EM — the empty face + THE DOOR'S HONEST REFUSAL ---------- */
console.log("Face EM — the honest empty, and the new door's refusal while nothing is of record");
const em1 = settle("the empty face");
ok("E1 the empty state speaks its heading", em1.emptyHead === true);
ok("E2 the composer's send door refuses honestly while empty (the house calibre)",
  em1.unCtrls === 0 && em1.sendDisabled === true);
ok("E3 THE TRANSCRIPT DOOR exists in the empty world and REFUSES honestly (disabled while no session of record)",
  em1.convDoor === true && em1.convDisabled === true,
  `disabled=${em1.convDisabled}`);
ok("E4 the door is still fully named (accessible name + title, icon-only compact form)",
  em1.convTitle === "Copy conversation as markdown" && em1.convText === "",
  `title="${em1.convTitle}" visibleText="${em1.convText}"`);
ok("E5 the hit-slop is quiet on this seat (the neighbors are interactive doors — a slop that shadows a real button lies to the mouse)",
  em1.convSlop === "none",
  `::before display=${em1.convSlop}`);
ok("E6 the seat order speaks: the content affordance rides BEFORE the tool affordances (next sibling = the history toggle)",
  em1.convNext === "Session history",
  `next=${em1.convNext}`);

/* ---------- Face SD — the seed (the instrument owns its conditions) ---------- */
console.log("Face SD — the store's seed, discovered and reversible (the t870 mechanics)");
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
const nowParsed = JSON.parse(readFileSync(seedPath, "utf8"));
const preSessions = (nowParsed.sessions ?? []).filter((s) => s.id !== resetId);
const preWasAbsence = preSessions.length === 0;
const preBytes = preWasAbsence ? null : JSON.stringify({ version: 1, sessions: preSessions }, null, 2);
console.log(`  store discovered: ${seedPath} (reset id ${resetId} verified; pre-walk truth: ${preWasAbsence ? "ABSENCE" : preSessions.length + " session(s)"})`);
const now = Date.now();
const seedId = `ai-t871-${Math.floor(now / 1000).toString(36)}`;
const seedSession = {
  id: seedId,
  projectId: proj.id,
  createdAt: now - 180000,
  updatedAt: now - 30000,
  title: "t871 — 整段对话复制门的见证",
  messages: [
    { role: "user", content: "把当前画布的任务和 2D 分类的判断整理成一段可以贴进实验记录的 markdown。", at: now - 180000 },
    {
      role: "assistant",
      content:
        "画布上现在有 **15 个任务**，2D 分类已完成，建议保留 σ 较高的两个类。\n\n| class | σ (Å) | 占比 |\n| --- | --- | --- |\n| 001 | 8.2 | 41% |\n| 002 | 9.7 | 33% |\n\n```\nrelion_refine --o Class2D/job012\n```",
      at: now - 90000,
      toolCalls: [
        { id: "call-t871-1", name: "list_jobs", args: {} },
        { id: "call-t871-2", name: "judge_class", args: {} },
        { id: "call-t871-3", name: "create_job", args: {} },
      ],
    },
    { role: "tool", toolCallId: "call-t871-1", name: "list_jobs", content: JSON.stringify({ ok: true, summary: "15 jobs on the canvas", detail: { count: 15 } }), at: now - 120000 },
    { role: "tool", toolCallId: "call-t871-2", name: "judge_class", content: JSON.stringify({ ok: true, summary: "class 001 推荐（σ 8.2）", detail: { sigma: 8.2 } }), at: now - 110000 },
    { role: "tool", toolCallId: "call-t871-3", name: "create_job", content: JSON.stringify({ ok: false, summary: "创建失败：模板忙", detail: { why: "busy" } }), at: now - 100000 },
  ],
};
const seedBytes = JSON.stringify({ version: 1, sessions: [seedSession] }, null, 2);
const tmpPath = `${seedPath}.t871-tmp`;
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
ok("S1 the seed rehydrated: the assistant turn arrived WITH its turn-level copy door",
  sArr.aiPanel === true && sArr.turns >= 1 && sArr.copyDoors >= 1,
  `turns=${sArr.turns} copyDoors=${sArr.copyDoors}`);
ok("S2 THE TRANSCRIPT DOOR woke up with the session of record (disabled -> enabled)",
  sArr.convDoor === true && sArr.convDisabled === false,
  `disabled=${sArr.convDisabled}`);

/* ---------- Face TR — the transcript face: THE DOOR AT WORK ---------- */
console.log("Face TR — the whole-conversation copy door, filmed byte-for-byte");
const tr1 = settle("the transcript face", 30);
ok("T1 the door in the seeded world: named, titled, icon-only, slop quiet, seated before the history toggle",
  tr1.convDoor === true && tr1.convDisabled === false && tr1.convTitle === "Copy conversation as markdown" && tr1.convText === "" && tr1.convSlop === "none" && tr1.convNext === "Session history",
  `disabled=${tr1.convDisabled} next=${tr1.convNext}`);
/* THE LIVE COPY: stub -> click -> read -> byte-compare against the endpoint.
 * The measurements ride in DECAY order — the evidence's own half-lives:
 *   1. the flip (1.4 s — the fastest-decaying witness),
 *   2. the toast (~4 s auto-dismiss),
 *   3. the endpoint comparator (retried, unbounded — the slow one last).
 * The first ride filmed the toast poll AFTER the comparator's retries and
 * the flip sleeps — the toast had already dismissed: the walk's own
 * misread, taught and fixed here. */
evalJson(stubClip);
const c1 = evalJson(clickConv);
ok("T2 the door clicked", c1.clicked === true);
let clip = null;
for (let i = 0; i < 12; i++) {
  sleep(1);
  clip = evalJson(readClip);
  if (clip.copied) break;
}
const flipNow = evalJson(MEASURE);
let toastSeen = false;
for (let i = 0; i < 5; i++) {
  const t = evalJson('(() => JSON.stringify({ text: (document.body.textContent || "").indexOf("已复制整个对话为 Markdown") !== -1 }))()');
  if (t.text === true) { toastSeen = true; break; }
  sleep(1);
}
sleep(2);
const flipBack = evalJson(MEASURE);
/* the node-side comparator fetch — retried: the dev lane's socket has
 * been witnessed closing mid-flight under memory pressure (this walk's
 * own first ride died on an UND_ERR_SOCKET at exactly this fetch), and
 * a walk must not die on the world's hiccup it is trying to film. */
const fetchEndpointBytes = async (id, tries = 5) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${BASE}/api/ai/sessions/${id}?format=md`, { headers: SH });
      if (r.status === 200) return await r.text();
      if (r.status === 404) return null; // an honest absence — the door's own refusal case
      /* 5xx — the world hiccuped; retry */
    } catch {
      /* socket closed / ECONNRESET — retry */
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  return undefined; // still failing after the budget — the walk speaks UNAVAILABLE
};
const endpointBytes = await fetchEndpointBytes(seedId);
ok("T3 the door wrote to the clipboard (the recorder caught the door's own write)",
  !!clip.copied,
  `bytes=${clip.copied ? clip.copied.length : 0}`);
ok("T4 ZERO DRIFT: the clipboard's bytes == the session of record's `?format=md` bytes (ONE maker, byte-for-byte)",
  !!clip.copied && endpointBytes != null && clip.copied === endpointBytes,
  `clipboard=${clip.copied ? clip.copied.length : 0} endpoint=${endpointBytes ? endpointBytes.length : "unavailable"} identical=${!!clip.copied && endpointBytes != null && clip.copied === endpointBytes}`);
ok("T5 the archival shape rides the clipboard: # heading, meta line, ## 用户 / ## 助手 sections, > 工具 quotes",
  !!clip.copied &&
    clip.copied.startsWith("# ") &&
    clip.copied.indexOf("## 用户") !== -1 &&
    clip.copied.indexOf("## 助手") !== -1 &&
    clip.copied.indexOf("> 工具 `list_jobs`") !== -1 &&
    clip.copied.indexOf("- 项目：") !== -1,
  "t428's shape, spoken through the door");
ok("T6 the Copied flip witnessed: the Check icon arrives while the flip window is open",
  flipNow.convCheck === true);
ok("T7 the flip returns (1.4 s — the family's own clock)",
  flipBack.convCheck === false);
evalJson(unstubClip);
ok("T8 the door's success toast spoken (已复制整个对话为 Markdown)", toastSeen === true);
ok("T9 zero unnamed page-wide WITH the full transcript and the new door up (the census's invariant)",
  censusOk(tr1) && tr1.aiUnnamed === 0,
  `page btns=${tr1.pageBtns} panel btns=${tr1.aiBtns}`);
ok("T10 the turn-level copy door still rides beside the header door (the family, not a fork)",
  tr1.copyDoors >= 1,
  `turnDoors=${tr1.copyDoors}`);
const tr2 = settle("the transcript face (second ride)", 34);
ok("T11 two settled rides bit-identical (the t836 law)",
  JSON.stringify(tr1) === JSON.stringify(tr2),
  diffKeys(tr1, tr2).length === 0 ? "bit-for-bit" : `moved: ${diffKeys(tr1, tr2).join(", ")}`);

/* ---------- Face HI — the history face (light regression) ---------- */
console.log("Face HI — the drawer regression: the header grew a button, the drawer must be unchanged");
evalJson(histToggle);
const hiArr = waitFor("the drawer", (m) => m.histOpen === true);
const hi1 = settle("the history face");
ok("H1 the row arrived titled from the DATA, the 当前 badge on the active row, the search named",
  hi1.histRows === 1 && (hi1.rowTitle || "").indexOf("整段对话复制门") !== -1 && hi1.rowBadge === true && hi1.histSearchName === "搜索历史会话",
  `row="${hi1.rowTitle}" search="${hi1.histSearchName}"`);
ok("H2 the three row doors are named by the session's own name (删除/重命名/导出)",
  hi1.rowDoors.length >= 3 && hi1.rowDoors.some((n) => n.indexOf("删除会话") === 0) && hi1.rowDoors.some((n) => n.indexOf("重命名会话") === 0) && hi1.rowDoors.some((n) => n.indexOf("导出会话") === 0),
  `doors=${JSON.stringify(hi1.rowDoors)}`);
evalJson(histToggle);
sleep(1.2);
const hi2 = evalJson(MEASURE);
ok("H3 the drawer closed through its own toggle", hi2.histOpen === false && hi2.aiPanel === true);

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
ok("W3 the transcript door REFUSES again in the honest empty (the refusal state came back with the world)",
  w1.convDoor === true && w1.convDisabled === true,
  `disabled=${w1.convDisabled}`);
evalJson(closePanel);
sleep(1.2);
const w2 = settle("the restored canvas");
if (corpse(w2, "Face W")) process.exit(1);
ok("W4 the world unharmed (canvas count == the opening count, zero unnamed, no dialogs)",
  w2.pageBtns === OPEN && w2.pageUnnamed === 0 && w2.aiPanel === false && w2.hasDlg === false,
  `btns=${w2.pageBtns} (opening ${OPEN})`);
const seedAfter = evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
ok("W5 the ride leaves no session seed (the t157 two-way door's honest none)",
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
  ? `the transcript-level copy door holds: the clean room held, the panel arrived as the honest non-modal companion, the door refused while nothing was of record and still spoke its name (the slop quiet on its seat, the content affordance before the tools), the seeded world woke it, the live copy was filmed byte-for-byte against the session of record's own markdown (ONE maker, zero drift), the archival shape rode the clipboard, the Copied flip kept the family's 1.4 s clock, the toast spoke, the history drawer was unchanged under the header's new neighbor, and the store came back to its pre-walk truth with the door refusing again in the honest empty`
  : `${fail} red — the transcript-level copy door moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: prevReceipt?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t871-transcript-copy-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> canvas -> AI launcher -> panel (non-modal companion) -> empty face (the door's honest refusal, slop quiet, seat order) -> store seeded (reset-door discovery, pre-walk truth noted) -> rehydrated transcript -> THE DOOR: stubbed clipboard, click, recorder read, byte-compare vs ?format=md, archival shape spots, the 1.4 s flip, the toast -> history drawer regression -> store restored (net zero) -> reopened empty (the door refusing again) -> canvas back",
  doors: {
    panel: "click the header launcher (aria-label 'AI assistant')",
    convDoor: "button[aria-label='Copy conversation as markdown'] — icon-only in the header row, disabled while no session of record, slop quiet",
    clipboard: "window.__t871 recorder — the stub IS the page's clipboard surface; the walk films what the door wrote",
    drawer: "the header's Session history toggle (aria-expanded speaks)",
    store: "data/ai-assistant.json — the reset door discovered it, the pre-walk truth came back",
  },
  seed: {
    store: seedPath,
    resetSessionId: resetId,
    seedSessionId: seedId,
    preWalkTruth: preWasAbsence ? "absence" : `${preSessions.length} session(s)`,
    restored: true,
    note: "the seeded conversation AND the discovery reset's empty session were both erased — the store returned to its pre-walk truth",
  },
  zeroDrift: {
    claim: "the door copies the session of record's `?format=md` bytes — one maker (sessionToMarkdown), zero drift between copy and download",
    measured: "clipboard recorder bytes === a fresh endpoint fetch's bytes, byte-for-byte",
    endpoint: `/api/ai/sessions/${seedId}?format=md`,
  },
  revealLaw: {
    seat: "the hit-slop quiet on the header seat (::before display none, measured) — the neighbors are interactive doors",
    order: "content affordance before tool affordances (next sibling = the history toggle, measured)",
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
  faces,
};
writeFileSync(join(ROOT, "shots-qa/t871-transcript-copy-a11y.json"), JSON.stringify(receipt, null, 2));
console.log(`\nTRANSCRIPT-COPY-A11Y t871: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
console.log(`receipt: shots-qa/t871-transcript-copy-a11y.json`);
process.exit(fail === 0 ? 0 : 1);
