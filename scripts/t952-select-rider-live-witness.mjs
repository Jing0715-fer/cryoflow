#!/usr/bin/env node
/**
 * t952 — the SELECT rider's live twin: the t949 mint-preview's dup-skip
 * law gets its select-side browser witness, in the multi-input class
 * world the t952 mint grew. What makes this seat richer than t929's
 * (the select rider's first fire, whose world left the sibling
 * childless) and t949's (the exclude twin):
 *
 *   - THE MULTI-INPUT FACT on the select side: X already consumes the
 *     sibling B through the SAME port pair (B.particles→X.particles).
 *     The old stand-in filed X under alreadyWired and the aria
 *     undercounted the fire; the mint preview (mintTargetType=select2d)
 *     makes X MOVE — the aria counts it, and the FIRE re-parents X onto
 *     the selection while B→X STAYS (the both-wires law through the
 *     SELECT fire, first live; t949 proved it through the exclude fire).
 *   - THE FULL-BUCKET SPLIT FACE: one world, two verbs, opposite
 *     per-child choices, each speech honest to its own fire —
 *       the PLAIN verb (planning against B): moves C, leaves X as is —
 *         ENABLED, the t948 wired clause ("and 1 already on B (left as
 *         is)") live in the CLASS domain for the first time;
 *       the SELECT rider (the mint preview): moves X, refuses C —
 *         "re-wires 1 … onto it and refuses 1 (port)", the t931
 *         refusal clause and the t949 dup-skip count in one aria.
 *
 *   P  the world: the t952 mint (re-rides idempotently; a crashed
 *      ride's default-named selection is swept), the reload, 9 cards.
 *   E  the SPLIT FACE: the compare dialog on A ("Class A/B — Occupancy
 *      share"), the rider-presence gate (读脸先等脸的数据到场 — the
 *      rider mounts only after both /classes fetches resolve), the
 *      verdict chips (3 gained · 0 lost · 0 held · unpaired: 1 in A —
 *      Class 004), the plain verb's enabled speech + the contract line,
 *      the select rider's aria/title/label verbatim.
 *   F  THE FIRE through the select door: the selection mints ("2D Class
 *      Selection 1", selectedClasses baked), BOTH mouths fed from B,
 *      the MOVE (selection→X born, A→X gone), B→X UNTOUCHED (the
 *      both-wires law), A→C STAYS (the fire's own port refusal — the
 *      aria's clause landed at the data layer), the toast's full
 *      contract verbatim, the dialog closes itself.
 *   D  the birth record: params.selectedClasses === "1, 2, 3" (the t453
 *      law — the list the dialog spoke IS the list the engine keeps).
 *   R  the restore: the selection dies, the t952 remove, the seed trio
 *      + 2 edges, the doctor CLEAN, the smoke clean.
 *
 *   node scripts/t952-select-rider-live-witness.mjs main
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t952-select-rider-live-witness.json";
const MANIFEST = path.join(ROOT, "data", "t952-class-world.json");

const NAME_A = "2D Classification 1 (t952)";
const NAME_B = "2D Classification 2 (t952)";
const NAME_X = "Selection Consumer (t952)";
const NAME_C = "Classes Consumer (t952)";
const DIALOG_TITLE = "Class A/B — Occupancy share";
const SEL_PREFIX = "2D Class Selection";

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
/* THE T946 LAW (the t951 mint's armor, carried): the API plane hiccups
 * against the dev server's own windows — a refused read is noise, not a
 * dead world. Every api/jobs/edges read rides SIX windows before it
 * claims failure (ride 1 died at band F's doorstep on a bare curl 56). */
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
 * rider, and the verdict chips' words — one read, the split face */
const dialogFace = async () => poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${DIALOG_TITLE}') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const contractDivs = [...d.querySelectorAll('div')].filter(x => (x.textContent || '').trim().startsWith('Adoption re-wires'));
  const contract = (contractDivs.find(x => x.children.length === 0) ?? contractDivs.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0])?.textContent?.trim() ?? null;
  const sel = d.querySelector('[data-testid="adopt-with-select"]');
  const plain = d.querySelector('[data-testid="adopt-downstream"]');
  const unpaired = [...d.querySelectorAll('span')].find(s => (s.textContent || '').startsWith('unpaired:'));
  return JSON.stringify({ open: true, text: d.textContent || '', contract,
    plain: plain ? { disabled: plain.disabled, aria: plain.getAttribute('aria-label'), title: plain.getAttribute('title'), label: plain.textContent?.replace(/\\s+/g, ' ')?.trim() ?? null } : null,
    select: sel ? { disabled: sel.disabled, aria: sel.getAttribute('aria-label'), title: sel.getAttribute('title'), label: sel.textContent?.replace(/\\s+/g, ' ')?.trim() ?? null } : null,
    unpaired: unpaired ? { text: unpaired.textContent?.trim(), title: unpaired.getAttribute('title') } : null }); })()`,
  (v) => v.open === true && !!v.select, 30, 600,
);

/* ================================================================== */
console.log("== band P: the world — the t952 mint re-rides, the reload ==");
/* a crashed prior ride's minted selection (default-named) is swept */
for (const pf of jobs().filter((j) => j.type === "select2d" && new RegExp(`^${SEL_PREFIX} \\d+`).test(j.name ?? ""))) {
  for (const fe of edges().filter((e) => e.toJobId === pf.id || e.fromJobId === pf.id)) api("DELETE", `/api/edges/${fe.id}`);
  const d = api("DELETE", `/api/jobs/${pf.id}`);
  ok("P a stale minted selection deleted (the idempotency sweep)", !d.error || String(d.error).includes("not found"), pf.name);
}
let M = null;
if (existsSync(MANIFEST)) {
  const vOut = sh(`unset DATABASE_URL; node scripts/t952-class-world-mint.mjs verify 2>&1`);
  if (/verify GREEN/.test(vOut)) {
    M = JSON.parse(readFileSync(MANIFEST, "utf8"));
    ok("P the standing world verified GREEN (idempotent re-ride)", true, `a=${M.a.id.slice(-8)}`);
  } else {
    sh(`unset DATABASE_URL; node scripts/t952-class-world-mint.mjs remove 2>&1`);
    ok("P a RED world removed (the retry's law)", true);
  }
}
if (!M) {
  const mintOut = sh(`unset DATABASE_URL; node scripts/t952-class-world-mint.mjs mint 2>&1`);
  ok("P the t952 mint rides GREEN", /mint GREEN/.test(mintOut), (mintOut.match(/== mint .*==/) ?? ["?"])[0]);
  if (!/mint GREEN/.test(mintOut)) { console.log("FATAL: the mint refused — the witness cannot ride"); process.exit(2); }
  M = JSON.parse(readFileSync(MANIFEST, "utf8"));
}
const A = M.a, B = M.b, X = M.x, C = M.c;
sh(`${AB} set viewport 1280 900`);
await reloadPage(9);
const worldCards = evalJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
ok("P the world renders (9 cards)", worldCards?.cards === 9, String(worldCards?.cards));

/* ================================================================== */
console.log("== band E: the SPLIT FACE — two verbs, opposite choices, one world ==");
await openInspector(NAME_A);
const openE = await openCompareUntil(NAME_A, "Class A/B — compare", DIALOG_TITLE);
ok("E the compare dialog opened on the occupancy lens", String(openE).startsWith("open@"), openE);
/* THE T949 RIDE-1 LAW (读脸先等脸的数据到场): the select rider mounts
 * only after BOTH /classes fetches resolve — the dialogFace gate
 * already demands v.select, and the poll above IS the presence wait. */
const faceE = await dialogFace();
ok("E the SPLIT FACE read whole (both verbs aboard)", !!faceE?.plain && !!faceE?.select);
ok("E the dialog's title signs the occupancy lens", (faceE?.text ?? "").includes(DIALOG_TITLE));
/* the class domain's own words (the t453 vocabulary law) */
ok("E the verdict chips speak the class words (3 gained · 0 lost · 0 held)",
  (faceE?.text ?? "").includes("3 gained") && (faceE?.text ?? "").includes("0 lost") && (faceE?.text ?? "").includes("0 held"));
ok("E the unpaired chip names the honest count (1 in A · 0 in B)",
  faceE?.unpaired?.text === "unpaired: 1 in A · 0 in B", faceE?.unpaired?.text ?? "none");
ok("E the unpaired chip's tooltip names Class 004 (the K=4 orphan)",
  (faceE?.unpaired?.title ?? "").includes("Only in A: Class 004"), faceE?.unpaired?.title ?? "none");
/* THE PLAIN VERB: ENABLED — its fire (planning against B) moves C and
 * leaves X as is; the t948 wired clause speaks the class domain's first
 * already-wired sentence */
ok("E the PLAIN verb ENABLED (its fire moves C)", faceE?.plain?.disabled === false, String(faceE?.plain?.disabled));
const EXPECT_PLAIN_ARIA = `Continue downstream from ${NAME_B} — re-wires 1 of ${NAME_A}'s downstream jobs and 1 already on ${NAME_B} (left as is)`;
ok("E THE PLAIN ARIA speaks move + already-wired verbatim (the t948 third bucket, class-domain first)",
  faceE?.plain?.aria === EXPECT_PLAIN_ARIA, faceE?.plain?.aria ?? "none");
const EXPECT_PLAIN_TITLE = `Re-wires ${NAME_A}'s 1 downstream wire to ${NAME_B} — their current results stay until re-run — and 1 already on ${NAME_B} (left as is)`;
ok("E the PLAIN TITLE pre-announces the wired child verbatim (the em-dash join)",
  faceE?.plain?.title === EXPECT_PLAIN_TITLE, faceE?.plain?.title ?? "none");
ok("E the PLAIN's label carries the count (1)", (faceE?.plain?.label ?? "").startsWith("Continue downstream from run B") && (faceE?.plain?.label ?? "").includes("(1)"), faceE?.plain?.label ?? "none");
const EXPECT_CONTRACT = `Adoption re-wires ${NAME_A}'s 1 downstream job to consume ${NAME_B} — their current results stay until re-run. Also 1 job already on ${NAME_B} (left as is).`;
ok("E the CONTRACT line closes the accounting (the wiredSentence)",
  faceE?.contract === EXPECT_CONTRACT, faceE?.contract ?? "none");
/* THE SELECT RIDER: ENABLED — the mint preview (mintTargetType=select2d)
 * counts X (the dup check skipped) and refuses C (the classes mouth the
 * selection cannot feed) */
ok("E THE SELECT RIDER ENABLED (the mint preview's cure, live on the select side)",
  faceE?.select?.disabled === false, String(faceE?.select?.disabled));
const EXPECT_SEL_ARIA = `Continue downstream from ${NAME_B} with 3 gained classes selected — mints a 2D Class Selection consuming ${NAME_B} and re-wires 1 of ${NAME_A}'s downstream jobs onto it and refuses 1 (port)`;
ok("E THE RIDER ARIA counts the wired child AND the refusal verbatim (the t949 dup-skip + the t931 clause, one speech)",
  faceE?.select?.aria === EXPECT_SEL_ARIA, faceE?.select?.aria ?? "none");
const EXPECT_SEL_TITLE = `Bakes the 3 gained classes into a 2D Class Selection consuming ${NAME_B} (editable in its Classes tab), then re-wires ${NAME_A}'s 1 downstream wire onto the selection — results stay until re-run — and refuses 1 (port)`;
ok("E THE RIDER TITLE counts the wired child verbatim (1 downstream wire onto the selection) and the refusal clause (the em-dash join)",
  faceE?.select?.title === EXPECT_SEL_TITLE, faceE?.select?.title ?? "none");
ok("E the rider's label carries the gained count (3)",
  (faceE?.select?.label ?? "").startsWith("Continue downstream, selecting these") && (faceE?.select?.label ?? "").includes("(3)"), faceE?.select?.label ?? "none");

/* ================================================================== */
console.log("== band F: THE FIRE through the select door — the mint's own truth ==");
const jobsAtFire = jobs().length;
const firePoll = poll(
  `(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => ({ title: t.querySelector('[data-title]')?.textContent ?? null, all: t.textContent?.slice(0, 600) ?? '' })); const hit = toasts.find(t => (t.all || '').includes('Downstream adopted by')); return JSON.stringify(hit ? { title: hit.title, all: hit.all } : {}); })()`,
  (v) => v && v.all, 40, 500,
);
const fired = await (async () => {
  for (let i = 0; i < 10; i++) {
    const f = await dialogFace();
    if (f?.select?.disabled === false) {
      const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${DIALOG_TITLE}') && (d.textContent || '').includes('Run A'))?.querySelector('[data-testid="adopt-with-select"]')`);
      if (!String(clicked).startsWith("clicked@")) { await sleep(600); continue; }
      for (let w = 0; w < 30; w++) {
        const js = jobs();
        const sel = js.find((j) => j.type === "select2d" && new RegExp(`^${SEL_PREFIX} \\d+`).test(j.name ?? ""));
        const es = edges();
        if (sel && es.some((e) => e.fromJobId === B.id && e.toJobId === sel.id && e.fromPort === "classAverages") &&
            es.some((e) => e.fromJobId === B.id && e.toJobId === sel.id && e.fromPort === "particles") &&
            es.some((e) => e.fromJobId === sel.id && e.toJobId === X.id) &&
            !es.some((e) => e.fromJobId === A.id && e.toJobId === X.id)) return `fired@try${i}`;
        await sleep(500);
      }
      return `clicked-but-unmoved@try${i}`;
    }
    await sleep(700);
  }
  return "NEVER-FIRED";
})();
ok("F the fire landed (the selection minted, X re-wired onto it, A→X gone)", String(fired).startsWith("fired@"), String(fired));
const selJob = jobs().find((j) => j.type === "select2d" && new RegExp(`^${SEL_PREFIX} \\d+`).test(j.name ?? ""));
ok("F exactly ONE selection minted (jobs +1, the default name)", !!selJob && jobs().length === jobsAtFire + 1, `${jobs().length} (was ${jobsAtFire}) sel=${selJob?.name ?? "missing"}`);
const esAfter = edges();
ok("F the feeds: B→selection rides BOTH mouths (classes ← classAverages, particles ← particles)",
  !!selJob &&
  esAfter.some((e) => e.fromJobId === B.id && e.toJobId === selJob.id && e.fromPort === "classAverages" && e.toPort === "classes") &&
  esAfter.some((e) => e.fromJobId === B.id && e.toJobId === selJob.id && e.fromPort === "particles" && e.toPort === "particles"));
ok("F THE MOVE: selection→X born with the wire's own port pair",
  !!selJob && esAfter.some((e) => e.fromJobId === selJob.id && e.toJobId === X.id && e.fromPort === "particles" && e.toPort === "particles"));
ok("F the move: A→X GONE", !esAfter.some((e) => e.fromJobId === A.id && e.toJobId === X.id));
ok("F THE BOTH-WIRES LAW THROUGH THE SELECT FIRE — B→X UNTOUCHED (the wired child keeps its B-upstream; t949's exclude-side proof gets its select-side twin)",
  !!esAfter.find((e) => e.fromJobId === B.id && e.toJobId === X.id && e.fromPort === "particles" && e.toPort === "particles"),
  esAfter.find((e) => e.fromJobId === B.id && e.toJobId === X.id)?.id ?? "missing");
ok("F THE REFUSAL AT THE DATA LAYER — A→C STAYS (the fire's own plan refuses the classes mouth, exactly what the aria pre-announced)",
  !!esAfter.find((e) => e.fromJobId === A.id && e.toJobId === C.id && e.fromPort === "classAverages" && e.toPort === "classes"),
  esAfter.find((e) => e.fromJobId === A.id && e.toJobId === C.id)?.id ?? "missing");
const toastV = await firePoll;
const toastSeen = toastV && toastV.all ? { title: toastV.title, all: toastV.all } : null;
if (!toastSeen?.all) {
  const again = evalJson(`(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => t.textContent?.slice(0, 600) ?? ''); const hit = toasts.find(t => t.includes('Downstream adopted by')); return JSON.stringify(hit ?? null); })()`);
  toastSeen = typeof again === "string" && again !== "null" ? { title: null, all: again } : null;
}
ok("F THE TOAST's title speaks the SELECTION as the new father", !!toastSeen?.all && !!selJob && toastSeen.all.includes(`Downstream adopted by ${selJob.name}`), (toastSeen?.title ?? toastSeen?.all ?? "none").slice(0, 90));
const EXPECT_DETAIL = `1 downstream wire re-wired from ${NAME_A} to ${selJob?.name ?? "?"} · ${NAME_X} now consumes ${selJob?.name ?? "?"} · their current results stay until re-run · ${NAME_C} refused — ${selJob?.name ?? "?"} has no matching output port`;
ok("F THE TOAST's detail carries the full contract verbatim (the move, the consumer, the stay, the refusal's own sentence)",
  (toastSeen?.all ?? "").includes(EXPECT_DETAIL), (toastSeen?.all ?? "none").slice(0, 400));
const dialogClosed = await poll(
  `JSON.stringify({ gone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('${DIALOG_TITLE}')) })`,
  (v) => v.gone === true, 12, 600,
);
ok("F the dialog closes itself (the canvas shows the minted wiring)", dialogClosed?.gone === true);

/* ================================================================== */
console.log("== band D: the birth record — the classes baked at birth ==");
/* the single-job GET answers empty (the t949 ride-1 law) — read the
 * birth record from the jobs LIST */
const selFresh = selJob ? (jobs().find((j) => j.id === selJob.id) ?? null) : null;
const selParam = String(selFresh?.params?.selectedClasses ?? "");
ok("D the selection's params.selectedClasses carries the gained numbers (the t453 law — the dialog's list IS the engine's list)",
  selParam === "1, 2, 3", selParam || "empty");

/* ================================================================== */
console.log("== band R: the restore — the world back to the seed trio ==");
sh(`${AB} press Escape`);
await sleep(500);
if (selJob) {
  for (const fe of edges().filter((e) => e.toJobId === selJob.id || e.fromJobId === selJob.id)) api("DELETE", `/api/edges/${fe.id}`);
  const d = api("DELETE", `/api/jobs/${selJob.id}`);
  ok("R the minted selection deleted", !d.error || String(d.error).includes("not found"), selJob.id.slice(0, 8));
}
const removeOut = sh(`unset DATABASE_URL; node scripts/t952-class-world-mint.mjs remove 2>&1`);
ok("R the t952 remove GREEN", /remove GREEN/.test(removeOut), (removeOut.match(/== remove .*==/) ?? ["?"])[0]);
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
  world: { a: A?.id, b: B?.id, x: X?.id, c: C?.id, selection: selJob?.id ?? null },
  face: { plain: faceE?.plain ?? null, select: faceE?.select ?? null, contract: faceE?.contract ?? null, unpaired: faceE?.unpaired ?? null },
  fired: String(fired),
  toast: toastSeen ?? null,
  at: new Date().toISOString(),
});
console.log(`\nSELECT-RIDER-LIVE-WITNESS t952: ${pass}/${pass + fail} ${fail === 0 ? "green — the rider's count is the fire's own truth, the wired child counted, the both-wires law through the select fire" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
