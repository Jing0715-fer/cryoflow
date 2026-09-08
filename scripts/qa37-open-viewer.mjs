// Task 37 QA — deterministic flow: page → job inspector → enlarge → View in 3D.
// Uses text/aria selectors via in-page eval (refs go stale across re-renders).
// Usage: node scripts/qa37-open-viewer.mjs
import { execSync } from "node:child_process";

const AB = "agent-browser";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 90_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => sh(`${AB} eval ${JSON.stringify(expr)}`);

/** real-input click: element center coords → mouse move/down/up (trusted
 *  events — canvas job nodes use pointer handlers that ignore .click()) */
const realClick = (findExpr) => {
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

const main = async () => {
  sh(`${AB} open http://localhost:3000`);
  // poll for the canvas job node (cold dev server compiles lazily)
  let node = "";
  for (let i = 0; i < 20; i++) {
    await sleep(2000);
    node = realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('3D Auto-Refine 1') && (x.textContent||'').includes('completed'))`,
    );
    console.log(`  node try ${i}:`, node);
    if (node.includes("clicked@")) break;
  }
  if (!node.includes("clicked@")) throw new Error("job node never appeared");
  await sleep(2500);

  // enlarge the half-map card (aria-label is stable)
  let card = "";
  for (let i = 0; i < 10; i++) {
    card = realClick(
      `[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Enlarge Half-map 1 (iter 1)')`,
    );
    if (card.includes("clicked@")) break;
    await sleep(1500);
  }
  console.log("step2:", card);
  await sleep(2000);

  // click View in 3D inside the dialog (plain Radix button — .click() is
  // reliable here; coordinate clicks miss when the MrcImage shifts layout)
  const v3d = evalJs(
    `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'View in 3D (Mol*)'); b ? b.click() : 0; return b ? 'v3d-clicked' : 'V3D-NOT-FOUND'; })()`,
  );
  console.log("step3:", v3d);

  // wait for molstar ready (window.__molstar + contour slider present)
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const probe = evalJs(
      `({m: typeof window.__molstar, s: !!document.querySelector('[role=slider]')})`,
    );
    console.log(`  wait ${i}:`, probe);
    if (probe.includes('"m":"object"') && probe.includes('"s":true')) {
      ready = true;
      break;
    }
  }
  console.log(ready ? "VIEWER READY" : "VIEWER NOT READY (timeout)");
  if (ready) {
    console.log(
      evalJs(
        `(() => ({canvases: document.querySelectorAll('canvas').length, layersBtn: [...document.querySelectorAll('button')].some(b => (b.getAttribute('aria-label')||'').startsWith('Overlay maps')), turntableBtn: [...document.querySelectorAll('button')].some(b => (b.getAttribute('aria-label')||'').includes('turntable video'))}))()`,
      ),
    );
  }
};

main().catch((e) => {
  console.error("FAILED:", e.message?.slice(0, 300));
  process.exit(1);
});
