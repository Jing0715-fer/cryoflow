// Task 37 QA — turntable CANCEL path: record then cancel mid-way; expects
// the "discarded" toast to appear in the in-page observer and NO download.
import { execSync } from "node:child_process";

const AB = "agent-browser";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 60_000, input: expr }).trim();

const OBSERVER = `(() => {
  window.__qaObs = [];
  const t0 = Date.now();
  const mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/Turntable|discarded|exported/.test(t)) {
          window.__qaObs.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 160) });
        }
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
  return 'observer-on';
})()`;

const main = async () => {
  console.log("observer:", evalJs(OBSERVER));
  const open = evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=turntable-popover]');
    if (!p) { const t = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').includes('Record a turntable video')); if (!t) return 'NO-TRIGGER'; t.click(); return 'opened'; }
    return 'was-open';
  })()`);
  console.log("popover:", open);
  await sleep(1200);
  console.log("record:", evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=turntable-popover]');
    if (!p) return 'POPOVER-CLOSED';
    const b = [...p.querySelectorAll('button')].find(x => x.textContent.includes('Record 360'));
    b.click(); return b ? 'recording' : 'NO-BTN';
  })()`));
  await sleep(2000);
  console.log("cancel:", evalJs(`(() => {
    const b = document.querySelector('[data-testid=turntable-rec-badge] button');
    if (!b) return 'BADGE-GONE (too late)';
    b.click(); return 'cancel-clicked';
  })()`));
  await sleep(2500);
  console.log("observed:", evalJs("JSON.stringify(window.__qaObs)"));
  console.log("badgeStill:", evalJs(`String(!!document.querySelector('[data-testid=turntable-rec-badge]'))`));
};

main().catch((e) => {
  console.error("FAILED:", e.message?.slice(0, 200));
  process.exit(1);
});
