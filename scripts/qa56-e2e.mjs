// Task 56 QA — turntable GIF side-export (gifenc encode after the WebM):
//   A  GIF ON (default): popover probes (chip states, footnote mentions the
//      GIF), Quick speed, record → REC badge → GIF progress badge → two
//      blobs (video/webm + image/gif with GIF89a magic), both toasts fire
//   B  GIF OFF: chip toggles + persists to localStorage, footnote drops the
//      GIF phrase, record → exactly ONE blob (webm), no GIF toast
//   C  console 0 errors, chip restored to ON for future sessions, close
// Usage: QA_PHASES=A,B,C node scripts/qa56-e2e.mjs   (production server!)
import { execSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa56-trace.log", import.meta.url).pathname;
const step = (m) => {
  const line = `[${(Date.now() / 1000).toFixed(0)}] ${m}`;
  try { appendFileSync(LOGF, line + "\n"); } catch { /* ignore */ }
  console.log(m);
};
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => { step(`SIGNAL ${sig} — dying`); process.exit(1); });
}
process.on("exit", (c) => step(`exit code=${c}`));
process.on("uncaughtException", (e) => { step(`uncaught: ${e.message}`); process.exit(2); });
process.on("unhandledRejection", (e) => { step(`unhandledRejection: ${e}`); process.exit(3); });

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));
const PHASES = (process.env.QA_PHASES || "A,B,C").split(",").map((s) => s.trim().toUpperCase());

const JOB = "3D Auto-Refine 1";
const B = "http://localhost:3000";

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

const sanityCheck = async () => {
  const s = unq(evalJs(`(() => !!document.querySelectorAll('button').length)() + ''`));
  if (s !== "true") throw new Error(`probe sanity failed: "${s}"`);
};

const openViewer = async () => {
  sh(`${AB} open ${B}`);
  await sleep(6000);
  await sanityCheck();
  let card = "";
  for (let i = 0; i < 14; i++) {
    card = await realClick(
      `[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Enlarge Half-map 1 (iter 1)')`,
    );
    if (card.includes("clicked@")) break;
    await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${JOB}') && (x.textContent||'').includes('completed'))`,
    );
    step(`  openViewer iter ${i}: enlarge=${card.slice(0, 24)}`);
    await sleep(2200);
  }
  if (!card.includes("clicked@")) throw new Error("half-map card never appeared");
  await sleep(1500);
  let v3d = "";
  for (let i = 0; i < 12; i++) {
    v3d = evalJs(
      `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('View in 3D')); b ? b.click() : 0; return b ? 'v3d-clicked' : 'V3D-WAIT'; })()`,
    );
    if (v3d.includes("v3d-clicked")) break;
    await sleep(2000);
  }
  step(`  v3d: ${v3d}`);
  for (let i = 0; i < 75; i++) {
    await sleep(2000);
    const probe = evalJs(`({m: typeof window.__molstar, s: !!document.querySelector('[role=slider]')})`).replace(/\s+/g, "");
    if (i % 10 === 9) step(`  ready-wait ${i}: ${probe.slice(0, 50)}`);
    if (probe.includes('"m":"object"') && probe.includes('"s":true')) return true;
  }
  return false;
};

// toast watcher + in-page console-error collector — the CLI `errors`
// subcommand relaunches the daemon when the session died and prints a bare
// "✗", which is indistinguishable from a real failure; the collector is
// deterministic (installed at bootstrap, read in phase C)
const toastObserver = `(() => {
  window.__qaErrs = [];
  window.addEventListener('error', (e) => window.__qaErrs.push(String(e.message || e.type)));
  window.addEventListener('unhandledrejection', (e) => window.__qaErrs.push('rej:' + ((e.reason && e.reason.message) || String(e.reason))));
  window.__qaToasts = [];
  const t0 = Date.now();
  window.__qaMo && window.__qaMo.disconnect();
  window.__qaMo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/Turntable|GIF/i.test(t)) {
          window.__qaToasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 240) });
        }
      }
    }
  });
  window.__qaMo.observe(document.body, { childList: true, subtree: true });
  return 'observer-on';
})()`;
const lastToasts = (n = 3) => unq(evalJs(`(window.__qaToasts||[]).slice(-${n}).map(t=>t.text).join(' | ') || 'NONE'`));

const hookBlobs = () => unq(evalJs(`(() => {
  window.__qaBlobs = [];
  if (!window.__qaBlobHooked) {
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { try { window.__qaBlobs.push({ type: (b && b.type) || '?', size: (b && b.size) || 0, blob: b }); } catch {} return orig(b); };
    window.__qaBlobHooked = true;
  }
  return 'hooked:' + window.__qaBlobs.length;
})()`));

const blobTail = (n = 3) => J(`(() => {
  const a = (window.__qaBlobs||[]).slice(-${n});
  return a.map(b => ({ type: b.type, size: b.size }));
})()`);

const blobMagic = (idx) => unq(evalJs(`(async () => {
  const b = (window.__qaBlobs||[])[${idx}];
  if (!b) return 'NO-BLOB';
  const buf = new Uint8Array(await b.blob.slice(0, 6).arrayBuffer());
  return String.fromCharCode(...buf);
})()`));

const openTurntablePopover = async () => {
  // already open? toggling again would close it
  const already = J(`(() => !!document.querySelector('[data-canvas-ui=turntable-popover]'))()`);
  if (already === true) return "already-open";
  let r = "";
  for (let i = 0; i < 6 && !r.includes("clicked@"); i++) {
    r = await realClick(`[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Record a turntable video of the current view')`);
    await sleep(900);
  }
  if (!r.includes("clicked@")) throw new Error("turntable popover never opened");
  await sleep(400);
  return r;
};

const popoverProbe = () => J(`(() => {
  const p = document.querySelector('[data-canvas-ui=turntable-popover]');
  if (!p) return null;
  const chip = (t) => { const c = p.querySelector('[data-testid=turntable-gif-' + t + ']'); return c ? c.getAttribute('aria-pressed') : null; };
  const foot = [...p.querySelectorAll('p')].map(x => x.textContent.replace(/\\s+/g,' ').trim()).find(t => t.includes('30 fps'));
  return { gifOn: chip('1'), gifOff: chip('0'), foot };
})()`);

const badgeState = () => J(`(() => {
  const b = document.querySelector('[data-testid=turntable-rec-badge]');
  if (!b) return { badge: false };
  return {
    badge: true,
    gifProgress: b.querySelector('[data-testid=turntable-gif-progress]')?.textContent?.trim() ?? null,
    rec: (b.textContent.match(/REC \\d+:\\d+/) || [null])[0],
  };
})()`);

/** wait for the badge to appear, then (optionally) watch the GIF encode
 *  progress badge, then for the badge to disappear; returns a timeline */
const runRecord = async ({ wantGif }) => {
  const clk = unq(evalJs(`(() => {
    const p = document.querySelector('[data-canvas-ui=turntable-popover]');
    if (!p) return 'NO-POPOVER';
    const b = [...p.querySelectorAll('button')].find(x => x.textContent.trim() === 'Record 360° loop');
    if (!b) return 'NO-RECORD-BTN';
    if (b.disabled) return 'RECORD-DISABLED';
    b.click(); return 'record-clicked';
  })()`));
  if (clk !== "record-clicked") throw new Error(clk);
  step("  record clicked");
  let sawBadge = false, sawGif = false, gifText = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const bs = badgeState();
    if (bs.badge) { sawBadge = true; if (bs.rec) gifText = bs.rec; }
    if (sawBadge) break;
  }
  if (!sawBadge) throw new Error("REC badge never appeared");
  step(`  recording: ${JSON.stringify(badgeState())}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa56-recording.png`);
  // wait for the badge to vanish (turn + encode tail) — watch it flip to
  // GIF progress on the way when a GIF is expected
  const limit = wantGif ? 55 : 30;
  for (let i = 0; i < limit * 2; i++) {
    await sleep(500);
    const bs = badgeState();
    if (bs.badge && bs.gifProgress) { sawGif = true; gifText = bs.gifProgress; }
    if (!bs.badge) break;
  }
  const final = badgeState();
  if (final.badge) throw new Error(`badge never cleared after ${limit}s: ${JSON.stringify(final)}`);
  step(`  badge cleared (gifProgress seen=${sawGif}${gifText ? ` — "${gifText}"` : ""})`);
  return { sawBadge, sawGif, gifText };
};

/** PHASE A — GIF on (default): two blobs, both toasts */
const phaseA = async () => {
  console.log("== PHASE A: turntable + GIF side-export ==");
  const ready = await openViewer();
  if (!ready) throw new Error("viewer never became ready");
  await sleep(1500);
  evalJs(toastObserver);
  await openTurntablePopover();
  let pp = popoverProbe();
  step(`  popover: ${JSON.stringify(pp)}`);
  if (!pp || pp.gifOn !== "true" || pp.gifOff !== "false")
    throw new Error(`GIF chips wrong by default: ${JSON.stringify(pp)}`);
  if (!/animated GIF \(480 px/.test(pp.foot ?? ""))
    throw new Error(`footnote lacks GIF phrase: ${pp.foot}`);
  // fastest turn keeps the phase inside its poll budget
  evalJs(`(() => { const b = document.querySelector('[data-testid=turntable-speed-5000]'); b ? b.click() : 0; return 'spd'; })()`);
  hookBlobs();
  const base = J(`({ n: (window.__qaBlobs||[]).length })`).n;
  const r = await runRecord({ wantGif: true });
  await sleep(1200);
  const toasts = lastToasts(4);
  step(`  toasts: ${toasts}`);
  if (!/Turntable video exported/i.test(toasts)) throw new Error(`video toast missing: ${toasts}`);
  if (!/Turntable GIF exported/i.test(toasts)) throw new Error(`GIF toast missing: ${toasts}`);
  if (!/frames × \d+ ms — replays the turn at true pace/.test(toasts))
    throw new Error(`GIF toast lacks true-pace spec: ${toasts}`);
  const blobs = blobTail(4);
  step(`  blobs tail: ${JSON.stringify(blobs)}`);
  const webm = blobs.filter((b) => b.type.startsWith("video/webm")).pop();
  const gif = blobs.filter((b) => b.type === "image/gif").pop();
  if (!webm || webm.size < 20_000) throw new Error(`webm blob bad: ${JSON.stringify(blobs)}`);
  if (!gif) throw new Error("no image/gif blob captured");
  if (gif.size < 30_000) throw new Error(`gif blob suspiciously small: ${gif.size}`);
  // locate the gif blob by type and verify the magic bytes
  const gifIdx = J(`(() => {
    const a = (window.__qaBlobs||[]);
    for (let i = a.length - 1; i >= 0; i--) if (a[i].type === 'image/gif') return i;
    return -1;
  })()`);
  if (gifIdx < 0) throw new Error("gif blob index not found");
  const magic2 = await blobMagic(gifIdx);
  step(`  gif[${gifIdx}] magic: ${magic2}`);
  if (!/^GIF89a/.test(magic2)) throw new Error(`bad GIF magic: ${magic2}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa56-after-a.png`);
  step("  PHASE A PASS (webm + gif, both toasts, GIF89a magic)");
};

/** PHASE B — GIF off: one blob, footnote drops the phrase */
const phaseB = async () => {
  console.log("== PHASE B: WebM only ==");
  // standalone batches start with no page — A owns the bootstrap when present
  if (!PHASES.includes("A")) {
    const ready = await openViewer();
    if (!ready) throw new Error("viewer never became ready");
    await sleep(1500);
    evalJs(toastObserver);
  }
  await openTurntablePopover();
  const clk = unq(evalJs(`(() => {
    const b = document.querySelector('[data-testid=turntable-gif-0]');
    if (!b) return 'NO-CHIP';
    b.click(); return 'chip-clicked';
  })()`));
  if (clk !== "chip-clicked") throw new Error(clk);
  await sleep(400);
  const pp = popoverProbe();
  step(`  popover after off: ${JSON.stringify(pp)}`);
  if (pp.gifOn !== "false" || pp.gifOff !== "true")
    throw new Error(`GIF chips did not flip: ${JSON.stringify(pp)}`);
  if (/animated GIF \(480 px/.test(pp.foot ?? ""))
    throw new Error(`footnote still mentions GIF: ${pp.foot}`);
  hookBlobs();
  evalJs(toastObserver); // reset the toast window — phase A's GIF toast must not leak into B's assert
  await runRecord({ wantGif: false });
  await sleep(1200);
  const toasts = lastToasts(4);
  step(`  toasts: ${toasts}`);
  if (!/Turntable video exported/i.test(toasts)) throw new Error(`video toast missing: ${toasts}`);
  if (/Turntable GIF exported|GIF encode failed/i.test(toasts))
    throw new Error(`GIF toast should be absent: ${toasts}`);
  const blobs = blobTail(3);
  step(`  blobs tail: ${JSON.stringify(blobs)}`);
  const news = blobs.filter((b) => b.type.startsWith("video/") || b.type === "image/gif");
  if (news.length !== 1 || !news[0].type.startsWith("video/webm"))
    throw new Error(`expected exactly one webm blob, got ${JSON.stringify(news)}`);
  step("  PHASE B PASS (webm only)");
};

/** PHASE C — persistence + console clean */
const phaseC = async () => {
  console.log("== PHASE C: persistence + console ==");
  if (!PHASES.includes("A") && !PHASES.includes("B")) {
    const ready = await openViewer();
    if (!ready) throw new Error("viewer never became ready");
    await sleep(1500);
    await openTurntablePopover();
  }
  const stored = unq(evalJs(`(() => localStorage.getItem('cryoflow.mol-turntable-gif') ?? 'unset')()`));
  step(`  localStorage gif pref: ${stored}`);
  if (stored !== "0") throw new Error(`gif pref not persisted: ${stored}`);
  // restore ON — future sessions and reruns start from the feature default
  evalJs(`(() => { const b = document.querySelector('[data-testid=turntable-gif-1]'); b ? b.click() : 0; return 'restored'; })()`);
  await sleep(300);
  const restored = unq(evalJs(`(() => localStorage.getItem('cryoflow.mol-turntable-gif') ?? 'unset')()`));
  if (restored !== "1") throw new Error(`gif pref not restored: ${restored}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa56-final.png`);
  const inPage = J(`({ n: (window.__qaErrs||[]).length, errs: (window.__qaErrs||[]).slice(0,3) })`);
  step(`  in-page errors: ${JSON.stringify(inPage)}`);
  if (inPage.n > 0) throw new Error(`console errors present: ${JSON.stringify(inPage.errs)}`);
  const cliErrs = (() => { try { return sh(`${AB} errors`); } catch { return "(cli-unreachable)"; } })();
  step(`  cli errors (informational): ${cliErrs || "(empty)"}`);
};

(async () => {
  if (PHASES.includes("A")) await phaseA();
  if (PHASES.includes("B")) await phaseB();
  if (PHASES.includes("C")) await phaseC();
  step("ALL PHASES GREEN");
  sh(`${AB} close`);
})().catch((e) => {
  step(`FATAL: ${e.message}`);
  try { sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa56-fatal.png`); } catch { /* ignore */ }
  try { sh(`${AB} close`); } catch { /* ignore */ }
  process.exit(1);
});
