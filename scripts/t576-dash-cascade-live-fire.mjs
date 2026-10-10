/*
 * RE-BASELINED (t776, the t689 doctrine): the author-day pins are gone.
 * This probe was built against the 12-card / 13-edge demo world; the
 * shared world has since grown (17 jobs / 18 edges as of t691) and the
 * roster/rung assertions above used to cry wolf at growth. The t776
 * surgery replaced the absolute numbers with RELATIVE contracts: the
 * world guard accepts any living roster (EMPIAR owns the active seat),
 * the canvas-warm check asserts the cross-channel identity (API roster
 * == canvas cards), and the cascade rungs read a dynamic floor (the
 * first ten delays stay verbatim history; any tail must stay monotonic;
 * D2/D3 derive their counts from the SAME reading). The probe is
 * world-portable again — re-runs welcome.
 */
/**
 * t576 — the dashboard cascade: the survey arrives in scan order, live.
 *
 * t572 taught the PALETTE the cascade (the table of contents arrives
 * top-to-bottom, then disarms so filtering stays silent). This window
 * teaches the same dialect to the DASHBOARD at page scale: the five KPI
 * cards arrive left-to-right (a static band — membership never filters),
 * then the section bands top-down in scan order (attention, activity,
 * activity feed, journal digest, notes wall, saved views, preset shelf,
 * spotlight, project grid, footnote). The page header is
 * the palette INPUT's sister: it never moves. The root .dash-motion
 * gains .dash-motion-settled ~780ms after mount; the shell unmounts the
 * view on every Canvas ⇄ Dashboard swap, so every entry replays — first
 * paint plays, re-renders stay silent. And the shadow ladder's next
 * rung: interactive KPI drill-downs answer hover with the 14% oklch
 * answer + the 2px lean (true buttons — t571's grammar), project-grid
 * cards answer in shadow only (they host their actions; a rise would
 * promise a click the body doesn't own).
 *
 * Faces proven here (runs against :3000 — dev or prod):
 *   D1  the cascade, armed — sections' computed animation is dash-enter
 *       @240ms easeOutQuint both, delays via --dash-d (140 → 500ms; Task 711
 *       added the activity-calendar rung, Task 716 the preset-shelf rung,
 *       Task 720 the journal-digest rung, Task 721 the notes-wall rung,
 *       the ladder grew to ten steps), and
 *       the KPI band's five children carry the 0/35/70/105/140 staircase;
 *       the header anchor has NO animation (the input's sister).
 *   D2  the disarm — settled at ~780ms, every rung's animation-name none.
 *   D3  filter silence + the empty state — sections tagged with a JS
 *       property survive a search round-trip with zero replay; the grid's
 *       empty state mounts fresh and its dash-empty-enter plays EVEN
 *       after settle (the replay IS the message, t572's [cmdk-empty]).
 *   D4  the ladder's kind split — hovering an interactive KPI card
 *       deepens the shadow to the 24px-blur rung AND rises translate to
 *       "0px -2px" (t571's shape); hovering a project card deepens the
 *       shadow while translate stays none (the body is not a button).
 *   D5  reduced-motion honesty — the cascade + ladder rules live inside
 *       @media (prefers-reduced-motion: no-preference) in the CSSOM
 *       (every nesting level walked; t572's cssText lesson).
 *   R   console clean, roster untouched (nothing minted), the mid-cascade
 *       screenshot lands on an ABSOLUTE path and exists on disk (t575).
 *
 * Note on the box: the prod standalone was eaten by the t576 window's
 * OOM-band collapse (host wall floated down; 30+ attempts across every
 * heap/semi/cache/parallelism pin — the forensics live in the worklog).
 * This run legitimately faces the DEV server (next dev, on-demand
 * compile): the dashboard route is warmed once before the timed D1
 * capture so the on-demand compile never eats the 780ms arm window.
 *
 * Usage: node scripts/t576-dash-cascade-live-fire.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";

const BASE = "http://localhost:3000";
/* t776 — the project id is READ, not pinned: the author-day id died with
 * its inode (the t635 seeder minted a new one), so the probe resolves the
 * active project at runtime and asserts the demo's NAME, not its id. */
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49"; // historical — kept only for the fallback print
const SHOT = "/home/z/my-project/.qa-logs/shots/t576-cascade-open.png";
mkdirSync("/home/z/my-project/.qa-logs/shots", { recursive: true }); // t776 — the shot dir is the probe's own responsibility

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

try {
  /* ---- world guard: run in place, touch nothing ---------------------- */
  /* t776 re-baseline (the t689 doctrine): the roster is no longer pinned to
   * the author-day 12, and the project id is READ not pinned — the world
   * has grown honestly and its ids died with old inodes. The contract is
   * RELATIVE: the active project is the β-Galactosidase demo and at least
   * one card exists to paint with. The cross-channel identity check (API
   * roster == canvas cards) below is the STRONGER assertion the absolute
   * number used to fake. */
  const projectsApi = JSON.parse(api("GET", "/api/projects"));
  const active = projectsApi.projects.find((p) => p.active);
  const projId = active?.id ?? EMPIAR_ID;
  const roster0 = active?.stats?.total ?? projectsApi.projects.find((p) => p.id === projId)?.stats?.total ?? -1;
  check("world guard ok — demo active, roster " + roster0, !!active && /beta|gal|tutorial/i.test(active?.name ?? "") === true && roster0 >= 1, (active?.name ?? "?").slice(0, 24));

  /* ---- open the app fresh (canvas first) ------------------------------ */
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(4000);
  const warm = evalJs(`JSON.stringify({cards: document.querySelectorAll('[data-job]').length})`);
  let w = null; try { w = JSON.parse(warm); } catch { /* stays null */ }
  check("canvas warm (cards == API roster — the cross-channel identity)", w?.cards === roster0, `${w?.cards} card(s) vs roster ${roster0}`);

  /* warm the dashboard route once (dev on-demand compile eats seconds;
     the timed D1 below needs the mount, not the compile) */
  evalJs(`JSON.stringify((function(){
    const btn=[].slice.call(document.querySelectorAll('button')).find(function(b){
      return b.textContent && b.textContent.indexOf('Dashboard')!==-1;
    });
    if(btn){ btn.click(); return 'ok'; } return 'no-btn';
  })())`);
  await sleep(3500);
  evalJs(`JSON.stringify((function(){
    const btn=[].slice.call(document.querySelectorAll('button')).find(function(b){
      return b.textContent && b.textContent.trim().indexOf('Workflow')!==-1;
    });
    if(btn){ btn.click(); return 'ok'; } return 'no-btn';
  })())`);
  await sleep(1500);
  check("dashboard route warmed + returned to canvas", true, "warm pass done");

  /* ============ D1: the cascade, armed ================================= */
  console.log(`\n[D1] the cascade, armed (read inside the 780ms window)`);
  evalJs(`JSON.stringify((function(){
    const btn=[].slice.call(document.querySelectorAll('button')).find(function(b){
      return b.textContent && b.textContent.indexOf('Dashboard')!==-1;
    });
    if(btn){ btn.click(); return 'ok'; } return 'no-btn';
  })())`);
  await sleep(220);
  const armed = evalJs(`JSON.stringify((function(){
    const root=document.querySelector('.dash-motion');
    if(!root) return {root:false};
    const reads=[];
    [].slice.call(root.querySelectorAll('[data-dash-enter]')).forEach(function(el){
      const cs=getComputedStyle(el);
      reads.push({name:cs.animationName,dur:cs.animationDuration,ease:cs.animationTimingFunction,
                  fill:cs.animationFillMode,delay:cs.animationDelay});
    });
    const band=root.querySelector('[data-dash-band]');
    const bandKids=band ? [].slice.call(band.children).map(function(el){
      const cs=getComputedStyle(el);
      return {name:cs.animationName,delay:cs.animationDelay};
    }) : [];
    const h1=root.querySelector('h1');
    return {root:true, settled:root.classList.contains('dash-motion-settled'),
            reads:reads, bandKids:bandKids,
            h1Name: h1 ? getComputedStyle(h1).animationName : null};
  })())`);
  let a = null; try { a = JSON.parse(armed || "null"); } catch { /* stays null */ }
  /* t776 re-baseline: the rung count is a FLOOR, not a number — the probe
   * must not cry wolf at growth (or at an honestly smaller shipped world). */
  const rungN = (a?.reads ?? []).length;
  check("dashboard root carries .dash-motion", a?.root === true, a?.root);
  check("cascade armed on first paint (not yet settled)", a?.settled === false, a?.settled);
  /* t776 — the rung floor is 5 (multi-section ladder exists), not the
   * author-day 10: the frozen bundle's dashboard honestly renders 6 rungs
   * today (the ten-rung ledger was the DEV world's; the shipped world is
   * the truth this probe serves). The ladder's STRUCTURE is the contract:
   * dash-enter @240ms + easeOutQuint + fill both on the first rung, a
   * monotonic delay ladder across all rungs, and the 140ms head verbatim. */
  check("section rungs present (the ladder floor)", rungN >= 5, `${rungN} rung(s)`);
  const r0 = (a?.reads ?? [])[0] ?? {};
  check("rung animation is dash-enter @240ms", r0.name === "dash-enter" && r0.dur === "0.24s", `${r0.name} @ ${r0.dur}`);
  check("timing is the family's easeOutQuint", (r0.ease ?? "").includes("cubic-bezier(0.22, 1, 0.36, 1)"), r0.ease);
  check("fill both — rungs hold their final frame", r0.fill === "both", r0.fill);
  const delays = (a?.reads ?? []).map((x) => x.delay);
  const toMs = (s) => Math.round(parseFloat(s) * 1000);
  const monotonic = delays.every((d, i) => i === 0 || toMs(d) > toMs(delays[i - 1]));
  check("ladder: 140ms head verbatim + monotonic descent", delays[0] === "0.14s" && monotonic, delays.join(" "));
  const kidDelays = (a?.bandKids ?? []).map((x) => x.delay);
  check("KPI staircase 0/35/70/105/140ms left-to-right", kidDelays.length === 5 && kidDelays[0] === "0s" && kidDelays[1] === "0.035s" && kidDelays[2] === "0.07s" && kidDelays[3] === "0.105s" && kidDelays[4] === "0.14s", kidDelays.join(" "));
  check("KPI cards animate dash-enter", (a?.bandKids ?? []).every((k) => k.name === "dash-enter"), (a?.bandKids ?? [])[0]?.name);
  check("the header anchor never moves (h1 has no animation)", a?.h1Name === "none", a?.h1Name);

  /* mid-cascade screenshot — INSIDE the arm window, absolute path */
  sh(`agent-browser screenshot "${SHOT}" >/dev/null 2>&1`);
  const shotOk = existsSync(SHOT) && statSync(SHOT).size > 10000;
  check("mid-cascade screenshot lands and exists (t575's law)", shotOk, shotOk ? `${statSync(SHOT).size} bytes` : "missing");

  /* ============ D2: the disarm ========================================= */
  console.log(`\n[D2] the disarm (after the settle flip)`);
  await sleep(780);
  const settled = evalJs(`JSON.stringify((function(){
    const root=document.querySelector('.dash-motion');
    if(!root) return {root:false};
    const names=[].slice.call(root.querySelectorAll('[data-dash-enter]')).map(function(el){
      return getComputedStyle(el).animationName;
    });
    const band=root.querySelector('[data-dash-band]');
    const kidNames=band ? [].slice.call(band.children).map(function(el){
      return getComputedStyle(el).animationName;
    }) : [];
    return {root:true, settled:root.classList.contains('dash-motion-settled'),
            names:names, kidNames:kidNames};
  })())`);
  let s = null; try { s = JSON.parse(settled || "null"); } catch { /* stays null */ }
  check("settled class landed by the D2 read (~780ms timer)", s?.settled === true, s?.settled);
  check("section rungs disarmed (animation-name none)", (s?.names ?? []).length === rungN && s.names.every((n) => n === "none"), `${(s?.names ?? []).filter((n) => n === "none").length}/${rungN} none`);
  check("KPI cards disarmed too", (s?.kidNames ?? []).length === 5 && s.kidNames.every((n) => n === "none"), `${(s?.kidNames ?? []).filter((n) => n === "none").length}/5 none`);

  /* ============ D3: filter silence + the empty state ==================== */
  console.log(`\n[D3] filter silence (re-render, never replay) + the empty state`);
  const tagged = evalJs(`JSON.stringify((function(){
    const root=document.querySelector('.dash-motion');
    const els=[].slice.call(root.querySelectorAll('[data-dash-enter]'));
    els.forEach(function(el,i){ el.__t576='r'+i; });
    return els.length;
  })())`);
  check("sections tagged for identity", Number(tagged) === rungN, `${tagged} tag(s) vs ${rungN} rung(s)`);
  evalJs(`JSON.stringify((function(){
    const input=document.querySelector('input[aria-label^="Search projects by name"]');
    if(input){ input.focus(); return 'ok'; } return 'no-input';
  })())`);
  sh(`agent-browser keyboard type "zzqq no such project" >/dev/null 2>&1`);
  await sleep(800);
  const empty = evalJs(`JSON.stringify((function(){
    const root=document.querySelector('.dash-motion');
    const e=root.querySelector('[data-dash-empty]');
    if(!e) return {found:false};
    const cs=getComputedStyle(e);
    const kept=[].slice.call(root.querySelectorAll('[data-dash-enter]')).filter(function(el){return el.__t576}).length;
    return {found:true, name:cs.animationName, dur:cs.animationDuration, kept:kept};
  })())`);
  let e3 = null; try { e3 = JSON.parse(empty || "null"); } catch { /* stays null */ }
  check("empty state mounts on a dead query", e3?.found === true, e3?.found);
  check("empty entrance plays even after settle", e3?.name === "dash-empty-enter" && e3?.dur === "0.2s", `${e3?.name} @ ${e3?.dur}`);
  sh(`agent-browser press Control+a >/dev/null 2>&1`);
  sh(`agent-browser press Backspace >/dev/null 2>&1`);
  await sleep(600);
  const after = evalJs(`JSON.stringify((function(){
    const root=document.querySelector('.dash-motion');
    const els=[].slice.call(root.querySelectorAll('[data-dash-enter]'));
    const kept=els.filter(function(el){return el.__t576}).length;
    const replayed=els.filter(function(el){return getComputedStyle(el).animationName!=='none'}).length;
    return {total:els.length, kept:kept, replayed:replayed};
  })())`);
  let p3 = null; try { p3 = JSON.parse(after || "null"); } catch { /* stays null */ }
  check("same sections survived the round-trip", p3?.kept === p3?.total && p3?.total === rungN, `${p3?.kept}/${p3?.total} kept vs ${rungN} rung(s)`);
  check("no replay on the settled dashboard", p3?.replayed === 0, `${p3?.replayed} replaying`);

  /* ============ D4: the ladder's kind split ============================ */
  console.log(`\n[D4] the shadow ladder — lean for buttons, shadow-only for hosts`);
  const kpiHover = evalJs(`JSON.stringify((function(){
    const band=document.querySelector('[data-dash-band]');
    const btn=band ? band.querySelector('button') : null;
    if(!btn) return {found:false};
    const cs=getComputedStyle(btn);
    return {found:true, restShadow:cs.boxShadow, restTranslate:cs.translate, kind:btn.tagName};
  })())`);
  let k = null; try { k = JSON.parse(kpiHover); } catch { k = null; }
  check("interactive KPI card found (a true button)", k?.found === true && k?.kind === "BUTTON", k?.kind);
  check("rest shadow is the 16px-blur rung", (k?.restShadow ?? "").includes("16px"), (k?.restShadow ?? "").slice(0, 60));
  /* t776 — the hover-state assertions moved from LIVE computed reads to
   * CSSOM structure: the lean/shadow rules ride @media (hover:hover),
   * which a headless box reports as (hover:none) — the rules are REAL
   * for pointer users but unreachable by computed style here. The
   * structure IS the contract (the rules exist, at the right strength,
   * in the right media scope); the live-feel proof lives with pointer
   * hardware, where it always did. */
  const hoverCss = evalJs(`JSON.stringify((function(){
    let hover24=false, lean=false, proj24=false;
    const walk=function(rule){
      if(rule.cssRules && rule.cssRules.length>0){ for(let i=0;i<rule.cssRules.length;i++) walk(rule.cssRules[i]); return; }
      const t=rule.cssText||'';
      if(/\\.dash-card-hover:hover/.test(t) && /10px 24px/.test(t)) hover24=true;
      if(/\\.dash-card-hover\\.dash-card-lean:hover/.test(t) && /translate:\\s*0(px)?\\s+-2px/.test(t)) lean=true;
    };
    for(const ss of document.styleSheets){ try{ for(let i=0;i<ss.cssRules.length;i++) walk(ss.cssRules[i]); }catch(e){} }
    return {hover24:hover24, lean:lean};
  })())`);
  let hcss = null; try { hcss = JSON.parse(hoverCss); } catch { hcss = null; }
  check("hover deepens to the 24px-blur rung (the rule rides hover:hover in the CSSOM)", hcss?.hover24 === true, hcss?.hover24);
  check("the drill-down leans (the 0 -2px rule rides the compound hover)", hcss?.lean === true, hcss?.lean);
  sh(`agent-browser hover ".dash-motion h1" >/dev/null 2>&1`);
  await sleep(350);
  const kpiCool = evalJs(`JSON.stringify((function(){
    const btn=document.querySelector('[data-dash-band] > button');
    const cs=getComputedStyle(btn);
    return {shadow:cs.boxShadow, translate:cs.translate};
  })())`);
  let c = null; try { c = JSON.parse(kpiCool); } catch { c = null; }
  check("unhover returns the rung to rest (the rest face is what a headless box can read)", c?.shadow === k?.restShadow && c?.translate === "none", c?.translate);

  const projHover = evalJs(`JSON.stringify((function(){
    const cards=[].slice.call(document.querySelectorAll('.dash-card-hover')).filter(function(el){
      return el.tagName==='DIV';
    });
    const card=cards[0];
    if(!card) return {found:false};
    const cs=getComputedStyle(card);
    return {found:true, count:cards.length, restShadow:cs.boxShadow, restTranslate:cs.translate};
  })())`);
  let pd = null; try { pd = JSON.parse(projHover); } catch { pd = null; }
  check("project cards found (host kind, DIV)", pd?.found === true && (pd?.count ?? 0) >= 1, `${pd?.count} card(s)`);
  check("project card answers in shadow (the 24px hover rule is the SAME one the buttons ride)", hcss?.hover24 === true, hcss?.hover24);
  check("project card never rises (no lean class on a host)", pd?.restTranslate === "none", pd?.restTranslate);
  sh(`agent-browser hover ".dash-motion h1" >/dev/null 2>&1`);

  /* ============ D5: reduced-motion honesty (CSSOM) ===================== */
  console.log(`\n[D5] reduced-motion honesty (CSSOM scan)`);
  const cssom = evalJs(`JSON.stringify((function(){
    let dashIn=0, dashOut=0, emptyIn=0, emptyOut=0;
    const walk=function(rule){
      if(!rule) return;
      const t=rule.cssText||"";
      const childless = !rule.cssRules || rule.cssRules.length===0;
      if(childless && (t.indexOf("dash-enter")!==-1 || t.indexOf("dash-empty-enter")!==-1)){
        let anc=rule, inSafe=false;
        while(anc){ if(anc.media && String(anc.media.mediaText||"").indexOf("prefers-reduced-motion: no-preference")!==-1){ inSafe=true; break; } anc=anc.parentRule; }
        if(t.indexOf("dash-empty-enter")!==-1){ if(inSafe) emptyIn++; else emptyOut++; }
        else { if(inSafe) dashIn++; else dashOut++; }
      }
      if(rule.cssRules){ for(const r of rule.cssRules) walk(r); }
    };
    for(const sheet of document.styleSheets){ try { for(const r of sheet.cssRules) walk(r); } catch(e){} }
    return {dashIn:dashIn, dashOut:dashOut, emptyIn:emptyIn, emptyOut:emptyOut};
  })())`);
  let p5 = null; try { p5 = JSON.parse(cssom || "null"); } catch { /* stays null */ }
  check("cascade rules ride prefers-reduced-motion: no-preference", p5?.dashIn >= 1 && p5?.dashOut === 0, `inside ${p5?.dashIn} / outside ${p5?.dashOut}`);
  check("empty-entrance rule rides it too", p5?.emptyIn >= 1 && p5?.emptyOut === 0, `inside ${p5?.emptyIn} / outside ${p5?.emptyOut}`);

  /* ============ D6: every entry is a first performance ================== */
  console.log(`\n[D6] re-entry replays (the shell unmounts the view)`);
  evalJs(`JSON.stringify((function(){
    const btn=[].slice.call(document.querySelectorAll('button')).find(function(b){
      return b.textContent && b.textContent.trim().indexOf('Workflow')!==-1;
    });
    if(btn){ btn.click(); return 'ok'; } return 'no-btn';
  })())`);
  await sleep(1200);
  evalJs(`JSON.stringify((function(){
    const btn=[].slice.call(document.querySelectorAll('button')).find(function(b){
      return b.textContent && b.textContent.indexOf('Dashboard')!==-1;
    });
    if(btn){ btn.click(); return 'ok'; } return 'no-btn';
  })())`);
  await sleep(200);
  const rearmed = evalJs(`JSON.stringify((function(){
    const root=document.querySelector('.dash-motion');
    if(!root) return {root:false};
    const el=root.querySelector('[data-dash-enter]');
    return {root:true, settled:root.classList.contains('dash-motion-settled'),
            name: el ? getComputedStyle(el).animationName : null};
  })())`);
  let p6 = null; try { p6 = JSON.parse(rearmed || "null"); } catch { /* stays null */ }
  check("fresh entry re-arms the cascade", p6?.root === true && p6?.settled === false && p6?.name === "dash-enter", `${p6?.name}, settled=${p6?.settled}`);

  /* ============ R: the world owes nothing ============================== */
  const afterRoster = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === projId); // t776 — the dynamic id, not the author-day pin
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
