// Task 37 QA — turntable recording completion-path observer.
// Installs an in-page MutationObserver (zero latency), starts a Quick (5s)
// turntable recording, then dumps: observed toast nodes, badge timeline,
// animation state transitions, and post-record canvas hash.
// Prereq: 3D viewer already open & ready on the page.
import { execSync } from "node:child_process";

const AB = "agent-browser";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// pipe via --stdin: zero shell-escaping mangling for multiline JS
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 60_000, input: expr }).trim();

const OBSERVER = `(() => {
  window.__qaObs = []; window.__qaBadge = [];
  const t0 = Date.now();
  const mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/Turntable|exported|discarded|cryoflow-turntable/.test(t)) {
          window.__qaObs.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 200) });
        }
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
  const bt = setInterval(() => {
    const b = document.querySelector('[data-testid=turntable-rec-badge]');
    window.__qaBadge.push({ at: Date.now() - t0, on: !!b, label: b ? b.textContent.trim() : null });
    if (window.__qaBadge.length > 80) clearInterval(bt);
  }, 400);
  return 'observer-on';
})()`;

const canvasHash = `(() => {
  const c = document.querySelector('canvas');
  if (!c) return 'no-canvas';
  const s = c.toDataURL('image/png'); let h = 0;
  for (let i = 0; i < s.length; i += 997) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return h;
})()`;

const main = async () => {
  console.log("idleHash:", evalJs(canvasHash));
  console.log("observer:", evalJs(OBSERVER));

  // open popover if closed, then click Record
  const open = evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=turntable-popover]');
    if (!p) { const t = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').includes('Record a turntable video')); if (!t) return 'NO-TRIGGER'; t.click(); return 'opened'; }
    return 'was-open';
  })()`);
  console.log("popover:", open);
  await sleep(1500);
  const start = evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=turntable-popover]');
    if (!p) return 'POPOVER-CLOSED';
    const b = [...p.querySelectorAll('button')].find(x => x.textContent.includes('Record 360'));
    if (!b) return 'NO-RECORD-BTN';
    b.click(); return 'recording-started';
  })()`);
  console.log("record:", start);

  // sample for up to 14s
  for (let i = 0; i < 14; i++) {
    await sleep(1000);
    const probe = evalJs(`(() => JSON.stringify({
      badge: !!document.querySelector('[data-testid=turntable-rec-badge]'),
      anim: window.__molstar ? String(window.__molstar.managers.animation.state.animationState) : 'no-plugin',
      obs: window.__qaObs ? window.__qaObs.length : -1,
    }))()`);
    console.log(`t+${i + 1}s:`, probe);
    if (i >= 8 && probe.includes('"badge":false') && probe.includes('"obs":0')) break;
  }

  console.log("observed:", evalJs("JSON.stringify(window.__qaObs)"));
  console.log(
    "badgeTimeline:",
    evalJs("JSON.stringify(window.__qaBadge.filter((x, i) => i === 0 || x.on !== window.__qaBadge[i - 1].on))"),
  );
  console.log("finalHash:", evalJs(canvasHash));
  console.log("bodyToast:", evalJs(`(() => { const t = document.body.textContent; return JSON.stringify({exported: t.includes('video exported'), discarded: t.includes('discarded'), failed: t.includes('recording failed'), fname: t.includes('cryoflow-turntable-')}); })()`));
};

main().catch((e) => {
  console.error("FAILED:", e.message?.slice(0, 300));
  process.exit(1);
});
