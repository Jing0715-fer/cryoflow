#!/usr/bin/env node
/**
 * t927 probe2 — the witness's EXACT band-R flow with the dense observer:
 * after the failure, card → inspector → DOOR (a FRESH panel mounts with
 * form=EMPTY) → the recovery fill → the save lands → card → inspector →
 * Re-run → Start again. Observer: 300ms jobs() samples (status + params +
 * all-job statuses) from 5s BEFORE the fill to 30s after Start again.
 */
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";

const NAME_MC_A = "Motion Correction 1";
const NAME_MC_B = "Motion Correction 2 (t922)";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_FILTER = "Exclude Micrographs (t927q)";
const LIST_FULL = "mic_002.mrc, mic_004.mrc, mic_006.mrc";
const LIST_RECOVER = "mic_002.mrc, mic_004.mrc";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim();
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
};
const api = (method, url, body) => {
  const cmd = `curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`;
  try { return JSON.parse(sh(cmd)); } catch { return { error: "parse" }; }
};
const jobs = () => api("GET", "/api/jobs").jobs ?? [];
const edges = () => api("GET", "/api/edges").edges ?? [];
const findName = (n) => jobs().find((j) => j.name === n);
const waitFor = async (name, times = 40, ms = 1000) => {
  for (let i = 0; i < times; i++) {
    const j = findName(name);
    if (j) return j;
    await sleep(ms);
  }
  return undefined;
};
async function pollUntil(jobId, want, timeoutMs = 240_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = jobs().find((x) => x.id === jobId);
    if (!j) return { status: "VANISHED" };
    if ([want, "failed", "cancelled"].includes(j.status)) return j;
    await sleep(2000);
  }
  return { status: "TIMEOUT" };
}
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) {
      evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' }); return 'siv'; })()`);
      await sleep(400);
      continue;
    }
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(400);
  }
  return "NEVER-VISIBLE";
};
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};

/* ============ world prep ============ */
console.log("== probe2 prep ==");
const preF0 = findName(NAME_FILTER);
if (preF0) api("DELETE", `/api/jobs/${preF0.id}`);
const ctfA0 = findName(NAME_CTF_A);
const mcA0 = findName(NAME_MC_A);
const seed0 = ctfA0 && mcA0 ? edges().find((e) => e.fromJobId === mcA0.id && e.toJobId === ctfA0.id) : null;
if (!seed0 && ctfA0 && mcA0) api("POST", "/api/edges", { fromJobId: mcA0.id, toJobId: ctfA0.id });
const mint = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs mint 2>&1`);
console.log(`  mint: ${(mint.match(/MINT .*/) ?? ["?"])[0]}`);
const mcA = await waitFor(NAME_MC_A);
const mcB = await waitFor(NAME_MC_B);
const ctfA = await waitFor(NAME_CTF_A);
if (!mcA || !mcB || !ctfA) { console.error("FATAL: mint jobs not visible"); process.exit(1); }
let filter = api("POST", "/api/jobs", { type: "excludemg", name: NAME_FILTER, params: { excludeNames: LIST_FULL } }).job;
for (let i = 0; i < 10 && !filter?.id; i++) { await sleep(1000); filter = api("POST", "/api/jobs", { type: "excludemg", name: NAME_FILTER, params: { excludeNames: LIST_FULL } }).job; }
if (!filter?.id) { console.error("FATAL: the filter POST never landed"); process.exit(1); }
api("POST", "/api/edges", { fromJobId: mcB.id, toJobId: filter.id });
const seedEdge = edges().find((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id);
if (seedEdge) api("DELETE", `/api/edges/${seedEdge.id}`);
api("POST", "/api/edges", { fromJobId: filter.id, toJobId: ctfA.id });
api("POST", `/api/jobs/${filter.id}/run`);
const run0 = await pollUntil(filter.id, "completed");
console.log(`  first run: ${run0.status} — ${String(run0.result ?? "").slice(0, 55)}`);

/* ============ the browser: failure, then the WITNESS's exact recover flow ============ */
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await sleep(1500);
const cardExpr = `[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${NAME_FILTER}'))?.querySelector('[role="button"][tabindex]')`;

// failure: card → inspector → door → panel → clear → API run
console.log(`  card: ${await realClick(cardExpr)}`);
await sleep(1200);
console.log(`  door: ${await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Edit parameters')`)}`);
await sleep(1200);
console.log(`  params: ${await realClick(`(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); return [...(a?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Params') ?? null; })()`)}`);
await poll(`JSON.stringify({ present: !!document.querySelector('#param-${filter.id}-excludeNames') })`, (v) => v.present === true, 12, 500);
console.log(`  focus: ${await realClick(`document.querySelector('#param-${filter.id}-excludeNames')`)}`);
sh(`${AB} press Control+a`);
sh(`${AB} press Delete`);
await sleep(1800);
console.log(`  cleared: DB=${JSON.stringify(jobs().find(j => j.id === filter.id)?.params?.excludeNames)}`);
api("POST", `/api/jobs/${filter.id}/run`);
const run2 = await pollUntil(filter.id, "failed");
console.log(`  failure: ${run2.status}`);

// THE WITNESS'S EXACT BAND R: fresh reload → card → inspector → DOOR (fresh
// panel) → Params → the recovery fill → save → card → inspector → Re-run
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await sleep(1500);
console.log(`  card2: ${await realClick(cardExpr)}`);
await sleep(1200);
console.log(`  door2: ${await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Edit parameters')`)}`);
await sleep(1200);
console.log(`  params2: ${await realClick(`(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); return [...(a?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Params') ?? null; })()`)}`);
let inputMounted = await poll(`JSON.stringify({ present: !!document.querySelector('#param-${filter.id}-excludeNames') })`, (v) => v.present === true, 20, 700);
for (let round = 0; round < 4 && !inputMounted; round++) {
  // the eaten-click law: re-aim the Params tab until the input mounts
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(700);
  console.log(`  card2 retry ${round}: ${await realClick(cardExpr)}`);
  await sleep(1000);
  console.log(`  door2 retry ${round}: ${await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Edit parameters')`)}`);
  await sleep(1000);
  console.log(`  params2 retry ${round}: ${await realClick(`(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); return [...(a?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Params') ?? null; })()`)}`);
  inputMounted = await poll(`JSON.stringify({ present: !!document.querySelector('#param-${filter.id}-excludeNames') })`, (v) => v.present === true, 12, 700);
}
if (!inputMounted) { console.error("FATAL: the door-opened panel's input never mounted"); process.exit(1); }

// the dense observer starts 3s BEFORE the fill
const timeline = [];
let observing = true;
const t0 = Date.now();
const observer = (async () => {
  let last = "";
  while (observing) {
    try {
      const js = jobs();
      const f = js.find((x) => x.id === filter.id);
      const row = `${f?.status}|${JSON.stringify(f?.params?.excludeNames)}|all=${js.map((x) => x.status[0]).join("")}`;
      if (row !== last) { timeline.push(`+${((Date.now() - t0) / 1000).toFixed(1)}s ${row}`); last = row; }
    } catch {}
    await sleep(300);
  }
})();
await sleep(3000);

sh(`${AB} fill "#param-${filter.id}-excludeNames" "${LIST_RECOVER}"`) || true;
await sleep(1800);
console.log(`  +${((Date.now() - t0) / 1000).toFixed(1)}s recovered: DB=${JSON.stringify(jobs().find(j => j.id === filter.id)?.params?.excludeNames)}`);
console.log(`  card3: ${await realClick(cardExpr)}`);
await sleep(1200);
console.log(`  rerun: ${await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Re-run')`)}`);
await sleep(1000);
console.log(`  start: ${await realClick(`[...document.querySelectorAll('[role="alertdialog"] button')].find(b => (b.textContent || '').trim() === 'Start again')`)}`);
await sleep(30_000);
observing = false;
await observer;
console.log("== TIMELINE ==");
for (const line of timeline) console.log(`  ${line}`);
const fin = jobs().find((x) => x.id === filter.id);
console.log(`  FINAL: ${fin?.status} — ${String(fin?.result ?? "").slice(0, 60)}`);

/* ============ restore ============ */
try { sh(`${AB} close`); } catch {}
const rw = edges().find((e) => e.fromJobId === filter.id && e.toJobId === ctfA.id);
if (rw) api("DELETE", `/api/edges/${rw.id}`);
const sBack = edges().find((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id);
if (!sBack) api("POST", "/api/edges", { fromJobId: mcA.id, toJobId: ctfA.id });
api("DELETE", `/api/jobs/${filter.id}`);
console.log(`  remove: ${(sh(`unset DATABASE_URL; node scripts/t922-mint.mjs remove 2>&1`).match(/REMOVE .*/) ?? ["?"])[0]}`);
console.log(`  world: ${jobs().length} jobs, ${edges().length} edges`);
