// Diagnostic — why doesn't the gallery-wall expand button toggle?
// Three click paths + remount detection on the saved-views section.
import { execSync } from "node:child_process";

const AB = "agent-browser";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// agent-browser eval output is JSON-encoded — unwrap quotes (qa54/68 lesson)
const unq = (s) => {
  const t = String(s).trim();
  try { return JSON.parse(t); } catch { return t; }
};
const evalJs = (expr) => unq(sh(`${AB} eval '${expr.replace(/'/g, "'\\''")}'`));

const snap = (name, i) => JSON.stringify({
  id: `diag-wall-${name}-${i}`,
  name: `diag wall ${name} ${i}`,
  ts: Date.now() - i * 1000,
  snapshot: { mode: "camera", fov: 0.876, position: [12.3, -4.5, 30.1], up: [0, 1, 0], target: [0.1, 0.2, 0.3], radius: 52.4, radiusMax: 120, fog: 0, clipFar: 0, minNear: 0, minFar: 0 },
  view: { sigma: 3, sign: 1, slice: { on: true, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
});

// find two jobs to seed
const jobs = JSON.parse(sh(`curl -s --max-time 15 http://localhost:3000/api/jobs`));
const list = jobs.jobs || jobs;
const usable = list.filter((j) => j && j.id && j.type !== "import");
if (usable.length < 2) { console.log("need 2 jobs, got", usable.length); process.exit(1); }
const [A, B] = usable;
for (const [jid, tag] of [[A.id, "A"], [B.id, "B"]]) {
  const bms = Array.from({ length: 8 }, (_, i) => snap(tag, i)).join(",");
  sh(`curl -s --max-time 20 -X PUT "http://localhost:3000/api/jobs/${jid}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":[${bms}]}'`);
}
console.log("seeded 8+8 on", A.name, "/", B.name);

sh(`${AB} open http://localhost:3000`);
await sleep(5000);

// nav to dashboard
evalJs(`(() => { const b = [...document.querySelectorAll('button,a')].find(x => x.textContent.trim() === 'Dashboard'); b ? b.click() : 0; return b ? 'nav' : 'NO-NAV'; })()`);
await sleep(3000);

const wallState = `(() => {
  const s = [...document.querySelectorAll('section')].find(x => x.getAttribute('aria-label') === 'Saved 3D views across all projects');
  if (!s) return null;
  const w = s.querySelector('#saved-views-wall');
  const b = [...s.querySelectorAll('button')].find(x => /Show (all|less)/.test(x.textContent));
  return { cards: w ? w.querySelectorAll(':scope > button').length : -1, btn: b ? { t: b.textContent.trim(), exp: b.getAttribute('aria-expanded') } : null };
})()`;

// tag the section + the button to detect remounts
evalJs(`(() => {
  const s = [...document.querySelectorAll('section')].find(x => x.getAttribute('aria-label') === 'Saved 3D views across all projects');
  if (s) { s.__diagTag = 'TAGGED'; window.__diagSection = s; }
  const b = s && [...s.querySelectorAll('button')].find(x => /Show all/.test(x.textContent));
  if (b) b.__diagBtn = 'BTN-TAG';
  return 'tagged';
})()`);

console.log("collapsed:", JSON.stringify(await (async () => evalJs(wallState))()));

// PATH 1 — programmatic click, probe fast then slow
evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^Show all \\d+ bookmarks$/.test(x.textContent.trim())); if (!b) return 'NO-BTN'; b.click(); return 'clicked'; })()`);
for (const d of [120, 500, 1200]) {
  await sleep(d);
  const st = evalJs(wallState);
  const alive = evalJs(`(() => { const s = [...document.querySelectorAll('section')].find(x => x.getAttribute('aria-label') === 'Saved 3D views across all projects'); return JSON.stringify({ same: s === window.__diagSection, tagged: !!(s && s.__diagTag) }); })()`);
  console.log(`path1 +${d}ms:`, JSON.stringify(st), "section:", alive);
}

// if still collapsed, PATH 2 — CLI atomic click on a section-scoped selector
const st2 = evalJs(wallState);
if (st2 && st2.btn && st2.btn.exp === "false") {
  console.log("path1 failed — trying CLI atomic click");
  try {
    sh(`${AB} click '(() => { const s=[...document.querySelectorAll(\"section\")].find(x=>x.getAttribute(\"aria-label\")===\"Saved 3D views across all projects\"); return s ? [...s.querySelectorAll(\"button\")].find(x=>/^Show all/.test(x.textContent)) : null; })() '`);
  } catch (e) { console.log("cli click error:", String(e.message).slice(0, 120)); }
  await sleep(600);
  console.log("path2 +600ms:", JSON.stringify(evalJs(wallState)));

  // PATH 3 — full pointer event sequence
  const st3 = evalJs(wallState);
  if (st3 && st3.btn && st3.btn.exp === "false") {
    console.log("path2 failed — trying pointer sequence");
    const r = evalJs(`(() => {
      const s = [...document.querySelectorAll('section')].find(x => x.getAttribute('aria-label') === 'Saved 3D views across all projects');
      const b = s && [...s.querySelectorAll('button')].find(x => /^Show all/.test(x.textContent));
      if (!b) return 'NO-BTN';
      const r = b.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      const opt = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
      b.dispatchEvent(new PointerEvent('pointerdown', opt));
      b.dispatchEvent(new MouseEvent('mousedown', opt));
      b.dispatchEvent(new PointerEvent('pointerup', opt));
      b.dispatchEvent(new MouseEvent('mouseup', opt));
      b.dispatchEvent(new MouseEvent('click', opt));
      return 'seq@' + Math.round(x) + ',' + Math.round(y);
    })()`);
    console.log("path3 dispatch:", r);
    await sleep(600);
    console.log("path3 +600ms:", JSON.stringify(evalJs(wallState)));
  }
}

// final diagnostics: react root, overlapping element at button center, matches count
console.log("extra:", evalJs(`(() => {
  const ms = [...document.querySelectorAll('button')].filter(x => /^Show all \\d+ bookmarks$/.test(x.textContent.trim()));
  const b = ms[0];
  const r = b && b.getBoundingClientRect();
  const topEl = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return JSON.stringify({
    matches: ms.length,
    rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
    topIsBtn: topEl === b,
    topTag: topEl ? topEl.tagName + '.' + (topEl.className || '').toString().slice(0, 40) : null,
    reactRoot: !!document.querySelector('#__next, [data-reactroot], main'),
    btnDisabled: b ? b.disabled : null,
  });
})()`));

// cleanup rows
for (const jid of [A.id, B.id]) {
  sh(`curl -s --max-time 20 -X PUT "http://localhost:3000/api/jobs/${jid}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":[]}'`);
}
console.log("cleaned");
