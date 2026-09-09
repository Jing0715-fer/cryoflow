// qa63-smoke — post-writeRuns-migration smoke + console probe.
// Bootstraps dashboard → canvas → inspector (QA Post 320) → FSC compare
// dialog open/close, then asserts ZERO page errors. ~60 s total (fits the
// tool-call window that kept eating longer calls this window).
//
// Run: node scripts/qa63-smoke.mjs   (server must be on :3000)
import { execSync } from "node:child_process";

const AB = "agent-browser";
const B = "http://localhost:3000";
const HOST_JOB = "QA Post 320";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const must = (cond, label) => {
  if (!cond) { console.log(`FATAL: ${label}`); process.exit(1); }
  console.log(`  ok: ${label}`);
};

const errCollector = `(() => {
  if (window.__qaErrColl) return 'errcoll-kept';
  window.__qaErrs = [];
  window.addEventListener('error', (e) => window.__qaErrs.push(String(e.message || e).slice(0, 160)));
  window.addEventListener('unhandledrejection', (e) => window.__qaErrs.push('rej:' + String((e.reason && e.reason.message) || e.reason).slice(0, 160)));
  window.__qaErrColl = true;
  return 'errcoll-on';
})()`;
const errCount = () => unq(evalJs(`String((window.__qaErrs||[]).length)`));
const realClick = async (findExpr) => {
  const coords = evalJs(
    `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`,
  );
  if (!coords || coords === "null") return "NO-ELEMENT";
  const c = JSON.parse(coords);
  sh(`${AB} mouse move ${c.x} ${c.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${c.x},${c.y}`;
};

// ---- boot -----------------------------------------------------------------
sh(`${AB} close`); await sleep(1200);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${B}`);
await sleep(5000);
evalJs(errCollector);

let onCanvas = false;
for (let i = 0; i < 10 && !onCanvas; i++) {
  const probe = evalJs(`(() => {
    const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'));
    const dash = !!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard');
    return (card ? 'CARD' : 'NOCARD') + (dash ? '+DASH' : '');
  })()`);
  if (probe.includes("CARD")) onCanvas = true;
  else if (probe.includes("DASH")) {
    evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
    await sleep(2200);
  } else await sleep(2000);
}
must(onCanvas, "canvas renders with seeded job cards");

// ---- inspector -------------------------------------------------------------
let modal = false;
for (let i = 0; i < 5 && !modal; i++) {
  const r = await realClick(
    `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'))`,
  );
  if (r.includes("clicked@")) {
    await sleep(1500);
    modal = unq(evalJs(`(() => {
      const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('${HOST_JOB}'));
      return dl ? 'MODAL' : 'NONE';
    })() + ''`)) === "MODAL";
  } else await sleep(1500);
}
must(modal, "inspector modal opens for the completed postprocess job");

const fsc = unq(evalJs(`(() => {
  const s = document.querySelector('section[aria-label="Fourier-shell correlation"]');
  return s ? 'YES' : 'NO';
})() + ''`));
must(fsc === "YES", "FSC section rendered inside inspector (state→workdir resolution alive post-migration)");

// ---- compare dialog open/close ---------------------------------------------
let dialog = false;
for (let i = 0; i < 5 && !dialog; i++) {
  const r = await realClick(
    `[...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('compare') || (b.title||'').includes('compare'))`,
  );
  if (r.includes("clicked@")) {
    await sleep(1800);
    dialog = unq(evalJs(`(() => {
      const rows = document.querySelectorAll('[data-testid=fsc-compare-row]');
      return rows.length >= 5 ? 'DIALOG:' + rows.length : 'NONE';
    })() + ''`)).startsWith("DIALOG");
  } else await sleep(1500);
}
const rowCount = unq(evalJs(`String(document.querySelectorAll('[data-testid=fsc-compare-row]').length)`));
must(dialog, `compare dialog opens with rows (got ${rowCount}, expect 5)`);

// Esc closes only the dialog (inspector survives — qa61 layered-escape contract).
// Dispatch on the DIALOG element (qa62 pattern): target must be a DOM node on
// the React root's bubble path — a document-target event never reaches the
// Radix/React onKeyDown handlers.
const escRet = evalJs(`(() => {
  const dl = [...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-testid=fsc-compare-list]'));
  if (dl) dl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return dl ? 'esc-dispatched' : 'esc-NO-DIALOG';
})()`);
// Radix unmounts on animation end — poll instead of a fixed sleep (a 1s
// wait raced the exit animation and false-failed this assertion once)
let cmpGone = false;
for (let i = 0; i < 10 && !cmpGone; i++) {
  await sleep(400);
  cmpGone = unq(evalJs(`String(!document.querySelector('[data-testid=fsc-compare-list]'))`)) === "true";
}
const afterEsc = unq(evalJs(`(() => {
  const cmp = !!document.querySelector('[data-testid=fsc-compare-row]');
  const insp = [...document.querySelectorAll('[role=dialog]')].some(d => (d.textContent||'').includes('${HOST_JOB}'));
  return (cmp ? 'CMP' : 'NOCMP') + (insp ? '+INSP' : '+NOINSP');
})() + ''`));
must(afterEsc === "NOCMP+INSP", `Esc closes compare dialog, inspector survives - got "${afterEsc}" (dispatch: ${unq(escRet)}, cmpGone: ${cmpGone})`);

// ---- console verdict --------------------------------------------------------
const n = Number(errCount());
const errs = unq(evalJs(`JSON.stringify((window.__qaErrs||[]).slice(0,5))`));
must(n === 0, `console errors: ${n === 0 ? "0" : `**${n}** ${errs}`}`);

sh(`${AB} close`);
console.log("SMOKE GREEN");
