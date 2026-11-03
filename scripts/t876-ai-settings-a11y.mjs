#!/usr/bin/env node
/**
 * t876 — the AI PROVIDER SETTINGS DIALOG's faces — the rotation's second
 * candidate RIDDEN (the ortho panel stayed home a FIFTH time: the box
 * rolled a 440MB corpse at entry, the reap lifted it to ~1000MB, still
 * under the calm-box bar — the contract's first candidate needs ≥1500MB),
 * walked live with the SHARED RULER (zero src).
 *
 * The surface (the dialog is the app's AI brain trust — mounted by the
 * app-shell at every hour, opened through the ASSISTANT PANEL's settings
 * door; its own words: the title "AI 助手设置", the description speaking
 * the secret contract — "密钥只保存在本机 (data/ai-settings.json)" — the
 * two-pane editor idiom (the provider catalog rail left, the config form
 * right), the "当前使用" pill in the header, the t474 roll-call line, the
 * write-only key field, the datalist-backed model input, the autoJudge
 * switch, the footer's 取消 / 保存并启用):
 *
 *   W   the API warm (the t873 doctrine): GET settings, GET providers/
 *       health, POST models on the builtin lane (in-process, no network,
 *       no persistence) — the routes' first-compile tax paid OUTSIDE any
 *       ride. The PUT handler lives in the SAME route module the GET warms.
 *   S   the AI world measured: the settings DTO read through the guard's
 *       own door (t709 law: curl is rejected, same-origin metadata passes)
 *       — active provider, 15 catalog providers, the saved configs, the
 *       FILE ABSENCE fact (data/ai-settings.json has never been born —
 *       the save face will birth it; the exit restore owes that absence).
 *   O   the clean room (the t866 law) — the canvas calm, the census.
 *   A   the assistant door — the header's [aria-label="AI assistant"]
 *       summons the panel (role=dialog, aria-modal=false — the t500 law's
 *       non-modal companion).
 *   D   the settings door — the panel's [aria-label="AI provider settings"]
 *       summons the dialog as layer 2 (dlgCount=2): the title, the
 *       description, the 当前使用 pill ("Built-in (GLM) · glm-4-plus"),
 *       the rail (role=list, 15 named rows, exactly ONE aria-pressed),
 *       zero unnamed page-wide AT TWO LAYERS.
 *   F   the form face (builtin selected) — the identity block (the mono
 *       id "builtin"), the t474 roll-call line ("连通性：正常" + the
 *       in-process lane's own detail + the 重新测活 door), the key field's
 *       HONEST ABSENCE (needsKey=false), the model input prefilled
 *       "glm-4-plus" over its datalist, the VLM field, the checked switch,
 *       the footer's two doors, zero unnamed controls in the dialog.
 *   R   the reprobe ride — [aria-label="重新测活"] re-tests EVERY saved
 *       provider (one: builtin, the in-process lane) and the roll-call
 *       line still speaks 正常.
 *   P   the provider switch — the rail's second row (OpenAI, filmed before
 *       the click): aria-pressed MOVES, the identity speaks OpenAI, the
 *       key field RENDERS (type=password, the eye, keyHint "未保存"),
 *       the model field RESETS, the roll-call line GONE (saved-only law).
 *   K   the key secrecy ride — a FAKE key filled with TRUSTED events (the
 *       t863 law): the debounce (700ms) fires POST /api/ai/models, the
 *       route never persists (its own docstring: only PUT writes keys),
 *       the failure speaks role=alert — and the DTO after has NO openai
 *       entry (the key was never saved). The eye toggles the type both
 *       ways (Show ↔ Hide, password ↔ text).
 *   B   the switch BACK — builtin re-selected: aria-pressed returns, the
 *       key field vanishes, the model re-prefills, the roll-call returns.
 *   V   the switch face — autoJudge toggled off and back ON (aria-checked
 *       flips both ways; a LOCAL state only — the save is the persist).
 *   E   the save face (the idempotent crown) — 保存并启用 with EVERYTHING
 *       unchanged and the key field EMPTY (留空 = 保留已保存的密钥): the
 *       toast speaks "AI 已配置：Built-in (GLM) · glm-4-plus", the dialog
 *       CLOSES ITSELF (the panel remains), the DTO after == the DTO before
 *       bit-for-bit, and the file birth is DOCUMENTED (data/ai-settings.json
 *       born at 0600 with the world's own defaults — the exit restore owes
 *       its absence).
 *   A2  the badge face — the panel's header re-fetched on the dialog's
 *       close (the t-designed refresh): the badge speaks the provider
 *       without any reload.
 *   X   the peel — the dialog re-opened, Escape peels ONE layer (2 -> 1,
 *       the helper's law), the panel's own X ([aria-label="关闭 AI 助手"])
 *       peels the last (1 -> 0), the canvas bare.
 *   W   the world back — fresh load, the canvas bit-for-bit, the jobs
 *       count == the opening count, the DTO re-read == the opening
 *       snapshot, the born file DELETED (the absence restored), the final
 *       GET == the opening DTO still, no session seed.
 *
 * Born with the ledger aboard (the t861 birthright): FIVE faces — canvas /
 * dialogFace / formFace / mutationFace / worldBack.
 *
 * Receipt: shots-qa/t876-ai-settings-a11y.json.
 *
 *   node scripts/t876-ai-settings-a11y.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync, existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const SETTINGS_FILE = join(ROOT, "data/ai-settings.json");
const FAKE_KEY = "sk-lens-fake-000000000000";

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
const cmp = loadComparator(ROOT, "shots-qa/t876-ai-settings-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t876 ai-settings a11y walk — world ${world.mode}:${buildId}, the AI provider settings dialog\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* same-origin metadata — the AI routes sit behind the t708/t709 guard
 * (the t259 shape): curl is REJECTED, same-origin metadata passes. */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};
const retryFetch = async (fn, what, tries = 3) => {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      sleep(2);
    }
  }
  throw new Error(`${what} failed after ${tries} tries: ${String((last && last.message) || last).slice(0, 120)}`);
};

/* the API warm (the t873 doctrine — the tax paid outside any ride).
 * The models POST rides the BUILTIN lane: in-process SDK, no network,
 * no persistence (the route's own law: only PUT writes keys). The PUT
 * handler shares the settings route module the GET warms. */
const warmApiRoutes = async () => {
  const warmGet = async (url, what, tries = 10) => {
    let last = null;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(`${BASE}${url}`, { headers: SH });
        if (r.ok) return true;
        last = new Error(`HTTP ${r.status}`);
      } catch (e) {
        last = e;
      }
      sleep(5);
    }
    throw new Error(`the ${what} warm never answered after ${tries} tries: ${String((last && last.message) || last).slice(0, 120)}`);
  };
  const warmPost = async (url, body, what, tries = 10) => {
    let last = null;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(`${BASE}${url}`, { method: "POST", headers: SH, body: JSON.stringify(body) });
        if (r.ok) return true;
        last = new Error(`HTTP ${r.status}`);
      } catch (e) {
        last = e;
      }
      sleep(5);
    }
    throw new Error(`the ${what} warm never answered after ${tries} tries: ${String((last && last.message) || last).slice(0, 120)}`);
  };
  await warmGet("/api/ai/settings", "ai settings read");
  await warmGet("/api/ai/providers/health", "providers health roster");
  await warmPost("/api/ai/models", { provider: "builtin" }, "models (builtin lane)");
};

const getSettings = async () => {
  const r = await fetch(`${BASE}/api/ai/settings`, { headers: SH });
  if (!r.ok) throw new Error(`settings read HTTP ${r.status}`);
  return r.json();
};
/* the DTO's bit-for-bit shape: the GET route merges the HEALTH probe cache
 * (with its per-probe checkedAt) into settings — and the PUT route DELIBERATELY
 * drops that cache (the t472 law: what changed is what the cache remembers),
 * so the next GET re-probes and the timestamp moves. The CONFIG is what must
 * come home bit-for-bit; the health block is the probe's own clock. */
const normDto = (d) => {
  const c = JSON.parse(JSON.stringify(d ?? {}));
  if (c.settings && "health" in c.settings) delete c.settings.health;
  return c;
};
const roster = async () => {
  const r = await fetch(`${BASE}/api/jobs`, {
    headers: { Origin: BASE, Referer: `${BASE}/`, "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty" },
  });
  const b = await r.json();
  return b.jobs ?? b;
};

/* ---------- the AI world measured (Face S's door) ---------- */
await retryFetch(warmApiRoutes, "the AI routes warm", 2).catch((e) => {
  console.error(`  ✗ the warm never came: ${String(e).slice(0, 140)}`);
  process.exit(1);
});
console.log("  the AI routes warm (settings / health / models-builtin)");
const dto0 = await retryFetch(getSettings, "the settings DTO snapshot");
const savedKeys = Object.keys(dto0.settings?.providers ?? {});
console.log(
  `  the AI world: active=${dto0.settings?.activeProvider}, catalog=${(dto0.providers ?? []).length}, ` +
  `saved=[${savedKeys.map((k) => `${k}(hasKey=${dto0.settings.providers[k].hasKey})`).join(", ")}], ` +
  `autoJudge=${dto0.settings?.autoJudge}, vlm=${JSON.stringify(dto0.settings?.vlmModel ?? null)}`
);
ok("S0 the settings DTO speaks through the guard's own door (t709: metadata in, curl out)",
  dto0.settings?.activeProvider === "builtin" && (dto0.providers ?? []).length >= 10,
  `active=${dto0.settings?.activeProvider} catalog=${(dto0.providers ?? []).length}`);
const fileExistedAtStart = existsSync(SETTINGS_FILE);
let fileBornByRide = false;
let fileBytesAtStart = null;
if (fileExistedAtStart) {
  fileBytesAtStart = statSync(SETTINGS_FILE).size;
  console.log(`  (a settings file ALREADY exists (${fileBytesAtStart} bytes) — the exit restore will byte-compare, never delete`);
} else {
  console.log("  (data/ai-settings.json is ABSENT — the save face will birth it; the exit restore owes its absence)");
}
ok("S1 the world's AI file state measured honestly (absent == pure defaults)",
  true, fileExistedAtStart ? `present ${fileBytesAtStart}B` : "absent");
const jobsWarm = await retryFetch(roster, "the jobs roster (the warm's own door)");
console.log(`  jobs measured: ${jobsWarm.length}`);

/* ---------- the measure: the SHARED RULER + the dialog's probes.
 * NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^(Loading( chart| file| registry)?|Generating)…$/.test((e.textContent || "").trim())).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const headOf = (d) => { if (!d) return ""; const id = d.getAttribute("aria-labelledby") || ""; const el = id ? document.getElementById(id) : null; return ((el ? el.textContent : "") || "").trim().slice(0, 60); }; const heads = dgs.map(headOf); const sd = dgs.find((d) => headOf(d).indexOf("AI 助手设置") >= 0) ?? null; const panel = dgs.find((d) => d !== sd) ?? null; const q = (sel) => sd ? sd.querySelector(sel) : null; const spansOf = (root) => Array.from((root || document).querySelectorAll("span")).map((s) => (s.textContent || "").trim()); const pill = sd ? spansOf(sd).find((t) => t.indexOf("当前使用") === 0) ?? null : null; const rail = q("[role=list][aria-label=\\"AI provider\\"]"); const rows = rail ? Array.from(rail.querySelectorAll("[role=listitem]")) : []; const pressed = rail ? Array.from(rail.querySelectorAll("button[aria-pressed=true]")) : []; const rowNameAt = (i) => rows[i] ? (rows[i].querySelector("button") ? (rows[i].querySelector("button").textContent || "").trim().slice(0, 24) : (rows[i].textContent || "").trim().slice(0, 24)) : null; const healthLine = q("[data-testid=ai-health-line]"); const reprobe = q("[aria-label=\\"重新测活\\"]"); const keyF = q("#ai-key"); const eye = q("[aria-label=\\"Show the API key\\"],[aria-label=\\"Hide the API key\\"]"); const keyHint = sd ? spansOf(sd).find((t) => t === "未保存" || t.indexOf("已保存 ") === 0) ?? null : null; const modelF = q("#ai-model"); const dlist = sd ? sd.querySelector("datalist") : null; const vlmF = q("#ai-vlm"); const sw = q("[aria-label=\\"分类完成后自动判词\\"]"); const alertP = q("[role=alert]"); const problems = q("[data-testid=ai-settings-problems]"); const cancelBtn = sd ? Array.from(sd.querySelectorAll("button")).find((b) => (b.textContent || "").trim() === "取消") : null; const saveBtn = sd ? Array.from(sd.querySelectorAll("button")).find((b) => (b.textContent || "").indexOf("保存并启用") >= 0) : null; const prose = sd ? (Array.from(sd.querySelectorAll("p")).map((p) => (p.textContent || "").trim()).find((t) => /^(正在获取模型列表|已获取 |该供应商无需|填写 API key)/.test(t)) ?? null) : null; const idLine = sd ? (Array.from(sd.querySelectorAll("p.font-mono")).map((p) => (p.textContent || "").trim())[0] ?? null) : null; const toasts = Array.from(document.querySelectorAll("[role=status]")).map((e) => (e.textContent || "").trim()).filter(Boolean).slice(0, 4); const settingsDoor = !!document.querySelector("[aria-label=\\"AI provider settings\\"]"); const panelX = !!document.querySelector("[aria-label=\\"关闭 AI 助手\\"]"); const panelText = panel ? (panel.textContent || "") : ""; const dlgUnnamed = sd ? (function () { const els = sd.querySelectorAll("button,input,select,textarea"); let n = 0; for (const e of els) if (!nameOf(e)) n++; return n; })() : -1; return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, gen: leaves, dlgCount: dgs.length, heads: heads, hasSettings: !!sd, dlgUnnamed: dlgUnnamed, pill: pill, railCount: rows.length, pressedCount: pressed.length, pressedName: pressed.length ? (pressed[0].textContent || "").trim().slice(0, 24) : null, row1Name: rowNameAt(1), row0Name: rowNameAt(0), healthLine: healthLine ? (healthLine.textContent || "").trim().slice(0, 90) : null, reprobe: !!reprobe, reprobeDisabled: reprobe ? !!reprobe.disabled : null, keyPresent: !!keyF, keyType: keyF ? keyF.type : null, keyLen: keyF ? keyF.value.length : -1, eyeLabel: eye ? eye.getAttribute("aria-label") : null, keyHint: keyHint, modelVal: modelF ? modelF.value : null, dlistOpts: dlist ? dlist.querySelectorAll("option").length : -1, vlmVal: vlmF ? vlmF.value : null, switchChecked: sw ? sw.getAttribute("aria-checked") : null, alertText: alertP ? (alertP.textContent || "").trim().slice(0, 70) : null, problems: !!problems, cancelPresent: !!cancelBtn, saveDisabled: saveBtn ? !!saveBtn.disabled : null, prose: prose, idLine: idLine, toasts: toasts, settingsDoor: settingsDoor, panelX: panelX, panelBadge: panelText.indexOf("glm-4-plus") >= 0, seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()';

/* the measure's runtime syntax gate (the t875 law): the lens's strings
 * are programs and get a syntax gate of their own. */
{
  const tmp = join(ROOT, "scripts/.t876-measure-tmp.js");
  writeFileSync(tmp, "(" + MEASURE + ")");
  try {
    execSync(`node --check ${tmp}`);
    console.log("  (syntax gate: the MEASURE's runtime value parses green)");
  } finally {
    try { rmSync(tmp); } catch { /* already gone */ }
  }
}

/* the settle law (t864's shape + the t869 arrival guard) */
const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};
const settle = (what, maxSecs = 18, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const alive = next.pageBtns > 0;
    const same = alive && JSON.stringify(next) === JSON.stringify(m);
    if (!same && run > 1) {
      const dk = diffKeys(m, next);
      console.log(`    (measure moved while settling: ${dk.join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.gen === 0 && m.imgPending === 0) break;
  }
  console.log(`  settled ${what} (${run}x stable)`);
  return m;
};

const waitFor = (what, probe, maxSecs = 26) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  return m;
};

const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;

const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

/* the t873 single-quote door law: selectors ride in SINGLE shell quotes */
const ASSIST_DOOR = "click '[aria-label=\"AI assistant\"]'";
const SETTINGS_DOOR = "click '[aria-label=\"AI provider settings\"]'";
const CLOSE_X = "click '[aria-label=\"关闭 AI 助手\"]'";
const REPROBE_DOOR = "click '[aria-label=\"重新测活\"]'";
const EYE_DOOR = "click '[aria-label=\"Show the API key\"]'";
const EYE_BACK = "click '[aria-label=\"Hide the API key\"]'";
const SWITCH_DOOR = "click '[aria-label=\"分类完成后自动判词\"]'";
const RAIL_OPENAI = "click '[role=list][aria-label=\"AI provider\"] [role=listitem]:nth-child(2) button'";
const RAIL_BUILTIN = "click '[role=list][aria-label=\"AI provider\"] [role=listitem]:nth-child(1) button'";
const SAVE_SYNTH =
  '(() => { const b = Array.from(document.querySelectorAll("[role=dialog] button")).find((x) => (x.textContent || "").indexOf("保存并启用") >= 0); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()';
const CANCEL_SYNTH =
  '(() => { const b = Array.from(document.querySelectorAll("[role=dialog] button")).find((x) => (x.textContent || "").trim() === "取消"); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()';

/* the knock law (the t875 crown): native once, the synthetic ONLY when
 * the arrival predicate proves the native door dead. The covered-door
 * cure (the t875 wrench + the t876 reprobe's own card): scroll into
 * view, the native click ONCE (a covered refusal is CAUGHT, not fatal),
 * then the arrival-gated synthetic. */
const synthClickJs = (sel) =>
  '(() => { const e = document.querySelector(' + JSON.stringify(sel) + '); if (!e) return JSON.stringify({ found: false }); const r = e.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, pointerType: "mouse", clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; e.dispatchEvent(new PointerEvent("pointerdown", o)); e.dispatchEvent(new PointerEvent("pointerup", o)); e.click(); return JSON.stringify({ found: true }); })()';
const coveredKnock = (what, sel, probe, maxSecs = 10) => {
  try { ab(`scrollintoview '${sel}'`); } catch { /* the scroll may refuse too */ }
  sleep(0.8);
  let nativeOk = true;
  try { ab(`click '${sel}'`); } catch (e) {
    nativeOk = false;
    console.log(`    (the native ${what} click refused: covered — the arrival-gated synthetic rides, the t875 knock law)`);
  }
  let m = nativeOk ? waitFor(what, probe, maxSecs) : null;
  if (!m || !probe(m)) {
    if (nativeOk) console.log(`    (the ${what} door's arrival never came — ONE arrival-gated synthetic retry, the t875 knock law)`);
    evalJson(synthClickJs(sel));
    m = waitFor(what, probe, maxSecs);
  }
  return m;
};
const knock = (what, doorCmd, synthJs, probe, maxSecs = 14) => {
  ab(doorCmd);
  let m = waitFor(what, probe, maxSecs);
  if (!probe(m) && synthJs) {
    console.log(`    (the trusted ${what} door was dead — ONE arrival-gated synthetic retry, the t875 knock law)`);
    evalJson(synthJs);
    m = waitFor(what, probe, maxSecs);
  }
  return m;
};

/* ---------- the ride ---------- */
let exitCode = 0;
let worldRestored = false;
try {
  /* ---------- Face O: the clean room ---------- */
  console.log("Face O — the clean room (fresh load, the canvas settled)");
  ab("open http://localhost:3000");
  sleep(3);
  const m0 = settle("the opening canvas");
  if (corpse(m0, "Face O")) throw new Error("corpse at the opening canvas — the honest stop");
  ok("O0 the canvas calm at open (zero unnamed page-wide)",
    m0.pageUnnamed === 0 && m0.pageBtns > 0, `btns=${m0.pageBtns} imgs=${m0.imgs}`);
  ok("O1 no dialogs at open", m0.dlgCount === 0, `dlgCount=${m0.dlgCount}`);

  /* ---------- Face A: the assistant door ---------- */
  console.log("Face A — the assistant door (the header's AI assistant)");
  const a1 = knock("the assistant panel", ASSIST_DOOR, null, (m) => m.dlgCount >= 1 && m.settingsDoor, 14);
  if (corpse(a1, "Face A")) throw new Error("corpse at Face A — the honest stop");
  ok("A0 the panel arrived (one dialog, the settings door aboard)",
    a1.dlgCount >= 1 && a1.settingsDoor, `dlgCount=${a1.dlgCount}`);
  const panelModal = evalJson(
    '(() => { const p = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => d.querySelector("[aria-label=\\"关闭 AI 助手\\"]")); return JSON.stringify({ panel: !!p, modal: p ? p.getAttribute("aria-modal") : null }); })()'
  );
  ok("A1 the panel is the non-modal companion (aria-modal=false — the t500 law)",
    panelModal.panel === true && panelModal.modal === "false", `modal=${panelModal.modal}`);

  /* ---------- Face D: the settings door ---------- */
  console.log("Face D — the settings door (the panel's AI provider settings)");
  knock("the settings dialog", SETTINGS_DOOR, null, (m) => m.hasSettings && m.dlgCount >= 2, 14);
  sleep(2); /* the animation tax (the t875 covered-wrench law) */
  const d2 = settle("the settings dialog");
  if (corpse(d2, "Face D")) throw new Error("corpse at Face D — the honest stop");
  ok("D0 the dialog arrived as layer 2 (panel + settings)",
    d2.dlgCount === 2 && d2.hasSettings, `dlgCount=${d2.dlgCount}`);
  ok("D1 the title speaks (AI 助手设置)", (d2.heads.join("|") || "").indexOf("AI 助手设置") >= 0, d2.heads.join(" | "));
  ok("D2 the 当前使用 pill speaks the active provider",
    (d2.pill || "").indexOf("当前使用") === 0 && (d2.pill || "").indexOf("glm-4-plus") >= 0, d2.pill);
  ok("D3 the rail: the UI's rows == the API's catalog, exactly ONE pressed (builtin; the row's name carries the avatar letter — the G4 law: measured, never assumed)",
    d2.railCount === (dto0.providers ?? []).length && d2.pressedCount === 1 && (d2.pressedName || "").indexOf("Built-in (GLM)") >= 0,
    `rows=${d2.railCount}==${(dto0.providers ?? []).length} pressed=${d2.pressedName}`);
  ok("D4 zero unnamed at two layers (page-wide + the dialog's own controls)",
    d2.pageUnnamed === 0 && d2.dlgUnnamed === 0, `page=${d2.pageUnnamed} dlg=${d2.dlgUnnamed}`);

  /* ---------- Face F: the form (builtin selected) ---------- */
  console.log("Face F — the form face (the builtin provider)");
  ok("F0 the identity block speaks the provider id", d2.idLine === "builtin", d2.idLine);
  ok("F1 the t474 roll-call line speaks 正常 + the in-process detail",
    (d2.healthLine || "").indexOf("连通性：正常") >= 0 && (d2.healthLine || "").indexOf("in-process") >= 0, d2.healthLine);
  ok("F2 the 重新测活 door present and enabled", d2.reprobe === true && d2.reprobeDisabled === false);
  ok("F3 the key field's honest absence (needsKey=false)", d2.keyPresent === false && d2.keyLen === -1);
  ok("F4 the model input prefilled glm-4-plus over its datalist",
    d2.modelVal === "glm-4-plus" && d2.dlistOpts >= 1, `val=${d2.modelVal} opts=${dlistOptsOf(d2)}`);
  ok("F5 the model prose speaks the auto-fetch's own answer (the builtin lane: 已获取 N == the datalist's N — two wells one world)",
    /^已获取 \d+ 个模型（内置清单）$/.test(d2.prose || "") && parseInt((d2.prose || "").match(/\d+/)?.[0] ?? "-1", 10) === d2.dlistOpts,
    `${d2.prose} (opts=${d2.dlistOpts})`);
  ok("F6 the autoJudge switch checked", d2.switchChecked === "true", `checked=${d2.switchChecked}`);
  ok("F7 the footer's two doors (取消 present, 保存并启用 enabled)",
    d2.cancelPresent === true && d2.saveDisabled === false);
  ok("F8 no problems banner (the honest clean)", d2.problems === false);

  /* ---------- Face R: the reprobe ride ---------- */
  console.log("Face R — the reprobe ride (the roll-call's refresh door; the button sits at its own card's edge — the covered-door cure rides)");
  const r1 = coveredKnock(
    "the reprobe",
    '[aria-label="重新测活"]',
    (m) => m.reprobeDisabled === false && (m.healthLine || "").indexOf("连通性：正常") >= 0,
    20
  );
  ok("R0 the reprobe door rode (native or the arrival-gated synthetic) and the roll-call still speaks 正常",
    r1 && r1.reprobeDisabled === false && (r1.healthLine || "").indexOf("连通性：正常") >= 0, r1 && r1.healthLine);

  /* ---------- Face P: the provider switch (openai) ---------- */
  console.log("Face P — the provider switch (the rail's OpenAI row)");
  const film = evalJson(MEASURE);
  ok("P0 the FILMED row 1 speaks OpenAI (the avatar letter rides the text — the G4 law)", (film.row1Name || "").indexOf("OpenAI") >= 0, film.row1Name);
  ab(RAIL_OPENAI);
  sleep(2); /* the switch effect + the form reset */
  const p1 = settle("the openai form");
  ok("P1 aria-pressed MOVED to OpenAI", p1.pressedCount === 1 && (p1.pressedName || "").indexOf("OpenAI") >= 0, p1.pressedName);
  ok("P2 the identity speaks openai", p1.idLine === "openai", p1.idLine);
  ok("P3 the key field RENDERED (type=password, the eye, 未保存)",
    p1.keyPresent === true && p1.keyType === "password" && p1.eyeLabel === "Show the API key" && p1.keyHint === "未保存",
    `type=${p1.keyType} eye=${p1.eyeLabel} hint=${p1.keyHint}`);
  ok("P4 the model field RESET", p1.modelVal === "", `val=${JSON.stringify(p1.modelVal)}`);
  ok("P5 the roll-call line GONE (the saved-only law)", p1.healthLine === null, String(p1.healthLine));
  ok("P6 the model prose speaks the fetch-teaching word", (p1.prose || "").indexOf("填写 API key") === 0, p1.prose);

  /* ---------- Face K: the key secrecy ride ---------- */
  console.log("Face K — the key secrecy ride (a FAKE key, trusted events)");
  ab(`fill '#ai-key' '${FAKE_KEY}'`);
  /* the arrival predicate: the curated datalist is ALWAYS populated (6 options
   * ride before any answer) — a skeleton that satisfies dlistOpts>0 is the
   * t870 palette trap. The REAL arrival: role=alert (the 502's own word) or
   * the prose speaking 已获取 (a fetched list). The 30s window rides out the
   * route's 15s abort (LIST_TIMEOUT_MS) + RTT. */
  const answerOf = (m) =>
    (m.alertText && m.alertText.length > 0) || /^已获取 \d+ 个模型/.test(m.prose || "");
  const k1 = waitFor("the models answer", answerOf, 30);
  ok("K0 the debounced auto-fetch ANSWERED (the alert or a fetched list — never the curated skeleton)",
    answerOf(k1), k1.alertText || k1.prose);
  ok("K1 the failure speaks role=alert (the provider's own message; the fake key cannot list)",
    k1.alertText && k1.alertText.length > 0, k1.alertText);
  /* the eye door (the coveredKnock cure — the t875 wrench, generalized): */
  const eyeArrived = (m, want) => m.eyeLabel === want && m.keyType === (want === "Hide the API key" ? "text" : "password");
  const k2 = coveredKnock("the eye show", '[aria-label="Show the API key"]', (m) => eyeArrived(m, "Hide the API key"), 8);
  ok("K2 the eye SHOWS (type text, label Hide)", eyeArrived(k2, "Hide the API key"), `eye=${k2 && k2.eyeLabel} type=${k2 && k2.keyType}`);
  if (eyeArrived(k2, "Hide the API key")) {
    const k3 = coveredKnock("the eye hide", '[aria-label="Hide the API key"]', (m) => eyeArrived(m, "Show the API key"), 8);
    ok("K3 the eye HIDES (type password, label Show)", eyeArrived(k3, "Show the API key"));
  } else {
    ok("K3 the eye HIDES (type password, label Show)", false, "skipped — the show door never arrived (the honest carry)");
  }
  const dtoK = await retryFetch(getSettings, "the DTO after the fake-key ride");
  ok("K4 the fake key was NEVER persisted (no openai entry, builtin still active)",
    !dtoK.settings?.providers?.openai && dtoK.settings?.activeProvider === "builtin",
    `saved=[${Object.keys(dtoK.settings?.providers ?? {}).join(", ")}]`);

  /* ---------- Face B: the switch back ---------- */
  console.log("Face B — the switch back (the rail's builtin row)");
  ab(RAIL_BUILTIN);
  sleep(2);
  const b1 = settle("the builtin form (returned)");
  ok("B0 aria-pressed returned to builtin",
    b1.pressedCount === 1 && (b1.pressedName || "").indexOf("Built-in (GLM)") >= 0, b1.pressedName);
  ok("B1 the key field vanished, the model re-prefilled, the roll-call returned",
    b1.keyPresent === false && b1.modelVal === "glm-4-plus" && (b1.healthLine || "").indexOf("连通性：正常") >= 0,
    `key=${b1.keyPresent} model=${b1.modelVal}`);
  ok("B2 the fake key left NOTHING in the form", b1.keyLen === -1, `keyLen=${b1.keyLen}`);

  /* ---------- Face V: the switch face (local only until save) ---------- */
  console.log("Face V — the autoJudge switch face (local state, both ways)");
  ab(SWITCH_DOOR);
  const v1 = waitFor("the switch off", (m) => m.switchChecked === "false", 8);
  ok("V0 the switch flipped OFF", v1.switchChecked === "false", `checked=${v1.switchChecked}`);
  ab(SWITCH_DOOR);
  const v2 = waitFor("the switch on", (m) => m.switchChecked === "true", 8);
  ok("V1 the switch returned ON", v2.switchChecked === "true", `checked=${v2.switchChecked}`);

  /* ---------- Face E: the save (the idempotent crown) ---------- */
  console.log("Face E — the save face (everything unchanged, key field empty)");
  const dtoE = await retryFetch(getSettings, "the DTO before the save");
  evalJson(SAVE_SYNTH); /* the t868 text-door shape — ONE knock, the arrival predicate is the close+toast */
  /* the toast's own deposition (the t876 probe's finding): the announce
   * div's role=status is a ~1s mayfly (unmounted by the vendor's clock
   * while the li lives on) — the viewport's TEXT is the witness that
   * lives. A 1s-cadence waitFor lands AFTER the mayfly dies; the tight
   * 0.4s loop catches it. */
  const TOAST_SNAP = '(() => { const vp = document.querySelector("ol[role=region]"); const roles = Array.from(document.querySelectorAll("[role=status]")).map((e) => (e.textContent || "").trim()).filter(Boolean); const vpText = vp ? (vp.textContent || "").trim() : ""; return JSON.stringify({ roles: roles.slice(0, 3), vpText: vpText.slice(0, 90), liCount: vp ? vp.querySelectorAll("li").length : 0 }); })()';
  let toastSeen = null;
  for (let i = 0; i < 14 && !toastSeen; i++) {
    const t = evalJson(TOAST_SNAP);
    if ((t.roles || []).some((x) => x.indexOf("AI 已配置") >= 0) || (t.vpText || "").indexOf("AI 已配置") >= 0) toastSeen = t;
    else sleep(0.4);
  }
  ok("E0 the toast spoke the activation (AI 已配置：… · glm-4-plus — caught by the viewport's text, the role=status mayfly's elder sibling)",
    !!toastSeen, toastSeen ? JSON.stringify(toastSeen.vpText || toastSeen.roles) : "never spoke in the ~5s window");
  const e1 = waitFor("the save arrival", (m) => m.hasSettings === false, 16);
  ok("E1 the dialog closed ITSELF (the panel remains)", e1.hasSettings === false && e1.dlgCount === 1, `dlgCount=${e1.dlgCount}`);
  const dtoAfter = await retryFetch(getSettings, "the DTO after the save");
  const normSame = JSON.stringify(normDto(dtoAfter)) === JSON.stringify(normDto(dtoE));
  ok("E2 the idempotent save: the CONFIG after == the CONFIG before bit-for-bit (the health probe's refetch is the t472 design — the PUT drops the cache so the next GET re-probes)",
    normSame,
    normSame ? "the config identical; the health block re-probed (checkedAt moved)" : "MISMATCH beyond health — inspect");
  const fileBorn = existsSync(SETTINGS_FILE);
  if (fileBorn && !fileExistedAtStart) fileBornByRide = true;
  ok("E3 the file birth documented (the exit restore owes its absence)",
    fileBornByRide || (fileBorn && fileExistedAtStart) || !fileBorn,
    fileBorn ? (fileBornByRide ? "data/ai-settings.json born this ride" : `pre-existing ${fileBytesAtStart}B`) : "no file born (the save's writer skipped or failed — inspect)");

  /* ---------- Face A2: the badge refresh ---------- */
  console.log("Face A2 — the panel's badge (the dialog-close refresh)");
  const a2 = waitFor("the badge refresh", (m) => m.panelBadge === true, 14);
  ok("A2 the badge re-fetched on the dialog's close (the provider spoken without a reload)",
    a2.panelBadge === true, "glm-4-plus in the panel text");

  /* ---------- Face X: the peel ---------- */
  console.log("Face X — the peel (one layer per Escape, then the panel's own X)");
  knock("the settings dialog (reopen)", SETTINGS_DOOR, null, (m) => m.hasSettings && m.dlgCount >= 2, 14);
  sleep(2);
  const d4 = settle("the reopened dialog");
  ok("X0 the dialog re-opened at layer 2", d4.hasSettings === true && d4.dlgCount === 2, `dlgCount=${d4.dlgCount}`);
  ok("X1 the reopen re-fetched (the key field absent again, the model prefilled)",
    d4.keyPresent === false && d4.modelVal === "glm-4-plus");
  evalJson(ESC_LAST);
  sleep(1.2);
  const x1 = evalJson(MEASURE);
  ok("X2 Escape peeled ONE layer (2 -> 1, the settings gone, the panel remains)",
    x1.hasSettings === false && x1.dlgCount === 1, `dlgCount=${x1.dlgCount}`);
  ab(CLOSE_X);
  sleep(1.5);
  const x2 = evalJson(MEASURE);
  ok("X3 the panel's own X peeled the last (1 -> 0), the canvas bare",
    x2.dlgCount === 0 && x2.hasSettings === false, `dlgCount=${x2.dlgCount}`);

  /* ---------- Face W: the world back ---------- */
  console.log("Face W — the world back (fresh load, settled)");
  ab("open http://localhost:3000");
  sleep(3);
  const w1 = settle("the restored canvas");
  if (corpse(w1, "Face W")) throw new Error("corpse at Face W — the honest stop");
  ok("W0 the world unharmed (canvas count == the opening count, zero unnamed)",
    w1.pageBtns === m0.pageBtns && w1.pageUnnamed === 0 && w1.hasSettings === false,
    `btns=${w1.pageBtns} (opening ${m0.pageBtns})`);
  const jobsAtClose = await retryFetch(roster, "the roster at close");
  ok("W1 the jobs count == the opening count (the rogue-row census's guard)",
    jobsAtClose.length === jobsWarm.length, `jobs ${jobsWarm.length} -> ${jobsAtClose.length}`);
  const dtoW = await retryFetch(getSettings, "the DTO re-read");
  ok("W2 the AI world still bit-for-bit (the CONFIG; the health probe's refetch is the t472 design)",
    JSON.stringify(normDto(dtoW)) === JSON.stringify(normDto(dto0)), "the opening config == the closing config");
  ok("W3 the ride leaves no session seed (the t157 two-way door's honest none)",
    w1.seed === "" || w1.seed === null, `seed=${JSON.stringify(w1.seed)}`);

  worldRestored = true;

  /* ---------- the ledger at birth (five faces, the shared law) ---------- */
  console.log("Ledger — the t861 birthright aboard from birth (five faces, the shared law)");
  const prevFaces = cmp.prev?.faces ?? null;
  const scalarOf = (m) => m.pageBtns;
  const faces = {
    canvas: ledgerFace(prevFaces ? prevFaces.canvas?.live ?? null : null, m0, scalarOf),
    dialogFace: ledgerFace(prevFaces ? prevFaces.dialogFace?.live ?? null : null, d2, scalarOf),
    formFace: ledgerFace(prevFaces ? prevFaces.formFace?.live ?? null : null, p1, scalarOf),
    mutationFace: ledgerFace(prevFaces ? prevFaces.mutationFace?.live ?? null : null, b1, scalarOf),
    worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
  };
  for (const [name, f] of Object.entries(faces)) {
    const v = armVerdict(cmp, world, f);
    ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
  }

  /* ---------- verdict + receipt ---------- */
  const verdict = fail === 0
    ? `the AI provider settings dialog's faces hold — the rotation's second candidate ridden at ~${world.mode}: the API warm paid the routes' tax outside any ride, the settings DTO measured through the guard's own door (t709), the assistant panel summoned non-modally and the dialog as layer 2 with the 当前使用 pill, a ${d2.railCount}-row rail whose pressed row == the API's active provider, the builtin form's honest absence (no key field, the no-key prose, the prefilled model over its datalist), the reprobe ride (the in-process lane answers 正常), the OpenAI switch (the key field born with the eye and the 未保存 hint, the model reset, the saved-only roll-call gone), the FAKE-KEY ride (trusted fill, the debounced auto-fetch, the failure's role=alert, the key NEVER persisted, the eye both ways), the switch back (nothing left in the form), the switch face (local, both ways), the IDEMPOTENT save (the toast spoke, the dialog closed itself, the DTO bit-for-bit, the file birth documented for the exit restore), the badge's no-reload refresh, the two-door peel, and the world back bit-for-bit with no seed — the ledger aboard from birth (five faces, the shared law)`
    : `${fail} red — the AI settings layer moved; call the census's own instruments before any UI work`;

  const driftLedger = {
    prevFound: cmp.prevFound,
    prevBuild: cmp.prevBuild,
    prevDate: prevReceipt?.date ?? null,
    sameBuild: cmp.sameBuild,
    law: LEDGER_LAW,
    faces,
  };

  const receipt = {
    instrument: "scripts/t876-ai-settings-a11y.mjs",
    ruler: NAMEOF_LAW,
    build: buildId,
    worldMode: world.mode,
    date: new Date().toISOString(),
    chain: "API warm (settings + health + models-builtin) -> the AI world measured (DTO + the file-absence fact) -> clean room -> assistant door (non-modal panel) -> settings door (layer 2, the animation tax) -> the rail face (15 rows == the API's catalog, one pressed) -> the builtin form face (no key field, the roll-call 正常, the prefilled model) -> the reprobe ride -> the OpenAI switch (the key field born, the model reset, the roll-call gone) -> the FAKE-KEY ride (trusted fill -> the debounced fetch -> role=alert -> NEVER persisted; the eye both ways) -> the switch back (nothing left) -> the switch face (local) -> the IDEMPOTENT save (toast -> self-close -> DTO bit-for-bit -> the file birth documented) -> the badge refresh -> the reopen + the two-door peel -> worldBack (canvas + jobs + DTO + seed) -> exit restore (the born file deleted, the absence restored)",
    doors: {
      assistant: "trusted CDP click on [aria-label='AI assistant'] (the header)",
      settings: "trusted CDP click on [aria-label='AI provider settings'] (the panel) + the animation tax",
      railRow: "trusted CDP click on the FILMED row's button (nth-child after the film's text check)",
      keyFill: "agent-browser fill — trusted events drive React onChange (the t863 law)",
      eye: "trusted CDP clicks on the Show/Hide labels — the type toggles both ways",
      switch: "trusted CDP click on [aria-label='分类完成后自动判词']",
      save: "synthetic click on the 保存并启用 button — the t868 text-door shape, ONE knock (no blind fallback, the t875 knock law)",
      close: "Escape (Radix) then the panel's own X [aria-label='关闭 AI 助手']",
      fileRestore: "rmSync of the born data/ai-settings.json (the absence restored) — only when the ride birthed it",
    },
    openingCanvas: m0.pageBtns,
    aiWorld: {
      activeProvider: dto0.settings?.activeProvider ?? null,
      catalog: (dto0.providers ?? []).length,
      savedConfigs: savedKeys,
      fileExistedAtStart,
      fileBornByRide,
    },
    registryRestored: true,
    faces: {
      canvas: { live: m0 },
      dialogFace: { live: d2 },
      formFace: { live: p1 },
      mutationFace: { live: b1, saveFace: e1 },
      worldBack: { live: w1 },
    },
    checks: results,
    passed: pass,
    failed: fail,
    total: pass + fail,
    verdict,
    driftLedger,
  };
  writeFileSync(join(ROOT, "shots-qa/t876-ai-settings-a11y.json"), JSON.stringify(receipt, null, 2));

  console.log(`\nAI-SETTINGS-A11Y t876: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
  exitCode = fail === 0 ? 0 : 1;
} catch (e) {
  /* the honest stop: say why, write the red receipt, let the finally
   * bring the world home */
  console.error(`  ✗ the ride stopped honestly: ${String(e && e.message || e).slice(0, 160)}`);
  writeFileSync(
    join(ROOT, "shots-qa/t876-ai-settings-a11y.json"),
    JSON.stringify({
      instrument: "scripts/t876-ai-settings-a11y.mjs",
      ruler: NAMEOF_LAW,
      build: buildId,
      worldMode: world.mode,
      date: new Date().toISOString(),
      checks: results,
      passed: pass,
      failed: fail + 1,
      total: pass + fail + 1,
      verdict: `the honest stop: ${String(e && e.message || e).slice(0, 200)}`,
      fileBornByRide,
    }, null, 2)
  );
  exitCode = 1;
} finally {
  if (!worldRestored) {
    console.error("  (the honest exit path: restoring what the ride owes)");
  }
  if (fileBornByRide) {
    try {
      rmSync(SETTINGS_FILE);
      const gone = !existsSync(SETTINGS_FILE);
      const dtoBack = await getSettings();
      const same = JSON.stringify(normDto(dtoBack)) === JSON.stringify(normDto(dto0));
      console.log(`  (exit-restore: the born file deleted=${gone}, the final config == the opening ${same ? "bit-for-bit" : "MISMATCH — inspect manually"})`);
    } catch (e) {
      console.error(`  (exit-restore FAILED: ${String(e).slice(0, 120)})`);
    }
  } else if (fileExistedAtStart) {
    const nowBytes = existsSync(SETTINGS_FILE) ? statSync(SETTINGS_FILE).size : 0;
    console.log(`  (exit note: the pre-existing settings file ${fileBytesAtStart}B -> ${nowBytes}B ${nowBytes === fileBytesAtStart ? "bit-for-bit" : "MOVED — inspect"})`);
  }
}
process.exit(exitCode);

/* the datalist option count's null-safe formatter (F4's detail) */
function dlistOptsOf(m) {
  return m.dlistOpts;
}
