#!/usr/bin/env node
/**
 * t954 — the SELECT rider's HIDDEN face, first live browser ride: the
 * t453 wiring gate's honest silence. The t954 world grows the t953
 * world one rung UP the 3D ladder — the host is a CLASS3D (outputs
 * model(volume) + particles; NO references2d), so the select2d mint's
 * classes mouth cannot be fed and the selectWired gate reads FALSE:
 *
 *   the SELECT rider renders NOTHING — no button, no aria, no title —
 *   while the verdict sheet still speaks its full occupancy law
 *   (3 gained · 0 lost · 0 held, the unpaired chip naming Class 004)
 *
 *   — and the graph is the FRIENDLY twin of t953's: A's ONLY downstream
 *   wire hangs on the PARTICLES mouth (A.particles→C.particles), the
 *   mint preview (the t954 unit's M-band) would MOVE it — moves=1,
 *   refused=0. So the hiding is the MOUTH-COVERAGE gate's choice (the
 *   mint's gallery would starve — a 3D classification has no class-
 *   averages references), never the plan's refusal: the plan says YES,
 *   the gate says NOTHING. The t948 no-op law's quietest mouth: a
 *   rider that can only promise a starving mint is no rider at all.
 *
 *   The PLAIN verb — planning against B (a class3d that DOES declare
 *   the particles mouth) — moves C honestly: ENABLED, clean speech.
 *   One world, one hidden rider, one plain fire.
 *
 *   P  the world: the t954 mint re-rides idempotently, the reload,
 *      9 cards (seed trio + pick + extract + initialmodel + A + B + C).
 *   E  THE HIDDEN FACE: the occupancy chips unchanged (3 gained ·
 *      0 lost · 0 held, the unpaired chip naming Class 004 — the
 *      classes law stable up the 3D ladder), THE CROWN — the SELECT
 *      rider ABSENT while the chips prove improvedSeries=3 (the render
 *      gate's other condition holds; only the wiring gate can hide it)
 *      — and the plain verb ENABLED with its clean aria/title/contract
 *      (no refusal clause, no wired clause — the plan has neither
 *      bucket to speak).
 *   F  THE CONTRAST FIRE through the plain door: B→C born with the
 *      wire's OWN port pair (particles→particles), A→C gone, the
 *      toast's clean contract verbatim, NO selection minted (the
 *      hidden rider minted nothing — the silence is not just words),
 *      the dialog closes itself.
 *   R  the restore: the t954 remove GREEN, the seed trio + 2 edges,
 *      the doctor CLEAN, the smoke clean.
 *
 *   node scripts/t954-select-hidden-face-witness.mjs main
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t954-select-hidden-face-witness.json";
const MANIFEST = path.join(ROOT, "data", "t954-class3d-hidden-world.json");

const NAME_A = "3D Classification 1 (t954)";
const NAME_B = "3D Classification 2 (t954)";
const NAME_C = "Particles Consumer (t954)";
const DIALOG_TITLE = "Class A/B — Occupancy share";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
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
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) {
      evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
      await sleep(500);
      const pos2 = evalJson(locate);
      if (pos2 && pos2.own) {
        sh(`${AB} mouse move ${pos2.x} ${pos2.y}`);
        sh(`${AB} mouse down`);
        sh(`${AB} mouse up`);
        return `clicked@${pos2.x},${pos2.y}`;
      }
      return "OFF-VIEWPORT";
    }
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
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
const settleCensus = async () => {
  let last = null;
  for (let i = 0; i < 24; i++) {
    const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job]')].map(c => { const b = c.querySelector('[role="button"][tabindex]') || c; const r = b.getBoundingClientRect(); return (c.getAttribute('data-job') ?? '') + ':' + Math.round(r.x) + ',' + Math.round(r.y); }).sort())`);
    if (census && census === last) break;
    last = census;
    await sleep(500);
  }
};
/* THE T948 RIDE-1 LAW: edges POSTed on the API plane reach the store
 * only through a fresh page load. Reload after EVERY API-side graph
 * mutation before any door. */
const reloadPage = async (minCards) => {
  sh(`${AB} open ${BASE}/`);
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= minCards, 30);
  await settleCensus();
};
/* THE T946 LAW (the t952 armor, carried): the API plane hiccups
 * against the dev server's own windows — a refused read is noise, not
 * a dead world. Every API read rides SIX windows before it claims
 * failure (甲要穿到每一次读). */
const apiRaw = (method, url, body) => {
  const cmd = `curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`;
  let lastErr = null;
  for (let i = 0; i < 6; i++) {
    try { return sh(cmd); } catch (e) { lastErr = e; sleep(2000); continue; }
  }
  throw lastErr ?? new Error("the API never answered through six windows");
};
const shApi = (url) => apiRaw("GET", url);
const apiJson = (url) => JSON.parse(shApi(url));
const api = (method, url, body) => {
  try { return JSON.parse(apiRaw(method, url, body)); } catch { return { error: "parse" }; }
};
const jobs = () => apiJson("/api/jobs").jobs ?? [];
const edges = () => apiJson("/api/edges").edges ?? [];
const openInspector = async (name) => {
  /* THE T953 RIDE-1 LAW (被面板盖住的卡片走产品的 find 门): the canvas
   * pans freely and the job-type palette overlays the canvas' left —
   * a card can sit UNDER the palette (scrollIntoView cannot pan a
   * transform). The product's own bring-here is the find bar: Ctrl+F,
   * type, Enter — the focusJob arrival centers the canvas on the card,
   * clear of the palette — then Escape stands the bar down. */
  sh(`${AB} press Control+f`);
  await sleep(400);
  sh(`${AB} keyboard type "${name}"`);
  await sleep(400);
  sh(`${AB} press Enter`);
  await sleep(900);
  sh(`${AB} press Escape`);
  await sleep(500);
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  ok(`card "${name}" clicked (own at the actual point)`, String(clicked).startsWith("clicked@"), String(clicked));
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true, 12, 600,
  );
  ok(`inspector "${name}" opened`, opened?.open === true);
};
const openCompareUntil = async (inspectorName, doorAriaPrefix, compareTitlePrefix) => {
  for (let i = 0; i < 8; i++) {
    const already = evalJson(`JSON.stringify([...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('${compareTitlePrefix}') && (d.textContent || '').includes('Run A')))`);
    if (already === true) return `open@try${i}`;
    const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${inspectorName}'))?.querySelector('[aria-label^="${doorAriaPrefix}"]')`);
    if (!String(clicked).startsWith("clicked@")) {
      evalJs(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${inspectorName}')); const b = d?.querySelector('[aria-label^="${doorAriaPrefix}"]'); if (b) { b.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; } return 'no-door'; })()`);
      if (i === 3) { sh(`${AB} press Escape`); await sleep(700); await openInspector(inspectorName); }
      await sleep(500);
      continue;
    }
    const opened = await poll(`(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; return JSON.stringify(ds.some(d => (d.textContent || '').includes('${compareTitlePrefix}') && (d.textContent || '').includes('Run A'))) })()`, (v) => v === true, 6, 450);
    if (opened === true) return `open@try${i + 1}`;
  }
  return "NEVER-OPEN";
};
const closeDialogs = async () => {
  sh(`${AB} press Escape`);
  await sleep(700);
  await poll(
    `JSON.stringify({ open: document.querySelectorAll('[role="dialog"]').length > 0 })`,
    (v) => v.open === false, 8, 500,
  );
};
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
}
/* the compare face whole: the plain verb, the contract line, the SELECT
 * rider's PRESENCE (null IS the verdict here), and the verdict chips'
 * words — one read, the hidden face. The poll's gate waits for the
 * PLAIN verb + the gained chips (the analysis loaded); it must NOT
 * wait for the select rider — its absence is the face's crown. */
const dialogFace = async () => poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${DIALOG_TITLE}') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const contractDivs = [...d.querySelectorAll('div')].filter(x => (x.textContent || '').trim().startsWith('Adoption re-wires'));
  const contract = (contractDivs.find(x => x.children.length === 0) ?? contractDivs.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0])?.textContent?.trim() ?? null;
  const sel = d.querySelector('[data-testid="adopt-with-select"]');
  const plain = d.querySelector('[data-testid="adopt-downstream"]');
  const unpaired = [...d.querySelectorAll('span')].find(s => (s.textContent || '').startsWith('unpaired:'));
  return JSON.stringify({ open: true, text: d.textContent || '', contract,
    plain: plain ? { disabled: plain.disabled, aria: plain.getAttribute('aria-label'), title: plain.getAttribute('title'), label: plain.textContent?.replace(/\\s+/g, ' ')?.trim() ?? null } : null,
    selectPresent: !!sel,
    select: sel ? { disabled: sel.disabled, aria: sel.getAttribute('aria-label'), title: sel.getAttribute('title'), label: sel.textContent?.replace(/\\s+/g, ' ')?.trim() ?? null } : null,
    unpaired: unpaired ? { text: unpaired.textContent?.trim(), title: unpaired.getAttribute('title') } : null }); })()`,
  (v) => v.open === true && !!v.plain && /gained/.test(v.text ?? ""), 30, 600,
);

/* ================================================================== */
console.log("== band P: the world — the t954 mint re-rides, the reload ==");
/* a crashed prior ride's minted selection (default-named) is swept */
for (const pf of jobs().filter((j) => j.type === "select2d" && /^2D Class Selection \d+/.test(j.name ?? ""))) {
  for (const fe of edges().filter((e) => e.toJobId === pf.id || e.fromJobId === pf.id)) api("DELETE", `/api/edges/${fe.id}`);
  const d = api("DELETE", `/api/jobs/${pf.id}`);
  ok("P a stale minted selection deleted (the idempotency sweep)", !d.error || String(d.error).includes("not found"), pf.name);
}
let M = null;
if (existsSync(MANIFEST)) {
  const vOut = sh(`unset DATABASE_URL; node scripts/t954-class3d-hidden-world-mint.mjs verify 2>&1`);
  if (/verify GREEN/.test(vOut)) {
    M = JSON.parse(readFileSync(MANIFEST, "utf8"));
    ok("P the standing world verified GREEN (idempotent re-ride)", true, `a=${M.a.id.slice(-8)}`);
  } else {
    sh(`unset DATABASE_URL; node scripts/t954-class3d-hidden-world-mint.mjs remove 2>&1`);
    ok("P a RED world removed (the retry's law)", true);
  }
}
if (!M) {
  const mintOut = sh(`unset DATABASE_URL; node scripts/t954-class3d-hidden-world-mint.mjs mint 2>&1`);
  ok("P the t954 mint rides GREEN", /mint GREEN/.test(mintOut), (mintOut.match(/== mint .*==/) ?? ["?"])[0]);
  if (!/mint GREEN/.test(mintOut)) { console.log("FATAL: the mint refused — the witness cannot ride"); process.exit(2); }
  M = JSON.parse(readFileSync(MANIFEST, "utf8"));
}
const A = M.a, B = M.b, C = M.c;
sh(`${AB} set viewport 1280 900`);
await reloadPage(9);
const worldCards = evalJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
ok("P the world renders (9 cards — the seed trio + pick + extract + initialmodel + A + B + C)", worldCards?.cards === 9, String(worldCards?.cards));

/* ================================================================== */
console.log("== band E: THE HIDDEN FACE — the wiring gate's honest silence ==");
/* THE T953 RIDE-2 LAW (整门重试): the compare dialog can leave the DOM
 * mid-read — close, re-open (the open toggle re-arms the fetch effect),
 * re-read — up to three whole-door attempts, with the DOM dumped on
 * every empty read so the next ride sees WHY. */
const openCompareFace = async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) {
      console.log(`  (attempt ${attempt}: the compare face left the DOM mid-read — re-opening through the product's own doors)`);
      await closeDialogs();
      await sleep(800);
    }
    await openInspector(NAME_A);
    const openE = await openCompareUntil(NAME_A, "Class A/B — compare", DIALOG_TITLE);
    ok(`E the compare dialog opened on the occupancy lens (attempt ${attempt})`, String(openE).startsWith("open@"), openE);
    if (!String(openE).startsWith("open@")) continue;
    /* THE T949 RIDE-1 LAW (读脸先等脸的数据到场): the poll's gate waits
     * for the plain verb AND the gained chips — the analysis loaded —
     * never for the select rider (its absence is the crown). */
    const face = await dialogFace();
    if (face?.plain) return face;
    const diag = evalJson(`JSON.stringify({ n: document.querySelectorAll('[role="dialog"]').length, texts: [...document.querySelectorAll('[role="dialog"]')].map(d => (d.textContent || '').slice(0, 70)) })`);
    console.log(`  (dialogFace came back empty — the DOM now: ${JSON.stringify(diag)})`);
  }
  return null;
};
const faceE = await openCompareFace();
ok("E the HIDDEN FACE read whole (the plain verb + the chips aboard)", !!faceE?.plain);
ok("E the dialog's title signs the occupancy lens", (faceE?.text ?? "").includes(DIALOG_TITLE));
/* the class domain's own words — the classes law stable UP the 3D
 * ladder (the world changed its rung, not its math) */
ok("E the verdict chips speak the class words (3 gained · 0 lost · 0 held)",
  (faceE?.text ?? "").includes("3 gained") && (faceE?.text ?? "").includes("0 lost") && (faceE?.text ?? "").includes("0 held"));
ok("E the unpaired chip names the honest count (1 in A · 0 in B)",
  faceE?.unpaired?.text === "unpaired: 1 in A · 0 in B", faceE?.unpaired?.text ?? "none");
ok("E the unpaired chip's tooltip names Class 004 (the K=4 orphan)",
  (faceE?.unpaired?.title ?? "").includes("Only in A: Class 004"), faceE?.unpaired?.title ?? "none");
/* ===== THE CROWN: the SELECT RIDER ABSENT — the honest silence ===== */
/* the chips prove improvedSeries=3 (the render gate's OTHER condition,
 * improvedSeries.length > 0, HOLDS) — so the absence can only be the
 * wiring gate's verdict (selectWired=false: a class3d host cannot feed
 * the mint's classes mouth). The t954 unit's M-band pins the same
 * graph's mint preview at moves=1 — the plan would speak the ENABLED
 * speech; the gate says NOTHING. The silence is a choice. */
ok("E THE CROWN: the SELECT RIDER ABSENT (no adopt-with-select node in the whole dialog)",
  faceE?.selectPresent === false);
ok("E the rider's label text appears NOWHERE (the silence is whole — not a disabled stub)",
  !(faceE?.text ?? "").includes("selecting these"));
/* ===== the PLAIN verb ENABLED — the same graph feeds it honestly ===== */
ok("E the PLAIN verb ENABLED (its fire moves C onto B — B declares the particles mouth)",
  faceE?.plain?.disabled === false, String(faceE?.plain?.disabled));
const EXPECT_PLAIN_ARIA = `Continue downstream from ${NAME_B} — re-wires 1 of ${NAME_A}'s downstream jobs`;
ok("E THE PLAIN ARIA speaks the clean move verbatim (no refusal clause, no wired clause — the plan has neither bucket)",
  faceE?.plain?.aria === EXPECT_PLAIN_ARIA, faceE?.plain?.aria ?? "none");
const EXPECT_PLAIN_TITLE = `Re-wires ${NAME_A}'s 1 downstream wire to ${NAME_B} — their current results stay until re-run`;
ok("E the PLAIN TITLE is the clean enabled speech verbatim",
  faceE?.plain?.title === EXPECT_PLAIN_TITLE, faceE?.plain?.title ?? "none");
ok("E the PLAIN's label carries the count (1)", (faceE?.plain?.label ?? "").startsWith("Continue downstream from run B") && (faceE?.plain?.label ?? "").includes("(1)"), faceE?.plain?.label ?? "none");
const EXPECT_CONTRACT = `Adoption re-wires ${NAME_A}'s 1 downstream job to consume ${NAME_B} — their current results stay until re-run.`;
ok("E the CONTRACT line is the clean accounting verbatim (no Also, no refusal sentence)",
  faceE?.contract === EXPECT_CONTRACT, faceE?.contract ?? "none");

/* ================================================================== */
console.log("== band F: THE CONTRAST FIRE through the plain door ==");
const jobsAtFire = jobs().length;
const firePoll = poll(
  `(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => ({ title: t.querySelector('[data-title]')?.textContent ?? null, all: t.textContent?.slice(0, 600) ?? '' })); const hit = toasts.find(t => (t.all || '').includes('Downstream adopted by')); return JSON.stringify(hit ? { title: hit.title, all: hit.all } : {}); })()`,
  (v) => v && v.all, 40, 500,
);
const fired = await (async () => {
  for (let i = 0; i < 10; i++) {
    const f = await dialogFace();
    if (f?.plain?.disabled === false) {
      const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${DIALOG_TITLE}') && (d.textContent || '').includes('Run A'))?.querySelector('[data-testid="adopt-downstream"]')`);
      if (!String(clicked).startsWith("clicked@")) { await sleep(600); continue; }
      for (let w = 0; w < 30; w++) {
        const es = edges();
        if (es.some((e) => e.fromJobId === B.id && e.toJobId === C.id && e.fromPort === "particles" && e.toPort === "particles") &&
            !es.some((e) => e.fromJobId === A.id && e.toJobId === C.id)) return `fired@try${i}`;
        await sleep(500);
      }
      return `clicked-but-unmoved@try${i}`;
    }
    await sleep(700);
  }
  return "NEVER-FIRED";
})();
ok("F the fire landed (B→C born, A→C gone)", String(fired).startsWith("fired@"), String(fired));
const esAfter = edges();
ok("F THE MOVE: B→C born with the wire's OWN port pair (particles→particles — the wire keeps its mouth)",
  !!esAfter.find((e) => e.fromJobId === B.id && e.toJobId === C.id && e.fromPort === "particles" && e.toPort === "particles"),
  esAfter.find((e) => e.fromJobId === B.id && e.toJobId === C.id)?.id ?? "missing");
ok("F the move: A→C GONE", !esAfter.some((e) => e.fromJobId === A.id && e.toJobId === C.id));
ok("F NO MINT — the hidden rider minted nothing (the silence is not just words: jobs unchanged)",
  jobs().length === jobsAtFire, `${jobs().length} (was ${jobsAtFire})`);
ok("F no selection exists anywhere (the hidden door never opened a mint)",
  jobs().every((j) => !/^2D Class Selection \d+/.test(j.name ?? "")));
const toastV = await firePoll;
let toastSeen = toastV && toastV.all ? { title: toastV.title, all: toastV.all } : null;
if (!toastSeen?.all) {
  const again = evalJson(`(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => t.textContent?.slice(0, 600) ?? ''); const hit = toasts.find(t => t.includes('Downstream adopted by')); return JSON.stringify(hit ?? null); })()`);
  toastSeen = typeof again === "string" && again !== "null" ? { title: null, all: again } : null;
}
ok("F THE TOAST's title speaks run B as the new father", !!toastSeen?.all && toastSeen.all.includes(`Downstream adopted by ${NAME_B}`), (toastSeen?.title ?? toastSeen?.all ?? "none").slice(0, 90));
const EXPECT_DETAIL = `1 downstream wire re-wired from ${NAME_A} to ${NAME_B} · ${NAME_C} now consumes ${NAME_B} · their current results stay until re-run`;
ok("F THE TOAST's detail carries the clean contract verbatim (the move, the consumer, the stay — no refusal, no wired)",
  (toastSeen?.all ?? "").includes(EXPECT_DETAIL), (toastSeen?.all ?? "none").slice(0, 400));
const dialogClosed = await poll(
  `JSON.stringify({ gone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('${DIALOG_TITLE}')) })`,
  (v) => v.gone === true, 12, 600,
);
ok("F the dialog closes itself (the canvas shows the re-parented wiring)", dialogClosed?.gone === true);

/* ================================================================== */
console.log("== band R: the restore — the world back to the seed trio ==");
sh(`${AB} press Escape`);
await sleep(500);
const removeOut = sh(`unset DATABASE_URL; node scripts/t954-class3d-hidden-world-mint.mjs remove 2>&1`);
ok("R the t954 remove GREEN (the fired world's C/B/A/initialmodel edges die with their jobs)", /remove GREEN/.test(removeOut), (removeOut.match(/== remove .*==/) ?? ["?"])[0]);
await sleep(1200);
await reloadPage(3);
const finalJobs = jobs();
const finalEdges = edges();
ok("R the world back to the seed trio (3 jobs, 2 edges)", finalJobs.length === 3 && finalEdges.length === 2, `${finalJobs.length} jobs / ${finalEdges.length} edges`);
const doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`);
ok("R the doctor CLEAN at the window end", doctorOut.includes("VERDICT: CLEAN"), (doctorOut.match(/VERDICT.*/) ?? ["?"])[0]);
const smoke = evalJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, overX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })`);
ok("R the final smoke clean (3 cards, overX 0)", smoke?.cards === 3 && smoke?.overX === false, JSON.stringify(smoke));

/* ================================================================== */
writeReceipt({
  pass, fail,
  world: { a: A?.id, b: B?.id, c: C?.id },
  face: { plain: faceE?.plain ?? null, selectPresent: faceE?.selectPresent ?? null, contract: faceE?.contract ?? null, unpaired: faceE?.unpaired ?? null },
  fired: String(fired),
  toast: toastSeen ?? null,
  at: new Date().toISOString(),
});
console.log(`\nSELECT-HIDDEN-FACE-WITNESS t954: ${pass}/${pass + fail} ${fail === 0 ? "green — the rider's HIDDEN face is live: the wiring gate's honest silence speaks where the plan would enable, and the same graph feeds the plain fire" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
