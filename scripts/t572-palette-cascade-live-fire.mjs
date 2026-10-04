/**
 * t572 — the palette cascade: the table of contents arrives in scan order.
 *
 * t570 taught the DOORS to move, t571 brought the grammar to the CANVAS.
 * This window teaches the PALETTE the same dialect: on open, the command
 * groups cascade in top-to-bottom — the cascade IS the index (the groups
 * arrive in the order you'll scan them). Group-level only, never items,
 * and the entrance DISARMS ~520ms after open (.palette-motion-settled):
 * filtering sets display:none on groups, and CSS animations restart when
 * an element returns from display:none — without the disarm, every
 * keystroke would replay the cascade (noise, not wayfinding). The disarm
 * resets on close, so each fresh open gets its cascade again: first
 * paint plays, filtering stays silent (the chip doctrine, t570).
 * The INPUT never moves — it is the anchor the list arrives to.
 *
 * Faces proven here (NO mints, NO Chrome spawn — keyboard faces only):
 *   P1  the cascade, armed — groups' computed animation is
 *       palette-group-enter @240ms easeOutQuint, fill both, delays in a
 *       35ms staircase (0 / 35 / 70 / 105 / 140 / 175 / 210ms cap),
 *       read INSIDE the 520ms arm window (a single batched eval).
 *   P2  the disarm — after the settle flip the dialog carries
 *       palette-motion-settled and the groups' animation-name is none.
 *   P3  filter silence — groups tagged with a JS property survive a
 *       filter round-trip (same DOM nodes, hidden not unmounted) and
 *       their animation stays disarmed (no replay on re-display).
 *   P4  the empty state — a garbage query mounts [cmdk-empty] fresh and
 *       its entrance plays even after settle (the replay IS the message:
 *       "the answer changed").
 *   P5  reduced-motion honesty — the cascade rules live inside
 *       @media (prefers-reduced-motion: no-preference) in the CSSOM
 *       (t570's cssText scan; CSS Nesting means every level must be
 *       checked).
 *   P6  re-arm on reopen — Escape, reopen: settled gone, cascade armed
 *       again (every open is a first open).
 *   R   console clean, roster untouched (nothing minted).
 *
 * The stock daemon Chrome reports (hover: none) — irrelevant here: no
 * :hover face is asserted, the palette opens by keyboard. Runs in the
 * EMPIAR world in place, mints nothing.
 *
 * Usage: node scripts/t572-palette-cascade-live-fire.mjs
 */

import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";

let pass = 0, fail = 0;
const check = (name, ok, evidence) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${evidence != null ? ` — ${evidence}` : ""}`);
  if (ok) pass++; else fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const evalJs = (expr) => {
  const flat = expr.replace(/\s*\n\s*/g, " ");
  const raw = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`);
  try { const p = JSON.parse(raw); return typeof p === "string" ? p.trim() : raw.trim(); }
  catch { return raw.replace(/^"|"$/g, "").trim(); }
};
const api = (method, path, body) => {
  const args = ["-s", "-X", method, `${BASE}${path}`, "-H", "Origin: http://localhost:3000"];
  if (body) args.push("-H", "Content-Type: application/json", "-d", JSON.stringify(body));
  return sh(`curl ${args.map((a) => JSON.stringify(a)).join(" ")}`);
};

const roster0 = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID)?.stats?.total ?? -1;

try {
  /* ---- world guard: run in place, touch nothing ---------------------- */
  const active = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.active);
  check("world guard ok — EMPIAR active, roster " + roster0, active?.id === EMPIAR_ID && roster0 === 12, active?.name?.slice(0, 24));

  /* ---- open the app fresh -------------------------------------------- */
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(3600);

  /* ============ P1: the cascade, armed ================================= */
  console.log(`\n[P1] the cascade, armed (read inside the 520ms window)`);
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(120);
  const armed = evalJs(`JSON.stringify((function(){
    const dlg=document.querySelector('.palette-motion');
    if(!dlg) return {dialog:false};
    const gs=[].slice.call(dlg.querySelectorAll('[cmdk-group]'));
    return {dialog:true, settled: dlg.classList.contains('palette-motion-settled'),
      groups: gs.map(function(g){
        const cs=getComputedStyle(g);
        return {name:cs.animationName, dur:cs.animationDuration, ease:cs.animationTimingFunction,
                fill:cs.animationFillMode, delay:cs.animationDelay, vis: g.offsetParent !== null};
      })};
  })())`);
  let a = null; try { a = JSON.parse(armed || "null"); } catch { /* stays null */ }
  check("dialog carries .palette-motion", a?.dialog === true, a?.dialog);
  const vis = (a?.groups ?? []).filter((g) => g.vis);
  check("groups present on open", vis.length >= 6, `${vis.length} visible group(s)`);
  const g0 = vis[0] ?? {};
  check("cascade armed on first paint (animation live)", a?.settled === false && g0.name === "palette-group-enter", `${g0.name} @ ${g0.dur}`);
  check("timing is the family's easeOutQuint", (g0.ease ?? "").includes("cubic-bezier(0.22, 1, 0.36, 1)"), g0.ease);
  check("fill both — the cascade holds its final frame", g0.fill === "both", g0.fill);
  const delays = vis.map((g) => g.delay);
  check("staircase 35ms top-to-bottom", delays[0] === "0s" && delays[1] === "0.035s" && delays[2] === "0.07s" && delays[3] === "0.105s" && delays[4] === "0.14s" && delays[5] === "0.175s", delays.slice(0, 6).join(" "));
  check("rung cap — 7th+ groups share 210ms", delays.length >= 7 && delays.slice(6).every((d) => d === "0.21s"), delays[6]);

  /* ============ P2: the disarm ========================================= */
  console.log(`\n[P2] the disarm (after the settle flip)`);
  await sleep(700);
  const settled = evalJs(`JSON.stringify((function(){
    const dlg=document.querySelector('.palette-motion');
    if(!dlg) return {dialog:false};
    const gs=[].slice.call(dlg.querySelectorAll('[cmdk-group]'));
    return {dialog:true, settled: dlg.classList.contains('palette-motion-settled'),
      names: gs.map(function(g){return getComputedStyle(g).animationName})};
  })())`);
  let s = null; try { s = JSON.parse(settled || "null"); } catch { /* stays null */ }
  check("settled class landed at ~520ms", s?.settled === true, s?.settled);
  check("groups disarmed (animation-name none)", (s?.names ?? []).length > 0 && s.names.every((n) => n === "none"), `${(s?.names ?? []).filter((n) => n === "none").length}/${(s?.names ?? []).length} none`);

  /* ============ P3: filter silence ===================================== */
  console.log(`\n[P3] filter silence (hide + re-display must not replay)`);
  const tagged = evalJs(`JSON.stringify((function(){
    const gs=[].slice.call(document.querySelectorAll('.palette-motion [cmdk-group]'));
    gs.forEach(function(g,i){ g.__t572 = 'g'+i; });
    return gs.length;
  })())`);
  check("groups tagged for identity", Number(tagged) >= 6, `${tagged} tag(s)`);
  sh(`agent-browser keyboard type "refine" >/dev/null 2>&1`);
  await sleep(900);
  const filtered = evalJs(`JSON.stringify({vis: [].slice.call(document.querySelectorAll('.palette-motion [cmdk-group]')).filter(function(g){return g.offsetParent!==null}).length})`);
  sh(`agent-browser press Control+a >/dev/null 2>&1`);
  sh(`agent-browser press Backspace >/dev/null 2>&1`);
  await sleep(700);
  const after = evalJs(`JSON.stringify((function(){
    const gs=[].slice.call(document.querySelectorAll('.palette-motion [cmdk-group]'));
    const kept=gs.filter(function(g){return g.__t572});
    const replayed=gs.filter(function(g){return getComputedStyle(g).animationName!=='none'});
    return {total: gs.length, kept: kept.length, replayed: replayed.length};
  })())`);
  let p3 = null; try { p3 = JSON.parse(after || "null"); } catch { /* stays null */ }
  check("filter actually narrowed the world", (() => { try { return JSON.parse(filtered).vis < Number(tagged); } catch { return false; } })(), filtered);
  check("same nodes survived the round-trip (hidden, not unmounted)", p3?.kept === p3?.total && p3?.total >= 6, `${p3?.kept}/${p3?.total} kept`);
  check("no replay on re-display", p3?.replayed === 0, `${p3?.replayed} replaying`);

  /* ============ P4: the empty state ==================================== */
  console.log(`\n[P4] the empty state (mounts fresh, always plays)`);
  sh(`agent-browser keyboard type "zzqq no such command" >/dev/null 2>&1`);
  await sleep(700);
  const empty = evalJs(`JSON.stringify((function(){
    const e=document.querySelector('.palette-motion [cmdk-empty]');
    if(!e) return {found:false};
    const cs=getComputedStyle(e);
    return {found:true, name:cs.animationName, dur:cs.animationDuration};
  })())`);
  let e4 = null; try { e4 = JSON.parse(empty || "null"); } catch { /* stays null */ }
  check("empty state mounts on a dead query", e4?.found === true, e4?.found);
  check("empty entrance plays even after settle", e4?.name === "palette-empty-enter" && e4?.dur === "0.2s", `${e4?.name} @ ${e4?.dur}`);
  sh(`agent-browser press Control+a >/dev/null 2>&1`);
  sh(`agent-browser press Backspace >/dev/null 2>&1`);
  await sleep(400);

  /* ============ P5: reduced-motion honesty (CSSOM) ===================== */
  console.log(`\n[P5] reduced-motion honesty (CSSOM scan)`);
  const cssom = evalJs(`JSON.stringify((function(){
    let hit=0, outside=0;
    const walk=function(rule){
      if(!rule) return;
      const t=rule.cssText||"";
      const childless = !rule.cssRules || rule.cssRules.length===0;
      if(t.indexOf("palette-group-enter")!==-1 && childless){
        let anc=rule, inSafe=false;
        while(anc){ if(anc.media && String(anc.media.mediaText||"").indexOf("prefers-reduced-motion: no-preference")!==-1){ inSafe=true; break; } anc=anc.parentRule; }
        if(inSafe) hit++; else outside++;
      }
      if(rule.cssRules){ for(const r of rule.cssRules) walk(r); }
    };
    for(const sheet of document.styleSheets){ try { for(const r of sheet.cssRules) walk(r); } catch(e){} }
    return {inside: hit, outside: outside};
  })())`);
  let p5 = null; try { p5 = JSON.parse(cssom || "null"); } catch { /* stays null */ }
  check("cascade rules ride prefers-reduced-motion: no-preference", p5?.inside >= 1 && p5?.outside === 0, `inside ${p5?.inside} / outside ${p5?.outside}`);

  /* ============ P6: re-arm on reopen =================================== */
  console.log(`\n[P6] every open is a first open`);
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(600);
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(150);
  const rearmed = evalJs(`JSON.stringify((function(){
    const dlg=document.querySelector('.palette-motion');
    if(!dlg) return {dialog:false};
    const g=dlg.querySelector('[cmdk-group]');
    return {dialog:true, settled: dlg.classList.contains('palette-motion-settled'),
            name: g ? getComputedStyle(g).animationName : null};
  })())`);
  let p6 = null; try { p6 = JSON.parse(rearmed || "null"); } catch { /* stays null */ }
  check("fresh open re-arms the cascade", p6?.dialog === true && p6?.settled === false && p6?.name === "palette-group-enter", `${p6?.name}, settled=${p6?.settled}`);
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(300);

  /* ============ R: the world owes nothing ============================== */
  const afterRoster = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
  check("roster untouched (nothing minted)", afterRoster?.stats?.total === roster0, `${roster0} → ${afterRoster?.stats?.total}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try {
    const errs = sh(`agent-browser errors 2>/dev/null`).trim();
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  } catch { /* eval unavailable */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}
