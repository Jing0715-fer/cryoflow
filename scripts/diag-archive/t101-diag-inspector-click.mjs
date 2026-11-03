// diag — why does qa61's card click fail on a fresh page?
// Matrix: {fresh-open +6s, +16s} × {near card (QA Refine3D), far card (seeded host)}
import { execSync } from "node:child_process";

const AB = "agent-browser";
const B = "http://localhost:3000";
const sh = (cmd, opts) => execSync(cmd, { encoding: "utf8", timeout: 60_000, ...opts }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => sh(`${AB} eval --stdin`, { input: expr }).trim();

const WS = JSON.parse(sh(`curl -s ${B}/api/workspaces`)).workspaces[0].id;
const created = JSON.parse(sh(`curl -s -X POST ${B}/api/jobs -H "Content-Type: application/json" -d '{"type":"refine3d","workspaceId":"${WS}","x":140,"y":3200}'`));
const host = created.job ?? created;
sh(`node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.job.update({where:{id:'${host.id}'},data:{status:'completed',progress:100}}).then(()=>p.\\$disconnect())"`);
const st = JSON.parse(sh(`curl -s ${B}/api/jobs`)).jobs.find(j => j.id === host.id).status;
console.log("host:", host.name, host.id, "status=" + st);

try {
  sh(`${AB} open ${B}`);
  const click = (pfx) => evalJs(`(() => {
    const el = [...document.querySelectorAll('[role=button]')].find(x => (x.getAttribute('aria-label')||'').startsWith(${JSON.stringify(pfx)}));
    if (!el) return 'NO-CARD:' + ${JSON.stringify(pfx)};
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, button: 0, isPrimary: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, button: 0, isPrimary: true }));
    const r = el.getBoundingClientRect();
    return 'clicked ' + el.getAttribute('aria-label').slice(0, 22) + ' @' + Math.round(r.x) + ',' + Math.round(r.y);
  })()`);
  const dlgs = () => evalJs(`(() => JSON.stringify([...document.querySelectorAll('[role=dialog]')].map(d => (d.textContent||'').slice(0, 40))))()`);
  const esc = () => evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 'esc'`);

  await sleep(6000);
  console.log("t+6s  near:", click("QA Refine3D"));
  await sleep(1500); console.log("      dlgs:", dlgs());
  await esc(); await sleep(800);

  console.log("t+9s  far:", click(host.name));
  await sleep(1500); console.log("      dlgs:", dlgs());
  await esc(); await sleep(800);

  await sleep(7000); // t+16s-ish
  console.log("t+16s far:", click(host.name));
  await sleep(1500); console.log("      dlgs:", dlgs());

  console.log("cards on page:", evalJs(`[...document.querySelectorAll('[role=button]')].filter(x => (x.getAttribute('aria-label')||'').includes('—')).length`));
} finally {
  try { sh(`${AB} close`); } catch {}
  const code = sh(`curl -s -X DELETE ${B}/api/jobs/${host.id} -o /dev/null -w "%{http_code}"`);
  console.log("host cleanup:", code);
}
