#!/usr/bin/env node
/**
 * walk-kit — the walk family's SHARED SKELETON (t991, the t990 entry's
 * candidate ①): the organs that lived copy-pasted inside SIX walks
 * (t982's witness grammar through t990's archive ride) now live here
 * ONCE. A new walk becomes a legs-only file: it imports createWalk(),
 * names its receipt, and rides.
 *
 * THE ORGANS (each carried verbatim from the family's current form):
 *   ok(label, cond, extra)        the assert counter (pass/fail, console)
 *   sleep(ms)                     the pause
 *   sh(cmd)                       execSync with the walk's timeout/cwd
 *   evalJs(expr)                  agent-browser eval --stdin
 *   evalJson(expr)                the eval output's JSON shell stripped
 *                                 (the quote-locator + the double-parse —
 *                                 the Bash channel's stripping artifact
 *                                 never mints a phantom read again)
 *   poll(expr, gate, times, ms)   poll-then-probe (24 × 500ms default)
 *   realClick(findExpr)           the nine-point self-hit click (the
 *                                 family's current form: NO-ELEMENT /
 *                                 OFF-VIEWPORT / NEVER-OWN verdicts, the
 *                                 off-viewport branch scrolls-then-retries)
 *   escAll(times)                 the blind Escape sweep (Radix layers)
 *   shot(name)                    the screenshot into shots-qa/
 *   serverFirst()                 the server-first law: 24 × 2.5s curl
 *                                 gate, FATAL exit(2) when never 200
 *   api(method, url, body)        curl with the Origin/Content-Type
 *                                 envelope (the api-body law's probe half)
 *   readJobs()                    GET /api/jobs parsed, retried 3×
 *   fingerprint(jobs, exclude)    the world's fingerprint: id:status:name
 *                                 sorted, pipe-joined
 *   notePhase(i, v)               the phase trace: every 5th beat the
 *                                 read is recorded (the i0-break tell)
 *   dlgBtn(dlgMatch, btnExpr)     the dialog-scoped button finder expr
 *   focusGate(id, tries)          the activeElement poll
 *   dialogOpen()                  the [role=dialog] visibility probe
 *   companionShut()               the companion's door probe (`关闭 AI
 *                                 助手` gone or zero-width — the t797 law)
 *   wideFirst()                   LEG 1's standard opening: viewport
 *                                 1440 900, fresh open, the alive poll,
 *                                 the companion shut — the wide-first law
 *                                 executable in one call
 *   finish(extra)                 the receipt written, the GREEN/RED line
 *                                 printed, the honest exit code
 *
 * THE LAWS THIS KIT ENFORCES BY CONSTRUCTION: server-first before any
 * open; poll-then-probe (never a single read); realClick probes
 * visibility AND self-hit every round; the phase trace rides every
 * settled-poll; mints stay OUT of the kit (each walk mints its own
 * fixtures with explicit AND VISIBLE x/y); the census is untouched
 * (the kit is instrument-side, additive, zero aria surface).
 *
 *   node scripts/walk-kit.mjs   (self-test: the organs answer)
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const AB = "agent-browser";

export function createWalk({
  name,                    // the walk's own name, e.g. "t992-my-walk"
  receiptFile,             // e.g. "t992-my-walk.json" (lives in shots-qa/)
  base = process.env.MINT_BASE ?? "http://localhost:3000",
} = {}) {
  const ROOT = process.cwd();
  const QA_DIR = path.join(ROOT, "shots-qa");
  const RECEIPT = path.join(QA_DIR, receiptFile ?? `${name}.json`);

  let pass = 0, fail = 0;
  const results = [];
  const phaseTrace = [];

  const ok = (label, cond, extra = "") => {
    if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
    else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); results.push({ label, cond: !!cond, extra }); }
    return !!cond;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const sh = (cmd) => {
    try { return execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim(); }
    catch (e) { return String(e?.stdout ?? e); }
  };

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

  /* the settled poll that rides the phase trace — the family's law: a
   * loop that waits for a complex face records every 5th read, so a
   * failed assert can be autopsied at the exact beat it broke. */
  const pollTraced = async (expr, gate, times = 24, ms = 500, tag = "poll") => {
    for (let i = 0; i < times; i++) {
      const v = evalJson(expr);
      notePhase(i, v, tag);
      if (v && v !== "null" && gate(v)) return v;
      await sleep(ms);
    }
    return null;
  };

  const notePhase = (i, v, tag = "poll") => {
    if (i % 5 === 0) phaseTrace.push(`${tag} i${i}: ${JSON.stringify(v)?.slice(0, 160)}`);
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

  const escAll = async (times = 2) => {
    for (let i = 0; i < times; i++) { try { sh(`${AB} press Escape`); } catch {} await sleep(500); }
  };

  const shot = (name) => sh(`${AB} screenshot ${path.join(QA_DIR, name)}`);

  /* the server-first law: every fresh open polls the server before the
   * open (the t981 walk's lesson, kit-enforced). */
  const serverFirst = async () => {
    let serverUp = false;
    for (let i = 0; i < 24 && !serverUp; i++) {
      try {
        const c = execSync(`curl -s -o /dev/null -w '%{http_code}' ${base}/ --max-time 5`, { encoding: "utf8" });
        serverUp = c.trim() === "200";
      } catch { serverUp = false; }
      if (!serverUp) await sleep(2500);
    }
    if (!serverUp) { console.log("FATAL: the server never answered 200"); process.exit(2); }
    console.log("server: 200");
    return true;
  };

  const api = (method, url, body) => execSync(
    `curl -s -X ${method} -H "Origin: ${base}" -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${base}${url}"`,
    { encoding: "utf8", timeout: 30_000 });

  const readJobs = async () => {
    let body = null;
    for (let attempt = 0; attempt < 3 && !body; attempt++) {
      if (attempt > 0) await sleep(4000);
      try { body = JSON.parse(api("GET", "/api/jobs")); } catch { body = null; }
      if (body && typeof body === "object") {
        const a = Array.isArray(body) ? body : body.jobs ?? [];
        if (a.length === 0) body = null;
      }
    }
    return body;
  };

  const jobsArr = (body) => (Array.isArray(body) ? body : body?.jobs ?? []);
  const fingerprint = (arr, excludeName = null) => arr
    .filter((j) => !excludeName || j.name !== excludeName)
    .map((j) => `${j.id}:${j.status}:${j.name}`)
    .sort()
    .join("|");

  const dlgBtn = (dlgMatch, btnExpr) => `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => (${dlgMatch})); if (!dlg) return null; return (${btnExpr}) ?? null; })()`;

  const focusGate = async (id, tries = 10) => {
    for (let i = 0; i < tries; i++) {
      const f = evalJson(`(() => JSON.stringify({ active: document.activeElement ? document.activeElement.id : null }))()`);
      if (f && f.active === id) return true;
      await sleep(300);
    }
    return false;
  };

  const dialogOpen = () => evalJson(`(() => JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some((d) => d.getBoundingClientRect().width > 0)) }))()`);

  const companionShut = async () => {
    const v = await poll(
      `(() => { const b = document.querySelector('[aria-label="关闭 AI 助手"]'); if (!b) return JSON.stringify({ shut: true }); const r = b.getBoundingClientRect(); return JSON.stringify({ shut: r.width === 0 }); })()`,
      (x) => x.shut, 4, 400);
    return !!v && v.shut;
  };

  /* LEG 1's standard opening — the wide-first law executable:
   * viewport 1440 900 BEFORE the fresh open, the alive poll, the
   * companion's shut poll. Returns { alive, shut } or null (fatal). */
  const wideFirst = async () => {
    sh(`${AB} set viewport 1440 900`);
    sh(`${AB} open ${base}/`);
    const alive = await poll(
      `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
      (v) => v.n > 0, 24, 500);
    ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);
    const shut = await companionShut();
    ok("the companion is shut (the ride plane is clear)", shut);
    return { alive, shut };
  };

  /* the receipt + the honest exit — every walk ends here. */
  const finish = (extra = {}) => {
    mkdirSync(QA_DIR, { recursive: true });
    writeFileSync(RECEIPT, JSON.stringify({
      walk: name,
      at: new Date().toISOString(),
      pass, fail,
      phaseTrace,
      results,
      ...extra,
    }, null, 2));
    console.log(`receipt: ${RECEIPT}`);
    console.log(`== ${name} ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
    process.exit(fail === 0 ? 0 : 1);
  };

  return {
    AB, BASE: base, ROOT, QA_DIR, RECEIPT,
    get pass() { return pass; }, get fail() { return fail; },
    results, phaseTrace,
    ok, sleep, sh, evalJs, evalJson, poll, pollTraced, notePhase,
    realClick, escAll, shot,
    serverFirst, api, readJobs, jobsArr, fingerprint,
    dlgBtn, focusGate, dialogOpen, companionShut, wideFirst,
    finish,
  };
}

/* self-test: node scripts/walk-kit.mjs answers the organ roll-call */
if (process.argv[1] && process.argv[1].endsWith("walk-kit.mjs")) {
  const w = createWalk({ name: "walk-kit-selftest", receiptFile: "walk-kit-selftest.json" });
  const organs = ["ok", "sleep", "sh", "evalJs", "evalJson", "poll", "pollTraced",
    "notePhase", "realClick", "escAll", "shot", "serverFirst", "api", "readJobs",
    "jobsArr", "fingerprint", "dlgBtn", "focusGate", "dialogOpen", "companionShut",
    "wideFirst", "finish"];
  let good = 0;
  for (const o of organs) {
    const live = typeof w[o] === "function";
    console.log(`  ${live ? "✓" : "✗"} ${o}`);
    if (live) good++;
  }
  const fp = w.fingerprint(w.jobsArr({ jobs: [{ id: "a", status: "idle", name: "B" }, { id: "c", status: "completed", name: "A" }] }));
  const fpOk = fp === "a:idle:B|c:completed:A";
  console.log(`  ${fpOk ? "✓" : "✗"} fingerprint (sorted, pipe-joined)${fpOk ? "" : ` — got ${JSON.stringify(fp)}`}`);
  const shell = w.evalJson(`"{\\"n\\": 7}"`);
  const shellOk = shell && shell.n === 7;
  console.log(`  ${shellOk ? "✓" : "✗"} evalJson strips the eval shell${shellOk ? "" : ` — got ${JSON.stringify(shell)}`}`);
  const total = organs.length + 2;
  console.log(`== walk-kit selftest ${good + (fpOk ? 1 : 0) + (shellOk ? 1 : 0)}/${total} ==`);
  process.exit(good + (fpOk ? 1 : 0) + (shellOk ? 1 : 0) === total ? 0 : 1);
}
