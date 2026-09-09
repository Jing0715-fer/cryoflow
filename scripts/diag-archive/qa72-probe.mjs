// qa72-probe — Task 72 feasibility probe, v2: single-sheet fit-to-paper.
// v1 learned: abs-pos cards CLIP at page boundaries instead of flowing
// (pages 2/3 rendered 0.00% ink), so the product design collapses to
// ONE guaranteed landscape sheet: zoom = min(1, budgetW/w, budgetH/h).
// v2 verifies the fit math end-to-end on the live page:
//   F1 paper goes landscape (raster width > height)
//   F2 exactly ONE page
//   F3 every job card name reaches the paper (with print un-truncate)
//   F4 fixed footer paints on the page
//   F5 leftmost/topmost card ink lands near the content-box origin (the
//      negative-margin shift + zoom interaction Chromium question)
// Run: node scripts/qa72-probe.mjs   (server on :3000, Sandbox C canvas)
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, mkdirSync } from "node:fs";
const AB = "agent-browser";
const B = "http://localhost:3000";
const OUT = "/home/z/my-project/.qa-logs/t72-probe-fit.pdf";
const PPM = "/home/z/my-project/.qa-logs/t72-ppm";
const sh = (c) => execSync(c, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (e) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: e }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");

sh(`${AB} close`); await sleep(1000);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${B}`);
await sleep(5000);
let probe = "";
for (let i = 0; i < 10 && !probe.includes("CARD"); i++) {
  probe = evalJs(`(function(){ var c=[...document.querySelectorAll('[role=button]')].find(function(x){return (x.textContent||'').includes('QA Refine 410')}); var d=!!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard'); return (c?'CARD':'NOCARD')+(d?'+DASH':''); })()`);
  if (!probe.includes("CARD")) {
    if (probe.includes("DASH")) evalJs(`(function(){ window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true })); return 'shift-d'; })()`);
    await sleep(2000);
  }
}
console.log("boot:", unq(probe));

// ---- bounds + fit zoom (budget: Letter-landscape content box minus
//      masthead 150 / footer 36 — Chromium kept Letter width even with
//      @page size:A4 landscape, so budgets use the SMALLER paper) -------
const box = unq(evalJs(`(function(){
  var cards=[].slice.call(document.querySelectorAll('[data-job]'));
  if(!cards.length) return 'NOCARDS';
  var P=40, x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  cards.forEach(function(c){
    var x=parseFloat(c.style.left)||0, y=parseFloat(c.style.top)||0;
    x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x+220); y1=Math.max(y1,y+96);
  });
  x0-=P; y0-=P; x1+=P; y1+=P;
  var w=x1-x0, h=y1-y0;
  var z=Math.min(1, 960/w, (700-150)/h);
  var ws=document.querySelector('[data-canvas=workspace]');
  ws.style.setProperty('--pw', w+'px');
  ws.style.setProperty('--ph', h+'px');
  ws.style.setProperty('--pmx', x0+'px');
  ws.style.setProperty('--pmy', y0+'px');
  ws.style.setProperty('--pz', z);
  return 'BOX:'+Math.round(w)+'x'+Math.round(h)+' z:'+z.toFixed(3);
})()`));
console.log("world:", box);

// ---- inject candidate print CSS ------------------------------------------
evalJs(`(function(){
  var st=document.createElement('style'); st.id='t72probe';
  st.textContent = "@media print {"+
    " html, body { height:auto !important; overflow:visible !important; }"+
    " body > div { display:block !important; height:auto !important; }"+
    " main { display:block !important; height:auto !important; min-height:0 !important; }"+
    " [data-canvas=viewport] { overflow:visible !important; height:auto !important; }"+
    " [data-canvas=workspace] { position:static !important; transform:scale(var(--pz,1)) !important; transform-origin:0 0;"+
    "   margin-left:calc(var(--pmx,0px) * var(--pz,1) * -1); margin-top:calc(var(--pmy,0px) * var(--pz,1) * -1);"+
    "   width:calc(var(--pw,0px) * var(--pz,1)) !important; height:calc(var(--ph,0px) * var(--pz,1)) !important; }"+
    " [data-job] .job-card-title-probe, [data-job] p.truncate { white-space:normal !important; overflow:visible !important; text-overflow:unset !important; }"+
    " @page { size:A4 landscape; margin:12mm; }"+
    " }";
  document.head.appendChild(st);
  var f=document.createElement('div'); f.id='t72foot';
  f.style.cssText='position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:space-between;font:9px sans-serif;color:#555;border-top:1px solid #bbb;padding-top:2px;';
  f.innerHTML='<span>T72-FOOTER-LEFT CryoFlow — Main · QA Sandbox C</span><span>T72-FOOTER-RIGHT Sep 9 2026</span>';
  document.body.appendChild(f);
  return 'injected';
})()`);

sh(`${AB} pdf ${OUT}`);
const raw = readFileSync(OUT).toString("latin1");
const counts = [...raw.matchAll(/\/Count (\d+)/g)].map((m) => +m[1]);
const pages = Math.max(...counts);
console.log("pdf bytes:", raw.length, "pages:", pages);

const full = execSync(`pdftotext ${OUT} -`, { encoding: "utf8" }).replace(/\s+/g, "");
const names = ["3DAuto-Refine1", "3DClassification1", "QAClass2DSource", "QAClassSelect", "QAPost320", "QAPost385", "QAPost300", "QARefine410", "QARefineLive"];
let missing = 0;
for (const n of names) if (!full.includes(n)) { console.log("MISSING:", n); missing++; }
console.log("F3 names:", names.length - missing, "/", names.length);
console.log("F4 footer:", full.includes("T72-FOOTER-LEFT") && full.includes("T72-FOOTER-RIGHT"));

// ---- raster checks: landscape + origin alignment -------------------------
rmSync(PPM, { recursive: true, force: true }); mkdirSync(PPM, { recursive: true });
sh(`pdftoppm -gray -r 100 ${OUT} ${PPM}/p`);
const files = readdirSync(PPM).sort();
console.log("rasters:", files.join(","));
const pgm = readFileSync(`${PPM}/${files[0]}`);
let i = 2; const vals = [];
while (vals.length < 3) {
  while (pgm[i] === 32 || pgm[i] === 10 || pgm[i] === 13 || pgm[i] === 9) i++;
  if (pgm[i] === 35) { while (pgm[i] !== 10) i++; continue; }
  let j = i; while (!(pgm[j] === 32 || pgm[j] === 10 || pgm[j] === 13 || pgm[j] === 9)) j++;
  vals.push(parseInt(pgm.toString("latin1", i, j))); i = j;
}
i++;
const [w, h] = vals;
const px = pgm.subarray(i);
console.log(`F1 raster: ${w}x${h} landscape=${w > h}`);
// first/last ink columns & rows (content origin alignment)
let firstCol = -1, firstRow = -1, lastCol = -1, lastRow = -1;
for (let y = 0; y < h && firstRow < 0; y++)
  for (let x = 0; x < w; x++) if (px[y * w + x] < 128) { firstRow = y; break; }
for (let x = 0; x < w && firstCol < 0; x++)
  for (let y = 0; y < h; y++) if (px[y * w + x] < 128) { firstCol = x; break; }
for (let y = h - 1; y >= 0 && lastRow < 0; y--)
  for (let x = 0; x < w; x++) if (px[y * w + x] < 128) { lastRow = y; break; }
for (let x = w - 1; x >= 0 && lastCol < 0; x--)
  for (let y = 0; y < h; y++) if (px[y * w + x] < 128) { lastCol = x; break; }
console.log(`F5 ink bbox: col ${firstCol}..${lastCol}, row ${firstRow}..${lastRow} (page ${w}x${h})`);
rmSync(PPM, { recursive: true, force: true });
