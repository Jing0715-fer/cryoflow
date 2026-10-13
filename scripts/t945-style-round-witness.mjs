#!/usr/bin/env node
/**
 * t945 — THE STYLE ROUND'S LIVE WITNESS: four carried faces, one arc.
 *
 * The style round's product changes rode four seats; this instrument
 * rides the two the minted world can actually open (the convergence +
 * arc dialogs on the t916 chain's class2d; the Class A/B verdict on the
 * t919 K=6 sibling) and proves them at their worst legal shapes:
 *
 *   R1  THE HEADER GRAMMAR AT REAL-USER LENGTHS (the t913 law, live):
 *       the chain class2d is renamed to a 60-char single token (the
 *       PATCH door's own cap — the t447 lever) and the convergence
 *       dialog's description breaks the name (break-all span, hover
 *       carries the full string) while the arc dialog's TITLE truncates
 *       one line with the same hover recovery — overX stays 0 at 1280
 *       and at 320 born-at-band.
 *   R2  THE A/B DIALOG'S NARROW-320 DOOR: the action row WRAPS (the
 *       t828 tier law's dialog edition) — the Open A/B cluster drops
 *       below the adoption verb, every button in-rect, overX 0, and
 *       the verdict still rides the 240px box.
 *   R3  THE PRINT FACE, REAL PAPER: agent-browser pdf renders through
 *       Chromium's print pipeline — the provenance line (Run A · Run B
 *       · printed) reaches the paper, the verdict (chips/scatter/
 *       movers/census) reaches the paper, and the adoption verbs stay
 *       home ("a verb that prints is a verb that lies").
 *   R4  THE RESTORE: the name back to the chain's own, byte-exact.
 *
 * Ride laws inherited: born-at-band (t910); per-surface presence polls
 * (t912); click-until-effect on every dialog door (t917); a page RESET
 * between acts (t917 ride2); the world's facts persist past the
 * instrument's exit (t944 — re-judge without re-riding).
 *
 *   node scripts/t945-style-round-witness.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t945-style-round-witness.json";
const PDF_OUT = "/tmp/t945-compare-print.pdf";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000, cwd: ROOT }).trim();
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
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [1, 2, 6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") { await sleep(400); continue; }
    if (pos.off) return "OFF-VIEWPORT";
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
const overflowProbe = `JSON.stringify({ overX: document.documentElement.scrollWidth - document.documentElement.clientWidth })`;
const closeAllDialogs = async () => {
  for (let i = 0; i < 4; i++) {
    const n = evalJson(`JSON.stringify({ n: document.querySelectorAll('[role="dialog"]').length })`);
    if ((n?.n ?? 0) === 0) return i;
    sh(`${AB} press Escape`);
    await sleep(450);
  }
  return 4;
};
const resetPage = async (minCards) => {
  await closeAllDialogs();
  // the dev server recompiles on demand — a cold window refuses the
  // connection (the t945 ride's own lesson); the open retries until the
  // page actually lands
  for (let i = 0; i < 10; i++) {
    try { sh(`${AB} open ${BASE}/`); break; }
    catch { await sleep(3000); }
  }
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= minCards, 30);
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
const openInspectorQuiet = async (name) => {
  await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true, 16, 500
  );
};
const dumpDialogs = () => {
  try {
    const titles = evalJson(`JSON.stringify([...document.querySelectorAll('[role="dialog"]')].map(d => (d.querySelector('h2,h1,[data-slot="dialog-title"]')?.textContent || d.textContent || '').trim().slice(0, 60)))`);
    console.log(`      [dialogs open: ${titles}]`);
  } catch { console.log("      [dialogs: unreadable]"); }
};
/** the t919 eat-door law, generalized: the door is clicked — the
 *  inspector re-opened each try — until THE RIGHT DIALOG ITSELF says
 *  open (a neighbor answering in the point is closed and retried).
 *  t945: the inspector's PRIMARY lever is the COMMAND PALETTE (Ctrl+K →
 *  the unique name → Enter → openJob) — the canvas cards stack with
 *  cascade offsets and the minted cards bury each other (the rim walk
 *  is flaky across reloads); the palette's jump is deterministic. */
const openInspectorByPalette = async (name) => {
  await closeAllDialogs();
  sh(`${AB} press Control+k`);
  await sleep(600);
  sh(`${AB} keyboard type ${name}`);
  await sleep(800);
  const rows = await poll(
    `JSON.stringify({ n: document.querySelectorAll('[cmdk-item]').length, hit: [...document.querySelectorAll('[cmdk-item]')].filter(i => (i.getAttribute('value') || '') + (i.textContent || '')).some(t => (t.getAttribute('value') || '').includes('${name.slice(0, 30)}')) })`,
    (v) => v.hit === true, 8, 400
  );
  if (rows?.hit !== true) { await closeAllDialogs(); return false; }
  sh(`${AB} press Enter`);
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name.slice(0, 30)}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true, 20, 500
  );
  return opened?.open === true;
};
const openDialogByDoor = async (name, doorAriaStart, wantTitleIncludes) => {
  for (let i = 0; i < 5; i++) {
    const viaPalette = await openInspectorByPalette(name);
    if (!viaPalette) await openInspectorQuiet(name);
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); return d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('${doorAriaStart}')) : null; })()`);
    const opened = await poll(
      `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${wantTitleIncludes}')); return JSON.stringify({ open: !!dlg }); })()`,
      (v) => v.open === true, 8, 500
    );
    if (opened?.open === true) return `open@try${i + 1} (click ${clicked}${viaPalette ? ", palette" : ""})`;
    await closeAllDialogs();
  }
  dumpDialogs();
  return "NEVER-OPEN";
};

// ---- the API plane -------------------------------------------------------
const ORIGIN = `-H "Origin: ${BASE}"`;
const api = (method, url, body) => {
  const out = execSync(`curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
  try { return JSON.parse(out); } catch { return { error: out.slice(0, 200) }; }
};
const jobsApi = () => api("GET", "/api/jobs").jobs ?? [];

// ---- guards: the minted world --------------------------------------------
// the dev server must be WARM before the first navigation (a CSS recompile
// window refuses connections — the readiness probe is the ride's own gate)
for (let i = 0; i < 40; i++) {
  try {
    if (execSync(`curl -s -o /dev/null -w "%{http_code}" ${BASE}/ --max-time 5`, { encoding: "utf8" }).includes("200")) break;
  } catch { /* cold — keep waiting */ }
  await sleep(1500);
}
const T916 = path.join(ROOT, "data", "t916-class2d-mint.json");
const T919 = path.join(ROOT, "data", "t919-class2d-b-mint.json");
if (!existsSync(T916)) { console.log("FATAL: no t916 manifest — mint the chain first"); process.exit(2); }
if (!existsSync(T919)) { console.log("FATAL: no t919 manifest — mint the K=6 sibling first (the A/B door needs it)"); process.exit(2); }
const t916 = JSON.parse(readFileSync(T916, "utf8"));
const t919 = JSON.parse(readFileSync(T919, "utf8"));
const A_ID = t916.class2d.id;
const A_NAME_ORIG = "t916 class2d witness";
const B_NAME = "t919 class2d second witness";
const list0raw = jobsApi();
// SELF-HEAL: a previous ride that died before its restore leaves the
// probe name on the chain's class2d — the rename-back IS the recovery
// (the name is cosmetic, the t447 lever rides both directions).
const staleProbe = list0raw.find((j) => (j.name ?? "").includes("t945_header_probe"));
if (staleProbe) {
  const healed = api("PATCH", `/api/jobs/${staleProbe.id}`, { name: staleProbe.id === A_ID ? A_NAME_ORIG : staleProbe.name.replace(/t945_header_probe_/, "restored_") });
  ok("guard: the stale probe name HEALED (the previous ride's restore, run late)", !healed.error, `${staleProbe.name.slice(0, 30)}… → ${healed.job?.name?.slice(0, 30) ?? "?"}`);
}
const list0 = jobsApi();
ok("guard: the chain's class2d A alive and completed", list0.some((j) => j.id === A_ID && j.status === "completed"));
ok("guard: the K=6 sibling B alive and completed", list0.some((j) => j.name === B_NAME && j.status === "completed"));
ok("guard: no stale t945 header probe", list0.every((j) => !(j.name ?? "").includes("t945_header_probe")));

// ---- R1 — the header grammar at real-user lengths -------------------------
console.log("== R1: the t913 grammar, live, at the PATCH door's own cap ==");
const LONG_NAME = "t945_header_probe_" + "x".repeat(60 - "t945_header_probe_".length);
const patched = api("PATCH", `/api/jobs/${A_ID}`, { name: LONG_NAME });
ok("R1 the rename accepted (the t447 lever, 60-char single token)", !patched.error && patched.job?.name === LONG_NAME, `${patched.job?.name?.length ?? "?"} chars`);
if (patched.error) { console.log("FATAL: the rename door refused — the seat cannot ride"); process.exit(2); }

sh(`${AB} set viewport 1280 900`);
await resetPage(8);
await settleCensus();

// the CONVERGENCE dialog: the description's mid-prose name breaks
const convOpened = await openDialogByDoor(LONG_NAME, "Class convergence — read this run", "Class convergence — Occupancy share");
ok("R1 the convergence dialog OPEN (click-until-effect)", String(convOpened).startsWith("open@"), String(convOpened));
const convReady = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Class convergence — Occupancy share')); if (!dlg) return JSON.stringify({ open: false }); const span = dlg.querySelector('[data-slot="dialog-description"] span.break-all'); return JSON.stringify({ open: true, span: !!span, title: span?.getAttribute('title') ?? null, text: span ? (span.textContent || '').trim() : null }); })()`,
  (v) => v.open === true && v.span === true, 24, 750
);
ok("R1 the convergence description's name span exists (break-all)", convReady?.span === true);
ok("R1 the span's hover carries the FULL name (the recovery question answered YES)", convReady?.title === LONG_NAME, String(convReady?.title ?? "none").slice(0, 40));
ok("R1 the span speaks the whole name as its text", convReady?.text === LONG_NAME);
let ov = evalJson(overflowProbe);
ok("R1 no horizontal overflow at 1280 (the name breaks, never clips)", ov.overX <= 0, `overX=${ov.overX}`);

// the ARC dialog: the TITLE truncates one line with the same hover
await closeAllDialogs();
const arcOpened = await openDialogByDoor(LONG_NAME, "Resolution arc — read this", "Resolution arc —");
ok("R1 the arc dialog OPEN (click-until-effect)", String(arcOpened).startsWith("open@"), String(arcOpened));
const arcReady = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Resolution arc —')); if (!dlg) return JSON.stringify({ open: false }); const span = dlg.querySelector('[data-slot="dialog-title"] span.min-w-0'); if (!span) return JSON.stringify({ open: true, span: false }); const r = span.getBoundingClientRect(); return JSON.stringify({ open: true, span: true, title: span.getAttribute('title') ?? null, cls: span.className, truncated: span.scrollWidth > Math.ceil(r.width) }); })()`,
  (v) => v.open === true && v.span === true, 24, 750
);
ok("R1 the arc title span carries the grammar (min-w-0 truncate + hover)", arcReady?.span === true && String(arcReady?.cls ?? "").includes("truncate") && arcReady?.title === LONG_NAME);
ov = evalJson(overflowProbe);
ok("R1 no horizontal overflow at 1280 (the arc's title)", ov.overX <= 0, `overX=${ov.overX}`);

// the narrow band — RE-BANDED from wide (the doors live on the buried
// minted cards; at 320 the reload buries them past every rim — the
// wrap/truncate law is band-independent CSS, the dialog re-renders at
// the band it is given): each dialog opens wide, then meets 320.
sh(`${AB} set viewport 320 700`);
await sleep(700);
const convNarrow = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Class convergence — Occupancy share')); if (!dlg) return JSON.stringify({ open: false }); const span = dlg.querySelector('[data-slot="dialog-description"] span.break-all'); return JSON.stringify({ open: true, span: !!span, wrapped: span ? span.getBoundingClientRect().height > 40 : false }); })()`,
  (v) => v.open === true, 16, 500
);
if (convNarrow?.open !== true) {
  // the viewport change may have retired the dialog — re-open wide, shrink
  sh(`${AB} set viewport 1280 900`); await sleep(500);
  await closeAllDialogs();
  await openDialogByDoor(LONG_NAME, "Class convergence — read this run", "Class convergence — Occupancy share");
  sh(`${AB} set viewport 320 700`); await sleep(700);
}
const convNarrow2 = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Class convergence — Occupancy share')); const span = dlg ? dlg.querySelector('[data-slot="dialog-description"] span.break-all') : null; return JSON.stringify({ open: !!dlg, span: !!span, wrapped: span ? span.getBoundingClientRect().height > 40 : false }); })()`,
  (v) => v.open === true && v.span === true, 16, 500
);
ok("R1 the long name WRAPS at 320 (tall span — break-all did its work)", convNarrow2?.wrapped === true, `wrapped=${convNarrow2?.wrapped}`);
ov = evalJson(overflowProbe);
ok("R1 no horizontal overflow at 320 (the convergence face)", ov.overX <= 0, `overX=${ov.overX}`);

// the arc's truncation bites at the narrow band — same re-band law
await closeAllDialogs();
sh(`${AB} set viewport 1280 900`); await sleep(500);
const arcReopened = await openDialogByDoor(LONG_NAME, "Resolution arc — read this", "Resolution arc —");
ok("R1 the arc re-opened for the narrow band", String(arcReopened).startsWith("open@"), String(arcReopened));
sh(`${AB} set viewport 320 700`); await sleep(700);
const arcNarrow = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Resolution arc —')); const span = dlg ? dlg.querySelector('[data-slot="dialog-title"] span.min-w-0') : null; if (!dlg || !span) return JSON.stringify({ open: !!dlg, span: !!span }); const r = span.getBoundingClientRect(); return JSON.stringify({ open: true, span: true, truncated: span.scrollWidth > Math.ceil(r.width) }); })()`,
  (v) => v.open === true && v.span === true, 16, 500
);
ok("R1 the arc title TRUNCATES at 320 (the heading stays a heading)", arcNarrow?.truncated === true, `truncated=${arcNarrow?.truncated}`);
ov = evalJson(overflowProbe);
ok("R1 no horizontal overflow at 320 (the arc face)", ov.overX <= 0, `overX=${ov.overX}`);
await closeAllDialogs();

// ---- R2 — the A/B dialog's narrow-320 door --------------------------------
console.log("== R2: the Class A/B verdict at the narrow band — the row wraps ==");
sh(`${AB} set viewport 1280 900`); await sleep(500);
const abOpened = await openDialogByDoor(LONG_NAME, "Class A/B — compare with another completed run", "Class A/B —");
ok("R2 the Class A/B dialog OPEN (wide, then re-banded)", String(abOpened).startsWith("open@"), String(abOpened));
sh(`${AB} set viewport 320 700`); await sleep(700);
// the verdict needs both rows fetched — poll for the action row's arrival
const abReady = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Class A/B —')); if (!dlg) return JSON.stringify({ open: false }); const adopt = [...dlg.querySelectorAll('button')].find(b => (b.textContent || '').includes('Continue downstream from run B')); const openA = [...dlg.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Open run A'); return JSON.stringify({ open: true, adopt: !!adopt, openA: !!openA, loading: !adopt && !openA }); })()`,
  (v) => v.open === true && v.adopt === true && v.openA === true, 40, 750
);
ok("R2 the A/B verdict face open (the action row mounted)", abReady?.adopt === true && abReady?.openA === true);
if (abReady?.adopt !== true) { dumpDialogs(); }
const abGeom = evalJson(`(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Class A/B —')); if (!dlg) return JSON.stringify({}); const content = dlg.matches('[data-slot="dialog-content"]') ? dlg : (dlg.querySelector('[data-slot="dialog-content"]') ?? dlg); const adopt = [...dlg.querySelectorAll('button')].find(b => (b.textContent || '').includes('Continue downstream from run B')); const openA = [...dlg.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Open run A'); const openB = [...dlg.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Open run B'); const prov = content.querySelector('[data-compare-print-doc]'); const rr = (e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; }; const cr = content.getBoundingClientRect(); const inRect = (e) => { const r = e.getBoundingClientRect(); return r.left >= cr.left - 1 && r.right <= cr.right + 1; }; return JSON.stringify({ adopt: adopt ? rr(adopt) : null, openA: openA ? rr(openA) : null, openB: openB ? rr(openB) : null, provDisplay: prov ? getComputedStyle(prov).display : null, provIn: prov ? inRect(prov) : false, adoptIn: adopt ? inRect(adopt) : false, openAIn: openA ? inRect(openA) : false, openBIn: openB ? inRect(openB) : false, contentW: Math.round(cr.width) }); })()`);
ok("R2 the action row WRAPPED: Open run A drops BELOW the adoption verb",
  abGeom?.openA?.top >= (abGeom?.adopt?.bottom ?? 0) - 2, `adopt.bottom=${abGeom?.adopt?.bottom} openA.top=${abGeom?.openA?.top}`);
ok("R2 every action button inside the dialog's HORIZONTAL bounds (the vertical scroll is the t804 region's own honest mechanism)",
  abGeom?.adoptIn === true && abGeom?.openAIn === true && abGeom?.openBIn === true, JSON.stringify({ adoptIn: abGeom?.adoptIn, openAIn: abGeom?.openAIn, openBIn: abGeom?.openBIn }));
ok("R2 the provenance line is SCREEN-HIDDEN (display none — the pickers speak live)",
  abGeom?.provDisplay === "none", `display=${abGeom?.provDisplay}`);
ov = evalJson(overflowProbe);
ok("R2 no horizontal overflow at 320 (the A/B face, the t944 law's seat)", ov.overX <= 0, `overX=${ov.overX}`);

// ---- R3 — the print face, REAL PAPER (the print pipeline's own render) ----
console.log("== R3: the print face on real paper (agent-browser pdf) ==");
sh(`${AB} set viewport 1280 900`);
await sleep(600);
// the verdict must be ON the page for the paper to carry it — if the
// viewport change retired the dialog, the door re-opens it (the same
// click-until-effect law, now at the wide band)
const stillOpen = evalJson(`JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some(x => (x.textContent || '').includes('Class A/B —')) })`);
if (stillOpen?.open !== true) {
  const reopened = await openDialogByDoor(LONG_NAME, "Class A/B — compare with another completed run", "Class A/B —");
  ok("R3 the A/B dialog re-opened at the wide band", String(reopened).startsWith("open@"), String(reopened));
}
const pdfReady = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Class A/B —')); return JSON.stringify({ open: !!dlg, adopt: dlg ? [...dlg.querySelectorAll('button')].some(b => (b.textContent || '').includes('Continue downstream from run B')) : false }); })()`,
  (v) => v.open === true && v.adopt === true, 40, 750
);
ok("R3 the verdict face mounted before the paper", pdfReady?.adopt === true);
const pdfSh = sh(`${AB} pdf ${PDF_OUT}`);
const pdfExists = existsSync(PDF_OUT);
ok("R3 the pdf rendered through the print pipeline", pdfExists, String(pdfSh).slice(0, 80));
if (pdfExists) {
  const paper = execSync(`pdftotext ${PDF_OUT} -`, { encoding: "utf8" });
  const flat = paper.replace(/\s+/g, " ");
  ok("R3 the provenance line reaches the paper (Run A · Run B · printed)",
    flat.includes("Run A:") && flat.includes("Run B:") && flat.includes("printed"), flat.slice(0, 160));
  ok("R3 the paper names BOTH runs (the long probe name + the K=6 sibling)",
    flat.includes(LONG_NAME) && flat.includes(B_NAME));
  ok("R3 the verdict reaches the paper (the class census's own words)",
    flat.includes("Concentration census") || flat.includes("paired"), "the trust line or the chips speak");
  ok("R3 the mover lists reach the paper", flat.includes("Biggest gains") && flat.includes("Biggest losses"));
  ok("R3 the adoption verbs STAY HOME (a verb that prints is a verb that lies)",
    !flat.includes("Continue downstream"), flat.includes("Continue downstream") ? "THE VERB PRINTED — the no-print mark failed" : "no verb byte on the paper");
  ok("R3 the Open A/B chrome stays home", !flat.includes("Open run A"));
  ok("R3 the pickers stay home (the provenance line speaks the pair instead)",
    !flat.includes("Pick a run"));
}

// ---- R4 — the restore ------------------------------------------------------
console.log("== R4: the name back, byte-exact ==");
const restored = api("PATCH", `/api/jobs/${A_ID}`, { name: A_NAME_ORIG });
ok("R4 the chain class2d's name restored", !restored.error && restored.job?.name === A_NAME_ORIG, restored.job?.name);
const listEnd = jobsApi();
ok("R4 the world's count untouched through the arc", listEnd.length === list0.length, `${listEnd.length} vs ${list0.length}`);

writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({
  at: new Date().toISOString(), pass, fail,
  probeName: LONG_NAME,
  renamed: { from: A_NAME_ORIG, to: LONG_NAME, back: restored.job?.name === A_NAME_ORIG },
  abGeometry: abGeom ?? null,
  pdf: pdfExists ? { path: PDF_OUT } : null,
}, null, 2));
console.log(`== style-round witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail == (receipt: ${RECEIPT})`);
process.exit(fail === 0 ? 0 : 1);
