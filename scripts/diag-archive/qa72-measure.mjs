// t72-measure — apply the candidate print rules ON SCREEN (media swapped)
// and measure the flow chain to find what overflows the paper content box.
import { execSync } from "node:child_process";
const AB = "agent-browser";
const sh = (c) => execSync(c, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (e) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: e }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");

sh(`${AB} close`); await sleep(800);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open http://localhost:3000`);
await sleep(5000);
// ensure canvas view
for (let i = 0; i < 8; i++) {
  const p = unq(evalJs(`(function(){ var c=!!document.querySelector('[data-canvas=workspace]'); var d=!!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard'); return (c?'CANVAS':'NO')+(d?'+DASH':''); })()`));
  if (p.includes("CANVAS")) break;
  if (p.includes("DASH")) evalJs(`(function(){ window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true })); return 1; })()`);
  await sleep(1500);
}
// bounds + zoom (same as probe)
evalJs(`(function(){
  var cards=[].slice.call(document.querySelectorAll('[data-job]'));
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
  return 1;
})()`);
const rep = unq(evalJs(`(function(){
  var st=document.createElement('style'); st.id='t72m';
  st.textContent = "@media screen {"+
    " html, body { height:auto !important; overflow:visible !important; }"+
    " body > div { display:block !important; height:auto !important; }"+
    " main { display:block !important; height:auto !important; min-height:0 !important; }"+
    " [data-canvas=viewport] { overflow:visible !important; height:auto !important; }"+
    " [data-canvas=workspace] { position:static !important; transform:scale(var(--pz,1)) !important; transform-origin:0 0;"+
    "   margin-left:calc(var(--pmx,0px) * var(--pz,1) * -1); margin-top:calc(var(--pmy,0px) * var(--pz,1) * -1);"+
    "   width:calc(var(--pw,0px) * var(--pz,1)) !important; height:calc(var(--ph,0px) * var(--pz,1)) !important; }"+
    " }";
  document.head.appendChild(st);
  function h(el){ return el ? Math.round(el.getBoundingClientRect().height) : -1; }
  var ws=document.querySelector('[data-canvas=workspace]');
  var sec=document.querySelector('[data-canvas=viewport]');
  var m=document.querySelector('main');
  var root=document.body.firstElementChild;
  var mast=document.querySelector('header[data-print-doc]');
  var tall=[];
  [].slice.call(document.body.querySelectorAll('*')).forEach(function(el){
    var r=el.getBoundingClientRect();
    if (r.bottom > 950 || r.height > 850) {
      var cls=(el.className && el.className.baseVal!==undefined)?el.className.baseVal:String(el.className||'');
      tall.push(el.tagName+'.'+String(cls).slice(0,60)+' h'+Math.round(r.height)+' bottom'+Math.round(r.bottom));
    }
  });
  return JSON.stringify({
    html: h(document.documentElement), body: h(document.body),
    root: h(root), main: h(m), sec: h(sec), ws: h(ws),
    wsBottom: ws ? Math.round(ws.getBoundingClientRect().bottom) : -1,
    wsTop: ws ? Math.round(ws.getBoundingClientRect().top) : -1,
    wsStyleHeight: ws ? ws.style.height : '',
    mast: h(mast), scrollH: document.body.scrollHeight,
    tall: tall.slice(0, 14)
  });
})()`));
console.log("measure:", rep);
