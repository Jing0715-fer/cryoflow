#!/usr/bin/env node
/**
 * t990 — the ARCHIVED-FACE WALK + the SE-GRIP RAISE WITNESS (the t989
 * entry's candidates ① and ②, folded): two carried planes, one window.
 *
 *   legs 2–3  THE RESIZE GRIPS' RAISE (the committed t990 cure — the
 *             cosmetic's sibling): the AI-settings dialog summoned from
 *             INSIDE the companion buries the window; a pointerdown on
 *             the SE grip + the FIRST REAL MOVE raises the window ABOVE
 *             the dialog MID-DRAG and the resize itself lands (w/h grow
 *             by the gesture); the round trip restores the geometry
 *             byte-identically, the companion interaction never
 *             dismisses the dialog (the t501 contract), and the window
 *             keeps the front after the release;
 *   leg 5     THE t395 ARCHIVED GENERATION FACES — the self row's second
 *             group, never witnessed live: the walk's fixture writes a
 *             REMOTE run record (the mock cluster's own lane) and crafts
 *             `.cryoflow_prev/<epoch>/` inside the mock's fs — the live
 *             tree exists but is EMPTY (the re-dispatch moved everything
 *             aside), so the self row hides (the designed absence) and
 *             the ARCHIVED row blooms: "This job · previous run" + the
 *             archived chip + the violet cluster badge + the "moved
 *             aside by a re-dispatch" explainer + the "2 rounds" chip +
 *             the it005 complete round (pickable, newest, the cluster
 *             path INSIDE the archive) and the it003 optimiser-only
 *             round (the completeness law rides the archive too — shown
 *             but disabled, the torn-flush refusal inside the archive);
 *   leg 6     cleanup + world honesty — the record and the mock-fs tree
 *             swept, the face pristine, nineteen jobs, the standing
 *             eighteen untouched by a byte-identical fingerprint.
 *
 * RIDE LAWS inherited: WIDE-FIRST; the palette's ENTER mouth; the
 * FOCUS GATE; the CONDITIONAL Escape; the companion closes through
 * [aria-label="关闭 AI 助手"] + a shut poll; the popover is
 * [aria-label="Rounds you can continue from"] and dialogs are
 * [data-slot="dialog-content"]; fresh `agent-browser open` before every
 * rider; **the t989 birth laws** — the api-body proof (an edge/record
 * POST is followed by an exists-read), the lane-badge read (the badge
 * speaks the record's lane — the archived row rides the MOCK cluster and
 * speaks /projects/... paths), the probe-before-theory (the phase trace
 * rides the receipt); fixture mutations re-read through the popover's
 * own refresh button (?refresh=1 — both TTLs bypassed).
 *
 *   node scripts/t990-archived-face-walk.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t990-archived-face-walk.json");
const FACE_NAME = "Rounds Face (t989)";
const FACE_ID = "cmv86xfmq0001usha0t85mcfb";
const PROJECT_ID = "cmv79wd4e0000usbucn0sncqa";
const REMOTE_WORKDIR = `/projects/cryoflow/${PROJECT_ID}/refine3d_${FACE_ID.slice(-8)}`;
const MOCK_FS_WORKDIR = path.join(ROOT, "services", "mock-cluster", "fs", "projects", "cryoflow", PROJECT_ID, `refine3d_${FACE_ID.slice(-8)}`);
const MOCK_FS_PREV = path.join(MOCK_FS_WORKDIR, ".cryoflow_prev");
const GEN = "1749930000000";
const GEN_DIR = path.join(MOCK_FS_PREV, GEN);
const STATE_FILE = path.join(ROOT, "data", "engine-state.json");

let pass = 0, fail = 0;
const results = [];
const phaseTrace = [];
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
  results.push({ label, ok: !!cond, extra });
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim(); } catch (e) { return String(e?.stdout ?? e); } };
function evalJs(expr) {
  try { return execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim(); }
  catch (e) { return String(e?.stdout ?? "") || "null"; }
}
function evalJson(expr) {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
}
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && v !== "null" && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [4, 10, 20]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) {
      evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
      await sleep(500);
      const pos2 = evalJson(locate);
      if (pos2 && pos2.own) {
        sh(`${AB} mouse move ${pos2.x} ${pos2.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
        return `clicked@${pos2.x},${pos2.y}`;
      }
      return "OFF-VIEWPORT";
    }
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    await sleep(400);
  }
  return "NEVER-OWN";
};
const shot = (name) => sh(`${AB} screenshot ${path.join(QA_DIR, name)}`);

console.log("=== t990 archived-face walk ===");

/* the server-first law */
let serverUp = false;
for (let i = 0; i < 24 && !serverUp; i++) {
  try { const c = execSync(`curl -s -o /dev/null -w '%{http_code}' ${BASE}/ --max-time 5`, { encoding: "utf8" }); serverUp = c.trim() === "200"; }
  catch { serverUp = false; }
  if (!serverUp) await sleep(2500);
}
if (!serverUp) { console.log("FATAL: the server never answered 200"); process.exit(2); }
console.log("server: 200");
/* the standing world's fingerprint, captured BEFORE any leg rides */
const api = (method, url, body) => execSync(`curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`, { encoding: "utf8", timeout: 30_000 });
let standingBody = null;
try { standingBody = JSON.parse(api("GET", "/api/jobs")); } catch { standingBody = null; }
const standingArr = Array.isArray(standingBody) ? standingBody : standingBody?.jobs ?? [];
const standingFingerprint = standingArr
  .filter((j) => j.name !== FACE_NAME)
  .map((j) => `${j.id}:${j.status}:${j.name}`)
  .sort()
  .join("|");

/* LEG 1 — the fresh open (the WIDE-FIRST law, executable) */
console.log("leg 1: the fresh open (wide-first)");
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
const alive = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);
const companionShut = await poll(
  `(() => { const b = document.querySelector('[aria-label="关闭 AI 助手"]'); if (!b) return JSON.stringify({ shut: true }); const r = b.getBoundingClientRect(); return JSON.stringify({ shut: r.width === 0 }); })()`,
  (v) => v.shut, 4, 400);
ok("the companion is shut (the ride plane is clear)", !!companionShut && companionShut.shut);

/* LEG 2 — the companion + the burial (the t989 grammar, executable) */
console.log("leg 2: the companion, the AI-settings dialog, the burial");
const openDoor = await realClick(`[...document.querySelectorAll('button[aria-label="AI assistant"]')].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the companion summoned through the header's own door", String(openDoor).startsWith("clicked@"), String(openDoor));
const compUp = await poll(
  `(() => { const r = document.querySelector('[data-companion-window]'); return JSON.stringify({ up: !!r && r.getBoundingClientRect().width > 0 }); })()`,
  (v) => v.up, 12, 500);
ok("the companion window is up (the body-level citizen)", !!compUp && compUp.up);
const setDoor = await realClick(`[...document.querySelectorAll('button[aria-label="AI provider settings"]')].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the AI-settings door clicked (a companion-summoned dialog)", String(setDoor).startsWith("clicked@"), String(setDoor));
const dlgUp = await poll(
  `(() => { const d = [...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ up: !!d }); })()`,
  (v) => v.up, 20, 500);
ok("the settings dialog is up (the shared DialogContent plane)", !!dlgUp && dlgUp.up);
const buried = await poll(
  `(() => { const root = document.querySelector('[data-companion-window]'); const dlg = [...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ rootUp: !!root && root.getBoundingClientRect().width > 0, dlgUp: !!dlg && dlg.getBoundingClientRect().width > 0, buried: !!root && !!dlg && document.body.lastElementChild !== root }); })()`,
  (v) => v.rootUp && v.dlgUp && v.buried, 16, 500);
ok("THE BURIAL IS REAL (the dialog keeps the front — lastElementChild is not the companion)",
  !!buried && buried.buried === true);
shot("t990-buried.png");

/* LEG 3 — THE SE-GRIP RAISE WITNESS (the t990 cure, met rendered) */
console.log("leg 3: the SE-grip raise witness (raise rides the first real move of a RESIZE)");
const gripPoint = evalJson(
  `(() => { const root = document.querySelector('[data-companion-window]'); if (!root) return JSON.stringify({ up: false }); const grip = root.querySelector('.cursor-nwse-resize'); if (!grip) return JSON.stringify({ up: false, grip: false }); const r = grip.getBoundingClientRect(); const x = Math.round(r.x + r.width / 2); const y = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(x, y); return JSON.stringify({ up: true, x, y, own: !!hit && grip.contains(hit) }); })()`);
ok("the SE grip answers at its center (the corner affordance, topmost at the corner)",
  !!gripPoint && gripPoint.up && gripPoint.own === true, `point=${gripPoint?.x},${gripPoint?.y}`);
const geoBefore = evalJson(
  `(() => { const root = document.querySelector('[data-companion-window]'); return JSON.stringify({ w: parseFloat(root?.style?.width ?? \"NaN\"), h: parseFloat(root?.style?.height ?? \"NaN\") }); })()`);
/* the round-trip resize: down at the grip → +14px (the first REAL MOVE —
 * the raise fires) → the MID-DRAG read → back → up (w/h end identical) */
sh(`${AB} mouse move ${gripPoint.x} ${gripPoint.y}`);
sh(`${AB} mouse down`);
await sleep(150);
sh(`${AB} mouse move ${gripPoint.x + 14} ${gripPoint.y + 14}`);
const midDrag = evalJson(
  `(() => { const root = document.querySelector('[data-companion-window]'); return JSON.stringify({ raised: !!root && document.body.lastElementChild === root, w: parseFloat(root?.style?.width ?? \"NaN\"), h: parseFloat(root?.style?.height ?? \"NaN\") }); })()`);
shot("t990-gripraise.png");
ok("THE RAISE RODE THE FIRST REAL MOVE OF A RESIZE (the window is lastElementChild MID-DRAG, before any release)",
  !!midDrag && midDrag.raised === true);
ok("the raise did not eat the resize (w/h GREW with the pointer, +14px)",
  !!midDrag && Number.isFinite(midDrag.w) && Number.isFinite(geoBefore.w)
    && Math.abs(midDrag.w - (geoBefore.w + 14)) <= 2
    && Math.abs(midDrag.h - (geoBefore.h + 14)) <= 2,
  `w ${geoBefore.w} → ${midDrag.w}, h ${geoBefore.h} → ${midDrag.h}`);
sh(`${AB} mouse move ${gripPoint.x} ${gripPoint.y}`);
await sleep(150);
sh(`${AB} mouse up`);
const afterUp = evalJson(
  `(() => { const root = document.querySelector('[data-companion-window]'); const dlg = [...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ w: parseFloat(root?.style?.width ?? \"NaN\"), h: parseFloat(root?.style?.height ?? \"NaN\"), dlgUp: !!dlg && dlg.getBoundingClientRect().width > 0, stillLast: !!root && document.body.lastElementChild === root }); })()`);
ok("the round trip restored the geometry (the echo writes the same w/h)",
  !!afterUp && Number.isFinite(afterUp.w) && Math.abs(afterUp.w - geoBefore.w) <= 1
    && Math.abs(afterUp.h - geoBefore.h) <= 1,
  `w=${afterUp?.w} h=${afterUp?.h}`);
ok("the t501 contract met alive — the grip interaction never dismissed the dialog",
  !!afterUp && afterUp.dlgUp === true);
ok("the window keeps the front after the release (the raise's own durability)",
  !!afterUp && afterUp.stillLast === true);
/* the close: the conditional Escape (a dialog verifiably up), then the companion's own door */
sh(`${AB} press Escape`);
const dlgShut = await poll(
  `(() => { const d = [...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ up: !!d }); })()`,
  (v) => v.up === false, 10, 500);
if (!dlgShut || dlgShut.up !== false) {
  const xClick = await realClick(`[...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((d) => d.getBoundingClientRect().width > 0)?.querySelector('[data-slot=\"dialog-close\"]')`);
  await poll(`(() => { const d = [...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ up: !!d }); })()`, (v) => v.up === false, 8, 500);
  ok("the dialog closed (the fallback close button)", String(xClick).startsWith("clicked@"), String(xClick));
} else {
  ok("the dialog closed (the conditional Escape — a dialog was verifiably up)", true);
}
const shutDoor = await realClick(`[...document.querySelectorAll('button[aria-label=\"关闭 AI 助手\"]')].find((b) => b.getBoundingClientRect().width > 0)`);
const compShut = await poll(
  `(() => { const r = document.querySelector('[data-companion-window]'); return JSON.stringify({ shut: !r || r.getBoundingClientRect().width === 0 }); })()`,
  (v) => v.shut, 10, 500);
ok("the companion shut through its own door (the t797 law)",
  String(shutDoor).startsWith("clicked@") && !!compShut && compShut.shut);

/* THE FIXTURE (the t989 api-body law: every write is followed by an
 * exists-read) — the face's REMOTE run record + the mock-fs archive tree:
 * the live workdir exists but is EMPTY (the re-dispatch moved everything
 * aside), the archive holds the newest epoch generation with it005
 * complete and it003 optimiser-only (the torn flush INSIDE the archive) */
console.log("fixture: the remote run record + the mock-fs archive tree");
const runsPre = JSON.parse(readFileSync(STATE_FILE, "utf8"));
runsPre[FACE_ID] = {
  jobId: FACE_ID,
  projectId: PROJECT_ID,
  type: "refine3d",
  pid: null,
  cmd: "t990 walk fixture — the archive lane record (not a real dispatch)",
  workdir: path.join(ROOT, "data", "relion", PROJECT_ID, `refine3d_${FACE_ID.slice(-8)}`),
  logFile: "",
  errFile: "",
  startedAt: new Date().toISOString(),
  outputs: {},
  done: true,
  exitCode: 0,
  remote: {
    connectionId: "conn-mv78si99",
    connectionName: "Mock Cluster",
    host: "127.0.0.1:3022",
    user: "cryo",
    module: "relion/5.0.1",
    mode: "slurm",
    remoteRoot: "/projects/cryoflow",
    remoteWorkdir: REMOTE_WORKDIR,
    pid: null,
    slurmId: "99",
    phase: "completed",
    slurmState: "COMPLETED",
    dispatchedAtEpoch: Math.floor(Date.now() / 1000),
    stagedBytes: 0,
    stagedMs: 0,
  },
};
const tmpPre = `${STATE_FILE}.t990.tmp`;
writeFileSync(tmpPre, JSON.stringify(runsPre, null, 2));
execSync(`mv "${tmpPre}" "${STATE_FILE}"`);
ok("the remote run record landed (the archive lane's own record)",
  !!JSON.parse(readFileSync(STATE_FILE, "utf8"))[FACE_ID]?.remote);
mkdirSync(GEN_DIR, { recursive: true }); // also mints the EMPTY live workdir
writeFileSync(path.join(GEN_DIR, "run_it005_optimiser.star"), "# t990 walk fixture\n");
writeFileSync(path.join(GEN_DIR, "run_it005_data.star"), "# t990 walk fixture\n");
writeFileSync(path.join(GEN_DIR, "run_it005_model.star"), "# t990 walk fixture\n");
writeFileSync(path.join(GEN_DIR, "run_it005_sampling.star"), "# t990 walk fixture\n");
writeFileSync(path.join(GEN_DIR, "run_it005_class001.mrc"), "# t990 walk fixture\n");
writeFileSync(path.join(GEN_DIR, "run_it003_optimiser.star"), "# t990 walk fixture — torn flush\n");
ok("the mock-fs archive tree landed (the live workdir EMPTY, the gen holds it005 complete + it003 torn)",
  existsSync(MOCK_FS_WORKDIR) && existsSync(path.join(GEN_DIR, "run_it005_optimiser.star"))
    && readdirOf(MOCK_FS_WORKDIR).length === 1, // the live root holds ONLY .cryoflow_prev
  `live=${readdirOf(MOCK_FS_WORKDIR).join(",")}`);
function readdirOf(p) {
  try { return readdirSync(p); } catch { return []; }
}

/* LEG 4 — the fresh open (the rider law: a new plane, a fresh open) */
console.log("leg 4: the fresh open for the rounds plane");
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
await poll(`(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`, (v) => v.n > 0, 24, 500);
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
  if (jumpLanded = !!landed) break;
  const pal = evalJson(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`);
  if (pal?.up) { sh(`${AB} press Escape`); await sleep(500); sh(`${AB} press Control+K`); await sleep(700); await poll(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`, (v) => v.up, 10, 400); evalJs(`(() => { const i = document.querySelector('[cmdk-input]'); if (i) i.focus(); return 'f'; })()`); sh(`${AB} keyboard type "Rounds Face"`); await sleep(800); }
}
ok("the jump landed — the edit panel hosts the face", jumpLanded);
const headerBadge = `(() => { const name = document.querySelector('input[aria-label="Job name"]'); if (!name || name.value !== ${JSON.stringify(FACE_NAME)}) return JSON.stringify({ word: null, panel: false }); const header = name.closest('div[class*="border-b"]'); const badge = header ? [...header.querySelectorAll('span')].find((sp) => sp.textContent.trim().toLowerCase() === 'idle' && (sp.className ?? '').includes('rounded-full')) : null; return JSON.stringify({ word: badge ? badge.textContent.trim().toLowerCase() : null, panel: true }); })()`;
const badgeIdle = await poll(headerBadge, (v) => v.panel && v.word === "idle", 10, 500);
ok("the panel's badge says idle (the header-scoped read)", !!badgeIdle && badgeIdle.panel && badgeIdle.word === "idle");

/* LEG 5 — THE t395 ARCHIVED GENERATION FACES (the self row's second group) */
console.log("leg 5: the archived generation faces (This job · previous run)");
const POPOVER_SEL = `[aria-label="Rounds you can continue from"]`;
const TRIGGER_SEL = `button[aria-label="Pick which previous round to continue from"]`;
const REFRESH_SEL = `button[aria-label="Re-read the rounds from the engine and the cluster"]`;
const trigClick = await realClick(`[...document.querySelectorAll(${JSON.stringify(TRIGGER_SEL)})].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the Rounds trigger clicked through the real mouse path", String(trigClick).startsWith("clicked@"), String(trigClick));
const popUp = await poll(
  `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); return JSON.stringify({ up: !!p && p.getBoundingClientRect().width > 0 }); })()`,
  (v) => v.up, 12, 500);
ok("the rounds popover opened (the picker's own plane)", !!popUp && popUp.up);
const rf = await realClick(`[...document.querySelectorAll(${JSON.stringify(REFRESH_SEL)})].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the refresh clicked (the ?refresh=1 lane — the remote listing rides the mock SSH)", String(rf).startsWith("clicked@"), String(rf));
let arch = null;
for (let i = 0; i < 30; i++) {
  const v = evalJson(`(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return JSON.stringify({ up: false }); const head = [...p.querySelectorAll('span')].find((x) => (x.textContent ?? '').trim() === 'This job · previous run'); const chip = [...p.querySelectorAll('span')].find((x) => (x.textContent ?? '').trim() === 'archived'); const cluster = [...p.querySelectorAll('span')].some((x) => (x.textContent ?? '').trim() === 'cluster'); const explain = [...p.querySelectorAll('p')].find((x) => (x.textContent ?? '').includes('moved aside by a re-dispatch')); const chipCount = [...p.querySelectorAll('span')].find((x) => (x.textContent ?? '').trim() === '2 rounds'); const it5 = [...p.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Continue from iteration 5 of ${FACE_NAME}')); const it3 = [...p.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Iteration 3 of ${FACE_NAME}')); const liveHead = [...p.querySelectorAll('span')].find((x) => (x.textContent ?? '').trim() === 'This job'); return JSON.stringify({ up: true, head: !!head, chip: !!chip, cluster, explain: !!explain, chipCount: !!chipCount, it5: it5 ? { label: it5.getAttribute('aria-label'), disabled: it5.disabled, hasNewest: (it5.textContent ?? '').includes('newest') } : null, it3: it3 ? { label: it3.getAttribute('aria-label'), disabled: it3.disabled, text: (it3.textContent ?? '').trim() } : null, liveHead: !!liveHead }); })()`);
  if (i % 5 === 0) phaseTrace.push(`i${i}: ${JSON.stringify(v).slice(0, 160)}`);
  /* the honest read is the WHOLE group: the poll waits for the complete
   * archived render (head + both rounds) — a snapshot that caught the
   * fetch landing mid-render reads the newer row before the older one
   * (the byte-probe named it: the row is there, verbatim, once settled) */
  if (v && v !== "null" && v.up && v.head && v.it5 && v.it3) { arch = v; break; }
  await sleep(500);
}
ok("THE ARCHIVED ROW BLOOMS (\"This job · previous run\" — the self row's second group, its first live witness)",
  !!arch && arch.head === true);
ok("the archived chip + the cluster lane badge ride the row (the record's own world)",
  !!arch && arch.chip === true && arch.cluster === true, `chip=${JSON.stringify(arch?.chip)} cluster=${JSON.stringify(arch?.cluster)}`);
ok("the re-dispatch explainer teaches (\"moved aside by a re-dispatch — RELION reads these paths fine…\")",
  !!arch && arch.explain === true);
ok("the \"2 rounds\" chip speaks (the archive generation's own count)",
  !!arch && arch.chipCount === true);
ok("THE COMPLETE ARCHIVED ROUND IS PICKABLE (it005 enabled, newest, the path INSIDE .cryoflow_prev/<epoch>/)",
  !!arch && arch.it5 && arch.it5.disabled === false && arch.it5.hasNewest === true
    && String(arch.it5.label).includes(`${REMOTE_WORKDIR}/.cryoflow_prev/${GEN}/run_it005_optimiser.star`),
  `label=${JSON.stringify(String(arch?.it5?.label).slice(0, 110))}`);
ok("THE COMPLETENESS LAW RIDES THE ARCHIVE (it003 optimiser-only shown but disabled, the torn-flush refusal)",
  !!arch && arch.it3 && arch.it3.disabled === true
    && arch.it3.label === `Iteration 3 of ${FACE_NAME} is incomplete and cannot be continued from`,
  `label=${JSON.stringify(arch?.it3?.label)}`);
ok("the DESIGNED ABSENCE holds — the live self row hides under its empty tree (no header, no error)",
  !!arch && arch.liveHead === false, `liveHead=${JSON.stringify(arch?.liveHead)}`);
shot("t990-archived.png");

/* LEG 6 — CLEANUP + WORLD HONESTY */
console.log("leg 6: cleanup + the world's honesty");
try {
  const raw = readFileSync(STATE_FILE, "utf8");
  const runs6 = JSON.parse(raw);
  delete runs6[FACE_ID];
  const tmp6 = `${STATE_FILE}.t990.tmp`;
  writeFileSync(tmp6, JSON.stringify(runs6, null, 2));
  execSync(`mv "${tmp6}" "${STATE_FILE}"`);
  console.log("  run record swept");
} catch { /* state untouched — fine */ }
if (existsSync(MOCK_FS_WORKDIR)) { rmSync(MOCK_FS_WORKDIR, { recursive: true, force: true }); console.log("  mock-fs archive tree swept"); }
ok("the fixtures are gone (the record and the archive tree)",
  !JSON.parse(readFileSync(STATE_FILE, "utf8"))[FACE_ID] && !existsSync(MOCK_FS_WORKDIR));
let body6 = null;
for (let attempt = 0; attempt < 3 && !body6; attempt++) {
  if (attempt > 0) await sleep(4000);
  try { body6 = JSON.parse(api("GET", "/api/jobs")); } catch { body6 = null; }
  if (body6 && typeof body6 === "object") { const a = Array.isArray(body6) ? body6 : body6.jobs ?? []; if (a.length === 0) body6 = null; }
}
const arr6 = Array.isArray(body6) ? body6 : body6?.jobs ?? [];
ok("the world carries NINETEEN jobs (18 standing + the face)", arr6.length === 19, `rows=${arr6.length}`);
const face6 = arr6.find((j) => j.name === FACE_NAME);
ok("the face is pristine (idle, no run evidence, no continue target — the t445 law)",
  !!face6 && face6.status === "idle" && face6.ranParams == null && face6.result == null && !face6.params?.fn_cont,
  face6 ? `status=${face6.status}` : "missing");
const mintVerify = sh(`node scripts/t989-rounds-face-mint.mjs verify 2>&1 | tail -1`);
ok("the mint's own verify answers GREEN after the sweep", /GREEN/.test(mintVerify), mintVerify.trim());
const fingerprint6 = arr6.filter((j) => j.name !== FACE_NAME).map((j) => `${j.id}:${j.status}:${j.name}`).sort().join("|");
ok("the standing eighteen untouched (byte-identical id:status:name fingerprint)",
  fingerprint6 === standingFingerprint, `rows=${fingerprint6.split("|").length}`);

/* the receipt */
mkdirSync(QA_DIR, { recursive: true });
writeFileSync(RECEIPT, JSON.stringify({
  walk: "t990-archived-face-walk",
  at: new Date().toISOString(),
  face: { name: FACE_NAME, jobId: FACE_ID },
  pass, fail,
  phaseTrace,
  results,
}, null, 2));
console.log(`receipt: ${RECEIPT}`);

console.log(`== t990 archived-face walk ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);

